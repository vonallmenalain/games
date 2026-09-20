/*
 * highscore.js – Wer hat das beste Ergebnis?
 *
 * Eine Bestenliste ist keine Zahl, sondern eine Frage nach der richtigen Zahl.
 * Turmbau misst Blöcke, Weichen-Wirrwarr Sterne, Arukone gelöste Level und
 * gebrauchte Zeit. Wer alle drei über einen Kamm schert, bekommt eine Liste,
 * die nichts bedeutet.
 *
 * Diese Datei hält deshalb an einer Stelle fest, woran sich jedes Spiel misst,
 * und rechnet daraus zweierlei:
 *
 *   liste()       die Rangfolge mehrerer Konten – für die Gruppe auf dem
 *                 Startbild: der Zug eines anderen, ein Wagen, ein Spiel.
 *   auswertung()  dieselben Daten zusammengezählt – für den Adminbereich:
 *                 wie oft wurde ein Spiel gespielt, abgeschlossen, neu
 *                 gestartet, und was ist der Bestwert.
 *
 * Rechnet nur. Kein DOM, kein Netz, keine Anmeldung: die Daten kommen von
 * aussen herein, damit dieselbe Rechnung für die Gruppe und für den
 * Adminbereich gilt. Läuft auf jeder Seite, weil das Profilfenster mit dem
 * Adminbereich überall aufgeht.
 *
 * Ein Konto sieht so aus:
 *
 *   { id, name, eigen, gameState, levels }
 *
 *   gameState  die Kästen der Spiele mit eigenem Konto, so wie firebase.js sie
 *              liefert: { "lernapp.turmbau": { data: {...} } }. Ein Kasten ohne
 *              Hülle wird ebenso verstanden.
 *   levels     die Level-Dokumente aus users/<uid>/levelProgress.
 */
