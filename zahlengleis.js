/*
 * zahlengleis.js – Wo hält der Zug? Der Zahlenstrahl als Gleis.
 *
 * Ein Gleis quer über das Bild, links der Bahnhof 0, rechts der letzte
 * Bahnhof. Oben steht eine Zahl. Wer spielt, schiebt die Lok dorthin, wo
 * diese Zahl auf dem Gleis liegt, und lässt los – oder tippt die Stelle
 * einfach an. Danach fährt ein Schild an die richtige Stelle und zeigt, wie
 * nah es war.
 *
 * Keine Stufenwahl und keine Marken. Zwischen den beiden Bahnhöfen steht
 * nichts: keine Striche, keine Zahlen, nichts, woran sich die Mitte ablesen
 * liesse. Wer die 500 auf einem Gleis bis 1000 sucht, muss sie sich denken –
 * und genau das ist die Aufgabe. Die beiden Enden bleiben angeschrieben,
 * sonst wäre nicht die Schätzung schwer, sondern der Massstab unbekannt.
 *
 * Eine Runde wird von selbst schwerer: die ersten Zahlen liegen auf dem Gleis
 * bis 100, die mittleren auf dem bis 500, die letzten auf dem bis 1000.
 * Dieselbe Strecke, immer feiner geteilt.
 *
 * Zehn Zahlen je Runde, bis zu zehn Punkte je Zahl – aber die zehn sind
 * schwer: Sie gelten nur für einen halben Prozentpunkt der Strecke, auf einem
 * Handy also für ein paar Bildpunkte. Danach fällt es steil (punkteFuer):
 * fünf Prozent daneben sind noch fünf Punkte, zwanzig noch einer. Wo die
 * Mitte der Lok ist, zeigt ein roter Strich unter ihr – ohne ihn müsste man
 * raten, ob der Kamin zählt oder das Führerhaus. Das ist kein Hinweis auf die
 * Zahl, nur auf die eigene Nase.
 *
 * Kein Zeitdruck und kein Ende nach einem Fehler: Jede Antwort zeigt die
 * richtige Stelle – das ist der Moment, in dem sich die Zahlenreihe im Kopf
 * festsetzt. Wer daneben liegt, sieht wohin, und bekommt die nächste Zahl.
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
  // Drei Gleise, eines nach dem anderen. Marken gibt es keine: `marken` steht
  // auf der Länge des Gleises, es steht also nur an den beiden Enden eine –
  // die Bahnhöfe, die den Massstab angeben. Dazwischen ist die Schiene leer.
  const GLEISE = [{ bis: 100 }, { bis: 500 }, { bis: 1000 }];

  // Welches Gleis die zehn Zahlen einer Runde bekommen: drei auf dem bis 100,
  // vier auf dem bis 500, drei auf dem bis 1000. Dieselbe Strecke auf dem
  // Bildschirm, immer feiner geteilt – die letzte Zahl ist die schwerste.
  const PLAN = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2];

  // Wie nah ist nah genug? Gemessen wird nicht in Zahlen, sondern im Anteil
  // der Strecke: Ein Finger ist auf jedem Gleis gleich breit, und 5 von 100
  // ist derselbe Weg wie 50 von 1000. Gerechnet wird darum in Prozent der
  // Strecke – dieselbe Zahl, die auf dem Gleis bis 100 die Zahl selbst ist.
  //
  // Jedes Band ist um eins breiter als das davor: 10 gilt für den Treffer,
  // 9 für eins und zwei daneben, 8 für drei bis fünf, 7 für sechs bis neun,
  // und so weiter. Oben ist es also eng und unten weit – wer grob danebenzielt,
  // verliert für jeden weiteren Schritt weniger, wer fast trifft, für jeden
  // Schritt mehr. Genau da soll es wehtun.
  //
  //   Punkte 10-k  bis  k·(k+3)/2  daneben
  //        9         2
  //        8         5
  //        7         9
  //        6        14      … und so fort bis 0.
  //
  // Die zehn braucht einen halben Prozentpunkt: Auf einem Bildschirm ist die
  // Lok nie EXAKT auf der Zahl, und "genau getroffen" heisst deshalb "näher
  // dran als eine halbe Zahl" – auf dem Gleis bis 100 also 42,5 bis 43,5 für
  // die 43. In Bildpunkten sind das quer gut zwei.
  const GENAU = 0.5;
  const bandGrenze = (k) => (k * (k + 3)) / 2;

  const ZAHLEN_JE_RUNDE = PLAN.length;
  const PUNKTE_JE_ZAHL = 10;
  // Wie eine Antwort heisst – für Farbe und Zählung. Elf Punktzahlen, sechs
  // Namen: Die Farbe muss man auf einen Blick auseinanderhalten können, und
  // elf Abstufungen sieht niemand.
  const WIE = ["daneben", "weit", "weit", "weit", "nah", "nah", "knapp", "knapp", "fast", "fast", "genau"];
  // So lange steht das Schild an der richtigen Stelle, bevor die nächste Zahl
  // kommt: lang genug zum Hinschauen, kurz genug, dass keine Runde zäh wird.
  const ZEIGEN_MS = 1500;
  // Wie viele, sagt das Wagen-Set: fünf im ersten, neun im zweiten (kids.js).
  const RUNS_FOR_DONE = window.LernappKids?.wagonRounds?.() || 5;
  const TOP_COUNT = 5;

  const HELP = [
    "Wo hält der Zug? Unten siehst du ein Gleis. Links ist der Bahnhof Null, rechts der letzte Bahnhof.",
    "Dazwischen steht nichts – du musst dir selbst denken, wo eine Zahl liegt.",
    "Oben steht eine Zahl. Schieb die Lok mit dem Finger dorthin, wo diese Zahl auf dem Gleis liegt, und lass los.",
    "Du kannst die Stelle auch einfach antippen.",
    "Der rote Strich unter der Lok zeigt ihre Mitte. Er zeigt nicht, wo die Zahl ist – nur, worauf du zielst.",
    "Danach zeigt ein Schild, wo die Zahl wirklich liegt.",
    "Je näher du dran bist, desto mehr Punkte gibt es: zehn, wenn du ganz genau triffst, und das ist schwer.",
    "Das Gleis wird länger: erst bis hundert, dann bis fünfhundert, zuletzt bis tausend.",
    "Zehn Zahlen, dann ist die Runde vorbei. Du hast so viel Zeit, wie du willst.",
  ].join(" ");

  // ---------------------------------------------------------------------------
  // Bestenliste – lokal und in der Cloud
  // ---------------------------------------------------------------------------
  // Eine Runde sind zehn Zahlen und höchstens hundert Punkte. Alle spielen
  // dasselbe – es gibt nur eine Schwierigkeit, also auch nur eine Liste.
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
  function gleisFuer(index) {
    return GLEISE[PLAN[index]];
  }

  // Nie die Enden – die stehen angeschrieben da – und nie zweimal dieselbe
  // hintereinander.
  function zahlFuer(gleis, vorher = null) {
    const moeglich = [];
    for (let n = 1; n < gleis.bis; n += 1) if (n !== vorher) moeglich.push(n);
    return moeglich[Math.floor(Math.random() * moeglich.length)];
  }

  // abweichung in Zahlen, bis = das Ende des Gleises. Beides zusammen ergibt
  // den Weg daneben in Prozent der Strecke – und nur der zählt.
  // Das Härchen am Vergleich ist kein Schnörkel: 14/100 × 100 ist in
  // Fliesskomma 14.000000000000002, und genau 14 daneben fiele sonst ins
  // nächste Band – die Grenze läge einen Rechenfehler neben der Zahl, die im
  // Kommentar steht.
  const HAERCHEN = 1e-9;

  function punkteFuer(abweichung, bis) {
    const weg = (Math.abs(abweichung) / bis) * 100;
    if (weg < GENAU) return PUNKTE_JE_ZAHL;
    for (let k = 1; k < PUNKTE_JE_ZAHL; k += 1) {
      if (weg <= bandGrenze(k) + HAERCHEN) return PUNKTE_JE_ZAHL - k;
    }
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
    phase: "aufgabe", index: 0, gleis: null, zahl: 0, vorher: null,
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
  // Das Gleis
  // ---------------------------------------------------------------------------
  // Alles auf dem Gleis steht an einem Anteil zwischen 0 und 1 der Strecke; die
  // Ränder links und rechts sind im CSS als --zg-rand abgezogen. So rechnet das
  // Spiel nie in Bildpunkten, und das Gleis darf so breit sein, wie die Bühne
  // hergibt.
  // Zwei Bahnhöfe, sonst nichts. Dazwischen ist die Schiene leer – keine
  // Striche, keine Zahlen, keine Mitte. Was hier dastünde, wäre die halbe
  // Antwort, und die Aufgabe ist gerade, sie sich selbst zu denken.
  //
  // Die Enden müssen bleiben: Sie sind nicht der Hinweis, sie sind der
  // Massstab. Ohne sie wüsste niemand, wo das Gleis anfängt und aufhört, und
  // die Schätzung wäre kein Schätzen mehr, sondern Raten.
  function baueMarken(aktuell) {
    marken.innerHTML = "";
    const { bis } = aktuell;
    for (const n of [0, bis]) {
      const marke = shell.el("span", "zg-marke is-bahnhof");
      marke.style.setProperty("--zg-p", String(n / bis));
      // Der Strich hängt unter der Schiene. Über ihr verdeckte die Lok ihn
      // genau dann, wenn es darauf ankam – beim Zielen; unten bleibt er frei,
      // und der Strich der Lok reicht bis neben ihn hinunter.
      marke.append(shell.el("span", "zg-marke-strich"));
      // Der Bahnhof steht oben auf der Schiene, mit seiner Zahl im Giebel.
      const bahnhof = shell.el("span", "zg-bahnhof");
      // Ein Haus ohne Tür: Die Zahl steht darin, und eine Tür in der Mitte
      // nähme ihr den Platz. Zwei Bahnhöfe, zwei Zahlen – sie sind das
      // Einzige, was auf diesem Gleis angeschrieben ist, und müssen ohne
      // Hinsehen zu lesen sein.
      bahnhof.append(art.el("svg", { viewBox: "0 0 40 34", "aria-hidden": "true" }, [
        art.el("path", { d: "M4 16 L20 4 L36 16 V32 H4 Z", fill: "#fff8ea", stroke: "#8a3a2c", "stroke-width": 2.5, "stroke-linejoin": "round" }),
      ]));
      bahnhof.append(shell.el("span", `zg-bahnhof-zahl${String(n).length > 2 ? " is-lang" : ""}`, String(n)));
      marke.append(bahnhof);
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
  function startRun() {
    clearStep();
    releaseHelp?.();
    releaseHelp = null;
    shell.closeOverlay();
    shell.setPhase("play");
    Object.assign(state, { phase: "aufgabe", index: 0, vorher: null, punkte: 0, genau: 0, fast: 0, knapp: 0, nah: 0, weit: 0, daneben: 0, drag: false });
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
    state.gleis = gleisFuer(state.index);
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
    return `Du hast ${punkte} von ${ZAHLEN_JE_RUNDE * PUNKTE_JE_ZAHL} Punkten und ${treffer} ganz genau getroffen. ${runsText(runs)}`;
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
      detail: `${state.genau} genau · ${state.fast + state.knapp} knapp · ${state.nah + state.weit + state.daneben} daneben`,
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
    title: "Wo hält der Zug?",
    area: "zahlbuchstabe",
    accent: "#E8543F",
    accentDark: "#a8321f",
    help: HELP,
    clock: false,
    // Es gibt nur eine Schwierigkeit – neu starten heisst neue Zahlen.
    onRestart: startRun,
  });

  // Ohne Menü beginnt die Runde sofort: Es gibt nichts zu wählen.
  startRun();

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
  // Pfeile schieben die Lok, Enter oder Leertaste lassen sie halten.
  // Geschoben wird um einen Anteil der Strecke, nicht um eine Zahl: Ein
  // Schritt von einem Viertel einer Zahl wäre auf dem Gleis bis 1000 ein
  // Zehntel Bildpunkt, und die Lok stünde nach zwanzig Tastendrücken noch
  // immer da. Ein Zweihundertstel ist fein genug für die zehn Punkte und
  // grob genug, um voranzukommen; mit Umschalt geht es in Sprüngen.
  const SCHRITT = 1 / 200;
  document.addEventListener("keydown", (event) => {
    if (state.phase !== "aufgabe") return;
    const { bis } = state.gleis;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const schritt = SCHRITT * (event.shiftKey ? 10 : 1);
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
    GLEISE, PLAN, GENAU, bandGrenze, WIE, ZAHLEN_JE_RUNDE, PUNKTE_JE_ZAHL, RUNS_FOR_DONE,
    gleisFuer, zahlFuer, punkteFuer, state,
  };
})();
