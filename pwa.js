/*
 * pwa.js – Die Mini-Games als eigene App.
 * ---------------------------------------------------------------------------
 * Meldet den Service Worker an, hält eine neue Fassung bereit (und lädt sie
 * erst nach, wenn gerade keine Runde läuft), und hebt das Ereignis auf, mit
 * dem der Browser meldet, dass sich die Seite installieren lässt – den
 * Hinweis dazu zeigt mini-games.js auf der Übersicht, nicht über einem
 * laufenden Spiel.
 *
 * Der Service Worker liegt neben den Seiten im Wurzelverzeichnis; sein
 * Bereich ist damit die ganze Site.
 */
(() => {
  const displayModeQueries = ["(display-mode: standalone)", "(display-mode: fullscreen)"];
  const UPDATE_CHECK_INTERVAL = 60 * 1000;
  let lastUpdateCheck = 0;
  let hasController = "serviceWorker" in navigator && Boolean(navigator.serviceWorker.controller);
  let refreshing = false;
  // Eine neue Fassung wartet, aber gerade läuft etwas, das kein Neuladen
  // verträgt.
  let pendingReload = false;

  function isStandaloneMode() {
    return displayModeQueries.some((query) => window.matchMedia(query).matches) || window.navigator.standalone === true;
  }

  function updateStandaloneMode() {
    document.documentElement.classList.toggle("standalone-mode", isStandaloneMode());
  }

  function watchDisplayMode(query) {
    const mediaQuery = window.matchMedia(query);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateStandaloneMode);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(updateStandaloneMode);
    }
  }

  updateStandaloneMode();
  window.addEventListener("pageshow", updateStandaloneMode);
  displayModeQueries.forEach(watchDisplayMode);

  // Vollbild ohne Statusleiste und ohne die Knöpfe des Geräts. Das Manifest
  // verlangt "fullscreen" – eine schon installierte App behält aber ihr altes
  // Manifest, bis der Browser es Tage später nachlädt. Bis dahin holt sich die
  // Seite das Vollbild bei der ersten Berührung selbst. Nur in der
  // installierten App: im Browser wäre ein Sprung ins Vollbild eine
  // Überraschung, um die niemand gebeten hat.
  function wantsFullscreen() {
    if (window.matchMedia("(display-mode: fullscreen)").matches) return false;
    if (document.fullscreenElement || !document.fullscreenEnabled) return false;
    return window.matchMedia("(display-mode: standalone)").matches
      || window.matchMedia("(display-mode: minimal-ui)").matches;
  }

  function enterFullscreen() {
    if (!wantsFullscreen()) return;
    try {
      const request = document.documentElement.requestFullscreen({ navigationUI: "hide" });
      if (request && typeof request.catch === "function") request.catch(() => {});
    } catch { /* nicht erlaubt – dann bleibt es beim Stand des Manifests */ }
  }

  // Erst eine Berührung erlaubt das Vollbild; ein Tippen auf dem Bildschirm
  // zählt als touchend und click, eine Taste als keydown.
  ["click", "touchend", "keydown"].forEach((type) => {
    document.addEventListener(type, enterFullscreen, { capture: true, passive: true });
  });

  // Ob gerade etwas läuft, das ein Neuladen zerstören würde: eine Runde im
  // Spiel. Ein Neuladen mitten darin sieht aus, als stürze die App ab – und es
  // träfe ausgerechnet den Moment nach einer Runde, weil dann nach neuen
  // Fassungen gesucht wird. game-shell.js meldet über window.LernappBusy, wann
  // das ist.
  function appBusy() {
    try { return Boolean(window.LernappBusy && window.LernappBusy()); }
    catch { return false; }
  }

  // Aufgeschoben, nicht aufgehoben: sobald die Seite aus dem Blick ist – beim
  // Wechsel in ein Spiel, beim Weglegen des Geräts –, wird nachgeholt. Dort
  // sieht niemand etwas davon, und beim Zurückkommen steht die neue Fassung.
  function reloadForUpdate() {
    if (refreshing) return;
    if (appBusy()) { pendingReload = true; return; }
    refreshing = true;
    window.location.reload();
  }

  function reloadWhenHidden() {
    if (!pendingReload || refreshing || document.visibilityState !== "hidden") return;
    refreshing = true;
    window.location.reload();
  }
  document.addEventListener("visibilitychange", reloadWhenHidden);
  window.addEventListener("pagehide", reloadWhenHidden);

  function activateWaitingWorker(registration) {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  }

  function watchForWorkerUpdates(registration) {
    activateWaitingWorker(registration);
    registration.addEventListener("updatefound", () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener("statechange", () => {
        if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
          installingWorker.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });
  }

  function checkForUpdates(registration) {
    const now = Date.now();
    if (now - lastUpdateCheck < UPDATE_CHECK_INTERVAL) return;

    lastUpdateCheck = now;
    registration.update().then(() => activateWaitingWorker(registration)).catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // Auf den Startbildschirm
  // ---------------------------------------------------------------------------
  // Chrome und Edge (Android wie Desktop) melden mit beforeinstallprompt, dass
  // die App installierbar ist – und zeigen ohne unser Zutun irgendwann eine
  // eigene Leiste. Wir fangen das Ereignis ab und heben es auf: der Vorschlag
  // soll erst kommen, wenn das Kind seinen ersten Wagenschritt geschafft hat,
  // nicht beim ersten Öffnen einer fremden Seite. Safari auf dem iPhone kennt
  // das Ereignis nicht; dort bleibt nur die Anleitung "Teilen → Zum
  // Home-Bildschirm". Wer den Link aus Instagram oder Facebook öffnet, sitzt
  // in deren eingebautem Browser, und der kann das gar nicht – dann heisst der
  // erste Schritt: in Safari öffnen.
  const INSTALL_HINT_KEY = "mini.install.hinweis";
  let deferredInstallPrompt = null;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    try { localStorage.setItem(INSTALL_HINT_KEY, "installiert"); } catch { /* privater Modus */ }
  });

  function installPlatform() {
    const ua = navigator.userAgent || "";
    // iPadOS meldet sich seit Version 13 als Mac – mit Touch verrät es sich.
    const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (ios) {
      // Die eingebauten Browser von Instagram, Facebook, Messenger, LinkedIn.
      if (/Instagram|FBAN|FBAV|FB_IAB|Messenger|LinkedInApp/i.test(ua)) return "ios-inapp";
      // Chrome und Firefox auf iOS können auch nicht installieren – nur Safari.
      if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return "ios-anderer-browser";
      return "ios-safari";
    }
    if (deferredInstallPrompt) return "prompt";
    return "keine";
  }

  function installHintState() {
    try { return localStorage.getItem(INSTALL_HINT_KEY) || ""; } catch { return ""; }
  }

  window.LernappInstall = {
    isStandalone: isStandaloneMode,
    // Ob ein Hinweis überhaupt Sinn hat: nicht installiert, nicht schon
    // gezeigt, und auf einer Plattform, für die wir etwas zu sagen haben.
    hintWanted() {
      if (isStandaloneMode()) return false;
      if (installHintState()) return false;
      return installPlatform() !== "keine";
    },
    platform: installPlatform,
    markHintShown() {
      try { localStorage.setItem(INSTALL_HINT_KEY, "gezeigt"); } catch { /* privater Modus */ }
    },
    canPrompt: () => Boolean(deferredInstallPrompt),
    // Löst den Dialog des Browsers aus. Geht nur einmal je aufgehobenem
    // Ereignis – danach ist es verbraucht, ob angenommen oder nicht.
    async prompt() {
      const event = deferredInstallPrompt;
      if (!event) return "unmoeglich";
      deferredInstallPrompt = null;
      try {
        event.prompt();
        const choice = await event.userChoice;
        return choice && choice.outcome === "accepted" ? "angenommen" : "abgelehnt";
      } catch {
        return "unmoeglich";
      }
    },
  };

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hasController) reloadForUpdate();
      hasController = true;
    });

    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "APP_UPDATED") {
        reloadForUpdate();
      }
    });

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js", { scope: "./", updateViaCache: "none" }).then((registration) => {
        watchForWorkerUpdates(registration);
        checkForUpdates(registration);
        window.addEventListener("pageshow", () => checkForUpdates(registration));
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") checkForUpdates(registration);
        });
      }).catch(() => {});
    });
  }
})();
