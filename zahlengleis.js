/*
 * zahlengleis.js – Wo hält der Zug? Der Zahlenstrahl als Gleis.
 *
 * Ein Gleis quer über das Bild, links der Bahnhof 0, rechts der letzte
 * Bahnhof. Oben steht eine Zahl. Das Kind schiebt seine Lok dorthin, wo diese
 * Zahl auf dem Gleis liegt, und lässt los – oder tippt die Stelle einfach an.
 * Danach fährt ein Schild an die richtige Stelle und zeigt, wie nah es war.
 * Zehn Zahlen je Runde, bis zu fünf Punkte je Zahl: fünf für die Mitte der
 * Lok genau auf der Zahl, und je weiter daneben, desto weniger. Wo die Mitte
 * ist, zeigt ein roter Strich unter der Lok – ohne ihn müsste ein Kind raten,
 * ob der Kamin zählt oder das Führerhaus.
 *
 * Die Marken des Gleises hängen unter der Schiene, nicht darüber. Über ihr
 * verdeckte die Lok genau die Marke, auf die gezielt wurde; unten stehen
 * Marke und Lok-Strich nebeneinander, und das Kind sieht beim Schieben, wie
 * nah es ist.
 *
 * Kein Zeitdruck und kein Ende nach einem Fehler: die Aufgabe ist das
 * Schätzen, und jede Antwort zeigt die richtige Stelle – das ist der Moment,
 * in dem sich die Zahlenreihe im Kopf festsetzt. Wer daneben liegt, sieht
 * wohin, und bekommt die nächste Zahl.
 *
 * Vier Stufen, vor der Runde gewählt: bis 20, bis 50, bis 100, und bis 100
 * ohne Marken dazwischen. Innerhalb einer Stufe wird die Runde von selbst
 * schwerer – die ersten Zahlen liegen auf dem kürzesten Gleis der Stufe, die
 * letzten auf dem längsten. Auf der ersten Stufe steht am Anfang an jeder
 * Zahl eine Marke, da wird gezählt; danach stehen Marken nur noch an runden
 * Zahlen, da wird geschätzt; auf der letzten Stufe nur noch an den beiden
 * Bahnhöfen. Wer daneben liegt, verliert nichts als Punkte.
 *
 * Bühne, Knöpfe und Bestenliste kommen aus game-shell.js; die Lok ist die des
 * Kindes, so wie sie auf dem Startbild steht.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "numberline") return;

  const host = document.querySelector("#zg-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  const art = window.LernappTrainArt;
  if (!host || !shellApi || !art) return;

  const kids = () => window.LernappKids || null;

  // ---------------------------------------------------------------------------
  // Regeln
  // ---------------------------------------------------------------------------
  // Vier Stufen mit je drei Gleisen. bis = wohin das Gleis geht, marken = alle
  // wie viele Zahlen eine Marke steht (die Enden tragen immer eine mit Zahl),
  // zahlen = ob auch an den Marken dazwischen die Zahl steht. Marken so weit
  // wie das Gleis heisst: nur die beiden Bahnhöfe.
  //
  // Schwerer wird es zweifach: die Zahlen werden grösser, und die Marken
  // dazwischen werden weniger – bis auf der vierten Stufe keine mehr steht.
  const STUFEN = [
    {
      nr: 1, bis: 20, name: "bis 20, mit einer Marke an jeder Zahl", striche: 5,
      gleise: [{ bis: 5, marken: 1, zahlen: true }, { bis: 10, marken: 5 }, { bis: 20, marken: 10 }],
    },
    {
      nr: 2, bis: 50, name: "bis 50, mit Marken an den runden Zahlen", striche: 3,
      gleise: [{ bis: 20, marken: 5 }, { bis: 30, marken: 10 }, { bis: 50, marken: 10 }],
    },
    {
      nr: 3, bis: 100, name: "bis 100, mit wenigen Marken", striche: 1,
      gleise: [{ bis: 50, marken: 10 }, { bis: 100, marken: 25 }, { bis: 100, marken: 50 }],
    },
    {
      nr: 4, bis: 100, name: "bis 100, ohne Marken dazwischen", striche: 0,
      gleise: [{ bis: 60, marken: 60 }, { bis: 80, marken: 80 }, { bis: 100, marken: 100 }],
    },
  ];

  // Welches Gleis der Stufe die zehn Zahlen einer Runde bekommen: drei auf
  // dem kurzen, vier auf dem mittleren, drei auf dem langen.
  const PLAN = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2];

  // Wie weit die Lok daneben stehen darf – in Zahlen, nicht in Bildpunkten,
  // und im Verhältnis zum Gleis: ein Finger überdeckt auf dem langen Gleis
  // mehr Zahlen als auf dem kurzen. Fünf Stufen, von innen nach aussen:
  // innerhalb von `genau` fünf Punkte, bis `fast` vier, bis `knapp` drei, bis
  // `nah` zwei, bis `weit` einen, sonst keinen. Auf den ganz kurzen Gleisen
  // gilt je Stufe eine Untergrenze, sonst müsste ein Kind auf dem Gleis bis
  // fünf genauer treffen als ein Finger breit ist.
  function toleranzFuer(bis) {
    return {
      genau: Math.max(0.15, bis * 0.02),
      fast: Math.max(0.35, bis * 0.045),
      knapp: Math.max(0.7, bis * 0.08),
      nah: Math.max(1.2, bis * 0.14),
      weit: Math.max(2, bis * 0.25),
    };
  }

  const ZAHLEN_JE_RUNDE = PLAN.length;
  const PUNKTE_JE_ZAHL = 5;
  // Wie eine Antwort heisst, je nach Punkten – für Farbe und Zählung.
  const WIE = ["daneben", "weit", "nah", "knapp", "fast", "genau"];
  // So lange steht das Schild an der richtigen Stelle, bevor die nächste Zahl
  // kommt: lang genug zum Hinschauen, kurz genug, dass keine Runde zäh wird.
  const ZEIGEN_MS = 1500;
  // Wie viele, sagt das Wagen-Set: fünf im ersten, neun im zweiten (kids.js).
  const RUNS_FOR_DONE = window.LernappKids?.wagonRounds?.() || 5;
  const TOP_COUNT = 5;

  const HELP = [
    "Wo hält der Zug? Zuerst wählst du, wie gross die Zahlen sind: bis zwanzig, bis fünfzig oder bis hundert.",
    "Dann siehst du unten ein Gleis. Links ist der Bahnhof Null, rechts der letzte Bahnhof.",
    "Oben steht eine Zahl. Schieb die Lok mit dem Finger dorthin, wo diese Zahl auf dem Gleis liegt, und lass los.",
    "Du kannst die Stelle auch einfach antippen.",
    "Der rote Strich unter der Lok zeigt ihre Mitte. Unter dem Gleis stehen kleine schwarze Striche – schieb den roten genau über den richtigen.",
    "Danach zeigt ein Schild, wo die Zahl wirklich liegt.",
    "Je näher du dran bist, desto mehr Punkte gibt es: fünf, wenn du genau triffst, und weniger, je weiter du daneben liegst.",
    "Zehn Zahlen, dann ist die Runde vorbei. Du hast so viel Zeit, wie du willst.",
  ].join(" ");

  // ---------------------------------------------------------------------------
  // Bestenliste – lokal und in der Cloud
  // ---------------------------------------------------------------------------
  // Eine Liste für alle Stufen: jede Runde hat zehn Zahlen und bis zu fünfzig
  // Punkte, und die Runden zählen für den Wagen gleich, egal auf welcher Stufe.
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.zahlengleis", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  // Zahlen und Punkte
  // ---------------------------------------------------------------------------
  function gleisFuer(stufe, index) {
    return stufe.gleise[PLAN[index]];
  }

  // Nie die Enden – die stehen angeschrieben da – und nie zweimal dieselbe
  // hintereinander.
  function zahlFuer(gleis, vorher = null) {
    const moeglich = [];
    for (let n = 1; n < gleis.bis; n += 1) if (n !== vorher) moeglich.push(n);
    return moeglich[Math.floor(Math.random() * moeglich.length)];
  }

  function punkteFuer(abweichung, bis) {
    const t = toleranzFuer(bis);
    const d = Math.abs(abweichung);
    if (d <= t.genau) return 5;
    if (d <= t.fast) return 4;
    if (d <= t.knapp) return 3;
    if (d <= t.nah) return 2;
    if (d <= t.weit) return 1;
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Die Lok des Kindes
  // ---------------------------------------------------------------------------
  // Dieselbe Lok wie auf dem Startbild: so ist es der eigene Zug, der hier
  // seinen Halt sucht. Gelesen wird, was train-home.js abgelegt hat; ohne
  // Eintrag fährt die Lok, mit der jedes Kind anfängt.
  function readLoco() {
    try {
      const raw = localStorage.getItem("lernapp.train.loco");
      return art.locoConfig(raw ? JSON.parse(raw) : {});
    } catch { return art.locoConfig({}); }
  }

  function lokBild() {
    // Der Ausschnitt lässt oben Platz für Kamin und Wimpel und endet unten an
    // den Rädern, damit die Lok auf dem Gleis steht und nicht darüber schwebt.
    return art.el("svg", {
      viewBox: `0 20 ${art.LOCO_W} ${art.GROUND - 20}`,
      class: "zg-lok-bild",
      "aria-hidden": "true",
    }, [art.buildLoco(readLoco())]);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  const state = {
    phase: "menu", stufe: STUFEN[0], index: 0, gleis: null, zahl: 0, vorher: null,
    p: 0, punkte: 0, genau: 0, fast: 0, knapp: 0, nah: 0, weit: 0, daneben: 0, drag: false,
  };
  let shell = null;
  let schild = null;
  let gleis = null;
  let lok = null;
  let ziel = null;
  let zielZahl = null;
  let plus = null;
  let marken = null;
  let stepTimer = null;
  let releaseHelp = null;

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  // ---------------------------------------------------------------------------
  // Die Stufenwahl
  // ---------------------------------------------------------------------------
  // Vier Knöpfe: die grösste Zahl der Stufe, und darunter ein kleines Gleis
  // mit immer weniger Strichen – so ist auch ohne Lesen zu sehen, dass es
  // nach rechts schwerer wird.
  function gleisBild(striche) {
    const teile = [
      art.el("rect", { x: 2, y: 13, width: 76, height: 4, rx: 2, fill: "#8a5f1c" }),
      art.el("rect", { x: 2, y: 8, width: 3, height: 14, rx: 1.5, fill: "#8a3a2c" }),
      art.el("rect", { x: 75, y: 8, width: 3, height: 14, rx: 1.5, fill: "#8a3a2c" }),
    ];
    for (let i = 1; i <= striche; i += 1) {
      const x = 2 + (76 * i) / (striche + 1);
      teile.push(art.el("rect", { x: x - 1.2, y: 10, width: 2.4, height: 8, rx: 1, fill: "#243047" }));
    }
    return art.el("svg", { viewBox: "0 0 80 24", class: "zg-stufe-gleis", "aria-hidden": "true" }, teile);
  }

  function showMenu() {
    clearStep();
    releaseHelp?.();
    releaseHelp = null;
    shell.closeOverlay();
    shell.setPhase("menu");
    state.phase = "menu";
    state.drag = false;
    shell.setCount(0);

    shell.clear();
    shell.play.append(shell.el("p", "cm-prompt", "Wie gross sollen die Zahlen sein?"));
    const reihe = shell.el("div", "zg-stufen");
    STUFEN.forEach((stufe) => {
      const button = shell.el("button", "zg-stufe");
      button.type = "button";
      button.dataset.stufe = String(stufe.nr);
      button.setAttribute("aria-label", `Stufe ${stufe.nr}: Zahlen ${stufe.name}.`);
      button.append(shell.el("span", "zg-stufe-zahl", String(stufe.bis)));
      button.append(gleisBild(stufe.striche));
      button.addEventListener("click", () => startRun(stufe));
      reihe.append(button);
    });
    shell.play.append(reihe);
  }

  // ---------------------------------------------------------------------------
  // Das Gleis
  // ---------------------------------------------------------------------------
  // Alles auf dem Gleis steht an einem Anteil zwischen 0 und 1 der Strecke; die
  // Ränder links und rechts sind im CSS als --zg-rand abgezogen. So rechnet das
  // Spiel nie in Bildpunkten, und das Gleis darf so breit sein, wie die Bühne
  // hergibt.
  function baueMarken(aktuell) {
    marken.innerHTML = "";
    const { bis, marken: alle, zahlen } = aktuell;
    for (let n = 0; n <= bis; n += alle) {
      const ende = n === 0 || n === bis;
      const marke = shell.el("span", `zg-marke${ende ? " is-bahnhof" : ""}`);
      marke.style.setProperty("--zg-p", String(n / bis));
      // Der Strich hängt unter der Schiene. Über ihr verdeckte die Lok ihn
      // genau dann, wenn es darauf ankam – beim Zielen; unten bleibt er frei,
      // und der Strich der Lok reicht bis neben ihn hinunter.
      marke.append(shell.el("span", "zg-marke-strich"));
      if (ende) {
        // Der Bahnhof steht oben auf der Schiene, mit seiner Zahl im Giebel.
        const bahnhof = shell.el("span", "zg-bahnhof");
        bahnhof.append(art.el("svg", { viewBox: "0 0 40 34", "aria-hidden": "true" }, [
          art.el("path", { d: "M4 16 L20 4 L36 16 V32 H4 Z", fill: "#fff8ea", stroke: "#8a3a2c", "stroke-width": 2.5, "stroke-linejoin": "round" }),
          art.el("rect", { x: 15, y: 20, width: 10, height: 12, fill: "#8a3a2c" }),
        ]));
        const zahl = shell.el("span", `zg-bahnhof-zahl${String(n).length > 2 ? " is-lang" : ""}`, String(n));
        bahnhof.append(zahl);
        marke.append(bahnhof);
      } else if (zahlen) {
        // Auf dem ersten Gleis steht unter jedem Strich seine Zahl – hier wird
        // gezählt, nicht geschätzt.
        marke.append(shell.el("span", "zg-marke-zahl", String(n)));
      }
      marken.append(marke);
    }
    gleis.setAttribute("aria-label", `Gleis von 0 bis ${bis}`);
  }

  function setLok(p, sofort = false) {
    state.p = Math.max(0, Math.min(1, p));
    lok.classList.toggle("is-sofort", sofort);
    lok.style.setProperty("--zg-p", String(state.p));
  }

  // Aus der Fingerstelle wird ein Anteil der Strecke. Gemessen wird an den
  // beiden Bahnhofsmarken – dort, wo CSS sie wirklich hingestellt hat. Den
  // Rand aus --zg-rand zu lesen ginge nicht: eine Custom Property kommt aus
  // getComputedStyle als unaufgelöster Text ("clamp(44px, …)") zurück, nicht
  // als Zahl, und die Lok stünde neben dem Finger statt darunter.
  //
  // Eine Marke ist ohne Breite; ihre linke Kante ist die Stelle. Die Mitte zu
  // rechnen schadet trotzdem nicht und hielte, wenn sie je wieder Breite bekäme.
  function anteilVon(clientX) {
    const box = gleis.getBoundingClientRect();
    let links = box.left;
    let rechts = box.right;
    const erste = marken.firstElementChild;
    const letzte = marken.lastElementChild;
    if (erste && letzte && letzte !== erste) {
      const a = erste.getBoundingClientRect();
      const b = letzte.getBoundingClientRect();
      links = a.left + a.width / 2;
      rechts = b.left + b.width / 2;
    }
    return (clientX - links) / Math.max(1, rechts - links);
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun(stufe = state.stufe) {
    clearStep();
    releaseHelp?.();
    releaseHelp = null;
    shell.closeOverlay();
    shell.setPhase("play");
    Object.assign(state, { phase: "aufgabe", stufe, index: 0, vorher: null, punkte: 0, genau: 0, fast: 0, knapp: 0, nah: 0, weit: 0, daneben: 0, drag: false });
    shell.setCount(0);

    shell.clear();
    schild = shell.el("div", "zg-schild");
    schild.setAttribute("role", "status");
    schild.setAttribute("aria-live", "polite");
    const fortschritt = shell.el("div", "zg-fortschritt");
    fortschritt.setAttribute("aria-hidden", "true");
    for (let i = 0; i < ZAHLEN_JE_RUNDE; i += 1) fortschritt.append(shell.el("span", "zg-punkt"));

    gleis = shell.el("div", "zg-gleis");
    gleis.setAttribute("role", "slider");
    gleis.setAttribute("tabindex", "0");
    marken = shell.el("div", "zg-marken");
    const schiene = shell.el("div", "zg-schiene");
    ziel = shell.el("div", "zg-ziel");
    zielZahl = shell.el("span", "zg-ziel-zahl");
    ziel.append(zielZahl);
    ziel.hidden = true;
    lok = shell.el("div", "zg-lok");
    lok.append(lokBild());
    plus = shell.el("span", "zg-plus");
    plus.hidden = true;
    lok.append(plus);
    gleis.append(schiene, marken, ziel, lok);

    shell.play.append(schild, fortschritt, gleis);

    naechsteZahl();
  }

  function naechsteZahl() {
    clearStep();
    state.phase = "aufgabe";
    state.gleis = gleisFuer(state.stufe, state.index);
    state.zahl = zahlFuer(state.gleis, state.vorher);
    state.vorher = state.zahl;
    const { bis } = state.gleis;

    baueMarken(state.gleis);
    ziel.hidden = true;
    plus.hidden = true;
    lok.classList.remove(...WIE.map((wie) => `is-${wie}`));
    setLok(0);

    schild.textContent = String(state.zahl);
    schild.classList.remove("is-neu");
    void schild.offsetWidth;
    schild.classList.add("is-neu");
    gleis.setAttribute("aria-valuemin", "0");
    gleis.setAttribute("aria-valuemax", String(bis));
    gleis.setAttribute("aria-valuenow", "0");
    gleis.setAttribute("aria-valuetext", `Lok steht bei 0. Gesucht ist ${state.zahl}.`);
    shell.play.querySelectorAll(".zg-punkt").forEach((punkt, i) => punkt.classList.toggle("is-dran", i === state.index));

    // Der Lautsprecher sagt jetzt die Zahl – wer sie nicht lesen kann, hört
    // sie. Die Spielregeln bleiben darunter liegen und kommen zurück, sobald
    // die Runde vorbei ist.
    releaseHelp?.();
    releaseHelp = kids()?.pushHelp?.(
      `Die Zahl ist ${state.zahl}. Das Gleis geht von null bis ${bis}. Schieb die Lok dorthin, wo die ${state.zahl} liegt, und lass los.`,
    ) || null;
  }

  function antwort(p) {
    if (state.phase !== "aufgabe") return;
    state.phase = "zeigen";
    state.drag = false;
    lok.classList.remove("is-drag");
    setLok(p);
    const { bis } = state.gleis;
    const wert = state.p * bis;
    const punkte = punkteFuer(wert - state.zahl, bis);
    const wie = WIE[punkte];
    state[wie] += 1;
    state.punkte += punkte;
    shell.setCount(state.punkte);

    // Das Schild fährt an die richtige Stelle; die Lok färbt sich danach, wie
    // nah sie steht.
    zielZahl.textContent = String(state.zahl);
    ziel.className = `zg-ziel is-${wie}`;
    ziel.style.setProperty("--zg-p", String(state.zahl / bis));
    ziel.hidden = false;
    lok.classList.add(`is-${wie}`);
    plus.textContent = punkte ? `+${punkte}` : "0";
    plus.className = `zg-plus is-${wie}`;
    plus.hidden = false;
    gleis.setAttribute("aria-valuenow", wert.toFixed(1));
    gleis.setAttribute("aria-valuetext", `Lok steht bei ${wert.toFixed(1)}, gesucht war ${state.zahl}: ${punkte} Punkte.`);

    if (punkte >= 4) { kids()?.playJingle?.("correct"); kids()?.vibrate?.(16); }
    else if (punkte >= 2) kids()?.playJingle?.("star");
    else kids()?.playJingle?.("retry");

    stepTimer = window.setTimeout(() => {
      state.index += 1;
      if (state.index >= ZAHLEN_JE_RUNDE) finish();
      else naechsteZahl();
    }, ZEIGEN_MS);
  }

  function runsText(runs) {
    const left = RUNS_FOR_DONE - runs;
    if (left <= 0) return "Dieses Spiel ist geschafft – der Wagen ist gebaut.";
    return left === 1
      ? "Noch eine Runde bis zum fertigen Wagen."
      : `Noch ${left} Runden bis zum fertigen Wagen.`;
  }

  function resultSpeech(punkte, runs) {
    const treffer = state.genau === 0 ? "keine Zahl" : state.genau === 1 ? "eine Zahl" : `${state.genau} Zahlen`;
    return `Stufe ${state.stufe.nr}, Zahlen bis ${state.stufe.bis}: Du hast ${punkte} von ${ZAHLEN_JE_RUNDE * PUNKTE_JE_ZAHL} Punkten und ${treffer} genau getroffen. ${runsText(runs)}`;
  }

  function finish() {
    clearStep();
    state.phase = "over";
    releaseHelp?.();
    releaseHelp = null;
    const punkte = state.punkte;
    const next = recordRun(punkte);
    kids()?.playJingle?.("win");
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: `Stufe ${state.stufe.nr} · ${state.genau} genau · ${state.fast + state.knapp} knapp · ${state.nah + state.weit + state.daneben} daneben`,
      scores: next.scores,
      top: TOP_COUNT,
      note: { text: runsText(next.runs), done: next.runs >= RUNS_FOR_DONE },
      speech: resultSpeech(punkte, next.runs),
      onBack: showMenu,
    });
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Wo hält der Zug?",
    area: "zahlbuchstabe",
    accent: "#E8543F",
    accentDark: "#a8321f",
    help: HELP,
    clock: false,
    // Neu starten heisst: dieselbe Stufe noch einmal; aus der Stufenwahl
    // heraus wieder die Stufenwahl.
    onRestart: () => (state.phase === "menu" ? showMenu() : startRun(state.stufe)),
    // Zurück aus einer Runde führt in die Stufenwahl, nicht gleich aus dem
    // Spiel heraus. Erst von dort aus geht es in die Bereichsauswahl.
    onBack: () => {
      if (state.phase === "menu") return false;
      showMenu();
      return true;
    },
  });

  // Das Menü zuerst: Hier wählt jeder seine Stufe selbst. (In der App kann
  // stattdessen die Reisekarte eine Stufe vorgeben – shell.journey; hier ist
  // die immer leer.)
  showMenu();

  // --- Schieben und Tippen ---------------------------------------------------
  // Ein Tipp auf das Gleis setzt die Lok dorthin und zählt schon als Antwort;
  // wer sie lieber schiebt, hält den Finger unten – die Lok folgt ihm – und
  // antwortet mit dem Loslassen. Beides ist ein Griff, kein zweiter Knopf.
  host.addEventListener("pointerdown", (event) => {
    if (state.phase !== "aufgabe" || !gleis || !gleis.contains(event.target)) return;
    event.preventDefault();
    state.drag = true;
    lok.classList.add("is-drag");
    try { gleis.setPointerCapture(event.pointerId); } catch { /* egal */ }
    setLok(anteilVon(event.clientX), true);
  });

  host.addEventListener("pointermove", (event) => {
    if (!state.drag || state.phase !== "aufgabe") return;
    setLok(anteilVon(event.clientX), true);
  });

  host.addEventListener("pointerup", (event) => {
    if (!state.drag) return;
    antwort(anteilVon(event.clientX));
  });

  host.addEventListener("pointercancel", () => {
    if (!state.drag) return;
    state.drag = false;
    lok.classList.remove("is-drag");
  });

  // --- Tastatur ----------------------------------------------------------------
  // Pfeile schieben die Lok um ein Viertel einer Zahl, Enter oder Leertaste
  // lassen sie halten. Die Tasten 1 bis 4 wählen die Stufe.
  document.addEventListener("keydown", (event) => {
    if (state.phase === "menu") {
      const stufe = STUFEN[["1", "2", "3", "4"].indexOf(event.key)];
      if (stufe) { event.preventDefault(); startRun(stufe); }
      return;
    }
    if (state.phase !== "aufgabe") return;
    const { bis } = state.gleis;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const schritt = 1 / (bis * 4);
      setLok(state.p + (event.key === "ArrowRight" ? schritt : -schritt), true);
      gleis.setAttribute("aria-valuenow", (state.p * bis).toFixed(2));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      if (document.activeElement?.tagName === "BUTTON") return;
      event.preventDefault();
      antwort(state.p);
    }
  });

  window.addEventListener("pagehide", clearStep);

  window.LernappZahlengleis = {
    STUFEN, PLAN, WIE, ZAHLEN_JE_RUNDE, PUNKTE_JE_ZAHL, RUNS_FOR_DONE,
    gleisFuer, toleranzFuer, zahlFuer, punkteFuer, state,
  };
})();
