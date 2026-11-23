/*
 * zwei.js – Der Rahmen der Spiele zu zweit.
 * ---------------------------------------------------------------------------
 * Alles, was die Spiele zu zweit (mini-games.js, ZWEI_SPIELER) gemeinsam
 * haben, steht hier: das Menü, der Computer als Gegner, das Duell auf zwei
 * Geräten, der Warteraum, die vier Ziffern zum Abtippen, im Turnier der
 * grosse Knopf «Mit Lena spielen», die Bilanz, die Töne. Ein Spiel bringt
 * nur mit, was es von den anderen unterscheidet: sein Brett, seine Regeln,
 * seinen Computer. Es meldet sich mit LernappZwei.starte({ … }) an (siehe
 * unten, «Was ein Spiel mitbringt»).
 *
 * Das Aussehen hat mit Viererreihe begonnen; die Klassen heissen darum vr-…
 * (styles.css, «Viererreihe»), für alle Spiele dieselben.
 *
 * Die Wege: die Adresse sagt, wo man ist.
 *
 *   /<seite>                     das Menü
 *   /<seite>?gegen=mittel        eine Partie gegen den Computer
 *   /<seite>?raum=K7QMX2PA9Z     ein Duell (zehn Zeichen, nicht zu erraten)
 *   …&turnier=herbst-k3m9x2p7   dasselbe im Turnier: Der Weg zurück führt
 *                                dorthin, und wer eröffnet, steht bei den
 *                                anderen als «Mit Lena spielen»
 *   …&von=admin                  aus dem Adminbereich ausprobiert
 *
 * Das Duell steht in der Realtime Database (database.rules.json), für alle
 * Spiele am selben Ort:
 *
 *   partie/<raum>
 *     info              spiel (welches), erstellt                einmal
 *     code              die vier Ziffern zum Abtippen            einmal
 *     a                 wer eröffnet hat: kennung, name, online, seit
 *     b                 wer dazukam: dasselbe – ist b besetzt, ist der
 *                       Raum voll, und wer jetzt noch kommt, schaut zu
 *     stand             zuege (die Züge der Partie als Text), beginnt (a
 *                       oder b), serie (wie die Partien davor ausgingen: a,
 *                       b, u …), nr, saat (für Spiele, die würfeln)
 *   partieCode/<code>   raum, spiel, bis – wohin die vier Ziffern führen
 *   partieOffen/<turnier>/<raum>   name, kennung, spiel, seit – wer im
 *                       Turnier gerade wartet. Verschwindet, sobald jemand
 *                       dazukommt, der Wartende geht oder seine Verbindung
 *                       abreisst (onDisconnect).
 *
 * Gerechnet wird nichts in der Datenbank. Ein Zug ist eine Transaktion, die
 * an zuege etwas anhängt – nur wenn das Spiel ihn auf dem Stand erlaubt, den
 * die Datenbank gerade hat (darf). Die Regeln lassen nichts anderes zu als
 * mehr Züge oder eine neue Partie. Jedes Gerät baut aus zuege dasselbe Bild
 * und kommt auf denselben Ausgang.
 *
 * Was ein Spiel mitbringt (LernappZwei.starte):
 *
 *   id, titel, seite     «tictactoe», «Tic Tac Toe», «tictactoe»
 *   unter                der Satz unter dem Namen im Menü
 *   held()               das Bild im Menü (ein Element)
 *   stufen               { leicht: { name, sterne, satz }, … } – oder null,
 *                        dann gibt es keinen Computer
 *   trenner              wie die Züge in zuege getrennt sind: "" (ein
 *                        Zeichen je Zug, wie Viererreihe) oder "." (Vorgabe)
 *   lage(zuege, { roh, beginnt, saat, stufe })
 *                        → { dran: "a" | "b" | "beide" | null,
 *                            ende: null | "a" | "b" | "u", … }
 *                        stufe: gegen den Computer die Stufe, im Duell null
 *   gemeinsam            true: Beide spielen miteinander, nicht gegeneinander.
 *                        Dann endet eine Partie mit «g» (geschafft) oder «v»
 *                        (verpasst), die Bilanz zählt Geschafftes, und
 *                        gefeiert wird bei beiden.
 *   darf(lage, zug, sitz)            ob sitz diesen Zug jetzt machen darf
 *   brett({ zug })       → { knoten, zeichne({ zuege, roh, lage, beginnt,
 *                            saat, nr, dran, ich, aus, modus, raum, namen }),
 *                            fokus? }
 *                        zug(z) schickt einen Zug. namen: { a, b } – wie
 *                        die beiden heissen (gegen den Computer: «Computer»).
 *                        Dazu bekommt das Brett: ton, el, knopf, steinZeichen,
 *                        ruhig, vorlesen(text | () => text, { titel }) – ein
 *                        Lautsprecher neben einem Text (vorlesen.js).
 *   vorlesen(bild)       (wenn es eines gibt) was der Lautsprecher beim Satz
 *                        über dem Brett nach dem Satz noch vorliest – etwa
 *                        der Spielstand oder die Antworten zur Wahl.
 *   computer(lage, sitz, stufe, { zuege, roh, saat })
 *                        → zug, oder { zug, warte } (warte: wie lange der
 *                        Computer sich Zeit lässt, für Spiele, in denen
 *                        beide zugleich dran sind)
 *   auto(lage, sitz, { raum, nr })   (wenn es eines gibt) ein Zug, den das
 *                        Gerät von selbst macht – etwa die Antwort auf einen
 *                        Schuss aus dem, was nur dieses Gerät weiss
 *   neuePartie(stufe, { nr })  (wenn es eines gibt) { saat } für eine neue
 *                        Partie; nr: die wievielte in Folge (0 die erste)
 *   satz(lage, { ich, name, modus })  (wenn es eines gibt) { text, sitz } –
 *                        was über dem Brett steht, wenn es mehr zu sagen gibt
 *                        als «Du bist dran»
 *   texte                { start: "tippe auf eine Spalte",
 *                          remis: "Unentschieden – das Brett ist voll.",
 *                          geschafft, verpasst (miteinander) }
 *   LernappZwei.live(raum)  (für das Brett, nur im Duell) ein Ort für das,
 *                        was keine Züge sind – { schreibe(stück, text),
 *                        hoere(stück, beiText) → abmelden }
 *   zeichen(sitz)        (wenn es eines gibt) das Zeichen eines Spielers
 *                        (sonst ein Stein in Koralle oder Gold)
 */
