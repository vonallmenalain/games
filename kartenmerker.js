/*
 * kartenmerker.js – Karten-Merker als Spiel auf Zeit.
 *
 * Ein einziger Lauf: die erste Karte steht da und will nur gemerkt werden,
 * dann 45 Sekunden lang Karte um Karte mit derselben Frage – dieselbe wie die
 * davor? Was zählt, ist die Punktzahl am Schluss.
 *
 * Bühne, Knöpfe, Uhr und Bestenliste kommen aus game-shell.js; hier steht nur,
 * was den Karten-Merker vom nächsten Tempospiel unterscheidet.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "cardmatch") return;

  const host = document.querySelector("#cm-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi || !window.LernappTrainArt) return;

  const kids = () => window.LernappKids || null;

  // ---------------------------------------------------------------------------
  // Regeln
  // ---------------------------------------------------------------------------
  const ROUND_MS = 45000;
  // Falsch kostet mehr, als richtig einbringt. Ohne dieses Gefälle wäre blindes
  // Draufhauen die beste Taktik: bei zwei Knöpfen trifft man die Hälfte.
  const POINTS_RIGHT = 2;
  const POINTS_WRONG = -3;
  const MATCH_RATE = 0.4;

  // Jedes Bild hat seine feste Farbe. Sonst müsste ein Kind unter Zeitdruck
  // raten, ob "gleich" die Form oder auch die Farbe meint.
  const CARDS = [
    { symbol: "🍎", color: "#ef476f" },
    { symbol: "⭐", color: "#ffd166" },
    { symbol: "🐸", color: "#06d6a0" },
    { symbol: "🚗", color: "#4285f4" },
    { symbol: "🌻", color: "#ff9f1c" },
    { symbol: "🐟", color: "#2ec4d6" },
    { symbol: "🎈", color: "#ff5da2" },
    { symbol: "🐝", color: "#8338ec" },
  ];

  // Fünf gespielte Runden, und der Wagen im Bereich Geschwindigkeit ist für
  // dieses Spiel fertig – unabhängig von der Punktzahl. Wer übt, kommt voran;
  // wer einen schlechten Tag hat, auch.
  // Wie viele, sagt das Wagen-Set: fünf im ersten, neun im zweiten (kids.js).
  const RUNS_FOR_DONE = window.LernappKids?.wagonRounds?.() || 5;
  const TOP_COUNT = 5;

  const HELP = [
    "Karten-Merker. Du siehst immer nur eine Karte.",
    "Merk dir die Karte. Dann kommt die nächste.",
    "Ist die neue Karte dieselbe wie die davor, tippst du auf den grünen Knopf: Grün heisst gleich.",
    "Ist sie eine andere, tippst du auf den roten Knopf: Rot heisst anders.",
    "Du hast fünfundvierzig Sekunden. Jede richtige Karte gibt Punkte, jede falsche kostet mehr, als eine richtige einbringt.",
    "Tippe auf Starten, wenn du bereit bist.",
  ].join(" ");

  // ---------------------------------------------------------------------------
  // Bestenliste – lokal und in der Cloud
  // ---------------------------------------------------------------------------
  // Zusammengeführt wird vereinigend: wer auf dem Handy 50 Punkte geschafft hat
  // und danach auf dem Tablet 10, hat immer noch 50 geschafft.
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.cardmatch", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  // Kartenlogik
  // ---------------------------------------------------------------------------
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  function nextCard(previous) {
    if (!previous) return pick(CARDS);
    if (Math.random() < MATCH_RATE) return previous;
    return pick(CARDS.filter((card) => card.symbol !== previous.symbol));
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  const state = { phase: "intro", previous: null, current: null, right: 0, wrong: 0, locked: false };
  let shell = null;
  let cardHost = null;
  let stepTimer = null;

  const score = () => Math.max(0, state.right * POINTS_RIGHT + state.wrong * POINTS_WRONG);

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function cardFace(card, extra = "") {
    const face = shell.el("div", `cm-card ${extra}`.trim());
    face.style.setProperty("--card-color", card.color);
    face.append(shell.el("span", "cm-card-symbol", card.symbol));
    return face;
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  // Die erste Karte will nur gemerkt werden – zu ihr gibt es nichts zu
  // entscheiden, also auch keine Knöpfe. Darunter steht Starten. Erst danach
  // kommt die zweite Karte, kommen die beiden Knöpfe, und erst dann läuft
  // die Uhr los.
  function showIntro() {
    clearStep();
    shell.stopClock();
    shell.closeOverlay();
    shell.setPhase("intro");
    state.phase = "intro";
    state.right = 0;
    state.wrong = 0;
    state.locked = false;
    state.previous = nextCard(null);
    state.current = null;
    shell.setCount(0);

    shell.clear();
    shell.play.append(shell.el("p", "cm-prompt", "Merk dir diese Karte."));
    cardHost = shell.el("div", "cm-card-host");
    cardHost.append(cardFace(state.previous));
    shell.play.append(cardHost);

    const start = shell.el("button", "cm-start", "Starten");
    start.type = "button";
    start.addEventListener("click", beginRound);
    shell.play.append(start);
  }

  function runsText(runs) {
    const left = RUNS_FOR_DONE - runs;
    if (left <= 0) return "Dieses Spiel ist geschafft – der Wagen ist gebaut.";
    return left === 1
      ? "Noch eine Runde bis zum fertigen Wagen."
      : `Noch ${left} Runden bis zum fertigen Wagen.`;
  }

  // Was der Lautsprecher am Schluss sagt. Ausgeschrieben statt abgekürzt: ein
  // Kind, das die Zahlen auf der Tafel nicht liest, soll hier alles hören –
  // die Punkte, die Karten, und wie weit es noch bis zum Wagen hat.
  function resultSpeech(points, runs) {
    const many = (count, one, more) =>
      count === 0 ? `keine ${one}` : count === 1 ? `eine ${one}` : `${count} ${more}`;
    const punkte = points === 1 ? "einen Punkt" : `${points} Punkte`;
    const richtig = many(state.right, "Karte richtig", "Karten richtig");
    const falsch = many(state.wrong, "falsche", "falsche");
    return `Du hast ${punkte}. ${richtig}, ${falsch}. ${runsText(runs)}`;
  }

  function beginRound() {
    clearStep();
    state.phase = "play";
    state.locked = false;
    // Die erste Karte bleibt die, die das Kind sich gemerkt hat.
    if (!state.previous) state.previous = nextCard(null);
    state.current = nextCard(state.previous);
    shell.setPhase("play");
    shell.setCount(state.right);
    renderPlay();
    shell.startClock(ROUND_MS, finish);
  }

  function renderPlay() {
    shell.clear();
    shell.play.append(shell.el("p", "cm-prompt", "Gleich wie die Karte davor?"));
    cardHost = shell.el("div", "cm-card-host");
    shell.play.append(cardHost);
    drawCard();

    const choices = shell.el("div", "cm-choices");
    [
      { label: "Gleich", match: true, cls: "is-same" },
      { label: "Anders", match: false, cls: "is-other" },
    ].forEach((choice) => {
      const button = shell.el("button", `cm-choice ${choice.cls}`, choice.label);
      button.type = "button";
      button.addEventListener("click", () => answer(choice.match));
      choices.append(button);
    });
    shell.play.append(choices);
  }

  function drawCard() {
    if (!cardHost) return;
    cardHost.innerHTML = "";
    cardHost.append(cardFace(state.current));
  }

  function answer(saysMatch) {
    if (state.phase !== "play" || state.locked) return;
    const correct = (state.current.symbol === state.previous.symbol) === saysMatch;
    state.locked = true;
    if (correct) {
      state.right += 1;
      kids()?.playJingle?.("correct");
      kids()?.vibrate?.(16);
    } else {
      state.wrong += 1;
      kids()?.playJingle?.("retry");
    }
    shell.setCount(state.right);
    cardHost?.querySelector(".cm-card")?.classList.add(correct ? "is-right" : "is-wrong");
    // Kurz zeigen, ob es gestimmt hat, dann sofort die nächste Karte. Es geht
    // um Tempo: eine Erklärung würde von den 45 Sekunden abziehen.
    stepTimer = window.setTimeout(nextRound, correct ? 260 : 460);
  }

  function nextRound() {
    if (state.phase !== "play") return;
    state.previous = state.current;
    state.current = nextCard(state.previous);
    state.locked = false;
    drawCard();
  }

  function finish() {
    clearStep();
    state.phase = "over";
    const points = score();
    const next = recordRun(points);
    kids()?.playJingle?.("win");
    shell.showResult({
      points,
      detail: `${state.right} richtig · ${state.wrong} falsch`,
      scores: next.scores,
      top: TOP_COUNT,
      note: { text: runsText(next.runs), done: next.runs >= RUNS_FOR_DONE },
      speech: resultSpeech(points, next.runs),
    });
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Karten-Merker",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    help: HELP,
    onRestart: showIntro,
  });

  showIntro();

  // Tastatur: links und rechts wie die beiden Knöpfe, Leertaste startet.
  document.addEventListener("keydown", (event) => {
    if (state.phase === "play") {
      if (event.key === "ArrowLeft") { event.preventDefault(); answer(true); }
      if (event.key === "ArrowRight") { event.preventDefault(); answer(false); }
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      if (document.activeElement?.tagName === "BUTTON") return;
      event.preventDefault();
      if (state.phase === "intro") beginRound();
    }
  });

  window.addEventListener("pagehide", clearStep);
})();
