/*
 * vollbild.js – Das Vollbild im Browser, das bleibt.
 * ---------------------------------------------------------------------------
 * Ein Browser verlässt das Vollbild bei jedem Seitenwechsel: Wer es im Spiel
 * einschaltet und danach zur Hall of Fame zurückgeht, stand bisher wieder mit
 * Adressleiste da. Die installierte App kennt das nicht – und so soll es sich
 * auch im Browser anfühlen.
 *
 * Deshalb wechselt im Vollbild nicht mehr die Seite, sondern nur ihr Inhalt:
 * Die Seite, auf der das Vollbild eingeschaltet wurde, bleibt stehen, und ab
 * dem nächsten Weg öffnet sich alles in einem Fenster, das sie ganz ausfüllt
 * (der Rahmen). Das Vollbild gehört der äusseren Seite und bleibt, bis man es
 * selbst beendet – mit dem Knopf, mit Esc oder mit der Zurück-Geste.
 *
 * Man merkt den Rahmen nicht: Die Adresse oben wandert mit (wer neu lädt,
 * landet, wo er war), der Name im Tab auch, und der Zurück-Weg des Browsers
 * führt Seite um Seite zurück, bis auf die erste. Wer das Vollbild verlässt,
 * bleibt im Rahmen; erst ein Neuladen räumt ihn weg.
 *
 * Alle Seiten tragen dieses Skript, auch die im Rahmen und das Spiel im
 * Fenster des Adminbereichs. Ihr Knopf schaltet immer das Vollbild der
 * äussersten Seite: Dort sitzt es, und nur dort überdauert es einen Wechsel.
 *
 * Nicht in der installierten App – die steht ohnehin ohne Browser da und holt
 * sich ihr Vollbild selbst (pwa.js). Und nicht auf dem iPhone: Safari lässt
 * eine Seite dort gar nicht ins Vollbild; dann gibt es keinen Knopf.
 *
 *   LernappVollbild.knopf(klasse)   ein Knopf, der es ein- und ausschaltet
 *                                   (null, wo es keines gibt)
 *   LernappVollbild.an()            ob gerade Vollbild ist
 *   LernappVollbild.imRahmen()      ob diese Seite im Rahmen steht
 *   LernappVollbild.weiter(adresse, { ersetzen })
 *                                   für Wege, die ein Skript geht: im
 *                                   Vollbild in den Rahmen, sonst wie immer
 */
