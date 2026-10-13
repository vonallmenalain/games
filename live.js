/*
 * live.js – Der Live-Abend: alle zusammen, zur selben Zeit, im selben Level.
 * ---------------------------------------------------------------------------
 * Die Seite /live. Wer einen Code hat (/live?code=K7QM), kommt in die Lobby
 * und spielt mit; wer im Adminbereich angemeldet ist, kann einen Live-Abend
 * anlegen und leiten – auf demselben Gerät, auf dem er mitspielt.
 *
 * Alles, was während des Abends hin und her geht, steht in der Realtime
 * Database (database.rules.json), nicht in Firestore: Sie schickt jede
 * Änderung in Zehntelsekunden an alle, merkt, wer die Verbindung verliert,
 * und sagt jedem Gerät, wie weit seine Uhr von ihrer abweicht.
 *
 *   live/<code>
 *     info      name, host (uid), hostKennung, erstellt, programm,
 *               einstellungen                                 nur der Admin
 *     zustand   phase (lobby · runde · pause · ende), nr, saat,
 *               startUm, endeUm, dabei                         nur der Admin
 *     spieler/<kennung>       name, online, seit       der Spieler selbst
 *     punkte/<nr>/<kennung>   p, fertig, t             der Spieler selbst
 *     lage/<kennung>          n, t, a, b, c, p         der Spieler selbst
 *
 * Der Ablauf: Die Leitung drückt «Start». Dann schreibt sie in zustand, welche
 * Runde gespielt wird, mit welcher Saat und ab wann – zur Serverzeit. Jedes
 * Gerät, das dabei ist, öffnet das Spiel in einem Rahmen über der Seite
 * (/turmbau?live=K7QM&nr=0); live-spiel.js zählt dort herunter und startet
 * die Runde auf allen Geräten zugleich. Ist jeder fertig oder die Zeit um,
 * kommt die Auswertung (pause): Rundenpunkte, Zwischenstand, die nächste
 * Runde. Nach der letzten: das Podest (ende).
 *
 * Gerechnet wird nichts in der Datenbank. Jedes Gerät rechnet Rundenpunkte
 * und Stand aus denselben Punkten selbst (wertung) – und kommt aufs Gleiche.
 *
 * Die Leitung ist das Gerät des Admins, der den Abend angelegt hat. Nur es
 * schreibt zustand – so verlangen es die Regeln. Spielt es selbst mit, steht
 * über dem Spiel ein kleiner Knopf «Leitung», für den Fall, dass eine Runde
 * von Hand enden soll.
 */
