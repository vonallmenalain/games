/*
 * geist.js – Gegen wen man spielt.
 * ---------------------------------------------------------------------------
 * Allein spielt man gegen die Uhr. Packender ist es gegen jemanden: gegen den,
 * der auf Platz 1 steht, und gegen sich selbst, so gut man schon einmal war.
 * Diese Datei holt beide auf die Bühne – als kleine Schalter über der
 * Spielfläche, die zugleich zeigen, wo man gegen sie steht. In den Spielen,
 * in denen die Gegner als Geist im Bild mitfliegen (Lianenschwung,
 * Tunnelflug, Drift-Rennen, Planetenhüpfer, Mondlandung, Schwerkraft-Läufer,
 * Hügelflieger), gibt es einen dritten: Alle – jeder, der in der Hall of
 * Fame steht, im Turnier jeder, der dort mitspielt. Ob die Welt dieselbe
 * ist, spielt keine Rolle: Der Geist fliegt seinen eigenen Weg.
 *
 * Zwei Arten, je nach Spiel:
 *
 *   tempo   Spiele mit fester Zeit (Blätter im Strom, Lianenschwung).
 *           Aufgezeichnet wird, wann jemand wie viele Punkte hatte; beim
 *           nächsten Mal läuft dieser Stand Viertelsekunde für Viertelsekunde
 *           mit. Wer vorne liegt, sieht es sofort, und wer überholt wird, auch.
 *           Der Lianenschwung zeichnet dazu den Weg auf (ort) und zeigt den
 *           Gegner als Geist im Bild – auf seiner festen Strecke an denselben
 *           Lianen.
 *           Ebenso die Spiele ohne Uhr, deren Gegner als Geist im Bild
 *           mitfliegen (Tunnelflug, Drift-Rennen, Planetenhüpfer,
 *           Mondlandung, Schwerkraft-Läufer): Ihr Lauf wird genauso
 *           aufgezeichnet, nur dauert er, solange er eben dauert.
 *   ziel    Spiele ohne Uhr, die beim ersten Fehler enden (Turmbau,
 *           Brückenbauer, Drehscheibe, Fischteich, Kacheln). Dort gibt es
 *           keinen Takt, nur eine Zahl: die Zielmarke. Der Turmbau zieht sie
 *           als Linie über den Turm.
 *
 * Wer auf Platz 1 steht, sagt die Hall of Fame – im Turnier dessen eigene
 * Liste. Die eigene Bestmarke kennt das Gerät: mini-games.js merkt sich den
 * Bestwert, diese Datei den besten Lauf dazu. Derselbe Name auf einem anderen
 * Gerät ist derselbe Spieler – war er dort besser, gilt das, mit dem Lauf von
 * dort (miniGeister). Was angezeigt wird, entscheidet
 * jeder selbst mit den Schaltern: Zu Beginn ist alles aus – das Spiel steht
 * allein da –, und ein Tipp auf einen Schalter blendet seinen Gegner ein. Die
 * Wahl gilt auf diesem Gerät für alle Spiele.
 *
 * Im Turnier kann der Admin beides abschalten (ohneGeist), und eine
 * verdeckte Rangliste verrät auch hier nicht, wer vorne liegt.
 *
 * Woher die Aufzeichnung des Gegners kommt:
 *
 *   Hall of Fame   miniGeister (cloud.js), geschrieben bei jedem Rekord
 *                  (mini-games.js, melde)
 *   Turnier        miniTurniere/<id>/geister, der beste Lauf jedes Spielers
 *                  in diesem Turnier (turnier.js, ergebnis)
 *   eigene         localStorage – auch ohne Namen und ohne Netz; war ein
 *                  anderes Gerät unter demselben Namen besser, miniGeister
 *
 * Gibt es zum Gegner keine Aufzeichnung (eine Bestzahl von früher), steht er
 * als Zielmarke da: seine Zahl, ohne Takt.
 *
 * Zuschauen: Der beste Lauf jedes Spielers in der Hall of Fame und in einem
 * Turnier lässt sich ganz anschauen (der ▶ in der Liste, mini-games.js). Die
 * Spielseite kommt dann mit ?zuschauen=<spieler> (und &aus=<turnier>) und
 * spielt den Lauf in seiner eigenen Welt ab: Die Aufzeichnung trägt die Saat,
 * mit der die Welt gewürfelt war (zufall.js), und das Spiel stellt seine Figur
 * Bild für Bild dorthin, wo sie damals war (zuschauer).
 *
 * Die Spiele ohne Figur im Bild (Turmbau, Brückenbauer, Heizer …) zeichnen
 * dafür ihre Züge auf (zuege): dieselben, die sie im Multiplayer melden
 * (live-spiel.js, zug), mit der Zeit seit dem Start. Beim Anschauen baut das
 * Spiel sie nach – genau so, wie es im Multiplayer dem zuschaut, der noch
 * spielt.
 */
