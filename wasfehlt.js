/*
 * wasfehlt.js – Was fehlt? Fracht kontrollieren, ohne Uhr.
 *
 * Ein offener Güterwagen fährt vor, darauf ein paar Stücke Fracht. Kurz
 * hinschauen, dann geht die Plane drüber. Wenn sie hochgeht, ist ein Stück
 * weg – welches? Unten liegen drei oder vier zur Wahl, darunter das fehlende.
 * Stimmt der Tipp, kommt der nächste Wagen mit einem Stück mehr. Ein
 * Fehlgriff beendet die Runde. Was zählt, ist, wie viele Wagen bis dahin
 * richtig kontrolliert wurden.
 *
 * Anders als Rucksack, Memory, Strand-Schätze und Kacheln fragt dieses Spiel
 * nicht nach einem Platz oder einer Reihenfolge, sondern nach dem Ding
 * selbst: welche Sachen lagen da? Die Lücke bleibt sichtbar – wo etwas
 * gefehlt hat, sieht man; was, muss man wissen. Und die Auswahl unten zeigt
 * nie etwas, das noch auf dem Wagen liegt: sonst liesse sich die Antwort
 * durch Vergleichen finden statt durch Erinnern.
 *
 * Kein Zeitdruck beim Antworten, wie bei den Strand-Schätzen: die Aufgabe ist
 * das Merken. Länger hinschauen darf man bei mehr Fracht – je Stück ein
 * bisschen mehr Zeit, sonst wäre der zehnte Wagen ein Tempospiel.
 *
 * Bühne, Knöpfe und Bestenliste kommen aus game-shell.js, die Gegenstände aus
 * strand-art.js; hier steht nur die Regel.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "missing") return;

  const host = document.querySelector("#wf-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  const strand = window.LernappStrandArt;
  if (!host || !shellApi || !strand) return;

  const kids = () => window.LernappKids || null;

  // ---------------------------------------------------------------------------
  // Regeln
  // ---------------------------------------------------------------------------
  // Je Wagen ein Stück mehr, bis zehn; ab dem vierten Wagen liegen vier statt
  // drei zur Wahl. Als Tabelle, damit sich die Kurve von Hand nachziehen
  // lässt, ohne die Spiellogik anzufassen.
  const STUFEN = [
    { stuecke: 3, auswahl: 3 },
    { stuecke: 4, auswahl: 3 },
    { stuecke: 5, auswahl: 3 },
    { stuecke: 6, auswahl: 4 },
    { stuecke: 7, auswahl: 4 },
    { stuecke: 8, auswahl: 4 },
    { stuecke: 9, auswahl: 4 },
    { stuecke: 10, auswahl: 4 },
  ];
  // So lange ist die Fracht zu sehen: mindestens zweieinhalb Sekunden, und je
  // Stück siebenhundert Millisekunden – zehn Stücke sind sieben Sekunden.
  const ZEIGEN_MIN_MS = 2500;
  const ZEIGEN_JE_STUECK_MS = 700;
  // So lange liegt die Plane drüber, bevor sie hochgeht.
  const PLANE_MS = 900;
  // Wie viele, sagt das Wagen-Set: fünf im ersten, neun im zweiten (kids.js).
  const RUNS_FOR_DONE = window.LernappKids?.wagonRounds?.() || 5;
  const TOP_COUNT = 5;

  const HELP = [
    "Was fehlt? Auf dem Wagen liegt Fracht. Schau sie dir gut an.",
    "Dann kommt die Plane drüber. Wenn sie wieder hochgeht, fehlt ein Stück.",
    "Unten siehst du ein paar Sachen. Tippe die an, die auf dem Wagen gefehlt hat.",
    "Stimmt es, kommt der nächste Wagen mit einem Stück mehr.",
    "Tippst du daneben, ist die Runde vorbei.",
    "Beim Antworten hast du so viel Zeit, wie du willst.",
    "Tippe auf Starten, wenn du bereit bist.",
  ].join(" ");

  // ---------------------------------------------------------------------------
  // Bestenliste – lokal und in der Cloud
  // ---------------------------------------------------------------------------
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.wasfehlt", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  // Fracht würfeln
  // ---------------------------------------------------------------------------
  const ALLE = strand.TREASURES.map((item) => item.id);

  function stufeFuer(wagen) {
    return STUFEN[Math.min(wagen, STUFEN.length - 1)];
  }

  function zeigenMs(stuecke) {
    return Math.max(ZEIGEN_MIN_MS, ZEIGEN_JE_STUECK_MS * stuecke);
  }

  function mischen(liste) {
    const kopie = [...liste];
    for (let i = kopie.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
    }
    return kopie;
  }

  // Die Ladung eines Wagens: lauter verschiedene Stücke.
  function ladungFuer(stufe) {
    return mischen(ALLE).slice(0, stufe.stuecke);
  }

  // Die Auswahl unten: das fehlende Stück und Stücke, die nicht auf dem Wagen
  // lagen – gemischt, damit die Antwort nie an derselben Stelle steht.
  function auswahlFuer(ladung, fehlt, anzahl) {
    const fremd = mischen(ALLE.filter((id) => !ladung.includes(id))).slice(0, anzahl - 1);
    return mischen([fehlt, ...fremd]);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  const state = { phase: "merken", wagen: 0, punkte: 0, ladung: [], fehlt: null, auswahl: [] };
  let shell = null;
  let prompt = null;
  let wagen = null;
  let ladeflaeche = null;
  let plane = null;
  let wahl = null;
  let stepTimer = null;

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function later(ms, fn) {
    clearStep();
    stepTimer = window.setTimeout(() => { stepTimer = null; fn(); }, ms);
  }

  function stueck(id, className = "wf-stueck") {
    const item = strand.BY_ID[id];
    const node = shell.el("span", className);
    node.dataset.id = id;
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", item?.name || id);
    node.append(strand.treasureSvg(id));
    return node;
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  // Der Wagen mit seiner Plane – dieselbe Bühne im Intro wie im Spiel, damit
  // beim Start nichts springt.
  function bauBuehne() {
    shell.clear();
    prompt = shell.el("p", "cm-prompt wf-prompt", "Merk dir die Fracht.");
    wagen = shell.el("div", "wf-wagen");
    ladeflaeche = shell.el("div", "wf-ladung");
    plane = shell.el("div", "wf-plane");
    plane.setAttribute("aria-hidden", "true");
    wagen.append(ladeflaeche, plane);
    wahl = shell.el("div", "wf-wahl");
    shell.play.append(prompt, wagen);
  }

  // Erst der Knopf, dann der erste Wagen. Wer das Spiel öffnet, hat noch die
  // Spielauswahl im Kopf und schaut nicht auf die Fracht – ohne Knopf wäre der
  // erste Wagen halb vorbei, bevor das Kind hinsieht. Ein Beispielwagen steht
  // schon da: was zu tun ist, sieht man daran schneller als an jedem Satz.
  function showIntro() {
    clearStep();
    shell.closeOverlay();
    shell.setPhase("intro");
    Object.assign(state, { phase: "intro", wagen: 0, punkte: 0, ladung: [], fehlt: null, auswahl: [] });
    shell.setCount(0);

    bauBuehne();
    const stufe = stufeFuer(0);
    ladeflaeche.style.setProperty("--wf-stuecke", String(stufe.stuecke));
    ladeflaeche.setAttribute("aria-label", `Wagen mit ${stufe.stuecke} Stücken Fracht`);
    ladungFuer(stufe).forEach((id) => ladeflaeche.append(stueck(id)));

    const start = shell.el("button", "cm-start", "Starten");
    start.type = "button";
    start.addEventListener("click", startRun);
    shell.play.append(start);
  }

  function startRun() {
    clearStep();
    shell.closeOverlay();
    shell.setPhase("play");
    state.wagen = 0;
    state.punkte = 0;
    shell.setCount(0);

    bauBuehne();
    shell.play.append(wahl);

    naechsterWagen();
  }

  function naechsterWagen() {
    clearStep();
    const stufe = stufeFuer(state.wagen);
    state.phase = "merken";
    state.ladung = ladungFuer(stufe);
    state.fehlt = state.ladung[Math.floor(Math.random() * state.ladung.length)];
    state.auswahl = auswahlFuer(state.ladung, state.fehlt, stufe.auswahl);

    prompt.textContent = "Merk dir die Fracht.";
    wagen.classList.remove("is-zu");
    wahl.innerHTML = "";
    ladeflaeche.innerHTML = "";
    ladeflaeche.style.setProperty("--wf-stuecke", String(stufe.stuecke));
    ladeflaeche.setAttribute("aria-label", `Wagen mit ${stufe.stuecke} Stücken Fracht`);
    state.ladung.forEach((id) => ladeflaeche.append(stueck(id)));

    // Erst hinschauen, dann die Plane drüber, dann die Lücke.
    later(zeigenMs(stufe.stuecke), () => {
      wagen.classList.add("is-zu");
      prompt.textContent = "Die Plane geht drüber …";
      later(PLANE_MS, luecke);
    });
  }

  function luecke() {
    const stufe = stufeFuer(state.wagen);
    const weg = ladeflaeche.querySelector(`[data-id="${state.fehlt}"]`);
    if (weg) {
      weg.classList.add("is-weg");
      weg.setAttribute("aria-label", "Hier fehlt etwas");
    }
    wagen.classList.remove("is-zu");
    state.phase = "waehlen";
    prompt.textContent = "Was fehlt?";

    state.auswahl.forEach((id) => {
      const knopf = shell.el("button", "wf-knopf");
      knopf.type = "button";
      knopf.dataset.id = id;
      knopf.setAttribute("aria-label", strand.BY_ID[id]?.name || id);
      knopf.append(strand.treasureSvg(id));
      knopf.addEventListener("click", () => tipp(id, knopf));
      wahl.append(knopf);
    });
    wahl.setAttribute("aria-label", `${stufe.auswahl} Sachen zur Wahl`);
  }

  function tipp(id, knopf) {
    if (state.phase !== "waehlen") return;
    const richtig = id === state.fehlt;
    wahl.querySelectorAll(".wf-knopf").forEach((other) => { other.disabled = true; });

    if (!richtig) {
      state.phase = "over";
      knopf.classList.add("is-daneben");
      kids()?.playJingle?.("retry");
      // Kurz zeigen, welches es gewesen wäre: es kehrt auf den Wagen zurück.
      wahl.querySelector(`[data-id="${state.fehlt}"]`)?.classList.add("is-richtig");
      const weg = ladeflaeche.querySelector(".is-weg");
      if (weg) weg.classList.remove("is-weg");
      later(1400, finish);
      return;
    }

    state.phase = "zurueck";
    state.punkte += 1;
    shell.setCount(state.punkte);
    knopf.classList.add("is-richtig");
    kids()?.playJingle?.("correct");
    kids()?.vibrate?.(16);
    // Das Stück kehrt auf den Wagen zurück, dann kommt der nächste.
    const weg = ladeflaeche.querySelector(".is-weg");
    if (weg) { weg.classList.remove("is-weg"); weg.classList.add("is-zurueck"); }
    prompt.textContent = "Richtig!";
    state.wagen += 1;
    later(900, naechsterWagen);
  }

  function runsText(runs) {
    const left = RUNS_FOR_DONE - runs;
    if (left <= 0) return "Dieses Spiel ist geschafft – der Wagen ist gebaut.";
    return left === 1
      ? "Noch eine Runde bis zum fertigen Wagen."
      : `Noch ${left} Runden bis zum fertigen Wagen.`;
  }

  function wagenText(punkte) {
    if (!punkte) return "Noch keinen Wagen richtig kontrolliert.";
    return punkte === 1 ? "Einen Wagen richtig kontrolliert." : `${punkte} Wagen richtig kontrolliert.`;
  }

  function resultSpeech(punkte, runs) {
    const fehlte = strand.BY_ID[state.fehlt]?.name;
    const zuletzt = state.phase === "over" && fehlte ? ` Zuletzt hat ${fehlte} gefehlt.` : "";
    return `${wagenText(punkte)}${zuletzt} ${runsText(runs)}`;
  }

  function finish() {
    clearStep();
    const punkte = state.punkte;
    const next = recordRun(punkte);
    kids()?.playJingle?.("win");
    const speech = resultSpeech(punkte, next.runs);
    state.phase = "over";
    shell.showResult({
      label: "Kontrollierte Wagen",
      points: punkte,
      detail: wagenText(punkte),
      scores: next.scores,
      top: TOP_COUNT,
      note: { text: runsText(next.runs), done: next.runs >= RUNS_FOR_DONE },
      speech,
    });
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  // Ein Beispielwagen und ein Startknopf, wie beim Karten-Merker: der erste
  // Wagen fährt erst vor, wenn das Kind bereit ist. Was zu tun ist, sagt
  // ausserdem der Lautsprecher.
  shell = shellApi.mount({
    host,
    title: "Was fehlt?",
    area: "gedaechtnis",
    accent: "#7C5CE6",
    accentDark: "#5a41b8",
    help: HELP,
    clock: false,
    onRestart: showIntro,
  });

  showIntro();

  document.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    if (document.activeElement?.tagName === "BUTTON") return;
    if (state.phase !== "intro") return;
    event.preventDefault();
    startRun();
  });

  window.addEventListener("pagehide", clearStep);

  window.LernappWasFehlt = { STUFEN, ZEIGEN_MIN_MS, ZEIGEN_JE_STUECK_MS, PLANE_MS, RUNS_FOR_DONE, stufeFuer, zeigenMs, ladungFuer, auswahlFuer, state };
})();
