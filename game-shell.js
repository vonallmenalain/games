/*
 * game-shell.js – Die gemeinsame Bühne der Mini-Games.
 *
 * Die Knöpfe oben links, ein Zähler oben rechts,
 * wahlweise ein Zeitbalken darunter, und am Schluss das Ergebnis mit der
 * Bestenliste. Alles, was ein Spiel um einen Punktestand gleich braucht – und
 * nichts vom Spiel selbst.
 *
 * Das Spiel bekommt eine Fläche in der Mitte und ein paar Handgriffe:
 *   setCount(n)      Zähler oben rechts
 *   startClock(ms)   Uhr starten; sie meldet sich, wenn die Zeit um ist.
 *                    startClock(rest, fertig, gesamt): mitten in einer Runde
 *                    einsteigen – der Balken steht dann bei rest / gesamt
 *   showResult(...)  Ergebnis mit "noch einmal" und dem Weg zu den anderen.
 *                    Wer seinen Lauf aufzeichnet (geist.js), gibt ihn als
 *                    geist mit; er wird zusammen mit der Punktzahl
 *                    eingetragen.
 *
 * In der App steht dieselbe Bühne in einem Zug: Dort führt oben links ein
 * Haus auf das Startbild, ein Pfeil zurück in die Spielauswahl, am Schluss
 * stehen die eigenen fünf besten Runden und darunter, wie weit es noch bis
 * zum nächsten Wagen ist – und vor der zweiten Runde steht ein Tor, wenn
 * niemand gekauft hat.
 *
 * Hier gibt es nichts davon: kein Zuhause, keine Auswahl, keinen Wagen, keine
 * Schranke. Wer hier ist, hat einen Link angeklickt. Er sieht seine Zahl, und
 * daneben alle anderen Zahlen (mini-games.js).
 *
 * Die Uhr ist wahlweise: Karten-Merker läuft gegen sie, Strand-Schätze läuft
 * ohne. Wo sie läuft, läuft sie nach der Wanduhr, nicht nach Zeitgeber-
 * Schritten. Ein Tab im Hintergrund bekommt seine Zeitgeber gedrosselt oder
 * gar nicht mehr; wer beim Zurückkommen weiterrechnete, sässe in einer Runde
 * ohne Ende.
 */