(() => {
  "use strict";

  const mini = () => window.LernappMini || null;
  const cloud = () => window.MiniCloud || null;
  const kids = () => window.LernappKids || null;
  // Das Turnier, aber nur, wenn diese Seite in einem gespielt wird.
  const turnier = () => (window.LernappTurnier?.aufSpielseite?.() ? window.LernappTurnier : null);
  // Eine Runde eines Live-Abends (live-spiel.js): Dort spielt man gegen die,
  // die gerade mitspielen – die Schalter für Platz 1 und Bestmarke stehen
  // nicht da, und wo die eigene Figur ist, geht an den Live-Abend.
  const live = () => (window.LernappLiveSpiel?.aktiv?.() ? window.LernappLiveSpiel : null);
  // Wer im Turnier zuschaut, bekommt Ort und Züge der laufenden Runde
  // (turnier.js, mitschauenSender) – nur dort, wo das erlaubt ist, sonst null.
  const sender = () => window.LernappTurnier?.mitschauenSender?.() || null;

  // Die Fassung der Aufzeichnung. Ändert sich, was in einer steht, zählt sie
  // hoch – und die alten verschwinden von selbst aus dem Bild (cloud.js,
  // geister fragt nach genau dieser Fassung).
  const LEVEL = "t1";
  // Zehn Proben je Sekunde. Mit vier (bis Oktober 2026) lief die Wiedergabe
  // eckig: Zwischen zwei Proben lag eine Viertelsekunde gerader Strich, über
  // einen Hügel hinweg eine Sehne statt des Bogens.
  const TAKT_MS = 100;
  // Sechs Minuten. Die Runden mit Uhr dauern höchstens zwei; die ohne Uhr
  // (Mondlandung, Schwerkraft-Läufer …) auch bei den Besten selten länger.
  // Was zu lang für die Datenbank ist, verdichtet packe().
  const PROBEN_MAX = 3600;
  const BAHN_MAX = 12000;
  // Über wie viel Zeit je Seite die Beschleunigung beim Zuschauen geschätzt
  // wird (stand, ab) – für Spiele, die zeigen wollen, wann ein Triebwerk
  // brannte. Länger als der Takt, sonst zitterte sie.
  const AB_MS = 250;
  // Wie weit die Kurve hinter der letzten Probe in ihrer Richtung weitergeht,
  // wenn die nächste noch fehlt (nur im Multiplayer, live-spiel.js).
  const VORAUS_MS = 250;
  // Bis Oktober 2026 «mini.gegner», mit allem an, bis jemand abschaltete. Der
  // neue Name lässt alle neu beginnen: alles aus.
  const WAHL_KEY = "mini.geister";
  const LAUF_KEY = "mini.lauf";
  // Gold für Platz 1, Hellblau für die eigene Bestmarke, Flieder für alle
  // anderen – im Bild der Spiele dieselben Farben wie auf den Schaltern.
  const FARBE = { erster: "#ffd23f", eigen: "#8fd3ff", alle: "#d9c7ff" };
  // So viele Geister höchstens unter «Alle» – mehr sähe niemand mehr.
  const ALLE_MAX = 20;
  // Die Züge eines Laufs (zuege): höchstens so viele. Die Lage dazwischen (die
  // Lok im Zahlengleis, während sie geschoben wird) höchstens fünfmal je
  // Sekunde – sie ist Zierde, die Züge sind der Lauf.
  const ZUEGE_MAX = 4000;
  const LAGE_MS = 200;

  const clamp = (wert, min, max) => Math.max(min, Math.min(max, wert));

  function el(tag, klasse, text) {
    const knoten = document.createElement(tag);
    if (klasse) knoten.className = klasse;
    if (text !== undefined) knoten.textContent = text;
    return knoten;
  }

  function zeichen(pfad, klasse) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", klasse);
    const weg = document.createElementNS(NS, "path");
    weg.setAttribute("d", pfad);
    svg.append(weg);
    return svg;
  }
  const KRONE = "M3 18.5h18l-1.6-10.2-4.6 4.3L12 5l-2.8 7.6-4.6-4.3z";
  const STERN = "M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z";
  const HAKEN = "M5 12.5l4.5 4.5L19 7.5";
  const LEUTE = "M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm7.5 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2zm14.5 0c0-2-.6-3.8-1.7-5.1.5-.1 1-.2 1.6-.2 3 0 5.1 2.2 5.1 5.3z";

  // Etwas, das scheitern darf, ohne die Runde mitzunehmen.
  const vielleicht = (frage) => Promise.resolve().then(frage).catch((fehler) => {
    console.warn("Der Gegner war nicht zu haben", fehler);
    return null;
  });

  // ---------------------------------------------------------------------------
  // Auf dem Gerät: die Wahl und der eigene beste Lauf
  // ---------------------------------------------------------------------------
  function liesJson(schluessel) {
    try {
      const roh = JSON.parse(localStorage.getItem(schluessel) || "null");
      return roh && typeof roh === "object" ? roh : {};
    } catch { return {}; }
  }

  function schreibeJson(schluessel, wert) {
    try { localStorage.setItem(schluessel, JSON.stringify(wert)); } catch { /* privater Modus */ }
  }

  // Alle aus, bis jemand einen einschaltet.
  function wahl() {
    const w = liesJson(WAHL_KEY);
    return { erster: w.erster === true, eigen: w.eigen === true, alle: w.alle === true };
  }

  function setzeWahl(art, an) {
    const w = wahl();
    w[art] = Boolean(an);
    schreibeJson(WAHL_KEY, w);
  }

  // Der eigene beste Lauf: die Zahl, und in Spielen mit Uhr die Aufzeichnung
  // dazu (sonst leer). Er steht auf dem Gerät, auch wenn nie ein Name
  // eingetragen wurde – dann kennt ihn mini-games.js nicht. Ein Lauf aus
  // einer anderen Fassung des Spiels zählt nicht: Seine Zahl hiess damals
  // etwas anderes.
  //
  // Und einer, der höher ist als das, was der Server für dieses Gerät kennt
  // (mini-games.js, gleicheAb), ist keiner mehr: Der Admin hat den Eintrag
  // gelöscht. Nur ein Lauf, der schon vor dieser Auskunft dastand – einer von
  // eben, dessen Zahl noch unterwegs ist, bleibt.
  function eigenerLauf(spiel, fassung = LEVEL) {
    const alle = liesJson(LAUF_KEY);
    const lauf = alle[spiel];
    const punkte = Math.round(Number(lauf?.punkte) || 0);
    if (!(punkte > 0) || (lauf.level || LEVEL) !== fassung) return null;
    const server = mini()?.bestwertAbgeglichen?.(spiel);
    if (server && punkte > server.punkte && (Number(lauf.ms) || 0) <= server.ms) {
      delete alle[spiel];
      schreibeJson(LAUF_KEY, alle);
      return null;
    }
    return { punkte, bahn: typeof lauf.bahn === "string" ? lauf.bahn : "" };
  }

  function merkeLauf(spiel, punkte, bahn, fassung = LEVEL) {
    const alle = liesJson(LAUF_KEY);
    alle[spiel] = { punkte, bahn, level: fassung, ms: Date.now() };
    schreibeJson(LAUF_KEY, alle);
  }

  // ---------------------------------------------------------------------------
  // Die Aufzeichnung
  // ---------------------------------------------------------------------------
  // Alle TAKT_MS eine Probe: die Punkte und, wo das Spiel einen Geist zeigt,
  // wo er war (a, b, c – was das heisst, weiss das Spiel; c ist eine ganze
  // Zahl, ein Zustand oder ein Winkel mal 100). Geschrieben wird sie als
  // JSON, ganze Zahlen, jede Liste als Schritte: die erste Zahl, dann je der
  // Unterschied zur vorigen – so passen zehn Proben je Sekunde in die
  // Datenbank:
  //
  //   {"v":2,"dt":100,"p":[0,0,1,…],"a":[0,31,30,…],"b":[…],"c":[…],"s":123456789}
  //
  // v 1 (bis Oktober 2026) schrieb die Zahlen selbst; entpacke liest beides.
  // s ist die Saat der Welt (zufall.js) – damit lässt sich der Lauf später
  // in derselben Welt anschauen. u ist, wo die Uhr des Spiels stand, als die
  // Runde begann (in ms) – für Welten, die sich mit der Zeit bewegen
  // (Planetenhüpfer).
  function neueAufzeichnung() {
    return { p: [], a: [], b: [], c: [], ort: false, mitC: false, vor: null };
  }

  /*
   * Bis zur Zeit ms auffüllen. Eine Probe gehört genau auf ihren Takt (k ×
   * TAKT_MS), ein Bild kommt aber, wann es kommt: Der Ort dort wird zwischen
   * dem vorigen Bild und diesem gerechnet. Ohne das läge jede Probe bis zu
   * ein Bild daneben, und die Wiedergabe holperte im Takt der Bilder.
   */
  function probe(auf, ms, punkte, ort) {
    const soll = Math.min(PROBEN_MAX, Math.floor(Math.max(0, ms) / TAKT_MS) + 1);
    if (ort) auf.ort = true;
    if (ort && ort.c !== undefined) auf.mitC = true;
    const letzte = (liste) => (liste.length ? liste[liste.length - 1] : 0);
    const jetzt = ort ? { a: Number(ort.a) || 0, b: Number(ort.b) || 0, c: Number(ort.c) || 0 } : null;
    const vor = auf.vor;
    while (auf.p.length < soll) {
      const tk = auf.p.length * TAKT_MS;
      let o = jetzt;
      if (jetzt && vor?.ort && ms > vor.ms && tk > vor.ms) {
        const f = Math.min(1, (tk - vor.ms) / (ms - vor.ms));
        o = { a: vor.ort.a + (jetzt.a - vor.ort.a) * f, b: vor.ort.b + (jetzt.b - vor.ort.b) * f, c: f < 0.5 ? vor.ort.c : jetzt.c };
      }
      auf.p.push(Math.max(0, Math.round(punkte)));
      auf.a.push(o ? Math.round(o.a) : letzte(auf.a));
      auf.b.push(o ? Math.round(o.b) : letzte(auf.b));
      auf.c.push(o ? Math.round(o.c) : letzte(auf.c));
    }
    if (ms >= (vor?.ms ?? -1)) auf.vor = { ms, ort: jetzt || vor?.ort || null };
  }

  // Eine Liste als Schritte (v 2) – und zurück.
  const schritte = (liste) => liste.map((x, i) => (i ? x - liste[i - 1] : x));
  const summen = (liste) => {
    let summe = 0;
    return liste.map((x) => { summe += x; return summe; });
  };

  // Zu lang für die Datenbank? Dann jede zweite Probe, mit doppeltem Takt –
  // die letzte bleibt, was sie war: das Ergebnis.
  function packe(auf, saat = null, vorlauf = null) {
    const ende = auf.p[auf.p.length - 1];
    let dt = TAKT_MS;
    let p = auf.p;
    let a = auf.ort ? auf.a : null;
    let b = auf.ort ? auf.b : null;
    let c = auf.ort && auf.mitC ? auf.c : null;
    for (let versuch = 0; versuch < 6 && p.length; versuch += 1) {
      const daten = { v: 2, dt, p: schritte(p) };
      if (a) Object.assign(daten, { a: schritte(a), b: schritte(b) });
      if (c) daten.c = schritte(c);
      if (saat !== null && saat !== undefined) daten.s = saat;
      if (vorlauf !== null && vorlauf !== undefined) daten.u = Math.max(0, Math.round(vorlauf));
      const text = JSON.stringify(daten);
      if (text.length <= BAHN_MAX) return text;
      const halb = (liste) => liste.filter((_, i) => i % 2 === 0);
      dt *= 2;
      p = halb(p);
      p[p.length - 1] = ende;
      if (a) { a = halb(a); b = halb(b); }
      if (c) c = halb(c);
    }
    return "";
  }

  function entpacke(bahn) {
    let d = null;
    try { d = JSON.parse(String(bahn || "")); } catch { return null; }
    if (!d || (d.v !== 1 && d.v !== 2) || !Array.isArray(d.p) || !d.p.length) return null;
    const zahl = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
    const lies = (liste) => (d.v === 2 ? summen(liste.map(zahl)) : liste.map(zahl));
    const p = lies(d.p);
    const mitOrt = Array.isArray(d.a) && Array.isArray(d.b) && d.a.length === p.length && d.b.length === p.length;
    const mitC = mitOrt && Array.isArray(d.c) && d.c.length === p.length;
    return {
      dt: Number(d.dt) > 0 ? Number(d.dt) : TAKT_MS,
      p,
      a: mitOrt ? lies(d.a) : null,
      b: mitOrt ? lies(d.b) : null,
      c: mitC ? lies(d.c) : null,
      s: Number.isInteger(d.s) && d.s >= 0 ? d.s : null,
      u: Number.isFinite(d.u) && d.u >= 0 ? d.u : 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Die Züge
  // ---------------------------------------------------------------------------
  /*
   * In den Spielen ohne Figur im Bild gibt es keinen Ort, der sich zehnmal je
   * Sekunde aufzeichnen liesse – dort geschieht etwas, wenn jemand tippt: Ein
   * Block fällt, ein Balken kippt, Kohle kommt in den Kessel. Aufgezeichnet
   * werden deshalb die Züge, in derselben Sprache wie im Multiplayer
   * (live-spiel.js, zug: a, b, c in der Sprache des Spiels, p die Punkte),
   * dazu t, die Zeit seit dem Start in ms. Jede Spalte als Schritte, und
   * eine, die überall null ist, fehlt:
   *
   *   {"v":3,"s":123456789,"e":48210,"z":{"t":[0,412,…],"a":[…],"c":[…],"p":[…]}}
   *
   * e ist, wann die Runde zu Ende war – nach dem letzten Zug geschieht oft
   * noch etwas (der Block fällt, der Arbeiter geht über den Balken und
   * stürzt), und erst danach kommt beim Anschauen die Tafel.
   *
   * Hat das Spiel daneben einen Lauf mit Uhr (Blätter im Strom), steht z
   * mit in dessen Aufzeichnung (v 2) – die Gegner lesen ihn wie bisher.
   */
  const ZUG_SPALTEN = ["t", "a", "b", "c", "p"];
  const ganzeZahl = (x) => (Number.isFinite(Number(x)) ? Math.round(Number(x)) : 0);

  // Zu lang für die Datenbank? Dann jede zweite Lage weniger – die Züge
  // bleiben alle, ohne sie liesse sich der Lauf nicht nachbauen.
  function packeZuege(basis, liste) {
    let auswahl = liste;
    for (let versuch = 0; versuch < 10 && auswahl.length; versuch += 1) {
      const z = {};
      ZUG_SPALTEN.forEach((k) => {
        const werte = auswahl.map((e) => e[k]);
        if (k === "t" || werte.some((x) => x !== 0)) z[k] = schritte(werte);
      });
      const text = JSON.stringify({ ...basis, z });
      if (text.length <= BAHN_MAX) return text;
      let n = 0;
      const vorher = auswahl.length;
      auswahl = auswahl.filter((e) => !e.lage || (n += 1) % 2 === 0);
      if (auswahl.length === vorher) break;
    }
    return "";
  }

  function entpackeZuege(bahn) {
    let d = null;
    try { d = JSON.parse(String(bahn || "")); } catch { return null; }
    const z = d?.z;
    if (!z || !Array.isArray(z.t) || !z.t.length) return null;
    const n = z.t.length;
    const spalte = (k) => (Array.isArray(z[k]) && z[k].length === n ? summen(z[k].map(ganzeZahl)) : new Array(n).fill(0));
    const [t, a, b, c, p] = ZUG_SPALTEN.map(spalte);
    return {
      proben: t.map((zeit, i) => ({ t: zeit, a: a[i], b: b[i], c: c[i], p: p[i] })),
      s: Number.isInteger(d.s) && d.s >= 0 ? d.s : null,
      e: Number.isFinite(d.e) && d.e >= 0 ? d.e : 0,
    };
  }

  /*
   * Ein Lauf aus Zügen zum Abspielen – dieselben Fragen, die ein Spiel im
   * Multiplayer an den stellt, dem es zuschaut (live-spiel.js, quelle):
   * seine Züge seit t0 bis einschliesslich bis, der letzte bis dahin und der
   * nächste danach.
   */
  function zugAbspieler(bahn) {
    const d = entpackeZuege(bahn);
    if (!d) return null;
    const { proben } = d;
    const dauer = Math.max(proben[proben.length - 1].t, d.e);
    // Der erste Zug nach t – gesucht, nicht gezählt.
    const nach = (t) => {
      let lo = 0;
      let hi = proben.length;
      while (lo < hi) {
        const mitte = (lo + hi) >> 1;
        if (proben[mitte].t <= t) lo = mitte + 1; else hi = mitte;
      }
      return lo;
    };
    return {
      zuege: true,
      saat: d.s,
      dauer,
      seit: (t0, bis) => proben.slice(nach(t0), nach(bis)),
      letzte: (bis) => proben[nach(bis) - 1] || null,
      naechste: (bis) => proben[nach(bis)] || null,
      wert: (ms) => proben[nach(ms) - 1]?.p || 0,
      fertig: (ms) => ms > dauer,
    };
  }

  /*
   * Die Aufzeichnung der Züge, für ein Spiel ohne Figur im Bild:
   *
   *   const aufnahme = LernappGeist.zuege({ fassung: "z1", zufall });
   *
   *   aufnahme.los()            wenn die Runde wirklich beginnt
   *   aufnahme.zug(p, ort)      bei jedem Zug, mit dem ganzen Stand
   *                             ({ a, b, c } – dasselbe wie live.zug)
   *   aufnahme.lage(p, ort)     dazwischen, wo es etwas zu sehen gibt (höchstens
   *                             alle LAGE_MS)
   *   aufnahme.ende(geist)      am Schluss; gibt die Aufzeichnung für
   *                             showResult zurück. geist: der Lauf mit Uhr,
   *                             falls das Spiel auch einen hat – die Züge
   *                             kommen dann dazu.
   *
   * Gespeichert wird sie wie jeder Lauf (mini-games.js, melde): beim Rekord.
   */
  function zuege({ fassung = "z1", zufall = null } = {}) {
    const z = { t0: 0, laeuft: false, liste: [], lageMs: -Infinity, zuletzt: "" };

    function merke(punkte, ort, lage) {
      if (!z.laeuft || !ort || z.liste.length >= ZUEGE_MAX) return;
      const neu = { t: Math.max(0, Math.round(performance.now() - z.t0)), a: ganzeZahl(ort.a), b: ganzeZahl(ort.b), c: ganzeZahl(ort.c), p: ganzeZahl(punkte), lage };
      const schluessel = `${neu.a}|${neu.b}|${neu.c}|${neu.p}`;
      if (schluessel === z.zuletzt) return;
      // Zwei Züge in derselben Millisekunde: Der zweite kommt eine später –
      // beim Abspielen zählt jeder Zug genau einmal (seit, nach seiner Zeit).
      const vor = z.liste[z.liste.length - 1];
      if (vor && neu.t <= vor.t) neu.t = vor.t + 1;
      z.zuletzt = schluessel;
      z.liste.push(neu);
      sender()?.probe?.("z", neu.t, neu.p, neu, lage);
    }

    return {
      los() {
        z.t0 = performance.now();
        z.laeuft = true;
        z.liste = [];
        z.lageMs = -Infinity;
        z.zuletzt = "";
        sender()?.los?.("z", () => zufall?.saat?.() ?? null);
      },
      zug: (punkte, ort) => merke(punkte, ort, false),
      lage(punkte, ort) {
        const jetzt = performance.now();
        if (!z.laeuft || jetzt - z.lageMs < LAGE_MS) return;
        z.lageMs = jetzt;
        merke(punkte, ort, true);
      },
      ende(geist = null) {
        if (!z.laeuft) return geist;
        z.laeuft = false;
        sender()?.ende?.("z", Math.round(performance.now() - z.t0), z.liste[z.liste.length - 1]?.p || 0);
        if (!z.liste.length) return geist;
        let basis = { v: 3 };
        if (geist?.bahn) {
          try { basis = JSON.parse(geist.bahn); } catch { return geist; }
        }
        const saat = zufall?.saat?.();
        if (Number.isInteger(saat) && saat >= 0) basis.s = saat;
        basis.e = Math.max(0, Math.round(performance.now() - z.t0));
        const bahn = packeZuege(basis, z.liste);
        return bahn ? { level: geist?.level || fassung, bahn } : geist;
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Die Kurve durch die Proben
  // ---------------------------------------------------------------------------
  /*
   * Zwischen zwei Proben nicht ein gerader Strich, sondern ein Bogen: kubisch
   * (Hermite), mit der Steigung an jeder Probe aus ihren beiden Nachbarn. Die
   * Figur fährt so weich durch jede Probe, Richtung und Tempo knicken nicht.
   * An einer Umkehr (oben auf dem Hügel) ist die Steigung null – die Kurve
   * schiesst nie über eine Probe hinaus. Dieselbe Kurve für die Wiedergabe
   * und für die anderen im Multiplayer (live-spiel.js).
   *
   * proben: [{ t, a, b, c }], nach t aufsteigend. c springt, wenn es ein
   * Zustand ist (Ast, Schub …); ist es ein Winkel (winkel), dreht es mit –
   * ausser um mehr als eine Vierteldrehung zwischen zwei Proben, das ist ein
   * Sprung. Hinter der letzten Probe: stehen (fertig) oder ein Stück in
   * ihrer Richtung weiter.
   */
  function steigung(proben, i, k) {
    const p = proben[i];
    const vor = proben[i - 1];
    const nach = proben[i + 1];
    const d0 = vor ? (p[k] - vor[k]) / Math.max(1, p.t - vor.t) : null;
    const d1 = nach ? (nach[k] - p[k]) / Math.max(1, nach.t - p.t) : null;
    if (d0 === null) return d1 ?? 0;
    if (d1 === null) return d0;
    if (d0 * d1 <= 0) return 0;
    return (2 * d0 * d1) / (d0 + d1);
  }

  function hermite(p0, p1, m0, m1, h, s) {
    const s2 = s * s;
    const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * h * m0 + (3 * s2 - 2 * s3) * p1 + (s3 - s2) * h * m1;
  }

  function kurve(proben, ms, { fertig = true, winkel = false, voraus = VORAUS_MS } = {}) {
    if (!proben.length) return { a: 0, b: 0, c: 0 };
    const erste = proben[0];
    if (ms <= erste.t) return { a: erste.a, b: erste.b, c: erste.c };
    const n = proben.length;
    const letzte = proben[n - 1];
    if (ms >= letzte.t) {
      if (fertig || n < 2) return { a: letzte.a, b: letzte.b, c: letzte.c };
      const weiter = Math.min(ms - letzte.t, voraus);
      return { a: letzte.a + steigung(proben, n - 1, "a") * weiter, b: letzte.b + steigung(proben, n - 1, "b") * weiter, c: letzte.c };
    }
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mitte = (lo + hi) >> 1;
      if (proben[mitte].t <= ms) lo = mitte; else hi = mitte;
    }
    const s0 = proben[lo];
    const s1 = proben[hi];
    const h = Math.max(1, s1.t - s0.t);
    const s = (ms - s0.t) / h;
    const dc = s1.c - s0.c;
    return {
      a: hermite(s0.a, s1.a, steigung(proben, lo, "a"), steigung(proben, hi, "a"), h, s),
      b: hermite(s0.b, s1.b, steigung(proben, lo, "b"), steigung(proben, hi, "b"), h, s),
      c: winkel && Math.abs(dc) < 157 ? s0.c + dc * s : s < 0.5 ? s0.c : s1.c,
    };
  }

  // Ob c in diesem Spiel ein Winkel ist (mini-games.js, ANSEHBAR).
  const cIstWinkel = (spiel) => Boolean(mini()?.ANSEHBAR?.[spiel]?.winkel);

  // Ein Lauf zum Abspielen: Punkte und Ort zu jeder Zeit, auf der Kurve durch
  // seine Proben. Nach seinem Ende bleibt er stehen, wo er aufgehört hat.
  function abspieler(bahn, { winkel = false } = {}) {
    const d = entpacke(bahn);
    if (!d) return null;
    const n = d.p.length;
    const dauer = (n - 1) * d.dt;
    const proben = d.a ? d.p.map((_, i) => ({ t: i * d.dt, a: d.a[i], b: d.b[i], c: d.c ? d.c[i] : 0 })) : null;
    return {
      dauer,
      saat: d.s,
      vorlauf: d.u,
      mitOrt: Boolean(d.a),
      wert: (ms) => d.p[Math.min(n - 1, Math.floor(Math.max(0, ms) / d.dt))],
      ort: (ms) => (proben ? kurve(proben, ms, { winkel }) : null),
      fertig: (ms) => ms > dauer,
    };
  }

  // ---------------------------------------------------------------------------
  // Wer die Gegner sind
  // ---------------------------------------------------------------------------
  // stand: { aus, erster, eigen, alle, grund }
  //   aus     im Turnier abgeschaltet – dann gibt es keine Schalter
  //   erster  { name, punkte, lauf, ich, spieler } oder null
  //   eigen   { punkte, lauf } oder null
  //   alle    [{ name, punkte, lauf, spieler }] – die anderen, mit Lauf
  //   grund   warum es keinen ersten gibt: "verdeckt", "frei"
  //
  // mitAllen: das Spiel zeigt die Gegner als Geist im Bild und will alle.
  async function ladeStand(spiel, art, lage, fassung, mitAllen = false) {
    const stand = { aus: false, erster: null, eigen: null, alle: [], grund: "frei" };
    const t = lage?.t || null;
    if (t?.ohneGeist) { stand.aus = true; return stand; }

    // Erst mit dem Server abgleichen: Ein gelöschter Eintrag nimmt die
    // Bestmarke auf dem Gerät mit.
    await vielleicht(() => mini()?.gleicheAb?.(spiel));
    const lokal = eigenerLauf(spiel, fassung);
    const best = Math.max(Math.round(Number(mini()?.bestwert?.(spiel)) || 0), lokal?.punkte || 0);
    if (best > 0) {
      let lauf = art === "tempo" && lokal?.bahn && lokal.punkte === best ? abspieler(lokal.bahn, { winkel: cIstWinkel(spiel) }) : null;
      // Stammt die Bestmarke nicht von diesem Gerät – ein anderes unter
      // demselben Namen war besser, oder der Speicher hier ist neu –, liegt
      // ihr Lauf dort, wo er hinterlegt wurde (mini-games.js, gleicheAb).
      const server = mini()?.bestwertAbgeglichen?.(spiel);
      if (!lauf && art === "tempo" && server?.spieler && server.punkte === best) {
        const [geist] = (await vielleicht(() => cloud()?.geister?.(spiel, [server.spieler], fassung))) || [];
        if (geist?.bahn && geist.punkte === best) lauf = abspieler(geist.bahn, { winkel: cIstWinkel(spiel) });
      }
      stand.eigen = { punkte: best, lauf };
    }

    if (t) {
      // Verdeckt heisst verdeckt: Wer vorne liegt, steht erst am Schluss da.
      if (t.verdeckt && turnier()?.lage?.(t) !== "beendet") { stand.grund = "verdeckt"; return stand; }
      const alle = await vielleicht(() => cloud()?.turnierErgebnisse?.(lage.id, { game: spiel }));
      const liste = mini()?.rangliste?.((alle || []).filter((e) => e.game === spiel)) || [];
      // Alle, die in diesem Turnier mitspielen – mit ihrem besten Lauf hier.
      if (mitAllen) {
        const andere = liste.filter((e) => e.spieler && !e.eigen && e.punkte > 0).slice(0, ALLE_MAX);
        const laeufe = await Promise.all(andere.map((e) => vielleicht(() => cloud()?.turnierGeist?.(lage.id, spiel, e.spieler))));
        andere.forEach((e, i) => {
          const geist = laeufe[i];
          const lauf = geist?.bahn && geist.level === fassung ? abspieler(geist.bahn, { winkel: cIstWinkel(spiel) }) : null;
          if (lauf) stand.alle.push({ name: e.name, punkte: geist.punkte, lauf, spieler: e.spieler });
        });
      }
      const vorne = liste[0];
      if (!vorne || !(vorne.punkte > 0)) return stand;
      const geist = art === "tempo" && vorne.spieler
        ? await vielleicht(() => cloud()?.turnierGeist?.(lage.id, spiel, vorne.spieler))
        : null;
      const passt = geist?.bahn && geist.level === fassung;
      // Zählen alle Versuche zusammen, ist die Zahl in der Liste eine Summe –
      // gegen die lässt sich keine einzelne Runde spielen. Dann gilt sein
      // bester einzelner Lauf, und ohne Aufzeichnung gibt es keinen.
      if (t.zaehlt === "summe") {
        if (passt) stand.erster = { name: vorne.name, punkte: geist.punkte, lauf: abspieler(geist.bahn, { winkel: cIstWinkel(spiel) }), ich: Boolean(vorne.eigen), spieler: vorne.spieler };
        return stand;
      }
      stand.erster = {
        name: vorne.name,
        punkte: vorne.punkte,
        lauf: passt && geist.punkte === vorne.punkte ? abspieler(geist.bahn, { winkel: cIstWinkel(spiel) }) : null,
        ich: Boolean(vorne.eigen),
        spieler: vorne.spieler,
      };
      return stand;
    }

    const liste = (await vielleicht(() => mini()?.listeFuer?.(spiel))) || [];
    const vorne = liste[0];
    // Für Platz 1 und, wenn das Spiel sie will, für alle anderen: die Läufe
    // in einer Runde gelesen.
    const fragen = [];
    if (art === "tempo" && vorne?.spieler && vorne.punkte > 0) fragen.push(vorne.spieler);
    const andere = mitAllen ? liste.filter((e) => e.spieler && !e.eigen && e.punkte > 0).slice(0, ALLE_MAX) : [];
    andere.forEach((e) => { if (!fragen.includes(e.spieler)) fragen.push(e.spieler); });
    const gefunden = fragen.length ? ((await vielleicht(() => cloud()?.geister?.(spiel, fragen, fassung))) || []) : [];
    const nachSpieler = new Map(gefunden.map((g) => [g.spieler, g]));
    andere.forEach((e) => {
      const geist = nachSpieler.get(e.spieler);
      if (geist?.bahn) stand.alle.push({ name: e.name, punkte: geist.punkte, lauf: abspieler(geist.bahn, { winkel: cIstWinkel(spiel) }), spieler: e.spieler });
    });
    stand.alle = stand.alle.filter((g) => g.lauf);
    if (!vorne || !(vorne.punkte > 0)) return stand;
    let lauf = null;
    const geist = nachSpieler.get(vorne.spieler);
    // Nur der Lauf, der zu dieser Zahl gehört. Trägt jemand denselben Namen
    // auf zwei Geräten, kann die Aufzeichnung vom anderen stammen.
    if (art === "tempo" && geist?.bahn && geist.punkte === vorne.punkte) lauf = abspieler(geist.bahn, { winkel: cIstWinkel(spiel) });
    stand.erster = { name: vorne.name, punkte: vorne.punkte, lauf, ich: Boolean(vorne.eigen), spieler: vorne.spieler };
    return stand;
  }

  // ---------------------------------------------------------------------------
  // Für ein Spiel
  // ---------------------------------------------------------------------------
  /*
   * Ein Spiel meldet sich einmal an, gleich nach game-shell.js:
   *
   *   const gegner = LernappGeist?.fuer({ spiel: "vineSwing", host, art: "tempo" });
   *
   * fassung gibt die Fassung der Aufzeichnung an (Vorgabe LEVEL). Ändert ein
   * Spiel, was seine Zahl bedeutet oder was es aufzeichnet, bekommt es eine
   * neue – dann laufen alte Läufe nicht mehr gegen neue.
   *
   * und ruft dann:
   *
   *   gegner.runde()        bei jedem Neustart, noch vor dem ersten Zug
   *   gegner.los()          wenn die Runde wirklich beginnt
   *   gegner.takt(p, ort)   wann immer es will – mit den Punkten und, für einen
   *                         Geist im Bild, dem Ort ({ a, b })
   *   gegner.ende(p)        am Schluss; gibt die Aufzeichnung für showResult
   *                         zurück (nur bei tempo)
   *   gegner.gegner()       wer gerade angezeigt wird, für das Bild
   *   gegner.zeit()         wie lange die Runde schon läuft, in ms
   */
  function fuer({ spiel, host, art = "ziel", fassung = LEVEL, alle: mitAllen = false, zufall = null, gleichschritt = false, vorlauf = null }) {
    if (!spiel || !host) return null;
    const ARTEN = mitAllen ? ["erster", "eigen", "alle"] : ["erster", "eigen"];

    const z = {
      stand: null,
      ladung: 0,
      laeuft: false,
      t0: 0,
      endeMs: 0,
      punkte: 0,
      ort: null,
      auf: neueAufzeichnung(),
      vorne: {},
      geschlagen: {},
      meldungBis: {},
      zuletzt: {},
      ticker: null,
    };

    // --- Die Schalter --------------------------------------------------------
    const leiste = el("div", "gs-leiste");
    leiste.setAttribute("role", "group");
    leiste.setAttribute("aria-label", "Gegner anzeigen");
    leiste.hidden = true;

    function baueSchalter(welche, titel, pfad) {
      const knopf = el("button", `gs-chip gs-${welche}`);
      knopf.type = "button";
      const haken = el("span", "gs-haken");
      haken.append(zeichen(HAKEN, "gs-haken-zeichen"));
      const name = el("span", "gs-name");
      const wert = el("span", "gs-wert");
      knopf.append(haken, zeichen(pfad, "gs-zeichen"), el("span", "gs-titel", titel), name, wert);
      knopf.addEventListener("click", (ereignis) => {
        setzeWahl(welche, !wahl()[welche]);
        zeichne();
        // Mit Finger oder Maus: Der Knopf gibt den Fokus wieder ab, sonst
        // gehörte die Leertaste ihm statt dem Spiel. Mit der Tastatur bleibt
        // er, wo er ist.
        if (ereignis.detail > 0) knopf.blur();
      });
      return { knopf, name, wert, titel };
    }

    const schalter = {
      erster: baueSchalter("erster", "Platz 1", KRONE),
      eigen: baueSchalter("eigen", "Bestmarke", STERN),
    };
    leiste.append(schalter.erster.knopf, schalter.eigen.knopf);
    if (mitAllen) {
      schalter.alle = baueSchalter("alle", "Alle", LEUTE);
      leiste.append(schalter.alle.knopf);
      leiste.dataset.drei = "";
    }
    host.insertBefore(leiste, host.querySelector(".cm-play"));

    // Im Live-Modus gilt die Uhr des Abends – für die eigene Aufzeichnung
    // dieselbe Zahl, und für die Geister läuft sie auch nach dem eigenen Ende
    // weiter (live-spiel.js, geistZeit).
    const zeit = () => (live() ? live().geistZeit() : z.laeuft ? performance.now() - z.t0 : z.endeMs);

    function gegnerVon(welche) {
      if (welche === "alle") return null;
      const g = z.stand?.[welche];
      if (!g) return null;
      return { ...g, name: welche === "eigen" ? "Bestmarke" : g.ich ? "du" : g.name };
    }

    // Unter «Alle»: wer gerade mitläuft. Platz 1 nicht doppelt, wenn er
    // schon als Platz 1 mitläuft.
    function alleAndern() {
      const s = z.stand;
      if (!s?.alle?.length) return [];
      const erster = wahl().erster && s.erster?.lauf ? s.erster.spieler : null;
      return s.alle.filter((g) => g.spieler !== erster);
    }

    // Der eigene Platz unter allen: wie viele haben zu dieser Zeit mehr.
    function rangUnterAllen(ms) {
      const andere = z.stand?.alle || [];
      const vor = andere.filter((g) => g.lauf.wert(ms) > z.punkte).length;
      return { rang: vor + 1, von: andere.length + 1 };
    }

    // Was der Gegner zu dieser Zeit hatte: mit Aufzeichnung sein Stand von
    // damals, ohne seine Zahl vom Schluss.
    const wertBei = (g, ms) => (g.lauf ? g.lauf.wert(ms) : g.punkte);
    const gespielt = () => z.laeuft || z.endeMs > 0;

    function setze(knoten, text) {
      if (knoten.textContent !== text) knoten.textContent = text;
    }

    function zeichne() {
      const s = z.stand;
      // Im Turnier erst, wenn feststeht, ob es Gegner zeigen will – sonst
      // stünden die Schalter kurz da und verschwänden wieder. Im Live-Modus
      // nie: Dort stehen oben die, die gerade mitspielen (live-spiel.js).
      if (live() || s?.aus || (!s && turnier())) {
        leiste.hidden = true;
        delete host.dataset.gegner;
        return;
      }
      leiste.hidden = false;
      host.dataset.gegner = "an";
      const w = wahl();
      const ms = zeit();
      if (schalter.alle) zeichneAlle(s, w, ms);
      ARTEN.forEach((welche) => {
        if (welche === "alle") return;
        const c = schalter[welche];
        const g = gegnerVon(welche);
        const an = Boolean(g) && w[welche];
        c.knopf.disabled = !s || !g;
        c.knopf.classList.toggle("is-an", an);
        c.knopf.classList.toggle("ist-leer", Boolean(s) && !g);
        c.knopf.setAttribute("aria-pressed", String(an));
        if (!s || !g) {
          setze(c.name, "");
          setze(c.wert, !s ? "…" : welche === "eigen" ? "noch keine" : s.grund === "verdeckt" ? "verdeckt" : "noch frei");
          c.knopf.classList.remove("ist-vorne", "ist-geschlagen");
          c.knopf.title = welche === "eigen"
            ? "Deine Bestmarke – nach deiner ersten Runde steht sie hier."
            : s?.grund === "verdeckt" ? "Die Rangliste dieses Turniers bleibt bis zum Schluss verdeckt." : "Platz 1 – noch hat hier niemand gespielt.";
          return;
        }
        setze(c.name, welche === "erster" ? g.name : "");
        // Im Gleichschritt (alle gleich schnell) sagt der laufende Stand
        // nichts: Dort steht die Zahl vom Schluss.
        const soll = gespielt() && !gleichschritt ? wertBei(g, ms) : g.punkte;
        if (Date.now() >= (z.meldungBis[welche] || 0)) setze(c.wert, String(soll));
        c.knopf.classList.toggle("ist-vorne", an && gespielt() && z.punkte > soll && !gleichschritt);
        c.knopf.classList.toggle("ist-geschlagen", an && Boolean(z.geschlagen[welche]));
        const wer = welche === "erster" ? `Platz 1: ${g.name}, ${g.punkte}` : `Deine Bestmarke: ${g.punkte}`;
        c.knopf.title = `${wer}${g.lauf ? " – läuft mit" : ""}. Antippen zum ${an ? "Ausblenden" : "Einblenden"}.`;
        c.knopf.setAttribute("aria-label", `${wer}. ${an ? "Wird angezeigt" : "Ausgeblendet"}.`);
      });
    }

    // Der Schalter «Alle»: wie viele mitlaufen, und während der Runde, auf
    // welchem Platz man unter ihnen liegt.
    function zeichneAlle(s, w, ms) {
      const c = schalter.alle;
      const n = s?.alle?.length || 0;
      const an = n > 0 && w.alle;
      c.knopf.disabled = !s || !n;
      c.knopf.classList.toggle("is-an", an);
      c.knopf.classList.toggle("ist-leer", Boolean(s) && !n);
      c.knopf.setAttribute("aria-pressed", String(an));
      setze(c.name, "");
      if (!s || !n) {
        setze(c.wert, !s ? "…" : s.grund === "verdeckt" ? "verdeckt" : "noch keine");
        c.knopf.classList.remove("ist-vorne");
        c.knopf.title = s?.grund === "verdeckt" ? "Die Rangliste dieses Turniers bleibt bis zum Schluss verdeckt." : "Alle anderen – noch hat niemand einen Lauf hinterlegt.";
        return;
      }
      const { rang, von } = rangUnterAllen(ms);
      if (Date.now() >= (z.meldungBis.alle || 0)) setze(c.wert, gespielt() && !gleichschritt ? `${rang}/${von}` : String(n));
      c.knopf.classList.toggle("ist-vorne", an && gespielt() && rang === 1 && !gleichschritt);
      const wer = `Alle anderen: ${n} ${n === 1 ? "Lauf" : "Läufe"}`;
      c.knopf.title = `${wer} – fliegen mit. Antippen zum ${an ? "Ausblenden" : "Einblenden"}.`;
      c.knopf.setAttribute("aria-label", `${wer}. ${an ? "Werden angezeigt" : "Ausgeblendet"}.`);
    }

    function melde(welche, text) {
      const c = schalter[welche];
      setze(c.wert, text);
      z.meldungBis[welche] = Date.now() + 1300;
      z.zuletzt[welche] = Date.now();
      c.knopf.classList.remove("is-pop");
      void c.knopf.offsetWidth;
      c.knopf.classList.add("is-pop");
    }

    // Überholt? Zweierlei: Wer mit Aufzeichnung mitläuft, kann man unterwegs
    // überholen – und wieder verlieren. Seine Zahl vom Schluss schlägt man
    // einmal, und das ist der Moment mit Ton.
    function pruefe() {
      const s = z.stand;
      if (!s || s.aus || !z.laeuft) return;
      const w = wahl();
      const ms = zeit();
      if (schalter.alle && w.alle && z.stand.alle?.length && !gleichschritt) {
        // Unter allen ein Platz nach vorn: kurz gemeldet.
        const { rang } = rangUnterAllen(ms);
        if (z.rangAlle && rang < z.rangAlle && ms > 1200 && Date.now() - (z.zuletzt.alle || 0) > 2500) melde("alle", `${rang}. Platz`);
        z.rangAlle = rang;
      }
      ARTEN.forEach((welche) => {
        if (welche === "alle") return;
        const g = gegnerVon(welche);
        if (!g || !w[welche]) return;
        const vorne = z.punkte > wertBei(g, ms);
        if (!z.geschlagen[welche] && z.punkte > g.punkte) {
          z.geschlagen[welche] = true;
          melde(welche, welche === "eigen" ? "Bestmarke!" : g.ich ? "Rekord!" : "geschlagen!");
          window.ArcadeKlang?.ton?.("ueberholt");
          kids()?.vibrate?.([12, 30, 12]);
        } else if (g.lauf && vorne && !z.vorne[welche] && ms > 1200 && !gleichschritt
          && Date.now() - (z.zuletzt[welche] || 0) > 2500) {
          melde(welche, "überholt!");
        }
        z.vorne[welche] = vorne;
      });
    }

    function stoppe() {
      if (z.ticker) { window.clearInterval(z.ticker); z.ticker = null; }
    }

    function tick() {
      if (!z.laeuft) return;
      probe(z.auf, zeit(), z.punkte, z.ort);
      pruefe();
      zeichne();
    }

    // Wer gegen wen: frisch bei jeder Runde, damit ein neuer Platz 1 auch
    // gleich als solcher dasteht. Im Turnier erst, wenn das Turnier gelesen
    // ist – vorher weiss niemand, ob es überhaupt Gegner zeigen will.
    function lade(nr, versuch) {
      if (live()) return;
      const t = turnier();
      const lage = t?.geistLage?.() || null;
      if (t && (!lage || !lage.geladen)) {
        if (versuch < 60) window.setTimeout(() => { if (nr === z.ladung) lade(nr, versuch + 1); }, 250);
        return;
      }
      ladeStand(spiel, art, lage?.t ? lage : null, fassung, mitAllen).then((stand) => {
        if (nr !== z.ladung) return;
        z.stand = stand;
        zeichne();
      });
    }

    function runde() {
      stoppe();
      z.laeuft = false;
      z.t0 = 0;
      z.endeMs = 0;
      z.punkte = 0;
      z.ort = null;
      z.auf = neueAufzeichnung();
      z.vorne = {};
      z.geschlagen = {};
      z.meldungBis = {};
      z.zuletzt = {};
      z.rangAlle = 0;
      z.ladung += 1;
      zeichne();
      lade(z.ladung, 0);
    }

    function los() {
      if (z.laeuft) return;
      z.laeuft = true;
      z.t0 = performance.now();
      z.vorlauf = vorlauf ? vorlauf() : null;
      z.endeMs = 0;
      if (art === "tempo") sender()?.los?.("o", () => zufall?.saat?.() ?? null);
      probe(z.auf, 0, z.punkte, z.ort);
      stoppe();
      z.ticker = window.setInterval(tick, 150);
      zeichne();
    }

    function takt(punkte, ort = null) {
      z.punkte = Math.max(0, Math.round(Number(punkte) || 0));
      if (ort) z.ort = ort;
      if (ort) live()?.lage?.(z.punkte, ort);
      if (!z.laeuft) return;
      if (ort && art === "tempo") sender()?.probe?.("o", zeit(), z.punkte, ort);
      probe(z.auf, zeit(), z.punkte, z.ort);
      pruefe();
    }

    function ende(punkte) {
      if (punkte !== undefined) z.punkte = Math.max(0, Math.round(Number(punkte) || 0));
      const lief = z.laeuft;
      const ms = zeit();
      if (lief) {
        probe(z.auf, ms, z.punkte, z.ort);
        z.auf.p[z.auf.p.length - 1] = z.punkte;
        pruefe();
      }
      z.laeuft = false;
      z.endeMs = Math.max(1, ms);
      stoppe();
      zeichne();
      if (!lief) return null;
      if (art === "tempo") sender()?.ende?.("o", ms, z.punkte);
      const bahn = art === "tempo" && z.auf.p.length ? packe(z.auf, zufall?.saat?.() ?? null, z.vorlauf) : "";
      // Der eigene beste Lauf bleibt auf dem Gerät – auch ohne Namen, auch
      // ohne Netz.
      if (z.punkte > 0 && z.punkte > (eigenerLauf(spiel, fassung)?.punkte || 0)) {
        merkeLauf(spiel, z.punkte, bahn, fassung);
      }
      return bahn ? { level: fassung, bahn } : null;
    }

    // Wer gerade angezeigt wird – für das Bild des Spiels. Liegt man selbst
    // auf Platz 1, liefe die eigene Bestmarke genau unter dem ersten Geist
    // her; dann steht sie nur einmal da.
    function gegner() {
      // Im Live-Modus: wer gerade mitspielt, aus seiner Lage (live-spiel.js).
      if (live()) return live().gegner?.() || [];
      const s = z.stand;
      if (!s || s.aus) return [];
      const w = wahl();
      const raus = [];
      ARTEN.forEach((welche) => {
        const g = gegnerVon(welche);
        if (!g || !w[welche]) return;
        if (welche === "eigen" && raus[0]?.ich && raus[0].punkte === g.punkte) return;
        raus.push({ art: welche, name: g.name, punkte: g.punkte, lauf: g.lauf, ich: Boolean(g.ich), farbe: FARBE[welche] });
      });
      // Alle anderen hinten an: Sie werden zuerst gezeichnet, Platz 1 und
      // die Bestmarke liegen darüber.
      if (schalter.alle && w.alle) {
        alleAndern().forEach((g) => raus.unshift({ art: "alle", name: g.name, punkte: g.punkte, lauf: g.lauf, ich: false, farbe: FARBE.alle }));
      }
      return raus;
    }

    window.addEventListener("pagehide", stoppe);

    const steuerung = { runde, los, takt, ende, gegner, zeit, leiste };
    angemeldet.push({ spiel, art, steuerung, z });
    return steuerung;
  }

  const angemeldet = [];

  /*
   * Die Namen über den Geistern im Bild – für alle Spiele gleich.
   *
   *   g        der Zeichenkontext, im Massstab des Bildes (CSS-Pixel)
   *   orte     [{ name, art, farbe, sx, sy, blass, weit }] – sx, sy: wo der
   *            Name im Bild steht; weit: was am Rand dazu steht ("+12 m")
   *   bild     { breit, hoch, oben } – oben: so weit bleibt der Rand frei
   *
   * Wer ausserhalb des Bildes ist, steht als Hinweis am Rand – Platz 1 und
   * die Bestmarke; die vielen unter «Alle» nicht, sonst stünde der Rand voll.
   */
  // oben: so weit bleibt der Rand frei – auf dem Handy, was unter den
  // Knöpfen liegt (game-shell.js, frei).
  function namen(g, orte, { breit, hoch, oben = window.LernappGameShell?.frei?.() || 0 }) {
    const gross = Math.round(clamp(hoch * 0.028, 10, 13));
    g.save();
    g.font = `800 ${gross}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "bottom";
    g.lineWidth = 3;
    g.strokeStyle = "rgba(20, 24, 50, 0.65)";
    orte.forEach((o) => {
      if (!(o.blass > 0)) return;
      const text = o.art === "eigen" ? "Bestmarke" : o.name;
      const drin = o.sx >= 0 && o.sx <= breit && o.sy >= oben && o.sy <= hoch + gross;
      g.globalAlpha = o.blass;
      // Wem im Live-Modus zugeschaut wird: sein Name gross an der Figur, auf
      // einem Schild – er ist die Figur, kein Geist.
      if (o.ziel) {
        if (!drin) return;
        g.save();
        g.font = `900 ${gross + 3}px system-ui, sans-serif`;
        const w = g.measureText(text).width + 16;
        const h = gross + 10;
        const x = clamp(o.sx, w / 2 + 4, breit - w / 2 - 4);
        g.fillStyle = "rgba(20, 24, 50, 0.78)";
        g.beginPath();
        if (g.roundRect) g.roundRect(x - w / 2, o.sy - h - 2, w, h, h / 2);
        else g.rect(x - w / 2, o.sy - h - 2, w, h);
        g.fill();
        g.fillStyle = "#ffffff";
        g.fillText(text, x, o.sy - 6);
        g.restore();
        return;
      }
      if (drin) {
        g.strokeText(text, o.sx, o.sy);
        g.fillStyle = "#ffffff";
        g.fillText(text, o.sx, o.sy);
        return;
      }
      if (o.art === "alle") return;
      const zeile = o.weit ? `${text} ${o.weit}` : text;
      const halb = g.measureText(zeile).width / 2 + 6;
      const x = clamp(o.sx, halb, breit - halb);
      const y = clamp(o.sy, oben + gross + 4, hoch - 6);
      g.strokeText(zeile, x, y);
      g.fillStyle = o.farbe;
      g.fillText(zeile, x, y);
    });
    g.restore();
  }

  // Wo ein Geist gerade ist, für das Bild eines Spiels: ort(ms) seines Laufs,
  // ein Stück voraus für die Richtung, und wie blass er nach seinem Ende ist.
  function orte(steuerung) {
    if (!steuerung) return [];
    const ms = steuerung.zeit();
    return steuerung.gegner().filter((geg) => geg.lauf?.mitOrt).map((geg) => {
      const ort = geg.lauf.ort(ms);
      const bald = geg.lauf.ort(ms + 100);
      const fertig = geg.lauf.fertig(ms);
      return {
        ...geg,
        a: ort.a,
        b: ort.b,
        c: ort.c,
        da: bald.a - ort.a,
        db: bald.b - ort.b,
        blass: fertig ? clamp(1 - (ms - geg.lauf.dauer) / 1200, 0, 1) : 1,
      };
    }).filter((o) => o.blass > 0);
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Wessen Lauf die Adresse zeigen will: ?zuschauen=<spieler>, aus einem
  // Turnier mit &aus=<turnier>. Kein Turnier im Sinn von turnier.js: Wer
  // zuschaut, spielt keinen Versuch.
  //
  // ?mitschauen=<kennung>&aus=<turnier> heisst: live, dem Spieler folgen
  // (mitschauer).
  function zuschauAdresse() {
    try {
      const p = new URLSearchParams(window.location.search);
      const aus = (p.get("aus") || "").trim().slice(0, 64);
      const mit = (p.get("mitschauen") || "").trim().slice(0, 64);
      if (mit && aus) return { spieler: mit, aus, live: true, wer: (p.get("wer") || "").trim().slice(0, 24) };
      const spieler = (p.get("zuschauen") || "").trim().slice(0, 64);
      if (!spieler) return null;
      return { spieler, aus };
    } catch { return null; }
  }

  // Den Lauf holen – aus der Hall of Fame oder aus dem Turnier. Ohne Saat
  // lässt er sich nur in einem Spiel mit immer derselben Welt anschauen.
  // mitZuegen: ein Spiel ohne Figur, das seine Züge nachbaut.
  //
  // Ein Turnier ohne Replays lässt keinen Lauf anschauen, eines mit
  // verdeckter Rangliste erst am Schluss – auch nicht über eine Adresse, die
  // jemand von Hand tippt ({ gesperrt }).
  async function ladeLauf(spiel, fassung, { spieler, aus }, fest, mitZuegen = false) {
    let geist = null;
    if (aus) {
      const t = await vielleicht(() => cloud()?.turnier?.(aus));
      if (t && (t.ohneReplay || (t.verdeckt && window.LernappTurnier?.lage?.(t) !== "beendet"))) return { gesperrt: true };
      geist = await vielleicht(() => cloud()?.turnierGeist?.(aus, spiel, spieler));
      if (geist && geist.level !== fassung) geist = null;
    } else {
      const gefunden = await vielleicht(() => cloud()?.geister?.(spiel, [spieler], fassung));
      geist = (gefunden || [])[0] || null;
    }
    if (!geist) return null;
    const lauf = mitZuegen ? zugAbspieler(geist.bahn) : abspieler(geist.bahn, { winkel: cIstWinkel(spiel) });
    if (!lauf || (!mitZuegen && !lauf.mitOrt) || (!fest && lauf.saat === null)) return null;
    return { name: geist.name, punkte: geist.punkte, lauf };
  }

  // Ob sich ein Lauf anschauen lässt – für den ▶ in der Liste.
  function ansehbar(bahn, fest = false, mitZuegen = false) {
    if (mitZuegen) {
      const d = entpackeZuege(bahn);
      return Boolean(d) && (fest || d.s !== null);
    }
    const d = entpacke(bahn);
    return Boolean(d?.a) && (fest || d.s !== null);
  }

  // Beim Zuschauen gehört kein Tipp und keine Taste dem Spiel – auch nicht in
  // dem Augenblick, bevor der Lauf geladen ist (sonst begänne dort eine
  // Runde, die in die Hall of Fame käme). Frei bleiben die Knöpfe oben und
  // die Tafel am Schluss.
  const GESPERRT = ["pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend", "click", "keydown", "keyup"];
  const FREI = ".gz-leiste, .gz-tafel, .cm-bar, .cm-vollbild";
  function sperreEingaben() {
    const sperrt = (ereignis) => {
      if (ereignis.target?.closest?.(FREI)) return;
      if (ereignis.type.startsWith("key") && ereignis.key === "Tab") return;
      ereignis.stopPropagation();
    };
    GESPERRT.forEach((typ) => window.addEventListener(typ, sperrt, { capture: true }));
  }

  /*
   * Ein Spiel, das man anschauen kann, fragt beim Laden:
   *
   *   const zuschauer = LernappGeist.zuschauer({ host, spiel, fassung, zufall,
   *     einheit: "m", nochmal: () => … });
   *
   * null heisst: Hier wird gespielt, nicht zugeschaut. Sonst:
   *
   *   zuschauer.laden      Promise – ob es den Lauf gibt; die Saat hält
   *                        danach den Zufall des Spiels fest
   *   zuschauer.los()      die Wiedergabe beginnt (nach dem Aufbau der Welt)
   *   zuschauer.stand()    { a, b, c, va, vb, ab, punkte, t } – wo der
   *                        Läufer jetzt ist, wie schnell er sich bewegt und
   *                        wie er nach oben beschleunigt
   *   zuschauer.weiter()   falsch, sobald der Lauf zu Ende ist (dann steht
   *                        die Tafel mit «Nochmal» und «Zurück» da)
   *
   * Ein Spiel ohne Figur im Bild sagt zuege: true und bekommt statt stand()
   * dieselben Fragen wie beim Zuschauen im Multiplayer (live-spiel.js):
   *
   *   zuschauer.jetzt()          die Zeit des Laufs, die gerade im Bild ist
   *   zuschauer.seit(t0, bis)    seine Züge nach t0 bis einschliesslich bis
   *   zuschauer.letzte(bis)      der letzte Zug bis dahin
   *   zuschauer.naechste(bis)    der nächste danach
   *
   * Oben steht, wessen Lauf das ist, und ein Knopf, der jederzeit beendet.
   */
  function zuschauer({ host, spiel, fassung = LEVEL, zufall = null, fest = false, einheit = "", nochmal = null, zuege: mitZuegen = false }) {
    const wo = zuschauAdresse();
    if (!wo || !host) return null;
    if (!einheit) einheit = mini()?.einheit?.(spiel) || "";
    if (wo.live) return mitschauer({ host, spiel, zufall, einheit, mitZuegen, wo });
    sperreEingaben();
    const z = { lauf: null, name: "", punkte: 0, t0: 0, fertig: false };
    const ziel = wo.aus ? (window.LernappTurnier?.seitenLink?.(wo.aus) || "/") : "/";
    const zurueck = () => {
      if (window.LernappVollbild?.weiter) window.LernappVollbild.weiter(ziel);
      else window.location.href = ziel;
    };

    const leiste = el("div", "gz-leiste");
    const titel = el("span", "gz-titel", "Lauf wird geladen …");
    const zu = el("button", "gz-zu", "Beenden");
    zu.type = "button";
    zu.addEventListener("click", zurueck);
    leiste.append(el("span", "gz-zeichen", "▶"), titel, zu);
    const tafel = el("div", "gz-tafel");
    tafel.hidden = true;
    host.append(leiste, tafel);
    host.dataset.gegner = "an";
    host.dataset.zuschauen = "an";

    function zeigeTafel(text, mitNochmal) {
      tafel.replaceChildren();
      const karte = el("div", "gz-karte");
      karte.append(el("p", "gz-text", text));
      const knoepfe = el("div", "gz-knoepfe");
      if (mitNochmal && nochmal) {
        const wieder = el("button", "gz-knopf gz-nochmal", "Nochmal");
        wieder.type = "button";
        wieder.addEventListener("click", () => { tafel.hidden = true; nochmal(); });
        knoepfe.append(wieder);
      }
      const weg = el("button", "gz-knopf gz-zurueck", "Zurück");
      weg.type = "button";
      weg.addEventListener("click", zurueck);
      knoepfe.append(weg);
      karte.append(knoepfe);
      tafel.append(karte);
      tafel.hidden = false;
    }

    const laden = ladeLauf(spiel, fassung, wo, fest, mitZuegen).then((g) => {
      if (g?.gesperrt) {
        titel.textContent = "Kein Replay";
        zeigeTafel("In diesem Turnier lassen sich die Läufe nicht anschauen.", false);
        return false;
      }
      if (!g) {
        titel.textContent = "Kein Lauf";
        zeigeTafel("Von diesem Lauf gibt es keine Aufzeichnung. Sie entsteht beim nächsten Rekord.", false);
        return false;
      }
      z.lauf = g.lauf;
      z.name = g.name;
      z.punkte = g.punkte;
      if (g.lauf.saat !== null) zufall?.halte?.(g.lauf.saat);
      titel.textContent = `${g.name} · ${g.punkte}${einheit ? ` ${einheit}` : ""}`;
      return true;
    });

    const zeit = () => (z.t0 ? performance.now() - z.t0 : 0);
    return {
      laden,
      get lauf() { return z.lauf; },
      get name() { return z.name; },
      los() {
        z.t0 = performance.now();
        z.fertig = false;
        tafel.hidden = true;
      },
      zeit,
      // Für die Spiele, die Zug um Zug nachbauen (zuege).
      jetzt: zeit,
      seit: (t0, bis) => z.lauf?.seit?.(t0, bis) || [],
      letzte: (bis) => z.lauf?.letzte?.(bis) || null,
      naechste: (bis) => z.lauf?.naechste?.(bis) || null,
      fertig: () => Boolean(z.lauf?.fertig?.(zeit())),
      stand() {
        if (!z.lauf?.ort) return null;
        const t = Math.min(zeit(), z.lauf.dauer);
        const ort = z.lauf.ort(t);
        const vor = z.lauf.ort(Math.max(0, t - 60));
        const nach = z.lauf.ort(t + 60);
        const dt = (Math.min(t + 60, z.lauf.dauer) - Math.max(0, t - 60)) / 1000 || 0.12;
        // Die Beschleunigung nach oben, über eine Viertelsekunde je Seite –
        // für Spiele, die zeigen wollen, wann ein Triebwerk brannte.
        const h = AB_MS;
        const oben = z.lauf.ort(Math.max(0, t - h));
        const unten = z.lauf.ort(t + h);
        const ab = (unten.b - 2 * ort.b + oben.b) / ((h / 1000) ** 2);
        return { a: ort.a, b: ort.b, c: ort.c, va: (nach.a - vor.a) / dt, vb: (nach.b - vor.b) / dt, ab, punkte: z.lauf.wert(t), t };
      },
      weiter() {
        if (!z.lauf || !z.t0) return false;
        if (!z.fertig && zeit() > z.lauf.dauer + 400) {
          z.fertig = true;
          zeigeTafel(`Das war der Lauf von ${z.name}: ${z.punkte}${einheit ? ` ${einheit}` : ""}.`, true);
        }
        return !z.fertig;
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Live mitschauen (Turnier)
  // ---------------------------------------------------------------------------
  /*
   * ?mitschauen=<kennung>&aus=<turnier>: Diese Seite folgt einem Spieler –
   * nicht einem Lauf. Was er gerade in diesem Turnier spielt, kommt aus der
   * Realtime Database (cloud.js, mitschauenHoeren; geschrieben von
   * turnier.js, mitschauenSender) und läuft hier im eigenen Spiel ab, auf
   * demselben Weg wie ein Replay (zuschauer): dieselbe Welt (die Saat der
   * Runde), dieselbe Figur, dieselben Züge – nur kurz hinter ihm her
   * (MITSCHAU_VERZUG), damit fast immer das nächste Stück schon da ist.
   *
   * Der Beobachtungsmodus bleibt, bis jemand «Beenden» tippt:
   *
   *   spielt er hier     sieht man ihm zu
   *   ein anderes Spiel  geht die Seite gleich dorthin (dieselbe Adresse,
   *                      anderes Spiel)
   *   eine neue Runde    lädt die Seite neu – mit der Welt der neuen Runde
   *   gerade nichts      steht da «<Name> spielt gerade nicht», und es geht
   *                      weiter, sobald er wieder spielt
   *
   * «Gerade nichts» heisst auch: Seine Runde ist zu Ende gespielt, oder er
   * hat seit MITSCHAU_STILL nichts geschrieben (Bildschirm aus, weggegangen).
   */
  // Anderthalb Sekunden: drei Stücke (turnier.js, MITSCHAUEN_MS) – fast
  // immer ist das nächste schon da, und die Figur läuft ohne Halt.
  const MITSCHAU_VERZUG = 1500;
  const MITSCHAU_STILL = 15000;
  // Beim Hineinkommen zählt die Uhr des Spielers: So frisch muss sein
  // letztes Lebenszeichen sein, damit seine Runde noch läuft.
  const MITSCHAU_FRISCH = 20000;

  function mitschauer({ host, spiel, zufall = null, einheit = "", mitZuegen = false, wo }) {
    sperreEingaben();
    const art = mitZuegen ? "z" : "o";
    const winkel = cIstWinkel(spiel);
    const m = {
      runde: null, gelesen: new Set(), orte: [], punkte: [], zuege: [], versatz: null, ende: null,
      name: wo.wer || "", zuletzt: 0, gestartet: false, zeitMax: 0, warten: false, gesperrt: false, aus: null,
    };
    const ziel = window.LernappTurnier?.seitenLink?.(wo.aus) || "/";
    const geh = (adresse) => {
      if (window.LernappVollbild?.weiter) window.LernappVollbild.weiter(adresse, { ersetzen: true });
      else window.location.replace(adresse);
    };
    const zurueck = () => {
      m.aus?.();
      if (window.LernappVollbild?.weiter) window.LernappVollbild.weiter(ziel);
      else window.location.href = ziel;
    };
    // Dieselbe Adresse für ein anderes Spiel.
    const adresseFuer = (anderes) => `${mini()?.spielLink?.(anderes) || "/"}?mitschauen=${encodeURIComponent(wo.spieler)}&aus=${encodeURIComponent(wo.aus)}${m.name || wo.wer ? `&wer=${encodeURIComponent(m.name || wo.wer)}` : ""}`;

    const leiste = el("div", "gz-leiste ist-live");
    const titel = el("span", "gz-titel", wo.wer || "Verbinde …");
    const zu = el("button", "gz-zu", "Beenden");
    zu.type = "button";
    zu.addEventListener("click", zurueck);
    const punkt = el("span", "gz-zeichen gz-live");
    punkt.setAttribute("aria-hidden", "true");
    leiste.append(punkt, titel, zu);
    const tafel = el("div", "gz-tafel");
    tafel.hidden = true;
    host.append(leiste, tafel);
    host.dataset.gegner = "an";
    host.dataset.zuschauen = "an";
    host.dataset.mitschauen = "an";

    // Die Tafel: spielt gerade nicht (mit dem, was er zuletzt hatte) – oder
    // hier lässt sich nicht zuschauen.
    function zeigeTafel(text, nebenbei = "") {
      tafel.replaceChildren();
      const karte = el("div", "gz-karte gz-warten");
      const zeile = el("p", "gz-text");
      if (!m.gesperrt) zeile.append(el("span", "gz-live"));
      zeile.append(el("span", "", text));
      karte.append(zeile);
      if (nebenbei) karte.append(el("p", "gz-neben", nebenbei));
      const knoepfe = el("div", "gz-knoepfe");
      const weg = el("button", "gz-knopf gz-zurueck", "Beenden");
      weg.type = "button";
      weg.addEventListener("click", zurueck);
      knoepfe.append(weg);
      karte.append(knoepfe);
      tafel.append(karte);
      tafel.hidden = false;
    }
    function warte(nebenbei = "") {
      m.warten = true;
      const wer = m.name || "Der Spieler";
      titel.textContent = wer;
      zeigeTafel(`${wer} spielt gerade nicht`, nebenbei);
    }
    function weiterSpielen() {
      if (!m.warten) return;
      m.warten = false;
      tafel.hidden = true;
    }

    // --- Der Lauf, der wächst --------------------------------------------------
    const nach = (liste, t) => {
      let lo = 0;
      let hi = liste.length;
      while (lo < hi) {
        const mitte = (lo + hi) >> 1;
        if (liste[mitte].t <= t) lo = mitte + 1; else hi = mitte;
      }
      return lo;
    };
    const lauf = {
      live: true,
      mitOrt: !mitZuegen,
      zuege: mitZuegen,
      get saat() { return m.runde?.saat ?? null; },
      get dauer() {
        const liste = mitZuegen ? m.zuege : m.orte;
        const zuletzt = liste[liste.length - 1]?.t || 0;
        const ende = m.ende?.[art];
        return Number.isFinite(ende) ? Math.max(zuletzt, ende) : zuletzt;
      },
      wert(ms) {
        const liste = mitZuegen ? m.zuege : m.punkte;
        return liste[nach(liste, ms) - 1]?.p || 0;
      },
      ort: (ms) => (m.orte.length ? kurve(m.orte, ms, { winkel, fertig: Boolean(m.ende) }) : null),
      seit: (t0, bis) => m.zuege.slice(nach(m.zuege, t0), nach(m.zuege, bis)),
      letzte: (bis) => m.zuege[nach(m.zuege, bis) - 1] || null,
      naechste: (bis) => m.zuege[nach(m.zuege, bis)] || null,
      fertig: (ms) => Boolean(m.ende) && ms > lauf.dauer,
    };
    const hatDaten = () => (mitZuegen ? m.zuege.length > 0 : m.orte.length > 0) && m.versatz !== null;

    // Wo der Spieler gerade ist, in der Uhr seines Stroms – und davon der
    // Verzug ab. Gemessen am schnellsten Stück, das je ankam: so wenig
    // hinterher wie möglich, und die Zeit läuft nie zurück.
    const zeit = () => {
      if (m.versatz === null) return 0;
      let t = performance.now() + m.versatz - MITSCHAU_VERZUG;
      if (m.ende) t = Math.min(t, lauf.dauer + 1000);
      m.zeitMax = Math.max(m.zeitMax, t);
      return Math.max(0, m.zeitMax);
    };

    let fertigLaden = null;
    const laden = new Promise((fertig) => { fertigLaden = fertig; });

    function lies(knoten) {
      m.zuletzt = performance.now();
      if (!knoten?.runde) { if (!m.gestartet) warte(); return; }
      m.name = String(knoten.name || "").slice(0, 24) || m.name;
      const r = knoten.runde;
      const frisch = Date.now() - (Number(knoten.lebt) || 0) < MITSCHAU_FRISCH;
      const laeuft = !knoten.ende && frisch;
      // Er spielt ein anderes Spiel: dorthin.
      if (r.spiel !== spiel) {
        if (laeuft && mini()?.SPIELE?.some((s) => s.id === r.spiel)) { m.aus?.(); geh(adresseFuer(r.spiel)); return; }
        if (!m.gestartet || m.ende) warte();
        return;
      }
      // Eine neue Runde in diesem Spiel: neu laden, mit ihrer Welt.
      if (m.runde && r.id !== m.runde.id) {
        if (m.gestartet) { if (laeuft) { m.aus?.(); geh(adresseFuer(spiel)); } return; }
        m.gelesen = new Set();
        m.orte = [];
        m.punkte = [];
        m.zuege = [];
        m.versatz = null;
      }
      if (!m.runde || m.runde.id !== r.id || (m.runde.saat === null && Number.isInteger(r.saat))) {
        m.runde = { id: r.id, saat: Number.isInteger(r.saat) ? r.saat : null };
      }
      // Die neuen Stücke, der Reihe nach.
      const jetzt = performance.now();
      Object.keys(knoten.teile || {}).map(Number).filter((n) => Number.isInteger(n) && !m.gelesen.has(n)).sort((a, b) => a - b).forEach((n) => {
        m.gelesen.add(n);
        let stueck = null;
        try { stueck = JSON.parse(knoten.teile[n]); } catch { return; }
        (Array.isArray(stueck?.o) ? stueck.o : []).forEach(([t, a, b, c, p]) => {
          if (m.orte.length && t <= m.orte[m.orte.length - 1].t) return;
          m.orte.push({ t, a, b, c });
          m.punkte.push({ t, p });
        });
        (Array.isArray(stueck?.z) ? stueck.z : []).forEach(([t, a, b, c, p, l]) => {
          const vor = m.zuege[m.zuege.length - 1];
          m.zuege.push({ t: vor && t <= vor.t ? vor.t + 1 : t, a, b, c, p, lage: Boolean(l) });
        });
        const j = Number(stueck?.[`j${art}`]);
        if (Number.isFinite(j)) m.versatz = m.versatz === null ? j - jetzt : Math.max(m.versatz, j - jetzt);
      });
      m.ende = knoten.ende || null;
      if (!m.gestartet) {
        // Hinein erst, wenn die Runde läuft und etwas zu sehen ist – und mit
        // ihrer Welt.
        if (!laeuft) { warte(m.ende ? `zuletzt ${m.ende.p}${einheit ? ` ${einheit}` : ""}` : ""); return; }
        if (!hatDaten() || (m.runde.saat === null && !mini()?.ANSEHBAR?.[spiel]?.fest)) return;
        if (m.runde.saat !== null) zufall?.halte?.(m.runde.saat);
        weiterSpielen();
        titel.textContent = m.name;
        fertigLaden(true);
        return;
      }
      if (laeuft) weiterSpielen();
    }

    // Darf hier überhaupt zugeschaut werden? Wie beim Replay: nicht ohne
    // Replays und nicht, solange die Rangliste verdeckt ist.
    vielleicht(() => cloud()?.turnier?.(wo.aus)).then((t) => {
      if (!t || t.ohneReplay || (t.verdeckt && window.LernappTurnier?.lage?.(t) !== "beendet") || !cloud()?.mitschauenHoeren) {
        m.gesperrt = true;
        titel.textContent = "Zuschauen";
        zeigeTafel(t ? "In diesem Turnier lässt sich nicht zuschauen." : "Dieses Turnier gibt es nicht (mehr).");
        fertigLaden(false);
        return;
      }
      m.aus = cloud().mitschauenHoeren(wo.aus, wo.spieler, lies);
    });

    // Oben: wer, und wie viel er gerade hat.
    const anzeige = window.setInterval(() => {
      if (!m.gestartet || m.warten) return;
      const punkte = lauf.wert(Math.min(zeit(), lauf.dauer));
      titel.textContent = `${m.name} · ${punkte}${einheit ? ` ${einheit}` : ""}`;
    }, 400);
    window.addEventListener("pagehide", () => { window.clearInterval(anzeige); m.aus?.(); });

    return {
      laden,
      get lauf() { return m.gestartet || hatDaten() ? lauf : null; },
      get name() { return m.name; },
      live: true,
      los() {
        m.gestartet = true;
        tafel.hidden = true;
      },
      zeit,
      jetzt: zeit,
      seit: (t0, bis) => lauf.seit(t0, bis),
      letzte: (bis) => lauf.letzte(bis),
      naechste: (bis) => lauf.naechste(bis),
      fertig: () => lauf.fertig(zeit()),
      stand() {
        if (!m.orte.length) return null;
        const t = Math.min(zeit(), lauf.dauer);
        const ort = lauf.ort(t);
        const vor = lauf.ort(Math.max(0, t - 60));
        const nachher = lauf.ort(t + 60);
        const h = AB_MS;
        const oben = lauf.ort(Math.max(0, t - h));
        const unten = lauf.ort(t + h);
        const ab = (unten.b - 2 * ort.b + oben.b) / ((h / 1000) ** 2);
        return { a: ort.a, b: ort.b, c: ort.c, va: (nachher.a - vor.a) / 0.12, vb: (nachher.b - vor.b) / 0.12, ab, punkte: lauf.wert(t), t };
      },
      // Läuft es noch? Nein, wenn seine Runde zu Ende gespielt ist – oder
      // wenn er seit MITSCHAU_STILL nichts mehr geschrieben hat. Dann steht
      // die Tafel; kommt er zurück, geht es weiter (lies).
      weiter() {
        if (!m.gestartet) return false;
        if (m.ende && zeit() > lauf.dauer + 400) {
          if (!m.warten) warte(`zuletzt ${m.ende.p}${einheit ? ` ${einheit}` : ""}`);
          return false;
        }
        if (!m.ende && performance.now() - m.zuletzt > MITSCHAU_STILL) {
          if (!m.warten) warte();
          return false;
        }
        return !m.warten;
      },
    };
  }

  window.LernappGeist = {
    LEVEL, TAKT_MS, AB_MS, FARBE,
    fuer, wahl, setzeWahl, entpacke, abspieler, eigenerLauf, namen, orte, kurve,
    zuschauer, zuschauAdresse, ansehbar, zuege, entpackeZuege, zugAbspieler,
    // Für die Prüfung im Browser: was die Spiele dieser Seite angemeldet haben.
    stand: () => angemeldet.map(({ spiel, art, steuerung, z }) => ({
      spiel, art, laeuft: z.laeuft, punkte: z.punkte, proben: z.auf.p.length,
      // Wer gerade im Bild mitläuft: «art:name».
      zeigt: steuerung.gegner().map((g) => `${g.art}:${g.name}`),
      stand: z.stand ? {
        aus: z.stand.aus,
        grund: z.stand.grund,
        erster: z.stand.erster ? { name: z.stand.erster.name, punkte: z.stand.erster.punkte, lauf: Boolean(z.stand.erster.lauf), ich: z.stand.erster.ich } : null,
        eigen: z.stand.eigen ? { punkte: z.stand.eigen.punkte, lauf: Boolean(z.stand.eigen.lauf) } : null,
        alle: (z.stand.alle || []).map((g) => ({ name: g.name, punkte: g.punkte })),
      } : null,
    })),
  };
})();
