/*
 * heizer.js – Der Heizer: mehrere Kessel, ein Paar Hände.
 *
 * Auf jedem Kessel steht ein Manometer, und jeder Zeiger fällt. Ein Tipp legt
 * Kohle nach und hebt ihn um KOHLE Striche. Fällt einer auf null, geht das
 * Feuer aus und die Schicht ist vorbei.
 *
 * Damit wäre es ein Spiel, das man durch schnelles Tippen gewinnt. Deshalb die
 * zweite Hälfte der Regel: Über GEFAHR darf nicht nachgelegt werden. Wer es
 * doch tut, treibt den Druck über den Anschlag, das Ventil platzt, und die
 * Schicht ist genauso vorbei. Der rote Bogen oben auf jedem Zifferblatt ist
 * genau diese Grenze – er ist nicht Zierde, er ist die Regel.
 *
 * Damit ist das Spiel kein Klopfen mehr, sondern ein Verteilen: Wer ist als
 * nächster dran, und wer sieht nur so aus. Alle neun Sekunden kommt ein Kessel
 * dazu, bis fünf nebeneinander stehen, und der Verbrauch steigt langsam mit.
 *
 * Die Form ist die von Blätter im Strom: eine Runde, eine Uhr, eine Zahl.
 * Anders als dort endet sie nicht nur an der Uhr, sondern meistens vorher – an
 * einem Kessel, den man übersehen hat.
 *
 * Gezählt wird in Zehntelsekunden, nicht in Nachlegungen. Zwei Gründe: Die
 * Zahl steigt sichtbar, solange man durchhält, und sie ist fein genug, dass
 * zwei gute Läufe fast nie gleich ausgehen – was in einem Turnier den
 * Unterschied zwischen einer Rangliste und einem Losentscheid macht.
 *
 * Die Zahlen unten sind ausgespielt, nicht ausgerechnet: mit einem
 * nachgebildeten Heizer, der immer den dringendsten Kessel wählt und um eine
 * feste Zeit zu spät kommt. Wer 320 Millisekunden braucht, hält im Mittel
 * 38 Sekunden durch, wer 220 braucht 51, wer 160 braucht 67.
 *
 * Die Schicht ist bei SCHICHT_MS zu Ende. Das ist kein Ziel, sondern ein
 * Deckel, und er soll keines werden: Ein Automat, der neunmal in der Sekunde
 * tippt und jeden Zeiger genau kennt, kommt auf 103 Sekunden – ein Mensch
 * nicht in die Nähe. Stünden oben in einem Turnier fünf Leute mit derselben
 * Höchstzahl, wäre die Rangliste ein Losentscheid.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "boiler") return;

  const host = document.querySelector("#hz-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  const art = window.LernappTrainArt;
  if (!host || !shellApi || !art) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Ohne Turnier in der Adresse ist das Math.random; in einem
  // Turnier bekommt jeder dieselbe Schicht (zufall.js).
  const zufall = window.LernappZufall?.fuer?.("boilerRoom") || {
    fest: false, neu() {}, zahl: Math.random,
    ganz: (n) => Math.floor(Math.random() * n),
    von: (a, b) => a + Math.random() * (b - a),
  };

  // ---------------------------------------------------------------------------
  // Die Regeln
  // ---------------------------------------------------------------------------
  const VOLL = 100;                 // der Anschlag des Manometers
  const START_WERT = 70;            // so steht ein frisch angefeuerter Kessel
  const KOHLE = 30;                 // so viel hebt ein Tipp
  // Über dieser Marke platzt das Ventil, wenn nachgelegt wird. Es ist genau
  // VOLL - KOHLE: Die Grenze ist damit keine zweite Zahl, die man sich merken
  // müsste, sondern die Stelle, ab der ein Tipp nicht mehr passt.
  const GEFAHR = VOLL - KOHLE;
  // Wie schnell ein Kessel leerläuft, in Strichen je Sekunde. Fünf
  // verschiedene Werte, und der dritte ist der hungrigste: Sonst wäre die
  // Reihenfolge immer dieselbe, und der Blick müsste nicht wandern.
  const TEMPO = [12.5, 15.5, 18, 14.5, 17];
  const KESSEL_MAX = 5;
  const KESSEL_START = 2;
  const KESSEL_DAZU_MS = 9000;      // alle neun Sekunden einer mehr
  // Der Verbrauch steigt mit der Zeit: nach einer Minute zweieinhalbmal so
  // viel, nach zwei Minuten mehr als das Vierfache. Ohne das liefe ein guter
  // Heizer ewig, denn fünf Kessel in einem festen Takt sind irgendwann
  // Routine – und eine Runde ohne Ende passt in kein Turnier.
  const ZUNAHME = 0.026;            // je Sekunde 2,6 % mehr
  // Das Ende der Schicht. Nicht als Ziel gedacht, sondern als Deckel: Eine
  // Runde, die zehn Minuten dauern kann, passt in kein Turnier – und in keinen
  // Feierabend.
  const SCHICHT_MS = 120000;

  // Jeder Kessel schwankt ein wenig um sein Tempo – dieselbe Schicht fühlt
  // sich sonst beim zweiten Mal an wie auswendig gelernt. Im Turnier ist das
  // Schwanken für alle dasselbe (zufall.js).
  const STREUUNG = 0.12;

  const HELP = [
    "Der Heizer. Auf jedem Kessel steht ein Manometer, und jeder Zeiger fällt.",
    "Tippe auf einen Kessel, dann legst du Kohle nach und sein Zeiger steigt.",
    "Fällt ein Zeiger auf null, geht das Feuer aus und die Schicht ist vorbei.",
    "Aber Achtung: Im roten Feld oben darfst du nicht nachlegen, sonst platzt das Ventil.",
    "Alle neun Sekunden kommt ein Kessel dazu, bis fünf nebeneinander stehen.",
    "Halte durch, so lange du kannst.",
  ].join(" ");

  // ---------------------------------------------------------------------------
  // Bestenliste – nur für diese Seite, die grosse steht in mini-games.js
  // ---------------------------------------------------------------------------
  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.heizer", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
    : {
      read: () => ({ runs: 0, scores: [] }),
      write(data) { return data; },
      update(fn) { return fn(this.read()); },
      onChange() { return () => {}; },
    };

  function recordRun(score) {
    return store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), score].sort((a, b) => b - a).slice(0, TOP_COUNT),
    }));
  }

  // ---------------------------------------------------------------------------
  // Das Zifferblatt
  // ---------------------------------------------------------------------------
  // Der Zeiger läuft über 260 Grad, von unten links nach unten rechts. Null
  // liegt links: ein fallender Zeiger wandert gegen den Uhrzeigersinn, und
  // "fast leer" sieht aus wie "fast leer".
  const MITTE_X = 50;
  const MITTE_Y = 52;
  const RADIUS = 34;
  const BOGEN = 260;

  const winkel = (wert) => -BOGEN / 2 + (BOGEN * Math.max(0, Math.min(VOLL, wert))) / VOLL;

  function punkt(wert, r) {
    const rad = (winkel(wert) * Math.PI) / 180;
    return [MITTE_X + Math.sin(rad) * r, MITTE_Y - Math.cos(rad) * r];
  }

  // Ein Stück Skala als Pfad. gross ist das Flag für Bögen über 180 Grad –
  // hier nie der Fall, aber der Pfad ist ohne es nicht vollständig.
  function bogen(von, bis, r) {
    const [x1, y1] = punkt(von, r);
    const [x2, y2] = punkt(bis, r);
    const gross = Math.abs(winkel(bis) - winkel(von)) > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${gross} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }

  // Unter welchem Wert das Feuer ausgeht, ist keine eigene Zahl – null ist
  // null. Der untere rote Bogen ist trotzdem breiter als ein Strich: Er sagt
  // "der ist als nächster dran", und das soll man aus dem Augenwinkel sehen.
  const MAHNUNG = 22;

  function baueKessel(kessel) {
    const knopf = shell.el("button", "hz-kessel");
    knopf.type = "button";
    knopf.setAttribute("aria-label", `Kessel ${kessel.nummer}: Kohle nachlegen`);

    const svg = art.el("svg", { viewBox: "0 0 100 100", class: "hz-uhr", "aria-hidden": "true" }, [
      art.el("circle", { cx: MITTE_X, cy: MITTE_Y, r: RADIUS + 9, fill: "#f7f1e4", stroke: "#8c7a62", "stroke-width": 3 }),
      art.el("circle", { cx: MITTE_X, cy: MITTE_Y, r: RADIUS + 3, fill: "#fffdf7", stroke: "#d9cbb3", "stroke-width": 1.5 }),
      // Die drei Felder: unten rot (fast aus), in der Mitte grün, oben rot
      // (hier nicht nachlegen).
      art.el("path", { d: bogen(0, MAHNUNG, RADIUS), fill: "none", stroke: "#e2694f", "stroke-width": 7, "stroke-linecap": "butt" }),
      art.el("path", { d: bogen(MAHNUNG, GEFAHR, RADIUS), fill: "none", stroke: "#5fb87a", "stroke-width": 7, "stroke-linecap": "butt" }),
      art.el("path", { d: bogen(GEFAHR, VOLL, RADIUS), fill: "none", stroke: "#d0392b", "stroke-width": 7, "stroke-linecap": "butt" }),
      // Der Strich, an dem der Tipp nicht mehr passt.
      art.el("path", { d: bogen(GEFAHR, GEFAHR + 0.6, RADIUS + 8), fill: "none", stroke: "#8c1c12", "stroke-width": 4, "stroke-linecap": "round" }),
    ]);

    const zeiger = art.el("g", { class: "hz-zeiger" }, [
      art.el("path", {
        d: `M ${MITTE_X} ${MITTE_Y + 8} L ${MITTE_X} ${MITTE_Y - RADIUS + 4}`,
        fill: "none", stroke: "#243047", "stroke-width": 4, "stroke-linecap": "round",
      }),
      art.el("circle", { cx: MITTE_X, cy: MITTE_Y, r: 5.5, fill: "#243047" }),
    ]);
    svg.append(zeiger);
    knopf.append(svg);

    const nummer = shell.el("span", "hz-nummer", String(kessel.nummer));
    knopf.append(nummer);

    // Der Funke beim Nachlegen: ein kurzes Aufleuchten, kein Ton. Bei vier
    // Tipps in der Sekunde wäre jeder Ton ein Geräusch.
    const funke = shell.el("span", "hz-funke");
    funke.setAttribute("aria-hidden", "true");
    knopf.append(funke);

    knopf.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      nachlegen(kessel);
    });

    kessel.node = knopf;
    kessel.zeiger = zeiger;
    return knopf;
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  const state = { phase: "intro", kessel: [], start: 0, gelaufen: 0, kohle: 0, ende: null };
  let shell = null;
  let reihe = null;
  let frame = null;
  let letzteZeit = 0;
  let stepTimer = null;

  const clearStep = () => { if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; } };
  const stopLoop = () => { if (frame) { window.cancelAnimationFrame(frame); frame = null; } };

  function neuerKessel() {
    const nummer = state.kessel.length + 1;
    const kessel = {
      nummer,
      wert: START_WERT,
      // Das Grundtempo des Kessels, einmal je Runde gewürfelt.
      tempo: TEMPO[nummer - 1] * zufall.von(1 - STREUUNG, 1 + STREUUNG),
      node: null,
      zeiger: null,
      gefahr: false,
    };
    state.kessel.push(kessel);
    reihe?.append(baueKessel(kessel));
    zeichne(kessel);
    return kessel;
  }

  function zeichne(kessel) {
    kessel.zeiger?.setAttribute("transform", `rotate(${winkel(kessel.wert).toFixed(2)} ${MITTE_X} ${MITTE_Y})`);
    // Zwei Zustände, die man aus dem Augenwinkel erkennen muss: "gleich aus"
    // und "Finger weg". Beides steht am Knopf, nicht nur am Zeiger – ein
    // Rahmen ist grösser als eine Nadel.
    const gefahr = kessel.wert > GEFAHR;
    const knapp = kessel.wert < MAHNUNG;
    if (gefahr !== kessel.gefahr) {
      kessel.node?.classList.toggle("is-gefahr", gefahr);
      kessel.gefahr = gefahr;
    }
    kessel.node?.classList.toggle("is-knapp", knapp && !gefahr);
  }

  // ---------------------------------------------------------------------------
  // Nachlegen
  // ---------------------------------------------------------------------------
  function nachlegen(kessel) {
    if (state.phase !== "play") return;
    if (kessel.wert > GEFAHR) { ende("platzt", kessel); return; }
    kessel.wert = Math.min(VOLL, kessel.wert + KOHLE);
    state.kohle += 1;
    zeichne(kessel);
    kids()?.vibrate?.(8);
    if (!ruhig()) {
      kessel.node?.classList.remove("ist-kohle");
      // Neu anstossen: Ohne das Auslösen des Umbruchs läuft die Bewegung beim
      // zweiten Tipp innerhalb einer Sekunde nicht noch einmal.
      void kessel.node?.offsetWidth;
      kessel.node?.classList.add("ist-kohle");
    }
  }

  // ---------------------------------------------------------------------------
  // Die Schicht
  // ---------------------------------------------------------------------------
  function step(now) {
    frame = window.requestAnimationFrame(step);
    if (state.phase !== "play") return;

    // Der Schritt wird gedeckelt. Ein Tab im Hintergrund bekommt keine Bilder
    // mehr; ohne Deckel käme der Spieler zurück und fände alle Kessel auf
    // einen Schlag erloschen. Die Uhr der Bühne läuft derweil weiter – wer
    // wegschaut, verliert Zeit, nicht die Schicht.
    const dt = Math.min(0.05, Math.max(0, (now - letzteZeit) / 1000));
    letzteZeit = now;

    const gelaufen = (Date.now() - state.start) / 1000;
    const faktor = 1 + ZUNAHME * gelaufen;

    for (const kessel of state.kessel) {
      kessel.wert -= kessel.tempo * faktor * dt;
      if (kessel.wert <= 0) { kessel.wert = 0; zeichne(kessel); ende("aus", kessel); return; }
      zeichne(kessel);
    }

    const soll = Math.min(KESSEL_MAX, KESSEL_START + Math.floor((Date.now() - state.start) / KESSEL_DAZU_MS));
    while (state.kessel.length < soll) neuerKessel();

    shell.setCount(Math.floor(gelaufen));
  }

  function ende(grund, kessel) {
    if (state.phase !== "play") return;
    state.phase = "over";
    state.ende = grund;
    // Jetzt stehenbleiben, nicht erst auf der Ergebnistafel: Der Nachlauf, in
    // dem der erloschene Kessel noch zu sehen ist, gehört nicht zur Schicht.
    state.gelaufen = Date.now() - state.start;
    stopLoop();
    shell.stopClock();
    if (kessel?.node) kessel.node.classList.add(grund === "platzt" ? "ist-geplatzt" : "ist-aus");
    kids()?.playJingle?.("retry");
    kids()?.vibrate?.([20, 40, 20]);
    // Einen Wimpernschlag stehen lassen: Man soll sehen, welcher Kessel es war.
    stepTimer = window.setTimeout(() => ergebnis(), 700);
  }

  function schichtEnde() {
    if (state.phase !== "play") return;
    state.phase = "over";
    state.ende = "schicht";
    state.gelaufen = SCHICHT_MS;
    stopLoop();
    kids()?.playJingle?.("win");
    if (!ruhig()) kids()?.burstConfetti?.();
    stepTimer = window.setTimeout(() => ergebnis(), 600);
  }

  const sekundenWort = (zehntel) => (zehntel / 10).toFixed(1).replace(".", ",");

  function grundText() {
    if (state.ende === "platzt") return "Das Ventil ist geplatzt.";
    if (state.ende === "aus") return "Ein Feuer ist ausgegangen.";
    return "Die Schicht ist zu Ende – durchgehalten bis zum Schluss.";
  }

  function resultSpeech(zehntel, rekord) {
    const wie = `Du hast ${sekundenWort(zehntel)} Sekunden durchgehalten.`;
    const lob = rekord ? "Das ist dein bester Lauf." : "";
    return `${wie} ${grundText()} ${lob}`.trim();
  }

  function ergebnis() {
    clearStep();
    const punkte = Math.max(0, Math.round(Math.min(SCHICHT_MS, state.gelaufen) / 100));
    const vorher = Math.max(0, ...(store.read().scores || [0]));
    recordRun(punkte);
    shell.showResult({
      label: "Punkte",
      points: punkte,
      detail: `${sekundenWort(punkte)} Sekunden · ${state.kohle} Mal Kohle`,
      speech: resultSpeech(punkte, punkte > vorher),
    });
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function showIntro() {
    clearStep();
    stopLoop();
    shell.stopClock();
    shell.closeOverlay();
    shell.setPhase("intro");
    state.phase = "intro";
    state.kessel = [];
    state.kohle = 0;
    state.ende = null;
    shell.setCount(0);
    reihe = null;

    shell.clear();
    shell.play.append(shell.el("p", "cm-prompt", "Halte die Kessel am Leben."));

    // Zwei Zifferblätter als Beispiel, ohne ein Wort dazu: links einer, der
    // gleich ausgeht, rechts einer, bei dem der Zeiger im roten Feld steht.
    // Was zu tun und was zu lassen ist, sieht man daran schneller als an
    // einem Satz.
    const demo = shell.el("div", "hz-demo");
    [
      { wert: 12, klasse: "is-knapp", text: "nachlegen" },
      { wert: 88, klasse: "is-gefahr", text: "Finger weg" },
    ].forEach((beispiel) => {
      const kachel = shell.el("div", `hz-demo-kessel ${beispiel.klasse}`);
      const platte = { nummer: 1, wert: beispiel.wert };
      const knopf = baueKessel(platte);
      knopf.disabled = true;
      knopf.querySelector(".hz-nummer")?.remove();
      platte.zeiger.setAttribute("transform", `rotate(${winkel(beispiel.wert).toFixed(2)} ${MITTE_X} ${MITTE_Y})`);
      kachel.append(knopf, shell.el("span", "hz-demo-wort", beispiel.text));
      demo.append(kachel);
    });
    shell.play.append(demo);

    const start = shell.el("button", "cm-start", "Starten");
    start.type = "button";
    start.addEventListener("click", beginRound);
    shell.play.append(start);
  }

  function beginRound() {
    clearStep();
    stopLoop();
    // Im Turnier ist der zweite Versuch dieselbe Schicht wie der erste.
    zufall.neu();
    state.phase = "play";
    state.kessel = [];
    state.kohle = 0;
    state.ende = null;
    state.gelaufen = 0;
    state.start = Date.now();
    letzteZeit = performance.now();
    shell.setPhase("play");
    shell.setCount(0);

    shell.clear();
    shell.play.append(shell.el("p", "cm-prompt hz-tafel", "Nie auf null. Nie ins Rote tippen."));
    reihe = shell.el("div", "hz-reihe");
    shell.play.append(reihe);

    for (let i = 0; i < KESSEL_START; i += 1) neuerKessel();

    frame = window.requestAnimationFrame(step);
    shell.startClock(SCHICHT_MS, schichtEnde);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Der Heizer",
    area: "konzentration",
    accent: "#00A5B5",
    accentDark: "#00707c",
    help: HELP,
    onRestart: showIntro,
  });

  showIntro();

  // --- Tastatur --------------------------------------------------------------
  // Mit einer Maus ist Tippen auf fünf Ziele langsamer als mit zwei Daumen.
  // Die Zifferntasten sind kein Komfort, sie halten das Spiel am Schreibtisch
  // spielbar.
  document.addEventListener("keydown", (event) => {
    if (state.phase === "play") {
      const nummer = Number(event.key);
      if (nummer >= 1 && nummer <= KESSEL_MAX) {
        const kessel = state.kessel[nummer - 1];
        if (kessel) { event.preventDefault(); nachlegen(kessel); }
      }
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      if (document.activeElement?.tagName === "BUTTON") return;
      event.preventDefault();
      if (state.phase === "intro") beginRound();
    }
  });

  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });
})();