(() => {
  "use strict";

  const mini = () => window.LernappMini || null;
  const cloud = () => window.MiniCloud || null;
  const kids = () => window.LernappKids || null;

  // Keine 0/O und 1/I: Der Raum steht in einem Link, der auch einmal
  // abgeschrieben wird. Wie beim Multiplayer (live.js).
  const ZEICHEN = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const RAUM_LAENGE = 10;
  const RAUM_MUSTER = /^[A-Z2-9]{10}$/;
  const CODE_MUSTER = /^[0-9]{4}$/;
  const ZUG_MUSTER = /^[A-Za-z0-9,:;_-]{1,60}$/;
  // So lange führt der Code in den Raum (die Regeln lassen höchstens drei
  // Stunden zu). Danach geht es nur noch mit dem Link.
  const CODE_DAUER_MS = 2 * 60 * 60 * 1000;
  // Wie lange ein Duell im Menü unter «Weiterspielen» steht.
  const DUELL_MERKEN_MS = 3 * 24 * 60 * 60 * 1000;
  const OFFEN_MAX_MS = 3 * 60 * 60 * 1000;

  const adresse = () => { try { return new URLSearchParams(window.location.search); } catch { return new URLSearchParams(); } };
  // Das Turnier, aus dem die Seite geöffnet wurde (?turnier=…): Es bleibt in
  // jeder Adresse dieser Seite stehen, damit der Weg zurück dorthin führt
  // und die Turnier-App ihre Gäste nicht hinauswirft (turnier.js, heim).
  const TURNIER = (() => {
    const t = String(adresse().get("turnier") || "");
    return /^[a-z0-9-]{6,48}$/.test(t) ? t : "";
  })();
  // Aus dem Adminbereich ausprobiert (▶, ?von=admin): Das bleibt in jeder
  // Adresse stehen – sonst führte der Weg zurück nach dem ersten Klick nicht
  // mehr dorthin (mini-games.js, ausAdmin).
  const VON_ADMIN = adresse().get("von") === "admin";

  // Für die Prüfung im Browser: ein Emulator der Realtime Database auf
  // diesem Rechner. Gilt nur für eine Adresse auf dem eigenen Rechner – wie
  // im Multiplayer (live.js).
  const TEST = (() => {
    const t = window.__zweiTest || window.__viererTest;
    if (!t || !/^(127\.0\.0\.1|localhost):\d+$/.test(String(t.emulator || ""))) return null;
    return t;
  })();

  const S = {
    spiel: null,
    wirt: null,
    ansicht: "",
    // gegen den Computer
    stufe: "",
    computer: { roh: "", beginnt: "a", nr: 0, saat: 0 },
    denkt: false,
    fassung: 0,
    computerUhr: 0,
    // live
    db: null,
    versatz: 0,
    verbunden: false,
    raum: "",
    daten: null,
    geladen: false,
    sitz: null,
    hoerer: null,
    meldet: false,
    beitrittVersucht: false,
    autoGesendet: "",
    // im Turnier: als Wartender gemeldet (der Raum), und wer der Liste
    // der Wartenden zuhört, wieder aufhören
    offenGemeldet: "",
    menueAus: null,
  };

  // ---------------------------------------------------------------------------
  // Kleine Helfer
  // ---------------------------------------------------------------------------
  function el(tag, klasse = "", text = "") {
    const node = document.createElement(tag);
    if (klasse) node.className = klasse;
    if (text) node.textContent = text;
    return node;
  }

  function knopf(text, klasse, beiKlick) {
    const k = el("button", klasse, text);
    k.type = "button";
    if (beiKlick) k.addEventListener("click", beiKlick);
    return k;
  }

  // Ein Lautsprecher neben einem Text (vorlesen.js): ein Tipp liest ihn vor.
  // Ohne Sprachausgabe im Browser steht nichts da.
  function vorlesen(text, { titel = "Vorlesen", klasse = "" } = {}) {
    return window.LernappVorlesen?.knopf?.(text, { titel, klasse: `vr-vorlesen${klasse ? ` ${klasse}` : ""}` }) || document.createTextNode("");
  }
  // Ein Absatz mit Lautsprecher am Ende.
  function absatz(klasse, text, vorzulesen = text) {
    const p = el("p", klasse);
    p.append(el("span", "vr-absatz-text", text), " ", vorlesen(vorzulesen));
    return p;
  }

  function liesJson(schluessel, ersatz) {
    try {
      const roh = localStorage.getItem(schluessel);
      return roh ? JSON.parse(roh) : ersatz;
    } catch { return ersatz; }
  }

  function schreibeJson(schluessel, wert) {
    try { localStorage.setItem(schluessel, JSON.stringify(wert)); } catch { /* privates Fenster */ }
  }

  const anderer = (sitz) => (sitz === "a" ? "b" : "a");
  const jetzt = () => Date.now() + S.versatz;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());
  const titel = () => S.spiel?.titel || "";

  function zufallsText(laenge, zeichen) {
    const zahlen = new Uint32Array(laenge);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(zahlen);
    else for (let i = 0; i < laenge; i += 1) zahlen[i] = Math.floor(Math.random() * 4294967296);
    let text = "";
    zahlen.forEach((n) => { text += zeichen[n % zeichen.length]; });
    return text;
  }

  function zufallsSaat() {
    const z = new Uint32Array(1);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(z);
    else z[0] = Math.floor(Math.random() * 4294967296);
    return z[0] >>> 0;
  }

  function meinName() {
    return mini()?.name?.() || "";
  }

  // Ein Stein als Bild – im Text, in den Namen, im Menü. Ein Spiel kann ein
  // eigenes Zeichen mitbringen (X und O bei Tic Tac Toe).
  function steinZeichen(sitz, klasse = "") {
    const eigen = S.spiel?.zeichen?.(sitz);
    if (eigen) {
      if (klasse) eigen.classList.add(...klasse.split(" ").filter(Boolean));
      eigen.setAttribute("aria-hidden", "true");
      return eigen;
    }
    const s = el("span", `vr-mini-stein ist-${sitz} ${klasse}`.trim());
    s.setAttribute("aria-hidden", "true");
    return s;
  }

  // Die Züge: als Liste für das Spiel, als Text in der Datenbank.
  function teile(roh) {
    const text = String(roh || "");
    if (!text) return [];
    const trenner = S.spiel.trenner ?? ".";
    return trenner ? text.split(trenner) : [...text];
  }
  function anhaengen(roh, zug) {
    const trenner = S.spiel.trenner ?? ".";
    return roh && trenner ? `${roh}${trenner}${zug}` : `${roh || ""}${zug}`;
  }
  // Gegen den Computer kennt die Lage die Stufe (eine Karte kann dann
  // grösser oder kleiner sein), im Duell nicht.
  const stufeJetzt = () => (S.ansicht === "computer" ? S.stufe || null : null);
  function lageVon(roh, beginnt, saat) {
    try {
      return S.spiel.lage(teile(roh), { roh: String(roh || ""), beginnt, saat: Number(saat) || 0, stufe: stufeJetzt() }) || { dran: null, ende: null };
    } catch (fehler) {
      console.warn("Die Partie liess sich nicht lesen", fehler);
      return { dran: null, ende: null, kaputt: true };
    }
  }
  const darf = (lage, zug, sitz) => {
    if (!ZUG_MUSTER.test(String(zug || "")) || lage.ende || lage.kaputt) return false;
    try { return Boolean(S.spiel.darf(lage, String(zug), sitz)); } catch { return false; }
  };
  const istDran = (lage, sitz) => Boolean(sitz && !lage.ende && (lage.dran === sitz || lage.dran === "beide"));

  // ---------------------------------------------------------------------------
  // Klang: kleine Töne aus dem Baukasten von kids.js, damit der Ton-Knopf
  // oben rechts (Lautstärke, stumm) auch hier gilt. Ein Spiel spielt sie mit
  // LernappZwei.ton(art).
  // ---------------------------------------------------------------------------
  function ton(art) {
    const ctx = kids()?.audioKontext?.();
    const aus = kids()?.ausgang?.();
    if (!ctx || !aus) return;
    const t0 = ctx.currentTime + 0.01;
    const note = (frequenz, start, dauer, { typ = "triangle", laut = 0.22 } = {}) => {
      try {
        const osz = ctx.createOscillator();
        const pegel = ctx.createGain();
        osz.type = typ;
        osz.frequency.setValueAtTime(frequenz, t0 + start);
        pegel.gain.setValueAtTime(0.0001, t0 + start);
        pegel.gain.exponentialRampToValueAtTime(laut, t0 + start + 0.012);
        pegel.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dauer);
        osz.connect(pegel);
        pegel.connect(aus);
        osz.start(t0 + start);
        osz.stop(t0 + start + dauer + 0.02);
      } catch { /* ohne Ton */ }
    };
    if (art === "klack") {
      // Ein Stein schlägt auf: tief und kurz, mit einem hellen Klick darüber.
      try {
        const osz = ctx.createOscillator();
        const pegel = ctx.createGain();
        osz.type = "sine";
        osz.frequency.setValueAtTime(260, t0);
        osz.frequency.exponentialRampToValueAtTime(90, t0 + 0.09);
        pegel.gain.setValueAtTime(0.0001, t0);
        pegel.gain.exponentialRampToValueAtTime(0.35, t0 + 0.005);
        pegel.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
        osz.connect(pegel);
        pegel.connect(aus);
        osz.start(t0);
        osz.stop(t0 + 0.14);
      } catch { /* ohne Ton */ }
      note(1800, 0, 0.03, { typ: "square", laut: 0.025 });
    } else if (art === "tipp") {
      note(660, 0, 0.07, { typ: "triangle", laut: 0.12 });
    } else if (art === "treffer") {
      note(196, 0, 0.18, { typ: "sawtooth", laut: 0.08 });
      note(130.8, 0.05, 0.3, { typ: "sine", laut: 0.2 });
    } else if (art === "platsch") {
      note(523.25, 0, 0.08, { typ: "sine", laut: 0.08 });
      note(392, 0.06, 0.14, { typ: "sine", laut: 0.06 });
    } else if (art === "sieg") {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, i * 0.11, i === 3 ? 0.5 : 0.16));
      note(1318.5, 0.44, 0.45, { typ: "sine", laut: 0.08 });
    } else if (art === "verloren") {
      note(392, 0, 0.22, { typ: "sine", laut: 0.18 });
      note(311.13, 0.2, 0.42, { typ: "sine", laut: 0.16 });
    } else if (art === "remis") {
      note(440, 0, 0.18, { typ: "sine", laut: 0.15 });
      note(440, 0.2, 0.25, { typ: "sine", laut: 0.12 });
    } else if (art === "dran") {
      note(880, 0, 0.12, { typ: "sine", laut: 0.08 });
      note(1174.7, 0.09, 0.18, { typ: "sine", laut: 0.07 });
    } else if (art === "da") {
      note(659.25, 0, 0.14, { typ: "triangle", laut: 0.14 });
      note(987.77, 0.12, 0.3, { typ: "triangle", laut: 0.12 });
    }
  }

  function feiern(ziel) {
    ton("sieg");
    kids()?.burstConfetti?.(ziel, 60);
    kids()?.vibrate?.([30, 40, 60]);
  }

  // ---------------------------------------------------------------------------
  // Die Ansicht einer Partie: Namen, Satz, Brett, Knöpfe
  // ---------------------------------------------------------------------------
  /*
   * Gemeinsam für den Computer und das Duell. spieler: { a: {name, zahl},
   * b: {name, zahl} }, text, dran, ich, knoepfe – was die Partie gerade sagt.
   */
  function partieBauen({ beiZug }) {
    const wirt = el("section", `vr-partie zw-${S.spiel.id}`);
    const oben = el("div", "vr-leiste");
    const karte = (sitz) => {
      const k = el("div", `vr-wer ist-${sitz}`);
      const name = el("span", "vr-wer-name");
      const zahl = el("span", "vr-wer-zahl");
      const punkt = el("span", "vr-wer-punkt");
      punkt.setAttribute("aria-hidden", "true");
      k.append(steinZeichen(sitz), name, punkt, zahl);
      return { k, name, zahl, punkt };
    };
    const a = karte("a");
    const b = karte("b");
    // Miteinander zählt keine gegen die andere: statt «1 : 1» nur «&».
    const gemeinsam = Boolean(S.spiel.gemeinsam);
    wirt.classList.toggle("ist-gemeinsam", gemeinsam);
    const mitte = el("span", "vr-leiste-mitte", gemeinsam ? "&" : ":");
    mitte.setAttribute("aria-hidden", "true");
    oben.append(a.k, mitte, b.k);
    const satz = el("p", "vr-satz");
    satz.setAttribute("aria-live", "polite");
    // Der Lautsprecher beim Satz liest den Satz – und was das Spiel dazu
    // sagen möchte (den Stand, die Antworten zur Wahl …).
    let satzJetzt = "";
    let bildJetzt = null;
    const satzLaut = vorlesen(() => {
      let dazu = "";
      try { dazu = bildJetzt ? S.spiel.vorlesen?.(bildJetzt) || "" : ""; } catch { dazu = ""; }
      if (!dazu) return satzJetzt;
      return /[.!?…]$/.test(satzJetzt.trim()) ? `${satzJetzt} ${dazu}` : `${satzJetzt}. ${dazu}`;
    }, { titel: "Vorlesen, was gerade los ist", klasse: "vr-satz-laut" });
    const brett = S.spiel.brett({ zug: beiZug, ton, el, knopf, steinZeichen, ruhig, vorlesen });
    const unten = el("div", "vr-knoepfe");
    wirt.append(oben, satz, brett.knoten, unten);

    function zeige({ spieler, text, textSitz = null, dran, ich, knoepfe = [], denkt = false, ende = null, bild }) {
      for (const [sitz, k] of [["a", a], ["b", b]]) {
        const s = spieler[sitz] || {};
        k.name.textContent = s.name || "…";
        k.zahl.textContent = String(s.zahl ?? 0);
        k.zahl.hidden = gemeinsam;
        k.k.classList.toggle("ist-dran", dran === sitz || dran === "beide");
        k.k.classList.toggle("ist-weg", s.weg === true);
        k.punkt.hidden = s.weg !== true;
        k.punkt.title = s.weg ? "Gerade nicht verbunden" : "";
      }
      satz.innerHTML = "";
      if (textSitz) satz.append(steinZeichen(textSitz));
      satz.append(el("span", "vr-satz-text", text));
      if (denkt) satz.append(el("span", "vr-denkt", "…"));
      satzJetzt = text;
      bildJetzt = bild;
      satz.append(satzLaut);
      satz.classList.toggle("ist-ich", Boolean(dran && (dran === ich || (dran === "beide" && ich))));
      satz.classList.toggle("ist-ende", Boolean(ende));
      satz.classList.toggle("ist-sieg", Boolean(ende === "g" || (ende && !["u", "v"].includes(ende) && (ende === ich || !ich))));
      unten.innerHTML = "";
      knoepfe.forEach((k) => unten.append(k));
      brett.zeichne(bild);
    }

    return { knoten: wirt, brettKnoten: brett.knoten, zeige, fokus: brett.fokus };
  }

  // Was über dem Brett steht – das Spiel darf es selbst sagen (satz), sonst
  // das Übliche.
  function satzFuer(lage, { ich, name, modus, zuege, standard }) {
    const eigen = S.spiel.satz?.(lage, { ich, name, modus, zuege });
    return eigen && eigen.text ? eigen : standard;
  }

  // ---------------------------------------------------------------------------
  // Der Rahmen der Seite: oben der Weg zurück, der Name, das Vollbild
  // ---------------------------------------------------------------------------
  function kopfBauen() {
    const kopf = el("header", "vr-kopf");
    const links = el("div", "vr-kopf-links");
    const zurueck = mini()?.leiste?.()?.[0];
    if (zurueck) links.append(zurueck);
    const marke = el("a", "vr-marke");
    marke.href = `/${S.spiel.seite}`;
    marke.append(el("span", "vr-marke-bild"), el("span", "vr-marke-wort", titel()));
    marke.addEventListener("click", (e) => { e.preventDefault(); geh({}); });
    const rechts = el("div", "vr-kopf-rechts");
    const voll = window.LernappVollbild?.knopf?.("mini-vollbild vr-rund");
    if (voll) rechts.append(voll);
    kopf.append(links, marke, rechts);
    return kopf;
  }

  function ansicht(name, ...inhalt) {
    S.menueAus?.();
    S.menueAus = null;
    S.ansicht = name;
    S.wirt.innerHTML = "";
    S.wirt.dataset.ansicht = name;
    S.wirt.append(kopfBauen(), ...inhalt);
  }

  // ---------------------------------------------------------------------------
  // Wege
  // ---------------------------------------------------------------------------
  function weg({ gegen = "", raum = "" } = {}, seite = S.spiel.seite) {
    const p = new URLSearchParams();
    if (TURNIER) p.set("turnier", TURNIER);
    if (VON_ADMIN) p.set("von", "admin");
    if (gegen) p.set("gegen", gegen);
    if (raum) p.set("raum", raum);
    return `/${seite}${p.toString() ? `?${p}` : ""}`;
  }

  function geh(ziel, { ersetzen = false } = {}) {
    try {
      if (ersetzen) window.history.replaceState({ zw: true }, "", weg(ziel));
      else window.history.pushState({ zw: true }, "", weg(ziel));
    } catch { /* ohne Verlauf */ }
    route();
  }

  // Ein Raum (oder Code) eines anderen Spiels: dorthin.
  function zuSpiel(spiel, raum) {
    const ziel = mini()?.ZWEI_SPIELER?.find((s) => s.id === spiel);
    if (!ziel) return false;
    window.location.assign(weg({ raum }, ziel.seite));
    return true;
  }

  function route() {
    const p = adresse();
    const raum = String(p.get("raum") || "").toUpperCase();
    const gegen = String(p.get("gegen") || "");
    if (raum !== S.raum) duellVerlassen();
    computerHalt();
    if (raum) {
      if (!RAUM_MUSTER.test(raum)) { fehlerZeigen("Dieser Link ist nicht ganz angekommen – frag nach einem neuen."); return; }
      duellBetreten(raum);
      return;
    }
    if (S.spiel.stufen?.[gegen]) { computerStarten(gegen); return; }
    menueZeigen();
  }

  function fehlerZeigen(text) {
    const box = el("section", "vr-karte vr-fehler");
    box.append(absatz("vr-fehler-text", text), knopf("Zum Menü", "mini-knopf mini-knopf-voll vr-los", () => geh({})));
    ansicht("fehler", box);
  }

  // ---------------------------------------------------------------------------
  // Das Menü
  // ---------------------------------------------------------------------------
  const bilanzKey = () => `${S.spiel.id}.bilanz`;
  const duelleKey = () => `${S.spiel.id}.duelle`;

  function bilanzen() {
    const roh = liesJson(bilanzKey(), {});
    const raus = {};
    for (const s of Object.keys(S.spiel.stufen || {})) {
      const x = roh?.[s] || {};
      raus[s] = { s: Number(x.s) || 0, n: Number(x.n) || 0, u: Number(x.u) || 0 };
    }
    return raus;
  }

  function bilanzZaehlen(stufe, wie) {
    const alle = bilanzen();
    if (!alle[stufe]) return;
    alle[stufe][wie] += 1;
    schreibeJson(bilanzKey(), alle);
  }

  function bilanzSatz(x) {
    if (!x.s && !x.n && !x.u) return "Noch nicht gespielt";
    if (S.spiel?.gemeinsam) return `${x.s} geschafft · ${x.n} nicht geschafft`;
    const teile = [`${x.s} gewonnen`, `${x.n} verloren`];
    if (x.u) teile.push(`${x.u} unentschieden`);
    return teile.join(" · ");
  }

  function gemerkteDuelle() {
    const liste = liesJson(duelleKey(), []);
    const grenze = Date.now() - DUELL_MERKEN_MS;
    return (Array.isArray(liste) ? liste : []).filter((d) => d && RAUM_MUSTER.test(d.raum) && Number(d.ms) > grenze);
  }

  // Die gemerkten Duelle, die hierher gehören: im Turnier die des Turniers,
  // sonst die ohne.
  function hiesigeDuelle() {
    return gemerkteDuelle().filter((d) => String(d.turnier || "") === TURNIER);
  }

  function duellMerken(raum, gegner = "") {
    const alt = gemerkteDuelle().filter((d) => d.raum !== raum);
    const vorher = gemerkteDuelle().find((d) => d.raum === raum);
    alt.unshift({ raum, gegner: gegner || vorher?.gegner || "", turnier: TURNIER || vorher?.turnier || "", ms: Date.now() });
    schreibeJson(duelleKey(), alt.slice(0, 4));
  }

  function duellVergessen(raum) {
    schreibeJson(duelleKey(), gemerkteDuelle().filter((d) => d.raum !== raum));
  }

  function sterne(anzahl) {
    const s = el("span", "vr-sterne");
    s.setAttribute("aria-hidden", "true");
    if (!anzahl) return s;
    for (let i = 0; i < 3; i += 1) s.append(el("span", `vr-stern${i < anzahl ? " ist-an" : ""}`, "★"));
    return s;
  }

  // Ohne Namen geht kein Duell: Das andere Gerät soll lesen, wer da spielt.
  function nameFeld({ text, wort, weiter }) {
    const form = el("form", "vr-namensfeld");
    const satz = absatz("vr-hinweis", text);
    const zeile = el("div", "vr-zeile");
    const feld = el("input", "vr-eingabe");
    feld.type = "text";
    feld.maxLength = mini()?.NAME_MAX || 24;
    feld.placeholder = "Dein Name";
    feld.autocomplete = "nickname";
    feld.setAttribute("aria-label", "Dein Name");
    const ok = el("button", "mini-knopf mini-knopf-voll vr-los", wort);
    ok.type = "submit";
    zeile.append(feld, ok);
    form.append(satz, zeile);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const wert = String(feld.value || "").replace(/\s+/g, " ").trim();
      if (!wert) { feld.focus(); return; }
      ok.disabled = true;
      try { await mini()?.namenAendern?.(wert); } catch { mini()?.setzeName?.(wert); }
      if (!meinName()) mini()?.setzeName?.(wert);
      weiter();
    });
    window.setTimeout(() => feld.focus({ preventScroll: true }), 50);
    return form;
  }

  function menueZeigen() {
    S.denkt = false;
    const seite = el("div", "vr-menue");

    const kopf = el("section", "vr-held");
    const bild = S.spiel.held?.() || el("div");
    bild.classList.add("zw-held-bild");
    bild.setAttribute("aria-hidden", "true");
    const text = el("div", "vr-held-text");
    text.append(el("h1", "vr-titel", titel()), absatz("vr-unter", S.spiel.unter || "", `${titel()}. ${S.spiel.unter || ""}`));
    kopf.append(bild, text);

    // Wer spielt: der Name dieses Geräts, zu ändern wie überall in der arcade.
    const wer = mini()?.namensZeile?.({ klasse: "vr-wer-zeile", beiWechsel: () => window.setTimeout(menueZeigen, 1200) });

    // Gegen den Computer – wenn das Spiel einen hat.
    let pc = null;
    if (S.spiel.stufen) {
      pc = el("section", "vr-karte vr-karte-pc");
      const pcTitel = el("h2", "vr-karte-titel", "Gegen den Computer");
      const stufenText = Object.values(S.spiel.stufen).map((st) => `${st.name}: ${st.satz}`).join(". ");
      pcTitel.append(" ", vorlesen(`Gegen den Computer. Such dir eine Stufe aus. ${stufenText}.`, { titel: "Die Stufen vorlesen" }));
      pc.append(pcTitel);
      const stufen = el("div", "vr-stufen");
      const b = bilanzen();
      for (const [id, st] of Object.entries(S.spiel.stufen)) {
        const k = el("button", `vr-stufe ist-${id}`);
        k.type = "button";
        k.dataset.stufe = id;
        const kopfZeile = el("span", "vr-stufe-kopf");
        kopfZeile.append(el("span", "vr-stufe-name", st.name), sterne(st.sterne));
        k.append(kopfZeile, el("span", "vr-stufe-satz", st.satz), el("span", "vr-stufe-bilanz", bilanzSatz(b[id])));
        k.addEventListener("click", () => geh({ gegen: id }));
        stufen.append(k);
      }
      pc.append(stufen);
    }

    // Zu zweit, live
    const live = el("section", "vr-karte vr-karte-live");
    live.append(el("h2", "vr-karte-titel", "Zu zweit, live"));
    // Im Turnier: wer gerade wartet, als grosser Knopf – ein Tipp, und man
    // sitzt am Brett. Darunter das eigene «Neues Spiel».
    const wartende = el("div", "vr-wartende");
    wartende.setAttribute("aria-live", "polite");
    if (TURNIER) live.append(wartende);
    const liveText = TURNIER
      ? "Jede auf dem eigenen Gerät. Wer ein Spiel eröffnet, steht hier bei allen im Turnier – ein Tipp, und es geht los."
      : "Jede und jeder auf dem eigenen Gerät. Du eröffnest und schickst den Link – oder sagst den Code mit vier Ziffern.";
    live.append(absatz("vr-hinweis", liveText, `Zu zweit, live. ${liveText}${TURNIER ? "" : " Hast du einen Code bekommen? Dann tippe die vier Ziffern ein und danach auf Beitreten."}`));
    const platz = el("div", "vr-live-platz");
    const offen = knopf(TURNIER ? "Neues Spiel eröffnen" : "Neues Duell eröffnen", "mini-knopf mini-knopf-voll vr-los vr-eroeffnen", () => {
      if (!meinName()) {
        platz.innerHTML = "";
        platz.append(nameFeld({ text: "Wie heisst du? Das sieht dein Gegenüber.", wort: "Eröffnen", weiter: eroeffnen }));
        return;
      }
      eroeffnen();
    });
    const codeForm = el("form", "vr-code");
    const codeLabel = el("label", "vr-code-label", "Code bekommen?");
    const codeZeile = el("div", "vr-zeile");
    const codeFeld = el("input", "vr-eingabe vr-code-feld");
    codeFeld.type = "text";
    codeFeld.inputMode = "numeric";
    codeFeld.pattern = "[0-9]{4}";
    codeFeld.maxLength = 4;
    codeFeld.placeholder = "1234";
    codeFeld.autocomplete = "off";
    codeFeld.id = "vr-code-feld";
    codeLabel.htmlFor = codeFeld.id;
    const codeOk = el("button", "mini-knopf mini-knopf-hell vr-code-ok", "Beitreten");
    codeOk.type = "submit";
    const codeMeldung = el("p", "vr-meldung");
    codeMeldung.setAttribute("aria-live", "polite");
    codeZeile.append(codeFeld, codeOk);
    codeForm.append(codeLabel, codeZeile, codeMeldung);
    codeFeld.addEventListener("input", () => {
      codeFeld.value = codeFeld.value.replace(/\D/g, "").slice(0, 4);
      codeMeldung.textContent = "";
    });
    codeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = codeFeld.value.trim();
      if (!CODE_MUSTER.test(code)) { codeMeldung.textContent = "Der Code hat vier Ziffern."; codeFeld.focus(); return; }
      const mitName = async () => {
        codeOk.disabled = true;
        codeMeldung.textContent = "Einen Moment …";
        const ziel = await codeSuchen(code);
        codeOk.disabled = false;
        if (ziel.raum && ziel.spiel && ziel.spiel !== S.spiel.id && zuSpiel(ziel.spiel, ziel.raum)) return;
        if (ziel.raum) { geh({ raum: ziel.raum }); return; }
        codeMeldung.textContent = ziel.fehler;
      };
      if (!meinName()) {
        platz.innerHTML = "";
        platz.append(nameFeld({ text: "Wie heisst du? Das sieht dein Gegenüber.", wort: "Beitreten", weiter: () => { platz.innerHTML = ""; platz.append(offen); mitName(); } }));
        return;
      }
      mitName();
    });
    platz.append(offen);
    live.append(platz);
    // Im Turnier braucht es den Code kaum – er steht eingeklappt darunter.
    if (TURNIER) {
      const mehr = el("details", "vr-mehr");
      mehr.append(el("summary", "vr-mehr-knopf", "Mit Code beitreten"), codeForm);
      live.append(mehr);
    } else live.append(codeForm);

    // Laufende Duelle dieses Geräts: weiterspielen, wo man war.
    const merk = hiesigeDuelle();
    if (merk.length) {
      const weiter = el("div", "vr-weiter");
      weiter.append(el("p", "vr-weiter-titel", "Weiterspielen"));
      merk.forEach((d) => {
        const k = knopf("", "mini-knopf mini-knopf-still vr-weiter-knopf", () => geh({ raum: d.raum }));
        k.append(el("span", "", d.gegner ? `Duell mit ${d.gegner}` : "Offenes Duell"));
        weiter.append(k);
      });
      live.append(weiter);
    }

    // Im Turnier steht «zu zweit» oben – darum geht es dort. Sonst der
    // Computer zuerst.
    seite.append(kopf);
    if (wer) seite.append(wer);
    if (TURNIER || !pc) seite.append(live);
    if (pc) seite.append(pc);
    if (!TURNIER && pc) seite.append(live);
    ansicht("menue", seite);
    document.title = `${titel()} · arcade`;

    if (TURNIER) {
      const zeigeWartende = (liste) => {
        wartende.innerHTML = "";
        live.classList.toggle("ist-wartet", liste.length > 0);
        liste.forEach((d) => {
          const k = el("button", "vr-wartet-knopf");
          k.type = "button";
          k.dataset.raum = d.raum;
          const text = el("span", "vr-wartet-text");
          text.append(el("strong", "", `Mit ${d.name} spielen`), el("span", "", `${d.name} wartet auf dich`));
          k.append(steinZeichen("a", "vr-wartet-stein"), text, el("span", "vr-wartet-los", "Los"));
          k.addEventListener("click", () => geh({ raum: d.raum }));
          wartende.append(k);
        });
      };
      S.menueAus = offeneHoeren(zeigeWartende);
    }
  }

  // Wer im Turnier gerade bei diesem Spiel wartet – ohne mich selbst, und
  // nichts, was älter ist als drei Stunden. Gibt zurück, wie man wieder
  // aufhört zuzuhören.
  function offeneHoeren(beiListe) {
    const db = datenbank();
    if (!db || !TURNIER) return null;
    const ref = db.ref(`partieOffen/${TURNIER}`);
    const hoerer = (s) => {
      const d = s.val() || {};
      const meine = mini()?.kennung?.() || "";
      const grenze = jetzt() - OFFEN_MAX_MS;
      beiListe(Object.entries(d)
        .filter(([raum, o]) => RAUM_MUSTER.test(raum) && o && o.name && o.spiel === S.spiel.id && o.kennung !== meine && Number(o.seit) > grenze)
        .map(([raum, o]) => ({ raum, name: String(o.name), seit: Number(o.seit) }))
        .sort((x, y) => x.seit - y.seit));
    };
    ref.on("value", hoerer, () => beiListe([]));
    return () => ref.off("value", hoerer);
  }

  // ---------------------------------------------------------------------------
  // Gegen den Computer
  // ---------------------------------------------------------------------------
  // Du bist a, der Computer b. Wer beginnt, wechselt von Partie zu Partie;
  // die erste beginnst du.
  let computerAnsicht = null;

  function computerHalt() {
    window.clearTimeout(S.computerUhr);
    S.computerUhr = 0;
    S.fassung += 1;
    S.denkt = false;
  }

  // Die Saat einer neuen Partie; nr ist die wievielte in Folge (0 die
  // erste) – ein Spiel kann damit schwerer werden (Zwillings-Labyrinth).
  function neueSaat(nr = 0) {
    return Number(S.spiel.neuePartie?.(stufeJetzt(), { nr })?.saat) || zufallsSaat();
  }

  function computerStarten(stufe) {
    S.stufe = stufe;
    S.computer = { roh: "", beginnt: "a", nr: 0, saat: neueSaat() };
    computerHalt();
    computerAnsicht = partieBauen({ beiZug: (zug) => computerZug(zug, "a") });
    ansicht("computer", computerAnsicht.knoten);
    document.title = `${S.spiel.stufen[stufe].name} · ${titel()} · arcade`;
    nachComputerStand();
    window.setTimeout(() => computerAnsicht?.fokus?.(), 60);
  }

  function computerNochmal() {
    computerHalt();
    S.computer = { roh: "", beginnt: anderer(S.computer.beginnt), nr: S.computer.nr + 1, saat: neueSaat(S.computer.nr + 1) };
    nachComputerStand({ start: true });
  }

  function computerLage() {
    const { roh, beginnt, saat } = S.computer;
    return lageVon(roh, beginnt, saat);
  }

  function computerZeichnen() {
    if (S.ansicht !== "computer" || !computerAnsicht) return null;
    const { roh, beginnt, nr, saat } = S.computer;
    const lage = computerLage();
    const zuege = teile(roh);
    const ende = lage.ende || null;
    const dran = ende ? null : lage.dran;
    const b = bilanzen()[S.stufe] || { s: 0, n: 0 };
    const st = S.spiel.stufen[S.stufe];
    const texte = S.spiel.texte || {};
    let standard = { text: "", sitz: null };
    if (ende === "g") standard = { text: texte.geschafft || "Geschafft – zusammen!", sitz: null };
    else if (ende === "v") standard = { text: texte.verpasst || "Leider nicht geschafft.", sitz: null };
    else if (ende === "a") standard = { text: "Du hast gewonnen!", sitz: "a" };
    else if (ende === "b") standard = { text: "Der Computer hat gewonnen.", sitz: "b" };
    else if (ende === "u") standard = { text: texte.remis || "Unentschieden.", sitz: null };
    else if (dran === "a" || dran === "beide") standard = { text: zuege.length ? "Du bist dran" : `Du beginnst – ${texte.start || "los geht's"}`, sitz: "a" };
    else standard = { text: zuege.length ? "Der Computer überlegt" : "Der Computer beginnt", sitz: "b" };
    const { text, sitz } = satzFuer(lage, { ich: "a", name: (s) => (s === "a" ? "Du" : "Der Computer"), modus: "computer", zuege, standard });
    const knoepfe = [];
    if (ende) knoepfe.push(knopf("Nochmal", "mini-knopf mini-knopf-voll vr-los vr-nochmal", computerNochmal));
    else if (zuege.length) knoepfe.push(knopf("Neu anfangen", "mini-knopf mini-knopf-still vr-neu", computerNochmal));
    knoepfe.push(knopf(`Stufe: ${st.name}`, "mini-knopf mini-knopf-still vr-menue-knopf", () => geh({})));
    computerAnsicht.zeige({
      spieler: {
        a: { name: meinName() || "Du", zahl: b.s },
        // Miteinander: Beide zeigen, was sie zusammen geschafft haben.
        b: { name: "Computer", zahl: S.spiel.gemeinsam ? b.s : b.n },
      },
      text,
      textSitz: sitz,
      dran,
      ich: "a",
      knoepfe,
      denkt: dran === "b" && S.denkt,
      ende,
      bild: { zuege, roh, lage, beginnt, saat, nr, dran, ich: "a", aus: Boolean(ende), modus: "computer", raum: "computer", stufe: S.stufe, namen: { a: meinName() || "Du", b: "Computer" } },
    });
    return lage;
  }

  // Ein Zug, ob vom Menschen (a) oder vom Computer (b).
  function computerZug(zug, sitz) {
    if (S.ansicht !== "computer") return false;
    const lage = computerLage();
    if (!darf(lage, zug, sitz)) return false;
    S.computer.roh = anhaengen(S.computer.roh, String(zug));
    nachComputerStand();
    return true;
  }

  // Nach jedem neuen Stand: zeichnen, am Ende zählen und feiern, sonst
  // macht, wer von selbst ziehen kann (auto), und der Computer überlegt.
  function nachComputerStand({ start = false } = {}) {
    S.fassung += 1;
    window.clearTimeout(S.computerUhr);
    const lage = computerZeichnen();
    if (!lage) return;
    if (lage.ende) {
      S.denkt = false;
      bilanzZaehlen(S.stufe, ["a", "g"].includes(lage.ende) ? "s" : ["b", "v"].includes(lage.ende) ? "n" : "u");
      computerZeichnen();
      const wann = ruhig() ? 50 : 520;
      window.setTimeout(() => {
        if (S.ansicht !== "computer") return;
        if (lage.ende === "a" || lage.ende === "g") feiern(computerAnsicht?.brettKnoten);
        else ton(["b", "v"].includes(lage.ende) ? "verloren" : "remis");
        S.wirt.querySelector(".vr-nochmal")?.focus({ preventScroll: true });
      }, wann);
      return;
    }
    // Was der Mensch von selbst tut (eine Antwort aus dem, was nur er weiss).
    if (S.spiel.auto && istDran(lage, "a")) {
      const z = S.spiel.auto(lage, "a", { raum: "computer", nr: S.computer.nr, zuege: teile(S.computer.roh) });
      if (z) { window.setTimeout(() => computerZug(z, "a"), ruhig() ? 30 : 260); return; }
    }
    if (istDran(lage, "b")) computerDenkt(start);
  }

  // Der Computer überlegt – sichtbar und ein bisschen länger, als er
  // bräuchte: Ein Zug, der sofort zurückkommt, ist schwer zu verfolgen.
  function computerDenkt(start = false) {
    const meine = S.fassung;
    const lage = computerLage();
    const allein = lage.dran === "b";
    S.denkt = allein;
    if (allein) computerZeichnen();
    const anfang = Date.now();
    const mindestens = ruhig() ? 250 : (start ? 900 : 650 + Math.random() * 350);
    // Erst wenn der eigene Zug zu sehen ist, wird gerechnet – sonst hielte
    // die Suche das Bild an.
    S.computerUhr = window.setTimeout(async () => {
      if (meine !== S.fassung || S.ansicht !== "computer") return;
      const jetztLage = computerLage();
      if (!istDran(jetztLage, "b")) { S.denkt = false; return; }
      let antwort = null;
      try {
        antwort = await S.spiel.computer(jetztLage, "b", S.stufe, { zuege: teile(S.computer.roh), roh: S.computer.roh, saat: S.computer.saat, nr: S.computer.nr });
      } catch (fehler) { console.warn("Der Computer kam nicht weiter", fehler); }
      if (meine !== S.fassung) return;
      const zug = antwort && typeof antwort === "object" ? antwort.zug : antwort;
      const warte = antwort && typeof antwort === "object" && Number.isFinite(antwort.warte)
        ? antwort.warte
        : Math.max(0, mindestens - (Date.now() - anfang));
      if (zug === null || zug === undefined) { S.denkt = false; computerZeichnen(); return; }
      S.computerUhr = window.setTimeout(() => {
        if (meine !== S.fassung || S.ansicht !== "computer") return;
        S.denkt = false;
        if (!computerZug(String(zug), "b")) computerZeichnen();
      }, warte);
    }, ruhig() ? 60 : 380);
  }

  // ---------------------------------------------------------------------------
  // Live: die Verbindung
  // ---------------------------------------------------------------------------
  function datenbank() {
    if (S.db) return S.db;
    const app = cloud()?.app?.();
    if (!app || !window.firebase?.database) return null;
    try {
      const db = window.firebase.database(app);
      if (TEST) {
        const [host, port] = TEST.emulator.split(":");
        db.useEmulator(host, Number(port));
      }
      db.ref(".info/serverTimeOffset").on("value", (s) => { S.versatz = Number(s.val()) || 0; });
      db.ref(".info/connected").on("value", (s) => {
        S.verbunden = s.val() === true;
        // Nach einer Lücke ist die Meldung als Wartender weg (onDisconnect).
        if (!S.verbunden) S.offenGemeldet = "";
        if (S.verbunden && S.sitz && S.raum) melden();
        if (S.ansicht === "duell" || S.ansicht === "lobby") duellZeichnen();
      });
      S.db = db;
    } catch (fehler) {
      console.warn("Die Realtime Database liess sich nicht öffnen", fehler);
      return null;
    }
    return S.db;
  }

  const TIMESTAMP = () => window.firebase?.database?.ServerValue?.TIMESTAMP;

  /*
   * Für Spiele, die mehr brauchen als Züge – Malen und Raten: die Striche,
   * während sie entstehen. Ein Ort je Raum (partie/<raum>/live/<stück>,
   * stück wie «0-3»: Partie und Runde), nur Ziffern und Trenner, höchstens
   * 40 000 Zeichen (database.rules.json). Nur im Duell; sonst null.
   */
  function live(raum) {
    const db = S.db;
    if (!db || !RAUM_MUSTER.test(String(raum || ""))) return null;
    const ort = (stueck) => db.ref(`partie/${raum}/live/${stueck}`);
    return {
      schreibe: (stueck, wert) => ort(stueck).set(String(wert)).catch((fehler) => console.warn("Live ging nicht hinaus", fehler)),
      hoere: (stueck, beiWert) => {
        const r = ort(stueck);
        const f = (schnappschuss) => beiWert(String(schnappschuss.val() || ""));
        r.on("value", f);
        return () => r.off("value", f);
      },
    };
  }

  function ich() {
    return { kennung: mini()?.kennung?.() || "", name: meinName() };
  }

  async function eroeffnen() {
    const db = datenbank();
    if (!db) { fehlerZeigen("Für ein Duell braucht es eine Verbindung – gerade gibt es keine."); return; }
    const wer = ich();
    if (!wer.kennung || !wer.name) { menueZeigen(); return; }
    const warten = el("section", "vr-karte vr-lobby");
    warten.append(el("p", "vr-hinweis", "Das Duell wird eröffnet …"));
    ansicht("lobby", warten);
    const raum = zufallsText(RAUM_LAENGE, ZEICHEN);
    try {
      await db.ref(`partie/${raum}`).update({
        info: { spiel: S.spiel.id, erstellt: TIMESTAMP() },
        a: { kennung: wer.kennung, name: wer.name, online: true, seit: TIMESTAMP() },
        stand: { zuege: "", beginnt: "a", serie: "", nr: 0, saat: neueSaat() },
      });
    } catch (fehler) {
      console.warn("Das Duell liess sich nicht eröffnen", fehler);
      fehlerZeigen("Das Duell liess sich gerade nicht eröffnen – vielleicht fehlt die Verbindung. Versuch es gleich noch einmal.");
      return;
    }
    // Vier Ziffern dazu – eine freie. Klappt es nicht, geht es mit dem Link.
    for (let versuch = 0; versuch < 8; versuch += 1) {
      const code = String(1000 + Math.floor(Math.random() * 9000));
      try {
        const bis = jetzt() + CODE_DAUER_MS;
        const t = await db.ref(`partieCode/${code}`).transaction((alt) => {
          if (alt && Number(alt.bis) > jetzt()) return undefined;
          return { raum, spiel: S.spiel.id, bis };
        }, undefined, false);
        if (t.committed) {
          await db.ref(`partie/${raum}/code`).set(code);
          break;
        }
      } catch { /* der nächste */ }
    }
    duellMerken(raum);
    geh({ raum });
  }

  async function codeSuchen(code) {
    const db = datenbank();
    if (!db) return { fehler: "Gerade gibt es keine Verbindung." };
    try {
      const s = await db.ref(`partieCode/${code}`).get();
      const v = s.val();
      if (!v || !RAUM_MUSTER.test(String(v.raum || "")) || Number(v.bis) < jetzt()) {
        return { fehler: "Diesen Code gibt es nicht – oder nicht mehr. Lass dir den Link schicken." };
      }
      return { raum: v.raum, spiel: String(v.spiel || "") };
    } catch (fehler) {
      console.warn("Der Code liess sich nicht nachsehen", fehler);
      return { fehler: "Das ging gerade nicht – vielleicht fehlt die Verbindung." };
    }
  }

  // Da sein: online, solange die Verbindung steht – die Datenbank setzt
  // selbst «weg», wenn sie abreisst.
  function melden() {
    const db = S.db;
    if (!db || !S.raum || !S.sitz || S.meldet) return;
    S.meldet = true;
    const ref = db.ref(`partie/${S.raum}/${S.sitz}`);
    const wer = ich();
    ref.update({ online: true, name: wer.name || S.daten?.[S.sitz]?.name || "?", seit: TIMESTAMP() })
      .then(() => ref.onDisconnect().update({ online: false }))
      .catch((fehler) => console.warn("Melden ging nicht", fehler))
      .finally(() => { S.meldet = false; });
  }

  /*
   * Im Turnier: wer eröffnet hat und noch allein ist, steht bei den anderen
   * als «… wartet» (partieOffen/<turnier>/<raum>). Reisst die Verbindung ab,
   * nimmt die Datenbank den Eintrag selbst weg – ein Tablet, das schläft,
   * lädt niemanden mehr ein. Kommt sie zurück, meldet sich das Gerät neu.
   */
  function offenMelden() {
    const db = S.db;
    const d = S.daten;
    if (!TURNIER || !db || !S.verbunden || S.sitz !== "a" || !d || d.b || S.offenGemeldet === S.raum) return;
    const raum = S.raum;
    S.offenGemeldet = raum;
    const ref = db.ref(`partieOffen/${TURNIER}/${raum}`);
    ref.onDisconnect().remove()
      .then(() => ref.set({ name: ich().name || d.a?.name || "?", kennung: d.a.kennung, spiel: S.spiel.id, seit: TIMESTAMP() }))
      .catch((fehler) => {
        console.warn("Im Turnier warten ging nicht", fehler);
        if (S.offenGemeldet === raum) S.offenGemeldet = "";
      });
  }

  function offenWeg(raum = S.raum) {
    if (!TURNIER || !S.db || !raum) return;
    const ref = S.db.ref(`partieOffen/${TURNIER}/${raum}`);
    ref.onDisconnect().cancel().catch(() => {});
    ref.remove().catch(() => {});
    if (S.offenGemeldet === raum) S.offenGemeldet = "";
  }

  function duellVerlassen() {
    if (!S.raum) return;
    const db = S.db;
    if (S.sitz === "a" && !S.daten?.b) offenWeg();
    if (db && S.hoerer) db.ref(`partie/${S.raum}`).off("value", S.hoerer);
    if (db && S.sitz) {
      const ref = db.ref(`partie/${S.raum}/${S.sitz}`);
      ref.onDisconnect().cancel().catch(() => {});
      ref.update({ online: false }).catch(() => {});
    }
    S.raum = "";
    S.daten = null;
    S.geladen = false;
    S.sitz = null;
    S.hoerer = null;
    S.beitrittVersucht = false;
    S.autoGesendet = "";
    duellAnsicht = null;
    letzterStand = null;
    document.title = `${titel()} · arcade`;
  }

  let duellAnsicht = null;
  let letzterStand = null;

  function duellBetreten(raum) {
    if (S.raum === raum && S.hoerer) { duellZeichnen(); return; }
    const db = datenbank();
    if (!db) { fehlerZeigen("Für ein Duell braucht es eine Verbindung – gerade gibt es keine."); return; }
    S.raum = raum;
    S.geladen = false;
    S.daten = null;
    S.sitz = null;
    const laden = el("section", "vr-karte vr-lobby");
    laden.append(el("p", "vr-hinweis", "Das Duell wird geladen …"));
    ansicht("lobby", laden);
    S.hoerer = (s) => {
      if (S.raum !== raum) return;
      S.daten = s.val();
      S.geladen = true;
      // Ein Raum eines anderen Spiels: dorthin.
      const spiel = S.daten?.info?.spiel;
      if (spiel && spiel !== S.spiel.id && zuSpiel(spiel, raum)) return;
      sitzFinden();
      duellZeichnen();
    };
    db.ref(`partie/${raum}`).on("value", S.hoerer, (fehler) => {
      console.warn("Das Duell liess sich nicht lesen", fehler);
      if (S.raum === raum) fehlerZeigen("Dieses Duell liess sich nicht laden.");
    });
  }

  // Wer bin ich in diesem Raum? Wer eröffnet hat, ist a; wer als Erstes
  // dazukommt, b; alle anderen schauen zu.
  function sitzFinden() {
    const d = S.daten;
    if (!d || !d.a) { S.sitz = null; return; }
    const meine = mini()?.kennung?.() || "";
    const vorher = S.sitz;
    if (d.a.kennung === meine) S.sitz = "a";
    else if (d.b?.kennung === meine) S.sitz = "b";
    else if (!d.b && !S.beitrittVersucht) { beitreten(); S.sitz = null; }
    else S.sitz = null;
    if (S.sitz && S.sitz !== vorher) {
      melden();
      duellMerken(S.raum, d[anderer(S.sitz)]?.name || "");
    }
  }

  async function beitreten() {
    const wer = ich();
    if (!wer.name) return; // erst den Namen (duellZeichnen fragt danach)
    S.beitrittVersucht = true;
    const db = S.db;
    const raum = S.raum;
    try {
      const t = await db.ref(`partie/${raum}/b`).transaction((alt) => {
        if (alt && alt.kennung !== wer.kennung) return undefined;
        return { kennung: wer.kennung, name: wer.name, online: true, seit: jetzt() };
      }, undefined, false);
      if (t.committed && S.raum === raum) {
        // Der Raum ist voll: Die vier Ziffern führen nicht mehr hierher.
        const code = S.daten?.code;
        if (code && CODE_MUSTER.test(code)) db.ref(`partieCode/${code}`).remove().catch(() => {});
        // Und im Turnier wartet niemand mehr.
        if (TURNIER) db.ref(`partieOffen/${TURNIER}/${raum}`).remove().catch(() => {});
        ton("da");
      }
    } catch (fehler) {
      console.warn("Beitreten ging nicht", fehler);
    }
  }

  function duellLink() {
    const p = new URLSearchParams();
    if (TURNIER) p.set("turnier", TURNIER);
    p.set("raum", S.raum);
    return `${window.location.origin}/${S.spiel.seite}?${p}`;
  }

  async function teilen(meldung) {
    const link = duellLink();
    const code = S.daten?.code;
    const text = `${meinName() || "Jemand"} fordert dich zu einer Partie ${titel()} heraus.${code ? ` Code: ${code}` : ""}`;
    if (navigator.share) {
      try { await navigator.share({ title: titel(), text, url: link }); return; } catch (e) { if (e?.name === "AbortError") return; }
    }
    try {
      await navigator.clipboard.writeText(link);
      meldung.textContent = "Link kopiert – jetzt einfügen und schicken.";
    } catch {
      meldung.textContent = link;
    }
  }

  // Der Stand einer Partie: wer wo sitzt, wer dran ist, wie es steht.
  function duellStand(d = S.daten || {}) {
    const st = d.stand || { zuege: "", beginnt: "a", serie: "", nr: 0 };
    const roh = String(st.zuege || "");
    const beginnt = st.beginnt === "b" ? "b" : "a";
    const saat = Number(st.saat) || 0;
    const lage = lageVon(roh, beginnt, saat);
    const ende = lage.ende || null;
    const serie = String(st.serie || "") + (ende || "");
    const zahl = { a: 0, b: 0, u: 0 };
    for (const z of serie) if (zahl[z] !== undefined) zahl[z] += 1;
    // Miteinander: Beide zählen, was sie zusammen geschafft haben.
    if (S.spiel?.gemeinsam) { const g = [...serie].filter((z) => z === "g").length; zahl.a = g; zahl.b = g; }
    return { roh, zuege: teile(roh), beginnt, saat, nr: Number(st.nr) || 0, lage, ende, zahl, serie: String(st.serie || "") };
  }

  function duellZeichnen() {
    if (!S.raum) return;
    if (!S.geladen) return;
    const d = S.daten;
    if (!d || !d.a) {
      duellVergessen(S.raum);
      fehlerZeigen("Dieses Duell gibt es nicht (mehr). Eröffne einfach ein neues.");
      return;
    }

    // Noch ohne Namen und ohne Platz: erst fragen, wer da kommt.
    if (!S.sitz && !d.b && !meinName()) {
      if (S.ansicht === "name") return;
      const box = el("section", "vr-karte vr-lobby");
      const fordert = el("h2", "vr-karte-titel", `${d.a.name} fordert dich heraus`);
      fordert.append(" ", vorlesen(`${d.a.name} fordert dich heraus. Wie heisst du? Schreib deinen Namen und tippe auf Mitspielen.`));
      box.append(fordert,
        nameFeld({ text: "Wie heisst du? Das sieht dein Gegenüber.", wort: "Mitspielen", weiter: () => { S.ansicht = ""; sitzFinden(); duellZeichnen(); } }));
      ansicht("name", box);
      return;
    }

    // Wer eröffnet hat und noch allein ist: der Link, der Code, warten –
    // und im Turnier bei den anderen als «… wartet».
    if (S.sitz === "a" && !d.b) {
      offenMelden();
      lobbyZeigen(d);
      return;
    }
    if (S.sitz === "a" && d.b && S.offenGemeldet) offenWeg();
    // Jemand, der dazukam, während der Platz frei wurde – gleich noch einmal.
    if (!S.sitz && !d.b) {
      const box = el("section", "vr-karte vr-lobby");
      box.append(el("p", "vr-hinweis", "Einen Moment …"));
      ansicht("lobby", box);
      return;
    }

    if (S.ansicht !== "duell" || !duellAnsicht) {
      // Wer gewartet hat, hört, dass jemand da ist.
      const ausLobby = S.sitz === "a" && Boolean(S.wirt.querySelector(".vr-warten"));
      duellAnsicht = partieBauen({ beiZug: duellZug });
      ansicht("duell", duellAnsicht.knoten);
      letzterStand = null;
      if (ausLobby) ton("da");
    }
    const st = duellStand();
    const dran = st.ende ? null : st.lage.dran;
    const gegen = S.sitz ? anderer(S.sitz) : null;
    const nameVon = (sitz) => (sitz === S.sitz ? `${d[sitz]?.name || "Du"} (du)` : d[sitz]?.name || "…");
    const weg = (sitz) => Boolean(d[sitz] && d[sitz].online === false);
    const texte = S.spiel.texte || {};

    let standard = { text: "", sitz: null };
    if (st.ende === "u") standard = { text: texte.remis || "Unentschieden.", sitz: null };
    else if (st.ende === "g") standard = { text: texte.geschafft || "Geschafft – zusammen!", sitz: null };
    else if (st.ende === "v") standard = { text: texte.verpasst || "Leider nicht geschafft.", sitz: null };
    else if (st.ende) {
      standard = {
        sitz: st.ende,
        text: !S.sitz ? `${d[st.ende]?.name || "?"} hat gewonnen!`
          : st.ende === S.sitz ? "Du hast gewonnen!" : `${d[st.ende]?.name || "?"} hat gewonnen.`,
      };
    } else if (dran === "beide") {
      standard = { sitz: S.sitz, text: S.sitz ? "Ihr seid beide dran" : "Beide sind dran" };
    } else {
      standard = { sitz: dran, text: "" };
      if (dran === S.sitz) standard.text = st.zuege.length ? "Du bist dran" : `Du beginnst – ${texte.start || "los geht's"}`;
      else if (gegen && dran === gegen && weg(gegen)) standard.text = `${d[gegen]?.name || "?"} ist dran – aber gerade nicht verbunden`;
      else standard.text = `${d[dran]?.name || "?"} ist dran`;
    }
    const gesagt = satzFuer(st.lage, {
      ich: S.sitz,
      name: (sitz) => (sitz === S.sitz ? "Du" : d[sitz]?.name || "?"),
      modus: "duell",
      zuege: st.zuege,
      standard,
    });
    let text = gesagt.text;
    if (!S.verbunden) text = `${text} · keine Verbindung`;

    const knoepfe = [];
    if (st.ende && S.sitz) knoepfe.push(knopf("Nochmal", "mini-knopf mini-knopf-voll vr-los vr-nochmal", duellNochmal));
    if (!S.sitz) knoepfe.push(el("span", "vr-zuschauen", "Du schaust zu"));
    const meldung = el("span", "vr-meldung");
    if (S.sitz) knoepfe.push(knopf("Link", "mini-knopf mini-knopf-still vr-teilen", () => teilen(meldung)));
    knoepfe.push(knopf("Menü", "mini-knopf mini-knopf-still vr-menue-knopf", () => geh({})));
    knoepfe.push(meldung);

    const vorher = letzterStand;
    duellAnsicht.zeige({
      spieler: {
        a: { name: nameVon("a"), zahl: st.zahl.a, weg: weg("a") },
        b: { name: nameVon("b"), zahl: st.zahl.b, weg: weg("b") },
      },
      text,
      textSitz: gesagt.sitz,
      dran,
      ich: S.sitz,
      knoepfe,
      ende: st.ende,
      bild: { zuege: st.zuege, roh: st.roh, lage: st.lage, beginnt: st.beginnt, saat: st.saat, nr: st.nr, dran, ich: S.sitz, aus: Boolean(st.ende), modus: "duell", raum: S.raum, namen: { a: d.a?.name || "…", b: d.b?.name || "…" } },
    });
    letzterStand = { nr: st.nr, roh: st.roh, ende: st.ende };

    // Was gerade passiert ist: Ende der Partie, oder ich bin wieder dran.
    if (vorher) {
      const gleichePartie = vorher.nr === st.nr;
      if (st.ende && !(gleichePartie && vorher.ende)) {
        window.setTimeout(() => {
          if (S.ansicht !== "duell") return;
          if (st.ende === "u") ton("remis");
          else if (st.ende === "v") ton("verloren");
          else if (st.ende === "g" || !S.sitz || st.ende === S.sitz) feiern(duellAnsicht?.brettKnoten);
          else ton("verloren");
        }, ruhig() ? 50 : 520);
      } else if (!st.ende && dran === S.sitz && st.roh !== vorher.roh && st.zuege.length && document.visibilityState === "visible") {
        window.setTimeout(() => ton("dran"), 420);
      }
    }
    document.title = !st.ende && S.sitz && (dran === S.sitz || dran === "beide") ? `● Du bist dran · ${titel()}` : `${titel()} · arcade`;

    // Was dieses Gerät von selbst tut (eine Antwort aus dem, was nur es
    // weiss) – einmal je Stand.
    if (S.spiel.auto && S.sitz && istDran(st.lage, S.sitz)) {
      const z = S.spiel.auto(st.lage, S.sitz, { raum: S.raum, nr: st.nr, zuege: st.zuege });
      const merk = `${st.nr}|${st.roh}|${z}`;
      if (z && S.autoGesendet !== merk) {
        S.autoGesendet = merk;
        window.setTimeout(() => duellZug(z), ruhig() ? 30 : 260);
      }
    }
  }

  function lobbyZeigen(d) {
    if (S.ansicht === "lobby" && S.wirt.querySelector(".vr-warten") && S.wirt.dataset.code === String(d.code || "")) return;
    const box = el("section", "vr-karte vr-lobby vr-warten");
    const meldung = el("p", "vr-meldung");
    meldung.setAttribute("aria-live", "polite");
    const abbrechen = knopf("Abbrechen", "mini-knopf mini-knopf-still vr-menue-knopf", () => { offenWeg(); duellVergessen(S.raum); geh({}); });
    const teilenKnopf = knopf(navigator.share ? "Link schicken" : "Link kopieren", `mini-knopf ${TURNIER ? "mini-knopf-still" : "mini-knopf-voll vr-los"} vr-teilen`, () => teilen(meldung));
    const code = el("div", "vr-code-block");
    if (d.code) {
      const ziffern = el("p", "vr-grosscode");
      ziffern.setAttribute("aria-label", `Code ${[...String(d.code)].join(" ")}`);
      [...String(d.code)].forEach((z) => ziffern.append(el("span", "vr-ziffer", z)));
      const label = el("p", "vr-code-label", "Code");
      label.append(" ", vorlesen(`Der Code ist: ${[...String(d.code)].join(", ")}.`, { titel: "Den Code vorlesen" }));
      code.append(label, ziffern);
    }
    const link = el("p", "vr-link", duellLink());
    const punkte = el("p", "vr-wartet");
    punkte.append(steinZeichen("a"), el("span", "", TURNIER ? "Warte auf jemanden" : "Warte auf dein Gegenüber"), el("span", "vr-denkt", "…"));
    if (TURNIER) {
      // Im Turnier ist nichts zu schicken: Die anderen sehen den Knopf
      // «Mit … spielen» von selbst. Code und Link nur für den Notfall.
      const name = meinName() || d.a?.name || "du";
      box.append(punkte,
        el("h2", "vr-karte-titel", "Die anderen sehen jetzt:"),
        el("p", "vr-vorschau-knopf", `Mit ${name} spielen`),
        absatz("vr-hinweis", "Sobald jemand darauf tippt, geht es los – hier und dort.", `Die anderen sehen jetzt einen Knopf: Mit ${name} spielen. Sobald jemand darauf tippt, geht es los – hier und dort.`));
      const reihe = el("div", "vr-knoepfe");
      reihe.append(abbrechen);
      const mehr = el("details", "vr-mehr");
      const innen = el("div", "vr-mehr-innen");
      const knoepfe = el("div", "vr-knoepfe");
      knoepfe.append(teilenKnopf);
      innen.append(code, knoepfe, meldung, link);
      mehr.append(el("summary", "vr-mehr-knopf", "Code und Link"), innen);
      box.append(reihe, mehr);
    } else {
      box.append(el("h2", "vr-karte-titel", "Wer spielt mit?"),
        absatz("vr-hinweis", "Schick den Link – oder sag den Code. Sobald jemand da ist, geht es los.", `Wer spielt mit? Schick den Link – oder sag den Code${d.code ? `: ${[...String(d.code)].join(", ")}` : ""}. Sobald jemand da ist, geht es los.`), code);
      const reihe = el("div", "vr-knoepfe");
      reihe.append(teilenKnopf, abbrechen);
      box.append(reihe, meldung, link, punkte);
    }
    ansicht("lobby", box);
    S.wirt.dataset.code = String(d.code || "");
    document.title = `Warte … · ${titel()}`;
  }

  // Ein Zug im Duell: als Transaktion, gegen den Stand, den die Datenbank
  // gerade hat – das Spiel entscheidet dort noch einmal, ob er gilt.
  async function duellZug(zug) {
    const db = S.db;
    if (!db || !S.sitz || !S.raum) return;
    const z = String(zug);
    const st = duellStand();
    if (!darf(st.lage, z, S.sitz)) return;
    const sitz = S.sitz;
    try {
      await db.ref(`partie/${S.raum}/stand`).transaction((alt) => {
        if (!alt) return undefined;
        if (Number(alt.nr) !== st.nr) return undefined;
        const roh = String(alt.zuege || "");
        const lage = lageVon(roh, alt.beginnt === "b" ? "b" : "a", alt.saat);
        if (!darf(lage, z, sitz)) return undefined;
        return { ...alt, zuege: anhaengen(roh, z) };
      });
    } catch (fehler) {
      console.warn("Der Zug ging nicht hinaus", fehler);
    }
  }

  async function duellNochmal() {
    const db = S.db;
    if (!db || !S.sitz || !S.raum) return;
    const st = duellStand();
    if (!st.ende) return;
    const saat = neueSaat(st.nr + 1);
    try {
      await db.ref(`partie/${S.raum}/stand`).transaction((alt) => {
        if (!alt || Number(alt.nr) !== st.nr) return undefined;
        const beginnt = alt.beginnt === "b" ? "b" : "a";
        const ende = lageVon(String(alt.zuege || ""), beginnt, alt.saat).ende;
        if (!ende) return undefined;
        return { zuege: "", beginnt: anderer(beginnt), serie: `${String(alt.serie || "")}${ende}`, nr: Number(alt.nr) + 1, saat };
      });
    } catch (fehler) {
      console.warn("Die neue Partie ging nicht hinaus", fehler);
    }
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  function starte(spiel) {
    if (!spiel || document.body?.dataset?.page !== spiel.seite) return;
    S.spiel = spiel;
    const los = () => {
      S.wirt = document.querySelector("[data-zwei]");
      if (!S.wirt) return;
      window.addEventListener("popstate", route);
      // Wieder vorne (Handy aus der Tasche): da sein und neu zeichnen.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && S.raum && S.sitz) melden();
      });
      route();
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", los);
    else los();
  }

  window.LernappZwei = {
    starte,
    ton,
    el,
    knopf,
    anderer,
    live,
    // Für die Prüfung im Browser: was gerade gilt, und ein Zug ohne Tippen.
    test: TEST ? {
      lage: () => (S.ansicht === "computer" ? computerLage() : duellStand().lage),
      zuege: () => (S.ansicht === "computer" ? teile(S.computer.roh) : duellStand().zuege),
      zug: (z) => (S.ansicht === "computer" ? computerZug(String(z), "a") : duellZug(String(z))),
      sitz: () => (S.ansicht === "computer" ? "a" : S.sitz),
    } : null,
  };
})();