(() => {
  "use strict";

  // ---------------------------------------------------------------------------
  // Woran sich ein Spiel misst
  // ---------------------------------------------------------------------------
  // Drei Messarten reichen für alle Spiele:
  //
  //   punkte   Runden mit einer Punktzahl. Bestwert ist die beste Runde.
  //            Level gibt es nicht – eine Runde ist eine Runde.
  //   sterne   Level, die mit null bis drei Sternen bewertet werden. Bestwert
  //            sind die Sterne zusammen, je Level zählen seine eigenen.
  //   katalog  Level aus dem Levelkatalog. Die liegen Level für Level in der
  //            Cloud, mit Versuchen, Zeit, Zügen und Neustarts – die einzigen
  //            Spiele, bei denen sich "wie oft neu gestartet" beantworten lässt.
  //
  // Der Titel steht hier ein zweites Mal, obwohl train-progress.js ihn auch
  // führt. Das ist kein Versehen: train-progress.js läuft nur auf dem
  // Startbild, der Adminbereich geht auf jeder Seite auf. Damit die beiden
  // Listen nicht auseinanderlaufen, hält sie scripts/validate-bestenliste.mjs
  // zusammen.
  const SPIELE = [
    // Gedächtnis
    { id: "backpack", titel: "Rucksack packen", bereich: "gedaechtnis", art: "punkte", key: "lernapp.backpack", einheit: "Punkte" },
    { id: "memory", titel: "Memory", bereich: "gedaechtnis", art: "sterne", key: "lernapp.memory", levelWort: (id) => `${id} Karten` },
    { id: "beachTreasure", titel: "Strand-Schätze", bereich: "gedaechtnis", art: "punkte", key: "lernapp.beachtreasure", einheit: "Schätze" },
    { id: "tileMemory", titel: "Kacheln-Knobeln", bereich: "gedaechtnis", art: "punkte", key: "lernapp.kacheln", einheit: "Kacheln" },
    { id: "missingItem", titel: "Was fehlt?", bereich: "gedaechtnis", art: "punkte", key: "lernapp.wasfehlt", einheit: "Wagen" },

    // Konzentration
    { id: "flanker", titel: "Schwarm-Fokus", bereich: "konzentration", art: "punkte", key: "lernapp.flanker", einheit: "Punkte" },
    { id: "trackRouter", titel: "Weichen-Wirrwarr", bereich: "konzentration", art: "sterne", key: "lernapp.trackrouter" },
    { id: "fishPond", titel: "Fischteich", bereich: "konzentration", art: "punkte", key: "lernapp.fischteich", einheit: "Fische" },
    { id: "gridlock", titel: "Freie Fahrt", bereich: "konzentration", art: "sterne", key: "lernapp.freiefahrt" },
    { id: "goSignal", titel: "Halt am Signal", bereich: "konzentration", art: "punkte", key: "lernapp.signal", einheit: "Punkte" },

    // Geschwindigkeit
    { id: "tiersprung", titel: "Tier-Sprung", bereich: "geschwindigkeit", art: "sterne", key: "lernapp.tiersprung.progress" },
    { id: "cardMatch", titel: "Karten-Merker", bereich: "geschwindigkeit", art: "punkte", key: "lernapp.cardmatch", einheit: "Punkte" },
    { id: "leafFlow", titel: "Blätter im Strom", bereich: "geschwindigkeit", art: "punkte", key: "lernapp.blaetter", einheit: "Blätter" },
    { id: "towerStack", titel: "Turmbau", bereich: "geschwindigkeit", art: "punkte", key: "lernapp.turmbau", einheit: "Blöcke" },
    { id: "twinSpot", titel: "Doppelt gleich", bereich: "geschwindigkeit", art: "punkte", key: "lernapp.doppelt", einheit: "Paare" },

    // Problemlösen
    // Raumdetektiv legt keine Punktzahl ab, sondern die Sterne der Runde: die
    // Bewertung steht fest, wenn die Aufgaben durch sind. Gemessen wird deshalb
    // die beste Runde, nicht das einzelne Level.
    { id: "spatialPuzzle", titel: "Raumdetektiv", bereich: "problemloesen", art: "punkte", key: "lernapp.raumdetektiv", einheit: "Sterne" },
    { id: "arukone", titel: "Arukone", bereich: "problemloesen", art: "katalog" },
    { id: "bimaru", titel: "Battleships", bereich: "problemloesen", art: "katalog" },
    { id: "shikaku", titel: "Tiergehege", bereich: "problemloesen", art: "katalog" },
    { id: "craneStack", titel: "Fässer stapeln", bereich: "problemloesen", art: "sterne", key: "lernapp.faesser" },

    // Zahl und Buchstabe
    { id: "letterPuzzle", titel: "Buchstabenjagd", bereich: "zahlbuchstabe", art: "katalog" },
    { id: "readingPuzzle", titel: "Wortdetektiv", bereich: "zahlbuchstabe", art: "katalog" },
    { id: "kakuro", titel: "Kakuro", bereich: "zahlbuchstabe", art: "katalog" },
    { id: "hidoku", titel: "Hidoku", bereich: "zahlbuchstabe", art: "katalog" },
    { id: "numberLine", titel: "Wo hält der Zug?", bereich: "zahlbuchstabe", art: "punkte", key: "lernapp.zahlengleis", einheit: "Punkte" },
  ];

  // Die fünf Bereiche des Zugs, nur mit Namen: der Adminbereich stellt seine
  // Auswertung danach zusammen, und "Gedächtnis" liest sich besser als
  // "gedaechtnis". Farbe, Symbol und Wagenbauart bleiben in train-progress.js –
  // hier wird nichts gezeichnet.
  const BEREICHE = {
    gedaechtnis: "Gedächtnis",
    konzentration: "Konzentration",
    geschwindigkeit: "Geschwindigkeit",
    problemloesen: "Problemlösen",
    zahlbuchstabe: "Zahl und Buchstabe",
  };

  // Spiele, die es einmal gab oder die nur im Levelkatalog auftauchen. Ihr
  // Fortschritt kann in alten Konten stehen, und der Adminbereich soll ihn
  // benennen können, statt "sudoku" hinzuschreiben.
  const ALTE_TITEL = {
    sudoku: "Sudoku",
    mathPuzzle: "Zahlenzauber",
    sequencePuzzle: "Zahlenfolge",
    shapeSequencePuzzle: "Figurenfolge",
    oddOneOut: "Was passt nicht?",
    whatFits: "Was passt?",
    countPuzzle: "Zählzauber",
  };

  const SCHWIERIGKEIT = ["easy", "medium", "hard", "extreme"];
  const SCHWIERIGKEIT_WORT = { easy: "Leicht", medium: "Mittel", hard: "Schwer", extreme: "Extrem" };

  const NACH_ID = new Map(SPIELE.map((spiel) => [spiel.id, spiel]));

  function spiel(id) { return NACH_ID.get(id) || null; }

  function titel(id) {
    return NACH_ID.get(id)?.titel || ALTE_TITEL[id] || id || "Rätsel";
  }

  // ---------------------------------------------------------------------------
  // Kleine Helfer
  // ---------------------------------------------------------------------------
  function zahl(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function sterneZahl(value) {
    return Math.max(0, Math.min(3, Math.round(zahl(value))));
  }

  // Der Kasten eines Spiels mit eigenem Konto. firebase.js liefert ihn mit
  // Hülle ({ data, updatedAt }), game-cloud.js ohne – beides wird verstanden,
  // damit kein Aufrufer vorher auspacken muss.
  function kasten(konto, key) {
    const eintrag = konto?.gameState?.[key];
    if (!eintrag || typeof eintrag !== "object") return null;
    if (eintrag.data && typeof eintrag.data === "object") return eintrag.data;
    return eintrag;
  }

  function levelDocs(konto, spielId) {
    const alle = Array.isArray(konto?.levels) ? konto.levels : [];
    return alle.filter((eintrag) => eintrag && eintrag.game === spielId);
  }

  function levelId(eintrag) {
    return String(eintrag?.levelId || eintrag?.id || eintrag?.levelName || "");
  }

  function zeitWort(sekunden) {
    const wert = Math.max(0, Math.round(zahl(sekunden)));
    if (!wert) return "";
    const minuten = Math.floor(wert / 60);
    if (minuten >= 60) return `${Math.floor(minuten / 60)} h ${minuten % 60} min`;
    if (minuten) return `${minuten} min ${wert % 60} s`;
    return `${wert} s`;
  }

  function mehrzahl(anzahl, eins, viele) {
    return `${anzahl} ${anzahl === 1 ? eins : viele}`;
  }

  // ---------------------------------------------------------------------------
  // Was ein Konto bei einem Spiel geschafft hat
  // ---------------------------------------------------------------------------
  // Alle drei Messarten geben dieselbe Form zurück, damit die Rangfolge darüber
  // nichts von der Messart wissen muss:
  //
  //   wert     die Zahl, nach der sortiert wird (grösser ist besser)
  //   zweit    entscheidet bei Gleichstand (grösser ist besser)
  //   text     was in der Liste steht
  //   zusatz   die Zeile darunter, oder ""
  //   leer     true, wenn hier noch nichts gespielt wurde
  function ergebnis(spielId, konto, levelWahl = null) {
    const s = spiel(spielId);
    if (!s) return leeresErgebnis();
    if (s.art === "punkte") return punkteErgebnis(s, konto);
    if (s.art === "sterne") return sterneErgebnis(s, konto, levelWahl);
    return katalogErgebnis(s, konto, levelWahl);
  }

  function leeresErgebnis(text = "noch nicht gespielt") {
    return { wert: 0, zweit: 0, text, zusatz: "", leer: true };
  }

  function punkteErgebnis(s, konto) {
    const daten = kasten(konto, s.key) || {};
    const punkte = (Array.isArray(daten.scores) ? daten.scores : [])
      .map(zahl)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => b - a);
    const runden = Math.max(0, Math.round(zahl(daten.runs)));
    if (!punkte.length && !runden) return leeresErgebnis();

    const best = punkte.length ? punkte[0] : 0;
    return {
      wert: best,
      zweit: runden,
      text: `${best} ${s.einheit || "Punkte"}`,
      zusatz: runden ? mehrzahl(runden, "Runde", "Runden") : "",
      leer: !punkte.length,
    };
  }

  function sterneErgebnis(s, konto, levelWahl) {
    const best = kasten(konto, s.key)?.best;
    const eintraege = best && typeof best === "object" ? best : {};

    if (levelWahl != null) {
      const sterne = sterneZahl(eintraege[levelWahl]?.stars);
      if (!sterne) return leeresErgebnis("noch nicht geschafft");
      return { wert: sterne, zweit: 0, text: mehrzahl(sterne, "Stern", "Sterne"), zusatz: "", leer: false };
    }

    const geschafft = Object.keys(eintraege).filter((id) => sterneZahl(eintraege[id]?.stars) > 0);
    if (!geschafft.length) return leeresErgebnis();
    const sterne = geschafft.reduce((summe, id) => summe + sterneZahl(eintraege[id]?.stars), 0);
    return {
      wert: sterne,
      zweit: geschafft.length,
      text: mehrzahl(sterne, "Stern", "Sterne"),
      zusatz: `${mehrzahl(geschafft.length, "Level", "Level")} geschafft`,
      leer: false,
    };
  }

  function katalogErgebnis(s, konto, levelWahl) {
    const docs = levelDocs(konto, s.id);

    if (levelWahl != null) {
      const eintrag = docs.find((doc) => levelId(doc) === String(levelWahl));
      if (!eintrag) return leeresErgebnis();
      const zeit = zahl(eintrag.timeSeconds || eintrag.elapsedSeconds);
      if (!eintrag.solved) {
        const versuche = Math.round(zahl(eintrag.attempts));
        return {
          wert: 0,
          zweit: 0,
          text: "noch offen",
          zusatz: versuche ? mehrzahl(versuche, "Versuch", "Versuche") : "",
          leer: !versuche,
        };
      }
      // Gelöst zählt mehr als schnell: wer ein Level geschafft hat, steht über
      // jedem, der es nicht geschafft hat. Unter den Gelösten entscheidet die
      // Zeit – und weil kleiner besser ist, wird sie negativ verglichen.
      return {
        wert: 1,
        zweit: zeit ? -zeit : 0,
        text: zeit ? zeitWort(zeit) : "gelöst",
        zusatz: `${mehrzahl(Math.round(zahl(eintrag.moves)), "Zug", "Züge")} · ${mehrzahl(Math.round(zahl(eintrag.resets)), "Neustart", "Neustarts")}`,
        leer: false,
      };
    }

    const geloest = docs.filter((doc) => doc.solved);
    const zeit = docs.reduce((summe, doc) => summe + zahl(doc.timeSeconds || doc.elapsedSeconds), 0);
    if (!geloest.length && !docs.length) return leeresErgebnis();
    return {
      wert: geloest.length,
      // Bei gleich vielen gelösten Leveln steht vorn, wer weniger Zeit
      // gebraucht hat.
      zweit: zeit ? -zeit : 0,
      text: `${mehrzahl(geloest.length, "Level", "Level")} gelöst`,
      zusatz: zeit ? zeitWort(zeit) : "",
      leer: !geloest.length,
    };
  }

  // ---------------------------------------------------------------------------
  // Die Level eines Spiels
  // ---------------------------------------------------------------------------
  // Zusammengetragen aus den Konten, nicht aus einer Liste hier: welche Level
  // es gibt, weiss das Spiel, und was gespielt wurde, wissen die Konten. Ein
  // Level, das noch niemand angefasst hat, fehlt also – und das ist richtig,
  // eine Bestenliste ohne einen einzigen Eintrag ist keine.
  function level(spielId, konten = []) {
    const s = spiel(spielId);
    if (!s || s.art === "punkte") return [];

    if (s.art === "sterne") {
      const ids = new Set();
      konten.forEach((konto) => {
        const best = kasten(konto, s.key)?.best;
        if (best && typeof best === "object") Object.keys(best).forEach((id) => ids.add(id));
      });
      return [...ids]
        .sort((a, b) => (Number(a) - Number(b)) || String(a).localeCompare(String(b), "de"))
        .map((id) => ({ id, label: s.levelWort ? s.levelWort(id) : `Level ${id}` }));
    }

    const gesehen = new Map();
    konten.forEach((konto) => {
      levelDocs(konto, s.id).forEach((doc) => {
        const id = levelId(doc);
        if (!id || gesehen.has(id)) return;
        gesehen.set(id, {
          id,
          label: doc.levelName || doc.title || id,
          schwierigkeit: doc.difficulty || "easy",
        });
      });
    });

    return [...gesehen.values()].sort((a, b) => {
      const rang = SCHWIERIGKEIT.indexOf(a.schwierigkeit) - SCHWIERIGKEIT.indexOf(b.schwierigkeit);
      return rang || a.label.localeCompare(b.label, "de");
    }).map((eintrag) => ({
      id: eintrag.id,
      label: eintrag.label,
      note: SCHWIERIGKEIT_WORT[eintrag.schwierigkeit] || "",
    }));
  }

  // ---------------------------------------------------------------------------
  // Die Bestenliste
  // ---------------------------------------------------------------------------
  // Ohne levelWahl das ganze Spiel, mit levelWahl ein einzelnes Level. Wer noch
  // nichts gespielt hat, steht am Ende – und bleibt in der Liste: ein Kind, das
  // seinen Namen nicht findet, glaubt, es sei nicht dabei.
  //
  // Der Platz wird geteilt, wenn zwei dasselbe geschafft haben. Zwei Kinder mit
  // 40 Punkten sind beide Zweiter, und der nächste ist Vierter.
  function liste(spielId, konten = [], levelWahl = null) {
    const eintraege = konten.map((konto) => ({
      konto,
      name: konto?.name || "Kind",
      eigen: Boolean(konto?.eigen),
      ...ergebnis(spielId, konto, levelWahl),
    }));

    eintraege.sort((a, b) => {
      if (a.leer !== b.leer) return a.leer ? 1 : -1;
      return (b.wert - a.wert) || (b.zweit - a.zweit) || a.name.localeCompare(b.name, "de");
    });

    let platz = 0;
    let vorher = null;
    eintraege.forEach((eintrag, index) => {
      const gleich = vorher && !eintrag.leer && !vorher.leer
        && eintrag.wert === vorher.wert && eintrag.zweit === vorher.zweit;
      if (!gleich) platz = index + 1;
      eintrag.platz = eintrag.leer ? null : platz;
      vorher = eintrag;
    });

    return eintraege;
  }

  // ---------------------------------------------------------------------------
  // Die Auswertung für den Adminbereich
  // ---------------------------------------------------------------------------
  // Dieselben Konten, nur zusammengezählt statt sortiert.
  //
  //   gespielt        angefangene Runden oder Level
  //   abgeschlossen   geschaffte Runden oder Level
  //   neugestartet    Neustarts mitten im Level
  //   spieler         wie viele Konten das Spiel überhaupt angefasst haben
  //   bestwert        der beste Wert und wer ihn hält
  //
  // Nicht jede Zahl gibt es bei jedem Spiel: Neustarts zählt nur, wer seinen
  // Fortschritt Level für Level in der Cloud ablegt – die Spiele mit eigenem
  // Konto führen nur ihren eigenen Kasten. Wo eine Zahl fehlt, steht null und
  // nicht 0: "nicht gezählt" ist etwas anderes als "keinmal".
  function auswertung(spielId, konten = []) {
    const s = spiel(spielId);
    const rang = liste(spielId, konten);
    const beste = rang.find((eintrag) => !eintrag.leer) || null;
    const spieler = rang.filter((eintrag) => !eintrag.leer).length;
    const grund = {
      id: spielId,
      titel: titel(spielId),
      art: s?.art || "katalog",
      spieler,
      bestwert: beste ? beste.text : "",
      bestwertVon: beste ? beste.name : "",
      zeit: null,
      gespielt: 0,
      abgeschlossen: 0,
      neugestartet: null,
    };

    if (!s) return grund;

    if (s.art === "punkte") {
      const runden = konten.reduce((summe, konto) => summe + Math.max(0, Math.round(zahl(kasten(konto, s.key)?.runs))), 0);
      // Eine Runde, die läuft, wird nicht gezählt – gezählt wird sie erst, wenn
      // sie vorbei ist. Angefangen und abgeschlossen ist hier also dasselbe.
      return { ...grund, gespielt: runden, abgeschlossen: runden };
    }

    if (s.art === "sterne") {
      const geschafft = konten.reduce((summe, konto) => {
        const best = kasten(konto, s.key)?.best;
        if (!best || typeof best !== "object") return summe;
        return summe + Object.keys(best).filter((id) => sterneZahl(best[id]?.stars) > 0).length;
      }, 0);
      return { ...grund, gespielt: geschafft, abgeschlossen: geschafft };
    }

    let versuche = 0;
    let geloest = 0;
    let resets = 0;
    let zeit = 0;
    konten.forEach((konto) => {
      levelDocs(konto, s.id).forEach((doc) => {
        versuche += Math.max(0, Math.round(zahl(doc.attempts)));
        resets += Math.max(0, Math.round(zahl(doc.resets)));
        zeit += zahl(doc.timeSeconds || doc.elapsedSeconds);
        if (doc.solved) geloest += 1;
      });
    });

    return { ...grund, gespielt: versuche, abgeschlossen: geloest, neugestartet: resets, zeit };
  }

  // Alle Spiele auf einmal, für die Übersicht im Adminbereich. Sortiert nach
  // Bereichen wie im Zug, damit die Reihenfolge dieselbe ist wie auf dem
  // Startbild.
  function alleAuswertungen(konten = []) {
    return SPIELE.map((s) => ({ ...auswertung(s.id, konten), bereich: s.bereich }));
  }

  window.LernappHighscore = {
    SPIELE,
    BEREICHE,
    SCHWIERIGKEIT_WORT,
    spiel,
    titel,
    level,
    liste,
    ergebnis,
    auswertung,
    alleAuswertungen,
    zeitWort,
  };
})();
