/*
 * bremsweg.js – Bremsweg: acht Mal punktgenau anhalten.
 *
 * Die Lok kommt mit offenem Regler ins Bild und fährt auf eine Haltetafel zu.
 * Wer den Finger aufs Bild legt, bremst; wer ihn hebt, fährt wieder an. Steht
 * die Lok, wird gemessen: Wie weit ist ihre Pufferbohle von der Tafel weg?
 * Daraus kommen null bis HOECHST Punkte, und acht Anläufe später steht die
 * Summe.
 *
 * Das ist Turmbaus Frage auf einer anderen Achse. Dort geht es um den
 * Augenblick, hier um die Strecke: Aus dem Tempo und der Bremskraft ergibt
 * sich ein Bremsweg, und den muss man vor dem Bremsen im Kopf haben. Deshalb
 * steht vor jedem Anlauf, womit man es zu tun hat – schwere Last und nasses
 * Gleis bremsen länger. Nichts davon ist versteckt: Ein Spiel, das Wissen
 * vorenthält, misst Glück.
 *
 * Zwei Regeln halten es ehrlich:
 *
 *   Der Regler bleibt offen. Wer die Bremse löst, wird wieder schneller –
 *   sonst könnte man früh bis fast zum Stillstand bremsen und den Rest
 *   heranrollen.
 *
 *   Unter SCHRITT gilt die Lok als angehalten, und zwar dort, wo sie gerade
 *   ist. Sonst wäre dasselbe Schleichen nur langsamer möglich.
 *
 * Die Punkte sind fein: Zwei gute Läufe unterscheiden sich fast immer, auch
 * wenn beide achtmal ordentlich standen. Das ist der Grund, warum dieses
 * Spiel in ein Turnier gehört – eine Rangliste, in der oben fünf Leute
 * dieselbe Zahl haben, ist keine.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "brake") return;

  const host = document.querySelector("#bw-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  const art = window.LernappTrainArt;
  if (!host || !shellApi || !art) return;

  const kids = () => window.LernappKids || null;

  const zufall = window.LernappZufall?.fuer?.("brakePoint") || {
    fest: false, neu() {}, zahl: Math.random,
    von: (a, b) => a + Math.random() * (b - a),
  };

  // ---------------------------------------------------------------------------
  // Die Strecke
  // ---------------------------------------------------------------------------
  // Gerechnet wird in Metern, gezeichnet in Anteilen der Fläche: STRECKE Meter
  // stehen immer im Bild, egal wie breit es ist. Damit ist ein Meter auf dem
  // Handy kürzer als am Bildschirm – aber er ist überall derselbe Anteil der
  // Strecke, und das Spiel ist auf beiden dasselbe.
  const STRECKE = 60;
  const LOK_M = 12;                // so lang ist die Lok, von Puffer bis Ende
  const SCHRITT = 1.4;             // langsamer heisst: sie steht
  const ANLAEUFE_ZAHL = 8;
  const HOECHST = 125;             // Punkte für einen genauen Halt
  // Ab diesem Abstand gibt es nichts mehr. Vier Meter sind ein Drittel einer
  // Lok – nah genug, dass "fast" noch zählt, weit genug, dass Zufall nicht
  // reicht.
  const TOLERANZ = 4;

  // Acht Anläufe, feste Leiter, für alle dieselbe. Es geht hoch, aber nicht
  // durch mehr Tempo allein: Mit dem Tempo wächst auch, was ein Zehntel zu
  // spät kostet – bei 19 m/s sind es fast zwei Meter.
  //
  //   v      Marschgeschwindigkeit in m/s
  //   a      Bremsverzögerung in m/s²
  //   tafel  wo die Haltetafel steht, in Metern
  const ANLAEUFE = [
    { v: 12, a: 6.0, tafel: 42, last: "leer", gleis: "trocken" },
    { v: 13, a: 5.6, tafel: 44, last: "leicht", gleis: "trocken" },
    { v: 14, a: 5.4, tafel: 45, last: "leicht", gleis: "feucht" },
    { v: 15, a: 5.0, tafel: 46, last: "beladen", gleis: "feucht" },
    { v: 16, a: 4.8, tafel: 48, last: "beladen", gleis: "feucht" },
    { v: 17, a: 4.6, tafel: 49, last: "schwer", gleis: "nass" },
    { v: 18, a: 4.4, tafel: 50, last: "schwer", gleis: "nass" },
    { v: 19, a: 4.2, tafel: 51, last: "voll", gleis: "nass" },
  ];
  // Die Tafel steht nicht auf den Zentimeter da, wo sie beim letzten Mal
  // stand. Ohne das liesse sich der Bremspunkt nach zwei Runden auswendig
  // lernen. Im Turnier ist die Abweichung für alle dieselbe (zufall.js).
  const TAFEL_STREUUNG = 1.5;

  // Wie schnell sie wieder anzieht, wenn die Bremse los ist.
  const ANZUG = 0.55;

  const HELP = [
    "Bremsweg. Die Lok fährt los und du musst sie an der Haltetafel anhalten.",
    "Halte den Finger aufs Bild, dann bremst sie. Nimm ihn weg, fährt sie wieder an.",
    "Vor jedem Anlauf steht, wie schwer sie beladen ist und wie das Gleis ist – beides macht den Bremsweg länger.",
    "Je näher die Lok an der Tafel steht, desto mehr Punkte gibt es.",
    "Acht Anläufe hast du. Am Schluss zählen alle zusammen.",
  ].join(" ");

  // ---------------------------------------------------------------------------
  // Bestenliste
  // ---------------------------------------------------------------------------
  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.bremsweg", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  // Punkte
  // ---------------------------------------------------------------------------
  // Eine Kurve, keine Stufen: Ein halber Meter daneben ist deutlich besser als
  // ein ganzer, und ein ganzer deutlich besser als zwei. Stufen ("gut, mittel,
  // schlecht") gäben am Ende zu vielen dieselbe Zahl.
  function punkteFuer(fehler) {
    if (!(fehler < TOLERANZ)) return 0;
    return Math.max(0, Math.round(HOECHST * ((1 - fehler / TOLERANZ) ** 1.6)));
  }

  const meter = (m) => m.toFixed(1).replace(".", ",");

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  const state = {
    phase: "intro",
    anlauf: 0,
    punkte: 0,
    halte: [],        // je Anlauf der Fehler in Metern
    vorne: 0,         // wo die Pufferbohle steht, in Metern
    tempo: 0,
    bremst: false,
    rollt: false,
    plan: null,
  };

  let shell = null;
  let strecke = null;
  let lok = null;
  let tafel = null;
  let marke = null;
  let tafelText = null;
  let anlaufText = null;
  let frame = null;
  let letzteZeit = 0;
  let stepTimer = null;

  const clearStep = () => { if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; } };
  const stopLoop = () => { if (frame) { window.cancelAnimationFrame(frame); frame = null; } };

  // ---------------------------------------------------------------------------
  // Die Anlage
  // ---------------------------------------------------------------------------
  function baueStrecke() {
    const wrap = shell.el("div", "bw-strecke");

    // Das Gleis mit den Kilometersteinen: alle zehn Meter ein Strich. Sie sind
    // die einzige Hilfe beim Schätzen – ohne sie wäre der Bremsweg geraten.
    const skala = shell.el("div", "bw-skala");
    skala.setAttribute("aria-hidden", "true");
    for (let m = 10; m < STRECKE; m += 10) {
      const strich = shell.el("span", "bw-strich");
      strich.style.left = `${(m / STRECKE) * 100}%`;
      strich.append(shell.el("span", "bw-strich-wort", `${m}`));
      skala.append(strich);
    }
    wrap.append(skala);

    wrap.append(shell.el("div", "bw-gleis"));

    tafel = shell.el("div", "bw-tafel");
    tafel.setAttribute("aria-hidden", "true");
    tafel.append(art.el("svg", { viewBox: "0 0 28 60", class: "bw-tafel-art" }, [
      art.el("rect", { x: 12, y: 16, width: 4, height: 44, fill: "#6b7280" }),
      art.el("rect", { x: 2, y: 0, width: 24, height: 20, rx: 3, fill: "#fdf3e3", stroke: "#d0392b", "stroke-width": 3 }),
      art.el("rect", { x: 7, y: 7, width: 14, height: 6, rx: 1.5, fill: "#d0392b" }),
    ]));
    wrap.append(tafel);

    // Wo die Lok stehen geblieben ist – wird erst nach dem Halt sichtbar.
    marke = shell.el("div", "bw-marke");
    marke.setAttribute("aria-hidden", "true");
    wrap.append(marke);

    lok = shell.el("div", "bw-lok");
    lok.append(art.el("svg", {
      viewBox: `0 20 ${art.LOCO_W} ${art.GROUND - 20}`, class: "bw-lok-art", "aria-hidden": "true",
    }, [art.buildLoco(art.locoConfig({}))]));
    // Die Funken beim Bremsen: nur ein Zeichen, dass die Bremse greift.
    const funken = shell.el("span", "bw-funken");
    funken.setAttribute("aria-hidden", "true");
    lok.append(funken);
    wrap.append(lok);

    return wrap;
  }

  function stelle() {
    if (!strecke || !lok) return;
    const box = strecke.getBoundingClientRect();
    if (!box.width) return;
    const proM = box.width / STRECKE;
    // Die Lok ist LOK_M Meter lang – es sei denn, so lang passt sie nicht mehr
    // in die Höhe der Strecke. Auf einem sehr flachen, sehr breiten Fenster
    // ragte sie sonst oben heraus. Gemessen wird ohnehin ihre Pufferbohle, und
    // die steht in beiden Fällen auf state.vorne.
    const lokB = Math.min(LOK_M * proM, Math.max(40, (box.height - 46) / 0.75));
    lok.style.width = `${lokB}px`;
    lok.style.transform = `translateX(${state.vorne * proM - lokB}px)`;
    if (state.plan) {
      tafel.style.left = `${state.plan.tafel * proM}px`;
    }
  }

  // ---------------------------------------------------------------------------
  // Ein Anlauf
  // ---------------------------------------------------------------------------
  function naechsterAnlauf() {
    clearStep();
    if (state.anlauf >= ANLAEUFE_ZAHL) { finish(); return; }

    const vorlage = ANLAEUFE[state.anlauf];
    state.plan = {
      ...vorlage,
      tafel: vorlage.tafel + zufall.von(-TAFEL_STREUUNG, TAFEL_STREUUNG),
    };
    // Die Lok kommt von links ins Bild, damit sie beim Auftauchen schon rollt.
    state.vorne = -1;
    state.tempo = state.plan.v;
    state.bremst = false;
    state.rollt = true;
    host.classList.remove("ist-bremse");
    marke.classList.remove("ist-da");
    lok.classList.remove("ist-steht", "ist-weg");

    anlaufText.textContent = `Anlauf ${state.anlauf + 1} von ${ANLAEUFE_ZAHL}`;
    tafelText.textContent = `${state.plan.last} · ${state.plan.gleis}es Gleis`;
    tafelText.className = "bw-lage";
    stelle();
    letzteZeit = performance.now();
  }

  function step(now) {
    frame = window.requestAnimationFrame(step);
    if (state.phase !== "play") return;
    const dt = Math.min(0.05, Math.max(0, (now - letzteZeit) / 1000));
    letzteZeit = now;
    if (!state.rollt) return;

    if (state.bremst) state.tempo -= state.plan.a * dt;
    else state.tempo = Math.min(state.plan.v, state.tempo + state.plan.a * ANZUG * dt);

    state.vorne += state.tempo * dt;

    if (state.tempo < SCHRITT) { halt(); return; }
    if (state.vorne > STRECKE) { halt(true); return; }
    stelle();
  }

  function halt(durch = false) {
    state.rollt = false;
    state.bremst = false;
    host.classList.remove("ist-bremse");
    lok.classList.add("ist-steht");
    state.vorne = Math.min(state.vorne, STRECKE);
    stelle();

    const fehler = durch ? Infinity : Math.abs(state.vorne - state.plan.tafel);
    const punkte = durch ? 0 : punkteFuer(fehler);
    state.punkte += punkte;
    state.halte.push(fehler);
    state.anlauf += 1;
    shell.setCount(state.punkte);

    // Wo sie steht, und wie weit das daneben ist.
    const box = strecke.getBoundingClientRect();
    if (box.width) {
      marke.style.left = `${(state.vorne / STRECKE) * box.width}px`;
      marke.classList.add("ist-da");
    }

    let wort;
    if (durch) wort = "Durchgerauscht.";
    else if (fehler < 0.35) wort = "Genau getroffen!";
    else wort = `${meter(fehler)} m ${state.vorne < state.plan.tafel ? "zu früh" : "zu weit"}`;
    tafelText.textContent = punkte > 0 ? `${wort}  +${punkte}` : wort;
    tafelText.className = `bw-lage ${punkte >= 90 ? "ist-gut" : punkte > 0 ? "ist-so-lala" : "ist-daneben"}`;

    if (punkte >= 90) { kids()?.playJingle?.("correct"); kids()?.vibrate?.(14); }
    else if (punkte > 0) kids()?.vibrate?.(10);
    else { kids()?.playJingle?.("retry"); kids()?.vibrate?.([18, 40, 18]); }

    // Erst das Ergebnis stehen lassen, dann die Lok ausblenden – sonst
    // spränge sie sichtbar vom Halteplatz zurück an den Anfang.
    stepTimer = window.setTimeout(() => {
      lok.classList.add("ist-weg");
      stepTimer = window.setTimeout(naechsterAnlauf, 280);
    }, 1150);
  }

  // ---------------------------------------------------------------------------
  // Die Bremse
  // ---------------------------------------------------------------------------
  function bremseAn(event) {
    if (state.phase !== "play" || !state.rollt) return;
    if (event?.target?.closest?.("button")) return;
    state.bremst = true;
    host.classList.add("ist-bremse");
  }

  function bremseAus() {
    if (state.phase !== "play") return;
    state.bremst = false;
    host.classList.remove("ist-bremse");
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function showIntro() {
    clearStep();
    stopLoop();
    shell.closeOverlay();
    shell.setPhase("intro");
    state.phase = "intro";
    state.anlauf = 0;
    state.punkte = 0;
    state.halte = [];
    state.rollt = false;
    state.plan = null;
    shell.setCount(0);
    strecke = null;
    host.classList.remove("ist-bremse");

    shell.clear();
    shell.play.append(shell.el("p", "cm-prompt", "Halte die Lok an der Tafel an."));
    shell.play.append(shell.el("p", "bw-regel", "Finger aufs Bild bremst. Finger weg, und sie zieht wieder an."));

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
    state.anlauf = 0;
    state.punkte = 0;
    state.halte = [];
    shell.setPhase("play");
    shell.setCount(0);

    shell.clear();
    anlaufText = shell.el("p", "cm-prompt bw-anlauf", "");
    tafelText = shell.el("p", "bw-lage", "");
    tafelText.setAttribute("role", "status");
    strecke = baueStrecke();
    shell.play.append(anlaufText, strecke, tafelText);

    naechsterAnlauf();
    frame = window.requestAnimationFrame(step);
  }

  function resultSpeech(punkte) {
    const genau = state.halte.filter((f) => f < 0.35).length;
    const lob = genau === 0 ? "" : genau === 1 ? "Einmal hast du genau getroffen." : `${genau} Mal hast du genau getroffen.`;
    return `${punkte} Punkte aus acht Anläufen. ${lob}`.trim();
  }

  function finish() {
    stopLoop();
    clearStep();
    state.phase = "over";
    const punkte = state.punkte;
    recordRun(punkte);
    kids()?.playJingle?.("win");
    const gut = state.halte.filter((f) => f < 1).length;
    shell.showResult({
      label: "Punkte",
      points: punkte,
      detail: `${gut} von ${ANLAEUFE_ZAHL} auf den Meter genau`,
      speech: resultSpeech(punkte),
    });
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Bremsweg",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    help: HELP,
    onRestart: showIntro,
    // Keine Uhr: Eine Runde sind acht Anläufe, und jeder endet von selbst.
    // Ein Balken, der nie kleiner wird, verspräche einen Zeitdruck, den es
    // hier nicht gibt.
    clock: false,
  });

  showIntro();

  host.addEventListener("pointerdown", bremseAn);
  host.addEventListener("pointerup", bremseAus);
  host.addEventListener("pointercancel", bremseAus);
  host.addEventListener("pointerleave", bremseAus);

  document.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (state.phase === "intro") { beginRound(); return; }
    if (state.phase === "play" && !event.repeat) bremseAn();
  });
  document.addEventListener("keyup", (event) => {
    if (event.key === " " || event.key === "Enter") bremseAus();
  });

  window.addEventListener("resize", stelle);
  window.addEventListener("orientationchange", stelle);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });
})();
