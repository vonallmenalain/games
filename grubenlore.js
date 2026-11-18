/*
 * grubenlore.js – Höhlenfahrt (bis November 2026 «Grubenlore»; Datei,
 * Adresse und Speicher heissen weiter so).
 * ---------------------------------------------------------------------------
 * Eine Lore jagt durch ein altes Bergwerk, immer bergab. Sie rollt von
 * allein – wer spielt, hat nur die Bremse: Halten bremst (die Räder sprühen
 * Funken), Loslassen lässt rollen. Mehr gibt es nicht zu tun.
 *
 * Und doch ist es nie egal, wie schnell sie ist, denn jede Stelle im Stollen
 * verträgt ein anderes Tempo:
 *
 *   Felsdach   Eine Kuppe, dahinter ein niedriges Dach aus Fels. Wer zu
 *              schnell über die Kuppe kommt, hebt ab – und hängt im Dach.
 *   Schacht    Das Gleis endet an einer Rampe, drüben geht es weiter. Wer zu
 *              langsam ist, stürzt hinein.
 *   Pochwerk   Stampfer schlagen im Takt auf das Gleis. Durch muss man, wenn
 *              sie oben sind.
 *   Senke      Ein scharfer Knick im Gleis. Wer hineinrauscht, dem bricht
 *              die Achse.
 *   Looping    Braucht Schwung, und zwar viel.
 *
 * Vor jeder Stelle steht ein Signal: rot heisst langsam, grün heisst laufen
 * lassen, gelb heisst im Takt. Wie schnell genau, sagt einem niemand – das
 * ist Gefühl. (Bis November 2026 zeigte ein Tempo-Fenster über der Lore,
 * womit sie ankäme und in welchem Band sie ankommen muss.) Wer genau im
 * gefährlichen Rand des Bandes durchfährt (so schnell, wie es gerade noch
 * geht, oder butterweich gelandet), fährt «haarscharf»: Das bringt
 * Vorsprung, mehrere hintereinander immer mehr.
 *
 * Vorsprung worauf? Hinter der Lore stürzt der Stollen ein. Der Einsturz
 * folgt nach der Uhr und wird immer schneller; wer zu vorsichtig bremst,
 * wird eingeholt. Der Vorsprung ist das Leben der Runde, jede Berührung mit
 * Fels, Stampfer oder Schacht ihr Ende. Gezählt wird nur eines: wie weit
 * die Lore kommt, in Metern.
 *
 * Gebaut wird das Bergwerk aus dem Zufall (zufall.js): ohne Turnier jedes
 * Mal ein anderes, im Turnier für alle im selben Versuch dasselbe. Und es
 * ist immer schaffbar, von jedem Tempo aus: Zu jeder Stelle rechnet das
 * Spiel aus, mit welchem Tempo man heil hindurchkommt (fenster – es fährt
 * sie vorher selbst ab), und legt davor so viel Gleis, dass man aus vollem
 * Tempo dorthin herunterbremsen und aus dem Stand dorthin Schwung holen
 * kann (naechstesStueck). Wer langsam ist und nicht bremst, pumpt: Unter
 * Schritttempo fällt die Lore nie, sie bleibt also nirgends liegen.
 *
 * Gerechnet wird in Metern, y nach oben. Das Gleis ist eine Kette von
 * Punkten im Abstand DS entlang des Wegs; wo die Lore ist, sagt ihr Weg s
 * darauf. Hebt sie ab – über einer Kuppe, an einer Rampe –, fliegt sie frei
 * und setzt wieder auf, wo ihre Bahn das Gleis kreuzt.
 *
 * Die Gegner (geist.js) fahren als Lore aus Licht auf demselben Gleis mit –
 * so weit, wie sie damals zu dieser Zeit waren (a: der Weg in Dezimetern,
 * b: die Höhe über dem Gleis, c: die Neigung). Und die besten Läufe lassen
 * sich anschauen (?zuschauen=, geist.js): mit derselben Saat dasselbe
 * Bergwerk.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "minecart") return;

  const host = document.querySelector("#gl-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall: nur das Bergwerk – Gleis, Stellen, Takte. Funken, Staub und
  // Brocken nehmen Math.random oder feste Zahlen, damit das Bergwerk nicht
  // davon abhängt, wie jemand fährt.
  const zufall = window.LernappZufall?.fuer?.("mineCart") || {
    fest: false, neu() {}, zahl: Math.random,
  };

  // ---------------------------------------------------------------------------
  // Die Schrauben
  // ---------------------------------------------------------------------------
  const TAKT = 1 / 240;            // gerechnet wird in festen kleinen Schritten
  const DS = 0.25;                 // Abstand der Gleispunkte, entlang des Wegs (m)
  const RX = 0.5;                  // Raster für Boden und Decke, quer (m)
  const VORLAUF = 80;              // so viel Stollen liegt hinter dem Start
  const START_S = VORLAUF + 6;     // hier steht die Lore am Anfang
  const GRAD = Math.PI / 180;
  const TAU = Math.PI * 2;

  // Die Fahrt.
  const G = 9.81;
  const ROLL = 0.32;               // Rollwiderstand (m/s²)
  const LUFT = 0.0034;             // Fahrtwind: bremst mit dem Quadrat des Tempos
  const BREMSE = 10;               // so kräftig bremst die Bremse (m/s²)
  const V_PUMPE = 3;               // langsamer rollt die Lore nie, solange niemand bremst (m/s)
  const PUMPE = 7;                 // so kräftig pumpt der Hauer (m/s²)
  const V_DECKEL = 22;             // schneller wird sie nirgends (m/s)
  const V_START = 4.5;             // mit so viel Schwung stösst er sich ab
  const V_HART = 6.2;              // härter aufgesetzt bricht die Achse (m/s, quer zum Gleis)
    const G_KNICK = 3.6;             // so viel Last hält die Achse in der Senke (in g)

  // Die Lore, wie sie getroffen wird: drei Kreise, im Bild der Lore (x nach
  // vorn, y nach oben, der Nullpunkt zwischen den Rädern auf dem Gleis) –
  // der Kasten vorn und hinten, darüber der Kopf mit dem Helm.
  const KOPF_Y = 1.6;
  const HUELLE = [{ x: -0.5, y: 0.72, r: 0.5 }, { x: 0.5, y: 0.72, r: 0.5 }, { x: 0.04, y: KOPF_Y, r: 0.3 }];

  // Das Pochwerk: so hoch steht ein Stampfer über dem Gleis, wenn er oben
  // und wenn er unten ist, so breit ist sein Kopf (halb), und so lange
  // dauern Fall und Hub. Offen ist er, solange unter ihm S_FREI Platz ist.
  const S_OBEN = 3.6;
  const S_UNTEN = 0.35;
  const S_BREIT = 0.6;
  const S_FALL = 0.13;
  const S_HUB = 0.55;
  const S_FREI = 2.0;
  const S_OFFEN_MIN = 1.45;        // so lange ist jeder Stampfer mindestens offen (s)

  // Der Einsturz: Er beginnt hinter der Lore und folgt nach der Uhr – erst
  // gemächlich, dann immer schneller. Weiter als VORSPRUNG_MAX hängt ihn
  // niemand ab.
  const EINSTURZ_START = 30;       // so weit hinter der Lore beginnt er (m)
  const EINSTURZ_V0 = 5.5;         // sein Tempo am Anfang (m/s) …
  const EINSTURZ_V1 = 17.5;        // … und wohin es strebt
  const EINSTURZ_ZEIT = 70;        // nach so vielen Sekunden sind gut sechs Zehntel davon da
  const VORSPRUNG_MAX = 70;
  const BONUS = [5, 7, 9];         // Meter Vorsprung für «haarscharf»: einzeln, zwei, drei und mehr in Folge

  // Wie schwer es bei m Metern ist (0 … gegen 1), und wie steil das Gleis
  // dort im Grunde fällt.
  const schwere = (m) => 1 - Math.exp(-Math.max(0, m) / 800);
  const gefaelle = (m) => -(5.5 + 4.5 * schwere(m)) * GRAD;

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.grubenlore", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const weich = (u) => u * u * (3 - 2 * u);

  // Immer dieselbe Zahl zu derselben Eingabe: Fels, Kristalle und Laternen
  // stehen bei jedem Bild am selben Platz, ohne den Zufall des Bergwerks
  // anzufassen.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Rauschen in einer Richtung: weich zwischen festen Zufallswerten.
  function rauschen(x, saat = 0) {
    const i = Math.floor(x);
    return lerp(hash01(i * 1.37 + saat * 17.3), hash01((i + 1) * 1.37 + saat * 17.3), weich(x - i));
  }

  // ---------------------------------------------------------------------------
  // Das Gleis
  // ---------------------------------------------------------------------------
  /*
   * Eine Welt: das Gleis als Punkte (x, y), dazu je Punkt die Richtung w
   * des Stücks, das zu ihm führt, dessen Krümmung k (links herum positiv:
   * eine Mulde; rechts herum negativ: eine Kuppe) und seine Art. Boden und
   * Decke stehen in einem Raster quer (alle RX Meter ein Wert): der Fels
   * unter dem Gleis und der über ihm. Die Decke ist fest – wer sie
   * berührt, ist draussen –, der Boden auch.
   *
   * Gebaut wird wie mit einer Schildkröte: Der Kopf steht am Ende des
   * Gleises und schaut in seine Richtung; jedes Stück setzt ihn DS weiter.
   */
  const SCHIENE = 0;               // gewöhnliches Gleis
  const LUECKE = 1;                // kein Gleis: der Schacht
  const KNICK = 2;                 // die Senke – hier zählt die Last auf der Achse
  const SCHLEIFE = 3;              // der Looping

  function neueWelt() {
    return {
      x: [], y: [], w: [], k: [], art: [], n: 0,
      kopf: { x: 0, y: 0, w: 0 },
      // Das Raster beginnt beim ersten Punkt.
      rx0: 0, boden: [], decke: [], glatt: [],
      // Fürs Bild: wie offen der Raum an dieser Stelle ist (0 Stollen, 1
      // Saal) und wie tief der Boden unter dem Gleis liegt.
      saal: [], tiefe: [],
      // Wie der Fels gerade zum Gleis steht: tief (der Boden so weit unter
      // dem Gleis) und hoch (die Decke so weit darüber), jeweils mit einem
      // Ziel, dem sie von Rasterpunkt zu Rasterpunkt folgen. basisY: Im
      // Looping zählt nicht das Gleis, sondern sein Fuss.
      raum: { tief: 0.5, hoch: 6.5, tiefZiel: 0.5, hochZiel: 6.5, basisY: null, glatt: false, saal: 0, saalZiel: 0 },
      stellen: [],                 // die Hindernisse, der Reihe nach
      stampfer: [],                // alle Stampfer, der Reihe nach
      signale: [],
      plan: { nr: 0, letzte: "", davor: "", grund: "fels", saal: false, tief: 0.5 },
    };
  }

  const sEnde = (W) => (W.n - 1) * DS;
  const meterBei = (s) => Math.max(0, s - START_S);

  function rasterBis(W, x, yVor, xVor) {
    const R = W.raum;
    const K = W.kopf;
    while (W.rx0 + W.boden.length * RX <= x) {
      const j = W.boden.length;
      const X = W.rx0 + j * RX;
      let y = K.y;
      if (R.basisY !== null) y = R.basisY;
      else if (K.x > xVor) y = lerp(yVor, K.y, clamp((X - xVor) / (K.x - xVor), 0, 1));
      // Dem Ziel nach: der Boden zügig (eine Wand ist eine Wand), die Decke
      // gemächlicher.
      R.tief = Math.abs(R.tiefZiel - R.tief) > 20 ? R.tiefZiel : lerp(R.tief, R.tiefZiel, 0.35);
      R.hoch = R.glatt ? R.hochZiel : lerp(R.hoch, R.hochZiel, 0.14);
      // Rauer Fels: im Graben Zacken nach oben, an der hohen Decke Zapfen
      // nach unten – nie bis ans Gleis.
      let unten = 0.1 * rauschen(j * 0.9, 1);
      if (R.tief > 2.5) {
        unten += 0.5 * rauschen(j * 0.31, 2);
        if (hash01(j * 3.3 + 7) < 0.1) unten -= Math.min(1.6, R.tief * 0.3) * hash01(j * 5.1);
      }
      let oben = 0;
      if (!R.glatt) {
        oben = 0.55 * rauschen(j * 0.27, 3) + 0.2 * rauschen(j * 1.3, 4);
        if (R.hoch > 5.4 && hash01(j * 2.9 + 3) < 0.13) oben -= Math.min(1.9, (R.hoch - 4.2) * 0.8) * (0.4 + 0.6 * hash01(j * 4.7));
      }
      R.saal = lerp(R.saal, R.saalZiel, 0.16);
      W.boden.push(y - R.tief - unten);
      W.decke.push(y + R.hoch + oben);
      W.glatt.push(R.glatt ? 1 : 0);
      W.saal.push(R.saal);
      W.tiefe.push(R.tief);
    }
  }

  function punkt(W, art, kr, yVor, xVor) {
    const K = W.kopf;
    W.x.push(K.x); W.y.push(K.y); W.w.push(K.w); W.k.push(kr); W.art.push(art);
    W.n += 1;
    rasterBis(W, K.x, yVor, xVor);
  }

  // Ein Schritt weiter, mit der Krümmung kr.
  function vor(W, kr, art) {
    const K = W.kopf;
    const x0 = K.x;
    const y0 = K.y;
    K.w += kr * DS;
    K.x += Math.cos(K.w) * DS;
    K.y += Math.sin(K.w) * DS;
    punkt(W, art, kr, y0, x0);
  }

  function gerade(W, L, art = SCHIENE) {
    const n = Math.max(1, Math.round(L / DS));
    for (let i = 0; i < n; i += 1) vor(W, 0, art);
  }

  // Ein Bogen, der um dw dreht – sanft hinein und sanft hinaus: Die
  // Krümmung wächst von null bis zur Mitte (dort 2·dw/L) und fällt wieder.
  function bogen(W, L, dw, art = SCHIENE) {
    const n = Math.max(2, Math.round(L / DS));
    for (let i = 0; i < n; i += 1) vor(W, (dw / (n * DS)) * (1 - Math.cos(TAU * (i + 0.5) / n)), art);
  }

  // Hinab in ein steileres Gefälle (wZiel), und zwar so, dass keine Lore
  // dabei abhebt: Das Gleis folgt der Wurfbahn der schnellsten – jede
  // langsamere fiele steiler und bleibt deshalb darauf. Wo es nur «laufen
  // lassen» heisst, darf das Gleis niemanden abwerfen.
  function sturz(W, wZiel, art = SCHIENE) {
    const vx = (V_DECKEL + 1.5) * Math.cos(W.kopf.w);
    for (let n = 0; n < 400 && W.kopf.w > wZiel; n += 1) vor(W, -(G / (vx * vx)) * Math.cos(W.kopf.w) ** 3, art);
  }

  // Ein Kreisbogen mit fester Krümmung.
  function kreis(W, L, dw, art = SCHIENE) {
    const n = Math.max(2, Math.round(L / DS));
    for (let i = 0; i < n; i += 1) vor(W, dw / (n * DS), art);
  }

  // Kein Gleis: von hier dx weiter und dy höher geht es in Richtung wNeu
  // weiter. Dazwischen stehen Punkte auf der Sehne, damit der Weg s nicht
  // springt – befahren werden sie nie.
  function luecke(W, dx, dy, wNeu) {
    const K = W.kopf;
    const n = Math.max(1, Math.round(Math.hypot(dx, dy) / DS));
    const x0 = K.x;
    const y0 = K.y;
    K.w = Math.atan2(dy, dx);
    for (let i = 1; i <= n; i += 1) {
      const xVor = K.x;
      const yVor = K.y;
      K.x = x0 + (dx * i) / n;
      K.y = y0 + (dy * i) / n;
      punkt(W, LUECKE, 0, yVor, xVor);
    }
    K.w = wNeu;
  }

  // Der Fels von jetzt an: sofort (hart) oder als Ziel, dem er nachzieht.
  function raum(W, { tief, hoch, hart = false, glatt }) {
    const R = W.raum;
    if (tief !== undefined) { R.tiefZiel = tief; if (hart) R.tief = tief; }
    if (hoch !== undefined) { R.hochZiel = hoch; if (hart) R.hoch = hoch; }
    if (glatt !== undefined) R.glatt = glatt;
  }

  // Für ein Stück Gleis, das schon liegt, die Decke nachträglich senken:
  // zwischen den Wegen sA und sB hängt sie frei Meter über dem Gleis – das
  // Felsdach hinter der Kuppe.
  function dachSetzen(W, sA, sB, frei) {
    const iA = Math.round(sA / DS);
    const iB = Math.min(W.n - 1, Math.round(sB / DS));
    let i = iA;
    for (let j = Math.ceil((W.x[iA] - W.rx0) / RX); j < W.decke.length; j += 1) {
      const X = W.rx0 + j * RX;
      if (X > W.x[iB]) break;
      while (i < iB - 1 && W.x[i + 1] < X) i += 1;
      const u = clamp((X - W.x[i]) / Math.max(1e-6, W.x[i + 1] - W.x[i]), 0, 1);
      W.decke[j] = lerp(W.y[i], W.y[i + 1], u) + frei;
      W.glatt[j] = 2;
    }
  }

  // Ein Stand zum Zurückkehren: Was danach gebaut wird, lässt sich wieder
  // abräumen (der Anlauf, der noch zu kurz war).
  function merke(W) {
    return { n: W.n, raster: W.boden.length, stampfer: W.stampfer.length, kopf: { ...W.kopf }, raum: { ...W.raum } };
  }

  function zurueck(W, m) {
    for (const liste of [W.x, W.y, W.w, W.k, W.art]) liste.length = m.n;
    for (const liste of [W.boden, W.decke, W.glatt, W.saal, W.tiefe]) liste.length = m.raster;
    W.stampfer.length = m.stampfer;
    W.n = m.n;
    W.kopf = { ...m.kopf };
    W.raum = { ...m.raum };
  }

  // Wo das Gleis bei Weg s liegt.
  const ort = { x: 0, y: 0, w: 0, k: 0, art: 0 };
  function gleisBei(W, s, o = ort) {
    const f = clamp(s / DS, 0, W.n - 1.001);
    const i = Math.floor(f);
    const u = f - i;
    o.x = W.x[i] + (W.x[i + 1] - W.x[i]) * u;
    o.y = W.y[i] + (W.y[i + 1] - W.y[i]) * u;
    o.w = W.w[i + 1];
    o.k = W.k[i + 1];
    o.art = W.art[i + 1];
    return o;
  }

  function rasterWert(W, liste, x) {
    const f = clamp((x - W.rx0) / RX, 0, liste.length - 1.001);
    const j = Math.floor(f);
    return liste[j] + (liste[j + 1] - liste[j]) * (f - j);
  }
  const bodenBei = (W, x) => rasterWert(W, W.boden, x);
  const deckeBei = (W, x) => rasterWert(W, W.decke, x);

  // ---------------------------------------------------------------------------
  // Die Stellen
  // ---------------------------------------------------------------------------
  /*
   * Jede Stelle beginnt und endet im Grundgefälle (w0): Sie dreht aus der
   * Richtung, in der der Kopf steht, in ihre eigene und am Schluss zurück.
   * So lässt sie sich für sich allein abfahren (fenster) und passt danach
   * an jede Stelle des Gleises.
   */
  const STUECK = {
    // Die Kuppe mit dem Felsdach: hinauf, über einen engen Scheitel (R) und
    // steil hinab – und über dem Hang hängt der Fels. Wer am Scheitel
    // abhebt, kommt nicht darunter durch.
    kuppe(W, p, w0) {
      bogen(W, 7, p.auf - W.kopf.w);
      gerade(W, 2.5);
      const dw = p.auf + p.ab;
      const L = 2 * dw * p.R;
      const sScheitel = sEnde(W) + L / 2;
      bogen(W, L, -dw);
      const sHang = sEnde(W);
      gerade(W, p.hang);
      // So hoch hängt das Dach: Die Lore passt am Hang gerade darunter
      // (ihr Kopf steht dort schräg), dazu luft.
      const frei = KOPF_Y / Math.cos(p.ab) + 0.3 + p.luft;
      dachSetzen(W, sScheitel + 0.6, sHang + p.hang - 1.2, frei);
      bogen(W, 8, w0 + p.ab);
      return { mass: sScheitel - 1, dach: [sScheitel + 0.6, sHang + p.hang - 1.2] };
    },

    // Der Schacht: Das Gleis bricht ab, wie es liegt, und geht drüben
    // weiter – ein Stück tiefer (fall, unter der Linie des Gleises) und
    // steiler, damit die Lore im Flug dorthin findet. Wer zu langsam ist,
    // fällt vor der Kante hinunter.
    schacht(W, p, w0) {
      if (Math.abs(W.kopf.w - w0) > 0.002) bogen(W, 6, w0 - W.kopf.w);
      gerade(W, 3);
      const sKante = sEnde(W);
      // So weit fliegt die schnellste Lore: bis dorthin reicht der Hang drüben.
      let lande = 8;
      const hangDrueben = Math.tan(w0 - p.ab);
      for (let t = 0; t < 4; t += 0.02) {
        const x = V_DECKEL * Math.cos(w0) * t;
        const y = V_DECKEL * Math.sin(w0) * t - (G / 2) * t * t;
        if (x > p.weit && y <= p.weit * Math.tan(w0) - p.fall + (x - p.weit) * hangDrueben) {
          lande = (x - p.weit) / Math.cos(w0 - p.ab) + 7;
          break;
        }
      }
      raum(W, { tief: 60, hart: true });
      luecke(W, p.weit, p.weit * Math.tan(w0) - p.fall, w0 - p.ab);
      raum(W, { tief: W.plan.tief, hart: true });
      const sDrueben = sEnde(W);
      gerade(W, lande);
      bogen(W, 9, p.ab);
      return { mass: sKante - 0.5, kante: sKante, drueben: sDrueben };
    },

    // Das Pochwerk: ein gerades Stück, darüber die Stampfer – im selben
    // Takt, versetzt wie eine grüne Welle.
    stampfer(W, p) {
      gerade(W, 3);
      const liste = [];
      for (let i = 0; i < p.viele; i += 1) {
        if (i) gerade(W, p.abstand);
        const s0 = liste.length ? liste[0].s : sEnde(W);
        const st = { s: sEnde(W), x: W.kopf.x, y: W.kopf.y, T: p.T, unten: p.unten, aus: p.aus - (sEnde(W) - s0) / p.welle };
        liste.push(st);
        W.stampfer.push(st);
      }
      gerade(W, 3);
      return { mass: liste[0].s - 3, stampfer: liste };
    },

    // Die Senke: steil hinab, ein scharfer Knick, kurz hinauf.
    knick(W, p, w0) {
      sturz(W, -p.ab);
      gerade(W, p.hang);
      const sA = sEnde(W);
      bogen(W, p.lang, p.ab + p.auf, KNICK);
      const sB = sEnde(W);
      gerade(W, 2.5);
      bogen(W, 8, w0 - W.kopf.w);
      return { mass: sA, knick: [sA, sB] };
    },

    // Der Looping: eben hinein, einmal herum, weiter.
    looping(W, p, w0) {
      bogen(W, 9, -W.kopf.w);
      gerade(W, 1.5);
      const R = W.raum;
      const hochVorher = R.hochZiel;
      R.basisY = W.kopf.y;
      raum(W, { hoch: Math.max(hochVorher, 2 * p.R + 6) });
      const sA = sEnde(W);
      const mitte = { x: W.kopf.x, y: W.kopf.y + p.R };
      kreis(W, TAU * p.R, TAU, SCHLEIFE);
      W.kopf.w -= TAU;
      R.basisY = null;
      const sB = sEnde(W);
      gerade(W, 4);
      raum(W, { hoch: hochVorher });
      sturz(W, w0);
      return { mass: sA, schleife: [sA, sB], mitte, R: p.R };
    },
  };

  // Was eine Stelle ausmacht, gewürfelt – mit k von leicht (0) bis schwer (1).
  const PARAMETER = {
    kuppe: (k, z) => ({
      auf: lerp(13, 8, k) * lerp(0.9, 1.1, z()) * GRAD,
      ab: lerp(24, 31, z()) * GRAD,
      R: lerp(6, 2.8, k) * lerp(0.88, 1.12, z()),
      luft: lerp(0.3, 0.05, k),
      hang: lerp(6.5, 9, z()),
    }),
    schacht: (k, z) => {
      const weit = lerp(3.4, 8, k) * lerp(0.8, 1.2, z());
      // Mit so viel Tempo soll man gerade hinüberkommen – daraus folgt,
      // wie tief die Kante drüben liegt.
      const knapp = lerp(7.5, 14, k) * lerp(0.92, 1.08, z());
      return {
        weit,
        fall: 4.9 * (weit / (knapp * 0.99)) ** 2,
        ab: lerp(11, 15, z()) * GRAD,
      };
    },
    stampfer: (k, z) => {
      const viele = k < 0.25 ? 1 : k < 0.55 ? 1 + Math.floor(z() * 2) : 2 + Math.floor(z() * 2);
      // Unten bleibt er später länger – offen ist er immer gleich lang.
      const unten = lerp(0.3, 0.75, k) * lerp(0.8, 1.2, z());
      return {
        viele,
        unten,
        T: S_OFFEN_MIN + lerp(0.25, 0, k) + S_FALL + unten + S_HUB * 0.62,
        aus: z() * 10,
        // Alle Stampfer eines Pochwerks schlagen im selben Takt, jeder um so
        // viel später, wie eine Lore mit diesem Tempo bis zu ihm braucht:
        // Wer den ersten gut erwischt und so weiterrollt, kommt durch alle.
        welle: lerp(6, 10, z()),
        abstand: lerp(7, 5, k) * lerp(0.9, 1.3, z()),
      };
    },
    knick: (k, z) => ({
      ab: lerp(12, 16, k) * lerp(0.95, 1.05, z()) * GRAD,
      hang: lerp(1.5, 2.5, z()),
      lang: lerp(3.5, 2.1, k) * lerp(0.93, 1.07, z()),
      auf: lerp(8, 12, z()) * GRAD,
    }),
    looping: (k, z) => ({ R: lerp(3.3, 4.3, z()) }),
  };

  // Ab wie vielen Metern eine Stelle vorkommt, wie oft, und welches Signal
  // vor ihr steht.
  const ARTEN = [
    { art: "kuppe", ab: 0, gewicht: 3, signal: "rot" },
    { art: "schacht", ab: 0, gewicht: 3, signal: "gruen" },
    { art: "stampfer", ab: 190, gewicht: 2.5, signal: "gelb" },
    { art: "knick", ab: 320, gewicht: 2.2, signal: "rot" },
    { art: "looping", ab: 440, gewicht: 1.2, signal: "gruen" },
  ];
  const SIGNAL = Object.fromEntries(ARTEN.map((a) => [a.art, a.signal]));

  // ---------------------------------------------------------------------------
  // Die Fahrt
  // ---------------------------------------------------------------------------
  const AM_GLEIS = 0;
  const IN_LUFT = 1;

  // Eine Lore am Weg s mit Tempo v. Alles, was die Fahrt ausmacht, steht in
  // diesem einen Ding – so lässt sie sich kopieren und vorausrechnen.
  function neueLore(W, s, v) {
    gleisBei(W, s);
    return {
      modus: AM_GLEIS, s, v, x: ort.x, y: ort.y, w: ort.w, vx: 0, vy: 0,
      t: 0,                // die Uhr der Runde – nach ihr schlagen die Stampfer
      j: Math.floor(s / DS), dn: 0, st: 0,
      aus: "",             // warum die Fahrt zu Ende ist
      verloren: "",        // im Looping abgehoben: Der nächste Aufprall ist das Ende
      luft: 0,             // so lange schon in der Luft (s)
      vn: 0,               // so hart war die letzte Landung
      landungen: 0,
    };
  }

  // Wie hoch ein Stampfer zur Zeit t über dem Gleis steht.
  function stampfHoehe(st, t) {
    const oben = st.T - S_FALL - st.unten - S_HUB;
    const u = (((t + st.aus) % st.T) + st.T) % st.T;
    if (u < oben) return S_OBEN;
    if (u < oben + S_FALL) { const q = (u - oben) / S_FALL; return lerp(S_OBEN, S_UNTEN, q * q); }
    if (u < oben + S_FALL + st.unten) return S_UNTEN;
    return lerp(S_UNTEN, S_OBEN, weich((u - oben - S_FALL - st.unten) / S_HUB));
  }

  function abheben(W, z, i, lippe) {
    // i: der letzte Punkt mit Gleis darunter. An der Rampe (lippe) fliegt
    // die Lore von dort in seiner Richtung weiter; über der Kuppe von da,
    // wo sie gerade ist.
    const w = W.w[i];
    if (lippe) {
      const weiter = Math.max(0, z.s - i * DS);
      z.x = W.x[i] + Math.cos(w) * weiter;
      z.y = W.y[i] + Math.sin(w) * weiter;
    }
    z.modus = IN_LUFT;
    z.vx = Math.cos(w) * z.v;
    z.vy = Math.sin(w) * z.v;
    z.w = w;
    z.j = i;
    z.dn = 0.001;
    z.luft = 0;
    if (W.art[i] === SCHLEIFE) z.verloren = "looping";
  }

  /*
   * Ein Schritt der Fahrt. streng (0 oder 1) rechnet mit etwas weniger
   * Platz und etwas weniger Stärke – für den, der vorausrechnet und auf der
   * sicheren Seite bleiben will (pilot).
   */
  function schritt(W, z, bremst, h, streng = 0) {
    if (z.aus) return;
    z.t += h;
    if (z.modus === AM_GLEIS) {
      const i = Math.min(W.n - 2, Math.floor(z.s / DS));
      const hang = -G * Math.sin(W.w[i + 1]) - LUFT * z.v * z.v;
      let v = z.v;
      if (bremst) {
        // Die Bremse hält, auch am Hang.
        v = Math.max(0, v + (hang - ROLL - BREMSE) * h);
      } else {
        v += (hang - ROLL) * h;
        // Unter Schritttempo pumpt der Hauer.
        if (v < V_PUMPE) v = Math.min(V_PUMPE, Math.max(v, z.v + PUMPE * h));
      }
      v = Math.min(v, V_DECKEL);
      z.v = v;
      z.s += v * h;
      const i2 = Math.min(W.n - 2, Math.floor(z.s / DS));
      const art = W.art[i2 + 1];
      if (art === LUECKE) {
        let kante = i2;
        while (kante > 0 && W.art[kante] === LUECKE) kante -= 1;
        abheben(W, z, kante, true);
      } else {
        // Die Last auf dem Gleis: Fliehkraft und Gewicht. Unter null trägt
        // es die Lore nicht mehr – sie hebt ab.
        const last = v * v * W.k[i2 + 1] + G * Math.cos(W.w[i2 + 1]);
        gleisBei(W, z.s);
        z.x = ort.x; z.y = ort.y; z.w = ort.w; z.j = i2;
        // (Wer vorausrechnet, lässt sie etwas früher abheben: Am Scheitel
        // entscheidet ein Hauch, und in der Luft bremst nichts mehr.)
        if (last < 0.06 * G * streng) abheben(W, z, i2 + 1, false);
        else if (art === KNICK && last > G * G_KNICK * (1 - 0.08 * streng)) z.aus = "achse";
      }
    } else {
      z.vy -= G * h;
      z.x += z.vx * h;
      z.y += z.vy * h;
      z.luft += h;
      // Die Lore dreht sich gemächlich in die Richtung, in die sie fliegt.
      let dw = Math.atan2(z.vy, z.vx) - z.w;
      while (dw > Math.PI) dw -= TAU;
      while (dw < -Math.PI) dw += TAU;
      z.w += dw * Math.min(1, h * 5);
      // Der nächste Gleispunkt: Er wandert mit.
      let j = z.j;
      const d2 = (n) => (z.x - W.x[n]) * (z.x - W.x[n]) + (z.y - W.y[n]) * (z.y - W.y[n]);
      let d = d2(j);
      for (let n = 0; n < 240 && j < W.n - 2; n += 1) { const e = d2(j + 1); if (e < d) { j += 1; d = e; } else break; }
      for (let n = 0; n < 240 && j > 1; n += 1) { const e = d2(j - 1); if (e < d) { j -= 1; d = e; } else break; }
      z.j = j;
      z.s = j * DS;
      const dx = z.x - W.x[j];
      const dy = z.y - W.y[j];
      const lang = dx * Math.cos(W.w[j]) + dy * Math.sin(W.w[j]);
      const stueck = lang >= 0 ? j + 1 : j;       // das Stück unter der Lore
      const w = W.w[stueck];
      const tx = Math.cos(w);
      const ty = Math.sin(w);
      const dn = -dx * ty + dy * tx;               // über dem Gleis: positiv
      const vn = z.vx * ty - z.vy * tx;            // ins Gleis hinein
      const vt = z.vx * tx + z.vy * ty;
      // Aufsetzen: am Gleis angekommen und auf dem Weg hinein. Aber nicht,
      // solange das Gleis die Lore dort gar nicht trüge (über der Kuppe
      // fällt es schneller weg, als sie fällt) – sonst klebte sie an jedem
      // geraden Stück zwischen zwei Punkten fest, statt abzuheben.
      const traegt = vt * vt * W.k[stueck] + G * Math.cos(w) >= 0;
      if (dn <= 0 && dn > -0.3 && vn > 0 && W.art[stueck] !== LUECKE && (traegt || dn < -0.03)) {
        if (z.verloren) z.aus = z.verloren;
        else if (vn > V_HART * (1 - 0.12 * streng) || vt < 0.5) z.aus = "hart";
        else {
          z.modus = AM_GLEIS;
          z.s = j * DS + lang;
          z.v = clamp(vt - 0.1 * vn, 0, V_DECKEL);
          z.vn = vn;
          if (z.luft > 0.12) z.landungen += 1;
          gleisBei(W, z.s);
          z.x = ort.x; z.y = ort.y; z.w = ort.w;
        }
      }
      z.dn = dn;
      if (!z.aus && z.modus === IN_LUFT) {
        // Unter dem Boden – im Schacht, an seiner Wand – oder zu lange gefallen.
        if (z.y < bodenBei(W, z.x) - 0.05 || z.luft > 3.5) {
          z.aus = z.verloren || (W.art[stueck] === LUECKE || W.art[j] === LUECKE || dn < -0.3 ? "schacht" : "hart");
        }
      }
    }
    if (z.aus) return;

    // Was im Weg ist: die Decke und die Stampfer, gegen die drei Kreise der Lore.
    const c = Math.cos(z.w);
    const sn = Math.sin(z.w);
    const eng = 0.12 * streng;
    if (z.modus === IN_LUFT || deckeBei(W, z.x) - z.y < 3.4) {
      for (const p of HUELLE) {
        const px = z.x + p.x * c - p.y * sn;
        const py = z.y + p.x * sn + p.y * c;
        if (py + p.r + eng > deckeBei(W, px)) { z.aus = "decke"; return; }
      }
    }
    const liste = W.stampfer;
    while (z.st < liste.length && liste[z.st].x + 3 < z.x) z.st += 1;
    for (let n = z.st; n < liste.length && liste[n].x - 3 < z.x; n += 1) {
      const st = liste[n];
      const unten = st.y + stampfHoehe(st, z.t) - eng * 2;
      for (const p of HUELLE) {
        const px = z.x + p.x * c - p.y * sn;
        const py = z.y + p.x * sn + p.y * c;
        const ex = px - clamp(px, st.x - S_BREIT, st.x + S_BREIT);
        const ey = py < unten ? unten - py : 0;
        if (ex * ex + ey * ey < (p.r + eng) * (p.r + eng)) { z.aus = "stampfer"; return; }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Das Bergwerk bauen
  // ---------------------------------------------------------------------------
  /*
   * Das Tempo-Fenster einer Stelle: mit welchem Tempo man an ihrem
   * Messpunkt ankommen darf – am Scheitel der Kuppe, an der Kante des
   * Schachts, am Knick, am Fuss des Loopings –, um von dort ohne zu bremsen
   * heil hindurchzukommen. Dafür wird die Stelle für sich allein gebaut und
   * von ihrem Messpunkt aus mit jedem Tempo einmal abgefahren.
   * lo und hi sind die Ränder des breitesten Bandes, gold der Teil davon,
   * der «haarscharf» ist.
   */
  function fenster(art, par, w0) {
    const P = neueWelt();
    P.kopf.w = w0;
    // Der Fels steht hier weit weg: Was die Stelle ausmacht, bringt sie mit.
    raum(P, { hoch: 40, hart: true });
    punkt(P, SCHIENE, 0, 0, 0);
    gerade(P, 3);
    const teile = STUECK[art](P, par, w0);
    const s1 = sEnde(P);
    gerade(P, 10);
    const fahrt = (v) => {
      const z = neueLore(P, teile.mass, v);
      for (let n = 0; n < 120 * 20 && !z.aus; n += 1) {
        schritt(P, z, false, 1 / 120);
        if (z.modus === AM_GLEIS && z.s >= s1 + 3) return { ok: true };
      }
      return { ok: false };
    };
    // Das breiteste Band: Meter für Meter je Sekunde abgetastet, die Ränder
    // danach genauer.
    const stufen = [];
    for (let v = 1; v <= V_DECKEL + 1.01; v += 1) stufen.push({ v, ...fahrt(v) });
    let best = null;
    for (let a = 0; a < stufen.length; a += 1) {
      if (!stufen[a].ok) continue;
      let b = a;
      while (b + 1 < stufen.length && stufen[b + 1].ok) b += 1;
      if (!best || b - a > best.b - best.a) best = { a, b };
      a = b;
    }
    if (!best) return null;
    const rand = (gut, schlecht) => {
      for (let n = 0; n < 6; n += 1) { const m = (gut + schlecht) / 2; if (fahrt(m).ok) gut = m; else schlecht = m; }
      return gut;
    };
    const lo = best.a === 0 ? 0 : rand(stufen[best.a].v, stufen[best.a - 1].v);
    const offen = best.b === stufen.length - 1;
    const hi = offen ? Infinity : rand(stufen[best.b].v, stufen[best.b + 1].v);
    // Gold ist der gefährliche Rand: bei Kuppe und Senke der schnelle, bei
    // Schacht und Looping der langsame.
    let gold = null;
    if (art === "kuppe" || art === "knick") {
      if (!offen) gold = [hi - Math.max(0.7, 0.13 * hi), hi];
    } else if (lo > 0) gold = [lo, lo + Math.max(0.8, 0.1 * lo)];
    return { lo, hi, gold };
  }

  // Mit welchem Tempo man bei sZiel ankommt, wenn man bei sVon mit v0
  // losfährt und die ganze Zeit bremst oder nie. 0 heisst: steht vorher.
  function ankunftBei(W, sVon, v0, bremsen, sZiel) {
    const z = neueLore(W, sVon, v0);
    for (let n = 0; n < 60 * 40 && !z.aus; n += 1) {
      schritt(W, z, bremsen, 1 / 60);
      if (z.s >= sZiel) return z.v;
      if (bremsen && z.v === 0) return 0;
    }
    return z.aus ? NaN : 0;
  }

  // Kommt eine Lore, die bei sVon losrollt und nie bremst, heil bis sBis –
  // mit jedem Tempo, vom Stand bis zum höchsten?
  function rolltHeil(W, sVon, sBis) {
    for (let v0 = 0; v0 <= V_DECKEL; v0 += 2) {
      const z = neueLore(W, sVon, v0);
      for (let n = 0; n < 120 * 30 && !z.aus && !(z.modus === AM_GLEIS && z.s >= sBis - 0.5); n += 1) schritt(W, z, false, 1 / 120);
      if (z.aus) return false;
    }
    return true;
  }

  // Welche Stelle als nächste kommt: die ersten drei stehen fest (langsam,
  // schnell, langsam – so lernt man beides), danach gewürfelt, nie dreimal
  // dieselbe.
  function waehleArt(W, m) {
    const P = W.plan;
    if (P.nr < 3) return ["kuppe", "schacht", "kuppe"][P.nr];
    const kann = ARTEN.filter((a) => m >= a.ab && !(a.art === P.letzte && a.art === P.davor)
      && !(a.art === "looping" && (P.letzte === "looping" || P.davor === "looping")));
    let summe = 0;
    for (const a of kann) summe += a.gewicht * (a.art === P.letzte ? 0.5 : 1);
    let r = zufall.zahl() * summe;
    for (const a of kann) {
      r -= a.gewicht * (a.art === P.letzte ? 0.5 : 1);
      if (r <= 0) return a.art;
    }
    return kann[kann.length - 1].art;
  }

  // Das freie Gleis vor einer Stelle: im Grundgefälle, mit sanften Wellen.
  function freieStrecke(W, L, w0) {
    if (Math.abs(W.kopf.w - w0) > 0.002) { bogen(W, 6, w0 - W.kopf.w); L -= 6; }
    let hin = zufall.zahl() < 0.5 ? 1 : -1;
    while (L >= 12) {
      const a = lerp(1.2, 3.6, zufall.zahl()) * GRAD * hin;
      bogen(W, 6, a);
      bogen(W, 6, -a);
      L -= 12;
      hin = -hin;
    }
    if (L > 0.3) gerade(W, L);
  }

  // Der Anlauf vor einer Stelle, die Schwung braucht: steil hinab und zurück
  // ins Grundgefälle.
  function anlauf(W, L, w0, steil) {
    sturz(W, -steil);
    gerade(W, L);
    bogen(W, 10, w0 - W.kopf.w);
  }

  // Wie der Fels vor und in der nächsten Stelle steht. Ein Stollen ist eng
  // und ganz im Fels: Dort hängt das Felsdach der Kuppe, dort steht das
  // Pochwerk. Ein Saal ist hoch und offen – für den Schacht und den Looping
  // –, und das Gleis liegt dort auf einem Sims aus Fels, auf einem Gerüst
  // oder über dem Abgrund.
  function raumWechsel(W, art, par) {
    const P = W.plan;
    const wurf = [zufall.zahl(), zufall.zahl(), zufall.zahl(), zufall.zahl()];
    const saal = art === "looping" || art === "schacht" ? true : art === "kuppe" || art === "stampfer" ? false : wurf[0] < 0.5;
    P.saal = saal;
    P.grund = !saal || art === "looping" ? "fels" : wurf[1] < 0.4 ? "fels" : wurf[1] < 0.78 ? "geruest" : "abgrund";
    P.tief = P.grund === "fels" ? 0.5 : P.grund === "geruest" ? lerp(4, 9, wurf[2]) : 40;
    let hoch = saal ? lerp(13, 24, wurf[3]) : art === "stampfer" ? 7.3 : lerp(6, 7.4, wurf[3]);
    if (art === "looping") hoch = Math.max(hoch, 2 * par.R + 6);
    raum(W, { hoch, tief: P.tief });
    W.raum.saalZiel = saal ? 1 : 0;
  }

  /*
   * Die nächste Stelle samt dem Gleis davor. Erst wird sie gewürfelt und
   * für sich abgefahren (fenster). Dann wird gebaut – freies Gleis, wenn
   * nötig ein Anlauf, die Stelle – und nachgerechnet, ob man an ihrem
   * Messpunkt richtig ankommen kann: aus vollem Tempo langsam genug (die
   * ganze Zeit gebremst) und aus dem Stand schnell genug (nie gebremst).
   * Wenn nicht, wird abgeräumt und länger gebaut.
   */
  function naechstesStueck(W) {
    const m = meterBei(sEnde(W));
    const w0 = gefaelle(m);
    const art = waehleArt(W, m);
    // Die ersten Stellen sind Lehrstücke: eine Kuppe, vor der man wirklich
    // bremsen muss, ein Schacht, über den man einfach rollt.
    let k = [0.45, 0, 0.3][W.plan.nr] ?? schwere(m);
    let par = null;
    let f = null;
    // Ein Band, das keines ist, wird neu gewürfelt – jedes Mal etwas leichter.
    for (let versuch = 0; versuch < 8; versuch += 1) {
      par = PARAMETER[art](k, zufall.zahl);
      f = art === "stampfer" ? { lo: 0, hi: 6.5, gold: null } : fenster(art, par, w0);
      const gut = f && (art === "stampfer"
        || ((art === "kuppe" || art === "knick") && f.hi >= 4.5 && f.hi <= 16 && f.lo <= 3)
        || ((art === "schacht" || art === "looping") && f.lo >= 4 && f.lo <= 18 && !Number.isFinite(f.hi)));
      if (gut) break;
      f = null;
      k *= 0.75;
    }
    const sFrei = sEnde(W);
    if (!f) {
      // Kommt nicht vor (die Prüfung fährt Hunderte Stellen ab) – dann eben
      // freies Gleis.
      freieStrecke(W, 24, w0);
      return;
    }
    raumWechsel(W, art, par);
    const basis = merke(W);
    let frei = lerp(20, 8, schwere(m)) + 6 * zufall.zahl();
    let anlaufLang = 0;
    const steil = lerp(26, 34, zufall.zahl()) * GRAD;
    const hiZiel = Number.isFinite(f.hi) ? f.hi - 0.8 : Infinity;
    let s0 = 0;
    let teile = null;
    for (let n = 0; n < 70; n += 1) {
      zurueck(W, basis);
      freieStrecke(W, frei, w0);
      if (anlaufLang) anlauf(W, anlaufLang, w0, steil);
      s0 = sEnde(W);
      teile = STUECK[art](W, par, w0);
      if (ankunftBei(W, sFrei, V_DECKEL, true, teile.mass) > hiZiel) { frei += 4; continue; }
      if (ankunftBei(W, sFrei, 0, false, teile.mass) < f.lo + 0.8) { anlaufLang += anlaufLang ? 3 : 4; continue; }
      // Grün heisst: einfach rollen. Dann muss das mit jedem Tempo gut gehen.
      if (!Number.isFinite(f.hi) && n < 60 && !rolltHeil(W, sFrei, sEnde(W))) { frei += 3; continue; }
      break;
    }
    const s1 = sEnde(W);
    const stelle = {
      art, nr: W.plan.nr, signal: SIGNAL[art], sFrei, s0, s1, lo: f.lo, hi: f.hi, gold: f.gold, ...teile,
      // Was die Runde dazuschreibt (takt): mit welchem Tempo die Lore am
      // Messpunkt war und ob sie hindurch ist.
      vMass: -1, durch: false, knapp: false,
    };
    W.stellen.push(stelle);
    W.signale.push({ s: Math.max(sFrei + 2, s0 - 30), stelle });
    W.plan.davor = W.plan.letzte;
    W.plan.letzte = art;
    W.plan.nr += 1;
  }

  // Der Anfang: hinten der Stollen, aus dem der Einsturz kommt, dann die
  // Lore auf ebenem Gleis – und gleich die Einfahrt hinab, damit sie Fahrt
  // hat, bevor die erste Stelle kommt.
  function weltAnfang() {
    const W = neueWelt();
    W.rx0 = -START_S;
    W.kopf = { x: -START_S, y: 0, w: 0 };
    punkt(W, SCHIENE, 0, 0, -START_S);
    gerade(W, START_S + 4);
    bogen(W, 8, -18 * GRAD);
    gerade(W, 13);
    bogen(W, 9, gefaelle(0) + 18 * GRAD);
    return W;
  }

  function weltBis(W, s) {
    while (sEnde(W) < s) naechstesStueck(W);
  }

  // Die Stelle, die bei Weg s als nächste endet – die, in der die Lore
  // steckt, oder die vor ihr.
  function naechste(W, s, ab = 0) {
    for (let i = ab; i < W.stellen.length; i += 1) if (W.stellen[i].s1 > s) return W.stellen[i];
    return null;
  }

  // Die gewürfelte Welt in Worten (für die Prüfung): die ersten Stellen.
  function weltText(W = state.welt) {
    weltBis(W, 900);
    return W.stellen.slice(0, 12).map((h) => `${h.art}@${h.s0.toFixed(1)}:${h.lo.toFixed(2)}-${Number.isFinite(h.hi) ? h.hi.toFixed(2) : "x"}`).join(" ");
  }

  // ---------------------------------------------------------------------------
  // Vorausrechnen
  // ---------------------------------------------------------------------------
  // Wie schnell der Einsturz zur Zeit t ist.
  const einsturzTempo = (t) => EINSTURZ_V0 + (EINSTURZ_V1 - EINSTURZ_V0) * (1 - Math.exp(-Math.max(0, t) / EINSTURZ_ZEIT));

  // Kommt die Lore heil durch die Stelle h, wenn sie nach plan bremst? Heil
  // ist auch, wer davor steht und stehen bleiben kann. Gerechnet wird in
  // denselben kleinen Schritten wie die Fahrt selbst: Am Scheitel einer
  // Kuppe entscheidet ein Hauch, und ein grober Schritt sähe ihn nicht.
  function heil(W, z0, h, plan) {
    const z = { ...z0 };
    let steht = -1;
    for (let n = 0; n < 240 * 14; n += 1) {
      const bremst = plan(n);
      schritt(W, z, bremst, TAKT, 1);
      if (z.aus) return false;
      if (z.modus === AM_GLEIS && z.s >= h.s1 + 1.5) return true;
      if (bremst && z.v === 0) {
        if (steht < 0) steht = n;
        else if (n - steht > 240 * 3.6) return true;
      } else steht = -1;
    }
    return false;
  }

  /*
   * Der Pilot (für die Prüfung und die Vorführung): Soll jetzt gebremst
   * werden? Er rollt, solange Rollen heil durch die nächste Stelle führt –
   * und auch dann noch, solange er danach noch anhalten könnte. Erst wenn
   * beides nicht mehr geht, bremst er: so spät wie möglich, so kurz wie
   * nötig.
   */
  function pilot(W, z) {
    if (z.aus) return false;
    const h = naechste(W, z.s);
    if (!h) return false;
    if (heil(W, z, h, () => false)) return false;
    return !heil(W, z, h, (n) => n >= 8);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase: "bereit" (noch nichts gedrückt), "spiel", "zuschauen", "ende"
  const state = {
    phase: "bereit",
    welt: null,
    z: null,               // die Lore (neueLore)
    punkte: 0,             // dasselbe wie meter – die Strecke ist die Punktzahl
    meter: 0,
    weit: 0,               // der weiteste Weg s der Runde
    spitze: 0,             // das höchste Tempo (m/s)
    einsturz: 0,           // wo der Einsturz steht (Weg s)
    kette: 0,              // so viele Stellen hintereinander «haarscharf»
    knappe: 0,             // so viele insgesamt
    stelleNr: 0,           // die Stelle, die als nächste endet
    grund: "",             // warum die Runde endete
    endet: 0,              // seit wann sie endet (Bildzeit), 0: läuft
    zeit: 0,               // die Bildzeit – läuft immer
    bremst: false,         // ob gerade gebremst wird (fürs Bild und den Klang)
    bremsZeit: 0,
    kam: { x: 0, y: 0, zoom: 1 },
    stoss: 0,
    funken: [], staub: [], brocken: [], schriften: [], schweben: [],
    wrack: null,           // die Lore nach dem Unglück
    radWinkel: 0,
    blick: 0,              // wie sehr der Hauer sich duckt (0 … 1)
    freude: 0,             // Arme hoch im Flug
    zone: { name: "", seit: -99 },
    letzterKlang: 0,
    signalNr: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  let gedrueckt = false;
  // Der Druck, mit dem die Runde beginnt, bremst noch nicht: Wer zum Start
  // tippt und liegen bleibt, stünde sonst gleich wieder.
  let startDruck = false;
  let gegner = null;
  let zuschauer = null;
  // Die Kulissen (klang.js): Rollen, Bremse, Grollen.
  let klRollen = null;
  let klBremse = null;
  let klGrollen = null;

  const view = { dpr: 1, cssW: 0, cssH: 0, frei: 0, s: 20, z: 20, hoch: false, mitteY: 0, anker: 0.26, guete: 1 };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Klang
  // ---------------------------------------------------------------------------
  const zuletzt = new Map();
  function ton(id, o = {}, pause = 70) {
    const ms = performance.now();
    if (ms - (zuletzt.get(id) ?? -1e9) < pause) return;
    zuletzt.set(id, ms);
    klang()?.ton?.(id, o);
  }

  function kulissenAn() {
    klRollen = klang()?.kulisse?.("grubenlore.rollen", { laut: 0 }) || null;
    klBremse = klang()?.kulisse?.("grubenlore.bremse", { laut: 0 }) || null;
    klGrollen = klang()?.kulisse?.("grubenlore.einsturz", { laut: 0 }) || null;
  }

  function kulissenAus() {
    klRollen?.stop(); klBremse?.stop(); klGrollen?.stop();
    klRollen = null; klBremse = null; klGrollen = null;
  }

  // Das Rollen hängt am Tempo, die Bremse am Bremsen, das Grollen daran, wie
  // nah der Einsturz ist.
  function kulissenStellen() {
    const z = state.z;
    const amGleis = z.modus === AM_GLEIS && !state.endet;
    const tempo = clamp(z.v / V_DECKEL, 0, 1);
    klRollen?.setze(tempo);
    klRollen?.laut(amGleis ? 0.25 + 0.75 * tempo : 0);
    klBremse?.setze(tempo);
    klBremse?.laut(amGleis && state.bremst && z.v > 0.5 ? 0.5 + 0.5 * tempo : 0);
    const nah = clamp(1 - (z.s - state.einsturz) / 60, 0, 1);
    klGrollen?.setze(nah);
    klGrollen?.laut(state.phase === "bereit" ? 0 : 0.35 + 0.95 * nah);
  }

  // ---------------------------------------------------------------------------
  // Funken, Staub und Brocken
  // ---------------------------------------------------------------------------
  // Alles hier würfelt mit Math.random: Es ist Zierde und hängt davon ab, wie
  // jemand fährt.
  function funke(x, y, vx, vy, leben, hell = 1) {
    if (state.funken.length > (ruhig() ? 50 : 170)) return;
    state.funken.push({ x, y, vx, vy, leben, max: leben, hell });
  }

  function staubWolke(x, y, anzahl, kraft = 1, farbe = 0) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl && state.staub.length < 90; i += 1) {
      const w = Math.random() * TAU;
      const v = (0.4 + Math.random() * 2.2) * kraft;
      state.staub.push({
        x: x + (Math.random() - 0.5) * 0.6, y: y + Math.random() * 0.3,
        vx: Math.cos(w) * v, vy: Math.abs(Math.sin(w)) * v * 0.7 + 0.3,
        r: 0.25 + Math.random() * 0.5, leben: 0.6 + Math.random() * 0.8, max: 1.4, farbe,
      });
    }
  }

  function brocken(x, y, anzahl, kraft = 1) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 2);
    for (let i = 0; i < anzahl && state.brocken.length < 60; i += 1) {
      const w = Math.random() * Math.PI;
      const v = (2 + Math.random() * 6) * kraft;
      state.brocken.push({
        x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v + 1, w: Math.random() * TAU, dw: (Math.random() - 0.5) * 12,
        r: 0.08 + Math.random() * 0.22, leben: 1 + Math.random() * 1.2, form: Math.random(),
      });
    }
  }

  function schrift(text, farbe, gross = 22, dauer = 1.5, hoch = 3.4) {
    state.schriften.push({ text, farbe, gross, leben: dauer, max: dauer, hoch, x: state.z.x, y: state.z.y });
    if (state.schriften.length > 4) state.schriften.shift();
  }

  // ---------------------------------------------------------------------------
  // Was unterwegs geschieht
  // ---------------------------------------------------------------------------
  const NAMEN = { kuppe: "Felsdach", schacht: "Schacht", stampfer: "Pochwerk", knick: "Senke", looping: "Looping" };

  // Eine Stelle liegt hinter der Lore. War es haarscharf – so schnell, wie es
  // unter dem Dach und durch die Senke gerade noch geht, so langsam, wie es
  // über den Schacht und durch den Looping gerade noch reicht, oder knapp
  // unter einem Stampfer durch –, gibt es Vorsprung: in Folge immer mehr.
  function geschafft(h) {
    h.durch = true;
    let knapp = false;
    if (h.art === "stampfer") knapp = h.knapp;
    else if (h.gold && h.vMass >= 0) {
      knapp = h.art === "kuppe" || h.art === "knick" ? h.vMass >= h.gold[0] : h.vMass <= h.gold[1];
    }
    if (!knapp) {
      state.kette = 0;
      if (state.phase === "spiel") ton("punkt", { laut: 0.45 }, 200);
      return;
    }
    state.kette += 1;
    state.knappe += 1;
    const bonus = BONUS[Math.min(state.kette, BONUS.length) - 1];
    state.einsturz = Math.max(state.einsturz - bonus, state.z.s - VORSPRUNG_MAX);
    schrift(state.kette > 1 ? `Haarscharf! ×${state.kette}` : "Haarscharf!", "#ffd23f", 24, 1.6);
    schrift(`+${bonus} m Vorsprung`, "#fff3c4", 15, 1.6, 2.5);
    if (state.phase === "spiel") {
      ton("perfekt", { laut: 0.8 }, 200);
      kids()?.vibrate?.([8, 30, 12]);
    }
    for (let i = 0; i < 14; i += 1) {
      const w = Math.random() * TAU;
      state.schweben.push({ x: state.z.x + Math.cos(w) * 0.8, y: state.z.y + 1.2 + Math.sin(w) * 0.8, vx: Math.cos(w) * 3, vy: Math.sin(w) * 3 + 1.5, leben: 0.7, max: 0.7 });
    }
  }

  // Nach jedem Schritt der Fahrt: abgehoben, aufgesetzt, eine Stelle
  // vermessen oder geschafft, ein Stampfer knapp verfehlt.
  function nachSchritt(vorher) {
    const W = state.welt;
    const z = state.z;
    if (vorher === AM_GLEIS && z.modus === IN_LUFT && !z.aus) {
      const i = Math.min(W.n - 1, z.j + 1);
      if (W.art[i] === LUECKE) {
        if (state.phase === "spiel") ton("grubenlore.sprung", { laut: 0.8 }, 250);
      }
    } else if (vorher === IN_LUFT && z.modus === AM_GLEIS && z.vn > 0.6) {
      // Aufgesetzt: Staub und ein Schlag, je härter, desto mehr.
      const hart = clamp(z.vn / V_HART, 0, 1);
      staubWolke(z.x, z.y, 4 + Math.round(hart * 10), 0.6 + hart);
      for (let i = 0; i < 6 + hart * 14; i += 1) funke(z.x + (Math.random() - 0.5) * 1.2, z.y + 0.05, -z.v * 0.3 * Math.random() + (Math.random() - 0.5) * 4, 1 + Math.random() * 4, 0.25 + Math.random() * 0.3);
      state.stoss = Math.max(state.stoss, 0.25 + hart * 0.6);
      if (state.phase === "spiel") {
        ton("grubenlore.landung", { laut: 0.5 + hart * 0.7 }, 150);
        kids()?.vibrate?.(8 + Math.round(hart * 20));
      }
      z.vn = 0;
    }
    const h = W.stellen[state.stelleNr];
    if (!h) return;
    if (h.vMass < 0 && z.s >= h.mass) h.vMass = z.modus === AM_GLEIS ? z.v : Math.hypot(z.vx, z.vy);
    if (h.art === "stampfer") {
      // Knapp: Der Stampfer war eben noch unten, als die Lore kam, oder ist
      // gleich wieder unten, wenn sie geht.
      for (const st of h.stampfer) {
        if (!st.ein && z.x + 1 >= st.x - S_BREIT) { st.ein = true; if (stampfHoehe(st, z.t - 0.22) < S_FREI) h.knapp = true; }
        if (!st.raus && z.x - 1 >= st.x + S_BREIT) { st.raus = true; if (stampfHoehe(st, z.t + 0.28) < S_FREI) h.knapp = true; }
      }
    }
    if (z.s >= h.s1 && z.modus === AM_GLEIS && !z.aus) {
      geschafft(h);
      state.stelleNr += 1;
    }
  }

  // Die Stampfer schlagen auf: Staub, und wer nah ist, hört und spürt es.
  function stampferTakt() {
    const W = state.welt;
    const z = state.z;
    for (const st of W.stampfer) {
      if (st.x < z.x - 30) continue;
      if (st.x > z.x + 45) break;
      const unten = stampfHoehe(st, z.t) <= S_UNTEN + 0.02;
      if (unten && !st.lag) {
        const nah = clamp(1 - Math.abs(st.x - z.x) / 30, 0, 1);
        staubWolke(st.x, st.y + 0.2, 6, 1.1);
        for (let i = 0; i < 8; i += 1) funke(st.x + (Math.random() - 0.5), st.y + 0.3, (Math.random() - 0.5) * 9, 1 + Math.random() * 3, 0.2 + Math.random() * 0.2);
        state.stoss = Math.max(state.stoss, 0.35 * nah);
        if (state.phase === "spiel" && nah > 0.15) ton("grubenlore.stampfer", { laut: 0.25 + 0.75 * nah }, 60);
      }
      st.lag = unten;
    }
  }

  const GRUND_TEXT = {
    decke: "Am Fels hängen geblieben",
    stampfer: "Vom Stampfer erwischt",
    schacht: "In den Schacht gestürzt",
    hart: "Zu hart aufgesetzt",
    achse: "Achsbruch in der Senke",
    looping: "Zu langsam für den Looping",
    einsturz: "Vom Einsturz eingeholt",
    zeit: "Die Zeit ist um",
  };
  const GRUND_KURZ = {
    decke: "Zu schnell!", stampfer: "Erwischt!", schacht: "Zu langsam!", hart: "Zu hart!",
    achse: "Achsbruch!", looping: "Zu langsam!", einsturz: "Eingeholt!",
  };

  // Das Unglück: Die Lore fliegt auseinander, die Runde ist vorbei.
  function unglueck(grund) {
    if (state.endet) return;
    const z = state.z;
    state.grund = grund;
    state.endet = state.zeit;
    state.bremst = false;
    state.stoss = 1;
    const vx = z.modus === AM_GLEIS ? Math.cos(z.w) * z.v : z.vx;
    const vy = z.modus === AM_GLEIS ? Math.sin(z.w) * z.v : z.vy;
    const stopp = grund === "decke" || grund === "stampfer" ? 0.25 : grund === "schacht" ? 0.9 : 0.6;
    state.wrack = {
      x: z.x, y: z.y + 0.6, vx: vx * stopp, vy: vy * stopp + (grund === "schacht" ? 0 : 3.5), w: z.w, dw: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 5),
      teile: [0, 1, 2].map((i) => ({ x: z.x, y: z.y + 0.4, vx: vx * 0.5 + (Math.random() - 0.5) * 8, vy: 4 + Math.random() * 6, w: 0, dw: (Math.random() - 0.5) * 20, art: i })),
      versinkt: grund === "einsturz",
    };
    staubWolke(z.x, z.y + 0.6, 26, 1.8);
    brocken(z.x, z.y + 0.8, grund === "einsturz" ? 6 : 16, 1.2);
    for (let i = 0; i < 40; i += 1) {
      const w = Math.random() * TAU;
      const v = 3 + Math.random() * 12;
      funke(z.x, z.y + 0.6, Math.cos(w) * v + vx * 0.3, Math.sin(w) * v + 2, 0.4 + Math.random() * 0.5, 1.4);
    }
    if (GRUND_KURZ[grund]) schrift(GRUND_KURZ[grund], "#ff8a70", 26, 2.2, 3.6);
    if (state.phase === "spiel") {
      ton("grubenlore.crash", { laut: 1 });
      ton("fehler", { verzoegerung: 0.3 }, 300);
      kids()?.vibrate?.([30, 40, 60]);
      klRollen?.laut(0);
      klBremse?.laut(0);
      stepTimer = window.setTimeout(finish, grund === "schacht" ? 1700 : 1500);
    }
  }

  // ---------------------------------------------------------------------------
  // Der Takt
  // ---------------------------------------------------------------------------
  function einsturzSchritt(h) {
    const z = state.z;
    state.einsturz += einsturzTempo(z.t) * h;
    if (z.s - state.einsturz > VORSPRUNG_MAX) state.einsturz = z.s - VORSPRUNG_MAX;
  }

  function fahrtTakt(dt) {
    const W = state.welt;
    const z = state.z;
    const bremst = gedrueckt && !startDruck;
    state.bremst = bremst && z.modus === AM_GLEIS;
    const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
    const h = dt / n;
    for (let i = 0; i < n && !z.aus && !state.endet; i += 1) {
      const vorher = z.modus;
      schritt(W, z, bremst, h);
      einsturzSchritt(h);
      nachSchritt(vorher);
      if (!z.aus && state.einsturz >= z.s) z.aus = "einsturz";
    }
    if (z.aus) unglueck(z.aus);
    const tempo = z.modus === AM_GLEIS ? z.v : Math.hypot(z.vx, z.vy);
    state.spitze = Math.max(state.spitze, tempo);
    if (z.s > state.weit) {
      state.weit = z.s;
      const meter = Math.floor(meterBei(z.s));
      if (meter !== state.meter) {
        state.meter = meter;
        state.punkte = meter;
        shell.setCount(meter);
      }
    }
  }

  // Funken an den Rädern, Staub, was fliegt und fällt.
  function nebenbei(dt) {
    const W = state.welt;
    const z = state.z;
    const tempo = z.modus === AM_GLEIS ? z.v : Math.hypot(z.vx, z.vy);
    state.radWinkel += (state.bremst ? tempo * 0.15 : tempo) * dt / 0.28;
    state.bremsZeit = state.bremst ? state.bremsZeit + dt : 0;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.2);

    // Bremsfunken: nach hinten oben weg, je schneller, desto mehr.
    if (state.bremst && z.v > 0.8 && !state.endet) {
      const c = Math.cos(z.w);
      const s = Math.sin(z.w);
      const viele = (ruhig() ? 60 : 260) * clamp(z.v / 12, 0.25, 1.3) * dt;
      for (let n = Math.floor(viele) + (Math.random() < viele % 1 ? 1 : 0); n > 0; n -= 1) {
        const rad = Math.random() < 0.5 ? -0.55 : 0.55;
        const v = z.v * (0.25 + Math.random() * 0.75);
        const hoch = 0.6 + Math.random() * 4.2;
        funke(z.x + c * rad, z.y + s * rad + 0.03, -c * v - s * hoch + (Math.random() - 0.5) * 1.5, -s * v + c * hoch, 0.18 + Math.random() * 0.4);
      }
    }
    for (let i = state.funken.length - 1; i >= 0; i -= 1) {
      const f = state.funken[i];
      f.vy -= 14 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.leben -= dt;
      if (f.leben <= 0) { state.funken[i] = state.funken[state.funken.length - 1]; state.funken.pop(); }
    }
    for (let i = state.staub.length - 1; i >= 0; i -= 1) {
      const t = state.staub[i];
      t.vx *= 1 - 1.8 * dt;
      t.vy *= 1 - 1.8 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.r += dt * 0.5;
      t.leben -= dt;
      if (t.leben <= 0) { state.staub[i] = state.staub[state.staub.length - 1]; state.staub.pop(); }
    }
    for (let i = state.brocken.length - 1; i >= 0; i -= 1) {
      const b = state.brocken[i];
      b.vy -= G * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.w += b.dw * dt;
      b.leben -= dt;
      if (b.leben <= 0) { state.brocken[i] = state.brocken[state.brocken.length - 1]; state.brocken.pop(); }
    }
    for (let i = state.schweben.length - 1; i >= 0; i -= 1) {
      const t = state.schweben[i];
      t.vx *= 1 - 2.5 * dt;
      t.vy *= 1 - 2.5 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.schweben.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    // Das Wrack: Es fliegt, schlägt auf und bleibt liegen.
    const wr = state.wrack;
    if (wr) {
      const alle = [wr, ...wr.teile];
      for (const t of alle) {
        t.vy -= G * dt;
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        t.w += t.dw * dt;
        const boden = bodenBei(W, t.x) + (t === wr ? 0.55 : 0.2);
        if (t.y < boden && !wr.versinkt) {
          t.y = boden;
          if (Math.abs(t.vy) > 2) staubWolke(t.x, boden, 3, 0.8);
          t.vy = -t.vy * 0.35;
          t.vx *= 0.6;
          t.dw *= 0.5;
        }
      }
    }

    // Der Hauer: duckt sich unter niedrigem Fels und vor Stampfern, jubelt im Flug.
    const frei = deckeBei(W, z.x + 1.5) - z.y;
    const duckt = frei < 4 || W.stampfer.some((st) => Math.abs(st.x - z.x - 1) < 3) ? 1 : 0;
    state.blick += (duckt - state.blick) * Math.min(1, dt * 10);
    const fliegt = z.modus === IN_LUFT && z.luft > 0.15 && !state.endet && !duckt ? 1 : 0;
    state.freude += (fliegt - state.freude) * Math.min(1, dt * 9);

    // Ein neues Revier: sein Name steht kurz im Bild.
    const zone = BIOME[biomNr(state.meter)].name;
    if (zone !== state.zone.name) state.zone = { name: zone, seit: state.phase === "bereit" ? -99 : state.zeit };

    // Ein Glockenschlag, wenn ein Signal vorbeizieht.
    while (state.signalNr < W.signale.length && W.signale[state.signalNr].s <= z.s) {
      if (state.phase === "spiel" && !state.endet) ton("grubenlore.signal", { laut: 0.45 }, 120);
      state.signalNr += 1;
    }
  }

  // Die Kamera: quer hängt sie fest an der Lore (im Looping an seinem Fuss –
  // sonst führe das Bild mit im Kreis), in der Höhe schaut sie voraus, dem
  // Gleis nach, das kommt. Je schneller, desto weiter weg.
  const kamZiel = { x: 0, y: 0 };
  function kameraZiel() {
    const W = state.welt;
    const z = state.z;
    let x = state.wrack && !state.wrack.versinkt ? Math.max(z.x, Math.min(state.wrack.x, z.x + 6)) : z.x;
    let y = z.y;
    const h = W.stellen[state.stelleNr];
    if (h && h.art === "looping" && z.s >= h.schleife[0] && z.s <= h.schleife[1]) {
      x = h.mitte.x;
      y = h.mitte.y - h.R * 0.35;
    } else {
      const a = gleisBei(W, z.s + 7).y;
      const b = gleisBei(W, z.s + 15).y;
      y = 0.5 * z.y + 0.32 * a + 0.18 * b;
    }
    kamZiel.x = x;
    kamZiel.y = y;
    return kamZiel;
  }

  function kameraTakt(dt, sofort = false) {
    const z = state.z;
    const ziel = kameraZiel();
    const tempo = z.modus === AM_GLEIS ? z.v : Math.hypot(z.vx, z.vy);
    const zoom = 1 - 0.17 * clamp((tempo - 9) / 12, 0, 1);
    if (sofort) {
      state.kam.x = ziel.x; state.kam.y = ziel.y; state.kam.zoom = zoom;
      return;
    }
    state.kam.x += (ziel.x - state.kam.x) * (1 - Math.exp(-dt * 14));
    state.kam.y += (ziel.y - state.kam.y) * (1 - Math.exp(-dt * 3.4));
    state.kam.zoom += (zoom - state.kam.zoom) * (1 - Math.exp(-dt * 1.6));
  }

  function takt(dt) {
    state.zeit += dt;
    const W = state.welt;
    if (state.phase === "zuschauen") zuschauenTakt(dt);
    else if (state.phase === "spiel" && !state.endet) fahrtTakt(dt);
    // Das Bergwerk wächst voraus – höchstens eine Stelle je Bild, damit kein
    // Bild darauf warten muss.
    if (sEnde(W) < state.z.s + 420) naechstesStueck(W);
    stampferTakt();
    nebenbei(dt);
    kameraTakt(dt);
    kulissenStellen();
    if (state.phase === "spiel" && !state.endet) {
      const z = state.z;
      gegner?.takt(state.punkte, {
        a: Math.round(z.s * 10),
        b: Math.round((z.modus === IN_LUFT ? Math.max(0, z.dn) : 0) * 10),
        c: Math.round(z.w * 100),
      });
    }
  }

  // Flüssig vor scharf: Stockt das Bild über eine gute Sekunde, wird es
  // gröber gemalt statt langsamer – und bleibt so für den Rest des Besuchs.
  let bildZeit = 1 / 60;
  let zaeh = 0;
  function gueteTakt(sekunden) {
    if (sekunden > 0.2 || document.hidden) { zaeh = 0; return; }
    bildZeit += (sekunden - bildZeit) * 0.06;
    zaeh = bildZeit > 0.024 ? zaeh + sekunden : 0;
    if (zaeh > 1.2 && view.guete > 0.5) {
      view.guete *= 0.8;
      view.cssW = 0;
      zaeh = 0;
      bildZeit = 1 / 60;
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    gueteTakt((now - last) / 1000);
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    messen();
    takt(dt);
    zeichnen();
  }

  // ---------------------------------------------------------------------------
  // Die Reviere
  // ---------------------------------------------------------------------------
  // Mit der Tiefe ändert sich das Bergwerk: Farben, Licht und was im Fels
  // steckt. Gerechnet wird überall gleich – das hier ist nur das Bild.
  const BIOME = [
    { ab: 0, name: "Alter Stollen", art: 0, oben: [30, 19, 13], mitte: [62, 37, 21], unten: [14, 9, 6], fern: [74, 46, 28], mittel: [46, 28, 18],
      fels: [108, 72, 48], tief: [24, 15, 10], kante: [238, 172, 104], staub: [182, 146, 112], leucht: "warm" },
    { ab: 420, name: "Kristallgrotte", art: 1, oben: [8, 18, 38], mitte: [16, 48, 76], unten: [4, 10, 22], fern: [26, 68, 98], mittel: [14, 42, 64],
      fels: [52, 96, 124], tief: [8, 24, 38], kante: [132, 238, 255], staub: [134, 172, 192], leucht: "cyan" },
    { ab: 900, name: "Smaragdsee", art: 2, oben: [5, 25, 27], mitte: [10, 60, 56], unten: [2, 14, 18], fern: [18, 80, 72], mittel: [9, 50, 47],
      fels: [46, 104, 92], tief: [6, 28, 28], kante: [152, 255, 206], staub: [124, 172, 152], leucht: "gruen" },
    { ab: 1400, name: "Glutkammer", art: 3, oben: [32, 8, 6], mitte: [88, 24, 10], unten: [26, 6, 3], fern: [108, 38, 16], mittel: [62, 19, 10],
      fels: [124, 56, 36], tief: [30, 9, 6], kante: [255, 152, 72], staub: [176, 108, 82], leucht: "glut" },
    { ab: 1950, name: "Goldader", art: 4, oben: [18, 10, 32], mitte: [46, 24, 70], unten: [10, 5, 20], fern: [64, 38, 94], mittel: [38, 21, 58],
      fels: [92, 64, 118], tief: [18, 9, 30], kante: [255, 216, 112], staub: [156, 134, 176], leucht: "gold" },
  ];
  const FARBNAMEN = ["oben", "mitte", "unten", "fern", "mittel", "fels", "tief", "kante", "staub"];

  function biomNr(m) {
    let i = 0;
    while (i + 1 < BIOME.length && BIOME[i + 1].ab <= m) i += 1;
    return i;
  }

  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  // Die Farben dieses Bildes: das Revier, in dem die Lore ist – achtzig
  // Meter vor dem nächsten schon auf dem Weg dorthin.
  const pal = { art: [0, 0, 0, 0, 0], leucht: "warm", leucht2: "warm", u: 0 };
  function palette(m) {
    const i = biomNr(m);
    const A = BIOME[i];
    const B = BIOME[Math.min(i + 1, BIOME.length - 1)];
    const u = B === A ? 0 : weich(clamp((m - (B.ab - 80)) / 80, 0, 1));
    for (const name of FARBNAMEN) {
      const a = A[name];
      const b = B[name];
      pal[name] = [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
    }
    pal.art.fill(0);
    pal.art[A.art] += 1 - u;
    pal.art[B.art] += u;
    pal.leucht = A.leucht;
    pal.leucht2 = B.leucht;
    pal.u = u;
    return pal;
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "gl-platz");
    feld = shell.el("div", "gl-feld");
    canvas = document.createElement("canvas");
    canvas.className = "gl-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");
    // Der Hinweis vor dem ersten Druck: ein Ring, der sich füllt – halten,
    // nicht tippen.
    const tipp = shell.el("span", "gl-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    [
      { r: 22, stroke: "rgba(255,255,255,0.45)", w: 5 },
      { r: 22, stroke: "#ffffff", w: 5, klasse: "gl-tipp-fuell" },
    ].forEach((ring) => {
      const kreis = document.createElementNS(ns, "circle");
      kreis.setAttribute("cx", "32");
      kreis.setAttribute("cy", "32");
      kreis.setAttribute("r", String(ring.r));
      kreis.setAttribute("fill", "none");
      kreis.setAttribute("stroke", ring.stroke);
      kreis.setAttribute("stroke-width", String(ring.w));
      if (ring.klasse) {
        kreis.setAttribute("class", ring.klasse);
        kreis.setAttribute("stroke-linecap", "round");
      }
      svg.append(kreis);
    });
    const punktMitte = document.createElementNS(ns, "circle");
    punktMitte.setAttribute("cx", "32");
    punktMitte.setAttribute("cy", "32");
    punktMitte.setAttribute("r", "9");
    punktMitte.setAttribute("fill", "#ffffff");
    svg.append(punktMitte);
    tipp.append(svg);
    feld.append(tipp);
    platz.append(feld);
    return platz;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    // Bis zur doppelten Pixeldichte: Darüber sieht niemand mehr, aber jedes
    // Bild kostet das Doppelte.
    // Und nie viel mehr Bildpunkte als gut zweieinhalb Millionen: Das Bild
    // lebt von grossen, weichen Lichtern, und die kosten je Punkt.
    const dpr = clamp(Math.min(window.devicePixelRatio || 1, Math.sqrt(2.6e6 / (cssW * cssH))), 1, 2) * view.guete;
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    view.hoch = cssH > cssW * 1.1;
    // Der Massstab: Quer stehen mindestens dreissig Meter im Bild, in der
    // Höhe mindestens vierzehn – auf jedem Gerät sieht man gleich weit voraus.
    // Hochkant etwas näher heran, sonst wäre die Lore ein Punkt.
    view.s = Math.max(Math.min(cssW / (view.hoch ? 24 : 30), (cssH - frei) / 14), cssW / 60);
    view.anker = view.hoch ? 0.24 : 0.27;
    view.mitteY = frei + (cssH - frei) * (view.hoch ? 0.46 : 0.56);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    hintergrundAlt = null;
  }

  const sx = (x) => (x - state.kam.x) * view.z + view.ankerX;
  const sy = (y) => view.mitteY - (y - state.kam.y) * view.z;
  const wx = (px) => (px - view.ankerX) / view.z + state.kam.x;

  // ---------------------------------------------------------------------------
  // Licht aus der Dose
  // ---------------------------------------------------------------------------
  // Ein Schein ist ein fertiges Bild (ein weicher Kreis in einer Farbe), das
  // hell über die Szene gelegt wird – viel billiger als ein Schatten oder ein
  // Verlauf je Lampe.
  const SCHEIN_FARBEN = {
    warm: [255, 186, 104], rot: [255, 70, 52], gruen: [84, 255, 150], gelb: [255, 214, 74], cyan: [120, 236, 255],
    violett: [204, 150, 255], glut: [255, 118, 44], gold: [255, 214, 104], weiss: [255, 246, 226], funke: [255, 150, 60],
  };
  const scheinBilder = {};
  function scheinBild(name) {
    if (scheinBilder[name]) return scheinBilder[name];
    const c = SCHEIN_FARBEN[name] || SCHEIN_FARBEN.warm;
    const bild = document.createElement("canvas");
    bild.width = 128;
    bild.height = 128;
    const q = bild.getContext("2d");
    const v = q.createRadialGradient(64, 64, 0, 64, 64, 64);
    v.addColorStop(0, rgba(c, 1));
    v.addColorStop(0.2, rgba(c, 0.6));
    v.addColorStop(0.55, rgba(c, 0.16));
    v.addColorStop(1, rgba(c, 0));
    q.fillStyle = v;
    q.fillRect(0, 0, 128, 128);
    scheinBilder[name] = bild;
    return bild;
  }

  // Staub: ein weicher Fleck in einer Farbe – je Farbe einmal gemalt.
  const staubBilder = new Map();
  function staubSprite(c) {
    const r = Math.round(c[0] / 20) * 20;
    const gr = Math.round(c[1] / 20) * 20;
    const b = Math.round(c[2] / 20) * 20;
    const name = `${r},${gr},${b}`;
    let bild = staubBilder.get(name);
    if (bild) return bild;
    if (staubBilder.size > 40) staubBilder.clear();
    bild = document.createElement("canvas");
    bild.width = 96;
    bild.height = 96;
    const q = bild.getContext("2d");
    const v = q.createRadialGradient(48, 48, 4, 48, 48, 48);
    v.addColorStop(0, `rgba(${name},0.95)`);
    v.addColorStop(0.5, `rgba(${name},0.6)`);
    v.addColorStop(1, `rgba(${name},0)`);
    q.fillStyle = v;
    q.fillRect(0, 0, 96, 96);
    staubBilder.set(name, bild);
    return bild;
  }

  // Die Lichter eines Bildes: beim Zeichnen gesammelt, am Schluss hell
  // darübergelegt.
  const lichter = [];
  let lichtZahl = 0;
  function licht(x, y, r, name, a) {
    if (lichtZahl >= 150) return;
    const l = lichter[lichtZahl] || (lichter[lichtZahl] = {});
    l.x = x; l.y = y; l.r = r; l.name = name; l.a = a;
    lichtZahl += 1;
  }

  function schein(x, y, r, name, a) {
    g.globalAlpha = a;
    g.drawImage(scheinBild(name), x - r, y - r, r * 2, r * 2);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: der Hintergrund
  // ---------------------------------------------------------------------------
  let hintergrundAlt = null;
  let randAlt = null;

  // Die Höhle dahinter: ein Verlauf, zwei Lagen Säulen (Tropfsteine, die
  // einander von oben und unten entgegenwachsen) und was im jeweiligen
  // Revier in der Ferne leuchtet. Alles zieht langsamer vorbei als das
  // Gleis.
  function saeulen(P, tiefe, farbe, abstand, saat, mitLicht) {
    const W = view.cssW;
    const H = view.cssH;
    const versatz = state.kam.x * view.s * tiefe;
    const i0 = Math.floor((versatz - abstand) / abstand);
    const i1 = Math.ceil((versatz + W + abstand) / abstand);
    g.fillStyle = farbe;
    for (let i = i0; i <= i1; i += 1) {
      const a = hash01(i * 7.31 + saat);
      const b = hash01(i * 3.17 + saat + 5);
      if (a < 0.12) continue;
      const x = i * abstand - versatz + (b - 0.5) * abstand * 0.55;
      const br = abstand * (0.1 + 0.16 * a);
      const taille = H * (0.34 + 0.3 * b);
      // Eine Säule: oben und unten breit, in der Taille schmal, mit einem
      // Absatz auf jeder Seite.
      g.beginPath();
      g.moveTo(x - br * 2.3, -12);
      g.quadraticCurveTo(x - br * 0.9, taille * 0.35, x - br * 0.75, taille * 0.72);
      g.lineTo(x - br * 0.5, taille * 0.8);
      g.quadraticCurveTo(x - br * 0.38, taille, x - br * 0.55, taille + (H - taille) * 0.3);
      g.lineTo(x - br * 0.85, taille + (H - taille) * 0.36);
      g.quadraticCurveTo(x - br * 1.1, taille + (H - taille) * 0.75, x - br * 2.6, H + 12);
      g.lineTo(x + br * 2.6, H + 12);
      g.quadraticCurveTo(x + br * 1.2, taille + (H - taille) * 0.7, x + br * 0.8, taille + (H - taille) * 0.42);
      g.lineTo(x + br * 0.52, taille + (H - taille) * 0.34);
      g.quadraticCurveTo(x + br * 0.36, taille, x + br * 0.55, taille * 0.78);
      g.lineTo(x + br * 0.82, taille * 0.7);
      g.quadraticCurveTo(x + br * 1.0, taille * 0.3, x + br * 2.2, -12);
      g.closePath();
      g.fill();
      if (!mitLicht) continue;
      // Was an dieser Säule leuchtet – je nach Revier.
      const hoehe = H * (0.2 + 0.6 * hash01(i * 5.9 + saat));
      const flackern = 0.75 + 0.25 * Math.sin(state.zeit * (2 + 3 * b) + i);
      for (let art = 0; art < 5; art += 1) {
        const w = P.art[art];
        if (w < 0.02 || hash01(i * 2.3 + art * 9.1) > 0.62) continue;
        const r = Math.max(26, H * 0.06);
        if (art === 0) {
          // Eine ferne Laterne.
          licht(x + br * 0.2, hoehe, r * 1.5, "warm", 0.5 * w * flackern);
          g.fillStyle = `rgba(255, 220, 160, ${0.9 * w})`;
          g.fillRect(x + br * 0.2 - 1.5, hoehe - 2, 3, 4);
        } else if (art === 1) {
          // Kristalle: drei Splitter, aus einem Punkt gefächert.
          const name = b < 0.5 ? "cyan" : "violett";
          licht(x, hoehe, r * 1.7, name, 0.42 * w);
          g.fillStyle = b < 0.5 ? `rgba(150, 240, 255, ${0.75 * w})` : `rgba(214, 170, 255, ${0.75 * w})`;
          for (let k = -1; k <= 1; k += 1) {
            const lang = r * (0.5 + 0.4 * hash01(i + k * 3.3));
            const wi = -Math.PI / 2 + k * 0.5 + (b - 0.5);
            const dx = Math.cos(wi);
            const dy = Math.sin(wi);
            g.beginPath();
            g.moveTo(x, hoehe);
            g.lineTo(x + dx * lang * 0.5 - dy * 3, hoehe + dy * lang * 0.5 + dx * 3);
            g.lineTo(x + dx * lang, hoehe + dy * lang);
            g.lineTo(x + dx * lang * 0.5 + dy * 3, hoehe + dy * lang * 0.5 - dx * 3);
            g.closePath();
            g.fill();
          }
        } else if (art === 2) {
          // Leuchtpilze in einer Reihe.
          licht(x, hoehe, r * 1.5, "gruen", 0.36 * w * flackern);
          g.fillStyle = `rgba(170, 255, 214, ${0.8 * w})`;
          for (let k = 0; k < 3; k += 1) {
            g.beginPath();
            g.arc(x + (k - 1) * 7, hoehe + k * 5 - 4, 3.2 - k * 0.5, Math.PI, 0);
            g.fill();
          }
        } else if (art === 3) {
          // Ein Faden Glut, der die Säule hinabläuft.
          licht(x, hoehe, r * 2.2, "glut", 0.5 * w * flackern);
          g.fillStyle = `rgba(255, 150, 70, ${0.85 * w})`;
          g.fillRect(x - 1.5, hoehe - r * 0.8, 3, r * 2.6);
        } else {
          // Eine Goldader im Zickzack.
          licht(x, hoehe, r * 1.4, "gold", 0.4 * w * flackern);
          g.strokeStyle = `rgba(255, 220, 130, ${0.8 * w})`;
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(x - 8, hoehe - r * 0.7);
          g.lineTo(x + 5, hoehe - r * 0.2);
          g.lineTo(x - 4, hoehe + r * 0.3);
          g.lineTo(x + 7, hoehe + r * 0.8);
          g.stroke();
        }
        g.fillStyle = farbe;
      }
    }
  }

  // Zacken am oberen und unteren Rand: Fels, der näher ist als die Säulen.
  function fransen(tiefe, farbe, hoch, saat, oben) {
    const W = view.cssW;
    const H = view.cssH;
    const schritt2 = 26;
    const versatz = state.kam.x * view.s * tiefe;
    const i0 = Math.floor(versatz / schritt2) - 1;
    const i1 = Math.ceil((versatz + W) / schritt2) + 1;
    g.fillStyle = farbe;
    g.beginPath();
    g.moveTo(i0 * schritt2 - versatz, oben ? -4 : H + 4);
    for (let i = i0; i <= i1; i += 1) {
      let h = hoch * (0.25 + 0.75 * rauschen(i * 0.23, saat));
      if (hash01(i * 1.9 + saat) < 0.2) h += hoch * 0.7 * hash01(i * 4.1 + saat);
      g.lineTo(i * schritt2 - versatz, oben ? h : H - h);
    }
    g.lineTo(i1 * schritt2 - versatz, oben ? -4 : H + 4);
    g.closePath();
    g.fill();
  }

  // Der Grund des Bildes – der Verlauf und zwei weite Schimmer in der
  // Tiefe der Höhle – ändert sich nur mit dem Revier. Er wird klein gemalt
  // und für jedes Bild bloss gestreckt: Weiche Flächen sieht man die Grösse
  // nicht an, und so kostet der Hintergrund fast nichts.
  function himmelBild(P) {
    const stufe = (c) => `${Math.round(c[0] / 3)},${Math.round(c[1] / 3)},${Math.round(c[2] / 3)}`;
    const schluessel = `${stufe(P.oben)}|${stufe(P.mitte)}|${stufe(P.unten)}|${P.leucht}|${P.leucht2}|${view.cssW}x${view.cssH}`;
    if (hintergrundAlt && hintergrundAlt.schluessel === schluessel) return hintergrundAlt.bild;
    const bild = hintergrundAlt?.bild || document.createElement("canvas");
    const w = Math.max(48, Math.round(view.cssW / 5));
    const h = Math.max(48, Math.round(view.cssH / 5));
    bild.width = w;
    bild.height = h;
    const q = bild.getContext("2d");
    const v = q.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, rgb(P.oben));
    v.addColorStop(0.48, rgb(P.mitte));
    v.addColorStop(1, rgb(P.unten));
    q.fillStyle = v;
    q.fillRect(0, 0, w, h);
    const gross = Math.max(w, h);
    q.globalAlpha = 0.22;
    q.drawImage(scheinBild(P.leucht), w * 0.28 - gross * 0.55, h * 0.3 - gross * 0.55, gross * 1.1, gross * 1.1);
    q.drawImage(scheinBild(P.leucht2), w * 0.82 - gross * 0.6, h * 0.68 - gross * 0.6, gross * 1.2, gross * 1.2);
    hintergrundAlt = { schluessel, bild };
    return bild;
  }

  function zeichneHintergrund(P) {
    const W = view.cssW;
    const H = view.cssH;
    g.drawImage(himmelBild(P), 0, 0, W, H);
    const gross = Math.max(W, H);

    saeulen(P, 0.1, rgb(P.fern), gross * 0.33, 11, true);
    // Der See, die Glut: ein leuchtendes Band am Grund.
    const band = P.art[2] + P.art[3];
    if (band > 0.02) {
      const oben = H * 0.8 + ((state.kam.y * view.s * 0.03) % 30);
      const farbe = P.art[3] > P.art[2] ? [255, 110, 40] : [80, 255, 190];
      const v = g.createLinearGradient(0, oben, 0, H);
      v.addColorStop(0, rgba(farbe, 0));
      v.addColorStop(0.25, rgba(farbe, 0.2 * band));
      v.addColorStop(1, rgba(farbe, 0.42 * band));
      g.fillStyle = v;
      g.fillRect(0, oben, W, H - oben);
      g.fillStyle = rgba(farbe, 0.32 * band);
      for (let n = 0; n < 9; n += 1) {
        const breite = W + 200;
        const x = ((hash01(n * 3.7) * breite - state.kam.x * view.s * (0.12 + 0.02 * n)) % breite + breite) % breite - 100;
        const y = oben + (H - oben) * (0.3 + 0.07 * n);
        g.fillRect(x, y, 40 + 90 * hash01(n * 1.3), 2);
      }
    }
    saeulen(P, 0.26, rgb(P.mittel), gross * 0.47, 23, false);
    fransen(0.34, rgb(P.mittel), H * 0.07, 3, true);
    fransen(0.34, rgb(P.mittel), H * 0.06, 9, false);
  }

  // Was in der Luft hängt: Staub, Funkeln, Sporen, Glut – je nach Revier.
  function zeichneSchwebendes(P) {
    if (ruhig()) return;
    const W = view.cssW;
    const H = view.cssH;
    const t = state.zeit;
    for (let i = 0; i < 34; i += 1) {
      const a = hash01(i * 12.9);
      const b = hash01(i * 4.3 + 2);
      const breite = W + 60;
      const steigt = P.art[3] > 0.5 ? 26 + 30 * a : (b - 0.5) * 10;
      const x = ((a * breite - state.kam.x * view.s * (0.5 + 0.4 * b) + Math.sin(t * 0.7 + i) * 12) % breite + breite) % breite - 30;
      const y = (((b * H - t * steigt) % H) + H) % H;
      const blink = 0.5 + 0.5 * Math.sin(t * (1.5 + 2 * a) + i * 1.7);
      if (P.art[3] > 0.5) g.fillStyle = `rgba(255, ${150 + 80 * a | 0}, 70, ${0.25 + 0.5 * blink})`;
      else if (P.art[1] > 0.5) g.fillStyle = `rgba(190, 240, 255, ${0.12 + 0.5 * blink * blink})`;
      else if (P.art[2] > 0.5) g.fillStyle = `rgba(170, 255, 210, ${0.12 + 0.35 * blink})`;
      else if (P.art[4] > 0.5) g.fillStyle = `rgba(255, 224, 140, ${0.12 + 0.5 * blink * blink})`;
      else g.fillStyle = `rgba(255, 226, 190, ${0.1 + 0.16 * blink})`;
      const r = 1 + 1.4 * b;
      g.fillRect(x, y, r, r);
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Fels, Gleis und was daran steht
  // ---------------------------------------------------------------------------
  // Wie dick der Fels unter dem Boden ist – nur fürs Bild. Im Stollen und
  // unter einem Gerüst ist er massiv (99). Im Saal ist er ein Sims, unter dem
  // die Höhle weitergeht, hier und da von einer Säule getragen; neben einem
  // Schacht steht immer eine Wand.
  function felsDicke(W, j, schaechte) {
    if (W.saal[j] < 0.5 || W.tiefe[j] > 2) return 99;
    const X = W.rx0 + j * RX;
    for (let n = 0; n < schaechte.length; n += 2) if (X > schaechte[n] - 6 && X < schaechte[n + 1] + 6) return 99;
    const saeule = rauschen(j * 0.019, 9);
    if (saeule > 0.8) return 99;
    let d = 1.3 + 2.4 * rauschen(j * 0.08, 7) + Math.max(0, (saeule - 0.6) / 0.2) ** 2 * 7;
    if (hash01(j * 3.9 + 1) < 0.15) d += 0.5 + 1.9 * hash01(j * 6.1);
    return d;
  }

  /*
   * Der Fels. Im Stollen sieht man wie in einen Schnitt hinein: unten und
   * oben der Fels, dazwischen die Rückwand des Stollens mit seinem Ausbau
   * aus Holz. Im Saal fehlt die Rückwand – dahinter liegt die Höhle –, und
   * der Boden ist ein Sims mit Zapfen an der Unterseite.
   */
  const schaechteImBild = [];
  function zeichneFels(P) {
    const W = state.welt;
    const H = view.cssH;
    const B = view.cssW;
    const j0 = clamp(Math.floor((wx(0) - W.rx0) / RX) - 1, 0, W.boden.length - 1);
    const j1 = clamp(Math.ceil((wx(B) - W.rx0) / RX) + 1, 0, W.boden.length - 1);
    if (j1 - j0 < 1) return;
    const z = view.z;
    const xVon = (j) => sx(W.rx0 + j * RX);
    schaechteImBild.length = 0;
    for (const h of W.stellen) {
      if (h.s1 < state.z.s - 90) continue;
      if (h.sFrei > state.z.s + 130) break;
      if (h.art === "schacht") schaechteImBild.push(gleisBei(W, h.kante).x, gleisBei(W, h.drueben).x);
    }

    // Die Rückwand des Stollens: dunkler Fels zwischen Boden und Decke.
    let von = -1;
    g.fillStyle = rgb([lerp(P.tief[0], P.fels[0], 0.36), lerp(P.tief[1], P.fels[1], 0.36), lerp(P.tief[2], P.fels[2], 0.36)]);
    for (let j = j0; j <= j1 + 1; j += 1) {
      const wand = j <= j1 && W.saal[j] < 0.5;
      if (wand && von < 0) von = j;
      if (!wand && von >= 0) {
        g.beginPath();
        g.moveTo(xVon(von), sy(W.boden[von]));
        for (let k = von + 1; k < j; k += 1) g.lineTo(xVon(k), sy(W.boden[k]));
        for (let k = j - 1; k >= von; k -= 1) g.lineTo(xVon(k), sy(W.decke[k]));
        g.closePath();
        g.fill();
        von = -1;
      }
    }
    // Der Ausbau: alle vier Meter ein Stempel mit Kappe und Kopfband,
    // dazwischen ein Brett unter der Decke.
    const holz = new Path2D();
    const kanten = new Path2D();
    let vorX = 0;
    let vorY = 0;
    let vorDa = false;
    for (let x = Math.ceil(wx(-40) / 4) * 4; x < wx(B + 40); x += 4) {
      const j = Math.round((x - W.rx0) / RX);
      const da = j > 0 && j < W.boden.length && W.saal[j] < 0.5 && W.glatt[j] === 0 && W.decke[j] - W.boden[j] > 4.5 && W.tiefe[j] < 2;
      const px = sx(x);
      const oben = da ? sy(W.decke[j] - 0.25) : 0;
      if (da) {
        const unten = sy(W.boden[j]);
        const b = z * 0.16;
        holz.rect(px - b, oben, b * 2, unten - oben);
        holz.rect(px - z * 0.5, oben - z * 0.08, z, z * 0.34);
        kanten.moveTo(px - b, oben + z * 0.3); kanten.lineTo(px - b, unten);
        kanten.moveTo(px + z * 0.95, oben + z * 0.2); kanten.lineTo(px + b, oben + z * 1.2);
        kanten.moveTo(px - z * 0.5, oben - z * 0.08); kanten.lineTo(px + z * 0.5, oben - z * 0.08);
        if (vorDa) { kanten.moveTo(vorX, vorY + z * 0.42); kanten.lineTo(px, oben + z * 0.42); }
      }
      vorX = px; vorY = oben; vorDa = da;
    }
    g.fillStyle = "#553a26";
    g.fill(holz);
    g.strokeStyle = "rgba(186, 132, 84, 0.7)";
    g.lineWidth = Math.max(1, z * 0.07);
    g.lineCap = "butt";
    g.stroke(kanten);

    for (const oben of [false, true]) {
      const liste = oben ? W.decke : W.boden;
      const rand = oben ? -6 : H + 6;
      const kante = new Path2D();
      kante.moveTo(xVon(j0), sy(liste[j0]));
      for (let j = j0 + 1; j <= j1; j += 1) kante.lineTo(xVon(j), sy(liste[j]));
      const flaeche = new Path2D(kante);
      let unterkante = null;
      if (oben) {
        flaeche.lineTo(xVon(j1), rand);
        flaeche.lineTo(xVon(j0), rand);
      } else {
        // Zurück an der Unterseite entlang: ein Sims, wo der Fels dünn ist.
        unterkante = new Path2D();
        let offen = false;
        for (let j = j1; j >= j0; j -= 1) {
          const d = felsDicke(W, j, schaechteImBild);
          const y = d > 60 ? rand : Math.min(rand, sy(W.boden[j] - d));
          flaeche.lineTo(xVon(j), y);
          if (d > 60) offen = false;
          else if (!offen) { unterkante.moveTo(xVon(j), y); offen = true; } else unterkante.lineTo(xVon(j), y);
        }
      }
      flaeche.closePath();
      // Hell an der Kante, dunkel in der Tiefe.
      const mitte = sy(state.kam.y + (oben ? 5 : -1.5));
      const v = g.createLinearGradient(0, mitte, 0, mitte + (oben ? -1 : 1) * 9 * z);
      v.addColorStop(0, rgb(P.fels));
      v.addColorStop(1, rgb(P.tief));
      g.fillStyle = v;
      g.fill(flaeche);
      // Lagen im Fels: dieselbe Linie, ein paarmal in die Tiefe versetzt –
      // am Boden nur so weit, wie auch der dünnste Sims dick ist.
      g.save();
      g.lineJoin = "round";
      for (let n = 1; n <= (oben ? 3 : 2); n += 1) {
        g.translate(0, (oben ? -1 : 1) * z * (oben ? 0.45 + n * 0.45 : 0.42));
        g.strokeStyle = n % 2 ? "rgba(0, 0, 0, 0.22)" : rgba(P.kante, 0.08);
        g.lineWidth = Math.max(1, z * 0.16);
        g.stroke(kante);
      }
      g.restore();
      if (unterkante) {
        g.strokeStyle = "rgba(0, 0, 0, 0.5)";
        g.lineWidth = Math.max(2, z * 0.22);
        g.stroke(unterkante);
        g.strokeStyle = rgba(P.kante, 0.22);
        g.lineWidth = Math.max(1, z * 0.05);
        g.stroke(unterkante);
      }
      // Die Kante: breit und blass, darüber schmal und hell.
      g.lineJoin = "round";
      g.strokeStyle = rgba(P.kante, 0.18);
      g.lineWidth = Math.max(3, z * 0.3);
      g.stroke(kante);
      g.strokeStyle = rgba(P.kante, 0.75);
      g.lineWidth = Math.max(1, z * 0.07);
      g.stroke(kante);
    }

    // Das Felsdach hinter einer Kuppe: rot-weiss gestreift, damit man es
    // kommen sieht.
    von = -1;
    for (let j = j0; j <= j1 + 1; j += 1) {
      const dach = j <= j1 && W.glatt[j] === 2;
      if (dach && von < 0) von = j;
      if (!dach && von >= 0) {
        const streifen = new Path2D();
        streifen.moveTo(xVon(von), sy(W.decke[von]));
        for (let k = von + 1; k < j; k += 1) streifen.lineTo(xVon(k), sy(W.decke[k]));
        g.lineCap = "butt";
        g.save();
        g.translate(0, -Math.max(1.5, z * 0.16));
        g.strokeStyle = "#f4efe6";
        g.lineWidth = Math.max(3, z * 0.32);
        g.stroke(streifen);
        g.strokeStyle = "#e23b2e";
        g.setLineDash([z * 0.55, z * 0.55]);
        g.stroke(streifen);
        g.setLineDash([]);
        g.restore();
        licht(xVon(von), sy(W.decke[von]), z * 2.8, "rot", 0.55 + 0.3 * Math.sin(state.zeit * 9));
        von = -1;
      }
    }

    // Alte Gänge im massiven Fels: Unter und über dem Stollen laufen
    // verlassene Strecken mit, ausgebaut und hier und da noch beleuchtet –
    // man schaut in ein ganzes Bergwerk hinein.
    const wandFarbe = rgb([lerp(P.tief[0], P.fels[0], 0.2), lerp(P.tief[1], P.fels[1], 0.2), lerp(P.tief[2], P.fels[2], 0.2)]);
    const gang = (versatz, hoehe, saat) => {
      const fuss = (k) => W.boden[k] + W.tiefe[k] + versatz + 0.9 * rauschen(k * 0.045, saat);
      let ab = -1;
      for (let j = j0; j <= j1 + 1; j += 1) {
        const da = j <= j1 && W.saal[j] < 0.42 && W.tiefe[j] < 2 && rauschen(j * 0.012, saat + 3) > 0.34;
        if (da && ab < 0) ab = j;
        if (da || ab < 0) continue;
        if (j - ab > 10) {
          const oberkante = new Path2D();
          g.beginPath();
          g.moveTo(xVon(ab), sy(fuss(ab)));
          for (let k = ab + 1; k < j; k += 1) g.lineTo(xVon(k), sy(fuss(k)));
          for (let k = j - 1; k >= ab; k -= 1) {
            const y = sy(fuss(k) + hoehe + 0.35 * rauschen(k * 0.4, saat + 1));
            g.lineTo(xVon(k), y);
            if (k === j - 1) oberkante.moveTo(xVon(k), y); else oberkante.lineTo(xVon(k), y);
          }
          g.closePath();
          g.fillStyle = wandFarbe;
          g.fill();
          g.strokeStyle = "rgba(0, 0, 0, 0.45)";
          g.lineWidth = Math.max(1.5, z * 0.16);
          g.stroke(oberkante);
          // Stempel alle vier Meter, alle sechzehn eine Laterne.
          g.strokeStyle = "#2c1d13";
          g.lineWidth = Math.max(1.5, z * 0.2);
          g.beginPath();
          for (let x = Math.ceil((W.rx0 + ab * RX) / 4) * 4; x < W.rx0 + (j - 1) * RX; x += 4) {
            const k = Math.round((x - W.rx0) / RX);
            const px = sx(x);
            const unten = sy(fuss(k));
            g.moveTo(px, unten);
            g.lineTo(px, unten - hoehe * z);
            if (Math.round(x / 4) % 4 === (saat % 4)) {
              const flackern = 0.8 + 0.2 * Math.sin(state.zeit * 9 + x);
              licht(px + z * 0.5, unten - hoehe * z * 0.62, z * 4.2, P.leucht, 0.4 * flackern);
              g.fillStyle = "#ffe2a6";
              g.fillRect(px + z * 0.42, unten - hoehe * z * 0.72, z * 0.16, z * 0.24);
            }
          }
          g.stroke();
        }
        ab = -1;
      }
    };
    gang(-9.4, 2.6, 41);
    gang(-17.2, 2.4, 44);
    gang(11.2, 2.4, 47);
    if (view.hoch) { gang(-25.5, 2.6, 49); gang(18.6, 2.4, 52); }

    // Erz im massiven Fels: kleine Nester aus drei Splittern, die im Dunkeln
    // glimmen – auf einem festen Gitter in der Welt.
    const GITTER = 4.5;
    const y0 = state.kam.y + (view.mitteY - H) / z;
    const y1 = state.kam.y + view.mitteY / z;
    for (let gx = Math.floor(wx(0) / GITTER); gx <= Math.floor(wx(B) / GITTER); gx += 1) {
      for (let gy = Math.floor(y0 / GITTER); gy <= Math.floor(y1 / GITTER); gy += 1) {
        const a = hash01(gx * 12.7 + gy * 31.3);
        if (a > 0.24) continue;
        const b = hash01(gx * 5.1 + gy * 17.9 + 3);
        const x = (gx + 0.2 + 0.6 * b) * GITTER;
        const y = (gy + 0.2 + 0.6 * hash01(gx * 9.3 + gy * 2.1)) * GITTER;
        const j = Math.round((x - W.rx0) / RX);
        if (j < 2 || j >= W.boden.length - 2) continue;
        const imBoden = y < W.boden[j] - 1.6 && W.tiefe[j] < 30 && felsDicke(W, j, schaechteImBild) > 60;
        const inDecke = y > W.decke[j] + 1.6;
        if (!imBoden && !inDecke) continue;
        const px = sx(x);
        const py = sy(y);
        const gross = z * (0.16 + 0.2 * b);
        const glimmt = 0.55 + 0.3 * Math.sin(state.zeit * (1 + 2 * b) + gx * 1.7);
        g.fillStyle = rgba(P.kante, glimmt);
        for (let k = 0; k < 3; k += 1) {
          const ox = (hash01(gx + k * 3.7 + gy) - 0.5) * gross * 4.5;
          const oy = (hash01(gy + k * 5.3 + gx) - 0.5) * gross * 3;
          const r = gross * (0.7 + 0.6 * hash01(k + gx * 0.7));
          g.beginPath();
          g.moveTo(px + ox, py + oy - r);
          g.lineTo(px + ox + r * 0.6, py + oy);
          g.lineTo(px + ox, py + oy + r);
          g.lineTo(px + ox - r * 0.6, py + oy);
          g.closePath();
          g.fill();
        }
        licht(px, py, gross * 9, a < 0.12 ? P.leucht : P.leucht2, 0.26 * glimmt);
      }
    }

    // Was aus dem Fels wächst: Kristalle, Pilze, Glut – am Boden und an der Decke.
    for (let j = j0; j <= j1; j += 1) {
      const a = hash01(j * 1.93 + 0.7);
      if (a > 0.085 || W.glatt[j]) continue;
      const x = xVon(j);
      const b = hash01(j * 5.3);
      const unten = b < 0.62;
      if (unten && W.tiefe[j] > 30) continue;
      const y = sy(unten ? W.boden[j] : W.decke[j]);
      const hin = unten ? -1 : 1;
      const gross = z * (0.35 + 0.5 * hash01(j * 2.7));
      if (P.art[1] > 0.5 || (P.art[4] > 0.5 && b > 0.4)) {
        const gold = P.art[4] > 0.5;
        g.fillStyle = gold ? "rgba(255, 220, 130, 0.9)" : b < 0.4 ? "rgba(150, 240, 255, 0.85)" : "rgba(214, 170, 255, 0.85)";
        for (let k = -1; k <= 1; k += 1) {
          const lang = gross * (1 + 0.5 * hash01(j + k * 3.1));
          const wi = (hin < 0 ? -Math.PI / 2 : Math.PI / 2) + k * 0.45;
          const dx = Math.cos(wi);
          const dy = Math.sin(wi);
          g.beginPath();
          g.moveTo(x - dy * gross * 0.16, y + dx * gross * 0.16);
          g.lineTo(x + dx * lang, y + dy * lang);
          g.lineTo(x + dy * gross * 0.16, y - dx * gross * 0.16);
          g.closePath();
          g.fill();
        }
        licht(x, y + hin * gross * 0.6, gross * 3.4, gold ? "gold" : b < 0.4 ? "cyan" : "violett", 0.5);
      } else if (P.art[2] > 0.5 && unten) {
        g.fillStyle = "rgba(170, 255, 214, 0.9)";
        for (let k = 0; k < 3; k += 1) {
          const px = x + (k - 1) * gross * 0.5;
          const hoch = gross * (0.5 + 0.3 * hash01(j + k));
          g.fillRect(px - 1, y - hoch, 2, hoch);
          g.beginPath();
          g.arc(px, y - hoch, gross * 0.22, Math.PI, 0);
          g.fill();
        }
        licht(x, y - gross * 0.5, gross * 3, "gruen", 0.45);
      } else if (P.art[3] > 0.5) {
        g.fillStyle = `rgba(255, 140, 60, ${0.6 + 0.3 * Math.sin(state.zeit * 3 + j)})`;
        g.beginPath();
        g.ellipse(x, y - hin * 2, gross * 0.5, gross * 0.14, 0, 0, TAU);
        g.fill();
        licht(x, y, gross * 2.6, "glut", 0.45);
      } else if (unten) {
        // Im alten Stollen liegt, was liegen blieb: Steine, ein Fass, eine Kiste.
        if (b < 0.2 && W.tiefe[j] < 2) {
          g.fillStyle = "#5a3d28";
          g.fillRect(x - gross * 0.5, y - gross * 1.0, gross, gross);
          g.strokeStyle = "#2a1c12";
          g.lineWidth = Math.max(1, gross * 0.1);
          g.strokeRect(x - gross * 0.5, y - gross * 1.0, gross, gross);
          g.beginPath();
          g.moveTo(x - gross * 0.5, y - gross * 1.0); g.lineTo(x + gross * 0.5, y);
          g.stroke();
        } else {
          g.fillStyle = "rgba(0, 0, 0, 0.3)";
          g.beginPath();
          g.ellipse(x, y - gross * 0.1, gross * 0.5, gross * 0.24, 0, 0, TAU);
          g.fill();
        }
      }
    }
  }

  // Die Gerüste: Wo der Boden tief unter dem Gleis liegt, tragen es Böcke
  // aus Holz – Pfosten alle vier Meter, dazwischen Kreuze.
  function zeichneGerueste(i0, i1) {
    const W = state.welt;
    const z = view.z;
    const H = view.cssH;
    const dunkel = new Path2D();
    const erster = Math.ceil(i0 / 16) * 16;
    let vorX = 0;
    let vorY = 0;
    let vorTief = 0;
    for (let i = erster; i <= i1; i += 16) {
      const art = W.art[i];
      const x = W.x[i];
      const y = W.y[i];
      const tief = art === SCHIENE || art === KNICK ? y - bodenBei(W, x) : 0;
      if (tief > 1.2 && W.art[Math.min(W.n - 1, i + 1)] !== LUECKE) {
        const px = sx(x);
        const py = sy(y - 0.2);
        const unten = Math.min(H + 20, sy(y - tief));
        dunkel.moveTo(px, py);
        dunkel.lineTo(px, unten);
        if (vorTief > 1.2) {
          // Kreuze zum Pfosten davor, drei Meter hoch, bis in die Tiefe.
          const lagen = Math.min(4, Math.floor(Math.min(tief, vorTief) / 3));
          for (let n = 0; n < lagen; n += 1) {
            const a = sy(vorY - 0.4 - n * 3);
            const b = sy(y - 0.4 - n * 3);
            const a2 = sy(vorY - 3.2 - n * 3);
            const b2 = sy(y - 3.2 - n * 3);
            dunkel.moveTo(sx(vorX), a); dunkel.lineTo(px, b2);
            dunkel.moveTo(sx(vorX), a2); dunkel.lineTo(px, b);
            dunkel.moveTo(sx(vorX), a2); dunkel.lineTo(px, b2);
          }
        }
      }
      vorX = x; vorY = y; vorTief = tief;
    }
    g.lineCap = "butt";
    g.strokeStyle = "#2c1d13";
    g.lineWidth = Math.max(2, z * 0.24);
    g.stroke(dunkel);
    g.strokeStyle = "rgba(150, 104, 66, 0.55)";
    g.lineWidth = Math.max(1, z * 0.07);
    g.stroke(dunkel);
  }

  // Das Gleis: Schwellen, darauf die Schiene mit einem hellen Strich.
  function zeichneGleis(i0, i1) {
    const W = state.welt;
    const z = view.z;
    // Schwellen, jeden Meter – in der Senke rot, damit man sie kommen sieht.
    const holz = new Path2D();
    const rot = new Path2D();
    for (let i = Math.ceil(i0 / 4) * 4; i <= i1; i += 4) {
      if (W.art[i] === LUECKE) continue;
      const c = Math.cos(W.w[i]);
      const s = Math.sin(W.w[i]);
      const px = sx(W.x[i]);
      const py = sy(W.y[i]);
      const a = 0.16 * z;
      const t = 0.22 * z;
      const ziel = W.art[i] === KNICK ? rot : holz;
      ziel.moveTo(px - c * a + s * 0.04 * z, py + s * a + c * 0.04 * z);
      ziel.lineTo(px + c * a + s * 0.04 * z, py - s * a + c * 0.04 * z);
      ziel.lineTo(px + c * a + s * t, py - s * a + c * t);
      ziel.lineTo(px - c * a + s * t, py + s * a + c * t);
      ziel.closePath();
    }
    g.fillStyle = "#4a3222";
    g.fill(holz);
    g.fillStyle = "#d4443a";
    g.fill(rot);

    const schiene = new Path2D();
    const glanz = new Path2D();
    let offen = false;
    for (let i = i0; i <= i1; i += 1) {
      if (W.art[i] === LUECKE && i > i0) { offen = false; continue; }
      const px = sx(W.x[i]);
      const py = sy(W.y[i]);
      const nx = -Math.sin(W.w[i]) * 0.05 * z;
      const ny = Math.cos(W.w[i]) * 0.05 * z;
      if (!offen) { schiene.moveTo(px, py); glanz.moveTo(px + nx, py - ny); offen = true; }
      else { schiene.lineTo(px, py); glanz.lineTo(px + nx, py - ny); }
    }
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = "#1c2028";
    g.lineWidth = Math.max(2.4, z * 0.17);
    g.stroke(schiene);
    g.strokeStyle = "#a9b6c9";
    g.lineWidth = Math.max(1, z * 0.055);
    g.stroke(glanz);
  }

  // Eine Laterne: von der Decke am Faden oder auf einem Pfosten.
  function laterne(px, py, gross, haengt, von) {
    g.strokeStyle = "#20160f";
    g.lineWidth = Math.max(1, gross * 0.12);
    g.beginPath();
    g.moveTo(px, von);
    g.lineTo(px, py);
    g.stroke();
    g.fillStyle = "#2a1c12";
    g.fillRect(px - gross * 0.32, py - gross * (haengt ? 0 : 0.9), gross * 0.64, gross * 0.9);
    g.fillStyle = "#ffe2a6";
    const oben = py - gross * (haengt ? -0.14 : 0.76);
    g.fillRect(px - gross * 0.2, oben, gross * 0.4, gross * 0.62);
    const flackern = 0.8 + 0.2 * Math.sin(state.zeit * 11 + px * 0.01) * Math.sin(state.zeit * 5.3 + px);
    licht(px, oben + gross * 0.3, gross * 6.4, "warm", 0.66 * flackern);
  }

  function zeichneLaternen(i0, i1) {
    const W = state.welt;
    const z = view.z;
    for (let i = Math.ceil((i0 - 32) / 72) * 72 + 32; i <= i1; i += 72) {
      if (i < 1 || i >= W.n || W.art[i] !== SCHIENE) continue;
      const x = W.x[i];
      const y = W.y[i];
      const j = clamp(Math.round((x - W.rx0) / RX), 0, W.decke.length - 1);
      if (W.glatt[j]) continue;
      const frei = W.decke[j] - y;
      if (frei < 4.6) continue;
      if (frei < 9.5) laterne(sx(x), sy(W.decke[j] - Math.min(1.6, frei - 3.4)), z * 0.5, true, sy(W.decke[j]));
      else if (y - W.boden[j] < 1.2) laterne(sx(x), sy(y + 2.7), z * 0.5, false, sy(y - 0.3));
    }
  }

  // Ein Signal vor jeder Stelle: ein Pfosten mit Lampe und Tafel.
  const SIGNAL_FARBE = { rot: "#ff4b3e", gruen: "#4dff8f", gelb: "#ffd23f" };
  function zeichneSignale() {
    const W = state.welt;
    const z = view.z;
    for (const sig of W.signale) {
      const o = gleisBei(W, sig.s);
      const px = sx(o.x);
      if (px < -60 || px > view.cssW + 60) continue;
      const fuss = sy(o.y - 0.2);
      const kopf = sy(o.y + 3.1);
      const art = sig.stelle.signal;
      const farbe = SIGNAL_FARBE[art];
      g.strokeStyle = "#1b1410";
      g.lineWidth = Math.max(2, z * 0.14);
      g.beginPath();
      g.moveTo(px, fuss);
      g.lineTo(px, kopf);
      g.stroke();
      // Die Tafel: was zu tun ist, als Zeichen.
      const t = z * 0.46;
      const ty = kopf + z * 1.05;
      g.fillStyle = "#14100d";
      g.beginPath();
      if (g.roundRect) g.roundRect(px - t, ty - t, t * 2, t * 2, t * 0.3); else g.rect(px - t, ty - t, t * 2, t * 2);
      g.fill();
      g.strokeStyle = farbe;
      g.fillStyle = farbe;
      g.lineWidth = Math.max(1.5, z * 0.11);
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      if (art === "rot") {
        // Ein Balken: langsam.
        g.moveTo(px - t * 0.55, ty);
        g.lineTo(px + t * 0.55, ty);
      } else if (art === "gruen") {
        // Zwei Pfeilspitzen: laufen lassen.
        g.moveTo(px - t * 0.5, ty - t * 0.45); g.lineTo(px - t * 0.05, ty); g.lineTo(px - t * 0.5, ty + t * 0.45);
        g.moveTo(px + t * 0.05, ty - t * 0.45); g.lineTo(px + t * 0.5, ty); g.lineTo(px + t * 0.05, ty + t * 0.45);
      } else {
        // Auf und ab: im Takt.
        g.moveTo(px, ty - t * 0.55); g.lineTo(px, ty + t * 0.55);
        g.moveTo(px - t * 0.3, ty - t * 0.25); g.lineTo(px, ty - t * 0.55); g.lineTo(px + t * 0.3, ty - t * 0.25);
        g.moveTo(px - t * 0.3, ty + t * 0.25); g.lineTo(px, ty + t * 0.55); g.lineTo(px + t * 0.3, ty + t * 0.25);
      }
      g.stroke();
      // Die Lampe: Gelb blinkt.
      const an = art === "gelb" ? 0.35 + 0.65 * (Math.sin(state.zeit * 7) > 0 ? 1 : 0) : 1;
      g.fillStyle = "#14100d";
      g.beginPath();
      g.arc(px, kopf, z * 0.34, 0, TAU);
      g.fill();
      g.globalAlpha = 0.35 + 0.65 * an;
      g.fillStyle = farbe;
      g.beginPath();
      g.arc(px, kopf, z * 0.22, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
      licht(px, kopf, z * 3.2, art, 0.85 * an);
    }
  }

  // Die Stampfer des Pochwerks: oben das Getriebe, daran der Schaft, unten
  // der Kopf aus Eisen.
  function zeichneStampfer() {
    const W = state.welt;
    const z = view.z;
    for (const st of W.stampfer) {
      const px = sx(st.x);
      if (px < -80 || px > view.cssW + 80) continue;
      const hoch = stampfHoehe(st, state.z.t);
      const kopfUnten = sy(st.y + hoch);
      const kopfOben = sy(st.y + hoch + 1.15);
      const dach = sy(st.y + S_OBEN + 2.3);
      const b = S_BREIT * z;
      // Führung: zwei Schienen hinab bis über das Gleis.
      g.strokeStyle = "#241a13";
      g.lineWidth = Math.max(2, z * 0.14);
      g.beginPath();
      g.moveTo(px - b * 1.25, dach); g.lineTo(px - b * 1.25, sy(st.y + S_FREI + 0.5));
      g.moveTo(px + b * 1.25, dach); g.lineTo(px + b * 1.25, sy(st.y + S_FREI + 0.5));
      g.stroke();
      // Schaft.
      g.fillStyle = "#6b4a30";
      g.fillRect(px - b * 0.32, dach, b * 0.64, kopfOben - dach);
      g.fillStyle = "rgba(0, 0, 0, 0.25)";
      g.fillRect(px + b * 0.05, dach, b * 0.27, kopfOben - dach);
      // Getriebe: ein Kasten mit Rad, das sich im Takt dreht.
      g.fillStyle = "#2c2019";
      g.fillRect(px - b * 1.7, dach - z * 1.3, b * 3.4, z * 1.3);
      g.strokeStyle = "#8a5a36";
      g.lineWidth = Math.max(1, z * 0.08);
      g.strokeRect(px - b * 1.7, dach - z * 1.3, b * 3.4, z * 1.3);
      // Ein Zahnrad, das sich im Takt dreht.
      const dreh = ((state.z.t + st.aus) / st.T) * TAU;
      const rad = z * 0.4;
      const radY = dach - z * 0.65;
      g.fillStyle = "#8a93a3";
      g.beginPath();
      for (let k = 0; k < 16; k += 1) {
        const wi = dreh + (k / 16) * TAU;
        const r = k % 2 ? rad : rad * 0.76;
        if (k) g.lineTo(px + Math.cos(wi) * r, radY + Math.sin(wi) * r); else g.moveTo(px + Math.cos(wi) * r, radY + Math.sin(wi) * r);
      }
      g.closePath();
      g.fill();
      g.fillStyle = "#2c2019";
      g.beginPath();
      g.arc(px, radY, rad * 0.3, 0, TAU);
      g.fill();
      // Kopf: schweres Eisen, unten gestreift.
      const v = g.createLinearGradient(px - b, 0, px + b, 0);
      v.addColorStop(0, "#4a515e");
      v.addColorStop(0.4, "#7f8999");
      v.addColorStop(1, "#2b3039");
      g.fillStyle = v;
      g.fillRect(px - b, kopfOben, b * 2, kopfUnten - kopfOben);
      g.fillStyle = "rgba(0, 0, 0, 0.28)";
      g.fillRect(px - b, kopfOben, b * 2, z * 0.14);
      g.fillStyle = "#f4c21f";
      g.fillRect(px - b, kopfUnten - z * 0.26, b * 2, z * 0.26);
      g.fillStyle = "#1c1c20";
      for (let k = 0; k < 4; k += 1) {
        g.beginPath();
        g.moveTo(px - b + (k * 0.5 + 0.1) * b, kopfUnten);
        g.lineTo(px - b + (k * 0.5 + 0.32) * b, kopfUnten);
        g.lineTo(px - b + (k * 0.5 + 0.5) * b, kopfUnten - z * 0.26);
        g.lineTo(px - b + (k * 0.5 + 0.28) * b, kopfUnten - z * 0.26);
        g.closePath();
        g.fill();
      }
      g.fillStyle = "rgba(190, 200, 215, 0.7)";
      g.beginPath();
      g.arc(px - b * 0.55, kopfOben + z * 0.38, z * 0.06, 0, TAU);
      g.arc(px + b * 0.55, kopfOben + z * 0.38, z * 0.06, 0, TAU);
      g.fill();
      // Kurz bevor er fällt, glüht die Lampe am Getriebe.
      const gleich = stampfHoehe(st, state.z.t + 0.3) < S_FREI;
      licht(px, dach - z * 1.3, z * 2.4, gleich ? "rot" : "gelb", gleich ? 0.9 : 0.4);
    }
  }

  // Was sonst am Gleis steht: abgebrochene Schienen am Schacht, das Gerüst
  // des Loopings, Tafeln alle hundert Meter und die Marken der Gegner.
  function zeichneStellen() {
    const W = state.welt;
    const z = view.z;
    for (const h of W.stellen) {
      if (h.s1 < state.z.s - 60) continue;
      if (h.sFrei > state.z.s + 90) break;
      if (h.art === "schacht") {
        // Verbogene Schienenstümpfe an beiden Kanten, Licht aus der Tiefe.
        const a = gleisBei(W, h.kante);
        const ax = sx(a.x);
        const ay = sy(a.y);
        const aw = a.w;
        const b = gleisBei(W, h.drueben + 0.3);
        const bx = sx(b.x);
        const by = sy(b.y);
        g.strokeStyle = "#1c2028";
        g.lineWidth = Math.max(2.4, z * 0.17);
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(ax, ay);
        g.quadraticCurveTo(ax + Math.cos(aw) * z * 0.7, ay - Math.sin(aw) * z * 0.7, ax + z * 0.9, ay + z * 0.75);
        g.moveTo(bx, by);
        g.quadraticCurveTo(bx - z * 0.6, by + z * 0.1, bx - z * 0.7, by + z * 0.8);
        g.stroke();
        // Die Warnbake vor der Kante.
        const v = gleisBei(W, h.kante - 2.2);
        const vx = sx(v.x);
        const vy = sy(v.y);
        g.strokeStyle = "#1b1410";
        g.lineWidth = Math.max(2, z * 0.12);
        g.beginPath();
        g.moveTo(vx, vy + z * 0.2);
        g.lineTo(vx, vy - z * 1.5);
        g.stroke();
        g.fillStyle = "#f4c21f";
        g.fillRect(vx - z * 0.45, vy - z * 2.0, z * 0.9, z * 0.6);
        g.fillStyle = "#1c1c20";
        for (let k = 0; k < 3; k += 1) {
          g.beginPath();
          g.moveTo(vx - z * 0.45 + k * z * 0.3, vy - z * 1.4);
          g.lineTo(vx - z * 0.3 + k * z * 0.3, vy - z * 1.4);
          g.lineTo(vx - z * 0.15 + k * z * 0.3, vy - z * 2.0);
          g.lineTo(vx - z * 0.3 + k * z * 0.3, vy - z * 2.0);
          g.closePath();
          g.fill();
        }
        licht((ax + bx) / 2, Math.max(ay, by) + z * 7, z * 9, pal.leucht, 0.34);
      } else if (h.art === "looping") {
        // Ein Bock aus Holz trägt den Kreis, Lampen laufen ihm entlang.
        const mx = sx(h.mitte.x);
        const my = sy(h.mitte.y);
        const R = h.R * z;
        g.strokeStyle = "#2c1d13";
        g.lineWidth = Math.max(2, z * 0.26);
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(mx - R * 1.25, my + R + z * 0.5); g.lineTo(mx, my - R - z * 0.3);
        g.moveTo(mx + R * 1.25, my + R + z * 0.5); g.lineTo(mx, my - R - z * 0.3);
        g.moveTo(mx - R * 0.62, my); g.lineTo(mx + R * 0.62, my);
        g.stroke();
        g.strokeStyle = "rgba(150, 104, 66, 0.55)";
        g.lineWidth = Math.max(1, z * 0.07);
        g.stroke();
        for (let k = 0; k < 10; k += 1) {
          const wi = (k / 10) * TAU + 0.3;
          const an = 0.35 + 0.65 * (((state.zeit * 6 - k) % 10 + 10) % 10 < 3 ? 1 : 0);
          const lx = mx + Math.cos(wi) * (R + z * 0.35);
          const ly = my + Math.sin(wi) * (R + z * 0.35);
          g.fillStyle = `rgba(255, 226, 150, ${0.4 + 0.6 * an})`;
          g.fillRect(lx - 1.5, ly - 1.5, 3, 3);
          licht(lx, ly, z * 1.5, "gold", 0.5 * an);
        }
      }
    }

    // Alle hundert Meter eine Tafel.
    const von = Math.max(100, Math.ceil(meterBei(state.z.s - 40) / 100) * 100);
    g.font = `800 ${Math.round(clamp(z * 0.42, 9, 15))}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let m = von; m <= meterBei(state.z.s + 80); m += 100) {
      const o = gleisBei(W, START_S + m);
      if (o.art !== SCHIENE) continue;
      const px = sx(o.x);
      const py = sy(o.y);
      g.strokeStyle = "#1b1410";
      g.lineWidth = Math.max(2, z * 0.12);
      g.beginPath();
      g.moveTo(px, py + z * 0.2);
      g.lineTo(px, py - z * 1.9);
      g.stroke();
      const breit = z * 1.5;
      g.fillStyle = "#6b4a30";
      g.fillRect(px - breit / 2, py - z * 2.5, breit, z * 0.75);
      g.strokeStyle = "#2a1c12";
      g.lineWidth = Math.max(1, z * 0.06);
      g.strokeRect(px - breit / 2, py - z * 2.5, breit, z * 0.75);
      g.fillStyle = "#fff0d2";
      g.fillText(`${m} m`, px, py - z * 2.1);
    }

    // Die Gegner: eine Fahne dort, wo ihre Runde endete.
    const ziele = (gegner?.gegner?.() || []).filter((ziel) => ziel.art !== "alle");
    g.textBaseline = "bottom";
    for (const ziel of ziele) {
      const s = START_S + ziel.punkte;
      if (s < state.z.s - 40 || s > state.z.s + 80 || s > sEnde(W) - 2) continue;
      const o = gleisBei(W, s);
      const px = sx(o.x);
      const py = sy(o.y);
      const geschlagen = state.punkte > ziel.punkte;
      g.globalAlpha = geschlagen ? 0.4 : 1;
      g.strokeStyle = ziel.farbe;
      g.lineWidth = Math.max(2, z * 0.1);
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px, py - z * 3.4);
      g.stroke();
      g.fillStyle = ziel.farbe;
      g.beginPath();
      g.moveTo(px, py - z * 3.4);
      g.lineTo(px + z * 1.1, py - z * 3.05);
      g.lineTo(px, py - z * 2.7);
      g.closePath();
      g.fill();
      const text = ziel.art === "eigen" ? `Bestmarke ${ziel.punkte} m` : `${ziel.name} ${ziel.punkte} m`;
      g.lineWidth = 3;
      g.strokeStyle = "rgba(10, 7, 5, 0.8)";
      g.strokeText(text, px, py - z * 3.6);
      g.fillText(text, px, py - z * 3.6);
    }
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Lore
  // ---------------------------------------------------------------------------
  /*
   * Die Lore mit dem Hauer, gezeichnet in ihrem eigenen Bild: x nach vorn,
   * y nach oben, der Nullpunkt zwischen den Rädern auf dem Gleis – dieselben
   * Masse wie HUELLE. opt.geist: nur der Umriss, in dieser Farbe.
   */
  function zeichneLore(px, py, w, opt = {}) {
    const z = view.z;
    g.save();
    g.translate(px, py);
    g.rotate(-w);
    g.scale(z, -z);
    if (opt.geist) {
      g.fillStyle = opt.geist;
      g.beginPath();
      g.moveTo(-0.82, 0.58); g.lineTo(0.82, 0.58); g.lineTo(1.04, 1.34); g.lineTo(-1.04, 1.34);
      g.closePath();
      g.arc(-0.55, 0.28, 0.28, 0, TAU);
      g.arc(0.55, 0.28, 0.28, 0, TAU);
      g.arc(0.04, KOPF_Y, 0.27, 0, TAU);
      g.fill();
      g.restore();
      return;
    }
    const bremst = opt.bremst;
    const ducken = opt.ducken || 0;
    const freude = opt.freude || 0;
    const t = state.zeit;

    // Der Bremshebel hinten: gezogen, wenn gebremst wird.
    const hebelX = -0.78 - (bremst ? 0.34 : 0);
    g.strokeStyle = "#2a2e36";
    g.lineWidth = 0.09;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-0.72, 0.6);
    g.lineTo(hebelX, 1.78);
    g.stroke();
    g.fillStyle = "#e23b2e";
    g.beginPath();
    g.arc(hebelX, 1.8, 0.1, 0, TAU);
    g.fill();

    // Der Hauer: Kopf mit Helm und Lampe, Schnauz, rotes Halstuch.
    const ky = KOPF_Y - ducken * 0.26 + freude * 0.05;
    // Das Halstuch flattert nach hinten – mit dem Tempo.
    const zug = clamp((opt.tempo || 0) / 14, 0.15, 1.2);
    g.strokeStyle = "#d8362b";
    g.lineWidth = 0.12;
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(-0.12, ky - 0.2);
    for (let k = 1; k <= 4; k += 1) {
      g.lineTo(-0.12 - k * 0.2 * zug, ky - 0.2 + Math.sin(t * 13 - k * 1.2) * 0.05 * k * zug + k * 0.02);
    }
    g.stroke();
    // Die Arme: am Hebel, am Rand der Lore oder in der Luft.
    g.strokeStyle = "#3b6fb5";
    g.lineWidth = 0.13;
    g.beginPath();
    if (freude > 0.3) {
      g.moveTo(-0.14, ky - 0.26); g.lineTo(-0.44, ky + freude * 0.5);
      g.moveTo(0.2, ky - 0.26); g.lineTo(0.52, ky + 0.05 + freude * 0.5);
    } else if (bremst) {
      g.moveTo(-0.12, ky - 0.26); g.lineTo(hebelX + 0.06, 1.7);
      g.moveTo(0.1, ky - 0.28); g.lineTo(hebelX + 0.1, 1.62);
    } else {
      g.moveTo(-0.12, ky - 0.26); g.lineTo(-0.5, 1.38);
      g.moveTo(0.18, ky - 0.26); g.lineTo(0.62, 1.4);
    }
    g.stroke();
    // Schultern.
    g.fillStyle = "#3b6fb5";
    g.beginPath();
    g.ellipse(0.03, ky - 0.3, 0.34, 0.2, 0, 0, TAU);
    g.fill();
    // Kopf.
    g.fillStyle = "#f1c69c";
    g.beginPath();
    g.arc(0.06, ky, 0.25, 0, TAU);
    g.fill();
    // Helm mit Krempe.
    g.fillStyle = "#f6c12b";
    g.beginPath();
    g.arc(0.05, ky + 0.06, 0.27, 0, Math.PI);
    g.closePath();
    g.fill();
    g.fillRect(-0.24, ky + 0.02, 0.62, 0.07);
    g.fillStyle = "#c98f12";
    g.fillRect(-0.02, ky + 0.07, 0.07, 0.25);
    // Die Stirnlampe.
    g.fillStyle = "#2a2e36";
    g.fillRect(0.24, ky + 0.1, 0.12, 0.13);
    g.fillStyle = "#fff6d8";
    g.beginPath();
    g.arc(0.37, ky + 0.165, 0.055, 0, TAU);
    g.fill();
    // Auge, Braue, Schnauz – grosse Augen, wenn es eng wird.
    const gross = 1 + ducken * 0.35 + freude * 0.2;
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.ellipse(0.2, ky - 0.03, 0.06 * gross, 0.07 * gross, 0, 0, TAU);
    g.fill();
    g.fillStyle = "#1c1410";
    g.beginPath();
    g.arc(0.225, ky - 0.035, 0.032, 0, TAU);
    g.fill();
    g.fillStyle = "#6b4226";
    g.beginPath();
    g.ellipse(0.2, ky - 0.15, 0.13, 0.05, -0.15, 0, TAU);
    g.fill();
    if (freude > 0.4) {
      g.fillStyle = "#5a1d14";
      g.beginPath();
      g.arc(0.23, ky - 0.17, 0.05, 0, TAU);
      g.fill();
    }

    // Der Kasten: Eisen, oben ein Rand, darauf Nieten.
    const kasten = g.createLinearGradient(0, 0.58, 0, 1.36);
    kasten.addColorStop(0, "#3d444f");
    kasten.addColorStop(0.55, "#6a7482");
    kasten.addColorStop(1, "#7d8898");
    g.fillStyle = kasten;
    g.beginPath();
    g.moveTo(-0.82, 0.58); g.lineTo(0.82, 0.58); g.lineTo(1.04, 1.34); g.lineTo(-1.04, 1.34);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(0, 0, 0, 0.2)";
    g.beginPath();
    g.moveTo(-0.82, 0.58); g.lineTo(0.82, 0.58); g.lineTo(0.88, 0.8); g.lineTo(-0.88, 0.8);
    g.closePath();
    g.fill();
    g.fillStyle = "#a5b0c0";
    g.fillRect(-1.08, 1.27, 2.16, 0.11);
    g.fillStyle = "#2a2f38";
    for (let k = -3; k <= 3; k += 1) {
      g.beginPath();
      g.arc(k * 0.29, 1.325, 0.028, 0, TAU);
      g.fill();
    }
    g.strokeStyle = "rgba(30, 34, 42, 0.5)";
    g.lineWidth = 0.035;
    g.beginPath();
    g.moveTo(-0.36, 0.62); g.lineTo(-0.44, 1.26);
    g.moveTo(0.36, 0.62); g.lineTo(0.44, 1.26);
    g.stroke();
    // Das Fahrgestell.
    g.fillStyle = "#4a3222";
    g.fillRect(-0.94, 0.44, 1.88, 0.16);
    // Die Räder mit Speichen.
    for (const rx of [-0.55, 0.55]) {
      g.fillStyle = "#1c2028";
      g.beginPath();
      g.arc(rx, 0.28, 0.28, 0, TAU);
      g.fill();
      g.fillStyle = "#7d8898";
      g.beginPath();
      g.arc(rx, 0.28, 0.2, 0, TAU);
      g.fill();
      g.strokeStyle = "#1c2028";
      g.lineWidth = 0.05;
      g.beginPath();
      for (let k = 0; k < 3; k += 1) {
        const wi = -state.radWinkel + k * 1.047;
        g.moveTo(rx - Math.cos(wi) * 0.2, 0.28 - Math.sin(wi) * 0.2);
        g.lineTo(rx + Math.cos(wi) * 0.2, 0.28 + Math.sin(wi) * 0.2);
      }
      g.stroke();
      g.fillStyle = bremst ? "#ffb14a" : "#2a2f38";
      g.beginPath();
      g.arc(rx, 0.28, 0.07, 0, TAU);
      g.fill();
    }
    g.restore();
  }

  // Die Lore im Bild – oder ihr Wrack.
  let neigung = 0;
  function zeichneLoreImBild() {
    const z = state.z;
    const wr = state.wrack;
    if (wr) {
      if (wr.versinkt) return;
      const t = state.zeit - state.endet;
      g.globalAlpha = clamp(2.2 - t, 0, 1);
      zeichneLore(sx(wr.x), sy(wr.y - 0.6), wr.w, { tempo: 0, ducken: 1 });
      // Was davonfliegt: zwei Räder und der Helm.
      for (const teil of wr.teile) {
        const px = sx(teil.x);
        const py = sy(teil.y);
        const r = view.z * (teil.art === 2 ? 0.26 : 0.28);
        if (teil.art === 2) {
          g.fillStyle = "#f6c12b";
          g.beginPath();
          g.arc(px, py, r, Math.PI + teil.w, teil.w);
          g.fill();
        } else {
          g.fillStyle = "#1c2028";
          g.beginPath();
          g.arc(px, py, r, 0, TAU);
          g.fill();
          g.fillStyle = "#7d8898";
          g.beginPath();
          g.arc(px, py, r * 0.7, 0, TAU);
          g.fill();
        }
      }
      g.globalAlpha = 1;
      return;
    }
    // Am Gleis steht sie so schräg wie das Gleis unter ihren beiden Rädern;
    // in der Luft, wie sie fliegt.
    let w = z.w;
    if (z.modus === AM_GLEIS) {
      const W = state.welt;
      const a = gleisBei(W, z.s - 0.55);
      const ax = a.x;
      const ay = a.y;
      const b = gleisBei(W, z.s + 0.55);
      w = Math.atan2(b.y - ay, b.x - ax);
    }
    let dw = w - neigung;
    while (dw > Math.PI) dw -= TAU;
    while (dw < -Math.PI) dw += TAU;
    neigung += dw * 0.5;
    const tempo = z.modus === AM_GLEIS ? z.v : Math.hypot(z.vx, z.vy);
    const px = sx(z.x);
    const py = sy(z.y);
    zeichneLore(px, py, neigung, { bremst: state.bremst, ducken: state.blick, freude: state.freude, tempo });
    // Die Stirnlampe wirft Licht voraus, die Bremse glüht.
    const c = Math.cos(neigung);
    const s = Math.sin(neigung);
    const kopfX = px + (c * 0.4 - s * (KOPF_Y + 0.16)) * view.z;
    const kopfY = py - (s * 0.4 + c * (KOPF_Y + 0.16)) * view.z;
    licht(kopfX + c * view.z * 3.4, kopfY - s * view.z * 3.4, view.z * 6, "weiss", 0.26);
    licht(kopfX + c * view.z * 0.25, kopfY - s * view.z * 0.25, view.z * 0.7, "weiss", 0.55);
    if (state.bremst && z.v > 0.5) {
      const hell = clamp(z.v / 10, 0.3, 1);
      licht(px - c * 0.55 * view.z, py + s * 0.55 * view.z, view.z * 2.4, "funke", 0.85 * hell);
      licht(px + c * 0.55 * view.z, py - s * 0.55 * view.z, view.z * 2.4, "funke", 0.85 * hell);
    }
  }

  // Die Gegner als Geist (geist.js): eine Lore aus Licht, auf diesem Gleis –
  // so weit, wie sie damals zu dieser Zeit waren.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    const W = state.welt;
    const namen = [];
    orte.forEach((o) => {
      const s = clamp(o.a / 10, 0, sEnde(W) - 1);
      const p = gleisBei(W, s);
      const hoch = Math.max(0, o.b / 10);
      const x = p.x - Math.sin(p.w) * hoch;
      const y = p.y + Math.cos(p.w) * hoch;
      namen.push({ ...o, sx: sx(x), sy: sy(y + 2.2), weit: `${s > state.z.s ? "+" : ""}${Math.round(s - state.z.s)} m` });
      // Wem im Live-Modus zugeschaut wird, der ist die Figur selbst – kein
      // Geist dazu, nur sein Name (geist.js, namen).
      if (o.ziel) return;
      g.globalAlpha = 0.55 * o.blass;
      zeichneLore(sx(x), sy(y), hoch > 0.15 ? (o.c || 0) / 100 : p.w, { geist: o.farbe });
    });
    g.globalAlpha = 1;
    window.LernappGeist.namen(g, namen, { breit: view.cssW, hoch: view.cssH });
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Funken, Staub, der Einsturz
  // ---------------------------------------------------------------------------
  function zeichneTeile(P) {
    const z = view.z;
    // Brocken.
    if (state.brocken.length) {
      g.fillStyle = rgb(P.tief);
      for (const b of state.brocken) {
        const px = sx(b.x);
        const py = sy(b.y);
        const r = b.r * z;
        g.beginPath();
        g.moveTo(px + Math.cos(b.w) * r, py + Math.sin(b.w) * r);
        g.lineTo(px + Math.cos(b.w + 2.2 + b.form) * r, py + Math.sin(b.w + 2.2 + b.form) * r);
        g.lineTo(px + Math.cos(b.w + 4.1) * r * 0.9, py + Math.sin(b.w + 4.1) * r * 0.9);
        g.closePath();
        g.fill();
      }
    }
    // Staub.
    if (state.staub.length) {
      const bild = staubSprite(P.staub);
      for (const t of state.staub) {
        const k = clamp(t.leben / t.max, 0, 1);
        g.globalAlpha = 0.42 * k;
        const r = t.r * z * 1.6;
        g.drawImage(bild, sx(t.x) - r, sy(t.y) - r, r * 2, r * 2);
      }
      g.globalAlpha = 1;
    }
  }

  // Die Funken: helle Striche in ihrer Flugrichtung, hell übereinandergelegt.
  function zeichneFunken() {
    if (!state.funken.length && !state.schweben.length) return;
    const z = view.z;
    g.lineCap = "round";
    for (const f of state.funken) {
      const k = clamp(f.leben / f.max, 0, 1);
      const px = sx(f.x);
      const py = sy(f.y);
      g.strokeStyle = k > 0.6 ? "#fff3c8" : k > 0.3 ? "#ffc14d" : "#ff7a2a";
      g.globalAlpha = Math.min(1, k * 1.6);
      g.lineWidth = Math.max(1, z * 0.055 * f.hell);
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px - f.vx * 0.028 * z, py + f.vy * 0.028 * z);
      g.stroke();
    }
    // Goldene Sterne nach einem «haarscharf».
    g.fillStyle = "#ffe07a";
    for (const t of state.schweben) {
      const k = clamp(t.leben / t.max, 0, 1);
      g.globalAlpha = k;
      const r = z * 0.22 * (0.4 + k);
      const px = sx(t.x);
      const py = sy(t.y);
      g.beginPath();
      g.moveTo(px, py - r); g.lineTo(px + r * 0.22, py - r * 0.22); g.lineTo(px + r, py); g.lineTo(px + r * 0.22, py + r * 0.22);
      g.lineTo(px, py + r); g.lineTo(px - r * 0.22, py + r * 0.22); g.lineTo(px - r, py); g.lineTo(px - r * 0.22, py - r * 0.22);
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
  }

  // Der Einsturz: eine Wand aus Staub, die dem Gleis folgt, dahinter nichts
  // mehr. Brocken fallen aus der Decke, und kurz davor rieselt es schon.
  function zeichneEinsturz(P) {
    const W = state.welt;
    const z = view.z;
    const H = view.cssH;
    const front = sx(gleisBei(W, Math.max(0, state.einsturz)).x);
    if (front < -z * 9) return;
    const t = state.zeit;
    // Dahinter: dicht.
    const v = g.createLinearGradient(front - z * 7, 0, front + z * 1.5, 0);
    v.addColorStop(0, rgba(P.tief, 1));
    v.addColorStop(0.6, rgba(P.tief, 0.92));
    v.addColorStop(1, rgba(P.tief, 0));
    g.fillStyle = v;
    g.fillRect(-10, 0, front + z * 1.5 + 10, H);
    // Die Wolken an der Front: innen dunkel und dicht, am Rand heller Staub.
    const dunkel = staubSprite([lerp(P.staub[0], P.tief[0], 0.6), lerp(P.staub[1], P.tief[1], 0.6), lerp(P.staub[2], P.tief[2], 0.6)]);
    const hell = staubSprite(P.staub);
    const viele = Math.max(8, Math.ceil(H / (z * 2.2)));
    for (let i = 0; i < viele; i += 1) {
      const y = (i + 0.5) / viele * H + Math.sin(t * 1.7 + i * 2.3) * z * 0.7;
      const x = front + (Math.sin(t * 1.3 + i * 1.9) - 0.9) * z * 1.6;
      const r = z * (2.8 + 0.9 * Math.sin(t * 2.1 + i * 3.1));
      g.globalAlpha = 0.9;
      g.drawImage(dunkel, x - r, y - r, r * 2, r * 2);
      g.globalAlpha = 0.3;
      g.drawImage(hell, x + z * 1.6 - r * 0.7, y - r * 0.7 + z * 0.4 * Math.sin(t * 3 + i), r * 1.4, r * 1.4);
    }
    g.globalAlpha = 1;
    // Brocken: fallen im Takt, jeder für sich.
    const kx = wx(front);
    const decke = sy(deckeBei(W, kx));
    const boden = Math.min(H + 20, sy(bodenBei(W, kx)));
    g.fillStyle = rgb(P.tief);
    g.strokeStyle = rgba(P.kante, 0.35);
    g.lineWidth = 1;
    for (let i = 0; i < 9; i += 1) {
      const dauer = 0.8 + 0.7 * hash01(i * 3.3);
      const u = ((t / dauer + hash01(i * 7.7)) % 1 + 1) % 1;
      const x = front + (hash01(i * 2.1 + Math.floor(t / dauer + hash01(i * 7.7))) * 7 - 5) * z;
      const y = lerp(Math.max(-20, decke), boden, u * u);
      const r = z * (0.3 + 0.5 * hash01(i * 5.5));
      const dreh = t * (2 + i) + i;
      g.beginPath();
      for (let k = 0; k < 5; k += 1) {
        const wi = dreh + k * 1.257;
        const rr = r * (0.75 + 0.25 * hash01(i + k * 2.9));
        if (k) g.lineTo(x + Math.cos(wi) * rr, y + Math.sin(wi) * rr); else g.moveTo(x + Math.cos(wi) * rr, y + Math.sin(wi) * rr);
      }
      g.closePath();
      g.fill();
      g.stroke();
    }
    // Es rieselt voraus.
    g.fillStyle = rgba(P.staub, 0.8);
    for (let i = 0; i < 14; i += 1) {
      const u = ((t * (0.9 + 0.5 * hash01(i)) + hash01(i * 9.1)) % 1 + 1) % 1;
      const x = front + hash01(i * 4.4) * z * 7;
      g.fillRect(x, lerp(decke, boden, u * u), 2, 2 + 3 * u);
    }
  }

  // Das Licht: alle Scheine des Bildes, hell übereinander.
  function zeichneLicht() {
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < lichtZahl; i += 1) {
      const l = lichter[i];
      if (l.a <= 0.04 || l.x < -l.r || l.x > view.cssW + l.r || l.y < -l.r || l.y > view.cssH + l.r) continue;
      schein(l.x, l.y, l.r, l.name, Math.min(1, l.a));
    }
    g.globalAlpha = 1;
    zeichneFunken();
    g.globalCompositeOperation = "source-over";
  }

  // Ganz vorn: dunkle Zacken am unteren Rand, die schneller vorbeiziehen als
  // das Gleis, und ein dunkler Rand um das ganze Bild.
  function zeichneVordergrund() {
    const W = view.cssW;
    const H = view.cssH;
    if (!ruhig()) fransen(1.55, "rgba(6, 4, 5, 0.9)", H * 0.055, 31, false);
    // Der Rand: oben und unten läuft das Bild ins Dunkle.
    if (!randAlt || randAlt.H !== H) {
      const oben = g.createLinearGradient(0, 0, 0, H * 0.2);
      oben.addColorStop(0, "rgba(0, 0, 0, 0.55)");
      oben.addColorStop(1, "rgba(0, 0, 0, 0)");
      const unten = g.createLinearGradient(0, H * 0.76, 0, H);
      unten.addColorStop(0, "rgba(0, 0, 0, 0)");
      unten.addColorStop(1, "rgba(0, 0, 0, 0.7)");
      randAlt = { H, oben, unten };
    }
    g.fillStyle = randAlt.oben;
    g.fillRect(0, 0, W, H * 0.2);
    g.fillStyle = randAlt.unten;
    g.fillRect(0, H * 0.76, W, H * 0.24);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Anzeige
  // ---------------------------------------------------------------------------
  function pille(x, y, w, h, farbe) {
    g.fillStyle = farbe;
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, h / 2); else g.rect(x, y, w, h);
    g.fill();
  }

  function zeichneAnzeige() {
    const W = view.cssW;
    const H = view.cssH;
    const z = state.z;
    const u = clamp(Math.min(W, H) / 420, 0.85, 1.35);

    // Die Schriften über der Lore.
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const s of state.schriften) {
      const k = clamp(s.leben / s.max, 0, 1);
      const auf = (1 - k) * 30 * u;
      const px = clamp(sx(z.x), 80, W - 80);
      const py = sy(z.y) - s.hoch * view.z - 60 * u - auf;
      g.globalAlpha = Math.min(1, k * 2.4);
      g.font = `900 ${Math.round(s.gross * u)}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(14, 9, 6, 0.8)";
      g.strokeText(s.text, px, py);
      g.fillStyle = s.farbe;
      g.fillText(s.text, px, py);
    }
    g.globalAlpha = 1;

    // Der Name des Reviers, wenn ein neues beginnt.
    const seit = state.zeit - state.zone.seit;
    if (seit < 3) {
      const a = clamp(seit / 0.4, 0, 1) * clamp((3 - seit) / 0.8, 0, 1);
      g.globalAlpha = a;
      g.font = `900 ${Math.round(clamp(W * 0.055, 18, 40))}px system-ui, sans-serif`;
      g.fillStyle = rgb(pal.kante);
      g.strokeStyle = "rgba(10, 7, 5, 0.7)";
      g.lineWidth = 5;
      const y = view.frei + (H - view.frei) * 0.2;
      g.strokeText(state.zone.name, W / 2, y);
      g.fillText(state.zone.name, W / 2, y);
      g.globalAlpha = 1;
    }

    // Oben links: die Meter, darunter Tempo und Vorsprung.
    g.save();
    g.translate(0, view.frei);
    const gross = clamp(H * 0.055, 14, 24);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    const text = `${state.meter} m`;
    const breit = g.measureText(text).width + gross * 1.1;
    pille(12, 12, breit, gross * 1.6, "rgba(12, 9, 8, 0.6)");
    g.fillStyle = "#ffffff";
    g.fillText(text, 12 + gross * 0.55, 12 + gross * 0.84);
    if (state.phase !== "bereit") {
      const klein = Math.round(gross * 0.6);
      const y2 = 12 + gross * 1.6 + 6;
      const tempo = z.modus === AM_GLEIS ? z.v : Math.hypot(z.vx, z.vy);
      const vorsprung = Math.max(0, z.s - state.einsturz);
      const eng = vorsprung < 16;
      g.font = `800 ${klein}px system-ui, sans-serif`;
      const t1 = `${Math.round(tempo * 3.6)} km/h`;
      const w1 = g.measureText("188 km/h").width + klein * 1.2;
      pille(12, y2, w1, klein * 1.8, "rgba(12, 9, 8, 0.6)");
      g.fillStyle = "#f3dcb4";
      g.fillText(t1, 12 + klein * 0.6, y2 + klein * 0.95);
      // Der Vorsprung: ein Balken, der rot wird, wenn es eng ist.
      const bx = 12 + w1 + 6;
      const bw = Math.max(70, gross * 4.6);
      pille(bx, y2, bw, klein * 1.8, eng && Math.sin(state.zeit * 12) > 0 ? "rgba(120, 20, 14, 0.8)" : "rgba(12, 9, 8, 0.6)");
      const anteil = clamp(vorsprung / VORSPRUNG_MAX, 0, 1);
      g.fillStyle = eng ? "#ff5a48" : vorsprung < 32 ? "#ffd23f" : "#35c46a";
      const innen = bw - 8;
      g.beginPath();
      if (g.roundRect) g.roundRect(bx + 4, y2 + klein * 1.8 - 7, Math.max(4, innen * anteil), 3, 1.5); else g.rect(bx + 4, y2 + klein * 1.8 - 7, innen * anteil, 3);
      g.fill();
      g.fillStyle = "#ffffff";
      g.fillText(`Vorsprung ${Math.round(vorsprung)} m`, bx + klein * 0.6, y2 + klein * 0.8);
      if (state.kette >= 2) {
        const y3 = y2 + klein * 1.8 + 6;
        const t3 = `Haarscharf ×${state.kette}`;
        const w3 = g.measureText(t3).width + klein * 1.2;
        pille(12, y3, w3, klein * 1.8, "#ffd23f");
        g.fillStyle = "#3a2400";
        g.fillText(t3, 12 + klein * 0.6, y3 + klein * 0.95);
      }
    }
    g.restore();

    // Am linken Rand: wie nah der Einsturz ist, solange man ihn nicht sieht.
    if (state.phase !== "bereit" && !state.endet) {
      const vorsprung = z.s - state.einsturz;
      const front = sx(gleisBei(state.welt, Math.max(0, state.einsturz)).x);
      if (front < 4 && vorsprung < 26) {
        const nah = clamp(1 - vorsprung / 26, 0, 1);
        const y = clamp(sy(z.y), view.frei + 120 * u, H - 60);
        g.globalAlpha = 0.5 + 0.5 * nah;
        g.fillStyle = "#ff5a48";
        const puls = 1 + 0.15 * Math.sin(state.zeit * (6 + 10 * nah));
        for (let k = 0; k < 2; k += 1) {
          g.beginPath();
          g.moveTo(8 + k * 12 * u, y);
          g.lineTo(8 + (k * 12 + 12 * puls) * u, y - 11 * u * puls);
          g.lineTo(8 + (k * 12 + 12 * puls) * u, y + 11 * u * puls);
          g.closePath();
          g.fill();
        }
        g.globalAlpha = 1;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: alles zusammen
  // ---------------------------------------------------------------------------
  function zeichnen() {
    if (!g || !state.welt) return;
    const W = state.welt;
    const z = state.z;
    view.z = view.s * state.kam.zoom;
    view.ankerX = view.cssW * view.anker;
    lichtZahl = 0;
    const P = palette(state.meter);
    // Das Bild wackelt, wenn es kracht – und je näher der Einsturz ist.
    const nah = state.phase === "bereit" ? 0 : clamp(1 - (z.s - state.einsturz) / 34, 0, 1);
    const wackel = ruhig() ? 0 : state.stoss * 7 + nah * nah * 3.2;
    const dx = wackel ? Math.sin(state.zeit * 71) * wackel : 0;
    const dy = wackel ? Math.cos(state.zeit * 57) * wackel : 0;

    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    zeichneHintergrund(P);
    zeichneSchwebendes(P);
    g.setTransform(view.dpr, 0, 0, view.dpr, dx * view.dpr, dy * view.dpr);

    // Welche Gleispunkte im Bild sind: vom Weg der Lore aus gesucht, denn im
    // Looping läuft x auch rückwärts.
    const links = wx(-40);
    const rechts = wx(view.cssW + 40);
    let i0 = clamp(Math.floor(z.s / DS), 0, W.n - 1);
    let i1 = i0;
    for (let n = 0; n < 900 && i0 > 0 && (W.x[i0] > links || W.art[i0] === SCHLEIFE); n += 1) i0 -= 1;
    for (let n = 0; n < 1400 && i1 < W.n - 1 && (W.x[i1] < rechts || W.art[i1] === SCHLEIFE); n += 1) i1 += 1;

    zeichneGerueste(i0, i1);
    zeichneFels(P);
    zeichneLaternen(i0, i1);
    zeichneSignale();
    zeichneStellen();
    zeichneGleis(i0, i1);
    zeichneStampfer();
    zeichneGeister();
    zeichneTeile(P);
    zeichneLoreImBild();
    zeichneEinsturz(P);
    zeichneLicht();
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    zeichneVordergrund();
    zeichneAnzeige();
    // Was die Anzeige noch an Licht gesammelt hat (der goldene Zeiger).
    if (lichtZahl) {
      g.globalCompositeOperation = "lighter";
      const l = lichter[lichtZahl - 1];
      if (l.name === "gold" && l.r < 60) schein(l.x, l.y, l.r, l.name, Math.min(1, l.a));
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Ein aufgezeichneter Lauf: Der Zufall hält die Saat (geist.js, zuschauer),
  // startRun baut damit dasselbe Bergwerk, die Uhr läuft wie damals (nach ihr
  // schlagen die Stampfer), und die Lore steht Bild für Bild dort, wo sie
  // war – auf dem Gleis bei ihrem Weg, im Flug so hoch darüber.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    shell.setPhase("play");
    zuschauer.los();
    kulissenAn();
  }

  let zuVor = { s: 0, t: 0, v: 0 };
  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s || state.endet) return;
    const W = state.welt;
    const z = state.z;
    const weg = clamp((s.a || 0) / 10, 0, sEnde(W) - 1);
    const hoch = Math.max(0, (s.b || 0) / 10);
    const vorher = z.modus;
    gleisBei(W, weg);
    z.s = weg;
    z.modus = hoch > 0.12 ? IN_LUFT : AM_GLEIS;
    z.x = ort.x - Math.sin(ort.w) * hoch;
    z.y = ort.y + Math.cos(ort.w) * hoch;
    z.w = z.modus === IN_LUFT ? (s.c || 0) / 100 : ort.w;
    z.dn = hoch;
    z.luft = z.modus === IN_LUFT ? z.luft + dt : 0;
    const t = s.t / 1000;
    // Das Tempo aus dem Weg; gebremst wurde, wo es schneller fiel, als Hang
    // und Fahrtwind erklären.
    const dtLauf = Math.max(1e-3, t - zuVor.t);
    const v = clamp((weg - zuVor.s) / dtLauf, 0, V_DECKEL);
    const frei = -G * Math.sin(ort.w) - ROLL - LUFT * v * v;
    state.bremst = z.modus === AM_GLEIS && t > zuVor.t && (v - zuVor.v) / dtLauf < frei - 3.5 && v > 0.6;
    if (t > zuVor.t) zuVor = { s: weg, t, v };
    z.v = v;
    z.vx = Math.cos(z.w) * v;
    z.vy = Math.sin(z.w) * v;
    z.t = t;
    if (vorher === IN_LUFT && z.modus === AM_GLEIS) { z.vn = 2.5; nachSchritt(IN_LUFT); } else nachSchritt(AM_GLEIS);
    // Der Einsturz folgt nach der Uhr wie im Spiel – aber er holt die Lore
    // erst ein, wenn der Lauf zu Ende ist.
    state.einsturz += einsturzTempo(t) * dt;
    state.einsturz = clamp(state.einsturz, z.s - VORSPRUNG_MAX, z.s - 2.5);
    state.spitze = Math.max(state.spitze, v);
    const meter = Math.max(0, Math.floor(s.punkte));
    if (meter !== state.meter) {
      state.meter = meter;
      state.punkte = meter;
      shell.setCount(meter);
    }
    if (!zuschauer.weiter()) {
      // Am Ende des Laufs: eingeholt oder verunglückt.
      const grund = z.s - state.einsturz < 6 ? "einsturz" : "hart";
      unglueck(grund);
      state.schriften.length = 0;
      kulissenAus();
    }
  }

  // ---------------------------------------------------------------------------
  // Halten und Loslassen
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Druck – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los). Der Hauer stösst sich ab,
  // und hinten bricht der Stollen ein.
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.z.v = V_START;
    state.zone.seit = state.zeit;
    shell.setPhase("play");
    gegner?.los();
    kulissenAn();
    kids()?.vibrate?.(8);
  }

  function druecken() {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    if (state.phase === "bereit") {
      if (shell.live) { gedrueckt = true; return; }
      startDruck = true;
      gedrueckt = true;
      losGehts();
      return;
    }
    gedrueckt = true;
  }

  function loslassen() {
    gedrueckt = false;
    startDruck = false;
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    clearStep();
    stopLoop();
    kulissenAus();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    const W = weltAnfang();
    // Das Bergwerk ein gutes Stück voraus – so stockt unterwegs kein Bild.
    weltBis(W, START_S + 700);
    state.welt = W;
    state.z = neueLore(W, START_S, 0);
    state.phase = "bereit";
    state.punkte = 0;
    state.meter = 0;
    state.weit = START_S;
    state.spitze = 0;
    state.einsturz = START_S - EINSTURZ_START;
    state.kette = 0;
    state.knappe = 0;
    state.stelleNr = 0;
    state.signalNr = 0;
    state.grund = "";
    state.endet = 0;
    state.zeit = 0;
    state.bremst = false;
    state.bremsZeit = 0;
    state.stoss = 0;
    state.funken = [];
    state.staub = [];
    state.brocken = [];
    state.schriften = [];
    state.schweben = [];
    state.wrack = null;
    state.radWinkel = 0;
    state.blick = 0;
    state.freude = 0;
    state.zone = { name: BIOME[0].name, seit: -99 };
    zuVor = { s: START_S, t: 0, v: 0 };
    neigung = 0;
    gedrueckt = false;
    startDruck = false;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt gl-prompt", "Halten – bremsen. Loslassen – rollen.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    kameraTakt(0, true);

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(800, 160 + ziel * 2);
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
    if (state.phase === "zuschauen") return;
    clearStep();
    stopLoop();
    kulissenAus();
    if (state.phase === "ende") return;
    // Im Live-Modus endet die Runde, wenn die Zeit des Abends um ist.
    if (!state.grund) state.grund = "zeit";
    state.phase = "ende";
    gedrueckt = false;
    const punkte = state.punkte;
    const geist = gegner?.ende(punkte) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    const kmh = Math.round(state.spitze * 3.6);
    const knapp = state.knappe ? `${state.knappe}× haarscharf` : "";
    shell.showResult({
      label: "Deine Meter",
      points: punkte,
      detail: rekord
        ? ["Neuer Rekord!", knapp].filter(Boolean).join(" ")
        : [GRUND_TEXT[state.grund] || "", knapp, `Spitze ${kmh} km/h`, vorher ? `Bestwert ${vorher} m` : ""].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("gl-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Höhlenfahrt",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "mineCart", fassung: "t1", zufall, einheit: "m", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "mineCart", host, art: "tempo", fassung: "t1", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    druecken();
  });
  window.addEventListener("pointerup", loslassen);
  window.addEventListener("pointercancel", loslassen);
  // Wer das Fenster verlässt, nimmt auch den Finger von der Bremse.
  window.addEventListener("blur", loslassen);

  const TASTEN = new Set([" ", "Enter", "ArrowDown", "ArrowLeft"]);
  document.addEventListener("keydown", (event) => {
    if (!TASTEN.has(event.key) && event.code !== "KeyS") return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    druecken();
  });
  document.addEventListener("keyup", (event) => {
    if (!TASTEN.has(event.key) && event.code !== "KeyS") return;
    loslassen();
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); kulissenAus(); });

  // Für die Prüfskripte und die Vorführung.
  window.LernappGrubenlore = {
    TAKT, DS, START_S, V_DECKEL, V_PUMPE, VORSPRUNG_MAX, S_OFFEN_MIN, S_FREI,
    state, view, takt, zeichnen, druecken, loslassen, losGehts, weltText, weltBis, BIOME, ARTEN,
    neueLore, schritt, pilot, naechste, stampfHoehe, einsturzTempo, meterBei,
    gedrueckt: () => gedrueckt,
  };
})();
