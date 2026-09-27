/*
 * cloud.js – Die Bestenliste, und sonst nichts.
 * ---------------------------------------------------------------------------
 * Wer hier spielt, hat einen Link angeklickt, tippt einen Namen ein und steht
 * in der Liste – mehr passiert nicht, und mehr kann diese Datei auch nicht.
 *
 * Eigenes Firebase-Projekt (games-a0cd4), eigene Datenbank, eigene
 * Anmeldung. Mit der Kids-App hat das nichts mehr zu tun: kein gemeinsames
 * Projekt, keine gemeinsamen Konten, keine gemeinsamen Zahlen.
 *
 * Ohne Anmeldung heisst für die Spiele wörtlich ohne: Die Spielseiten laden
 * firebase-auth gar nicht erst, und request.auth ist beim Schreiben leer. Die
 * Regeln (firestore.rules) prüfen deshalb nicht, WER schreibt, sondern WAS
 * geschrieben wird – ein Dokument je Spiel und Spieler, Punkte fallen nie,
 * Versuche zählen nur hoch.
 *
 * Angemeldet wird nur im Adminbereich (admin.js). Er lädt firebase-auth
 * zusätzlich und benutzt von hier aus nur app() und db().
 *
 * Ein Dokument sieht so aus:
 *
 *   miniScores/towerStack_mini_a7f3…
 *     game       "towerStack"     welches Spiel
 *     spieler    "mini_a7f3…"     die Kennung, die das Gerät sich selbst gab
 *     name       "Jonas"          was in der Liste steht
 *     punkte     42               der Bestwert, er fällt nie
 *     versuche   7                wie oft gespielt wurde
 *     erstesMs / updatedAtMs      Uhrzeiten, für die Reihenfolge bei
 *                                 Gleichstand
 *
 * Und, für Spiele mit festem Level, die Aufzeichnung eines Laufs:
 *
 *   miniGeister/trackRun_mini_a7f3…
 *     game / spieler / name       dieselben wie nebenan
 *     punkte     742              die Runde, aus der die Aufzeichnung stammt
 *     level      "v1"             wozu sie gehört; ein Geist aus v1 ist auf
 *                                 v2 sinnlos
 *     bahn       "AAEC…"          wo der Läufer wann war, als Text
 *
 * Eine eigene Sammlung, weil die Startseite JEDES Punkte-Dokument liest, um
 * die Hall of Fame zu bauen. Lägen die Aufzeichnungen dort, lüde jeder Besuch
 * der Startseite ein paar Kilobyte je Spieler mit, die dort niemand ansieht.
 *
 * Und die Turniere, jedes mit seiner eigenen kleinen Bestenliste:
 *
 *   miniTurniere/herbstcup-k3m9x2p7
 *     name, beschreibung          was auf der Turnierseite steht
 *     spiele     ["towerStack"]   was dazugehört
 *     startMs / endeMs            wann es läuft
 *     versuche   3                je Spiel; 0 heisst unbegrenzt
 *     zaehlt     "bester"         oder "summe": alle Versuche zusammen
 *     wertung    "platz"          oder "prozent" – siehe turnier.js
 *     aufgaben   "gleich"         oder "zufall" – siehe zufall.js
 *     sichtbar   "alle"           oder "link": nur, wer den Link hat
 *     verdeckt   false            Rangliste erst am Schluss zeigen
 *     aktiv      true             angehalten, wenn false
 *
 *   miniTurniere/<id>/eintraege/towerStack_mini_a7f3…
 *     game / spieler / name       wie in miniScores
 *     punkte     42               der beste Versuch oder die Summe
 *     versuche   2                wie viele begonnen wurden
 *     offen      false            ob gerade einer läuft, dessen Ergebnis
 *                                 noch aussteht
 *
 * Ein Turnier-Eintrag ist nicht miniScores mit anderem Namen: Ein Versuch
 * zählt dort, sobald er beginnt (turnierVersuch), und sein Ergebnis kommt
 * danach genau einmal (turnierErgebnis). firestore.rules erzählt, warum.
 */
