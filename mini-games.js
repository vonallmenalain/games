/*
 * mini-games.js – Die Spiele allein, für alle, ohne Konto.
 * ---------------------------------------------------------------------------
 * Ein einzelnes Spiel, ein Link, eine Bestenliste, auf der alle stehen:
 *
 *     https://games.alae.app/turmbau
 *
 * Gedacht ist das zum Weitergeben. Man schickt den Link einem Freund, einem
 * Grosi, einer Klasse, und wer ihn öffnet, spielt sofort: kein Konto, keine
 * Anmeldung, keine Schranke. Nur das Spiel und die Frage, wer die höchste
 * Zahl schafft.
 *
 * Die Spiele stammen aus Gripszug (kids.alae.app) – dort sind sie ein Teil
 * von etwas Grösserem: Ein Kind spielt, sein Wagen wächst, die Reise geht
 * weiter. Hier ist das Gegenteil davon. Welche Spiele es überhaupt
 * gibt, sagt die Tabelle SPIELE weiter unten. Und welche davon offen sind,
 * sagt der Adminbereich: Er schreibt die Liste nach config/miniGames, und die
 * Startseite zeigt genau die. Steht dort nichts, gelten alle.
 *
 * Drei Dinge macht diese Datei:
 *
 *   1. Auf einer Spielseite baut sie den Weg zurück oben links und den Block
 *      unter dem Ergebnis: Namensfeld, eigener Platz, Bestenliste.
 *   2. Die Hall of Fame auf der Startseite: die Spiele als Karten, dazu die
 *      Auswertung über alle Namen – wer den besten Durchschnittsrang hat, wer
 *      wie oft gespielt hat, wer wie viele Spiele oben steht.
 *   3. Den Hintergrund: Jede Spielseite bekommt eine andere Landschaft, der
 *      Reihe nach.
 *
 * Der Name gehört dem Gerät, nicht einem Konto: Er steht im localStorage und
 * wird beim nächsten Spiel wieder vorgeschlagen. Dazu eine Kennung (mini_…),
 * die das Gerät sich selbst gibt – sie sorgt dafür, dass ein Spieler je Spiel
 * eine Zeile hat und nicht zehn. Gespeichert wird beides in miniScores
 * (cloud.js), lesbar für alle.
 */
