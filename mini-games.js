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
    { id: "missingItem", seite: "wasfehlt", page: "missing" },
    { id: "fishPond", seite: "fischteich", page: "pond" },
    { id: "goSignal", seite: "signal", page: "signal" },
    { id: "leafFlow", seite: "blaetter", page: "leaves" },
    { id: "towerStack", seite: "turmbau", page: "tower" },
    { id: "numberLine", seite: "zahlengleis", page: "numberline" },
  ];

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
  // Welche Landschaft zuletzt dran war. Siehe naechsteSzene().
  const SZENE_KEY = "mini.szene";
  // Die zuletzt gelesene Auswahl. Siehe offeneSpiele().
  const OFFEN_KEY = "mini.offen";
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

  function bestwerte() {
    try {
      const roh = JSON.parse(localStorage.getItem(BEST_KEY) || "{}");
      return roh && typeof roh === "object" ? roh : {};
    } catch { return {}; }
  }

  function merkeBestwert(spiel, punkte) {
    const zahl = Math.max(0, Math.round(Number(punkte) || 0));
    if (!spiel || !zahl) return;
    const alle = bestwerte();
    if ((Number(alle[spiel]) || 0) >= zahl) return;
    alle[spiel] = zahl;
    try { localStorage.setItem(BEST_KEY, JSON.stringify(alle)); } catch { /* privater Modus */ }
  }

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
  // Der Hintergrund
  // ---------------------------------------------------------------------------
  // In der App gehört die Landschaft dem Kind: Es spielt sie frei und wählt
  // sie aus, und dann steht sie hinter jedem Spiel. Hier wählt niemand etwas
  // aus – also drehen sie sich. Jede Spielseite, die geöffnet wird, nimmt die
  // nächste: Turmbau vor der Wiese, danach das Signal am Meer, danach der
  // Fischteich in den Bergen.
  //
  // Gezählt wird auf dem Gerät, nicht gewürfelt: Zufall wiederholt sich, und
  // zweimal dieselbe Landschaft hintereinander sähe aus, als drehe sich nichts.
  // Ohne localStorage (privates Fenster) bleibt der Zufall als Rückfall – er
  // ist besser als immer dieselbe.
  function naechsteSzene() {
    const szenen = window.LernappScenes?.SCENES;
    if (!Array.isArray(szenen) || !szenen.length) return null;
    let naechste = -1;
    try {
      const zuletzt = Number(localStorage.getItem(SZENE_KEY));
      naechste = (Number.isFinite(zuletzt) && zuletzt >= 0 ? zuletzt + 1 : 0) % szenen.length;
      localStorage.setItem(SZENE_KEY, String(naechste));
    } catch {
      naechste = Math.floor(Math.random() * szenen.length);
    }
    return szenen[naechste] || szenen[0];
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
  // einträgt, steht trotzdem einmal da: Es zählt sein bestes Ergebnis.
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
      }
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
  // Nur den Namen ändern, ohne dass eine Runde daraus wird – und zwar in
  // allen Spielen, in denen dieses Gerät schon steht. Der Name gehört dem
  // Gerät, und die Liste fasst nach Namen zusammen (verdichte): Bliebe in
  // einem Spiel der alte stehen, stünde derselbe Mensch zweimal da. Gibt es
  // noch keinen Eintrag, gilt der neue Name ab der nächsten Runde von selbst.
  async function benenneUm() {
    const wie = name();
    if (!wie) return null;
    const ergebnis = await cloud()?.benenneUm?.({ spieler: kennung(), name: wie });
    zwischenspeicher = null;
    return ergebnis || null;
  }

  async function melde(spiel, punkte) {
    const wie = name();
    if (!wie) return null;
    const ergebnis = await cloud()?.speichere?.({
      game: spiel,
      spieler: kennung(),
      name: wie,
      punkte: Math.max(0, Math.round(Number(punkte) || 0)),
    });
    zwischenspeicher = null;
    // Der Bestwert kommt vom Server zurück, nicht aus der eben gespielten
    // Runde: Er weiss, was vorher schon dastand.
    if (ergebnis) merkeBestwert(spiel, ergebnis.punkte);
    return ergebnis || null;
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
  function listeBauen(eintraege, spiel, { max = 0 } = {}) {
    const wrap = el("ol", "mini-liste");
    let gezeigt = max ? eintraege.slice(0, max) : eintraege;
    const eigen = eintraege.find((eintrag) => eintrag.eigen);
    const nachgestellt = eigen && !gezeigt.includes(eigen);
    if (nachgestellt) gezeigt = [...gezeigt, eigen];
    if (!gezeigt.length) {
      const leer = el("li", "mini-liste-leer", "Noch niemand. Sei der Erste.");
      wrap.append(leer);
      return wrap;
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
      wrap.append(zeile);
    });
    return wrap;
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
  // Handy hochkant bleibt für das Wort kein Platz: Links steht der
  // Lautsprecher, rechts der Ton-Schalter, und dazwischen müssen noch der
  // Neustart und der Zähler stehen. Dort steht deshalb nur der Pfeil – das
  // Wort liegt in einem eigenen span, damit das Stylesheet es ausblenden
  // kann (.mini-knopf-wort). Der Knopf behält seinen Namen für alle, die ihn
  // nicht sehen: title und aria-label bleiben.
  function leiste() {
    const halle = el("a", "mini-knopf mini-knopf-still mini-knopf-zurueck");
    halle.href = uebersichtLink();
    halle.title = "Zurück zur Hall of Fame";
    halle.setAttribute("aria-label", "Zurück zur Hall of Fame");
    halle.append(pfeil(), el("span", "mini-knopf-wort", "Hall of Fame"));
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
  function ergebnis({ punkte }) {
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

    // Diese Runde wird genau einmal gemeldet. Danach ändert "Name ändern" nur
    // noch den Namen: Wer sich umbenennt, hat nicht noch einmal gespielt – und
    // ein zweiter Aufruf von melde() zählte ihm einen Versuch an, den es nie
    // gab.
    let schonGemeldet = false;

    function melden() {
      if (schonGemeldet) { benennen(); return; }
      schonGemeldet = true;
      meldung.textContent = "Wird eingetragen...";
      melde(spiel, punkte)
        .then((stand) => {
          if (stand?.rekord) meldung.textContent = "Neue Bestzahl – eingetragen!";
          else meldung.textContent = "Eingetragen.";
          zeigeListe(true);
        })
        .catch(() => {
          // Angekommen ist nichts – dann ist die Runde auch nicht gemeldet,
          // und der nächste Anlauf darf es wieder versuchen, statt nur noch
          // umbenennen zu wollen.
          schonGemeldet = false;
          meldung.textContent = "Das Eintragen hat nicht geklappt. Die Runde zählt trotzdem.";
          zeigeListe(false);
        });
    }

    function benennen() {
      meldung.textContent = "Wird geändert...";
      benenneUm()
        .then((stand) => {
          // Ohne Eintrag gibt es nichts umzubenennen – der Name gilt dann ab
          // der nächsten Runde, und das steht auch so da.
          meldung.textContent = stand ? "Geändert." : "Der Name gilt ab der nächsten Runde.";
          zeigeListe(Boolean(stand));
        })
        .catch(() => {
          meldung.textContent = "Der neue Name konnte nicht gespeichert werden.";
          zeigeListe(false);
        });
    }

    function frageNamen(text) {
      const form = el("form", "mini-namensfeld");
      const feld = el("input");
      feld.type = "text";
      feld.maxLength = NAME_MAX;
      feld.placeholder = "Dein Name";
      feld.value = name();
      feld.setAttribute("aria-label", "Dein Name für die Bestenliste");
      feld.autocomplete = "nickname";
      const ab = el("button", "mini-knopf mini-knopf-voll", "Eintragen");
      ab.type = "submit";
      form.append(feld, ab);
      form.addEventListener("submit", (ereignis) => {
        ereignis.preventDefault();
        const gewaehlt = setzeName(feld.value);
        if (!gewaehlt) { feld.focus(); return; }
        form.replaceWith(el("p", "mini-name-steht", `Du spielst als ${gewaehlt}.`));
        melden();
      });
      meldung.textContent = text;
      block.insertBefore(form, listenWirt);
      zeigeListe(false);
    }

    if (name()) {
      const zeile = el("p", "mini-name-steht");
      zeile.append(document.createTextNode(`Du spielst als ${name()}. `));
      const aendern = knopf("Name ändern", "mini-knopf-klein", () => {
        zeile.remove();
        frageNamen("Wie sollen die anderen dich nennen?");
      });
      zeile.append(aendern);
      block.insertBefore(zeile, listenWirt);
      melden();
    } else {
      frageNamen("Trag deinen Namen ein, dann stehst du in der Liste.");
    }

    return block;
  }

  // Was der Lautsprecher nach der Runde sagt. In der App steht dort, wie weit
  // es noch bis zum fertigen Wagen ist – hier gibt es keinen Wagen.
  function ergebnisSprache({ punkte, label }) {
    const wort = String(label || "Punkte").replace(/^Deine?\s+/i, "");
    return `${punkte} ${wort}. Trag deinen Namen ein, dann stehst du in der Bestenliste.`;
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
  // Die Übersicht: die Startseite
  // ---------------------------------------------------------------------------
  // Zwei Fragen, und die zweite ist die, für die sich am Ende alle
  // interessieren: Welche Spiele gibt es – und wer ist der beste Spieler über
  // alle Spiele hinweg?
  //
  // "Der beste" ist dabei der Durchschnittsrang: Wer in drei Spielen Zweiter
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

  function spielKarte(spiel, liste) {
    const f = farbe(spiel);
    const karte = el("article", "mini-karte");
    karte.style.setProperty("--mini-farbe", f.hell);
    karte.style.setProperty("--mini-farbe-dunkel", f.dunkel);

    const kopf = el("header", "mini-karte-kopf");
    kopf.append(el("h3", "", titel(spiel)));
    kopf.append(el("span", "mini-karte-zahl", liste.length
      ? zahlWort(liste.length, "Spieler", "Spieler")
      : "noch frei"));
    karte.append(kopf);

    // Drei Zeilen, und auf Wunsch alle. Das stand einmal in einem Fenster,
    // das sich über die Seite legte – aber die Karte ist schon der Ort, an dem
    // die Liste steht, und eine Liste, die aufgeht, wo sie ohnehin ist, kostet
    // keinen zweiten Weg.
    const wirt = el("div", "mini-listen-wirt");
    let ganz = false;
    const zeichne = () => {
      wirt.innerHTML = "";
      wirt.append(listeBauen(liste, spiel, ganz ? {} : { max: 3 }));
    };
    zeichne();
    karte.append(wirt);

    const aktionen = el("div", "mini-karte-aktionen");
    aktionen.append(verweis("Spielen", spielLink(spiel), "mini-knopf-voll"));
    // Erst ab der vierten Zeile gibt es etwas aufzuklappen.
    if (liste.length > 3) {
      const mehr = knopf("Ganze Liste", "mini-knopf-still", () => {
        ganz = !ganz;
        zeichne();
        mehr.textContent = ganz ? "Nur die ersten drei" : "Ganze Liste";
      });
      aktionen.append(mehr);
    }
    karte.append(aktionen);
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

  function streifen(zahlen) {
    const wrap = el("div", "mini-streifen");
    zahlen.forEach(([wert, wort]) => {
      const kasten = el("div");
      kasten.append(el("strong", "", String(wert)), el("span", "", wort));
      wrap.append(kasten);
    });
    return wrap;
  }

  async function baueUebersicht(wirt) {
    wirt.innerHTML = "";

    // Kein Werbesatz und kein Vorspann: Wer hier ankommt, hat einen Link
    // angeklickt und weiss, warum. Was er sucht, sind die Spiele und die
    // Liste – der Name des Orts genügt darüber, und er ist zugleich die
    // Überschrift der Seite.
    const kopf = el("header", "mini-kopf");
    const text = el("div");
    // Nur "Mini-Games": Die Spiele stammen aus Gripszug, gehören aber nicht
    // mehr dorthin – eigene Adresse, eigene Datenbank, eigener Adminbereich.
    // Ein fremder Name im Titel versprach eine App, die es hier nicht gibt.
    text.append(el("h1", "mini-marke", "Mini-Games"));
    kopf.append(text);
    wirt.append(kopf);

    const laedt = el("p", "mini-hinweis", "Die Ergebnisse werden geladen...");
    wirt.append(laedt);

    const offen = await offeneSpiele();
    let alle = [];
    try { alle = await alleErgebnisse(offen, { neu: true }); }
    catch { laedt.textContent = "Die Ergebnisse sind gerade nicht zu haben. Probier es später noch einmal."; return; }

    laedt.remove();

    if (!offen.length) {
      wirt.append(el("p", "mini-hinweis", "Gerade ist kein Spiel freigegeben. Schau später wieder vorbei."));
      zeigeInstall(wirt);
      return;
    }

    // alle enthält nur die offenen Spiele (alleErgebnisse fragt gar nicht nach
    // anderen) – die Zahl oben zählt also dasselbe, was darunter als Karte und
    // als Spieler dasteht.
    const runden = alle.reduce((summe, eintrag) => summe + Math.max(1, Number(eintrag.versuche) || 1), 0);
    const personen = auswertung(alle, offen);
    wirt.append(streifen([
      [offen.length, offen.length === 1 ? "Spiel" : "Spiele"],
      [personen.length, personen.length === 1 ? "Spieler" : "Spieler"],
      [runden, runden === 1 ? "Runde" : "Runden"],
    ]));

    const spieleBlock = el("section", "mini-block");
    spieleBlock.append(el("h2", "", "Die Spiele"));
    const karten = el("div", "mini-karten");
    offen.forEach((spiel) => {
      const liste = rangliste(alle.filter((eintrag) => eintrag.game === spiel));
      karten.append(spielKarte(spiel, liste));
    });
    spieleBlock.append(karten);
    wirt.append(spieleBlock);

    const leuteBlock = el("section", "mini-block");
    leuteBlock.append(el("h2", "", "Die Spieler"));
    leuteBlock.append(spielerTabelle(personen));
    wirt.append(leuteBlock);

    // Ganz unten, nach dem, wofür man gekommen ist: der Weg auf den
    // Startbildschirm. Oben stünde er im Weg.
    zeigeInstall(wirt);

  }

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
    spielId,
    spielLink,
    uebersichtLink,
    alleSpiele,
    offeneSpiele,
    naechsteSzene,
    name,
    setzeName,
    kennung,
    listeFuer,
    rangliste,
    startStand,
    auswertung,
    leiste,
    ergebnis,
    ergebnisSprache,
  };

  // Die Startseite baut sich selbst; auf einer Spielseite holt game-shell.js
  // ab, was es braucht, wenn es so weit ist.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", starteUebersicht);
  else starteUebersicht();
})();
