/*
 * cloud.js – Die Bestenliste, und sonst nichts.
 * ---------------------------------------------------------------------------
 * Die Mini-Games haben keine Konten. Wer hier spielt, hat einen Link
 * angeklickt, tippt einen Namen ein und steht in der Liste – mehr passiert
 * nicht, und mehr kann diese Datei auch nicht.
 *
 * Das ist der Unterschied zur App: Dort führt firebase.js Konten, Kinder,
 * Gruppen, Käufe, Fortschritt und den Adminbereich – zweihundert Kilobyte,
 * von denen hier kein Byte gebraucht wird. Übrig bleibt eine Sammlung,
 * miniScores, und drei Handgriffe darauf.
 *
 * Ohne Anmeldung heisst wörtlich ohne: Kein firebase-auth, kein anonymes
 * Konto, kein request.auth. Die Regeln (firestore.rules im App-Repository,
 * Abschnitt "Die Bestenliste der Mini-Games") prüfen deshalb nicht, WER
 * schreibt, sondern WAS geschrieben wird – ein Dokument je Spiel und Spieler,
 * Punkte fallen nie, Versuche zählen nur hoch. Beide Adressen schreiben in
 * dieselbe Sammlung desselben Firebase-Projekts: Wer in der App ein
 * Mini-Game gespielt hat, steht hier in derselben Liste.
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

  // Derselbe Schlüssel wie in der App – es ist dasselbe Firebase-Projekt und
  // dieselbe Sammlung. Ein Web-API-Schlüssel ist kein Geheimnis: Er steht in
  // jeder Seite, die Firebase im Browser nutzt, und geschützt wird durch die
  // Regeln, nicht durch ihn.
  const firebaseConfig = {
    apiKey: "AIzaSyDJKaBS1W-EU6d8N3pL2R4amSl8R0vD-Uc",
    authDomain: "lernapp-8d944.firebaseapp.com",
    projectId: "lernapp-8d944",
    storageBucket: "lernapp-8d944.firebasestorage.app",
    messagingSenderId: "123146993935",
    appId: "1:123146993935:web:8843f8c35e9a2a4b4e3e7a",
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

  const zustand = { db: null, fehler: "" };

  function starte() {
    if (zustand.db || zustand.fehler) return zustand.db;
    const firebase = window.firebase;
    if (!firebase?.initializeApp) {
      zustand.fehler = "Firebase ist nicht geladen.";
      return null;
    }
    try {
      const app = firebase.apps?.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
      zustand.db = firebase.firestore(app);
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

  window.MiniCloud = { ergebnisse, speichere, benenneUm, MAX_JE_SPIEL, MAX_JE_SPIELER, NAME_MAX };
})();
