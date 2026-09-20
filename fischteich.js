/*
 * fischteich.js – Fischteich als eine Runde ohne Uhr.
 *
 * Im Teich schwimmen Fische. Jeden darf man genau einmal antippen. Gefangene
 * Fische schwimmen weiter und sehen aus wie vorher – gemerkt werden muss also,
 * welchen man schon hatte. Sind alle gefangen, kommt der nächste Teich mit
 * einem Fisch mehr. Tippt man denselben Fisch ein zweites Mal an, ist der Lauf
 * vorbei. Was zählt, ist, wie viele Fische bis dahin zusammengekommen sind.
 *
 * Dieselbe Regel und dieselbe Punktzahl wie bei den Strand-Schätzen: ein Punkt
 * je Fisch, ein Fehler beendet die Runde, kein Zeitdruck. Neu ist nur, dass
 * sich die Fische bewegen – das macht aus dem Merken ein Konzentrationsspiel.
 *
 * Bühne, Knöpfe und Bestenliste kommen aus game-shell.js; hier steht nur die
 * Regel und das Schwimmen.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "pond") return;

  const host = document.querySelector("#ft-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  const art = window.LernappTrainArt;
  if (!host || !shellApi || !art) return;

  const kids = () => window.LernappKids || null;

  // ---------------------------------------------------------------------------
  // Regeln
  // ---------------------------------------------------------------------------
  // Je Teich ein Fisch mehr und eine Spur flotter. Als Tabelle, damit sich die
  // Kurve nachziehen lässt, ohne die Spiellogik anzufassen. Wer über den
  // letzten Teich hinauskommt, schwimmt weiter auf dessen Werten.
  const TEICHE = [
    { fische: 4, tempo: 1.0 },
    { fische: 5, tempo: 1.1 },
    { fische: 6, tempo: 1.2 },
    { fische: 7, tempo: 1.3 },
    { fische: 8, tempo: 1.4 },
    { fische: 9, tempo: 1.5 },
    { fische: 10, tempo: 1.6 },
    { fische: 11, tempo: 1.7 },
  ];

  // Grundtempo in Bildbreiten je Sekunde. Bewusst gemächlich: ein Fisch, den
  // man nicht in Ruhe anschauen kann, lässt sich auch nicht wiedererkennen.
  const TEMPO = 0.075;
  const DREH = 0.9;        // wie stark ein Fisch je Sekunde die Richtung ändert
  const RAND = 0.08;       // so weit vom Teichrand dreht er wieder ein
  const EINDREHEN = 4;     // wie schnell er dabei umlenkt (Bogenmass je Sekunde)
  const FANG_MS = 700;     // so lange steht das Häkchen über dem Fisch
  // Nach einem Fang ist Pause: über dem Fisch füllt sich ein kleines Rad, und
  // erst wenn es voll ist und zum Häkchen wird, zählt der nächste Tipp. Ohne
  // die Pause liesse sich ein Teich in zwei Sekunden leertippen, ohne
  // hinzuschauen – und das Hinschauen ist die Aufgabe.
  const SPERRE_MS = 1500;

  // Wie viele, sagt das Wagen-Set: fünf im ersten, neun im zweiten (kids.js).
  const RUNS_FOR_DONE = window.LernappKids?.wagonRounds?.() || 5;
  const TOP_COUNT = 5;

  // Jeder Fisch sieht anders aus – das ist der Haken, an dem das Merken hängt.
  // Zwei Fische mit derselben Farbe wären nicht auseinanderzuhalten, sobald sie
  // sich einmal gekreuzt haben.
  const FISCHE = [
    { id: "rot", name: "der rote Fisch", body: "#e2694f", fin: "#c14a30", muster: "streifen" },
    { id: "gelb", name: "der gelbe Fisch", body: "#f0b429", fin: "#c98f10", muster: "punkte" },
    { id: "gruen", name: "der grüne Fisch", body: "#5fb87a", fin: "#3d8f57", muster: "keins" },
    { id: "blau", name: "der blaue Fisch", body: "#4a90d9", fin: "#2f6cae", muster: "streifen" },
    { id: "lila", name: "der lila Fisch", body: "#9a6fd0", fin: "#7048ab", muster: "punkte" },
    { id: "orange", name: "der orange Fisch", body: "#ef8f3c", fin: "#c96b1c", muster: "keins" },
    { id: "tuerkis", name: "der türkise Fisch", body: "#3fb8b8", fin: "#249393", muster: "streifen" },
    { id: "rosa", name: "der rosa Fisch", body: "#ef86a8", fin: "#c95c80", muster: "punkte" },
    { id: "braun", name: "der braune Fisch", body: "#b1854f", fin: "#8a6234", muster: "keins" },
    { id: "grau", name: "der graue Fisch", body: "#8d9aa8", fin: "#6a7683", muster: "streifen" },
    { id: "hellgruen", name: "der hellgrüne Fisch", body: "#a8cf5c", fin: "#82a935", muster: "punkte" },
    { id: "dunkelblau", name: "der dunkelblaue Fisch", body: "#3a5f9e", fin: "#254478", muster: "keins" },
  ];

  const HELP = [
    "Fischteich. Im Teich schwimmen Fische umher.",
    "Tippe jeden Fisch genau einmal an.",
    "Nach jedem Tipp füllt sich über dem Fisch ein kleines Rad. Erst wenn daraus ein Häkchen wird, kannst du den nächsten Fisch antippen.",
    "Ein gefangener Fisch schwimmt weiter und sieht aus wie vorher – merk dir an der Farbe, welchen du schon hattest.",
    "Hast du alle, kommt der nächste Teich mit einem Fisch mehr.",
    "Tippst du denselben Fisch ein zweites Mal an, ist die Runde vorbei.",
    "Ins Wasser daneben tippen macht nichts.",
    "Zeit hast du so viel du willst.",
  ].join(" ");

  // ---------------------------------------------------------------------------
  // Bestenliste – lokal und in der Cloud
  // ---------------------------------------------------------------------------
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.fischteich", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  // Ein Fisch als Bild
  // ---------------------------------------------------------------------------
  // Nach rechts schauend gezeichnet; wer nach links schwimmt, wird gespiegelt.
  function fischSvg(fisch) {
    const teile = [
      art.el("polygon", { points: "6,32 22,20 22,44", fill: fisch.fin }),
      art.el("ellipse", { cx: 44, cy: 32, rx: 22, ry: 14, fill: fisch.body }),
      art.el("path", { d: "M40 18 q6 -9 13 -4 q-4 5 -3 9 z", fill: fisch.fin }),
    ];
    if (fisch.muster === "streifen") {
      teile.push(art.el("path", {
        d: "M38 20 q4 12 0 24 M48 21 q4 11 0 22",
        fill: "none", stroke: fisch.fin, "stroke-width": 3.4, "stroke-linecap": "round",
      }));
    } else if (fisch.muster === "punkte") {
      teile.push(art.el("circle", { cx: 40, cy: 27, r: 3.2, fill: fisch.fin }));
      teile.push(art.el("circle", { cx: 47, cy: 35, r: 3.2, fill: fisch.fin }));
      teile.push(art.el("circle", { cx: 38, cy: 38, r: 2.6, fill: fisch.fin }));
    }
    teile.push(art.el("circle", { cx: 58, cy: 28, r: 4.2, fill: "#fdfbf6" }));
    teile.push(art.el("circle", { cx: 59, cy: 28, r: 2.2, fill: "#2b3440" }));
    return art.el("svg", { viewBox: "0 0 72 64", class: "ft-fisch-art", "aria-hidden": "true" }, teile);
  }

  // Dreht a auf dem kürzesten Weg Richtung b, aber höchstens um max: so
  // schwimmt der Fisch eine Kurve, statt in der Luft umzuspringen.
  function drehZu(a, b, max) {
    const diff = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    return a + Math.max(-max, Math.min(max, diff));
  }

  // Startplätze auf einem gemischten Raster statt rein zufällig: zwei Fische,
  // die schon zu Beginn übereinander liegen, sind nicht auseinanderzuhalten.
  // Nach dem Start dürfen sie sich kreuzen – das gehört zur Aufgabe.
  function startplaetze(anzahl) {
    const spalten = Math.max(1, Math.ceil(Math.sqrt(anzahl * 1.6)));
    const reihen = Math.ceil(anzahl / spalten);
    const platz = 1 - 2 * RAND;
    return shuffle([...Array(spalten * reihen).keys()]).slice(0, anzahl).map((zelle) => ({
      x: RAND + platz * (((zelle % spalten) + 0.5) / spalten + (Math.random() - 0.5) * 0.6 / spalten),
      y: RAND + platz * ((Math.floor(zelle / spalten) + 0.5) / reihen + (Math.random() - 0.5) * 0.6 / reihen),
    }));
  }

  function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  const state = { phase: "play", teich: 0, punkte: 0, fische: [], sperreBis: 0 };
  let shell = null;
  let prompt = null;
  let pond = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  function teichFuer(nummer) {
    return TEICHE[Math.min(nummer, TEICHE.length - 1)];
  }

  // ---------------------------------------------------------------------------
  // Der Teich
  // ---------------------------------------------------------------------------
  // Wasser mit ein paar Wellen, sonst nichts. Seerosen und Steine wären hier
  // fehl am Platz: wer sich zehn Fische merkt, soll nicht auch noch entscheiden
  // müssen, was davon ein Fisch ist.
  function buildPond() {
    const wrap = shell.el("div", "ft-pond");
    const back = art.el("svg", {
      class: "ft-pond-art", viewBox: "0 0 200 120", preserveAspectRatio: "none", "aria-hidden": "true",
    }, [
      // Ein weicher Verlauf statt zweier Wasserfarben: eine Kante quer durch den
      // Teich sähe aus wie ein Rand, an dem etwas endet.
      art.el("defs", {}, [
        art.el("linearGradient", { id: "ft-wasser", x1: "0", y1: "0", x2: "0", y2: "1" }, [
          art.el("stop", { offset: "0%", "stop-color": "#6ec7e6" }),
          art.el("stop", { offset: "100%", "stop-color": "#3ba3cf" }),
        ]),
      ]),
      art.el("rect", { x: 0, y: 0, width: 200, height: 120, fill: "url(#ft-wasser)" }),
      art.el("path", {
        d: "M14 26 q7 -5 14 0 M60 44 q7 -5 14 0 M120 20 q7 -5 14 0 M158 60 q7 -5 14 0 M36 84 q7 -5 14 0 M104 96 q7 -5 14 0",
        fill: "none", stroke: "#ffffff", "stroke-width": 2.4, "stroke-linecap": "round", opacity: 0.5,
      }),
    ]);
    wrap.append(back);
    // Ein Tipp ins Wasser kostet nichts – aber er darf auch nicht stumm
    // bleiben, sonst weiss ein Kind nicht, ob die App es überhaupt gemerkt hat.
    wrap.addEventListener("pointerdown", (event) => {
      if (state.phase !== "play" || event.target.closest(".ft-fisch")) return;
      splash(event);
    });
    return wrap;
  }

  function splash(event) {
    const box = pond.getBoundingClientRect();
    const ring = shell.el("span", "ft-platsch");
    ring.style.left = `${event.clientX - box.left}px`;
    ring.style.top = `${event.clientY - box.top}px`;
    pond.append(ring);
    window.setTimeout(() => ring.remove(), 460);
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    clearStep();
    stopLoop();
    shell.closeOverlay();
    shell.setPhase("play");
    state.phase = "play";
    state.teich = 0;
    state.punkte = 0;
    state.sperreBis = 0;
    shell.setCount(0);

    shell.clear();
    prompt = shell.el("p", "cm-prompt ft-prompt", "Tippe jeden Fisch einmal an.");
    pond = buildPond();
    shell.play.append(prompt, pond);

    nextPond();
    last = performance.now();
    frame = window.requestAnimationFrame(step);
  }

  function nextPond() {
    const teich = teichFuer(state.teich);
    pond.querySelectorAll(".ft-fisch").forEach((node) => node.remove());
    const plaetze = startplaetze(teich.fische);
    state.fische = shuffle(FISCHE).slice(0, teich.fische).map((fisch, index) => {
      const node = shell.el("button", "ft-fisch");
      node.type = "button";
      node.setAttribute("aria-label", fisch.name);
      node.title = fisch.name;
      node.append(fischSvg(fisch));
      // Das Rad, das sich nach dem Fang füllt: ein heller Kreis, darauf eine
      // blasse Spur und der grüne Bogen, der sie entlangwächst.
      const ring = art.el("svg", { viewBox: "0 0 24 24", class: "ft-ring", "aria-hidden": "true" }, [
        art.el("circle", { cx: 12, cy: 12, r: 11, fill: "#fdfbf6" }),
        art.el("circle", { cx: 12, cy: 12, r: 8, fill: "none", stroke: "#d5dde3", "stroke-width": 4 }),
        art.el("circle", {
          class: "ft-ring-fill", cx: 12, cy: 12, r: 8, fill: "none", stroke: "#3fa34d",
          "stroke-width": 4, "stroke-linecap": "round",
          "stroke-dasharray": "50.27", "stroke-dashoffset": "50.27", transform: "rotate(-90 12 12)",
        }),
      ]);
      node.append(ring);
      const haken = art.el("svg", { viewBox: "0 0 24 24", class: "ft-haken", "aria-hidden": "true" }, [
        art.el("circle", { cx: 12, cy: 12, r: 11, fill: "#3fa34d" }),
        art.el("path", {
          d: "M6 12.5 10 17 18 8", fill: "none", stroke: "#fdfbf6",
          "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round",
        }),
      ]);
      node.append(haken);
      pond.append(node);
      const eintrag = {
        art: fisch,
        node,
        gefangen: false,
        x: plaetze[index].x,
        y: plaetze[index].y,
        winkel: Math.random() * Math.PI * 2,
        tempo: teich.tempo,
      };
      node.addEventListener("click", () => tap(eintrag));
      return eintrag;
    });
    prompt.textContent = state.teich === 0
      ? "Tippe jeden Fisch einmal an."
      : `Teich ${state.teich + 1}: ${teich.fische} Fische.`;
    place();
  }

  // ---------------------------------------------------------------------------
  // Schwimmen
  // ---------------------------------------------------------------------------
  // Wie gross ein Fisch im aktuellen Teich ist und wie viel Platz er dadurch
  // am Rand braucht – in Anteilen der Teichgrösse, weil x und y so gerechnet
  // werden. Auf einem flachen Gerät begrenzt die Höhe: ein Fisch, der halb so
  // hoch ist wie der Teich, käme nie vom Rand weg.
  function masse(box) {
    const size = Math.max(40, Math.min(110, box.width * 0.11, box.height * 0.3));
    return { size, halbX: size / 2 / box.width, halbY: size * 0.45 / box.height };
  }

  function step(now) {
    frame = window.requestAnimationFrame(step);
    // Grosse Sprünge abfangen: nach einem Tabwechsel liegt now weit vorn, und
    // ein einziger Schritt schöbe alle Fische quer durch den Teich.
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state.phase !== "play" || !pond) return;
    const box = pond.getBoundingClientRect();
    if (!box.width) return;
    const { halbX, halbY } = masse(box);

    state.fische.forEach((fisch) => {
      // Sanftes Schlingern statt gerader Bahnen: gerade Linien wären leichter
      // zu verfolgen, und genau das Verfolgen ist die Aufgabe.
      fisch.winkel += (Math.random() - 0.5) * DREH * dt;
      // Am Rand dreht der Fisch eine Kurve zur Mitte, statt hart abzuprallen.
      // Gemessen wird ab seiner Nase, nicht ab seiner Mitte – sonst schaute er
      // schon aus dem Teich, bevor das Eindrehen anfängt.
      const amRand = fisch.x < RAND + halbX || fisch.x > 1 - RAND - halbX
        || fisch.y < RAND + halbY || fisch.y > 1 - RAND - halbY;
      if (amRand) fisch.winkel = drehZu(fisch.winkel, Math.atan2(0.5 - fisch.y, 0.5 - fisch.x), EINDREHEN * dt);

      const schritt = TEMPO * fisch.tempo * dt;
      fisch.x = Math.max(halbX, Math.min(1 - halbX, fisch.x + Math.cos(fisch.winkel) * schritt));
      // Der Teich ist breiter als hoch: senkrecht dieselbe Strecke in Anteilen
      // wäre optisch viel schneller, deshalb gebremst.
      fisch.y = Math.max(halbY, Math.min(1 - halbY, fisch.y + Math.sin(fisch.winkel) * schritt * 0.6));
    });
    place();
  }

  function place() {
    if (!pond) return;
    const box = pond.getBoundingClientRect();
    if (!box.width) return;
    const { size, halbX, halbY } = masse(box);
    state.fische.forEach((fisch) => {
      // Nach einem Drehen des Geräts kann ein Fisch ausserhalb liegen: hier
      // wird er zurückgeholt, bevor er gezeichnet wird.
      fisch.x = Math.max(halbX, Math.min(1 - halbX, fisch.x));
      fisch.y = Math.max(halbY, Math.min(1 - halbY, fisch.y));
      const links = Math.cos(fisch.winkel) < 0;
      fisch.node.style.width = `${size}px`;
      fisch.node.style.height = `${size * 0.9}px`;
      fisch.node.style.transform =
        `translate(${fisch.x * box.width - size / 2}px, ${fisch.y * box.height - size * 0.45}px)`;
      // Nur das Bild wird gespiegelt, nicht der Knopf: das Häkchen soll auch
      // bei einem nach links schwimmenden Fisch richtig herum stehen.
      fisch.node.style.setProperty("--ft-blick", links ? "-1" : "1");
    });
  }

  function tap(fisch) {
    if (state.phase !== "play") return;
    // Solange das Rad läuft, zählt kein Tipp – auch nicht auf einen anderen
    // Fisch. Das Rad zeigt, dass gewartet wird.
    if (performance.now() < state.sperreBis) return;

    if (fisch.gefangen) {
      state.phase = "over";
      fisch.node.classList.add("is-doppelt");
      kids()?.playJingle?.("retry");
      state.fische.forEach((other) => { other.node.disabled = true; });
      stepTimer = window.setTimeout(() => finish(fisch.art), 760);
      return;
    }

    fisch.gefangen = true;
    state.punkte += 1;
    shell.setCount(state.punkte);
    kids()?.playJingle?.("star");
    kids()?.vibrate?.(16);
    state.sperreBis = performance.now() + SPERRE_MS;

    // Erst füllt sich das Rad über dem Fisch, dann wird daraus das Häkchen.
    // Das Häkchen steht kurz und geht wieder weg: bliebe es, müsste sich
    // niemand mehr merken, wen er schon hatte.
    const node = fisch.node;
    node.classList.remove("is-gefangen", "is-laden");
    void node.offsetWidth;
    node.style.setProperty("--ft-sperre", `${SPERRE_MS}ms`);
    node.classList.add("is-laden");
    window.setTimeout(() => {
      node.classList.remove("is-laden");
      if (!node.isConnected) return;
      node.classList.add("is-gefangen");
      kids()?.playJingle?.("correct");
      window.setTimeout(() => node.classList.remove("is-gefangen"), FANG_MS);
    }, SPERRE_MS);

    if (state.fische.some((other) => !other.gefangen)) return;
    state.teich += 1;
    prompt.textContent = "Alle gefangen!";
    // Der nächste Teich kommt erst, wenn das letzte Häkchen dagestanden hat.
    stepTimer = window.setTimeout(nextPond, SPERRE_MS + FANG_MS);
  }

  function runsText(runs) {
    const left = RUNS_FOR_DONE - runs;
    if (left <= 0) return "Dieses Spiel ist geschafft – der Wagen ist gebaut.";
    return left === 1
      ? "Noch eine Runde bis zum fertigen Wagen."
      : `Noch ${left} Runden bis zum fertigen Wagen.`;
  }

  function resultSpeech(punkte, teiche, runs) {
    const fische = punkte === 1 ? "einen Fisch" : `${punkte} Fische`;
    const geschafft = teiche === 1 ? "einen Teich" : `${teiche} Teiche`;
    return `Du hast ${fische} gefangen und ${geschafft} leer gefischt. ${runsText(runs)}`;
  }

  function finish(doppelt) {
    clearStep();
    stopLoop();
    state.phase = "over";
    const punkte = state.punkte;
    const next = recordRun(punkte);
    kids()?.playJingle?.("win");
    shell.showResult({
      label: "Deine Fische",
      points: punkte,
      detail: `${doppelt.name}: den hattest du schon.`,
      scores: next.scores,
      top: TOP_COUNT,
      note: { text: runsText(next.runs), done: next.runs >= RUNS_FOR_DONE },
      speech: resultSpeech(punkte, state.teich, next.runs),
    });
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  // Kein Erklärbild und kein Startknopf: ein Tipp auf das Gebäude, und die
  // Fische schwimmen. Was zu tun ist, sagt der Lautsprecher.
  shell = shellApi.mount({
    host,
    title: "Fischteich",
    area: "konzentration",
    accent: "#00A5B5",
    accentDark: "#00707c",
    help: HELP,
    clock: false,
    onRestart: startRun,
  });

  startRun();

  window.addEventListener("resize", place);
  window.addEventListener("orientationchange", place);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  window.LernappFischteich = { TEICHE, FISCHE, TEMPO, RUNS_FOR_DONE, teichFuer };
})();
