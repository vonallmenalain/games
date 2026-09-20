/*
 * turmbau.js – Turmbau als ein Turm ohne Uhr.
 *
 * Über dem Turm schwingt ein Block hin und her. Ein Tipp lässt ihn fallen: was
 * auf dem Block darunter aufliegt, bleibt liegen, was übersteht, bricht ab und
 * fällt aus dem Bild. Der nächste Block ist dann nur noch so breit wie das,
 * was liegen blieb – der Turm wird nach oben von selbst schmaler. Erst wer
 * ganz daneben trifft, ist fertig: solange der Block den Turm berührt, geht es
 * weiter, und sei der Rest noch so schmal. Was zählt, ist, wie viele Blöcke
 * bis dahin gestapelt sind.
 *
 * Dieselbe Form wie der Fischteich: ein Lauf, keine Uhr, keine Level. Schwerer
 * wird es allein durch die Höhe – der Block schwingt mit jedem Stapel eine
 * Spur schneller und weiter (siehe SCHWUNG weiter unten).
 *
 * Gezeichnet wird auf eine Leinwand statt in Elemente: ein hoher Turm hat
 * schnell fünfzig Blöcke, dazu Bruchstücke und Funken, und die schiebt kein
 * Browser als eigene Kästen mehr flüssig durchs Bild. Die Leiste oben, der
 * Zähler und die Ergebnistafel kommen weiter aus game-shell.js.
 *
 * Gerechnet wird in Welteinheiten, nicht in Bildpunkten. Fest steht dabei die
 * Höhe: immer SICHT_H Einheiten Welt stehen im Bild. Wie breit die Welt dazu
 * ist, sagt die Form der Baustelle – auf einem Handy quer ist sie gut doppelt
 * so breit wie hoch, also ist es die Welt auch. Alle Masse quer wachsen dann
 * im selben Verhältnis mit, und weil alle dasselbe Mass bekommen, ist das
 * Spiel auf jedem Gerät dasselbe: der Block ist immer derselbe Anteil des
 * Bildes und schwingt über denselben Anteil davon. Nur grösser ist es.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "tower") return;

  const host = document.querySelector("#tb-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  const art = window.LernappTrainArt;
  if (!host || !shellApi || !art) return;

  const kids = () => window.LernappKids || null;
  // Wer weniger Bewegung eingestellt hat, bekommt keinen Parallax-Himmel und
  // keinen Stoss aufs Bild. Der Block fällt trotzdem und die Punkte zählen
  // trotzdem hoch – das ist das Spiel, nicht die Zierde.
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  // Der Nullpunkt liegt auf dem Boden, y zählt nach oben. Ein Block wird über
  // seine Mitte und seine Unterkante geführt: beim Stapeln geht es um genau
  // diese zwei Zahlen.
  //
  // WELT_W ist das Grundmass der Breite: so breit ist die Welt, wenn die
  // Baustelle so breit wie hoch ist. Auf einem Handy quer ist sie gut doppelt
  // so breit – dann ist es die Welt auch, und mit ihr jedes Mass quer (siehe
  // welt weiter unten). Schmaler als das Grundmass wird sie nie: auf einem
  // hohen Bild steht dann eben mehr Turm im Bild.
  //
  // Jede Zahl quer ist darum ein Grundmass, keine Länge: im Spiel gilt, was
  // dazu in welt steht.
  const WELT_W = 300;              // Grundmass der Breite, in Einheiten
  const WELT_W_MAX = 700;          // breiter als das wird die Welt nicht
  const SICHT_H = 300;             // so viel Welt steht in der Höhe immer im Bild
  const BLOCK_H = 26;
  const START_W = 132;             // knapp die Hälfte des Bildes
  // Schmaler als das wird kein Block. Eine Grenze, an der der Turm "zu schmal"
  // und damit fertig wäre, gibt es nicht: ein Kind, das den Turm trifft, hat
  // ihn getroffen, und ein Spiel, das dann trotzdem endet, fühlt sich falsch
  // an. Nur unsichtbar darf der Rest nicht werden – unter drei Einheiten wäre
  // er auf einem Handy kein Bildpunkt mehr, also bleibt so viel stehen, und
  // genau so viel zählt auch. Von dort führen drei genaue Treffer hintereinander
  // wieder zu einem breiteren Block.
  const KLEINSTE_W = 3;
  const SOCKEL_W = START_W * 1.34; // das Fundament ist breiter als der erste Block
  const SOCKEL_H = BLOCK_H * 1.15;
  const GRUND = 46;                // so viel Boden liegt unter dem Sockel im Bild
  const SCHWEBE = BLOCK_H * 1.6;   // so hoch über der Turmspitze schwingt der Block
  const FALL_G = 2600;             // Schwerkraft in Einheiten je Sekunde²

  // ---------------------------------------------------------------------------
  // Der Schwung
  // ---------------------------------------------------------------------------
  // Die Kurve, an der das ganze Spiel hängt. Am Anfang schwingt der Block
  // langsam und in einem kurzen Bogen; mit jedem Stapel wird die Schwingung
  // schneller und weiter. Beides ist gedeckelt: ab einer gewissen Höhe soll es
  // schwer sein, nicht unmöglich.
  //
  // Die Zahlen sind ausgespielt, nicht ausgerechnet: mit einem nachgebildeten
  // Spieler, dessen Tipp um eine bestimmte Zeit streut, und dann im Browser.
  // Wer 90 Millisekunden daneben liegt – das trifft ein Kind um die sieben
  // Jahre gut – kommt im Mittel auf dreizehn Blöcke, wer 130 daneben liegt auf
  // zehn, wer nur 60 daneben liegt auf siebzehn. Nach oben ist es offen, aber
  // nicht endlos: auch der genaueste Lauf endete unter vierzig Blöcken.
  //
  // Das Fenster für einen genauen Treffer folgt daraus: beim ersten Block gut
  // zwei Zehntelsekunden, beim fünfzehnten noch etwa 60 Millisekunden. Ab dem
  // sechsundzwanzigsten läuft die Schwingung am Anschlag.
  const PERIODE_START = 3.1;       // Sekunden für eine ganze Schwingung
  const PERIODE_MIN = 0.9;
  const PERIODE_RAMPE = 0.952;     // je Block gut 5 % schneller
  // Ab dieser Höhe schwankt das Tempo von Block zu Block ein wenig. Ohne das
  // liesse sich der Takt auswendig lernen, und wer ihn kann, stapelt endlos.
  const ZITTER_AB = 12;
  const ZITTER = 0.16;             // ±8 % auf die Periode
  const WEITE_START = 44;          // halbe Auslenkung in Einheiten
  const WEITE_SCHRITT = 1.8;       // je Block ein Stück weiter
  const WEITE_MIN = 18;            // ganz ohne Bogen schwingt kein Block
  const RAND = 8;                  // so weit bleibt der Block vom Bildrand weg

  // ---------------------------------------------------------------------------
  // Treffer
  // ---------------------------------------------------------------------------
  // "Genau getroffen" ist kein fester Abstand in Bildpunkten, sondern ein
  // Anteil der Blockbreite: ein schmaler Block muss genauer sitzen als ein
  // breiter, sonst wäre der Turm oben leichter als unten.
  const PERFEKT_ANTEIL = 0.075;
  const PERFEKT_MIN = 4.5;
  // Drei genaue Treffer hintereinander geben ein Stück Breite zurück. Das ist
  // der Weg aus einem schief geratenen Turm heraus – ohne ihn endet jeder Lauf
  // unweigerlich am immer schmaleren Block, und ein Kind hat nichts in der
  // Hand, um das aufzuhalten.
  const BONUS_NACH = 3;
  const BONUS = START_W * 0.06;

  // ---------------------------------------------------------------------------
  // Die Kamera
  // ---------------------------------------------------------------------------
  // Sie hält die Turmspitze auf gut sechs Zehnteln der Bildhöhe und zieht weich
  // nach – exponentiell, damit kein Sprung entsteht und das Tempo nicht an der
  // Bildrate hängt. Darüber bleibt genug Luft für den schwingenden Block,
  // darunter sieht man noch acht, neun Blöcke des eigenen Turms.
  const FOLGE_HOEHE = 0.6;
  const FOLGE_K = 7;
  const FOLGE_K_RUHIG = 14;

  // ---------------------------------------------------------------------------
  // Zeiten
  // ---------------------------------------------------------------------------
  const EINZUG_MS = 220;           // wie lange der neue Block einschwebt
  const STAUCH_MS = 110;           // Zusammendrücken beim Aufsetzen
  const GLANZ_MS = 190;            // Leuchten nach einem genauen Treffer
  const STOSS_MS = 90;             // Stoss aufs Bild, nur bei genauem Treffer
  const ENDE_MS = 820;             // von "vorbei" bis zur Ergebnistafel

  // ---------------------------------------------------------------------------
  // Farben
  // ---------------------------------------------------------------------------
  // Ein Regenbogen von unten nach oben: zwei Blöcke übereinander haben nie
  // dieselbe Farbe, und die Höhe ist auch an der Farbe abzulesen.
  const FARBEN = [
    "#e2694f", "#ef8f3c", "#f0b429", "#a8cf5c", "#5fb87a", "#3fb8b8",
    "#4a90d9", "#7c5ce6", "#9a6fd0", "#ef86a8", "#e8543f", "#c97a3c",
  ];
  const SOCKEL_FARBE = "#9aa7b4";

  // Der Himmel wandert mit der Höhe von Tag über Sonnenuntergang in die Nacht.
  // Nach so vielen Blöcken ist es tiefe Nacht – wer so weit kommt, hat den
  // ganzen Tag durchgebaut.
  const NACHT_BLOECKE = 40;
  const HIMMEL = [
    { t: 0, oben: "#79c7ee", unten: "#dff2fc" },
    { t: 0.3, oben: "#6aaee2", unten: "#ffe6b8" },
    { t: 0.55, oben: "#b96a8f", unten: "#f6a463" },
    { t: 0.78, oben: "#4a3f74", unten: "#a86a84" },
    { t: 1, oben: "#141c38", unten: "#2c3a63" },
  ];

  // Wie viele, sagt das Wagen-Set: fünf im ersten, neun im zweiten (kids.js).
  const RUNS_FOR_DONE = window.LernappKids?.wagonRounds?.() || 5;
  const TOP_COUNT = 5;

  const HELP = [
    "Turmbau. Über dem Turm schwingt ein Block hin und her.",
    "Tippe irgendwo aufs Bild, dann fällt er herunter.",
    "Was auf dem Block darunter aufliegt, bleibt liegen. Was übersteht, bricht ab.",
    "Der nächste Block ist dann nur noch so breit wie das, was liegen geblieben ist.",
    "Triffst du genau, bleibt der Block ganz breit – und nach drei genauen Treffern bekommst du sogar ein Stück Breite zurück.",
    "Je höher der Turm, desto schneller schwingt der Block.",
    "Erst wenn du ganz daneben triffst, ist der Turm fertig.",
    "Zeit hast du so viel du willst.",
  ].join(" ");

  // ---------------------------------------------------------------------------
  // Bestenliste – lokal und in der Cloud
  // ---------------------------------------------------------------------------
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.turmbau", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
    : {
      read: () => ({ runs: 0, scores: [] }),
      write(data) { return data; },
      update(fn) { return fn(this.read()); },
      onChange() { return () => {}; },
    };

  function recordRun(score) {
    return store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), score].sort((a, b) => b - a).slice(0, TOP_COUNT),
    }));
  }

  // ---------------------------------------------------------------------------
  // Kleine Rechnungen
  // ---------------------------------------------------------------------------
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  // Weiche Überblendung zwischen 0 und 1 – ohne Knick an den Enden.
  function sanft(von, bis, wert) {
    const k = clamp((wert - von) / (bis - von || 1), 0, 1);
    return k * k * (3 - 2 * k);
  }

  // Immer dieselbe Zahl zu derselben Eingabe: die Sterne sollen bei jedem
  // Neustart am selben Platz stehen, sonst springt der Himmel.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Mischt zwei Farben. shade(farbe, 0) ändert nichts an der Farbe, bringt aber
  // jede Kurzschreibweise auf sechs Stellen – danach lassen sich die Kanäle
  // paarweise lesen.
  function mischeFarbe(a, b, k) {
    const rgbA = art.shade(a, 0).replace("#", "");
    const rgbB = art.shade(b, 0).replace("#", "");
    const teile = [0, 2, 4].map((i) => {
      const va = parseInt(rgbA.slice(i, i + 2), 16);
      const vb = parseInt(rgbB.slice(i, i + 2), 16);
      return Math.round(va + (vb - va) * k).toString(16).padStart(2, "0");
    });
    return `#${teile.join("")}`;
  }

  // Die zwei Himmelsfarben zur Höhe t (0 = Tag, 1 = Nacht).
  function himmelFarben(t) {
    let i = 0;
    while (i < HIMMEL.length - 2 && t > HIMMEL[i + 1].t) i += 1;
    const von = HIMMEL[i];
    const bis = HIMMEL[i + 1];
    const k = clamp((t - von.t) / (bis.t - von.t), 0, 1);
    return { oben: mischeFarbe(von.oben, bis.oben, k), unten: mischeFarbe(von.unten, bis.unten, k) };
  }

  // Sterne und Wolken sind auf Vorrat gerechnet; wie viele davon am Himmel
  // stehen, sagt die Form der Baustelle. Auf einem Handy quer ist doppelt so
  // viel Himmel im Bild wie auf einem quadratischen – mit derselben Handvoll
  // Sterne wäre die Nacht dort halb so dicht besetzt. Die ersten sind immer
  // dieselben, es kommen nur welche dazu.
  const STERNE_JE_QUADRAT = 46;
  const WOLKEN_JE_QUADRAT = 4;
  const wieViele = (jeQuadrat, vorrat) =>
    Math.min(vorrat.length, Math.round(jeQuadrat * clamp(view.cssW / Math.max(1, view.cssH), 1, 2.4)));

  const STERNE = [...Array(112).keys()].map((i) => ({
    x: hash01(i * 3.7),
    y: hash01(i * 7.3 + 1),
    r: 0.6 + hash01(i * 11.1) * 1.1,
    ph: hash01(i * 5.5) * Math.PI * 2,
  }));

  const WOLKEN = [...Array(10).keys()].map((i) => ({
    x: hash01(i * 2.3),
    y: 0.1 + hash01(i * 9.1) * 0.5,
    r: 16 + hash01(i * 4.4) * 14,
    v: 0.006 + hash01(i * 6.6) * 0.008,
  }));

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase: "bereit" (der Block schwingt, noch ist nichts gefallen)
  //        "spiel"  (es wird gestapelt)
  //        "ende"   (der Turm fällt, die Tafel kommt gleich)
  const state = {
    phase: "bereit",
    punkte: 0,
    combo: 0,
    perfekte: 0,          // genaue Treffer hintereinander, für die Breite zurück
    breite: START_W,      // Breite des nächsten Blocks
    bloecke: [],
    teile: [],            // abgebrochene Stücke, die noch fallen
    funken: [],
    schweber: null,
    camX: 0,
    camY: -GRUND,
    himmel: 0,
    stoss: 0,
    zeit: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let prompt = null;
  let combo = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, h: 400 };

  // ---------------------------------------------------------------------------
  // Die Welt in der Breite
  // ---------------------------------------------------------------------------
  // Hier steht alles, was quer misst, noch einmal – diesmal nicht als feste
  // Zahl, sondern so breit, wie die Baustelle es gerade zulässt. welt.mass sagt,
  // um wie viel das mehr ist als das Grundmass. Weil jedes Mass quer denselben
  // Faktor bekommt, ändert sich am Spiel nichts: der Block ist immer derselbe
  // Anteil des Bildes, sein Bogen immer derselbe Anteil des Blocks, und die
  // Zeit für eine Schwingung steht ohnehin in Sekunden.
  const welt = {
    w: WELT_W,
    mass: 1,
    startW: START_W,
    kleinsteW: KLEINSTE_W,
    sockelW: SOCKEL_W,
    perfektMin: PERFEKT_MIN,
    bonus: BONUS,
    weiteStart: WEITE_START,
    weiteSchritt: WEITE_SCHRITT,
    weiteMin: WEITE_MIN,
    rand: RAND,
  };

  // Was schon steht, wird mitgezogen. Ohne das stünde nach dem Drehen des
  // Geräts ein Turm aus zu schmalen Blöcken auf einem zu breiten Sockel – und
  // der schwingende Block schwänge über einem Turm, den es so nicht mehr gibt.
  // Gestreckt wird allein quer; alle Höhen bleiben, wie sie sind.
  function weltStrecken(faktor) {
    state.breite *= faktor;
    state.camX *= faktor;
    state.bloecke.forEach((block) => { block.x *= faktor; block.w *= faktor; });
    state.teile.forEach((teil) => { teil.x *= faktor; teil.w *= faktor; teil.vx *= faktor; });
    state.funken.forEach((funke) => { funke.x *= faktor; funke.vx *= faktor; });
    const s = state.schweber;
    if (s) { s.x *= faktor; s.w *= faktor; s.mitte *= faktor; s.weite *= faktor; }
  }

  // Die Welt auf eine neue Breite bringen. Kommt aus messen(), also beim Start,
  // beim Drehen des Geräts und beim Ziehen am Fenster.
  function weltBreite(gewuenscht) {
    const breit = clamp(gewuenscht, WELT_W, WELT_W_MAX);
    const faktor = breit / welt.w;
    if (Math.abs(faktor - 1) < 0.001) return;
    welt.w = breit;
    welt.mass = breit / WELT_W;
    welt.startW = START_W * welt.mass;
    welt.kleinsteW = KLEINSTE_W * welt.mass;
    welt.sockelW = SOCKEL_W * welt.mass;
    welt.perfektMin = PERFEKT_MIN * welt.mass;
    welt.bonus = BONUS * welt.mass;
    welt.weiteStart = WEITE_START * welt.mass;
    welt.weiteSchritt = WEITE_SCHRITT * welt.mass;
    welt.weiteMin = WEITE_MIN * welt.mass;
    welt.rand = RAND * welt.mass;
    weltStrecken(faktor);
  }

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  const spitze = () => {
    const oben = state.bloecke[state.bloecke.length - 1];
    return oben ? oben.y + oben.h : 0;
  };

  // ---------------------------------------------------------------------------
  // Die Baustelle
  // ---------------------------------------------------------------------------
  // Der Platz füllt, was die Bühne hergibt; die Baustelle darin steht hochkant
  // in der Mitte. Ein Turm auf einer breiten, flachen Fläche wäre nach drei
  // Blöcken schon oben – die Höhe ist hier das Mass, nicht die Breite.
  function buildPlatz() {
    const platz = shell.el("div", "tb-platz");
    feld = shell.el("div", "tb-feld");
    canvas = document.createElement("canvas");
    canvas.className = "tb-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Der Zähler oben rechts sagt schon, wie viele Blöcke liegen. Die Reihe
    // genauer Treffer sagt er nicht – dafür steht diese Marke im Bild, und nur
    // solange die Reihe hält.
    combo = shell.el("span", "tb-combo");
    combo.setAttribute("aria-hidden", "true");
    feld.append(combo);

    // Wortloser Hinweis für den ersten Tipp: ein Ring, der aufgeht, und ein
    // Punkt darin. Er verschwindet mit dem ersten Block.
    const tipp = shell.el("span", "tb-tipp");
    tipp.setAttribute("aria-hidden", "true");
    tipp.append(art.el("svg", { viewBox: "0 0 64 64" }, [
      art.el("circle", { class: "tb-tipp-ring", cx: 32, cy: 32, r: 14, fill: "none", stroke: "#ffffff", "stroke-width": 4 }),
      art.el("circle", { class: "tb-tipp-ring is-spaet", cx: 32, cy: 32, r: 14, fill: "none", stroke: "#ffffff", "stroke-width": 4 }),
      art.el("circle", { cx: 32, cy: 32, r: 9, fill: "#ffffff" }),
    ]));
    feld.append(tipp);
    platz.append(feld);
    return platz;
  }

  // Grösse der Leinwand. Immer SICHT_H Einheiten Welt stehen im Bild; wie breit
  // die Welt dazu ist, hängt am Seitenverhältnis der Baustelle. Auf einem hohen
  // Bild bleibt es beim Grundmass, und dann steht eben mehr Turm im Bild.
  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    // Erst die Welt, dann der Massstab – der hängt an ihrer Breite.
    weltBreite(SICHT_H * (cssW / cssH));
    view.s = cssW / welt.w;
    view.h = cssH / view.s;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
  }

  // Bildkoordinaten: von links oben, in Bildpunkten. Für den Himmel.
  function bildTransform() {
    const y = ruhig() ? 0 : -3 * state.stoss;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, y * view.dpr);
  }

  // Weltkoordinaten: Nullpunkt auf dem Boden in der Bildmitte, y nach oben.
  // Alles, was im Turm steht, wird darin gezeichnet – die Kamera steckt in
  // dieser einen Transformation, es muss nichts umgerechnet werden.
  function weltTransform() {
    const f = view.s * view.dpr;
    const y = ruhig() ? 0 : -3 * state.stoss;
    g.setTransform(f, 0, 0, -f,
      (view.cssW / 2 - view.s * state.camX) * view.dpr,
      (view.cssH + view.s * state.camY + y) * view.dpr);
  }

  // Ein Rechteck mit runden Ecken, ohne roundRect: das kennen alte Browser
  // noch nicht, und die App läuft auch auf alten Geräten.
  function rundRect(x, y, w, h, r) {
    const rad = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    g.beginPath();
    g.moveTo(x + rad, y);
    g.lineTo(x + w - rad, y);
    g.quadraticCurveTo(x + w, y, x + w, y + Math.sign(h) * rad);
    g.lineTo(x + w, y + h - Math.sign(h) * rad);
    g.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    g.lineTo(x + rad, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - Math.sign(h) * rad);
    g.lineTo(x, y + Math.sign(h) * rad);
    g.quadraticCurveTo(x, y, x + rad, y);
    g.closePath();
  }

  // ---------------------------------------------------------------------------
  // Himmel, Sonne, Mond, Wolken, Hügel
  // ---------------------------------------------------------------------------
  function zeichneHimmel() {
    bildTransform();
    const t = state.himmel;
    const farben = himmelFarben(t);
    const verlauf = g.createLinearGradient(0, 0, 0, view.cssH);
    verlauf.addColorStop(0, farben.oben);
    verlauf.addColorStop(1, farben.unten);
    g.fillStyle = verlauf;
    g.fillRect(0, -8, view.cssW, view.cssH + 16);

    // Wie weit der Himmel mitgezogen ist: je höher der Turm, desto tiefer
    // rutschen Sterne, Wolken und Hügel im Bild. Sie ziehen langsamer nach als
    // der Turm – daher sehen sie weit weg aus.
    const par = ruhig() ? 0 : (state.camY + GRUND) * view.s;

    // Sonne und Mond messen an der kürzeren Seite der Baustelle, nicht an der
    // Breite: auf einem Handy quer ist die Baustelle doppelt so breit wie hoch,
    // und eine Sonne nach ihrer Breite füllte dort das halbe Bild.
    const kurz = Math.min(view.cssW, view.cssH);

    const sterneAuf = sanft(0.48, 0.85, t);
    if (sterneAuf > 0.01) {
      const band = view.cssH * 1.4;
      const wieVieleSterne = wieViele(STERNE_JE_QUADRAT, STERNE);
      g.fillStyle = "#ffffff";
      for (let i = 0; i < wieVieleSterne; i += 1) {
        const stern = STERNE[i];
        const funkeln = ruhig() ? 0.85 : 0.55 + 0.45 * Math.sin(state.zeit * 1.6 + stern.ph);
        g.globalAlpha = sterneAuf * funkeln;
        const y = ((stern.y * band + par * 0.22) % band + band) % band;
        g.beginPath();
        g.arc(stern.x * view.cssW, y, stern.r, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }

    // Die Sonne sinkt, der Mond steigt. Der Zahlenstand allein trägt kein
    // Erfolgsgefühl; dass es draussen Abend wird, schon.
    //
    // Die Sonne steht links, nicht rechts: rechts oben in der Landschaft hinter
    // der Baustelle steht schon eine, und zwei Sonnen dicht übereinander sehen
    // nach Versehen aus.
    const sonneAuf = 1 - sanft(0.46, 0.66, t);
    if (sonneAuf > 0.01) {
      const x = view.cssW * 0.27;
      const y = view.cssH * (0.15 + 1.05 * sanft(0, 0.62, t));
      const r = kurz * 0.075;
      schein(x, y, r * 2.4, "rgba(255, 232, 150, 0.55)", sonneAuf);
      g.globalAlpha = sonneAuf;
      g.fillStyle = "#ffe38a";
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }

    const mondAuf = sanft(0.44, 0.68, t);
    if (mondAuf > 0.01) {
      const x = view.cssW * 0.73;
      const y = view.cssH * (1.08 - 0.86 * sanft(0.42, 1, t));
      const r = kurz * 0.082;
      schein(x, y, r * 2.1, "rgba(255, 248, 216, 0.4)", mondAuf);
      g.globalAlpha = mondAuf;
      g.fillStyle = "#f8f3dd";
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      // Voller Mond mit drei Kratern, keine Sichel: eine Sichel ist bei dieser
      // Grösse nur noch ein heller Strich, ein runder Mond bleibt ein Mond.
      g.fillStyle = "#e4dcc0";
      [[-0.3, -0.22, 0.26], [0.28, 0.18, 0.19], [0.02, 0.42, 0.13]].forEach(([dx, dy, kr]) => {
        g.beginPath();
        g.arc(x + dx * r, y + dy * r, kr * r, 0, Math.PI * 2);
        g.fill();
      });
      g.globalAlpha = 1;
    }

    const wolkenAuf = (1 - sanft(0.3, 0.62, t)) * 0.9;
    if (wolkenAuf > 0.01) {
      const band = view.cssH * 0.95;
      const wieVieleWolken = wieViele(WOLKEN_JE_QUADRAT, WOLKEN);
      g.globalAlpha = wolkenAuf;
      g.fillStyle = "#ffffff";
      for (let i = 0; i < wieVieleWolken; i += 1) {
        const wolke = WOLKEN[i];
        const treib = ruhig() ? 0 : state.zeit * wolke.v;
        const x = (((wolke.x + treib) % 1.3) - 0.15) * view.cssW;
        const y = ((wolke.y * band + par * 0.4) % band + band) % band;
        const r = wolke.r * view.s;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.arc(x + r * 0.9, y - r * 0.3, r * 0.78, 0, Math.PI * 2);
        g.arc(x + r * 1.75, y + r * 0.05, r * 0.62, 0, Math.PI * 2);
        g.arc(x + r * 0.85, y + r * 0.42, r * 0.72, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }

    // Zwei Reihen Hügel am Fuss des Bildes. Sie sinken mit der Höhe weg – das
    // ist das Zeichen, dass der Turm wirklich steigt, und nicht nur die Zahl.
    const dunkel = sanft(0.4, 1, t);
    huegel(view.cssH - 8 * view.s + par * 0.2, 26 * view.s, 3, mischeFarbe("#7cb98d", "#2c3a52", dunkel), 0.6);
    huegel(view.cssH + 10 * view.s + par * 0.42, 34 * view.s, 2, mischeFarbe("#57a26b", "#1e2a3e", dunkel), 2.1);
  }

  // Ein weicher Schein um Sonne und Mond. Eine Scheibe mit halber Deckung
  // hätte einen Rand, und der sähe aus wie ein zweiter Kreis.
  function schein(x, y, r, farbe, deckung) {
    const verlauf = g.createRadialGradient(x, y, r * 0.35, x, y, r);
    verlauf.addColorStop(0, farbe);
    verlauf.addColorStop(1, "rgba(255, 255, 255, 0)");
    g.globalAlpha = deckung;
    g.fillStyle = verlauf;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }

  function huegel(y, hoehe, wellen, farbe, versatz) {
    if (y - hoehe > view.cssH + 4) return;
    g.fillStyle = farbe;
    g.beginPath();
    g.moveTo(0, view.cssH + 12);
    const schritte = 22;
    for (let i = 0; i <= schritte; i += 1) {
      const k = i / schritte;
      g.lineTo(k * view.cssW, y - Math.abs(Math.sin(k * Math.PI * wellen + versatz)) * hoehe);
    }
    g.lineTo(view.cssW, view.cssH + 12);
    g.closePath();
    g.fill();
  }

  // ---------------------------------------------------------------------------
  // Boden und Blöcke
  // ---------------------------------------------------------------------------
  function zeichneBoden() {
    // Nur solange der Boden noch im Bild ist – oben im Turm gibt es keinen.
    if (state.camY > 4) return;
    g.fillStyle = "#7a5b3c";
    g.fillRect(-welt.w, -GRUND - 60, welt.w * 2, GRUND + 60);
    g.fillStyle = "#5f9f52";
    g.fillRect(-welt.w, -15, welt.w * 2, 15);
    g.fillStyle = "#78b863";
    g.fillRect(-welt.w, -5, welt.w * 2, 5);
  }

  function zeichneBlock(block) {
    // Beim Aufsetzen wird der Block kurz flach gedrückt und breit – der Stoss
    // muss zu sehen sein, sonst klebt der Block einfach am Turm.
    const k = block.stauch || 0;
    const w = block.w * (1 + 0.12 * k);
    const h = block.h * (1 - 0.2 * k);
    const wackel = block.wackel ? Math.sin(state.zeit * 26) * 3.2 * block.wackel : 0;
    const x = block.x + wackel - w / 2;
    const r = Math.min(5, h * 0.32);

    rundRect(x, block.y, w, h, r);
    g.fillStyle = block.farbe;
    g.fill();
    // Eine helle Kante oben und eine dunkle unten: daran ist zu sehen, wo ein
    // Block endet und der nächste anfängt, auch wenn zwei Farben nah liegen.
    rundRect(x + 2, block.y + h - Math.min(5, h * 0.28), w - 4, Math.min(5, h * 0.28), 2);
    g.fillStyle = art.shade(block.farbe, 0.3);
    g.fill();
    g.fillStyle = art.shade(block.farbe, -0.24);
    g.fillRect(x + 2, block.y, w - 4, Math.min(2.6, h * 0.14));

    // Das Leuchten nach einem genauen Treffer: ein Ring, der aufgeht und
    // verblasst. Nur dort – sonst wäre es kein Lob mehr, sondern Tapete.
    if (block.glanz > 0) {
      const auf = 1 - block.glanz;
      g.globalAlpha = block.glanz;
      g.strokeStyle = "#fff8dc";
      g.lineWidth = 2.6;
      rundRect(x - 2 - 8 * auf, block.y - 2 - 8 * auf, w + 4 + 16 * auf, h + 4 + 16 * auf, r + 4);
      g.stroke();
      g.globalAlpha = 1;
    }
  }

  function zeichneSockel(block) {
    const x = block.x - block.w / 2;
    rundRect(x, block.y, block.w, block.h, 5);
    g.fillStyle = SOCKEL_FARBE;
    g.fill();
    g.fillStyle = art.shade(SOCKEL_FARBE, 0.26);
    g.fillRect(x + 3, block.y + block.h - 4, block.w - 6, 4);
    // Ein paar Fugen, damit das Fundament aus Stein aussieht und nicht aus
    // demselben Zeug wie die Blöcke darüber.
    g.strokeStyle = art.shade(SOCKEL_FARBE, -0.22);
    g.lineWidth = 1.6;
    g.beginPath();
    for (let i = 1; i < 4; i += 1) {
      const fx = x + (block.w * i) / 4;
      g.moveTo(fx, block.y + 3);
      g.lineTo(fx, block.y + block.h - 5);
    }
    g.stroke();
  }

  function zeichneTeil(teil) {
    g.save();
    g.translate(teil.x, teil.y + teil.h / 2);
    g.rotate(teil.dreh);
    rundRect(-teil.w / 2, -teil.h / 2, teil.w, teil.h, Math.min(4, teil.h * 0.3));
    g.fillStyle = teil.farbe;
    g.fill();
    g.fillStyle = art.shade(teil.farbe, -0.22);
    g.fillRect(-teil.w / 2 + 1, -teil.h / 2, teil.w - 2, Math.min(2.4, teil.h * 0.14));
    g.restore();
  }

  function zeichnen() {
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    zeichneHimmel();

    weltTransform();
    zeichneBoden();

    // Nur zeichnen, was im Bild liegt: ein Turm mit hundert Blöcken hat
    // neunzig, die niemand mehr sieht.
    const untenGrenze = state.camY - 20;
    const obenGrenze = state.camY + view.h + 20;
    state.bloecke.forEach((block) => {
      if (block.y + block.h < untenGrenze || block.y > obenGrenze) return;
      if (block.sockel) zeichneSockel(block);
      else zeichneBlock(block);
    });

    state.teile.forEach(zeichneTeil);

    const s = state.schweber;
    if (s) {
      g.globalAlpha = 1 - s.einzug;
      zeichneBlock({ ...s, y: s.y + s.einzug * 20, stauch: 0, glanz: 0 });
      g.globalAlpha = 1;
    }

    state.funken.forEach((funke) => {
      const k = funke.leben / funke.max;
      g.globalAlpha = clamp(k, 0, 1);
      g.fillStyle = funke.farbe;
      g.beginPath();
      g.arc(funke.x, funke.y, funke.r * k, 0, Math.PI * 2);
      g.fill();
    });
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------------
  // Der nächste Block
  // ---------------------------------------------------------------------------
  // Schwung und Weite hängen an der Zahl der schon gestapelten Blöcke, nicht an
  // der Zeit: wer lange überlegt, soll dadurch nichts schwerer bekommen.
  function schwungFuer(n) {
    let periode = clamp(PERIODE_START * Math.pow(PERIODE_RAMPE, n), PERIODE_MIN, PERIODE_START);
    if (n >= ZITTER_AB) periode *= 1 + (Math.random() - 0.5) * ZITTER;
    return periode;
  }

  function weiteFuer(n, breite) {
    // Nach innen begrenzt vom Bildrand: der Block darf nie halb aus dem Bild
    // schwingen, sonst wäre er im Moment des Tipps nicht zu sehen.
    const platz = welt.w / 2 - breite / 2 - welt.rand;
    return Math.max(welt.weiteMin, Math.min(platz, welt.weiteStart + n * welt.weiteSchritt));
  }

  function neuerSchweber() {
    const unten = state.bloecke[state.bloecke.length - 1];
    const n = state.punkte;
    // Von links und von rechts abwechselnd: immer von derselben Seite wäre der
    // erste Bogen jedes Blocks derselbe.
    const seite = n % 2 === 0 ? -1 : 1;
    const weite = weiteFuer(n, state.breite);
    state.schweber = {
      x: unten.x + seite * weite,
      y: spitze() + SCHWEBE,
      w: state.breite,
      h: BLOCK_H,
      farbe: FARBEN[(state.bloecke.length - 1) % FARBEN.length],
      // Die Schwingung ist auf den Block darunter zentriert: genau in der
      // Mitte des Bogens sitzt der Block genau richtig.
      mitte: unten.x,
      weite,
      periode: schwungFuer(n),
      phase: seite < 0 ? -Math.PI / 2 : Math.PI / 2,
      einzug: 1,
      fallend: false,
      vy: 0,
      stauch: 0,
      glanz: 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Fallen lassen und abgleichen
  // ---------------------------------------------------------------------------
  function tap() {
    if (state.phase === "bereit") {
      state.phase = "spiel";
      shell.setPhase("play");
    }
    if (state.phase !== "spiel") return;
    const s = state.schweber;
    if (!s || s.fallend || s.einzug > 0.5) return;
    s.fallend = true;
    s.vy = -40;            // ein kleiner Anschub, damit der Fall gleich anspringt
    kids()?.vibrate?.(10);
  }

  function funkenSpruehen(x, y, farbe, anzahl) {
    for (let i = 0; i < anzahl; i += 1) {
      const winkel = Math.PI * (0.15 + Math.random() * 0.7);
      const tempo = 40 + Math.random() * 90;
      state.funken.push({
        x: x + (Math.random() - 0.5) * 20,
        y,
        vx: Math.cos(winkel) * tempo * (Math.random() < 0.5 ? -1 : 1),
        vy: Math.sin(winkel) * tempo,
        r: 1.6 + Math.random() * 2.2,
        leben: 0.45 + Math.random() * 0.25,
        max: 0.7,
        farbe,
      });
    }
  }

  function zeigeCombo() {
    if (!combo) return;
    if (state.combo < 2) { combo.classList.remove("is-an"); return; }
    combo.textContent = `×${state.combo}`;
    // Klasse abnehmen, Auslegung erzwingen, Klasse wieder dran: nur so springt
    // die Animation bei jedem weiteren Treffer neu an.
    combo.classList.remove("is-an", "is-pop");
    void combo.offsetWidth;
    combo.classList.add("is-an", "is-pop");
  }

  function landen() {
    const s = state.schweber;
    const unten = state.bloecke[state.bloecke.length - 1];
    s.fallend = false;
    s.y = spitze();
    state.schweber = null;

    const a1 = unten.x - unten.w / 2;
    const a2 = unten.x + unten.w / 2;
    const b1 = s.x - s.w / 2;
    const b2 = s.x + s.w / 2;
    const links = Math.max(a1, b1);
    const rechts = Math.min(a2, b2);
    const versatz = s.x - unten.x;
    const genau = Math.abs(versatz) <= Math.max(welt.perfektMin, s.w * PERFEKT_ANTEIL);

    if (genau) {
      s.x = unten.x;
    } else {
      // Was übersteht, bricht ab und fällt sichtbar aus dem Bild – nicht
      // einfach weg. Ein Kind soll sehen, was es gekostet hat.
      if (b1 < links) abbrechen(b1, links, s, -1);
      if (b2 > rechts) abbrechen(rechts, b2, s, 1);
      s.x = (links + rechts) / 2;
      s.w = Math.max(welt.kleinsteW, rechts - links);
    }

    s.stauch = 1;
    unten.stauch = Math.max(unten.stauch || 0, 0.4);
    state.bloecke.push(s);

    state.punkte += 1;
    shell.setCount(state.punkte);

    if (genau) {
      state.combo += 1;
      state.perfekte += 1;
      s.glanz = 1;
      state.stoss = 1;
      funkenSpruehen(s.x, s.y, "#fff3c4", 10);
      zeigeCombo();
      kids()?.playJingle?.("correct");
      kids()?.vibrate?.(24);
      // Drei genaue Treffer hintereinander: ein Stück Breite zurück, aber
      // nie über die Anfangsbreite hinaus.
      if (state.perfekte % BONUS_NACH === 0 && state.breite < welt.startW) {
        state.breite = Math.min(welt.startW, s.w + welt.bonus);
        funkenSpruehen(s.x, s.y + s.h, "#ffffff", 12);
        kids()?.playJingle?.("unlock");
      } else {
        state.breite = s.w;
      }
    } else {
      state.combo = 0;
      state.perfekte = 0;
      zeigeCombo();
      state.breite = s.w;
      kids()?.playJingle?.("star");
      kids()?.vibrate?.(12);
    }

    neuerSchweber();
  }

  // richtung: -1 = das Stück steht links über, 1 = rechts. Ausdrücklich
  // mitgegeben und nicht aus der Lage geschlossen: bei einem Versatz von mehr
  // als der halben Breite liegt auch das rechte Stück links von der Mitte des
  // gefallenen Blocks.
  function abbrechen(von, bis, block, richtung) {
    const w = bis - von;
    if (w <= 0.4) return;
    const nachRechts = richtung > 0;
    state.teile.push({
      x: (von + bis) / 2,
      y: block.y,
      w,
      h: block.h,
      farbe: block.farbe,
      vx: (nachRechts ? 1 : -1) * (24 + w * 0.5),
      vy: 30,
      dreh: 0,
      // Das Stück kippt über die Kante, an der es abgebrochen ist – nach
      // aussen, nicht in den Turm hinein.
      vdreh: (nachRechts ? -1 : 1) * (1.8 + Math.random() * 1.2),
    });
  }

  // ---------------------------------------------------------------------------
  // Turm fertig
  // ---------------------------------------------------------------------------
  // Nie abrupt: erst fällt sichtbar etwas, dann kommt die Tafel. Ein Bild, das
  // mitten in der Bewegung durch eine Tafel ersetzt wird, sieht nach Fehler
  // aus, nicht nach Spielende.
  function daneben() {
    const s = state.schweber;
    state.schweber = null;
    state.phase = "ende";
    const nachRechts = s.x > state.bloecke[state.bloecke.length - 1].x;
    state.teile.push({
      x: s.x, y: s.y, w: s.w, h: s.h, farbe: s.farbe,
      vx: nachRechts ? 26 : -26, vy: s.vy, dreh: 0,
      vdreh: (nachRechts ? -1 : 1) * 2.2,
    });
    const oben = state.bloecke[state.bloecke.length - 1];
    if (oben && !oben.sockel) oben.wackel = 1;
    state.combo = 0;
    zeigeCombo();
    kids()?.playJingle?.("retry");
    stepTimer = window.setTimeout(finish, ENDE_MS);
  }

  // ---------------------------------------------------------------------------
  // Die Schleife
  // ---------------------------------------------------------------------------
  function schritt(dt) {
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 1000 / STOSS_MS);

    // Der Himmel zieht der Höhe weich nach: sonst sprang die Farbe mit jedem
    // Block eine Stufe weiter.
    const hoehe = Math.max(0, spitze() - SOCKEL_H);
    const ziel = clamp(hoehe / (NACHT_BLOECKE * BLOCK_H), 0, 1);
    state.himmel += (ziel - state.himmel) * (1 - Math.exp(-2.5 * dt));

    // Der schwingende Block
    const s = state.schweber;
    if (s) {
      if (s.einzug > 0) s.einzug = Math.max(0, s.einzug - dt * 1000 / EINZUG_MS);
      if (s.fallend) {
        s.vy -= FALL_G * dt;
        s.y += s.vy * dt;
        const ziellinie = spitze();
        if (s.y <= ziellinie) {
          const unten = state.bloecke[state.bloecke.length - 1];
          const ueberlapp = Math.min(unten.x + unten.w / 2, s.x + s.w / 2)
            - Math.max(unten.x - unten.w / 2, s.x - s.w / 2);
          if (ueberlapp <= 0) daneben();
          else landen();
        }
      } else {
        s.phase += (Math.PI * 2 / s.periode) * dt;
        s.x = s.mitte + s.weite * Math.sin(s.phase);
        s.y = spitze() + SCHWEBE;
      }
    }

    // Abgebrochene Stücke
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const teil = state.teile[i];
      teil.vy -= FALL_G * 0.32 * dt;
      teil.x += teil.vx * dt;
      teil.y += teil.vy * dt;
      teil.dreh += teil.vdreh * dt;
      if (teil.y + teil.h < state.camY - 60) state.teile.splice(i, 1);
    }

    // Funken
    for (let i = state.funken.length - 1; i >= 0; i -= 1) {
      const funke = state.funken[i];
      funke.vy -= FALL_G * 0.22 * dt;
      funke.x += funke.vx * dt;
      funke.y += funke.vy * dt;
      funke.leben -= dt;
      if (funke.leben <= 0) state.funken.splice(i, 1);
    }

    // Stauchen, Leuchten, Wackeln laufen ab
    state.bloecke.forEach((block) => {
      if (block.stauch > 0) block.stauch = Math.max(0, block.stauch - dt * 1000 / STAUCH_MS);
      if (block.glanz > 0) block.glanz = Math.max(0, block.glanz - dt * 1000 / GLANZ_MS);
      if (block.wackel > 0) block.wackel = Math.max(0, block.wackel - dt * 2.2);
    });

    // Die Kamera. Exponentiell nachgezogen und mit dt gerechnet – so ist der
    // Weg derselbe, ob das Gerät 60 oder 120 Bilder je Sekunde zeichnet, und
    // es gibt keinen Sprung.
    const zielY = Math.max(-GRUND, spitze() - view.h * FOLGE_HOEHE);
    const k = 1 - Math.exp(-(ruhig() ? FOLGE_K_RUHIG : FOLGE_K) * dt);
    state.camY += (zielY - state.camY) * k;
    const zielX = state.bloecke[state.bloecke.length - 1]?.x ?? 0;
    state.camX += (zielX - state.camX) * k;
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    // Nach einem Tabwechsel liegt now weit vorn. Ohne die Schranke fiele der
    // Block in einem einzigen Schritt durch den halben Turm.
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    messen();
    schritt(dt);
    zeichnen();
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    clearStep();
    stopLoop();
    shell.closeOverlay();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.punkte = 0;
    state.combo = 0;
    state.perfekte = 0;
    state.bloecke = [];
    state.teile = [];
    state.funken = [];
    state.schweber = null;
    state.camX = 0;
    state.camY = -GRUND;
    state.himmel = 0;
    state.stoss = 0;
    state.zeit = 0;
    shell.setCount(0);

    shell.clear();
    prompt = shell.el("p", "cm-prompt tb-prompt", "Tippe – dann fällt der Block.");
    shell.play.append(prompt, buildPlatz());

    view.cssW = 0;
    view.cssH = 0;
    messen();

    // Erst jetzt, nach dem Messen: wie breit der erste Block ist, weiss die
    // Welt erst, wenn sie ihre Breite kennt.
    state.breite = welt.startW;
    state.bloecke.push({
      x: 0, y: 0, w: welt.sockelW, h: SOCKEL_H, farbe: SOCKEL_FARBE,
      sockel: true, stauch: 0, glanz: 0, wackel: 0,
    });
    neuerSchweber();
    zeigeCombo();

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function runsText(runs) {
    const left = RUNS_FOR_DONE - runs;
    if (left <= 0) return "Dieses Spiel ist geschafft – der Wagen ist gebaut.";
    return left === 1
      ? "Noch eine Runde bis zum fertigen Wagen."
      : `Noch ${left} Runden bis zum fertigen Wagen.`;
  }

  function resultSpeech(punkte, best, rekord, runs) {
    const turm = punkte === 0
      ? "Der erste Block ist daneben gegangen."
      : punkte === 1 ? "Dein Turm hat einen Block." : `Dein Turm hat ${punkte} Blöcke.`;
    // Warum der Turm fertig war, gehört dazu: wer nicht liest, sieht den
    // letzten Block fallen und hört hier, was ihn zu Fall gebracht hat. Beim
    // leeren Turm steht es schon im Satz davor.
    const warum = punkte === 0 ? "" : "Der letzte Block ist daneben gefallen.";
    const marke = rekord
      ? "Das ist dein neuer Rekord!"
      : best ? `Dein bester Turm hat ${best} Blöcke.` : "";
    return `${turm} ${warum} ${marke} ${runsText(runs)}`;
  }

  // Die Zahl auf der Tafel läuft von null hoch, statt gleich fertig dazu-
  // stehen: so ist der Turm noch einmal zu sehen, Block für Block.
  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(700, 120 + ziel * 45);
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
    clearStep();
    stopLoop();
    state.phase = "ende";
    const punkte = state.punkte;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    const next = recordRun(punkte);
    kids()?.playJingle?.("win");
    shell.showResult({
      label: "Deine Blöcke",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : (vorher ? `Bester Turm: ${vorher}` : null),
      scores: next.scores,
      top: TOP_COUNT,
      note: { text: runsText(next.runs), done: next.runs >= RUNS_FOR_DONE },
      speech: resultSpeech(punkte, vorher, rekord, next.runs),
    });
    // Das Rekord-Abzeichen ist derselbe Satz, nur hervorgehoben: eine eigene
    // Zeile mehr auf der Tafel hätte auf dem flachen Handy keinen Platz.
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("tb-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  // Kein Erklärbild und kein Startknopf: der Block schwingt schon, und der
  // erste Tipp lässt ihn fallen. Was zu tun ist, sagt der Lautsprecher.
  shell = shellApi.mount({
    host,
    title: "Turmbau",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    help: HELP,
    clock: false,
    onRestart: startRun,
  });

  startRun();

  // --- Eingabe ---------------------------------------------------------------
  // Getippt wird auf der ganzen Bühne, nicht nur auf der Baustelle: der Block
  // schwingt schnell, und eine kleine Fläche trifft ein Kind dabei nicht. Nur
  // die Knöpfe oben bleiben Knöpfe.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    tap();
  });

  // Leertaste für den Rechner. Steht der Finger gerade auf einem Knopf, gilt
  // die Taste dem Knopf – sonst liesse sich die Bestenliste nicht mehr
  // verlassen.
  document.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (state.phase === "bereit" || state.phase === "spiel") tap();
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  // Nach aussen sichtbar für die Prüfskripte. state ist absichtlich dabei:
  // scripts/check-handy.mjs muss die Ergebnistafel anfahren, und wo der Block
  // gerade schwingt, lässt sich von aussen nicht abwarten.
  window.LernappTurmbau = {
    WELT_W, SICHT_H, BLOCK_H, START_W, KLEINSTE_W, RUNS_FOR_DONE,
    welt, view,
    schwungFuer, weiteFuer, himmelFarben, state,
  };
})();
