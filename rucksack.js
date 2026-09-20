/*
 * rucksack.js – Rucksack packen als wachsende Reihenfolge.
 *
 * Ein Gegenstand kommt in den Rucksack, dann muss die ganze Reihenfolge noch
 * einmal gepackt werden. Danach kommt einer dazu, und wieder die ganze Reihe.
 * Was zählt, ist die längste Reihe, die vollständig zurückkam.
 *
 * Zwei Schritte wechseln sich ab, und sie sehen bewusst verschieden aus:
 *
 *   Aussuchen  – goldener Rand, ein "Neu"-Schild: hier kommt etwas Neues in
 *                den Rucksack, es gibt kein Richtig und kein Falsch.
 *   Packen     – lila Rand, eine Reihe Plätze mit Nummern: jetzt wird die
 *                Reihe von vorn gepackt, und der Platz, der dran ist, blinkt.
 *
 * Der Rucksack selbst steht unten rechts im Bild. Jeder Gegenstand fliegt
 * sichtbar hinein, und die Zahl darauf sagt, wie viele schon drin sind. Vor
 * dem Packen wird er ausgeleert – die Zahl geht auf null und füllt sich mit
 * jedem richtigen Gegenstand wieder.
 *
 * Vier Schwierigkeiten: wie viele Gegenstände bei jedem Schritt zur Wahl
 * stehen. Bei dreien ist ein geratener Tipp jeder dritte, bei sechsen jeder
 * sechste – deshalb ist ein gemerkter Gegenstand dort doppelt so viel wert.
 *
 * Bühne und Bestenliste kommen aus game-shell.js; hier steht nur die Regel.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "backpack") return;

  const host = document.querySelector("#rs-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  const art = window.LernappTrainArt || null;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const reduced = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  // ---------------------------------------------------------------------------
  // Regeln
  // ---------------------------------------------------------------------------
  // Die Stufen sind die Zahl der Karten, die bei jedem Schritt zur Wahl
  // stehen. Der Faktor gleicht aus, dass Raten bei drei Karten dreimal so oft
  // trifft wie bei sechsen. Gerundet wird aufwärts – eine halbe Punktzahl
  // müsste ein Kind erst deuten.
  //
  // Gewählt wird nicht: In der App sagt die Schwierigkeitsstufe des Kindes,
  // wie viele Karten zur Wahl stehen – drei, vier oder sechs. Hier stehen für
  // alle vier da, und das ist der Punkt: Eine Bestenliste, in der der eine
  // gegen drei Karten und der andere gegen sechs gespielt hat, vergleicht
  // nichts. Die Stufen mit drei, fünf und sechs bleiben in der Tabelle, damit
  // die Punkteformel nachvollziehbar bleibt.
  const STUFEN = [
    { anzahl: 3, faktor: 1 },
    { anzahl: 4, faktor: 1.2 },
    { anzahl: 5, faktor: 1.5 },
    { anzahl: 6, faktor: 2 },
  ];
  const aktuelleStufe = () => STUFEN[1];

  // Wie viele, sagt das Wagen-Set: fünf im ersten, neun im zweiten (kids.js).
  const RUNS_FOR_DONE = window.LernappKids?.wagonRounds?.() || 5;
  const TOP_COUNT = 5;
  // Wie lange der neue Gegenstand allein dasteht, bevor er in den Rucksack
  // fliegt.
  const MERK_MS = 1000;
  // So lange dauert der Flug in den Rucksack. Danach geht es weiter.
  const FLUG_MS = 520;
  // Und so lange steht ein falscher Tipp da, bevor die Runde vorbei ist.
  const FEHLER_MS = 700;

  const HELP = [
    "Rucksack packen. Unten rechts steht dein Rucksack.",
    "Zuerst suchst du dir einen neuen Gegenstand aus – das ist der goldene Schritt. Er fliegt in den Rucksack.",
    "Dann wird der Rucksack ausgeleert, und du packst alles noch einmal ein – in derselben Reihenfolge wie vorher. Das ist der lila Schritt: die Plätze mit den Nummern zeigen, welcher Gegenstand gerade dran ist.",
    "Stimmt die Reihe, kommt ein neuer Gegenstand dazu, und du packst wieder von vorn.",
    "Tippst du einmal daneben, ist die Runde vorbei.",
    "Gezählt wird die längste Reihe, die du ganz geschafft hast.",
    "Wie viele Karten zur Wahl stehen, hängt von deiner Stufe ab – je mehr, desto mehr Punkte gibt jeder Gegenstand.",
    "Zeit hast du so viel du willst.",
  ].join(" ");

  const ITEMS = [
    { id: "apple", emoji: "🍎", label: "Apfel" },
    { id: "ball", emoji: "⚽", label: "Ball" },
    { id: "book", emoji: "📘", label: "Buch" },
    { id: "kite", emoji: "🪁", label: "Flugdrachen" },
    { id: "banana", emoji: "🍌", label: "Banane" },
    { id: "bear", emoji: "🧸", label: "Teddy" },
    { id: "pencil", emoji: "✏️", label: "Stift" },
    { id: "cookie", emoji: "🍪", label: "Keks" },
    { id: "car", emoji: "🚗", label: "Auto" },
    { id: "key", emoji: "🔑", label: "Schlüssel" },
    { id: "flower", emoji: "🌸", label: "Blume" },
    { id: "rocket", emoji: "🚀", label: "Rakete" },
    { id: "clock", emoji: "⏰", label: "Wecker" },
    { id: "shell", emoji: "🐚", label: "Muschel" },
    { id: "puzzle", emoji: "🧩", label: "Puzzle" },
    { id: "train", emoji: "🚂", label: "Zug" },
    { id: "umbrella", emoji: "☂️", label: "Schirm" },
    { id: "light", emoji: "💡", label: "Lampe" },
    { id: "hat", emoji: "🧢", label: "Kappe" },
    { id: "magnifier", emoji: "🔎", label: "Lupe" },
    { id: "dice", emoji: "🎲", label: "Würfel" },
    { id: "paint", emoji: "🎨", label: "Farbe" },
    { id: "map", emoji: "🗺️", label: "Karte" },
    { id: "medal", emoji: "🏅", label: "Medaille" },
    { id: "gift", emoji: "🎁", label: "Geschenk" },
    { id: "balloon", emoji: "🎈", label: "Ballon" },
    { id: "cup", emoji: "🥤", label: "Becher" },
    { id: "sandwich", emoji: "🥪", label: "Sandwich" },
    { id: "cheese", emoji: "🧀", label: "Käse" },
    { id: "grapes", emoji: "🍇", label: "Trauben" },
    { id: "carrot", emoji: "🥕", label: "Rüebli" },
    { id: "corn", emoji: "🌽", label: "Mais" },
    { id: "strawberry", emoji: "🍓", label: "Erdbeere" },
    { id: "chocolate", emoji: "🍫", label: "Schoggi" },
    { id: "lollipop", emoji: "🍭", label: "Lolli" },
    { id: "shoe", emoji: "👟", label: "Schuh" },
    { id: "sock", emoji: "🧦", label: "Socke" },
    { id: "glove", emoji: "🧤", label: "Handschuh" },
    { id: "scarf", emoji: "🧣", label: "Schal" },
    { id: "sunglasses", emoji: "🕶️", label: "Sonnenbrille" },
    { id: "camera", emoji: "📷", label: "Kamera" },
    { id: "phone", emoji: "📱", label: "Telefon" },
    { id: "headphones", emoji: "🎧", label: "Kopfhörer" },
    { id: "microphone", emoji: "🎤", label: "Mikrofon" },
    { id: "drum", emoji: "🥁", label: "Trommel" },
    { id: "guitar", emoji: "🎸", label: "Gitarre" },
    { id: "trumpet", emoji: "🎺", label: "Trompete" },
    { id: "violin", emoji: "🎻", label: "Geige" },
    { id: "crown", emoji: "👑", label: "Krone" },
    { id: "ring", emoji: "💍", label: "Ring" },
    { id: "gem", emoji: "💎", label: "Edelstein" },
    { id: "envelope", emoji: "✉️", label: "Brief" },
    { id: "mailbox", emoji: "📮", label: "Briefkasten" },
    { id: "paperclip", emoji: "📎", label: "Büroklammer" },
    { id: "scissors", emoji: "✂️", label: "Schere" },
    { id: "ruler", emoji: "📏", label: "Lineal" },
    { id: "calculator", emoji: "🧮", label: "Rechner" },
    { id: "laptop", emoji: "💻", label: "Laptop" },
    { id: "battery", emoji: "🔋", label: "Batterie" },
    { id: "flashlight", emoji: "🔦", label: "Taschenlampe" },
  ];

  // ---------------------------------------------------------------------------
  // Bestenliste – lokal und in der Cloud
  // ---------------------------------------------------------------------------
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.backpack", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  // Zustand
  // ---------------------------------------------------------------------------
  const state = { phase: "menu", stufe: null, reihe: [], schritt: 0, erinnert: 0, locked: false, drin: 0 };
  let shell = null;
  let feld = null;
  let prompt = null;
  let promptChip = null;
  let promptText = null;
  let plaetze = null;
  let rucksack = null;
  let rucksackZahl = null;
  let stepTimer = null;

  function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  const punkte = (erinnert, stufe) => Math.ceil(erinnert * stufe.faktor);

  // Welcher Schritt gerade läuft, steht an der Bühne: daran hängt, wie die
  // Gegenstände gerahmt sind und welches Schild über ihnen steht.
  function setPhase(phase) {
    state.phase = phase;
    host.dataset.rsPhase = phase;
  }

  function runsText(runs) {
    const left = RUNS_FOR_DONE - runs;
    if (left <= 0) return "Dieses Spiel ist geschafft – der Wagen ist gebaut.";
    return left === 1
      ? "Noch eine Runde bis zum fertigen Wagen."
      : `Noch ${left} Runden bis zum fertigen Wagen.`;
  }

  // ---------------------------------------------------------------------------
  // Der Rucksack
  // ---------------------------------------------------------------------------
  // Unten rechts, immer im Bild. Die Zahl darauf sagt, wie viele Sachen gerade
  // drin sind – nicht welche: die soll sich das Kind ja merken.
  function buildRucksack() {
    const wrap = shell.el("div", "rs-rucksack");
    wrap.setAttribute("role", "img");
    wrap.setAttribute("aria-label", "Dein Rucksack. Noch nichts drin.");
    if (art) {
      wrap.append(art.el("svg", { viewBox: "0 0 100 112", class: "rs-rucksack-art", "aria-hidden": "true" }, [
        // Träger hinter dem Rucksack.
        art.el("rect", { x: 20, y: 8, width: 14, height: 44, rx: 7, fill: "#8a5a2b" }),
        art.el("rect", { x: 66, y: 8, width: 14, height: 44, rx: 7, fill: "#8a5a2b" }),
        // Der Griff oben.
        art.el("path", { d: "M36 24 q14 -18 28 0", fill: "none", stroke: "#8a5a2b", "stroke-width": 7, "stroke-linecap": "round" }),
        // Der Körper.
        art.el("rect", { x: 12, y: 24, width: 76, height: 84, rx: 20, fill: "#e0913c" }),
        // Die Klappe – beim Ausleeren geht sie auf.
        art.el("path", { class: "rs-klappe", d: "M12 46 a38 26 0 0 1 76 0 v12 h-76 z", fill: "#c97a2c" }),
        art.el("rect", { x: 43, y: 50, width: 14, height: 12, rx: 3, fill: "#5c3a17" }),
        // Die Aussentasche.
        art.el("rect", { x: 28, y: 70, width: 44, height: 28, rx: 9, fill: "#c97a2c" }),
        art.el("rect", { x: 28, y: 70, width: 44, height: 8, rx: 4, fill: "#b4681f" }),
      ]));
    } else {
      wrap.append(shell.el("span", "rs-rucksack-bild", "🎒"));
    }
    rucksackZahl = shell.el("span", "rs-rucksack-zahl", "0");
    rucksackZahl.setAttribute("aria-hidden", "true");
    wrap.append(rucksackZahl);
    return wrap;
  }

  function setDrin(anzahl) {
    state.drin = anzahl;
    if (!rucksack) return;
    rucksackZahl.textContent = String(anzahl);
    rucksack.setAttribute("aria-label", anzahl === 0
      ? "Dein Rucksack. Noch nichts drin."
      : `Dein Rucksack. ${anzahl === 1 ? "Ein Gegenstand" : `${anzahl} Gegenstände`} drin.`);
  }

  // Einmal hüpfen, wenn etwas hineinfällt.
  function bump(className) {
    if (!rucksack) return;
    rucksack.classList.remove("is-bump", "is-leer");
    void rucksack.offsetWidth;
    rucksack.classList.add(className);
  }

  // Ein Gegenstand fliegt von seinem Platz in den Rucksack. Geflogen wird eine
  // Kopie des Bildes; das Feld darunter darf sich derweil schon umbauen.
  function fliegeInRucksack(node, emoji, done) {
    if (!node || !rucksack || reduced()) { done(); return; }
    const von = node.getBoundingClientRect();
    const zu = rucksack.getBoundingClientRect();
    if (!von.width || !zu.width) { done(); return; }
    const flug = shell.el("span", "rs-flug", emoji);
    flug.setAttribute("aria-hidden", "true");
    const bild = node.querySelector(".rs-item-bild") || node;
    flug.style.fontSize = window.getComputedStyle(bild).fontSize;
    flug.style.left = `${von.left + von.width / 2}px`;
    flug.style.top = `${von.top + von.height / 2}px`;
    flug.style.setProperty("--dx", `${zu.left + zu.width / 2 - (von.left + von.width / 2)}px`);
    flug.style.setProperty("--dy", `${zu.top + zu.height * 0.42 - (von.top + von.height / 2)}px`);
    flug.style.setProperty("--flug", `${FLUG_MS}ms`);
    host.append(flug);
    let fertig = false;
    const schluss = () => {
      if (fertig) return;
      fertig = true;
      flug.remove();
      done();
    };
    flug.addEventListener("animationend", schluss, { once: true });
    // Falls die Animation nicht meldet (etwa weil das Fenster verborgen ist),
    // geht es trotzdem weiter.
    window.setTimeout(schluss, FLUG_MS + 120);
  }

  // Das Bild an der Bühne: die Plätze, die beim Packen der Reihe nach zu füllen
  // sind. Nummern statt Bilder – die Bilder sind ja gerade das, was gemerkt
  // werden soll.
  function zeichnePlaetze(schritt) {
    plaetze.innerHTML = "";
    state.reihe.forEach((item, index) => {
      const platz = shell.el("span", "rs-platz");
      if (index < schritt) { platz.classList.add("is-drin"); platz.textContent = "✓"; }
      else if (index === schritt) { platz.classList.add("is-dran"); platz.textContent = String(index + 1); }
      else platz.textContent = String(index + 1);
      plaetze.append(platz);
    });
  }

  function setPrompt(chip, text, chipClass = "") {
    promptChip.className = `rs-chip${chipClass ? ` ${chipClass}` : ""}`;
    promptChip.textContent = chip;
    promptChip.hidden = !chip;
    promptText.textContent = text;
  }

  // ---------------------------------------------------------------------------
  // Eine Runde
  // ---------------------------------------------------------------------------
  function startRun(stufe) {
    clearStep();
    shell.closeOverlay();
    shell.setPhase("play");
    state.stufe = stufe;
    state.reihe = [];
    state.schritt = 0;
    state.erinnert = 0;
    state.locked = false;
    shell.setCount(0);

    shell.clear();
    host.querySelectorAll(".rs-flug").forEach((node) => node.remove());
    prompt = shell.el("p", "cm-prompt rs-prompt");
    promptChip = shell.el("span", "rs-chip");
    promptText = shell.el("span", "rs-prompt-text");
    prompt.append(promptChip, promptText);
    plaetze = shell.el("div", "rs-plaetze");
    plaetze.setAttribute("aria-hidden", "true");
    feld = shell.el("div", "rs-feld");
    rucksack = buildRucksack();
    shell.play.append(prompt, plaetze, feld, rucksack);
    setDrin(0);
    zeigeWahl();
  }

  // Die Karten für einen Schritt: kein Rahmen um das Bild, nur ein farbiger
  // Ring dahinter – gold beim Aussuchen, lila beim Packen. Der Ring gehört
  // zum Schritt, nicht zur Sache, und wird deshalb nicht mitgemerkt.
  function karten(liste, onTap) {
    feld.innerHTML = "";
    feld.dataset.anzahl = String(liste.length);
    liste.forEach((item) => {
      const button = shell.el("button", "rs-item");
      button.type = "button";
      button.setAttribute("aria-label", item.label);
      button.append(shell.el("span", "rs-item-bild", item.emoji));
      button.addEventListener("click", () => onTap(item, button));
      feld.append(button);
    });
  }

  // --- Einen neuen Gegenstand aussuchen ---
  function zeigeWahl() {
    setPhase("waehlen");
    state.locked = false;
    setPrompt("＋ Neu", state.reihe.length ? "Such dir noch einen neuen Gegenstand aus." : "Such dir einen Gegenstand aus.", "is-neu");
    plaetze.hidden = true;
    const drin = new Set(state.reihe.map((item) => item.id));
    const frei = ITEMS.filter((item) => !drin.has(item.id));
    karten(shuffle(frei).slice(0, state.stufe.anzahl), (item, button) => {
      if (state.locked) return;
      state.locked = true;
      state.reihe.push(item);
      kids()?.playJingle?.("star");
      kids()?.vibrate?.(12);
      button.classList.add("is-gewaehlt");
      zeigeMerken(item);
    });
  }

  // --- Ihn kurz allein zeigen, dann fliegt er in den Rucksack ---
  function zeigeMerken(item) {
    setPhase("merken");
    setPrompt("＋ Neu", "Merk ihn dir!", "is-neu");
    feld.innerHTML = "";
    feld.dataset.anzahl = "1";
    const bild = shell.el("div", "rs-item is-solo");
    bild.append(shell.el("span", "rs-item-bild", item.emoji));
    feld.append(bild);
    stepTimer = window.setTimeout(() => {
      if (state.phase !== "merken") return;
      bild.classList.add("is-weg");
      fliegeInRucksack(bild, item.emoji, () => {
        if (state.phase !== "merken") return;
        setDrin(state.reihe.length);
        bump("is-bump");
        // Kurz stehen lassen, dann wird ausgeleert und von vorn gepackt.
        stepTimer = window.setTimeout(() => {
          if (state.phase !== "merken") return;
          setDrin(0);
          bump("is-leer");
          zeigePacken(0);
        }, 520);
      });
    }, MERK_MS);
  }

  // --- Die ganze Reihe noch einmal packen ---
  function zeigePacken(schritt) {
    setPhase("packen");
    state.schritt = schritt;
    state.locked = false;
    const richtig = state.reihe[schritt];
    setPrompt(String(schritt + 1), state.reihe.length === 1
      ? "Pack ihn ein."
      : `Was war Nummer ${schritt + 1}?`, "is-packen");
    plaetze.hidden = false;
    zeichnePlaetze(schritt);
    const ablenker = shuffle(ITEMS.filter((item) => item.id !== richtig.id)).slice(0, state.stufe.anzahl - 1);
    karten(shuffle([richtig, ...ablenker]), (item, button) => {
      if (state.locked) return;
      state.locked = true;
      if (item.id === richtig.id) {
        button.classList.add("is-right");
        kids()?.playJingle?.("correct");
        kids()?.vibrate?.(14);
        fliegeInRucksack(button, item.emoji, () => {
          if (state.phase !== "packen") return;
          setDrin(schritt + 1);
          bump("is-bump");
          zeichnePlaetze(schritt + 1);
          if (schritt + 1 < state.reihe.length) { zeigePacken(schritt + 1); return; }
          // Die ganze Reihe sass: das ist der neue Stand.
          state.erinnert = state.reihe.length;
          shell.setCount(state.erinnert);
          stepTimer = window.setTimeout(() => { if (state.phase === "packen") zeigeWahl(); }, 380);
        });
        return;
      }
      button.classList.add("is-wrong");
      kids()?.playJingle?.("retry");
      stepTimer = window.setTimeout(finish, FEHLER_MS);
    });
  }

  // ---------------------------------------------------------------------------
  // Schluss
  // ---------------------------------------------------------------------------
  function resultSpeech(points, runs) {
    const sachen = state.erinnert === 1 ? "einen Gegenstand" : `${state.erinnert} Gegenstände`;
    const zahl = points === 1 ? "einen Punkt" : `${points} Punkte`;
    return `Du hast ${sachen} gemerkt. Das gibt ${zahl}. ${runsText(runs)}`;
  }

  function finish() {
    clearStep();
    setPhase("over");
    const points = punkte(state.erinnert, state.stufe);
    const next = recordRun(points);
    kids()?.playJingle?.("win");
    shell.showResult({
      label: "Deine Punkte",
      points,
      detail: `${state.erinnert} gemerkt · ${state.stufe.anzahl} zur Wahl`,
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
    title: "Rucksack packen",
    area: "gedaechtnis",
    accent: "#7C5CE6",
    accentDark: "#5a41b8",
    help: HELP,
    clock: false,
    onRestart: () => startRun(aktuelleStufe()),
  });

  // Kein Menü: Die Kartenzahl steht fest, für alle gleich.
  startRun(aktuelleStufe());

  // Die Punkteformel nach aussen: das Prüfskript rechnet sie ohne Browser nach.
  window.LernappRucksack = { STUFEN, ITEMS, punkte, RUNS_FOR_DONE };

  window.addEventListener("pagehide", clearStep);
})();
