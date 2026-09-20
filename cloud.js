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

  // app und db für den Adminbereich: Er meldet jemanden an und liest und
  // löscht dieselben Einträge, braucht dafür aber keinen zweiten Client.
  window.MiniCloud = {
    app,
    db: starte,
    projektId: firebaseConfig.projectId,
    ergebnisse, speichere, benenneUm, lies,
    MAX_JE_SPIEL, MAX_JE_SPIELER, NAME_MAX,
  };
})();
