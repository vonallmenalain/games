/*
 * schwarmfokus.js – Schwarm-Fokus als Runde auf Zeit.
 *
 * Fünf Fische in einer Reihe. Nur der mittlere zählt; die vier aussen zeigen
 * mal in dieselbe Richtung und mal in die andere und wollen ablenken. 45
 * Sekunden lang: links oder rechts, so oft wie möglich richtig.
 *
 * Geantwortet wird auf drei Wegen – die beiden grossen Knöpfe, die Pfeiltasten
 * und ein Wisch nach links oder rechts. Der Wisch ist am schnellsten und
 * deshalb unter Zeitdruck der natürliche Weg; die Knöpfe bleiben für Kinder,
 * denen ein Wisch nicht gelingt.
 *
 * Bühne, Uhr und Bestenliste kommen aus game-shell.js.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "flanker") return;

  const host = document.querySelector("#sf-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  const art = window.LernappTrainArt;
  if (!host || !shellApi || !art) return;

  const kids = () => window.LernappKids || null;

  // ---------------------------------------------------------------------------
  // Regeln
  // ---------------------------------------------------------------------------
  const ROUND_MS = 45000;
  // Zwei Fische links, zwei rechts, dazwischen der eine, auf den es ankommt.
  const FLANKERS = 2;
  // Wie oft die äusseren Fische in die andere Richtung zeigen. Bei jedem
  // zweiten Mal: seltener wäre keine Übung, häufiger nur noch Ärger.
  const INCONGRUENT = 0.5;
  // Wie viele, sagt das Wagen-Set: fünf im ersten, neun im zweiten (kids.js).
  const RUNS_FOR_DONE = window.LernappKids?.wagonRounds?.() || 5;
  const TOP_COUNT = 5;
  // Ein Fehler kostet eine längere Pause als ein Treffer. Es gibt keine
  // Minuspunkte – aber bei zwei Knöpfen träfe blindes Draufhauen die Hälfte,
  // und die Pause ist es, die das teuer macht.
  const PAUSE_RIGHT = 300;
  const PAUSE_WRONG = 900;

  const HELP = [
    "Schwarm-Fokus. Du siehst fünf Fische nebeneinander.",
    "Nur der mittlere zählt – er ist grösser und leuchtet orange.",
    "Schaut er nach links, wischst du nach links oder tippst auf den linken Knopf.",
    "Schaut er nach rechts, wischst du nach rechts oder tippst auf den rechten Knopf.",
    "Die vier Fische aussen wollen dich austricksen: sie schauen oft in die andere Richtung.",
    "Du hast fünfundvierzig Sekunden. Schaff so viele wie du kannst.",
    "Tippe auf Starten, wenn du bereit bist.",
  ].join(" ");

  // ---------------------------------------------------------------------------
  // Bestenliste – lokal und in der Cloud
  // ---------------------------------------------------------------------------
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.flanker", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  // Der Fisch
  // ---------------------------------------------------------------------------
  // Nach links wird gespiegelt statt gedreht – ein um 180 Grad gedrehter Fisch
  // läge auf dem Rücken.
  function fish(direction, target) {
    const body = target ? "#ff9f1c" : "#7fb2d9";
    const fin = target ? "#ef7d0a" : "#6699c4";
    const parts = [
      art.el("path", { d: "M6 24 L20 12 L20 36 Z", fill: fin }),
      art.el("ellipse", { cx: 36, cy: 24, rx: 22, ry: 14, fill: body }),
      art.el("path", { d: "M34 10 Q38 2 44 10 Z", fill: fin }),
      art.el("circle", { cx: 49, cy: 20, r: 4.6, fill: "#ffffff" }),
      art.el("circle", { cx: 50.5, cy: 20, r: 2.4, fill: "#243047" }),
    ];
    return art.el("svg", {
      viewBox: "0 0 64 48",
      class: `sf-fish${target ? " is-target" : ""}`,
      role: "img",
      "aria-label": `Fisch schaut nach ${direction === "left" ? "links" : "rechts"}`,
      style: direction === "left" ? "transform: scaleX(-1)" : "",
    }, parts);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  const state = { phase: "intro", target: null, flanker: null, right: 0, wrong: 0, locked: false };
  let shell = null;
  let swarm = null;
  let stepTimer = null;

  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function nextTrial() {
    state.target = pick(["left", "right"]);
    state.flanker = Math.random() < INCONGRUENT
      ? (state.target === "left" ? "right" : "left")
      : state.target;
    state.locked = false;
    drawSwarm();
  }

  function drawSwarm(mark = "") {
    if (!swarm) return;
    swarm.innerHTML = "";
    swarm.className = `sf-swarm ${mark}`.trim();
    for (let i = 0; i < FLANKERS * 2 + 1; i += 1) {
      const target = i === FLANKERS;
      const slot = shell.el("span", `sf-slot${target ? " is-target" : ""}`);
      slot.append(fish(target ? state.target : state.flanker, target));
      swarm.append(slot);
    }
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function showIntro() {
    clearStep();
    shell.stopClock();
    shell.closeOverlay();
    shell.setPhase("intro");
    state.phase = "intro";
    state.right = 0;
    state.wrong = 0;
    state.locked = false;
    shell.setCount(0);

    shell.clear();
    shell.play.append(shell.el("p", "cm-prompt", "Wohin schaut der Fisch in der Mitte?"));
    // Ein Beispiel steht schon da: die vier aussen schauen nach links, der
    // mittlere nach rechts. Was zu tun ist, sieht man daran schneller als an
    // jedem Satz.
    state.target = "right";
    state.flanker = "left";
    swarm = shell.el("div", "sf-swarm");
    shell.play.append(swarm);
    drawSwarm();

    const start = shell.el("button", "cm-start", "Starten");
    start.type = "button";
    start.addEventListener("click", beginRound);
    shell.play.append(start);
  }

  function beginRound() {
    clearStep();
    state.phase = "play";
    shell.setPhase("play");
    shell.setCount(0);
    renderPlay();
    nextTrial();
    shell.startClock(ROUND_MS, finish);
  }

  function renderPlay() {
    shell.clear();
    shell.play.append(shell.el("p", "cm-prompt", "Wohin schaut der Fisch in der Mitte?"));
    swarm = shell.el("div", "sf-swarm");
    shell.play.append(swarm);

    const keys = shell.el("div", "sf-keys");
    [
      { dir: "left", label: "Nach links", arrow: "M15 5 8 12l7 7" },
      { dir: "right", label: "Nach rechts", arrow: "M9 5l7 7-7 7" },
    ].forEach((key) => {
      const button = shell.el("button", `sf-key is-${key.dir}`);
      button.type = "button";
      button.setAttribute("aria-label", key.label);
      button.append(art.el("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }, [
        art.el("path", {
          d: key.arrow, fill: "none", stroke: "currentColor", "stroke-width": 3.2,
          "stroke-linecap": "round", "stroke-linejoin": "round",
        }),
      ]));
      button.addEventListener("click", () => answer(key.dir));
      keys.append(button);
    });
    shell.play.append(keys);
  }

  function answer(direction) {
    if (state.phase !== "play" || state.locked) return;
    state.locked = true;
    const correct = direction === state.target;
    if (correct) {
      state.right += 1;
      kids()?.playJingle?.("correct");
      kids()?.vibrate?.(16);
    } else {
      state.wrong += 1;
      kids()?.playJingle?.("retry");
    }
    shell.setCount(state.right);
    drawSwarm(correct ? "is-right" : "is-wrong");
    // Ein Fehler kostet die längere Pause – das ist der ganze Preis, den es
    // fürs Raten gibt, und unter der Uhr ist er hoch genug.
    stepTimer = window.setTimeout(() => {
      if (state.phase === "play") nextTrial();
    }, correct ? PAUSE_RIGHT : PAUSE_WRONG);
  }

  function runsText(runs) {
    const left = RUNS_FOR_DONE - runs;
    if (left <= 0) return "Dieses Spiel ist geschafft – der Wagen ist gebaut.";
    return left === 1
      ? "Noch eine Runde bis zum fertigen Wagen."
      : `Noch ${left} Runden bis zum fertigen Wagen.`;
  }

  function resultSpeech(points, runs) {
    const fische = points === 1 ? "einen Fisch" : `${points} Fische`;
    const daneben = state.wrong === 0
      ? "Kein einziger daneben."
      : state.wrong === 1 ? "Einer war daneben." : `${state.wrong} waren daneben.`;
    return `Du hast ${fische} richtig erkannt. ${daneben} ${runsText(runs)}`;
  }

  function finish() {
    clearStep();
    state.phase = "over";
    const points = state.right;
    const next = recordRun(points);
    kids()?.playJingle?.("win");
    shell.showResult({
      label: "Richtige Fische",
      points,
      detail: `${state.right} richtig · ${state.wrong} daneben`,
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
    title: "Schwarm-Fokus",
    area: "konzentration",
    accent: "#00A5B5",
    accentDark: "#00707c",
    help: HELP,
    onRestart: showIntro,
  });

  showIntro();

  // --- Wischen ---------------------------------------------------------------
  // Auf der ganzen Spielfläche, nicht nur auf dem Schwarm: unter Zeitdruck
  // trifft ein Kind keine kleine Fläche. Ein Wisch zählt erst ab 40 Pixeln und
  // nur, wenn er mehr quer als hoch geht – sonst löste jedes Wackeln beim
  // Tippen eine Antwort aus.
  const SWIPE_MIN = 40;
  let swipe = null;

  host.addEventListener("pointerdown", (event) => {
    if (state.phase !== "play") return;
    swipe = { x: event.clientX, y: event.clientY };
  });

  host.addEventListener("pointerup", (event) => {
    if (!swipe || state.phase !== "play") { swipe = null; return; }
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) <= Math.abs(dy)) return;
    answer(dx > 0 ? "right" : "left");
  });

  host.addEventListener("pointercancel", () => { swipe = null; });

  // --- Tastatur --------------------------------------------------------------
  document.addEventListener("keydown", (event) => {
    if (state.phase === "play") {
      if (event.key === "ArrowLeft") { event.preventDefault(); answer("left"); }
      if (event.key === "ArrowRight") { event.preventDefault(); answer("right"); }
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
