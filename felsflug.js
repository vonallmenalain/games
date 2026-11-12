/*
 * felsflug.js – Felsflug.
 * ---------------------------------------------------------------------------
 * Im Wingsuit durch eine Alpenschlucht, im Morgenlicht. Wer links aufs Bild
 * hält, zieht nach links, wer rechts hält, nach rechts – mehr gibt es nicht
 * zu tun. Die Höhe hält der Flieger von selbst. Die Schlucht windet sich
 * talwärts, und auf Flughöhe ist sie ein Gang, der dem freien Weg folgt:
 * vorne gut zwanzig Meter breit und in weiten Bögen, hinten kaum acht, und
 * er schlägt Haken (gangBei, engeBei). Im Weg steht, was in einer Schlucht
 * eben steht: Felsnasen,
 * die aus der Wand ragen, Türme mitten im Weg, ein Massiv, das die Schlucht
 * teilt (links breit, rechts ein Spalt), Felsbögen, eine Steinbrücke, Tannen
 * auf Felsbändern. Der erste Kontakt beendet die Runde.
 *
 * Gezählt wird die Nähe zum Fels. Fliegen allein gibt einen Punkt je Sekunde.
 * Wer näher als sieben Meter an Wand, Turm, Pfeiler oder Tanne vorbeizieht,
 * bekommt mehr – je näher, desto mehr, bis sechsmal so viel bei unter zwei
 * Metern. Dazu die Serie: Sie steigt, solange man nah bleibt, und fällt, wenn
 * man in der Mitte fliegt. Wer an einer Nase, einem Turm oder einer Tanne
 * ganz knapp vorbeikommt, fliegt «haarscharf» und bekommt einen Schub, und
 * wer den Spalt neben einem Massiv nimmt, erst recht.
 *
 * Es wird immer schneller, von 130 auf 250 km/h, und nach 4300 Metern –
 * gut 85 Sekunden – öffnet sich das Tal: Schirm auf, Landung auf der Wiese.
 * Dorthin kommt nur, wer die Haken am Schluss vorausahnt.
 *
 * Der Flieger ist ein Mensch im Wingsuit, und er bewegt sich: Sein Netz
 * entsteht in jedem Bild neu aus seiner Haltung (fliegerNetz, fliegerPose).
 *
 * Gebaut wird die Schlucht aus dem Zufall (zufall.js): ohne Turnier jedes
 * Mal eine andere, im Turnier für alle im selben Versuch dieselbe. Zuerst
 * entsteht der freie Weg (weg), Punkt für Punkt nie weiter zur Seite, als
 * sich in der Zeit lenken lässt; dann die Schlucht darum herum. Auf der
 * Breite breiteBei(z) steht am Weg nichts – die Wände weichen dort zurück,
 * und was sonst im Weg stünde, wird schmaler (raeumeWeg).
 *
 * Die Wände sind zwei Reihen von Knoten, alle vier Meter einer (wandL,
 * wandR): Dort steht der Fels auf Flughöhe, und genau diese Knoten sind
 * auch die Ecken des gezeichneten Netzes. Was man sieht, ist, woran man
 * anstösst.
 *
 * Die Gegner (geist.js) fliegen als Flieger aus Licht mit, und die besten
 * Flüge lassen sich anschauen (?zuschauen=): durch ihre eigene Schlucht,
 * gewürfelt mit derselben Saat.
 *
 * Gezeichnet wird mit WebGL 2, ohne Bibliothek, in einem Durchgang: Himmel,
 * Fels (Stück um Stück laufend erzeugt), Bach, alles Feste (ein Netz je
 * Form), Bänder (Rauch, Seile, Wasserfälle, Sonnenstrahlen), Lichter, Dohlen.
 * Gerechnet wird in Metern; x zeigt nach rechts, y nach oben, z talwärts.
 * Die Zahlen und Namen liegen auf einer zweiten Leinwand darüber.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "cliff") return;

  const host = document.querySelector("#ff-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur die Schlucht zieht daraus – ihr Verlauf, was im Weg
  // steht. Staub, Windstreifen und Steinchen nehmen Math.random; wo eine
  // Tanne am Rand steht, folgt aus festen Zahlen (hash01).
  const zufall = window.LernappZufall?.fuer?.("cliffFlight") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Schrauben
  // ---------------------------------------------------------------------------
  const TAKT = 1 / 120;            // gelenkt wird in festen kleinen Schritten
  const Z_ENDE = 4300;             // so weit ist es bis ins Tal
  const FLUG_Y = 30;               // so hoch über dem Bach fliegt er
  const START_HOCH = 11;           // so viel höher steht er vor dem Absprung
  const KOERPER = 0.7;             // näher am Fels ist es ein Treffer (der Körper, nicht die Flügelspitze)

  // Das Tempo, nach der Strecke: von 130 auf 250 km/h. Die ersten Meter
  // sind der Absprung.
  const V0 = 36;
  const V_MAX = 69.5;
  // Zur Seite: so schnell zieht er, in m/s – mit dem Tempo etwas mehr. Bis
  // er in der Kurve liegt, dauert es einen Augenblick (TRAEG_AN), bis er
  // wieder gerade fliegt, einen kürzeren.
  const QUER0 = 26;
  const QUER_ZU = 0.3;
  const TRAEG_AN = 0.16;
  const TRAEG_AB = 0.13;

  // Die Punkte. Fliegen allein: GRUND je Sekunde. Näher als NAH am Fels
  // steigt das bis NAH_MAL-mal (bei GANZ_NAH und darunter), und alles mal
  // die Serie (1 bis SERIE_MAX).
  const GRUND = 1;
  const NAH = 4.5;
  const GANZ_NAH = 1.5;
  const NAH_MAL = 6;
  const NAH_HOCH = 1.5;            // wie steil es zum Fels hin mehr wird (1 wäre gleichmässig)
  const SERIE_MAX = 1.6;
  const SERIE_AUF = 0.12;          // je Sekunde ganz nah
  const SERIE_AB = 0.3;            // je Sekunde in der Mitte
  const SERIE_GNADE = 1.3;         // so lange hält die Serie ohne Fels
  const HAAR = 2.2;                // näher an einem Hindernis vorbei ist «haarscharf»
  const HAAR_PUNKTE = [3, 8];      // von knapp bis ganz knapp
  const SPALT_PUNKTE = 12;         // der Spalt neben einem Massiv
  const LANDE_PUNKTE = 30;         // die Landung im Tal

  // Der freie Weg: am Anfang gut vier Flieger breit, am Schluss knapp zwei.
  const BREIT0 = 9.5;
  const BREIT_MIN = 5;
  const ERSTES_DING = 260;         // bis hier ist die Schlucht leer und weit
  // Der Gang: Auf Flughöhe steht die Wand so viel neben dem freien Weg –
  // erst ein paar Meter, zum Schluss kaum einer. Und so schnell wird es eng
  // und kurvig: ab ENG_AB, ganz ab ENG_VOLL.
  const LUFT0 = 5.5;
  const LUFT_MIN = 1.7;
  const ENG_AB = 220;
  const ENG_VOLL = 2600;

  // Die Wände: alle DZ Meter ein Knoten, von vor dem Absprung bis hinter
  // die Wiese.
  const DZ = 4;
  const Z_MIN = -192;
  const Z_MAX = Z_ENDE + 1920;
  const KNOTEN = Math.round((Z_MAX - Z_MIN) / DZ) + 1;

  // Die Hindernisse.
  const PFEILER = 3.4;             // Breite eines Brückenpfeilers
  const BRUECKE_TIEF = 5;          // so dick ist die Steinbrücke
  const TANNE_R = 2.6;             // so breit trifft eine Tanne auf Flughöhe
  const TANNE_H = 22;
  const TANNE_FUSS = 20;           // so hoch über dem Bach steht sie

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.felsflug", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
    : {
      read: () => ({ runs: 0, scores: [] }),
      write(data) { return data; },
      update(fn) { return fn(this.read()); },
      onChange() { return () => {}; },
    };

  // ---------------------------------------------------------------------------
  // Kleine Rechnungen
  // ---------------------------------------------------------------------------
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, k) => a + (b - a) * k;
  const weich = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const schwereBei = (z) => clamp(z / Z_ENDE, 0, 1);
  const tempoBei = (z) => (V0 + (V_MAX - V0) * clamp(z / Z_ENDE, 0, 1)) * clamp(0.3 + z / 50, 0.3, 1);
  const querBei = (z) => QUER0 + QUER_ZU * (tempoBei(Math.max(60, z)) - V0);
  // Wie eng und wie kurvig es ist: 0 bis ENG_AB, 1 ab ENG_VOLL.
  const engeBei = (z) => clamp((z - ENG_AB) / (ENG_VOLL - ENG_AB), 0, 1);
  const breiteBei = (z) => lerp(BREIT0, BREIT_MIN, Math.pow(engeBei(z), 0.75));
  // Wie nah: 0 bei NAH und weiter weg, 1 bei GANZ_NAH und näher.
  const naeheBei = (ab) => clamp((NAH - ab) / (NAH - GANZ_NAH), 0, 1);

  // Immer dieselbe Zahl zu derselben Eingabe.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  // Dasselbe aus ganzen Zahlen: auf jedem Gerät gleich.
  function hashGanz(n) {
    let t = (n + 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts gedrückt), "spiel", "zuschauen", "ende"
  // schritt: "start" (er steht am Absprung), "flug", "landung" (am Schirm),
  //          "aus" (angeprallt)
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,
    roh: 0,               // die Punkte, ungerundet
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    lenk: 0,              // -1 links, 1 rechts
    roll: 0,              // die Schräglage
    nick: 0,              // die Nase nach oben (im Stand) oder unten (im Sturz)
    zeit: 0,              // seit dem Aufbau der Runde, in Spielzeit
    echt: 0,              // dasselbe in echter Zeit (die Zeitlupe zählt hier ganz)
    flugzeit: 0,          // seit dem Absprung
    meter: 0,
    ab: 99,               // so nah ist der nächste Fels
    abSeite: 0,           // und auf welcher Seite
    naehe: 0,             // 0 bis 1 (naeheBei), geglättet fürs Bild
    serie: 1,
    serieBest: 1,
    ohneFels: 0,          // so lange schon ohne Fels in der Nähe
    haarscharf: 0,        // wie oft
    zeitlupe: 0,          // noch so lange (echte Sekunden)
    schirm: 0,            // 0 zu, 1 offen
    gelandet: false,
    angekommen: false,
    welt: null,
    teile: [],
    schriften: [],
    karte: null,
    stoss: 0,
    blitz: 0,
    schub: 0,             // ein Ruck nach vorn im Bild (haarscharf)
    schrittZeit: 0,
    sturz: null,          // wie er nach dem Aufprall fällt
  };

  let shell = null;
  let feld = null;
  let canvas = null;       // WebGL: die Welt
  let hud = null;          // 2D: Zahlen und Namen darüber
  let g = null;
  let frame = null;
  let last = 0;
  // Die Gegner (geist.js): wer als Flieger aus Licht mitfliegt.
  let gegner = null;
  // Wer einen Flug anschaut statt zu fliegen (geist.js, zuschauer).
  let zuschauer = null;

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Die Schlucht
  // ---------------------------------------------------------------------------
  /*
   * Ihre Mitte schwingt in drei Wellen hin und her (mitteBei), ihr Boden
   * fällt talwärts (bodenBei). Der freie Weg (weg) ist eine Reihe von
   * Punkten: wie weit neben der Mitte er an der Stelle z liegt; dazwischen
   * eine weiche Kurve. Die Abschnitte – Nasen, Türme, eine Klamm, ein Bogen,
   * ein Massiv, eine Brücke, Tannen – stellen ihre Hindernisse neben diesen
   * Weg und drücken die Wände an ihn heran (buckel).
   *
   *   weg      die Punkte des freien Wegs
   *   buckel   wo eine Wand hereinragt: Nasen, Engen
   *   massive  die Felsen, die die Schlucht teilen
   *   dinge    was sonst trifft: Türme, Tannen, Brücken – nach z geordnet
   *   marken   woran man haarscharf vorbeifliegen kann
   *   zier     was nur schön ist: Hängebrücke, Seilbahn, Wasserfall, Dohlen
   *
   * Aus alledem werden die Knoten gebacken (backe): die Wände, das Massiv
   * dazwischen, der Bach, die Höhe des Rands.
   */
  let W = null;

  function neueWelt() {
    const feldN = () => new Float32Array(KNOTEN);
    const w = {
      dinge: [], marken: [], zier: [], buckel: [], massive: [],
      weg: [{ z: Z_MIN, o: 0 }, { z: 120, o: 0 }],
      bis: ERSTES_DING, vorher: "", fertig: false, nr: 0,
      von: 0, markeVon: 0, buckelVon: 0, zuPruefen: 0,
      fest: 0,                   // so viele Knoten sind gebacken
      wandL: feldN(), wandR: feldN(), glattL: feldN(), glattR: feldN(),
      mitte: feldN(), boden: feldN(), randL: feldN(), randR: feldN(),
      inselL: feldN(), inselR: feldN(), inselH: feldN(),
      fluss: feldN(), flussHalb: feldN(), hoch: feldN(), simsL: feldN(), simsR: feldN(),
      // Die Wellen der Mitte und ein paar feste Zahlen für die Zier.
      wellen: [],
      saat: [],
    };
    const LAENGEN = [660, 410, 265];
    const STEIL = [0.15, 0.1, 0.065];
    for (let i = 0; i < 3; i += 1) {
      const f = (Math.PI * 2) / (LAENGEN[i] * (0.88 + 0.24 * zufall.zahl()));
      w.wellen.push({ a: STEIL[i] / f, f, p: zufall.zahl() * Math.PI * 2 });
    }
    for (let i = 0; i < 8; i += 1) w.saat.push(zufall.zahl());
    return w;
  }

  // Die Mitte der Schlucht: am Absprung gerade, dann in Bögen – später, wenn
  // es schneller geht, etwas sanfter.
  function mitteBei(z) {
    const h = weich(90, 420, z) * lerp(1, 0.45, engeBei(z));
    if (h <= 0) return 0;
    let x = 0;
    for (const w of W.wellen) x += w.a * (Math.sin(w.f * z + w.p) - Math.sin(w.f * 90 + w.p));
    return x * h;
  }
  const mitteAb = (z) => (mitteBei(z + 1) - mitteBei(z - 1)) / 2;

  // Der Boden fällt talwärts; hinter dem Ausgang liegt das Tal fast eben.
  function bodenBei(z) {
    const tal = Math.max(0, z - Z_ENDE);
    return -0.072 * (z - tal) - 0.012 * tal
      - 4 * Math.sin(z / 160 + W.saat[0] * 6.28) * (1 - weich(Z_ENDE - 300, Z_ENDE, z));
  }

  // Wie weit die Schlucht aufgeht: 0 in der Schlucht, 1 im Tal.
  const talBei = (z) => weich(Z_ENDE - 40, Z_ENDE + 340, z);
  // Die halbe Breite der Schlucht auf Flughöhe, ohne das, was hereinragt.
  function halbBei(s, z) {
    const k = schwereBei(z);
    const p = W.saat[s < 0 ? 1 : 2] * 6.28;
    return lerp(27, 17.5, Math.pow(k, 0.8)) + 3 * Math.sin(z / 61 + p) + 1.6 * Math.sin(z / 23 + p * 2)
      + 13 * (1 - weich(0, 320, z)) + 240 * Math.pow(talBei(z), 1.4);
  }
  // Die Höhe des Rands über dem Bach – mit Scharten, durch die die Sonne fällt.
  function randBei(s, z) {
    const p = W.saat[s < 0 ? 3 : 4] * 6.28;
    const scharte = Math.pow(Math.max(0, Math.sin(z / 97 + p * 3)), 6);
    return 96 + 20 * Math.sin(z / 143 + p) + 9 * Math.sin(z / 37 + p * 2) - 30 * scharte * (s < 0 ? 1 : 0.5);
  }

  // Wie weit der Weg an der Stelle z neben der Mitte liegt.
  function versatzBei(z) {
    const w = W.weg;
    let hi = w.length - 1;
    if (z <= w[0].z) return w[0].o;
    if (z >= w[hi].z) return w[hi].o;
    let lo = 0;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (w[m].z <= z) lo = m;
      else hi = m;
    }
    const a = w[lo];
    const b = w[hi];
    const u = (z - a.z) / (b.z - a.z);
    return a.o + (b.o - a.o) * (1 - Math.cos(Math.PI * u)) / 2;
  }
  const wegBei = (z) => mitteBei(z) + versatzBei(z);

  // Wie viel vom Lenken der Weg verlangen darf: am Anfang gut ein Drittel,
  // am Schluss gut zwei Drittel dessen, was er zur Seite kann – der Rest
  // bleibt, um eine Kurve zu spät erwischt wieder einzuholen.
  const anteilBei = (z) => lerp(0.36, 0.68, Math.pow(engeBei(z), 0.8));
  const kannBei = (z) => querBei(z) / tempoBei(Math.max(60, z));

  // Wie weit der Weg bis zur Stelle z zur Seite gehen darf, vom letzten
  // Punkt aus. Die Kurve dazwischen ist in ihrer Mitte π/2-mal steiler als
  // im Schnitt, und die Schlucht selbst biegt auch – beides ist eingerechnet.
  function reichBis(z) {
    const letzter = W.weg[W.weg.length - 1];
    const dz = Math.max(1, z - letzter.z);
    let steil = Math.abs(mitteAb(z));
    for (let q = letzter.z; q < z; q += 8) steil = Math.max(steil, Math.abs(mitteAb(q)));
    return Math.max(0, kannBei(z) * anteilBei(z) - steil) * dz / (Math.PI / 2);
  }

  /*
   * Der Gang: So weit steht die Wand auf Flughöhe vom Weg ab, zu jeder
   * Seite. Am Absprung ist die Schlucht noch offen, dann wird sie Meter um
   * Meter enger, und am Ausgang geht sie ins Tal auf.
   */
  const gangBei = (z) => breiteBei(z) / 2 + lerp(LUFT0, LUFT_MIN, Math.pow(engeBei(z), 0.8))
    + 40 * (1 - weich(120, 260, z)) + 400 * talBei(z);

  // So weit neben der Mitte darf der Weg liegen.
  const grenzeBei = (z) => Math.max(2, Math.min(halbBei(-1, z), halbBei(1, z)) - breiteBei(z) / 2 - 4.5);

  // Der nächste Punkt des Wegs: ein Stück zur Seite – in die Richtung, die
  // der Abschnitt will, sonst gewürfelt; nie fast geradeaus, nie weiter, als
  // es zu lenken ist, und vom Rand weg zurück zur Mitte.
  function schritt(z, richtung = 0, weit = 1) {
    const letzter = W.weg[W.weg.length - 1];
    const reich = reichBis(z) * weit;
    const wurf = zufall.zahl() * 2 - 1;
    const r = richtung || (wurf < 0 ? -1 : 1);
    const grenze = grenzeBei(z);
    // Später geht es fast immer so weit zur Seite, wie es sich lenken lässt.
    const min = lerp(0.35, 0.8, engeBei(z));
    const weg = (min + (1 - min) * Math.abs(wurf)) * reich;
    let o = letzter.o + r * weg;
    if (Math.abs(o) > grenze) o = letzter.o - r * weg * (richtung ? 0.3 : 1);
    o = clamp(o, -grenze, grenze);
    return clamp(o, letzter.o - reich, letzter.o + reich);
  }

  function wegPunkt(z, o) {
    W.weg.push({ z, o });
    return o;
  }

  function marke(art, z0, z1, mehr = {}) {
    W.marken.push({ art, z0, z1, min: 99, drin: true, fertig: false, ...mehr });
  }

  // Ein Felsturm. Sein Netz ist auf Flughöhe so breit wie r.
  function turm(z, x, r) {
    const d = { art: "turm", z, x, r, h: lerp(60, 98, zufall.zahl()), form: Math.floor(zufall.zahl() * 4), dreh: zufall.zahl() * Math.PI * 2 };
    W.dinge.push(d);
    marke("turm", z - r - 3, z + r + 3, { ding: d });
    return d;
  }

  // Wie lange es zwischen zwei Hindernissen dauert: am Anfang gut anderthalb
  // Sekunden, am Schluss eine Dreiviertelsekunde.
  const folgeBei = (z, k) => tempoBei(z) * lerp(1.6, 0.74, engeBei(z)) * (0.9 + 0.3 * zufall.zahl());

  // Felsnasen: abwechselnd von links und rechts ragt ein Stück Wand herein,
  // der Weg schlängelt sich dazwischen durch. Später drückt auch die Wand
  // gegenüber.
  function nasen(z0, k) {
    const n = 2 + Math.floor(zufall.zahl() * 3);
    const abstand = folgeBei(z0, k);
    let s = zufall.zahl() < 0.5 ? -1 : 1;
    for (let i = 0; i < n; i += 1) {
      const z = z0 + 26 + i * abstand;
      const o = wegPunkt(z, schritt(z, -s));
      const halb = breiteBei(z) / 2;
      const luft = 0.5 + zufall.zahl() * lerp(5, 0.7, k);
      const platt = 2 + 4 * zufall.zahl();
      W.buckel.push({ art: "nase", s, z, an: lerp(27, 17, k) * (0.8 + 0.5 * zufall.zahl()), ab: 10 + 8 * zufall.zahl(), platt, o: o + s * (halb + luft) });
      marke("nase", z - platt / 2 - 5, z + platt / 2 + 5, { s });
      if (zufall.zahl() < lerp(0.1, 0.8, k)) {
        const luft2 = 1 + zufall.zahl() * lerp(9, 2.2, k);
        W.buckel.push({ art: "nase", s: -s, z, an: 30, ab: 24, platt: 8, o: o - s * (halb + luft2) });
      }
      s = -s;
    }
    return 26 + (n - 1) * abstand + 12;
  }

  // Felstürme mitten in der Schlucht: links oder rechts vorbei. Später
  // stehen zwei nebeneinander, und der Weg führt zwischen ihnen durch.
  function tuerme(z0, k, einzeln = false) {
    const n = einzeln ? 1 : 1 + Math.floor(zufall.zahl() * lerp(1.5, 3.3, k));
    const abstand = folgeBei(z0, k);
    for (let i = 0; i < n; i += 1) {
      const z = z0 + 24 + i * abstand;
      const o = wegPunkt(z, schritt(z));
      const halb = breiteBei(z) / 2;
      const r = lerp(3.2, lerp(5, 7.5, k), zufall.zahl());
      const luft = 0.8 + zufall.zahl() * lerp(5, 0.6, k);
      let q = zufall.zahl() < 0.5 ? -1 : 1;
      // Lieber dorthin, wo Platz ist – ein Turm in der Wand wäre keiner.
      if (q * (o + q * (halb + luft + r)) > halbBei(q, z) - r * 0.5) q = -q;
      turm(z, mitteBei(z) + o + q * (halb + luft + r), r);
      const zwei = zufall.zahl() < lerp(0, 0.65, k);
      const r2 = lerp(3, 6, zufall.zahl());
      const luft2 = 0.8 + zufall.zahl() * lerp(7, 1.2, k);
      const o2 = o - q * (halb + luft2 + r2);
      if (zwei && -q * o2 < halbBei(-q, z) - r2 * 0.5) turm(z + (zufall.zahl() - 0.5) * 6, mitteBei(z) + o2, r2);
    }
    return 24 + (n - 1) * abstand + 12;
  }

  // Eine Klamm: Beide Wände rücken an den Weg heran, und der windet sich.
  function klamm(z0, k) {
    const lang = tempoBei(z0) * lerp(1.7, 2.7, zufall.zahl());
    const zA = z0 + 34;
    const zE = zA + lang;
    wegPunkt(zA, schritt(zA));
    wegPunkt((zA + zE) / 2, schritt((zA + zE) / 2));
    wegPunkt(zE, schritt(zE));
    const breit = breiteBei(zA) + 1.4 + zufall.zahl() * lerp(7, 1.6, k);
    W.buckel.push({ art: "klamm", z0: zA, z1: zE, an: 28, halb: breit / 2 });
    return 34 + lang + 26;
  }

  // Ein Felsbogen: Die Wände greifen kurz ganz nah zusammen, darüber liegt
  // ein Sturz aus Fels. Durch die Öffnung.
  function felsbogen(z0, k) {
    const z = z0 + 36;
    const o = wegPunkt(z, schritt(z, 0, 0.8));
    const halb = breiteBei(z) / 2 * lerp(1.45, 1.1, k) + 0.8;
    W.buckel.push({ art: "klamm", z0: z - 3, z1: z + 3, an: 13, halb });
    W.zier.push({ art: "sturz", z, x: mitteBei(z) + o, form: Math.floor(zufall.zahl() * 3), dreh: zufall.zahl() });
    marke("bogen", z - 7, z + 7, {});
    return 72;
  }

  // Ein Massiv teilt die Schlucht: Auf einer Seite geht es breit vorbei –
  // dort führt der Weg –, auf der anderen bleibt ein Spalt.
  function gabel(z0, k) {
    const lang = Math.round(lerp(150, 230, zufall.zahl()) / DZ) * DZ;
    const zA = Math.ceil((z0 + 40) / DZ) * DZ;
    const zB = zA + lang;
    const A = lerp(6.5, 10.5, zufall.zahl());
    const wurf = zufall.zahl();
    const breit = breiteBei(zA) + lerp(8, 2.6, k) + zufall.zahl() * 3;
    const spalt = lerp(8.4, 5.8, k);
    const form = (z) => {
      const t = Math.abs(clamp((z - zA) / lang, 0, 1) * 2 - 1);
      return A * Math.pow(Math.max(0, 1 - Math.pow(t, 2.6)), 1 / 2.2);
    };
    const z1 = zA + lang * 0.22;
    const z2 = zA + lang * 0.5;
    const z3 = zA + lang * 0.78;
    const o1 = wegPunkt(z1, schritt(z1, 0, 0.7));
    // Die breite Seite ist die, auf der der Weg schon liegt – so steht das
    // Massiv in der Schlucht und nicht in der Wand.
    const q = Math.abs(o1) > 2 ? Math.sign(o1) : (wurf < 0.5 ? -1 : 1);
    const om = o1 - q * (form(z1) + breit / 2);
    wegPunkt(z2, om + q * (A + breit / 2));
    wegPunkt(z3, om + q * (form(z3) + breit / 2));
    const m = { zA, zB, om, q, breit, spalt, form, hoch: lerp(62, 86, zufall.zahl()), nr: W.massive.length };
    W.massive.push(m);
    // Auf der breiten Seite bleibt die Wand so nah, wie der Weg breit ist.
    W.buckel.push({ art: "klamm", z0: z1, z1: z3, an: 30, halb: breit / 2, nur: q });
    marke("spalt", zA + lang * 0.2, zB - lang * 0.2, { s: -q, massiv: m });
    return 40 + lang + 20;
  }

  // Eine Steinbrücke quer durch die Schlucht: durch die Öffnung, an den
  // Pfeilern vorbei. Wo neben der Öffnung kaum Platz bleibt, steht statt
  // eines Pfeilers die Wand.
  function bruecke(z0, k) {
    const z = z0 + 44;
    // Durch die Öffnung geht es gerade: Sonst stünde ein Pfeiler im Weg.
    const o = wegPunkt(z - 9, schritt(z - 9, 0, 0.8));
    wegPunkt(z + 9, o);
    const a = breiteBei(z) / 2 * lerp(1.5, 1.12, k) + 0.7;
    const xm = mitteBei(z) + o;
    const pfeiler = [];
    for (const s of [-1, 1]) {
      const px = xm + s * (a + PFEILER / 2);
      const platz = s * (mitteBei(z) + s * halbBei(s, z) - px) - PFEILER / 2;
      if (platz < 6.5) {
        W.buckel.push({ art: "nase", s, z, an: 5, ab: 5, platt: BRUECKE_TIEF + 2, o: o + s * a });
        continue;
      }
      pfeiler.push({ x: px, b: PFEILER });
      if (platz > 26) pfeiler.push({ x: px + s * (platz * (0.4 + 0.2 * zufall.zahl()) + PFEILER / 2), b: PFEILER });
    }
    pfeiler.sort((p, r) => p.x - r.x);
    const d = { art: "bruecke", z, x: xm, pfeiler, tief: BRUECKE_TIEF };
    W.dinge.push(d);
    for (const p of pfeiler) marke("pfeiler", z - BRUECKE_TIEF / 2 - 3, z + BRUECKE_TIEF / 2 + 3, { ding: d, pfeiler: p });
    return 84;
  }

  // Tannen auf Felsbändern: Ihr Wipfel ragt in den Weg, dahinter drückt die
  // Wand nach.
  function tannen(z0, k) {
    const n = 2 + Math.floor(zufall.zahl() * 3);
    const abstand = folgeBei(z0, k);
    let s = zufall.zahl() < 0.5 ? -1 : 1;
    for (let i = 0; i < n; i += 1) {
      const z = z0 + 26 + i * abstand;
      const o = wegPunkt(z, schritt(z, -s));
      const halb = breiteBei(z) / 2;
      const luft = 0.8 + zufall.zahl() * lerp(4.5, 0.6, k);
      const to = o + s * (halb + luft + TANNE_R);
      if (s * to < halbBei(s, z) - 2) {
        const d = { art: "tanne", z, x: mitteBei(z) + to, r: TANNE_R, s, dreh: zufall.zahl() * 6.28 };
        W.dinge.push(d);
        marke("tanne", z - TANNE_R - 3, z + TANNE_R + 3, { ding: d });
        // Das Felsband, auf dem sie steht: Die Wand kommt bis dicht dahinter.
        W.buckel.push({ art: "nase", s, z, an: 15, ab: 12, platt: 7, o: to + s * (TANNE_R + 2.2) });
        // Manchmal eine zweite, ein Stück dahinter an der Wand.
        if (zufall.zahl() < 0.5) {
          const z2 = z + 5 + zufall.zahl() * 4;
          const d2 = { art: "tanne", z: z2, x: mitteBei(z2) + to + s * (1 + zufall.zahl() * 1.5), r: TANNE_R, s, dreh: zufall.zahl() * 6.28 };
          W.dinge.push(d2);
          marke("tanne", z2 - TANNE_R - 3, z2 + TANNE_R + 3, { ding: d2 });
        }
      } else {
        W.buckel.push({ art: "nase", s, z, an: 18, ab: 12, platt: 4, o: o + s * (halb + luft) });
        marke("nase", z - 7, z + 7, { s });
      }
      if (zufall.zahl() < 0.6) s = -s;
    }
    return 26 + (n - 1) * abstand + 14;
  }

  // Serpentinen: Der Gang schlägt Haken, links, rechts, links – so weit, wie
  // es sich gerade noch lenken lässt, und später immer dichter.
  function kurven(z0) {
    const e = engeBei(z0);
    const n = 3 + Math.floor(zufall.zahl() * lerp(2, 5, e));
    let s = zufall.zahl() < 0.5 ? -1 : 1;
    let z = z0;
    for (let i = 0; i < n; i += 1) {
      z += tempoBei(z) * lerp(1.35, 0.72, e) * (0.9 + 0.25 * zufall.zahl());
      wegPunkt(z, schritt(z, s, 1));
      s = -s;
    }
    return z - z0 + 20;
  }

  // Ein Stück ohne Hindernis: Luft holen, schauen.
  function offen(z0) {
    wegPunkt(z0 + 70, schritt(z0 + 70));
    return 130;
  }

  const ABSCHNITTE = { nasen, tuerme, klamm, bogen: felsbogen, gabel, bruecke, tannen, kurven, offen };

  // Was nur schön ist, zwischen zwei Abschnitten: eine Hängebrücke hoch
  // oben, eine Seilbahn, ein Wasserfall, ein Trupp Dohlen.
  function zierDazu(z) {
    const wurf = zufall.zahl();
    const wo = zufall.zahl();
    const s = zufall.zahl() < 0.5 ? -1 : 1;
    if (wurf < 0.26) W.zier.push({ art: "wasserfall", z: Math.round(z / DZ) * DZ, s, breit: 4 + wo * 5 });
    else if (wurf < 0.44) W.zier.push({ art: "haengebruecke", z, u: 52 + wo * 16 });
    else if (wurf < 0.56) W.zier.push({ art: "seilbahn", z, u: 66 + wo * 14, phase: wo * 40 });
    else if (wurf < 0.84) W.zier.push({ art: "dohlen", z, s, u: 34 + wo * 30, n: 5 + Math.floor(wo * 6) });
  }

  function abschnitt() {
    const z0 = W.bis;
    // Kurz vor dem Tal ist Schluss: Der Weg führt geradeaus hinaus auf die
    // Wiese. Davor nur noch, was vor dem Ausgang Platz hat.
    const platz = Z_ENDE - 150 - z0;
    if (platz < 90) {
      const letzter = W.weg[W.weg.length - 1];
      wegPunkt(Math.max(letzter.z + 60, Z_ENDE - 40), letzter.o * 0.5);
      wegPunkt(Z_MAX, 0);
      W.zier.push({ art: "dorf", z: Z_ENDE + 520 });
      W.fertig = true;
      return;
    }
    const k = schwereBei(z0);
    let art = "tuerme";
    let lang = 0;
    if (W.nr === 0) {
      // Zum Verstehen: ein einzelner Turm.
      lang = tuerme(z0, k, true);
    } else {
      const wahl = [["bogen", 1.7], ["bruecke", 1.5]];
      if (platz > 380) {
        const e = engeBei(z0);
        wahl.push(["nasen", 3], ["tuerme", lerp(3, 1.4, e)]);
        if (z0 > 420) wahl.push(["kurven", lerp(2, 5, e)]);
        if (z0 > 520) wahl.push(["tannen", 2.3]);
        if (z0 > 680) wahl.push(["klamm", 2]);
        if (z0 > 1000) wahl.push(["gabel", 1.9]);
        if (z0 > 600 && e < 0.7) wahl.push(["offen", 0.45]);
      }
      // Bögen erst nach den ersten 800 Metern, Brücken noch später – ausser
      // kurz vor dem Tal, wo nichts Längeres mehr passt.
      const frueh = (name) => (name === "bogen" && z0 < 820) || (name === "bruecke" && z0 < 1250);
      const moeglich = wahl.filter(([name]) => name !== W.vorher && !frueh(name));
      let los = zufall.zahl() * moeglich.reduce((summe, [, gewicht]) => summe + gewicht, 0);
      art = moeglich[0][0];
      for (const [name, gewicht] of moeglich) {
        art = name;
        los -= gewicht;
        if (los <= 0) break;
      }
      lang = ABSCHNITTE[art](z0, k);
    }
    W.vorher = art;
    W.nr += 1;
    const e = engeBei(z0);
    const pause = tempoBei(z0) * lerp(1.5, 0.4, e);
    zierDazu(z0 + lang + pause * 0.5);
    // Auch zwischen zwei Abschnitten schlägt der Gang später einen Haken.
    if (e > 0.25 && zufall.zahl() < e) wegPunkt(z0 + lang + pause * 0.6, schritt(z0 + lang + pause * 0.6));
    W.bis = z0 + lang + pause;
    W.dinge.sort((a, b) => a.z - b.z);
    W.marken.sort((a, b) => a.z0 - b.z0);
  }

  // ---------------------------------------------------------------------------
  // Die Knoten
  // ---------------------------------------------------------------------------
  const knotenZ = (k) => Z_MIN + k * DZ;

  // Wie weit ein Buckel an der Stelle z hereinragt, 0 bis 1.
  function buckelForm(b, z) {
    if (b.art === "nase") {
      const vorn = b.z - b.platt / 2;
      const hinten = b.z + b.platt / 2;
      if (z <= vorn) return weich(vorn - b.an, vorn, z);
      if (z >= hinten) return 1 - weich(hinten, hinten + b.ab, z);
      return 1;
    }
    return weich(b.z0 - b.an, b.z0, z) * (1 - weich(b.z1, b.z1 + b.an, z));
  }
  const buckelVon = (b) => (b.art === "nase" ? b.z - b.platt / 2 - b.an : b.z0 - b.an);
  const buckelBis = (b) => (b.art === "nase" ? b.z + b.platt / 2 + b.ab : b.z1 + b.an);

  /*
   * Die Knoten bis zur Stelle bisZ backen. Erst die glatte Schlucht, dann
   * was hereinragt, dann ein wenig Rauheit – und zum Schluss weicht jede
   * Wand so weit zurück, dass der Weg auf seiner Breite frei ist. Gebacken
   * wird nur, wo der Weg schon feststeht (bis zu seinem letzten Punkt).
   */
  function backe(bisZ) {
    const ende = Math.min(KNOTEN, Math.floor((Math.min(bisZ, Z_MAX) - Z_MIN) / DZ) + 1);
    for (let k = W.fest; k < ende; k += 1) {
      const z = knotenZ(k);
      const mitte = mitteBei(z);
      const weg = mitte + versatzBei(z);
      const halb = breiteBei(z) / 2 + 0.25;
      const tal = talBei(z);
      let l = mitte - halbBei(-1, z);
      let r = mitte + halbBei(1, z);
      W.mitte[k] = mitte;
      W.boden[k] = bodenBei(z);
      W.glattL[k] = l;
      W.glattR[k] = r;
      W.hoch[k] = lerp(1, 0.3, tal);
      W.randL[k] = randBei(-1, z);
      W.randR[k] = randBei(1, z);
      for (const b of W.buckel) {
        if (z <= buckelVon(b) || z >= buckelBis(b)) continue;
        const f = buckelForm(b, z);
        if (b.art === "nase") {
          const ziel = mitte + b.o;
          if (b.s < 0) l = Math.max(l, lerp(l, ziel, f));
          else r = Math.min(r, lerp(r, ziel, f));
        } else {
          if (b.nur !== 1) l = Math.max(l, lerp(l, weg - b.halb, f));
          if (b.nur !== -1) r = Math.min(r, lerp(r, weg + b.halb, f));
        }
      }
      // Der Gang: Auf Flughöhe rückt die Wand an den Weg heran – nur nicht
      // auf der Seite eines Massivs, dort bleibt der Spalt. Vor und hinter
      // dem Massiv geht das über gut hundert Meter ineinander über: Rückte
      // die Wand auf einmal heran, stünde sie quer im Weg.
      const gang = gangBei(z);
      let offenL = 0;
      let offenR = 0;
      for (const m of W.massive) {
        const w = weich(m.zA - 110, m.zA - 10, z) * (1 - weich(m.zB + 10, m.zB + 110, z));
        if (m.q > 0) offenL = Math.max(offenL, w);
        else offenR = Math.max(offenR, w);
      }
      l = lerp(Math.max(l, weg - gang), l, offenL);
      r = lerp(Math.min(r, weg + gang), r, offenR);
      const rauh = lerp(2.2, 1.4, engeBei(z)) * (1 - tal);
      l += (hashGanz(k * 2) - 0.5) * rauh;
      r += (hashGanz(k * 2 + 1) - 0.5) * rauh;

      // Ein Massiv: seine zwei Flanken, und die Wände um es herum.
      let il = 0;
      let ir = 0;
      let ih = 0;
      for (const m of W.massive) {
        if (z < m.zA || z > m.zB) continue;
        const a = m.form(z);
        const cm = mitte + m.om;
        il = cm - a + (a > 1 ? (hashGanz(k * 2 + 7001) - 0.5) * 1.4 : 0);
        ir = cm + a + (a > 1 ? (hashGanz(k * 2 + 7002) - 0.5) * 1.4 : 0);
        // Am Weg weicht auch das Massiv zurück.
        if (m.q > 0) ir = Math.min(ir, weg - halb);
        else il = Math.max(il, weg + halb);
        // Ist nichts mehr übrig, schrumpft es neben dem Weg auf null – nicht in
        // seiner Mitte, sonst ragte zwischen zwei Knoten eine Spitze herein.
        if (ir - il < 0.6) {
          const c = m.q > 0 ? Math.min(cm, weg - halb) : Math.max(cm, weg + halb);
          il = c;
          ir = c;
        }
        ih = ir > il ? 44 + (m.hoch - 44) * clamp((ir - il) / 9, 0, 1) : 0;
        // Der Spalt: in der Mitte des Massivs gleich breit, an den Enden
        // öffnet er sich zur Schlucht.
        const f = weich(m.zA + 0.04 * (m.zB - m.zA), m.zA + 0.2 * (m.zB - m.zA), z) * (1 - weich(m.zB - 0.2 * (m.zB - m.zA), m.zB - 0.04 * (m.zB - m.zA), z));
        const breit = m.spalt + hashGanz(k + 9001) * 1.1;
        if (m.q > 0) l = lerp(l, il - breit, f);
        else r = lerp(r, ir + breit, f);
        if (ir > il) {
          if (m.q > 0) l = Math.min(l, il - Math.min(breit, m.spalt));
          else r = Math.max(r, ir + Math.min(breit, m.spalt));
        }
      }
      W.inselL[k] = il;
      W.inselR[k] = ir;
      W.inselH[k] = ih;

      // Der Weg ist frei.
      l = Math.min(l, weg - halb);
      r = Math.max(r, weg + halb);
      W.wandL[k] = l;
      W.wandR[k] = r;
      // Der Bach liegt zwischen den Wänden, wo Platz ist.
      W.fluss[k] = (l + r) / 2;
      W.flussHalb[k] = clamp((r - l) * 0.17, 1.4, 8) * lerp(1, 2.4, tal);
      // Die Felsbänder weiter oben kommen und gehen.
      W.simsL[k] = 9 * Math.pow(Math.max(0, Math.sin(z / 71 + W.saat[5] * 6.28)), 1.5);
      W.simsR[k] = 9 * Math.pow(Math.max(0, Math.sin(z / 83 + W.saat[6] * 6.28)), 1.5);
    }
    // Der Bach in weichen Bögen: über ein paar Knoten gemittelt.
    for (let k = Math.max(2, W.fest - 2); k < ende - 2; k += 1) {
      W.fluss[k] = (W.wandL[k - 2] + W.wandR[k - 2] + W.wandL[k] + W.wandR[k] + W.wandL[k + 2] + W.wandR[k + 2]) / 6;
      const platz = Math.min(W.wandR[k] - W.fluss[k], W.fluss[k] - W.wandL[k]);
      W.flussHalb[k] = Math.min(W.flussHalb[k], Math.max(1, platz - 0.6));
    }
    W.fest = Math.max(W.fest, ende);
  }

  // Türme und Tannen, an denen der Weg inzwischen feststeht: Steht einer
  // doch zu nah, wird er schlanker (oder rückt zur Seite).
  function raeumeWeg(bisZ) {
    for (; W.zuPruefen < W.dinge.length; W.zuPruefen += 1) {
      const d = W.dinge[W.zuPruefen];
      if (d.z + 14 > bisZ) break;
      if (d.art !== "turm" && d.art !== "tanne") continue;
      let fehlt = 0;
      for (let dz = -d.r - 3; dz <= d.r + 3; dz += 0.5) {
        const z = d.z + dz;
        const luft = Math.hypot(wegBei(z) - d.x, dz) - d.r;
        fehlt = Math.max(fehlt, breiteBei(z) / 2 + 0.05 - luft);
      }
      if (fehlt <= 0) continue;
      if (d.art === "turm" && d.r - fehlt >= 2.4) d.r -= fehlt;
      else d.x += (d.x < wegBei(d.z) ? -1 : 1) * (fehlt + 0.4);
    }
  }

  function weltBis(z) {
    const ziel = Math.min(z, Z_MAX);
    while (!W.fertig && W.weg[W.weg.length - 1].z < ziel + 40) abschnitt();
    const steht = W.weg[W.weg.length - 1].z;
    // dinge ist nach z geordnet – aber raeumeWeg zählt nur weiter, und ein
    // Abschnitt stellt nie etwas vor den vorigen.
    raeumeWeg(W.fertig ? Infinity : steht);
    backe(W.fertig ? Z_MAX : steht);
  }

  // Die gewürfelte Schlucht in Worten: was auf den ersten Kilometern steht.
  // Im Turnier bekommen alle denselben Text.
  function weltText() {
    weltBis(1800);
    return W.dinge.slice(0, 36).map((d) => `${d.art[0]}${d.z.toFixed(0)}/${d.x.toFixed(1)}`).join(" ")
      + " | " + W.buckel.slice(0, 24).map((b) => `${b.art[0]}${(b.z ?? b.z0).toFixed(0)}`).join(" ")
      + " | " + W.massive.slice(0, 4).map((m) => `${m.zA}-${m.zB}${m.q > 0 ? "r" : "l"}`).join(" ")
      + " | " + W.weg.slice(2, 20).map((p) => p.o.toFixed(1)).join(",");
  }

  // ---------------------------------------------------------------------------
  // Wo Fels ist
  // ---------------------------------------------------------------------------
  // Ein Wert zwischen zwei Knoten.
  function knoten(feldK, z) {
    const k = clamp((z - Z_MIN) / DZ, 0, KNOTEN - 1.001);
    const i = Math.floor(k);
    return feldK[i] + (feldK[i + 1] - feldK[i]) * (k - i);
  }

  // Das Profil der Wand über der Flughöhe: in welcher Höhe über dem Bach
  // (oder, mit einer 1 dahinter, über dem Rand) sie wie weit zurückweicht.
  // Dieselben Zahlen baut kachelBauen in die Reihen. Darunter das Ufer: wie
  // weit vom Bach zur Wand, und wie hoch dort.
  const OBEN = [[38, 0, 0], [46, 0, 2.7], [58, 0, 5], [76, 0, 8.5], [-9, 1, 11], [0, 1, 13.5], [4, 1, 30], [30, 1, 84], [85, 1, 200]];
  const UNTEN = [[0, -0.3], [0.22, 1.6], [0.5, 5.5], [0.78, 12], [0.94, 18.5], [1, 23.5]];
  // Zu den Reihen von OBEN: wie weit sie zur glatten Schlucht hin auslaufen,
  // und die Mitte ihrer Rauheit (GLATT und RAUH bei den Kacheln).
  const OBEN_GLATT = [0, 0.3, 0.6, 0.9, 1, 1, 1, 1, 1];
  const OBEN_RAUH = [0.3, 1.2, 1.5, 1.7, 1.7, 2, 4, 7, 12];

  // Die Höhe des Geländes an einer Stelle – für die Schatten, und damit
  // Tannen und Hütten auf dem Boden stehen.
  function hoeheBei(x, z) {
    const k = clamp((z - Z_MIN) / DZ, 0, KNOTEN - 1.001);
    const i = Math.floor(k);
    const f = k - i;
    const von = (feldK) => feldK[i] + (feldK[i + 1] - feldK[i]) * f;
    const boden = von(W.boden);
    const hoch = von(W.hoch);
    const l = von(W.wandL);
    const r = von(W.wandR);
    if (x > l && x < r) {
      const il = von(W.inselL);
      const ir = von(W.inselR);
      if (ir > il && x > il && x < ir) return boden + von(W.inselH) * Math.min(1, Math.min(x - il, ir - x) / 2 + 0.5);
      // Das Ufer steigt vom Bach zur Wand.
      const fl = von(W.fluss);
      const fh = von(W.flussHalb);
      const s = x < fl ? -1 : 1;
      const rand = fl + s * fh;
      const wand = s < 0 ? l : r;
      const t = clamp((x - rand) / (wand - rand || 1), 0, 1);
      if (s * (x - rand) <= 0) return boden;
      for (let j = 1; j < UNTEN.length; j += 1) {
        if (t <= UNTEN[j][0]) {
          const q = (t - UNTEN[j - 1][0]) / (UNTEN[j][0] - UNTEN[j - 1][0]);
          return boden + lerp(UNTEN[j - 1][1], UNTEN[j][1], q) * hoch;
        }
      }
      return boden + 23.5 * hoch;
    }
    const s = x <= l ? -1 : 1;
    const aus = s < 0 ? l - x : x - r;
    const h = von(s < 0 ? W.randL : W.randR);
    // Wie im Netz (wandEcke): Weiter oben steht die Wand dort, wo die glatte
    // Schlucht sie hat – eine Nase läuft aus –, und ein Felsband schiebt
    // alles darüber hinaus. Die Rauheit zählt mit ihrer Mitte.
    const glatt = Math.max(0, s * (von(s < 0 ? W.glattL : W.glattR) - (s < 0 ? l : r)));
    const sims = von(s < 0 ? W.simsL : W.simsR);
    let u0 = 38;
    let a0 = 0;
    for (let n = 0; n < OBEN.length; n += 1) {
      const u = OBEN[n][1] ? h + OBEN[n][0] : OBEN[n][0];
      const a = OBEN[n][2] + glatt * OBEN_GLATT[n] + (n >= 3 && n <= 6 ? sims : 0) + OBEN_RAUH[n];
      if (aus <= a) return boden + lerp(u0, u, clamp((aus - a0) / (a - a0 || 1), 0, 1)) * hoch;
      u0 = u;
      a0 = a;
    }
    return boden + u0 * hoch;
  }

  // Die Sonne steht vorn links über dem Rand.
  const SONNE = (() => {
    const v = [-0.42, 0.6, 0.68];
    const l = Math.hypot(v[0], v[1], v[2]);
    return v.map((w) => w / l);
  })();
  const SONNE_FLACH = Math.hypot(SONNE[0], SONNE[2]);
  const SONNE_X = SONNE[0] / SONNE_FLACH;
  const SONNE_Z = SONNE[2] / SONNE_FLACH;
  const SONNE_STEIG = SONNE[1] / SONNE_FLACH;
  const STRAHL_WEIT = [4, 10, 18, 30, 46, 68, 96, 132, 180, 240];

  // Wie viel Sonne ein Punkt bekommt, 0 bis 1: Ein Strahl zur Sonne, Stück
  // um Stück – steht Gelände darüber, liegt der Punkt im Schatten.
  function sonneBei(x, y, z) {
    let hell = 1;
    for (const t of STRAHL_WEIT) {
      const h = hoeheBei(x + SONNE_X * t, z + SONNE_Z * t);
      hell = Math.min(hell, (y + SONNE_STEIG * t - h) / (2.5 + 0.07 * t) + 0.5);
      if (hell <= 0) return 0;
    }
    return Math.min(1, hell);
  }

  // Ab welcher Höhe an einer Stelle die Sonne scheint.
  function schattenBei(x, z) {
    const boden = knoten(W.boden, z);
    let unten = 0;
    let oben = 140;
    if (sonneBei(x, boden + 1, z) > 0.5) return boden - 20;
    for (let i = 0; i < 6; i += 1) {
      const m = (unten + oben) / 2;
      if (sonneBei(x, boden + m, z) > 0.5) oben = m;
      else unten = m;
    }
    return boden + oben;
  }

  /*
   * Wie nah der nächste Fels ist, von der Stelle (x, z) auf Flughöhe aus –
   * die Zahl, um die sich alles dreht. Zurück kommt der Abstand; umSeite
   * sagt, auf welcher Seite er liegt. Eine schräge Wand ist näher, als sie
   * zur Seite hin aussieht – das ist eingerechnet.
   */
  let umSeite = 0;
  function abstandBei(x, z) {
    const k = clamp((z - Z_MIN) / DZ, 0, KNOTEN - 1.001);
    const i = Math.floor(k);
    const f = k - i;
    const l0 = W.wandL[i];
    const l1 = W.wandL[i + 1];
    const r0 = W.wandR[i];
    const r1 = W.wandR[i + 1];
    const links = (x - (l0 + (l1 - l0) * f)) / Math.hypot(1, (l1 - l0) / DZ);
    const rechts = ((r0 + (r1 - r0) * f) - x) / Math.hypot(1, (r1 - r0) / DZ);
    let ab = links;
    umSeite = -1;
    if (rechts < ab) { ab = rechts; umSeite = 1; }
    // Das Massiv.
    const a0 = W.inselL[i];
    const a1 = W.inselL[i + 1];
    const b0 = W.inselR[i];
    const b1 = W.inselR[i + 1];
    if (b0 > a0 || b1 > a1) {
      const il = a0 + (a1 - a0) * f;
      const ir = b0 + (b1 - b0) * f;
      if (ir > il) {
        const d = x < (il + ir) / 2
          ? (il - x) / Math.hypot(1, (a1 - a0) / DZ)
          : (x - ir) / Math.hypot(1, (b1 - b0) / DZ);
        if (d < ab) { ab = d; umSeite = x < (il + ir) / 2 ? 1 : -1; }
      }
    }
    // Türme, Tannen, Pfeiler in Reichweite.
    for (let n = W.von; n < W.dinge.length; n += 1) {
      const d = W.dinge[n];
      if (d.z > z + 30) break;
      if (d.z < z - 30) continue;
      const dd = dingAbstand(d, x, z);
      if (dd < ab) { ab = dd; umSeite = dingSeite; }
    }
    return ab;
  }

  let dingSeite = 0;
  let dingPfeiler = null;
  function dingAbstand(d, x, z) {
    if (d.art === "bruecke") {
      let ab = 99;
      const dz = Math.max(0, Math.abs(z - d.z) - d.tief / 2);
      for (const p of d.pfeiler) {
        const dx = Math.max(0, Math.abs(x - p.x) - p.b / 2);
        const dd = Math.hypot(dx, dz);
        if (dd < ab) { ab = dd; dingSeite = p.x < x ? -1 : 1; dingPfeiler = p; }
      }
      return ab;
    }
    dingSeite = d.x < x ? -1 : 1;
    return Math.hypot(x - d.x, z - d.z) - d.r;
  }

  // Was am Weg frei ist an der Stelle z: von links bis rechts. Für die
  // Piloten der Prüfung und der Vorführung.
  function freiBei(z) {
    const weg = wegBei(z);
    let l = knoten(W.wandL, z);
    let r = knoten(W.wandR, z);
    const il = knoten(W.inselL, z);
    const ir = knoten(W.inselR, z);
    if (ir > il) {
      if (weg >= (il + ir) / 2) l = Math.max(l, ir);
      else r = Math.min(r, il);
    }
    for (let n = z > state.z - 20 ? W.von : 0; n < W.dinge.length; n += 1) {
      const d = W.dinge[n];
      if (d.z > z + 12) break;
      if (d.z < z - 12) continue;
      if (d.art === "bruecke") {
        if (Math.abs(z - d.z) > d.tief / 2 + 1) continue;
        for (const p of d.pfeiler) {
          if (p.x < weg) l = Math.max(l, p.x + p.b / 2);
          else r = Math.min(r, p.x - p.b / 2);
        }
      } else if (Math.abs(z - d.z) < d.r) {
        const halb = Math.sqrt(d.r * d.r - (z - d.z) * (z - d.z));
        if (d.x < weg) l = Math.max(l, d.x + halb);
        else r = Math.min(r, d.x - halb);
      }
    }
    return { l, r };
  }

  // ---------------------------------------------------------------------------
  // Die Nähe zum Fels
  // ---------------------------------------------------------------------------
  // Wie nah eine Wand ist (s: -1 links, 1 rechts).
  function wandAbstand(s, x, z) {
    const k = clamp((z - Z_MIN) / DZ, 0, KNOTEN - 1.001);
    const i = Math.floor(k);
    const feldK = s < 0 ? W.wandL : W.wandR;
    const w = feldK[i] + (feldK[i + 1] - feldK[i]) * (k - i);
    return s * (w - x) / Math.hypot(1, (feldK[i + 1] - feldK[i]) / DZ);
  }

  // Ein Schub Punkte: knapp vorbei, oder durch den Spalt.
  function lohn(m) {
    let punkte = 0;
    let text = "";
    if (m.art === "spalt") {
      if (!m.drin) return;
      punkte = Math.round(SPALT_PUNKTE * state.serie);
      text = `Durch den Spalt +${punkte}`;
    } else {
      if (m.min >= HAAR) return;
      const q = clamp((HAAR - m.min) / (HAAR - KOERPER - 0.3), 0, 1);
      punkte = Math.round(lerp(HAAR_PUNKTE[0], HAAR_PUNKTE[1], q) * state.serie);
      text = `Haarscharf +${punkte}`;
    }
    state.roh += punkte;
    state.haarscharf += 1;
    state.serie = Math.min(SERIE_MAX, state.serie + 0.06);
    schrift(text, "#ffd76a", 24);
    ton("felsflug.haarscharf", { laut: 0.9 }, 140);
    kids()?.vibrate?.(12);
    if (ruhig() || state.phase === "zuschauen") return;
    // Ein Ruck, und die Zeit hält für einen Wimpernschlag den Atem an.
    state.stoss = Math.min(1, state.stoss + 0.35);
    state.schub = 1;
    state.zeitlupe = 0.2;
  }

  // Woran er gerade vorbeifliegt: an jeder Marke den kleinsten Abstand
  // festhalten, und dahinter abrechnen.
  function markenTakt() {
    const M = W.marken;
    const x = state.x;
    const z = state.z;
    while (W.markeVon < M.length && M[W.markeVon].fertig) W.markeVon += 1;
    for (let i = W.markeVon; i < M.length; i += 1) {
      const m = M[i];
      if (m.z0 > z) break;
      if (m.fertig) continue;
      if (z > m.z1) {
        m.fertig = true;
        lohn(m);
        continue;
      }
      let d = 99;
      if (m.art === "turm" || m.art === "tanne") {
        d = dingAbstand(m.ding, x, z);
      } else if (m.art === "pfeiler") {
        d = Math.hypot(Math.max(0, Math.abs(x - m.pfeiler.x) - m.pfeiler.b / 2), Math.max(0, Math.abs(z - m.ding.z) - m.ding.tief / 2));
      } else if (m.art === "spalt") {
        // Im Spalt ist, wer auf dessen Seite neben dem Massiv fliegt.
        const il = knoten(W.inselL, z);
        const ir = knoten(W.inselR, z);
        if (!(ir > il) || (m.s < 0 ? x > il : x < ir)) m.drin = false;
      } else if (m.art === "bogen") {
        d = Math.min(wandAbstand(-1, x, z), wandAbstand(1, x, z));
      } else {
        d = wandAbstand(m.s, x, z);
      }
      if (d < m.min) m.min = d;
    }
  }

  // Ein Schritt Nähe: wie nah, was das zählt, was die Serie tut. Beim
  // Zuschauen wird nur gezeigt, nicht gezählt – und nicht angeprallt.
  function naeheTakt(dt, zaehlt) {
    while (W.von < W.dinge.length && W.dinge[W.von].z < state.z - 34) W.von += 1;
    const ab = abstandBei(state.x, state.z);
    state.ab = ab;
    state.abSeite = umSeite;
    if (zaehlt && ab < KOERPER) {
      aufprall(umSeite);
      return;
    }
    const n = naeheBei(ab);
    if (n > 0) {
      state.ohneFels = 0;
      state.serie = Math.min(SERIE_MAX, state.serie + SERIE_AUF * n * dt);
    } else {
      state.ohneFels += dt;
      if (state.ohneFels > SERIE_GNADE) state.serie = Math.max(1, state.serie - SERIE_AB * dt);
    }
    state.serieBest = Math.max(state.serieBest, state.serie);
    state.roh += GRUND * (1 + (NAH_MAL - 1) * Math.pow(n, NAH_HOCH)) * state.serie * dt;
    markenTakt();
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  // Staub und Steinchen von der Wand, wenn er nah vorbeizieht: Sie entstehen
  // ein Stück voraus am Fels und bleiben zurück.
  function staub(seite, ab, n) {
    if (state.teile.length > 150 || ruhig()) return;
    const v = tempoBei(state.z);
    const voraus = 3 + Math.random() * 12;
    const z = state.z + voraus;
    const wand = seite < 0 ? knoten(W.wandL, z) : knoten(W.wandR, z);
    // Nur, wenn der Fels dort wirklich die Wand ist (und kein Turm).
    const x = Math.abs(wand - (state.x + seite * ab)) < 3 ? wand : state.x + seite * ab;
    const stein = Math.random() < 0.35;
    state.teile.push({
      x: x - seite * 0.2, y: state.y + (Math.random() - 0.5) * 3.2, z,
      vx: -seite * (0.6 + Math.random() * 2.2), vy: stein ? 1 + Math.random() * 2 : 0.4 + Math.random(), vz: v * (stein ? 0.25 : 0.06),
      fall: stein ? 9 : 0.4, r: stein ? 0.05 + Math.random() * 0.05 : 0.16 + Math.random() * 0.22 + n * 0.12,
      wachs: stein ? 0 : 0.9, farbe: stein ? [0.2, 0.17, 0.15] : [0.86, 0.81, 0.73], deck: stein ? 0.95 : 0.1 + 0.1 * n,
      leben: 0.35 + Math.random() * 0.3, max: 0.65,
    });
  }

  // Der Aufprall: eine Wolke aus Staub und Splittern.
  function wolke(x, y, z, seite) {
    const viele = ruhig() ? 8 : 26;
    for (let i = 0; i < viele; i += 1) {
      const stein = i % 3 === 0;
      const w = Math.random() * Math.PI * 2;
      const v = 2 + Math.random() * 9;
      state.teile.push({
        x, y, z,
        vx: -seite * Math.abs(Math.cos(w)) * v, vy: Math.sin(w) * v * 0.7 + 2, vz: 4 + Math.random() * 16,
        fall: stein ? 12 : 1.5, r: stein ? 0.08 + Math.random() * 0.1 : 0.35 + Math.random() * 0.6,
        wachs: stein ? 0 : 1.5, farbe: stein ? [0.22, 0.19, 0.17] : [0.86, 0.8, 0.72], deck: stein ? 1 : 0.32,
        leben: 0.9 + Math.random() * 0.8, max: 1.7,
      });
    }
  }

  // Eine Schrift am Flieger: Sie steigt ein Stück und vergeht.
  function schrift(text, farbe, gross) {
    state.schriften.push({ text, farbe, gross, leben: 1.25, max: 1.25 });
    if (state.schriften.length > 3) state.schriften.shift();
  }

  // ---------------------------------------------------------------------------
  // Die Kamera
  // ---------------------------------------------------------------------------
  // Hinter und über dem Flieger. Sie schaut dorthin, wohin die Schlucht
  // biegt, und legt sich mit ihm in die Kurve. Gezeichnet wird relativ zu
  // ihr: So rechnet die Grafikkarte nur mit kleinen Zahlen.
  const view = { cssW: 0, cssH: 0, dpr: 1, frei: 0, pw: 0, ph: 0, guete: 1, fest: false, langsam: 0, schnell: 0 };
  const kam = {
    x: 0, y: 0, z: 0, gier: 0, roll: 0, weit: 13, ueber: 4, glattX: 0, glattY: 0, fov: 1, seit: 1,
    rechts: [1, 0, 0], hoch: [0, 1, 0], vor: [0, 0, 1], tan: [1, 1], ort: new Float32Array(3),
    proj: new Float32Array(16), sicht: new Float32Array(16), pv: new Float32Array(16),
  };

  // Wohin die Kamera will: Abstand und Höhe über dem Flieger.
  function kameraZiel() {
    const quer = view.cssW >= view.cssH;
    let weit = quer ? 10.5 : 13;
    let ueber = quer ? 3.3 : 3.9;
    if (state.schritt === "start") { weit += 2.5; ueber += 0.9; }
    else if (state.schritt === "landung") { weit += 8; ueber += 3.5; }
    else if (state.schritt === "aus") { weit += 7; ueber += 2.5; }
    return { weit, ueber };
  }

  function kameraTakt(dt) {
    const ziel = kameraZiel();
    const k = 1 - Math.exp(-dt / 0.7);
    kam.weit += (ziel.weit - kam.weit) * k;
    kam.ueber += (ziel.ueber - kam.ueber) * k;
    // Der Blick geht ein Stück voraus, dorthin, wo der Gang hinführt.
    const voraus = 70;
    const zielX = lerp(state.x, wegBei(state.z + voraus), 0.6);
    const gierZiel = state.schritt === "start" || state.schritt === "landung" ? 0 : Math.atan2(zielX - state.x, voraus);
    kam.gier += (gierZiel - kam.gier) * (1 - Math.exp(-dt / 0.45));
    kam.glattX += (state.x - kam.glattX) * (1 - Math.exp(-dt / 0.13));
    kam.glattY += (state.y - kam.glattY) * (1 - Math.exp(-dt / 0.22));
    kam.x = kam.glattX - Math.sin(kam.gier) * kam.weit;
    kam.z = state.z - Math.cos(kam.gier) * kam.weit;
    kam.y = kam.glattY + kam.ueber;
    // Nicht in den Fels hinein.
    if (W.fest > 0 && kam.z > Z_MIN + DZ) {
      const l = knoten(W.wandL, kam.z) + 1.5;
      const r = knoten(W.wandR, kam.z) - 1.5;
      if (l < r) kam.x = clamp(kam.x, l, r);
    }
    const rollZiel = ruhig() ? 0 : state.roll * 0.42;
    kam.roll += (rollZiel - kam.roll) * (1 - Math.exp(-dt / 0.25));
  }

  function kameraSetzen() {
    const ziel = kameraZiel();
    kam.weit = ziel.weit;
    kam.ueber = ziel.ueber;
    kam.gier = 0;
    kam.roll = 0;
    kam.glattX = state.x;
    kam.glattY = state.y;
    kam.x = state.x;
    kam.y = state.y + kam.ueber;
    kam.z = state.z - kam.weit;
  }

  function kameraStellen() {
    const seit = view.cssW / Math.max(1, view.cssH);
    // 58 Grad in der Höhe – auf einem sehr breiten Bild weniger (zur Seite
    // höchstens 84), hochkant mehr (zur Seite mindestens 54). Mit dem Tempo
    // weitet sich der Blick, und bei «haarscharf» für einen Moment noch mehr.
    const flug = state.schritt === "flug" ? 1 : 0;
    const schnell = ruhig() ? 0 : clamp((tempoBei(state.z) - V0) / (V_MAX - V0), 0, 1) * flug;
    const grad = Math.PI / 180;
    let fov = 58 * grad;
    fov = Math.min(fov, 2 * Math.atan(Math.tan(42 * grad) / seit));
    fov = Math.max(fov, Math.min(1.7, 2 * Math.atan(Math.tan(27 * grad) / seit)));
    fov *= 1 + 0.12 * schnell + (ruhig() ? 0 : 0.05 * state.schub);
    kam.fov = fov;
    kam.seit = seit;
    const wackel = ruhig() ? 0 : state.stoss;
    const t = state.echt;
    const ax = (Math.sin(t * 61) * 0.2 + Math.sin(t * 37) * 0.16) * wackel;
    const ay = Math.sin(t * 53) * 0.24 * wackel;
    // Der Blick: ein wenig hinab, der Schlucht nach – hochkant flacher, dort
    // gehört die Höhe den Wänden.
    const nick = lerp(0.17, 0.1, clamp((1.15 - seit) / 0.6, 0, 1)) + (state.schritt === "landung" ? 0.1 : 0) + ay * 0.02;
    const gier = kam.gier + ax * 0.02;
    const fx = Math.sin(gier) * Math.cos(nick);
    const fy = -Math.sin(nick);
    const fz = Math.cos(gier) * Math.cos(nick);
    const ux = Math.sin(kam.roll) * Math.cos(gier);
    const uy = Math.cos(kam.roll);
    const uz = -Math.sin(kam.roll) * Math.sin(gier);
    // rechts = oben × vor, hoch = vor × rechts (x zeigt im Bild nach rechts).
    let rx = uy * fz - uz * fy;
    let ry = uz * fx - ux * fz;
    let rz = ux * fy - uy * fx;
    const rl = Math.hypot(rx, ry, rz);
    rx /= rl; ry /= rl; rz /= rl;
    const hx = fy * rz - fz * ry;
    const hy = fz * rx - fx * rz;
    const hz = fx * ry - fy * rx;
    kam.rechts = [rx, ry, rz];
    kam.hoch = [hx, hy, hz];
    kam.vor = [fx, fy, fz];
    kam.tan = [Math.tan(fov / 2) * seit, Math.tan(fov / 2)];
    kam.ort[0] = kam.x + ax;
    kam.ort[1] = kam.y + ay;
    kam.ort[2] = kam.z;
    // Das Auge sitzt im Ursprung: Die Programme ziehen kam.ort selbst ab.
    const s = kam.sicht;
    s[0] = rx; s[4] = ry; s[8] = rz; s[12] = 0;
    s[1] = hx; s[5] = hy; s[9] = hz; s[13] = 0;
    s[2] = -fx; s[6] = -fy; s[10] = -fz; s[14] = 0;
    s[3] = 0; s[7] = 0; s[11] = 0; s[15] = 1;
    const f = 1 / Math.tan(fov / 2);
    const NAH_EBENE = 0.5;
    const FERN = 2400;
    const p = kam.proj;
    p.fill(0);
    p[0] = f / seit; p[5] = f; p[10] = (FERN + NAH_EBENE) / (NAH_EBENE - FERN); p[11] = -1; p[14] = (2 * FERN * NAH_EBENE) / (NAH_EBENE - FERN);
    const pv = kam.pv;
    for (let c = 0; c < 4; c += 1) {
      for (let r = 0; r < 4; r += 1) {
        pv[c * 4 + r] = p[r] * s[c * 4] + p[4 + r] * s[c * 4 + 1] + p[8 + r] * s[c * 4 + 2] + p[12 + r] * s[c * 4 + 3];
      }
    }
  }

  // Wo ein Punkt der Welt im Bild steht (in CSS-Pixeln) – oder null, wenn er
  // hinter der Kamera liegt.
  function imBild(x, y, z) {
    const px = x - kam.ort[0];
    const py = y - kam.ort[1];
    const pz = z - kam.ort[2];
    const m = kam.pv;
    const w = m[3] * px + m[7] * py + m[11] * pz + m[15];
    if (w <= 0.01) return null;
    const cx = (m[0] * px + m[4] * py + m[8] * pz + m[12]) / w;
    const cy = (m[1] * px + m[5] * py + m[9] * pz + m[13]) / w;
    return { x: (cx * 0.5 + 0.5) * view.cssW, y: (0.5 - cy * 0.5) * view.cssH, w };
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Programme
  // ---------------------------------------------------------------------------
  let gl = null;
  const bild = { ok: false, verloren: false, prog: {}, netz: {}, rausch: null, leer: null };

  // Der Morgen: die Farben des Lichts. Die Sonne ist warm, der Himmel füllt
  // die Schatten kühl und blau, und von der Wand im Licht kommt ein warmer
  // Schein zurück auf die Wand im Schatten.
  const MORGEN = {
    licht: [1.78, 1.44, 1.0],
    himmelLicht: [0.3, 0.45, 0.8],
    prall: [0.36, 0.25, 0.15],
    nebel: [0.62, 0.74, 0.93],
    glut: [1.0, 0.84, 0.6],
    zenit: [0.2, 0.41, 0.78],
    horizont: [0.78, 0.86, 0.95],
    dichte: 1 / 620,
  };

  // Was alle Programme über das Licht wissen: Sonne, Himmel, Dunst. Fernes
  // wird hell – zur Sonne hin golden, sonst blau –, daran liest man die Tiefe.
  const LICHT = `
    uniform vec3 uSonne, uLicht, uHimmelLicht, uPrall, uNebel, uGlut;
    uniform float uDichte, uZeit;
    vec3 dunst(vec3 farbe, vec3 rel) {
      float weit = length(rel);
      float zurSonne = max(dot(rel / weit, uSonne), 0.0);
      vec3 nebel = mix(uNebel, uGlut, pow(zurSonne, 3.0) * 0.8);
      float f = 1.0 - exp(-weit * uDichte);
      f = max(f, smoothstep(1050.0, 1330.0, weit));
      return mix(farbe, nebel, f);
    }
    // Helles läuft weich aus, statt abzureissen.
    vec3 belichte(vec3 c) {
      vec3 x = max(c - 0.75, 0.0);
      return c - x + x / (1.0 + 2.2 * x);
    }
    // rel: der Ort von der Kamera aus – flach gesehene Flächen bekommen
    // einen kühlen Schimmer vom Himmel, daran liest man ihre Form.
    vec3 beleuchte(vec3 farbe, vec3 n, float sonne, float offen, vec3 rel) {
      float oben = n.y * 0.5 + 0.5;
      float streif = pow(1.0 - abs(dot(n, normalize(rel))), 3.0);
      return farbe * (uLicht * max(dot(n, uSonne), 0.0) * sonne
        + uHimmelLicht * (0.42 + 0.7 * oben + 0.7 * streif) * offen
        + uPrall * (max(n.x, 0.0) * 0.75 + 0.2) * offen);
    }
  `;

  // Der Fels: geschichteter Kalk, warm und hell, mit dunklen Fugen. Jede
  // Fläche hat ihren eigenen Ton (kantig, wie gebrochen). Was flach liegt,
  // trägt unten Kies, darüber Gras und oben Schnee.
  const FELS = `
    uniform sampler2D uRausch;
    vec3 fels(vec3 welt, vec3 rel, vec3 n, float u, float sonne, float offen, float kahl) {
      vec4 r1 = texture(uRausch, vec2(welt.z * 0.0041 + welt.x * 0.0023, u * 0.0105));
      vec4 r2 = texture(uRausch, vec2(welt.z * 0.033 + welt.x * 0.021, u * 0.061));
      // Die Schichten: Bänke von gut zehn Metern, leicht gewellt, jede in
      // ihrem Ton – dazwischen eine dunkle Fuge.
      float lage = u * 0.092 + r1.a * 0.2 + r1.r * 0.12;
      float bank = fract(sin(floor(lage) * 91.7) * 43758.5453);
      vec3 farbe = mix(vec3(0.83, 0.72, 0.57), vec3(0.62, 0.48, 0.37), smoothstep(0.25, 0.75, bank * 0.6 + r1.r * 0.4));
      farbe = mix(farbe, vec3(0.92, 0.86, 0.75), smoothstep(0.72, 0.95, bank) * 0.7);
      farbe *= 0.84 + 0.16 * smoothstep(0.0, 0.06, fract(lage)) * smoothstep(1.0, 0.97, fract(lage));
      farbe *= 0.9 + 0.2 * r2.r;
      // Dunkle Streifen, wo Wasser die Wand hinabläuft.
      float nass = texture(uRausch, vec2(welt.z * 0.047 + welt.x * 0.031, u * 0.0045)).a;
      farbe *= 0.78 + 0.22 * smoothstep(0.3, 0.62, nass + (1.0 - abs(n.y)) * 0.0);
      float facette = fract(sin(dot(floor(n * 5.0 + 0.5), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      farbe *= 0.82 + 0.32 * facette;
      float flach = smoothstep(0.52, 0.74, n.y) * (1.0 - kahl);
      float schnee = smoothstep(72.0, 98.0, u + (r1.a - 0.5) * 34.0);
      vec3 gras = mix(vec3(0.26, 0.40, 0.14), vec3(0.48, 0.54, 0.20), r2.r);
      vec3 kies = vec3(0.56, 0.54, 0.51) * (0.8 + 0.4 * r2.r);
      vec3 weiss = vec3(0.93, 0.96, 1.0);
      farbe = mix(farbe, mix(mix(kies, gras, smoothstep(1.2, 4.5, u)), weiss, schnee), flach);
      farbe = mix(farbe, weiss, schnee * smoothstep(0.15, 0.5, n.y) * 0.4 * (1.0 - flach));
      // Am Wasser ist der Stein nass.
      farbe *= mix(0.6, 1.0, smoothstep(0.1, 1.7, u));
      return beleuchte(farbe, n, sonne, offen, rel);
    }
    // Wohin eine Fläche schaut, aus ihren Ecken: kantig, ohne dass ein Netz
    // seine Richtungen mitbringen muss.
    vec3 flaeche(vec3 rel) {
      vec3 n = normalize(cross(dFdx(rel), dFdy(rel)));
      return dot(n, rel) > 0.0 ? -n : n;
    }
  `;

  // Der Himmel: ein Dreieck über das ganze Bild. Aus der Blickrichtung jedes
  // Punkts entstehen der Verlauf, die Sonne, Schleierwolken und zwei Ketten
  // von Gipfeln im Dunst – die fernen mit Schnee.
  const HIMMEL_VS = `#version 300 es
    out vec2 vBild;
    void main() {
      vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;
      vBild = p;
      gl_Position = vec4(p, 0.9999, 1.0);
    }`;
  const HIMMEL_FS = `#version 300 es
    precision highp float;
    in vec2 vBild;
    out vec4 aus;
    uniform vec3 uRechts, uHoch, uVor, uZenit, uHorizont;
    uniform vec2 uTan;
    uniform sampler2D uRausch;
    ${LICHT}
    void main() {
      vec3 d = normalize(uVor + vBild.x * uTan.x * uRechts + vBild.y * uTan.y * uHoch);
      float h = d.y;
      float hh = max(h, 0.0);
      float zurSonne = max(dot(d, uSonne), 0.0);
      float seite = max(dot(normalize(d.xz + vec2(1e-4)), normalize(uSonne.xz)), 0.0);
      vec3 nebel = mix(uNebel, uGlut, pow(zurSonne, 3.0) * 0.8);

      vec3 c = mix(uHorizont, uZenit, 1.0 - pow(1.0 - hh, 2.6));
      c = mix(c, uGlut, pow(zurSonne, 5.0) * 0.5 + pow(1.0 - hh, 9.0) * 0.3 * seite);

      // Schleierwolken, von der Sonne angestrahlt.
      vec2 uv = d.xz / (hh + 0.22);
      float w = texture(uRausch, uv * vec2(0.05, 0.1) + vec2(uZeit * 0.001, 0.0)).a * 0.62
        + texture(uRausch, uv * vec2(0.17, 0.29) + vec2(0.31, uZeit * 0.0007)).r * 0.38;
      float wolke = smoothstep(0.42, 0.95, w) * smoothstep(0.14, 0.4, hh);
      vec3 wolkeFarbe = mix(vec3(0.9, 0.92, 0.98), vec3(1.0, 0.93, 0.8), clamp(pow(zurSonne, 2.0) + 0.2, 0.0, 1.0));
      c = mix(c, wolkeFarbe, wolke * 0.4);

      // Die Sonne: ein weiter Hof, ein enger, die Scheibe.
      c += uGlut * (pow(zurSonne, 12.0) * 0.3 + pow(zurSonne, 90.0) * 0.6 + pow(zurSonne, 900.0) * 1.5);
      c += vec3(1.0, 0.96, 0.85) * smoothstep(0.99945, 0.9998, zurSonne) * 3.0;

      // Gipfel: aus der Richtung zwei Kämme. Der ferne trägt Schnee, und
      // seine Sonnenseite leuchtet.
      float az = atan(d.x, d.z);
      float fein = texture(uRausch, vec2(az * 2.3 + 0.2, 0.83)).r;
      float n1 = texture(uRausch, vec2(az * 0.31 + 0.13, 0.27)).r;
      float n2 = texture(uRausch, vec2(az * 0.9 + 0.5, 0.61)).a;
      float zacken = 1.0 - abs(2.0 * n2 - 1.0);
      float kamm1 = 0.045 + 0.27 * pow(n1, 1.4) + 0.1 * zacken * zacken + 0.028 * fein;
      float in1 = smoothstep(kamm1 + 0.003, kamm1 - 0.003, h);
      float schnee = smoothstep(0.06, 0.105, h + 0.05 * fein);
      vec3 berg1 = mix(vec3(0.3, 0.4, 0.6), vec3(0.93, 0.95, 1.0), schnee);
      // Grosse Flächen wie gefaltet: die einen im Licht, die anderen im Schatten.
      // Nach unten verliert er sich im Dunst.
      berg1 = mix(berg1, nebel, smoothstep(kamm1 * 0.55, 0.0, h) * 0.5);
      berg1 = mix(berg1, berg1 * vec3(1.25, 1.1, 0.92), seite);
      c = mix(c, mix(nebel, berg1, 0.5), in1);
      float n3 = texture(uRausch, vec2(az * 0.52 + 0.71, 0.42)).a;
      float kamm2 = -0.02 + 0.13 * pow(n3, 1.3) + 0.045 * n2 + 0.012 * fein;
      float in2 = smoothstep(kamm2 + 0.003, kamm2 - 0.003, h);
      vec3 berg2 = mix(vec3(0.2, 0.3, 0.3), vec3(0.34, 0.4, 0.5), smoothstep(0.0, 0.1, h));
      c = mix(c, mix(nebel, berg2, 0.6), in2);

      // Unten geht der Himmel in den Dunst über – dort hinein verschwindet
      // die Schlucht.
      c = mix(c, nebel, smoothstep(0.1, -0.03, h) * 0.92);
      c = belichte(c);
      c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 200.0;
      aus = vec4(c, 1.0);
    }`;

  // Die Wände der Schlucht, Stück um Stück erzeugt (kachelBauen). Jede Ecke
  // bringt mit, wie hoch sie über dem Bach liegt, wie viel Sonne sie bekommt
  // und wie offen sie zum Himmel ist – ausgerechnet, wenn das Stück entsteht.
  const WAND_VS = `#version 300 es
    layout(location = 0) in vec3 aOrt;
    layout(location = 1) in vec3 aMehr;   // Höhe über dem Bach, Sonne, Offenheit
    uniform mat4 uPV;
    uniform vec3 uKam;
    out vec3 vRel;
    out vec3 vWelt;
    out vec3 vMehr;
    void main() {
      vWelt = aOrt;
      vRel = aOrt - uKam;
      vMehr = aMehr;
      gl_Position = uPV * vec4(vRel, 1.0);
    }`;
  const WAND_FS = `#version 300 es
    precision highp float;
    in vec3 vRel;
    in vec3 vWelt;
    in vec3 vMehr;
    out vec4 aus;
    ${LICHT}
    ${FELS}
    void main() {
      vec3 c = fels(vWelt, vRel, flaeche(vRel), vMehr.x, vMehr.y, vMehr.z, 0.0);
      aus = vec4(belichte(dunst(c, vRel)), 1.0);
    }`;

  // Der Bach: milchig-türkises Gletscherwasser, das talwärts schiesst. Wo
  // die Sonne hinkommt, glitzert es; an den Ufern schäumt es.
  const FLUSS_VS = `#version 300 es
    layout(location = 0) in vec3 aOrt;
    layout(location = 1) in vec3 aMehr;   // quer (-1 bis 1), Sonne, halbe Breite
    uniform mat4 uPV;
    uniform vec3 uKam;
    out vec3 vRel;
    out vec3 vWelt;
    out vec3 vMehr;
    void main() {
      vWelt = aOrt;
      vRel = aOrt - uKam;
      vMehr = aMehr;
      gl_Position = uPV * vec4(vRel, 1.0);
    }`;
  const FLUSS_FS = `#version 300 es
    precision highp float;
    in vec3 vRel;
    in vec3 vWelt;
    in vec3 vMehr;
    out vec4 aus;
    uniform sampler2D uRausch;
    ${LICHT}
    void main() {
      float quer = vMehr.x;
      float sonne = vMehr.y;
      vec2 ort = vec2(quer * vMehr.z, vWelt.z);
      vec4 a = texture(uRausch, ort * vec2(0.035, 0.016) + vec2(0.0, -uZeit * 0.21));
      vec4 b = texture(uRausch, ort * vec2(0.11, 0.045) + vec2(0.37, -uZeit * 0.5));
      vec3 n = normalize(vec3((a.g - 0.5) * 1.3 + (b.g - 0.5) * 0.9, 1.0, (a.b - 0.5) * 1.3 + (b.b - 0.5) * 0.9));
      vec3 v = normalize(-vRel);
      float spiegel = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 3.2);
      vec3 wasser = mix(vec3(0.07, 0.34, 0.37), vec3(0.3, 0.62, 0.6), smoothstep(0.25, 1.0, abs(quer)));
      vec3 c = wasser * (vec3(0.5, 0.62, 0.68) + uLicht * sonne * 0.6);
      c = mix(c, vec3(0.6, 0.73, 0.84), spiegel * 0.5);
      float schaum = smoothstep(0.6, 0.82, a.r * 0.55 + b.a * 0.45 + pow(abs(quer), 3.0) * 0.4);
      c = mix(c, vec3(0.95, 0.98, 1.0) * (uHimmelLicht * 1.25 + uLicht * sonne * 0.6), schaum * 0.85);
      float zurSonne = max(dot(reflect(-v, n), uSonne), 0.0);
      c += uLicht * (pow(zurSonne, 90.0) * 5.0 + pow(zurSonne, 14.0) * 0.35) * sonne;
      aus = vec4(belichte(dunst(c, vRel)), 1.0);
    }`;

  // Alles Feste: Türme, Brocken, Tannen, Pfeiler, der Flieger. Ein Netz je
  // Form, viele Male gezeichnet – jedes Mal mit Ort, Grösse, Drehung und
  // Farbe. Fels (ein Boden ist mitgegeben) bekommt dieselben Schichten wie
  // die Wände; alles andere seine eigene Farbe.
  const DING_VS = `#version 300 es
    layout(location = 0) in vec3 aOrt;
    layout(location = 1) in vec3 aFarbe;
    layout(location = 2) in vec4 iOrt;    // x, y, z, Drehung um die Hochachse
    layout(location = 3) in vec4 iMass;   // Breite, Höhe, Tiefe, Rollen um die Flugachse
    layout(location = 4) in vec4 iFarbe;  // Farbe, eigenes Leuchten
    layout(location = 5) in vec4 iMehr;   // Nicken, Boden (Fels) oder -1e4, Schatten bis, Sonne darunter
    uniform mat4 uPV;
    uniform vec3 uKam;
    uniform float uGeist;
    out vec3 vRel;
    out vec3 vWelt;
    out vec4 vFarbe;
    out vec3 vMehr;
    void main() {
      vec3 p = aOrt * iMass.xyz;
      float cr = cos(iMass.w), sr = sin(iMass.w);
      p = vec3(p.x * cr - p.y * sr, p.x * sr + p.y * cr, p.z);
      float cn = cos(iMehr.x), sn = sin(iMehr.x);
      p = vec3(p.x, p.y * cn + p.z * sn, -p.y * sn + p.z * cn);
      float cy = cos(iOrt.w), sy = sin(iOrt.w);
      p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
      vWelt = p + iOrt.xyz;
      vRel = vWelt - uKam;
      // Ein Gegner trägt nur seine eigene Farbe; vom Netz bleibt hell und dunkel.
      vFarbe = uGeist > 0.0
        ? vec4(iFarbe.rgb * (0.55 + 0.45 * dot(aFarbe, vec3(0.34))), iFarbe.a)
        : vec4(aFarbe * iFarbe.rgb, iFarbe.a);
      vMehr = iMehr.yzw;
      gl_Position = uPV * vec4(vRel, 1.0);
    }`;
  const DING_FS = `#version 300 es
    precision highp float;
    in vec3 vRel;
    in vec3 vWelt;
    in vec4 vFarbe;
    in vec3 vMehr;
    out vec4 aus;
    uniform float uGeist;
    ${LICHT}
    ${FELS}
    void main() {
      vec3 n = flaeche(vRel);
      if (uGeist > 0.0) {
        // Ein Gegner: ein Flieger aus Licht, durchscheinend.
        float rand = pow(1.0 - abs(dot(n, normalize(vRel))), 2.0);
        float deck = 0.72 * vFarbe.a;
        aus = vec4(vFarbe.rgb * (0.7 + 0.6 * rand) * deck, deck);
        return;
      }
      float sonne = mix(vMehr.z, 1.0, smoothstep(vMehr.y - 5.0, vMehr.y + 5.0, vWelt.y));
      vec3 c;
      if (vMehr.x > -9000.0) c = fels(vWelt, vRel, n, vWelt.y - vMehr.x, sonne, 0.85, vFarbe.a) * vFarbe.rgb;
      else if (vFarbe.a < 0.0) {
        // Gemauert: Lagen von Steinen, versetzt, jeder in seinem Ton.
        vec2 q = vec2((vWelt.x + vWelt.z) * 0.42, vWelt.y * 0.8);
        q.x += mod(floor(q.y), 2.0) * 0.5;
        vec2 stein = floor(q);
        vec2 fuge = smoothstep(vec2(0.0), vec2(0.05, 0.09), fract(q)) * smoothstep(vec2(1.0), vec2(0.96, 0.93), fract(q));
        float ton = fract(sin(dot(stein, vec2(12.9898, 78.233))) * 43758.5453);
        c = beleuchte(vFarbe.rgb * (0.82 + 0.3 * ton) * (0.72 + 0.28 * fuge.x * fuge.y), n, sonne, 0.9, vRel);
      } else c = beleuchte(vFarbe.rgb, n, sonne, 0.9, vRel) + vFarbe.rgb * vFarbe.a;
      aus = vec4(belichte(dunst(c, vRel)), 1.0);
    }`;

  // Bänder: alles Lange und Dünne oder Durchscheinende, jedes Bild neu
  // gelegt – die Rauchfahne, Windstreifen, Seile, Wasserfälle, die
  // Sonnenstrahlen. Welche Art, sagt jede Ecke selbst:
  //   0 weich und deckend (Rauch)        1 fest (Seil, Brett, Fähnchen)
  //   2 Wasserfall                       3 Sonnenstrahl (Licht dazu)
  //   4 weich, Licht dazu (Windstreifen)
  const BAND_VS = `#version 300 es
    layout(location = 0) in vec3 aOrt;
    layout(location = 1) in vec2 aUV;
    layout(location = 2) in vec4 aFarbe;
    layout(location = 3) in float aArt;
    uniform mat4 uPV;
    uniform vec3 uKam;
    out vec3 vRel;
    out vec2 vUV;
    out vec4 vFarbe;
    out float vArt;
    void main() {
      vRel = aOrt - uKam;
      vUV = aUV;
      vFarbe = aFarbe;
      vArt = aArt;
      gl_Position = uPV * vec4(vRel, 1.0);
    }`;
  const BAND_FS = `#version 300 es
    precision highp float;
    in vec3 vRel;
    in vec2 vUV;
    in vec4 vFarbe;
    in float vArt;
    out vec4 aus;
    uniform sampler2D uRausch;
    ${LICHT}
    void main() {
      float weit = length(vRel);
      if (vArt < 0.5) {
        float a = vFarbe.a * (1.0 - smoothstep(0.35, 1.0, abs(vUV.x)));
        aus = vec4(vFarbe.rgb * a, a);
      } else if (vArt < 1.5) {
        aus = vec4(belichte(dunst(vFarbe.rgb, vRel)), 1.0);
      } else if (vArt < 2.5) {
        float s1 = texture(uRausch, vec2(vUV.x * 0.22, vUV.y * 0.03 - uZeit * 0.36)).r;
        float s2 = texture(uRausch, vec2(vUV.x * 0.6 + 0.4, vUV.y * 0.09 - uZeit * 0.75)).a;
        float w = smoothstep(0.3, 0.72, s1 * 0.6 + s2 * 0.4);
        float a = (1.0 - smoothstep(0.5, 1.0, abs(vUV.x))) * (0.5 + 0.5 * w) * vFarbe.a;
        vec3 c = mix(vec3(0.74, 0.86, 0.97), vec3(1.0), w) * (vec3(0.6, 0.72, 0.92) + uLicht * 0.4 * vFarbe.r);
        aus = vec4(belichte(dunst(c, vRel)) * a, a);
      } else if (vArt < 3.5) {
        float streif = texture(uRausch, vec2(vUV.x * 0.27 + vFarbe.b * 3.0, vUV.y * 0.6 + 0.3)).r * 0.6
          + texture(uRausch, vec2(vUV.x * 0.9, vUV.y * 0.3 + vFarbe.b)).a * 0.4;
        float a = (1.0 - smoothstep(0.25, 1.0, abs(vUV.x))) * smoothstep(0.0, 0.2, vUV.y) * (1.0 - smoothstep(0.55, 1.0, vUV.y))
          * smoothstep(8.0, 45.0, weit) * (1.0 - smoothstep(160.0, 520.0, weit))
          * (0.3 + 0.7 * smoothstep(0.3, 0.7, streif)) * vFarbe.a;
        aus = vec4(uGlut * a, 0.0);
      } else {
        float a = vFarbe.a * (1.0 - smoothstep(0.2, 1.0, abs(vUV.x))) * smoothstep(0.0, 0.3, vUV.y) * (1.0 - smoothstep(0.7, 1.0, vUV.y));
        aus = vec4(vFarbe.rgb * a, 0.0);
      }
    }`;

  // Scheiben, die zur Kamera schauen: Staub und Steinchen (decken) und
  // alles, was leuchtet (legt sein Licht dazu).
  const SCHEIN_VS = `#version 300 es
    layout(location = 0) in vec2 aEcke;
    layout(location = 1) in vec4 iA;      // x, y, z, Grösse
    layout(location = 2) in vec4 iB;      // Farbe; > 0: Licht, so hart der Rand – < 0: Staub, so deckend
    uniform mat4 uProj, uSicht;
    uniform vec3 uKam;
    out vec2 vEcke;
    out vec4 vFarbe;
    void main() {
      vec4 p = uSicht * vec4(iA.xyz - uKam, 1.0);
      p.xy += aEcke * iA.w;
      vEcke = aEcke;
      vFarbe = iB;
      gl_Position = uProj * p;
    }`;
  const SCHEIN_FS = `#version 300 es
    precision highp float;
    in vec2 vEcke;
    in vec4 vFarbe;
    out vec4 aus;
    void main() {
      float r = length(vEcke);
      if (vFarbe.a < 0.0) {
        float a = -vFarbe.a * (1.0 - smoothstep(0.35, 1.0, r));
        aus = vec4(vFarbe.rgb * a, a);
      } else {
        float a = pow(max(1.0 - r, 0.0), vFarbe.a);
        aus = vec4(vFarbe.rgb * a, 0.0);
      }
    }`;

  // Die Dohlen: je eine kleine Scheibe, die zur Kamera schaut – ein Rumpf
  // und zwei Flügel, die schlagen. Die Form entsteht im Programm; so bleibt
  // auch eine ferne Dohle ein Vogel und wird nie dünner als ein paar
  // Bildpunkte. (Wie die Stare im Schwarm.)
  const VOGEL_VS = `#version 300 es
    layout(location = 0) in vec2 aEcke;
    layout(location = 1) in vec4 iA;      // x, y, z, Takt
    layout(location = 2) in vec4 iB;      // rollen, gleiten (0 bis 1), Grösse, Deckkraft
    uniform mat4 uProj, uSicht;
    uniform vec3 uKam;
    uniform float uPunkt, uZeit;
    out vec2 vEcke;
    out vec3 vRel;
    out float vSchlag;
    out float vDeck;
    void main() {
      vRel = iA.xyz - uKam;
      vec4 p = uSicht * vec4(vRel, 1.0);
      float gross = max(iB.z, -p.z * uPunkt * 2.4);
      float c = cos(iB.x), s = sin(iB.x);
      p.xy += vec2(aEcke.x * c - aEcke.y * s, aEcke.x * s + aEcke.y * c) * gross;
      vEcke = aEcke;
      vDeck = iB.w;
      vSchlag = mix(sin(uZeit * (13.0 + 5.0 * fract(iA.w * 7.31)) + iA.w * 6.2832), 0.25, iB.y);
      gl_Position = uProj * p;
    }`;
  const VOGEL_FS = `#version 300 es
    precision highp float;
    in vec2 vEcke;
    in vec3 vRel;
    in float vSchlag;
    in float vDeck;
    out vec4 aus;
    ${LICHT}
    float strecke(vec2 p, vec2 a, vec2 b) {
      vec2 pa = p - a;
      vec2 ba = b - a;
      return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
    }
    void main() {
      vec2 p = vec2(abs(vEcke.x), vEcke.y);
      float w = 0.1 + 0.6 * vSchlag;
      vec2 gelenk = 0.44 * vec2(cos(w * 0.6), sin(w * 0.6));
      vec2 spitze = gelenk + 0.5 * vec2(cos(w * 1.35), sin(w * 1.35));
      float d = strecke(p, vec2(0.0), gelenk) - 0.08;
      d = min(d, strecke(p, gelenk, spitze) - mix(0.075, 0.025, clamp(length(p - gelenk) * 2.0, 0.0, 1.0)));
      d = min(d, length(p * vec2(1.0, 0.8)) - 0.14);
      float rand = fwidth(d) * 0.9 + 1e-4;
      float a = smoothstep(rand, -rand, d) * vDeck;
      if (a < 0.01) discard;
      aus = vec4(belichte(dunst(vec3(0.035, 0.035, 0.05), vRel)) * a, a);
    }`;

  function programm(name, vs, fs) {
    const baue = (art, quelle) => {
      const s = gl.createShader(art);
      gl.shaderSource(s, quelle);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`Felsflug, Programm «${name}»: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, baue(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, baue(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Felsflug, Programm «${name}»: ${gl.getProgramInfoLog(p)}`);
    const orte = new Map();
    return {
      p,
      ort(u) {
        if (!orte.has(u)) orte.set(u, gl.getUniformLocation(p, u));
        return orte.get(u);
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Netze
  // ---------------------------------------------------------------------------
  // Dreiecke mit Ort und Farbe. Wohin eine Fläche schaut, rechnet das
  // Programm selbst (flaeche) – darum braucht kein Netz seine Richtungen.
  // ziel: ein Feld, in das geschrieben wird (der Flieger, jedes Bild neu).
  function netzBauer(ziel = null) {
    const v = [];
    let n = 0;
    let f = [1, 1, 1];
    const ecke = (e) => {
      if (!ziel) { v.push(e[0], e[1], e[2], f[0], f[1], f[2]); return; }
      ziel[n] = e[0]; ziel[n + 1] = e[1]; ziel[n + 2] = e[2];
      ziel[n + 3] = f[0]; ziel[n + 4] = f[1]; ziel[n + 5] = f[2];
      n += 6;
    };
    const b = {
      farbe(r, gr, bl) { f = [r, gr, bl]; },
      dreieck(p, q, r) { ecke(p); ecke(q); ecke(r); },
      viereck(p, q, r, s) { b.dreieck(p, q, r); b.dreieck(p, r, s); },
      kasten(mx, my, mz, hx, hy, hz, oben = 1) {
        const e = (sx, sy, sz) => [mx + sx * hx * (sy > 0 ? oben : 1), my + sy * hy, mz + sz * hz * (sy > 0 ? oben : 1)];
        b.viereck(e(-1, -1, 1), e(1, -1, 1), e(1, 1, 1), e(-1, 1, 1));
        b.viereck(e(-1, -1, -1), e(1, -1, -1), e(1, 1, -1), e(-1, 1, -1));
        b.viereck(e(-1, -1, -1), e(-1, -1, 1), e(-1, 1, 1), e(-1, 1, -1));
        b.viereck(e(1, -1, -1), e(1, -1, 1), e(1, 1, 1), e(1, 1, -1));
        b.viereck(e(-1, 1, -1), e(1, 1, -1), e(1, 1, 1), e(-1, 1, 1));
        b.viereck(e(-1, -1, -1), e(1, -1, -1), e(1, -1, 1), e(-1, -1, 1));
      },
      // Ein Körper aus Querschnitten: Ring um Ring verbunden.
      rohr(ringe, zu = true) {
        for (let i = 0; i < ringe.length - 1; i += 1) {
          const n = ringe[i].length;
          for (let j = 0; j < n; j += 1) b.viereck(ringe[i][j], ringe[i][(j + 1) % n], ringe[i + 1][(j + 1) % n], ringe[i + 1][j]);
        }
        if (!zu) return;
        for (const ring of [ringe[0], ringe[ringe.length - 1]]) {
          const m = ring.reduce((s, p) => [s[0] + p[0] / ring.length, s[1] + p[1] / ring.length, s[2] + p[2] / ring.length], [0, 0, 0]);
          for (let j = 0; j < ring.length; j += 1) b.dreieck(ring[j], ring[(j + 1) % ring.length], m);
        }
      },
      feld: () => ziel || new Float32Array(v),
    };
    return b;
  }

  // Eine Kugel aus Flächen: ein Achtflach, n-mal geteilt.
  function kugelFlaechen(n) {
    const norm = (p) => { const l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l, p[1] / l, p[2] / l]; };
    const halb = (p, q) => norm([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2]);
    let flaechen = [];
    const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1], x = [-1, 0, 0], y = [0, -1, 0], z = [0, 0, -1];
    for (const o of [Y, y]) for (const [p, q] of [[X, Z], [Z, x], [x, z], [z, X]]) flaechen.push([o, p, q]);
    for (let i = 0; i < n; i += 1) {
      const neu = [];
      for (const [p, q, r] of flaechen) {
        const pq = halb(p, q), qr = halb(q, r), rp = halb(r, p);
        neu.push([p, pq, rp], [pq, q, qr], [rp, qr, r], [pq, qr, rp]);
      }
      flaechen = neu;
    }
    return flaechen;
  }

  const HELM_KUGEL = kugelFlaechen(2);
  const ROT = [0.92, 0.12, 0.09];
  const ROT_TIEF = [0.6, 0.06, 0.07];
  const HELM = [0.96, 0.96, 0.98];
  const DUNKEL = [0.1, 0.1, 0.13];
  const AKZENT = [0.98, 0.66, 0.14];

  // Der Anzug: oben leuchtend, damit man ihn vor dem Fels sieht; Rumpf,
  // Beine und Gurtzeug dunkel, der Helm weiss mit einem Streifen.
  const ANZUG = [0.97, 0.3, 0.1];
  const ANZUG_TIEF = [0.78, 0.17, 0.07];
  const ANZUG_DUNKEL = [0.2, 0.22, 0.28];
  const STREIF = [0.97, 0.95, 0.9];
  const SCHUH = [0.92, 0.92, 0.94];

  // Kleine Vektorrechnung für den Flieger.
  const vPlus = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const vMal = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const vMisch = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const vKreuz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const vNorm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  /*
   * Ein Ring um die Achse d am Punkt c: n Ecken, quer rx, zum Rücken hin ry.
   * «Oben» ist der Rücken (+y) – liegt die Achse fast darauf, die Nase.
   */
  function ringUm(c, d, rx, ry, n = 6) {
    const a = vNorm(d);
    const hinweis = Math.abs(a[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
    const quer = vNorm(vKreuz(a, hinweis));
    const oben = vKreuz(quer, a);
    const ring = [];
    for (let i = 0; i < n; i += 1) {
      const w = (i / n) * Math.PI * 2;
      ring.push(vPlus(c, vPlus(vMal(quer, Math.cos(w) * rx), vMal(oben, Math.sin(w) * ry))));
    }
    return ring;
  }

  /*
   * Die Haltung des Fliegers – woraus sein Netz in jedem Bild entsteht:
   *
   *   spann    0 bis 1: wie weit Arme und Beine gespreizt sind (0 am Körper)
   *   hoch     0 bis 1: die Arme nach oben (am Schirm, an den Steuerleinen)
   *   lenk     -1 bis 1: wohin er lenkt – der innere Arm sinkt und geht
   *            zurück, der Kopf schaut in die Kurve
   *   zeit, flattern: der Stoff an den Hinterkanten zittert im Fahrtwind
   *   stehen   0 bis 1: die Füsse stehen (zeigen zum Bauch) statt gestreckt
   *   knie     wie weit die Knie gebeugt sind (Bogenmass)
   */
  const POSE_FLUG = { spann: 1, hoch: 0, lenk: 0, zeit: 0, flattern: 0, stehen: 0, knie: 0.08 };

  /*
   * Der Flieger im Wingsuit, von hinten oben gesehen: ein Mensch, bäuchlings
   * in der Luft, den Kopf voran (+z), den Rücken oben (+y). Helm mit Visier,
   * auf dem Rücken das Gurtzeug mit dem Schirm, Handschuhe, Schuhe. Zwischen
   * Arm und Rumpf und zwischen den Beinen der Stoff, Zelle an Zelle leicht
   * aufgeblasen. Gut zwei Meter lang und knapp zwei breit.
   *
   * Gebaut wird in jedem Bild neu (in ziel), aus der Haltung p – die Zahl der
   * Ecken bleibt dabei immer dieselbe.
   */
  function fliegerNetz(p = POSE_FLUG, ziel = null) {
    const b = netzBauer(ziel);
    const spann = p.spann;
    const welle = (u, v, phase) => (p.flattern ? Math.sin(p.zeit * 23 + u * 7 + phase) * p.flattern * 0.022 * v * v : 0);

    // Der Rumpf: Ringe vom Becken bis zum Hals, unten flacher als oben.
    const ring = (z, w, oben, unten, y = 0) => {
      const r = [];
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const s = Math.sin(a);
        r.push([Math.cos(a) * w, y + s * (s > 0 ? oben : unten), z]);
      }
      return r;
    };
    b.farbe(...ANZUG_DUNKEL);
    b.rohr([ring(-0.12, 0.13, 0.06, 0.06), ring(0.0, 0.17, 0.085, 0.08), ring(0.18, 0.155, 0.08, 0.075), ring(0.36, 0.19, 0.09, 0.1), ring(0.5, 0.215, 0.08, 0.08), ring(0.58, 0.1, 0.06, 0.055)]);
    // Der Hals.
    b.rohr([ring(0.56, 0.055, 0.045, 0.045), ring(0.68, 0.05, 0.04, 0.04)]);

    // Das Gurtzeug mit dem Schirm: ein flacher Packen auf dem Rücken, ein
    // Streifen darüber, unten der Griff.
    const pack = (z, w, h) => [[-w, 0.07, z], [-w * 0.85, 0.07 + h, z], [w * 0.85, 0.07 + h, z], [w, 0.07, z]];
    b.farbe(0.1, 0.1, 0.12);
    b.rohr([pack(0.02, 0.12, 0.06), pack(0.1, 0.15, 0.085), pack(0.4, 0.16, 0.085), pack(0.48, 0.13, 0.05)]);
    b.farbe(...ANZUG);
    b.kasten(0, 0.16, 0.26, 0.022, 0.008, 0.2);
    b.farbe(0.98, 0.78, 0.18);
    b.kasten(0.07, 0.11, 0.0, 0.025, 0.02, 0.025);

    // Der Helm: weiss, ein Streifen über den Scheitel, vorne unten das
    // dunkle Visier. Der Kopf schaut ein wenig in die Kurve.
    const kopf = [0, 0.015, 0.79];
    const gier = p.lenk * 0.3;
    const cg = Math.cos(gier);
    const sg = Math.sin(gier);
    const amKopf = (k) => {
      const x = k[0] * 0.118;
      const z = k[2] * 0.132;
      return [kopf[0] + x * cg + z * sg, kopf[1] + k[1] * 0.122, kopf[2] - x * sg + z * cg];
    };
    for (const [q, r, s] of HELM_KUGEL) {
      const m = [(q[0] + r[0] + s[0]) / 3, (q[1] + r[1] + s[1]) / 3, (q[2] + r[2] + s[2]) / 3];
      if (m[2] > 0.3 && m[1] < 0.28 && m[1] > -0.7) b.farbe(0.07, 0.08, 0.11);
      else if (Math.abs(m[0]) < 0.17 && m[1] > -0.1 && m[2] < 0.5) b.farbe(...ANZUG);
      else b.farbe(...HELM);
      b.dreieck(amKopf(q), amKopf(r), amKopf(s));
    }

    for (const s of [-1, 1]) {
      // Lenkt er zu dieser Seite, ist das der innere Arm: zurück und tiefer.
      const innen = Math.max(0, s * p.lenk);
      const aussen = Math.max(0, -s * p.lenk);
      // Der Arm: vom Rumpf weg (0 am Körper, 90° zur Seite), dazu hoch.
      const alpha = (lerp(14, 60, spann) - 10 * innen + 4 * aussen) * (Math.PI / 180) + p.hoch * 2.05;
      const senk = -0.05 * spann - 0.14 * innen + 0.04 * aussen;
      const schulter = [s * 0.2, 0.01, 0.5];
      const ellbogen = vPlus(schulter, vMal(vNorm([s * Math.sin(alpha), senk, -Math.cos(alpha)]), 0.3));
      const beta = alpha + lerp(0.05, 0.2, spann);
      const handgelenk = vPlus(ellbogen, vMal(vNorm([s * Math.sin(beta), senk * 1.4, -Math.cos(beta)]), 0.29));
      const finger = vPlus(handgelenk, vMal(vNorm([s * Math.sin(beta + 0.1), senk, -Math.cos(beta + 0.1)]), 0.1));
      b.farbe(...ANZUG_DUNKEL);
      b.rohr([ringUm(schulter, vPlus(ellbogen, vMal(schulter, -1)), 0.062, 0.055), ringUm(ellbogen, vPlus(handgelenk, vMal(schulter, -1)), 0.05, 0.045), ringUm(handgelenk, vPlus(handgelenk, vMal(ellbogen, -1)), 0.04, 0.036)]);
      // Der Handschuh.
      b.farbe(0.08, 0.08, 0.1);
      b.rohr([ringUm(handgelenk, vPlus(finger, vMal(handgelenk, -1)), 0.034, 0.022, 5), ringUm(vMisch(handgelenk, finger, 0.6), vPlus(finger, vMal(handgelenk, -1)), 0.038, 0.02, 5), ringUm(finger, vPlus(finger, vMal(handgelenk, -1)), 0.018, 0.012, 5)]);

      // Das Bein: aus der Hüfte leicht gespreizt, das Knie wenig gebeugt.
      const gamma = lerp(0.03, 0.2, spann) + 0.04 * innen;
      const huefte = [s * 0.09, 0, -0.06];
      const knie = vPlus(huefte, vMal(vNorm([s * Math.sin(gamma), 0, -Math.cos(gamma)]), 0.43));
      const kb = p.knie + 0.1 * innen;
      const knoechel = vPlus(knie, vMal(vNorm([s * Math.sin(gamma * 1.15), -Math.sin(kb), -Math.cos(gamma * 1.15) * Math.cos(kb)]), 0.42));
      b.farbe(...ANZUG_DUNKEL);
      b.rohr([ringUm(huefte, vPlus(knie, vMal(huefte, -1)), 0.085, 0.075), ringUm(knie, vPlus(knoechel, vMal(huefte, -1)), 0.062, 0.058), ringUm(knoechel, vPlus(knoechel, vMal(knie, -1)), 0.048, 0.044)]);
      // Der Schuh: gestreckt nach hinten – oder, wenn er steht, zum Bauch.
      const fuss = vNorm(vMisch([s * 0.05, -0.3, -1], [s * 0.1, -1, 0.15], p.stehen));
      const spitze = vPlus(knoechel, vMal(fuss, 0.21));
      b.farbe(...SCHUH);
      b.rohr([ringUm(vPlus(knoechel, vMal(fuss, -0.04)), fuss, 0.045, 0.05, 5), ringUm(vPlus(knoechel, vMal(fuss, 0.1)), fuss, 0.045, 0.04, 5), ringUm(spitze, fuss, 0.03, 0.025, 5)]);

      // Der Flügel zwischen Arm und Rumpf. Vorne der Arm, innen die Flanke
      // des Rumpfs bis zum Oberschenkel, hinten eine Kante, die der Stoff
      // nach innen zieht. Die Zellen sind ein wenig aufgeblasen.
      const flanke = [[s * 0.2, 0.0, 0.42], [s * 0.18, 0.0, 0.2], [s * 0.17, 0.0, 0.0], vPlus(huefte, vMal(vPlus(knie, vMal(huefte, -1)), 0.62))];
      const vorne = (u) => (u < 0.5 ? vMisch(schulter, ellbogen, u * 2) : vMisch(ellbogen, handgelenk, u * 2 - 1));
      const wurzel = (v) => {
        const i = Math.min(2, Math.floor(v * 3));
        return vMisch(flanke[i], flanke[i + 1], v * 3 - i);
      };
      const hinten = (u) => {
        const a = vMisch(flanke[3], handgelenk, u);
        // Der Stoff spannt: Die Kante biegt sich zum Arm hin.
        return [a[0] - s * 0.02 * Math.sin(Math.PI * u), a[1], a[2] + 0.07 * Math.sin(Math.PI * u) * (0.4 + 0.6 * spann)];
      };
      const U = 5;
      const V = 3;
      const armFlaeche = (u, v) => {
        const a = vorne(u);
        const h = hinten(u);
        // Innen folgt er der Flanke (ein Coons-Fleck aus drei Rändern).
        const korr = vPlus(wurzel(v), vMal(vMisch(schulter, flanke[3], v), -1));
        const q = vPlus(vMisch(a, h, v), vMal(korr, 1 - u));
        q[1] += 0.055 * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.15)) * spann + welle(u, v, s);
        return q;
      };
      for (let i = 0; i < U; i += 1) {
        for (let j = 0; j < V; j += 1) {
          if (j === 0) b.farbe(...(i === U - 2 ? STREIF : ANZUG));
          else if (j === V - 1) b.farbe(...ANZUG_TIEF);
          else b.farbe(...(i % 2 ? ANZUG_TIEF : ANZUG));
          const p00 = armFlaeche(i / U, j / V);
          const p10 = armFlaeche((i + 1) / U, j / V);
          const p11 = armFlaeche((i + 1) / U, (j + 1) / V);
          const p01 = armFlaeche(i / U, (j + 1) / V);
          b.viereck(p00, p10, p11, p01);
        }
      }
    }

    // Der Flügel zwischen den Beinen: vom Schritt bis zu den Knöcheln, die
    // Hinterkante nach vorn gezogen, in der Mitte ein weisser Winkel.
    const bein = (s, v) => {
      const gamma = lerp(0.03, 0.2, spann);
      const kb = p.knie;
      const h = [s * 0.06, -0.01, -0.12];
      const kn = vPlus([s * 0.09, 0, -0.06], vMal(vNorm([s * Math.sin(gamma), 0, -Math.cos(gamma)]), 0.43));
      const kc = vPlus(kn, vMal(vNorm([s * Math.sin(gamma * 1.15), -Math.sin(kb), -Math.cos(gamma * 1.15) * Math.cos(kb)]), 0.4));
      return v < 0.5 ? vMisch(h, kn, v * 2) : vMisch(kn, kc, v * 2 - 1);
    };
    const UB = 4;
    const VB = 4;
    const beinFlaeche = (u, v) => {
      const q = vMisch(bein(-1, v), bein(1, v), u);
      q[2] += 0.1 * Math.sin(Math.PI * u) * v * v * spann;
      q[1] += 0.035 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * spann + welle(u, v, 2);
      return q;
    };
    for (let i = 0; i < UB; i += 1) {
      for (let j = 0; j < VB; j += 1) {
        const mitte = Math.abs((i + 0.5) / UB - 0.5);
        const winkel = Math.abs((j + 0.5) / VB - 0.42 - mitte * 0.9) < 0.14;
        b.farbe(...(winkel ? STREIF : j === VB - 1 ? ANZUG_TIEF : ANZUG));
        b.viereck(beinFlaeche(i / UB, j / VB), beinFlaeche((i + 1) / UB, j / VB), beinFlaeche((i + 1) / UB, (j + 1) / VB), beinFlaeche(i / UB, (j + 1) / VB));
      }
    }
    return b.feld();
  }

  // Der Schirm: ein Flächenschirm aus neun Zellen, gewölbt, in Streifen.
  // Gut sieben Meter breit; sein Scheitel liegt bei y = 0.
  function schirmNetz() {
    const b = netzBauer();
    const ZELLEN = 9;
    const R = 5.2;
    const punkt = (i, z, dick) => {
      const w = (i / ZELLEN - 0.5) * 1.5;
      return [Math.sin(w) * (R - dick), Math.cos(w) * (R - dick) - R, z];
    };
    for (let i = 0; i < ZELLEN; i += 1) {
      const farbe = i % 2 ? [0.98, 0.97, 0.94] : (i === 4 ? AKZENT : ROT);
      b.farbe(...farbe);
      b.viereck(punkt(i, 1.5, 0), punkt(i + 1, 1.5, 0), punkt(i + 1, -1.4, 0), punkt(i, -1.4, 0));
      b.farbe(farbe[0] * 0.7, farbe[1] * 0.7, farbe[2] * 0.7);
      b.viereck(punkt(i, 1.5, 0.34), punkt(i + 1, 1.5, 0.34), punkt(i + 1, -1.4, 0.05), punkt(i, -1.4, 0.05));
      // Die offene Nase jeder Zelle.
      b.farbe(0.12, 0.1, 0.12);
      b.viereck(punkt(i, 1.5, 0), punkt(i + 1, 1.5, 0), punkt(i + 1, 1.5, 0.34), punkt(i, 1.5, 0.34));
    }
    for (const i of [0, ZELLEN]) {
      b.farbe(...ROT_TIEF);
      b.viereck(punkt(i, 1.5, 0), punkt(i, -1.4, 0), punkt(i, -1.4, 0.05), punkt(i, 1.5, 0.34));
    }
    return b.feld();
  }

  // Wie breit ein Turm in welcher Höhe ist (t: 0 unten, 1 oben), mal seinem
  // Mass. Sein Netz hat dieselbe Form; auf Flughöhe ist er so breit wie r.
  const turmBreite = (t) => 1.3 - 0.72 * Math.pow(Math.max(0, t), 1.15);
  const TURM_FORMEN = 4;
  function turmNetz(form) {
    const b = netzBauer();
    const HOEHEN = [-0.06, 0.06, 0.17, 0.29, 0.42, 0.56, 0.7, 0.83, 0.94, 1];
    const S = 9;
    const lehne = [(hash01(form * 3.3 + 1) - 0.5) * 0.35, (hash01(form * 5.9 + 2) - 0.5) * 0.35];
    const mitte = (t) => [lehne[0] * t * t, t, lehne[1] * t * t];
    const ringe = HOEHEN.map((t, i) => {
      const m = mitte(Math.max(0, t));
      return Array.from({ length: S }, (_, j) => {
        const w = (j / S) * Math.PI * 2 + hash01(form * 7.7 + i) * 0.6;
        // Um die Flughöhe herum (ein Drittel bis die Hälfte der Höhe) bleibt
        // der Turm rund: Was man sieht, ist, woran man anstösst.
        const rauh = t > 0.25 && t < 0.6 ? 0.07 : 0.2;
        const rr = turmBreite(t) * (1 - rauh + 2 * rauh * hash01(form * 91.3 + i * 13.1 + j * 3.7));
        return [m[0] + Math.cos(w) * rr, t + (i > 0 && i < 9 ? (hash01(form * 17 + i * 5 + j) - 0.5) * 0.035 : 0), m[2] + Math.sin(w) * rr];
      });
    });
    b.rohr(ringe, false);
    const spitze = mitte(1.06);
    spitze[1] = 1.06;
    const oben = ringe[ringe.length - 1];
    for (let j = 0; j < S; j += 1) b.dreieck(oben[j], oben[(j + 1) % S], spitze);
    return b.feld();
  }

  // Ein Felsbrocken: eine Kugel, jede Ecke verrückt. Für den Sturz über
  // einem Bogen, die Kanzel am Absprung, die Felsbänder unter den Tannen.
  const BROCKEN_FORMEN = 3;
  function brockenNetz(form) {
    const b = netzBauer();
    const verrueckt = (p) => {
      const h = hash01(form * 31.7 + Math.round(p[0] * 50) * 1.31 + Math.round(p[1] * 50) * 7.77 + Math.round(p[2] * 50) * 3.19);
      const k = 0.78 + 0.44 * h;
      return [p[0] * k, p[1] * k, p[2] * k];
    };
    for (const [p, q, r] of kugelFlaechen(2)) b.dreieck(verrueckt(p), verrueckt(q), verrueckt(r));
    return b.feld();
  }

  // Eine Tanne: ein Stamm, drei Kegel übereinander. Höhe 1, unten 1 breit
  // (halb). In 45 % ihrer Höhe ist sie 0,58 breit – dort trifft TANNE_R.
  function tanneNetz() {
    const b = netzBauer();
    const ring = (y, r, dreh, S = 6) => Array.from({ length: S }, (_, j) => [Math.cos(j / S * 6.2832 + dreh) * r, y, Math.sin(j / S * 6.2832 + dreh) * r]);
    const S = 6;
    b.farbe(0.3, 0.2, 0.13);
    b.rohr([ring(-0.05, 0.1, 0, 3), ring(0.2, 0.08, 0, 3)], false);
    const STUFEN = [[0.12, 1, 0.55, [0.09, 0.22, 0.12]], [0.36, 0.74, 0.8, [0.11, 0.27, 0.14]], [0.6, 0.48, 1, [0.15, 0.33, 0.17]]];
    STUFEN.forEach(([y, r, oben, farbe], n) => {
      const unten = ring(y, r, n * 0.4);
      b.farbe(...farbe);
      for (let j = 0; j < S; j += 1) b.dreieck(unten[j], unten[(j + 1) % S], [0, oben, 0]);
      // Von unten sieht man nur den untersten Kegel.
      if (n > 0) return;
      b.farbe(farbe[0] * 0.55, farbe[1] * 0.55, farbe[2] * 0.55);
      for (let j = 0; j < S; j += 1) b.dreieck(unten[j], unten[(j + 1) % S], [0, y + 0.04, 0]);
    });
    return b.feld();
  }

  // Die Kanzel, von der er abspringt: ein schmaler Felssporn, oben fast
  // flach (bei y = 0), vorn spitz, nach unten breiter. Er ragt nach +z.
  function kanzelNetz() {
    const b = netzBauer();
    const S = 10;
    const HOEHEN = [0, -0.012, -0.05, -0.2, -0.5, -1];
    const BREIT = [0.8, 1, 1.25, 1.7, 2.3, 3.2];
    const ringe = HOEHEN.map((y, i) => Array.from({ length: S }, (_, j) => {
      const w = (j / S) * 6.2832;
      const rr = BREIT[i] * (0.82 + 0.36 * hash01(i * 13.1 + j * 3.7 + 5));
      // Vorn (bei +z) läuft er spitz zu.
      const spitz = 1 - 0.45 * Math.max(0, Math.sin(w));
      return [Math.cos(w) * rr * spitz, y + (i > 0 ? (hash01(i * 5 + j) - 0.5) * 0.012 * (i + 1) : 0), Math.sin(w) * rr];
    }));
    b.rohr(ringe, false);
    for (let j = 0; j < S; j += 1) b.dreieck(ringe[0][j], ringe[0][(j + 1) % S], [0, 0.003, 0.1]);
    return b.feld();
  }

  function kastenNetz(oben = 1) {
    const b = netzBauer();
    b.kasten(0, 0, 0, 1, 1, 1, oben);
    return b.feld();
  }

  // Ein Dach: unten 2 × 2, der First längs z in der Höhe 1.
  function dachNetz() {
    const b = netzBauer();
    const e = (x, z) => [x, 0, z];
    b.viereck(e(-1, -1), e(-1, 1), [0, 1, 1], [0, 1, -1]);
    b.viereck(e(1, -1), e(1, 1), [0, 1, 1], [0, 1, -1]);
    b.dreieck(e(-1, 1), e(1, 1), [0, 1, 1]);
    b.dreieck(e(-1, -1), e(1, -1), [0, 1, -1]);
    return b.feld();
  }

  // Ein Bogen der Steinbrücke: die Mauer über einer halbrunden Öffnung.
  // Breite 2 (von -1 bis 1), Höhe 1, Tiefe 2; die Öffnung steigt bis 0,76.
  function bogenNetz() {
    const b = netzBauer();
    const M = 12;
    const kurve = (i) => {
      const w = Math.PI * i / M;
      return [-Math.cos(w), Math.sin(w) * 0.76];
    };
    for (let i = 0; i < M; i += 1) {
      const [x0, y0] = kurve(i);
      const [x1, y1] = kurve(i + 1);
      b.farbe(1, 1, 1);
      for (const z of [-1, 1]) b.viereck([x0, y0, z], [x1, y1, z], [x1, 1, z], [x0, 1, z]);
      // Die Leibung der Öffnung, etwas dunkler.
      b.farbe(0.72, 0.72, 0.74);
      b.viereck([x0, y0, -1], [x1, y1, -1], [x1, y1, 1], [x0, y0, 1]);
    }
    b.farbe(1, 1, 1);
    b.viereck([-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]);
    return b.feld();
  }

  // Rauschen, das sich nahtlos wiederholt: für die Schichten im Fels, das
  // Wasser (mit seiner Neigung in Grün und Blau), Wolken und Gipfel. Einmal
  // gerechnet, 256 × 256.
  function rauschBild() {
    const N = 256;
    const lage = (saat) => {
      const h = new Float32Array(N * N);
      let amp = 0.5;
      for (let o = 0, p = 4; o < 5; o += 1, p *= 2) {
        const raster = new Float32Array(p * p);
        for (let i = 0; i < p * p; i += 1) raster[i] = hashGanz(saat * 7919 + o * 104729 + i);
        for (let y = 0; y < N; y += 1) {
          const fy = (y / N) * p;
          const y0 = Math.floor(fy);
          const ty = fy - y0;
          const sy = ty * ty * (3 - 2 * ty);
          for (let x = 0; x < N; x += 1) {
            const fx = (x / N) * p;
            const x0 = Math.floor(fx);
            const tx = fx - x0;
            const sx = tx * tx * (3 - 2 * tx);
            const a = raster[(y0 % p) * p + (x0 % p)];
            const bb = raster[(y0 % p) * p + ((x0 + 1) % p)];
            const c = raster[((y0 + 1) % p) * p + (x0 % p)];
            const dd = raster[((y0 + 1) % p) * p + ((x0 + 1) % p)];
            h[y * N + x] += amp * (a + (bb - a) * sx + (c - a) * sy + (a - bb - c + dd) * sx * sy);
          }
        }
        amp *= 0.5;
      }
      let min = Infinity;
      let max = -Infinity;
      for (const w of h) { min = Math.min(min, w); max = Math.max(max, w); }
      for (let i = 0; i < h.length; i += 1) h[i] = (h[i] - min) / (max - min);
      return h;
    };
    const A = lage(23);
    const B = lage(61);
    const px = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y += 1) {
      for (let x = 0; x < N; x += 1) {
        const i = y * N + x;
        const gx = A[y * N + ((x + 1) % N)] - A[y * N + ((x + N - 1) % N)];
        const gy = A[((y + 1) % N) * N + x] - A[((y + N - 1) % N) * N + x];
        px[i * 4] = Math.round(A[i] * 255);
        px[i * 4 + 1] = Math.round(clamp(0.5 + gx * 9, 0, 1) * 255);
        px[i * 4 + 2] = Math.round(clamp(0.5 + gy * 9, 0, 1) * 255);
        px[i * 4 + 3] = Math.round(B[i] * 255);
      }
    }
    return { N, px };
  }

  // Ein Netz mit seinen Abzügen: die Ecken einmal, dazu ein Puffer, in den
  // jedes Bild schreibt, wo und wie es gezeichnet wird.
  function abzug(ecken, teile, breite, anzahl, art = gl.STATIC_DRAW) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, ecken, art);
    const schritt = teile.reduce((summe, t) => summe + t, 0);
    let weit = 0;
    teile.forEach((t, i) => {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, t, gl.FLOAT, false, schritt * 4, weit * 4);
      weit += t;
    });
    const daten = new Float32Array(breite * anzahl);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ARRAY_BUFFER, daten.byteLength, gl.DYNAMIC_DRAW);
    for (let i = 0; i < breite / 4; i += 1) {
      const ort = teile.length + i;
      gl.enableVertexAttribArray(ort);
      gl.vertexAttribPointer(ort, 4, gl.FLOAT, false, breite * 4, i * 16);
      gl.vertexAttribDivisor(ort, 1);
    }
    gl.bindVertexArray(null);
    return { vao, vbo, ibo, daten, breite, max: anzahl, n: 0, ecken: ecken.length / schritt };
  }

  function hochladen(a) {
    if (!a.n) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, a.ibo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, a.daten, 0, a.n * a.breite);
  }

  function zeichneAbzug(a) {
    if (!a.n) return;
    gl.bindVertexArray(a.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, a.ecken, a.n);
  }

  // Ein Puffer, den jedes Bild neu füllt (Bänder) oder Stück um Stück (die
  // Wände): Ecken mit den genannten Teilen.
  function puffer(teile, ecken, art) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const schritt = teile.reduce((summe, t) => summe + t, 0);
    gl.bufferData(gl.ARRAY_BUFFER, ecken * schritt * 4, art);
    let weit = 0;
    teile.forEach((t, i) => {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, t, gl.FLOAT, false, schritt * 4, weit * 4);
      weit += t;
    });
    gl.bindVertexArray(null);
    return { vao, vbo, schritt, max: ecken };
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Schlucht, Stück um Stück
  // ---------------------------------------------------------------------------
  /*
   * Die Wände entstehen in Kacheln von 64 Metern: je Seite ein Gitter aus
   * Knoten (längs) und Reihen (vom Bachbett über das Ufer und die Wand bis
   * hinauf auf die Schulter des Bergs), dazu die zwei Flanken eines Massivs,
   * wo eines steht, und das Band des Bachs. Die Reihen 6 bis 10 sind die Wand
   * um die Flughöhe; die mittlere steht genau dort, wo wandL und wandR sie
   * haben, die anderen weichen ein wenig zurück, nie vor.
   *
   * 22 Kacheln liegen im Speicher, jede an ihrem festen Platz; fliegt der
   * Flieger weiter, wird die hinterste zur vordersten. Gezeichnet wird alles
   * mit einem Aufruf.
   */
  const K_SPALTEN = 16;
  const KACHEL_LANG = K_SPALTEN * DZ;
  const KACHELN = 22;
  const W_REIHEN = 20;
  const M_REIHEN = 9;
  const ECKEN_WAND = K_SPALTEN * (W_REIHEN - 1) * 6;
  const ECKEN_MASSIV = K_SPALTEN * (M_REIHEN - 1) * 6;
  const ECKEN_KACHEL = 2 * ECKEN_WAND + 2 * ECKEN_MASSIV;
  const ECKEN_FLUSS = K_SPALTEN * 6;
  const BAEUME_JE = 24;
  const SICHT_WEIT = (KACHELN - 2) * KACHEL_LANG;
  const gitter = new Float32Array((K_SPALTEN + 1) * W_REIHEN * 6);
  const kachelFeld = new Float32Array(ECKEN_KACHEL * 6);
  const flussFeld = new Float32Array(ECKEN_FLUSS * 6);
  const kacheln = {
    drin: new Int32Array(KACHELN).fill(-1),
    baeume: Array.from({ length: KACHELN }, () => ({ n: 0, d: new Float32Array(BAEUME_JE * 6) })),
    wand: null,
    fluss: null,
  };

  // Wie weit die Reihen über der Flughöhe zur glatten Schlucht hin
  // auslaufen (eine Nase ist oben schmaler), wie rauh sie sind, und wie
  // sehr ihre Höhe streut.
  const GLATT = [0, 0.3, 0.6, 0.7, 0.9, 1, 1, 1, 1, 1];
  const RAUH = [0.5, 2.5, 3, 3, 3.5, 3.5, 4, 8, 14, 24];
  const STREU = [0, 2.2, 2.4, 0.8, 2.6, 2.6, 2, 3, 9, 16];
  // Die Höhen der fünf Reihen um die Flughöhe.
  const BAND = [23.5, 27, FLUG_Y, 33.5, 38];

  // Eine Ecke der Wand: Seite s, Knoten k, Reihe j – nach aus ab o.
  function wandEcke(s, k, j, aus, o) {
    const z = knotenZ(k);
    const boden = W.boden[k];
    const hoch = W.hoch[k];
    const wand = s < 0 ? W.wandL[k] : W.wandR[k];
    const rand = s < 0 ? W.randL[k] : W.randR[k];
    const nr = k * 64 + j * 2 + (s < 0 ? 0 : 1);
    const r = hashGanz(nr + 5000);
    const r2 = hashGanz(nr + 90000);
    let x;
    let u;
    if (j === 0) {
      x = W.fluss[k] + s * W.flussHalb[k] * 0.45;
      u = -2.4;
    } else if (j <= 5) {
      const [f, hoehe] = UNTEN[j - 1];
      const ufer = W.fluss[k] + s * W.flussHalb[k];
      x = lerp(ufer, wand, f) + (j > 1 ? (r - 0.5) * 1.6 : 0);
      u = hoehe + (j > 1 ? (r2 - 0.5) * 1.2 : 0);
    } else if (j <= 10) {
      // Die Wand auf Flughöhe: in der Reihe 8 genau dort, wo wandL und wandR
      // sie haben – darüber und darunter weicht sie ein wenig zurück, nie vor.
      u = BAND[j - 6];
      x = wand + (j === 8 ? 0 : s * r * 1.3);
    } else {
      const n = j - 10;
      const glatt = s < 0 ? W.glattL[k] : W.glattR[k];
      const sims = j >= 13 && j <= 17 ? (s < 0 ? W.simsL[k] : W.simsR[k]) : 0;
      const reihe = n <= 2 ? OBEN[n] : n === 3 ? [60.5, 0, 5] : OBEN[n - 1];
      // Nie weiter herein als die Wand auf Flughöhe.
      const fuss = s * Math.max(s * wand, s * lerp(wand, glatt, GLATT[n]));
      x = fuss + s * (reihe[2] + sims + r * RAUH[n]);
      u = (reihe[1] ? rand + reihe[0] : reihe[0]) + (r2 - 0.5) * STREU[n];
    }
    const y = boden + u * hoch;
    const tal = 1 - (hoch - 0.3) / 0.7;
    aus[o] = x;
    aus[o + 1] = y;
    aus[o + 2] = z;
    aus[o + 3] = u * lerp(1, 0.55, tal) + 7 * tal;
    aus[o + 4] = sonneBei(x - s * 0.7, y + 0.6, z);
    const breit = clamp((W.wandR[k] - W.wandL[k]) / 46, 0.45, 1);
    aus[o + 5] = lerp(clamp(0.3 + 0.75 * Math.pow(clamp(u / rand, 0, 1), 0.75), 0, 1) * lerp(0.72, 1, breit), 1, tal);
  }

  // Eine Ecke des Massivs: Flanke q (-1 links, 1 rechts), Knoten k, Reihe j.
  function massivEcke(q, k, j, aus, o) {
    const z = knotenZ(k);
    const boden = W.boden[k];
    const il = W.inselL[k];
    const ir = W.inselR[k];
    const c = (il + ir) / 2;
    const halb = (ir - il) / 2;
    const dick = Math.min(1, halb);
    const kante = q < 0 ? il : ir;
    const hoch = Math.max(42, W.inselH[k]);
    const r = hashGanz(k * 64 + j * 2 + (q < 0 ? 0 : 1) + 400000);
    let x;
    let u;
    if (j === 0) { x = kante + q * 1.3 * dick; u = -3; }
    else if (j === 1) { x = kante + q * (0.5 + r * 0.6) * dick; u = 8 + r * 2; }
    else if (j === 2) { x = kante + q * 0.3 * r * dick; u = 20; }
    else if (j === 3) { x = kante; u = FLUG_Y; }
    else if (j === 4) { x = kante - q * 0.4 * r * dick; u = 39; }
    else if (j === 5) { x = c + q * halb * (0.7 + 0.16 * r); u = lerp(39, hoch, 0.42) + (r - 0.5) * 3; }
    else if (j === 6) { x = c + q * halb * (0.42 + 0.16 * r); u = lerp(39, hoch, 0.76) + (r - 0.5) * 3; }
    else if (j === 7) { x = c + q * halb * 0.2; u = hoch - 2 + r * 2; }
    else { x = c + (hashGanz(k * 31 + 77000) - 0.5) * halb * 0.3; u = hoch + hashGanz(k * 31 + 78000) * 4; }
    const y = boden + u;
    aus[o] = x;
    aus[o + 1] = y;
    aus[o + 2] = z;
    aus[o + 3] = u + 16;
    aus[o + 4] = sonneBei(x + q * 0.7, y + 0.6, z);
    aus[o + 5] = clamp(0.42 + 0.6 * u / hoch, 0, 1);
  }

  // Ein Gitter aus (K_SPALTEN + 1) × reihen Ecken zu Dreiecken, ins Feld der
  // Kachel ab der Ecke ab. Die Diagonale wechselt von Feld zu Feld – so
  // bricht der Fels unregelmässig.
  function gitterZuDreiecken(reihen, ab, spalte) {
    let o = ab * 6;
    for (let kk = 0; kk < K_SPALTEN; kk += 1) {
      if (spalte && !spalte(kk)) { o += (reihen - 1) * 36; continue; }
      for (let j = 0; j < reihen - 1; j += 1) {
        const a = (kk * reihen + j) * 6;
        const b = ((kk + 1) * reihen + j) * 6;
        const c = ((kk + 1) * reihen + j + 1) * 6;
        const d = (kk * reihen + j + 1) * 6;
        const folge = (kk + j) & 1 ? [a, b, c, a, c, d] : [a, b, d, b, c, d];
        for (const e of folge) {
          for (let n = 0; n < 6; n += 1) kachelFeld[o + n] = gitter[e + n];
          o += 6;
        }
      }
    }
  }

  // Die Tannen einer Kachel: auf den Schultern über dem Rand, auf den
  // Felsbändern, am Ufer – im Tal auf den Hängen. Wo, folgt aus festen
  // Zahlen: dieselbe Schlucht hat dieselben Tannen.
  function baeumeSetzen(c, platz) {
    const B = kacheln.baeume[platz];
    B.n = 0;
    const k0 = c * K_SPALTEN;
    for (let i = 0; i < BAEUME_JE; i += 1) {
      const h1 = hashGanz(c * 97 + i * 13 + 1);
      const h2 = hashGanz(c * 97 + i * 13 + 2);
      const h3 = hashGanz(c * 97 + i * 13 + 3);
      const k = k0 + Math.floor(h1 * K_SPALTEN);
      if (k >= W.fest - 1) continue;
      const z = knotenZ(k) + h3 * DZ;
      const s = i % 2 ? 1 : -1;
      const wand = s < 0 ? W.wandL[k] : W.wandR[k];
      const tal = 1 - (W.hoch[k] - 0.3) / 0.7;
      const art = i % 5;
      let x;
      let gross = 8 + 8 * h3;
      if (tal > 0.25) {
        // Im Tal: auf den Hängen links und rechts, nicht auf der Wiese am Bach.
        x = wand + s * (-30 + h2 * 190);
      } else if (art < 3) {
        x = wand + s * (16 + h2 * 60);
      } else if (art === 3) {
        const sims = s < 0 ? W.simsL[k] : W.simsR[k];
        if (sims < 4.5) continue;
        x = wand + s * (7.5 + h2 * (sims - 3));
        gross = 6 + 5 * h3;
      } else {
        const ufer = W.fluss[k] + s * W.flussHalb[k];
        if (Math.abs(wand - ufer) < 14 || W.inselR[k] > W.inselL[k]) continue;
        x = lerp(ufer, wand, 0.45 + 0.4 * h2);
        gross = 5 + 5 * h3;
      }
      let y = hoeheBei(x, z);
      if (art === 3 && tal <= 0.25) y = W.boden[k] + 60.5;
      const o = B.n * 6;
      B.d[o] = x;
      B.d[o + 1] = y - 1.1;
      B.d[o + 2] = z;
      B.d[o + 3] = gross;
      B.d[o + 4] = sonneBei(x, y + gross * 0.6, z);
      // Über der Schneegrenze sind sie weiss bestäubt.
      B.d[o + 5] = weich(60, 100, y - W.boden[k] + (h1 - 0.5) * 30) * (1 - tal);
      B.n += 1;
    }
  }

  // Die Kachel c bauen und an ihren Platz laden.
  function kachelBauen(c) {
    const platz = c % KACHELN;
    const k0 = c * K_SPALTEN;
    kachelFeld.fill(0);
    let ab = 0;
    for (const s of [-1, 1]) {
      for (let kk = 0; kk <= K_SPALTEN; kk += 1) {
        for (let j = 0; j < W_REIHEN; j += 1) wandEcke(s, k0 + kk, j, gitter, (kk * W_REIHEN + j) * 6);
      }
      gitterZuDreiecken(W_REIHEN, ab, null);
      ab += ECKEN_WAND;
    }
    // Das Massiv, wo eines steht.
    let insel = false;
    for (let kk = 0; kk <= K_SPALTEN; kk += 1) if (W.inselR[k0 + kk] > W.inselL[k0 + kk]) insel = true;
    if (insel) {
      const da = (k) => W.inselL[k] !== 0 || W.inselR[k] !== 0;
      const spalte = (kk) => da(k0 + kk) && da(k0 + kk + 1);
      for (const q of [-1, 1]) {
        for (let kk = 0; kk <= K_SPALTEN; kk += 1) {
          if (!da(k0 + kk)) continue;
          for (let j = 0; j < M_REIHEN; j += 1) massivEcke(q, k0 + kk, j, gitter, (kk * M_REIHEN + j) * 6);
        }
        gitterZuDreiecken(M_REIHEN, ab, spalte);
        ab += ECKEN_MASSIV;
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, kacheln.wand.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, platz * ECKEN_KACHEL * 24, kachelFeld);

    // Der Bach: ein Band zwischen den Ufern.
    let o = 0;
    const ecke = (k, s) => {
      const x = W.fluss[k] + s * W.flussHalb[k];
      const y = W.boden[k] + 0.05;
      const z = knotenZ(k);
      flussFeld[o] = x; flussFeld[o + 1] = y; flussFeld[o + 2] = z;
      flussFeld[o + 3] = s; flussFeld[o + 4] = sonneBei(x, y + 0.5, z); flussFeld[o + 5] = W.flussHalb[k];
      o += 6;
    };
    for (let kk = 0; kk < K_SPALTEN; kk += 1) {
      const k = k0 + kk;
      ecke(k, -1); ecke(k, 1); ecke(k + 1, 1);
      ecke(k, -1); ecke(k + 1, 1); ecke(k + 1, -1);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, kacheln.fluss.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, platz * ECKEN_FLUSS * 24, flussFeld);
    baeumeSetzen(c, platz);
    kacheln.drin[platz] = c;
  }

  // Die Kacheln um die Kamera: Was fehlt, wird gebaut – im Flug höchstens
  // zwei je Bild, beim Aufbau alle.
  function kachelnTakt(alle) {
    if (!bild.ok) return;
    const erste = Math.max(0, Math.floor((kam.z - 40 - Z_MIN) / KACHEL_LANG));
    const letzte = Math.min(erste + KACHELN - 1, Math.floor((KNOTEN - 64) / K_SPALTEN) - 1);
    // Die Schatten einer Kachel fallen von weiter vorn: Gebaut wird erst,
    // wenn die Knoten ein gutes Stück darüber hinaus feststehen.
    weltBis(knotenZ((letzte + 1) * K_SPALTEN) + 260);
    let gebaut = 0;
    for (let c = erste; c <= letzte; c += 1) {
      if (kacheln.drin[c % KACHELN] === c) continue;
      if ((c + 1) * K_SPALTEN + 62 >= W.fest) break;
      kachelBauen(c);
      gebaut += 1;
      if (!alle && gebaut >= 2) break;
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: der Aufbau
  // ---------------------------------------------------------------------------
  const BAND_FEST_MAX = 6000;
  const BAND_LUFT_MAX = 9000;
  const band = {
    fest: { d: new Float32Array(BAND_FEST_MAX * 10), n: 0, max: BAND_FEST_MAX, puffer: null },
    luft: { d: new Float32Array(BAND_LUFT_MAX * 10), n: 0, max: BAND_LUFT_MAX, puffer: null },
  };

  function grafikBauen() {
    const P = bild.prog;
    P.himmel = programm("Himmel", HIMMEL_VS, HIMMEL_FS);
    P.wand = programm("Wand", WAND_VS, WAND_FS);
    P.fluss = programm("Bach", FLUSS_VS, FLUSS_FS);
    P.ding = programm("Ding", DING_VS, DING_FS);
    P.band = programm("Band", BAND_VS, BAND_FS);
    P.schein = programm("Schein", SCHEIN_VS, SCHEIN_FS);
    P.vogel = programm("Vogel", VOGEL_VS, VOGEL_FS);

    const N = bild.netz;
    // Der Flieger bekommt in jedem Bild ein neues Netz (seine Haltung), die
    // Gegner fliegen in der Haltung des Flugs.
    const flieger = fliegerNetz();
    N.flieger = abzug(flieger, [3, 3], 16, 2, gl.DYNAMIC_DRAW);
    N.flieger.netz = new Float32Array(flieger.length);
    N.geist = abzug(flieger, [3, 3], 16, 16);
    N.schirm = abzug(schirmNetz(), [3, 3], 16, 2);
    for (let i = 0; i < TURM_FORMEN; i += 1) N[`turm${i}`] = abzug(turmNetz(i), [3, 3], 16, 48);
    for (let i = 0; i < BROCKEN_FORMEN; i += 1) N[`brocken${i}`] = abzug(brockenNetz(i), [3, 3], 16, 64);
    N.kanzel = abzug(kanzelNetz(), [3, 3], 16, 2);
    N.tanne = abzug(tanneNetz(), [3, 3], 16, KACHELN * BAEUME_JE + 120);
    N.kasten = abzug(kastenNetz(), [3, 3], 16, 260);
    N.pfeiler = abzug(kastenNetz(0.86), [3, 3], 16, 48);
    N.dach = abzug(dachNetz(), [3, 3], 16, 64);
    N.bogen = abzug(bogenNetz(), [3, 3], 16, 48);
    const ecken = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
    N.schein = abzug(ecken, [2], 8, 420);
    N.vogel = abzug(ecken, [2], 8, 160);
    N.sonne = abzug(ecken, [2], 8, 2);

    kacheln.wand = puffer([3, 3], KACHELN * ECKEN_KACHEL, gl.DYNAMIC_DRAW);
    kacheln.fluss = puffer([3, 3], KACHELN * ECKEN_FLUSS, gl.DYNAMIC_DRAW);
    kacheln.drin.fill(-1);
    band.fest.puffer = puffer([3, 2, 4, 1], BAND_FEST_MAX, gl.STREAM_DRAW);
    band.luft.puffer = puffer([3, 2, 4, 1], BAND_LUFT_MAX, gl.STREAM_DRAW);
    bild.leer = gl.createVertexArray();

    const r = rauschBild();
    bild.rausch = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, bild.rausch);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, r.N, r.N, 0, gl.RGBA, gl.UNSIGNED_BYTE, r.px);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    bild.ok = true;
  }

  // Die Leinwand für die Welt entsteht einmal und bleibt über alle Runden –
  // mit ihr die Programme und Netze.
  function grafikStarten() {
    canvas = document.createElement("canvas");
    canvas.className = "ff-canvas";
    canvas.setAttribute("aria-hidden", "true");
    hud = document.createElement("canvas");
    hud.className = "ff-hud";
    hud.setAttribute("aria-hidden", "true");
    g = hud.getContext("2d");
    try {
      gl = canvas.getContext("webgl2", { antialias: true, alpha: false, depth: true, stencil: false, powerPreference: "high-performance" });
      if (gl) grafikBauen();
    } catch (fehler) {
      console.warn(fehler);
      bild.ok = false;
    }
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      bild.ok = false;
      bild.verloren = true;
    });
    canvas.addEventListener("webglcontextrestored", () => {
      bild.prog = {};
      bild.netz = {};
      try { grafikBauen(); bild.verloren = false; } catch (fehler) { console.warn(fehler); }
    });
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: ein Bild
  // ---------------------------------------------------------------------------
  const WEISS = [1, 1, 1];
  const STEIN = [0.7, 0.66, 0.6];
  const HOLZ = [0.4, 0.26, 0.16];
  const OHNE_BODEN = -1e4;

  // Ein Abzug: Ort, Drehung, Masse, Rollen, Farbe – und was das Programm
  // sonst wissen will: Nicken, der Boden (bei Fels), bis wohin der Schatten
  // reicht und wie viel Sonne darunter ist, eigenes Leuchten.
  function ding(a, x, y, z, dreh, sx, sy, sz, roll, farbe, hell, boden, schatten, darunter, nick = 0, glanz = 0) {
    if (a.n >= a.max) return;
    const d = a.daten;
    const o = a.n * 16;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = dreh;
    d[o + 4] = sx; d[o + 5] = sy; d[o + 6] = sz; d[o + 7] = roll;
    d[o + 8] = farbe[0] * hell; d[o + 9] = farbe[1] * hell; d[o + 10] = farbe[2] * hell; d[o + 11] = glanz;
    d[o + 12] = nick; d[o + 13] = boden; d[o + 14] = schatten; d[o + 15] = darunter;
    a.n += 1;
  }

  // Eine Scheibe zur Kamera. rand > 0: Licht dazu (so hart der Rand);
  // rand < 0: Staub, so deckend.
  function schein(x, y, z, gross, r, gr, b, rand = 2.2, a = bild.netz.schein) {
    if (a.n >= a.max) return;
    const d = a.daten;
    const o = a.n * 8;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = gross;
    d[o + 4] = r; d[o + 5] = gr; d[o + 6] = b; d[o + 7] = rand;
    a.n += 1;
  }

  function bandEcke(B, x, y, z, u, v, r, gr, b, a, art) {
    if (B.n >= B.max) return;
    const d = B.d;
    const o = B.n * 10;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = u; d[o + 4] = v;
    d[o + 5] = r; d[o + 6] = gr; d[o + 7] = b; d[o + 8] = a; d[o + 9] = art;
    B.n += 1;
  }

  // Ein Stück Band von A nach B, quer dazu je halb breit: zwei Dreiecke.
  // (qx, qy, qz) ist die Richtung quer – null heisst: zur Kamera gedreht.
  const farbeJetzt = [1, 1, 1, 1];
  function bandStueck(B, ax, ay, az, bx, by, bz, halbA, halbB, vA, vB, art, quer) {
    let q0x; let q0y; let q0z; let q1x; let q1y; let q1z;
    if (quer) {
      q0x = quer[0] * halbA; q0y = quer[1] * halbA; q0z = quer[2] * halbA;
      q1x = quer[0] * halbB; q1y = quer[1] * halbB; q1z = quer[2] * halbB;
    } else {
      // Quer zur Strecke und zum Blick: so schaut das Band die Kamera an.
      const tx = bx - ax, ty = by - ay, tz = bz - az;
      const sx = (ax + bx) / 2 - kam.ort[0], sy = (ay + by) / 2 - kam.ort[1], sz = (az + bz) / 2 - kam.ort[2];
      let nx = ty * sz - tz * sy;
      let ny = tz * sx - tx * sz;
      let nz = tx * sy - ty * sx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      q0x = nx * halbA; q0y = ny * halbA; q0z = nz * halbA;
      q1x = nx * halbB; q1y = ny * halbB; q1z = nz * halbB;
    }
    const [r, gr, b, a] = farbeJetzt;
    bandEcke(B, ax - q0x, ay - q0y, az - q0z, -1, vA, r, gr, b, a, art);
    bandEcke(B, ax + q0x, ay + q0y, az + q0z, 1, vA, r, gr, b, a, art);
    bandEcke(B, bx + q1x, by + q1y, bz + q1z, 1, vB, r, gr, b, a, art);
    bandEcke(B, ax - q0x, ay - q0y, az - q0z, -1, vA, r, gr, b, a, art);
    bandEcke(B, bx + q1x, by + q1y, bz + q1z, 1, vB, r, gr, b, a, art);
    bandEcke(B, bx - q1x, by - q1y, bz - q1z, -1, vB, r, gr, b, a, art);
  }
  function bandFarbe(r, gr, b, a) {
    farbeJetzt[0] = r; farbeJetzt[1] = gr; farbeJetzt[2] = b; farbeJetzt[3] = a;
  }

  // Ein Seil von A nach B, das durchhängt – nie dünner als gut ein Bildpunkt.
  function seil(ax, ay, az, bx, by, bz, durchhang, dick, stuecke = 10) {
    const punkt = 2 * kam.tan[1] / Math.max(1, view.cssH);
    let px = ax; let py = ay; let pz = az;
    for (let i = 1; i <= stuecke; i += 1) {
      const u = i / stuecke;
      const x = lerp(ax, bx, u);
      const y = lerp(ay, by, u) - durchhang * 4 * u * (1 - u);
      const z = lerp(az, bz, u);
      const weit = Math.hypot(x - kam.ort[0], y - kam.ort[1], z - kam.ort[2]);
      const halb = Math.max(dick, weit * punkt * 0.75);
      bandStueck(band.fest, px, py, pz, x, y, z, halb, halb, 0, 0, 1, null);
      px = x; py = y; pz = z;
    }
  }

  // Die Rauchfahne: Wo die Fersen waren, alle paar Meter ein Punkt, im Kreis.
  const SPUR_N = 64;
  const spur = { x: new Float32Array(SPUR_N * 2), y: new Float32Array(SPUR_N * 2), z: new Float32Array(SPUR_N * 2), t: new Float32Array(SPUR_N * 2), kopf: 0, n: 0, zuletzt: -1e9 };

  function spurNeu() {
    spur.kopf = 0;
    spur.n = 0;
    spur.zuletzt = -1e9;
  }

  function spurTakt() {
    if (state.schritt !== "flug" || state.z - spur.zuletzt < 1.3) return;
    spur.zuletzt = state.z;
    const i = spur.kopf;
    const c = Math.cos(state.roll);
    const s = Math.sin(state.roll);
    for (const [seite, ab] of [[-1, 0], [1, SPUR_N]]) {
      spur.x[ab + i] = state.x + seite * 0.4 * c;
      spur.y[ab + i] = state.y - seite * 0.4 * s + 0.02;
      spur.z[ab + i] = state.z - 1.6;
      spur.t[ab + i] = state.zeit;
    }
    spur.kopf = (i + 1) % SPUR_N;
    spur.n = Math.min(SPUR_N, spur.n + 1);
  }

  function rauchLegen() {
    if (spur.n < 2 || state.schritt === "start") return;
    const B = band.luft;
    for (const ab of [0, SPUR_N]) {
      // Von den Fersen (jetzt) rückwärts durch die Punkte.
      const c = Math.cos(state.roll);
      const s = Math.sin(state.roll);
      const seite = ab ? 1 : -1;
      let px = state.x + seite * 0.4 * c;
      let py = state.y - seite * 0.4 * s + 0.02;
      let pz = state.z - 1.6;
      let pAlter = 0;
      for (let n = 1; n <= spur.n; n += 1) {
        const i = ab + ((spur.kopf - n + SPUR_N * 2) % SPUR_N);
        const alter = state.zeit - spur.t[i];
        if (alter > 1.5) break;
        const x = spur.x[i];
        const y = spur.y[i] - alter * 0.5;
        const z = spur.z[i];
        const weit = Math.hypot((x + px) / 2 - kam.ort[0], (y + py) / 2 - kam.ort[1], (z + pz) / 2 - kam.ort[2]);
        const deck = 0.27 * Math.pow(1 - (alter + pAlter) / 3, 1.6) * weich(1.5, 6, weit);
        bandFarbe(1.0, 0.96, 0.9, deck);
        bandStueck(B, px, py, pz, x, y, z, 0.035 + pAlter * 0.55, 0.035 + alter * 0.55, 0, 0, 0, null);
        px = x; py = y; pz = z; pAlter = alter;
      }
    }
  }

  // Windstreifen: helle Striche, die am Flieger vorbeiziehen – mehr und
  // heller, je schneller es geht, und dort, wo der Fels nah ist.
  const STREIFEN = 44;
  const streifen = Array.from({ length: STREIFEN }, () => ({ x: 0, y: 0, z: -1e9, lang: 4, hell: 0 }));

  function streifenLegen() {
    if (ruhig() || state.schritt !== "flug") return;
    const B = band.luft;
    const v = tempoBei(state.z);
    const schnell = clamp((v - 20) / (V_MAX - 20), 0, 1);
    const nah = state.naehe;
    for (let i = 0; i < STREIFEN; i += 1) {
      const s = streifen[i];
      if (s.z + s.lang < kam.z + 1 || s.z > state.z + 160) {
        // Ein neuer, ein Stück voraus. Jeder dritte gehört der Felsseite.
        s.z = state.z + 25 + Math.random() * 95;
        const amFels = nah > 0.05 && i % 3 === 0;
        if (amFels) {
          s.x = state.x + state.abSeite * state.ab * (0.25 + 0.7 * Math.random());
          s.y = state.y + (Math.random() - 0.5) * 3.5;
          s.hell = 0.3 + 0.5 * nah;
        } else {
          const w = Math.random() * Math.PI * 2;
          const r = 2.5 + Math.random() * 9;
          s.x = state.x + Math.cos(w) * r + state.vx * 0.5;
          s.y = state.y + Math.sin(w) * r * 0.6 + 0.5;
          s.hell = (0.1 + 0.16 * Math.random()) * (0.4 + 0.6 * schnell);
        }
        s.lang = 3 + v * 0.09 + Math.random() * 3;
      }
      if (s.z < kam.z + 2) continue;
      bandFarbe(1.0, 0.97, 0.9, s.hell);
      bandStueck(B, s.x, s.y, s.z, s.x, s.y, s.z + s.lang, 0.045, 0.045, 0, 1, 4, null);
    }
  }

  // Die Sonnenstrahlen: helle Schleier, die vom linken Rand schräg in die
  // Schlucht fallen – der Sonne nach. Wo, folgt aus festen Zahlen; kräftig
  // sind sie, wo der Rand eine Scharte hat.
  const STRAHL_QUER = (() => {
    const l = Math.hypot(SONNE[1], SONNE[0]);
    return [SONNE[1] / l, -SONNE[0] / l, 0];
  })();
  function strahlenLegen() {
    const B = band.luft;
    const RASTER = 46;
    const von = Math.floor((kam.z + 20) / RASTER);
    for (let i = von; i < von + 20; i += 1) {
      const h = hashGanz(i * 3 + 11);
      if (h < 0.45) continue;
      const z = i * RASTER + hashGanz(i * 3 + 12) * 30;
      if (z < 60 || z > Z_ENDE + 200 || z > knotenZ(W.fest - 2)) continue;
      const rand = knoten(W.randL, z);
      const boden = knoten(W.boden, z);
      const hoch = knoten(W.hoch, z);
      const scharte = clamp((104 - rand) / 30, 0, 1);
      const kraft = (0.07 + 0.15 * scharte + 0.05 * h) * hoch;
      const ax = knoten(W.wandL, z) - 10;
      const ay = boden + (rand + 14) * hoch;
      const lang = (rand + 26) * hoch / SONNE[1];
      const halb = 4 + 9 * hashGanz(i * 3 + 13);
      bandFarbe(1, 1, hashGanz(i * 3 + 14), kraft);
      bandStueck(B, ax, ay, z, ax - SONNE[0] * lang, ay - SONNE[1] * lang, z - SONNE[2] * lang, halb, halb * 1.5, 0, 1, 3, STRAHL_QUER);
    }
  }

  // Ein Wasserfall: Er folgt der Wand vom Rand bis in den Bach.
  function wasserfallLegen(d) {
    const k = Math.round((d.z - Z_MIN) / DZ);
    if (k >= W.fest - 2) return;
    // Vom Rand (Reihe 16) bis an den Bach (Reihe 1).
    const P = 16;
    if (!d.punkte) {
      d.punkte = new Float32Array(P * 4);
      for (let j = P; j >= 1; j -= 1) {
        wandEcke(d.s, k, j, gitter, 0);
        const o = (P - j) * 4;
        d.punkte[o] = gitter[0] - d.s * 0.8;
        d.punkte[o + 1] = gitter[1] + (j === 1 ? -0.3 : 0.3);
        d.punkte[o + 2] = gitter[4];
      }
      let lang = 0;
      for (let n = 0; n < P; n += 1) {
        if (n) lang += Math.hypot(d.punkte[n * 4] - d.punkte[n * 4 - 4], d.punkte[n * 4 + 1] - d.punkte[n * 4 - 3]);
        d.punkte[n * 4 + 3] = lang;
      }
    }
    const B = band.luft;
    const p = d.punkte;
    const quer = [0, 0, 1];
    for (let n = 0; n < P - 1; n += 1) {
      const o = n * 4;
      const breit = d.breit * (0.5 + 0.5 * Math.min(1, n / 3));
      const breit2 = d.breit * (0.5 + 0.5 * Math.min(1, (n + 1) / 3));
      bandFarbe(0.3 + 0.7 * p[o + 2], 1, 1, n === 0 ? 0.5 : 0.92);
      bandStueck(B, p[o], p[o + 1], d.z, p[o + 4], p[o + 5], d.z, breit / 2, breit2 / 2, p[o + 3], p[o + 7], 2, quer);
    }
    // Unten stäubt es.
    const fuss = (P - 1) * 4;
    for (let i = 0; i < 3; i += 1) {
      const w = state.zeit * (0.5 + 0.2 * i) + i * 2.1;
      schein(p[fuss] - d.s * (1.5 + i * 1.2) + Math.sin(w) * 0.6, p[fuss + 1] + 1.5 + i * 1.3 + Math.cos(w * 1.3) * 0.4, d.z + Math.sin(w * 0.7) * d.breit * 0.3,
        d.breit * (0.9 + 0.35 * i), 0.82, 0.9, 1.0, -0.2);
    }
  }

  // Eine Hängebrücke hoch über dem Flieger: zwei Tragseile, der Steg, und
  // Fähnchen im Wind.
  const FAHNEN = [[0.86, 0.14, 0.12], [0.96, 0.96, 0.96], [0.2, 0.42, 0.8], [0.98, 0.76, 0.16], [0.2, 0.6, 0.3]];
  function haengebrueckeLegen(d) {
    if (d.z > knotenZ(W.fest - 2)) return;
    const boden = knoten(W.boden, d.z);
    const l = knoten(W.wandL, d.z) - 6;
    const r = knoten(W.wandR, d.z) + 6;
    const y = boden + d.u;
    const hang = (r - l) * 0.055;
    bandFarbe(0.2, 0.17, 0.15, 1);
    for (const dz of [-0.75, 0.75]) seil(l, y + 1.3, d.z + dz, r, y + 1.3, d.z + dz, hang, 0.05, 12);
    // Der Steg: Bretter, von unten gesehen.
    const N = 14;
    for (let i = 0; i < N; i += 1) {
      const u0 = i / N;
      const u1 = (i + 1) / N;
      const y0 = y - hang * 4 * u0 * (1 - u0);
      const y1 = y - hang * 4 * u1 * (1 - u1);
      bandFarbe(0.36, 0.25, 0.16, 1);
      bandStueck(band.fest, lerp(l, r, u0), y0, d.z, lerp(l, r, u1), y1, d.z, 0.75, 0.75, 0, 0, 1, [0, 0, 1]);
      // Hänger vom Tragseil zum Steg.
      bandFarbe(0.2, 0.17, 0.15, 1);
      if (i % 2 === 0) for (const dz of [-0.75, 0.75]) seil(lerp(l, r, u0), y0 + 1.3, d.z + dz, lerp(l, r, u0), y0, d.z + dz, 0, 0.03, 1);
    }
    // Fähnchen an einer Leine darunter.
    const F = Math.round((r - l) / 2.2);
    for (let i = 1; i < F; i += 1) {
      const u = i / F;
      const fx = lerp(l, r, u);
      const fy = y - hang * 4 * u * (1 - u) - 0.25;
      const weht = Math.sin(state.zeit * 5 + i * 1.7) * 0.25;
      const farbe = FAHNEN[i % FAHNEN.length];
      bandFarbe(farbe[0], farbe[1], farbe[2], 1);
      bandStueck(band.fest, fx, fy, d.z + 0.8, fx + 0.1, fy - 0.95, d.z + 0.8 + 0.35 + weht, 0.42, 0.34, 0, 0, 1, [1, 0, 0]);
    }
  }

  // Eine Seilbahn quer über die Schlucht, mit einer Gondel, die gemächlich
  // hinüberfährt.
  function seilbahnLegen(d) {
    if (d.z > knotenZ(W.fest - 2)) return;
    const N = bild.netz;
    const boden = knoten(W.boden, d.z);
    const l = knoten(W.wandL, d.z) - 22;
    const r = knoten(W.wandR, d.z) + 22;
    const yl = boden + d.u + 6;
    const yr = boden + d.u - 4;
    const hang = (r - l) * 0.035;
    bandFarbe(0.13, 0.13, 0.15, 1);
    seil(l, yl, d.z, r, yr, d.z, hang, 0.04, 14);
    const u = 0.5 + 0.36 * Math.sin(state.zeit * 0.12 + d.phase);
    const gx = lerp(l, r, u);
    const gy = lerp(yl, yr, u) - hang * 4 * u * (1 - u);
    ding(N.kasten, gx, gy - 1.3, d.z, 0, 0.05, 1.3, 0.05, 0, DUNKEL, 1, OHNE_BODEN, 1e5, 1);
    ding(N.kasten, gx, gy - 3.6, d.z, 0, 1.5, 1.05, 1.0, 0, ROT, 1, OHNE_BODEN, 1e5, 1, 0, 0.15);
    ding(N.kasten, gx, gy - 3.25, d.z, 0, 1.53, 0.3, 1.03, 0, [0.75, 0.86, 0.95], 1, OHNE_BODEN, 1e5, 1, 0, 0.2);
    ding(N.kasten, gx, gy - 2.5, d.z, 0, 1.6, 0.07, 1.1, 0, HELM, 1, OHNE_BODEN, 1e5, 1);
  }

  // Ein Trupp Dohlen, der an der Wand kreist.
  function dohlenLegen(d) {
    if (d.z > knotenZ(W.fest - 2)) return;
    const a = bild.netz.vogel;
    const boden = knoten(W.boden, d.z);
    const mitte = knoten(W.mitte, d.z) + d.s * 6;
    for (let j = 0; j < d.n; j += 1) {
      if (a.n >= a.max) return;
      const h = hash01(j * 7.3 + d.z);
      const richtung = j % 2 ? 1 : -1;
      const w = state.zeit * (0.55 + 0.35 * h) * richtung + j * 1.9;
      const r = 4 + 9 * hash01(j * 3.1 + d.z * 0.7);
      const o = a.n * 8;
      a.daten[o] = mitte + Math.cos(w) * r;
      a.daten[o + 1] = boden + d.u + j * 1.7 + Math.sin(w * 0.6 + j) * 2.4;
      a.daten[o + 2] = d.z + Math.sin(w) * r * 1.5;
      a.daten[o + 3] = h;
      a.daten[o + 4] = richtung * 0.5;
      a.daten[o + 5] = 0.5 + 0.5 * Math.sin(w * 0.37 + j);
      a.daten[o + 6] = 0.62;
      a.daten[o + 7] = 1;
      a.n += 1;
    }
  }

  // Das Dorf im Tal: ein paar Hütten und eine Kapelle auf der Wiese.
  function dorfLegen(d) {
    const N = bild.netz;
    if (d.z > knotenZ(W.fest - 80)) return;
    if (!d.haeuser) {
      d.haeuser = [];
      for (let i = 0; i < 9; i += 1) {
        const z = d.z + (hash01(i * 3.3) - 0.5) * 420;
        const seite = i % 2 ? 1 : -1;
        const x = knoten(W.fluss, z) + seite * (38 + hash01(i * 5.1) * 110);
        d.haeuser.push({ x, z, y: hoeheBei(x, z), dreh: hash01(i * 9.7) * 3.1, gross: 0.8 + 0.5 * hash01(i * 1.9), kapelle: i === 4, sonne: sonneBei(x, hoeheBei(x, z) + 3, z) });
      }
    }
    for (const h of d.haeuser) {
      const gr = h.gross;
      if (h.kapelle) {
        ding(N.kasten, h.x, h.y + 2.2, h.z, h.dreh, 2.4, 2.4, 3.6, 0, [0.95, 0.94, 0.9], 1, OHNE_BODEN, 1e5, h.sonne);
        ding(N.dach, h.x, h.y + 4.6, h.z, h.dreh, 2.8, 2.2, 4.0, 0, [0.42, 0.2, 0.16], 1, OHNE_BODEN, 1e5, h.sonne);
        const tx = h.x + Math.sin(h.dreh) * 4.2;
        const tz = h.z + Math.cos(h.dreh) * 4.2;
        ding(N.kasten, tx, h.y + 4.5, tz, h.dreh, 1.2, 4.5, 1.2, 0, [0.95, 0.94, 0.9], 1, OHNE_BODEN, 1e5, h.sonne);
        ding(N.dach, tx, h.y + 9, tz, h.dreh, 1.4, 4.4, 0.08, 0, [0.42, 0.2, 0.16], 1, OHNE_BODEN, 1e5, h.sonne);
        ding(N.dach, tx, h.y + 9, tz, h.dreh + Math.PI / 2, 1.4, 4.4, 0.08, 0, [0.42, 0.2, 0.16], 1, OHNE_BODEN, 1e5, h.sonne);
      } else {
        ding(N.kasten, h.x, h.y + 1.5 * gr, h.z, h.dreh, 3.4 * gr, 1.7 * gr, 2.7 * gr, 0, HOLZ, 0.9 + 0.3 * hash01(h.x), OHNE_BODEN, 1e5, h.sonne);
        ding(N.dach, h.x, h.y + 3.1 * gr, h.z, h.dreh + Math.PI / 2, 3.3 * gr, 1.7 * gr, 4.1 * gr, 0, [0.3, 0.27, 0.27], 1, OHNE_BODEN, 1e5, h.sonne);
      }
    }
  }

  // Eine Steinbrücke: Pfeiler, Bögen dazwischen, darüber die Fahrbahn.
  function brueckeLegen(d) {
    const N = bild.netz;
    const boden = bodenBei(d.z);
    if (d.sonne === undefined) {
      if (d.z > knotenZ(W.fest - 70)) return;
      d.sonne = sonneBei(d.x, boden + 40, d.z);
      d.links = knoten(W.wandL, d.z);
      d.rechts = knoten(W.wandR, d.z);
    }
    const tief = d.tief / 2;
    const stuetzen = [d.links - 9];
    for (const p of d.pfeiler) {
      ding(N.pfeiler, p.x, boden + 15.5, d.z, 0, p.b / 2 + 0.25, 18.6, tief + 0.2, 0, STEIN, 1, OHNE_BODEN, 1e5, d.sonne * 0.3, 0, -1);
      stuetzen.push(p.x - p.b / 2, p.x + p.b / 2);
    }
    stuetzen.push(d.rechts + 9);
    for (let i = 0; i < stuetzen.length; i += 2) {
      const a = stuetzen[i];
      const b = stuetzen[i + 1];
      ding(N.bogen, (a + b) / 2, boden + 34, d.z, 0, (b - a) / 2, 9.5, tief, 0, STEIN, 0.96, OHNE_BODEN, 1e5, d.sonne * 0.6, 0, -1);
    }
    for (const p of d.pfeiler) ding(N.kasten, p.x, boden + 38.75, d.z, 0, p.b / 2 + 0.3, 4.75, tief - 0.02, 0, STEIN, 0.96, OHNE_BODEN, 1e5, d.sonne * 0.6, 0, -1);
    const mitte = (d.links + d.rechts) / 2;
    const halb = (d.rechts - d.links) / 2 + 10;
    ding(N.kasten, mitte, boden + 43.8, d.z, 0, halb, 0.4, tief + 0.5, 0, STEIN, 0.85, OHNE_BODEN, 1e5, d.sonne, 0, -1);
    for (const dz of [-1, 1]) ding(N.kasten, mitte, boden + 44.7, d.z + dz * (tief + 0.3), 0, halb, 0.55, 0.22, 0, STEIN, 1.05, OHNE_BODEN, 1e5, d.sonne);
  }

  const geisterOrte = [];
  const farbenMerker = new Map();
  function farbeAus(hex) {
    if (!farbenMerker.has(hex)) {
      const n = parseInt(String(hex || "#ffffff").slice(1), 16) || 0xffffff;
      farbenMerker.set(hex, [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]);
    }
    return farbenMerker.get(hex);
  }

  /*
   * Die Haltung des Fliegers in diesem Bild (fliegerNetz): Auf der Kanzel
   * steht er, die Arme ein wenig gebreitet. Im Absprung gehen Arme und Beine
   * auf, im Flug ist alles gespannt, und wer lenkt, nimmt den inneren Arm
   * zurück. Am Schirm hängt er, die Hände oben an den Leinen.
   */
  const POSE = { spann: 1, hoch: 0, lenk: 0, zeit: 0, flattern: 0, stehen: 0, knie: 0.08 };
  function fliegerPose() {
    const P = POSE;
    P.zeit = state.echt;
    P.flattern = ruhig() ? 0 : clamp(tempoBei(state.z) / V_MAX, 0, 1);
    P.lenk = clamp(state.roll / 0.86, -1, 1);
    P.hoch = 0;
    P.knie = 0.08;
    if (state.schritt === "start") {
      P.spann = 0.3;
      P.stehen = 1;
      P.knie = 0.03;
      P.flattern = 0;
      P.lenk = 0;
    } else if (state.schritt === "landung") {
      const k = weich(0, 0.9, state.zeit - state.schrittZeit);
      P.spann = lerp(1, 0.14, k);
      P.hoch = k * (state.gelandet ? 0.3 : 0.86);
      P.stehen = k;
      P.knie = lerp(0.08, state.gelandet ? 0.05 : 0.32, k);
      P.flattern *= 1 - k;
      P.lenk = 0;
    } else {
      P.spann = lerp(0.3, 1, weich(1, 46, state.z));
      P.stehen = 1 - weich(0, 26, state.z);
      if (state.schritt === "aus") { P.spann = 0.75; P.lenk = 0; }
    }
    return P;
  }

  // Was im Bild steht, in die Abzüge und Bänder schreiben.
  function weltSammeln() {
    const N = bild.netz;
    for (const name of Object.keys(N)) N[name].n = 0;
    band.fest.n = 0;
    band.luft.n = 0;
    const hinten = kam.z - 30;
    const vorn = kam.z + SICHT_WEIT;
    const steht = knotenZ(W.fest - 70);

    // Die Kanzel, von der er abspringt.
    if (kam.z < 300) {
      const boden = bodenBei(0);
      const oben = boden + FLUG_Y + START_HOCH - 1.62;
      ding(N.kanzel, 0, oben, -1.5, 0, 2.3, 34, 3.4, 0, WEISS, 1.04, boden, -1e5, 1, 0, 0.75);
      // Ein Brocken liegt noch darauf.
      ding(N.brocken0, -1.5, oben - 0.25, -3.1, 0.7, 0.8, 0.5, 0.9, 0, WEISS, 1, boden, -1e5, 1, 0, 1);
    }

    // Was trifft.
    for (const d of W.dinge) {
      if (d.z < hinten) continue;
      if (d.z > vorn) break;
      if (d.art === "bruecke") { brueckeLegen(d); continue; }
      if (d.z > steht) continue;
      const boden = bodenBei(d.z);
      if (d.art === "turm") {
        if (d.schatten === undefined) d.schatten = schattenBei(d.x, d.z);
        const s = d.r / turmBreite(FLUG_Y / d.h);
        ding(N[`turm${d.form}`], d.x, boden, d.z, d.dreh, s, d.h, s, 0, WEISS, 0.92 + 0.16 * hash01(d.z), boden - 14, d.schatten, 0);
      } else if (d.art === "tanne") {
        if (d.sonne === undefined) {
          d.sonne = sonneBei(d.x, boden + 34, d.z);
          d.wand = d.s < 0 ? knoten(W.wandL, d.z) : knoten(W.wandR, d.z);
        }
        ding(N.tanne, d.x, boden + TANNE_FUSS, d.z, d.dreh, TANNE_R / 0.58, TANNE_H, TANNE_R / 0.58, 0, WEISS, 1.15, OHNE_BODEN, 1e5, d.sonne);
        // Das Felsband darunter, bis in die Wand.
        const breit = Math.abs(d.wand - d.x) / 2 + 3.5;
        ding(N[`brocken${Math.floor(hash01(d.z) * BROCKEN_FORMEN)}`], (d.x + d.wand) / 2 + d.s * 1.5, boden + TANNE_FUSS - 4.6, d.z, d.dreh, breit, 5.2, 5.5, 0, WEISS, 1, boden, 1e5, d.sonne * 0.5);
      }
    }

    // Was nur schön ist.
    for (const d of W.zier) {
      if (d.z < hinten - 40 || d.z > vorn) continue;
      if (d.art === "wasserfall") wasserfallLegen(d);
      else if (d.art === "haengebruecke") haengebrueckeLegen(d);
      else if (d.art === "seilbahn") seilbahnLegen(d);
      else if (d.art === "dohlen") dohlenLegen(d);
      else if (d.art === "dorf") { if (d.z < vorn + 300) dorfLegen(d); }
      else if (d.art === "sturz" && d.z < steht) {
        // Der Sturz über einem Felsbogen: von Wand zu Wand.
        if (d.schatten === undefined) {
          d.links = knoten(W.glattL, d.z);
          d.rechts = knoten(W.glattR, d.z);
          d.schatten = schattenBei((d.links + d.rechts) / 2, d.z);
        }
        const boden = bodenBei(d.z);
        ding(N[`brocken${d.form}`], (d.links + d.rechts) / 2, boden + 50.5, d.z, d.dreh * 0.3, (d.rechts - d.links) / 2 + 9, 10.5, 7.5, 0, WEISS, 1, boden - 8, d.schatten, 0);
      }
    }

    // Die Tannen der Kacheln.
    for (let p = 0; p < KACHELN; p += 1) {
      if (kacheln.drin[p] < 0) continue;
      const B = kacheln.baeume[p];
      for (let i = 0; i < B.n; i += 1) {
        const o = i * 6;
        if (B.d[o + 2] < hinten) continue;
        const gross = B.d[o + 3];
        const schnee = B.d[o + 5];
        const a = N.tanne;
        if (a.n >= a.max) break;
        const q = a.n * 16;
        const dd = a.daten;
        dd[q] = B.d[o]; dd[q + 1] = B.d[o + 1]; dd[q + 2] = B.d[o + 2]; dd[q + 3] = o * 1.7;
        dd[q + 4] = gross * 0.21; dd[q + 5] = gross; dd[q + 6] = gross * 0.21; dd[q + 7] = 0;
        dd[q + 8] = 1 + 3.2 * schnee; dd[q + 9] = 1 + 2.1 * schnee; dd[q + 10] = 1 + 3.9 * schnee; dd[q + 11] = 0;
        dd[q + 12] = 0; dd[q + 13] = OHNE_BODEN; dd[q + 14] = 1e5; dd[q + 15] = B.d[o + 4];
        a.n += 1;
      }
    }

    // Der Flieger: erst seine Haltung, dann wo er ist.
    const v = Math.max(8, tempoBei(state.z));
    const gier = state.schritt === "flug" ? Math.atan2(state.vx, v) * 0.55 : 0;
    const deck = state.schritt === "aus" ? 1 - weich(0.9, 1.5, state.zeit - state.schrittZeit) : 1;
    if (deck > 0.02) {
      let roll = -state.roll;
      let nick = state.nick;
      let dreh = gier;
      if (state.sturz) { roll = state.sturz.roll; nick = state.sturz.nick; dreh = state.sturz.gier; }
      fliegerNetz(fliegerPose(), N.flieger.netz);
      gl.bindBuffer(gl.ARRAY_BUFFER, N.flieger.vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, N.flieger.netz);
      ding(N.flieger, state.x, state.y, state.z, dreh, 1.3 * deck, 1.3 * deck, 1.3 * deck, roll, WEISS, 1, OHNE_BODEN, 1e5, state.sonne, nick, 0.24);
    }
    if (state.schirm > 0.01) {
      const auf = state.schirm;
      ding(N.schirm, state.x, state.y + 6.4 * auf, state.z - 0.6, 0, auf, lerp(0.4, 1, auf), auf, -state.roll * 0.4, WEISS, 1, OHNE_BODEN, 1e5, 1, 0, 0.1);
      // Die Leinen.
      bandFarbe(0.92, 0.92, 0.95, 1);
      for (const sx of [-3.3, -1.7, 1.7, 3.3]) {
        for (const sz of [1.2, -1.1]) {
          seil(state.x + Math.sign(sx) * 0.22, state.y + 0.5, state.z, state.x + sx * auf, state.y + (6.4 - 0.9 - Math.abs(sx) * 0.28) * auf, state.z - 0.6 + sz * auf, 0, 0.012, 1);
        }
      }
    }

    // Die Gegner (geist.js): je ein Flieger aus Licht.
    geisterOrte.length = 0;
    if (gegner && state.phase !== "bereit") {
      (window.LernappGeist?.orte?.(gegner) || []).forEach((o) => {
        geisterOrte.push(o);
        // Wem im Live-Modus zugeschaut wird, der ist der Flieger selbst – kein
        // Geist dazu, nur sein Name (geist.js, namen).
        if (o.ziel) return;
        const farbe = farbeAus(o.farbe);
        const gx = o.b / 10;
        const gz = o.a / 10;
        if (gz < kam.z + 1 || gz > kam.z + 700) return;
        const gy = flugHoehe(gz);
        const schraeg = o.c > 250 ? 0 : o.c / 100;
        ding(N.geist, gx, gy, gz, 0, 1.3, 1.3, 1.3, -schraeg, farbe, 1, OHNE_BODEN, 1e5, 1, nickBei(gz), o.blass);
        // Ein Schein um ihn – von weitem ein Licht, das man noch sieht.
        const fern = Math.max(3.2, (gz - kam.z) * 0.03);
        schein(gx, gy, gz, fern, farbe[0] * 0.34 * o.blass, farbe[1] * 0.34 * o.blass, farbe[2] * 0.34 * o.blass, 1.8);
      });
    }

    // Staub und Steinchen.
    for (const t of state.teile) {
      const k = clamp(t.leben / t.max, 0, 1);
      // Dicht vor der Linse wäre ein Staubkorn ein Fleck im Bild.
      const weit = Math.hypot(t.x - kam.ort[0], t.y - kam.ort[1], t.z - kam.ort[2]);
      schein(t.x, t.y, t.z, t.r, t.farbe[0], t.farbe[1], t.farbe[2], -t.deck * Math.min(1, k * 2.5) * weich(2.5, 8, weit));
    }
    rauchLegen();
    streifenLegen();
    strahlenLegen();

    // Ein Schleier vor der Sonne: Er legt sich auch über den Fels davor.
    schein(kam.ort[0] + SONNE[0] * 900, kam.ort[1] + SONNE[1] * 900, kam.ort[2] + SONNE[2] * 900, 560,
      MORGEN.glut[0] * 0.2, MORGEN.glut[1] * 0.17, MORGEN.glut[2] * 0.12, 2.4, N.sonne);
    for (const name of Object.keys(N)) hochladen(N[name]);
    for (const B of [band.fest, band.luft]) {
      if (!B.n) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, B.puffer.vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, B.d, 0, B.n * 10);
    }
  }

  function lichtSetzen(p) {
    gl.uniform3fv(p.ort("uSonne"), SONNE);
    gl.uniform3fv(p.ort("uLicht"), MORGEN.licht);
    gl.uniform3fv(p.ort("uHimmelLicht"), MORGEN.himmelLicht);
    gl.uniform3fv(p.ort("uPrall"), MORGEN.prall);
    gl.uniform3fv(p.ort("uNebel"), MORGEN.nebel);
    gl.uniform3fv(p.ort("uGlut"), MORGEN.glut);
    gl.uniform1f(p.ort("uDichte"), MORGEN.dichte);
    gl.uniform1f(p.ort("uZeit"), state.echt);
    gl.uniform1i(p.ort("uRausch"), 0);
  }

  const DINGE_FEST = ["flieger", "schirm", "kanzel", "turm0", "turm1", "turm2", "turm3", "brocken0", "brocken1", "brocken2", "tanne", "kasten", "pfeiler", "dach", "bogen"];

  function zeichneWelt() {
    if (!bild.ok || !gl || gl.isContextLost()) return;
    const P = bild.prog;
    const N = bild.netz;
    kameraStellen();
    kachelnTakt(false);
    weltSammeln();

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.CULL_FACE);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bild.rausch);
    for (const name of ["himmel", "wand", "fluss", "ding", "band", "vogel"]) {
      gl.useProgram(P[name].p);
      lichtSetzen(P[name]);
      if (name === "himmel") continue;
      gl.uniform3fv(P[name].ort("uKam"), kam.ort);
      if (name !== "vogel") gl.uniformMatrix4fv(P[name].ort("uPV"), false, kam.pv);
    }
    for (const name of ["vogel", "schein"]) {
      gl.useProgram(P[name].p);
      gl.uniformMatrix4fv(P[name].ort("uProj"), false, kam.proj);
      gl.uniformMatrix4fv(P[name].ort("uSicht"), false, kam.sicht);
      gl.uniform3fv(P[name].ort("uKam"), kam.ort);
    }
    gl.useProgram(P.vogel.p);
    gl.uniform1f(P.vogel.ort("uPunkt"), 2 * kam.tan[1] / Math.max(1, view.cssH));

    // 1. Alles Feste: die Schlucht, der Bach, die Dinge, Seile und Bretter.
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(P.wand.p);
    gl.bindVertexArray(kacheln.wand.vao);
    gl.drawArrays(gl.TRIANGLES, 0, KACHELN * ECKEN_KACHEL);
    gl.useProgram(P.fluss.p);
    gl.bindVertexArray(kacheln.fluss.vao);
    gl.drawArrays(gl.TRIANGLES, 0, KACHELN * ECKEN_FLUSS);
    gl.useProgram(P.ding.p);
    gl.uniform1f(P.ding.ort("uGeist"), 0);
    for (const name of DINGE_FEST) zeichneAbzug(N[name]);
    gl.useProgram(P.band.p);
    if (band.fest.n) {
      gl.bindVertexArray(band.fest.puffer.vao);
      gl.drawArrays(gl.TRIANGLES, 0, band.fest.n);
    }

    // 2. Der Himmel – ganz hinten, also nur dort, wo noch nichts steht. In
    // der Schlucht ist das ein schmaler Streifen: Sein Programm läuft für
    // wenige Bildpunkte.
    gl.depthMask(false);
    gl.useProgram(P.himmel.p);
    gl.uniform3fv(P.himmel.ort("uRechts"), kam.rechts);
    gl.uniform3fv(P.himmel.ort("uHoch"), kam.hoch);
    gl.uniform3fv(P.himmel.ort("uVor"), kam.vor);
    gl.uniform2fv(P.himmel.ort("uTan"), kam.tan);
    gl.uniform3fv(P.himmel.ort("uZenit"), MORGEN.zenit);
    gl.uniform3fv(P.himmel.ort("uHorizont"), MORGEN.horizont);
    gl.bindVertexArray(bild.leer);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 3. Was durchscheint oder leuchtet: Wasserfälle, Sonnenstrahlen, Rauch,
    // Windstreifen, Dohlen, Staub – und die Gegner.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(P.band.p);
    if (band.luft.n) {
      gl.bindVertexArray(band.luft.puffer.vao);
      gl.drawArrays(gl.TRIANGLES, 0, band.luft.n);
    }
    gl.useProgram(P.vogel.p);
    zeichneAbzug(N.vogel);
    gl.useProgram(P.schein.p);
    zeichneAbzug(N.schein);
    if (N.geist.n) {
      gl.useProgram(P.ding.p);
      gl.uniform1f(P.ding.ort("uGeist"), 1);
      zeichneAbzug(N.geist);
    }

    // 4. Der Schleier vor der Sonne, über allem.
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(P.schein.p);
    zeichneAbzug(N.sonne);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.bindVertexArray(null);
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    feld = shell.el("div", "ff-feld");
    feld.append(canvas, hud);
    if (!bild.ok) {
      feld.append(shell.el("p", "ff-ohne", "Dieses Spiel braucht WebGL 2 – dieser Browser kann das leider nicht."));
    }
    return feld;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    // Auf dem Handy reicht die Leinwand unter die Knöpfe oben (game-shell.js,
    // frei): Die Anzeige rückt darunter.
    const oben = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && oben === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = oben;
    view.pw = Math.max(2, Math.round(cssW * dpr * view.guete));
    view.ph = Math.max(2, Math.round(cssH * dpr * view.guete));
    if (canvas.width !== view.pw) canvas.width = view.pw;
    if (canvas.height !== view.ph) canvas.height = view.ph;
    const hw = Math.round(cssW * dpr);
    const hh = Math.round(cssH * dpr);
    if (hud.width !== hw) hud.width = hw;
    if (hud.height !== hh) hud.height = hh;
  }

  // Flüssig geht vor scharf: Kommen die Bilder zu langsam, wird die Welt mit
  // weniger Bildpunkten gezeichnet (die Zahlen darüber bleiben scharf) – und
  // wieder mit mehr, wenn lange Luft war.
  function gueteTakt(sekunden) {
    if (view.fest || !bild.ok) return;
    if (sekunden > 0.027) view.langsam += sekunden;
    else view.langsam = Math.max(0, view.langsam - sekunden * 0.5);
    if (sekunden < 0.0185) view.schnell += sekunden;
    else view.schnell = 0;
    let neu = view.guete;
    if (view.langsam > 1.2) neu = Math.max(0.5, view.guete - 0.15);
    else if (view.schnell > 8) neu = Math.min(1, view.guete + 0.1);
    if (neu === view.guete) return;
    view.guete = neu;
    view.langsam = 0;
    view.schnell = 0;
    view.cssW = 0;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Zahlen und Namen
  // ---------------------------------------------------------------------------
  function runde(x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r);
    else g.rect(x, y, w, h);
  }

  // Oben links: wie schnell, und wie weit es schon ging.
  function zeichneAnzeige() {
    const gross = clamp(view.cssH * 0.05, 15, 24);
    const x = 12;
    const y = 12 + view.frei;
    const tempo = state.schritt === "flug" ? tempoBei(state.z) : state.schritt === "landung" ? state.tempo : 0;
    const kmh = String(Math.round(tempo * 3.6));
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    const zw = g.measureText(kmh).width;
    g.font = `800 ${Math.round(gross * 0.62)}px system-ui, sans-serif`;
    const einheit = "km/h";
    const ew = g.measureText(einheit).width;
    const meter = `${state.meter} m`;
    const mw = g.measureText(meter).width;
    const breit = gross * 1.9 + zw + gross * 0.3 + ew + gross * 0.8 + mw + gross * 0.6;
    g.fillStyle = "rgba(13, 12, 17, 0.5)";
    runde(x, y, breit, gross * 1.7, gross * 0.85);
    g.fill();
    // Ein kleiner Flieger als Zeichen.
    g.save();
    g.translate(x + gross * 0.95, y + gross * 0.86);
    g.fillStyle = "#F5A623";
    g.beginPath();
    g.moveTo(0, -gross * 0.42);
    g.lineTo(gross * 0.5, gross * 0.02);
    g.lineTo(gross * 0.16, gross * 0.06);
    g.lineTo(gross * 0.2, gross * 0.4);
    g.lineTo(0, gross * 0.3);
    g.lineTo(-gross * 0.2, gross * 0.4);
    g.lineTo(-gross * 0.16, gross * 0.06);
    g.lineTo(-gross * 0.5, gross * 0.02);
    g.closePath();
    g.fill();
    g.restore();
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.fillStyle = "#ffffff";
    g.fillText(kmh, x + gross * 1.75, y + gross * 0.9);
    g.font = `800 ${Math.round(gross * 0.62)}px system-ui, sans-serif`;
    g.fillStyle = "rgba(255, 255, 255, 0.72)";
    g.fillText(einheit, x + gross * 1.75 + zw + gross * 0.3, y + gross * 0.94);
    g.fillText(meter, x + gross * 1.75 + zw + gross * 0.3 + ew + gross * 0.8, y + gross * 0.94);
  }

  // Am Flieger: die Serie als Zahl, darunter ein Bogen – wie nah der Fels
  // gerade ist. Und was eben gelohnt wurde («Haarscharf +12»).
  function zeichneAmFlieger() {
    if (state.schritt !== "flug" && !state.schriften.length) return;
    const p = imBild(state.x, state.y + 1.1, state.z);
    if (!p) return;
    const mass = clamp(Math.min(view.cssW, view.cssH) / 480, 0.8, 1.5);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    const oben = p.y - 46 * mass;
    if (state.schritt === "flug" && (state.serie > 1.04 || state.naehe > 0.04)) {
      const n = state.naehe;
      const gross = (15 + 9 * (state.serie - 1) / (SERIE_MAX - 1) + 3 * n) * mass;
      const deck = clamp((state.serie - 1) * 5 + n * 3, 0, 1);
      g.globalAlpha = deck;
      g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
      const text = `×${state.serie.toFixed(1)}`;
      g.lineWidth = Math.max(3, gross * 0.2);
      g.strokeStyle = "rgba(13, 12, 17, 0.6)";
      g.strokeText(text, p.x, oben);
      g.fillStyle = n > 0.02 ? "#ffd76a" : "#ffffff";
      g.fillText(text, p.x, oben);
      // Der Bogen der Nähe.
      if (n > 0.02) {
        const r = 21 * mass;
        g.lineCap = "round";
        g.lineWidth = 3.4 * mass;
        g.strokeStyle = "rgba(13, 12, 17, 0.45)";
        g.beginPath();
        g.arc(p.x, oben - 2 * mass, r, Math.PI * 0.2, Math.PI * 0.8);
        g.stroke();
        g.strokeStyle = n > 0.85 ? "#ff7a4a" : "#F5A623";
        g.beginPath();
        g.arc(p.x, oben - 2 * mass, r, Math.PI * (0.5 - 0.3 * n), Math.PI * (0.5 + 0.3 * n));
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    state.schriften.forEach((s, i) => {
      const k = clamp(s.leben / s.max, 0, 1);
      g.globalAlpha = Math.min(1, k * 2.4);
      g.font = `900 ${Math.round(s.gross * mass)}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(13, 12, 17, 0.6)";
      const y = oben - (34 + (1 - k) * 46 + (state.schriften.length - 1 - i) * 26) * mass;
      g.strokeText(s.text, p.x, y);
      g.fillStyle = s.farbe;
      g.fillText(s.text, p.x, y);
    });
    g.globalAlpha = 1;
  }

  // Vor dem ersten Druck: links und rechts ein Pfeil – dort wird gehalten.
  function zeichneHinweis() {
    if (state.phase !== "bereit" || shell.live) return;
    const puls = ruhig() ? 0.75 : 0.6 + 0.3 * Math.sin(state.echt * 3.2);
    const gross = clamp(Math.min(view.cssW, view.cssH) * 0.085, 24, 52);
    const y = view.cssH * 0.74;
    for (const s of [-1, 1]) {
      const x = view.cssW / 2 + s * Math.min(view.cssW * 0.36, 300);
      g.fillStyle = `rgba(13, 12, 17, ${0.42 * puls + 0.1})`;
      g.beginPath();
      g.arc(x, y, gross, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = `rgba(255, 255, 255, ${puls})`;
      g.lineWidth = Math.max(3, gross * 0.14);
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      g.moveTo(x - s * gross * 0.18, y - gross * 0.38);
      g.lineTo(x + s * gross * 0.24, y);
      g.lineTo(x - s * gross * 0.18, y + gross * 0.38);
      g.stroke();
    }
  }

  // Eine Zeile oben in der Mitte: der Rat zu Beginn, das Tal am Schluss.
  function zeichneKarte() {
    const k = state.karte;
    if (!k) return;
    const alter = state.echt - k.seit;
    const deck = Math.min(1, alter / 0.4) * clamp((k.dauer - alter) / 0.6, 0, 1);
    if (deck <= 0) return;
    const gross = clamp(view.cssW * 0.055, 21, 44);
    // Unter der Anzeige oben links – hochkant reicht die bis in die Mitte.
    const y = Math.max(view.cssH * 0.2, view.frei + 64 + gross);
    g.globalAlpha = deck;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.lineWidth = Math.max(3, gross * 0.12);
    g.lineJoin = "round";
    g.strokeStyle = "rgba(13, 12, 17, 0.55)";
    g.strokeText(k.gross, view.cssW / 2, y);
    g.fillStyle = k.farbe;
    g.fillText(k.gross, view.cssW / 2, y);
    if (k.klein) {
      g.font = `800 ${Math.round(gross * 0.46)}px system-ui, sans-serif`;
      g.lineWidth = Math.max(2, gross * 0.08);
      g.strokeText(k.klein, view.cssW / 2, y + gross * 0.95);
      g.fillStyle = "#ffffff";
      g.fillText(k.klein, view.cssW / 2, y + gross * 0.95);
    }
    g.globalAlpha = 1;
  }

  // Die Namen der Gegner an ihren Fliegern (geist.js) – wer hinter der
  // Kamera fliegt, steht am unteren Rand.
  function zeichneNamen() {
    if (!geisterOrte.length || !window.LernappGeist?.namen) return;
    const liste = geisterOrte.map((o) => {
      const gz = o.a / 10;
      const p = o.ziel ? imBild(state.x, state.y + 2.2, state.z) : imBild(o.b / 10, flugHoehe(gz) + 1.6, gz);
      return { ...o, sx: p ? p.x : view.cssW / 2, sy: p ? p.y : view.cssH + 40, weit: `${Math.round(gz)} m` };
    });
    window.LernappGeist.namen(g, liste, { breit: view.cssW, hoch: view.cssH });
  }

  function zeichneHud() {
    if (!g) return;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    g.clearRect(0, 0, view.cssW, view.cssH);
    // Der Fels ist nah: Auf seiner Seite glüht der Rand des Bilds.
    if (state.naehe > 0.03 && state.schritt === "flug") {
      const s = state.abSeite < 0 ? 0 : 1;
      const breit = view.cssW * 0.3;
      const rand = g.createLinearGradient(s ? view.cssW : 0, 0, s ? view.cssW - breit : breit, 0);
      rand.addColorStop(0, `rgba(255, 176, 60, ${0.5 * state.naehe})`);
      rand.addColorStop(1, "rgba(255, 176, 60, 0)");
      g.fillStyle = rand;
      g.fillRect(s ? view.cssW - breit : 0, 0, breit, view.cssH);
    }
    // Der Aufprall: Das Bild blitzt hell auf.
    if (state.blitz > 0.01 && !ruhig()) {
      g.fillStyle = `rgba(255, 244, 230, ${0.75 * state.blitz * state.blitz})`;
      g.fillRect(0, 0, view.cssW, view.cssH);
    }
    zeichneNamen();
    zeichneAmFlieger();
    zeichneKarte();
    zeichneHinweis();
    zeichneAnzeige();
  }

  function zeichnen() {
    zeichneWelt();
    zeichneHud();
  }

  // ---------------------------------------------------------------------------
  // Klänge (klang.js)
  // ---------------------------------------------------------------------------
  const zuletztTon = new Map();
  function ton(id, o = {}, pause = 80) {
    const ms = performance.now();
    if (ms - (zuletztTon.get(id) ?? -1e9) < pause) return;
    zuletztTon.set(id, ms);
    klang()?.ton?.(id, o);
  }

  // Zwei Schleifen: der Fahrtwind, der mit dem Tempo heller und lauter wird,
  // und das Rauschen des Felsens, das man nur hört, wenn er nah ist.
  // Nachgestellt werden sie ein paarmal je Sekunde, nicht in jedem Bild.
  let wind = null;
  let felsKlang = null;
  let windMs = -1e9;
  function windAn() {
    wind = klang()?.kulisse?.("felsflug.wind") || null;
    felsKlang = klang()?.kulisse?.("felsflug.fels", { laut: 0 }) || null;
    windMs = -1e9;
    windStellen();
  }

  function windStellen() {
    if (!wind && !felsKlang) return;
    const ms = performance.now();
    if (ms - windMs < 70) return;
    windMs = ms;
    const flug = state.schritt === "flug" ? 1 : 0.3;
    const k = clamp((tempoBei(state.z) - 10) / (V_MAX - 10), 0, 1) * flug;
    wind?.setze(0.25 + 0.6 * k);
    wind?.laut(0.45 + 0.55 * k);
    const n = state.schritt === "flug" ? state.naehe : 0;
    felsKlang?.setze(0.3 + 0.7 * n);
    felsKlang?.laut(Math.min(1, n * 1.3));
  }

  function windAus() {
    wind?.stop();
    felsKlang?.stop();
    wind = null;
    felsKlang = null;
  }

  // ---------------------------------------------------------------------------
  // Der Lauf
  // ---------------------------------------------------------------------------
  function karte(gross, klein, farbe = "#ffe9b8", dauer = 2.8) {
    state.karte = { gross, klein, farbe, dauer, seit: state.echt };
  }

  // Die Höhe des Flugs an der Stelle z: von der Kanzel hinab auf Flughöhe,
  // dann dem Bach nach talwärts.
  const flugHoehe = (z) => bodenBei(z) + FLUG_Y + START_HOCH * (1 - weich(2, 64, z));
  // Und wie die Nase steht: aufrecht auf der Kanzel, im Absprung steil
  // hinab, im Flug ein wenig nach unten.
  const nickBei = (z) => lerp(1.3, lerp(-0.62, -0.07, weich(12, 66, z)), weich(0.2, 8, z));

  function physik(dt) {
    const v = tempoBei(state.z);
    // Im Absprung tragen die Flügel noch kaum: Zur Seite geht es erst nach
    // und nach – wer gleich zu Beginn hält, hat Zeit, es zu merken.
    const ziel = state.lenk * querBei(state.z) * clamp(0.3 + state.z / 50, 0.3, 1);
    state.vx += (ziel - state.vx) * (1 - Math.exp(-dt / (state.lenk ? TRAEG_AN : TRAEG_AB)));
    state.x += state.vx * dt;
    state.z += v * dt;
    state.y = flugHoehe(state.z);
    naeheTakt(dt, true);
  }

  // Der erste Kontakt: Die Runde ist vorbei. Er prallt ab, überschlägt sich
  // und fällt.
  function aufprall(seite) {
    if (state.schritt === "aus") return;
    const v = tempoBei(state.z);
    state.schritt = "aus";
    state.schrittZeit = state.zeit;
    state.lenk = 0;
    state.zeitlupe = 0;
    state.sturz = {
      vx: -seite * (5 + Math.random() * 5), vy: 3, vz: v * 0.45,
      roll: -state.roll, nick: state.nick, gier: 0,
      wr: (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 5), wn: 5 + Math.random() * 6, wg: (Math.random() - 0.5) * 6,
    };
    state.stoss = 1;
    state.blitz = 1;
    // Zurück an die Kante des Felsens, falls der letzte Schritt hineinging.
    state.x -= seite * Math.max(0, 0.8 - state.ab);
    wolke(state.x, state.y, state.z + 1, seite);
    windAus();
    klang()?.ton?.("felsflug.aufprall");
    if (state.phase !== "spiel") return;
    karte("Aufprall", `nach ${Math.floor(state.z)} m`, "#ff9a7a", 2);
    kids()?.vibrate?.([30, 40, 60]);
  }

  // Das Tal: Schirm auf. Die Landung zählt noch einmal.
  function landung() {
    if (state.schritt !== "flug") return;
    state.schritt = "landung";
    state.schrittZeit = state.zeit;
    state.angekommen = true;
    state.lenk = 0;
    state.lande = { y0: state.y, v0: tempoBei(state.z), x: knoten(W.fluss, state.z + 150) + 44 };
    klang()?.ton?.("felsflug.schirm");
    if (state.phase !== "spiel") return;
    state.roh += LANDE_PUNKTE;
    state.punkte = Math.floor(state.roh);
    shell.setCount(state.punkte);
    karte("Im Tal", `Schirm auf · +${LANDE_PUNKTE}`, "#ffd76a", 3.4);
    kids()?.vibrate?.([20, 40, 20]);
  }

  function takt(sekunden) {
    // Die Zeitlupe: Für einen Wimpernschlag läuft die Welt langsamer.
    let dt = sekunden;
    state.echt += sekunden;
    if (state.zeitlupe > 0) {
      state.zeitlupe -= sekunden;
      dt = sekunden * 0.38;
    }
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - sekunden * 2.6);
    if (state.blitz > 0) state.blitz = Math.max(0, state.blitz - sekunden * 2.4);
    if (state.schub > 0) state.schub = Math.max(0, state.schub - sekunden * 2.8);

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else if (state.phase === "spiel" && state.schritt === "flug") {
      const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
      for (let i = 0; i < n && state.schritt === "flug"; i += 1) physik(dt / n);
      state.flugzeit += dt;
      if (state.schritt === "flug" && state.z >= Z_ENDE) landung();
    }
    weltBis(state.z + 500);

    const seit = state.zeit - state.schrittZeit;
    if (state.schritt === "start") {
      // Auf der Kanzel: Er steht, die Arme leicht gebreitet, und wiegt sich.
      state.y = flugHoehe(0);
      state.nick = 1.3 + (ruhig() ? 0 : Math.sin(state.echt * 1.3) * 0.025);
      state.roll = ruhig() ? 0 : Math.sin(state.echt * 0.9) * 0.03;
    } else if (state.schritt === "flug") {
      state.nick = nickBei(state.z);
      if (state.phase !== "zuschauen") {
        const rollZiel = clamp(state.vx / querBei(state.z), -1, 1) * 0.72 + state.lenk * 0.14;
        state.roll += (rollZiel - state.roll) * (1 - Math.exp(-dt / 0.085));
      }
      state.naehe += (naeheBei(state.ab) - state.naehe) * (1 - Math.exp(-dt / 0.07));
      if (state.naehe > 0.25 && Math.random() < dt * 34 * state.naehe) staub(state.abSeite, state.ab, state.naehe);
      spurTakt();
    } else if (state.schritt === "landung") {
      // Am Schirm: langsamer, aufrecht, hinüber zur Wiese und hinab.
      const L = state.lande;
      state.schirm = weich(0, 0.55, seit);
      const v = lerp(L.v0, 11, weich(0, 1.5, seit)) * (state.gelandet ? Math.max(0, 1 - (seit - 3.5) * 3) : 1);
      state.tempo = v;
      state.z += v * dt;
      state.vx *= Math.exp(-dt / 0.4);
      state.x += (L.x - state.x) * (1 - Math.exp(-dt / 1.6));
      const grund = hoeheBei(state.x, state.z) + 1.45;
      state.y = lerp(L.y0 + (bodenBei(state.z) - bodenBei(Z_ENDE)), grund, weich(0.25, 3.5, seit));
      state.nick += (1.18 - state.nick) * (1 - Math.exp(-dt / 0.35));
      state.roll = Math.sin(seit * 2.1) * 0.12 * (1 - weich(2.4, 3.5, seit));
      state.naehe = 0;
      if (!state.gelandet && seit >= 3.5) {
        state.gelandet = true;
        for (let i = 0; i < 8; i += 1) {
          state.teile.push({
            x: state.x + (Math.random() - 0.5) * 1.6, y: grund - 1.2, z: state.z + Math.random() * 2,
            vx: (Math.random() - 0.5) * 3, vy: 0.8 + Math.random(), vz: 1 + Math.random() * 3, fall: 0.5, wachs: 1.4,
            r: 0.5 + Math.random() * 0.5, farbe: [0.8, 0.86, 0.7], deck: 0.3, leben: 0.9, max: 0.9,
          });
        }
      }
    } else if (state.schritt === "aus" && state.sturz) {
      const s = state.sturz;
      s.vy -= 20 * dt;
      s.vz *= Math.exp(-dt / 0.7);
      state.x += s.vx * dt;
      state.y += s.vy * dt;
      state.z += s.vz * dt;
      const grund = hoeheBei(state.x, state.z) + 0.6;
      if (grund > state.y + 2.5) {
        // Dort steht Fels: zurück.
        state.x -= s.vx * dt;
        s.vx *= -0.5;
      } else if (state.y < grund) { state.y = grund; s.vy = Math.abs(s.vy) * 0.3; s.vx *= 0.5; s.wr *= 0.6; s.wn *= 0.6; }
      s.roll += s.wr * dt;
      s.nick += s.wn * dt;
      s.gier += s.wg * dt;
      state.naehe = 0;
    }
    state.sonne += (sonneBei(state.x, state.y, state.z) - state.sonne) * (1 - Math.exp(-dt / 0.12));

    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.vy -= t.fall * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.z += t.vz * dt;
      t.r += (t.wachs || 0) * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= sekunden;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
    kameraTakt(sekunden);
    windStellen();

    if (state.phase === "spiel") {
      if (state.schritt === "flug") {
        state.meter = Math.floor(state.z);
        const punkte = Math.floor(state.roh);
        if (punkte !== state.punkte) {
          state.punkte = punkte;
          shell.setCount(punkte);
        }
        if (!state.talGesagt && state.z > Z_ENDE - 520) {
          state.talGesagt = true;
          karte("Noch 500 m", "dann öffnet sich das Tal");
        }
      }
      // Für die Aufzeichnung: Strecke, Seite, Schräglage – oder 314 für
      // «angeprallt» (kein Winkel, den ein Flieger je hat).
      gegner?.takt(state.punkte, { a: Math.round(state.z * 10), b: Math.round(state.x * 10), c: state.schritt === "aus" ? 314 : Math.round(state.roll * 100) });
      // Erst ausfliegen lassen: den Sturz, die Landung. (Neu gerechnet – der
      // Schritt kann eben erst begonnen haben.)
      const dauer = state.zeit - state.schrittZeit;
      if ((state.schritt === "aus" && dauer > 1.5) || (state.schritt === "landung" && dauer > 4.3)) finish();
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const sekunden = (now - last) / 1000;
    last = now;
    gueteTakt(sekunden);
    messen();
    takt(Math.min(0.05, Math.max(0, sekunden)));
    zeichnen();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Ein aufgezeichneter Flug durch seine eigene Schlucht: Der Zufall hält die
  // Saat (geist.js, zuschauer), startRun würfelt damit dieselbe Welt, und der
  // Flieger steht Bild für Bild dort, wo er damals war, in derselben
  // Schräglage. Was er zählt, steht in der Aufzeichnung.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "flug";
    state.schrittZeit = state.zeit;
    shell.setPhase("play");
    zuschauer.los();
    windAn();
  }

  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s) return;
    if (state.schritt === "flug") {
      state.z = Math.max(state.z, s.a / 10);
      state.x = s.b / 10;
      state.vx = (s.vb || 0) / 10;
      state.y = flugHoehe(state.z);
      state.flugzeit = (s.t || 0) / 1000;
      state.meter = Math.floor(state.z);
      weltBis(state.z + 500);
      naeheTakt(dt, false);
      if (s.c > 250) aufprall(state.abSeite || 1);
      else {
        state.roll = s.c / 100;
        if (state.z >= Z_ENDE - 0.5) landung();
      }
    }
    const punkte = Math.max(0, Math.floor(s.punkte));
    if (punkte !== state.punkte) {
      state.punkte = punkte;
      shell.setCount(punkte);
    }
    if (!zuschauer.weiter()) windAus();
  }

  // ---------------------------------------------------------------------------
  // Lenken
  // ---------------------------------------------------------------------------
  // Die Runde beginnt mit dem ersten Druck – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los): Er springt.
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "flug";
    state.schrittZeit = state.zeit;
    shell.setPhase("play");
    gegner?.los();
    windAn();
    karte("Nah am Fels zählt", "je näher, desto mehr – aber nicht anstossen", "#ffe9b8", 3.2);
    kids()?.vibrate?.(8);
    lenkNeu();
  }

  // Wer hält, lenkt: links vom Bild nach links, rechts nach rechts. Liegen
  // zwei Finger auf, zählt der, der zuletzt kam.
  const finger = new Map();
  function lenkNeu() {
    let richtung = 0;
    for (const seite of finger.values()) richtung = seite;
    state.lenk = state.phase === "zuschauen" || state.phase === "ende" || state.schritt !== "flug" ? 0 : richtung;
  }

  function fingerAuf(id, seite) {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    // Ohne Bild keine Runde (ein Browser ohne WebGL 2).
    if (!bild.ok && !bild.verloren) return;
    finger.delete(id);
    finger.set(id, seite);
    if (state.phase === "bereit" && !shell.live) losGehts();
    lenkNeu();
  }

  function fingerWeg(id) {
    if (!finger.delete(id)) return;
    lenkNeu();
  }

  function alleWeg() {
    finger.clear();
    lenkNeu();
  }

  function seiteVon(event) {
    const r = (feld || host).getBoundingClientRect();
    return event.clientX < r.left + r.width / 2 ? -1 : 1;
  }

  // Für die Prüfskripte und die Vorführung: -1, 0 oder 1.
  function lenke(richtung) {
    if (richtung) fingerAuf("pilot", richtung < 0 ? -1 : 1);
    else fingerWeg("pilot");
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    stopLoop();
    windAus();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    Object.assign(state, {
      phase: "bereit", schritt: "start", punkte: 0, roh: 0, x: 0, y: 0, z: 0, vx: 0, lenk: 0, roll: 0, nick: 1.3,
      zeit: 0, echt: 0, flugzeit: 0, meter: 0, ab: 99, abSeite: 0, naehe: 0, serie: 1, serieBest: 1, ohneFels: 0,
      haarscharf: 0, zeitlupe: 0, schirm: 0, gelandet: false, angekommen: false, talGesagt: false, sonne: 1, tempo: 0,
      teile: [], schriften: [], karte: null, stoss: 0, blitz: 0, schub: 0, schrittZeit: 0, sturz: null, lande: null,
    });
    W = neueWelt();
    state.welt = W;
    weltBis(700);
    state.y = flugHoehe(0);
    finger.clear();
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt ff-prompt", "Links halten – nach links. Rechts halten – nach rechts.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    messen();
    kameraSetzen();
    spurNeu();
    for (const s of streifen) s.z = -1e9;
    kacheln.drin.fill(-1);
    kachelnTakt(true);

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(900, 250 + ziel * 2);
    const start = performance.now();
    zahl.textContent = "0";
    const lauf = (now) => {
      if (!zahl.isConnected) return;
      const k = Math.min(1, (now - start) / dauer);
      zahl.textContent = String(Math.round(ziel * (1 - (1 - k) * (1 - k))));
      if (k < 1) window.requestAnimationFrame(lauf);
    };
    window.requestAnimationFrame(lauf);
  }

  function finish() {
    stopLoop();
    windAus();
    if (state.phase === "ende" || state.phase === "zuschauen") return;
    state.phase = "ende";
    alleWeg();
    const punkte = state.punkte;
    const geist = gegner?.ende(punkte) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    const wie = state.angekommen ? "Im Tal gelandet" : `Aufprall nach ${state.meter} m`;
    const serie = state.serieBest > 1.05 ? `Serie bis ×${state.serieBest.toFixed(1)}` : "";
    const knapp = state.haarscharf ? `${state.haarscharf}-mal haarscharf` : "";
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : [wie, serie, knapp, vorher ? `Bestwert ${vorher}` : ""].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("ff-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Felsflug",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "cliffFlight", fassung: "t2", zufall, einheit: "Punkte", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    // Fassung t2: der Gang. Die Läufe durch die weite Schlucht gehören nicht dazu.
    gegner = window.LernappGeist?.fuer?.({ spiel: "cliffFlight", host, art: "tempo", fassung: "t2", alle: true, zufall }) || null;
  }

  grafikStarten();
  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Ein Finger irgendwo im Bild: Start – und solange er liegt, lenkt er. Wer
  // ihn über die Mitte zieht, lenkt um. Nur Knöpfe bleiben Knöpfe.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    fingerAuf(event.pointerId, seiteVon(event));
  });
  window.addEventListener("pointermove", (event) => {
    if (!finger.has(event.pointerId)) return;
    const seite = seiteVon(event);
    if (finger.get(event.pointerId) === seite) return;
    finger.set(event.pointerId, seite);
    lenkNeu();
  });
  window.addEventListener("pointerup", (event) => fingerWeg(event.pointerId));
  window.addEventListener("pointercancel", (event) => fingerWeg(event.pointerId));
  // Wer das Fenster verlässt, lässt auch los.
  window.addEventListener("blur", alleWeg);

  // Pfeiltasten oder A und D lenken; Leertaste und Enter starten nur.
  const TASTEN = { ArrowLeft: -1, ArrowRight: 1, KeyA: -1, KeyD: 1 };
  const tasteVon = (event) => (TASTEN[event.key] ? event.key : TASTEN[event.code] ? event.code : null);
  document.addEventListener("keydown", (event) => {
    const taste = tasteVon(event);
    const start = event.key === " " || event.key === "Enter";
    if (!taste && !start) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    if (taste) fingerAuf(taste, TASTEN[taste]);
    else if (state.phase === "bereit" && !shell.live) losGehts();
  });
  document.addEventListener("keyup", (event) => {
    const taste = tasteVon(event);
    if (taste) fingerWeg(taste);
  });

  // Steht das Bild (die Tafel ist da), zeichnet eine neue Grösse es einmal neu.
  const neuMessen = () => {
    messen();
    if (!frame) zeichnen();
  };
  window.addEventListener("resize", neuMessen);
  window.addEventListener("orientationchange", neuMessen);
  window.addEventListener("pagehide", () => { stopLoop(); windAus(); });

  // Für die Prüfskripte und die Vorführung. lenke(-1 | 0 | 1) hält links oder
  // rechts oder lässt los; guete(1) hält die Schärfe fest.
  window.LernappFelsflug = {
    TAKT, Z_ENDE, FLUG_Y, KOERPER, NAH, GANZ_NAH, HAAR, SERIE_MAX, LANDE_PUNKTE, DZ, Z_MIN, TANNE_R,
    state, view, kam, bild, takt, zeichnen, weltText, weltBis, wegBei, mitteBei, mitteAb, bodenBei, breiteBei, gangBei, engeBei, tempoBei, querBei, kannBei,
    abstandBei, freiBei, sonneBei, hoeheBei, losGehts, lenke, geister: geisterOrte,
    guete(wert) {
      view.fest = wert !== null && wert !== undefined;
      if (view.fest) view.guete = clamp(Number(wert) || 1, 0.3, 1);
      view.cssW = 0;
    },
  };
})();