(() => {
  "use strict";

  // Das eigene Projekt. Ein Web-API-Schlüssel ist kein Geheimnis: Er steht in
  // jeder Seite, die Firebase im Browser nutzt, und geschützt wird durch die
  // Regeln, nicht durch ihn.
  const firebaseConfig = {
    apiKey: "AIzaSyDtuKd2P0JL_We6JBmj25vHN1hEHR-Xx84",
    authDomain: "games-a0cd4.firebaseapp.com",
    projectId: "games-a0cd4",
    storageBucket: "games-a0cd4.firebasestorage.app",
    messagingSenderId: "462520409587",
    appId: "1:462520409587:web:21877e455bb1140a19c686",
  };

  const NAME_MAX = 24;
  // Je Spiel, nicht für alle zusammen: Eine gemeinsame Grenze hiesse, dass ein
  // gut laufendes Spiel mit seinen Einträgen die eines anderen aus der Antwort
  // drängt. Gefragt wird ausserdem ohne Sortierung – das ist eine Abfrage über
  // ein einziges Feld und braucht deshalb keinen zusammengesetzten Index, also
  // keine Datei, die jemand von Hand nach Firebase bringen muss.
  const MAX_JE_SPIEL = 300;
  // Und je Gerät: ein Dokument je Spiel, mehr kann es nicht geben. Die Grenze
  // steht nur da, damit eine kaputte Kennung nicht die halbe Sammlung liest.
  const MAX_JE_SPIELER = 50;

  const zustand = { app: null, db: null, fehler: "" };

  // Die eine Anwendung, die alle benutzen – die Spielseiten für die
  // Bestenliste, der Adminbereich zusätzlich für die Anmeldung. Ein zweites
  // initializeApp mit demselben Namen wirft.
  function app() {
    if (zustand.app || zustand.fehler) return zustand.app;
    const firebase = window.firebase;
    if (!firebase?.initializeApp) {
      zustand.fehler = "Firebase ist nicht geladen.";
      return null;
    }
    try {
      zustand.app = firebase.apps?.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
    } catch (fehler) {
      zustand.fehler = String(fehler?.message || fehler);
      console.warn("Firebase liess sich nicht starten", fehler);
      return null;
    }
    return zustand.app;
  }

  function starte() {
    if (zustand.db) return zustand.db;
    const angemeldet = app();
    if (!angemeldet) return null;
    try {
      zustand.db = window.firebase.firestore(angemeldet);
    } catch (fehler) {
      zustand.fehler = String(fehler?.message || fehler);
      console.warn("Firestore liess sich nicht starten", fehler);
      return null;
    }
    return zustand.db;
  }

  const sammlung = () => starte()?.collection("miniScores") || null;
  const geisterSammlung = () => starte()?.collection("miniGeister") || null;
  // Dieselbe Grenze wie in firestore.rules. Sie steht hier ein zweites Mal,
  // damit eine zu lange Aufzeichnung gar nicht erst hinausgeht – abgewiesen
  // würde sie ohnehin, aber erst nach der Reise.
  const BAHN_MAX = 12000;
  const listenDoc = () => starte()?.doc("config/miniGames") || null;
  const jetztAufDemServer = () => window.firebase?.firestore?.FieldValue?.serverTimestamp?.() || null;

  function lies(doc) {
    const daten = typeof doc?.data === "function" ? doc.data() : null;
    if (!daten) return null;
    const game = String(daten.game || "").trim();
    const name = String(daten.name || "").trim().slice(0, NAME_MAX);
    if (!game || !name) return null;
    return {
      id: doc.id,
      game,
      spieler: String(daten.spieler || ""),
      name,
      punkte: Math.max(0, Math.round(Number(daten.punkte) || 0)),
      versuche: Math.max(1, Math.round(Number(daten.versuche) || 1)),
      updatedAtMs: Number(daten.updatedAtMs) || 0,
    };
  }

  function sauber(wert) {
    return String(wert || "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
  }

  /*
   * Die Ergebnisse der genannten Spiele.
   *
   * Eine Abfrage je Spiel, und ein Spiel, das nicht antwortet, wirft die
   * anderen nicht um: Die Liste kommt dann ohne dieses eine – besser als eine
   * leere Seite.
   */
  async function ergebnisse(spiele = []) {
    const ref = sammlung();
    const ids = [...new Set((Array.isArray(spiele) ? spiele : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean))];
    if (!ref || !ids.length) return [];

    const antworten = await Promise.all(ids.map((id) => ref
      .where("game", "==", id)
      .limit(MAX_JE_SPIEL)
      .get()
      .catch((fehler) => {
        console.warn(`Die Bestenliste von ${id} konnte nicht gelesen werden`, fehler);
        return null;
      })));

    const liste = [];
    antworten.forEach((schnappschuss) => {
      if (!schnappschuss) return;
      schnappschuss.forEach((doc) => {
        const eintrag = lies(doc);
        if (eintrag) liste.push(eintrag);
      });
    });
    return liste;
  }

  /*
   * Welche Spiele offen sind.
   *
   * Eine Liste, ein Dokument. Gesetzt wird sie im Adminbereich, gelesen von
   * der Startseite. Gibt es das Dokument nicht, kommt null zurück – und das
   * heisst nicht "keine", sondern "es wurde nie etwas ausgewählt". Was dann
   * gilt, entscheidet mini-games.js: alle.
   */
  async function offeneSpiele() {
    const doc = listenDoc();
    if (!doc) return null;
    const stand = await doc.get();
    if (!stand.exists) return null;
    const liste = stand.data()?.spiele;
    if (!Array.isArray(liste)) return null;
    return liste.map((id) => String(id || "").trim()).filter(Boolean);
  }

  /*
   * Und sie setzen. Nur der Adminbereich ruft das auf, und nur er darf es –
   * die Regeln prüfen die Anmeldung und dass jeder Name zu einem Spiel
   * gehört, das es gibt.
   */
  async function setzeOffeneSpiele(spiele) {
    const doc = listenDoc();
    if (!doc) throw new Error("Firestore ist nicht bereit.");
    const liste = [...new Set((Array.isArray(spiele) ? spiele : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean))];
    await doc.set({ spiele: liste, updatedAtMs: Date.now(), updatedAt: jetztAufDemServer() });
    return liste;
  }

  /*
   * Eine Runde ist zu Ende.
   *
   * Zwei Dinge stehen im selben Dokument und folgen verschiedenen Regeln: Die
   * Punktzahl ist ein Bestwert – sie steigt oder bleibt –, die Versuche sind
   * ein Zähler und steigen immer. Beides hängt davon ab, was schon dasteht,
   * also muss erst gelesen und dann geschrieben werden.
   *
   * Und zwar in einer Transaktion. Zwei Tabs desselben Spiels, zwei Runden,
   * die kurz nacheinander enden: Ohne Transaktion lesen beide denselben alten
   * Stand. Die schlechtere Runde hielte sich dann für einen Rekord und wollte
   * die eben eingetragene Bestzahl überschreiben – die Regeln weisen das ab
   * (Punkte fallen nie), der Spieler sähe "hat nicht geklappt", und seine
   * Runde wäre nicht gezählt. Beim allerersten Eintrag dasselbe in Grün:
   * Zwei Anlagen mit versuche = 1, eine davon abgewiesen.
   *
   * In der Transaktion liest Firestore noch einmal, wenn dazwischen jemand
   * geschrieben hat, und rechnet gegen den frischen Stand.
   */
  async function speichere({ game, spieler, name, punkte }) {
    const spielId = String(game || "").trim();
    const spielerId = String(spieler || "").trim();
    const wie = sauber(name);
    const zahl = Math.max(0, Math.min(1000000, Math.round(Number(punkte) || 0)));
    if (!spielId || !spielerId || !wie) throw new Error("Für einen Eintrag fehlt etwas.");
    const db = starte();
    const ref = sammlung();
    if (!db || !ref) throw new Error("Firestore ist nicht bereit.");

    const doc = ref.doc(`${spielId}_${spielerId}`);
    return db.runTransaction(async (lauf) => {
      const vorher = await lauf.get(doc);
      const alt = vorher.exists ? lies(vorher) : null;
      const jetzt = Date.now();

      if (!alt) {
        lauf.set(doc, {
          game: spielId,
          spieler: spielerId,
          name: wie,
          punkte: zahl,
          versuche: 1,
          erstesMs: jetzt,
          updatedAtMs: jetzt,
          updatedAt: jetztAufDemServer(),
        });
        return { rekord: true, punkte: zahl, versuche: 1 };
      }

      const rekord = zahl > alt.punkte;
      lauf.set(doc, {
        name: wie,
        punkte: rekord ? zahl : alt.punkte,
        versuche: alt.versuche + 1,
        updatedAtMs: jetzt,
        updatedAt: jetztAufDemServer(),
      }, { merge: true });
      return { rekord, punkte: rekord ? zahl : alt.punkte, versuche: alt.versuche + 1 };
    });
  }

  /*
   * Ein neuer Name, ohne dass eine Runde daraus wird.
   *
   * Ohne diesen Weg müsste sich ein Umbenennen als Runde verkleiden – und wer
   * nach einer Runde auf "Name ändern" tippt, hätte danach zwei Versuche für
   * ein Spiel. Die Regeln lassen deshalb eine Änderung zu, die nur den Namen
   * anfasst.
   *
   * Umbenannt wird in ALLEN Spielen, nicht nur in dem, das gerade offen ist.
   * Der Name gehört dem Gerät, und die Hall of Fame fasst nach Namen zusammen
   * (mini-games.js, verdichte): Bliebe in Turmbau "Jonas" stehen, während im
   * Fischteich schon "Jonas K." steht, stünde derselbe Mensch zweimal in der
   * Tabelle – bis er jedes alte Spiel noch einmal spielt.
   *
   * Ein Gerät hat höchstens ein Dokument je Spiel, also eine Handvoll. Sie
   * gehen in einem Zug hinaus: entweder alle oder keines.
   */
  async function benenneUm({ spieler, name }) {
    const spielerId = String(spieler || "").trim();
    const wie = sauber(name);
    if (!spielerId || !wie) throw new Error("Für einen neuen Namen fehlt etwas.");
    const db = starte();
    const ref = sammlung();
    if (!db || !ref) throw new Error("Firestore ist nicht bereit.");

    // Eine Abfrage über ein einziges Feld – kein zusammengesetzter Index.
    const meine = await ref.where("spieler", "==", spielerId).limit(MAX_JE_SPIELER).get();
    // Noch kein Eintrag: Dann gibt es auch nichts umzubenennen – der Name gilt
    // ab der nächsten Runde.
    if (meine.empty) return null;

    const jetzt = Date.now();
    const stapel = db.batch();
    let geaendert = 0;
    meine.forEach((doc) => {
      const alt = lies(doc);
      if (!alt || alt.name === wie) return;
      stapel.set(doc.ref, { name: wie, updatedAtMs: jetzt, updatedAt: jetztAufDemServer() }, { merge: true });
      geaendert += 1;
    });
    if (geaendert) await stapel.commit();
    return { spiele: meine.size, geaendert };
  }

  /*
   * Die Aufzeichnung eines Laufs.
   *
   * Ein Dokument je Spiel und Spieler, überschrieben, sobald jemand besser
   * war als er selbst. Keine Transaktion wie bei der Bestenliste: Hier hängt
   * nichts vom alten Stand ab – geschrieben wird der ganze Lauf oder keiner,
   * und die Regeln lassen nur den besseren durch. Zwei Tabs nacheinander
   * bedeuten hier schlimmstenfalls, dass der schwächere abgewiesen wird, und
   * das ist genau richtig.
   */
  async function speichereGeist({ game, spieler, name, punkte, level, bahn }) {
    const spielId = String(game || "").trim();
    const spielerId = String(spieler || "").trim();
    const wie = sauber(name);
    const fassung = String(level || "").trim().slice(0, 16);
    const strecke = String(bahn || "");
    const zahl = Math.max(0, Math.min(1000000, Math.round(Number(punkte) || 0)));
    if (!spielId || !spielerId || !wie || !fassung || !strecke) return null;
    if (strecke.length > BAHN_MAX) {
      console.warn(`Die Aufzeichnung ist ${strecke.length} Zeichen lang, erlaubt sind ${BAHN_MAX}.`);
      return null;
    }
    const ref = geisterSammlung();
    if (!ref) return null;
    const jetzt = Date.now();
    await ref.doc(`${spielId}_${spielerId}`).set({
      game: spielId,
      spieler: spielerId,
      name: wie,
      punkte: zahl,
      level: fassung,
      bahn: strecke,
      updatedAtMs: jetzt,
      updatedAt: jetztAufDemServer(),
    });
    return { punkte: zahl };
  }

  /*
   * Die Aufzeichnungen der genannten Spieler.
   *
   * Gefragt wird nach Dokumentnamen, einer je Spieler – das ist keine Abfrage
   * und braucht deshalb keinen Index. Wer nichts hinterlassen hat, fehlt
   * einfach; ein Spiel ohne Geister ist ein Spiel, und keine leere Seite.
   */
  async function geister(game, spieler = [], level = "") {
    const spielId = String(game || "").trim();
    const fassung = String(level || "").trim();
    const ids = [...new Set((Array.isArray(spieler) ? spieler : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean))].slice(0, 10);
    const ref = geisterSammlung();
    if (!ref || !spielId || !ids.length) return [];

    const stände = await Promise.all(ids.map((id) => ref.doc(`${spielId}_${id}`).get()
      .catch((fehler) => {
        console.warn(`Der Geist von ${id} konnte nicht gelesen werden`, fehler);
        return null;
      })));

    const liste = [];
    stände.forEach((doc) => {
      if (!doc?.exists) return;
      const daten = doc.data() || {};
      const bahn = String(daten.bahn || "");
      const gehoert = String(daten.level || "");
      if (!bahn) return;
      // Ein Geist aus einer anderen Fassung des Levels liefe durch Wände.
      if (fassung && gehoert !== fassung) return;
      liste.push({
        spieler: String(daten.spieler || ""),
        name: String(daten.name || "").trim().slice(0, NAME_MAX),
        punkte: Math.max(0, Math.round(Number(daten.punkte) || 0)),
        level: gehoert,
        bahn,
      });
    });
    return liste;
  }

  // ---------------------------------------------------------------------------
  // Turniere
  // ---------------------------------------------------------------------------
  const TURNIER_NAME_MAX = 60;
  const BESCHREIBUNG_MAX = 600;
  // Höher als in miniScores: Mit "alle Versuche zusammen" wächst die Zahl mit
  // jedem Versuch.
  const TURNIER_PUNKTE_MAX = 10000000;
  const MAX_TURNIERE = 100;
  const MAX_JE_TURNIER = 3000;

  const turnierSammlung = () => starte()?.collection("miniTurniere") || null;
  function turnierEintraege(id) {
    const ref = turnierSammlung();
    const kennung = String(id || "").trim();
    return ref && kennung ? ref.doc(kennung).collection("eintraege") : null;
  }

  // Ein Turnier, so wie der Rest es braucht. Was fehlt oder nicht passt, wird
  // zum freundlichen Wert – bis auf das, ohne das es kein Turnier ist: Name,
  // Spiele, Ende.
  function liesTurnier(doc) {
    const d = typeof doc?.data === "function" ? doc.data() : null;
    if (!d) return null;
    const name = String(d.name || "").trim().slice(0, TURNIER_NAME_MAX);
    const spiele = [...new Set((Array.isArray(d.spiele) ? d.spiele : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean))];
    const endeMs = Math.round(Number(d.endeMs) || 0);
    if (!name || !spiele.length || !endeMs) return null;
    return {
      id: doc.id,
      name,
      beschreibung: String(d.beschreibung || "").trim().slice(0, BESCHREIBUNG_MAX),
      spiele,
      startMs: Math.round(Number(d.startMs) || 0),
      endeMs,
      versuche: Math.max(0, Math.round(Number(d.versuche) || 0)),
      zaehlt: d.zaehlt === "summe" ? "summe" : "bester",
      wertung: d.wertung === "prozent" ? "prozent" : "platz",
      aufgaben: d.aufgaben === "zufall" ? "zufall" : "gleich",
      sichtbar: d.sichtbar === "alle" ? "alle" : "link",
      verdeckt: d.verdeckt === true,
      aktiv: d.aktiv !== false,
      erstelltMs: Math.round(Number(d.erstelltMs) || 0),
      updatedAtMs: Math.round(Number(d.updatedAtMs) || 0),
    };
  }

  function liesTurnierEintrag(doc) {
    const eintrag = lies(doc);
    if (!eintrag) return null;
    return { ...eintrag, offen: doc.data()?.offen === true };
  }

  // Ein Turnier, über seinen Namen. Das darf jeder, der ihn kennt – auch bei
  // einem, das nur über den Link zu finden ist.
  //
  // null heisst "gibt es nicht". Ist Firestore gar nicht da, ist das keine
  // Antwort, sondern ein Fehler – sonst sähe ein Gerät ohne Netz ein
  // gelöschtes Turnier, wo nur die Verbindung fehlt.
  async function turnier(id) {
    const ref = turnierSammlung();
    const kennung = String(id || "").trim();
    if (!kennung) return null;
    if (!ref) throw new Error("Firestore ist nicht bereit.");
    const stand = await ref.doc(kennung).get();
    return stand.exists ? liesTurnier(stand) : null;
  }

  function sammle(schnappschuss, lesen) {
    const liste = [];
    schnappschuss.forEach((doc) => {
      const ding = lesen(doc);
      if (ding) liste.push(ding);
    });
    return liste;
  }

  /*
   * Die Turniere für die Startseite.
   *
   * Gefragt wird ausdrücklich nur nach den öffentlichen – die Regeln lassen
   * eine Abfrage ohne diese Bedingung gar nicht zu, auch wenn zufällig nur
   * öffentliche darin stünden. Was davon gerade läuft, sortiert turnier.js:
   * Eine zweite Bedingung (endeMs > jetzt) bräuchte einen zusammengesetzten
   * Index, und öffentliche Turniere gibt es ohnehin nur eine Handvoll.
   */
  async function oeffentlicheTurniere() {
    const ref = turnierSammlung();
    if (!ref) return [];
    return sammle(await ref.where("sichtbar", "==", "alle").limit(MAX_TURNIERE).get(), liesTurnier);
  }

  // Alle, auch die nur mit Link. Das darf nur der Admin.
  async function alleTurniere() {
    const ref = turnierSammlung();
    if (!ref) throw new Error("Firestore ist nicht bereit.");
    return sammle(await ref.limit(MAX_TURNIERE).get(), liesTurnier);
  }

  // Anlegen und ändern ist dasselbe: das ganze Dokument, nicht ein Stück
  // davon. Die Regeln prüfen jedes Feld; ein halbes Turnier gibt es nicht.
  async function setzeTurnier(id, daten) {
    const ref = turnierSammlung();
    const kennung = String(id || "").trim();
    if (!ref || !kennung) throw new Error("Firestore ist nicht bereit.");
    const doc = {
      name: String(daten.name || "").trim().slice(0, TURNIER_NAME_MAX),
      spiele: [...new Set((daten.spiele || []).map((s) => String(s || "").trim()).filter(Boolean))],
      startMs: Math.round(Number(daten.startMs) || 0),
      endeMs: Math.round(Number(daten.endeMs) || 0),
      versuche: Math.max(0, Math.min(100, Math.round(Number(daten.versuche) || 0))),
      zaehlt: daten.zaehlt === "summe" ? "summe" : "bester",
      wertung: daten.wertung === "prozent" ? "prozent" : "platz",
      aufgaben: daten.aufgaben === "zufall" ? "zufall" : "gleich",
      sichtbar: daten.sichtbar === "alle" ? "alle" : "link",
      verdeckt: daten.verdeckt === true,
      aktiv: daten.aktiv !== false,
      erstelltMs: Math.round(Number(daten.erstelltMs) || Date.now()),
      updatedAtMs: Date.now(),
      updatedAt: jetztAufDemServer(),
    };
    const beschreibung = String(daten.beschreibung || "").trim().slice(0, BESCHREIBUNG_MAX);
    if (beschreibung) doc.beschreibung = beschreibung;
    await ref.doc(kennung).set(doc);
    return liesTurnier({ id: kennung, data: () => doc });
  }

  /*
   * Ein Turnier weg, samt seiner Einträge.
   *
   * Erst die Einträge, dann das Turnier. Firestore räumt eine Untersammlung
   * nicht von selbst mit weg – andersherum blieben Einträge liegen, zu denen
   * es kein Turnier mehr gibt und die deshalb niemand mehr sieht. Und
   * aufräumen kann man nur, was man sieht.
   */
  async function loescheTurnier(id) {
    const db = starte();
    const ref = turnierSammlung();
    const eintraege = turnierEintraege(id);
    if (!db || !ref || !eintraege) throw new Error("Firestore ist nicht bereit.");
    for (let runde = 0; runde < 50; runde += 1) {
      const stapel = await eintraege.limit(400).get();
      if (stapel.empty) break;
      const weg = db.batch();
      stapel.forEach((doc) => weg.delete(doc.ref));
      await weg.commit();
    }
    await ref.doc(String(id)).delete();
  }

  // Die Liste eines Turniers, auf Wunsch nur die eines Spiels – eine Abfrage
  // über ein einziges Feld, ohne zusammengesetzten Index.
  async function turnierErgebnisse(id, { game = "" } = {}) {
    const ref = turnierEintraege(id);
    if (!ref) throw new Error("Firestore ist nicht bereit.");
    const spielId = String(game || "").trim();
    const frage = spielId ? ref.where("game", "==", spielId) : ref;
    return sammle(await frage.limit(MAX_JE_TURNIER).get(), liesTurnierEintrag);
  }

  // Der eigene Stand in einem Spiel: wie viele Versuche schon weg sind.
  async function meinTurnierEintrag(id, { game, spieler }) {
    const ref = turnierEintraege(id);
    const spielId = String(game || "").trim();
    const spielerId = String(spieler || "").trim();
    if (!ref || !spielId || !spielerId) return null;
    const stand = await ref.doc(`${spielId}_${spielerId}`).get();
    return stand.exists ? liesTurnierEintrag(stand) : null;
  }

  function turnierFehler(text, code) {
    const fehler = new Error(text);
    fehler.code = code;
    return fehler;
  }

  /*
   * Ein Versuch beginnt.
   *
   * Gezählt wird jetzt und nicht erst am Ende der Runde: Wer eine schlechte
   * Runde kommen sieht und neu lädt, hat den Versuch trotzdem gebraucht. Die
   * Punkte bleiben dabei stehen, wie sie sind – das Ergebnis kommt mit
   * turnierErgebnis.
   *
   * In einer Transaktion, aus demselben Grund wie speichere(): Zwei Tabs, die
   * gleichzeitig beginnen, zählten sonst beide von derselben Zahl aus hoch,
   * und einer der beiden Versuche ginge verloren.
   */
  async function turnierVersuch(id, { game, spieler, name, grenze = 0 }) {
    const spielId = String(game || "").trim();
    const spielerId = String(spieler || "").trim();
    const wie = sauber(name);
    if (!spielId || !spielerId || !wie) throw new Error("Für einen Versuch fehlt etwas.");
    const db = starte();
    const ref = turnierEintraege(id);
    if (!db || !ref) throw new Error("Firestore ist nicht bereit.");

    const doc = ref.doc(`${spielId}_${spielerId}`);
    return db.runTransaction(async (lauf) => {
      const vorher = await lauf.get(doc);
      const alt = vorher.exists ? liesTurnierEintrag(vorher) : null;
      const versuche = (alt?.versuche || 0) + 1;
      if (grenze > 0 && versuche > grenze) throw turnierFehler("Alle Versuche sind gespielt.", "turnier/keine-versuche");
      const jetzt = Date.now();
      if (!alt) {
        lauf.set(doc, {
          game: spielId,
          spieler: spielerId,
          name: wie,
          punkte: 0,
          versuche: 1,
          offen: true,
          erstesMs: jetzt,
          updatedAtMs: jetzt,
          updatedAt: jetztAufDemServer(),
        });
      } else {
        lauf.set(doc, { name: wie, versuche, offen: true, updatedAtMs: jetzt, updatedAt: jetztAufDemServer() }, { merge: true });
      }
      return { versuche, punkte: alt?.punkte || 0 };
    });
  }

  /*
   * Der Versuch ist zu Ende: sein Ergebnis, genau einmal.
   *
   *   bester   es bleibt die grösste Zahl
   *   summe    die Zahl kommt dazu
   *
   * Ohne offenen Versuch gibt es nichts einzutragen – dann wurde er nie
   * angemeldet, oder sein Ergebnis steht schon da.
   */
  async function turnierErgebnis(id, { game, spieler, name, punkte, zaehlt = "bester" }) {
    const spielId = String(game || "").trim();
    const spielerId = String(spieler || "").trim();
    const wie = sauber(name);
    const zahl = Math.max(0, Math.min(1000000, Math.round(Number(punkte) || 0)));
    if (!spielId || !spielerId || !wie) throw new Error("Für ein Ergebnis fehlt etwas.");
    const db = starte();
    const ref = turnierEintraege(id);
    if (!db || !ref) throw new Error("Firestore ist nicht bereit.");

    const doc = ref.doc(`${spielId}_${spielerId}`);
    return db.runTransaction(async (lauf) => {
      const vorher = await lauf.get(doc);
      const alt = vorher.exists ? liesTurnierEintrag(vorher) : null;
      if (!alt?.offen) throw turnierFehler("Zu dieser Runde gibt es keinen angemeldeten Versuch.", "turnier/kein-versuch");
      const summe = zaehlt === "summe";
      const neu = summe ? Math.min(TURNIER_PUNKTE_MAX, alt.punkte + zahl) : Math.max(alt.punkte, zahl);
      lauf.set(doc, { name: wie, punkte: neu, offen: false, updatedAtMs: Date.now(), updatedAt: jetztAufDemServer() }, { merge: true });
      return {
        punkte: neu,
        runde: zahl,
        versuche: alt.versuche,
        // Ein Rekord ist nur, was einen früheren Versuch schlägt – beim
        // ersten gibt es keinen, und bei der Summe wächst die Zahl ohnehin.
        rekord: !summe && alt.versuche > 1 && zahl > alt.punkte,
      };
    });
  }

  // Ein neuer Name, in allen Spielen dieses Turniers – aus demselben Grund
  // wie benenneUm(): Die Rangliste fasst nach Namen zusammen, und ein alter
  // Name in einem Spiel wäre ein zweiter Spieler.
  async function turnierUmbenennen(id, { spieler, name }) {
    const spielerId = String(spieler || "").trim();
    const wie = sauber(name);
    const db = starte();
    const ref = turnierEintraege(id);
    if (!spielerId || !wie || !db || !ref) return null;
    const meine = await ref.where("spieler", "==", spielerId).limit(MAX_JE_SPIELER).get();
    if (meine.empty) return null;
    const jetzt = Date.now();
    const stapel = db.batch();
    let geaendert = 0;
    meine.forEach((doc) => {
      const alt = lies(doc);
      if (!alt || alt.name === wie) return;
      stapel.set(doc.ref, { name: wie, updatedAtMs: jetzt, updatedAt: jetztAufDemServer() }, { merge: true });
      geaendert += 1;
    });
    if (geaendert) await stapel.commit();
    return { spiele: meine.size, geaendert };
  }

  // app und db für den Adminbereich: Er meldet jemanden an und liest und
  // löscht dieselben Einträge, braucht dafür aber keinen zweiten Client.
  window.MiniCloud = {
    app,
    db: starte,
    projektId: firebaseConfig.projectId,
    ergebnisse, speichere, benenneUm, lies,
    speichereGeist, geister,
    offeneSpiele, setzeOffeneSpiele,
    turnier, oeffentlicheTurniere, alleTurniere, setzeTurnier, loescheTurnier,
    turnierErgebnisse, meinTurnierEintrag, turnierVersuch, turnierErgebnis, turnierUmbenennen,
    MAX_JE_SPIEL, MAX_JE_SPIELER, NAME_MAX, BAHN_MAX,
    TURNIER_NAME_MAX, BESCHREIBUNG_MAX,
  };
})();
