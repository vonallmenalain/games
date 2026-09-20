/*
 * game-shell.js – Die gemeinsame Bühne der Mini-Games.
 *
 * Die Landschaft als Hintergrund, die Knöpfe und der Lautsprecher oben links,
 * ein Zähler oben rechts, wahlweise ein Zeitbalken darunter, und am Schluss
 * das Ergebnis mit der Bestenliste. Alles, was ein Spiel um einen Punktestand
 * gleich braucht – und nichts vom Spiel selbst.
 *
 * Das Spiel bekommt eine Fläche in der Mitte und ein paar Handgriffe:
 *   setCount(n)      Zähler oben rechts
 *   startClock(ms)   Uhr starten; sie meldet sich, wenn die Zeit um ist
 *   showResult(...)  Ergebnis mit "noch einmal" und dem Weg zu den anderen
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
  const scenes = () => window.LernappScenes || null;
  const kids = () => window.LernappKids || null;
  const mini = () => window.LernappMini || null;

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
    // Der Pokal: der Weg zu den anderen Mini-Games.
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

  /*
   * Baut die Bühne.
   *
   *   host      das Element, in dem alles landet
   *   title     Name des Spiels – das Einzige, was oben steht
   *   help      Text, den der Lautsprecher vorliest
   *   onRestart was der Neu-Knopf tut
   *
   * area, accent, accentDark und onBack kommen aus der App mit. Die Farben
   * gelten auch hier; area und onBack führten dort in die Spielauswahl, die es
   * hier nicht gibt – sie bleiben in der Liste, damit sich ein Spiel
   * unverändert herüberkopieren lässt.
   */
  function mount({ host, title, accent, accentDark, help, onRestart, clock = true }) {
    host.style.setProperty("--cm-accent", accent);
    host.style.setProperty("--cm-accent-dark", accentDark);
    host.innerHTML = "";
    host.dataset.phase = "intro";
    // Für pwa.js: eine laufende Runde verträgt kein Neuladen. Eine neue
    // Fassung wartet, bis ohnehin die Seite gewechselt wird.
    window.LernappBusy = () => host.dataset.phase === "play";

    // --- Hintergrund: die Landschaft ----------------------------------------
    if (scenes()) host.append(scenes().buildScene(scenes().savedScene()));

    // --- Der Lautsprecher oben links ----------------------------------------
    // Derselbe wie in der App: er kennt schon den Ton-Schalter, das Vorlesen
    // und die Sprechblase für die, die mitlesen wollen.
    kids()?.mountHelpButton?.();
    if (help) kids()?.setHelp?.(help);

    // --- Leiste oben ---------------------------------------------------------
    const bar = el("div", "cm-bar");
    const left = el("div", "cm-bar-left");
    // Drei Wege hinaus und einer zurück an den Anfang: "Zur App", "Mini
    // Games", "Hall of Fame" (mini-games.js) und der Neu-Knopf.
    mini()?.leiste?.().forEach((knopf) => left.append(knopf));
    left.append(iconButton("again", "Neu starten", ICONS.again(), () => { stopClock(); onRestart(); }));
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

    function startClock(ms, callback) {
      stopClock();
      duration = ms;
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
    let releaseHelp = null;

    // Nur die Tafel wegnehmen: panel() baut gleich die nächste auf und meldet
    // ihren Vorlese-Text selbst an.
    function dropOverlay() {
      overlay?.remove();
      overlay = null;
    }

    // Zurück ins Spiel: Tafel weg, und der Lautsprecher sagt wieder die Regeln.
    function closeOverlay() {
      dropOverlay();
      releaseHelp?.();
      releaseHelp = null;
    }

    function panel(children) {
      dropOverlay();
      overlay = el("div", "cm-overlay");
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
    function showResult({ points, detail, speech, label = "Deine Punkte" }) {
      host.dataset.phase = "over";
      timeFill.style.transform = "scaleX(0)";

      // Der Lautsprecher oben links sagt jetzt das Ergebnis statt der Regeln.
      releaseHelp?.();
      const satz = mini()?.ergebnisSprache?.({ punkte: points, label }) || speech;
      releaseHelp = satz ? kids()?.pushHelp?.(satz) || null : null;

      const parts = [el("p", "cm-result-label", label)];
      parts.push(el("p", "cm-result-score", String(points)));
      if (detail) parts.push(el("p", "cm-result-detail", detail));
      // Namensfeld, eigener Platz, die Liste aller.
      const block = mini()?.ergebnis?.({ punkte: points });
      if (block) parts.push(block);

      const actions = el("div", "cm-actions");
      actions.append(iconButton("again", "Noch einmal", ICONS.again(), () => { closeOverlay(); onRestart(); }, "big"));
      // Kein Weg "zurück": Wer über einen Link hereinkam, hat keine Auswahl
      // hinter sich. Der Pokal führt zu den anderen Mini-Games.
      actions.append(iconButton("cup", "Mini Games", ICONS.cup(), () => mini()?.oeffneFenster?.(mini()?.spielId?.()), "big"));
      parts.push(actions);
      panel(parts);
    }

    return {
      play,
      el,
      // In der App steht hier der Auftrag der Reise, und ein Spiel startet
      // dann direkt im verlangten Level. Hier gibt es keine Reise – die Zeile
      // bleibt, damit ein Spiel, das danach fragt, unverändert läuft.
      journey: null,
      setPhase(phase) { host.dataset.phase = phase; },
      setCount(value) { countValue.textContent = String(value); },
      startClock,
      stopClock,
      showResult,
      closeOverlay,
      clear() { play.innerHTML = ""; },
    };
  }

  window.LernappGameShell = { mount };
})();