(() => {
  // Die äusserste Seite. Alle kommen von derselben Adresse – wäre es doch
  // einmal eine fremde, gälte diese hier als äusserste.
  const oben = (() => {
    try { return window.top.document ? window.top : window; } catch { return window; }
  })();
  const zuoberst = oben === window;
  const dok = oben.document;

  const erlaubt = () => Boolean(dok.fullscreenEnabled || dok.webkitFullscreenEnabled);
  const an = () => Boolean(dok.fullscreenElement || dok.webkitFullscreenElement);

  // Als App geöffnet? Beim Laden gefragt: Später holt sich die App ihr
  // Vollbild selbst und sähe dann aus wie ein Browser im Vollbild. Und
  // umgekehrt meldet ein Browser im Vollbild "display-mode: fullscreen" wie
  // eine App – darum zählt das nur, solange niemand das Vollbild verlangt hat.
  const app = (() => {
    try {
      if (oben.navigator.standalone === true) return true;
      const passt = (frage) => Boolean(oben.matchMedia?.(frage).matches);
      if (passt("(display-mode: standalone)") || passt("(display-mode: minimal-ui)")) return true;
      return passt("(display-mode: fullscreen)") && !an();
    } catch { return false; }
  })();

  const nutzbar = () => !app && erlaubt();

  function umschalten() {
    try {
      if (an()) {
        (dok.exitFullscreen || dok.webkitExitFullscreen)?.call(dok)?.catch?.(() => {});
      } else {
        const wurzel = dok.documentElement;
        (wurzel.requestFullscreen || wurzel.webkitRequestFullscreen)?.call(wurzel, { navigationUI: "hide" })?.catch?.(() => {});
      }
    } catch { /* Der Browser wollte nicht – dann bleibt es, wie es ist. */ }
  }

  // Das Vollbild wechselt nur auf der äussersten Seite. Die Seiten darin
  // erfahren es von ihr – mit einem eigenen Ereignis an ihrem Dokument.
  const WECHSEL = "lernapp-vollbild";
  function verteile(fenster) {
    try { fenster.document.dispatchEvent(new fenster.Event(WECHSEL)); } catch { /* fremdes Fenster */ }
    for (let i = 0; i < fenster.frames.length; i += 1) verteile(fenster.frames[i]);
  }
  if (zuoberst) {
    ["fullscreenchange", "webkitfullscreenchange"].forEach((typ) => document.addEventListener(typ, () => verteile(window)));
  }

  // ---------------------------------------------------------------------------
  // Der Knopf
  // ---------------------------------------------------------------------------
  const PFADE = {
    rein: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
    raus: "M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5",
  };

  function knopf(klasse) {
    if (!nutzbar()) return null;
    const node = document.createElement("button");
    node.type = "button";
    node.className = klasse;
    const NS = "http://www.w3.org/2000/svg";
    const bild = document.createElementNS(NS, "svg");
    bild.setAttribute("viewBox", "0 0 24 24");
    bild.setAttribute("aria-hidden", "true");
    const weg = document.createElementNS(NS, "path");
    [["fill", "none"], ["stroke", "currentColor"], ["stroke-width", "2.4"],
      ["stroke-linecap", "round"], ["stroke-linejoin", "round"]].forEach(([k, w]) => weg.setAttribute(k, w));
    bild.append(weg);
    node.append(bild);
    const zeichne = () => {
      const ist = an();
      const wort = ist ? "Vollbild beenden" : "Vollbild";
      weg.setAttribute("d", ist ? PFADE.raus : PFADE.rein);
      node.title = wort;
      node.setAttribute("aria-label", wort);
      node.setAttribute("aria-pressed", ist ? "true" : "false");
    };
    node.addEventListener("click", () => {
      umschalten();
      // Die Spiele überhören Leertaste und Enter, solange ein Knopf den
      // Fokus hat. Nach dem Tipp aufs Vollbild gehört die Taste wieder dem
      // Spiel.
      node.blur();
    });
    document.addEventListener(WECHSEL, zeichne);
    zeichne();
    return node;
  }

  // ---------------------------------------------------------------------------
  // Der Rahmen
  // ---------------------------------------------------------------------------
  let rahmen = null;

  const imRahmen = () => {
    try { return Boolean(window.frameElement?.hasAttribute("data-vollbild-rahmen")); } catch { return false; }
  };

  // Adresse und Name der Seite im Rahmen nach oben übernehmen.
  function nachziehen() {
    if (!rahmen) return;
    try {
      const innen = rahmen.contentWindow;
      const adresse = innen.location.href;
      if (/^https?:/.test(adresse) && adresse !== window.location.href) {
        window.history.replaceState(window.history.state, "", adresse);
      }
      const name = innen.document.title;
      if (name && name !== document.title) document.title = name;
    } catch { /* fremde Seite – dann bleibt oben, was war */ }
  }

  function beobachte() {
    try {
      const innen = rahmen.contentWindow;
      innen.navigation?.addEventListener?.("currententrychange", nachziehen);
      innen.addEventListener("hashchange", nachziehen);
      innen.addEventListener("popstate", nachziehen);
      // Die Turnierseite setzt ihren Namen erst, wenn sie das Turnier kennt.
      const titel = innen.document.querySelector("title");
      if (titel) new MutationObserver(nachziehen).observe(titel, { childList: true, characterData: true, subtree: true });
    } catch { /* fremde Seite */ }
  }

  function leite(adresse, ersetzen) {
    try {
      const innen = rahmen.contentWindow.location;
      if (ersetzen) innen.replace(adresse); else innen.assign(adresse);
    } catch { rahmen.src = adresse; }
  }

  // Die Seite wird zum Rahmen. Was sie zeigte, tritt ab: Die Spiele halten
  // bei pagehide ihre Schleife an, der Ton verstummt, und was noch ein Bild
  // zeichnen wollte, kommt nicht mehr dran – sonst liefe hinter dem neuen
  // Spiel das alte unsichtbar weiter und kostete es Bilder.
  function umziehen(adresse, ersetzen) {
    try { window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })); }
    catch { try { window.dispatchEvent(new Event("pagehide")); } catch { /* egal */ } }
    try { window.LernappKids?.stille?.(); } catch { /* egal */ }
    try {
      const letztes = window.requestAnimationFrame(() => {});
      for (let i = Math.max(1, letztes - 64); i <= letztes; i += 1) window.cancelAnimationFrame(i);
    } catch { /* egal */ }
    window.requestAnimationFrame = () => 0;

    // Ein eigener Eintrag für den Weg hierher: Zurück führt auf die Seite,
    // auf der das Vollbild begann.
    if (ersetzen) window.history.replaceState(null, "", adresse);
    else window.history.pushState(null, "", adresse);

    const fenster = document.createElement("iframe");
    fenster.setAttribute("data-vollbild-rahmen", "");
    fenster.setAttribute("allow", "fullscreen; autoplay");
    fenster.setAttribute("allowfullscreen", "");
    fenster.title = "alae arcade";
    fenster.style.cssText = "position:fixed;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;"
      + "display:block;background:#f7f3ff;z-index:2147483647";
    const koerper = document.body;
    [...koerper.attributes].forEach((a) => koerper.removeAttribute(a.name));
    koerper.style.cssText = "margin:0;overflow:hidden;background:#f7f3ff";
    document.documentElement.style.overflow = "hidden";
    koerper.replaceChildren(fenster);
    rahmen = fenster;
    fenster.addEventListener("load", () => {
      nachziehen();
      beobachte();
      try { fenster.contentWindow.focus(); } catch { /* egal */ }
    });
    fenster.src = adresse;

    // Zurück bis auf die erste Seite: Der Browser springt dann oben zurück,
    // und der Rahmen zeigt, was die Adresse sagt.
    window.addEventListener("popstate", () => {
      try {
        if (rahmen.contentWindow.location.href !== window.location.href) leite(window.location.href, true);
      } catch { /* egal */ }
    });
  }

  // Ob ein Weg dieser Seite in den Rahmen gehört – und wenn ja, ihn gehen.
  function abfangen(adresse, ersetzen, neuLaden = false) {
    if (!zuoberst || app) return false;
    if (!rahmen && !an()) return false;
    let ziel;
    try { ziel = new URL(adresse, window.location.href); } catch { return false; }
    if (ziel.origin !== window.location.origin) return false;
    if (rahmen) {
      if (neuLaden) { try { rahmen.contentWindow.location.reload(); } catch { /* egal */ } }
      else leite(ziel.href, ersetzen);
      return true;
    }
    // Nur ein anderer Anker auf derselben Seite: Das bleibt diese Seite.
    if (!neuLaden && ziel.pathname === window.location.pathname && ziel.search === window.location.search && ziel.hash) return false;
    umziehen(ziel.href, ersetzen || neuLaden);
    return true;
  }

  if (zuoberst && !app) {
    if (window.navigation?.addEventListener) {
      // Jeder Weg – ein Link, ein Skript, das die Adresse setzt, das
      // Neuladen nach einer neuen Fassung (pwa.js).
      window.navigation.addEventListener("navigate", (e) => {
        if (!e.cancelable || e.hashChange || e.downloadRequest != null || e.formData) return;
        if (e.navigationType === "traverse" || e.destination.sameDocument) return;
        const neuLaden = e.navigationType === "reload";
        if (abfangen(e.destination.url, e.navigationType === "replace", neuLaden)) e.preventDefault();
      });
    } else {
      // Ältere Browser: wenigstens die Links. Was ein Skript ansteuert, geht
      // über weiter().
      document.addEventListener("click", (e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const link = e.target?.closest?.("a[href]");
        if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
        if (abfangen(link.href, false)) e.preventDefault();
      });
    }
  }

  // Ein Weg, den ein Skript geht. Im Rahmen geht er im Rahmen – das tut er
  // von selbst; auf der äussersten Seite im Vollbild wird sie zum Rahmen.
  function weiter(adresse, { ersetzen = false } = {}) {
    if (abfangen(adresse, ersetzen)) return;
    if (ersetzen) window.location.replace(adresse); else window.location.assign(adresse);
  }

  // Im Rahmen meldet sich die Seite gleich, nicht erst, wenn alle Bilder da
  // sind: Dann steht oben schon ihre Adresse.
  if (imRahmen()) {
    try { window.parent.LernappVollbild?.nachziehen?.(); } catch { /* egal */ }
  }

  window.LernappVollbild = {
    knopf, an, umschalten, imRahmen, weiter, nachziehen,
    nutzbar,
    // Das Fenster, in dem die Seiten wechseln – null, solange es keines gibt.
    rahmen: () => rahmen,
  };
})();
