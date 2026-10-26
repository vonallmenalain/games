/*
 * blaetter.js – Blätter im Strom als Runde auf Zeit.
 *
 * Auf dem Wasser kommt Welle um Welle: drei Blätter derselben Farbe, und zu
 * jeder Farbe gehört eine andere Frage.
 *
 *   Orange – gewischt wird dorthin, wohin die Blätter schwimmen.
 *   Grün   – gewischt wird dorthin, wohin die Spitze zeigt.
 *
 * Alle Blätter treiben, und die Spitze zeigt immer woandershin, als sie
 * treiben. Ohne diesen Widerspruch wäre das Spiel keines: man könnte immer nur
 * auf die Spitze schauen und hätte beide Farben mit derselben Regel erledigt.
 * So aber muss bei jeder Welle neu entschieden werden, worauf es ankommt – und
 * genau dieses Umschalten ist die Übung.
 *
 * Ein Level, fünfundvierzig Sekunden, so viele richtige Wische wie möglich.
 * Keine Stufen, keine Diagonalen, keine Minuspunkte. Nach jedem Wisch kommt
 * sofort die nächste Welle – Haken oder Kreuz blitzen nur kurz auf, der Ton
 * sagt dasselbe, und nichts hält den nächsten Wisch auf.
 *
 * Gespielt wird nur mit dem Finger: ein Wisch auf dem Wasser, gemessen ab dem
 * ersten Stück Weg, nicht erst beim Loslassen.
 *
 * Bühne, Uhr und Bestenliste kommen aus game-shell.js; hier steht nur die Regel
 * und das Treiben.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "leaves") return;

  const host = document.querySelector("#bs-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  const art = window.LernappTrainArt;
  if (!host || !shellApi || !art) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;

  // Der Zufall. Ohne Turnier in der Adresse ist das Math.random; in einem
  // Turnier treiben allen dieselben Wellen entgegen (zufall.js). Wer schneller
  // wischt, sieht mehr davon – aber Welle für Welle dieselben.
  const zufall = window.LernappZufall?.fuer?.("leafFlow") || {
    fest: false, neu() {}, zahl: Math.random,
  };

  // ---------------------------------------------------------------------------
  // Regeln
  // ---------------------------------------------------------------------------
  const ROUND_MS = 45000;
  // So lange treibt eine Welle über das Wasser. Grosszügig gewählt: wer schnell
  // ist, wischt längst vorher und bekommt sofort die nächste – die Zeit läuft
  // nur für den, der zögert.
  const WELLE_MS = 3800;
  // Drei Blätter je Welle. Alle zeigen dasselbe an; wer eines übersieht, hat
  // immer noch zwei. Mehr wären auf einem Handy nur noch Gewimmel.
  const BLAETTER = 3;

  // Nach einem Wisch kommt die nächste Welle sofort – richtig oder falsch.
  // Eine verpasste Welle hat schon fast vier Sekunden gekostet; danach lange
  // warten zu lassen wäre doppelt bestraft.
  const PAUSE_VERPASST = 200;

  // Wie viele, sagt das Wagen-Set: fünf im ersten, neun im zweiten (kids.js).
  const RUNS_FOR_DONE = window.LernappKids?.wagonRounds?.() || 5;
  const TOP_COUNT = 5;

  // Vier Richtungen, keine Diagonalen. "dreh" ist der Winkel, um den das Blatt
  // gedreht wird: gezeichnet ist es mit der Spitze nach oben.
  const RICHTUNGEN = [
    { id: "hoch", name: "nach oben", dx: 0, dy: -1, dreh: 0 },
    { id: "rechts", name: "nach rechts", dx: 1, dy: 0, dreh: 90 },
    { id: "runter", name: "nach unten", dx: 0, dy: 1, dreh: 180 },
    { id: "links", name: "nach links", dx: -1, dy: 0, dreh: 270 },
  ];
  const RICHTUNG = Object.fromEntries(RICHTUNGEN.map((r) => [r.id, r]));

  // Wie schnell ein Blatt treibt, in Pixeln je Sekunde. In Pixeln und nicht in
  // Anteilen des Wassers: Das Wasser ist nie quadratisch – quer breit und
  // flach, hochkant schmal und hoch –, und ein Anteil seiner Höhe wäre eine
  // ganz andere Strecke als derselbe Anteil seiner Breite. Eine Welle nach
  // unten sähe gegenüber einer nach rechts aus wie stehengeblieben. So treibt
  // jedes Blatt gleich schnell, egal wohin und egal, wie das Gerät liegt.
  const TEMPO = 185;
  // Wo die drei Blätter quer zur Fahrt liegen, in Anteilen der Breite quer zur
  // Fahrt. Nicht am Rand: dort schnitte das Wasser sie an.
  const QUER = [0.28, 0.5, 0.72];

  // ---------------------------------------------------------------------------
  // Bestenliste – lokal und in der Cloud
  // ---------------------------------------------------------------------------
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.blaetter", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  // Ein Blatt als Bild
  // ---------------------------------------------------------------------------
  // Tropfenform: vorne spitz, hinten rund, dazu Stiel und Blattadern. Die
  // Spitze muss auf einen Blick zu finden sein – an ihr hängt die halbe Regel.
  //
  // Orange und Grün allein würden ein farbenblindes Kind im Stich lassen.
  // Deshalb sagt die Frage über dem Wasser in Worten und in derselben Farbe,
  // worauf es ankommt.
  function blattSvg(sorte) {
    const koerper = sorte === "treibt" ? "#f2a03d" : "#6fbf73";
    const ader = sorte === "treibt" ? "#bd6b12" : "#3d8a4c";
    return art.el("svg", { viewBox: "0 0 48 64", class: "bs-blatt-art", "aria-hidden": "true" }, [
      art.el("path", {
        d: "M24 57 q2 4 6 5", fill: "none", stroke: ader,
        "stroke-width": 3.4, "stroke-linecap": "round",
      }),
      art.el("path", {
        d: "M24 3 C 39 17 44 31 44 40 A 20 20 0 0 1 4 40 C 4 31 9 17 24 3 Z",
        fill: koerper,
      }),
      art.el("path", {
        d: "M24 9 V56 M24 22 L13 31 M24 22 L35 31 M24 34 L13 43 M24 34 L35 43",
        fill: "none", stroke: ader, "stroke-width": 2.6, "stroke-linecap": "round",
      }),
    ]);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  const state = { phase: "intro", welle: null, letzte: null, richtig: 0, falsch: 0, wellen: 0 };
  let shell = null;
  let prompt = null;
  let wasser = null;
  let frame = null;
  let stepTimer = null;
  // Die Gegner (geist.js): Platz 1 und die eigene Bestmarke wischen mit –
  // als Zahl, die Sekunde für Sekunde zeigt, wie weit sie damals waren.
  let gegner = null;
  // Die Aufzeichnung der Wische (geist.js, zuege) – mit ihr lässt sich die
  // Runde später aus der Hall of Fame anschauen – und wer gerade eine
  // anschaut (geist.js, zuschauer), bis zu welchem Wisch.
  let aufnahme = null;
  let zuschauer = null;
  let gesehenBis = -Infinity;

  // Beim Anschauen wischt dieses Gerät nur nach – es brummt nicht, aber es
  // klingt: Jeder Wisch des anderen ist zu hören.
  const zuschauend = () => state.phase === "zuschauen";
  const brumm = (muster) => { if (!zuschauend()) kids()?.vibrate?.(muster); };

  // Unter allem rauscht leise der Fluss, solange die Runde läuft – auch beim
  // Anschauen; dessen Ende kennt das Spiel (zuschauer.weiter).
  let fluss = null;

  function flussAn() {
    if (fluss?.laeuft) return;
    fluss = klang()?.kulisse?.("blaetter.fluss") || null;
    fluss?.laut(0.8);
  }

  function flussAus() {
    fluss?.stop();
    fluss = null;
  }

  const pick = (list) => list[Math.floor(zufall.zahl() * list.length)];

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Das Wasser
  // ---------------------------------------------------------------------------
  // Eine ruhige Fläche mit ein paar Wellenstrichen, sonst nichts. Fische und
  // Steine wären hübsch, aber sie bewegten sich neben den Blättern – und die
  // Bewegung ist hier die Frage, nicht die Deko.
  function buildWasser() {
    const wrap = shell.el("div", "bs-wasser");
    wrap.append(art.el("svg", {
      class: "bs-wasser-art", viewBox: "0 0 200 120", preserveAspectRatio: "none", "aria-hidden": "true",
    }, [
      art.el("defs", {}, [
        art.el("linearGradient", { id: "bs-flut", x1: "0", y1: "0", x2: "0", y2: "1" }, [
          art.el("stop", { offset: "0%", "stop-color": "#7cd0ea" }),
          art.el("stop", { offset: "100%", "stop-color": "#41a6d0" }),
        ]),
      ]),
      art.el("rect", { x: 0, y: 0, width: 200, height: 120, fill: "url(#bs-flut)" }),
      art.el("path", {
        d: "M12 24 q7 -5 14 0 M64 40 q7 -5 14 0 M124 18 q7 -5 14 0 M160 62 q7 -5 14 0 M32 82 q7 -5 14 0 M108 98 q7 -5 14 0",
        fill: "none", stroke: "#ffffff", "stroke-width": 2.4, "stroke-linecap": "round", opacity: 0.5,
      }),
    ]));
    return wrap;
  }

  // ---------------------------------------------------------------------------
  // Eine Welle
  // ---------------------------------------------------------------------------
  function nextWelle() {
    if ((state.phase !== "play" && !zuschauend()) || !wasser) return;
    wasser.querySelectorAll(".bs-welle").forEach((node) => node.remove());

    // Die Farbe wird für jede Welle neu gewürfelt. Eine feste Abfolge liesse
    // sich mitzählen; gerade das Nichtwissen ist die Aufgabe. Nur dieselbe
    // Welle zweimal hintereinander gibt es nicht: nach jedem Wisch wechselt
    // die Farbe oder die Antwort – so ist zu sehen, dass etwas Neues kommt.
    let sorte;
    let fahrt;
    let spitze;
    let antwort;
    do {
      sorte = zufall.zahl() < 0.5 ? "treibt" : "zeigt";
      fahrt = pick(RICHTUNGEN);
      // Die Spitze zeigt woandershin, als die Blätter treiben – bei beiden
      // Farben; das ist die Falle. Orange fragt nach der Fahrt, Grün nach
      // der Spitze.
      spitze = pick(RICHTUNGEN.filter((r) => r.id !== fahrt.id));
      antwort = sorte === "treibt" ? fahrt.id : spitze.id;
    } while (state.letzte && state.letzte.sorte === sorte && state.letzte.antwort === antwort);
    state.letzte = { sorte, antwort };

    const gruppe = shell.el("div", "bs-welle");
    const blaetter = [];
    for (let i = 0; i < BLAETTER; i += 1) {
      const node = shell.el("span", "bs-blatt");
      node.append(blattSvg(sorte));
      gruppe.append(node);
      blaetter.push({
        node,
        quer: QUER[i],
        // Gleichmässig über die Runde verteilt: so ist immer eines im Bild,
        // während das nächste gerade hinausschwimmt.
        versatz: i / BLAETTER,
      });
    }
    wasser.append(gruppe);

    state.welle = {
      // Die wievielte Welle – beim Anschauen gehört jeder Wisch zu seiner.
      nr: state.wellen,
      sorte,
      fahrt,
      antwort,
      dreh: spitze.dreh,
      gruppe,
      blaetter,
      start: performance.now(),
      fertig: false,
    };
    state.wellen += 1;

    prompt.className = `cm-prompt bs-frage is-${sorte}`;
    prompt.textContent = sorte === "treibt" ? "Wohin schwimmen sie?" : "Wohin zeigen sie?";
    place();
  }

  // Hält einen Platz so weit vom Rand weg, dass das ganze Blatt im Wasser
  // liegt. Ist das Wasser schmaler als ein Blatt, bleibt nur die Mitte.
  function drin(wert, laenge, halb) {
    if (laenge <= halb * 2) return laenge / 2;
    return Math.max(halb, Math.min(laenge - halb, wert));
  }

  // Wo die Blätter gerade liegen. Gerechnet wird bei jedem Bild neu aus der
  // Grösse des Wassers – so stimmt das Bild auch nach dem Drehen des Geräts,
  // ohne dass die Welle neu anfangen müsste.
  //
  // Gerechnet wird mit dem längeren Mass des Blattes nach allen Seiten. Ein
  // gedrehtes Blatt ist quer so breit, wie es aufrecht hoch ist; mit dem
  // kürzeren Mass würde es am Rand angeschnitten.
  function place(now = performance.now()) {
    const welle = state.welle;
    if (!welle || !wasser) return;
    const box = wasser.getBoundingClientRect();
    if (!box.width) return;
    const breit = Math.max(44, Math.min(96, box.width * 0.12, box.height * 0.36));
    const hoch = breit * 1.15;
    const halb = hoch / 2;
    const zeit = (now - welle.start) / 1000;

    welle.blaetter.forEach((blatt) => {
      // Die Blätter laufen im Kreis: hinten aus dem Bild, vorne wieder
      // hinein. Ein einziger Durchlauf wäre auf dem flachen Wasser einer
      // Welle nach oben oder unten nur ein kurzes Zucken – so treibt der
      // Strom, solange die Welle steht, und die Richtung bleibt ablesbar.
      const senkrecht = welle.fahrt.dy !== 0;
      const laenge = senkrecht ? box.height : box.width;
      const quer = senkrecht ? box.width : box.height;
      const runde = laenge + halb * 2;
      let auf = (blatt.versatz * runde + TEMPO * zeit) % runde - halb;
      // Nach links und nach oben läuft dieselbe Runde rückwärts.
      if ((senkrecht ? welle.fahrt.dy : welle.fahrt.dx) < 0) auf = laenge - auf;
      const ab = drin(quer * blatt.quer, quer, halb);
      const x = senkrecht ? ab : auf;
      const y = senkrecht ? auf : ab;
      blatt.node.style.width = `${breit}px`;
      blatt.node.style.height = `${hoch}px`;
      blatt.node.style.transform =
        `translate(${x - breit / 2}px, ${y - hoch / 2}px) rotate(${welle.dreh}deg)`;
    });
  }

  function step(now) {
    frame = window.requestAnimationFrame(step);
    if (zuschauend()) { zuschauenTakt(); place(now); return; }
    if (state.phase !== "play") return;
    place(now);
    const welle = state.welle;
    if (welle && !welle.fertig && now - welle.start >= WELLE_MS) verpasst();
  }

  // ---------------------------------------------------------------------------
  // Antworten
  // ---------------------------------------------------------------------------
  // Ein Haken oder ein Kreuz, das kurz auf dem Wasser aufblitzt. Es hält
  // nichts auf: die nächste Welle ist schon da, während es verblasst.
  function flash(richtig) {
    if (!wasser) return;
    const mark = shell.el("span", `bs-flash ${richtig ? "is-richtig" : "is-falsch"}`, richtig ? "✓" : "✗");
    mark.setAttribute("aria-hidden", "true");
    wasser.append(mark);
    window.setTimeout(() => mark.remove(), 440);
  }

  function answer(id) {
    const welle = state.welle;
    if ((state.phase !== "play" && !zuschauend()) || !welle || welle.fertig) return;
    welle.fertig = true;
    const richtig = id === welle.antwort;

    // Jeder Wisch rauscht, darum nicht zu laut; dazu sagt ein zweiter Klang,
    // ob er stimmte: ein Punkt, alle zehn richtigen der Meilenstein.
    klang()?.ton?.("blaetter.wisch", { laut: 0.7 });
    if (richtig) {
      state.richtig += 1;
      if (state.richtig % 10 === 0) klang()?.ton?.("meilenstein");
      else klang()?.ton?.("punkt", { laut: 0.7 });
      brumm(16);
    } else {
      state.falsch += 1;
      // Kein Abzug: der Ton sagt "nicht ganz", nicht "falsch gemacht".
      klang()?.ton?.("fehler");
    }
    shell.setCount(state.richtig);
    gegner?.takt(state.richtig);
    if (!zuschauend()) {
      aufnahme?.zug(state.richtig, { a: RICHTUNGEN.findIndex((r) => r.id === id), b: 0, c: welle.nr * 4 + 1 });
    }
    flash(richtig);
    // Sofort weiter: die nächste Welle ist da, bevor der Finger wieder oben
    // ist. Wer schnell ist, soll nicht auf das Spiel warten müssen.
    nextWelle();
  }

  function verpasst() {
    const welle = state.welle;
    if (!welle || welle.fertig) return;
    welle.fertig = true;
    state.falsch += 1;
    welle.gruppe.classList.add("is-vorbei");
    klang()?.ton?.("fehler");
    flash(false);
    if (!zuschauend()) aufnahme?.zug(state.richtig, { a: 0, b: 0, c: welle.nr * 4 + 2 });
    stepTimer = window.setTimeout(nextWelle, PAUSE_VERPASST);
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function showIntro() {
    clearStep();
    stopLoop();
    flussAus();
    shell.stopClock();
    shell.closeOverlay();
    shell.setPhase("intro");
    state.phase = "intro";
    state.welle = null;
    state.letzte = null;
    state.richtig = 0;
    state.falsch = 0;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    shell.play.append(shell.el("p", "cm-prompt", "Wisch dorthin, wo die Blätter hinwollen."));

    // Zwei Beispiele nebeneinander, ohne ein Wort dazu: links treibt ein
    // oranges Blatt nach rechts, obwohl seine Spitze nach oben zeigt – rechts
    // liegt ein grünes still und zeigt nach rechts. Was zu tun ist, sieht man
    // daran schneller als an jedem Satz.
    const demo = shell.el("div", "bs-demo");
    [
      { sorte: "treibt", dreh: 0 },
      { sorte: "zeigt", dreh: 90 },
    ].forEach((beispiel) => {
      const chip = shell.el("span", `bs-demo-chip is-${beispiel.sorte}`);
      const blatt = shell.el("span", "bs-demo-blatt");
      blatt.style.setProperty("--bs-dreh", `${beispiel.dreh}deg`);
      blatt.append(blattSvg(beispiel.sorte));
      chip.append(blatt);
      demo.append(chip);
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
    zufall.neu();
    state.phase = "play";
    state.letzte = null;
    shell.setPhase("play");
    shell.setCount(0);
    state.wellen = 0;

    shell.clear();
    prompt = shell.el("p", "cm-prompt bs-frage");
    wasser = buildWasser();
    shell.play.append(prompt, wasser);

    // Der Fluss vor der ersten Welle und der Uhr: Richtet er dabei die
    // Tonausgabe erst ein, geht das nicht von der Runde ab.
    flussAn();
    nextWelle();
    frame = window.requestAnimationFrame(step);
    shell.startClock(ROUND_MS, finish);
    gegner?.los();
    aufnahme?.los();
  }

  // ---------------------------------------------------------------------------
  // Anschauen
  // ---------------------------------------------------------------------------
  /*
   * Eine Runde aus der Hall of Fame (geist.js, zuschauer). Aufgezeichnet ist
   * jeder Wisch und jede verpasste Welle (aufnahme.zug):
   *
   *   c   die wievielte Welle × 4 + was: 1 gewischt, 2 verpasst
   *   a   wohin gewischt wurde (RICHTUNGEN)
   *   p   wie viele bis dahin richtig waren
   *
   * Die Wellen kommen aus derselben Saat in derselben Reihe. Die Wiedergabe
   * wischt zur selben Zeit in dieselbe Richtung – und holt, falls eine Welle
   * hier noch nicht da ist, sie zuerst.
   */
  function zugNachbauen(probe) {
    const nr = Math.floor(probe.c / 4);
    const was = probe.c - nr * 4;
    let sicher = 0;
    while (state.welle && state.welle.nr < nr && sicher < 500) {
      clearStep();
      nextWelle();
      sicher += 1;
    }
    if (was === 1) answer(RICHTUNGEN[probe.a]?.id || "");
    else if (was === 2) verpasst();
    state.richtig = probe.p;
    shell.setCount(probe.p);
  }

  function zuschauenTakt() {
    if (!zuschauer?.seit) return;
    zuschauer.seit(gesehenBis, zuschauer.jetzt()).forEach((probe) => {
      gesehenBis = probe.t;
      zugNachbauen(probe);
    });
    // Am Schluss die Tafel – und der Fluss wird still.
    if (zuschauer.weiter?.() === false) flussAus();
  }

  function zuschauenStarten() {
    if (!zuschauer?.seit) return;
    clearStep();
    stopLoop();
    shell.closeOverlay();
    zufall.neu();
    state.phase = "zuschauen";
    state.letzte = null;
    state.richtig = 0;
    state.falsch = 0;
    state.wellen = 0;
    gesehenBis = -Infinity;
    shell.setPhase("play");
    shell.setCount(0);

    shell.clear();
    prompt = shell.el("p", "cm-prompt bs-frage");
    wasser = buildWasser();
    shell.play.append(prompt, wasser);

    flussAn();
    zuschauer.los?.();
    nextWelle();
    frame = window.requestAnimationFrame(step);
    // Die Uhr läuft mit wie in der Runde, so weit wie die des anderen (im
    // Multiplayer schaut man erst mittendrin zu) – das Ende kommt mit der
    // Aufzeichnung.
    const schon = Math.max(0, Number(zuschauer.jetzt?.()) || 0);
    shell.startClock(Math.max(0, ROUND_MS - schon), () => {}, ROUND_MS);
  }

  function runsText(runs) {
    const left = RUNS_FOR_DONE - runs;
    if (left <= 0) return "Dieses Spiel ist geschafft – der Wagen ist gebaut.";
    return left === 1
      ? "Noch eine Runde bis zum fertigen Wagen."
      : `Noch ${left} Runden bis zum fertigen Wagen.`;
  }

  function finish() {
    if (zuschauer) return;
    clearStep();
    stopLoop();
    flussAus();
    state.phase = "over";
    const points = state.richtig;
    const geist = aufnahme?.ende(gegner?.ende(points) || null) || null;
    const next = recordRun(points);
    shell.showResult({
      label: "Richtige Blätter",
      points,
      detail: `${state.richtig} richtig · ${state.falsch} daneben`,
      scores: next.scores,
      top: TOP_COUNT,
      note: { text: runsText(next.runs), done: next.runs >= RUNS_FOR_DONE },
      geist,
    });
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Blätter im Strom",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    onRestart: () => (zuschauer ? zuschauenStarten() : showIntro()),
    // Live-Modus: Die Runde beginnt zum gemeinsamen Start, ohne «Starten».
    live: { los: beginRound, stopp: () => finish() },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "leafFlow", fassung: "t1", zufall, zuege: true, nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "leafFlow", host, art: "tempo" }) || null;
    aufnahme = window.LernappGeist?.zuege?.({ fassung: "t1", zufall }) || null;
  }

  showIntro();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // --- Wischen ---------------------------------------------------------------
  // Auf der ganzen Bühne, nicht nur auf dem Wasser: unter Zeitdruck trifft ein
  // Kind keine kleine Fläche. Ein Wisch zählt, sobald der Finger 32 Bildpunkte
  // weit ist – nicht erst beim Loslassen. Welche Richtung, entscheidet die
  // längere der beiden Strecken; so wird aus einem schrägen Wisch die
  // Richtung, die gemeint war. Der Rest des Wischs zählt dann nicht mehr.
  //
  // Der Zeiger wird an die Bühne gebunden: der Finger darf über den Rand des
  // Wassers hinaus, und der Browser gibt die Berührung nicht mehr her – das
  // Stylesheet hält ihn während der Runde mit touch-action: none davon ab,
  // den Wisch als Rollen zu deuten und abzubrechen.
  const SWIPE_MIN = 32;
  let swipe = null;

  function swipeStart(event) {
    if (state.phase !== "play" || event.target.closest("button")) { swipe = null; return; }
    swipe = { id: event.pointerId, x: event.clientX, y: event.clientY, done: false };
    try { host.setPointerCapture(event.pointerId); } catch { /* dann ohne Bindung */ }
  }

  function swipeCheck(event) {
    if (!swipe || swipe.id !== event.pointerId || swipe.done || state.phase !== "play") return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
    swipe.done = true;
    if (Math.abs(dx) > Math.abs(dy)) answer(dx > 0 ? "rechts" : "links");
    else answer(dy > 0 ? "runter" : "hoch");
  }

  host.addEventListener("pointerdown", swipeStart);
  host.addEventListener("pointermove", swipeCheck);
  host.addEventListener("pointerup", (event) => { swipeCheck(event); swipe = null; });
  host.addEventListener("pointercancel", () => { swipe = null; });

  // --- Tastatur --------------------------------------------------------------
  const TASTEN = { ArrowUp: "hoch", ArrowRight: "rechts", ArrowDown: "runter", ArrowLeft: "links" };

  document.addEventListener("keydown", (event) => {
    if (state.phase === "play") {
      const richtung = TASTEN[event.key];
      if (richtung) { event.preventDefault(); answer(richtung); }
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      if (document.activeElement?.tagName === "BUTTON") return;
      event.preventDefault();
      if (state.phase === "intro") beginRound();
    }
  });

  window.addEventListener("resize", () => place());
  window.addEventListener("orientationchange", () => place());
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); flussAus(); });

  // Für die Prüfskripte. zeitUm beendet die Runde, ohne 45 Sekunden zu warten.
  window.LernappBlaetter = {
    RICHTUNGEN, RICHTUNG, WELLE_MS, ROUND_MS, RUNS_FOR_DONE, state,
    zeitUm() { shell.stopClock(); finish(); },
  };
})();