(() => {
  "use strict";

  // ---------------------------------------------------------------------------
  // Welche Spiele Mini-Games sein können
  // ---------------------------------------------------------------------------
  // Ein Mini-Game braucht genau eine Zahl, die grösser besser ist – sonst
  // gäbe es nichts zu vergleichen, und "eine Bestenliste" wäre ein
  // Versprechen ohne Inhalt. Das sind die Spiele mit Punkten (highscore.js,
  // art: "punkte") und gemeinsamer Bühne (game-shell.js): eine Runde, ein
  // Ergebnis, fertig.
  //
  // Spiele mit Sternen je Level (Memory, Weichen-Wirrwarr, Fässer) und Rätsel
  // aus einem Levelkatalog (Arukone, Kakuro) passen nicht hierher: Bei ihnen
  // hätten am Ende alle drei Sterne, und die Liste sagte nichts mehr.
  //
  //   id      der Name in der Bestenliste (miniScores.game). Er ist derselbe
  //           wie in der App – wer dort ein Mini-Game gespielt hat, steht
  //           hier in derselben Liste.
  //   seite   die Datei und zugleich das letzte Stück der Adresse, die man
  //           weitergibt: games.alae.app/turmbau.
  //   page    was am body steht. Daran erkennt das Spiel seine eigene Seite
  //           (turmbau.js: dataset.page !== "tower" → nichts tun).
  //
  // scripts/seiten-bauen.mjs baut aus dieser Tabelle die Seiten, das Manifest
  // und den Service Worker; scripts/pruefen.mjs hält beides zusammen.
  const SPIELE = [
    { id: "tileMemory", seite: "kacheln", page: "tiles" },
    { id: "fishPond", seite: "fischteich", page: "pond" },
    { id: "leafFlow", seite: "blaetter", page: "leaves" },
    { id: "towerStack", seite: "turmbau", page: "tower" },
    { id: "bridgeBuilder", seite: "bruecke", page: "bridge" },
    { id: "dartWheel", seite: "drehscheibe", page: "wheel" },
    { id: "vineSwing", seite: "liane", page: "vine" },
    { id: "tunnelFlight", seite: "tunnelflug", page: "tunnel" },
    { id: "driftRace", seite: "drift", page: "drift" },
    { id: "planetHop", seite: "planeten", page: "planets" },
    { id: "moonLander", seite: "mondlandung", page: "moon" },
    { id: "gravityRun", seite: "schwerkraft", page: "gravity" },
    { id: "hillGlide", seite: "huegel", page: "hills" },
    { id: "balloonRide", seite: "ballon", page: "balloon" },
    { id: "skiSlalom", seite: "slalom", page: "slalom" },
    { id: "frogHop", seite: "frosch", page: "frog" },
    { id: "waveRider", seite: "wellen", page: "waves" },
    { id: "craneHarbor", seite: "kranhafen", page: "harbor" },
    { id: "ropeWalk", seite: "seiltaenzer", page: "rope" },
    { id: "numberLine", seite: "zahlengleis", page: "numberline" },
    { id: "boilerRoom", seite: "heizer", page: "boiler" },
  ];

  // Die Tiers: wie der Admin die Spiele einteilt – im Adminbereich und beim
  // Anlegen eines Turniers stehen sie danach gruppiert (admin.js). Was hier
  // steht, ist die Vorgabe; der Admin teilt im Adminbereich selbst ein, und
  // das steht dann in config/miniGames (cloud.js, tiers). Ein Spiel, das in
  // keiner der beiden Listen steht, ist Tier 3.
  const TIERS_VORGABE = {
    towerStack: 1, bridgeBuilder: 1, vineSwing: 1, tunnelFlight: 1, driftRace: 1, hillGlide: 1,
    leafFlow: 2, dartWheel: 2, planetHop: 2, boilerRoom: 2,
    // Die sechs neuen, gebaut nach dem Muster von Tier 1.
    balloonRide: 1, skiSlalom: 1, frogHop: 1, waveRider: 1, craneHarbor: 1, ropeWalk: 1,
  };
  const TIERS = [1, 2, 3];
  // Das Tier eines Spiels: aus der Einteilung des Admins, sonst aus der Vorgabe.
  function tierVon(spiel, einteilung = null) {
    const tier = Number(einteilung?.[spiel] ?? TIERS_VORGABE[spiel] ?? 3);
    return TIERS.includes(tier) ? tier : 3;
  }

  // Die Spiele, deren beste Läufe sich anschauen lassen (geist.js,
  // zuschauer): die Fassung ihrer Aufzeichnung – dieselbe, die das Spiel bei
  // LernappGeist.fuer angibt – und ob ihre Welt immer dieselbe ist. Sonst
  // braucht der Lauf seine Saat, um seine Welt wieder aufzubauen.
  // winkel: c in der Lage ist ein Winkel (mal 100) – im Multiplayer gleitet
  // er bei den anderen mit, statt zehnmal je Sekunde zu springen
  // (live-spiel.js). In den übrigen ist c ein Zustand (Ast, Schub).
  const ANSEHBAR = {
    vineSwing: { fassung: "s1", fest: true },
    tunnelFlight: { fassung: "t1", winkel: true },
    driftRace: { fassung: "t1", winkel: true },
    planetHop: { fassung: "p2", winkel: true },
    moonLander: { fassung: "p5", winkel: true },
    gravityRun: { fassung: "t1", winkel: true },
    hillGlide: { fassung: "t1" },
    balloonRide: { fassung: "t1" },
    skiSlalom: { fassung: "t1", winkel: true },
    frogHop: { fassung: "t1", winkel: true },
    waveRider: { fassung: "t1", winkel: true },
    ropeWalk: { fassung: "t1", winkel: true },
  };

  // Und die Spiele ohne Figur im Bild: Ihre besten Läufe lassen sich Zug um
  // Zug anschauen (geist.js, zuege) – das Spiel baut nach, was damals
  // geschah, wie beim Zuschauen im Multiplayer. Blätter im Strom schreibt
  // seine Züge in den Lauf mit Uhr (Fassung t1), den die Gegner lesen.
  const ANSEHBAR_ZUEGE = {
    leafFlow: { fassung: "t1" },
    towerStack: { fassung: "z1" },
    bridgeBuilder: { fassung: "z1" },
    dartWheel: { fassung: "z1" },
    tileMemory: { fassung: "z1" },
    fishPond: { fassung: "z1" },
    numberLine: { fassung: "z1" },
    boilerRoom: { fassung: "z1" },
    craneHarbor: { fassung: "z1" },
  };

  // Wie sich der Lauf eines Spiels anschauen lässt – oder null.
  function ansehArt(spiel) {
    if (ANSEHBAR[spiel]) return ANSEHBAR[spiel];
    return ANSEHBAR_ZUEGE[spiel] ? { ...ANSEHBAR_ZUEGE[spiel], zuege: true } : null;
  }

  // Wem sich im Multiplayer zuschauen lässt, wenn man selbst ausgeschieden
  // oder schon fertig ist: den Spielen oben, aus der Lage ihrer Figur, und denen, die ihre Züge
  // melden (zug, live-spiel.js) – dort baut das Spiel des Zuschauers nach, was
  // der andere tut, Block für Block, Wurf für Wurf.
  const ZUSCHAUBAR = {
    ...Object.fromEntries(Object.keys(ANSEHBAR).map((id) => [id, { zug: false }])),
    towerStack: { zug: true },
    bridgeBuilder: { zug: true },
    dartWheel: { zug: true },
    tileMemory: { zug: true },
    fishPond: { zug: true },
    boilerRoom: { zug: true },
    numberLine: { zug: true },
    craneHarbor: { zug: true },
  };

  // Die Farbe des Bereichs, dieselbe wie in der App: Gedächtnis violett,
  // Konzentration türkis, Geschwindigkeit orange, Problemlösen grün, Zahlen
  // und Buchstaben rot. highscore.js sagt, welches Spiel zu welchem Bereich
  // gehört.
  const FARBEN = {
    gedaechtnis: { hell: "#7C5CE6", dunkel: "#5a41b8" },
    konzentration: { hell: "#00A5B5", dunkel: "#00707c" },
    geschwindigkeit: { hell: "#F5A623", dunkel: "#b9741a" },
    problemloesen: { hell: "#3FA34D", dunkel: "#2c7337" },
    zahlbuchstabe: { hell: "#E8543F", dunkel: "#a8321f" },
  };

  const NACH_ID = new Map(SPIELE.map((s) => [s.id, s]));

  const NAME_KEY = "mini.name";
  const ID_KEY = "mini.id";
  // Der eigene Bestwert je Spiel – dasselbe, was in der Liste steht, nur auf
  // dem Gerät. Wozu doppelt? Weil das Spiel selbst ihn braucht, und zwar
  // sofort: Turmbau sagt "Neuer Rekord!", wenn die Runde besser war als die
  // bisher beste. game-cloud.js legt hier nichts ab – ohne diesen Eintrag
  // wäre also jede erste Runde ein Rekord, und ein Rekord, den es umsonst
  // gibt, ist keiner.
  const BEST_KEY = "mini.best";
  // Die zuletzt gelesene Auswahl. Siehe offeneSpiele().
  const OFFEN_KEY = "mini.offen";
  // Ob auf diesem Gerät der Admin angemeldet ist. Siehe adminKnopf().
  const ADMIN_KEY = "mini.admin";
  const NAME_MAX = 24;

  const cloud = () => window.MiniCloud || null;
  const hs = () => window.LernappHighscore || null;

  // ---------------------------------------------------------------------------
  // Wo sind wir?
  // ---------------------------------------------------------------------------
  const koerper = () => document.body || null;

  // Welches Spiel diese Seite spielt. Es steht am body – nicht aus der
  // Adresse geraten: Die Adresse ist das, was jemand weitergibt, und sie darf
  // sich ändern, ohne dass die Seite rät.
  function spielId() {
    const id = koerper()?.dataset?.spiel || "";
    return NACH_ID.has(id) ? id : "";
  }

  // Adressen ab der Wurzel: Die Seiten liegen alle nebeneinander
  // (/turmbau, /signal), die Übersicht ist die Startseite. Ab der Wurzel
  // heisst jede Adresse überall dasselbe – auch aus dem Fenster heraus, das
  // über einem Spiel liegt.
  const spielLink = (id) => `/${NACH_ID.get(id)?.seite || ""}`;
  const uebersichtLink = () => "/";

  // Aus dem Adminbereich gestartet (/turmbau?von=admin, admin.js,
  // zeigeSpiel): Das Spiel läuft wie immer, und die Runde zählt wie jede
  // andere. Nur der Weg zurück führt in den Adminbereich.
  function ausAdmin() {
    try { return new URLSearchParams(window.location.search).get("von") === "admin"; }
    catch { return false; }
  }

  // ---------------------------------------------------------------------------
  // Name und Kennung – beides auf dem Gerät
  // ---------------------------------------------------------------------------
  // Der Name ist das, was in der Liste steht; die Kennung sorgt dafür, dass
  // derselbe Spieler je Spiel eine Zeile hat. Ohne localStorage (privates
  // Fenster) gilt beides nur für diese Sitzung – dann steht der Name eben
  // beim nächsten Spiel wieder leer da. Das ist besser, als gar nicht
  // mitspielen zu können.
  let kennungMerker = "";

  function sauberName(wert) {
    return String(wert || "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
  }

  let merkName = "";

  function name() {
    try {
      const gemerkt = localStorage.getItem(NAME_KEY);
      if (gemerkt !== null) return sauberName(gemerkt);
    } catch { /* privates Fenster */ }
    return sauberName(merkName);
  }

  function setzeName(wert) {
    const sauber = sauberName(wert);
    merkName = sauber;
    try { localStorage.setItem(NAME_KEY, sauber); } catch { /* privater Modus */ }
    return sauber;
  }

  function neueKennung() {
    const zufall = new Uint8Array(12);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(zufall);
    else for (let i = 0; i < zufall.length; i += 1) zufall[i] = Math.floor(Math.random() * 256);
    const zeichen = "abcdefghijklmnopqrstuvwxyz0123456789";
    let text = "";
    zufall.forEach((n) => { text += zeichen[n % zeichen.length]; });
    return `mini_${text}`;
  }

  const gueltigeKennung = (wert) => /^mini_[A-Za-z0-9_-]{8,48}$/.test(String(wert || ""));

  // Nur nachsehen, nicht anlegen: Wer bloss die Übersicht ansieht, braucht
  // keine Kennung – und bekommt auch keine.
  function kennungFallsDa() {
    try { return localStorage.getItem(ID_KEY) || ""; } catch { return kennungMerker; }
  }

  function kennung() {
    try {
      const gemerkt = localStorage.getItem(ID_KEY);
      if (gueltigeKennung(gemerkt)) return gemerkt;
      const frisch = neueKennung();
      localStorage.setItem(ID_KEY, frisch);
      return frisch;
    } catch {
      if (!gueltigeKennung(kennungMerker)) kennungMerker = neueKennung();
      return kennungMerker;
    }
  }

  function setzeKennung(id) {
    if (!gueltigeKennung(id)) return;
    kennungMerker = id;
    try { localStorage.setItem(ID_KEY, id); } catch { /* privates Fenster */ }
  }

  // ---------------------------------------------------------------------------
  // Namen ändern
  // ---------------------------------------------------------------------------
  /*
   * Ein neuer Name gilt nur für die Runden, die noch kommen. Was schon in
   * einer Liste steht, bleibt unter dem bisherigen Namen stehen – in der
   * Hall of Fame wie in jedem Turnier.
   *
   * Darum spielt das Gerät mit einem neuen Namen als neuer Mitspieler: mit
   * einer eigenen Kennung, ohne Bestwerte und ohne eigenen Lauf. Denn in den
   * Listen gibt es je Spiel und Kennung ein Dokument; mit der alten Kennung
   * schriebe die nächste Runde den neuen Namen auch über die alten Punkte.
   *
   * Wer zu einem Namen zurückwechselt, den das Gerät schon kennt, ist wieder
   * dieser Mitspieler – mit seiner Kennung, seinen Bestwerten, seinem Lauf.
   * So teilen sich Geschwister ein Handy, ohne einander in die Quere zu
   * kommen. Gross- und Kleinschreibung zählt dabei nicht.
   */
  const WER_KEY = "mini.wer";
  const LAUF_KEY = "mini.lauf";        // der eigene beste Lauf je Spiel (geist.js)
  const WER_MAX = 12;
  const nameSchluessel = (wert) => sauberName(wert).toLocaleLowerCase("de");

  function liesJson(schluessel, ersatz) {
    try {
      const roh = JSON.parse(localStorage.getItem(schluessel) || "null");
      return roh && typeof roh === "object" ? roh : ersatz;
    } catch { return ersatz; }
  }

  function schreibe(schluessel, wert) {
    try {
      if (wert === null) localStorage.removeItem(schluessel);
      else localStorage.setItem(schluessel, typeof wert === "string" ? wert : JSON.stringify(wert));
    } catch { /* privater Modus */ }
  }

  function bekannteNamen() {
    const liste = liesJson(WER_KEY, []);
    return Array.isArray(liste) ? liste.filter((e) => e && sauberName(e.name) && gueltigeKennung(e.id)) : [];
  }

  // Gibt den Namen zurück, unter dem ab jetzt gespielt wird, und wie es dazu
  // kam: "gleich" (derselbe Mitspieler, nur anders geschrieben), "erster"
  // (bisher ohne Namen), "zurueck" (ein Name, den das Gerät schon kennt) oder
  // "neu".
  function namenWechseln(wert) {
    const neu = sauberName(wert);
    if (!neu) return { name: name(), wie: "leer" };
    const alt = name();
    const altId = kennungFallsDa();
    if (!alt) {
      setzeName(neu);
      return { name: neu, wie: "erster" };
    }
    if (nameSchluessel(alt) === nameSchluessel(neu)) {
      setzeName(neu);
      return { name: neu, wie: "gleich" };
    }
    // Den bisherigen Mitspieler merken, mit allem, was ihm gehört.
    let liste = bekannteNamen().filter((e) => e.id !== altId && nameSchluessel(e.name) !== nameSchluessel(alt));
    if (gueltigeKennung(altId)) {
      liste.unshift({ name: alt, id: altId, best: bestwerte(), lauf: liesJson(LAUF_KEY, {}) });
    }
    const da = liste.find((e) => nameSchluessel(e.name) === nameSchluessel(neu));
    liste = liste.filter((e) => e !== da).slice(0, WER_MAX);
    schreibe(WER_KEY, liste);
    if (da) {
      schreibe(ID_KEY, da.id);
      schreibe(BEST_KEY, da.best || {});
      schreibe(LAUF_KEY, da.lauf || {});
    } else {
      schreibe(ID_KEY, neueKennung());
      schreibe(BEST_KEY, {});
      schreibe(LAUF_KEY, null);
    }
    kennungMerker = "";
    setzeName(neu);
    zwischenspeicher = null;
    return { name: neu, wie: da ? "zurueck" : "neu" };
  }

  /*
   * Die Zeile "Du spielst als …" mit dem Knopf "Namen ändern". Ein Tipp
   * darauf macht aus ihr ein Feld; der neue Name gilt ab der nächsten Runde.
   * beiWechsel bekommt, was namenWechseln zurückgibt – die Turnierseite
   * zeichnet sich damit neu, denn wer vorne liegt, hängt an der Kennung.
   */
  function namensZeile({ beiWechsel = null, klasse = "" } = {}) {
    const wirt = el("div", `mini-wer ${klasse}`.trim());

    function zeige(meldung = "") {
      wirt.innerHTML = "";
      const zeile = el("p", "mini-name-steht");
      const wer = name();
      if (wer) {
        zeile.append(document.createTextNode("Du spielst als "), el("strong", "", wer));
      } else {
        zeile.append(document.createTextNode("Du spielst noch ohne Namen"));
      }
      zeile.append(knopf(wer ? "Namen ändern" : "Namen festlegen", "mini-knopf-klein", frage));
      wirt.append(zeile);
      if (meldung) wirt.append(el("p", "mini-wer-hinweis", meldung));
    }

    function frage() {
      wirt.innerHTML = "";
      const form = el("form", "mini-namensfeld");
      const feld = el("input");
      feld.type = "text";
      feld.maxLength = NAME_MAX;
      feld.placeholder = name() ? "Neuer Name" : "Dein Name";
      feld.autocomplete = "nickname";
      feld.setAttribute("aria-label", "Neuer Name");
      const ok = el("button", "mini-knopf mini-knopf-voll", "Übernehmen");
      ok.type = "submit";
      form.append(feld, ok);
      form.addEventListener("submit", (ereignis) => {
        ereignis.preventDefault();
        const wechsel = namenWechseln(feld.value);
        if (wechsel.wie === "leer") { feld.focus(); return; }
        const satz = wechsel.wie === "zurueck"
          ? `Willkommen zurück, ${wechsel.name}!`
          : `Ab der nächsten Runde spielst du als ${wechsel.name}.`;
        zeige(satz);
        beiWechsel?.(wechsel);
      });
      const zurueck = knopf("Abbrechen", "mini-knopf-klein mini-knopf-still", () => zeige());
      wirt.append(form, el("p", "mini-wer-hinweis", name()
        ? "Gilt nur für die nächsten Runden – was du schon gespielt hast, bleibt unter deinem bisherigen Namen stehen."
        : "Unter diesem Namen stehst du in den Listen."), zurueck);
      feld.focus();
    }

    zeige();
    return wirt;
  }

  // ---------------------------------------------------------------------------
  // Ein Name, ein Spieler
  // ---------------------------------------------------------------------------
  /*
   * Wer denselben Namen auf dem Handy und am Tablet einträgt, ist ein
   * Spieler: In jeder Liste steht er einmal (verdichte), mit seinem besten
   * Ergebnis – und genau das ist auch seine Bestmarke (gleicheAb).
   *
   * Damit seine Runden auch in denselben Einträgen landen und nicht in
   * zweien, die nur die Anzeige zusammenhält, spielt jedes Gerät unter der
   * Kennung, die zu seinem Namen gehört: der, unter der am meisten gespielt
   * wurde. Bei Gleichstand die kleinere, damit jedes Gerät dieselbe wählt.
   * Die Wahl bleibt stehen: Gespielt wird ab dann nur noch unter ihr, ihre
   * Runden wachsen, die der anderen nicht mehr. Was unter den anderen schon
   * steht, führt der Adminbereich zusammen (admin.js, fuehreZusammen) – bis
   * dahin hält es die Anzeige zusammen.
   *
   * Nicht mitten in einem Turnier, einem Multiplayer oder beim Zuschauen:
   * Dort hängen Versuche und Plätze an der Kennung, mit der die Seite
   * begann. Gewechselt wird beim nächsten gewöhnlichen Spiel.
   */
  function stammVon(eintraege) {
    const runden = new Map();
    (eintraege || []).forEach((e) => {
      if (!gueltigeKennung(e?.spieler)) return;
      runden.set(e.spieler, (runden.get(e.spieler) || 0) + Math.max(1, Math.round(Number(e.versuche) || 1)));
    });
    let stamm = "";
    runden.forEach((anzahl, id) => {
      const bisher = runden.get(stamm) || 0;
      if (!stamm || anzahl > bisher || (anzahl === bisher && id < stamm)) stamm = id;
    });
    return stamm;
  }

  // Aus der Adresse und nicht aus turnier.js oder live-spiel.js: Die laden
  // erst nach dieser Datei, gefragt wird aber schon beim Aufbauen.
  function inTurnierOderLive() {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.has("turnier") || p.has("live") || p.has("zuschauen");
    } catch { return true; }
  }

  const stammGeprueft = new Map();   // Name → Promise

  function stammKennung(spiel = spielId()) {
    const wie = name();
    if (!wie || !cloud()?.unterNamen || inTurnierOderLive()) return Promise.resolve(null);
    const schluessel = nameSchluessel(wie);
    if (!stammGeprueft.has(schluessel)) {
      // Gefragt wird nach dem Namen, so wie er geschrieben ist – Firestore
      // vergleicht genau, und dieselbe Frage gibt in jedem Spiel dieselbe
      // Antwort. Steht er so nirgends, aber anders geschrieben in der Liste
      // dieses Spiels ("ELIN" für "Elin"), gilt die.
      stammGeprueft.set(schluessel, cloud().unterNamen(wie).then(async (genau) => {
        if (genau.length || !spiel) return genau;
        return (await alleErgebnisse([spiel]).catch(() => [])).filter((e) => nameSchluessel(e.name) === schluessel);
      }).then((eintraege) => {
        const stamm = stammVon(eintraege);
        // Inzwischen ein anderer Name: Dann gilt die Antwort nicht mehr.
        if (!stamm || nameSchluessel(name()) !== schluessel) return null;
        if (stamm !== kennungFallsDa()) setzeKennung(stamm);
        return stamm;
      }).catch(() => {
        stammGeprueft.delete(schluessel);
        return null;
      }));
    }
    return stammGeprueft.get(schluessel);
  }

  // Das Beste unter einem Namen in einer Liste, von allen Kennungen ausser
  // der genannten: { punkte, spieler } oder null.
  function bestesUnterNamen(eintraege, wie, ausser = "") {
    const schluessel = nameSchluessel(wie);
    let bestes = null;
    (eintraege || []).forEach((e) => {
      if (!e || e.spieler === ausser || nameSchluessel(e.name) !== schluessel) return;
      const punkte = Math.max(0, Math.round(Number(e.punkte) || 0));
      if (!bestes || punkte > bestes.punkte) bestes = { punkte, spieler: e.spieler };
    });
    return bestes;
  }

  function bestwerte() {
    try {
      const roh = JSON.parse(localStorage.getItem(BEST_KEY) || "{}");
      return roh && typeof roh === "object" ? roh : {};
    } catch { return {}; }
  }

  // Der eigene Bestwert in einem Spiel, so wie dieses Gerät ihn kennt –
  // geist.js stellt ihn als Bestmarke neben die Runde.
  function bestwert(spiel) {
    return Math.max(0, Math.round(Number(bestwerte()[spiel]) || 0));
  }

  /*
   * Was der Server über den eigenen Bestwert sagt, gilt – auch nach unten.
   *
   * Das Gerät merkt sich den Bestwert (mini.best), die Bestmarke daneben
   * (geist.js, mini.lauf) und gibt ihn jedem Spiel als Startstand mit. Löscht
   * der Admin einen Eintrag, stünde die alte Zahl sonst nach der nächsten
   * Runde wieder als "Bestwert" und als Bestmarke da – auf ewig, denn höher
   * als 10 000 Meter kommt nach einem Umbau niemand mehr. Deshalb fragt jede
   * Spielseite einmal nach dem einen Eintrag dieses Geräts (cloud.js,
   * meinErgebnis) und setzt den Bestwert auf das, was dort steht – oder auf
   * nichts, wenn dort nichts steht.
   *
   * Und nach dem, was unter demselben Namen von einem anderen Gerät dasteht:
   * Derselbe Name ist derselbe Spieler (stammKennung). Steht dort mehr, ist
   * das die Bestmarke – mit der Kennung, an der ihr Lauf hängt (geist.js).
   *
   * Ohne Namen gibt es keinen Eintrag, und ohne Netz keine Antwort: Dann
   * bleibt alles, wie es ist. Wer es wissen muss (geist.js, game-cloud.js),
   * bekommt den abgeglichenen Wert mit einem Ereignis "mini-bestwert".
   */
  const abgeglichen = new Map();   // spiel → { punkte, ms, spieler }
  const abgleiche = new Map();

  function setzeBestwert(spiel, punkte, spieler = "") {
    const zahl = Math.max(0, Math.round(Number(punkte) || 0));
    if (!spiel) return;
    const alle = bestwerte();
    if (zahl) alle[spiel] = zahl;
    else delete alle[spiel];
    try { localStorage.setItem(BEST_KEY, JSON.stringify(alle)); } catch { /* privater Modus */ }
    abgeglichen.set(spiel, { punkte: zahl, ms: Date.now(), spieler: zahl ? String(spieler || "") : "" });
    try { window.dispatchEvent(new CustomEvent("mini-bestwert", { detail: { spiel, punkte: zahl } })); } catch { /* alt */ }
  }

  function gleicheAb(spiel = spielId()) {
    if (!spiel || !name() || !cloud()?.meinErgebnis) return Promise.resolve(null);
    if (!abgleiche.has(spiel)) {
      abgleiche.set(spiel, stammKennung(spiel)
        .then(async () => {
          const ich = kennungFallsDa();
          if (!gueltigeKennung(ich)) return null;
          const [meiner, liste] = await Promise.all([
            cloud().meinErgebnis(spiel, ich),
            alleErgebnisse([spiel]).catch(() => []),
          ]);
          const eigen = meiner ? meiner.punkte : 0;
          const fremd = bestesUnterNamen(liste, name(), ich);
          if (fremd && fremd.punkte > eigen) setzeBestwert(spiel, fremd.punkte, fremd.spieler);
          else setzeBestwert(spiel, eigen, ich);
          return abgeglichen.get(spiel).punkte;
        })
        .catch(() => {
          abgleiche.delete(spiel);
          return null;
        }));
    }
    return abgleiche.get(spiel);
  }

  // Der abgeglichene Bestwert, wenn es auf dieser Seite schon einen gibt:
  // { punkte, ms, spieler } – wann der Server das gesagt hat, und unter
  // welcher Kennung die Zahl steht. Sonst null.
  const bestwertAbgeglichen = (spiel) => abgeglichen.get(spiel) || null;

  // Der Startstand für game-cloud.js: Was das Spiel für seinen eigenen
  // Vergleich braucht, und nichts weiter. Kein Spiel ohne Punktzahl und kein
  // Spiel, das hier gar nicht läuft, bekommt etwas.
  function startStand(leer) {
    const spiel = spielId();
    if (!spiel || !leer || !Array.isArray(leer.scores)) return null;
    const best = Math.max(0, Math.round(Number(bestwerte()[spiel]) || 0));
    return best ? { ...leer, runs: 0, scores: [best] } : null;
  }

  // ---------------------------------------------------------------------------
  // Die Spiele, die gerade offen sind
  // ---------------------------------------------------------------------------
  // Alle, die es gibt – die Reihenfolge ist die von SPIELE, damit die Liste
  // überall gleich aussieht.
  const alleSpiele = () => SPIELE.map((spiel) => spiel.id);

  // Und die, die offen sind: was der Adminbereich angehakt hat
  // (config/miniGames). Steht dort nichts, gelten alle – eine frische
  // Datenbank zeigt alles, statt nichts. Gefiltert wird gegen SPIELE, damit
  // ein Name, zu dem es keine Seite (mehr) gibt, keine Karte bekommt.
  let offenGemerkt = null;

  // Was zuletzt wirklich dastand, bleibt auf dem Gerät. Denn "nicht gelesen"
  // ist nicht dasselbe wie "nichts eingetragen": Die installierte App startet
  // auch ohne Netz, und Firestore hält hier nichts vor – nur die Dateien
  // liegen im Speicher des Service Workers. Ohne dieses Gedächtnis stünden
  // beim ersten Start ohne Netz wieder alle Spiele da, auch die
  // abgewählten. Im Zweifel gilt lieber die Wahl von gestern als gar keine.
  function gemerkteAuswahl() {
    try {
      const roh = JSON.parse(localStorage.getItem(OFFEN_KEY) || "null");
      return Array.isArray(roh) ? roh : null;
    } catch { return null; }
  }

  function merkeAuswahl(liste) {
    try { localStorage.setItem(OFFEN_KEY, JSON.stringify(liste)); } catch { /* privater Modus */ }
  }

  // Erst beim zweiten Mal richtig: Wer noch nie online war, hat nichts
  // gemerkt – dann gelten alle, wie bei einer frischen Datenbank.
  function ausGemerktem() {
    const gemerkt = gemerkteAuswahl();
    return gemerkt ? alleSpiele().filter((id) => gemerkt.includes(id)) : alleSpiele();
  }

  async function offeneSpiele() {
    if (offenGemerkt) return offenGemerkt;
    const wolke = cloud();
    // Kein Firestore auf der Seite: nichts merken, sonst überschriebe ein
    // Ladefehler die richtige Liste mit "alle".
    if (!wolke?.offeneSpiele) { offenGemerkt = ausGemerktem(); return offenGemerkt; }
    try {
      const gewaehlt = await wolke.offeneSpiele();
      // null heisst hier: gelesen, aber nichts eingetragen. Das ist eine
      // Antwort, kein Fehler – cloud.js wirft, wenn es nicht lesen konnte.
      offenGemerkt = gewaehlt === null || gewaehlt === undefined
        ? alleSpiele()
        : alleSpiele().filter((id) => gewaehlt.includes(id));
      merkeAuswahl(offenGemerkt);
    } catch (fehler) {
      console.warn("Die Liste der Spiele war nicht zu lesen", fehler);
      offenGemerkt = ausGemerktem();
    }
    return offenGemerkt;
  }

  function titel(id) {
    return hs()?.titel?.(id) || id;
  }

  function einheit(id) {
    return hs()?.spiel?.(id)?.einheit || "Punkte";
  }

  function farbe(id) {
    const bereich = hs()?.spiel?.(id)?.bereich || "geschwindigkeit";
    return FARBEN[bereich] || FARBEN.geschwindigkeit;
  }

  // ---------------------------------------------------------------------------
  // Die Ergebnisse
  // ---------------------------------------------------------------------------
  // Gefragt wird je Spiel: cloud.js stellt eine Abfrage je Spiel (ohne
  // Sortierung, die bräuchte einen zusammengesetzten Index) und legt die
  // Antworten zusammen. Sortiert wird hier.
  let zwischenspeicher = null;
  let zwischenspeicherMs = 0;
  let zwischenspeicherFuer = "";
  const FRISCH_MS = 20000;

  async function alleErgebnisse(spiele, { neu = false } = {}) {
    const schluessel = spiele.join(",");
    // Der Zwischenspeicher gilt nur für dieselbe Frage: Kommt ein Spiel dazu,
    // wäre eine Antwort von vorhin eine falsche.
    if (!neu && zwischenspeicher && zwischenspeicherFuer === schluessel
      && Date.now() - zwischenspeicherMs < FRISCH_MS) return zwischenspeicher;
    const daten = await (cloud()?.ergebnisse?.(spiele) || Promise.resolve([]));
    zwischenspeicher = Array.isArray(daten) ? daten : [];
    zwischenspeicherMs = Date.now();
    zwischenspeicherFuer = schluessel;
    return zwischenspeicher;
  }

  // Ein Ergebnis je Person und Spiel – genauso, wie die Bestenliste der Gruppe
  // in der App eine Zeile je Kind zeigt. Wer denselben Namen auf zwei Geräten
  // einträgt, steht trotzdem einmal da: Es zählt sein bestes Ergebnis, und
  // seine Runden zählen zusammen.
  //
  // Die Kennung der Zeile ist die des besten Ergebnisses: An ihr hängt der
  // Lauf, der zu dieser Zahl gehört (geister, ansehbareLaeufe, geist.js).
  function verdichte(eintraege) {
    const nachName = new Map();
    // Wer bin ich in dieser Liste? Die Kennung dieses Geräts, und sonst der
    // Name, der hier eingetragen wurde – wer denselben Namen auf dem Handy
    // und am Tablet nimmt, soll sich auf beiden wiederfinden.
    const meineKennung = kennungFallsDa();
    const meinName = name().toLocaleLowerCase("de");
    eintraege.forEach((roh) => {
      const schluessel = sauberName(roh.name).toLocaleLowerCase("de");
      if (!schluessel) return;
      const eintrag = {
        ...roh,
        eigen: Boolean((meineKennung && roh.spieler === meineKennung) || (meinName && schluessel === meinName)),
      };
      const bisher = nachName.get(schluessel);
      if (!bisher) {
        nachName.set(schluessel, { ...eintrag, name: sauberName(eintrag.name) });
        return;
      }
      if ((Number(eintrag.punkte) || 0) > (Number(bisher.punkte) || 0)) {
        bisher.punkte = Number(eintrag.punkte) || 0;
        bisher.updatedAtMs = Number(eintrag.updatedAtMs) || 0;
        bisher.name = sauberName(eintrag.name);
        bisher.spieler = eintrag.spieler;
        bisher.id = eintrag.id;
      }
      bisher.versuche = (Number(bisher.versuche) || 0) + (Number(eintrag.versuche) || 0);
      // Die eigene Zeile bleibt die eigene, auch wenn das bessere Ergebnis von
      // einem anderen Gerät desselben Namens kommt.
      bisher.eigen = bisher.eigen || eintrag.eigen;
    });
    return [...nachName.values()];
  }

  // Die Rangfolge eines Spiels. Gleiche Punktzahl heisst gleicher Platz – und
  // der nächste überspringt so viele Plätze, wie sich geteilt haben. Wer
  // früher dort war, steht bei Gleichstand oben: Die Zahl war zuerst da.
  function rangliste(eintraege) {
    const liste = verdichte(eintraege).sort((a, b) =>
      (Number(b.punkte) || 0) - (Number(a.punkte) || 0)
      || (Number(a.updatedAtMs) || 0) - (Number(b.updatedAtMs) || 0)
      || a.name.localeCompare(b.name, "de"));

    let platz = 0;
    let vorher = null;
    liste.forEach((eintrag, index) => {
      if (!vorher || (Number(eintrag.punkte) || 0) !== (Number(vorher.punkte) || 0)) platz = index + 1;
      eintrag.platz = platz;
      vorher = eintrag;
    });
    return liste;
  }

  // Für ein einzelnes Spiel wird auch nur nach diesem gefragt. Auf einer
  // Spielseite interessiert keine andere Liste – und die Seite muss nicht
  // erst wissen, welche Spiele offen sind, um ihre eigene zu zeigen.
  async function listeFuer(spiel, optionen = {}) {
    const alle = await alleErgebnisse([spiel], optionen);
    return rangliste(alle);
  }

  // Eine Runde ist zu Ende. Geschrieben wird immer beides: die Punktzahl, wenn
  // sie besser ist als die bisherige, und ein Versuch mehr. Ohne Namen wird
  // noch nichts geschrieben – dann steht erst das Feld da, und der Eintrag
  // entsteht, wenn jemand ihn haben will.
  async function melde(spiel, punkte, geist = null) {
    const wie = name();
    if (!wie) return null;
    // Erst die Kennung, die zu diesem Namen gehört: Wer ihn eben zum ersten
    // Mal eingetippt hat, hat vielleicht auf einem anderen Gerät schon
    // gespielt – dann gehört die Runde zu dessen Einträgen.
    await stammKennung(spiel);
    const zahl = Math.max(0, Math.round(Number(punkte) || 0));
    const ich = kennung();
    const ergebnis = await cloud()?.speichere?.({ game: spiel, spieler: ich, name: wie, punkte: zahl });
    zwischenspeicher = null;
    if (!ergebnis) return null;
    // Der Bestwert kommt vom Server zurück, nicht aus der eben gespielten
    // Runde: Er weiss, was vorher schon dastand – und was nicht mehr. Dazu,
    // was unter demselben Namen von einem anderen Gerät dasteht: Ein Rekord
    // ist nur, was auch das schlägt.
    const fremd = bestesUnterNamen(await alleErgebnisse([spiel], { neu: true }).catch(() => []), wie, ich);
    if (fremd && fremd.punkte > ergebnis.punkte) setzeBestwert(spiel, fremd.punkte, fremd.spieler);
    else setzeBestwert(spiel, ergebnis.punkte, ich);

    // Und, wenn das Spiel eine Aufzeichnung mitgibt: der Lauf selbst. Nur
    // beim Rekord – sonst ersetzte ein schwächerer Lauf den Geist, den die
    // anderen neben sich laufen sehen. Und nur nach der Punktzahl: Ein Geist
    // ohne Zeile in der Bestenliste gehörte zu niemandem.
    //
    // Er darf scheitern, ohne die Runde mitzunehmen. Die Zahl ist das
    // Versprechen, die Aufzeichnung die Zugabe.
    if (ergebnis.rekord && geist?.bahn) {
      try {
        await cloud()?.speichereGeist?.({
          game: spiel,
          spieler: ich,
          name: wie,
          punkte: zahl,
          level: geist.level,
          bahn: geist.bahn,
        });
      } catch (fehler) {
        console.warn("Die Aufzeichnung ist nicht angekommen", fehler);
      }
    }
    return { ...ergebnis, rekord: ergebnis.rekord && !(fremd && fremd.punkte >= zahl) };
  }

  // Ob sich eine Aufzeichnung abspielen lässt: mit Weg (oder Zügen) und, wo
  // die Welt jedes Mal neu gewürfelt wird, mit ihrer Saat (geist.js,
  // ansehbar – das hier geladen ist, steht auf der Startseite nicht).
  function abspielbar(bahn, art) {
    let d = null;
    try { d = JSON.parse(bahn); } catch { return false; }
    if (!art.fest && !Number.isInteger(d?.s)) return false;
    return art.zuege ? Array.isArray(d?.z?.t) && d.z.t.length > 0 : Array.isArray(d?.a);
  }

  /*
   * Welche Einträge einer Liste einen Lauf hinterlegt haben, den man
   * anschauen kann – aus der Hall of Fame oder, mit aus, aus einem Turnier.
   * Gefragt wird nach denen, die übergeben werden (die Listen fragen nach
   * denen, die gerade dastehen). Gibt die Adressen zurück: Kennung des
   * Spielers → Weg zum Zuschauen.
   */
  async function ansehbareLaeufe(spiel, liste, { aus = "" } = {}) {
    const art = ansehArt(spiel);
    const raus = new Map();
    if (!art || !cloud()) return raus;
    const wer = [...new Set((liste || []).filter((e) => e.spieler && e.punkte > 0).map((e) => e.spieler))];
    if (!wer.length) return raus;
    let gefunden = [];
    try {
      if (aus) {
        gefunden = (await Promise.all(wer.map((spieler) => Promise.resolve(cloud().turnierGeist?.(aus, spiel, spieler)).catch(() => null))))
          .filter((g) => g && g.level === art.fassung);
      } else {
        // cloud.js liest höchstens 25 auf einmal.
        const pakete = [];
        for (let i = 0; i < wer.length; i += 25) pakete.push(wer.slice(i, i + 25));
        gefunden = (await Promise.all(pakete.map((paket) => Promise.resolve(cloud().geister?.(spiel, paket, art.fassung)).catch(() => []))))
          .flat().filter(Boolean);
      }
    } catch { return raus; }
    gefunden.forEach((g) => {
      if (!abspielbar(g.bahn, art)) return;
      raus.set(g.spieler, `${spielLink(spiel)}?zuschauen=${encodeURIComponent(g.spieler)}${aus ? `&aus=${encodeURIComponent(aus)}` : ""}`);
    });
    return raus;
  }

  /*
   * Der ▶ neben jedem, dessen besten Lauf es gibt – für eine Liste, die
   * aufklappt. Gefragt wird nach denen, die gerade dastehen (gezeigt): erst
   * die ersten drei, mit «Ganze Liste» die übrigen, jeder nur einmal. Was
   * ankommt, zeichnet die Liste neu (neu).
   *
   *   const ansehen = ansehenFuer(spiel, gezeigt, neu, { aus });
   *   listeBauen(liste, spiel, { ansehen });   ansehen(eintrag) → Adresse
   *   ansehen.frage();                         nach dem Zeichnen
   */
  function ansehenFuer(spiel, gezeigt, neu, { aus = "" } = {}) {
    const laeufe = new Map();
    const gefragt = new Set();
    const ansehen = (eintrag) => laeufe.get(eintrag.spieler) || null;
    ansehen.frage = () => {
      if (!ansehArt(spiel)) return;
      const offen = (gezeigt() || []).filter((e) => e.spieler && !gefragt.has(e.spieler));
      if (!offen.length) return;
      offen.forEach((e) => gefragt.add(e.spieler));
      ansehbareLaeufe(spiel, offen, { aus }).then((gefunden) => {
        if (!gefunden.size) return;
        gefunden.forEach((weg, spieler) => laeufe.set(spieler, weg));
        neu();
      });
    };
    return ansehen;
  }

  /*
   * Die Geister der Besten eines Spiels.
   *
   * Gefragt wird nach ein paar mehr, als gebraucht werden: Wer ganz oben
   * steht, hat vielleicht noch keine Aufzeichnung – aus einer Runde von
   * früher, oder weil er von einem Gerät kam, das unter demselben Namen ein
   * zweites ist (verdichte fasst nach Namen zusammen, die Aufzeichnung hängt
   * am Gerät). Dann rückt der nächste nach, statt dass ein Platz leer bleibt.
   */
  async function geister(spiel, { anzahl = 3, level = "" } = {}) {
    if (!spiel || !cloud()?.geister) return [];
    const liste = await listeFuer(spiel).catch(() => []);
    const oben = liste.slice(0, anzahl + 3).filter((eintrag) => eintrag.spieler);
    if (!oben.length) return [];
    const gefunden = await cloud().geister(spiel, oben.map((e) => e.spieler), level);
    const nachSpieler = new Map(gefunden.map((g) => [g.spieler, g]));
    const raus = [];
    for (const eintrag of oben) {
      const geist = nachSpieler.get(eintrag.spieler);
      if (!geist) continue;
      raus.push({ ...geist, platz: eintrag.platz, eigen: Boolean(eintrag.eigen) });
      if (raus.length >= anzahl) break;
    }
    return raus;
  }

  // ---------------------------------------------------------------------------
  // Bausteine
  // ---------------------------------------------------------------------------
  function el(tag, klasse, text) {
    const knoten = document.createElement(tag);
    if (klasse) knoten.className = klasse;
    if (text !== undefined) knoten.textContent = text;
    return knoten;
  }

  function knopf(text, klasse, beiKlick) {
    const node = el("button", `mini-knopf ${klasse || ""}`.trim(), text);
    node.type = "button";
    node.addEventListener("click", beiKlick);
    return node;
  }

  function verweis(text, ziel, klasse) {
    const node = el("a", `mini-knopf ${klasse || ""}`.trim(), text);
    node.href = ziel;
    return node;
  }

  function zahlWort(anzahl, eins, viele) {
    return `${anzahl} ${anzahl === 1 ? eins : viele}`;
  }

  // Die Rangliste als Liste: Platz, Name, Zahl. Der eigene Eintrag ist
  // hervorgehoben – ohne das sucht man seinen Namen.
  //
  // Und er steht immer da, auch wenn er weit hinten liegt: Eine Liste, die
  // nur die ersten fünf zeigt, lässt genau den ohne Antwort, der am meisten
  // wissen will, wo er steht – den Sechsten. Zwischen den Ersten und ihm
  // steht dann eine Zeile mit drei Punkten, damit niemand die Plätze
  // dazwischen für ausgelassen hält.
  //
  // ansehen(eintrag): wohin der ▶ neben einem Eintrag führt – oder null, wenn
  // es von seinem Lauf keine Aufzeichnung gibt (ansehbareLaeufe).
  //
  // Wer dasteht: die ersten max (oder alle) und der eigene Eintrag.
  function gezeigteEintraege(eintraege, max = 0) {
    const gezeigt = max ? eintraege.slice(0, max) : eintraege;
    const eigen = eintraege.find((eintrag) => eintrag.eigen);
    return eigen && !gezeigt.includes(eigen) ? [...gezeigt, eigen] : gezeigt;
  }

  function listeBauen(eintraege, spiel, { max = 0, ansehen = null } = {}) {
    const wrap = el("ol", "mini-liste");
    const gezeigt = gezeigteEintraege(eintraege, max);
    const nachgestellt = gezeigt.length > (max ? Math.min(max, eintraege.length) : eintraege.length);
    if (!gezeigt.length) {
      const leer = el("li", "mini-liste-leer", "Noch niemand. Sei der Erste.");
      wrap.append(leer);
      return wrap;
    }
    const ziele = new Map();
    if (ansehen) {
      gezeigt.forEach((eintrag) => {
        const ziel = ansehen(eintrag);
        if (ziel) ziele.set(eintrag, ziel);
      });
      if (ziele.size) wrap.classList.add("mit-ansehen");
    }
    gezeigt.forEach((eintrag, stelle) => {
      if (nachgestellt && stelle === gezeigt.length - 1 && gezeigt.length > 1) {
        const luecke = el("li", "mini-luecke", "···");
        luecke.setAttribute("aria-hidden", "true");
        wrap.append(luecke);
      }
      const zeile = el("li", `mini-zeile${eintrag.eigen ? " ist-ich" : ""}${eintrag.platz === 1 ? " ist-erster" : ""}`);
      zeile.append(el("span", "mini-platz", `${eintrag.platz}.`));
      zeile.append(el("span", "mini-name", eintrag.name));
      const wert = el("span", "mini-wert", String(eintrag.punkte));
      wert.append(el("small", "mini-einheit", ` ${einheit(spiel)}`));
      zeile.append(wert);
      if (ziele.size) {
        const ziel = ziele.get(eintrag);
        if (ziel) {
          const play = el("a", "mini-ansehen", "▶");
          play.href = ziel;
          play.title = `Den Lauf von ${eintrag.name} anschauen`;
          play.setAttribute("aria-label", play.title);
          zeile.append(play);
        } else {
          zeile.append(el("span", "mini-ansehen-leer"));
        }
      }
      wrap.append(zeile);
    });
    return wrap;
  }

  // ---------------------------------------------------------------------------
  // Der Weg in den Adminbereich
  // ---------------------------------------------------------------------------
  // Einen Anmeldeknopf gibt es hier nicht: Wer spielt, soll nicht über eine
  // Tür stolpern, die nicht für ihn ist. Wer aber im Adminbereich angemeldet
  // ist und von dort zu den Spielen kommt, soll wieder zurückfinden, ohne
  // /admin von Hand zu tippen.
  //
  // Woher die Seite das weiss: admin.js merkt es sich im localStorage, sobald
  // Firebase einen Admin meldet, und nimmt es beim Abmelden wieder weg. Die
  // Anmeldung selbst lesen können die Spielseiten nicht – sie laden
  // firebase-auth gar nicht erst, und dabei bleibt es.
  //
  // Ein Schutz ist das nicht, und es muss keiner sein: Wer den Eintrag von
  // Hand setzt, bekommt einen Knopf, der zur Anmeldung führt. Was dahinter
  // liegt, schützen die Regeln der Datenbank.
  function adminAngemeldet() {
    try { return localStorage.getItem(ADMIN_KEY) === "ja"; } catch { return false; }
  }

  function adminKnopf() {
    if (!adminAngemeldet()) return null;
    const weg = verweis("Adminbereich", "/admin", "mini-knopf-hell mini-knopf-admin");
    weg.title = "Zum Adminbereich – du bist dort angemeldet";
    return weg;
  }

  // ---------------------------------------------------------------------------
  // Oben links
  // ---------------------------------------------------------------------------
  // In der App stehen dort vier Knöpfe: Haus, Zurück, Neustart, Lautsprecher.
  // Hier ist einer genug. Wer über einen Link hereinkommt, will spielen – und
  // wenn er genug hat, wissen, wer sonst noch gespielt hat. Das ist die Hall
  // of Fame, und dorthin führt derselbe Weg, der auch zurückführt: Der Pfeil
  // sagt, dass es hier hinausgeht, der Name sagt, wohin.
  //
  // Was hier einmal stand und wieder weg ist: ein Knopf "Zur App" (diese Site
  // verweist nicht mehr auf die Kids-App) und ein Fenster, in dem man ein
  // anderes Spiel wählen konnte (zwei Wege zur selben Liste sind einer zu
  // viel – die Karten auf der Startseite können dasselbe).
  // Der Pfeil sagt, dass es hier hinausgeht, das Wort sagt wohin. Auf einem
  // Handy hochkant bleibt für das Wort kein Platz: Rechts stehen der
  // Vollbild-Knopf und der Ton-Schalter, und davor müssen noch der Neustart
  // und der Zähler stehen. Dort steht deshalb nur der Pfeil – das
  // Wort liegt in einem eigenen span, damit das Stylesheet es ausblenden
  // kann (.mini-knopf-wort). Der Knopf behält seinen Namen für alle, die ihn
  // nicht sehen: title und aria-label bleiben.
  //
  // Wohin er führt, sagt ziel(): meist in die Hall of Fame, in einem Turnier
  // zurück zum Turnier (turnier.js). Wer über die Turnierseite gekommen ist,
  // will dorthin zurück und nicht in die ewige Liste.
  //
  // Aus dem Adminbereich geht es dorthin zurück.
  function ziel() {
    if (ausAdmin()) return { link: "/admin", wort: "Admin", titel: "Zurück in den Adminbereich" };
    return window.LernappTurnier?.ziel?.()
      || { link: uebersichtLink(), wort: "Hall of Fame", titel: "Zurück zur Hall of Fame" };
  }

  // Läuft das Spiel im Fenster über dem Adminbereich (admin.js, zeigeSpiel),
  // schliesst der Weg zurück dieses Fenster – statt den Adminbereich ein
  // zweites Mal hineinzuladen. Der Rahmen des Vollbilds (vollbild.js) ist
  // kein solches Fenster: Dort geht der Weg wie sonst.
  if (ausAdmin() && window.parent !== window && !window.LernappVollbild?.imRahmen?.()) {
    document.addEventListener("click", (ereignis) => {
      const weg = ereignis.target?.closest?.("a[href]");
      if (!weg || weg.getAttribute("href") !== ziel().link) return;
      ereignis.preventDefault();
      try { window.parent.postMessage({ miniAdmin: "zu" }, window.location.origin); } catch { /* dann bleibt es offen */ }
    }, true);
  }

  function leiste() {
    const wohin = ziel();
    const halle = el("a", "mini-knopf mini-knopf-still mini-knopf-zurueck");
    halle.href = wohin.link;
    halle.title = wohin.titel;
    halle.setAttribute("aria-label", wohin.titel);
    halle.append(pfeil(), el("span", "mini-knopf-wort", wohin.wort));
    return [halle];
  }

  // Der Pfeil im Knopf. Als SVG und nicht als Zeichen: Ein "←" sitzt je nach
  // Schrift anders auf der Zeile.
  function pfeil() {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "mini-pfeil");
    const weg = document.createElementNS(NS, "path");
    weg.setAttribute("d", "M15 5 8 12l7 7");
    weg.setAttribute("fill", "none");
    weg.setAttribute("stroke", "currentColor");
    weg.setAttribute("stroke-width", "2.8");
    weg.setAttribute("stroke-linecap", "round");
    weg.setAttribute("stroke-linejoin", "round");
    svg.append(weg);
    return svg;
  }

  // ---------------------------------------------------------------------------
  // Der Block unter dem Ergebnis
  // ---------------------------------------------------------------------------
  // Drei Zustände, und sie folgen dem, was gerade passiert ist:
  //
  //   noch kein Name   ein Feld und ein Knopf. Erst wer seinen Namen einträgt,
  //                    steht in der Liste – vorher ist nichts geschrieben.
  //   Name steht       die Runde wird gleich gemeldet, danach steht der eigene
  //                    Platz da und darunter die Liste.
  //   Rekord           dasselbe, nur mit einem Wort dazu: Das ist der Moment,
  //                    für den der Link verschickt wurde.
  function ergebnis({ punkte, geist = null }) {
    // Im Turnier gilt dessen Block: was eingetragen wurde, die Liste des
    // Turniers, die übrigen Versuche. In die ewige Liste geht die Runde von
    // dort aus trotzdem (turnier.js, ergebnis).
    const turnier = window.LernappTurnier;
    if (turnier?.aufSpielseite?.()) return turnier.ergebnis({ punkte, geist });

    const spiel = spielId();
    const block = el("div", "mini-ergebnis");
    // Ohne Spiel und ohne Zahl gibt es nichts einzutragen. Beides kann nur
    // passieren, wenn jemand ein Spiel freigibt, das gar keine Punktzahl hat –
    // dann steht hier lieber nichts als ein Feld, das ins Leere schreibt.
    if (!spiel || !Number.isFinite(Number(punkte))) return block;

    const meldung = el("p", "mini-meldung");
    const listenWirt = el("div", "mini-listen-wirt");
    block.append(meldung, listenWirt);

    function zeigeListe(hervor) {
      listeFuer(spiel, { neu: true }).then((liste) => {
        const eigen = liste.find((eintrag) => eintrag.eigen);
        listenWirt.innerHTML = "";
        listenWirt.append(listeBauen(liste, spiel, { max: 5 }));
        if (hervor && eigen) {
          meldung.textContent = eigen.platz === 1
            ? `${eigen.name}, du stehst auf Platz 1!`
            : `${eigen.name}: Platz ${eigen.platz} von ${liste.length}.`;
        }
      }).catch(() => {
        listenWirt.textContent = "Die Rangliste ist gerade nicht zu haben.";
      });
    }

    // Diese Runde wird genau einmal gemeldet – unter dem Namen, der jetzt
    // gilt. Wer danach den Namen ändert, ändert ihn für die nächste Runde.
    function melden() {
      meldung.textContent = "Wird eingetragen...";
      melde(spiel, punkte, geist)
        .then((stand) => {
          if (stand?.rekord) meldung.textContent = "Neue Bestzahl – eingetragen!";
          else meldung.textContent = "Eingetragen.";
          zeigeListe(true);
        })
        .catch(() => {
          meldung.textContent = "Das Eintragen hat nicht geklappt. Die Runde zählt trotzdem.";
          zeigeListe(false);
        });
    }

    function frageNamen(text) {
      const form = el("form", "mini-namensfeld");
      const feld = el("input");
      feld.type = "text";
      feld.maxLength = NAME_MAX;
      feld.placeholder = "Dein Name";
      feld.setAttribute("aria-label", "Dein Name für die Bestenliste");
      feld.autocomplete = "nickname";
      const ab = el("button", "mini-knopf mini-knopf-voll", "Eintragen");
      ab.type = "submit";
      form.append(feld, ab);
      form.addEventListener("submit", (ereignis) => {
        ereignis.preventDefault();
        const gewaehlt = setzeName(feld.value);
        if (!gewaehlt) { feld.focus(); return; }
        form.replaceWith(namensZeile());
        melden();
      });
      meldung.textContent = text;
      block.insertBefore(form, listenWirt);
      zeigeListe(false);
    }

    if (name()) {
      block.insertBefore(namensZeile(), listenWirt);
      melden();
    } else {
      frageNamen("Trag deinen Namen ein, dann stehst du in der Liste.");
    }

    return block;
  }

  // ---------------------------------------------------------------------------
  // Auf den Startbildschirm
  // ---------------------------------------------------------------------------
  // Die Mini-Games sind eine App: eigenes Manifest, eigener Service Worker,
  // eigenes Zeichen. Ohne einen Hinweis findet das nur, wer das Browsermenü
  // kennt – und auf dem Handy ist die Adresszeile sonst der einzige Weg
  // hierher, den man jedes Mal neu tippt.
  //
  // Der Hinweis steht nur auf der Startseite, nie über einem laufenden Spiel,
  // und nur einmal: Wer ihn wegtippt, sieht ihn nicht wieder.
  const INSTALL_KEY = "mini.install";
  const pwa = () => window.LernappInstall || null;

  function installErledigt() {
    try { return Boolean(localStorage.getItem(INSTALL_KEY)); } catch { return false; }
  }

  function merkeInstall(wert) {
    try { localStorage.setItem(INSTALL_KEY, wert); } catch { /* privater Modus */ }
  }

  const IOS_SCHRITTE = [
    "Unten auf das Teilen-Zeichen tippen (das Quadrat mit dem Pfeil nach oben).",
    "In der Liste «Zum Home-Bildschirm» wählen.",
    "Oben rechts «Hinzufügen» tippen – fertig.",
  ];

  function installBlock() {
    const hilfe = pwa();
    if (!hilfe || hilfe.isStandalone?.() || installErledigt()) return null;
    const art = hilfe.platform?.() || "keine";
    if (art === "keine") return null;

    const karte = el("section", "mini-install");
    const text = el("div", "mini-install-text");
    text.append(el("strong", "", "Als App installieren"));
    // Wo der Browser den Knopf selbst anbietet, steht kein Satz dazu: Der
    // Knopf daneben sagt schon alles. Erklärt wird nur, wo es NICHT mit einem
    // Tipp geht – auf dem iPhone.
    const sage = (satz) => {
      let zeile = text.querySelector("p");
      if (!zeile) { zeile = el("p"); text.append(zeile); }
      zeile.textContent = satz;
    };
    karte.append(text);

    const aktionen = el("div", "mini-install-aktionen");
    if (art === "prompt") {
      const los = knopf("Installieren", "mini-knopf-voll", () => {
        hilfe.prompt?.().then((ausgang) => {
          if (ausgang === "angenommen") { merkeInstall("installiert"); karte.remove(); }
          else if (ausgang === "unmoeglich") sage("Das hat der Browser nicht zugelassen. Im Browsermenü steht der Punkt «App installieren».");
        });
      });
      aktionen.append(los);
    } else if (art === "ios-safari") {
      sage("Auf dem iPhone in drei Schritten:");
      const schritte = el("ol", "mini-install-schritte");
      IOS_SCHRITTE.forEach((zeile) => schritte.append(el("li", "", zeile)));
      karte.append(schritte);
    } else if (art === "ios-anderer-browser") {
      sage("Auf dem iPhone geht das nur in Safari. Öffne diese Seite dort, dann steht der Weg hier.");
    } else if (art === "ios-inapp") {
      sage("Du bist im eingebauten Browser einer anderen App. Öffne diese Seite in Safari, dann geht es.");
    }

    const weg = knopf("Nicht jetzt", "mini-knopf-still", () => { merkeInstall("weggetippt"); karte.remove(); });
    aktionen.append(weg);
    karte.append(aktionen);
    return karte;
  }

  // pwa.js steht in der Seite hinter dieser Datei und hat beim Bauen der
  // Übersicht womöglich noch nicht gelaufen: Aufgeschobene Skripte laufen der
  // Reihe nach, und was hier auf eine Zusage wartet, kommt vor dem nächsten
  // dran. Deshalb wird nicht gefragt "gibt es window.LernappInstall", sondern
  // notfalls gewartet, bis die Seite fertig geladen ist.
  function zeigeInstall(wirt) {
    const bauen = () => {
      const karte = installBlock();
      if (karte) wirt.append(karte);
    };
    if (pwa()) { bauen(); return; }
    if (document.readyState === "complete") { bauen(); return; }
    window.addEventListener("load", bauen, { once: true });
  }

  // ---------------------------------------------------------------------------
  // Die Gesamtwertung (ganz unten auf der Startseite, zugeklappt)
  // ---------------------------------------------------------------------------
  // Wer ist der beste Spieler über alle Spiele hinweg? "Der beste" ist dabei
  // der Durchschnittsrang: Wer in drei Spielen Zweiter
  // ist, steht über dem, der in einem Erster und in zweien Letzter ist. Die
  // Summe der Punkte wäre sinnlos – 40 Blöcke in Turmbau und 40 Fische im
  // Fischteich sind nicht dasselbe.
  function auswertung(alle, offen) {
    const spieler = new Map();
    offen.forEach((spiel) => {
      const liste = rangliste(alle.filter((eintrag) => eintrag.game === spiel));
      liste.forEach((eintrag) => {
        const schluessel = eintrag.name.toLocaleLowerCase("de");
        if (!spieler.has(schluessel)) spieler.set(schluessel, { name: eintrag.name, spiele: 0, plaetze: [], siege: 0, bester: null });
        const person = spieler.get(schluessel);
        person.spiele += 1;
        person.plaetze.push(eintrag.platz);
        if (eintrag.platz === 1) person.siege += 1;
        if (person.bester === null || eintrag.platz < person.bester) person.bester = eintrag.platz;
      });
    });

    return [...spieler.values()].map((person) => ({
      ...person,
      schnitt: person.plaetze.reduce((summe, p) => summe + p, 0) / (person.plaetze.length || 1),
    })).sort((a, b) =>
      a.schnitt - b.schnitt || b.spiele - a.spiele || a.name.localeCompare(b.name, "de"));
  }

  // ---------------------------------------------------------------------------
  // Die Spielkachel
  // ---------------------------------------------------------------------------
  // Für die Spiele, die einen Film haben (vorschau.js): oben der Film, wie
  // das Spiel aussieht und wie es gespielt wird, und daran der runde
  // Play-Knopf – er steht dort, wo der Daumen hinwill, und lässt den Film
  // frei. Getippt werden darf auch auf den Film selbst. Darunter der Name, ein
  // Satz, wie man spielt, und die Bestenliste: der Rekord mit Krone, die
  // nächsten zwei mit Silber und Bronze, und hinter jeder Zeile ein Balken,
  // wie weit sie vom Rekord weg ist – eine Zahl allein sagt nicht, ob 57 nah
  // an 99 ist.
  //
  // Dieselbe Kachel steht auf der Startseite und im Turnier (turnier.js):
  //
  //   kachel(spiel, liste, {
  //     klasse,      eine Klasse dazu (im Turnier: tn-karte)
  //     link,        wohin der Play-Knopf führt – ohne ihn steht dort sperre
  //     sperre,      { text, art: "zu" | "vorne" } an Stelle des Knopfs
  //     chips,       kleine Angaben unter dem Namen («6 Spieler»)
  //     aus,         die Turnier-Kennung für den ▶ (ansehenFuer)
  //     ansehbar,    ob es den ▶ überhaupt gibt (nicht in Turnieren ohne Replays)
  //     verdeckt,    die Rangliste bleibt verdeckt (Turnier)
  //   })
  const ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 5.3v13.4a1 1 0 0 0 1.52.85l10.7-6.7a1 1 0 0 0 0-1.7L9.72 4.45a1 1 0 0 0-1.52.85z"/></svg>',
    krone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.2 8.4l4.6 3.9L12 5.2l4.2 7.1 4.6-3.9-1.9 10.1H5.1z"/></svg>',
    leute: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8.2" r="3.3"/><path d="M2.8 19.4c.4-3.4 3-5.6 6.2-5.6s5.8 2.2 6.2 5.6z"/><circle cx="17" cy="9" r="2.6"/><path d="M15.9 13.9c2.7-.3 4.9 1.5 5.3 4.4h-4.5c-.1-1.7-.4-3.1-.8-4.4z"/></svg>',
    schloss: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10.5V8a5 5 0 0 1 10 0v2.5h.6A1.9 1.9 0 0 1 19.5 12.4v6.7A1.9 1.9 0 0 1 17.6 21H6.4a1.9 1.9 0 0 1-1.9-1.9v-6.7A1.9 1.9 0 0 1 6.4 10.5zm2.4 0h5.2V8a2.6 2.6 0 0 0-5.2 0z"/></svg>',
    pfeil: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.7 9.3a1 1 0 0 1 1.4 0L12 13.2l3.9-3.9a1 1 0 1 1 1.4 1.4l-4.6 4.6a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4z"/></svg>',
  };

  function mitIcon(tag, klasse, icon, text) {
    const knoten = el(tag, klasse);
    const bild = el("span", "gk-icon");
    bild.innerHTML = ICON[icon];
    knoten.append(bild);
    if (text !== undefined) knoten.append(el("span", "", text));
    return knoten;
  }

  // Die Bestenliste der Kachel. Wie listeBauen – wer dasteht, die Punkte
  // zwischen den Ersten und dem eigenen Eintrag, der ▶ –, nur anders
  // gezeichnet. listeBauen bleibt, wie es ist: Es steht auch auf der Tafel
  // nach einer Runde, und dort ist für Medaillen kein Platz.
  function bestenliste(eintraege, spiel, { max = 0, ansehen = null } = {}) {
    const wrap = el("ol", "gk-liste");
    const gezeigt = gezeigteEintraege(eintraege, max);
    if (!gezeigt.length) {
      const leer = el("li", "gk-leer");
      const krone = mitIcon("span", "gk-leer-krone", "krone");
      const text = el("span", "gk-leer-text");
      text.append(el("strong", "", "Der Rekord ist noch frei."), el("span", "", "Wer zuerst spielt, steht hier."));
      leer.append(krone, text);
      wrap.append(leer);
      return wrap;
    }
    const nachgestellt = gezeigt.length > (max ? Math.min(max, eintraege.length) : eintraege.length);
    const rekord = Math.max(1, Number(eintraege[0]?.punkte) || 0);
    const ziele = new Map();
    if (ansehen) gezeigt.forEach((eintrag) => { const ziel = ansehen(eintrag); if (ziel) ziele.set(eintrag, ziel); });
    if (ziele.size) wrap.classList.add("mit-ansehen");
    gezeigt.forEach((eintrag, stelle) => {
      if (nachgestellt && stelle === gezeigt.length - 1 && gezeigt.length > 1) {
        const luecke = el("li", "gk-luecke", "···");
        luecke.setAttribute("aria-hidden", "true");
        wrap.append(luecke);
      }
      const punkte = Number(eintrag.punkte) || 0;
      // Gold, Silber, Bronze. Der ▶ steht trotzdem bei allen (ansehen).
      const medaille = [1, 2, 3].includes(eintrag.platz) ? ` ist-platz-${eintrag.platz}` : "";
      const zeile = el("li", `gk-zeile${medaille}${eintrag.eigen ? " ist-ich" : ""}`);
      zeile.style.setProperty("--gk-anteil", `${Math.round(Math.max(0.06, Math.min(1, punkte / rekord)) * 100)}%`);
      const marke = eintrag.platz === 1 ? mitIcon("span", "gk-marke", "krone") : el("span", "gk-marke", String(eintrag.platz));
      marke.setAttribute("aria-label", `Platz ${eintrag.platz}`);
      zeile.append(marke);
      const name = el("span", "gk-name");
      name.append(el("span", "gk-name-text", eintrag.name));
      if (eintrag.eigen) name.append(el("small", "gk-du", "Du"));
      zeile.append(name);
      const wert = el("span", "gk-wert", String(punkte));
      wert.append(el("small", "gk-einheit", einheit(spiel)));
      zeile.append(wert);
      if (ziele.size) {
        const ziel = ziele.get(eintrag);
        if (ziel) {
          const play = mitIcon("a", "gk-ansehen", "play");
          play.href = ziel;
          play.title = `Den Lauf von ${eintrag.name} anschauen`;
          play.setAttribute("aria-label", play.title);
          zeile.append(play);
        } else {
          zeile.append(el("span", "gk-ansehen-leer"));
        }
      }
      wrap.append(zeile);
    });
    return wrap;
  }

  function kachel(spiel, liste, { klasse = "", link = "", sperre = null, chips = [], aus = "", ansehbar = true, verdeckt = false } = {}) {
    const f = farbe(spiel);
    const karte = el("article", `mini-karte gk-karte${klasse ? ` ${klasse}` : ""}`);
    karte.style.setProperty("--mini-farbe", f.hell);
    karte.style.setProperty("--mini-farbe-dunkel", f.dunkel);
    karte.dataset.spiel = spiel;

    // Oben: der Film. Er ist selbst ein Weg ins Spiel (für den Finger, der
    // irgendwo auf das Bild tippt); für Tastatur und Vorleser zählt nur der
    // Play-Knopf.
    const oben = el("div", "gk-oben");
    const buehne = el(link ? "a" : "div", `gk-buehne${link ? "" : " ist-zu"}`);
    if (link) {
      buehne.href = link;
      buehne.tabIndex = -1;
      buehne.setAttribute("aria-hidden", "true");
    }
    const film = el("canvas", "gk-film");
    film.setAttribute("aria-hidden", "true");
    buehne.append(film);
    oben.append(buehne);
    if (link) {
      const play = mitIcon("a", "gk-play", "play");
      play.href = link;
      play.title = `${titel(spiel)} spielen`;
      play.setAttribute("aria-label", play.title);
      oben.append(play);
    } else if (sperre?.text) {
      buehne.append(mitIcon("span", `gk-sperre${sperre.art === "vorne" ? " ist-vorne" : ""}`, sperre.art === "vorne" ? "krone" : "schloss", sperre.text));
    }
    karte.append(oben);
    window.LernappVorschau?.zeige?.(film, spiel);

    const koerper = el("div", "gk-koerper");
    const kopf = el("header", "gk-kopf");
    kopf.append(el("h3", "gk-titel", titel(spiel)));
    const satz = window.LernappVorschau?.satz?.(spiel);
    if (satz) kopf.append(el("p", "gk-satz", satz));
    if (chips.length) {
      const reihe = el("div", "gk-chips");
      chips.forEach(({ text, icon }) => reihe.append(icon ? mitIcon("span", "gk-chip", icon, text) : el("span", "gk-chip", text)));
      kopf.append(reihe);
    }
    koerper.append(kopf);

    const wirt = el("div", "gk-listen-wirt");
    let ganz = false;
    const gezeigt = () => (ganz ? liste : gezeigteEintraege(liste, 3));
    const ansehen = ansehbar && !verdeckt ? ansehenFuer(spiel, gezeigt, () => zeichne(), { aus }) : null;
    const zeichne = () => {
      wirt.innerHTML = "";
      if (verdeckt) wirt.append(mitIcon("p", "gk-verdeckt", "schloss", "Die Rangliste bleibt bis zum Schluss verdeckt."));
      else wirt.append(bestenliste(liste, spiel, ganz ? { ansehen } : { max: 3, ansehen }));
      ansehen?.frage?.();
    };
    zeichne();
    koerper.append(wirt);

    // Erst ab der vierten Zeile gibt es etwas aufzuklappen.
    if (!verdeckt && liste.length > 3) {
      const mehr = mitIcon("button", "gk-mehr", "pfeil", `Alle ${liste.length} zeigen`);
      mehr.type = "button";
      mehr.setAttribute("aria-expanded", "false");
      mehr.addEventListener("click", () => {
        ganz = !ganz;
        zeichne();
        mehr.lastChild.textContent = ganz ? "Nur die ersten drei" : `Alle ${liste.length} zeigen`;
        mehr.setAttribute("aria-expanded", String(ganz));
      });
      koerper.append(mehr);
    }
    karte.append(koerper);
    return karte;
  }

  function spielerTabelle(personen) {
    if (!personen.length) return el("p", "mini-hinweis", "Noch hat niemand gespielt. Der erste Name, der hier steht, könnte deiner sein.");
    const tabelle = el("table", "mini-tabelle");
    const kopf = el("thead");
    const kopfZeile = el("tr");
    [["Spieler", ""], ["Spiele", "zahl"], ["Ø Rang", "zahl"], ["Bester", "zahl"], ["Siege", "zahl"]]
      .forEach(([text, klasse]) => kopfZeile.append(el("th", klasse, text)));
    kopf.append(kopfZeile);
    tabelle.append(kopf);

    const koerperTeil = el("tbody");
    personen.forEach((person, index) => {
      const zeile = el("tr", index === 0 ? "ist-erster" : "");
      const namensZelle = el("td", "mini-tabelle-name");
      namensZelle.append(el("span", "mini-rangzahl", `${index + 1}`), el("span", "", person.name));
      zeile.append(namensZelle);
      zeile.append(el("td", "zahl", String(person.spiele)));
      zeile.append(el("td", "zahl", person.schnitt.toFixed(1).replace(".", ",")));
      zeile.append(el("td", "zahl", String(person.bester ?? "–")));
      zeile.append(el("td", "zahl", String(person.siege)));
      koerperTeil.append(zeile);
    });
    tabelle.append(koerperTeil);
    return tabelle;
  }

  /*
   * Der Knopf «Multiplayer» oben auf der Startseite (live.js): Er steht nur
   * da, solange ein Multiplayer für alle offen ist – einer nur mit Link
   * erscheint hier nie. Bei einem führt er direkt hinein, bei mehreren zur
   * Auswahl. Gefragt wird beim Laden und alle 20 Sekunden, solange die Seite
   * zu sehen ist: Wer gerade hier ist, sieht ihn auch, wenn er erst später
   * aufgeht.
   */
  function multiplayerKnopf(kopf, vor) {
    let knopf = null;
    let zuletzt = "";
    const schau = async () => {
      let offene = [];
      try { offene = (await cloud()?.offeneMultiplayer?.()) || []; } catch { offene = []; }
      const ziel = offene.length === 1 ? `/live?code=${encodeURIComponent(offene[0].code)}` : offene.length ? "/live" : "";
      if (ziel === zuletzt) return;
      zuletzt = ziel;
      knopf?.remove();
      knopf = null;
      if (!ziel) return;
      knopf = verweis("Multiplayer", ziel, "mini-knopf-hell mini-knopf-live");
      knopf.title = offene.length === 1 ? `Multiplayer «${offene[0].name}»: jetzt mitspielen` : "Multiplayer: jetzt mitspielen";
      if (vor && vor.parentNode === kopf) kopf.insertBefore(knopf, vor);
      else kopf.append(knopf);
    };
    schau();
    const takt = window.setInterval(() => {
      if (!kopf.isConnected) { window.clearInterval(takt); return; }
      if (document.visibilityState === "visible") schau();
    }, 20000);
  }

  // ---------------------------------------------------------------------------
  // Die Startseite: alae arcade
  // ---------------------------------------------------------------------------
  /*
   * Oben die Bühne: ein Spiel gross, als laufender Film, dazu sein Name, ein
   * Satz, wie man es spielt, der Weg hinein und seine Bestenliste. Darunter
   * alle Spiele in Reihen, nach Tier (Favoriten zuerst): Ein Tipp auf eine
   * Kachel holt das Spiel auf die Bühne. Solange niemand selbst wählt, geht
   * die Bühne von allein durch die Favoriten.
   *
   * Die Filme sind echte Runden, aufgenommen (scripts/filme-aufnehmen.mjs):
   * filme/<seite>-quer.mp4 für breite Bildschirme, -hoch.mp4 fürs Handy, und
   * je ein Standbild (.webp) – das steht da, bis der Film läuft, und auf den
   * Kacheln. Auf der ganzen Seite läuft immer nur ein Film: der auf der Bühne
   * (und am Computer der unter der Maus).
   *
   * Wer weniger Bewegung eingestellt hat, sieht die Standbilder, und die
   * Bühne wechselt nicht von selbst.
   *
   * Die Gesamtwertung über alle Spiele steht ganz unten, zugeklappt.
   */
  const WECHSEL_MS = 9000;
  const ZULETZT_KEY = "arcade.zuletzt";
  const REIHEN = [
    { tier: 1, titel: "Favoriten" },
    { tier: 2, titel: "Beliebt" },
    { tier: 3, titel: "Zum Entdecken" },
  ];
  // Wofür ein Spiel ist (highscore.js, bereich) – klein über dem Namen.
  const BEREICHE = {
    geschwindigkeit: "Tempo & Geschick",
    konzentration: "Konzentration",
    gedaechtnis: "Gedächtnis",
    problemloesen: "Knobeln",
    zahlbuchstabe: "Zahlen",
  };

  // Wie man es spielt – ein Satz, auf der Bühne unter dem Namen.
  const SAETZE = {
    tileMemory: "Merk dir, welche Kacheln leuchten, und tippe sie nach.",
    fishPond: "Tippe jeden Fisch genau einmal an – und merk dir, welche du schon hattest.",
    leafFlow: "Wische die Blätter: orange dorthin, wo sie schwimmen, grüne dorthin, wo sie zeigen.",
    towerStack: "Tippe, wenn der Block genau über dem Turm ist – was übersteht, bricht ab.",
    bridgeBuilder: "Halte gedrückt, bis der Balken über die Schlucht reicht – und triff die rote Mitte.",
    dartWheel: "Wirf Pfeil um Pfeil in die drehende Scheibe, ohne einen anderen zu treffen.",
    vineSwing: "Halten heisst festhalten, Loslassen heisst fliegen – schwing dich über den Fluss.",
    tunnelFlight: "Halten heisst steigen, Loslassen sinken – flieg durch den Tunnel, ohne die Wände zu berühren.",
    driftRace: "Halten heisst driften, Loslassen geradeaus – jag das Auto die Passstrasse hinauf.",
    planetHop: "Tippe im richtigen Moment, und der Astronaut springt zum nächsten Planeten.",
    moonLander: "Halten gibt Schub, der Finger lenkt – setz die Fähre sanft auf die Plattform.",
    gravityRun: "Tippe, und die Schwerkraft kehrt sich um – an Lücken, Stacheln und Blöcken vorbei.",
    hillGlide: "Halten macht den Vogel schwer, Loslassen leicht – flieg über die Kuppen.",
    balloonRide: "Halten heizt den Brenner, Loslassen kühlt – zwischen Bergen und Gewittern hindurch.",
    skiSlalom: "Halten heisst Kurve nach rechts, Loslassen nach links – durch jedes Tor.",
    frogHop: "Halten lädt den Sprung, Loslassen springt – lande mitten auf dem Seerosenblatt.",
    waveRider: "Halten drückt das Brett in die Welle, Loslassen hebt es – bleib vor dem Brecher.",
    craneHarbor: "Tippe im richtigen Moment und stapel den Container auf das schaukelnde Schiff.",
    ropeWalk: "Halten lehnt nach rechts, Loslassen nach links – halt das Gleichgewicht auf dem Seil.",
    numberLine: "Schieb den Zug auf dem Gleis dorthin, wo die Zahl liegt.",
    boilerRoom: "Jeder Kessel fällt – leg Kohle nach, aber nie im roten Feld.",
  };

  // Die Fassung dieser Datei (mini-games.js?v=…): Sie hängt auch an Filmen und
  // Standbildern – wer sie neu aufnimmt, zählt die Fassung hoch.
  const FASSUNG_HIER = (() => {
    try { return new URL(document.currentScript?.src || "", window.location.href).searchParams.get("v") || ""; } catch { return ""; }
  })();

  // Fürs Handy hochkant, sonst quer.
  const HOCHKANT = window.matchMedia?.("(max-width: 700px)") || { matches: false, addEventListener() {} };
  const ruhigHier = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

  function filmPfad(spiel, art) {
    const seite = NACH_ID.get(spiel)?.seite || spiel;
    const format = HOCHKANT.matches ? "hoch" : "quer";
    return `/filme/${seite}-${format}.${art}${FASSUNG_HIER ? `?v=${FASSUNG_HIER}` : ""}`;
  }

  const MARKE = '<svg viewBox="0 0 34 20" aria-hidden="true"><path d="M2 17 9 4l7 13" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 17 25 4l7 13" fill="none" stroke="#ff7466" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // Der Film einer Ebene der Bühne: ein Video mit Standbild. Ohne Ton, in der
  // Schleife, im Browser eingebettet (playsinline – sonst öffnet das iPhone
  // ihn bildschirmfüllend).
  function filmKnoten(klasse) {
    const film = el("video", klasse);
    film.muted = true;
    film.defaultMuted = true;
    film.loop = true;
    film.playsInline = true;
    film.preload = "auto";
    film.setAttribute("muted", "");
    film.setAttribute("playsinline", "");
    film.setAttribute("aria-hidden", "true");
    film.disablePictureInPicture = true;
    return film;
  }

  function spiele(film) {
    if (ruhigHier()) return;
    const versuch = film.play?.();
    if (versuch?.catch) versuch.catch(() => { /* ohne Erlaubnis bleibt das Standbild */ });
  }

  // Zwei Buchstaben für den Kreis neben dem Namen.
  function kuerzel(wer) {
    const teile = String(wer || "").trim().split(/\s+/).filter(Boolean);
    if (!teile.length) return "?";
    return (teile.length > 1 ? teile[0][0] + teile[1][0] : teile[0].slice(0, 2)).toLocaleUpperCase("de");
  }

  // Baut sich die Seite neu (nach einem neuen Namen), räumt die alte zuerst
  // ab: ihre Uhr, ihre Filme und was sie an window und document hörte.
  let abbauUebersicht = null;

  async function baueUebersicht(wirt, { spiel: gewuenscht = "" } = {}) {
    abbauUebersicht?.abort();
    const ende = new AbortController();
    abbauUebersicht = ende;
    const { signal } = ende;
    wirt.innerHTML = "";
    wirt.classList.add("ar-seite");
    document.body.classList.add("ar");

    // --- Oben: die Marke, und rechts der Name und das Vollbild ---------------
    const kopf = el("header", "ar-kopf");
    const marke = el("a", "ar-marke");
    marke.href = "/";
    marke.setAttribute("aria-label", "alae arcade");
    const zeichen = el("span", "ar-marke-zeichen");
    zeichen.innerHTML = MARKE;
    const wort = el("span", "ar-marke-wort");
    wort.append(el("strong", "", "alae"), el("span", "", "arcade"));
    marke.append(zeichen, wort);
    // Die Überschrift der Seite, für alle, die sie nicht sehen.
    const h1 = el("h1", "ar-unsichtbar", "alae arcade");
    kopf.append(marke, h1);
    const rechts = el("div", "ar-kopf-rechts");
    const zumAdmin = adminKnopf();
    if (zumAdmin) rechts.append(zumAdmin);
    rechts.append(nameChip(wirt, signal));
    const voll = window.LernappVollbild?.knopf?.("mini-vollbild ar-vollbild");
    if (voll) rechts.append(voll);
    kopf.append(rechts);
    wirt.append(kopf);
    // Davor, sobald ein Multiplayer für alle offen ist, der Weg hinein.
    multiplayerKnopf(rechts, rechts.querySelector(".ar-name"));
    // Der Kopf wird fest, sobald die Bühne nach oben wegscrollt.
    const merkeScroll = () => kopf.classList.toggle("ist-fest", window.scrollY > 24);
    window.addEventListener("scroll", merkeScroll, { passive: true, signal });
    merkeScroll();

    const offen = await offeneSpiele();
    if (signal.aborted) return;
    if (!offen.length) {
      wirt.append(el("p", "mini-hinweis ar-leer", "Gerade ist kein Spiel freigegeben. Schau später wieder vorbei."));
      zeigeInstall(wirt);
      return;
    }

    // Die Reihen: nach Tier, wie der Admin sie eingeteilt hat.
    let einteilung = null;
    try { einteilung = await cloud()?.tiers?.(); } catch { einteilung = null; }
    if (signal.aborted) return;
    const reihen = REIHEN.map((r) => ({ ...r, spiele: offen.filter((s) => tierVon(s, einteilung) === r.tier) }))
      .filter((r) => r.spiele.length);
    const reihenfolge = reihen.flatMap((r) => r.spiele);
    const favoriten = reihen[0].spiele;

    // Welches Spiel zuerst auf der Bühne steht: das gewünschte, das, aus dem
    // man gerade kommt, oder der erste Favorit. Wer aus einem Spiel kommt,
    // will seinen Platz sehen – dort wechselt die Bühne nicht von selbst.
    let zuletzt = "";
    try { zuletzt = sessionStorage.getItem(ZULETZT_KEY) || ""; } catch { zuletzt = ""; }
    let herkunft = "";
    try {
      const weg = new URL(document.referrer).pathname.replace(/^\//, "").replace(/\.html$/, "");
      herkunft = SPIELE.find((s) => s.seite === weg)?.id || "";
    } catch { herkunft = ""; }
    const start = [gewuenscht, herkunft, zuletzt].find((s) => s && offen.includes(s)) || favoriten[0];

    // --- Die Bühne -----------------------------------------------------------
    const buehne = el("section", "ar-buehne");
    buehne.setAttribute("aria-label", "Spiel auf der Bühne");
    const filme = el("div", "ar-filme");
    const ebenen = [filmKnoten("ar-film"), filmKnoten("ar-film")];
    filme.append(...ebenen);
    const licht = el("div", "ar-licht");
    const inhalt = el("div", "ar-buehne-inhalt");
    const ueber = el("p", "ar-ueber");
    const titelZeile = el("h2", "ar-titel");
    const satz = el("p", "ar-satz");
    const aktionen = el("div", "ar-aktionen");
    const play = mitIcon("a", "ar-play", "play", "Spielen");
    const rekord = el("p", "ar-rekord");
    aktionen.append(play, rekord);
    inhalt.append(ueber, titelZeile, satz, aktionen);
    const tafel = el("aside", "ar-bestenliste");
    tafel.setAttribute("aria-label", "Bestenliste");
    buehne.append(filme, licht, inhalt, tafel);
    wirt.append(buehne);

    // Laufende Turniere: gleich unter der Bühne (turnier.js füllt den Platz).
    const turniere = el("div", "tn-hinweise ar-turniere");
    turniere.dataset.turnierHinweis = "";
    wirt.append(turniere);
    window.LernappTurnier?.hinweis?.(turniere);

    // --- Die Reihen ----------------------------------------------------------
    const kacheln = new Map();
    const reihenWirt = el("div", "ar-reihen");
    reihen.forEach((r) => {
      const block = el("section", "ar-reihe");
      const kopfReihe = el("div", "ar-reihe-kopf");
      kopfReihe.append(el("h2", "ar-reihe-titel", r.titel), el("span", "ar-reihe-zahl", zahlWort(r.spiele.length, "Spiel", "Spiele")));
      const spur = el("div", "ar-spur");
      spur.setAttribute("role", "list");
      r.spiele.forEach((spiel, i) => {
        const k = kachelBauen(spiel);
        k.style.setProperty("--ar-i", String(i));
        kacheln.set(spiel, k);
        spur.append(k);
      });
      const zurueck = mitIcon("button", "ar-blaettern ist-zurueck", "pfeil");
      const vor = mitIcon("button", "ar-blaettern ist-vor", "pfeil");
      zurueck.type = "button";
      vor.type = "button";
      zurueck.setAttribute("aria-label", `${r.titel}: zurückblättern`);
      vor.setAttribute("aria-label", `${r.titel}: weiterblättern`);
      const blaettern = (richtung) => spur.scrollBy({ left: richtung * spur.clientWidth * 0.8, behavior: ruhigHier() ? "auto" : "smooth" });
      zurueck.addEventListener("click", () => blaettern(-1));
      vor.addEventListener("click", () => blaettern(1));
      const rand = el("div", "ar-spur-rand");
      rand.append(spur, zurueck, vor);
      block.append(kopfReihe, rand);
      reihenWirt.append(block);
      const knoepfe = () => {
        zurueck.disabled = spur.scrollLeft < 8;
        vor.disabled = spur.scrollLeft + spur.clientWidth > spur.scrollWidth - 8;
      };
      spur.addEventListener("scroll", knoepfe, { passive: true });
      window.requestAnimationFrame(knoepfe);
    });
    wirt.append(reihenWirt);

    // Die Gesamtwertung: ganz unten, zugeklappt.
    const gesamt = el("details", "ar-gesamt");
    const zusammen = el("summary", "ar-gesamt-titel");
    zusammen.append(el("span", "", "Gesamtwertung über alle Spiele"));
    gesamt.append(zusammen);
    const gesamtInhalt = el("div", "ar-gesamt-inhalt");
    gesamtInhalt.append(el("p", "mini-hinweis", "Wird geladen..."));
    gesamt.append(gesamtInhalt);
    wirt.append(gesamt);
    zeigeInstall(wirt);

    // Die Reihen gleiten herein, sobald sie ins Bild kommen.
    if ("IntersectionObserver" in window && !ruhigHier()) {
      const beobachter = new IntersectionObserver((eintraege) => {
        eintraege.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("ist-da");
          beobachter.unobserve(e.target);
        });
      }, { rootMargin: "0px 0px -8% 0px" });
      reihenWirt.querySelectorAll(".ar-reihe").forEach((r) => { r.classList.add("kommt"); beobachter.observe(r); });
      signal.addEventListener("abort", () => beobachter.disconnect());
    }

    // --- Die Ergebnisse --------------------------------------------------------
    let listen = new Map();
    let geladen = false;
    let ladefehler = false;
    const ansehen = new Map();

    function kachelBauen(spiel) {
      const k = el("button", "ar-kachel");
      k.type = "button";
      k.setAttribute("role", "listitem");
      k.dataset.spiel = spiel;
      const f = farbe(spiel);
      k.style.setProperty("--mini-farbe", f.hell);
      k.style.setProperty("--mini-farbe-dunkel", f.dunkel);
      const bild = el("img", "ar-kachel-bild");
      bild.alt = "";
      bild.loading = "lazy";
      bild.decoding = "async";
      bild.src = filmPfad(spiel, "webp");
      bild.addEventListener("error", () => k.classList.add("ohne-bild"), { once: true });
      const text = el("span", "ar-kachel-text");
      text.append(el("span", "ar-kachel-titel", titel(spiel)), el("span", "ar-kachel-rekord", "…"));
      const zeit = el("span", "ar-zeit");
      k.append(bild, text, zeit);
      k.setAttribute("aria-label", titel(spiel));
      k.addEventListener("click", () => waehle(spiel, { von: k, selbst: true }));
      // Am Computer: der Film läuft schon in der Kachel, solange die Maus
      // darauf liegt.
      let vorschau = null;
      k.addEventListener("pointerenter", (ereignis) => {
        if (ereignis.pointerType !== "mouse" || ruhigHier()) return;
        vorschau = filmKnoten("ar-kachel-film");
        vorschau.src = filmPfad(spiel, "mp4");
        vorschau.addEventListener("playing", () => k.classList.add("spielt"), { once: true });
        k.insertBefore(vorschau, text);
        spiele(vorschau);
      });
      k.addEventListener("pointerleave", () => {
        k.classList.remove("spielt");
        vorschau?.remove();
        vorschau = null;
      });
      return k;
    }

    function rekordText(spiel) {
      if (ladefehler) return "";
      if (!geladen) return "…";
      const oben = (listen.get(spiel) || [])[0];
      return oben ? `${oben.punkte} ${einheit(spiel)} · ${oben.name}` : "Rekord frei";
    }

    function kachelnAuffrischen() {
      kacheln.forEach((k, spiel) => {
        const zeile = k.querySelector(".ar-kachel-rekord");
        const oben = (listen.get(spiel) || [])[0];
        zeile.textContent = rekordText(spiel);
        zeile.classList.toggle("ist-frei", geladen && !oben);
      });
    }

    // Die Bestenliste der Bühne: die ersten fünf und der eigene Eintrag, und
    // auf Wunsch alle – mit dem ▶ bei jedem, dessen Lauf es gibt.
    let ganz = false;
    function tafelZeichnen() {
      const spiel = aktuell;
      tafel.innerHTML = "";
      const kopfTafel = el("div", "ar-tafel-kopf");
      kopfTafel.append(mitIcon("span", "ar-tafel-titel", "krone", "Bestenliste"));
      const liste = listen.get(spiel) || [];
      if (geladen && liste.length) kopfTafel.append(el("span", "ar-tafel-zahl", zahlWort(liste.length, "Spieler", "Spieler")));
      tafel.append(kopfTafel);
      if (ladefehler) {
        tafel.append(el("p", "ar-tafel-hinweis", "Die Bestenliste ist gerade nicht zu haben. Probier es später noch einmal."));
        return;
      }
      if (!geladen) {
        tafel.append(el("p", "ar-tafel-hinweis", "Wird geladen..."));
        return;
      }
      if (!ansehen.has(spiel)) ansehen.set(spiel, ansehenFuer(spiel, () => (ganz ? liste : gezeigteEintraege(liste, 5)), () => { if (aktuell === spiel) tafelZeichnen(); }));
      const fuer = ansehen.get(spiel);
      const wirtListe = el("div", "ar-tafel-liste");
      wirtListe.append(bestenliste(liste, spiel, ganz ? { ansehen: fuer } : { max: 5, ansehen: fuer }));
      tafel.append(wirtListe);
      fuer.frage();
      if (liste.length > 5) {
        const mehr = mitIcon("button", "gk-mehr ar-mehr", "pfeil", ganz ? "Nur die ersten fünf" : `Alle ${liste.length} zeigen`);
        mehr.type = "button";
        mehr.setAttribute("aria-expanded", String(ganz));
        mehr.addEventListener("click", () => { ganz = !ganz; tafelZeichnen(); });
        tafel.append(mehr);
      }
    }

    // --- Ein Spiel auf die Bühne -------------------------------------------
    let aktuell = "";
    let ebene = 0;
    let selbstGewaehlt = Boolean(gewuenscht || herkunft || zuletzt);

    function waehle(spiel, { von = null, selbst = false, sofort = false } = {}) {
      if (selbst) {
        selbstGewaehlt = true;
        uhr.stopp();
      }
      if (spiel === aktuell && !sofort) {
        if (selbst) zurBuehne();
        return;
      }
      const vorher = aktuell;
      aktuell = spiel;
      ganz = false;
      const f = farbe(spiel);
      wirt.style.setProperty("--ar-farbe", f.hell);
      wirt.style.setProperty("--mini-farbe", f.hell);
      wirt.style.setProperty("--mini-farbe-dunkel", f.dunkel);
      kacheln.forEach((k, s) => {
        k.classList.toggle("ist-aktiv", s === spiel);
        k.setAttribute("aria-current", s === spiel ? "true" : "false");
      });
      // Der neue Film kommt auf die freie Ebene und blendet über die alte.
      const alt = ebenen[ebene];
      ebene = 1 - ebene;
      const neu = ebenen[ebene];
      neu.poster = filmPfad(spiel, "webp");
      neu.src = filmPfad(spiel, "mp4");
      neu.currentTime = 0;
      spiele(neu);
      neu.classList.add("ist-an");
      alt.classList.remove("ist-an");
      window.setTimeout(() => { if (!alt.classList.contains("ist-an")) alt.pause(); }, 700);

      // Der Text: kurz weg, und neu herein.
      ueber.textContent = BEREICHE[hs()?.spiel?.(spiel)?.bereich] || "";
      titelZeile.textContent = titel(spiel);
      satz.textContent = SAETZE[spiel] || "";
      play.href = spielLink(spiel);
      play.title = `${titel(spiel)} spielen`;
      play.setAttribute("aria-label", play.title);
      rekordZeile();
      inhalt.classList.remove("ist-neu");
      tafel.classList.remove("ist-neu");
      void inhalt.offsetWidth;
      if (vorher) { inhalt.classList.add("ist-neu"); tafel.classList.add("ist-neu"); }
      tafelZeichnen();

      // Ist die Bühne im Bild, fliegt die Kachel hinauf; sonst geht die Seite
      // zur Bühne, und dort blendet der Film über.
      if (selbst && !zurBuehne() && von) flug(von);
      if (!selbstGewaehlt) uhr.weiter();
    }

    // Steht die Bühne nicht gut im Bild, scrollt die Seite hinauf. Sagt, ob sie
    // es tat.
    function zurBuehne() {
      const r = buehne.getBoundingClientRect();
      const sichtbar = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
      if (sichtbar > Math.min(r.height, window.innerHeight) * 0.6) return false;
      window.scrollTo({ top: 0, behavior: ruhigHier() ? "auto" : "smooth" });
      return true;
    }

    function rekordZeile() {
      rekord.innerHTML = "";
      const oben = (listen.get(aktuell) || [])[0];
      if (!geladen || ladefehler) return;
      if (!oben) {
        rekord.append(mitIcon("span", "ar-rekord-marke ist-frei", "krone", "Der Rekord ist noch frei"));
        return;
      }
      const marke = mitIcon("span", "ar-rekord-marke", "krone");
      const text = el("span", "ar-rekord-text");
      text.append(el("strong", "", `${oben.punkte} ${einheit(aktuell)}`), el("span", "", oben.name));
      rekord.append(marke, text);
    }

    // Die Kachel fliegt auf die Bühne: ihr Bild, vom Platz in der Reihe bis
    // über die ganze Bühne – nur wenn beide im Bild sind.
    function flug(von) {
      if (ruhigHier() || !von.animate) return;
      const bild = von.querySelector(".ar-kachel-bild");
      const a = von.getBoundingClientRect();
      const b = filme.getBoundingClientRect();
      if (!bild || b.bottom < 40 || a.top > window.innerHeight) return;
      const klon = bild.cloneNode();
      klon.className = "ar-flug";
      klon.removeAttribute("loading");
      Object.assign(klon.style, { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` });
      document.body.append(klon);
      const sx = a.width / b.width;
      const sy = a.height / b.height;
      klon.animate([
        { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${sx}, ${sy})`, opacity: 1, borderRadius: "14px" },
        { transform: "translate(0, 0) scale(1, 1)", opacity: 1, borderRadius: "0px", offset: 0.75 },
        { transform: "translate(0, 0) scale(1, 1)", opacity: 0, borderRadius: "0px" },
      ], { duration: 720, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }).finished.then(() => klon.remove(), () => klon.remove());
    }

    // Die Uhr der Bühne: Solange niemand selbst wählt, kommt alle paar
    // Sekunden der nächste Favorit – nur wenn die Bühne zu sehen ist, die
    // Seite vorne und keine Maus darauf liegt.
    const uhr = (() => {
      let zeitgeber = null;
      let sichtbar = true;
      let drauf = false;
      const darf = () => !signal.aborted && !selbstGewaehlt && sichtbar && !drauf && document.visibilityState === "visible" && !ruhigHier();
      const naechster = () => {
        const liste = favoriten.length > 1 ? favoriten : reihenfolge;
        const i = liste.indexOf(aktuell);
        return liste[(i + 1) % liste.length];
      };
      const zeige = () => kacheln.get(aktuell)?.classList.toggle("ist-uhr", darf());
      return {
        weiter() {
          window.clearTimeout(zeitgeber);
          kacheln.forEach((k) => k.classList.remove("ist-uhr"));
          const k = kacheln.get(aktuell);
          if (k) { void k.offsetWidth; }
          zeige();
          if (!darf()) return;
          zeitgeber = window.setTimeout(() => { if (darf()) waehle(naechster()); }, WECHSEL_MS);
        },
        stopp() {
          window.clearTimeout(zeitgeber);
          kacheln.forEach((k) => k.classList.remove("ist-uhr"));
        },
        sicht(wert) { sichtbar = wert; if (darf()) this.weiter(); else this.stopp(); },
        maus(wert) { drauf = wert; if (darf()) this.weiter(); else this.stopp(); },
      };
    })();
    buehne.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") uhr.maus(true); });
    buehne.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") uhr.maus(false); });
    // Wer die Bühne berührt oder die Seite bewegt, liest – dann bleibt das
    // Spiel stehen, für immer.
    const bleib = () => { selbstGewaehlt = true; uhr.stopp(); };
    buehne.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") bleib(); });
    const beimScrollen = () => {
      if (window.scrollY < 60) return;
      bleib();
      window.removeEventListener("scroll", beimScrollen);
    };
    window.addEventListener("scroll", beimScrollen, { passive: true, signal });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") { spiele(ebenen[ebene]); uhr.weiter(); } else { ebenen.forEach((v) => v.pause()); uhr.stopp(); }
    }, { signal });
    if ("IntersectionObserver" in window) {
      const imBild = new IntersectionObserver(([e]) => {
        uhr.sicht(e.isIntersecting);
        if (e.isIntersecting) spiele(ebenen[ebene]); else ebenen[ebene].pause();
      }, { threshold: 0.25 });
      imBild.observe(buehne);
      signal.addEventListener("abort", () => imBild.disconnect());
    }
    // Abgebaut: Uhr aus, und die Filme laden nicht weiter.
    signal.addEventListener("abort", () => {
      uhr.stopp();
      ebenen.forEach((v) => { v.pause(); v.removeAttribute("src"); v.load(); });
    });
    // Wer Play drückt, kommt danach hierher zurück – auf dieses Spiel.
    play.addEventListener("click", () => {
      try { sessionStorage.setItem(ZULETZT_KEY, aktuell); } catch { /* egal */ }
    });
    // Dreht jemand das Handy, passt das Format der Filme nicht mehr.
    HOCHKANT.addEventListener?.("change", () => {
      kacheln.forEach((k, s) => { k.querySelector(".ar-kachel-bild").src = filmPfad(s, "webp"); });
      waehle(aktuell, { sofort: true });
    }, { signal });

    waehle(start, { sofort: true });

    // Jetzt die Ergebnisse – die Filme laufen schon.
    let alle = [];
    try {
      alle = await alleErgebnisse(offen, { neu: true });
    } catch {
      if (signal.aborted) return;
      ladefehler = true;
      kachelnAuffrischen();
      tafelZeichnen();
      gesamtInhalt.innerHTML = "";
      gesamtInhalt.append(el("p", "mini-hinweis", "Die Ergebnisse sind gerade nicht zu haben."));
      return;
    }
    if (signal.aborted) return;
    listen = new Map(offen.map((spiel) => [spiel, rangliste(alle.filter((e) => e.game === spiel))]));
    geladen = true;
    kachelnAuffrischen();
    rekordZeile();
    tafelZeichnen();
    gesamtInhalt.innerHTML = "";
    gesamtInhalt.append(spielerTabelle(auswertung(alle, offen)));
  }

  // Der Name oben rechts: ein Kreis mit zwei Buchstaben und der Name. Ein
  // Tipp öffnet darunter das Feld, ihn zu ändern (namensZeile).
  function nameChip(seite, signal) {
    const wirt = el("div", "ar-name");
    const knopfName = el("button", "ar-name-knopf");
    knopfName.type = "button";
    knopfName.setAttribute("aria-haspopup", "dialog");
    knopfName.setAttribute("aria-expanded", "false");
    const kreis = el("span", "ar-name-kreis");
    const text = el("span", "ar-name-text");
    const beschriften = () => {
      const wer = name();
      kreis.textContent = wer ? kuerzel(wer) : "?";
      text.textContent = wer || "Name";
      knopfName.title = wer ? `Du spielst als ${wer} – Namen ändern` : "Namen festlegen";
      knopfName.setAttribute("aria-label", knopfName.title);
    };
    beschriften();
    knopfName.append(kreis, text);
    const feld = el("div", "ar-name-feld");
    feld.hidden = true;
    feld.setAttribute("role", "dialog");
    feld.setAttribute("aria-label", "Dein Name");
    const zu = () => {
      feld.hidden = true;
      knopfName.setAttribute("aria-expanded", "false");
    };
    const auf = () => {
      feld.innerHTML = "";
      feld.append(namensZeile({
        klasse: "ar-wer",
        beiWechsel: () => {
          beschriften();
          // Wer man ist, ändert, welche Zeilen «Du» sind: neu aufbauen, auf
          // demselben Spiel.
          const jetzt = seite.querySelector(".ar-kachel.ist-aktiv")?.dataset.spiel || "";
          window.setTimeout(() => baueUebersicht(seite, { spiel: jetzt }), 1400);
        },
      }));
      feld.hidden = false;
      knopfName.setAttribute("aria-expanded", "true");
    };
    knopfName.addEventListener("click", () => (feld.hidden ? auf() : zu()));
    document.addEventListener("pointerdown", (e) => { if (!feld.hidden && !wirt.contains(e.target)) zu(); }, { signal });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !feld.hidden) { zu(); knopfName.focus(); } }, { signal });
    wirt.append(knopfName, feld);
    return wirt;
  }

  // ---------------------------------------------------------------------------
  // Nichts markieren, kein Menü beim langen Drücken
  // ---------------------------------------------------------------------------
  /*
   * styles.css nimmt dem Text das Markieren (user-select). Das genügt nicht
   * überall: Manche Browser markieren beim langen Drücken trotzdem ein Wort
   * und bieten «Suchen» an, und auf Links und Bildern kommt ein Menü mit
   * «In neuem Tab öffnen». Beides führt ein Kind mit einem Tipp aus der App
   * hinaus. Hier wird beides abgesagt – ausser in Eingabefeldern, dort soll
   * man seinen Namen markieren und korrigieren können. Gilt auf jeder Seite
   * (mini-games.js steht überall).
   */
  const darfMarkieren = (ziel) => {
    const knoten = ziel?.nodeType === 3 ? ziel.parentElement : ziel;
    return Boolean(knoten?.closest?.("input, textarea, [contenteditable='true']"));
  };
  ["selectstart", "contextmenu", "dragstart"].forEach((typ) => {
    document.addEventListener(typ, (ereignis) => {
      if (!darfMarkieren(ereignis.target)) ereignis.preventDefault();
    }, { capture: true });
  });

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  // Welche Spiele es gibt, steht in dieser Datei – die Übersicht muss auf
  // nichts warten und kann sofort bauen. Auf die Ergebnisse wartet sie
  // natürlich schon, und solange steht dort, dass geladen wird.
  function starteUebersicht() {
    const wirt = document.querySelector("[data-uebersicht]");
    if (wirt) baueUebersicht(wirt);
  }

  window.LernappMini = {
    SPIELE,
    FARBEN,
    NAME_MAX,
    spielId,
    spielLink,
    uebersichtLink,
    ausAdmin,
    ziel,
    alleSpiele,
    offeneSpiele,
    name,
    setzeName,
    kennung,
    kennungFallsDa,
    stammVon,
    titel,
    einheit,
    farbe,
    listeFuer,
    TIERS, TIERS_VORGABE, tierVon,
    listeBauen, gezeigteEintraege, ansehbareLaeufe, ansehenFuer, ansehArt, ANSEHBAR, ANSEHBAR_ZUEGE, ZUSCHAUBAR,
    kachel,
    geister,
    rangliste,
    melde,
    namenWechseln,
    namensZeile,
    startStand,
    bestwert,
    gleicheAb,
    bestwertAbgeglichen,
    auswertung,
    adminKnopf,
    leiste,
    ergebnis,
  };

  // Die Startseite baut sich selbst; auf einer Spielseite holt game-shell.js
  // ab, was es braucht, wenn es so weit ist. Den eigenen Bestwert gleicht sie
  // gleich zu Beginn mit dem Server ab.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", starteUebersicht);
  else starteUebersicht();
  if (spielId()) gleicheAb();
})();
