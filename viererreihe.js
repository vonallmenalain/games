/*
 * viererreihe.js – Vier in einer Reihe: gegen den Computer oder live zu zweit.
 * ---------------------------------------------------------------------------
 * Die Seite /viererreihe. Ein Brett mit sieben Spalten und sechs Reihen; wer
 * an der Reihe ist, lässt einen Stein in eine Spalte fallen. Wer zuerst vier
 * gleiche in einer Reihe hat – waagrecht, senkrecht oder schräg –, gewinnt.
 *
 * Kein Spiel mit Bestenliste: Hier gibt es keine eine Zahl, die grösser
 * besser wäre. Gezählt wird nur, was zwei Menschen interessiert, die
 * gegeneinander spielen – eine kleine Bilanz.
 *
 *   Gegen den Computer   drei Stufen (viererreihe-ki.js). Die Bilanz je Stufe
 *                        steht auf dem Gerät (localStorage, BILANZ_KEY). Wer
 *                        beginnt, wechselt von Partie zu Partie. Geht ohne
 *                        Netz.
 *   Im Turnier           (?turnier=<id>, wenn der Admin Viererreihe zum
 *                        Turnier genommen hat): Wer eröffnet, steht bei allen
 *                        anderen im Turnier als grosser Knopf «Mit Lena
 *                        spielen» – ein Tipp, und man sitzt am Brett, ohne
 *                        Code und ohne Link (duellOffen/<turnier>). Der Weg
 *                        zurück führt ins Turnier.
 *   Zu zweit, live       jede auf ihrem Gerät. Wer eröffnet, bekommt einen
 *                        Link (/viererreihe?raum=K7QMX2PA9Z – zehn Zeichen,
 *                        nicht zu erraten) und einen Code mit vier Ziffern
 *                        zum Abtippen. Wer den Link öffnet oder den Code
 *                        eingibt, sitzt am Brett. Ein Dritter mit dem Link
 *                        schaut zu.
 *
 * Das Duell steht in der Realtime Database (database.rules.json), dieselbe
 * wie beim Multiplayer – sie schickt jeden Zug in Zehntelsekunden an das
 * andere Gerät und merkt, wer die Verbindung verliert:
 *
 *   duell/<raum>
 *     erstellt          wann                                einmal
 *     code              die vier Ziffern zum Abtippen        einmal
 *     a                 wer eröffnet hat: kennung, name, online, seit
 *     b                 wer dazukam: dasselbe – ist b besetzt, ist der
 *                       Raum voll
 *     stand             zuege (die Spalten der Partie als Text, «3342…»),
 *                       beginnt (a oder b), serie (wer die Partien davor
 *                       gewonnen hat: a, b oder u für unentschieden), nr
 *   duellCode/<code>    raum, bis – wohin die vier Ziffern führen, solange
 *                       der Raum auf jemanden wartet
 *   duellOffen/<turnier>/<raum>   name, kennung, seit – wer im Turnier
 *                       gerade wartet. Verschwindet, sobald jemand dazukommt,
 *                       der Wartende geht oder seine Verbindung abreisst
 *                       (onDisconnect).
 *
 * Gerechnet wird nichts in der Datenbank. Ein Zug ist eine Transaktion, die
 * an zuege eine Ziffer anhängt – nur wenn der Stand noch der ist, den das
 * Gerät gesehen hat, die Partie läuft und dieses Gerät dran ist. Die Regeln
 * lassen nichts anderes zu als genau eine Ziffer mehr oder eine neue Partie.
 * Jedes Gerät baut aus zuege dasselbe Brett (LernappVierer.ausZuegen) und
 * kommt auf denselben Sieger.
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "viererreihe") return;

  const V = window.LernappVierer;
  const mini = () => window.LernappMini || null;
  const cloud = () => window.MiniCloud || null;
  const kids = () => window.LernappKids || null;

  const BILANZ_KEY = "viererreihe.bilanz";
  const DUELLE_KEY = "viererreihe.duelle";
  // Keine 0/O und 1/I: Der Raum steht in einem Link, der auch einmal
  // abgeschrieben wird. Wie beim Multiplayer (live.js).
  const ZEICHEN = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const RAUM_LAENGE = 10;
  const RAUM_MUSTER = /^[A-Z2-9]{10}$/;
  const CODE_MUSTER = /^[0-9]{4}$/;
  // So lange führt der Code in den Raum (die Regeln lassen höchstens drei
  // Stunden zu). Danach geht es nur noch mit dem Link.
  const CODE_DAUER_MS = 2 * 60 * 60 * 1000;
  // Wie lange ein Duell im Menü unter «Weiterspielen» steht.
  const DUELL_MERKEN_MS = 3 * 24 * 60 * 60 * 1000;

  const STUFEN = {
    leicht: { name: "Ganz leicht", sterne: 0, satz: "Zum Lernen" },
    einfach: { name: "Einfach", sterne: 1, satz: "Zum Warmwerden" },
    mittel: { name: "Mittel", sterne: 2, satz: "Eine echte Aufgabe" },
    schwer: { name: "Schwer", sterne: 3, satz: "Kaum zu schlagen" },
  };

  // Das Turnier, aus dem die Seite geöffnet wurde (?turnier=…): Es bleibt in
  // jeder Adresse dieser Seite stehen, damit der Weg zurück dorthin führt
  // und die Turnier-App ihre Gäste nicht hinauswirft (turnier.js, heim).
  const TURNIER = (() => {
    try {
      const t = String(new URLSearchParams(window.location.search).get("turnier") || "");
      return /^[a-z0-9-]{6,48}$/.test(t) ? t : "";
    } catch { return ""; }
  })();
  const OFFEN_MAX_MS = 3 * 60 * 60 * 1000;
  // Aus dem Adminbereich ausprobiert (▶, ?von=admin): Das bleibt in jeder
  // Adresse stehen – sonst führte der Weg zurück nach dem ersten Klick nicht
  // mehr dorthin (mini-games.js, ausAdmin).
  const VON_ADMIN = (() => {
    try { return new URLSearchParams(window.location.search).get("von") === "admin"; } catch { return false; }
  })();

  // Für die Prüfung im Browser: ein Emulator der Realtime Database auf
  // diesem Rechner. Gilt nur für eine Adresse auf dem eigenen Rechner – wie
  // im Multiplayer (live.js).
  const TEST = (() => {
    const t = window.__viererTest;
    if (!t || !/^(127\.0\.0\.1|localhost):\d+$/.test(String(t.emulator || ""))) return null;
    return t;
  })();

  const S = {
    wirt: null,
    ansicht: "",
    // gegen den Computer
    stufe: "einfach",
    computer: { zuege: "", beginnt: "a", nr: 0 },
    denkt: false,
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
    // im Turnier: als Wartender gemeldet (der Raum), und wer der Liste
    // der Wartenden zuhört, wieder aufhören
    offenGemeldet: "",
    menueAus: null,
    // das Brett, wie es gerade gezeichnet ist
    brett: null,
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

  function zufallsText(laenge, zeichen) {
    const zahlen = new Uint32Array(laenge);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(zahlen);
    else for (let i = 0; i < laenge; i += 1) zahlen[i] = Math.floor(Math.random() * 4294967296);
    let text = "";
    zahlen.forEach((n) => { text += zeichen[n % zeichen.length]; });
    return text;
  }

  function meinName() {
    return mini()?.name?.() || "";
  }

  // Ein Stein als Bild – im Text, in den Namen, im Menü.
  function steinZeichen(sitz, klasse = "") {
    const s = el("span", `vr-mini-stein ist-${sitz} ${klasse}`.trim());
    s.setAttribute("aria-hidden", "true");
    return s;
  }

  // ---------------------------------------------------------------------------
  // Klang: drei kleine Töne aus dem Baukasten von kids.js, damit der
  // Ton-Knopf oben rechts (Lautstärke, stumm) auch hier gilt.
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
      // Der Stein schlägt auf: tief und kurz, mit einem hellen Klick darüber.
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

  // ---------------------------------------------------------------------------
  // Das Brett
  // ---------------------------------------------------------------------------
  /*
   * Hinten eine dunkle Rückwand, davor die Steine, ganz vorne die Platte mit
   * den Löchern (eine Maske, styles.css .vr-platte) – so fällt ein Stein
   * hinter der Platte hinunter, wie bei einem echten Brett. Darüber sieben
   * unsichtbare Knöpfe, je einer für eine ganze Spalte, und über dem Brett
   * eine Reihe Luft: Dort schwebt der Stein, der gleich fällt.
   *
   *   beiZug(spalte)   was ein Tipp auf eine Spalte tut
   *
   * zeichne({ zuege, beginnt, dran, ich }) bringt das Bild auf den Stand:
   * Kommt ein Zug dazu, fällt er; ist es eine neue Partie, fallen die alten
   * Steine unten hinaus.
   */
  function brettBauen({ beiZug }) {
    const feld = el("div", "vr-feld");
    const brett = el("div", "vr-brett");
    const steine = el("div", "vr-steine");
    const platte = el("div", "vr-platte");
    platte.setAttribute("aria-hidden", "true");
    const vorschau = el("span", "vr-stein vr-vorschau");
    vorschau.setAttribute("aria-hidden", "true");
    vorschau.hidden = true;
    const spalten = el("div", "vr-spalten");
    spalten.setAttribute("role", "group");
    spalten.setAttribute("aria-label", "Spalten des Bretts");
    brett.append(steine, platte);
    feld.append(vorschau, brett, spalten);

    const zustand = { zuege: null, beginnt: "a", nr: -1, knoten: [], dran: null, ich: null, aus: false };
    let zeiger = -1;

    const knoepfe = [];
    for (let c = 0; c < V.SPALTEN; c += 1) {
      const k = el("button", "vr-spalte");
      k.type = "button";
      k.dataset.spalte = String(c);
      k.addEventListener("click", () => beiZug(c));
      k.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") zeige(c); });
      k.addEventListener("focus", () => zeige(c));
      k.addEventListener("keydown", (e) => {
        let ziel = -1;
        if (e.key === "ArrowLeft") ziel = Math.max(0, c - 1);
        else if (e.key === "ArrowRight") ziel = Math.min(V.SPALTEN - 1, c + 1);
        else if (/^[1-7]$/.test(e.key)) { e.preventDefault(); beiZug(Number(e.key) - 1); return; }
        if (ziel < 0) return;
        e.preventDefault();
        knoepfe[ziel].focus();
      });
      knoepfe.push(k);
      spalten.append(k);
    }
    spalten.addEventListener("pointerleave", () => zeige(-1));

    function wessen(stein, beginnt) {
      return stein === 1 ? beginnt : anderer(beginnt);
    }

    // Der schwebende Stein über der Spalte: nur wenn ich dran bin.
    function zeige(c) {
      zeiger = c;
      const darf = !zustand.aus && zustand.dran && zustand.dran === zustand.ich && c >= 0;
      vorschau.hidden = !darf;
      if (!darf) return;
      vorschau.className = `vr-stein vr-vorschau ist-${zustand.ich}`;
      vorschau.style.setProperty("--c", String(c));
    }

    function steinKnoten(c, r, sitz) {
      const s = el("span", `vr-stein ist-${sitz}`);
      s.style.setProperty("--c", String(c));
      s.style.setProperty("--r", String(r));
      return s;
    }

    // Ein Stein fällt von über dem Brett bis in seine Reihe – und federt kurz.
    function fallen(knoten, r, { leise = false } = {}) {
      if (ruhig() || !knoten.animate) { if (!leise) ton("klack"); return; }
      const hoehe = V.REIHEN - r; // in Zellen, von der Reihe über dem Brett
      const dauer = 180 + Math.sqrt(hoehe) * 120;
      const flug = knoten.animate([
        { transform: `translateY(${-hoehe * 100}%)` },
        { transform: "translateY(0)" },
      ], { duration: dauer, easing: "cubic-bezier(0.55, 0, 1, 0.45)" });
      flug.onfinish = () => {
        if (!leise) ton("klack");
        knoten.animate([
          { transform: "translateY(0)" },
          { transform: "translateY(-14%)", offset: 0.45 },
          { transform: "translateY(0)" },
        ], { duration: 170, easing: "ease-out" });
      };
    }

    // Die Steine einer fertigen Partie fallen unten hinaus.
    function leeren() {
      const alte = [...steine.children];
      if (!alte.length) return;
      if (ruhig() || !alte[0].animate) { alte.forEach((s) => s.remove()); return; }
      alte.forEach((s) => {
        s.classList.remove("ist-sieg", "ist-letzter");
        const r = Number(s.style.getPropertyValue("--r")) || 0;
        const a = s.animate([
          { transform: "translateY(0)", opacity: 1 },
          { transform: `translateY(${(r + 2) * 100}%)`, opacity: 0 },
        ], { duration: 380 + Math.random() * 160, delay: Math.random() * 90, easing: "cubic-bezier(0.5, 0, 1, 0.5)", fill: "forwards" });
        a.onfinish = () => s.remove();
      });
    }

    function beschrifte() {
      knoepfe.forEach((k, c) => {
        const frei = zustand.lage ? V.REIHEN - zustand.lage.brett.h[c] : V.REIHEN;
        const darf = !zustand.aus && zustand.dran && zustand.dran === zustand.ich && frei > 0;
        k.disabled = !darf;
        k.setAttribute("aria-label", `Spalte ${c + 1}${frei ? `, noch ${frei} frei` : ", voll"}`);
      });
    }

    function zeichne({ zuege, beginnt, nr, dran, ich, aus }) {
      const neuePartie = nr !== zustand.nr || beginnt !== zustand.beginnt
        || zustand.zuege === null || !zuege.startsWith(zustand.zuege);
      if (neuePartie) {
        const vorher = zustand.zuege;
        if (vorher !== null) leeren();
        else steine.innerHTML = "";
        zustand.zuege = "";
        zustand.knoten = [];
      }
      zustand.nr = nr;
      zustand.beginnt = beginnt;
      zustand.dran = dran;
      zustand.ich = ich;
      const lage = V.ausZuegen(zuege, 1);
      zustand.lage = lage;
      zustand.aus = aus || lage.sieger !== null;
      // Die neuen Steine: Beim ersten Bild (oder nach einer neuen Partie
      // aus der Datenbank) liegen viele auf einmal – die fallen schnell und
      // ohne Ton, nur der letzte richtig.
      const neu = zuege.slice(zustand.zuege.length);
      const b = V.neuesBrett();
      for (const z of zustand.zuege) V.setze(b, Number(z), 1);
      const viele = neu.length > 1;
      [...neu].forEach((z, i) => {
        const c = Number(z);
        const r = V.setze(b, c, 1);
        const stein = (zustand.zuege.length + i) % 2 === 0 ? 1 : 2;
        const knoten = steinKnoten(c, r, wessen(stein, beginnt));
        steine.append(knoten);
        zustand.knoten.push(knoten);
        const letzter = i === neu.length - 1;
        if (!viele || letzter) fallen(knoten, r, { leise: viele && !letzter });
      });
      zustand.zuege = zuege;
      zustand.knoten.forEach((k, i) => k.classList.toggle("ist-letzter", i === zustand.knoten.length - 1 && lage.sieger === null));
      // Die Reihe, die gewonnen hat.
      const sieg = new Set((lage.reihe || []).map(([c, r]) => `${c},${r}`));
      const b2 = V.neuesBrett();
      zustand.knoten.forEach((k, i) => {
        const c = Number(zuege[i]);
        const r = V.setze(b2, c, 1);
        k.classList.toggle("ist-sieg", sieg.has(`${c},${r}`));
      });
      brett.classList.toggle("ist-aus", lage.sieger !== null && lage.sieger !== 0);
      feld.classList.toggle("ist-dran", Boolean(!zustand.aus && dran && dran === ich));
      feld.dataset.dran = dran || "";
      beschrifte();
      zeige(zeiger);
      return lage;
    }

    return { knoten: feld, zeichne, fokus: () => knoepfe[3]?.focus({ preventScroll: true }) };
  }

  // ---------------------------------------------------------------------------
  // Die Ansicht einer Partie: Namen, Satz, Brett, Knöpfe
  // ---------------------------------------------------------------------------
  /*
   * Gemeinsam für den Computer und das Duell. spieler: { a: {name, zahl},
   * b: {name, zahl} }, satz, dran, ich, knoepfe – was die Partie gerade sagt.
   */
  function partieBauen({ beiZug }) {
    const wirt = el("section", "vr-partie");
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
    const mitte = el("span", "vr-leiste-mitte", ":");
    mitte.setAttribute("aria-hidden", "true");
    oben.append(a.k, mitte, b.k);
    const satz = el("p", "vr-satz");
    satz.setAttribute("aria-live", "polite");
    const brett = brettBauen({ beiZug });
    const unten = el("div", "vr-knoepfe");
    wirt.append(oben, satz, brett.knoten, unten);

    function zeige({ spieler, text, textSitz = null, dran, ich, knoepfe = [], zuege, beginnt, nr, aus = false, denkt = false, ende = null }) {
      for (const [sitz, k] of [["a", a], ["b", b]]) {
        const s = spieler[sitz] || {};
        k.name.textContent = s.name || "…";
        k.zahl.textContent = String(s.zahl ?? 0);
        k.k.classList.toggle("ist-dran", dran === sitz);
        k.k.classList.toggle("ist-weg", s.weg === true);
        k.punkt.hidden = s.weg !== true;
        k.punkt.title = s.weg ? "Gerade nicht verbunden" : "";
      }
      satz.innerHTML = "";
      if (textSitz) satz.append(steinZeichen(textSitz));
      satz.append(el("span", "vr-satz-text", text));
      if (denkt) satz.append(el("span", "vr-denkt", "…"));
      satz.classList.toggle("ist-ich", Boolean(dran && dran === ich));
      satz.classList.toggle("ist-ende", Boolean(ende));
      satz.classList.toggle("ist-sieg", Boolean(ende && ende !== "u" && (ende === ich || !ich)));
      unten.innerHTML = "";
      knoepfe.forEach((k) => unten.append(k));
      return brett.zeichne({ zuege, beginnt, nr, dran, ich, aus });
    }

    return { knoten: wirt, zeige, fokus: brett.fokus };
  }

  // Wer am Zug ist, nach zuege und beginnt.
  function amZug(zuege, beginnt) {
    return zuege.length % 2 === 0 ? beginnt : anderer(beginnt);
  }

  // Wer gewonnen hat, als Sitz (a, b) oder u – oder null, solange es läuft.
  function ausgang(lage, beginnt) {
    if (lage.sieger === null) return null;
    if (lage.sieger === 0) return "u";
    return lage.sieger === 1 ? beginnt : anderer(beginnt);
  }

  function feiern(ziel) {
    ton("sieg");
    kids()?.burstConfetti?.(ziel, 60);
    kids()?.vibrate?.([30, 40, 60]);
  }

  // ---------------------------------------------------------------------------
  // Der Rahmen der Seite: oben der Weg zurück, der Name, das Vollbild
  // ---------------------------------------------------------------------------
  function kopfBauen() {
    const kopf = el("header", "vr-kopf");
    const links = el("div", "vr-kopf-links");
    const zurueck = mini()?.leiste?.()?.[0];
    if (zurueck) links.append(zurueck);
    const titel = el("a", "vr-marke");
    titel.href = "/viererreihe";
    titel.append(el("span", "vr-marke-bild"), el("span", "vr-marke-wort", "Viererreihe"));
    titel.addEventListener("click", (e) => { e.preventDefault(); geh({}); });
    const rechts = el("div", "vr-kopf-rechts");
    const voll = window.LernappVollbild?.knopf?.("mini-vollbild vr-rund");
    if (voll) rechts.append(voll);
    kopf.append(links, titel, rechts);
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
  // Wege: die Adresse sagt, wo man ist
  // ---------------------------------------------------------------------------
  //   /viererreihe                  das Menü
  //   /viererreihe?gegen=mittel     eine Partie gegen den Computer
  //   /viererreihe?raum=K7QMX2PA9Z  ein Duell
  //   …&turnier=herbst-k3m9x2p7    dasselbe im Turnier
  function geh({ gegen = "", raum = "" }, { ersetzen = false } = {}) {
    const p = new URLSearchParams();
    if (TURNIER) p.set("turnier", TURNIER);
    if (VON_ADMIN) p.set("von", "admin");
    if (gegen) p.set("gegen", gegen);
    if (raum) p.set("raum", raum);
    const adresse = `/viererreihe${p.toString() ? `?${p}` : ""}`;
    try {
      if (ersetzen) window.history.replaceState({ vr: true }, "", adresse);
      else window.history.pushState({ vr: true }, "", adresse);
    } catch { /* ohne Verlauf */ }
    route();
  }

  function route() {
    const p = new URLSearchParams(window.location.search);
    const raum = String(p.get("raum") || "").toUpperCase();
    const gegen = String(p.get("gegen") || "");
    if (raum !== S.raum) duellVerlassen();
    if (raum) {
      if (!RAUM_MUSTER.test(raum)) { fehlerZeigen("Dieser Link ist nicht ganz angekommen – frag nach einem neuen."); return; }
      duellBetreten(raum);
      return;
    }
    if (STUFEN[gegen]) { computerStarten(gegen); return; }
    menueZeigen();
  }

  function fehlerZeigen(text) {
    const box = el("section", "vr-karte vr-fehler");
    box.append(el("p", "vr-fehler-text", text), knopf("Zum Menü", "mini-knopf mini-knopf-voll vr-los", () => geh({})));
    ansicht("fehler", box);
  }

  // ---------------------------------------------------------------------------
  // Das Menü
  // ---------------------------------------------------------------------------
  function bilanzen() {
    const roh = liesJson(BILANZ_KEY, {});
    const raus = {};
    for (const s of Object.keys(STUFEN)) {
      const x = roh?.[s] || {};
      raus[s] = { s: Number(x.s) || 0, n: Number(x.n) || 0, u: Number(x.u) || 0 };
    }
    return raus;
  }

  function bilanzZaehlen(stufe, wie) {
    const alle = bilanzen();
    alle[stufe][wie] += 1;
    schreibeJson(BILANZ_KEY, alle);
  }

  function bilanzSatz(x) {
    if (!x.s && !x.n && !x.u) return "Noch nicht gespielt";
    const teile = [`${x.s} gewonnen`, `${x.n} verloren`];
    if (x.u) teile.push(`${x.u} unentschieden`);
    return teile.join(" · ");
  }

  function gemerkteDuelle() {
    const liste = liesJson(DUELLE_KEY, []);
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
    schreibeJson(DUELLE_KEY, alt.slice(0, 4));
  }

  function duellVergessen(raum) {
    schreibeJson(DUELLE_KEY, gemerkteDuelle().filter((d) => d.raum !== raum));
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
    const satz = el("p", "vr-hinweis", text);
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
    S.computer.zuege = "";
    const seite = el("div", "vr-menue");

    const kopf = el("section", "vr-held");
    const bild = el("div", "vr-held-bild");
    bild.setAttribute("aria-hidden", "true");
    // Ein kleines Brett mit einer Viererreihe, schräg hinauf.
    const MUSTER = ["", "b", "ab", "bab", "abba", "a", "b"];
    MUSTER.forEach((spalte, c) => {
      [...spalte].forEach((sitz, r) => {
        const s = el("span", `vr-held-stein ist-${sitz}${(c === r && sitz === "a" && c <= 3) ? " ist-reihe" : ""}`);
        s.style.setProperty("--c", String(c));
        s.style.setProperty("--r", String(r));
        bild.append(s);
      });
    });
    const text = el("div", "vr-held-text");
    text.append(el("h1", "vr-titel", "Viererreihe"),
      el("p", "vr-unter", "Lass die Steine fallen. Wer zuerst vier gleiche in einer Reihe hat – waagrecht, senkrecht oder schräg –, gewinnt."));
    kopf.append(bild, text);

    // Wer spielt: der Name dieses Geräts, zu ändern wie überall in der arcade.
    const wer = mini()?.namensZeile?.({ klasse: "vr-wer-zeile", beiWechsel: () => window.setTimeout(menueZeigen, 1200) });

    // Gegen den Computer
    const pc = el("section", "vr-karte vr-karte-pc");
    pc.append(el("h2", "vr-karte-titel", "Gegen den Computer"));
    const stufen = el("div", "vr-stufen");
    const b = bilanzen();
    for (const [id, st] of Object.entries(STUFEN)) {
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

    // Zu zweit, live
    const live = el("section", "vr-karte vr-karte-live");
    live.append(el("h2", "vr-karte-titel", "Zu zweit, live"));
    // Im Turnier: wer gerade wartet, als grosser Knopf – ein Tipp, und man
    // sitzt am Brett. Darunter das eigene «Neues Spiel».
    const wartende = el("div", "vr-wartende");
    wartende.setAttribute("aria-live", "polite");
    if (TURNIER) live.append(wartende);
    live.append(el("p", "vr-hinweis", TURNIER
      ? "Jede auf dem eigenen Gerät. Wer ein Spiel eröffnet, steht hier bei allen im Turnier – ein Tipp, und es geht los."
      : "Jede und jeder auf dem eigenen Gerät. Du eröffnest und schickst den Link – oder sagst den Code mit vier Ziffern."));
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
    if (TURNIER) seite.append(live, pc);
    else seite.append(pc, live);
    ansicht("menue", seite);
    document.title = "Viererreihe · arcade";

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

  // Wer im Turnier gerade wartet – ohne mich selbst, und nichts, was älter
  // ist als drei Stunden. Gibt zurück, wie man wieder aufhört zuzuhören.
  function offeneHoeren(beiListe) {
    const db = datenbank();
    if (!db || !TURNIER) return null;
    const ref = db.ref(`duellOffen/${TURNIER}`);
    const hoerer = (s) => {
      const d = s.val() || {};
      const meine = mini()?.kennung?.() || "";
      const grenze = jetzt() - OFFEN_MAX_MS;
      beiListe(Object.entries(d)
        .filter(([raum, o]) => RAUM_MUSTER.test(raum) && o && o.name && o.kennung !== meine && Number(o.seit) > grenze)
        .map(([raum, o]) => ({ raum, name: String(o.name), seit: Number(o.seit) }))
        .sort((x, y) => x.seit - y.seit));
    };
    ref.on("value", hoerer, () => beiListe([]));
    return () => ref.off("value", hoerer);
  }

  // ---------------------------------------------------------------------------
  // Gegen den Computer
  // ---------------------------------------------------------------------------
  // Du bist a (koralle), der Computer b (gold). Wer beginnt, wechselt von
  // Partie zu Partie; die erste beginnst du.
  let computerAnsicht = null;
  let partieNr = 0;

  function computerStarten(stufe) {
    S.stufe = stufe;
    S.computer = { zuege: "", beginnt: "a", nr: 0 };
    S.denkt = false;
    partieNr += 1;
    computerAnsicht = partieBauen({ beiZug: computerSpieltMensch });
    ansicht("computer", computerAnsicht.knoten);
    document.title = `${STUFEN[stufe].name} · Viererreihe · arcade`;
    computerZeichnen();
    if (amZug(S.computer.zuege, S.computer.beginnt) === "b") computerDenkt();
    else window.setTimeout(() => computerAnsicht?.fokus?.(), 60);
  }

  function computerNochmal() {
    S.computer = { zuege: "", beginnt: anderer(S.computer.beginnt), nr: S.computer.nr + 1 };
    S.denkt = false;
    partieNr += 1;
    computerZeichnen();
    if (S.computer.beginnt === "b") window.setTimeout(computerDenkt, 450);
  }

  function computerZeichnen() {
    if (S.ansicht !== "computer" || !computerAnsicht) return null;
    const { zuege, beginnt, nr } = S.computer;
    const lage = V.ausZuegen(zuege, 1);
    const ende = ausgang(lage, beginnt);
    const dran = ende ? null : amZug(zuege, beginnt);
    const b = bilanzen()[S.stufe];
    const st = STUFEN[S.stufe];
    let text = "";
    let textSitz = null;
    if (ende === "a") { text = "Du hast gewonnen!"; textSitz = "a"; }
    else if (ende === "b") { text = "Der Computer hat gewonnen."; textSitz = "b"; }
    else if (ende === "u") text = "Unentschieden – das Brett ist voll.";
    else if (dran === "a") { text = zuege.length ? "Du bist dran" : "Du beginnst – tippe auf eine Spalte"; textSitz = "a"; }
    else { text = zuege.length ? "Der Computer überlegt" : "Der Computer beginnt"; textSitz = "b"; }
    const knoepfe = [];
    if (ende) knoepfe.push(knopf("Nochmal", "mini-knopf mini-knopf-voll vr-los vr-nochmal", computerNochmal));
    else if (zuege.length) knoepfe.push(knopf("Neu anfangen", "mini-knopf mini-knopf-still vr-neu", computerNochmal));
    knoepfe.push(knopf(`Stufe: ${st.name}`, "mini-knopf mini-knopf-still vr-menue-knopf", () => geh({})));
    return computerAnsicht.zeige({
      spieler: {
        a: { name: meinName() || "Du", zahl: b.s },
        b: { name: "Computer", zahl: b.n },
      },
      text,
      textSitz,
      dran,
      ich: "a",
      knoepfe,
      zuege,
      beginnt,
      nr,
      denkt: dran === "b" && S.denkt,
      ende,
    });
  }

  function computerZugAusfuehren(c, sitz) {
    const { zuege, beginnt } = S.computer;
    const lage = V.ausZuegen(zuege, 1);
    if (lage.sieger !== null || amZug(zuege, beginnt) !== sitz || !V.frei(lage.brett, c)) return false;
    S.computer.zuege = zuege + c;
    const nachher = computerZeichnen();
    const ende = nachher ? ausgang(nachher, beginnt) : null;
    if (ende) {
      bilanzZaehlen(S.stufe, ende === "a" ? "s" : ende === "b" ? "n" : "u");
      computerZeichnen();
      const wann = ruhig() ? 50 : 520;
      window.setTimeout(() => {
        if (S.ansicht !== "computer") return;
        if (ende === "a") feiern(S.wirt.querySelector(".vr-feld"));
        else ton(ende === "b" ? "verloren" : "remis");
        S.wirt.querySelector(".vr-nochmal")?.focus({ preventScroll: true });
      }, wann);
    }
    return true;
  }

  function computerSpieltMensch(c) {
    if (S.denkt) return;
    if (!computerZugAusfuehren(c, "a")) return;
    if (amZug(S.computer.zuege, S.computer.beginnt) === "b" && V.ausZuegen(S.computer.zuege, 1).sieger === null) computerDenkt();
  }

  // Der Computer überlegt – sichtbar und ein bisschen länger, als er
  // bräuchte: Ein Stein, der sofort zurückkommt, ist schwer zu verfolgen.
  function computerDenkt() {
    const meine = partieNr;
    S.denkt = true;
    computerZeichnen();
    const start = Date.now();
    const mindestens = ruhig() ? 250 : 650 + Math.random() * 350;
    // Erst wenn der eigene Stein gefallen ist, wird gerechnet – sonst hielte
    // die Suche das Bild an.
    window.setTimeout(() => {
      if (meine !== partieNr || S.ansicht !== "computer") return;
      const lage = V.ausZuegen(S.computer.zuege, 1);
      if (lage.sieger !== null) { S.denkt = false; return; }
      const stein = lage.amZug;
      let c = -1;
      try { c = V.computerZug(lage.brett, stein, S.stufe, { zeit: 650 }); } catch (fehler) { console.warn("Der Computer kam nicht weiter", fehler); }
      if (c < 0 || !V.frei(lage.brett, c)) c = [3, 2, 4, 1, 5, 0, 6].find((x) => V.frei(lage.brett, x));
      const warte = Math.max(0, mindestens - (Date.now() - start));
      window.setTimeout(() => {
        if (meine !== partieNr || S.ansicht !== "computer") return;
        S.denkt = false;
        computerZugAusfuehren(c, "b");
        computerZeichnen();
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
      await db.ref(`duell/${raum}`).update({
        erstellt: TIMESTAMP(),
        a: { kennung: wer.kennung, name: wer.name, online: true, seit: TIMESTAMP() },
        stand: { zuege: "", beginnt: "a", serie: "", nr: 0 },
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
        const t = await db.ref(`duellCode/${code}`).transaction((alt) => {
          if (alt && Number(alt.bis) > jetzt()) return undefined;
          return { raum, bis };
        }, undefined, false);
        if (t.committed) {
          await db.ref(`duell/${raum}/code`).set(code);
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
      const s = await db.ref(`duellCode/${code}`).get();
      const v = s.val();
      if (!v || !RAUM_MUSTER.test(String(v.raum || "")) || Number(v.bis) < jetzt()) {
        return { fehler: "Diesen Code gibt es nicht – oder nicht mehr. Lass dir den Link schicken." };
      }
      return { raum: v.raum };
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
    const ref = db.ref(`duell/${S.raum}/${S.sitz}`);
    const wer = ich();
    ref.update({ online: true, name: wer.name || S.daten?.[S.sitz]?.name || "?", seit: TIMESTAMP() })
      .then(() => ref.onDisconnect().update({ online: false }))
      .catch((fehler) => console.warn("Melden ging nicht", fehler))
      .finally(() => { S.meldet = false; });
  }

  /*
   * Im Turnier: wer eröffnet hat und noch allein ist, steht bei den anderen
   * als «… wartet» (duellOffen/<turnier>/<raum>). Reisst die Verbindung ab,
   * nimmt die Datenbank den Eintrag selbst weg – ein Tablet, das schläft,
   * lädt niemanden mehr ein. Kommt sie zurück, meldet sich das Gerät neu.
   */
  function offenMelden() {
    const db = S.db;
    const d = S.daten;
    if (!TURNIER || !db || !S.verbunden || S.sitz !== "a" || !d || d.b || S.offenGemeldet === S.raum) return;
    const raum = S.raum;
    S.offenGemeldet = raum;
    const ref = db.ref(`duellOffen/${TURNIER}/${raum}`);
    ref.onDisconnect().remove()
      .then(() => ref.set({ name: ich().name || d.a?.name || "?", kennung: d.a.kennung, seit: TIMESTAMP() }))
      .catch((fehler) => {
        console.warn("Im Turnier warten ging nicht", fehler);
        if (S.offenGemeldet === raum) S.offenGemeldet = "";
      });
  }

  function offenWeg(raum = S.raum) {
    if (!TURNIER || !S.db || !raum) return;
    const ref = S.db.ref(`duellOffen/${TURNIER}/${raum}`);
    ref.onDisconnect().cancel().catch(() => {});
    ref.remove().catch(() => {});
    if (S.offenGemeldet === raum) S.offenGemeldet = "";
  }

  function duellVerlassen() {
    if (!S.raum) return;
    const db = S.db;
    if (S.sitz === "a" && !S.daten?.b) offenWeg();
    if (db && S.hoerer) db.ref(`duell/${S.raum}`).off("value", S.hoerer);
    if (db && S.sitz) {
      const ref = db.ref(`duell/${S.raum}/${S.sitz}`);
      ref.onDisconnect().cancel().catch(() => {});
      ref.update({ online: false }).catch(() => {});
    }
    S.raum = "";
    S.daten = null;
    S.geladen = false;
    S.sitz = null;
    S.hoerer = null;
    S.beitrittVersucht = false;
    duellAnsicht = null;
    letzterStand = null;
    document.title = "Viererreihe · arcade";
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
      sitzFinden();
      duellZeichnen();
    };
    db.ref(`duell/${raum}`).on("value", S.hoerer, (fehler) => {
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
      const t = await db.ref(`duell/${raum}/b`).transaction((alt) => {
        if (alt && alt.kennung !== wer.kennung) return undefined;
        return { kennung: wer.kennung, name: wer.name, online: true, seit: jetzt() };
      }, undefined, false);
      if (t.committed && S.raum === raum) {
        // Der Raum ist voll: Die vier Ziffern führen nicht mehr hierher.
        const code = S.daten?.code;
        if (code && CODE_MUSTER.test(code)) db.ref(`duellCode/${code}`).remove().catch(() => {});
        // Und im Turnier wartet niemand mehr.
        if (TURNIER) db.ref(`duellOffen/${TURNIER}/${raum}`).remove().catch(() => {});
        ton("da");
      }
    } catch (fehler) {
      console.warn("Beitreten ging nicht", fehler);
    }
  }

  function duellLink() {
    return `${window.location.origin}/viererreihe?${TURNIER ? `turnier=${encodeURIComponent(TURNIER)}&` : ""}raum=${S.raum}`;
  }

  async function teilen(meldung) {
    const link = duellLink();
    const code = S.daten?.code;
    const text = `${meinName() || "Jemand"} fordert dich zu einer Partie Viererreihe heraus.${code ? ` Code: ${code}` : ""}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Viererreihe", text, url: link }); return; } catch (e) { if (e?.name === "AbortError") return; }
    }
    try {
      await navigator.clipboard.writeText(link);
      meldung.textContent = "Link kopiert – jetzt einfügen und schicken.";
    } catch {
      meldung.textContent = link;
    }
  }

  // Der Stand einer Partie: wer wo sitzt, wer dran ist, wie es steht.
  function duellStand() {
    const d = S.daten || {};
    const st = d.stand || { zuege: "", beginnt: "a", serie: "", nr: 0 };
    const zuege = String(st.zuege || "");
    const beginnt = st.beginnt === "b" ? "b" : "a";
    const lage = V.ausZuegen(zuege, 1);
    const ende = ausgang(lage, beginnt);
    const serie = String(st.serie || "") + (ende || "");
    const zahl = { a: 0, b: 0, u: 0 };
    for (const z of serie) if (zahl[z] !== undefined) zahl[z] += 1;
    return { zuege, beginnt, nr: Number(st.nr) || 0, lage, ende, zahl, serie: String(st.serie || "") };
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
      box.append(el("h2", "vr-karte-titel", `${d.a.name} fordert dich heraus`),
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
    const dran = st.ende ? null : amZug(st.zuege, st.beginnt);
    const gegen = S.sitz ? anderer(S.sitz) : null;
    const nameVon = (sitz) => (sitz === S.sitz ? `${d[sitz]?.name || "Du"} (du)` : d[sitz]?.name || "…");
    const weg = (sitz) => Boolean(d[sitz] && d[sitz].online === false);

    let text = "";
    let textSitz = null;
    if (st.ende === "u") text = "Unentschieden – das Brett ist voll.";
    else if (st.ende) {
      textSitz = st.ende;
      if (!S.sitz) text = `${d[st.ende]?.name || "?"} hat gewonnen!`;
      else text = st.ende === S.sitz ? "Du hast gewonnen!" : `${d[st.ende]?.name || "?"} hat gewonnen.`;
    } else {
      textSitz = dran;
      if (dran === S.sitz) text = st.zuege.length ? "Du bist dran" : "Du beginnst – tippe auf eine Spalte";
      else if (gegen && dran === gegen && weg(gegen)) text = `${d[gegen]?.name || "?"} ist dran – aber gerade nicht verbunden`;
      else text = `${d[dran]?.name || "?"} ist dran`;
    }
    if (!S.verbunden) text = `${text} · keine Verbindung`;

    const knoepfe = [];
    if (st.ende && S.sitz) knoepfe.push(knopf("Nochmal", "mini-knopf mini-knopf-voll vr-los vr-nochmal", duellNochmal));
    if (!S.sitz) knoepfe.push(el("span", "vr-zuschauen", "Du schaust zu"));
    const meldung = el("span", "vr-meldung");
    if (S.sitz) knoepfe.push(knopf("Link", "mini-knopf mini-knopf-still vr-teilen", () => teilen(meldung)));
    knoepfe.push(knopf("Menü", "mini-knopf mini-knopf-still vr-menue-knopf", () => geh({})));
    knoepfe.push(meldung);

    const vorher = letzterStand;
    const lage = duellAnsicht.zeige({
      spieler: {
        a: { name: nameVon("a"), zahl: st.zahl.a, weg: weg("a") },
        b: { name: nameVon("b"), zahl: st.zahl.b, weg: weg("b") },
      },
      text,
      textSitz,
      dran,
      ich: S.sitz,
      knoepfe,
      zuege: st.zuege,
      beginnt: st.beginnt,
      nr: st.nr,
      ende: st.ende,
    });
    letzterStand = { nr: st.nr, zuege: st.zuege, ende: st.ende };

    // Was gerade passiert ist: Ende der Partie, oder ich bin wieder dran.
    if (vorher && lage) {
      const gleichePartie = vorher.nr === st.nr;
      if (st.ende && !(gleichePartie && vorher.ende)) {
        window.setTimeout(() => {
          if (S.ansicht !== "duell") return;
          if (st.ende === "u") ton("remis");
          else if (!S.sitz || st.ende === S.sitz) feiern(S.wirt.querySelector(".vr-feld"));
          else ton("verloren");
        }, ruhig() ? 50 : 520);
      } else if (!st.ende && dran === S.sitz && st.zuege !== vorher.zuege && st.zuege.length && document.visibilityState === "visible") {
        window.setTimeout(() => ton("dran"), 420);
      }
    }
    document.title = !st.ende && dran && dran === S.sitz ? "● Du bist dran · Viererreihe" : "Viererreihe · arcade";
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
      code.append(el("p", "vr-code-label", "Code"), ziffern);
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
        el("p", "vr-hinweis", "Sobald jemand darauf tippt, geht es los – hier und dort."));
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
        el("p", "vr-hinweis", "Schick den Link – oder sag den Code. Sobald jemand da ist, geht es los."), code);
      const reihe = el("div", "vr-knoepfe");
      reihe.append(teilenKnopf, abbrechen);
      box.append(reihe, meldung, link, punkte);
    }
    ansicht("lobby", box);
    S.wirt.dataset.code = String(d.code || "");
    document.title = "Warte … · Viererreihe";
  }


  async function duellZug(c) {
    const db = S.db;
    if (!db || !S.sitz || !S.raum) return;
    const st = duellStand();
    if (st.ende || amZug(st.zuege, st.beginnt) !== S.sitz || !V.frei(st.lage.brett, c)) return;
    const sitz = S.sitz;
    try {
      await db.ref(`duell/${S.raum}/stand`).transaction((alt) => {
        if (!alt) return undefined;
        const zuege = String(alt.zuege || "");
        const beginnt = alt.beginnt === "b" ? "b" : "a";
        if (Number(alt.nr) !== st.nr || zuege !== st.zuege) return undefined;
        const lage = V.ausZuegen(zuege, 1);
        if (lage.sieger !== null || amZug(zuege, beginnt) !== sitz || !V.frei(lage.brett, c)) return undefined;
        return { ...alt, zuege: zuege + c };
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
    try {
      await db.ref(`duell/${S.raum}/stand`).transaction((alt) => {
        if (!alt || Number(alt.nr) !== st.nr) return undefined;
        const zuege = String(alt.zuege || "");
        const beginnt = alt.beginnt === "b" ? "b" : "a";
        const ende = ausgang(V.ausZuegen(zuege, 1), beginnt);
        if (!ende) return undefined;
        return { zuege: "", beginnt: anderer(beginnt), serie: `${String(alt.serie || "")}${ende}`, nr: Number(alt.nr) + 1 };
      });
    } catch (fehler) {
      console.warn("Die neue Partie ging nicht hinaus", fehler);
    }
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  function starte() {
    S.wirt = document.querySelector("[data-viererreihe]");
    if (!S.wirt || !V) return;
    window.addEventListener("popstate", route);
    // Wieder vorne (Handy aus der Tasche): da sein und neu zeichnen.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && S.raum && S.sitz) melden();
    });
    route();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", starte);
  else starte();
})();
