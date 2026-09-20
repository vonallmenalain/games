/*
 * strandschatz.js – Strand-Schätze als eine Runde ohne Uhr.
 *
 * Am Strand liegen Schätze. Wer einen antippt, den er noch nicht hat, nimmt ihn
 * mit; danach liegt alles neu verteilt da, die gesammelten wieder mit dabei und
 * drei neue dazu. Die Runde endet erst, wenn man denselben Schatz zweimal
 * nimmt. Was zählt, ist, wie viele es bis dahin geworden sind.
 *
 * Kein Zeitdruck: die Aufgabe ist das Merken, und eine laufende Uhr würde ein
 * Kind zum Raten drängen statt zum Nachdenken. Die Schwierigkeit kommt von
 * allein – jede Runde liegt ein Schatz mehr da.
 *
 * Bühne, Knöpfe und Bestenliste kommen aus game-shell.js, die Gegenstände aus
 * strand-art.js; hier steht nur die Regel.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "beach") return;

  const host = document.querySelector("#st-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  const strand = window.LernappStrandArt;
  const art = window.LernappTrainArt;
  if (!host || !shellApi || !strand || !art) return;

  const kids = () => window.LernappKids || null;

  // ---------------------------------------------------------------------------
  // Regeln
  // ---------------------------------------------------------------------------
  // Drei neue Schätze je Runde: die erste Runde zeigt drei, danach immer alle
  // gesammelten plus drei. So wächst die Aufgabe um genau einen Schritt pro
  // Runde – schnell genug, dass es spannend bleibt, langsam genug, dass ein
  // Kind mitkommt.
  const NEW_PER_ROUND = 3;
  // Wie viele, sagt das Wagen-Set: fünf im ersten, neun im zweiten (kids.js).
  const RUNS_FOR_DONE = window.LernappKids?.wagonRounds?.() || 5;
  const TOP_COUNT = 5;

  const HELP = [
    "Strand-Schätze. Am Strand liegen Schätze im Sand.",
    "Tippe einen an. Er kommt in deine Kiste.",
    "Danach liegt alles neu verteilt da: deine gesammelten Schätze wieder mit dabei, und drei neue dazu.",
    "Tippe jedes Mal einen an, den du noch nicht hast.",
    "Nimmst du aus Versehen denselben noch einmal, ist die Runde vorbei.",
    "Du hast so viel Zeit, wie du willst – zähl in Ruhe nach, welche du schon hattest.",
  ].join(" ");

  // ---------------------------------------------------------------------------
  // Bestenliste – lokal und in der Cloud
  // ---------------------------------------------------------------------------
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.beachtreasure", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  // Auswahl und Verteilung
  // ---------------------------------------------------------------------------
  function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Die Schätze liegen scheinbar zufällig – aber nie übereinander. Deshalb wird
  // der Strand in ein Raster mit genug Feldern geteilt, die Felder werden
  // gemischt, und jeder Schatz wackelt nur innerhalb seines Feldes. Rein
  // zufällige Punkte müsste man auf Abstand nachprüfen und könnten bei zwanzig
  // Schätzen gar keine Lösung mehr haben.
  // Die Fläche, auf der Schätze liegen dürfen: der Strand ohne das Wasser oben
  // und mit etwas Luft zum Rand. Ein Schatz im Wasser sähe aus, als gehöre er
  // nicht dazu.
  const SAND = { top: 0.19, bottom: 0.06, side: 0.03 };

  function sandBox() {
    const box = beach.getBoundingClientRect();
    return {
      x: box.width * SAND.side,
      y: box.height * SAND.top,
      width: box.width * (1 - 2 * SAND.side),
      height: box.height * (1 - SAND.top - SAND.bottom),
    };
  }

  function planLayout(count) {
    const box = sandBox();
    const aspect = box.height > 0 ? box.width / box.height : 1.6;
    let cols = Math.max(1, Math.min(count, Math.round(Math.sqrt(count * aspect))));
    let rows = Math.ceil(count / cols);
    // Ein Rest wie 7 Schätze in 3 × 3 lässt eine halbe Reihe leer; eine Spalte
    // mehr verteilt sie gleichmässiger.
    while (cols * rows - count >= rows && cols > 1) { cols -= 1; rows = Math.ceil(count / cols); }
    const cells = shuffle([...Array(cols * rows).keys()]).slice(0, count);
    return {
      cols,
      rows,
      cells,
      jitter: cells.map(() => ({ x: Math.random() - 0.5, y: Math.random() - 0.5 })),
    };
  }

  // Rechnet den Plan in Pixel um. Getrennt vom Plan, damit ein Drehen des
  // Geräts die Schätze nur neu misst und nicht neu mischt – ein Kind, dem
  // mitten in der Runde alles umspringt, verliert seinen Faden.
  function placeItems() {
    if (!plan || !beach) return;
    const box = sandBox();
    if (!box.width) return;
    const cellW = box.width / plan.cols;
    const cellH = box.height / plan.rows;
    const size = Math.max(30, Math.min(150, Math.min(cellW, cellH) * 0.78));
    const roomX = Math.max(0, cellW - size) * 0.9;
    const roomY = Math.max(0, cellH - size) * 0.9;

    nodes.forEach((node, index) => {
      const cell = plan.cells[index];
      const jitter = plan.jitter[index];
      const cx = box.x + (cell % plan.cols + 0.5) * cellW + jitter.x * roomX;
      const cy = box.y + (Math.floor(cell / plan.cols) + 0.5) * cellH + jitter.y * roomY;
      node.style.width = `${size}px`;
      node.style.height = `${size}px`;
      node.style.left = `${cx - size / 2}px`;
      node.style.top = `${cy - size / 2}px`;
    });
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  const state = { phase: "play", collected: [], onSand: [], locked: false };
  let shell = null;
  let beach = null;
  let prompt = null;
  let plan = null;
  let nodes = [];
  let stepTimer = null;

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  // ---------------------------------------------------------------------------
  // Der Strand
  // ---------------------------------------------------------------------------
  // Sand mit einem Streifen Wasser darüber, sonst nichts. Muscheln oder Steine
  // zur Zierde wären hier fehl am Platz: ein Kind, das sich zwölf Gegenstände
  // merkt, müsste bei jedem Ding erst entscheiden, ob es dazugehört.
  function buildBeach() {
    const wrap = shell.el("div", "st-beach");
    const back = art.el("svg", {
      class: "st-beach-art", viewBox: "0 0 200 120", preserveAspectRatio: "none", "aria-hidden": "true",
    }, [
      art.el("rect", { x: 0, y: 0, width: 200, height: 120, fill: "#f3dfae" }),
      art.el("path", {
        d: "M0 0 h200 v13 c-8 5 -17 5 -25 0 s-17 -5 -25 0 s-17 5 -25 0 s-17 -5 -25 0 s-17 5 -25 0 s-17 -5 -25 0 s-17 5 -25 0 z",
        fill: "#79c7e3",
      }),
      art.el("path", {
        d: "M0 13 c8 5 17 5 25 0 s17 -5 25 0 s17 5 25 0 s17 -5 25 0 s17 5 25 0 s17 -5 25 0 s17 5 25 0 v4 c-8 5 -17 5 -25 0 s-17 -5 -25 0 s-17 5 -25 0 s-17 -5 -25 0 s-17 5 -25 0 s-17 -5 -25 0 s-17 5 -25 0 z",
        fill: "#ffffff", opacity: 0.7,
      }),
      art.el("path", { d: "M0 112 h200 v8 h-200 z", fill: "#e6cd97" }),
    ]);
    wrap.append(back);
    return wrap;
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    clearStep();
    shell.closeOverlay();
    shell.setPhase("play");
    state.phase = "play";
    state.collected = [];
    state.locked = false;
    shell.setCount(0);

    shell.clear();
    prompt = shell.el("p", "st-prompt", "Such dir einen Schatz aus.");
    shell.play.append(prompt);
    beach = buildBeach();
    shell.play.append(beach);

    nextRound();
  }

  function nextRound() {
    const taken = new Set(state.collected.map((item) => item.id));
    const pool = strand.TREASURES.filter((item) => !taken.has(item.id));
    // Alles eingesammelt: eine perfekte Runde, und mehr geht nicht.
    if (!pool.length) { finish(null); return; }

    const fresh = shuffle(pool).slice(0, Math.min(NEW_PER_ROUND, pool.length));
    state.onSand = shuffle([...state.collected, ...fresh]);
    state.locked = false;
    prompt.textContent = state.collected.length
      ? "Welchen Schatz hattest du noch nicht?"
      : "Such dir einen Schatz aus.";
    drawSand();
  }

  function drawSand() {
    beach.querySelectorAll(".st-item").forEach((node) => node.remove());
    plan = planLayout(state.onSand.length);
    nodes = state.onSand.map((item) => {
      const button = shell.el("button", "st-item");
      button.type = "button";
      button.setAttribute("aria-label", item.name);
      button.title = item.name;
      button.append(strand.treasureSvg(item.id));
      button.addEventListener("click", () => tap(item, button));
      beach.append(button);
      return button;
    });
    placeItems();
  }

  function tap(item, node) {
    if (state.phase !== "play" || state.locked) return;
    state.locked = true;
    const known = state.collected.some((old) => old.id === item.id);

    if (!known) {
      state.collected.push(item);
      shell.setCount(state.collected.length);
      node.classList.add("is-right");
      kids()?.playJingle?.("correct");
      kids()?.vibrate?.(16);
      // Kurz zeigen, dass er in die Kiste wandert, dann neu verteilen.
      stepTimer = window.setTimeout(nextRound, 460);
      return;
    }

    node.classList.add("is-wrong");
    kids()?.playJingle?.("retry");
    nodes.forEach((other) => { other.disabled = true; });
    stepTimer = window.setTimeout(() => finish(item), 760);
  }

  function runsText(runs) {
    const left = RUNS_FOR_DONE - runs;
    if (left <= 0) return "Dieses Spiel ist geschafft – der Wagen ist gebaut.";
    return left === 1
      ? "Noch eine Runde bis zum fertigen Wagen."
      : `Noch ${left} Runden bis zum fertigen Wagen.`;
  }

  function resultSpeech(points, runs) {
    const schaetze = points === 1 ? "einen Schatz" : `${points} Schätze`;
    return `Du hast ${schaetze} gefunden. ${runsText(runs)}`;
  }

  // doppelt = der Schatz, der schon in der Kiste lag. Null, wenn der Strand
  // leer geräumt war.
  function finish(doppelt) {
    clearStep();
    state.phase = "over";
    const points = state.collected.length;
    const next = recordRun(points);
    kids()?.playJingle?.("win");
    shell.showResult({
      label: "Deine Schätze",
      points,
      // Ohne Artikel: der Krebs, die Sandburg, das Segelboot – ein "den" oder
      // "die" davor müsste für jeden Schatz einzeln stimmen.
      detail: doppelt
        ? `${doppelt.name}: schon in deiner Kiste.`
        : "Du hast alle Schätze am Strand gefunden!",
      scores: next.scores,
      top: TOP_COUNT,
      note: { text: runsText(next.runs), done: next.runs >= RUNS_FOR_DONE },
      speech: resultSpeech(points, next.runs),
    });
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  // Kein Erklärbild und kein Startknopf: ein Tipp auf das Gebäude, und die
  // ersten drei Schätze liegen da. Was zu tun ist, sagt der Lautsprecher.
  shell = shellApi.mount({
    host,
    title: "Strand-Schätze",
    area: "gedaechtnis",
    accent: "#7C5CE6",
    accentDark: "#5a41b8",
    help: HELP,
    clock: false,
    onRestart: startRun,
  });

  startRun();

  window.addEventListener("resize", placeItems);
  window.addEventListener("orientationchange", placeItems);
  window.addEventListener("pagehide", clearStep);
})();