(() => {
  "use strict";

  const cloud = () => window.MiniCloud || null;
  const mini = () => window.LernappMini || null;
  const hs = () => window.LernappHighscore || null;

  // Wer leiten darf, entscheiden die Regeln (database.rules.json). Diese Liste
  // sorgt nur dafür, dass der Knopf zum Anlegen nicht jemandem angeboten
  // wird, den die Datenbank dann abweist.
  const ADMINS = ["alain.sc2@gmail.com"];
  // Keine 0/O und 1/I: Der Code wird vorgelesen und abgetippt.
  const ZEICHEN = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const CODE_MUSTER = /^[A-Z2-9]{4}$/;
  // Platz 1 bis 8; wer dahinter liegt, bekommt einen Punkt.
  const PLATZPUNKTE = [10, 8, 6, 5, 4, 3, 2, 1];
  const ZULETZT_KEY = "mini.live.zuletzt";
  const VORLAGEN_KEY = "mini.live.vorlagen";
  const ADMIN_KEY = "mini.admin";
  // Wie lange die Spielseite zum Laden bekommt, bevor der Countdown beginnt.
  const LADEZEIT_MS = 2500;
  // Wie lange nach dem Zeitende die Leitung auf die letzten Ergebnisse wartet.
  const NACHLAUF_MS = 2500;
  const AUTO_WEITER_MS = 15000;

  const STANDARD = {
    name: "Live-Abend",
    programm: [{ spiel: "towerStack", runden: 2, uebung: 1 }],
    einstellungen: {
      zeitlimit: 120,
      wertung: "platz",
      finaleDoppelt: false,
      gleichesLevel: false,
      countdown: 5,
      weiter: "leitung",
      nachzuegler: true,
      zwischenstand: true,
      gegner: true,
    },
  };

  // Für die Prüfung im Browser (scripts/check-live.mjs): ein Emulator der
  // Realtime Database auf diesem Rechner und, wenn gewollt, ein Admin. Gilt
  // nur für eine Adresse auf dem eigenen Rechner.
  const TEST = (() => {
    const t = window.__miniLiveTest;
    if (!t || !/^(127\.0\.0\.1|localhost):\d+$/.test(String(t.emulator || ""))) return null;
    return t;
  })();

  const S = {
    wirt: null,
    db: null,
    code: "",
    info: null,
    infoGeladen: false,
    warDa: false,
    zustand: null,
    spieler: {},
    punkte: {},
    lage: {},
    versatz: 0,
    verbunden: false,
    admin: false,
    uid: null,
    ich: null,
    beigetreten: false,
    rahmen: null,
    hoerer: [],
    zeichnenGeplant: false,
    leitungAuf: false,
    autoWeiterAb: 0,
    letzteWertung: null,
    wachHalten: null,
    fehler: "",
    // Wer in einer Runde nicht mitspielt, kann zuschauen – in den Spielen mit
    // Figur im Bild. Gilt bis zum Ende der Runde.
    zuschauen: false,
    zuschauNr: null,
    // Das Grossbild für Fernseher und Beamer: niemand tritt bei, alles nur
    // grösser – und in einer Runde schaut es von selbst dem zu, der vorne liegt.
    gross: false,
  };

  // ---------------------------------------------------------------------------
  // Kleine Helfer
  // ---------------------------------------------------------------------------
  function el(tag, klasse, text) {
    const knoten = document.createElement(tag);
    if (klasse) knoten.className = klasse;
    if (text !== undefined) knoten.textContent = text;
    return knoten;
  }

  function knopf(text, klasse, beiKlick) {
    const k = el("button", `mini-knopf ${klasse || ""}`.trim(), text);
    k.type = "button";
    k.addEventListener("click", beiKlick);
    return k;
  }

  const titel = (spiel) => hs()?.titel?.(spiel) || mini()?.titel?.(spiel) || spiel;
  // Den Spielen mit Figur im Bild lässt sich zuschauen (dieselben, deren beste
  // Läufe sich anschauen lassen).
  const zuschaubar = (spiel) => Boolean(mini()?.ANSEHBAR?.[spiel]);
  const alleSpiele = () => (mini()?.SPIELE || []).map((s) => s.id);
  const serverJetzt = () => Date.now() + S.versatz;

  // Listen kommen aus der Realtime Database als Feld oder als Objekt mit
  // Zahlen als Schlüsseln zurück – je nachdem, ob Lücken darin sind.
  function liste(wert) {
    if (Array.isArray(wert)) return wert.filter((x) => x !== null && x !== undefined);
    if (wert && typeof wert === "object") return Object.keys(wert).sort((a, b) => Number(a) - Number(b)).map((k) => wert[k]);
    return [];
  }

  function liesJson(schluessel, ersatz) {
    try {
      const roh = JSON.parse(localStorage.getItem(schluessel) || "null");
      return roh ?? ersatz;
    } catch { return ersatz; }
  }

  function schreibeJson(schluessel, wert) {
    try { localStorage.setItem(schluessel, JSON.stringify(wert)); } catch { /* privater Modus */ }
  }

  // Ob auf diesem Gerät schon einmal der Admin angemeldet war (admin.js) –
  // dann steht der Weg zum Leiten da, auch wenn die Anmeldung gerade fehlt.
  function adminWarHier() {
    try { return Boolean(localStorage.getItem(ADMIN_KEY)); } catch { return false; }
  }

  function codeAusAdresse() {
    try {
      const code = String(new URLSearchParams(window.location.search).get("code") || "").trim().toUpperCase();
      return CODE_MUSTER.test(code) ? code : "";
    } catch { return ""; }
  }

  function neueAdresse(suche) {
    try { window.history.replaceState(null, "", `/live${suche}`); } catch { /* egal */ }
    window.LernappVollbild?.nachziehen?.();
  }

  function zufallsCode() {
    const zahlen = new Uint8Array(4);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(zahlen);
    else for (let i = 0; i < 4; i += 1) zahlen[i] = Math.floor(Math.random() * 256);
    return [...zahlen].map((n) => ZEICHEN[n % ZEICHEN.length]).join("");
  }

  function zufallsSaat() {
    const zahlen = new Uint32Array(1);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(zahlen);
    else zahlen[0] = Math.floor(Math.random() * 4294967296);
    return zahlen[0] >>> 0;
  }

  // Derselbe Streuwert wie in zufall.js: «alle Runden eines Spiels gleich»
  // heisst, die Saat hängt am Code und an der Stelle im Programm.
  function streuwert(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // ---------------------------------------------------------------------------
  // Firebase
  // ---------------------------------------------------------------------------
  function datenbank() {
    if (S.db) return S.db;
    const app = cloud()?.app?.();
    if (!app || !window.firebase?.database) {
      S.fehler = "Die Verbindung für den Live-Modus liess sich nicht aufbauen.";
      return null;
    }
    try {
      const db = window.firebase.database(app);
      if (TEST) {
        const [host, port] = TEST.emulator.split(":");
        const optionen = TEST.admin ? { mockUserToken: { sub: TEST.admin.uid, user_id: TEST.admin.uid, email: TEST.admin.email, email_verified: true } } : undefined;
        db.useEmulator(host, Number(port), optionen);
      }
      S.db = db;
      db.ref(".info/serverTimeOffset").on("value", (s) => { S.versatz = Number(s.val()) || 0; });
      db.ref(".info/connected").on("value", (s) => {
        S.verbunden = s.val() === true;
        if (S.verbunden && S.beigetreten) melden().catch(() => {});
        zeichneBald();
      });
    } catch (fehler) {
      console.warn("Die Realtime Database liess sich nicht öffnen", fehler);
      S.fehler = "Die Verbindung für den Live-Modus liess sich nicht aufbauen.";
      return null;
    }
    return S.db;
  }

  // Wer angemeldet ist. Auf dieser Seite nur, um zu wissen, ob hier der Admin
  // sitzt – angemeldet wird im Adminbereich, die Anmeldung gilt dann auch hier.
  function anmeldung() {
    if (TEST) {
      S.admin = Boolean(TEST.admin);
      S.uid = TEST.admin?.uid || null;
      return Promise.resolve();
    }
    const app = cloud()?.app?.();
    let auth = null;
    try { auth = app && window.firebase?.auth ? window.firebase.auth(app) : null; } catch { auth = null; }
    if (!auth) return Promise.resolve();
    return new Promise((fertig) => {
      let einmal = false;
      auth.onAuthStateChanged((nutzer) => {
        S.uid = nutzer?.uid || null;
        S.admin = Boolean(nutzer && nutzer.emailVerified && ADMINS.includes(String(nutzer.email || "").toLowerCase()));
        if (!einmal) { einmal = true; fertig(); } else zeichneBald();
      });
    });
  }

  const istLeitung = () => Boolean(S.admin && S.info && S.uid && S.info.host === S.uid);

  // ---------------------------------------------------------------------------
  // Das Programm und die Wertung
  // ---------------------------------------------------------------------------
  /*
   * Die Runden des Abends, der Reihe nach: je Spiel erst die Übungsrunden,
   * dann die, die zählen. Alle Geräte bauen dieselbe Liste aus info.
   */
  function plan(info = S.info) {
    const programm = liste(info?.programm);
    const e = info?.einstellungen || {};
    const raus = [];
    let zaehlt = 0;
    programm.forEach((p, i) => {
      const uebung = Math.max(0, Math.min(3, Number(p.uebung) || 0));
      const runden = Math.max(1, Math.min(9, Number(p.runden) || 1));
      for (let u = 0; u < uebung; u += 1) raus.push({ spiel: p.spiel, spielNr: i, uebung: true, i: u + 1, von: uebung });
      for (let r = 0; r < runden; r += 1) {
        zaehlt += 1;
        raus.push({ spiel: p.spiel, spielNr: i, uebung: false, i: r + 1, von: runden, zaehlNr: zaehlt, doppelt: Boolean(e.finaleDoppelt) && i === programm.length - 1 && programm.length > 1 });
      }
    });
    raus.forEach((r) => { r.zaehlVon = zaehlt; });
    return raus;
  }

  function rundenText(r) {
    if (!r) return "";
    if (r.uebung) return r.von > 1 ? `Übung ${r.i} von ${r.von}` : "Übung";
    return r.von > 1 ? `Runde ${r.i} von ${r.von}` : "Eine Runde";
  }

  function name(kennung) {
    return S.spieler?.[kennung]?.name || "?";
  }

  /*
   * Die Rundenpunkte einer Runde: wer wie viele Punkte hatte, auf welchem
   * Platz, und was das bringt. Gleich viele Punkte, gleicher Platz.
   *
   *   platz     10 · 8 · 6 · 5 · 4 · 3 · 2 · 1, dahinter je 1
   *   prozent   der Beste 100, alle anderen ihren Anteil an seiner Zahl
   *
   * Das Finale (doppelt) zählt zweimal.
   */
  function rundenWertung(nr, art, doppelt) {
    const eintraege = Object.entries(S.punkte?.[nr] || {})
      .filter(([, e]) => e && typeof e === "object")
      .map(([kennung, e]) => ({ kennung, name: name(kennung), p: Math.max(0, Number(e.p) || 0), fertig: Boolean(e.fertig) }));
    eintraege.sort((a, b) => b.p - a.p || a.name.localeCompare(b.name, "de"));
    const bester = eintraege.length ? eintraege[0].p : 0;
    let platz = 0;
    eintraege.forEach((e, i) => {
      if (i === 0 || e.p !== eintraege[i - 1].p) platz = i + 1;
      e.platz = platz;
      const wert = art === "prozent"
        ? (bester > 0 ? Math.round((e.p / bester) * 100) : 0)
        : (PLATZPUNKTE[platz - 1] ?? 1);
      e.punkte = wert * (doppelt ? 2 : 1);
    });
    return eintraege;
  }

  // Eine Runde, die noch läuft: alle, die dabei sind – auch die, die noch
  // nichts gemeldet haben –, nach ihren Punkten.
  function laufendeRunde(z) {
    const punkte = S.punkte?.[z.nr] || {};
    const eintraege = Object.keys(z.dabei || {}).map((kennung) => ({
      kennung,
      name: name(kennung),
      p: Math.max(0, Number(punkte[kennung]?.p) || 0),
      fertig: Boolean(punkte[kennung]?.fertig) || S.spieler?.[kennung]?.online === false,
    }));
    eintraege.sort((a, b) => b.p - a.p || a.name.localeCompare(b.name, "de"));
    let platz = 0;
    eintraege.forEach((e, i) => {
      if (i === 0 || e.p !== eintraege[i - 1].p) platz = i + 1;
      e.platz = platz;
    });
    return eintraege;
  }

  // Welche Runden schon gewertet sind: alle vor der laufenden, und die
  // laufende, sobald sie in der Auswertung ist.
  function gewerteteRunden() {
    const z = S.zustand;
    if (!z) return [];
    const p = plan();
    const bis = z.phase === "pause" || z.phase === "ende" ? z.nr : z.nr - 1;
    const raus = [];
    for (let nr = 0; nr <= bis && nr < p.length; nr += 1) if (!p[nr].uebung) raus.push(nr);
    return raus;
  }

  // Der Stand des Abends: die Rundenpunkte zusammengezählt.
  function gesamt(runden = gewerteteRunden()) {
    const art = S.info?.einstellungen?.wertung === "prozent" ? "prozent" : "platz";
    const p = plan();
    const personen = new Map();
    runden.forEach((nr) => {
      rundenWertung(nr, art, p[nr]?.doppelt).forEach((e) => {
        if (!personen.has(e.kennung)) personen.set(e.kennung, { kennung: e.kennung, name: e.name, punkte: 0, runden: 0, siege: 0 });
        const person = personen.get(e.kennung);
        person.punkte += e.punkte;
        person.runden += 1;
        if (e.platz === 1) person.siege += 1;
      });
    });
    const alle = [...personen.values()].sort((a, b) => b.punkte - a.punkte || b.siege - a.siege || a.name.localeCompare(b.name, "de"));
    let platz = 0;
    alle.forEach((person, i) => {
      if (i === 0 || person.punkte !== alle[i - 1].punkte || person.siege !== alle[i - 1].siege) platz = i + 1;
      person.platz = platz;
    });
    return alle;
  }

  // ---------------------------------------------------------------------------
  // Mitspielen
  // ---------------------------------------------------------------------------
  // Da sein: der eigene Eintrag in spieler, und – wenn die Verbindung abreisst
  // – von der Datenbank selbst auf «weg» gesetzt.
  async function melden() {
    const db = datenbank();
    if (!db || !S.ich || !S.code) return;
    const ref = db.ref(`live/${S.code}/spieler/${S.ich.kennung}`);
    // Erst da sein, dann das «weg» für später anmelden: Die Datenbank prüft
    // es schon jetzt, und ohne Eintrag fehlte ihm der Name.
    await ref.update({ name: S.ich.name, online: true, seit: window.firebase.database.ServerValue.TIMESTAMP });
    await ref.onDisconnect().update({ online: false });
  }

  async function beitreten() {
    const kennung = mini()?.kennung?.();
    const wer = mini()?.name?.();
    if (!kennung || !wer) return;
    S.ich = { kennung, name: wer };
    try {
      await melden();
      S.beigetreten = true;
      wachHalten();
    } catch (fehler) {
      console.warn("Beitreten ging nicht", fehler);
      S.fehler = "Beitreten hat nicht geklappt. Prüf die Verbindung und lade die Seite neu.";
    }
    zeichneBald();
  }

  async function verlassen() {
    try { await S.db?.ref(`live/${S.code}/spieler/${S.ich?.kennung}/online`).set(false); } catch { /* egal */ }
    window.location.href = "/";
  }

  // Der Bildschirm bleibt an, solange man im Live-Abend ist – wer zwischen
  // den Runden aufs Handy wartet, soll nicht aus dem Spiel fallen.
  async function wachHalten() {
    try {
      if (!navigator.wakeLock || document.visibilityState !== "visible") return;
      S.wachHalten = await navigator.wakeLock.request("screen");
    } catch { /* nicht erlaubt – dann eben nicht */ }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && (S.beigetreten || S.gross)) wachHalten();
  });

  // ---------------------------------------------------------------------------
  // Der Rahmen für das Spiel
  // ---------------------------------------------------------------------------
  /*
   * Was die Spielseite im Rahmen fragt und meldet (live-spiel.js). Dieselbe
   * Herkunft: Sie ruft diese Funktionen direkt auf.
   */
  window.LernappLiveRahmen = {
    runde(code, nr) {
      const z = S.zustand;
      if (code !== S.code || !z || z.phase !== "runde" || z.nr !== nr) return null;
      const r = plan()[nr];
      if (!r) return null;
      const dabei = Boolean(S.ich && z.dabei?.[S.ich.kennung]);
      if (!dabei && !S.zuschauen) return null;
      const namen = {};
      Object.entries(S.spieler || {}).forEach(([k, s]) => { namen[k] = s?.name || "?"; });
      return {
        code,
        nr,
        spiel: r.spiel,
        titel: titel(r.spiel),
        saat: Number(z.saat) >>> 0,
        startUm: Number(z.startUm) || 0,
        endeUm: Number(z.endeUm) || 0,
        uebung: r.uebung,
        countdown: Number(S.info?.einstellungen?.countdown) || 5,
        rundeText: r.uebung ? "" : `${r.zaehlNr} von ${r.zaehlVon}`,
        dabei: { ...(z.dabei || {}) },
        ich: S.ich ? { ...S.ich } : { kennung: "", name: "" },
        namen,
        gegner: S.info?.einstellungen?.gegner !== false,
        nurZuschauen: !dabei,
        gross: S.gross,
      };
    },
    // Das reine Zuschauen beenden (der Knopf «Schliessen» oben im Spiel).
    schliessen() {
      S.zuschauen = false;
      zeichneBald();
    },
    versatz: () => S.versatz,
    melde({ p, fertig, t }) {
      const nr = S.rahmen?.nr;
      if (!S.db || !S.ich || !S.rahmen?.dabei || nr === undefined || nr === null) return;
      S.db.ref(`live/${S.code}/punkte/${nr}/${S.ich.kennung}`)
        .set({ p: Math.max(0, Math.round(Number(p) || 0)), fertig: Boolean(fertig), t: Math.max(0, Math.round(Number(t) || 0)) })
        .catch((fehler) => console.warn("Die Punkte kamen nicht an", fehler));
    },
    lage({ t, a, b, c, p }) {
      const nr = S.rahmen?.nr;
      if (!S.db || !S.ich || !S.rahmen?.dabei || nr === undefined || nr === null) return;
      const zahl = (x) => Math.round(Number(x) || 0);
      S.db.ref(`live/${S.code}/lage/${S.ich.kennung}`)
        .set({ n: nr, t: zahl(t), a: zahl(a), b: zahl(b), c: zahl(c), p: zahl(p) })
        .catch(() => { /* die nächste kommt gleich */ });
    },
    hoere(fn) {
      S.hoerer.push(fn);
      try { fn(datenFuerRahmen()); } catch { /* egal */ }
      return () => { S.hoerer = S.hoerer.filter((x) => x !== fn); };
    },
  };

  function datenFuerRahmen() {
    const nr = S.rahmen?.nr;
    return { spieler: S.spieler || {}, punkte: (nr !== undefined && S.punkte?.[nr]) || {}, lage: S.lage || {} };
  }

  function funke() {
    if (!S.hoerer.length) return;
    const daten = datenFuerRahmen();
    S.hoerer = S.hoerer.filter((fn) => {
      try { fn(daten); return true; } catch { return false; }
    });
  }

  // Der Rahmen steht, solange eine Runde läuft, in der dieses Gerät dabei ist.
  function rahmenAbgleichen() {
    const z = S.zustand;
    const r = z ? plan()[z.nr] : null;
    // Zuschauen gilt nur für die Runde, in der es gewählt wurde.
    if (!z || z.phase !== "runde" || S.zuschauNr !== z.nr) {
      S.zuschauen = false;
      S.zuschauNr = z?.phase === "runde" ? z.nr : null;
    }
    // Das Grossbild schaut in jeder Runde mit Figur im Bild von selbst zu.
    if (S.gross && z?.phase === "runde" && r && zuschaubar(r.spiel)) S.zuschauen = true;
    const dabei = Boolean(S.beigetreten && S.ich && z?.dabei?.[S.ich.kennung]);
    const soll = Boolean(z && z.phase === "runde" && r && (dabei || (S.zuschauen && zuschaubar(r.spiel))));
    if (!soll) {
      if (S.rahmen) {
        S.rahmen.huelle.remove();
        S.rahmen = null;
        S.hoerer = [];
        S.leitungAuf = false;
        document.body.classList.remove("lv-im-spiel");
      }
      return;
    }
    if (S.rahmen && S.rahmen.nr === z.nr && S.rahmen.saat === z.saat && S.rahmen.dabei === dabei) return;
    if (S.rahmen) { S.rahmen.huelle.remove(); S.hoerer = []; }
    const huelle = el("div", "lv-rahmen");
    const frame = document.createElement("iframe");
    frame.className = "lv-frame";
    frame.title = titel(r.spiel);
    frame.setAttribute("allow", "autoplay; fullscreen; screen-wake-lock");
    // Ob das Gerät mitspielt oder nur zuschaut, fragt die Spielseite beim
    // Rahmen nach (runde, nurZuschauen) – nicht in der Adresse: ?zuschauen=
    // gehört dort dem Anschauen der besten Läufe (geist.js).
    frame.src = `${mini()?.spielLink?.(r.spiel) || "/"}?live=${encodeURIComponent(S.code)}&nr=${z.nr}`;
    huelle.append(frame);
    if (istLeitung()) huelle.append(leitungImSpiel());
    document.body.append(huelle);
    document.body.classList.add("lv-im-spiel");
    S.rahmen = { huelle, frame, nr: z.nr, saat: z.saat, dabei };
  }

  // Der kleine Knopf über dem Spiel, für die Leitung, die mitspielt.
  function leitungImSpiel() {
    const box = el("div", "lv-leitung");
    const auf = el("button", "lv-leitung-knopf", "Leitung");
    auf.type = "button";
    const menue = el("div", "lv-leitung-menue");
    menue.hidden = true;
    menue.append(
      knopf("Runde jetzt beenden", "mini-knopf-voll", () => { menue.hidden = true; rundeBeenden(); }),
      knopf("Abend beenden", "mini-knopf-still", () => { menue.hidden = true; abendBeenden(); }),
      knopf("Zurück ins Spiel", "mini-knopf-still", () => { menue.hidden = true; }),
    );
    auf.addEventListener("click", () => { menue.hidden = !menue.hidden; });
    box.append(auf, menue);
    return box;
  }

  // ---------------------------------------------------------------------------
  // Leiten
  // ---------------------------------------------------------------------------
  function setzeZustand(neu) {
    return S.db.ref(`live/${S.code}/zustand`).set(neu).catch((fehler) => {
      console.warn("Die Leitung konnte nicht schreiben", fehler);
      S.fehler = "Das ging nicht – bist du im Adminbereich angemeldet?";
      zeichneBald();
    });
  }

  const onlineSpieler = () => Object.entries(S.spieler || {}).filter(([, s]) => s && s.online).map(([k]) => k);

  // Die nächste Runde – oder, nach der letzten, das Podest.
  function naechsteRunde({ nochmal = false } = {}) {
    if (!istLeitung()) return;
    const z = S.zustand || { phase: "lobby", nr: -1 };
    const p = plan();
    const nr = nochmal ? z.nr : (z.phase === "lobby" ? 0 : z.nr + 1);
    if (nr >= p.length) { setzeZustand({ phase: "ende", nr: z.nr, seit: serverJetzt() }); return; }
    const r = p[nr];
    const e = S.info.einstellungen || {};
    const dabei = {};
    onlineSpieler().forEach((k) => { dabei[k] = true; });
    if (!Object.keys(dabei).length) { S.fehler = "Es ist niemand online."; zeichneBald(); return; }
    const saat = e.gleichesLevel && !r.uebung ? streuwert(`${S.code}|${r.spielNr}`) : zufallsSaat();
    const countdown = Math.max(3, Math.min(10, Number(e.countdown) || 5)) * 1000;
    const startUm = serverJetzt() + LADEZEIT_MS + countdown;
    const zeitlimit = Math.max(0, Number(e.zeitlimit) || 0) * 1000;
    const schreib = () => setzeZustand({ phase: "runde", nr, saat, startUm, endeUm: zeitlimit ? startUm + zeitlimit : 0, dabei, seit: serverJetzt() });
    // Eine wiederholte Runde fängt bei null an.
    if (nochmal) S.db.ref(`live/${S.code}/punkte/${nr}`).remove().then(schreib, schreib);
    else schreib();
  }

  function rundeBeenden() {
    const z = S.zustand;
    if (!istLeitung() || !z || z.phase !== "runde") return;
    setzeZustand({ ...z, phase: "pause", seit: serverJetzt() });
  }

  function abendBeenden() {
    const z = S.zustand || { nr: -1 };
    if (!istLeitung()) return;
    setzeZustand({ phase: "ende", nr: z.phase === "lobby" ? -1 : z.nr, seit: serverJetzt() });
  }

  async function abendLoeschen() {
    if (!istLeitung()) return;
    try {
      await S.db.ref(`live/${S.code}`).remove();
    } catch (fehler) {
      console.warn("Löschen ging nicht", fehler);
      S.fehler = "Löschen ging nicht.";
      zeichneBald();
      return;
    }
    window.location.href = "/live";
  }

  /*
   * Die Leitung schaut zweimal je Sekunde, ob die Runde vorbei ist: Alle, die
   * dabei sind, sind fertig oder weg – oder die Zeit ist um (mit etwas
   * Nachlauf für die letzten Ergebnisse). Und in der Auswertung, ob es von
   * selbst weitergeht.
   */
  function leitungTakt() {
    if (!istLeitung() || !S.zustand) return;
    const z = S.zustand;
    const jetzt = serverJetzt();
    if (z.phase === "runde") {
      const dabei = Object.keys(z.dabei || {});
      const punkte = S.punkte?.[z.nr] || {};
      const alleFertig = dabei.length > 0 && dabei.every((k) => punkte[k]?.fertig || S.spieler?.[k]?.online === false);
      const zeitUm = z.endeUm && jetzt > z.endeUm + NACHLAUF_MS;
      if ((alleFertig && jetzt > z.startUm + 1500) || zeitUm) rundeBeenden();
    } else if (z.phase === "pause" && S.info?.einstellungen?.weiter === "auto") {
      if (!S.autoWeiterAb) S.autoWeiterAb = Date.now() + AUTO_WEITER_MS;
      if (Date.now() >= S.autoWeiterAb) { S.autoWeiterAb = 0; naechsteRunde(); }
    }
    if (z.phase !== "pause") S.autoWeiterAb = 0;
  }
  window.setInterval(() => { leitungTakt(); if (S.zustand?.phase === "runde" || S.zustand?.phase === "pause") zeichneUhr(); }, 500);

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  function zeichneBald() {
    if (S.zeichnenGeplant) return;
    S.zeichnenGeplant = true;
    window.requestAnimationFrame(() => {
      S.zeichnenGeplant = false;
      zeichne();
    });
  }

  function kopf(text, untertitel) {
    const k = el("header", "mini-kopf lv-kopf");
    const links = el("div");
    const marke = el("p", "mini-marke lv-live");
    marke.append(el("span", "lv-punkt"), el("span", "", "Live"));
    links.append(marke, el("h1", "", text));
    if (untertitel) links.append(el("p", "lv-status", untertitel));
    k.append(links);
    if (S.code) k.append(el("span", "lv-code-klein", S.code));
    const voll = window.LernappVollbild?.knopf?.("mini-vollbild");
    if (voll) k.append(voll);
    return k;
  }

  function block(titelText, ...kinder) {
    const b = el("section", "mini-block lv-block");
    if (titelText) b.append(el("h2", "", titelText));
    kinder.filter(Boolean).forEach((k) => b.append(k));
    return b;
  }

  function hinweis(text, klasse = "") {
    return el("p", `mini-hinweis ${klasse}`.trim(), text);
  }

  function fehlerZeile() {
    if (!S.fehler) return null;
    const p = el("p", "lv-fehler", S.fehler);
    return p;
  }

  // Wer da ist – mit grünem Punkt, solange die Verbindung steht.
  function spielerListe() {
    const ul = el("ul", "lv-spieler");
    const alle = Object.entries(S.spieler || {}).filter(([, s]) => s && s.name)
      .sort(([, a], [, b]) => Number(Boolean(b.online)) - Number(Boolean(a.online)) || String(a.name).localeCompare(String(b.name), "de"));
    if (!alle.length) { ul.append(el("li", "lv-leer", "Noch niemand da.")); return ul; }
    alle.forEach(([k, s]) => {
      const li = el("li", s.online ? "ist-online" : "ist-weg");
      li.append(el("span", "lv-punkt-klein"), el("span", "lv-name", s.name));
      if (k === S.info?.hostKennung) li.append(el("span", "lv-marke-klein", "Leitung"));
      if (k === S.ich?.kennung) li.append(el("span", "lv-marke-klein ist-ich", "du"));
      ul.append(li);
    });
    return ul;
  }

  function programmListe() {
    const ol = el("ol", "lv-programm");
    const p = plan();
    const z = S.zustand;
    liste(S.info?.programm).forEach((eintrag, i) => {
      const li = el("li");
      const jetzt = z && z.nr >= 0 && p[z.nr]?.spielNr === i && z.phase !== "lobby" && z.phase !== "ende";
      if (jetzt) li.classList.add("ist-jetzt");
      li.append(el("span", "lv-name", titel(eintrag.spiel)));
      const teile = [];
      if (Number(eintrag.uebung) > 0) teile.push(Number(eintrag.uebung) === 1 ? "1 Übung" : `${eintrag.uebung} Übungen`);
      teile.push(Number(eintrag.runden) === 1 ? "1 Runde" : `${eintrag.runden} Runden`);
      if (S.info?.einstellungen?.finaleDoppelt && i === liste(S.info.programm).length - 1 && i > 0) teile.push("zählt doppelt");
      li.append(el("span", "lv-klein", teile.join(" · ")));
      ol.append(li);
    });
    return ol;
  }

  function einstellungsZeile() {
    const e = S.info?.einstellungen || {};
    const teile = [];
    const limit = Number(e.zeitlimit) || 0;
    teile.push(!limit ? "ohne Zeitlimit" : limit < 60 ? `${limit} s je Runde` : `${String(Math.round((limit / 60) * 10) / 10).replace(".", ",")} min je Runde`);
    teile.push(e.wertung === "prozent" ? "Prozent vom Besten" : "Platzpunkte 10 · 8 · 6 …");
    if (!e.zwischenstand) teile.push("Zwischenstand verdeckt");
    return el("p", "lv-klein lv-einstellungen", teile.join(" · "));
  }

  function standTabelle(personen, { mitRunde = null } = {}) {
    if (!personen.length) return hinweis("Noch keine Punkte.");
    const tabelle = el("table", "mini-tabelle lv-tabelle");
    const kopfZeile = el("tr");
    [["Spieler", ""], ["Punkte", "zahl"]].forEach(([w, k]) => kopfZeile.append(el("th", k, w)));
    if (mitRunde) kopfZeile.append(el("th", "zahl", "Runde"));
    const thead = el("thead");
    thead.append(kopfZeile);
    const tbody = el("tbody");
    personen.forEach((person) => {
      const tr = el("tr", `${person.platz === 1 ? "ist-erster" : ""}${person.kennung === S.ich?.kennung ? " ist-ich" : ""}`.trim());
      const td = el("td", "mini-tabelle-name");
      td.append(el("span", "mini-rangzahl", String(person.platz)), el("span", "", person.name));
      tr.append(td, el("td", "zahl lv-wert", String(person.punkte)));
      if (mitRunde) {
        const r = mitRunde.get(person.kennung);
        tr.append(el("td", "zahl lv-dazu", r ? `+${r.punkte}` : "–"));
      }
      tbody.append(tr);
    });
    tabelle.append(thead, tbody);
    return tabelle;
  }

  // zaehlt: falsch in der Übung – dann ohne Rundenpunkte. laeuft: während
  // der Runde, mit «spielt» bei denen, die noch dabei sind.
  function rundenTabelle(eintraege, { zaehlt = true, laeuft = false } = {}) {
    if (!eintraege.length) return hinweis("In dieser Runde hat niemand Punkte gemeldet.");
    const tabelle = el("table", "mini-tabelle lv-tabelle");
    const kopfZeile = el("tr");
    const spalten = [["Spieler", ""], ["Im Spiel", "zahl"]];
    if (zaehlt && !laeuft) spalten.push(["Punkte", "zahl"]);
    spalten.forEach(([w, k]) => kopfZeile.append(el("th", k, w)));
    const thead = el("thead");
    thead.append(kopfZeile);
    const tbody = el("tbody");
    eintraege.forEach((e) => {
      const tr = el("tr", `${e.platz === 1 ? "ist-erster" : ""}${e.kennung === S.ich?.kennung ? " ist-ich" : ""}`.trim());
      const td = el("td", "mini-tabelle-name");
      td.append(el("span", "mini-rangzahl", String(e.platz)), el("span", "", e.name));
      if (laeuft && !e.fertig) td.append(el("span", "lv-marke-klein lv-spielt-noch", "spielt"));
      tr.append(td, el("td", "zahl", String(e.p)));
      if (zaehlt && !laeuft) tr.append(el("td", "zahl lv-dazu", `+${e.punkte}`));
      tbody.append(tr);
    });
    tabelle.append(thead, tbody);
    return tabelle;
  }

  // Die ersten drei auf dem Treppchen.
  function podest(personen) {
    const box = el("div", "lv-podest");
    [1, 0, 2].forEach((i) => {
      const person = personen[i];
      const stufe = el("div", `lv-stufe lv-stufe-${i + 1}`);
      if (person) {
        stufe.append(el("span", "lv-podest-name", person.name), el("span", "lv-podest-wert", `${person.punkte}`));
      }
      stufe.append(el("span", "lv-podest-platz", person ? String(person.platz) : String(i + 1)));
      box.append(stufe);
    });
    return box;
  }

  // Die Uhr in der Auswertung und unter einer laufenden Runde, ohne alles neu
  // zu bauen.
  function zeichneUhr() {
    const z = S.zustand;
    const uhr = S.wirt?.querySelector("[data-lv-uhr]");
    if (!uhr || !z) return;
    if (z.phase === "runde") {
      const jetzt = serverJetzt();
      if (jetzt < z.startUm) uhr.textContent = `Start in ${Math.ceil((z.startUm - jetzt) / 1000)} s`;
      else if (z.endeUm) uhr.textContent = `Noch ${Math.max(0, Math.ceil((z.endeUm - jetzt) / 1000))} s`;
      else uhr.textContent = "Läuft, bis alle fertig sind";
    } else if (z.phase === "pause" && S.autoWeiterAb) {
      uhr.textContent = `Weiter in ${Math.max(0, Math.ceil((S.autoWeiterAb - Date.now()) / 1000))} s`;
    } else uhr.textContent = "";
  }

  // --- Die einzelnen Ansichten ----------------------------------------------
  function zeichneEinstieg() {
    const w = S.wirt;
    w.replaceChildren(kopf("Live-Abend", "Alle spielen zur selben Zeit dasselbe Level."));
    const form = el("form", "lv-beitreten");
    const feld = el("input", "lv-code-feld");
    feld.id = "lv-code";
    feld.maxLength = 4;
    feld.autocomplete = "off";
    feld.setAttribute("autocapitalize", "characters");
    feld.spellcheck = false;
    feld.placeholder = "CODE";
    feld.setAttribute("aria-label", "Code des Live-Abends");
    feld.addEventListener("input", () => { feld.value = feld.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });
    const los = el("button", "mini-knopf mini-knopf-voll", "Beitreten");
    los.type = "submit";
    form.append(feld, los);
    const meldung = el("p", "lv-klein");
    form.addEventListener("submit", (ereignis) => {
      ereignis.preventDefault();
      const code = feld.value.trim().toUpperCase();
      if (!CODE_MUSTER.test(code)) { meldung.textContent = "Der Code hat vier Zeichen – Buchstaben und Ziffern."; feld.focus(); return; }
      neueAdresse(`?code=${code}`);
      starteAbend(code);
    });
    w.append(block("Beitreten", el("p", "lv-klein", "Den Code sagt dir, wer den Abend leitet."), form, meldung));

    if (S.admin) {
      w.append(block("Leiten", el("p", "lv-klein", "Programm zusammenstellen, Lobby öffnen, alle starten zusammen. Du kannst selbst mitspielen."),
        knopf("Neuen Live-Abend anlegen", "mini-knopf-voll", () => { neueAdresse("?neu"); zeichneFormular(); })));
    } else if (adminWarHier()) {
      const weg = el("a", "lv-klein lv-link", "Leiten? Erst im Adminbereich anmelden.");
      weg.href = "/admin";
      w.append(weg);
    }
    const zurueck = el("a", "lv-klein lv-link", "Zur Startseite");
    zurueck.href = "/";
    w.append(zurueck);
  }

  function zeichneName() {
    const w = S.wirt;
    w.replaceChildren(kopf(S.info?.name || "Live-Abend", `Code ${S.code}`));
    const form = el("form", "lv-beitreten");
    const feld = el("input", "lv-name-feld");
    feld.id = "lv-name";
    feld.maxLength = mini()?.NAME_MAX || 24;
    feld.autocomplete = "nickname";
    feld.placeholder = "Dein Name";
    feld.setAttribute("aria-label", "Dein Name");
    const los = el("button", "mini-knopf mini-knopf-voll", "Mitspielen");
    los.type = "submit";
    form.append(feld, los);
    form.addEventListener("submit", (ereignis) => {
      ereignis.preventDefault();
      const gesetzt = mini()?.setzeName?.(feld.value);
      if (!gesetzt) { feld.focus(); return; }
      beitreten();
    });
    w.append(block("Wie heisst du?", el("p", "lv-klein", "So stehst du in der Liste – hier und in der Hall of Fame."), form));
    window.setTimeout(() => feld.focus(), 50);
  }

  function zeichneLobby() {
    const w = S.wirt;
    const leitung = istLeitung();
    w.replaceChildren(kopf(S.info.name, leitung ? "Du leitest diesen Abend." : "Gleich geht es los."));
    const fehler = fehlerZeile();
    if (fehler) w.append(fehler);

    if (leitung) {
      const adresse = `${window.location.origin}/live?code=${S.code}`;
      const code = el("p", "lv-code-gross", S.code);
      const link = el("p", "lv-link-text", adresse.replace(/^https?:\/\//, ""));
      const teilen = el("div", "lv-knoepfe");
      teilen.append(knopf("Link kopieren", "mini-knopf-still", async (ereignis) => {
        const k = ereignis.currentTarget;
        try { await navigator.clipboard.writeText(adresse); k.textContent = "Kopiert!"; }
        catch { k.textContent = adresse; }
      }));
      if (navigator.share) {
        teilen.append(knopf("Teilen", "mini-knopf-still", () => {
          navigator.share({ title: S.info.name, text: `Live-Abend «${S.info.name}» – Code ${S.code}`, url: adresse }).catch(() => {});
        }));
      }
      const gross = el("a", "lv-klein lv-link", "Grossbild für Fernseher oder Beamer öffnen");
      gross.href = `/live?code=${S.code}&gross`;
      gross.target = "_blank";
      gross.rel = "noopener";
      w.append(block("So kommen alle rein", el("p", "lv-klein", "Auf der Startseite «Live» antippen und den Code eingeben – oder den Link öffnen."), code, link, teilen, gross));
    } else if (S.gross) {
      w.append(block("So kommst du rein", el("p", "lv-klein", "Auf der Startseite «Live» antippen und diesen Code eingeben:"), el("p", "lv-code-gross", S.code)));
    }

    const online = onlineSpieler().length;
    w.append(block(`Dabei (${online})`, spielerListe()));
    w.append(block("Programm", programmListe(), einstellungsZeile()));

    const aktionen = el("div", "lv-knoepfe lv-unten");
    if (leitung) {
      const start = knopf("Start", "mini-knopf-voll lv-start-knopf", () => naechsteRunde());
      start.disabled = !online;
      aktionen.append(start, knopf("Abend absagen", "mini-knopf-still", () => {
        if (window.confirm?.("Den Live-Abend absagen und löschen?") === false) return;
        abendLoeschen();
      }));
    } else if (S.gross) {
      aktionen.append(el("p", "lv-warten", "Gleich geht es los …"));
    } else {
      aktionen.append(el("p", "lv-warten", "Warte auf den Start …"), knopf("Verlassen", "mini-knopf-still", verlassen));
    }
    w.append(aktionen);
  }

  function zeichneRunde() {
    const w = S.wirt;
    const z = S.zustand;
    const r = plan()[z.nr];
    const leitung = istLeitung();
    const dabei = Boolean(S.ich && z.dabei?.[S.ich.kennung]);
    w.replaceChildren(kopf(S.info.name, `${titel(r?.spiel)} · ${rundenText(r)}`));
    const fehler = fehlerZeile();
    if (fehler) w.append(fehler);
    const uhr = el("p", "lv-uhr-text");
    uhr.dataset.lvUhr = "";
    w.append(uhr);
    if (!dabei && !S.gross) {
      const satz = S.info?.einstellungen?.nachzuegler === false
        ? "Diese Runde läuft schon. Du schaust zu."
        : "Diese Runde läuft schon – ab der nächsten spielst du mit.";
      w.append(hinweis(satz));
      if (r && zuschaubar(r.spiel)) {
        const box = el("div", "lv-knoepfe lv-unten");
        box.append(knopf("Zuschauen", "mini-knopf-voll", () => { S.zuschauen = true; S.zuschauNr = z.nr; zeichneBald(); }));
        w.append(box);
      }
    }
    w.append(block("So steht es gerade", rundenTabelle(laufendeRunde(z), { laeuft: true })));
    if (leitung && !dabei) {
      const aktionen = el("div", "lv-knoepfe lv-unten");
      aktionen.append(knopf("Runde jetzt beenden", "mini-knopf-voll", rundeBeenden), knopf("Abend beenden", "mini-knopf-still", abendBeenden));
      w.append(aktionen);
    }
    zeichneUhr();
  }

  function zeichnePause() {
    const w = S.wirt;
    const z = S.zustand;
    const p = plan();
    const r = p[z.nr];
    const leitung = istLeitung();
    const e = S.info.einstellungen || {};
    w.replaceChildren(kopf(S.info.name, `${titel(r?.spiel)} · ${rundenText(r)} – vorbei`));
    const fehler = fehlerZeile();
    if (fehler) w.append(fehler);

    const art = e.wertung === "prozent" ? "prozent" : "platz";
    const runde = rundenWertung(z.nr, art, r?.doppelt);
    w.append(block(r?.uebung ? "Übungsrunde – zählt nicht" : `Ergebnis${r?.doppelt ? " (zählt doppelt)" : ""}`, rundenTabelle(runde, { zaehlt: !r?.uebung })));

    if (e.zwischenstand !== false || leitung) {
      const dazu = new Map(r?.uebung ? [] : runde.map((x) => [x.kennung, x]));
      const stand = gesamt();
      w.append(block(e.zwischenstand === false ? "Zwischenstand (nur für dich als Leitung)" : "Zwischenstand", standTabelle(stand, { mitRunde: dazu })));
    } else {
      w.append(block("Zwischenstand", hinweis("Der Zwischenstand bleibt bis zum Schluss verdeckt.")));
    }

    const naechste = p[z.nr + 1];
    w.append(el("p", "lv-weiter-text", naechste ? `Als Nächstes: ${titel(naechste.spiel)} · ${rundenText(naechste)}` : "Das war die letzte Runde."));
    const uhr = el("p", "lv-uhr-text");
    uhr.dataset.lvUhr = "";
    w.append(uhr);

    const aktionen = el("div", "lv-knoepfe lv-unten");
    if (leitung) {
      aktionen.append(knopf(naechste ? "Weiter" : "Zum Podest", "mini-knopf-voll", () => naechsteRunde()));
      aktionen.append(knopf("Runde wiederholen", "mini-knopf-still", () => naechsteRunde({ nochmal: true })));
      if (naechste) aktionen.append(knopf("Abend beenden", "mini-knopf-still", abendBeenden));
    } else {
      aktionen.append(el("p", "lv-warten", "Gleich geht es weiter …"));
    }
    w.append(aktionen);
    zeichneUhr();
  }

  function zeichneEnde() {
    const w = S.wirt;
    const leitung = istLeitung();
    const stand = gesamt();
    S.letzteWertung = stand;
    w.replaceChildren(kopf(S.info.name, "Der Endstand"));
    const fehler = fehlerZeile();
    if (fehler) w.append(fehler);
    if (stand.length) {
      w.append(podest(stand));
      w.append(block("Endstand", standTabelle(stand)));
    } else {
      w.append(hinweis("Es wurde keine Runde gewertet."));
    }
    const aktionen = el("div", "lv-knoepfe lv-unten");
    if (leitung) {
      aktionen.append(knopf("Abend abschliessen", "mini-knopf-voll", abendLoeschen));
    }
    const heim = el("a", "mini-knopf mini-knopf-still", "Zur Startseite");
    heim.href = "/";
    aktionen.append(heim);
    w.append(aktionen);
  }

  function zeichneVorbei() {
    const w = S.wirt;
    w.replaceChildren(kopf(S.info?.name || "Live-Abend", "Dieser Live-Abend ist vorbei."));
    if (S.letzteWertung?.length) {
      w.append(podest(S.letzteWertung));
      w.append(block("Endstand", standTabelle(S.letzteWertung)));
    }
    const heim = el("a", "mini-knopf mini-knopf-voll", "Zur Startseite");
    heim.href = "/";
    const box = el("div", "lv-knoepfe lv-unten");
    box.append(heim);
    w.append(box);
  }

  function zeichneUnbekannt() {
    const w = S.wirt;
    w.replaceChildren(kopf("Live-Abend", `Code ${S.code}`));
    w.append(hinweis("Zu diesem Code gibt es keinen Live-Abend. Vielleicht ist er schon vorbei – oder ein Zeichen stimmt nicht."));
    const box = el("div", "lv-knoepfe lv-unten");
    box.append(knopf("Anderen Code eingeben", "mini-knopf-voll", () => { S.code = ""; neueAdresse(""); zeichneEinstieg(); }));
    w.append(box);
  }

  function zeichne() {
    if (!S.wirt) return;
    rahmenAbgleichen();
    window.LernappBusy = () => Boolean((S.beigetreten || S.gross) && S.zustand && S.zustand.phase !== "ende");
    S.wirt.classList.toggle("lv-grossbild", S.gross);
    if (!S.code) return;
    if (!S.infoGeladen) {
      S.wirt.replaceChildren(kopf("Live-Abend", `Code ${S.code}`), hinweis(S.fehler || "Der Live-Abend wird geladen …"));
      return;
    }
    if (!S.info) { if (S.warDa) zeichneVorbei(); else zeichneUnbekannt(); return; }
    // Das Grossbild tritt nicht bei: Es zeigt nur, was alle sehen sollen.
    if (S.gross) {
      if (!S.wachHalten) wachHalten();
      const phase = S.zustand?.phase || "lobby";
      if (phase === "runde") zeichneRunde();
      else if (phase === "pause") zeichnePause();
      else if (phase === "ende") zeichneEnde();
      else zeichneLobby();
      return;
    }
    if (!S.ich || !S.beigetreten) {
      if (!mini()?.name?.()) { zeichneName(); return; }
      const begonnen = S.zustand && S.zustand.phase !== "lobby";
      if (begonnen && S.info.einstellungen?.nachzuegler === false && !S.spieler?.[mini()?.kennung?.()]) {
        S.wirt.replaceChildren(kopf(S.info.name, "Dieser Live-Abend hat schon begonnen."), hinweis("Hier kommt niemand mehr dazu. Beim nächsten Mal!"));
        return;
      }
      S.wirt.replaceChildren(kopf(S.info.name, "Du trittst bei …"));
      const fehler = fehlerZeile();
      if (fehler) S.wirt.append(fehler, knopf("Nochmal versuchen", "mini-knopf-voll", () => { S.ich = null; S.fehler = ""; zeichne(); }));
      if (!S.ich) beitreten();
      return;
    }
    const phase = S.zustand?.phase || "lobby";
    if (phase === "runde") zeichneRunde();
    else if (phase === "pause") zeichnePause();
    else if (phase === "ende") zeichneEnde();
    else zeichneLobby();
  }

  // ---------------------------------------------------------------------------
  // Einen Live-Abend anlegen
  // ---------------------------------------------------------------------------
  function zeichneFormular() {
    const w = S.wirt;
    if (!S.admin) { zeichneEinstieg(); return; }
    const vorlage = { ...STANDARD, ...liesJson(ZULETZT_KEY, {}) };
    vorlage.einstellungen = { ...STANDARD.einstellungen, ...(vorlage.einstellungen || {}) };
    let programm = liste(vorlage.programm).filter((p) => alleSpiele().includes(p.spiel));
    if (!programm.length) programm = [...STANDARD.programm];

    w.replaceChildren(kopf("Neuer Live-Abend", "Programm und Einstellungen – in der Lobby siehst du alles noch einmal."));
    const form = el("form", "lv-formular");

    const feld = (beschriftung, eingabe, hilfe) => {
      const box = el("label", "lv-feld");
      box.append(el("span", "lv-feld-name", beschriftung), eingabe);
      if (hilfe) box.append(el("span", "lv-klein", hilfe));
      return box;
    };
    const auswahl = (id, optionen, wert) => {
      const s = el("select");
      s.id = id;
      optionen.forEach(([v, t]) => {
        const o = el("option", "", t);
        o.value = String(v);
        if (String(v) === String(wert)) o.selected = true;
        s.append(o);
      });
      return s;
    };
    const haken = (id, text, an) => {
      const box = el("label", "lv-haken");
      const k = el("input");
      k.type = "checkbox";
      k.id = id;
      k.checked = Boolean(an);
      box.append(k, el("span", "", text));
      return box;
    };

    // Vorlagen: gespeicherte Programme auf diesem Gerät.
    const vorlagen = liesJson(VORLAGEN_KEY, []);
    if (Array.isArray(vorlagen) && vorlagen.length) {
      const wahl = auswahl("lv-vorlage", [["", "– Vorlage laden –"], ...vorlagen.map((v, i) => [i, v.name])], "");
      wahl.addEventListener("change", () => {
        const v = vorlagen[Number(wahl.value)];
        if (!v) return;
        schreibeJson(ZULETZT_KEY, v);
        zeichneFormular();
      });
      form.append(feld("Vorlage", wahl));
    }

    const nameFeld = el("input");
    nameFeld.id = "lv-abend-name";
    nameFeld.maxLength = 60;
    nameFeld.value = vorlage.name || "Live-Abend";
    form.append(feld("Name des Abends", nameFeld));

    // Das Programm: Spiele in ihrer Reihenfolge, je mit Runden und Übungen.
    const programmBox = el("div", "lv-programm-form");
    const zeilen = el("div", "lv-zeilen");
    const zeileBauen = (eintrag) => {
      const zeile = el("div", "lv-zeile");
      const spiel = auswahl("", alleSpiele().map((id) => [id, titel(id)]), eintrag.spiel);
      spiel.className = "lv-spiel-wahl";
      spiel.setAttribute("aria-label", "Spiel");
      const runden = auswahl("", [1, 2, 3, 4, 5].map((n) => [n, n === 1 ? "1 Runde" : `${n} Runden`]), eintrag.runden || 1);
      runden.className = "lv-runden-wahl";
      runden.setAttribute("aria-label", "Runden");
      const uebung = auswahl("", [[0, "ohne Übung"], [1, "1 Übung"], [2, "2 Übungen"]], eintrag.uebung || 0);
      uebung.className = "lv-uebung-wahl";
      uebung.setAttribute("aria-label", "Übungsrunden");
      const hoch = knopf("↑", "mini-knopf-still lv-klein-knopf", () => { const vor = zeile.previousElementSibling; if (vor) zeilen.insertBefore(zeile, vor); });
      hoch.setAttribute("aria-label", "Nach oben");
      const weg = knopf("✕", "mini-knopf-still lv-klein-knopf", () => { if (zeilen.children.length > 1) zeile.remove(); });
      weg.setAttribute("aria-label", "Entfernen");
      zeile.append(spiel, runden, uebung, hoch, weg);
      return zeile;
    };
    programm.forEach((p) => zeilen.append(zeileBauen(p)));
    programmBox.append(zeilen, knopf("Spiel hinzufügen", "mini-knopf-still", () => {
      const vorhanden = new Set([...zeilen.querySelectorAll(".lv-spiel-wahl")].map((s) => s.value));
      const frei = alleSpiele().find((id) => !vorhanden.has(id)) || alleSpiele()[0];
      zeilen.append(zeileBauen({ spiel: frei, runden: 2, uebung: 1 }));
    }));
    form.append(block("Programm", programmBox));

    const e = vorlage.einstellungen;
    const einstellungen = el("div", "lv-einstellungs-form");
    einstellungen.append(
      feld("Zeitlimit je Runde", auswahl("lv-zeitlimit", [[0, "ohne – bis alle fertig sind"], [30, "30 Sekunden"], [60, "1 Minute"], [90, "1½ Minuten"], [120, "2 Minuten"], [180, "3 Minuten"], [300, "5 Minuten"]], e.zeitlimit)),
      feld("Punkte je Runde", auswahl("lv-wertung", [["platz", "Platzpunkte 10 · 8 · 6 · 5 · 4 · 3 · 2 · 1"], ["prozent", "Prozent vom Besten"]], e.wertung)),
      feld("Level", auswahl("lv-level", [["neu", "jede Runde ein neues"], ["gleich", "alle Runden eines Spiels gleich"]], e.gleichesLevel ? "gleich" : "neu"), "Immer für alle dasselbe."),
      feld("Countdown", auswahl("lv-countdown", [[3, "3 Sekunden"], [5, "5 Sekunden"], [10, "10 Sekunden"]], e.countdown)),
      feld("Nach jeder Runde", auswahl("lv-weiter", [["leitung", "ich drücke «Weiter»"], ["auto", "automatisch nach 15 Sekunden"]], e.weiter)),
      haken("lv-finale", "Das letzte Spiel zählt doppelt (Finale)", e.finaleDoppelt),
      haken("lv-zwischenstand", "Zwischenstand nach jeder Runde zeigen", e.zwischenstand !== false),
      haken("lv-nachzuegler", "Nachzügler dürfen ab der nächsten Runde mitspielen", e.nachzuegler !== false),
      haken("lv-gegner", "Die anderen live im Bild zeigen", e.gegner !== false),
    );
    form.append(block("Einstellungen", einstellungen));

    const meldung = el("p", "lv-fehler");
    meldung.hidden = true;
    const aktionen = el("div", "lv-knoepfe lv-unten");
    const oeffnen = el("button", "mini-knopf mini-knopf-voll", "Lobby öffnen");
    oeffnen.type = "submit";
    aktionen.append(oeffnen, knopf("Als Vorlage speichern", "mini-knopf-still", () => {
      const daten = lies();
      const liste2 = liesJson(VORLAGEN_KEY, []);
      const neu = Array.isArray(liste2) ? liste2.filter((v) => v.name !== daten.name) : [];
      neu.unshift(daten);
      schreibeJson(VORLAGEN_KEY, neu.slice(0, 12));
      meldung.hidden = false;
      meldung.className = "lv-ok";
      meldung.textContent = `Vorlage «${daten.name}» gespeichert.`;
    }), knopf("Abbrechen", "mini-knopf-still", () => { neueAdresse(""); zeichneEinstieg(); }));
    form.append(meldung, aktionen);

    function lies() {
      const programm2 = [...zeilen.querySelectorAll(".lv-zeile")].map((z) => ({
        spiel: z.querySelector(".lv-spiel-wahl").value,
        runden: Number(z.querySelector(".lv-runden-wahl").value) || 1,
        uebung: Number(z.querySelector(".lv-uebung-wahl").value) || 0,
      }));
      const wert = (id) => form.querySelector(`#${id}`);
      return {
        name: (nameFeld.value || "").replace(/\s+/g, " ").trim().slice(0, 60) || "Live-Abend",
        programm: programm2,
        einstellungen: {
          zeitlimit: Number(wert("lv-zeitlimit").value) || 0,
          wertung: wert("lv-wertung").value === "prozent" ? "prozent" : "platz",
          gleichesLevel: wert("lv-level").value === "gleich",
          countdown: Number(wert("lv-countdown").value) || 5,
          weiter: wert("lv-weiter").value === "auto" ? "auto" : "leitung",
          finaleDoppelt: wert("lv-finale").checked,
          zwischenstand: wert("lv-zwischenstand").checked,
          nachzuegler: wert("lv-nachzuegler").checked,
          gegner: wert("lv-gegner").checked,
        },
      };
    }

    form.addEventListener("submit", async (ereignis) => {
      ereignis.preventDefault();
      const daten = lies();
      schreibeJson(ZULETZT_KEY, daten);
      oeffnen.disabled = true;
      oeffnen.textContent = "Wird geöffnet …";
      try {
        const code = await anlegen(daten);
        neueAdresse(`?code=${code}`);
        starteAbend(code);
      } catch (fehler) {
        console.warn("Anlegen ging nicht", fehler);
        meldung.hidden = false;
        meldung.className = "lv-fehler";
        meldung.textContent = "Das ging nicht. Bist du im Adminbereich angemeldet?";
        oeffnen.disabled = false;
        oeffnen.textContent = "Lobby öffnen";
      }
    });
    w.append(form);
  }

  // Einen freien Code suchen und den Abend anlegen.
  async function anlegen(daten) {
    const db = datenbank();
    if (!db || !S.uid) throw new Error("nicht angemeldet");
    for (let versuch = 0; versuch < 8; versuch += 1) {
      const code = zufallsCode();
      const ref = db.ref(`live/${code}`);
      const da = await ref.child("info").get();
      if (da.exists()) continue;
      const info = {
        name: daten.name,
        host: S.uid,
        hostKennung: mini()?.kennung?.() || "",
        erstellt: window.firebase.database.ServerValue.TIMESTAMP,
        programm: daten.programm,
        einstellungen: daten.einstellungen,
      };
      if (!info.hostKennung) delete info.hostKennung;
      await ref.set({ info, zustand: { phase: "lobby", nr: -1 } });
      return code;
    }
    throw new Error("Kein freier Code gefunden");
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  let abo = null;

  function starteAbend(code) {
    const db = datenbank();
    S.code = code;
    S.info = null;
    S.infoGeladen = false;
    S.zustand = null;
    S.spieler = {};
    S.punkte = {};
    S.lage = {};
    S.fehler = db ? "" : S.fehler;
    zeichne();
    if (!db) return;
    abo?.();
    const basis = db.ref(`live/${code}`);
    const lesefehler = (fehler) => {
      console.warn("Der Live-Abend war nicht zu lesen", fehler);
      S.fehler = "Der Live-Abend war nicht zu lesen.";
      S.infoGeladen = true;
      zeichneBald();
    };
    const teile = [
      ["info", (s) => { S.info = s.val(); S.infoGeladen = true; if (S.info) S.warDa = true; zeichneBald(); }],
      ["zustand", (s) => { S.zustand = s.val(); S.fehler = ""; zeichneBald(); }],
      ["spieler", (s) => { S.spieler = s.val() || {}; zeichneBald(); funke(); }],
      ["punkte", (s) => {
        S.punkte = s.val() || {};
        // Während einer Runde, in der dieses Gerät spielt, liegt das Spiel
        // über der Seite – neu zeichnen braucht es darunter nichts.
        if (!S.rahmen) zeichneBald();
        funke();
      }],
      ["lage", (s) => { S.lage = s.val() || {}; funke(); }],
    ];
    teile.forEach(([pfad, fn]) => basis.child(pfad).on("value", fn, lesefehler));
    abo = () => teile.forEach(([pfad, fn]) => basis.child(pfad).off("value", fn));
  }

  async function starte() {
    S.wirt = document.querySelector("[data-live]");
    if (!S.wirt) return;
    S.wirt.replaceChildren(kopf("Live-Abend"), hinweis("Wird geladen …"));
    await anmeldung();
    datenbank();
    const code = codeAusAdresse();
    try { S.gross = new URLSearchParams(window.location.search).has("gross"); } catch { S.gross = false; }
    if (code) { starteAbend(code); return; }
    let neu = false;
    try { neu = new URLSearchParams(window.location.search).has("neu"); } catch { neu = false; }
    if (neu && S.admin) zeichneFormular();
    else zeichneEinstieg();
  }

  window.LernappLive = {
    plan, rundenWertung, gesamt, PLATZPUNKTE,
    // Für die Prüfung im Browser.
    stand: () => ({ code: S.code, phase: S.zustand?.phase || "", nr: S.zustand?.nr ?? null, leitung: istLeitung(), beigetreten: S.beigetreten, rahmen: Boolean(S.rahmen), versatz: S.versatz }),
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", starte);
  else starte();
})();
