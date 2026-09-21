/*
 * weichen.js – Weichenwärter: sortieren, solange es rollt.
 *
 * Von oben kommen Wagen auf eine Weiche zu, jeder mit einer Fracht: Kohle,
 * Holz oder Kies. Unten stehen die Rampen, eine je Fracht. Wer den Wagen auf
 * die richtige Rampe schickt, bekommt einen Punkt; wer ihn falsch schickt,
 * hat einen entgleisten Wagen im Gleis und muss ihn aufräumen – und solange
 * rollt nichts.
 *
 * Die eine Zahl, an der das ganze Spiel hängt, ist WURF_MS: Eine Weiche
 * braucht Zeit zum Umlegen. Wer erst tippt, wenn der Wagen an der Gabel ist,
 * ist zu spät – der Wagen nimmt noch die alte Richtung. Damit ist es kein
 * Reaktionsspiel mehr, sondern eines, bei dem man den nächsten Wagen ansieht,
 * während der jetzige noch fährt.
 *
 * Deshalb sind auch immer mehrere Wagen im Bild. Kommen zwei mit derselben
 * Fracht hintereinander, darf die Weiche stehenbleiben – und genau das ist
 * der Unterschied zwischen "reagieren" und "lesen".
 *
 * Die Form ist die von Blätter im Strom: fünfundvierzig Sekunden lang so
 * viele wie möglich, keine Level, kein Abbruch. Ein Fehler beendet hier nichts,
 * er kostet Zeit – ENTWIRREN_MS, in denen nichts rollt. Das hält die Runde
 * genau gleich lang, egal wie gut jemand ist (wichtig, wenn irgendwann vier
 * Leute dieselbe Stunde lang gegeneinander spielen), und tut trotzdem weh.
 *
 * Gerechnet wird in Anteilen der Anlage, nicht in Bildpunkten: Die Fläche ist
 * quer breit und flach und hochkant schmal und hoch, und ein Wagen soll auf
 * beiden dieselbe Strecke in derselben Zeit zurücklegen.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "yard") return;

  const host = document.querySelector("#ww-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  const art = window.LernappTrainArt;
  if (!host || !shellApi || !art) return;

  const kids = () => window.LernappKids || null;

  const zufall = window.LernappZufall?.fuer?.("shuntYard") || {
    fest: false, neu() {}, zahl: Math.random,
    ganz: (n) => Math.floor(Math.random() * n),
    aus: (liste) => liste[Math.floor(Math.random() * liste.length)],
  };

  // ---------------------------------------------------------------------------
  // Die Regeln
  // ---------------------------------------------------------------------------
  const ROUND_MS = 60000;
  // So lange braucht die Weiche zum Umlegen. Die Zahl ist der Kern des Spiels:
  // gross genug, dass Zutippen im letzten Moment nicht mehr reicht, klein
  // genug, dass zwei verschiedene Frachten hintereinander immer zu schaffen
  // sind – auch beim schnellsten Takt (siehe TEMPO_MAX).
  const WURF_MS = 150;
  // Ein falsch geschickter Wagen entgleist. So lange steht die Anlage still.
  const ENTWIRREN_MS = 1500;

  // Das Band: Wie weit zwei Wagen auseinanderliegen (in Anteilen der Strecke)
  // und wie schnell es läuft (Strecke je Sekunde). Der Abstand bleibt, das
  // Tempo steigt – so sieht die Schlange immer gleich aus, sie kommt nur
  // schneller. Ein Band, bei dem auch die Abstände schrumpfen, sieht am
  // Schluss aus wie ein einziger langer Wagen.
  const LUECKE = 0.5;
  const TEMPO_START = 0.16;       // gut sechs Sekunden von oben bis unten
  const TEMPO_MAX = 0.42;         // am Schluss knapp zweieinhalb
  const TEMPO_RAMPE_MS = 50000;   // in fünfzig Sekunden von einem zum anderen

  // Wo die Gabel liegt, in Anteilen der Höhe. Ab hier ist die Richtung
  // entschieden; darunter fährt der Wagen nur noch aus.
  const GABEL = 0.6;

  // Ab diesem Wagen gibt es die dritte Rampe. Vorher wäre es ein Spiel mit
  // zwei Antworten – das kann jeder, und es sagt nichts.
  const DRITTE_AB = 12;

  // Die Frachten. Farbe UND Form: Zwei Farben auseinanderzuhalten ist nicht
  // für alle dasselbe, und unter Zeitdruck erst recht nicht. Die Form auf dem
  // Wagen ist dieselbe wie die auf der Rampe.
  const FRACHTEN = [
    { id: "kohle", name: "Kohle", farbe: "#3f4756", hell: "#5c6679" },
    { id: "holz", name: "Holz", farbe: "#b5763a", hell: "#d59a5c" },
    { id: "kies", name: "Kies", farbe: "#8c96a6", hell: "#aeb7c4" },
  ];

  const HELP = [
    "Weichenwärter. Von oben rollen Wagen auf die Weiche zu.",
    "Unten stehen die Rampen: eine für Kohle, eine für Holz, später eine für Kies.",
    "Tippe auf die Rampe, zu der der nächste Wagen gehört – dann legt sich die Weiche um.",
    "Die Weiche braucht einen Moment. Tippst du erst an der Gabel, ist es zu spät.",
    "Ein falsch geschickter Wagen entgleist, und so lange rollt nichts.",
    "Du hast eine Minute. Sortier so viele wie du kannst.",
  ].join(" ");

  // ---------------------------------------------------------------------------
  // Bestenliste
  // ---------------------------------------------------------------------------
  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.weichen", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  // Zeichnungen
  // ---------------------------------------------------------------------------
  // Die Fracht als Umriss: Kohle rund gehäuft, Holz gestapelte Stämme, Kies
  // als spitzer Haufen. Drei Silhouetten, die auch klein und in Bewegung
  // auseinanderzuhalten sind.
  //
  // Die Teile allein, ohne eigenes <svg> darum: Auf dem Wagen kommen sie in
  // dessen Zeichnung hinein, und ein verschachteltes <svg> ohne Masse zöge
  // sich dort auf die ganze Wagenhöhe – die Fracht sässe hinter dem Kasten.
  // Gezeichnet ist alles in einem Feld von 52 auf 22.
  function frachtTeile(fracht) {
    return {
      kohle: [
        art.el("circle", { cx: 16, cy: 15, r: 6.5, fill: fracht.farbe }),
        art.el("circle", { cx: 27, cy: 13, r: 7.5, fill: fracht.hell }),
        art.el("circle", { cx: 37, cy: 15.5, r: 6, fill: fracht.farbe }),
      ],
      holz: [
        art.el("rect", { x: 10, y: 12, width: 33, height: 6.5, rx: 3.2, fill: fracht.farbe }),
        art.el("rect", { x: 14, y: 4.5, width: 25, height: 6.5, rx: 3.2, fill: fracht.hell }),
      ],
      kies: [
        art.el("path", { d: "M8 20 L26 4 L44 20 Z", fill: fracht.farbe }),
        art.el("path", { d: "M18 20 L26 11 L34 20 Z", fill: fracht.hell }),
      ],
    }[fracht.id];
  }

  // Dieselbe Fracht als eigenes Bild – für die Rampen und das Startbild.
  function frachtSvg(fracht, klasse) {
    return art.el("svg", { viewBox: "0 0 52 22", class: klasse, "aria-hidden": "true" }, frachtTeile(fracht));
  }

  // Ein Wagen: Kasten, zwei Räder, darauf die Fracht.
  function wagenSvg(fracht) {
    return art.el("svg", { viewBox: "0 0 60 44", class: "ww-wagen-art", "aria-hidden": "true" }, [
      art.el("g", { class: "ww-fracht", transform: "translate(4 0)" }, frachtTeile(fracht)),
      art.el("rect", { x: 3, y: 22, width: 54, height: 13, rx: 2.5, fill: "#6d5a45", stroke: "#4a3b2c", "stroke-width": 2 }),
      art.el("rect", { x: 3, y: 22, width: 54, height: 4, fill: "#8a7358" }),
      art.el("circle", { cx: 16, cy: 38, r: 5, fill: "#2f3743" }),
      art.el("circle", { cx: 44, cy: 38, r: 5, fill: "#2f3743" }),
      art.el("circle", { cx: 16, cy: 38, r: 1.8, fill: "#93a0b0" }),
      art.el("circle", { cx: 44, cy: 38, r: 1.8, fill: "#93a0b0" }),
    ]);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  const state = {
    phase: "intro",
    wagen: [],          // die, die gerade rollen
    naechste: 0,        // wie viele schon losgeschickt wurden
    letzte: [],         // die letzten Frachten – gegen zu lange Serien
    richtig: 0,
    falsch: 0,
    gefahren: 0,        // zurückgelegte Strecke des Bandes, in Anteilen
    weiche: 0,          // die Rampe, auf die sie jetzt zeigt
    ziel: 0,            // die, auf die sie sich gerade legt
    wurfBis: 0,
    stillBis: 0,        // so lange steht alles (Entgleisung)
    start: 0,
  };

  let shell = null;
  let anlage = null;
  let gleisBild = null;
  let rampen = [];
  let frame = null;
  let letzteZeit = 0;

  const rampenZahl = () => (state.naechste > DRITTE_AB ? 3 : 2);
  const stopLoop = () => { if (frame) { window.cancelAnimationFrame(frame); frame = null; } };

  // ---------------------------------------------------------------------------
  // Die Anlage
  // ---------------------------------------------------------------------------
  function baueAnlage() {
    const wrap = shell.el("div", "ww-anlage");

    // Das Gleisbild: der Strang von oben, die Gabel, die Stränge nach unten.
    // Es wird bei jedem Neuaufbau gezeichnet, weil die dritte Rampe später
    // dazukommt.
    gleisBild = art.el("svg", {
      class: "ww-gleisbild", viewBox: "0 0 100 100", preserveAspectRatio: "none", "aria-hidden": "true",
    }, []);
    wrap.append(gleisBild);

    const bahn = shell.el("div", "ww-bahn");
    wrap.append(bahn);

    const leiste = shell.el("div", "ww-rampen");
    wrap.append(leiste);

    return { wrap, bahn, leiste };
  }

  function zeichneGleis() {
    if (!gleisBild) return;
    gleisBild.innerHTML = "";
    const n = rampenZahl();
    const gabelY = GABEL * 100;
    const strang = (x2) => art.el("path", {
      d: `M 50 ${gabelY} C 50 ${gabelY + 14}, ${x2} ${gabelY + 10}, ${x2} 100`,
      fill: "none", stroke: "#7d7466", "stroke-width": 2.4, "stroke-linecap": "round",
      "vector-effect": "non-scaling-stroke",
    });
    gleisBild.append(art.el("path", {
      d: `M 50 0 L 50 ${gabelY}`, fill: "none", stroke: "#7d7466", "stroke-width": 3,
      "stroke-linecap": "round", "vector-effect": "non-scaling-stroke",
    }));
    for (let i = 0; i < n; i += 1) gleisBild.append(strang(mitteX(i, n)));
  }

  const mitteX = (i, n) => ((i + 0.5) / n) * 100;

  function baueRampen(leiste) {
    leiste.innerHTML = "";
    rampen = [];
    const n = rampenZahl();
    for (let i = 0; i < n; i += 1) {
      const fracht = FRACHTEN[i];
      const knopf = shell.el("button", "ww-rampe");
      knopf.type = "button";
      knopf.style.setProperty("--ww-farbe", fracht.farbe);
      knopf.setAttribute("aria-label", `Weiche auf ${fracht.name} stellen`);
      knopf.append(frachtSvg(fracht, "ww-rampe-art"));
      knopf.append(shell.el("span", "ww-rampe-wort", fracht.name));
      knopf.addEventListener("pointerdown", (event) => { event.preventDefault(); stelle(i); });
      leiste.append(knopf);
      rampen.push(knopf);
    }
    zeigeWeiche();
  }

  function zeigeWeiche() {
    rampen.forEach((knopf, i) => {
      knopf.classList.toggle("ist-gestellt", i === state.weiche);
      knopf.classList.toggle("ist-unterwegs", i === state.ziel && i !== state.weiche);
    });
  }

  // ---------------------------------------------------------------------------
  // Die Weiche stellen
  // ---------------------------------------------------------------------------
  function stelle(i) {
    if (state.phase !== "play" || i >= rampenZahl()) return;
    if (i === state.ziel) return;
    state.ziel = i;
    state.wurfBis = performance.now() + WURF_MS;
    zeigeWeiche();
    kids()?.vibrate?.(6);
  }

  // ---------------------------------------------------------------------------
  // Die Wagen
  // ---------------------------------------------------------------------------
  function neuerWagen(bahn) {
    // Nicht mehr als zwei gleiche hintereinander: Eine lange Serie ist kein
    // Sortieren mehr, sondern Warten.
    const moeglich = FRACHTEN.slice(0, rampenZahl());
    let fracht;
    do {
      fracht = zufall.aus(moeglich);
    } while (state.letzte.length >= 2 && state.letzte.every((f) => f === fracht.id));
    state.letzte = [...state.letzte, fracht.id].slice(-2);

    const node = shell.el("div", "ww-wagen");
    node.append(wagenSvg(fracht));
    bahn.append(node);
    state.wagen.push({
      fracht,
      node,
      // Wo das Band gerade steht, als der Wagen losfuhr. Daraus ergibt sich
      // sein Platz: p = gefahren - los.
      los: state.gefahren,
      ziel: null,
      // Auf wie viele Rampen er zufährt. Kommt die dritte dazu, während er
      // schon eingeschwenkt ist, bliebe er sonst nicht auf seinem Strang.
      spur: rampenZahl(),
      fertig: false,
    });
    state.naechste += 1;
  }

  function loese(wagen) {
    if (wagen.fertig) return;
    wagen.fertig = true;
    const richtig = wagen.ziel === FRACHTEN.indexOf(wagen.fracht);
    if (richtig) {
      state.richtig += 1;
      shell.setCount(state.richtig);
      kids()?.playJingle?.("correct");
      kids()?.vibrate?.(12);
      const knopf = rampen[wagen.ziel];
      if (knopf) {
        knopf.classList.remove("ist-angekommen");
        void knopf.offsetWidth;
        knopf.classList.add("ist-angekommen");
      }
      wagen.node.classList.add("ist-drin");
    } else {
      state.falsch += 1;
      kids()?.playJingle?.("retry");
      kids()?.vibrate?.([18, 40, 18]);
      wagen.node.classList.add("ist-entgleist");
      // Alles steht, bis der Wagen aufgeräumt ist. Das ist die ganze Strafe:
      // keine Minuspunkte, nur Zeit, die niemand mehr sortiert.
      state.stillBis = performance.now() + ENTWIRREN_MS;
      anlage?.classList.add("ist-blockiert");
    }
  }

  // ---------------------------------------------------------------------------
  // Der Lauf
  // ---------------------------------------------------------------------------
  function tempo(jetzt) {
    const anteil = Math.min(1, (jetzt - state.start) / TEMPO_RAMPE_MS);
    return TEMPO_START + (TEMPO_MAX - TEMPO_START) * anteil;
  }

  function step(now) {
    frame = window.requestAnimationFrame(step);
    if (state.phase !== "play" || !anlage) return;

    const dt = Math.min(0.05, Math.max(0, (now - letzteZeit) / 1000));
    letzteZeit = now;

    // Die Weiche kommt an.
    if (state.ziel !== state.weiche && now >= state.wurfBis) {
      state.weiche = state.ziel;
      zeigeWeiche();
    }

    const still = now < state.stillBis;
    if (!still && anlage.classList.contains("ist-blockiert")) {
      anlage.classList.remove("ist-blockiert");
      // Der entgleiste Wagen ist aufgeräumt.
      state.wagen = state.wagen.filter((w) => {
        if (!w.node.classList.contains("ist-entgleist")) return true;
        w.node.remove();
        return false;
      });
    }
    if (!still) state.gefahren += tempo(Date.now()) * dt;

    const box = anlage.getBoundingClientRect();
    if (!box.width) return;
    const n = rampenZahl();
    const breit = Math.max(44, Math.min(108, box.width / n * 0.66, box.height * 0.26));
    const hoch = breit * 0.73;

    for (const wagen of state.wagen) {
      const p = state.gefahren - wagen.los;
      // An der Gabel wird entschieden – mit der Weiche, wie sie JETZT steht.
      if (!wagen.fertig && wagen.ziel === null && p >= GABEL) {
        wagen.ziel = state.weiche;
        wagen.spur = n;
      }
      if (!wagen.fertig && p >= 1) loese(wagen);

      const y = -hoch + Math.min(p, 1.04) * (box.height + hoch);
      let x = box.width / 2;
      if (wagen.ziel !== null) {
        // Nach der Gabel schwenkt der Wagen in seine Rampe ein.
        const rein = Math.min(1, Math.max(0, (p - GABEL) / (1 - GABEL)));
        const zielX = (mitteX(wagen.ziel, wagen.spur) / 100) * box.width;
        x = box.width / 2 + (zielX - box.width / 2) * rein;
      }
      wagen.node.style.width = `${breit}px`;
      wagen.node.style.height = `${hoch}px`;
      wagen.node.style.transform = `translate(${x - breit / 2}px, ${y}px)`;
    }

    // Abgearbeitete Wagen verschwinden, wenn sie unten aus dem Bild sind.
    state.wagen = state.wagen.filter((wagen) => {
      if (!wagen.fertig || wagen.node.classList.contains("ist-entgleist")) return true;
      if (state.gefahren - wagen.los < 1.12) return true;
      wagen.node.remove();
      return false;
    });

    // Nachschub, sobald die Lücke gross genug ist.
    if (!still) {
      const letzter = state.wagen[state.wagen.length - 1];
      const abstand = letzter ? state.gefahren - letzter.los : Infinity;
      if (abstand >= LUECKE) {
        const vorher = rampenZahl();
        neuerWagen(anlage.querySelector(".ww-bahn"));
        if (rampenZahl() !== vorher) {
          // Die dritte Rampe kommt dazu: Gleisbild und Knöpfe neu, und der
          // Wärter bekommt es gesagt.
          baueRampen(anlage.querySelector(".ww-rampen"));
          zeichneGleis();
          melde("Dritte Rampe: Kies");
        }
      }
    }
  }

  // Ein kurzer Hinweis über der Anlage. Er hält nichts auf.
  function melde(text) {
    const tafel = anlage?.querySelector(".ww-melder");
    if (!tafel) return;
    tafel.textContent = text;
    tafel.classList.remove("ist-da");
    void tafel.offsetWidth;
    tafel.classList.add("ist-da");
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function showIntro() {
    stopLoop();
    shell.stopClock();
    shell.closeOverlay();
    shell.setPhase("intro");
    state.phase = "intro";
    state.wagen = [];
    state.naechste = 0;
    state.letzte = [];
    state.richtig = 0;
    state.falsch = 0;
    state.gefahren = 0;
    state.weiche = 0;
    state.ziel = 0;
    state.stillBis = 0;
    shell.setCount(0);
    anlage = null;

    shell.clear();
    shell.play.append(shell.el("p", "cm-prompt", "Jede Fracht auf ihre Rampe."));

    // Die drei Frachten nebeneinander, mit ihrem Namen. Mehr Erklärung
    // braucht es nicht; den Rest sagt der Lautsprecher.
    const demo = shell.el("div", "ww-demo");
    FRACHTEN.forEach((fracht) => {
      const chip = shell.el("span", "ww-demo-chip");
      chip.style.setProperty("--ww-farbe", fracht.farbe);
      chip.append(frachtSvg(fracht, "ww-demo-art"));
      chip.append(shell.el("span", "ww-demo-wort", fracht.name));
      demo.append(chip);
    });
    shell.play.append(demo);

    const start = shell.el("button", "cm-start", "Starten");
    start.type = "button";
    start.addEventListener("click", beginRound);
    shell.play.append(start);
  }

  function beginRound() {
    stopLoop();
    zufall.neu();
    state.phase = "play";
    state.wagen = [];
    state.naechste = 0;
    state.letzte = [];
    state.richtig = 0;
    state.falsch = 0;
    state.gefahren = 0;
    state.weiche = 0;
    state.ziel = 0;
    state.wurfBis = 0;
    state.stillBis = 0;
    state.start = Date.now();
    letzteZeit = performance.now();
    shell.setPhase("play");
    shell.setCount(0);

    shell.clear();
    const bau = baueAnlage();
    anlage = bau.wrap;
    const melder = shell.el("p", "ww-melder");
    melder.setAttribute("role", "status");
    anlage.append(melder);
    shell.play.append(anlage);
    baueRampen(bau.leiste);
    zeichneGleis();
    neuerWagen(bau.bahn);

    frame = window.requestAnimationFrame(step);
    shell.startClock(ROUND_MS, finish);
  }

  function resultSpeech(punkte) {
    const wagen = punkte === 1 ? "einen Wagen" : `${punkte} Wagen`;
    const daneben = state.falsch === 0
      ? "Kein einziger entgleist."
      : state.falsch === 1 ? "Einer ist entgleist." : `${state.falsch} sind entgleist.`;
    return `Du hast ${wagen} richtig sortiert. ${daneben}`;
  }

  function finish() {
    stopLoop();
    state.phase = "over";
    const punkte = state.richtig;
    recordRun(punkte);
    kids()?.playJingle?.("win");
    shell.showResult({
      label: "Sortierte Wagen",
      points: punkte,
      detail: `${state.richtig} richtig · ${state.falsch} entgleist`,
      speech: resultSpeech(punkte),
    });
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Weichenwärter",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    help: HELP,
    onRestart: showIntro,
  });

  showIntro();

  // --- Tastatur --------------------------------------------------------------
  const TASTEN = { ArrowLeft: 0, ArrowDown: 1, ArrowUp: 1, ArrowRight: 2, 1: 0, 2: 1, 3: 2 };

  document.addEventListener("keydown", (event) => {
    if (state.phase === "play") {
      const i = TASTEN[event.key];
      if (i !== undefined) {
        event.preventDefault();
        // Bei zwei Rampen liegt die rechte auf Platz 1, nicht auf Platz 2 –
        // sonst zeigte die rechte Pfeiltaste ins Leere.
        stelle(rampenZahl() === 2 && i === 2 ? 1 : i);
      }
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      if (document.activeElement?.tagName === "BUTTON") return;
      event.preventDefault();
      if (state.phase === "intro") beginRound();
    }
  });

  window.addEventListener("pagehide", stopLoop);
})();