(() => {
  "use strict";

  const art = () => window.LernappTrainArt || null;
  const mini = () => window.LernappMini || null;
  const klang = () => window.ArcadeKlang || null;
  // Das Turnier, aber nur, wenn diese Seite in einem gespielt wird
  // (?turnier= in der Adresse). Sonst ist hier alles wie immer.
  const turnier = () => (window.LernappTurnier?.aufSpielseite?.() ? window.LernappTurnier : null);
  // Der Live-Modus, aber nur, wenn diese Seite eine Runde eines Live-Abends
  // ist (live-spiel.js). Dann startet die Runde zur Serverzeit statt auf
  // einen Tipp, und es gibt sie nur einmal.
  const live = () => (window.LernappLiveSpiel?.aktiv?.() ? window.LernappLiveSpiel : null);

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function svg(children, extra = {}) {
    return art().el("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", ...extra }, children);
  }

  const ICONS = {
    again: () => [
      art().el("path", {
        d: "M19 12a7 7 0 1 1-2.4-5.3", fill: "none", stroke: "currentColor",
        "stroke-width": 2.4, "stroke-linecap": "round",
      }),
      art().el("polygon", { points: "19,3 19.6,8.2 14.4,7.4", fill: "currentColor" }),
    ],
    tick: () => [art().el("path", {
      d: "M5 13l4.5 4.5L19 7", fill: "none", stroke: "currentColor",
      "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round",
    })],
    // Überspringen (Testrunde): zwei Dreiecke und ein Strich.
    weiter: () => [
      art().el("path", { d: "M4 6.5v11l7.2-5.5zM11.2 6.5v11l7.2-5.5z", fill: "currentColor" }),
      art().el("path", { d: "M20.3 6.5v11", fill: "none", stroke: "currentColor", "stroke-width": 2.2, "stroke-linecap": "round" }),
    ],
    // Der Pokal: der Weg in die Hall of Fame.
    cup: () => [
      art().el("path", { d: "M7 4h10v4a5 5 0 0 1-10 0z", fill: "currentColor" }),
      art().el("path", { d: "M7 6H4.5v1.5A3.5 3.5 0 0 0 8 11M17 6h2.5v1.5A3.5 3.5 0 0 1 16 11", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round" }),
      art().el("path", { d: "M12 13v4m-3.5 3h7", fill: "none", stroke: "currentColor", "stroke-width": 2.4, "stroke-linecap": "round" }),
    ],
  };

  function iconButton(name, label, paths, onClick, extraClass = "") {
    const button = el("button", `cm-icon cm-icon-${name} ${extraClass}`.trim());
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.append(svg(paths));
    button.addEventListener("click", onClick);
    return button;
  }

  // Dasselbe als Weg statt als Knopf: Ein Ziel, das eine Adresse hat, gehört
  // an einen Link – dann kann man ihn auch in einem neuen Tab öffnen.
  function iconLink(name, label, paths, ziel, extraClass = "") {
    const link = el("a", `cm-icon cm-icon-${name} ${extraClass}`.trim());
    link.href = ziel;
    link.setAttribute("aria-label", label);
    link.title = label;
    link.append(svg(paths));
    return link;
  }

  /*
   * Der Vollbild-Knopf oben rechts, neben dem Ton-Schalter: das ganze Bild
   * für das Spiel, ohne Adressleiste und Ränder des Browsers – auch ohne die
   * App zu installieren.
   *
   * Nur wo der Browser das einer Seite erlaubt (am Computer, auf Android; auf
   * dem iPhone nicht) und nicht in der installierten App: Die steht ohnehin
   * ohne Browser da und holt sich das Vollbild selbst (pwa.js). Wo es keinen
   * Knopf gibt, rückt auch die Leiste nicht für ihn zur Seite (styles.css,
   * data-vollbild).
   *
   * Das Vollbild bleibt, bis man es selbst beendet – auch über das Ende der
   * Runde und den Weg zurück hinaus (vollbild.js). Auch im Fenster des
   * Adminbereichs steht der Knopf: Er bringt dort den ganzen Adminbereich ins
   * Vollbild, mit dem Spiel darüber.
   */
  function vollbildKnopf(host) {
    const knopf = window.LernappVollbild?.knopf?.("cm-vollbild");
    if (!knopf) return;
    host.append(knopf);
    host.dataset.vollbild = "da";
  }

  /*
   * Baut die Bühne.
   *
   *   host      das Element, in dem alles landet
   *   title     Name des Spiels – das Einzige, was oben steht
   *   onRestart was der Neu-Knopf tut
   *
   * area, accent, accentDark und onBack kommen aus der App mit. Die Farben
   * gelten auch hier; area und onBack führten dort in die Spielauswahl, die es
   * hier nicht gibt – sie bleiben in der Liste, damit sich ein Spiel
   * unverändert herüberkopieren lässt.
   *
   *   live      { los, stopp, zuschauen } für den Live-Modus (live-spiel.js):
   *             los beginnt die Runde ohne Tipp, stopp beendet sie, wenn die
   *             Zeit des Live-Abends um ist, zuschauen zeigt ab jetzt eine
   *             fremde Figur (nur Spiele mit Figur im Bild). Ohne los beginnt
   *             die Runde mit onRestart.
   */
  function mount({ host, title, accent, accentDark, onRestart, clock = true, live: liveHaken = null }) {
    host.style.setProperty("--cm-accent", accent);
    host.style.setProperty("--cm-accent-dark", accentDark);
    host.innerHTML = "";
    host.dataset.phase = "intro";
    // Für pwa.js: eine laufende Runde verträgt kein Neuladen. Eine neue
    // Fassung wartet, bis ohnehin die Seite gewechselt wird.
    window.LernappBusy = () => host.dataset.phase === "play";

    // Keine Landschaft dahinter. In der App steht das Spiel vor der Landschaft,
    // die das Kind ausgewählt hat; hier ist das Spiel das ganze Bild
    // (styles.css, Die Bühne) – von einer Landschaft sähe man nichts mehr.

    // --- Neu anfangen ---------------------------------------------------------
    // Über den Knopf oben (mitten in der Runde) oder nach dem Ergebnis. Im
    // Turnier fragt erst turnier.js: Eine angefangene Runde ist dort ein
    // gebrauchter Versuch, und wer keinen mehr hat, bekommt die Tafel statt
    // einer neuen Runde.
    function neuStart(mitten = false) {
      const los = () => { stopClock(); closeOverlay(); klang()?.stille?.(); onRestart(); };
      const t = turnier();
      if (t) t.neuStart({ mitten, los });
      else los();
    }

    // --- Leiste oben ---------------------------------------------------------
    const bar = el("div", "cm-bar");
    const left = el("div", "cm-bar-left");
    // Ein Weg hinaus – in die Hall of Fame oder, im Turnier, zurück zum
    // Turnier (mini-games.js) – und der Neu-Knopf. Im Live-Modus keines von
    // beiden: Die Runde gibt es nur einmal, und hinaus geht es über den
    // Live-Abend, in dem diese Seite steckt.
    if (!live()) {
      mini()?.leiste?.().forEach((knopf) => left.append(knopf));
      left.append(iconButton("again", "Neu starten", ICONS.again(), () => neuStart(host.dataset.phase === "play")));
    }
    bar.append(left, el("h1", "cm-title", title));

    // Dezent oben rechts: wie viel bisher geschafft ist. Beim Karten-Merker ist
    // das nicht der Punktestand – eine Zahl, die während des Spiels auch fallen
    // kann, würde mitten im Tempo entmutigen.
    const count = el("div", "cm-count");
    count.setAttribute("role", "status");
    count.setAttribute("aria-live", "polite");
    count.append(svg(ICONS.tick(), { class: "cm-count-tick" }));
    const countValue = el("span", "cm-count-value", "0");
    count.append(countValue);
    bar.append(count);
    host.append(bar);
    vollbildKnopf(host);

    // --- Zeitbalken ----------------------------------------------------------
    // Nicht jedes Spiel läuft gegen die Uhr. Ein Balken, der nie kleiner wird,
    // wäre schlimmer als keiner: er verspräche einen Zeitdruck, den es nicht
    // gibt.
    const time = el("div", "cm-time");
    time.setAttribute("aria-hidden", "true");
    const timeFill = el("span", "cm-time-fill");
    time.append(timeFill);
    if (clock) host.append(time);

    // --- Die Fläche für das Spiel -------------------------------------------
    const play = el("div", "cm-play");
    host.append(play);

    /*
     * Wie viele Pixel oben an einem Element (Vorgabe: die Spielfläche) unter
     * dem liegen, was oben schwebt: Leiste, Uhr, Gegner, Multiplayer. Auf dem
     * Handy beginnt die Spielfläche ganz oben (styles.css, Handy), und was ein
     * Spiel selbst oben ins Bild zeichnet – die Meter, die Scheibe –, rückt um
     * so viel nach unten. Sonst steht die Fläche unter der Leiste: null.
     * Gemessen, nicht gerechnet – die Gegner kommen und gehen, und quer steht
     * alles in einer Zeile. Eine Viertelsekunde gilt die letzte Messung.
     */
    const OBEN = ".cm-bar, .cm-time, .gs-leiste, .lv-leiste, .gz-leiste";
    let gemessen = { ms: -1e9, knoten: null, wert: 0 };
    function frei(knoten = play) {
      const jetzt = performance.now();
      if (gemessen.knoten === knoten && jetzt - gemessen.ms < 250) return gemessen.wert;
      let wert = 0;
      try {
        const oben = knoten.getBoundingClientRect().top;
        let unten = oben;
        host.querySelectorAll(OBEN).forEach((teil) => {
          if (teil.hidden) return;
          const r = teil.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) unten = Math.max(unten, r.bottom);
        });
        wert = Math.max(0, Math.round(unten - oben));
      } catch { wert = 0; }
      gemessen = { ms: jetzt, knoten, wert };
      return wert;
    }
    aktuell = { frei };

    // --- Uhr ------------------------------------------------------------------
    let ticker = null;
    let endsAt = 0;
    let duration = 0;
    let onTimeUp = null;

    function paintClock() {
      const rest = Math.max(0, endsAt - Date.now());
      timeFill.style.transform = `scaleX(${duration ? rest / duration : 1})`;
      return rest;
    }

    function tick() {
      if (paintClock() > 0) return;
      stopClock();
      onTimeUp?.();
    }

    function startClock(ms, callback, gesamt = ms) {
      stopClock();
      duration = gesamt;
      endsAt = Date.now() + ms;
      onTimeUp = callback;
      paintClock();
      ticker = window.setInterval(tick, 100);
    }

    function stopClock() {
      if (ticker) { window.clearInterval(ticker); ticker = null; }
    }

    // Zurück aus dem Hintergrund: sofort nachziehen. Der Browser drosselt
    // Zeitgeber in verborgenen Tabs oder hält sie ganz an – ohne dieses
    // Nachziehen liefe die Runde weiter, obwohl die Zeit längst um ist.
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && ticker) tick();
    });
    window.addEventListener("pagehide", stopClock);

    // --- Der Überzug für das Ergebnis ---------------------------------------
    let overlay = null;

    // Nur die Tafel wegnehmen: panel() baut gleich die nächste auf.
    function dropOverlay() {
      overlay?.remove();
      overlay = null;
    }

    // Zurück ins Spiel: Tafel weg.
    function closeOverlay() {
      dropOverlay();
    }

    function panel(children) {
      dropOverlay();
      overlay = el("div", "cm-overlay");
      // Wer in ein Feld auf der Tafel tippt, tippt dort und nicht im Spiel.
      // Die Spiele hören auf der ganzen Seite auf Leertaste und Enter und
      // halten sie an (preventDefault) – im Namensfeld kam deshalb kein
      // Leerzeichen an, und Enter trug nichts ein.
      ["keydown", "keyup"].forEach((typ) => overlay.addEventListener(typ, (ereignis) => {
        if (ereignis.target.closest?.("input, textarea")) ereignis.stopPropagation();
      }));
      const box = el("div", "cm-panel");
      children.forEach((child) => box.append(child));
      overlay.append(box);
      host.append(overlay);
      return box;
    }

    /*
     * Das Ergebnis am Schluss: die Zahl, ein Satz darunter, und dann das
     * Namensfeld mit der Bestenliste (mini-games.js).
     *
     * scores und note kommen aus der App mit – dort stehen darunter die
     * eigenen fünf besten Runden und der Weg zum nächsten Wagen. Hier zählt
     * die Liste, auf der die anderen stehen; zwei Bestenlisten übereinander
     * wären eine zu viel, und einen Wagen gibt es nicht.
     */
    // eintragen: false – eine Runde zum Ausprobieren (Kopfkino, Testrunde):
    // die Tafel mit Zahl und Satz, aber ohne Namensfeld und Bestenliste. Es
    // wird nichts eingetragen, und ein Rekord ist es nie.
    function showResult({ points, detail, label = "Deine Punkte", geist = null, eintragen = true }) {
      host.dataset.phase = "over";
      // Der Bestwert von vorher – bevor die Runde ihn ersetzt (mini-games.js,
      // ergebnis). Wer ihn schlägt, hört den Rekord statt der Tafel. Ohne
      // Bestwert ist die erste Runde kein Rekord: Den gäbe es umsonst.
      const vorher = Number(mini()?.bestwert?.(document.body?.dataset?.spiel || "")) || 0;
      mini()?.rundeEndet?.();
      timeFill.style.transform = "scaleX(0)";
      klang()?.stille?.();

      // Im Live-Modus keine Tafel mit «Noch einmal»: Das Ergebnis geht an
      // den Live-Abend, und live-spiel.js zeigt, wie es bei den anderen steht.
      if (live()) {
        stopClock();
        live().fertig({ punkte: points, geist });
        return;
      }

      klang()?.ton?.(eintragen && vorher > 0 && points > vorher ? "rekord" : "tafel");
      const parts = [el("p", "cm-result-label", label)];
      parts.push(el("p", "cm-result-score", String(points)));
      // Im Turnier nur die Zahl und die Liste darunter: Was das Spiel sonst
      // dazu sagt (Bestwert, Rekord auf diesem Gerät), gilt dort nicht.
      if (detail && !turnier()) parts.push(el("p", "cm-result-detail", detail));
      // Namensfeld, eigener Platz, die Liste aller. Bringt das Spiel eine
      // Aufzeichnung seines Laufs mit (geist.js, Spiele mit Uhr tun das), geht
      // sie denselben Weg wie die Punktzahl – ein Trichter, nicht zwei.
      const block = eintragen ? mini()?.ergebnis?.({ punkte: points, geist }) : null;
      if (block) parts.push(block);

      const actions = el("div", "cm-actions");
      const nochmal = iconButton("again", "Noch einmal", ICONS.again(), () => neuStart(), "big");
      actions.append(nochmal);
      // Rechts der Pokal: ein Weg, kein Knopf – er führt direkt in die Hall of
      // Fame, dieselbe Adresse wie oben in der Leiste. Im Turnier führen beide
      // zurück zum Turnier.
      const wohin = mini()?.ziel?.() || { link: "/", wort: "Hall of Fame" };
      actions.append(iconLink("cup", wohin.wort, ICONS.cup(), wohin.link, "big"));
      parts.push(actions);
      panel(parts);
      // Im Turnier gibt es "Noch einmal" nur, wenn es noch einmal geht.
      turnier()?.nochmalKnopf?.(nochmal);
    }

    // Die Tafel des Turniers, falls diese Seite in einem gespielt wird. Sie
    // bringt ihren eigenen Überzug mit; "los" ist derselbe Neustart wie der
    // Knopf oben – nur ohne Nachfrage, denn vor der Tafel lief noch nichts,
    // was zählte.
    turnier()?.anBuehne?.({ host, los: () => { stopClock(); closeOverlay(); onRestart(); } });

    // Eine Runde eines Live-Abends: Countdown, Start zur Serverzeit, Ende,
    // wenn die Zeit des Abends um ist. Oder – den Link einer Runde allein
    // geöffnet – der Weg zum Live-Abend.
    if (live()) {
      live().buehne({
        host,
        vor: play,
        los: liveHaken?.los || (() => { stopClock(); closeOverlay(); onRestart(); }),
        stopp: liveHaken?.stopp || null,
        zuschauen: liveHaken?.zuschauen || null,
        // Spiele, in denen der Finger gehalten wird (Schub, Lenken): Liegt
        // er beim «Los!» schon, gilt er ab da (live-spiel.js).
        halten: Boolean(liveHaken?.halten),
      });
    } else {
      window.LernappLiveSpiel?.zeigeVerwaist?.(host);
    }

    /*
     * Der Knopf «Überspringen» oben links, neben «Neu starten» – nur in einer
     * Testrunde (?alle: Kopfkino, Freihand, Zeitgefühl, Augenmass). Er führt
     * zur nächsten Aufgabe, ohne die jetzige zu lösen; die Taste N tut
     * dasselbe. Was er genau tut, sagt das Spiel (beiKlick).
     */
    function ueberspringen(beiKlick) {
      const knopf = iconButton("weiter", "Überspringen (N)", ICONS.weiter(), () => {
        // Der Fokus geht zurück: Sonst drückte die Leertaste den Knopf ein
        // zweites Mal, statt im Spiel zu tippen.
        knopf.blur();
        beiKlick();
      });
      left.append(knopf);
      window.addEventListener("keydown", (ereignis) => {
        if (ereignis.repeat || ereignis.key.toLowerCase() !== "n" || ereignis.ctrlKey || ereignis.metaKey || ereignis.altKey) return;
        if (ereignis.target.closest?.("input, textarea") || overlay) return;
        ereignis.preventDefault();
        beiKlick();
      });
      return knopf;
    }

    return {
      play,
      el,
      ueberspringen,
      // In der App steht hier der Auftrag der Reise, und ein Spiel startet
      // dann direkt im verlangten Level. Hier gibt es keine Reise – die Zeile
      // bleibt, damit ein Spiel, das danach fragt, unverändert läuft.
      journey: null,
      // "play" heisst: Jetzt beginnt eine Runde. Im Turnier ist das der
      // Moment, in dem der Versuch zählt (turnier.js, rundeBeginnt) – und
      // überall der, ab dem die Spielzeit läuft (mini-games.js).
      setPhase(phase) {
        if (phase === "play") {
          turnier()?.rundeBeginnt?.();
          mini()?.rundeBeginnt?.();
        }
        host.dataset.phase = phase;
        // Während der Runde: stockt das Bild? (bildpunkte, unten)
        bildMessen(phase === "play");
      },
      setCount(value) {
        countValue.textContent = String(value);
        live()?.punkte?.(value);
      },
      // Wahr, wenn diese Seite eine Runde eines Live-Abends ist. Spiele, die
      // beim Laden sofort loslegen, warten dann auf den Start (live.los).
      live: Boolean(live()),
      startClock,
      stopClock,
      showResult,
      closeOverlay,
      frei,
      clear() { play.innerHTML = ""; },
    };
  }

  // Die Bühne dieser Seite (es gibt nur eine) – für geist.js, das die Namen
  // der Geister nicht unter die Knöpfe schreiben soll.
  let aktuell = null;

  // ---------------------------------------------------------------------------
  // Flüssig vor scharf: wie fein eine Leinwand gemalt wird
  // ---------------------------------------------------------------------------
  /*
   * Nach zwei Turnierabenden im November 2026: Auf iPhones und iPads ruckelte
   * es – in Safari wie in Chrome, am stärksten im Lianenschwung –, auf
   * Android lief alles flüssig. Der Grund liegt in WebKit, das auf Apple-
   * Geräten jeder Browser ist: Eine Leinwand (canvas 2D) wird dort Bild für
   * Bild auf dem Prozessor gerastert, nicht auf der Grafikkarte. Was das
   * kostet, wächst mit der Zahl der Bildpunkte – und ein iPhone hat drei je
   * CSS-Pixel, die Spiele malten mit bis zu 2,5 (gut sechsmal so viele wie
   * mit einem). Gemessen mit Rastern auf dem Prozessor: Der Lianenschwung
   * braucht bei 2,5 rund 10 ms je Bild, bei 2 rund 6 ms.
   *
   * Darum zweierlei, für jedes Spiel, das seine Leinwand mit bildpunkte()
   * misst:
   *
   *   1. Auf iPhone und iPad höchstens 2 Bildpunkte je CSS-Pixel und
   *      höchstens APPLE_PIXEL insgesamt (ein grosses iPad hätte sonst bei 2
   *      über drei Millionen). Den Unterschied zu 3 sieht man im Spiel kaum,
   *      den Ruckler sofort.
   *   2. Wird es trotzdem zäh, wird es gröber statt langsamer – wie es zwölf
   *      Spiele schon selbst tun (gueteTakt): Während einer Runde (Bühne in
   *      «play») misst die Bühne die Abstände der Bilder. Liegen sie über gut
   *      eine Sekunde im Mittel über 24 ms (unter gut 40 Bildern je Sekunde),
   *      malt jede Leinwand ab dann mit einem Fünftel weniger Bildpunkten je
   *      Richtung, bis höchstens auf GUETE_MIN – und bleibt so für den Rest
   *      des Besuchs. Die Spiele messen ihre Leinwand in jedem Bild nach
   *      (messen), also greift das im nächsten Bild.
   *
   * Spiele mit eigenem gueteTakt holen sich nur geraetDpr() – ihr eigenes
   * Mass für «zäh» bleibt, die Obergrenze für Apple gilt auch dort.
   */
  const APPLE_MOBIL = (() => {
    try {
      const ua = navigator.userAgent || "";
      // Ein iPad meldet sich seit iPadOS 13 als Mac – aber ein Mac hat keinen
      // Touchscreen.
      return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
    } catch { return false; }
  })();
  const APPLE_DPR = 2;
  const APPLE_PIXEL = 2.2e6;
  const GUETE_MIN = 0.6;
  const bild = { guete: 1, frame: 0, letzt: 0, mittel: 1 / 60, zaeh: 0 };

  // Wie viele Bildpunkte je CSS-Pixel das Gerät hat – auf Apple-Geräten
  // höchstens APPLE_DPR.
  function geraetDpr() {
    const roh = Number(window.devicePixelRatio) || 1;
    return APPLE_MOBIL ? Math.min(roh, APPLE_DPR) : roh;
  }

  // Für eine Leinwand von cssW × cssH: so viele Bildpunkte je CSS-Pixel,
  // zwischen 1 und obergrenze (was das Spiel sich vorgenommen hat), auf
  // Apple-Geräten auch nicht mehr als APPLE_PIXEL insgesamt – mal der Güte.
  function bildpunkte(cssW, cssH, obergrenze = 2.5) {
    let dpr = Math.max(1, Math.min(geraetDpr(), obergrenze));
    const flaeche = Math.max(1, (Number(cssW) || 0) * (Number(cssH) || 0));
    if (APPLE_MOBIL) dpr = Math.max(1, Math.min(dpr, Math.sqrt(APPLE_PIXEL / flaeche)));
    // Gerundet auf Hundertstel: Die Spiele vergleichen die Zahl mit der vom
    // letzten Bild, und ein Rest im Fliesskomma hiesse jedes Mal neu messen.
    return Math.round(Math.max(1, dpr * bild.guete) * 100) / 100;
  }

  function bildTakt(now) {
    bild.frame = window.requestAnimationFrame(bildTakt);
    const sekunden = bild.letzt ? (now - bild.letzt) / 1000 : 0;
    bild.letzt = now;
    // Ein Sprung über eine Fünftelsekunde ist kein Ruckeln, sondern ein Tab
    // im Hintergrund oder ein Bildschirm, der kurz aus war.
    if (!sekunden || sekunden > 0.2 || document.hidden) { bild.zaeh = 0; return; }
    bild.mittel += (sekunden - bild.mittel) * 0.06;
    bild.zaeh = bild.mittel > 0.024 ? bild.zaeh + sekunden : 0;
    if (bild.zaeh > 1.2 && bild.guete > GUETE_MIN) {
      bild.guete = Math.max(GUETE_MIN, bild.guete * 0.8);
      bild.zaeh = 0;
      bild.mittel = 1 / 60;
    }
  }

  // Gemessen wird nur, solange eine Runde läuft – im Menü und auf der Tafel
  // malt kein Spiel, und dort hiesse «zäh» nichts.
  function bildMessen(an) {
    if (an && !bild.frame) {
      bild.letzt = 0;
      bild.zaeh = 0;
      bild.mittel = 1 / 60;
      bild.frame = window.requestAnimationFrame(bildTakt);
    } else if (!an && bild.frame) {
      window.cancelAnimationFrame(bild.frame);
      bild.frame = 0;
    }
  }

  window.LernappGameShell = {
    mount,
    frei: (knoten) => aktuell?.frei?.(knoten) ?? 0,
    bildpunkte,
    geraetDpr,
    // Für die Prüfskripte: was gerade gilt.
    bild: () => ({ apple: APPLE_MOBIL, guete: bild.guete, mittel: bild.mittel, misst: Boolean(bild.frame) }),
  };
})();
