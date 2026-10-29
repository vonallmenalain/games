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
 *     spielMs    412000           wie lange, alle Runden zusammen (ältere
 *                                 Einträge haben das Feld nicht)
 *     erstesMs / updatedAtMs      Uhrzeiten, für die Reihenfolge bei
 *                                 Gleichstand
 *
 * Das sind Summen: Wann gespielt wurde, steht dort nicht. Deshalb hält jede
 * Runde, die dort zählt, zusätzlich ein eigenes Dokument fest – in derselben
 * Transaktion (speichere), also genau die Runden, die in miniScores zählen,
 * auch die aus einem Turnier oder einem Multiplayer:
 *
 *   miniRunden/towerStack_mini_a7f3…_7
 *     game / spieler / name       wie im Eintrag
 *     nr         7                die wievielte Runde dieses Eintrags – der
 *                                 Zähler versuche nach ihr; daher der Name
 *     punkte     38               was diese Runde brachte
 *     ms         52000            wie lange sie dauerte (höchstens 30 min)
 *     zeitMs     1761473400000    wann sie zu Ende war
 *     offline    true             ohne Netz gespielt und später hochgeladen
 *                                 (mini-games.js, sendeWartende); zeitMs ist
 *                                 dann die Zeit der Runde. Fehlt sonst.
 *     quelle     "turnier"        oder "live" (Multiplayer); fehlt bei einer
 *                                 Runde auf der Spielseite selbst
 *
 * Lesen darf sie nur der Admin: Er fragt damit, wer in einem Zeitraum was
 * gespielt hat (admin.js, Zeitraum). Was vor dieser Sammlung gespielt wurde,
 * steht nur in den Summen.
 *
 * Und welche Spiele offen sind und wie der Admin sie einteilt:
 *
 *   config/miniGames
 *     spiele     ["towerStack", …]   was auf der Startseite steht
 *     tiers      { towerStack: 1 }    Tier 1, 2 oder 3 je Spiel (admin.js).
 *                                     Fehlt, wo nie eingeteilt wurde.
 *
 * Und die Aufzeichnung des besten Laufs, für die, die gegen ihn spielen
 * (geist.js):
 *
 *   miniGeister/<spiel>_mini_a7f3…
 *     game / spieler / name       dieselben wie nebenan
 *     punkte     742              die Runde, aus der die Aufzeichnung stammt
 *     level      "t1"             welche Fassung; ein Geist aus einer
 *                                 anderen ist hier sinnlos
 *     bahn       "AAEC…"          wo der Läufer wann war, als Text
 *
 * Eine eigene Sammlung, weil die Startseite JEDES Punkte-Dokument liest, um
 * die Hall of Fame zu bauen. Lägen die Aufzeichnungen dort, lüde jeder Besuch
 * der Startseite ein paar Kilobyte je Spieler mit, die dort niemand ansieht.
 *
 * Und wohin eine Kennung gezogen ist, die der Adminbereich zusammengeführt
 * hat (umzug, setzeUmzuege – nur der Admin schreibt):
 *
 *   miniUmzuege/mini_a7f3…
 *     nach       "mini_k2p9…"     unter dieser Kennung geht es weiter
 *     name       "Efraim"         unter diesem Namen
 *
 * Und die Turniere, jedes mit seiner eigenen kleinen Bestenliste:
 *
 *   miniTurniere/herbstcup-k3m9x2p7
 *     name, beschreibung          was auf der Turnierseite steht
 *     spiele     ["towerStack"]   was dazugehört
 *     startMs / endeMs            wann es läuft
 *     versuche   3                je Spiel; 0 heisst unbegrenzt
 *     spitzeWartet true           nur bei 0: wer in einem Spiel allein vorne
 *                                 liegt, wartet dort – siehe turnier.js.
 *                                 Fehlt bei allen anderen.
 *     zaehlt     "bester"         oder "summe": alle Versuche zusammen
 *     wertung    "platz"          oder "prozent" – siehe turnier.js
 *     aufgaben   "gleich"         oder "zufall", oder "wieErster": immer
 *                                 derselbe Lauf – siehe turnier.js
 *     sichtbar   "alle"           oder "link": nur, wer den Link hat
 *     verdeckt   false            Rangliste erst am Schluss zeigen
 *     ohneGeist  true             keine Gegner beim Spielen (geist.js).
 *                                 Fehlt, wo sie gezeigt werden.
 *     ohneReplay true             die besten Läufe lassen sich nicht
 *                                 anschauen (der ▶ in den Listen). Fehlt,
 *                                 wo sie sich anschauen lassen.
 *     nurLive    true             gespielt wird nur im Multiplayer
 *                                 (live.js), keine Versuche dazwischen.
 *                                 Fehlt bei allen anderen.
 *     aktiv      true             angehalten, wenn false
 *
 *   miniTurniere/<id>/eintraege/towerStack_mini_a7f3…
 *     game / spieler / name       wie in miniScores
 *     punkte     42               der beste Versuch oder die Summe
 *     versuche   2                wie viele begonnen wurden
 *     offen      false            ob gerade einer läuft, dessen Ergebnis
 *                                 noch aussteht
 *
 *   miniTurniere/<id>/geister/towerStack_mini_a7f3…
 *     wie miniGeister: der beste einzelne Lauf eines Spielers in diesem
 *     Turnier, für den, der gegen ihn spielt
 *
 *   miniTurniere/<id>/live/K7QM-1760368000000
 *     der Endstand eines Multiplayers, der zum Turnier gehört (live.js):
 *     name, gewicht (0–3), endstand [{ spieler, name, punkte, platz }],
 *     runden, spiele, erstelltMs. Nur der Admin schreibt ihn.
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
    // Die Realtime Database, nur für den Live-Modus (live.js). Die Seiten
    // ohne Live laden ihr SDK gar nicht erst.
    databaseURL: "https://games-a0cd4-default-rtdb.europe-west1.firebasedatabase.app",
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
  // Und je Name: ein Dokument je Spiel und Gerät, auf dem er eingetragen ist.
  const MAX_JE_NAMEN = 200;

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
  const rundenSammlung = () => starte()?.collection("miniRunden") || null;
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
      erstesMs: Number(daten.erstesMs) || 0,
      spielMs: Math.max(0, Math.round(Number(daten.spielMs) || 0)),
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

    // Ohne Netz antwortet Firestore aus seinem Zwischenspeicher – und der ist
    // hier leer: Eine leere Liste sähe aus wie «noch niemand gespielt». Eine
    // Antwort von dort zählt deshalb nicht; antwortet kein Spiel vom Server,
    // wirft es, und mini-games.js nimmt, was es zuletzt gesehen hat
    // (alleErgebnisse).
    const antworten = await Promise.all(ids.map((id) => ref
      .where("game", "==", id)
      .limit(MAX_JE_SPIEL)
      .get()
      .then((schnappschuss) => (schnappschuss?.metadata?.fromCache ? null : schnappschuss))
      .catch((fehler) => {
        console.warn(`Die Bestenliste von ${id} konnte nicht gelesen werden`, fehler);
        return null;
      })));
    if (!antworten.some(Boolean)) throw Object.assign(new Error("Die Bestenliste ist gerade nicht zu haben."), { code: "unavailable" });

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
    // merge: Die Tiers im selben Dokument bleiben, wie sie sind – bis auf
    // die von Spielen, die es nicht mehr gibt (ohneAlteSpiele).
    const daten = { spiele: liste, updatedAtMs: Date.now(), updatedAt: jetztAufDemServer() };
    await doc.set(ohneAlteSpiele(await doc.get(), daten), { merge: true });
    return liste;
  }

  /*
   * Ein Spiel, das es nicht mehr gibt (wie der Wellenreiter), kann noch in
   * den gespeicherten Tiers stehen. Die Regeln lassen dort nur Spiele zu, die
   * es gibt (firestore.rules, istSpieleListe) – und merge liesse seinen
   * Schlüssel stehen: Jedes weitere Speichern scheiterte daran, auch nur ein
   * Haken. Darum fällt er im selben Schreiben weg. Welche Spiele es gibt,
   * weiss mini-games.js (SPIELE); fehlt es, bleibt alles, wie es ist.
   */
  function ohneAlteSpiele(stand, daten) {
    const bekannt = window.LernappMini?.SPIELE;
    const alt = stand?.exists ? stand.data()?.tiers : null;
    const loeschen = window.firebase?.firestore?.FieldValue?.delete;
    if (!Array.isArray(bekannt) || !bekannt.length || !alt || typeof alt !== "object" || !loeschen) return daten;
    const ids = new Set(bekannt.map((s) => s.id));
    const weg = Object.keys(alt).filter((id) => !ids.has(id));
    if (!weg.length) return daten;
    const tiers = { ...(daten.tiers || {}) };
    weg.forEach((id) => { tiers[id] = window.firebase.firestore.FieldValue.delete(); });
    return { ...daten, tiers };
  }

  /*
   * Die Tiers: wie der Admin die Spiele einteilt (admin.js) – je Spiel 1, 2
   * oder 3, im selben Dokument wie die offenen Spiele. null heisst: nie
   * eingeteilt, es gilt die Vorgabe (mini-games.js, TIERS_VORGABE).
   */
  async function tiers() {
    const doc = listenDoc();
    if (!doc) return null;
    const stand = await doc.get();
    const roh = stand.exists ? stand.data()?.tiers : null;
    if (!roh || typeof roh !== "object") return null;
    const raus = {};
    Object.entries(roh).forEach(([spiel, tier]) => {
      if ([1, 2, 3].includes(Number(tier))) raus[String(spiel)] = Number(tier);
    });
    return raus;
  }

  // Und sie setzen. offen: die Liste der offenen Spiele, falls es das Dokument
  // noch nicht gibt – die Regeln verlangen sie, und «nie ausgewählt» hiesse
  // ohnehin «alle».
  async function setzeTiers(einteilung, offen = []) {
    const doc = listenDoc();
    if (!doc) throw new Error("Firestore ist nicht bereit.");
    const sauber = {};
    Object.entries(einteilung || {}).forEach(([spiel, tier]) => {
      const id = String(spiel || "").trim();
      if (id && [1, 2, 3].includes(Number(tier))) sauber[id] = Number(tier);
    });
    const daten = { tiers: sauber, updatedAtMs: Date.now(), updatedAt: jetztAufDemServer() };
    const stand = await doc.get();
    if (!stand.exists || !Array.isArray(stand.data()?.spiele)) {
      daten.spiele = [...new Set((offen || []).map((id) => String(id || "").trim()).filter(Boolean))];
    }
    await doc.set(ohneAlteSpiele(stand, daten), { merge: true });
    return sauber;
  }

  /*
   * Eine zweite Anwendung ohne gespeicherte Anmeldung – für die Google-
   * Anmeldung der Netlify-Vorschauen (admin.js, vorschau). Die Anmeldung des
   * Adminbereichs auf der Live-Adresse bleibt davon unberührt.
   */
  function vorschauApp() {
    const firebase = window.firebase;
    if (!firebase?.initializeApp) return null;
    const name = "vorschau-anmeldung";
    return (firebase.apps || []).find((a) => a.name === name) || firebase.initializeApp(firebaseConfig, name);
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
   *
   * Im selben Zug geht die Runde selbst ins Protokoll (miniRunden): unter
   * ihrer Nummer, dem Zähler nach dieser Runde. Die Regeln lassen sie nur
   * zu, wenn der Eintrag daneben genau um diese Runde wächst – so steht dort
   * jede Runde, die in miniScores zählt, und keine andere.
   *
   * Eine Runde ohne Netz (mini-games.js, sendeWartende) kommt später: mit
   * offline und der Uhrzeit, zu der sie zu Ende war (zeitMs), und woher sie
   * kam (quelle). Sie steht dann im Protokoll zu ihrer Zeit, nicht zu der
   * des Hochladens – die Regeln lassen dafür bis zu 30 Tage zurück zu.
   */
  // Die Dauer einer Runde zählt zur Spielzeit des Eintrags (spielMs) – nie
  // mehr als eine halbe Stunde: So viel lassen die Regeln je Runde zu.
  const RUNDE_MS = 30 * 60 * 1000;

  // Woher eine Runde kommt, fürs Protokoll: aus einem Multiplayer (die Runde
  // steckt in live.html, ?live= in der Adresse), aus einem Turnier
  // (?turnier=) – oder von der Spielseite selbst, dann fehlt das Feld.
  function woher() {
    try {
      if (window.LernappLiveSpiel?.aktiv?.()) return "live";
      const p = new URLSearchParams(window.location?.search || "");
      if (p.has("live")) return "live";
      if (p.has("turnier")) return "turnier";
    } catch { /* ohne Adresse: von der Spielseite */ }
    return "";
  }

  async function speichere({ game, spieler, name, punkte, ms = 0, zeitMs = 0, offline = false, quelle: von = null }) {
    const spielId = String(game || "").trim();
    const spielerId = String(spieler || "").trim();
    const wie = sauber(name);
    const zahl = Math.max(0, Math.min(1000000, Math.round(Number(punkte) || 0)));
    const dauer = Math.max(0, Math.min(RUNDE_MS, Math.round(Number(ms) || 0)));
    if (!spielId || !spielerId || !wie) throw new Error("Für einen Eintrag fehlt etwas.");
    const db = starte();
    const ref = sammlung();
    if (!db || !ref) throw new Error("Firestore ist nicht bereit.");

    const doc = ref.doc(`${spielId}_${spielerId}`);
    const protokoll = rundenSammlung();
    const spaeter = Boolean(offline);
    const quelle = von === null ? woher() : (von === "turnier" || von === "live" ? von : "");
    const eintragen = (mitRunde) => db.runTransaction(async (lauf) => {
      const vorher = await lauf.get(doc);
      const alt = vorher.exists ? lies(vorher) : null;
      // Ohne Netz gespielt: zur Zeit der Runde, nie in der Zukunft.
      const jetzt = spaeter && zeitMs > 0 ? Math.min(Date.now(), Math.round(Number(zeitMs))) : Date.now();
      // Der Name gehört dem Eintrag: Eine Runde ändert ihn nicht. Umbenannt
      // wird nur ausdrücklich (benenneUm) – auf einem Gerät oder im
      // Adminbereich. Spielte ein zweites Gerät noch unter dem alten Namen,
      // schriebe es ihn sonst Runde für Runde, Spiel für Spiel zurück. So
      // bleibt der neue stehen, und das Gerät übernimmt ihn (mini-games.js,
      // melde).
      const hiess = alt ? alt.name : wie;

      if (mitRunde && protokoll) {
        const nr = alt ? alt.versuche + 1 : 1;
        lauf.set(protokoll.doc(`${spielId}_${spielerId}_${nr}`), {
          game: spielId,
          spieler: spielerId,
          name: hiess,
          nr,
          punkte: zahl,
          ms: dauer,
          zeitMs: jetzt,
          ...(quelle ? { quelle } : {}),
          ...(spaeter ? { offline: true } : {}),
        });
      }

      if (!alt) {
        lauf.set(doc, {
          game: spielId,
          spieler: spielerId,
          name: wie,
          punkte: zahl,
          versuche: 1,
          erstesMs: jetzt,
          spielMs: dauer,
          updatedAtMs: jetzt,
          updatedAt: jetztAufDemServer(),
        });
        return { rekord: true, punkte: zahl, versuche: 1, name: wie };
      }

      const rekord = zahl > alt.punkte;
      lauf.set(doc, {
        punkte: rekord ? zahl : alt.punkte,
        versuche: alt.versuche + 1,
        spielMs: alt.spielMs + dauer,
        // Eine Runde von früher (ohne Netz) stellt die Uhr nicht zurück.
        updatedAtMs: Math.max(alt.updatedAtMs, jetzt),
        updatedAt: jetztAufDemServer(),
      }, { merge: true });
      return { rekord, punkte: rekord ? zahl : alt.punkte, versuche: alt.versuche + 1, name: hiess };
    });

    // Die Runde ist das Versprechen, das Protokoll die Zugabe. Weist die
    // Datenbank beides zusammen ab, geht die Runde allein noch einmal – sonst
    // kostete ein Protokoll, das nicht passt (Regeln noch ohne miniRunden,
    // eine Uhr, die weit danebenliegt, eine Runde, die nach einem Löschen
    // liegen blieb), die Runde selbst. Weist sie auch die ab, war es nie das
    // Protokoll.
    try {
      return await eintragen(true);
    } catch (fehler) {
      if (fehler?.code !== "permission-denied") throw fehler;
      return eintragen(false);
    }
  }

  /*
   * Der eine Eintrag dieses Geräts in einem Spiel – oder null, wenn es keinen
   * gibt. Er ist die Wahrheit über den eigenen Bestwert: Hat der Admin ihn
   * gelöscht, gilt auch auf dem Gerät nichts mehr davon (mini-games.js,
   * gleicheAb). Kann nicht gelesen werden, wirft es – dann bleibt auf dem
   * Gerät alles, wie es ist.
   */
  async function meinErgebnis(game, spieler) {
    const spielId = String(game || "").trim();
    const spielerId = String(spieler || "").trim();
    const ref = sammlung();
    if (!ref || !spielId || !spielerId) throw new Error("Firestore ist nicht bereit.");
    const doc = await ref.doc(`${spielId}_${spielerId}`).get();
    return doc.exists ? lies(doc) : null;
  }

  /*
   * Alle Einträge unter einem Namen, aus allen Spielen und von allen Geräten
   * – für die Frage, unter welcher Kennung dieser Name spielt (mini-games.js,
   * stammKennung). Eine Abfrage über ein einziges Feld, kein
   * zusammengesetzter Index. Firestore vergleicht dabei genau: "Elin" findet
   * kein "ELIN".
   */
  async function unterNamen(name) {
    const wie = sauber(name);
    const ref = sammlung();
    if (!ref || !wie) return [];
    const stand = await ref.where("name", "==", wie).limit(MAX_JE_NAMEN).get();
    const liste = [];
    stand.forEach((doc) => {
      const eintrag = lies(doc);
      if (eintrag) liste.push(eintrag);
    });
    return liste;
  }

  /*
   * Alle Einträge einer Kennung, aus allen Spielen – für die Frage, wie sie
   * heute heisst (mini-games.js, eigenenNamenPruefen). Eine Abfrage über ein
   * einziges Feld, kein zusammengesetzter Index.
   */
  async function vonKennung(spieler) {
    const spielerId = String(spieler || "").trim();
    const ref = sammlung();
    if (!ref || !spielerId) return [];
    return sammle(await ref.where("spieler", "==", spielerId).limit(MAX_JE_SPIELER).get(), lies);
  }

  /*
   * Ein neuer Name, ohne dass eine Runde daraus wird – und alles, was unter
   * dem alten steht, kommt mit (mini-games.js, namenAendern).
   *
   * Ohne diesen Weg müsste sich ein Umbenennen als Runde verkleiden – und wer
   * nach einer Runde auf "Name ändern" tippt, hätte danach zwei Versuche für
   * ein Spiel. Die Regeln lassen deshalb eine Änderung zu, die nur den Namen
   * anfasst.
   *
   * Umbenannt wird in ALLEN Spielen, nicht nur in dem, das gerade offen ist,
   * und nicht nur die Einträge dieses Geräts: Die Hall of Fame fasst nach
   * Namen zusammen (mini-games.js, verdichte), und derselbe Name ist derselbe
   * Spieler. Bliebe in Turmbau "Jonas" stehen – von diesem Gerät oder vom
   * Tablet –, während im Fischteich schon "Jonas K." steht, stünde derselbe
   * Mensch zweimal in der Tabelle. Gefragt wird deshalb zweimal, beide Male
   * über ein einziges Feld: nach der Kennung (spieler) und nach dem alten
   * Namen (alt), so wie er geschrieben ist.
   *
   * Dazu die Turniere, in denen dieses Gerät dabei war (turnier.js,
   * turnierIds): Dort fasst die Gesamtwertung genauso nach Namen zusammen.
   * Ein Turnier, das nicht antwortet, hält die anderen nicht auf – die
   * Bestenliste ist dann schon umbenannt.
   *
   * Die Uhr (updatedAtMs) bleibt stehen: Sie sagt, wann zuletzt gespielt
   * wurde, und ordnet Gleichstände. Wer sich umbenennt, hat nicht gespielt.
   *
   * Ein Spieler hat höchstens ein Dokument je Spiel und Gerät, also eine
   * Handvoll. Die der Bestenliste gehen in einem Zug hinaus: alle oder keines.
   */
  async function benenneUm({ spieler, name, alt = "", turniere = [] }) {
    const spielerId = String(spieler || "").trim();
    const wie = sauber(name);
    const vorher = sauber(alt);
    if (!spielerId || !wie) throw new Error("Für einen neuen Namen fehlt etwas.");
    const db = starte();
    const ref = sammlung();
    if (!db || !ref) throw new Error("Firestore ist nicht bereit.");

    const meine = await umzubenennen(ref, spielerId, vorher, wie);
    const geaendert = await schreibeNamen(db, meine, wie);
    let inTurnieren = 0;
    for (const id of new Set((turniere || []).map((t) => String(t || "").trim()).filter(Boolean))) {
      const liste = turnierEintraege(id);
      if (!liste) continue;
      try {
        inTurnieren += await schreibeNamen(db, await umzubenennen(liste, spielerId, vorher, wie), wie);
      } catch (fehler) {
        console.warn(`Im Turnier ${id} heisst du noch wie vorher`, fehler);
      }
    }
    return { spiele: meine.length, geaendert, turniere: inTurnieren };
  }

  // Die Dokumente einer Sammlung (miniScores oder die Einträge eines
  // Turniers), die den neuen Namen bekommen: die der Kennung und die unter
  // dem alten Namen – jedes einmal, und nur die, die noch anders heissen.
  async function umzubenennen(ref, spielerId, vorher, wie) {
    const fragen = [ref.where("spieler", "==", spielerId).limit(MAX_JE_SPIELER).get()];
    if (vorher) fragen.push(ref.where("name", "==", vorher).limit(MAX_JE_NAMEN).get());
    const docs = new Map();
    (await Promise.all(fragen)).forEach((stand) => stand.forEach((doc) => {
      const e = lies(doc);
      if (e && e.name !== wie) docs.set(doc.ref.path, doc.ref);
    }));
    return [...docs.values()];
  }

  // Nur der Name, sonst nichts (firestore.rules) – in Stapeln, die
  // Firestore annimmt.
  async function schreibeNamen(db, refs, wie) {
    for (let i = 0; i < refs.length; i += 400) {
      const stapel = db.batch();
      refs.slice(i, i + 400).forEach((ref) => stapel.set(ref, { name: wie }, { merge: true }));
      await stapel.commit();
    }
    return refs.length;
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
      .filter(Boolean))].slice(0, 25);
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
  // Das Rundenprotokoll – nur für den Adminbereich
  // ---------------------------------------------------------------------------
  // Gelesen wird Seite für Seite. Ein Tag sind ein paar Dutzend Runden, ein
  // Jahr ein paar Tausend; MAX_RUNDEN hält nur fest, dass ein Zeitraum nicht
  // die ganze Sammlung in den Browser zieht.
  const RUNDEN_SEITE = 1000;
  const MAX_RUNDEN = 20000;

  function liesRunde(doc) {
    const d = typeof doc?.data === "function" ? doc.data() : null;
    if (!d) return null;
    const game = String(d.game || "").trim();
    const spieler = String(d.spieler || "").trim();
    const zeitMs = Math.round(Number(d.zeitMs) || 0);
    if (!game || !spieler || !zeitMs) return null;
    return {
      id: doc.id,
      game,
      spieler,
      name: String(d.name || "").trim().slice(0, NAME_MAX),
      nr: Math.max(1, Math.round(Number(d.nr) || 1)),
      punkte: Math.max(0, Math.round(Number(d.punkte) || 0)),
      ms: Math.max(0, Math.min(RUNDE_MS, Math.round(Number(d.ms) || 0))),
      zeitMs,
      quelle: d.quelle === "turnier" || d.quelle === "live" ? d.quelle : "",
    };
  }

  // Die Runden zwischen zwei Zeitpunkten, beide eingeschlossen, nach der
  // Zeit. Eine Bereichsabfrage über ein einziges Feld – kein
  // zusammengesetzter Index – und nur über das, was im Zeitraum liegt.
  async function runden({ vonMs = 0, bisMs = Date.now() } = {}) {
    const ref = rundenSammlung();
    if (!ref) throw new Error("Firestore ist nicht bereit.");
    let frage = ref
      .where("zeitMs", ">=", Math.max(0, Math.round(Number(vonMs) || 0)))
      .where("zeitMs", "<=", Math.round(Number(bisMs) || 0))
      .orderBy("zeitMs")
      .limit(RUNDEN_SEITE);
    const liste = [];
    for (;;) {
      const seite = await frage.get();
      liste.push(...sammle(seite, liesRunde));
      if (seite.size < RUNDEN_SEITE || liste.length >= MAX_RUNDEN) return liste.slice(0, MAX_RUNDEN);
      frage = frage.startAfter(seite.docs[seite.docs.length - 1]);
    }
  }

  // Wann die erste Runde festgehalten wurde – was davor gespielt wurde, steht
  // nur in den Summen von miniScores. 0 heisst: noch keine.
  async function ersteRunde() {
    const ref = rundenSammlung();
    if (!ref) throw new Error("Firestore ist nicht bereit.");
    const stand = await ref.orderBy("zeitMs").limit(1).get();
    let ms = 0;
    stand.forEach((doc) => { ms = liesRunde(doc)?.zeitMs || 0; });
    return ms;
  }

  // Die Runden eines Geräts in den genannten Spielen. Gefragt wird nach dem
  // Gerät allein – ein Feld, kein Index –, das Spiel sortiert diese Datei.
  async function rundenDesGeraets(spieler, spiele) {
    const ref = rundenSammlung();
    const wer = String(spieler || "").trim();
    if (!ref || !wer) return [];
    const welche = new Set(spiele);
    let frage = ref.where("spieler", "==", wer).limit(RUNDEN_SEITE);
    const docs = [];
    for (;;) {
      const seite = await frage.get();
      seite.forEach((doc) => { if (welche.has(String(doc.data()?.game || ""))) docs.push(doc); });
      if (seite.size < RUNDEN_SEITE) return docs;
      frage = frage.startAfter(seite.docs[seite.docs.length - 1]);
    }
  }

  /*
   * Die Runden zu Einträgen löschen, mit dem Eintrag (admin.js, loesche):
   * Wer aus der Liste genommen wurde, soll auch in keinem Zeitraum mehr
   * auftauchen – und eine liegen gebliebene Runde trüge den Namen, den die
   * nächste Runde dieses Eintrags braucht. eintraege: [{ game, spieler }].
   * Nur der Admin darf das.
   */
  async function loescheRunden(eintraege) {
    const db = starte();
    if (!db) throw new Error("Firestore ist nicht bereit.");
    const jeGeraet = new Map();
    (eintraege || []).forEach((e) => {
      const wer = String(e?.spieler || "").trim();
      const spiel = String(e?.game || "").trim();
      if (!wer || !spiel) return;
      if (!jeGeraet.has(wer)) jeGeraet.set(wer, new Set());
      jeGeraet.get(wer).add(spiel);
    });
    let weg = 0;
    for (const [wer, spiele] of jeGeraet) {
      const docs = await rundenDesGeraets(wer, [...spiele]);
      for (let i = 0; i < docs.length; i += 400) {
        const stapel = db.batch();
        docs.slice(i, i + 400).forEach((doc) => stapel.delete(doc.ref));
        await stapel.commit();
      }
      weg += docs.length;
    }
    return weg;
  }

  /*
   * Zusammenführen (admin.js, fuehreZusammen): Die Runden eines Spiels von
   * den anderen Geräten ziehen unter die Kennung, unter der der Eintrag
   * bleibt. Sonst blieben sie unter einer Kennung ohne Eintrag liegen, und
   * wer den Eintrag später löscht, löschte sie nicht mit.
   *
   * Geändert wird eine Runde nie (firestore.rules): Sie wird unter der neuen
   * Kennung angelegt und die alte gelöscht, in einem Stapel. Ihre Nummer
   * kommt hinter alle Runden, die der Eintrag dort schon hatte (basis),
   * Gerät für Gerät – so, wie die Versuche zusammengezählt werden. Die
   * nächste Runde zählt danach weiter; keine Nummer ist doppelt.
   *
   *   von   [{ spieler, versuche }] in der Reihenfolge, in der gezählt wird
   */
  async function zieheRundenUm({ game, nach, name, basis = 0, von = [] }) {
    const db = starte();
    const ref = rundenSammlung();
    const spiel = String(game || "").trim();
    const ziel = String(nach || "").trim();
    const wie = sauber(name);
    if (!db || !ref || !spiel || !ziel || !wie) throw new Error("Für das Umziehen fehlt etwas.");
    let versatz = Math.max(0, Math.round(Number(basis) || 0));
    let gezogen = 0;
    for (const geraet of von) {
      const wer = String(geraet?.spieler || "").trim();
      if (!wer || wer === ziel) continue;
      const docs = await rundenDesGeraets(wer, [spiel]);
      for (let i = 0; i < docs.length; i += 200) {
        const stapel = db.batch();
        docs.slice(i, i + 200).forEach((doc) => {
          const r = liesRunde(doc);
          if (r) {
            const nr = versatz + r.nr;
            stapel.set(ref.doc(`${spiel}_${ziel}_${nr}`), {
              game: spiel,
              spieler: ziel,
              name: wie,
              nr,
              punkte: r.punkte,
              ms: r.ms,
              zeitMs: r.zeitMs,
              ...(r.quelle ? { quelle: r.quelle } : {}),
            });
            gezogen += 1;
          }
          stapel.delete(doc.ref);
        });
        await stapel.commit();
      }
      versatz += Math.max(1, Math.round(Number(geraet.versuche) || 1));
    }
    return gezogen;
  }

  // ---------------------------------------------------------------------------
  // Turniere
  // ---------------------------------------------------------------------------
  const TURNIER_NAME_MAX = 60;
  const BESCHREIBUNG_MAX = 600;
  // Woher die Läufe kommen (zufall.js, turnier.js). Das erste ist der Standard.
  const AUFGABEN = ["gleich", "zufall", "wieErster"];
  // Höher als in miniScores: Mit "alle Versuche zusammen" wächst die Zahl mit
  // jedem Versuch.
  const TURNIER_PUNKTE_MAX = 10000000;
  const MAX_TURNIERE = 100;
  // So viele Einträge eines Turniers auf einmal. Gelesen wird Seite für Seite
  // bis zum Ende und nicht bis zu einer Grenze: Bei einem grossen Turnier
  // fehlten sonst die hinteren Einträge still – und wer in der
  // Gesamtwertung fehlt, bekommt dort für jedes Spiel den Platz hinter dem
  // Letzten.
  const TURNIER_SEITE = 500;

  const turnierSammlung = () => starte()?.collection("miniTurniere") || null;
  function turnierEintraege(id) {
    const ref = turnierSammlung();
    const kennung = String(id || "").trim();
    return ref && kennung ? ref.doc(kennung).collection("eintraege") : null;
  }
  function turnierGeisterRef(id) {
    const ref = turnierSammlung();
    const kennung = String(id || "").trim();
    return ref && kennung ? ref.doc(kennung).collection("geister") : null;
  }
  function turnierLiveRef(id) {
    const ref = turnierSammlung();
    const kennung = String(id || "").trim();
    return ref && kennung ? ref.doc(kennung).collection("live") : null;
  }

  // ---------------------------------------------------------------------------
  // Multiplayer eines Turniers (live.js)
  // ---------------------------------------------------------------------------
  // Was ein Multiplayer im Turnier hinterlässt: seinen Endstand, mit dem
  // Gewicht, mit dem er in der Gesamtwertung zählt.
  function liesLiveErgebnis(doc) {
    const d = typeof doc?.data === "function" ? doc.data() : null;
    if (!d) return null;
    const endstand = (Array.isArray(d.endstand) ? d.endstand : [])
      .map((e) => ({
        spieler: String(e?.spieler || ""),
        name: String(e?.name || "").trim().slice(0, NAME_MAX),
        punkte: Math.max(0, Math.round(Number(e?.punkte) || 0)),
        platz: Math.max(1, Math.round(Number(e?.platz) || 1)),
      }))
      .filter((e) => e.name);
    return {
      id: doc.id,
      name: String(d.name || "Multiplayer").trim().slice(0, TURNIER_NAME_MAX),
      gewicht: Math.max(0, Math.min(3, Math.round(Number(d.gewicht) || 0))),
      endstand,
      runden: Math.max(0, Math.round(Number(d.runden) || 0)),
      spiele: Array.isArray(d.spiele) ? d.spiele.map(String) : [],
      erstelltMs: Math.round(Number(d.erstelltMs) || 0),
    };
  }

  async function turnierLive(id) {
    const ref = turnierLiveRef(id);
    if (!ref) return [];
    return sammle(await ref.limit(50).get(), liesLiveErgebnis).sort((a, b) => a.erstelltMs - b.erstelltMs);
  }

  // Nur der Admin, am Ende eines Multiplayers (firestore.rules, live).
  async function speichereTurnierLive(id, abendId, daten) {
    const ref = turnierLiveRef(id);
    if (!ref) throw new Error("Firestore ist nicht bereit.");
    const doc = {
      name: String(daten.name || "Multiplayer").trim().slice(0, TURNIER_NAME_MAX) || "Multiplayer",
      gewicht: Math.max(0, Math.min(3, Math.round(Number(daten.gewicht) || 0))),
      endstand: (daten.endstand || []).slice(0, 200).map((e) => ({
        spieler: String(e.spieler || "").slice(0, 64),
        name: String(e.name || "").trim().slice(0, NAME_MAX),
        punkte: Math.max(0, Math.round(Number(e.punkte) || 0)),
        platz: Math.max(1, Math.round(Number(e.platz) || 1)),
      })),
      runden: Math.max(0, Math.min(100, Math.round(Number(daten.runden) || 0))),
      spiele: (daten.spiele || []).slice(0, 50).map(String),
      erstelltMs: Math.round(Number(daten.erstelltMs) || Date.now()),
      updatedAtMs: Date.now(),
      updatedAt: jetztAufDemServer(),
    };
    await ref.doc(String(abendId)).set(doc);
    return liesLiveErgebnis({ id: abendId, data: () => doc });
  }

  // Der Code eines Multiplayers: zehn Zeichen, von früher auch vier.
  const LIVE_CODE = /^[A-Z2-9]{4,12}$/;

  // Ob zu einem Turnier gerade ein Multiplayer für alle offen ist – aus der
  // Realtime Database, ohne ihr SDK: Die Turnierseite fragt über die
  // REST-Schnittstelle (turnierLive/<id> lesen darf jeder).
  async function liveZeiger(id) {
    const kennung = String(id || "").trim();
    if (!/^[a-z0-9-]+$/.test(kennung)) return null;
    const antwort = await fetch(`${firebaseConfig.databaseURL}/turnierLive/${kennung}.json`, { cache: "no-store" });
    if (!antwort.ok) return null;
    const d = await antwort.json();
    if (!d || typeof d !== "object" || !LIVE_CODE.test(String(d.code || ""))) return null;
    return { code: String(d.code), name: String(d.name || "Multiplayer").slice(0, 60) };
  }

  // Was aus einem Multiplayer geworden ist (für den Adminbereich, der seine
  // eigenen auflistet): Name, Phase, Sichtbarkeit – oder null, wenn es ihn
  // nicht mehr gibt.
  async function multiplayer(code) {
    const c = String(code || "").trim();
    if (!LIVE_CODE.test(c)) return null;
    const hole = async (pfad) => {
      const antwort = await fetch(`${firebaseConfig.databaseURL}/live/${c}/${pfad}.json`, { cache: "no-store" });
      if (!antwort.ok) throw new Error(`Realtime Database: ${antwort.status}`);
      return antwort.json();
    };
    const [name, sichtbar, phase] = await Promise.all([hole("info/name"), hole("info/einstellungen/sichtbar"), hole("zustand/phase")]);
    if (typeof name !== "string") return null;
    return { code: c, name: name.slice(0, 60), sichtbar: sichtbar === "alle" ? "alle" : "link", phase: String(phase || "lobby") };
  }

  // Die Multiplayer, die gerade für alle offen sind (liveOffen, live.js) –
  // für den Knopf auf der Startseite, auf demselben Weg ohne SDK. Was älter
  // ist als einen halben Tag, hat jemand zu schliessen vergessen.
  async function offeneMultiplayer() {
    const antwort = await fetch(`${firebaseConfig.databaseURL}/liveOffen.json`, { cache: "no-store" });
    if (!antwort.ok) return [];
    const d = await antwort.json();
    if (!d || typeof d !== "object") return [];
    const jetzt = Date.now();
    return Object.entries(d)
      .filter(([code, o]) => LIVE_CODE.test(code) && o && typeof o === "object")
      .map(([code, o]) => ({ code, name: String(o.name || "Multiplayer").slice(0, 60), seit: Number(o.seit) || 0 }))
      .filter((o) => !o.seit || jetzt - o.seit < 12 * 3600 * 1000)
      .sort((a, b) => b.seit - a.seit);
  }

  /*
   * Live mitschauen (geist.js schreibt und schaut zu): im Turnier
   * turnierMitschauen/<turnier>/<kennung>, sonst – in der App –
   * mitschauen/<kennung>. In der Realtime Database, über ihre
   * REST-Schnittstelle, ohne SDK – die Spielseiten laden es gar nicht erst.
   *
   *   name     wer spielt
   *   runde    { id, spiel, saat, start } – die Runde, die gerade läuft
   *            oder zuletzt lief
   *   teile    { 0: "…", 1: "…" } – die Proben, je ein Stück JSON (Ort
   *            und Züge), alle halbe Sekunde eines
   *   ende     { p, o, z } – die Runde ist fertig: Punkte, letzte Zeiten
   *   lebt     wann das Gerät zuletzt geschrieben hat
   *
   * mitschauenSchreiben setzt den ganzen Knoten (ganz, zu Beginn einer Runde)
   * oder ändert einzelne Pfade darin ({ "teile/4": "…", lebt: … }).
   * mitschauenHoeren hört mit (EventSource, Streaming der REST-Schnittstelle)
   * und meldet nach jeder Änderung den ganzen Knoten; gibt das Abmelden
   * zurück. Ohne Turnier (turnier leer) ist der Knoten der der App gemeint.
   *
   * Dazu ein Zettel je Spieler und Runde – in der App amSpielen/<kennung>,
   * im Turnier turnierAmSpielen/<turnier>/<kennung>:
   *
   *   name, spiel   wer was spielt
   *   p             wie viele Punkte er gerade hat (fehlt, solange die
   *                 Rangliste des Turniers verdeckt ist)
   *   lebt          wann das Gerät zuletzt gesagt hat, dass die Runde läuft
   *   fertig        true: die Runde ist zu Ende gespielt
   *
   * Daran sehen die Startseite und die Turnierseite, wer gerade spielt
   * (amSpielenHoeren), ohne die Stücke der Läufe mitzuladen – sofort, über
   * denselben Strom.
   */
  const TURNIER_ID = /^[a-z0-9-]{6,48}$/;
  const SPIELER_ID = /^mini_[A-Za-z0-9_-]{8,48}$/;
  function mitschauenAdresse(turnier, kennung) {
    const t = String(turnier || "");
    const k = String(kennung || "");
    if (!SPIELER_ID.test(k)) return "";
    if (!t) return `${firebaseConfig.databaseURL}/mitschauen/${k}.json`;
    return TURNIER_ID.test(t) ? `${firebaseConfig.databaseURL}/turnierMitschauen/${t}/${k}.json` : "";
  }

  async function schreibeRest(adresse, daten, ganz) {
    if (!adresse) return false;
    const antwort = await fetch(adresse, {
      method: ganz ? "PUT" : "PATCH",
      body: JSON.stringify(daten),
      keepalive: true,
    });
    return antwort.ok;
  }

  const mitschauenSchreiben = (turnier, kennung, daten, { ganz = false } = {}) => schreibeRest(mitschauenAdresse(turnier, kennung), daten, ganz);

  // Die Zettel: alle einer Liste (kennung leer) oder der eines Spielers.
  function amSpielenAdresse(turnier, kennung = null) {
    const t = String(turnier || "");
    const liste = t ? (TURNIER_ID.test(t) ? `turnierAmSpielen/${t}` : "") : "amSpielen";
    if (!liste) return "";
    if (kennung === null) return `${firebaseConfig.databaseURL}/${liste}.json`;
    return SPIELER_ID.test(String(kennung)) ? `${firebaseConfig.databaseURL}/${liste}/${kennung}.json` : "";
  }
  const amSpielenSchreiben = (turnier, kennung, daten, { ganz = false } = {}) => schreibeRest(amSpielenAdresse(turnier, String(kennung || "")), daten, ganz);

  // Einen Wert an einem Pfad setzen ("/", "/teile/4") – null löscht ihn.
  function setzeBei(knoten, pfad, wert) {
    const teile = String(pfad || "/").split("/").filter(Boolean);
    if (!teile.length) return wert;
    const kopie = knoten && typeof knoten === "object" ? { ...knoten } : {};
    const [erster, ...rest] = teile;
    const neu = setzeBei(kopie[erster], rest.join("/"), wert);
    if (neu === null || neu === undefined) delete kopie[erster];
    else kopie[erster] = neu;
    return Object.keys(kopie).length ? kopie : null;
  }

  const mitschauenHoeren = (turnier, kennung, beiStand) => hoere(mitschauenAdresse(turnier, kennung), beiStand);
  // Alle Zettel einer Liste auf einmal: { <kennung>: { name, spiel, p, lebt,
  // fertig } } – die der App oder, mit turnier, die dieses Turniers.
  const amSpielenHoeren = (beiStand, turnier = "") => hoere(amSpielenAdresse(turnier), beiStand);

  /*
   * Wer gerade zuschaut: zuschauer/<spieler>/<zuschauer> – { name, lebt }.
   * Der Beobachtungsmodus meldet sich dort an und alle zehn Sekunden wieder
   * (geist.js, mitschauer) und meldet sich beim Gehen ab (daten null); die
   * Spielseite des Spielers hört mit und zeigt «Alain schaut gerade zu».
   */
  const zuschauerAdresse = (spieler, ich = null) => {
    if (!SPIELER_ID.test(String(spieler || ""))) return "";
    if (ich === null) return `${firebaseConfig.databaseURL}/zuschauer/${spieler}.json`;
    return SPIELER_ID.test(String(ich)) ? `${firebaseConfig.databaseURL}/zuschauer/${spieler}/${ich}.json` : "";
  };
  async function zuschauerMelden(spieler, ich, daten) {
    const adresse = zuschauerAdresse(spieler, String(ich || ""));
    if (!adresse) return false;
    if (daten) return schreibeRest(adresse, daten, true);
    const antwort = await fetch(adresse, { method: "DELETE", keepalive: true });
    return antwort.ok;
  }
  const zuschauerHoeren = (spieler, beiStand) => hoere(zuschauerAdresse(spieler), beiStand);

  function hoere(adresse, beiStand) {
    if (!adresse || typeof window.EventSource !== "function") return () => {};
    let knoten = null;
    let quelle = null;
    let aus = false;
    const melde = () => { try { beiStand(knoten); } catch (fehler) { console.warn("Mitschauen", fehler); } };
    const verbinde = () => {
      if (aus) return;
      quelle = new window.EventSource(adresse);
      quelle.addEventListener("put", (e) => {
        try {
          const { path, data } = JSON.parse(e.data);
          knoten = setzeBei(knoten, path, data);
          melde();
        } catch { /* eine kaputte Nachricht überspringen */ }
      });
      quelle.addEventListener("patch", (e) => {
        try {
          const { path, data } = JSON.parse(e.data);
          Object.entries(data || {}).forEach(([k, v]) => { knoten = setzeBei(knoten, `${path}/${k}`, v); });
          melde();
        } catch { /* eine kaputte Nachricht überspringen */ }
      });
      // Die Datenbank kündigt den Strom (Regeln geändert, Verbindung weg):
      // in ein paar Sekunden noch einmal. Bricht er sonst ab, versucht es der
      // Browser selbst – ausser er hat aufgegeben (CLOSED).
      quelle.addEventListener("cancel", () => { quelle.close(); window.setTimeout(verbinde, 3000); });
      quelle.addEventListener("error", () => {
        if (quelle.readyState === 2) window.setTimeout(() => { if (quelle.readyState === 2) verbinde(); }, 3000);
      });
    };
    // Zurück aus dem Hintergrund (Handy, App): Ist der Strom dabei
    // eingeschlafen, gleich neu – der erste Stand kommt dann ganz.
    const wach = () => {
      if (aus || document.visibilityState !== "visible" || !quelle || quelle.readyState !== 2) return;
      verbinde();
    };
    document.addEventListener("visibilitychange", wach);
    verbinde();
    return () => {
      aus = true;
      quelle?.close();
      document.removeEventListener("visibilitychange", wach);
    };
  }

  // Ein Turnier, so wie der Rest es braucht. Was fehlt oder nicht passt, wird
  // zum freundlichen Wert – bis auf das, ohne das es kein Turnier ist: Name,
  // Spiele, Ende.
  function liesTurnier(doc) {
    const d = typeof doc?.data === "function" ? doc.data() : null;
    if (!d) return null;
    const name = String(d.name || "").trim().slice(0, TURNIER_NAME_MAX);
    // Ein Spiel, das es nicht mehr gibt, gehört zu keinem Turnier mehr: Es
    // hat keine Seite, und die Regeln nähmen das Turnier mit ihm nicht mehr
    // an – ein Turnier von früher liesse sich sonst weder anhalten noch
    // umbenennen. Bleibt gar keines übrig, gibt es das Turnier nicht mehr.
    const bekannt = window.LernappMini?.SPIELE?.map?.((s) => s.id) || null;
    const spiele = [...new Set((Array.isArray(d.spiele) ? d.spiele : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean))]
      .filter((id) => !bekannt || bekannt.includes(id));
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
      aufgaben: AUFGABEN.includes(d.aufgaben) ? d.aufgaben : "gleich",
      sichtbar: d.sichtbar === "alle" ? "alle" : "link",
      verdeckt: d.verdeckt === true,
      ohneGeist: d.ohneGeist === true,
      ohneReplay: d.ohneReplay === true,
      nurLive: d.nurLive === true,
      aktiv: d.aktiv !== false,
      spitzeWartet: d.spitzeWartet === true && !(Number(d.versuche) > 0),
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
      aufgaben: AUFGABEN.includes(daten.aufgaben) ? daten.aufgaben : "gleich",
      sichtbar: daten.sichtbar === "alle" ? "alle" : "link",
      verdeckt: daten.verdeckt === true,
      aktiv: daten.aktiv !== false,
      erstelltMs: Math.round(Number(daten.erstelltMs) || Date.now()),
      updatedAtMs: Date.now(),
      updatedAt: jetztAufDemServer(),
    };
    const beschreibung = String(daten.beschreibung || "").trim().slice(0, BESCHREIBUNG_MAX);
    if (beschreibung) doc.beschreibung = beschreibung;
    // Nur, wo es gilt: Ein Turnier mit fester Zahl von Versuchen kennt das
    // Warten an der Spitze nicht, und die Regeln wiesen es dort ab.
    if (daten.spitzeWartet === true && doc.versuche === 0) doc.spitzeWartet = true;
    // Ebenso: Nur wer die Gegner abschaltet, schreibt das Feld. Ein Turnier
    // ohne das Feld zeigt sie, wie jedes Turnier von vorher.
    if (daten.ohneGeist === true) doc.ohneGeist = true;
    // Ebenso die Replays.
    if (daten.ohneReplay === true) doc.ohneReplay = true;
    // Und nur, wer nur live spielen lässt.
    if (daten.nurLive === true) doc.nurLive = true;
    await ref.doc(kennung).set(doc);
    return liesTurnier({ id: kennung, data: () => doc });
  }

  /*
   * Ein Turnier weg, samt seiner Einträge.
   *
   * Erst die Einträge und die Geister, dann das Turnier. Firestore räumt
   * eine Untersammlung nicht von selbst mit weg – andersherum blieben
   * Einträge liegen, zu denen es kein Turnier mehr gibt und die deshalb
   * niemand mehr sieht. Und aufräumen kann man nur, was man sieht.
   */
  async function loescheTurnier(id) {
    const db = starte();
    const ref = turnierSammlung();
    const eintraege = turnierEintraege(id);
    const geister = turnierGeisterRef(id);
    const abende = turnierLiveRef(id);
    if (!db || !ref || !eintraege || !geister || !abende) throw new Error("Firestore ist nicht bereit.");
    for (const unter of [eintraege, geister, abende]) {
      for (let runde = 0; runde < 50; runde += 1) {
        const stapel = await unter.limit(400).get();
        if (stapel.empty) break;
        const weg = db.batch();
        stapel.forEach((doc) => weg.delete(doc.ref));
        await weg.commit();
      }
    }
    await ref.doc(String(id)).delete();
  }

  // Einzelne Einträge eines Turniers weg – für den Namen, den man dort nicht
  // haben will, und mit ihnen seine Läufe: Sie tragen denselben Namen. Das
  // Turnier selbst und alle anderen bleiben. Nur der Admin darf das
  // (firestore.rules, eintraege und geister: delete).
  async function loescheTurnierEintraege(id, eintragIds) {
    const db = starte();
    const ref = turnierEintraege(id);
    const geister = turnierGeisterRef(id);
    if (!db || !ref || !geister) throw new Error("Firestore ist nicht bereit.");
    const ids = [...new Set((eintragIds || []).map((e) => String(e || "").trim()).filter(Boolean))];
    for (let i = 0; i < ids.length; i += 200) {
      const weg = db.batch();
      ids.slice(i, i + 200).forEach((e) => { weg.delete(ref.doc(e)); weg.delete(geister.doc(e)); });
      await weg.commit();
    }
    return ids.length;
  }

  /*
   * Der beste Lauf eines Spielers in einem Turnier – gelesen von dem, der
   * gegen ihn spielt (geist.js), geschrieben nach jedem Versuch, der besser
   * war als sein bester bisher (turnier.js). Gelesen wird vorher: Die Regeln
   * wiesen einen schwächeren Lauf ohnehin ab, aber erst nach der Reise, und
   * als Fehler in der Konsole.
   */
  function liesGeist(doc) {
    if (!doc?.exists) return null;
    const daten = doc.data() || {};
    const bahn = String(daten.bahn || "");
    if (!bahn) return null;
    return {
      spieler: String(daten.spieler || ""),
      name: String(daten.name || "").trim().slice(0, NAME_MAX),
      punkte: Math.max(0, Math.round(Number(daten.punkte) || 0)),
      level: String(daten.level || ""),
      bahn,
    };
  }

  async function turnierGeist(id, game, spieler) {
    const ref = turnierGeisterRef(id);
    const spielId = String(game || "").trim();
    const spielerId = String(spieler || "").trim();
    if (!ref || !spielId || !spielerId) return null;
    return liesGeist(await ref.doc(`${spielId}_${spielerId}`).get());
  }

  async function speichereTurnierGeist(id, { game, spieler, name, punkte, level, bahn }) {
    const ref = turnierGeisterRef(id);
    const spielId = String(game || "").trim();
    const spielerId = String(spieler || "").trim();
    const wie = sauber(name);
    const fassung = String(level || "").trim().slice(0, 16);
    const strecke = String(bahn || "");
    const zahl = Math.max(0, Math.min(1000000, Math.round(Number(punkte) || 0)));
    if (!ref || !spielId || !spielerId || !wie || !fassung || !strecke || strecke.length > BAHN_MAX) return null;
    const doc = ref.doc(`${spielId}_${spielerId}`);
    const alt = liesGeist(await doc.get());
    if (alt && alt.level === fassung && alt.punkte >= zahl) return null;
    const jetzt = Date.now();
    await doc.set({
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

  // Die Liste eines Turniers, auf Wunsch nur die eines Spiels – eine Abfrage
  // über ein einziges Feld, ohne zusammengesetzten Index. Weiterblättern
  // (startAfter) geht nach dem Dokumentnamen, nach dem Firestore ohnehin
  // sortiert; auch dafür braucht es keinen eigenen Index.
  async function turnierErgebnisse(id, { game = "" } = {}) {
    const ref = turnierEintraege(id);
    if (!ref) throw new Error("Firestore ist nicht bereit.");
    const spielId = String(game || "").trim();
    let frage = (spielId ? ref.where("game", "==", spielId) : ref).limit(TURNIER_SEITE);
    const liste = [];
    for (;;) {
      const seite = await frage.get();
      liste.push(...sammle(seite, liesTurnierEintrag));
      if (seite.size < TURNIER_SEITE) return liste;
      frage = frage.startAfter(seite.docs[seite.docs.length - 1]);
    }
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
  async function turnierUmbenennen(id, { spieler, name, alt = "" }) {
    const spielerId = String(spieler || "").trim();
    const wie = sauber(name);
    const db = starte();
    const ref = turnierEintraege(id);
    if (!spielerId || !wie || !db || !ref) return null;
    return { geaendert: await schreibeNamen(db, await umzubenennen(ref, spielerId, sauber(alt), wie), wie) };
  }

  // Nur diese Einträge eines Turniers bekommen einen neuen Namen (admin.js,
  // fuehreNamenZusammen) – dieselbe Regel wie eben: nur der Name.
  async function turnierEintraegeBenennen(id, ids, name) {
    const db = starte();
    const ref = turnierEintraege(id);
    const wie = sauber(name);
    if (!db || !ref || !wie) throw new Error("Firestore ist nicht bereit.");
    const refs = [...new Set((ids || []).map((e) => String(e || "").trim()).filter(Boolean))].map((e) => ref.doc(e));
    return schreibeNamen(db, refs, wie);
  }

  /*
   * Umzüge: wohin eine Kennung gezogen ist, die es in den Listen nicht mehr
   * gibt. Der Adminbereich führt zwei Namen zusammen (admin.js,
   * fuehreNamenZusammen) oder einen Namen von mehreren Geräten
   * (fuehreZusammen): Je Spiel bleibt ein Eintrag unter einer Kennung, die
   * der anderen werden gelöscht. Ein Gerät, das noch unter einer davon
   * spielt, fände danach nichts mehr von sich – und finge unter dem alten
   * Namen neu an. Deshalb bleibt für jede verschwundene Kennung ein Zettel
   * zurück:
   *
   *   miniUmzuege/mini_a7f3…
   *     nach       "mini_k2p9…"   die Kennung, unter der es weitergeht
   *     name       "Efraim"        der Name dort
   *
   * Das Gerät fragt beim Öffnen nach seiner eigenen Kennung (mini-games.js,
   * folgeUmzug) – ein Dokument, keine Abfrage – und spielt danach unter der
   * neuen weiter. Lesen darf das jeder, der die Kennung kennt; schreiben nur
   * der Admin (firestore.rules).
   */
  const umzugSammlung = () => starte()?.collection("miniUmzuege") || null;

  async function umzug(kennung) {
    const von = String(kennung || "").trim();
    const ref = umzugSammlung();
    if (!ref || !SPIELER_ID.test(von)) return null;
    const doc = await ref.doc(von).get();
    if (!doc.exists) return null;
    const d = doc.data() || {};
    const nach = String(d.nach || "");
    const name = sauber(d.name);
    return SPIELER_ID.test(nach) && nach !== von && name ? { nach, name } : null;
  }

  // Nur der Admin: Die Kennungen in von ziehen nach nach. Wo nach selbst
  // einmal weggezogen war, gilt das nicht mehr – sonst liefe ein Gerät im
  // Kreis.
  async function setzeUmzuege(von, { nach, name }) {
    const db = starte();
    const ref = umzugSammlung();
    const ziel = String(nach || "").trim();
    const wie = sauber(name);
    if (!db || !ref || !SPIELER_ID.test(ziel) || !wie) throw new Error("Für den Umzug fehlt etwas.");
    const kennungen = [...new Set((von || []).map((k) => String(k || "").trim()))]
      .filter((k) => SPIELER_ID.test(k) && k !== ziel);
    const stapel = db.batch();
    kennungen.forEach((k) => stapel.set(ref.doc(k), {
      nach: ziel, name: wie, updatedAtMs: Date.now(), updatedAt: jetztAufDemServer(),
    }));
    stapel.delete(ref.doc(ziel));
    await stapel.commit();
    return kennungen.length;
  }

  // app und db für den Adminbereich: Er meldet jemanden an und liest und
  // löscht dieselben Einträge, braucht dafür aber keinen zweiten Client.
  window.MiniCloud = {
    app,
    db: starte,
    projektId: firebaseConfig.projectId,
    ergebnisse, speichere, benenneUm, lies, meinErgebnis, unterNamen, vonKennung, umzug, setzeUmzuege,
    speichereGeist, geister,
    runden, ersteRunde, loescheRunden, zieheRundenUm,
    offeneSpiele, setzeOffeneSpiele, tiers, setzeTiers, vorschauApp,
    turnier, oeffentlicheTurniere, alleTurniere, setzeTurnier, loescheTurnier, loescheTurnierEintraege,
    turnierErgebnisse, meinTurnierEintrag, turnierVersuch, turnierErgebnis, turnierUmbenennen, turnierEintraegeBenennen,
    mitschauenSchreiben, mitschauenHoeren, amSpielenSchreiben, amSpielenHoeren, zuschauerMelden, zuschauerHoeren,
    turnierGeist, speichereTurnierGeist,
    turnierLive, speichereTurnierLive, liveZeiger, offeneMultiplayer, multiplayer,
    MAX_JE_SPIEL, MAX_JE_SPIELER, NAME_MAX, BAHN_MAX, MAX_RUNDEN,
    TURNIER_NAME_MAX, BESCHREIBUNG_MAX,
  };
})();
