/*
 * doppelt.js – Doppelt gleich: zwei Karten, ein gemeinsames Bild, auf Zeit.
 *
 * Zwei runde Karten liegen nebeneinander, auf jeder ein paar Bilder. Genau
 * eines ist auf beiden – antippen, egal auf welcher Karte, und sofort liegen
 * die nächsten zwei da. Fünfundvierzig Sekunden, so viele Paare wie möglich.
 * Mit jedem zweiten Treffer kommt ein Bild mehr auf die Karten, bis es sechs
 * sind: die Regel bleibt dieselbe, nur das Suchen wird länger.
 *
 * Die Bilder liegen gedreht und in wechselnder Grösse, jedes Mal anders.
 * Sonst fände ein Kind das Paar über die Stelle oder die Grösse statt über die
 * Form – und geübt würde nicht das Vergleichen, sondern das Muster.
 *
 * Ein Fehltipp kostet keine Punkte, aber eine längere Pause als ein Treffer:
 * bei drei Bildern je Karte träfe blindes Tippen jedes dritte Mal, und die
 * Pause ist es, die das teuer macht – wie beim Schwarm-Fokus.
 *
 * Bühne, Uhr und Bestenliste kommen aus game-shell.js, die Bilder aus
 * strand-art.js; hier steht nur die Regel.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "twins") return;

  const host = document.querySelector("#dg-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  const strand = window.LernappStrandArt;
  if (!host || !shellApi || !strand) return;

  const kids = () => window.LernappKids || null;

  // ---------------------------------------------------------------------------
  // Regeln
  // ---------------------------------------------------------------------------
  const ROUND_MS = 45000;
  // Wie viele Bilder je Karte: drei am Anfang, alle zwei Treffer eines mehr,
  // höchstens sechs.
  const BILDER_MIN = 3;
  const BILDER_MAX = 6;
  const TREFFER_JE_STUFE = 2;
  // Ein Treffer geht schnell weiter, ein Fehltipp hält länger an.
  const PAUSE_RICHTIG = 260;
  const PAUSE_FALSCH = 750;
  // Wie viele, sagt das Wagen-Set: fünf im ersten, neun im zweiten (kids.js).
  const RUNS_FOR_DONE = window.LernappKids?.wagonRounds?.() || 5;
  const TOP_COUNT = 5;

  const HELP = [
    "Doppelt gleich. Du siehst zwei runde Karten mit Bildern.",
    "Ein Bild ist auf beiden Karten. Finde es und tippe es an – auf welcher Karte, ist egal.",
    "Dann kommen sofort die nächsten zwei Karten.",
    "Je mehr du findest, desto mehr Bilder liegen auf den Karten.",
    "Du hast fünfundvierzig Sekunden. Tippe auf Starten, wenn du bereit bist.",
  ].join(" ");

  // ---------------------------------------------------------------------------
  // Bestenliste – lokal und in der Cloud
  // ---------------------------------------------------------------------------
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.doppelt", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  // Karten würfeln
  // ---------------------------------------------------------------------------
  const ALLE = strand.TREASURES.map((item) => item.id);

  function bilderFuer(treffer) {
    return Math.min(BILDER_MAX, BILDER_MIN + Math.floor(treffer / TREFFER_JE_STUFE));
  }

  function mischen(liste) {
    const kopie = [...liste];
    for (let i = kopie.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
    }
    return kopie;
  }

  // Zwei Karten mit je n Bildern, genau eines gemeinsam. Die Dobble-Mathematik
  // braucht es dafür nicht: ein gemeinsames ziehen, den Rest aus zwei
  // getrennten Haufen füllen, beide Karten mischen.
  function paarFuer(n) {
    const [gemeinsam, ...rest] = mischen(ALLE);
    const a = mischen([gemeinsam, ...rest.slice(0, n - 1)]);
    const b = mischen([gemeinsam, ...rest.slice(n - 1, 2 * n - 2)]);
    return { a, b, gemeinsam };
  }

  // Wo die Bilder auf der Karte liegen: im Kreis um die Mitte, jedes ein
  // bisschen verschoben, gedreht und in eigener Grösse. Als Anteile der
  // Kartenbreite, damit die Karte so gross sein darf, wie die Bühne hergibt.
  //
  // Zwei Grenzen, beide vom Prüfskript nachgerechnet: Abstand von der Mitte
  // plus halbe Bildgrösse bleibt unter der halben Karte, damit kein Bild über
  // den runden Rand ragt – und die Tippflächen zweier Nachbarn berühren sich
  // nie, damit ein Tipp immer genau ein Bild trifft. Deshalb werden die Bilder
  // mit jedem weiteren kleiner, und der Ring, auf dem sie liegen, weiter.
  function plaetzeFuer(n) {
    const radius = n <= 3 ? 0.27 : n <= 4 ? 0.3 : n <= 5 ? 0.32 : 0.34;
    const groesse = n <= 3 ? 0.27 : n <= 4 ? 0.25 : n <= 5 ? 0.22 : 0.2;
    const versatz = Math.random() * Math.PI * 2;
    return Array.from({ length: n }, (_, i) => {
      const winkel = versatz + (i * Math.PI * 2) / n;
      const r = radius + (Math.random() - 0.5) * 0.04;
      return {
        x: 0.5 + Math.cos(winkel) * r,
        y: 0.5 + Math.sin(winkel) * r,
        drehung: Math.round((Math.random() - 0.5) * 80),
        groesse: groesse * (0.85 + Math.random() * 0.25),
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  const state = { phase: "intro", gemeinsam: null, treffer: 0, daneben: 0, locked: false };
  let shell = null;
  let karten = null;
  let stepTimer = null;

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function karte(ids, seite) {
    const node = shell.el("div", `dg-karte is-${seite}`);
    node.setAttribute("role", "group");
    node.setAttribute("aria-label", `${seite === "a" ? "Linke" : "Rechte"} Karte mit ${ids.length} Bildern`);
    const plaetze = plaetzeFuer(ids.length);
    ids.forEach((id, i) => {
      const platz = plaetze[i];
      const knopf = shell.el("button", "dg-bild");
      knopf.type = "button";
      knopf.dataset.id = id;
      knopf.setAttribute("aria-label", strand.BY_ID[id]?.name || id);
      knopf.style.setProperty("--dg-x", platz.x.toFixed(3));
      knopf.style.setProperty("--dg-y", platz.y.toFixed(3));
      knopf.style.setProperty("--dg-drehung", `${platz.drehung}deg`);
      knopf.style.setProperty("--dg-groesse", platz.groesse.toFixed(3));
      knopf.append(strand.treasureSvg(id));
      knopf.addEventListener("click", () => tipp(id, knopf));
      node.append(knopf);
    });
    return node;
  }

  function legeKarten() {
    const n = bilderFuer(state.treffer);
    const paar = paarFuer(n);
    state.gemeinsam = paar.gemeinsam;
    state.locked = false;
    karten.innerHTML = "";
    karten.append(karte(paar.a, "a"), karte(paar.b, "b"));
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function showIntro() {
    clearStep();
    shell.stopClock();
    shell.closeOverlay();
    shell.setPhase("intro");
    Object.assign(state, { phase: "intro", gemeinsam: null, treffer: 0, daneben: 0, locked: true });
    shell.setCount(0);

    shell.clear();
    shell.play.append(shell.el("p", "cm-prompt", "Welches Bild ist auf beiden Karten?"));
    // Ein Beispiel liegt schon da – was zu tun ist, sieht man daran schneller
    // als an jedem Satz.
    karten = shell.el("div", "dg-karten");
    shell.play.append(karten);
    legeKarten();
    state.locked = true;

    const start = shell.el("button", "cm-start", "Starten");
    start.type = "button";
    start.addEventListener("click", beginRound);
    shell.play.append(start);
  }

  function beginRound() {
    clearStep();
    state.phase = "play";
    state.treffer = 0;
    state.daneben = 0;
    shell.setPhase("play");
    shell.setCount(0);

    shell.clear();
    shell.play.append(shell.el("p", "cm-prompt", "Welches Bild ist auf beiden Karten?"));
    karten = shell.el("div", "dg-karten");
    shell.play.append(karten);
    legeKarten();
    shell.startClock(ROUND_MS, finish);
  }

  function tipp(id, knopf) {
    if (state.phase !== "play" || state.locked) return;
    state.locked = true;
    const richtig = id === state.gemeinsam;
    if (richtig) {
      state.treffer += 1;
      shell.setCount(state.treffer);
      kids()?.playJingle?.("correct");
      kids()?.vibrate?.(16);
      // Beide Zwillinge leuchten auf, dann kommen die nächsten Karten.
      karten.querySelectorAll(`[data-id="${id}"]`).forEach((zwilling) => zwilling.classList.add("is-richtig"));
    } else {
      state.daneben += 1;
      kids()?.playJingle?.("retry");
      knopf.classList.add("is-daneben");
    }
    stepTimer = window.setTimeout(() => {
      stepTimer = null;
      if (state.phase !== "play") return;
      if (richtig) legeKarten();
      else { knopf.classList.remove("is-daneben"); state.locked = false; }
    }, richtig ? PAUSE_RICHTIG : PAUSE_FALSCH);
  }

  function runsText(runs) {
    const left = RUNS_FOR_DONE - runs;
    if (left <= 0) return "Dieses Spiel ist geschafft – der Wagen ist gebaut.";
    return left === 1
      ? "Noch eine Runde bis zum fertigen Wagen."
      : `Noch ${left} Runden bis zum fertigen Wagen.`;
  }

  function resultSpeech(punkte, runs) {
    const paare = punkte === 1 ? "ein Paar" : `${punkte} Paare`;
    const daneben = state.daneben === 0
      ? "Kein einziger Tipp daneben."
      : state.daneben === 1 ? "Ein Tipp war daneben." : `${state.daneben} Tipps waren daneben.`;
    return `Du hast ${paare} gefunden. ${daneben} ${runsText(runs)}`;
  }

  function finish() {
    clearStep();
    state.phase = "over";
    state.locked = true;
    const punkte = state.treffer;
    const next = recordRun(punkte);
    kids()?.playJingle?.("win");
    shell.showResult({
      label: "Gefundene Paare",
      points: punkte,
      detail: `${state.treffer} gefunden · ${state.daneben} daneben`,
      scores: next.scores,
      top: TOP_COUNT,
      note: { text: runsText(next.runs), done: next.runs >= RUNS_FOR_DONE },
      speech: resultSpeech(punkte, next.runs),
    });
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Doppelt gleich",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    help: HELP,
    onRestart: showIntro,
  });

  showIntro();

  document.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    if (document.activeElement?.tagName === "BUTTON") return;
    if (state.phase !== "intro") return;
    event.preventDefault();
    beginRound();
  });

  window.addEventListener("pagehide", clearStep);

  window.LernappDoppelt = { ROUND_MS, BILDER_MIN, BILDER_MAX, TREFFER_JE_STUFE, RUNS_FOR_DONE, bilderFuer, paarFuer, plaetzeFuer, state };
})();
