/*
 * turmspringen.js – Turmspringen.
 * ---------------------------------------------------------------------------
 * Ein Sprungturm aus Stahl steht in einem Bergsee, die Alpen dahinter. Eine
 * Runde sind acht Sprünge, jeder von einer anderen Plattform: erst 8 bis
 * 11 Meter, zuletzt 24 bis 27. Gezählt werden die Punkte aller Sprünge. Die
 * Runde endet nach dem achten – oder beim ersten Klatscher oder der ersten
 * Arschbombe.
 *
 * Es gibt genau eine Regel:
 *
 *   Halten     heisst Päckchen: Er zieht die Knie an die Brust und dreht.
 *   Loslassen  heisst strecken: Er öffnet sich, und die Drehung hört auf –
 *              nicht schlagartig, sondern so, wie er aufgeht: Wer aus vollem
 *              Päckchen loslässt, dreht noch ein gutes Dutzend Grad nach.
 *
 * Ins Wasser geht es senkrecht, Kopf oder Füsse voran, und gestreckt. Den
 * Absprung macht er selbst, immer gleich: anlaufen, einmal wippen, ab.
 *
 * Jede halbe Drehung ist ein Punkt. Wer fast genau senkrecht und ganz
 * gestreckt eintaucht (PERFEKT), springt «perfekt»: Seine Punkte zählen
 * doppelt, und mehrere perfekte hintereinander dreifach, vierfach (bis
 * KETTE_MAX). Liegt er mehr als KLATSCH Grad daneben, ist es ein Bauch- oder
 * Rückenklatscher; ist er noch im Päckchen, eine Arschbombe. Beides beendet
 * die Runde. Wie viel er sich zutraut, entscheidet jeder selbst – mehr
 * Drehung bringt mehr, lässt aber weniger Zeit zum Öffnen.
 *
 * Wie hoch die Plattform ist, kommt aus dem Zufall (zufall.js), Sprung um
 * Sprung in einem Band, das mit jedem Sprung höher liegt: ohne Turnier jedes
 * Mal anders, im Turnier für alle im selben Versuch dieselben. Die Höhe
 * steht gross auf der Tafel und am Turm – sie sagt, wie viel Zeit zum Drehen
 * bleibt. Dazu wird es Abend, und die letzten Sprünge gehen unter Flutlicht
 * in die Nacht.
 *
 * Gerechnet wird in Metern: x nach vorne (rechts), y nach oben, die
 * Wasserfläche bei 0, die Kante der Plattform bei x = 0. Der Fall läuft um
 * TEMPO langsamer als in echt – sonst bliebe zum Öffnen keine Zeit.
 *
 * Bis November 2026 hatte dieses Spiel sieben Regeln: einen Ring an der
 * Kante, einen Drall, der nie aufhört, Böen, einen Kompass, eine Pflicht je
 * Höhe und drei Richter. Geblieben ist die eine, um die es ging.
 *
 * Das Bild ist seit dem 12. November 2026 neu, die Rechnung dieselbe: Es
 * springen abwechselnd eine Frau und ein Mann – Körper mit Gelenken statt
 * Strichen (FIGUREN, maleFigur). Der Anlauf ist ein Gang, bei dem kein Fuss
 * rutscht, der Absprung holt mit den Armen aus (bodenPose); im Päckchen
 * fassen die Hände die Schienbeine (flugPose). Beim Eintauchen schiesst
 * Wasser hoch – eine Krone aus Strahlen, Tropfen, Schaum und Ringe, unter
 * Wasser eine Schleppe aus Blasen (platsch) –, klein bei einem sauberen
 * Sprung, gewaltig bei der Arschbombe.
 *
 * Die Gegner (geist.js) springen als halb durchsichtige Springer mit – so,
 * wie sie in ihrer besten Runde gesprungen sind (a, b: Ort in Dezimetern,
 * die Sprünge hintereinander, ABSTAND Meter auseinander; c: die Drehung mal
 * 100). Zu sehen ist, wer gerade von derselben Plattform springt. Und die
 * besten Runden lassen sich anschauen (?zuschauen=, geist.js): mit derselben
 * Saat, also mit denselben Höhen.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "highdive") return;

  const host = document.querySelector("#ts-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur der Plan zieht daraus – die Höhen und der Wind. Spritzer,
  // Zuschauer und Funken nehmen Math.random, ebenso die Wahl, wer die Runde
  // beginnt: damit der Plan nicht davon abhängt, wie jemand springt.
  const zufall = window.LernappZufall?.fuer?.("highDive") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const TAKT = 1 / 240;            // gerechnet wird in festen kleinen Schritten
  const ABSTAND = 100;             // so weit liegen die Sprünge in der Aufzeichnung auseinander (m)
  const G = 9.81;
  const TEMPO = 0.8;               // der Fall läuft so viel langsamer als echt
  const SPRUENGE = 8;              // so viele Sprünge hat eine Runde
  // Aus welchem Band die Höhe jedes Sprungs gewürfelt wird (ganze Meter).
  const BAENDER = [[8, 11], [10, 13], [12, 15], [14, 17], [16, 19], [18, 21], [21, 24], [24, 27]];

  // Der Körper. Stehend liegt der Schwerpunkt so hoch über den Füssen.
  const SCHWERPUNKT = 1.0;
  const KANTE_X = -0.3;            // dort steht der Schwerpunkt an der Kante

  // Die Drehung (Grad/s) ganz im Päckchen. Wie schnell er dreht, folgt aus
  // dem Quadrat dessen, wie weit er zu ist: gestreckt gar nicht, halb offen
  // ein Viertel. Darum dreht er nach dem Loslassen nur noch ein wenig nach.
  const W_PAECK = 400;
  const SCHLIESSEN = 11;           // so schnell zieht er sich zusammen (1/s)
  const OEFFNEN = 14;              // so schnell streckt er sich (1/s)

  // Der Absprung: so schnell nach oben und nach vorne (m/s). Immer gleich.
  const V_AB = 4.2;
  const V_VOR = 1.3;
  const ABSPRUNG_NACH = 0.6;       // so lange wippt er an der Kante (s)

  // Das Eintauchen (Grad neben der Senkrechten).
  const PERFEKT = 10;              // so genau ist es «perfekt» …
  const OFFEN_GUT = 0.92;          // … wenn er dazu so weit gestreckt ist
  const KLATSCH = 30;              // weiter daneben ist es ein Klatscher
  const BOMBE = 0.35;              // weniger offen ist es eine Arschbombe
  const KETTE_MAX = 3;             // perfekt zählt ×2, in Folge bis ×(1 + KETTE_MAX)

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.turmspringen", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const rad = (d) => (d * Math.PI) / 180;
  const grad = (r) => (r * 180) / Math.PI;
  const glatt = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  const naeher = (wert, ziel, rate, dt) => wert + (ziel - wert) * (1 - Math.exp(-rate * dt));

  // Zwei Farben (#rrggbb) gemischt: k = 0 die erste, 1 die zweite.
  function mische(a, b, k) {
    const zahl = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
    const teil = (i) => Math.round(zahl(a, i) + (zahl(b, i) - zahl(a, i)) * k).toString(16).padStart(2, "0");
    return `#${teil(0)}${teil(1)}${teil(2)}`;
  }

  // Immer dieselbe Zahl zu derselben Eingabe: Sterne, Zuschauer, Wellen.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Halbe Saltos in Worten: 1 → «½», 3 → «1½», 4 → «2».
  function halbe(n) {
    if (n % 2 === 0) return String(n / 2);
    return `${n > 1 ? (n - 1) / 2 : ""}½`;
  }
  const saltos = (n) => `${halbe(n)} ${n <= 2 ? "Salto" : "Saltos"}`;

  // Die Tageszeit: Morgen, Mittag, Nachmittag, Abendrot, Dämmerung (mit
  // Flutlicht), Nacht – über die acht Sprünge verteilt.
  const tagBei = (n) => Math.min(5, Math.floor((n * 6) / SPRUENGE));
  const flutlichtBei = (n) => tagBei(n) >= 4;
  // Wie schnell er dreht: aus dem, wie weit er zu ist.
  const drehBei = (offen) => W_PAECK * (1 - offen) * (1 - offen);
  // Was ein Sprung bringt: halbe Drehungen, perfekt mal die Reihe.
  const malBei = (perfekt, kette) => (perfekt ? 1 + Math.min(kette, KETTE_MAX) : 1);

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts getippt), "spiel", "zuschauen", "ende"
  // schritt: "start" (hinten auf der Plattform), "laufen" (an die Kante),
  //          "wippen" (der Absprung), "flug", "wasser", "wechsel" (zum
  //          nächsten Sprung)
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,               // die Punkte aller Sprünge – die Zahl der Runde
    nr: 0,                   // der wievielte Sprung (ab 0)
    H: 10,                   // die Höhe dieses Sprungs (m)
    plan: [],                // Höhe und Wind je Sprung
    sprung: null,            // was bei diesem Sprung geschah
    sprunge: [],             // die Punkte der Sprünge bisher
    sp: null,                // der Springer
    halten: false,           // gedrückt: Päckchen
    kette: 0,                // perfekte Sprünge hintereinander
    besteKette: 0,
    perfekte: 0,
    startRest: 0,
    weiterIn: 0,
    aus: "",                 // warum die Runde endet: "klatscher", "bombe", "fertig"
    grund: "",
    blende: 0,               // schwarz zwischen zwei Sprüngen
    blendeZiel: 0,
    tv: null,                // die Anzeige unten
    figur: null,             // wer springt: die Frau oder der Mann (FIGUREN)
    erste: 0,                // wer die Runde beginnt
    wellen: [],              // Ringe auf dem Wasser
    platscher: [],           // das Wasser, das beim Eintauchen hochschiesst
    schaum: [],              // Schaum, der danach auf dem Wasser liegt
    teile: [],
    schriften: [],
    hilfe: "",               // im ersten Sprung: was jetzt zu tun ist
    jubel: 0,
    stoss: 0,
    blitz: 0,
    zeitlupe: 0,
    zeit: 0,
    echt: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  // Die Gegner (geist.js): wer als halb durchsichtiger Springer mitspringt.
  let gegner = null;
  // Wer eine Runde anschaut statt zu spielen (geist.js, zuschauer).
  let zuschauer = null;

  const view = { dpr: 1, cssW: 0, cssH: 0, frei: 0, nutzH: 0, minD: 1, ox: 0, oy: 0 };
  // Die Kamera: welcher Punkt der Welt in der Mitte der Fläche steht und wie
  // viele Bildpunkte ein Meter ist (z).
  const kam = { x: 0, y: 0, z: 30, ax: 0.5, ay: 0.4, bereit: false };

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Der Plan
  // ---------------------------------------------------------------------------
  /*
   * Je Sprung zieht der Plan genau ZAHLEN_JE_SPRUNG Zahlen, auch wenn er sie
   * nicht alle braucht – so hängt er nur an der Saat, nicht daran, wie weit
   * jemand kommt.
   *
   *   H       die Höhe der Plattform in ganzen Metern, aus dem Band des
   *           Sprungs (BAENDER)
   *   wind    nur für die Fahne: plus weht nach vorne, minus zurück
   */
  const ZAHLEN_JE_SPRUNG = 4;

  function neuerSprung(n) {
    const z = [];
    for (let i = 0; i < ZAHLEN_JE_SPRUNG; i += 1) z.push(zufall.zahl());
    const [von, bis] = BAENDER[Math.min(n, BAENDER.length - 1)];
    const H = Math.min(bis, von + Math.floor(z[0] * (bis - von + 1)));
    const wind = lerp(-1.2, 1.2, z[1]);
    return { n, H, wind };
  }

  function planBis(n) {
    while (state.plan.length <= n) state.plan.push(neuerSprung(state.plan.length));
  }

  // Die gewürfelte Welt in Worten: die Höhen aller Sprünge. Im Turnier
  // bekommen alle denselben Text.
  function weltText() {
    planBis(SPRUENGE - 1);
    return state.plan.slice(0, SPRUENGE).map((p) => `${p.H}m w${p.wind.toFixed(2)}`).join(" | ");
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  let promptKnoten = null;

  function buildPlatz() {
    feld = shell.el("div", "ts-feld");
    canvas = document.createElement("canvas");
    canvas.className = "ts-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");
    return feld;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    // Auf dem Handy reicht die Leinwand unter die Knöpfe oben (game-shell.js,
    // frei). Gemalt wird dort auch – aber der Springer steht darunter.
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    view.nutzH = cssH - frei;
    view.minD = Math.min(cssW, view.nutzH);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    bilder.schluessel = "";
    kam.bereit = false;
  }

  const wackelX = () => (ruhig() ? 0 : Math.sin(state.echt * 61) * 7 * state.stoss * state.stoss);
  const wackelY = () => (ruhig() ? 0 : Math.cos(state.echt * 47) * 7 * state.stoss * state.stoss);

  // Welt (Meter, y nach oben) auf die Leinwand (CSS-Pixel, y nach unten).
  // ox, oy stellt kameraSetzen einmal je Bild.
  const bildX = (x) => x * kam.z + view.ox;
  const bildY = (y) => view.oy - y * kam.z;

  function kameraSetzen() {
    view.ox = view.cssW / 2 - kam.x * kam.z + wackelX();
    view.oy = view.frei + view.nutzH / 2 + kam.y * kam.z + wackelY();
  }

  function flach() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  /*
   * Wohin die Kamera will. Auf der Plattform nah am Springer, die Tiefe unter
   * ihm im Bild. Im Fall etwas weiter, der Springer im oberen Drittel – unter
   * ihm kommt das Wasser herauf. Die Wasserlinie steigt dabei nie über
   * WASSER_OBEN: Kurz vor dem Eintauchen hält die Kamera an, und der
   * Springer fällt ins Bild hinein. Im Wasser steht die Linie in der Mitte.
   */
  const WASSER_OBEN = 0.66;
  function kameraZiel(sp, schritt) {
    const W = view.cssW;
    const H = view.nutzH;
    const quer = W > H;
    if (schritt === "start" || schritt === "laufen" || schritt === "wippen") {
      return { z: Math.min(H / 8.5, W / (quer ? 9 : 5.5)), ax: quer ? 0.42 : 0.5, ay: 0.36 };
    }
    if (schritt === "flug") {
      return { z: Math.min(H / 12, W / (quer ? 11 : 6.5)), ax: quer ? 0.44 : 0.5, ay: 0.34 };
    }
    return { z: Math.min(H / 10, W / (quer ? 12 : 7)), ax: quer ? 0.5 : 0.55, ay: 0.5, wasser: true };
  }

  function kameraTakt(dt, sp, schritt, sofort = false) {
    if (!sp) return;
    const ziel = kameraZiel(sp, schritt);
    if (sofort || !kam.bereit) {
      kam.z = ziel.z;
      kam.ax = ziel.ax;
      kam.ay = ziel.ay;
      kam.bereit = true;
    } else {
      kam.z = naeher(kam.z, ziel.z, ziel.z < kam.z ? 2.2 : 2.6, dt);
      kam.ax = naeher(kam.ax, ziel.ax, 2.2, dt);
      kam.ay = naeher(kam.ay, ziel.ay, 2.2, dt);
    }
    const H = view.nutzH;
    kam.x = sp.x + ((0.5 - kam.ax) * view.cssW) / kam.z;
    let y = sp.y - ((0.5 - kam.ay) * H) / kam.z;
    // Nie tiefer, als dass die Wasserlinie bei WASSER_OBEN steht – im Wasser
    // dann sanft auf die Mitte.
    const boden = ((WASSER_OBEN - 0.5) * H) / kam.z;
    if (ziel.wasser) {
      kam.wasserY = naeher(kam.wasserY ?? boden, 0, 2.4, dt);
      y = kam.wasserY;
    } else {
      kam.wasserY = Math.max(y, boden);
      y = kam.wasserY;
    }
    kam.y = y;
  }

  // ---------------------------------------------------------------------------
  // Die gemalten Bilder im Speicher
  // ---------------------------------------------------------------------------
  /*
   * Was weit weg ist, steht still oder zieht langsam: der Himmel, die
   * Alpen, die Voralpen und das Ufer gegenüber. Sie liegen je Tageszeit
   * fertig gemalt in Leinwänden (wie im Skispringen) – im Bild werden sie
   * nur kopiert. Gemalt wird eine Tageszeit erst, wenn sie gebraucht wird
   * (zwischen zwei Sprüngen, hinter der Blende), und nur eine liegt im
   * Speicher.
   *
   * see: der See vom Ufer gegenüber bis vorne; unter: unter Wasser, oben
   * und tief.
   */
  const TAGESZEITEN = [
    {
      name: "morgen",
      himmel: ["#41558f", "#c98fae", "#fdd6a6"],
      gestirn: { art: "sonne", fx: 0.18, fy: 0.5, r: 26, kern: "#fff3d6", hof: "rgba(255, 196, 140, 0.55)" },
      sterne: 0,
      wolke: "#ffe2d4",
      fern: { fels: "#8b84aa", schatten: "#5f5b86", schnee: "#ffeae2", schneeSchatten: "#b7a7cd", dunst: "rgba(253, 214, 186, 0.55)" },
      mitte: { grund: "#5d6d8e", hell: "#7383a3", schnee: "#e7e2ef", wald: "#3f5468" },
      nah: { grund: "#2f4a4c", wald: "#24403f", licht: "#ffd38a" },
      see: ["#d8b4bf", "#5d6f9e"], glanz: "#ffe1c4", unter: ["#2f6c82", "#0b2433"],
      bau: ["#c9c3d6", "#8e88a6"],
    },
    {
      name: "mittag",
      himmel: ["#1f63c7", "#5aa6ee", "#cfe7ff"],
      gestirn: { art: "sonne", fx: 0.78, fy: 0.12, r: 20, kern: "#fffbe8", hof: "rgba(255, 245, 200, 0.5)" },
      sterne: 0,
      wolke: "#ffffff",
      fern: { fels: "#7d8ea8", schatten: "#5a6a88", schnee: "#ffffff", schneeSchatten: "#bdd0ea", dunst: "rgba(214, 233, 255, 0.55)" },
      mitte: { grund: "#4f7088", hell: "#6a8ca0", schnee: "#f2f7fc", wald: "#2f5a4f" },
      nah: { grund: "#2e5a44", wald: "#1f4a37", licht: "#ffd38a" },
      see: ["#9fd4ea", "#1f7aa8"], glanz: "#ffffff", unter: ["#1d8c9c", "#04314a"],
      bau: ["#d6dbe3", "#8f9bab"],
    },
    {
      name: "nachmittag",
      himmel: ["#2f5fb3", "#86b1e2", "#f7e2bc"],
      gestirn: { art: "sonne", fx: 0.82, fy: 0.26, r: 22, kern: "#fff3cf", hof: "rgba(255, 220, 150, 0.55)" },
      sterne: 0,
      wolke: "#fff6e8",
      fern: { fels: "#8a8aa4", schatten: "#5d6182", schnee: "#fff9ee", schneeSchatten: "#c5c7de", dunst: "rgba(250, 232, 200, 0.55)" },
      mitte: { grund: "#5a6f86", hell: "#7a8ea0", schnee: "#f5f1ea", wald: "#355749" },
      nah: { grund: "#33533f", wald: "#244533", licht: "#ffd38a" },
      see: ["#cfdbe0", "#2f74a2"], glanz: "#fff4d8", unter: ["#24808f", "#062f42"],
      bau: ["#d8d4cf", "#958f8c"],
    },
    {
      name: "abendrot",
      himmel: ["#2a2766", "#c2517a", "#ffb066"],
      gestirn: { art: "sonne", fx: 0.86, fy: 0.5, r: 34, kern: "#ffd27a", hof: "rgba(255, 140, 80, 0.6)" },
      sterne: 0.15,
      wolke: "#ffb7a0",
      // Alpenglühen: Die Gipfel leuchten rosa.
      fern: { fels: "#7a5a86", schatten: "#4a3a6a", schnee: "#ffc6b0", schneeSchatten: "#a77aa6", dunst: "rgba(255, 160, 130, 0.45)" },
      mitte: { grund: "#4c3f6c", hell: "#6a4f7c", schnee: "#e6b9c6", wald: "#2e2a4e" },
      nah: { grund: "#28284a", wald: "#1c1d3a", licht: "#ffcf7a" },
      see: ["#f0a68e", "#4b3f74"], glanz: "#ffd27a", unter: ["#3b4d70", "#0c1830"],
      bau: ["#c9a8b4", "#7a6082"],
    },
    {
      name: "daemmerung",
      himmel: ["#0d1236", "#36307a", "#b85f88"],
      gestirn: null,
      sterne: 0.55,
      wolke: "#6c5a96",
      fern: { fels: "#3f3c70", schatten: "#2a2852", schnee: "#a9a5d8", schneeSchatten: "#6e6aa6", dunst: "rgba(150, 110, 170, 0.4)" },
      mitte: { grund: "#25285a", hell: "#30336a", schnee: "#8d8cc2", wald: "#181c40" },
      nah: { grund: "#141a38", wald: "#0e1430", licht: "#ffcf7a" },
      see: ["#9d6a98", "#22285a"], glanz: "#ffcf7a", unter: ["#1f2d52", "#060c20"],
      bau: ["#8e93b8", "#4e5480"],
    },
    {
      name: "nacht",
      himmel: ["#02040f", "#0a1236", "#1c2a5a"],
      gestirn: { art: "mond", fx: 0.22, fy: 0.16, r: 15, kern: "#f4f1ff", hof: "rgba(170, 180, 255, 0.28)" },
      sterne: 1,
      wolke: "#2c3766",
      fern: { fels: "#1f2550", schatten: "#151a3c", schnee: "#7c86b8", schneeSchatten: "#4b5488", dunst: "rgba(60, 80, 150, 0.35)" },
      mitte: { grund: "#141a3c", hell: "#1b2248", schnee: "#525c90", wald: "#0e1430" },
      nah: { grund: "#0b1028", wald: "#070b1e", licht: "#ffcf7a" },
      see: ["#28366a", "#070e28"], glanz: "#dfe4ff", unter: ["#0d1b3c", "#010510"],
      bau: ["#7a82aa", "#3d4470"],
    },
  ];

  const bilder = { schluessel: "", tage: new Map(), q: 1 };

  function leinwand(w, h, q) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w * q));
    c.height = Math.max(1, Math.ceil(h * q));
    const cg = c.getContext("2d");
    cg.scale(q, q);
    return { c, g: cg };
  }

  // Die Bilder einer Tageszeit – gemalt, wenn sie zum ersten Mal gebraucht
  // werden. Ändert sich die Grösse der Fläche, wird neu gemalt.
  function tagesBilder(i) {
    const schluessel = `${view.cssW}|${view.cssH}|${view.dpr}`;
    if (bilder.schluessel !== schluessel) {
      bilder.schluessel = schluessel;
      bilder.tage.clear();
      bilder.q = view.dpr;
    }
    let b = bilder.tage.get(i);
    if (!b) {
      bilder.tage.clear();
      b = maleTag(i);
      bilder.tage.set(i, b);
    }
    return b;
  }

  // So breit ist ein Streifen der Berge, bevor er sich wiederholt.
  const streifenBreite = () => Math.round(Math.max(view.cssW, 560) * 1.3);

  function maleTag(i) {
    const T = TAGESZEITEN[i];
    const q = bilder.q;
    const W = view.cssW;
    const H = view.cssH;
    const TW = streifenBreite();

    // Der Himmel: Verlauf, Gestirn mit Hof, Sterne.
    const himmel = leinwand(W, H, q);
    let cg = himmel.g;
    const verlauf = cg.createLinearGradient(0, 0, 0, H * 0.75);
    verlauf.addColorStop(0, T.himmel[0]);
    verlauf.addColorStop(0.6, T.himmel[1]);
    verlauf.addColorStop(1, T.himmel[2]);
    cg.fillStyle = verlauf;
    cg.fillRect(0, 0, W, H);
    if (T.sterne > 0) {
      cg.fillStyle = "#ffffff";
      const anzahl = Math.round((W * H) / 2600);
      for (let n = 0; n < anzahl; n += 1) {
        const y = hash01(n * 5.3 + 2) ** 1.6 * H * 0.6;
        cg.globalAlpha = T.sterne * (0.25 + hash01(n * 9.1) * 0.7) * (1 - y / (H * 0.65));
        cg.beginPath();
        cg.arc(hash01(n * 3.7 + 1) * W, y, 0.45 + hash01(n * 7.7) * 1.05, 0, Math.PI * 2);
        cg.fill();
      }
      cg.globalAlpha = 1;
    }
    if (T.gestirn) {
      const s = T.gestirn;
      const x = W * s.fx;
      const y = H * s.fy;
      const r = s.r * clamp(Math.min(W, H) / 420, 0.8, 1.6);
      const hof = cg.createRadialGradient(x, y, r * 0.4, x, y, r * 6);
      hof.addColorStop(0, s.hof);
      hof.addColorStop(1, "rgba(0,0,0,0)");
      cg.fillStyle = hof;
      cg.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
      cg.fillStyle = s.kern;
      cg.beginPath();
      cg.arc(x, y, r, 0, Math.PI * 2);
      cg.fill();
      if (s.art === "mond") {
        cg.fillStyle = T.himmel[1];
        cg.beginPath();
        cg.arc(x + r * 0.45, y - r * 0.25, r * 0.88, 0, Math.PI * 2);
        cg.fill();
      }
    }

    // Die Alpen: spitze Gipfel mit Schnee, die Sonnenseite heller. Einer
    // ist das Horn – steil, schief, unverkennbar.
    const fernH = Math.round(H * 0.42);
    const fern = leinwand(TW, fernH, q);
    cg = fern.g;
    const sonneLinks = !T.gestirn || T.gestirn.fx < 0.5;
    const gipfel = [];
    const zahl = 9;
    for (let n = 0; n < zahl; n += 1) {
      const h = (k) => hash01(n * 17.3 + k * 4.1 + 7);
      gipfel.push({
        x: ((n + 0.2 + h(1) * 0.6) / zahl) * TW,
        h: fernH * lerp(0.4, 0.74, h(2)),
        wl: fernH * lerp(0.55, 0.95, h(3)),
        wr: fernH * lerp(0.55, 0.95, h(4)),
        saat: n * 31 + 5,
      });
    }
    gipfel.push({ x: TW * 0.62, h: fernH * 0.95, wl: fernH * 0.42, wr: fernH * 0.62, saat: 901, horn: true });
    gipfel.push({ x: TW * 0.21, h: fernH * 0.8, wl: fernH * 0.6, wr: fernH * 0.35, saat: 911 });
    gipfel.push({ x: TW * 0.28, h: fernH * 0.86, wl: fernH * 0.35, wr: fernH * 0.4, saat: 921 });
    gipfel.sort((a, b) => b.h - a.h);
    for (const p of gipfel) {
      for (const versatz of [-TW, 0, TW]) maleGipfel(cg, p.x + versatz, fernH, p, T.fern, sonneLinks);
    }
    const dunst = cg.createLinearGradient(0, fernH * 0.55, 0, fernH);
    dunst.addColorStop(0, "rgba(0,0,0,0)");
    dunst.addColorStop(1, T.fern.dunst);
    cg.fillStyle = dunst;
    cg.fillRect(0, fernH * 0.55, TW, fernH * 0.45);

    // Die Voralpen: runde Rücken mit Wald und Schneefeldern.
    const mitteH = Math.round(H * 0.3);
    const mitte = leinwand(TW, mitteH, q);
    cg = mitte.g;
    const welle = (x, a, b, c) => Math.sin((x / TW) * Math.PI * 4 + a) * 0.18 + Math.sin((x / TW) * Math.PI * 10 + b) * 0.08 + Math.sin((x / TW) * Math.PI * 22 + c) * 0.03;
    const rueckenY = (x) => mitteH * (0.42 - welle(x, 1.3, 0.4, 2.2));
    const licht = cg.createLinearGradient(0, mitteH * 0.15, 0, mitteH * 0.7);
    licht.addColorStop(0, T.mitte.hell);
    licht.addColorStop(1, T.mitte.grund);
    cg.fillStyle = licht;
    cg.beginPath();
    cg.moveTo(0, mitteH);
    for (let x = 0; x <= TW; x += 4) cg.lineTo(x, rueckenY(x));
    cg.lineTo(TW, mitteH);
    cg.closePath();
    cg.fill();
    cg.save();
    cg.clip();
    cg.fillStyle = T.mitte.wald;
    for (let x = -10; x <= TW + 10; x += 4) {
      const y = Math.max(rueckenY(x) + mitteH * 0.12, mitteH * 0.5 + Math.sin(x * 0.02) * mitteH * 0.05);
      const hb = mitteH * (0.035 + hash01(x * 0.71) * 0.03);
      cg.beginPath();
      cg.moveTo(x - hb * 0.4, y + hb * 0.2);
      cg.lineTo(x, y - hb);
      cg.lineTo(x + hb * 0.4, y + hb * 0.2);
      cg.fill();
    }
    cg.fillRect(0, mitteH * 0.55, TW, mitteH * 0.45);
    cg.restore();
    const dunst2 = cg.createLinearGradient(0, mitteH * 0.3, 0, mitteH);
    dunst2.addColorStop(0, "rgba(0,0,0,0)");
    dunst2.addColorStop(1, T.fern.dunst);
    cg.fillStyle = dunst2;
    cg.fillRect(0, mitteH * 0.3, TW, mitteH * 0.7);

    // Das Ufer gegenüber: ein flacher Waldsaum mit Häusern und einem
    // Kirchturm – abends und nachts brennt Licht.
    const nahH = Math.round(H * 0.12);
    const nah = leinwand(TW, nahH, q);
    cg = nah.g;
    const nachts = i >= 4;
    const uferY = (x) => nahH * (0.55 - Math.sin((x / TW) * Math.PI * 6 + 0.7) * 0.12 - Math.sin((x / TW) * Math.PI * 14 + 2.1) * 0.06);
    cg.fillStyle = T.nah.grund;
    cg.beginPath();
    cg.moveTo(0, nahH);
    for (let x = 0; x <= TW; x += 6) cg.lineTo(x, uferY(x));
    cg.lineTo(TW, nahH);
    cg.closePath();
    cg.fill();
    cg.fillStyle = T.nah.wald;
    for (let x = -8; x <= TW + 8; x += 5) {
      const hb = nahH * (0.2 + hash01(x * 0.37 + 3) * 0.2);
      const y = uferY(x) + nahH * 0.1;
      cg.beginPath();
      cg.moveTo(x - hb * 0.3, y + hb * 0.15);
      cg.lineTo(x, y - hb);
      cg.lineTo(x + hb * 0.3, y + hb * 0.15);
      cg.fill();
    }
    for (let n = 0; n < 9; n += 1) {
      const hx = ((n + 0.3 + hash01(n * 5.7) * 0.4) / 9) * TW;
      const hy = nahH * 0.86;
      const hb = nahH * 0.12;
      cg.fillStyle = nachts ? "#1a1f36" : hash01(n * 2.3) > 0.5 ? "#e9e2d6" : "#d8c9b2";
      cg.fillRect(hx - hb, hy - hb, hb * 2, hb);
      cg.fillStyle = nachts ? "#2a3150" : "#9a3b2e";
      cg.beginPath();
      cg.moveTo(hx - hb * 1.2, hy - hb * 0.95);
      cg.lineTo(hx, hy - hb * 1.7);
      cg.lineTo(hx + hb * 1.2, hy - hb * 0.95);
      cg.closePath();
      cg.fill();
      if (n === 4) {
        // Der Kirchturm.
        cg.fillStyle = nachts ? "#1a1f36" : "#efe9de";
        cg.fillRect(hx + hb * 1.4, hy - hb * 3.2, hb * 0.7, hb * 3.2);
        cg.fillStyle = nachts ? "#2a3150" : "#3f6b54";
        cg.beginPath();
        cg.moveTo(hx + hb * 1.3, hy - hb * 3.1);
        cg.lineTo(hx + hb * 1.75, hy - hb * 4.4);
        cg.lineTo(hx + hb * 2.2, hy - hb * 3.1);
        cg.closePath();
        cg.fill();
      }
      cg.fillStyle = nachts || i === 3 ? T.nah.licht : "rgba(30, 30, 40, 0.45)";
      cg.fillRect(hx - hb * 0.55, hy - hb * 0.65, hb * 0.35, hb * 0.3);
      cg.fillRect(hx + hb * 0.2, hy - hb * 0.65, hb * 0.35, hb * 0.3);
    }

    // Wolken: drei Bäusche, die langsam ziehen.
    const wolken = [0, 1, 2].map((n) => {
      const ww = 150 + n * 40;
      const wh = 74;
      const w = leinwand(ww, wh, q);
      w.g.fillStyle = T.wolke;
      w.g.globalAlpha = i >= 4 ? 0.5 : 0.9;
      for (let k = 0; k < 7; k += 1) {
        const r = wh * (0.22 + hash01(n * 7 + k) * 0.18);
        const x = ww * (0.15 + (k / 6) * 0.7);
        w.g.beginPath();
        w.g.ellipse(x, wh * 0.56 - r * 0.45 * Math.sin((k / 6) * Math.PI), r * 1.3, r, 0, 0, Math.PI * 2);
        w.g.fill();
      }
      return { c: w.c, w: ww, h: wh };
    });

    return { himmel: himmel.c, fern: fern.c, mitte: mitte.c, nah: nah.c, wolken, TW, fernH, mitteH, nahH, T };
  }

  // Ein Gipfel: Fels mit Sonnen- und Schattenseite, oben Schnee mit
  // zackigem Rand. Die Grate zittern ein wenig (feste Zahlen).
  function maleGipfel(cg, cx, unten, p, F, sonneLinks) {
    const spitze = { x: cx + (p.horn ? p.wl * 0.08 : 0), y: unten - p.h };
    const grat = (von, bis, saat, hoch) => {
      const pkt = [];
      const n = 9;
      for (let k = 1; k < n; k += 1) {
        const t = k / n;
        const j = (hash01(saat + k * 1.7) - 0.5) * p.h * 0.08 + (hash01(saat + k * 3.1) > 0.75 ? -p.h * 0.04 : 0);
        const ty = p.horn ? (hoch ? t ** 1.6 : 1 - (1 - t) ** 1.6) : t;
        pkt.push({ x: lerp(von.x, bis.x, t) + j * 0.4, y: lerp(von.y, bis.y, ty) + j });
      }
      return pkt;
    };
    const fussL = { x: cx - p.wl, y: unten };
    const fussR = { x: cx + p.wr, y: unten };
    const links = grat(fussL, spitze, p.saat, true);
    const rechts = grat(spitze, fussR, p.saat + 50, false);
    const umriss = [fussL, ...links, spitze, ...rechts, fussR];
    cg.save();
    cg.beginPath();
    umriss.forEach((q, k) => (k ? cg.lineTo(q.x, q.y) : cg.moveTo(q.x, q.y)));
    cg.closePath();
    cg.fillStyle = F.schatten;
    cg.fill();
    cg.clip();
    const mitteFuss = { x: cx + (sonneLinks ? -1 : 1) * p.wl * 0.05 + (p.horn ? p.wl * 0.2 : 0), y: unten };
    const sonnenSeite = () => {
      cg.beginPath();
      cg.moveTo(spitze.x, spitze.y);
      (sonneLinks ? [...links].reverse() : rechts).forEach((q) => cg.lineTo(q.x, q.y));
      cg.lineTo(sonneLinks ? fussL.x : fussR.x, unten);
      cg.lineTo(mitteFuss.x, mitteFuss.y);
      cg.closePath();
    };
    cg.fillStyle = F.fels;
    sonnenSeite();
    cg.fill();
    const grenze = unten - p.h * (p.horn ? 0.42 : 0.5);
    const schneeFlaeche = () => {
      cg.beginPath();
      cg.moveTo(cx - p.wl * 1.2, unten - p.h * 1.2);
      cg.lineTo(cx + p.wr * 1.2, unten - p.h * 1.2);
      const schritte = 14;
      for (let k = schritte; k >= 0; k -= 1) {
        const x = cx - p.wl + ((p.wl + p.wr) * k) / schritte;
        const zacke = (k % 2 ? 1 : -0.4) * p.h * 0.07 * (0.5 + hash01(p.saat + k * 2.3));
        cg.lineTo(x, grenze + zacke + Math.abs(x - spitze.x) * 0.25);
      }
      cg.closePath();
    };
    cg.fillStyle = F.schneeSchatten;
    schneeFlaeche();
    cg.fill();
    cg.clip();
    cg.fillStyle = F.schnee;
    sonnenSeite();
    cg.fill();
    cg.restore();
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: was weit weg ist
  // ---------------------------------------------------------------------------
  const tz = () => TAGESZEITEN[tagBei(state.nr)];

  // Wo das Ufer gegenüber im Bild steht: ein Stück unter der Mitte – nie
  // tiefer als die Wasserlinie vorne. Steht die Kamera hoch über dem See,
  // liegt dazwischen die Fläche des Sees.
  function horizont() {
    const mitte = view.frei + view.nutzH * 0.6;
    const wasser = bildY(0);
    return Math.min(wasser, mitte + clamp((wasser - mitte) * 0.05, 0, view.nutzH * 0.1));
  }

  // Die Ebenen: wie stark sie der Kamera quer folgen (Bildpunkte je Meter)
  // und wie weit ihr Fuss über dem Ufer steht (Bildpunkte).
  const EBENEN = [
    { art: "fern", px: 0.4, ueber: 0.012 },
    { art: "mitte", px: 1, ueber: 0.004 },
    { art: "nah", px: 2, ueber: 0 },
  ];

  function zeichneHintergrund() {
    const B = tagesBilder(tagBei(state.nr));
    const T = B.T;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const q = view.dpr;
    const W = canvas.width;
    const H = canvas.height;
    g.drawImage(B.himmel, 0, 0);
    const hz = horizont();
    // Die Wolken ziehen langsam, unabhängig vom Springer.
    flach();
    B.wolken.forEach((w, n) => {
      const breite = view.cssW + w.w * 2;
      const x = ((((n * 0.37 + 0.1) * breite - state.echt * (4 + n * 2) - kam.x * 0.2) % breite) + breite) % breite - w.w;
      const y = hz * (0.08 + n * 0.1) - 20;
      g.drawImage(w.c, x, y, w.w, w.h);
    });
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (const e of EBENEN) {
      const bild = B[e.art];
      const TW = bild.width;
      const hoch = bild.height;
      const oben = Math.round((hz - B[`${e.art}H`] - e.ueber * view.cssH) * q);
      const x0 = Math.round(((((-kam.x * e.px) % B.TW) + B.TW) % B.TW - B.TW) * q);
      const y0 = Math.max(0, -oben);
      const y1 = Math.min(hoch, H - oben);
      if (y1 > y0) {
        for (let x = x0; x < W; x += TW) {
          const sx = Math.max(0, -x);
          const sw = Math.min(TW, W - x) - sx;
          if (sw > 0) g.drawImage(bild, sx, y0, sw, y1 - y0, x + sx, oben + y0, sw, y1 - y0);
        }
      }
    }
    flach();
    // Der See: vom Ufer gegenüber bis vorne an die Wasserlinie.
    const wasser = bildY(0);
    const bis = Math.min(view.cssH, wasser);
    if (bis > hz) {
      // Der Verlauf endet spätestens eine halbe Bildhöhe unter dem Ufer –
      // auch wenn die Wasserlinie vorne weit unter dem Bild liegt.
      const see = g.createLinearGradient(0, hz, 0, Math.max(hz + 1, Math.min(wasser, hz + view.cssH * 0.45)));
      see.addColorStop(0, T.see[0]);
      see.addColorStop(1, T.see[1]);
      g.fillStyle = see;
      g.fillRect(0, hz - 0.5, view.cssW, bis - hz + 0.5);
      // Das Glitzern unter dem Gestirn und ein paar helle Striche.
      const fx = T.gestirn ? T.gestirn.fx * view.cssW : view.cssW * 0.5;
      g.fillStyle = T.glanz;
      for (let n = 0; n < 28; n += 1) {
        const u = hash01(n * 3.3 + 1);
        const y = hz + (bis - hz) * u ** 1.5;
        const breit = (6 + hash01(n * 5.1) * 26) * (0.4 + u);
        const unterGestirn = T.gestirn && hash01(n * 1.9) < 0.6;
        const x = unterGestirn ? fx + (hash01(n * 7.7) - 0.5) * 50 * (0.4 + u) : hash01(n * 7.7) * view.cssW;
        const flimmer = 0.5 + 0.5 * Math.sin(state.echt * (1.5 + hash01(n) * 2) + n);
        g.globalAlpha = (unterGestirn ? 0.45 : 0.16) * flimmer;
        g.fillRect(x - breit / 2, y, breit, 1.2);
      }
      g.globalAlpha = 1;
    }
    // Unter Wasser: dunkler, je tiefer.
    if (wasser < view.cssH) {
      const tief = g.createLinearGradient(0, wasser, 0, wasser + 14 * kam.z);
      tief.addColorStop(0, T.unter[0]);
      tief.addColorStop(1, T.unter[1]);
      g.fillStyle = tief;
      g.fillRect(0, wasser, view.cssW, view.cssH - wasser);
      // Licht, das schräg ins Wasser fällt.
      if (!ruhig()) {
        g.globalCompositeOperation = "lighter";
        for (let n = 0; n < 6; n += 1) {
          const x = (hash01(n * 4.1) * 1.3 - 0.15) * view.cssW + Math.sin(state.echt * 0.4 + n) * 18;
          const breit = 18 + hash01(n * 2.7) * 40;
          const lang = (5 + hash01(n * 6.1) * 6) * kam.z;
          const s = g.createLinearGradient(0, wasser, 0, wasser + lang);
          s.addColorStop(0, "rgba(180, 240, 255, 0.07)");
          s.addColorStop(1, "rgba(180, 240, 255, 0)");
          g.fillStyle = s;
          g.beginPath();
          g.moveTo(x, wasser);
          g.lineTo(x + breit, wasser);
          g.lineTo(x + breit * 0.4 + lang * 0.25, wasser + lang);
          g.lineTo(x - breit * 0.4 + lang * 0.25, wasser + lang);
          g.closePath();
          g.fill();
        }
        g.globalCompositeOperation = "source-over";
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: der Turm
  // ---------------------------------------------------------------------------
  // Zwei Pfosten aus Stahl, Kreuzstreben, oben die Plattform mit
  // rot-weisser Kante, links die Leiter, auf dem Geländer die Fahne. Der Fuss
  // steht auf einem Sockel im Wasser. Wie hoch das Brett im Bild liegt und wo
  // es vorne endet, sagt die Figur (deckHoehe, kanteVorn) – auf dem Schild
  // steht die Höhe, mit der gerechnet wird.
  const TURM_L = -3.3;
  const TURM_R = -0.75;
  const DECK_L = -3.7;

  function zeichneTurm() {
    const H = deckHoehe();
    const vorn = kanteVorn();
    const T = tz();
    const z = kam.z;
    const unten = -7;
    const X = bildX;
    const Y = bildY;
    if (X(0.2) < -20 || X(DECK_L - 0.6) > view.cssW + 20) return;
    // Der Sockel.
    g.fillStyle = mische(T.bau[1], "#000000", 0.25);
    g.fillRect(X(-3.9), Y(0.5), 3.5 * z, (0.5 - unten) * z);
    g.fillStyle = T.bau[0];
    g.fillRect(X(-3.9), Y(0.5), 3.5 * z, Math.max(1, 0.12 * z));
    // Die Kreuzstreben, alle drei Meter.
    const bisY = Math.max(unten, Math.floor((-view.oy + view.cssH) / z) - 3);
    g.strokeStyle = mische(T.bau[1], "#000000", 0.12);
    g.lineWidth = Math.max(1, 0.09 * z);
    g.beginPath();
    for (let y = 0.5; y < H - 0.5; y += 3) {
      if (Y(y + 3) > view.cssH + 20 || Y(y) < -20) continue;
      const y1 = Math.min(H - 0.35, y + 3);
      g.moveTo(X(TURM_L), Y(y));
      g.lineTo(X(TURM_R), Y(y1));
      g.moveTo(X(TURM_R), Y(y));
      g.lineTo(X(TURM_L), Y(y1));
      g.moveTo(X(TURM_L), Y(y1));
      g.lineTo(X(TURM_R), Y(y1));
    }
    g.stroke();
    // Die Pfosten.
    const pfosten = Math.max(2, 0.22 * z);
    g.fillStyle = T.bau[1];
    for (const px of [TURM_L, TURM_R]) g.fillRect(X(px) - pfosten / 2, Y(H - 0.35), pfosten, (H - 0.35 - Math.max(unten, -bisY)) * z + 2);
    g.fillStyle = T.bau[0];
    for (const px of [TURM_L, TURM_R]) g.fillRect(X(px) - pfosten / 2, Y(H - 0.35), pfosten * 0.35, (H - 0.35 - unten) * z);
    // Die Leiter links.
    const lx = DECK_L + 0.05;
    g.strokeStyle = T.bau[0];
    g.lineWidth = Math.max(1, 0.06 * z);
    g.beginPath();
    g.moveTo(X(lx), Y(0.5));
    g.lineTo(X(lx), Y(H + 1.3));
    g.moveTo(X(lx + 0.45), Y(0.5));
    g.lineTo(X(lx + 0.45), Y(H));
    const sprosse = 0.35 * Math.max(1, Math.round(5 / z));
    for (let y = 0.6; y < H; y += sprosse) {
      if (Y(y) < -5 || Y(y) > view.cssH + 5) continue;
      g.moveTo(X(lx), Y(y));
      g.lineTo(X(lx + 0.45), Y(y));
    }
    g.stroke();
    // Die Plattform: Deck, Belag, die rot-weisse Kante vorne.
    const dick = 0.35;
    g.fillStyle = mische(T.bau[1], "#000000", 0.2);
    g.fillRect(X(DECK_L), Y(H), (vorn - DECK_L) * z, dick * z);
    g.fillStyle = mische(T.bau[0], "#5aa0c8", 0.25);
    g.fillRect(X(DECK_L), Y(H) - Math.max(1.5, 0.07 * z), (vorn - DECK_L) * z, Math.max(1.5, 0.07 * z));
    for (let k = 0; k < 4; k += 1) {
      g.fillStyle = k % 2 ? "#ffffff" : "#e8262f";
      g.fillRect(X(vorn - 0.32 + k * 0.08), Y(H), Math.max(1, 0.08 * z), dick * z);
    }
    // Das Schild mit der Höhe.
    const schild = Math.max(10, 0.5 * z);
    g.fillStyle = "rgba(14, 18, 34, 0.85)";
    const sx = X((TURM_L + TURM_R) / 2);
    const sy = Y(H - 0.9);
    g.font = `900 ${Math.round(schild * 0.75)}px system-ui, sans-serif`;
    const text = `${state.H} m`;
    const sw = g.measureText(text).width + schild * 0.8;
    g.beginPath();
    if (g.roundRect) g.roundRect(sx - sw / 2, sy - schild * 0.6, sw, schild * 1.2, schild * 0.25);
    else g.rect(sx - sw / 2, sy - schild * 0.6, sw, schild * 1.2);
    g.fill();
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, sx, sy + 1);
    // Das Geländer hinten, offen nach vorne – hüfthoch für die Figur, wie sie
    // gezeichnet wird.
    g.strokeStyle = T.bau[0];
    g.lineWidth = Math.max(1, 0.07 * z);
    g.beginPath();
    for (const px of [DECK_L, -2.4, -1.4]) {
      g.moveTo(X(px), Y(H));
      g.lineTo(X(px), Y(H + 1.5));
    }
    g.moveTo(X(DECK_L), Y(H + 1.5));
    g.lineTo(X(-1.4), Y(H + 1.5));
    g.moveTo(X(DECK_L), Y(H + 0.78));
    g.lineTo(X(-1.4), Y(H + 0.78));
    g.stroke();
    // Die Fahne am Mast hinten – sie weht mit dem Wind.
    const plan = state.plan[state.nr];
    const wind = plan ? plan.wind : 0.5;
    g.strokeStyle = "#d8d8d8";
    g.lineWidth = Math.max(1, 0.06 * z);
    g.beginPath();
    g.moveTo(X(DECK_L + 0.1), Y(H));
    g.lineTo(X(DECK_L + 0.1), Y(H + 4));
    g.stroke();
    zeichneFahne(DECK_L + 0.1, H + 3.95, 1.15, 0.75, wind);
  }

  // Die Schweizer Fahne: weht dorthin, wohin der Wind zeigt, und umso
  // gerader, je stärker er ist.
  function zeichneFahne(x, y, breit, hoch, wind) {
    const z = kam.z;
    const X = bildX(x);
    const Y = bildY(y);
    const w = breit * z;
    const h = hoch * z;
    const d = wind < 0 ? -1 : 1;
    const stark = clamp(Math.abs(wind) / 1.2 + 0.25, 0, 1);
    const haengt = (1 - stark) * 0.9;
    const welle = (u) => Math.sin(state.echt * (5 + stark * 6) + u * 5) * (0.08 + stark * 0.12) * h * u;
    const punkt = (u, v) => [X + d * u * w * (1 - haengt * 0.6), Y + v * h + u * haengt * h * 1.2 + welle(u)];
    g.fillStyle = "#e8262f";
    g.beginPath();
    let q = punkt(0, 0);
    g.moveTo(q[0], q[1]);
    for (let u = 0.25; u <= 1.001; u += 0.25) { q = punkt(u, 0); g.lineTo(q[0], q[1]); }
    for (let u = 1; u >= -0.001; u -= 0.25) { q = punkt(u, 1); g.lineTo(q[0], q[1]); }
    g.closePath();
    g.fill();
    if (h < 4) return;
    const m = punkt(0.5, 0.5);
    const a = h * 0.18;
    const b = h * 0.55;
    g.fillStyle = "#ffffff";
    g.fillRect(m[0] - a / 2, m[1] - b / 2, a, b);
    g.fillRect(m[0] - b / 2, m[1] - a / 2, b, a);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Boote mit dem Publikum
  // ---------------------------------------------------------------------------
  // Drei Boote liegen vor dem Turm, voll mit Leuten. Nach einem guten Sprung
  // reissen sie die Arme hoch; nachts brennt an jedem eine Laterne.
  const BOOTE = [
    { x: 8.5, lang: 4.6, rumpf: "#f4f1ea", streifen: "#1f5fd6", leute: 5 },
    { x: 15.5, lang: 5.4, rumpf: "#c0392b", streifen: "#ffffff", leute: 6 },
    { x: 23.5, lang: 4.2, rumpf: "#2f6248", streifen: "#ffd23f", leute: 4 },
  ];
  const KLEIDER = ["#e8262f", "#ffd23f", "#1f5fd6", "#ffffff", "#ff8a3d", "#3fa34d", "#7c5ce6"];

  function zeichneBoote() {
    const z = kam.z;
    const nacht = tagBei(state.nr) >= 4;
    BOOTE.forEach((b, i) => {
      const wipp = Math.sin(state.echt * 1.3 + i * 1.7) * 0.07;
      const x0 = b.x;
      const x1 = b.x + b.lang;
      if (bildX(x1 + 1) < 0 || bildX(x0 - 1) > view.cssW) return;
      const y = wipp;
      // Die Leute.
      for (let k = 0; k < b.leute; k += 1) {
        const px = x0 + 0.45 + (k + 0.5) * ((b.lang - 0.9) / b.leute);
        const springt = state.jubel > 0.05 ? Math.abs(Math.sin(state.echt * 9 + k * 1.3 + i)) * 0.25 * state.jubel : 0;
        const py = y + 0.55 + springt;
        const kleid = KLEIDER[(k * 3 + i * 2) % KLEIDER.length];
        g.strokeStyle = kleid;
        g.lineCap = "round";
        g.lineWidth = Math.max(1.5, 0.32 * z);
        g.beginPath();
        g.moveTo(bildX(px), bildY(py));
        g.lineTo(bildX(px), bildY(py + 0.55));
        g.stroke();
        g.lineWidth = Math.max(1, 0.1 * z);
        const arme = state.jubel > 0.2 ? 0.55 : 0.2;
        g.beginPath();
        g.moveTo(bildX(px - 0.18), bildY(py + 0.45 + arme));
        g.lineTo(bildX(px), bildY(py + 0.4));
        g.lineTo(bildX(px + 0.18), bildY(py + 0.45 + arme));
        g.stroke();
        g.fillStyle = nacht ? "#c9a585" : "#f1c7a0";
        g.beginPath();
        g.arc(bildX(px), bildY(py + 0.72), Math.max(1.5, 0.15 * z), 0, Math.PI * 2);
        g.fill();
      }
      g.lineCap = "butt";
      // Der Rumpf.
      g.fillStyle = nacht ? mische(b.rumpf, "#0a1030", 0.55) : b.rumpf;
      g.beginPath();
      g.moveTo(bildX(x0), bildY(y + 0.75));
      g.lineTo(bildX(x1 + 0.3), bildY(y + 0.8));
      g.lineTo(bildX(x1 - 0.2), bildY(y - 0.35));
      g.lineTo(bildX(x0 + 0.5), bildY(y - 0.35));
      g.closePath();
      g.fill();
      g.fillStyle = nacht ? mische(b.streifen, "#0a1030", 0.5) : b.streifen;
      g.fillRect(bildX(x0 + 0.1), bildY(y + 0.55), (b.lang - 0.1) * z, Math.max(1, 0.12 * z));
      if (nacht) {
        // Die Laterne vorne am Bug.
        const lx = bildX(x1 - 0.1);
        const ly = bildY(y + 1.7);
        g.strokeStyle = "#555a70";
        g.lineWidth = Math.max(1, 0.05 * z);
        g.beginPath();
        g.moveTo(lx, bildY(y + 0.8));
        g.lineTo(lx, ly);
        g.stroke();
        g.globalCompositeOperation = "lighter";
        const r = Math.max(8, 1.6 * z);
        const hof = g.createRadialGradient(lx, ly, 1, lx, ly, r);
        hof.addColorStop(0, "rgba(255, 210, 120, 0.9)");
        hof.addColorStop(1, "rgba(255, 210, 120, 0)");
        g.fillStyle = hof;
        g.fillRect(lx - r, ly - r, r * 2, r * 2);
        g.globalCompositeOperation = "source-over";
      }
    });
  }

  // Unter der Wasserlinie liegt alles im Blau: der Fuss des Turms, die
  // Rümpfe, der Springer, wenn er eintaucht.
  function zeichneUnterwasser() {
    const wasser = bildY(0);
    if (wasser >= view.cssH) return;
    const T = tz();
    flach();
    g.globalAlpha = 0.5;
    g.fillStyle = T.unter[0];
    g.fillRect(0, wasser, view.cssW, view.cssH - wasser);
    g.globalAlpha = 1;
  }

  /*
   * Die Wasserlinie: kleine Wellen und ein heller Saum. Wo jemand eingetaucht
   * ist, läuft ein Wellenberg nach beiden Seiten davon, Ringe breiten sich
   * aus, und eine Weile liegt Schaum auf dem Wasser.
   */
  function zeichneWasserlinie() {
    const wasser = bildY(0);
    if (wasser < -40 || wasser > view.cssH + 40) return;
    const T = tz();
    const z = kam.z;
    const hell = mische(T.see[0], "#ffffff", 0.45);
    // Die Linie, Punkt für Punkt – mit den Wellenbergen der grossen Ringe.
    g.beginPath();
    g.moveTo(-4, wasser + 2);
    for (let x = -4; x <= view.cssW + 6; x += 6) {
      const wx = (x - view.ox) / z;
      let hoch = Math.sin(wx * 1.7 + state.echt * 2.1) * 0.05 + Math.sin(wx * 0.6 - state.echt * 1.3) * 0.04;
      for (const w of state.wellen) {
        if (w.klein || w.alter < 0) continue;
        const k = w.alter / w.dauer;
        const d = Math.abs(wx - w.x) - (0.4 + k * w.weit);
        if (d > 1.5 || d < -1.5) continue;
        hoch += w.stark * (1 - k) * (1 - k) * Math.cos(d * 4.4) * Math.exp(-d * d * 1.8) * 0.2;
      }
      g.lineTo(x, wasser - hoch * z);
    }
    g.lineTo(view.cssW + 6, wasser + 2);
    // Was über die ruhige Fläche steigt, ist auch Wasser.
    g.fillStyle = hell;
    g.globalAlpha = 0.5;
    g.fill();
    g.strokeStyle = hell;
    g.globalAlpha = 0.9;
    g.lineWidth = Math.max(1.2, 0.08 * z);
    g.lineJoin = "round";
    g.stroke();
    // Die Ringe: von der Seite gesehen flache Ellipsen.
    for (const w of state.wellen) {
      if (w.alter < 0) continue;
      const k = clamp(w.alter / w.dauer, 0, 1);
      const r = ((w.klein ? 0.08 : 0.4) + k * w.weit) * z;
      g.globalAlpha = (w.klein ? 0.5 : 0.6) * (1 - k);
      g.strokeStyle = "#ffffff";
      g.lineWidth = Math.max(1, 0.1 * z * (1 - k) * (w.klein ? 0.5 : 1) + 0.5);
      g.beginPath();
      g.ellipse(bildX(w.x), wasser, r, r * 0.14, 0, 0, Math.PI * 2);
      g.stroke();
      if (!w.klein && k > 0.12) {
        g.globalAlpha = 0.3 * (1 - k);
        g.beginPath();
        g.ellipse(bildX(w.x), wasser, r * 0.6, r * 0.084, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
    // Der Schaum: weisse Flecken, die auseinanderlaufen und vergehen.
    g.fillStyle = "#ffffff";
    for (const f of state.schaum) {
      const k = clamp(f.alter / f.dauer, 0, 1);
      const da = (1 - k) ** 1.3 * Math.min(1, f.alter * 9) * f.deck;
      for (let n = 0; n < 7; n += 1) {
        const u = hash01(f.saat + n * 3.1) - 0.5;
        const rx = (0.16 + hash01(f.saat + n * 5.7) * 0.3) * f.weit * (0.45 + 0.75 * k) * z;
        const ry = Math.max(1, rx * (0.17 - 0.09 * k));
        g.globalAlpha = da * (0.35 + hash01(f.saat + n * 1.3) * 0.45);
        g.beginPath();
        g.ellipse(bildX(f.x + u * f.weit * (0.5 + 1.1 * k)), wasser + (hash01(f.saat + n * 9.9) - 0.6) * 0.1 * z, rx, ry, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
  }

  /*
   * Das Wasser, das beim Eintauchen hochschiesst: Jeder «Finger» ist ein
   * Strahl, der eine kurze Zeit lang aus der Fläche tritt – das Wasser darin
   * fliegt weiter, wie es geworfen wurde. So wächst er, biegt sich, löst sich
   * vom See und fällt zurück. Gemalt wird er als Band, am Fuss breit, an der
   * Spitze dünn: einmal bläulich und breit, einmal weiss und schmal darüber.
   */
  const FINGER_PUNKTE = 8;
  const fingerX = new Float64Array(FINGER_PUNKTE);
  const fingerY = new Float64Array(FINGER_PUNKTE);
  const fingerBand = [];
  function fingerPfad(f, t, schmal) {
    const z = kam.z;
    const bisher = Math.min(t, f.dauer);
    const sw = Math.sin(f.w);
    const cw = Math.cos(f.w);
    for (let i = 0; i < FINGER_PUNKTE; i += 1) {
      // i = 0 ist die Spitze (das älteste Wasser), das letzte der Fuss.
      const seit = bisher * (i / (FINGER_PUNKTE - 1));
      const a = t - seit;
      const v = f.v * (1 - 0.45 * (seit / f.dauer));
      fingerX[i] = bildX(f.x + sw * v * a);
      fingerY[i] = bildY(cw * v * a - 0.5 * G * a * a);
    }
    // Hat er sich gelöst, wird auch der Fuss dünn.
    const los = clamp((t - f.dauer) / 0.25, 0, 1);
    const duenn = schmal / (1 + t * 1.5);
    fingerBand.length = 0;
    for (let seite = 1; seite >= -1; seite -= 2) {
      for (let n = 0; n < FINGER_PUNKTE; n += 1) {
        const i = seite > 0 ? n : FINGER_PUNKTE - 1 - n;
        const u = i / (FINGER_PUNKTE - 1);
        const vor = Math.max(0, i - 1);
        const nach = Math.min(FINGER_PUNKTE - 1, i + 1);
        const dx = fingerX[nach] - fingerX[vor];
        const dy = fingerY[nach] - fingerY[vor];
        const l = Math.hypot(dx, dy) || 1;
        const breit = f.dick * z * duenn * lerp(0.3, 1, u ** 0.8) * lerp(1, Math.sin(Math.PI * (0.12 + 0.76 * u)) * 1.15, los) * 0.5;
        fingerBand.push(fingerX[i] - (dy / l) * breit * seite, fingerY[i] + (dx / l) * breit * seite);
      }
    }
    g.beginPath();
    rundIn(g, fingerBand);
  }

  /*
   * Die Krone: die Wand aus Wasser zwischen den Spitzen der Finger. Am
   * Anfang ist sie fast geschlossen, dann reissen die Täler zwischen den
   * Spitzen auf – bis nur noch die Finger stehen und sie in Tropfen zerfällt.
   */
  const kronenRand = [];
  function kronePfad(p, mass) {
    const wasser = bildY(0);
    const k = clamp(p.alter / p.kronZeit, 0, 1);
    const tal = lerp(0.84, 0.25, k);
    const weit = p.breit * (0.5 + 0.9 * k);
    kronenRand.length = 0;
    kronenRand.push(bildX(p.x - weit), wasser + 10);
    let vx = 0;
    let vy = 0;
    for (let i = 0; i < p.krone; i += 1) {
      const f = p.finger[i];
      const a = Math.max(0, p.alter - f.ab);
      const x = bildX(f.x + Math.sin(f.w) * f.v * a);
      const y = Math.min(wasser + 10, bildY((Math.cos(f.w) * f.v * a - 0.5 * G * a * a) * mass));
      if (i) kronenRand.push(lerp(bildX(p.x), (x + vx) / 2, 0.5 + tal * 0.5), lerp(wasser, (y + vy) / 2, tal));
      kronenRand.push(x, y);
      vx = x;
      vy = y;
    }
    kronenRand.push(bildX(p.x + weit), wasser + 10);
    g.beginPath();
    rundIn(g, kronenRand);
  }

  function zeichnePlatscher() {
    if (!state.platscher.length) return;
    const wasser = bildY(0);
    if (wasser < 0) return;
    g.save();
    g.beginPath();
    g.rect(0, 0, view.cssW, wasser + 1);
    g.clip();
    const blau = mische(tz().see[0], "#ffffff", 0.62);
    const z = kam.z;
    for (let lage = 0; lage < 2; lage += 1) {
      g.fillStyle = lage ? "#ffffff" : blau;
      for (const p of state.platscher) {
        // Der Hügel: Das Wasser wölbt sich auf und fällt zusammen.
        const k = p.alter / p.dauer;
        if (k < 1) {
          const auf = Math.sin(Math.PI * k ** 0.55);
          g.globalAlpha = (1 - k) * (lage ? 0.9 : 0.6);
          g.beginPath();
          g.ellipse(bildX(p.x), wasser, p.breit * (0.5 + 0.9 * k) * z * (lage ? 0.8 : 1), Math.max(1, p.hoch * auf * z * (lage ? 0.8 : 1)), 0, 0, Math.PI * 2);
          g.fill();
        }
        if (p.alter < p.kronZeit) {
          g.globalAlpha = clamp(1.7 - (p.alter / p.kronZeit) * 1.7, 0, 1) * (lage ? 0.5 : 0.62);
          kronePfad(p, lage ? 0.86 : 1);
          g.fill();
        }
        for (const f of p.finger) {
          const t = p.alter - f.ab;
          if (t <= 0.01 || t > f.lebt) continue;
          g.globalAlpha = clamp((1 - t / f.gipfel) * 1.6, 0, 1) * (lage ? 0.9 : 0.5);
          fingerPfad(f, t, lage ? 0.6 : 1);
          g.fill();
        }
      }
    }
    g.restore();
    g.globalAlpha = 1;
  }

  // Das Flutlicht: zwei Scheinwerfer auf Masten im Wasser, ihr Kegel auf die
  // Fallstrecke, zusammengezählt («lighter»). Es fällt auch auf den Springer.
  function zeichneFlutlicht() {
    if (!flutlichtBei(state.nr)) return;
    const z = kam.z;
    const H = state.H;
    g.globalCompositeOperation = "lighter";
    for (const m of [{ x: -9, y: H * 0.75 + 4 }, { x: 12, y: H * 0.5 + 5 }]) {
      const lx = bildX(m.x);
      const ly = bildY(m.y);
      g.strokeStyle = "rgba(120, 125, 150, 0.6)";
      g.lineWidth = Math.max(1, 0.15 * z);
      g.beginPath();
      g.moveTo(lx, ly);
      g.lineTo(lx, bildY(0));
      g.stroke();
      const r = Math.max(14, 1.2 * z);
      const hof = g.createRadialGradient(lx, ly, 1, lx, ly, r);
      hof.addColorStop(0, "rgba(255, 250, 220, 0.85)");
      hof.addColorStop(1, "rgba(255, 250, 220, 0)");
      g.fillStyle = hof;
      g.fillRect(lx - r, ly - r, r * 2, r * 2);
      const ziel = { x: 1.5, y: H * 0.45 };
      const kegel = g.createLinearGradient(lx, ly, bildX(ziel.x), bildY(ziel.y));
      kegel.addColorStop(0, "rgba(255, 248, 220, 0.1)");
      kegel.addColorStop(1, "rgba(255, 248, 220, 0.015)");
      g.fillStyle = kegel;
      g.beginPath();
      g.moveTo(lx, ly - 0.4 * z);
      g.lineTo(lx, ly + 0.4 * z);
      g.lineTo(bildX(ziel.x + (m.x < 0 ? 3 : -3)), bildY(-1));
      g.lineTo(bildX(ziel.x + (m.x < 0 ? -2 : 2)), bildY(H + 2));
      g.closePath();
      g.fill();
    }
    g.globalCompositeOperation = "source-over";
  }

  // ---------------------------------------------------------------------------
  // Der Springer
  // ---------------------------------------------------------------------------
  /*
   * Eine Person von der Seite, in Metern (1,75 m gross), im Rahmen des
   * Körpers: y zeigt zum Kopf, x nach vorne (dorthin, wohin sie schaut). Eine
   * Haltung sagt, wie die Glieder stehen (Grad: 90 nach oben, -90 nach unten,
   * 0 nach vorne): die Wirbelsäule in zwei Stücken (rumpf, brust), der Kopf
   * gegen die Brust (kopf), je Bein Oberschenkel, Unterschenkel und Fuss, je
   * Arm Oberarm, Unterarm und Hand. V ist die Seite zum Betrachter, H die
   * abgewandte.
   *
   * In der Luft und im Wasser wird um den Schwerpunkt gezeichnet – um ihn
   * dreht sie sich. Auf der Plattform steht sie auf ihren Füssen: Dort sagt
   * die Haltung auch, wo die Hüfte über dem Brett ist (boden, hx, hy), und
   * die Beine folgen aus den Füssen (zweiGlieder).
   *
   * Es springen abwechselnd eine Frau und ein Mann (FIGUREN), Sprung um
   * Sprung. Das ist nur das Bild: Gerechnet wird für beide gleich.
   */
  const K = {
    ober: 0.43, unter: 0.42,                    // Oberschenkel, Unterschenkel
    knoechel: 0.068,                            // der Knöchel über der Sohle
    ferse: 0.05, ballen: 0.14, spitze: 0.172,   // vom Knöchel zur Ferse, zum Ballen, zu den Zehen
    lende: 0.27, brust: 0.27,                   // die Wirbelsäule
    hals: 0.055, kopf: 0.112,                   // vom Halsansatz zur Mitte des Kopfes
    oberarm: 0.29, unterarm: 0.25, hand: 0.16,
  };
  const BEIN = K.ober + K.unter;
  // So hoch steht die Hüfte, wenn sie steht – die Knie nicht ganz
  // durchgedrückt. (Schon wenig darunter knickt das Knie stark.)
  const HUEFTE = BEIN + K.knoechel - 0.002;

  const POSE_FELDER = [
    "rumpf", "brust", "kopf",
    "oberV", "unterV", "fussV", "oberH", "unterH", "fussH",
    "armV", "ellV", "handV", "armH", "ellH", "handH",
  ];
  const ARM_FELDER = new Set(["armV", "ellV", "handV", "armH", "ellH", "handH"]);

  // Eine Haltung aus dem, was sie vom Stehen unterscheidet. Die abgewandte
  // Seite folgt der zugewandten, die Hand dem Unterarm, wo nichts anderes
  // steht.
  function haltung(p) {
    const q = { rumpf: 90, brust: 90, kopf: 0, oberV: -90, unterV: -90, fussV: 0, armV: -90, ellV: -86, ...p };
    for (const [feld, wie] of [["oberH", "oberV"], ["unterH", "unterV"], ["fussH", "fussV"], ["armH", "armV"], ["ellH", "ellV"], ["handV", "ellV"]]) {
      if (q[feld] === undefined) q[feld] = q[wie];
    }
    if (q.handH === undefined) q.handH = q.ellH;
    q.boden = false;
    q.hx = 0;
    q.hy = 0;
    return q;
  }

  function poseZu(pose, ziel, rate, dt) {
    const k = 1 - Math.exp(-rate * dt);
    for (const f of POSE_FELDER) pose[f] += (ziel[f] - pose[f]) * k;
  }

  function poseMisch(a, b, k, aus = {}) {
    for (const f of POSE_FELDER) aus[f] = a[f] + (b[f] - a[f]) * k;
    return aus;
  }

  /*
   * Zwei Glieder (l1, l2) von a zum Ziel z: die Winkel beider in Grad. Das
   * Gelenk dazwischen knickt nach links der Linie (seite 1) oder nach rechts
   * (-1). Liegt das Ziel zu weit, strecken sie sich dorthin.
   */
  function zweiGlieder(ax, ay, zx, zy, l1, l2, seite, aus) {
    const dx = zx - ax;
    const dy = zy - ay;
    const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 1e-4, (l1 + l2) * 0.9998);
    const basis = Math.atan2(dy, dx);
    const w1 = basis + seite * Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const kx = ax + l1 * Math.cos(w1);
    const ky = ay + l1 * Math.sin(w1);
    aus[0] = grad(w1);
    aus[1] = grad(Math.atan2(ay + Math.sin(basis) * d - ky, ax + Math.cos(basis) * d - kx));
    return aus;
  }

  // Ein Punkt am Rumpf: t entlang der Wirbelsäule (0 an der Hüfte, 1 am
  // Halsansatz – ein Bogen), quer nach hinten (plus) oder nach vorne (minus).
  function rumpfPunkt(j, t, quer, aus) {
    const tt = clamp(t, 0, 1);
    const a = 1 - tt;
    const x = a * a * j.H[0] + 2 * a * tt * j.M[0] + tt * tt * j.S[0];
    const y = a * a * j.H[1] + 2 * a * tt * j.M[1] + tt * tt * j.S[1];
    let tx = a * (j.M[0] - j.H[0]) + tt * (j.S[0] - j.M[0]);
    let ty = a * (j.M[1] - j.H[1]) + tt * (j.S[1] - j.M[1]);
    const l = Math.hypot(tx, ty) || 1e-6;
    tx /= l;
    ty /= l;
    // Über die Enden hinaus geht es gerade weiter.
    const ueber = (t - tt) * (K.lende + K.brust);
    aus[0] = x + tx * ueber - ty * quer;
    aus[1] = y + ty * ueber + tx * quer;
    return aus;
  }

  // Die Gelenke einer Haltung, die Hüfte bei 0, und der Schwerpunkt (sx, sy).
  function gelenke(p) {
    const pol = (von, w, l) => {
      const r = rad(w);
      return [von[0] + l * Math.cos(r), von[1] + l * Math.sin(r)];
    };
    const H = [0, 0];
    const M = pol(H, p.rumpf, K.lende);
    const S = pol(M, p.brust, K.brust);
    const j = { H, M, S };
    j.Sch = rumpfPunkt(j, 0.9, 0, [0, 0]);
    j.kw = p.brust + p.kopf;
    j.N = pol(S, p.brust + p.kopf * 0.5, K.hals);
    j.C = pol(j.N, j.kw, K.kopf);
    j.knV = pol(H, p.oberV, K.ober);
    j.fuV = pol(j.knV, p.unterV, K.unter);
    j.knH = pol(H, p.oberH, K.ober);
    j.fuH = pol(j.knH, p.unterH, K.unter);
    j.elV = pol(j.Sch, p.armV, K.oberarm);
    j.haV = pol(j.elV, p.ellV, K.unterarm);
    j.fiV = pol(j.haV, p.handV, K.hand);
    j.elH = pol(j.Sch, p.armH, K.oberarm);
    j.haH = pol(j.elH, p.ellH, K.unterarm);
    j.fiH = pol(j.haH, p.handH, K.hand);
    // Der Schwerpunkt: jedes Glied mit seinem Anteil am Gewicht.
    let sx = 0;
    let sy = 0;
    let summe = 0;
    const dazu = (a, b, k, gewicht) => {
      sx += (a[0] + (b[0] - a[0]) * k) * gewicht;
      sy += (a[1] + (b[1] - a[1]) * k) * gewicht;
      summe += gewicht;
    };
    dazu(j.C, j.C, 0, 0.08);
    dazu(M, S, 0.5, 0.23);
    dazu(H, M, 0.5, 0.25);
    dazu(H, j.knV, 0.45, 0.1);
    dazu(H, j.knH, 0.45, 0.1);
    dazu(j.knV, j.fuV, 0.45, 0.045);
    dazu(j.knH, j.fuH, 0.45, 0.045);
    dazu(j.fuV, j.fuV, 0, 0.015);
    dazu(j.fuH, j.fuH, 0, 0.015);
    dazu(j.Sch, j.elV, 0.45, 0.028);
    dazu(j.Sch, j.elH, 0.45, 0.028);
    dazu(j.elV, j.haV, 0.6, 0.022);
    dazu(j.elH, j.haH, 0.6, 0.022);
    j.sx = sx / summe;
    j.sy = sy / summe;
    return j;
  }

  const POSEN = {
    stehen: haltung({ rumpf: 86, brust: 93, kopf: -4, armV: -92, ellV: -84, armH: -88, ellH: -80 }),
    // Der letzte Augenblick am Brett: gestreckt auf den Zehen, die Arme oben.
    absprung: haltung({ brust: 91, kopf: 4, fussV: -65, armV: 92, ellV: 89, armH: 89, ellH: 87 }),
    // In der Luft, gestreckt: kopfüber die Arme vor dem Kopf, sonst am Körper.
    gestreckt: haltung({ fussV: -88, armV: 91, ellV: 89, handV: 88, armH: 89, ellH: 88, handH: 88 }),
    fuesse: haltung({ fussV: -88, armV: -91, ellV: -89, handV: -90, armH: -89, ellH: -88, handH: -89 }),
    // Unter Wasser, im Gleiten: alles ein wenig gelöst.
    gleitenKopf: haltung({ brust: 88, kopf: 5, oberV: -85, unterV: -99, oberH: -93, unterH: -104, fussV: -112, fussH: -118, armV: 74, ellV: 62, handV: 56, armH: 84, ellH: 76, handH: 70 }),
    gleitenFuss: haltung({ brust: 88, kopf: 5, oberV: -80, unterV: -104, oberH: -92, unterH: -112, fussV: -118, fussH: -126, armV: -62, ellV: -34, handV: -24, armH: -76, ellH: -52, handH: -44 }),
    // Nach dem Klatscher treibt sie: auf dem Bauch, auf dem Rücken.
    bauch: haltung({ rumpf: 93, brust: 98, kopf: 10, oberV: -84, unterV: -108, oberH: -95, unterH: -124, fussV: -122, fussH: -138, armV: 50, ellV: 26, handV: 16, armH: 72, ellH: 52, handH: 44 }),
    ruecken: haltung({ rumpf: 88, brust: 84, kopf: -6, oberV: -78, unterV: -112, oberH: -87, unterH: -126, fussV: -100, fussH: -112, armV: 128, ellV: 152, handV: 160, armH: 110, ellH: 132, handH: 142 }),
  };

  // Das Päckchen: die Knie an der Brust, der Rücken rund, das Kinn auf der
  // Brust – und die Hände fassen die Schienbeine knapp unter dem Knie.
  POSEN.paeckchen = (() => {
    const p = haltung({ rumpf: 70, brust: 34, kopf: -28, oberV: 36, unterV: -120, fussV: -138, oberH: 31, unterH: -125, fussH: -143 });
    const j = gelenke(p);
    const w = [0, 0];
    for (const s of ["V", "H"]) {
      const kn = j[`kn${s}`];
      const fu = j[`fu${s}`];
      zweiGlieder(j.Sch[0], j.Sch[1], lerp(kn[0], fu[0], 0.2) + 0.022, lerp(kn[1], fu[1], 0.2) + 0.036, K.oberarm, K.unterarm, -1, w);
      p[`arm${s}`] = w[0];
      p[`ell${s}`] = w[1];
      p[`hand${s}`] = p[`unter${s}`] + 8;
    }
    return p;
  })();

  // Der Knöchel eines Fusses, dessen Sohle flach mit dem Knöchel bei w
  // stünde und der um neig Grad kippt: über Ballen oder Zehen (neig < 0, die
  // Ferse hebt sich) oder über die Ferse (neig > 0, die Zehen heben sich).
  function knoechelBei(w, neig, aus, vorn = K.ballen) {
    const r = rad(neig);
    const c = Math.cos(r);
    const s = Math.sin(r);
    if (neig < 0) {
      aus[0] = w + vorn - vorn * c - K.knoechel * s;
      aus[1] = -vorn * s + K.knoechel * c;
    } else {
      aus[0] = w - K.ferse + K.ferse * c - K.knoechel * s;
      aus[1] = K.ferse * s + K.knoechel * c;
    }
    return aus;
  }

  // Der Absprung, von den Zehen her gerechnet: wo die Hüfte dann steht
  // (hx, hy), wie hoch der Schwerpunkt über dem Brett ist (hoch) – und wo
  // der Knöchel stehen muss, damit der Schwerpunkt genau dort abhebt, wo die
  // Rechnung ihn hat (fussX, alles gegen sp.x).
  const ABSPRUNG = (() => {
    const f = knoechelBei(0, POSEN.absprung.fussV, [0, 0], K.spitze);
    const j = gelenke(POSEN.absprung);
    const hx = -j.sx;
    const hy = f[1] + BEIN * 0.9995;
    return { hx, hy, fussX: hx - f[0], hoch: hy + j.sy };
  })();
  const FUSS_X = ABSPRUNG.fussX;
  // Der abgewandte Fuss steht eine Spur weiter hinten – sonst wäre im Stehen
  // nur ein Bein zu sehen.
  const FUSS_HINTEN = -0.03;

  // Zwischen Stützen (x aufsteigend) weich hin und her: [x0, y0, x1, y1, …].
  function stuetzen(s, k) {
    if (s <= k[0]) return k[1];
    for (let i = 2; i < k.length; i += 2) {
      if (s <= k[i]) return lerp(k[i - 1], k[i + 1], glatt((s - k[i - 2]) / (k[i] - k[i - 2])));
    }
    return k[k.length - 1];
  }

  /*
   * Der Anlauf über das Brett, in Schritten: welches Bein (0: das abgewandte)
   * wann schwingt (s0 bis s1 – so weit ist die Hüfte dann) und von wo nach wo
   * (von, bis). ab und auf: wie der Fuss beim Abstossen und beim Aufsetzen
   * kippt (Grad), hub: wie hoch er dazwischen kommt, kipp: wie weit die
   * Zehen im Schwung hängen. Der letzte Schritt schliesst die Füsse an der
   * Kante.
   */
  const SCHRITTE = 2.5;
  const GANG = [
    { bein: 0, s0: 0, s1: 0.56, von: 0, bis: 0.82, ab: 0, auf: 14, hub: 0.05, kipp: 26 },
    { bein: 1, s0: 0.44, s1: 1.3, von: 0, bis: 1.8, ab: -38, auf: 14, hub: 0.045, kipp: 0 },
    { bein: 0, s0: 1.2, s1: 2.04, von: 0.82, bis: 2.5, ab: -40, auf: 10, hub: 0.045, kipp: 0 },
    { bein: 1, s0: 1.94, s1: 2.5, von: 1.8, bis: 2.5, ab: -30, auf: 0, hub: 0.03, kipp: 8 },
  ];
  // Die Hüfte sinkt, wenn beide Füsse stehen, und die Arme schwingen gegen
  // die Beine.
  const GANG_TIEF = [0, 0, 0.5, 0.8, 0.9, 0, 1.25, 1, 1.63, 0, 2, 0.9, 2.5, 0];
  const GANG_ARM = [0, 0, 0.56, 1, 1.3, -1, 2.04, 0.9, 2.5, 0];
  const ABROLLEN = 0.18;
  const ABSTOSSEN = 0.34;

  // Wo ein Fuss im Anlauf ist: der Knöchel (x ab dem Stand am Anfang, y über
  // dem Brett, Meter) und wie der Fuss kippt. s: so viele Schritte ist die
  // Hüfte weit, lang: so lang ist ein Schritt.
  const KN0 = [0, 0];
  const KN1 = [0, 0];
  function fussImGang(bein, s, lang, aus) {
    let vorher = null;
    for (const gg of GANG) {
      if (gg.bein !== bein) continue;
      if (s < gg.s0) {
        // Er steht: erst rollt er vom letzten Aufsetzen ab, dann stösst er ab.
        let neig = gg.ab * glatt((s - (gg.s0 - ABSTOSSEN)) / ABSTOSSEN);
        if (vorher && s < vorher.s1 + ABROLLEN) neig = vorher.auf * (1 - glatt((s - vorher.s1) / ABROLLEN));
        knoechelBei(gg.von * lang, neig, aus);
        aus[2] = neig;
        return aus;
      }
      if (s <= gg.s1) {
        const q = (s - gg.s0) / (gg.s1 - gg.s0);
        knoechelBei(gg.von * lang, gg.ab, KN0);
        knoechelBei(gg.bis * lang, gg.auf, KN1);
        aus[0] = lerp(KN0[0], KN1[0], glatt(q));
        aus[1] = lerp(KN0[1], KN1[1], q) + gg.hub * Math.sin(Math.PI * q);
        aus[2] = lerp(gg.ab, gg.auf, glatt((q - 0.25) / 0.75)) - gg.kipp * Math.sin(Math.PI * q);
        return aus;
      }
      vorher = gg;
    }
    const neig = vorher.auf * (1 - glatt((s - vorher.s1) / ABROLLEN));
    knoechelBei(vorher.bis * lang, neig, aus);
    aus[2] = neig;
    return aus;
  }

  /*
   * Die Haltung auf der Plattform, von den Füssen her gerechnet: Sie stehen
   * auf dem Brett, wo sie hingesetzt wurden, und die Beine folgen daraus – so
   * rutscht kein Fuss.
   *
   *   gang   0 bis 1: wie weit der Anlauf ist (0: sie steht hinten, 1: an
   *          der Kante)
   *   wipp   0 bis 1: der Absprung an der Kante – in die Knie, die Arme nach
   *          hinten, dann strecken, die Arme schwingen hoch, auf die Zehen.
   *          Kleiner als 0: noch im Anlauf.
   *   weg    wie lang der Anlauf ist, in Metern des Körpers
   *   zeit   für das Atmen im Stehen
   */
  const FV = [0, 0, 0];
  const FH = [0, 0, 0];
  const WINKEL = [0, 0];
  function bodenPose(aus, { gang = 0, wipp = -1, weg = 1.55, zeit = 0 } = {}) {
    const S = POSEN.stehen;
    let hx;
    let hy;
    if (wipp < 0) {
      const lang = weg / SCHRITTE;
      const s = clamp(gang, 0, 1) * SCHRITTE;
      fussImGang(1, s, lang, FV);
      fussImGang(0, s, lang, FH);
      FV[0] += FUSS_X - s * lang;
      FH[0] += FUSS_X - s * lang + FUSS_HINTEN;
      const geht = glatt(s / 0.35) * glatt((SCHRITTE - s) / 0.45);
      const arm = stuetzen(s, GANG_ARM);
      const atem = (1 - glatt(s / 0.2)) * Math.sin(zeit * 1.9);
      hx = FUSS_X + 0.012 + 0.022 * geht;
      hy = HUEFTE - 0.046 * stuetzen(s, GANG_TIEF) + 0.002 * atem;
      aus.rumpf = S.rumpf - 3 * geht;
      aus.brust = S.brust - 3 * geht + 0.9 * atem;
      aus.kopf = S.kopf + 2 * geht;
      aus.armV = S.armV + 17 * arm + 1.2 * atem;
      aus.ellV = aus.armV + 8 + 16 * Math.max(0, arm) + 8 * geht;
      aus.armH = S.armH - 17 * arm - atem;
      aus.ellH = aus.armH + 8 + 16 * Math.max(0, -arm) + 8 * geht;
    } else {
      const u = clamp(wipp, 0, 1);
      const tief = u < 0.46 ? glatt(u / 0.46) : 1 - glatt((u - 0.46) / 0.4);    // in die Knie
      const hoch = glatt((u - 0.7) / 0.3);                                       // auf die Zehen
      const vorn = glatt((u - 0.5) / 0.5);                                       // das Gewicht nach vorne
      const zurueck = u < 0.42 ? glatt(u / 0.42) : 1 - glatt((u - 0.42) / 0.3);  // die Arme holen aus …
      const v = clamp((u - 0.5) / 0.5, 0, 1);
      const schwung = v * v * v * (v * (v * 6 - 15) + 10);                       // … und schwingen hoch
      const ende = glatt((u - 0.86) / 0.14);
      const A = POSEN.absprung;
      knoechelBei(FUSS_X, A.fussV * hoch, FV, K.spitze);
      FV[2] = A.fussV * hoch;
      FH[0] = FV[0] + FUSS_HINTEN * (1 - hoch);
      FH[1] = FV[1];
      FH[2] = FV[2];
      hx = lerp(FUSS_X + 0.012 - 0.15 * tief, ABSPRUNG.hx, vorn);
      hy = lerp(HUEFTE - 0.27 * tief, ABSPRUNG.hy, hoch);
      const arm = S.armV - 60 * zurueck + 184 * schwung;
      aus.rumpf = lerp(S.rumpf - 29 * tief, A.rumpf, ende);
      aus.brust = lerp(S.brust - 40 * tief, A.brust, ende);
      aus.kopf = lerp(S.kopf + 29 * tief + 6 * vorn, A.kopf, ende);
      aus.armV = lerp(arm, A.armV, ende);
      aus.ellV = lerp(arm + 8 * (1 - schwung) + 26 * Math.sin(Math.PI * schwung), A.ellV, ende);
      aus.armH = lerp(arm + 4 - 7 * schwung, A.armH, ende);
      aus.ellH = lerp(arm + 12 * (1 - schwung) + 22 * Math.sin(Math.PI * schwung), A.ellH, ende);
    }
    zweiGlieder(hx, hy, FV[0], FV[1], K.ober, K.unter, 1, WINKEL);
    aus.oberV = WINKEL[0];
    aus.unterV = WINKEL[1] > 0 ? WINKEL[1] - 360 : WINKEL[1];
    aus.fussV = FV[2];
    zweiGlieder(hx, hy, FH[0], FH[1], K.ober, K.unter, 1, WINKEL);
    aus.oberH = WINKEL[0];
    aus.unterH = WINKEL[1] > 0 ? WINKEL[1] - 360 : WINKEL[1];
    aus.fussH = FH[2];
    aus.handV = aus.ellV + 4;
    aus.handH = aus.ellH + 4;
    aus.boden = true;
    aus.hx = hx;
    aus.hy = hy;
    return aus;
  }

  /*
   * Die Haltung im Flug: gestreckt – die Arme vor dem Kopf, wenn als Nächstes
   * der Kopf ins Wasser käme, sonst am Körper – und so weit im Päckchen, wie
   * sie zu ist. Die Arme sind dem Rest eine Spur voraus: Sie greifen zuerst
   * nach den Knien und lassen sie zuletzt los. tf: seit dem Absprung (s) –
   * so lange geht die Haltung vom Brett in die des Flugs über.
   */
  const LANG = {};
  function flugPose(aus, offen, armeOben, tf) {
    poseMisch(POSEN.fuesse, POSEN.gestreckt, armeOben, LANG);
    if (tf < 0.3) poseMisch(POSEN.absprung, LANG, glatt(tf / 0.3), LANG);
    const o = clamp(offen, 0, 1);
    const kRest = glatt(o);
    const kArm = glatt((o - 0.1) / 0.9);
    const P = POSEN.paeckchen;
    for (const f of POSE_FELDER) aus[f] = P[f] + (LANG[f] - P[f]) * (ARM_FELDER.has(f) ? kArm : kRest);
    aus.boden = false;
    return aus;
  }

  /*
   * Im Wasser, wenn sie wieder oben ist oder dorthin schwimmt: tief 1 heisst
   * noch unten – sie zieht sich mit beiden Armen nach oben, die Beine
   * schlagen –, tief 0 an der Oberfläche: Sie tritt Wasser. jubel: eine Faust
   * in der Luft.
   */
  const OBEN = {};
  const UNTEN = {};
  function schwimmPose(aus, zeit, jubel, tief) {
    const a = Math.sin(zeit * 5.4);
    const b = Math.cos(zeit * 5.4);
    // Wassertreten.
    OBEN.rumpf = 87;
    OBEN.brust = 84 + 1.5 * b;
    OBEN.kopf = 9;
    OBEN.oberV = -72 + 20 * a;
    OBEN.unterV = OBEN.oberV - 42 - 20 * b;
    OBEN.fussV = OBEN.unterV + 22;
    OBEN.oberH = -80 - 20 * a;
    OBEN.unterH = OBEN.oberH - 42 + 20 * b;
    OBEN.fussH = OBEN.unterH + 22;
    const stoss = Math.sin(zeit * 8.5);
    OBEN.armV = jubel ? 56 + 10 * stoss : -36 + 9 * b;
    OBEN.ellV = jubel ? 98 + 12 * stoss : 6 + 16 * a;
    OBEN.handV = jubel ? OBEN.ellV + 6 : OBEN.ellV + 8;
    OBEN.armH = -44 - 9 * b;
    OBEN.ellH = -2 - 16 * a;
    OBEN.handH = OBEN.ellH + 8;
    if (tief <= 0) return poseMisch(OBEN, OBEN, 0, aus);
    // Der Armzug nach oben: strecken, durchziehen.
    const zug = 0.5 - 0.5 * Math.cos(zeit * 7.6);
    UNTEN.rumpf = 90;
    UNTEN.brust = 88;
    UNTEN.kopf = 10;
    UNTEN.oberV = -86 + 11 * a;
    UNTEN.unterV = UNTEN.oberV - 12 - 9 * b;
    UNTEN.fussV = UNTEN.unterV - 6;
    UNTEN.oberH = -90 - 11 * a;
    UNTEN.unterH = UNTEN.oberH - 12 + 9 * b;
    UNTEN.fussH = UNTEN.unterH - 6;
    UNTEN.armV = lerp(84, -58, zug);
    UNTEN.ellV = UNTEN.armV + lerp(-4, 34, Math.sin(Math.PI * zug));
    UNTEN.handV = UNTEN.ellV;
    UNTEN.armH = lerp(88, -64, zug);
    UNTEN.ellH = UNTEN.armH + lerp(-4, 30, Math.sin(Math.PI * zug));
    UNTEN.handH = UNTEN.ellH;
    return poseMisch(OBEN, UNTEN, glatt(tief), aus);
  }

  // So gross wird der Springer gezeichnet (Bildpunkte je Meter): gut
  // anderthalbmal so gross wie echt, und nie kleiner als gut 50 Bildpunkte
  // hoch.
  const figurMass = () => Math.max(kam.z * 1.55, 26, view.minD * 0.07);
  const figurGroesse = (figur = state.figur) => figurMass() * figur.mass;
  // So viele Meter des Körpers ist ein Meter der Welt im Bild.
  const koerperJeMeter = () => kam.z / figurGroesse();

  /*
   * Weil die Figur grösser gezeichnet wird, als sie gerechnet ist, steht das
   * Brett im Bild etwas tiefer als state.H: genau so, dass ihr Schwerpunkt
   * beim Absprung dort ist, wo die Rechnung ihn hat. Dasselbe vorne: Die
   * Kante liegt dort, wo ihre Zehen sind.
   */
  const deckHoehe = () => state.H + SCHWERPUNKT - ABSPRUNG.hoch / koerperJeMeter();
  const kanteVorn = () => KANTE_X + (FUSS_X + K.spitze + 0.05) / koerperJeMeter();
  const START_X = DECK_L + 1;      // dort steht sie vor dem Anlauf
  // Wer Wasser tritt, wird so viel tiefer gezeichnet, als sein Schwerpunkt
  // gerechnet ist (m): Sonst stünde die grosse Figur bis zur Brust heraus.
  const TIEFER = 0.2;
  const gangBei = (x) => clamp((x - START_X) / (KANTE_X - START_X), 0, 1);
  const anlaufWeg = () => (KANTE_X - START_X) * koerperJeMeter();

  // --- Die Figuren ---------------------------------------------------------------
  /*
   * Die Formen: wie breit ein Glied links und rechts seiner Achse ist, an
   * mehreren Stellen ([wo, links, rechts], wo: 0 am Anfang, 1 am Ende). Bei
   * Armen und Beinen ist links vorne, beim Rumpf (von der Hüfte zum Hals)
   * hinten. Kopf und Haar sind Umrisse um die Mitte des Kopfes (nach vorne,
   * nach oben), der Fuss einer um den Knöchel (entlang der Sohle, zum Spann).
   */
  const KOPF_MASS = 0.92;
  const FUSS_FORM = [-0.028, 0.045, -0.064, -0.02, -0.052, -0.074, 0.04, -0.063, 0.12, -0.074, 0.186, -0.071, 0.2, -0.046, 0.125, -0.02, 0.045, 0.04];
  const FIGUREN = [
    {
      art: "frau",
      mass: 0.95,
      haut: "#efc3a1", hell: "#fbdcc2", dunkel: "#cf9774", linie: "#8f5a40",
      haar: "#6a4329", haarH: "#8a5c3a", anzug: "#e3262f", anzugD: "#ad1622", streifen: "#ffffff", mund: "#b8605a",
      form: {
        ober: [[0, 0.086, 0.094], [0.3, 0.085, 0.087], [0.72, 0.06, 0.06], [1, 0.049, 0.049]],
        unter: [[0, 0.047, 0.05], [0.26, 0.041, 0.062], [0.62, 0.031, 0.041], [1, 0.026, 0.028]],
        oberarm: [[0, 0.043, 0.045], [0.4, 0.037, 0.038], [1, 0.03, 0.03]],
        unterarm: [[0, 0.03, 0.032], [0.3, 0.032, 0.03], [1, 0.021, 0.021]],
        hand: [[0, 0.021, 0.021], [0.4, 0.028, 0.023], [0.8, 0.022, 0.019], [1, 0.015, 0.014]],
        rumpf: [[0, 0.108, 0.094], [0.2, 0.106, 0.092], [0.42, 0.079, 0.081], [0.7, 0.088, 0.118], [0.88, 0.084, 0.09], [1, 0.05, 0.058]],
        hals: [[0, 0.043, 0.046], [1, 0.038, 0.038]],
        kopf: [0.03, -0.122, 0.08, -0.12, 0.1, -0.082, 0.088, -0.05, 0.132, -0.03, 0.092, 0.012, 0.104, 0.06, 0.08, 0.126, 0, 0.148, -0.09, 0.126, -0.124, 0.04, -0.104, -0.058, -0.04, -0.1],
        haar: [0.104, 0.058, 0.09, 0.14, 0, 0.166, -0.106, 0.142, -0.144, 0.045, -0.122, -0.052, -0.076, -0.072, -0.05, -0.03, -0.024, 0.016, 0.03, 0.016, 0.058, 0.046],
        dutt: [-0.128, 0.098, 0.056],
        fuss: 0.9,
      },
    },
    {
      art: "mann",
      mass: 1,
      haut: "#e4b18a", hell: "#f3cdab", dunkel: "#c08862", linie: "#7f5036",
      haar: "#2f231d", haarH: "#4a382e", anzug: "#e3262f", anzugD: "#ad1622", streifen: "#ffffff", mund: "#a35a4c",
      form: {
        ober: [[0, 0.086, 0.092], [0.3, 0.09, 0.086], [0.72, 0.066, 0.064], [1, 0.054, 0.053]],
        unter: [[0, 0.052, 0.055], [0.26, 0.047, 0.07], [0.62, 0.036, 0.048], [1, 0.03, 0.032]],
        oberarm: [[0, 0.054, 0.056], [0.4, 0.047, 0.048], [1, 0.037, 0.037]],
        unterarm: [[0, 0.037, 0.039], [0.3, 0.04, 0.037], [1, 0.025, 0.025]],
        hand: [[0, 0.024, 0.024], [0.4, 0.032, 0.027], [0.8, 0.026, 0.022], [1, 0.017, 0.016]],
        rumpf: [[0, 0.106, 0.096], [0.2, 0.104, 0.096], [0.42, 0.092, 0.088], [0.7, 0.112, 0.132], [0.9, 0.1, 0.104], [1, 0.062, 0.07]],
        hals: [[0, 0.052, 0.056], [1, 0.046, 0.046]],
        kopf: [0.03, -0.128, 0.086, -0.126, 0.108, -0.086, 0.092, -0.052, 0.142, -0.034, 0.096, 0.012, 0.108, 0.06, 0.082, 0.128, 0, 0.15, -0.092, 0.128, -0.128, 0.04, -0.108, -0.06, -0.04, -0.105],
        haar: [0.1, 0.07, 0.086, 0.137, 0, 0.162, -0.1, 0.137, -0.14, 0.04, -0.118, -0.062, -0.07, -0.076, -0.05, -0.02, -0.03, 0.036, 0.02, 0.03, 0.048, 0.06],
        hose: [[0, 0.086, 0.092], [1, 0.09, 0.086]],
        dutt: null,
        fuss: 0.95,
      },
    },
  ];

  // Das Licht des Tages auf Haut und Stoff: morgens und abends warm, in der
  // Dämmerung und nachts kühl – hell bleibt sie, das Flutlicht steht auf ihr.
  const TAGESLICHT = [["#ffd2a6", 0.1], null, ["#ffe0b4", 0.05], ["#ff9566", 0.17], ["#a9b3ee", 0.2], ["#98a6ee", 0.24]];
  const farbenSpeicher = new Map();
  function farbenVon(F) {
    const tag = tagBei(state.nr);
    const schluessel = `${F.art}|${tag}`;
    let P = farbenSpeicher.get(schluessel);
    if (P) return P;
    const licht = TAGESLICHT[tag];
    const f = (farbe) => (licht ? mische(farbe, licht[0], licht[1]) : farbe);
    P = {
      flach: false,
      haut: f(F.haut), hell: f(F.hell), dunkel: f(F.dunkel),
      fern: f(mische(F.haut, F.dunkel, 0.7)), fernD: f(mische(F.dunkel, "#000000", 0.14)),
      linie: f(F.linie), haar: f(F.haar), haarH: f(F.haarH),
      anzug: f(F.anzug), anzugD: f(F.anzugD), streifen: f(F.streifen), mund: f(F.mund), auge: "#2a1c17",
    };
    farbenSpeicher.set(schluessel, P);
    return P;
  }

  // Ein runder, geschlossener Umriss um ein Vieleck (x0, y0, x1, y1, …): Er
  // geht durch die Mitten der Kanten.
  function rundIn(ziel, p) {
    const n = p.length;
    ziel.moveTo((p[n - 2] + p[0]) / 2, (p[n - 1] + p[1]) / 2);
    for (let i = 0; i < n; i += 2) {
      const k = (i + 2) % n;
      ziel.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[k]) / 2, (p[i + 1] + p[k + 1]) / 2);
    }
    ziel.closePath();
  }

  function rundPfad(p) {
    const pfad = new Path2D();
    rundIn(pfad, p);
    return pfad;
  }

  // Ein Glied von a nach b mit seiner Form, an beiden Enden rund (ende: wie
  // weit die Kappe am Ende vorsteht, 1 ist rund, nahe 0 ein gerader Schnitt).
  function gliedPfad(a, b, form, ende = 1) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1e-6;
    const ux = dx / l;
    const uy = dy / l;
    const p = [];
    const punkt = (weit, quer) => { p.push(a[0] + ux * weit - uy * quer, a[1] + uy * weit + ux * quer); };
    const n = form.length;
    for (let i = 0; i < n; i += 1) punkt(form[i][0] * l, form[i][1]);
    const e = form[n - 1];
    const ke = (e[1] + e[2]) * 0.5 * ende;
    punkt(l + ke, e[1] * 0.55);
    punkt(l + ke, -e[2] * 0.55);
    for (let i = n - 1; i >= 0; i -= 1) punkt(form[i][0] * l, -form[i][2]);
    const s = form[0];
    const ks = (s[1] + s[2]) * 0.5;
    punkt(-ks, -s[2] * 0.55);
    punkt(-ks, s[1] * 0.55);
    return rundPfad(p);
  }

  const RP = [0, 0];
  function rumpfPfad(j, form) {
    const p = [];
    const n = form.length;
    for (let i = 0; i < n; i += 1) { rumpfPunkt(j, form[i][0], form[i][1], RP); p.push(RP[0], RP[1]); }
    const e = form[n - 1];
    rumpfPunkt(j, 1.06, e[1] * 0.5, RP); p.push(RP[0], RP[1]);
    rumpfPunkt(j, 1.06, -e[2] * 0.5, RP); p.push(RP[0], RP[1]);
    for (let i = n - 1; i >= 0; i -= 1) { rumpfPunkt(j, form[i][0], -form[i][2], RP); p.push(RP[0], RP[1]); }
    // Unten das Becken.
    const s = form[0];
    rumpfPunkt(j, -0.16, -s[2] * 0.6, RP); p.push(RP[0], RP[1]);
    rumpfPunkt(j, -0.16, s[1] * 0.6, RP); p.push(RP[0], RP[1]);
    return rundPfad(p);
  }

  // Wie breit der Rumpf bei t ist (spalte 1: hinten, 2: vorne).
  function rumpfBreite(form, t, spalte) {
    for (let i = 1; i < form.length; i += 1) {
      if (t <= form[i][0]) return lerp(form[i - 1][spalte], form[i][spalte], (t - form[i - 1][0]) / (form[i][0] - form[i - 1][0]));
    }
    return form[form.length - 1][spalte];
  }

  /*
   * Der Badeanzug: der Rumpf von unten bis hinten und vorne (Anteil der
   * Wirbelsäule), dazwischen der Schnitt als Ecken [t, quer]. Beim Mann die
   * Hose, bei der Frau ein Einteiler – hinten tief ausgeschnitten, vorne bis
   * über die Brust, mit einem Träger über die Schulter.
   */
  const SCHNITT = {
    mann: { hinten: 0.21, vorne: 0.16, ecken: [] },
    frau: { hinten: 0.5, vorne: 0.83, ecken: [[0.56, 0.06], [0.78, 0.004], [0.965, 0.02], [0.965, 0.02], [0.965, -0.03], [0.965, -0.03], [0.9, -0.064]] },
  };
  function anzugPfad(j, form, schnitt) {
    const p = [];
    const dazu = (t, quer) => { rumpfPunkt(j, t, quer, RP); p.push(RP[0], RP[1]); };
    for (const zeile of form) if (zeile[0] < schnitt.hinten) dazu(zeile[0], zeile[1]);
    // Die Ecken des Schnitts doppelt: Dort ist der Rand scharf.
    const h = rumpfBreite(form, schnitt.hinten, 1) * 0.97;
    dazu(schnitt.hinten, h);
    dazu(schnitt.hinten, h);
    for (const e of schnitt.ecken) dazu(e[0], e[1]);
    const v = -rumpfBreite(form, schnitt.vorne, 2) * 0.97;
    dazu(schnitt.vorne, v);
    dazu(schnitt.vorne, v);
    for (let i = form.length - 1; i >= 0; i -= 1) if (form[i][0] < schnitt.vorne) dazu(form[i][0], -form[i][2]);
    dazu(-0.16, -form[0][2] * 0.6);
    dazu(-0.16, form[0][1] * 0.6);
    return rundPfad(p);
  }

  // Ein Umriss um einen Punkt: je Ecke «entlang» und «quer» zur Richtung w.
  function umrissPfad(mitte, w, form, mass = 1) {
    const r = rad(w);
    const ex = Math.cos(r) * mass;
    const ey = Math.sin(r) * mass;
    const p = [];
    for (let i = 0; i < form.length; i += 2) {
      p.push(mitte[0] + form[i] * ex - form[i + 1] * ey, mitte[1] + form[i] * ey + form[i + 1] * ex);
    }
    return rundPfad(p);
  }

  /*
   * Die Figur in der Haltung pose, mit den Gelenken j – gemalt in Metern des
   * Körpers, die Hüfte bei 0. Von hinten nach vorne: der abgewandte Arm, das
   * abgewandte Bein, Rumpf und Kopf, das zugewandte Bein, der zugewandte Arm.
   * Jede Gruppe hat einen feinen Rand um das Ganze – nicht um jedes Glied,
   * sonst hätte sie Nähte an den Gelenken. P.flach: nur die Fläche, in einer
   * Farbe (die Geister).
   */
  function maleFigur(c, F, j, pose, P) {
    const form = F.form;
    const flach = P.flach;
    c.lineJoin = "round";
    c.lineCap = "round";
    const gruppe = (teile) => {
      if (!flach) {
        c.strokeStyle = P.linie;
        c.lineWidth = 0.02;
        for (const t of teile) c.stroke(t[0]);
      }
      for (const t of teile) {
        c.fillStyle = t[1];
        c.fill(t[0]);
      }
    };
    // Licht von vorne oben: quer über das Glied von hell nach dunkel.
    const verlauf = (a, b, breit, hell, mitte, dunkel) => {
      if (flach) return P.haut;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1e-6;
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const nx = (-dy / l) * breit;
      const ny = (dx / l) * breit;
      const v = c.createLinearGradient(mx + nx, my + ny, mx - nx, my - ny);
      v.addColorStop(0, hell);
      v.addColorStop(0.5, mitte);
      v.addColorStop(1, dunkel);
      return v;
    };
    const arm = (s, fern) => {
      const el = j[`el${s}`];
      const ha = j[`ha${s}`];
      const hell = fern ? P.fern : P.hell;
      const mitte = fern ? P.fern : P.haut;
      const dunkel = fern ? P.fernD : P.dunkel;
      gruppe([
        [gliedPfad(j.Sch, el, form.oberarm), verlauf(j.Sch, el, 0.055, hell, mitte, dunkel)],
        [gliedPfad(el, ha, form.unterarm), verlauf(el, ha, 0.04, hell, mitte, dunkel)],
        [gliedPfad(ha, j[`fi${s}`], form.hand), flach ? P.haut : mitte],
      ]);
    };
    const bein = (s, fern) => {
      const kn = j[`kn${s}`];
      const fu = j[`fu${s}`];
      const hell = fern ? P.fern : P.hell;
      const mitte = fern ? P.fern : P.haut;
      const dunkel = fern ? P.fernD : P.dunkel;
      gruppe([
        [gliedPfad(j.H, kn, form.ober), verlauf(j.H, kn, 0.09, hell, mitte, dunkel)],
        [gliedPfad(kn, fu, form.unter), verlauf(kn, fu, 0.062, hell, mitte, dunkel)],
        [umrissPfad(fu, pose[`fuss${s}`], FUSS_FORM, form.fuss), flach ? P.haut : mitte],
      ]);
      if (!flach && F.art === "mann") {
        // Die Badehose reicht ein Stück auf den Oberschenkel – und liegt an
        // der Hüfte über dem Bein, sonst zöge dessen Rand einen Bogen hindurch.
        if (!fern) {
          c.fillStyle = stoff;
          c.fill(anzug);
        }
        c.fillStyle = fern ? P.anzugD : P.anzug;
        c.fill(gliedPfad(j.H, [lerp(j.H[0], kn[0], 0.29), lerp(j.H[1], kn[1], 0.29)], form.hose, 0.3));
      }
    };

    const rumpf = rumpfPfad(j, form.rumpf);
    const vorn = rumpfPunkt(j, 0.5, -0.12, [0, 0]);
    const hinten = rumpfPunkt(j, 0.5, 0.12, [0, 0]);
    let stoff = null;
    let anzug = null;
    if (!flach) {
      anzug = anzugPfad(j, form.rumpf, SCHNITT[F.art]);
      stoff = c.createLinearGradient(vorn[0], vorn[1], hinten[0], hinten[1]);
      stoff.addColorStop(0, P.anzug);
      stoff.addColorStop(0.55, P.anzug);
      stoff.addColorStop(1, P.anzugD);
    }
    arm("H", true);
    bein("H", true);

    // Rumpf, Hals und Kopf.
    const r = rad(j.kw);
    const ux = Math.cos(r) * KOPF_MASS;
    const uy = Math.sin(r) * KOPF_MASS;
    const imKopf = (vor, hoch) => [j.C[0] + vor * uy + hoch * ux, j.C[1] - vor * ux + hoch * uy];
    const kopf = umrissPfad(j.C, j.kw - 90, form.kopf, KOPF_MASS);
    let hautRumpf = P.haut;
    if (!flach) {
      hautRumpf = c.createLinearGradient(vorn[0], vorn[1], hinten[0], hinten[1]);
      hautRumpf.addColorStop(0, P.hell);
      hautRumpf.addColorStop(0.45, P.haut);
      hautRumpf.addColorStop(1, P.dunkel);
    }
    let hautKopf = P.haut;
    if (!flach) {
      const stirn = imKopf(0.12, 0.03);
      const nacken = imKopf(-0.12, -0.03);
      hautKopf = c.createLinearGradient(stirn[0], stirn[1], nacken[0], nacken[1]);
      hautKopf.addColorStop(0, P.hell);
      hautKopf.addColorStop(0.5, P.haut);
      hautKopf.addColorStop(1, P.dunkel);
    }
    gruppe([
      [gliedPfad(j.S, imKopf(-0.022, -0.07), form.hals), flach ? P.haut : P.dunkel],
      [rumpf, hautRumpf],
      [kopf, hautKopf],
    ]);
    if (!flach) {
      // Der Einteiler liegt unter dem Bein, die Hose des Manns darüber (bein).
      if (F.art === "frau") {
        c.fillStyle = stoff;
        c.fill(anzug);
      }
      // Der Einteiler hat einen weissen Streifen an der Seite.
      if (F.art === "frau") {
        c.strokeStyle = P.streifen;
        c.lineWidth = 0.016;
        c.beginPath();
        for (let t = -0.1; t <= 0.471; t += 0.1) {
          rumpfPunkt(j, Math.min(t, 0.47), 0.012, RP);
          if (t < -0.09) c.moveTo(RP[0], RP[1]); else c.lineTo(RP[0], RP[1]);
        }
        c.stroke();
      }

      // Das Haar: bei der Frau ein Dutt am Hinterkopf.
      c.fillStyle = P.haar;
      if (form.dutt) {
        const d = imKopf(form.dutt[0], form.dutt[1]);
        c.beginPath();
        c.arc(d[0], d[1], form.dutt[2] * KOPF_MASS, 0, Math.PI * 2);
        c.fill();
      }
      c.fill(umrissPfad(j.C, j.kw - 90, form.haar, KOPF_MASS));
      c.strokeStyle = P.haarH;
      c.lineWidth = 0.012;
      c.beginPath();
      let q = imKopf(0.06, 0.1);
      c.moveTo(q[0], q[1]);
      q = imKopf(-0.02, 0.135);
      const q2 = imKopf(-0.09, 0.09);
      c.quadraticCurveTo(q[0], q[1], q2[0], q2[1]);
      c.stroke();
      // Ohr, Auge, Braue, Mund.
      q = imKopf(-0.012, -0.012);
      c.fillStyle = P.haut;
      c.strokeStyle = P.linie;
      c.lineWidth = 0.008;
      c.beginPath();
      c.ellipse(q[0], q[1], 0.015, 0.024, r - Math.PI / 2, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      q = imKopf(0.068, 0.014);
      c.fillStyle = P.auge;
      c.beginPath();
      c.ellipse(q[0], q[1], 0.012, 0.009, r - Math.PI / 2, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = P.haar;
      c.lineWidth = 0.009;
      c.beginPath();
      q = imKopf(0.05, 0.04);
      c.moveTo(q[0], q[1]);
      q = imKopf(0.09, 0.037);
      c.lineTo(q[0], q[1]);
      c.stroke();
      c.strokeStyle = P.mund;
      c.lineWidth = 0.008;
      c.beginPath();
      q = imKopf(0.066, -0.072);
      c.moveTo(q[0], q[1]);
      q = imKopf(0.092, -0.068);
      c.lineTo(q[0], q[1]);
      c.stroke();
    }

    bein("V", false);
    arm("V", false);
  }

  // Die Geister werden erst für sich gemalt und dann als Ganzes durchsichtig
  // ins Bild gelegt – sonst schienen ihre Glieder durcheinander.
  const geistBild = { c: null, g: null, gross: 0 };
  const GEIST_FARBEN = { flach: true, haut: "#ffffff" };

  /*
   * Die Figur im Bild: ihr Schwerpunkt an (x, y), gedreht um winkel Grad nach
   * vorne (0: aufrecht, 180: kopfüber) – oder, wenn die Haltung auf dem
   * Brett steht (pose.boden), mit den Füssen auf dem Brett bei x. farbe: als
   * Geist, ganz in dieser Farbe. brett: so viel höher als das Brett dieses
   * Sprungs steht sie (ein Geist aus einer Runde mit anderen Höhen).
   */
  function zeichneSpringer(x, y, winkel, pose, { farbe = null, alpha = 1, figur = state.figur, brett = 0 } = {}) {
    const fs = figurGroesse(figur);
    const X = bildX(x);
    const Y = bildY(pose.boden ? deckHoehe() + brett : y);
    if (X < -fs * 3 || X > view.cssW + fs * 3 || Y < -fs * 3 || Y > view.cssH + fs * 3) return;
    const j = gelenke(pose);
    const setze = (c) => {
      if (pose.boden) {
        c.scale(fs, -fs);
        c.translate(pose.hx, pose.hy);
      } else {
        c.rotate(rad(winkel));
        c.scale(fs, -fs);
        c.translate(-j.sx, -j.sy);
      }
    };
    if (!farbe) {
      g.save();
      g.globalAlpha = alpha;
      g.translate(X, Y);
      setze(g);
      maleFigur(g, figur, j, pose, farbenVon(figur));
      g.restore();
      return;
    }
    // Als Geist: die Mitte der kleinen Leinwand liegt auf der Mitte der Figur.
    const gross = Math.ceil(fs * 3.3);
    const q = view.dpr;
    if (!geistBild.c || geistBild.gross !== gross || geistBild.q !== q) {
      geistBild.c = geistBild.c || document.createElement("canvas");
      geistBild.c.width = Math.ceil(gross * q);
      geistBild.c.height = Math.ceil(gross * q);
      geistBild.g = geistBild.c.getContext("2d");
      geistBild.gross = gross;
      geistBild.q = q;
    }
    const mx = pose.boden ? pose.hx * fs : 0;
    const my = pose.boden ? -(pose.hy + 0.15) * fs : 0;
    const c = geistBild.g;
    c.setTransform(q, 0, 0, q, 0, 0);
    c.clearRect(0, 0, gross, gross);
    c.translate(gross / 2 - mx, gross / 2 - my);
    setze(c);
    GEIST_FARBEN.haut = farbe;
    maleFigur(c, figur, j, pose, GEIST_FARBEN);
    g.save();
    g.globalAlpha = alpha;
    g.drawImage(geistBild.c, X + mx - gross / 2, Y + my - gross / 2, gross, gross);
    g.restore();
  }

  // Die Gegner (geist.js): halb durchsichtige Springer in ihrer Farbe – nur,
  // wer gerade von derselben Plattform springt. Wie eng er sich macht, folgt
  // aus seiner Drehung: Wer schnell dreht, ist im Päckchen. Anlauf und
  // Absprung zeigen sie wie der Springer selbst; dafür merkt sich das Spiel
  // je Lauf, wann er an der Kante ankam.
  const geistPosen = new WeakMap();
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    const ms = gegner.zeit();
    const da = [];
    orte.forEach((o) => {
      if (o.ziel) return;
      const wx = o.a / 10;
      const nr = Math.floor((wx + ABSTAND / 2) / ABSTAND);
      if (nr !== state.nr || Math.abs(o.da) > 200) return;
      const x = wx - nr * ABSTAND;
      const y = o.b / 10;
      const winkel = grad((o.c || 0) / 100);
      const bald = o.lauf?.ort?.(ms + 100);
      // Grad je Sekunde echter Zeit – im Spiel lief der Fall um TEMPO langsamer.
      const w = bald ? (Math.abs(grad((bald.c - o.c) / 100)) * 10) / TEMPO : 0;
      const offen = clamp(1 - Math.sqrt(w / W_PAECK), 0, 1);
      let z = o.lauf ? geistPosen.get(o.lauf) : null;
      if (!z) {
        z = { pose: haltung({}), nr: -1, ms, ankunft: -1, arme: 1, tf: 9, tiefer: 0 };
        if (o.lauf) geistPosen.set(o.lauf, z);
      }
      if (z.nr !== nr || ms < z.ms) {
        z.nr = nr;
        z.ankunft = -1;
        z.arme = 1;
        z.tf = 9;
      }
      const dt = clamp((ms - z.ms) / 1000, 0, 0.1);
      z.ms = ms;
      const steigt = (o.db || 0) > 1.5;
      // Sein Brett: Ohne Turnier hat jede Runde ihre eigenen Höhen – er
      // steht auf seinem, auch wenn es anders hoch ist als dieses.
      const seinH = Math.round(y - SCHWERPUNKT + 0.05);
      let dreh = winkel;
      if (y > 4 && Math.abs(y - SCHWERPUNKT - seinH) < 0.2 && x <= KANTE_X + 0.1 && !steigt) {
        if (x < KANTE_X - 0.05) {
          z.ankunft = -1;
          bodenPose(z.pose, { gang: gangBei(x), weg: anlaufWeg(), zeit: state.echt });
        } else {
          if (z.ankunft < 0) z.ankunft = ms;
          bodenPose(z.pose, { wipp: (ms - z.ankunft) / 1000 / ABSPRUNG_NACH });
        }
        z.tf = 0;
        z.arme = 1;
      } else if (y < 0.4) {
        schwimmPose(z.pose, state.echt, false, 0);
        z.pose.boden = false;
        dreh = 0;
      } else {
        z.tf += dt * TEMPO;
        z.arme = naeher(z.arme, armeZiel(winkel), 7, dt);
        flugPose(z.pose, offen, z.arme, z.tf);
      }
      // Im Wasser liegt sie tiefer, als gerechnet: Nur Kopf und Schultern
      // schauen heraus.
      z.tiefer = naeher(z.tiefer, y < 0.4 ? TIEFER : 0, 5, dt);
      zeichneSpringer(x, y - z.tiefer, dreh, z.pose, { farbe: o.farbe, alpha: 0.45 * o.blass, brett: seinH - state.H });
      da.push({ ...o, sx: bildX(x), sy: bildY(y) - figurMass() * 1.3, weit: "" });
    });
    if (da.length) window.LernappGeist.namen(g, da, { breit: view.cssW, hoch: view.cssH });
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Anzeigen
  // ---------------------------------------------------------------------------
  // Ein weicher weisser Fleck für Gischt und Luftwolken – einmal gemalt.
  let weich = null;
  function weichBild() {
    if (weich) return weich;
    weich = document.createElement("canvas");
    weich.width = 64;
    weich.height = 64;
    const cg = weich.getContext("2d");
    const v = cg.createRadialGradient(32, 32, 0, 32, 32, 32);
    v.addColorStop(0, "rgba(255, 255, 255, 1)");
    v.addColorStop(0.45, "rgba(255, 255, 255, 0.5)");
    v.addColorStop(1, "rgba(255, 255, 255, 0)");
    cg.fillStyle = v;
    cg.fillRect(0, 0, 64, 64);
    return weich;
  }

  /*
   * Die Teilchen: Tropfen als kurze Striche in Flugrichtung, Gischt und die
   * Luftwolke unter Wasser als weiche Flecken, Blasen als kleine Kugeln mit
   * einem Glanzpunkt. Die Funken des Feuerwerks leuchten zusammengezählt.
   */
  function zeichneTeile() {
    if (!state.teile.length) return;
    const z = kam.z;
    g.lineCap = "round";
    for (let durchgang = 0; durchgang < 2; durchgang += 1) {
      if (durchgang) g.globalCompositeOperation = "lighter";
      for (const t of state.teile) {
        const hell = t.art === "funke";
        if (hell !== Boolean(durchgang)) continue;
        const k = clamp(t.leben / t.max, 0, 1);
        const X = bildX(t.x);
        const Y = bildY(t.y);
        if (X < -40 || X > view.cssW + 40 || Y < -40 || Y > view.cssH + 40) continue;
        if (t.art === "tropfen") {
          g.globalAlpha = Math.min(1, k * 3);
          g.strokeStyle = t.farbe;
          g.lineWidth = Math.max(1.1, t.r * z * 1.5);
          g.beginPath();
          g.moveTo(X, Y);
          g.lineTo(X - t.vx * 0.028 * z, Y + t.vy * 0.028 * z);
          g.stroke();
        } else if (t.art === "gischt" || t.art === "wolke") {
          const r = Math.max(2, t.r * z * (1 + (1 - k) * t.waechst));
          g.globalAlpha = Math.min(1, k * 1.6) * t.deck;
          g.drawImage(weichBild(), X - r, Y - r, r * 2, r * 2);
        } else if (t.art === "blase") {
          const r = Math.max(1, t.r * z);
          g.globalAlpha = Math.min(1, k * 3) * 0.8;
          g.fillStyle = t.farbe;
          g.beginPath();
          g.arc(X, Y, r, 0, Math.PI * 2);
          if (r < 2.2) {
            g.fill();
          } else {
            g.strokeStyle = t.farbe;
            g.lineWidth = Math.max(1, r * 0.24);
            g.stroke();
            g.globalAlpha *= 0.25;
            g.fill();
            g.globalAlpha = Math.min(1, k * 3) * 0.9;
            g.beginPath();
            g.arc(X - r * 0.34, Y - r * 0.34, r * 0.24, 0, Math.PI * 2);
            g.fill();
          }
        } else {
          g.fillStyle = t.farbe;
          g.globalAlpha = Math.min(1, k * 1.6);
          g.beginPath();
          g.arc(X, Y, Math.max(0.8, t.r * z * (0.5 + k * 0.5)), 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const s of state.schriften) {
      const k = clamp(s.leben / s.max, 0, 1);
      const alter = s.max - s.leben;
      const pop = alter < 0.15 && !ruhig() ? 0.6 + (alter / 0.15) * 0.4 + Math.sin((alter / 0.15) * Math.PI) * 0.25 : 1;
      const gross = Math.round(s.gross * clamp(view.minD / 380, 0.9, 1.5) * pop);
      const sp = s.folgt ? state.sp : null;
      const X0 = sp ? bildX(sp.x) : bildX(s.x);
      const Y0 = sp ? bildY(sp.y) - figurMass() * 2.4 : bildY(s.y);
      const x = clamp(X0, gross * s.text.length * 0.3 + 8, view.cssW - gross * s.text.length * 0.3 - 8);
      const y = clamp(Y0 - (1 - k) * 20, view.frei + gross, view.cssH - gross * 3);
      g.globalAlpha = Math.min(1, k * 2.5);
      g.font = `900 ${gross}px system-ui, sans-serif`;
      g.lineWidth = Math.max(3, gross * 0.2);
      g.lineJoin = "round";
      g.strokeStyle = "rgba(10, 14, 30, 0.75)";
      g.strokeText(s.text, x, y);
      g.fillStyle = s.farbe;
      g.fillText(s.text, x, y);
    }
    g.globalAlpha = 1;
  }

  // Im ersten Sprung: was jetzt zu tun ist, gross unter dem Springer.
  function zeichneHilfe() {
    if (!state.hilfe || state.phase !== "spiel" || state.schritt !== "flug") return;
    const sp = state.sp;
    const gross = Math.round(clamp(view.minD * 0.06, 16, 26));
    const x = clamp(bildX(sp.x), 70, view.cssW - 70);
    const y = clamp(bildY(sp.y) + figurMass() * 2.6, view.frei + 40, view.cssH - 30);
    g.font = `900 ${gross}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = Math.max(3, gross * 0.22);
    g.lineJoin = "round";
    g.strokeStyle = "rgba(10, 14, 30, 0.8)";
    g.strokeText(state.hilfe, x, y);
    g.fillStyle = state.hilfe === "Loslassen!" ? "#3dff8c" : "#ffd23f";
    g.fillText(state.hilfe, x, y);
  }

  function pille(text, x, y, gross, grund, schrift) {
    g.font = `900 ${gross}px system-ui, sans-serif`;
    const w = g.measureText(text).width + gross * 1.4;
    const h = gross * 1.7;
    g.fillStyle = grund;
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, h / 2);
    else g.rect(x, y, w, h);
    g.fill();
    g.fillStyle = schrift;
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText(text, x + gross * 0.7, y + h / 2 + 1);
    return h;
  }

  // Oben links, unter den Knöpfen: die Punkte, darunter Sprung und Höhe,
  // die Reihe der perfekten Sprünge – im Flug, wie weit es noch bis zum
  // Wasser ist.
  function zeichneAnzeige() {
    if (state.phase === "bereit") return;
    flach();
    g.translate(0, view.frei);
    const gross = clamp(view.cssH * 0.05, 14, 24);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    const text = `${state.punkte}`;
    const x = 12;
    let y = 12;
    const w = g.measureText(text).width + gross * 2.2;
    const hoch = gross * 1.6;
    g.fillStyle = "rgba(12, 16, 34, 0.6)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, hoch, hoch / 2);
    else g.rect(x, y, w, hoch);
    g.fill();
    // Ein kleiner Springer kopfüber vor der Zahl.
    const bx = x + gross * 0.85;
    const by = y + hoch / 2;
    g.strokeStyle = "#F5A623";
    g.lineWidth = Math.max(2, gross * 0.13);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(bx, by - gross * 0.42);
    g.lineTo(bx, by + gross * 0.2);
    g.moveTo(bx - gross * 0.12, by + gross * 0.42);
    g.lineTo(bx, by + gross * 0.2);
    g.lineTo(bx + gross * 0.12, by + gross * 0.42);
    g.stroke();
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(bx, by - gross * 0.02, gross * 0.13, 0, Math.PI * 2);
    g.fill();
    g.lineCap = "butt";
    g.fillStyle = "#ffffff";
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText(text, x + gross * 1.6, by + 1);
    y += hoch + 6;
    const klein = Math.round(gross * 0.6);
    y += pille(`Sprung ${state.nr + 1}/${SPRUENGE} · ${state.H} m`, x, y, klein, "rgba(12, 16, 34, 0.55)", "#ffffff") + 5;
    if (state.kette > 0) {
      y += pille(`Nächster perfekt: ×${malBei(true, state.kette + 1)}`, x, y, klein, "rgba(255, 210, 63, 0.92)", "#2a1d00") + 5;
    }
    const sp = state.sp;
    if (sp && state.schritt === "flug") {
      pille(`↓ ${Math.max(0, sp.y - 1).toFixed(1)} m`, x, y, klein, "rgba(12, 16, 34, 0.55)", "#8fd3ff");
    }
  }

  // Unten in der Mitte, wie im Fernsehen: vor dem Sprung Höhe und Pflicht,
  // nach dem Sprung die Saltos, die Note und die Punkte. Darüber die Tafeln
  // der drei Richter.
  function zeichneTv() {
    const tv = state.tv;
    if (!tv) return;
    const ein = clamp(tv.alter / 0.25, 0, 1);
    const aus = clamp((tv.dauer - tv.alter) / 0.3, 0, 1);
    const k = Math.min(ein, aus);
    if (k <= 0) return;
    flach();
    const W = view.cssW;
    const breit = Math.min(W - 24, 420);
    const gross = clamp(view.minD * 0.075, 22, 40);
    const klein = Math.round(clamp(gross * 0.42, 11, 15));
    const zeile1 = klein * 1.55;
    const zeile2 = zeile1 + gross * 1.02;
    const zeile3 = zeile2 + klein * 1.65;
    const hoch = zeile3 + klein * 0.85;
    const unten = view.cssH - 18;
    const x = (W - breit) / 2 - (1 - ein) * 40 * (ruhig() ? 0 : 1);
    const y = unten - hoch;
    g.globalAlpha = k;
    g.fillStyle = "rgba(10, 14, 30, 0.84)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, breit, hoch, 12);
    else g.rect(x, y, breit, hoch);
    g.fill();
    g.fillStyle = tv.farbe || "#F5A623";
    g.fillRect(x, y + 10, 5, hoch - 20);
    g.textBaseline = "alphabetic";
    g.textAlign = "left";
    g.fillStyle = "rgba(255, 255, 255, 0.7)";
    g.font = `800 ${klein}px system-ui, sans-serif`;
    g.fillText(tv.oben, x + 18, y + zeile1);
    g.fillStyle = "#ffffff";
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.fillText(tv.gross, x + 18, y + zeile2);
    if (tv.rechts) {
      g.textAlign = "right";
      g.font = `900 ${Math.round(gross * 0.55)}px system-ui, sans-serif`;
      g.fillStyle = tv.rechtsFarbe || "#ffffff";
      g.fillText(tv.rechts, x + breit - 16, y + zeile2 - gross * 0.08);
    }
    g.textAlign = "left";
    g.font = `800 ${klein}px system-ui, sans-serif`;
    g.fillStyle = tv.untenFarbe || "rgba(255, 255, 255, 0.85)";
    g.fillText(tv.unten, x + 18, y + zeile3);
    // Die Tafeln der Richter: eine nach der anderen hoch.
    const noten = tv.noten;
    if (noten) {
      const kw = clamp(gross * 1.25, 32, 48);
      const kh = kw * 0.8;
      for (let n = 0; n < noten.length; n += 1) {
        const auf = clamp((tv.alter - 0.35 - n * 0.18) / 0.2, 0, 1);
        if (auf <= 0) continue;
        const kx = x + breit - 16 - (noten.length - n) * (kw + 6) + 6;
        const ky = y - kh - 8 + (1 - auf) * 12;
        g.globalAlpha = k * auf;
        g.fillStyle = "#fffdf5";
        g.beginPath();
        if (g.roundRect) g.roundRect(kx, ky, kw, kh, 5);
        else g.rect(kx, ky, kw, kh);
        g.fill();
        g.fillStyle = "#1b1f33";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.font = `900 ${Math.round(kh * 0.5)}px system-ui, sans-serif`;
        g.fillText(noten[n].toFixed(1), kx + kw / 2, ky + kh / 2 + 1);
      }
    }
    g.globalAlpha = 1;
  }

  function zeichnen() {
    if (!g) return;
    kameraSetzen();
    g.setTransform(1, 0, 0, 1, 0, 0);
    zeichneHintergrund();
    flach();
    zeichneTurm();
    zeichneBoote();
    zeichneGeister();
    const sp = state.sp;
    if (sp) zeichneSpringer(sp.x, sp.y - sp.tiefer, sp.winkel + sp.kipp, sp.pose);
    zeichneUnterwasser();
    zeichneWasserlinie();
    zeichnePlatscher();
    zeichneTeile();
    zeichneFlutlicht();
    zeichneSchriften();
    zeichneHilfe();
    if (state.blitz > 0.01 && !ruhig()) {
      g.fillStyle = `rgba(255, 250, 235, ${state.blitz * 0.25})`;
      g.fillRect(0, 0, view.cssW, view.cssH);
    }
    zeichneTv();
    zeichneAnzeige();
    if (state.blende > 0.005) {
      flach();
      g.fillStyle = `rgba(8, 10, 22, ${state.blende})`;
      g.fillRect(0, 0, view.cssW, view.cssH);
    }
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  const TEILE_MAX = 520;

  function teil(t) {
    if (state.teile.length >= TEILE_MAX) state.teile.shift();
    state.teile.push(t);
  }

  /*
   * Die Spritzer beim Eintauchen. kraft: fast 0 ist ein «Rip» – ein dünner
   * Strahl, ein paar Tropfen –, 1 ein Sprung mit Schlagseite, darüber
   * Klatscher und Arschbombe. breit: wie weit der Fächer aufgeht (schmal bei
   * einem sauberen Sprung, weit beim Klatscher). schief: wohin er kippt
   * (-1 bis 1, plus nach vorne). Die Arschbombe wirft dazu einen Augenblick
   * später eine Säule in die Mitte.
   */
  function spritzer(x, kraft, breit = 1, schief = 0) {
    const wenig = ruhig();
    const stark = 0.16 + 0.84 * clamp(kraft / 1.7, 0, 1) ** 0.75;
    const faecher = lerp(0.24, 1.2, clamp((breit - 0.4) / 1.2, 0, 1)) + (kraft > 1.5 ? 0.22 : 0);
    const finger = [];
    const neuerFinger = (f) => {
      // So lange lebt er: bis seine Spitze wieder im Wasser ist.
      f.gipfel = (f.v * Math.cos(f.w)) / G;
      f.lebt = f.gipfel;
      f.oben = false;
      finger.push(f);
    };
    const anzahl = Math.max(2, Math.round(lerp(3, 10, stark) * (wenig ? 0.6 : 1)));
    for (let i = 0; i < anzahl; i += 1) {
      const u = anzahl > 1 ? (i / (anzahl - 1)) * 2 - 1 : 0;
      neuerFinger({
        x: x + u * 0.3 * breit + (Math.random() - 0.5) * 0.12,
        w: clamp(u * faecher + (Math.random() - 0.5) * 0.22 + schief * 0.3, -1.3, 1.3),
        v: lerp(3, 8.2, stark) * (0.7 + Math.random() * 0.5) * (1 - 0.3 * Math.abs(u) * (faecher < 0.6 ? 1 : 0.4)),
        dick: lerp(0.1, 0.52, stark) * (0.6 + Math.random() * 0.7),
        dauer: lerp(0.07, 0.2, stark) + Math.random() * 0.06,
        ab: Math.random() * 0.05 * (1 + stark),
      });
    }
    // Von links nach rechts geordnet: Zwischen ihren Spitzen steht die Krone.
    finger.sort((a, b) => a.w - b.w);
    const krone = finger.length;
    const kronZeit = (finger.reduce((summe, f) => summe + f.gipfel, 0) / krone) * 1.7;
    if (kraft > 1.5) neuerFinger({ x, w: (Math.random() - 0.5) * 0.1, v: 10.5, dick: 0.8, dauer: 0.3, ab: 0.14 });
    // Dazu wölbt sich das Wasser um die Stelle kurz auf.
    state.platscher.push({
      x, alter: 0, finger, krone, kronZeit,
      breit: (0.3 + 1.1 * stark) * (0.55 + 0.5 * breit), hoch: 0.12 + 0.9 * stark, dauer: 0.35 + 0.5 * stark,
    });
    if (state.platscher.length > 4) state.platscher.shift();

    const tropfen = Math.round(lerp(5, 48, stark) * (wenig ? 0.35 : 1));
    for (let i = 0; i < tropfen; i += 1) {
      const w = (Math.random() * 2 - 1) * (faecher * 1.2 + 0.15) + schief * 0.3;
      const v = lerp(2.5, 9.5, stark) * (0.35 + Math.random() * 0.85);
      teil({
        art: "tropfen", x: x + (Math.random() - 0.5) * 0.7 * breit, y: 0.05,
        vx: Math.sin(w) * v, vy: Math.cos(w) * v, r: 0.018 + Math.random() ** 2 * 0.05 * (0.5 + stark),
        farbe: i % 3 ? "#ffffff" : "#d6f1ff", leben: 2.6, max: 2.6,
      });
    }
    const gischt = Math.round(lerp(1, 14, stark) * (wenig ? 0.4 : 1));
    for (let i = 0; i < gischt; i += 1) {
      teil({
        art: "gischt", x: x + (Math.random() - 0.5) * (0.6 + breit) * (0.5 + stark), y: 0.05 + Math.random() * 0.3,
        vx: (Math.random() - 0.5) * 1.6, vy: 0.4 + Math.random() * 3.4 * stark, r: (0.12 + Math.random() * 0.2) * (0.6 + 1.6 * stark),
        deck: lerp(0.2, 0.4, stark), waechst: 1.2, leben: 0.5 + Math.random() * 0.6, max: 1.1,
      });
    }
    state.schaum.push({ x, alter: 0, dauer: 1.8 + 1.8 * stark, weit: (0.6 + 2.4 * stark) * (0.6 + 0.5 * breit), deck: lerp(0.5, 1, stark), saat: Math.random() * 100 });
    if (state.schaum.length > 4) state.schaum.shift();
  }

  // Luftblasen unter Wasser: grosse steigen schneller als kleine.
  function blasen(x, y, anzahl, streu = 0.7) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const r = 0.025 + Math.random() ** 2 * 0.1;
      teil({
        art: "blase", x: x + (Math.random() - 0.5) * streu, y: Math.min(-0.08, y + (Math.random() - 0.5) * streu),
        vx: (Math.random() - 0.5) * 0.5, vy: 0.5 + r * 14 + Math.random() * 0.8, r,
        farbe: "#dff6ff", leben: 1.2 + Math.random() * 1.4, max: 2.6,
      });
    }
  }

  // Die Luft, die der Körper mit hinunterreisst: eine weisse Wolke, die
  // langsam steigt und vergeht.
  function luftwolke(x, y) {
    teil({
      art: "wolke", x: x + (Math.random() - 0.5) * 0.4, y: Math.min(-0.25, y), vx: (Math.random() - 0.5) * 0.3, vy: 0.35 + Math.random() * 0.4,
      r: 0.16 + Math.random() * 0.2, deck: 0.2, waechst: 0.8, leben: 0.6 + Math.random() * 0.5, max: 1.1,
    });
  }

  // Alles, was beim Eintauchen zu sehen ist: die Spritzer, die Ringe und die
  // ersten Blasen. daneben: wie viele Grad sie neben der Senkrechten lag –
  // dorthin kippt das Wasser.
  function platsch(x, kraft, breit, daneben, fehl) {
    spritzer(x, kraft, breit, clamp(daneben / 30, -1, 1));
    const stark = 0.35 + kraft * 0.9;
    state.wellen.push({ x, alter: 0, dauer: 2.4, weit: 2.5 + kraft * 3, stark });
    state.wellen.push({ x, alter: -0.35, dauer: 2.4, weit: 2 + kraft * 2.4, stark: stark * 0.6 });
    blasen(x, -0.5, fehl ? 16 : 12, fehl ? 1.6 : 0.6);
  }

  /*
   * Was im Wasser nebenher zu sehen ist, Bild für Bild – im Spiel und beim
   * Zuschauen: die Schleppe aus Luft hinter dem Körper, solange er sinkt, und
   * kleine Ringe um ihn, wenn er oben Wasser tritt.
   */
  function wasserBild(dt) {
    const sp = state.sp;
    const sprung = state.sprung;
    if (!sp || !sprung?.eingetaucht || (state.schritt !== "wasser" && state.schritt !== "wechsel")) return;
    const seit = state.zeit - sprung.eintauchZeit;
    const tempo = Math.hypot(sp.vx, sp.vy);
    const wenig = ruhig() ? 0.3 : 1;
    const y = sp.y - sp.tiefer;
    if (y < 0.3 && seit < 1.3 && tempo > 0.4 && !istFehl(sprung.ergebnis)) {
      let n = tempo * dt * 16 * wenig;
      for (; n > 0; n -= 1) {
        if (n >= 1 || Math.random() < n) blasen(sp.x, y + 0.2 + Math.random() * 1.7, 1, 0.5);
      }
      if (seit < 0.5 && Math.random() < dt * 16 * wenig) luftwolke(sp.x, y + 0.4 + Math.random() * 1.6);
    }
    if (sp.tiefer > 0.3) {
      sp.ringIn -= dt;
      if (sp.ringIn <= 0) {
        sp.ringIn = 0.55;
        state.wellen.push({ x: sp.x, alter: 0, dauer: 1.3, weit: 1.1, stark: 0, klein: true });
      }
    }
  }

  function funken(x, y, anzahl, farben, kraft = 1) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = (3 + Math.random() * 6) * kraft;
      teil({ art: "funke", x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v, r: 0.06 + Math.random() * 0.08,
        farbe: farben[i % farben.length], leben: 0.5 + Math.random() * 0.5, max: 1 });
    }
  }

  function schrift(text, farbe, gross, dauer = 1.2, { x = 0, y = 0, folgt = true } = {}) {
    state.schriften.push({ text, farbe, gross, x, y, folgt, leben: dauer, max: dauer });
    if (state.schriften.length > 4) state.schriften.shift();
  }

  function tvZeigen(inhalt, dauer) {
    state.tv = { ...inhalt, alter: 0, dauer };
  }

  // Die Karte vor dem Sprung: welcher, wie hoch – und was perfekt brächte.
  function karteZeigen(dauer) {
    const plan = state.plan[state.nr];
    if (!plan) return;
    const letzter = state.nr === SPRUENGE - 1;
    tvZeigen({
      oben: `SPRUNG ${state.nr + 1} VON ${SPRUENGE}${letzter ? " · DER LETZTE" : ""}`,
      gross: `${state.H} m`,
      rechts: state.kette > 0 ? `Perfekt ×${malBei(true, state.kette + 1)}` : "",
      rechtsFarbe: "#ffd23f",
      unten: state.nr === 0 ? "Halten dreht · Loslassen streckt · senkrecht rein" : "Kopf oder Füsse voran, gestreckt",
      farbe: "#F5A623",
      karte: true,
    }, dauer);
  }

  // ---------------------------------------------------------------------------
  // Klänge (klang.js)
  // ---------------------------------------------------------------------------
  // Beim Zuschauen klingt es wie gespielt. Jeder Klang hat eine Mindestpause
  // in echter Zeit – die Prüfskripte rechnen ganze Serien am Stück.
  const klang = () => window.ArcadeKlang || null;
  const zuletzt = new Map();
  function ton(id, o = {}, pause = 80) {
    const ms = performance.now();
    if (ms - (zuletzt.get(id) ?? -1e9) < pause) return;
    zuletzt.set(id, ms);
    klang()?.ton?.(id, o);
  }

  // Eine Kulisse, die mit der Runde läuft: an() jedes Bild – weitergegeben
  // höchstens alle 50 ms –, aus() am Ende. Hat die Tafel oder der Neustart
  // sie gestoppt, holt an() sie neu (ohne Ton nur alle zwei Sekunden).
  function schleife(id) {
    let k = null;
    let ms = -1e9;
    let neu = -1e9;
    return {
      an(wert, laut = 1) {
        const jetzt = performance.now();
        if (jetzt - ms < 50) return;
        ms = jetzt;
        if (!k || (!k.laeuft && jetzt - neu > 2000)) { k = klang()?.kulisse?.(id) || null; neu = jetzt; }
        k?.setze(wert);
        k?.laut(laut);
      },
      aus() { k?.stop(); k = null; ms = -1e9; },
    };
  }
  const fahrtwind = schleife("turmspringen.flug");
  function klangAus() {
    fahrtwind.aus();
  }

  // Perfekt beim Eintauchen: die Harfe, nur die erste in Folge.
  let perfektFolge = 0;
  function perfektTon(perfekt, laut = 1, verzoegerung = 0) {
    if (!perfekt) { perfektFolge = 0; return; }
    perfektFolge += 1;
    if (perfektFolge === 1) ton("perfekt", { laut, verzoegerung }, 100);
  }

  // Jedes Bild: der Wind im Fall – je schneller, desto mehr.
  function klangTakt() {
    const sp = state.sp;
    const an = sp && (state.phase === "spiel" || (state.phase === "zuschauen" && !zuschauer?.fertig?.()));
    if (an && state.schritt === "flug") fahrtwind.an(clamp(0.15 + Math.hypot(sp.vx, sp.vy) / 22, 0, 1));
    else fahrtwind.aus();
  }

  // ---------------------------------------------------------------------------
  // Der Sprung
  // ---------------------------------------------------------------------------
  // kipp, tiefer und ringIn gehören nur zum Bild: wie weit sie sich nach
  // einer Arschbombe aufgerichtet hat (Grad), wie viel tiefer sie beim
  // Wassertreten gezeichnet wird (m), wann der nächste kleine Ring kommt.
  function neuerSpringer(H) {
    return {
      x: START_X, y: H + SCHWERPUNKT, vx: 0, vy: 0, winkel: 0, offen: 1, tf: 0,
      armeOben: 1, pose: bodenPose(haltung({})), kipp: 0, tiefer: 0, ringIn: 0,
    };
  }

  function neuerSprungZustand() {
    return {
      abgesprungen: false, ankunft: -1,
      eingetaucht: false, halbe: 0, err: 0, perfekt: false, mal: 1, punkte: 0, ergebnis: "", seitHalb: 0,
      eintauchZeit: -1, eintauchY: 0, auftauchen: false,
    };
  }

  // Ein Sprung: für den ersten und jeden weiteren – im Spiel und beim
  // Zuschauen.
  function sprungAufbauen(nr) {
    planBis(nr + 1);
    state.nr = nr;
    state.H = state.plan[nr].H;
    // Frau und Mann wechseln sich ab, Sprung um Sprung.
    state.figur = FIGUREN[(state.erste + nr) % FIGUREN.length];
    state.sp = neuerSpringer(state.H);
    state.sprung = neuerSprungZustand();
    state.teile = [];
    state.wellen = [];
    state.platscher = [];
    state.schaum = [];
    state.hilfe = "";
    kam.bereit = false;
    kam.wasserY = undefined;
  }

  function laufenSchritt(h) {
    const sp = state.sp;
    sp.x = Math.min(KANTE_X, sp.x + 1.7 * h);
    sp.y = state.H + SCHWERPUNKT + Math.abs(Math.sin(sp.x * 5)) * 0.03;
    if (sp.x >= KANTE_X) {
      state.schritt = "wippen";
      state.sprung.ankunft = state.zeit;
    }
  }

  // An der Kante: Er wippt einmal – tief in die Knie mit den Armen hinten,
  // dann auf die Zehen mit den Armen oben – und springt.
  function wippAnteil() {
    const u = clamp((state.zeit - state.sprung.ankunft) / ABSPRUNG_NACH, 0, 1);
    return 0.5 + 0.5 * Math.cos(u * Math.PI * 2);
  }

  function wippenSchritt() {
    const sp = state.sp;
    const tief = 1 - wippAnteil();
    sp.y = state.H + SCHWERPUNKT - 0.14 * tief;
    if (state.zeit - state.sprung.ankunft >= ABSPRUNG_NACH && !state.sprung.abgesprungen) abspringen();
  }

  // Der Absprung: immer gleich hoch, gleich weit, ohne Drehung. Drehen tut
  // er erst, wenn jemand hält.
  function abspringen() {
    const sp = state.sp;
    state.sprung.abgesprungen = true;
    sp.vy = V_AB;
    sp.vx = V_VOR;
    sp.x = KANTE_X;
    sp.y = state.H + SCHWERPUNKT;
    sp.tf = 0;
    state.schritt = "flug";
    if (state.phase !== "spiel") return;
    ton("turmspringen.absprung", { laut: 0.9 });
    kids()?.vibrate?.(8);
  }

  // Wie weit sein tiefster Punkt unter dem Schwerpunkt liegt: gestreckt die
  // Hände (kopfüber) oder die Füsse, im Päckchen ein Knäuel.
  function unterkante(winkel, offen) {
    const w = rad(winkel);
    const uy = Math.cos(w);
    const quer = 0.15 * Math.abs(Math.sin(w));
    const strecke = uy >= 0 ? 0.95 * uy : lerp(0.6, 1.25, offen) * -uy;
    return Math.max(lerp(0.55, 0.15, offen), strecke + quer);
  }

  // Ein Schritt im Fall: Schwerkraft, und gedreht wird, so weit er zu ist.
  function fallSchritt(p, hp, ziel) {
    p.offen = naeher(p.offen, ziel, ziel < p.offen ? SCHLIESSEN : OEFFNEN, hp);
    p.winkel += drehBei(p.offen) * hp;
    p.vy -= G * hp;
    p.x += p.vx * hp;
    p.y += p.vy * hp;
  }

  function flugSchritt(h) {
    const sp = state.sp;
    const sprung = state.sprung;
    const hp = h * TEMPO;
    sp.tf += hp;
    fallSchritt(sp, hp, state.halten ? 0 : 1);
    // Jede halbe Drehung ein kleines Zeichen am Springer.
    const halb = Math.floor(sp.winkel / 180 + 0.5);
    if (halb > sprung.seitHalb) {
      sprung.seitHalb = halb;
      if (state.phase === "spiel" && sp.y > 2) schrift(halbe(halb), "#ffffff", 15, 0.55, { folgt: false, x: sp.x + 2.6, y: sp.y + 0.6 });
    }
    if (sp.y - unterkante(sp.winkel, sp.offen) <= 0) eintauchen();
  }

  // Bis zum Wasser vorausrechnen: Wo steht seine Achse, wenn er jetzt
  // öffnet (oder im Päckchen bleibt)? Für die Hilfe im ersten Sprung und
  // den Autopiloten der Tests.
  function vorausWinkel(oeffnen = true) {
    const sp = state.sp;
    if (!sp || state.schritt !== "flug") return { winkel: sp?.winkel || 0, tau: 9, offen: 1 };
    const p = { x: sp.x, y: sp.y, vx: sp.vx, vy: sp.vy, winkel: sp.winkel, offen: sp.offen };
    const ziel = oeffnen ? 1 : 0;
    const hp = 1 / 120;
    for (let t = 0; t < 6; t += hp) {
      fallSchritt(p, hp, ziel);
      if (p.y - unterkante(p.winkel, p.offen) <= 0) return { winkel: p.winkel, tau: (t + hp) / TEMPO, offen: p.offen };
    }
    return { winkel: p.winkel, tau: 9, offen: p.offen };
  }

  /*
   * Er taucht ein. Wie viele halbe Drehungen es waren, sagt die Senkrechte,
   * der seine Achse am nächsten ist; wie weit er daneben liegt, ob es
   * perfekt war. Offen muss er sein: Wer im Päckchen bleibt, macht eine
   * Arschbombe. Liegt er quer, ist es ein Klatscher.
   */
  function eintauchen() {
    const sp = state.sp;
    const sprung = state.sprung;
    const n = state.nr;
    const halb = Math.max(0, Math.round(sp.winkel / 180));
    const err = Math.abs(sp.winkel - halb * 180);
    const offen = sp.offen;
    let ergebnis;
    if (offen < BOMBE) ergebnis = "bombe";
    else if (err > KLATSCH) {
      const lage = ((sp.winkel % 360) + 360) % 360;
      ergebnis = lage < 180 ? "bauch" : "ruecken";
    } else if (halb === 0) ergebnis = "kerze";
    else ergebnis = "gut";
    const perfekt = ergebnis === "gut" && err <= PERFEKT && offen >= OFFEN_GUT;
    if (perfekt) {
      state.kette += 1;
      state.perfekte += 1;
      state.besteKette = Math.max(state.besteKette, state.kette);
    } else {
      state.kette = 0;
    }
    const mal = malBei(perfekt, state.kette);
    const punkte = ergebnis === "gut" ? halb * mal : 0;
    sprung.eingetaucht = true;
    sprung.halbe = halb;
    sprung.err = err;
    sprung.perfekt = perfekt;
    sprung.mal = mal;
    sprung.punkte = punkte;
    sprung.ergebnis = ergebnis;
    sprung.eintauchZeit = state.zeit;
    state.punkte += punkte;
    state.sprunge.push(punkte);
    shell.setCount(state.punkte);
    state.schritt = "wasser";
    state.weiterIn = 2.2;
    state.hilfe = "";
    sp.y = Math.min(sp.y, unterkante(sp.winkel, sp.offen));
    sprung.eintauchY = sp.y;
    sp.vy *= 0.35;
    sp.vx *= 0.3;
    const fehl = ergebnis === "bombe" || ergebnis === "bauch" || ergebnis === "ruecken";
    const kraft = fehl ? (ergebnis === "bombe" ? 1.7 : 1.25) : 0.08 + err * 0.03;
    platsch(sp.x, kraft, ergebnis === "bombe" ? 0.6 : fehl ? 1.6 : 0.5, sp.winkel - halb * 180, fehl);
    kids()?.vibrate?.(fehl ? [30, 40, 60] : perfekt ? [10, 30, 14] : 14);
    fahrtwind.aus();
    // Der Platsch: leise beim sauberen Eintauchen, laut beim Klatscher.
    ton("turmspringen.eintauchen", { laut: clamp(0.35 + kraft * 0.6, 0.35, 1.3) });
    perfektTon(perfekt, 0.8, 0.05);
    if (perfekt) ton("turmspringen.rip", { laut: 0.9 });

    const oben = `SPRUNG ${n + 1} VON ${SPRUENGE} · ${state.H} m`;
    if (fehl) {
      state.aus = ergebnis === "bombe" ? "bombe" : "klatscher";
      const wort = { bombe: "Arschbombe", bauch: "Bauchklatscher", ruecken: "Rückenklatscher" }[ergebnis];
      state.grund = wort;
      state.stoss = 1;
      state.weiterIn = 2.8;
      if (!ruhig()) state.zeitlupe = 0.4;
      schrift(`${wort}!`, "#ff7a6b", 24, 1.8);
      tvZeigen({ oben, gross: wort, rechts: "0 Punkte", rechtsFarbe: "#ff7a6b", unten: "Die Runde ist vorbei", untenFarbe: "#ffb0a8", farbe: "#ff3b30" }, state.weiterIn);
      ton("fehler", { verzoegerung: 0.25 }, 300);
      return;
    }
    if (n >= SPRUENGE - 1) state.aus = "fertig";
    state.stoss = 0.25;
    const sauber = err <= 18;
    tvZeigen({
      oben,
      gross: ergebnis === "kerze" ? "Ohne Drehung" : saltos(halb),
      rechts: perfekt ? (mal > 2 ? `Perfekt ×${mal}` : "Perfekt") : sauber ? "Sauber" : "Spritzer",
      rechtsFarbe: perfekt ? "#ffd23f" : sauber ? "#ffffff" : "#ffb347",
      unten: ergebnis === "kerze" ? "Keine halbe Drehung, keine Punkte" : `+${punkte} ${punkte === 1 ? "Punkt" : "Punkte"}${mal > 1 ? ` (${halb} × ${mal})` : ""}`,
      untenFarbe: perfekt ? "#ffe9a0" : "rgba(255, 255, 255, 0.85)",
      farbe: perfekt ? "#ffd23f" : "#3dff8c",
    }, state.weiterIn);
    if (perfekt) {
      schrift(mal > 2 ? `Perfekt ×${mal}!` : "Perfekt!", "#ffd23f", 24, 1.3);
      if (flutlichtBei(n)) {
        for (let k = 0; k < 3; k += 1) funken(lerp(-4, 16, Math.random()), state.H + 6 + Math.random() * 8, 22, ["#ffd23f", "#ff7ab6", "#7ae0ff", "#ffffff"], 1.3);
      }
    } else if (!sauber && ergebnis === "gut") {
      schrift("Spritzer", "#ffb347", 20, 1.1);
    }
    if (perfekt || (sauber && halb >= 4)) {
      // Das Publikum jubelt einen Augenblick später – am lautesten bei einem
      // perfekten Sprung mit vielen Drehungen.
      state.jubel = 1;
      const laut = 0.6 + (perfekt ? 0.3 : 0) + Math.min(0.3, halb * 0.05);
      ton("turmspringen.publikum", { laut, verzoegerung: 0.45 }, 500);
    }
  }

  // Im Wasser: Er gleitet hinunter, Blasen steigen, dann taucht er auf –
  // nach einem guten Sprung mit der Faust in der Luft. Nach einem Klatscher
  // treibt er erst einmal flach an der Oberfläche.
  function wasserSchritt(h) {
    const sp = state.sp;
    const sprung = state.sprung;
    const seit = state.zeit - sprung.eintauchZeit;
    const fehl = state.aus === "klatscher" || state.aus === "bombe";
    if (fehl) {
      sp.vy = naeher(sp.vy, 0, 6, h);
      sp.y = naeher(sp.y + sp.vy * h, -0.15, 3, h);
      sp.vx = naeher(sp.vx, 0, 3, h);
      sp.x += sp.vx * h;
    } else if (seit < 0.75) {
      sp.vy = naeher(sp.vy, 0, 2.6, h);
      sp.y += sp.vy * h;
      sp.x += sp.vx * h;
      sp.vx = naeher(sp.vx, 0, 2, h);
    } else {
      sprung.auftauchen = true;
      sp.vy = naeher(sp.vy, 1.6, 3, h);
      sp.y = Math.min(-0.25, sp.y + sp.vy * h);
      sp.winkel = naeher(sp.winkel, Math.round(sp.winkel / 360) * 360, 3.5, h);
    }
    state.weiterIn -= h;
    if (state.weiterIn <= 0 && state.phase === "spiel") {
      if (state.aus) finish();
      else wechselBeginnen();
    }
  }

  function wechselBeginnen() {
    state.schritt = "wechsel";
    state.blendeZiel = 1;
    planBis(state.nr + 2);
  }

  function naechsterSprung() {
    const vorher = tagBei(state.nr);
    sprungAufbauen(state.nr + 1);
    tagesBilder(tagBei(state.nr));
    state.schritt = "start";
    state.startRest = 1.1;
    state.blendeZiel = 0;
    karteZeigen(state.startRest + 1.8);
    if (tagBei(state.nr) === 4 && vorher < 4) schrift("Flutlicht an!", "#fff6c8", 20, 1.6, { folgt: false, x: 2, y: state.H + 2 });
  }

  // Ein Schritt der Rechnung – je nachdem, wo der Sprung steht.
  function schrittTakt(h) {
    switch (state.schritt) {
      case "start":
        state.startRest -= h;
        if (state.startRest <= 0) state.schritt = "laufen";
        break;
      case "laufen":
        laufenSchritt(h);
        break;
      case "wippen":
        wippenSchritt();
        break;
      case "flug":
        flugSchritt(h);
        break;
      case "wasser":
        wasserSchritt(h);
        break;
      case "wechsel":
        if (state.blende >= 0.97) naechsterSprung();
        break;
      default:
        break;
    }
  }

  // Die Arme gestreckt vor dem Kopf, wenn als Nächstes der Kopf ins Wasser
  // käme, sonst am Körper.
  const armeZiel = (winkel) => (Math.ceil((winkel - 20) / 180) % 2 !== 0 ? 1 : 0);
  const istFehl = (ergebnis) => ergebnis === "bombe" || ergebnis === "bauch" || ergebnis === "ruecken";

  /*
   * Die Haltung, die zum Augenblick gehört – im Spiel und beim Zuschauen.
   * Auf dem Brett aus dem Anlauf und dem Absprung (bodenPose), im Flug aus
   * dem, wie weit sie offen ist (flugPose). Im Wasser gleitet sie erst
   * gestreckt hinunter, schwimmt dann nach oben und tritt Wasser – nach einem
   * guten Sprung mit der Faust in der Luft. Nach einem Klatscher treibt sie
   * flach; nach einer Arschbombe richtet sie sich auf.
   */
  const ZIEL = {};
  function poseWaehlen(dt) {
    const sp = state.sp;
    if (!sp) return;
    const s = state.schritt;
    const sprung = state.sprung;
    if (s === "start" || s === "laufen" || s === "wippen") {
      const wipp = s === "wippen" ? (state.zeit - sprung.ankunft) / ABSPRUNG_NACH : -1;
      bodenPose(sp.pose, { gang: gangBei(sp.x), wipp, weg: anlaufWeg(), zeit: state.echt });
      return;
    }
    sp.pose.boden = false;
    if (s === "flug") {
      sp.armeOben = naeher(sp.armeOben, armeZiel(sp.winkel), 7, dt);
      flugPose(sp.pose, sp.offen, sp.armeOben, sp.tf);
      return;
    }
    const seit = state.zeit - sprung.eintauchZeit;
    // Die Figur ist grösser gezeichnet als gerechnet – also taucht sie im
    // Bild auch tiefer: um so viel mehr, wie sie seit dem Eintauchen gesunken
    // ist. Sonst bliebe nach einem Sprung aus acht Metern der Kopf draussen.
    const mehr = (1 / koerperJeMeter() - 1) * Math.max(0, sprung.eintauchY - sp.y);
    let tiefer = 0;
    if (sprung.ergebnis === "bombe") {
      // Erst noch das Knäuel, dann kommt sie hoch und tritt Wasser.
      if (seit > 0.45) {
        sp.kipp = naeher(sp.kipp, Math.round(sp.winkel / 360) * 360 - sp.winkel, 3.2, dt);
        tiefer = TIEFER;
      }
      schwimmPose(ZIEL, state.zeit, false, 0);
      poseZu(sp.pose, seit < 0.3 ? POSEN.paeckchen : ZIEL, 5, dt);
    } else if (istFehl(sprung.ergebnis)) {
      poseZu(sp.pose, POSEN[sprung.ergebnis], 5, dt);
    } else if (!sprung.auftauchen) {
      poseZu(sp.pose, poseMisch(POSEN.gleitenFuss, POSEN.gleitenKopf, sp.armeOben, ZIEL), 3.5, dt);
      sp.tiefer = mehr;
      return;
    } else {
      // Wie tief sie im Bild noch ist: unten zieht sie sich hoch, oben tritt
      // sie Wasser – und jubelt erst, wenn der Kopf draussen ist.
      const tief = clamp((sp.tiefer - sp.y - 0.55) / 0.7, 0, 1);
      const jubel = tief <= 0 && (sprung.perfekt || (sprung.ergebnis === "gut" && sprung.err <= 18 && sprung.halbe >= 4));
      schwimmPose(ZIEL, state.zeit, jubel, tief);
      poseZu(sp.pose, ZIEL, 7, dt);
      sp.tiefer = lerp(mehr, TIEFER, glatt((seit - 0.75) / 0.8));
      return;
    }
    sp.tiefer = naeher(sp.tiefer, tiefer, 4, dt);
  }

  // ---------------------------------------------------------------------------
  // Der Takt
  // ---------------------------------------------------------------------------
  function takt(dtEcht) {
    let dt = dtEcht;
    state.echt += dtEcht;
    if (state.zeitlupe > 0) {
      state.zeitlupe = Math.max(0, state.zeitlupe - dtEcht);
      dt = dtEcht * 0.35;
    }
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dtEcht * 2.5);
    if (state.blitz > 0) state.blitz = Math.max(0, state.blitz - dtEcht * 3);
    if (state.jubel > 0) state.jubel = Math.max(0, state.jubel - dtEcht * 0.4);

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else if (state.phase === "spiel") {
      const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
      for (let i = 0; i < n && state.phase === "spiel"; i += 1) schrittTakt(dt / n);
      hilfeTakt();
    }
    klangTakt();
    const sp = state.sp;
    if (sp) poseWaehlen(dt);
    state.blende = clamp(state.blende + Math.sign(state.blendeZiel - state.blende) * dtEcht * 3.2, 0, 1);
    if (Math.abs(state.blende - state.blendeZiel) < 0.02) state.blende = state.blendeZiel;
    nebenbei(dt);
    if (sp) kameraTakt(dt, sp, state.schritt === "wechsel" ? "wasser" : state.schritt);

    if (state.phase === "spiel" && sp) {
      gegner?.takt(state.punkte, {
        a: Math.round((state.nr * ABSTAND + sp.x) * 10),
        b: Math.round(sp.y * 10),
        c: Math.round(rad(sp.winkel) * 100),
      });
    }
  }

  // Im ersten Sprung sagt das Spiel, was zu tun ist: halten, bis ein ganzer
  // Salto reicht – loslassen, wenn er aufgeht. Wer zu früh losgelassen hat,
  // hört wieder «Halten!»: Gestreckt dreht er ja nicht weiter.
  function hilfeTakt() {
    if (state.nr !== 0 || state.schritt !== "flug") { state.hilfe = ""; return; }
    const ziel = 360;
    const v = vorausWinkel(true);
    if (v.tau < 0.15) { state.hilfe = ""; return; }
    if (state.halten) state.hilfe = v.winkel >= ziel - 6 ? "Loslassen!" : "";
    else state.hilfe = v.winkel < ziel - 8 ? "Halten!" : "";
  }

  // Was nebenher geschieht: Teilchen, Schriften, Wellen.
  function nebenbei(dt) {
    if (state.tv) {
      state.tv.alter += dt;
      if (state.tv.alter > state.tv.dauer) state.tv = null;
    }
    wasserBild(dt);
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      if (t.art === "blase") {
        t.vx *= 1 - 1.5 * dt;
        t.x += Math.sin(state.echt * 6 + i) * 0.2 * dt;
        if (t.y > -0.05) t.leben = 0;
      } else if (t.art === "wolke") {
        t.vx *= 1 - 1.5 * dt;
        if (t.y > -t.r * 0.6) t.vy = 0;
      } else if (t.art === "gischt") {
        t.vy -= 1.5 * dt;
        t.vx *= 1 - 1.2 * dt;
      } else {
        t.vy -= (t.art === "funke" ? 4 : G) * dt;
        t.vx *= 1 - 0.8 * dt;
        if (t.art === "tropfen" && t.y < 0 && t.vy < 0) {
          // Zurück im Wasser: Ein grosser Tropfen macht einen kleinen Ring.
          t.leben = 0;
          if (t.r > 0.05 && state.wellen.length < 24) state.wellen.push({ x: t.x, alter: 0, dauer: 0.7, weit: 0.25 + t.r * 4, stark: 0, klein: true });
        }
      }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    // Die Strahlen der Spritzer: An ihrem Gipfel reissen Tropfen ab.
    for (let i = state.platscher.length - 1; i >= 0; i -= 1) {
      const p = state.platscher[i];
      p.alter += dt;
      let lebt = false;
      for (const f of p.finger) {
        const t = p.alter - f.ab;
        if (t < f.lebt || p.alter < p.dauer || p.alter < p.kronZeit) lebt = true;
        if (f.oben || t < f.gipfel * 0.6) continue;
        f.oben = true;
        const viele = ruhig() ? 1 : 2 + Math.round(f.dick * 6);
        for (let n = 0; n < viele; n += 1) {
          const a = f.gipfel * (0.4 + Math.random() * 0.2);
          teil({
            art: "tropfen", x: f.x + Math.sin(f.w) * f.v * a, y: Math.max(0.05, Math.cos(f.w) * f.v * a - 0.5 * G * a * a),
            vx: Math.sin(f.w) * f.v + (Math.random() - 0.5) * 1.6, vy: Math.cos(f.w) * f.v - G * a + (Math.random() - 0.3) * 1.4,
            r: 0.02 + Math.random() * 0.04, farbe: n % 2 ? "#ffffff" : "#d6f1ff", leben: 2.6, max: 2.6,
          });
        }
      }
      if (!lebt) state.platscher.splice(i, 1);
    }
    for (let i = state.schaum.length - 1; i >= 0; i -= 1) {
      state.schaum[i].alter += dt;
      if (state.schaum[i].alter > state.schaum[i].dauer) state.schaum.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
    for (let i = state.wellen.length - 1; i >= 0; i -= 1) {
      state.wellen[i].alter += dt;
      if (state.wellen[i].alter > state.wellen[i].dauer) state.wellen.splice(i, 1);
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    // Nie rückwärts: Der Zeitstempel eines Bildes kann vor dem letzten
    // Neustart liegen.
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    messen();
    takt(dt);
    zeichnen();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Eine aufgezeichnete Runde mit ihrem eigenen Plan: Der Zufall hält die
  // Saat (geist.js, zuschauer), startRun würfelt damit dieselben Höhen, und
  // der Springer steht Bild für Bild dort, wo er damals war. Aus a folgt der Sprung, aus der Drehung je Sekunde, wie eng er sich
  // machte; wo er eintaucht, zeigt die Anzeige seine Saltos und Punkte.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    shell.setPhase("play");
    zuschauer.los();
  }

  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s) return;
    const wx = s.a / 10;
    const nr = Math.max(0, Math.floor((wx + ABSTAND / 2) / ABSTAND));
    if (nr !== state.nr) {
      sprungAufbauen(nr);
      state.schritt = "start";
      state.blende = 0.8;
      karteZeigen(2.4);
    }
    const sp = state.sp;
    const sprung = state.sprung;
    const x = clamp(wx - nr * ABSTAND, DECK_L, 40);
    const y = clamp(s.b / 10, -8, state.H + 6);
    const winkel = grad((s.c || 0) / 100);
    // Ganz am Anfang hat eine Aufzeichnung manchmal noch keinen Ort (0, 0).
    // Wer noch nicht abgesprungen ist, kann nicht unter dem Brett sein: Er
    // bleibt stehen, wo er steht – sonst tauchte er ein, bevor er losläuft.
    // (Wer wirklich fällt, ist längst vor der Kante.)
    if (!sprung.abgesprungen && y < state.H && x <= 0.01) {
      zuschauer.weiter();
      return;
    }
    // Wie schnell er dreht, in Grad je Sekunde des Spiels: daraus, wie eng
    // er sich machte.
    if (sp.zw !== undefined && dt > 0) {
      const w = Math.abs(winkel - sp.zw) / dt / TEMPO;
      const offen = clamp(1 - Math.sqrt(w / W_PAECK), 0, 1);
      sp.offen = naeher(sp.offen, offen, 14, dt);
    }
    sp.zw = winkel;
    sp.vx = (s.va || 0) / 10;
    sp.vy = (s.vb || 0) / 10;
    sp.x = x;
    sp.y = y;
    sp.winkel = winkel;
    // Auf der Plattform: oben, hinter der Kante, und nicht schon im Steigen.
    const aufDerPlattform = y > state.H + 0.3 && x <= KANTE_X + 0.1 && sp.vy < 1.5;
    if (state.tv?.karte && !aufDerPlattform) state.tv.dauer = Math.min(state.tv.dauer, state.tv.alter + 0.3);
    if (aufDerPlattform && !sprung.eingetaucht) {
      // An der Kante wippt er, so lange wie im Spiel – ab jetzt.
      state.schritt = x < KANTE_X - 0.05 ? "laufen" : "wippen";
      if (state.schritt === "wippen" && sprung.ankunft < 0) sprung.ankunft = state.zeit;
    } else if (!sprung.eingetaucht && y - unterkante(winkel, sp.offen) > 0.05) {
      if (state.schritt !== "flug") {
        ton("turmspringen.absprung", { laut: 0.9 });
        sp.tf = 0;
      }
      state.schritt = "flug";
      sprung.abgesprungen = true;
      sp.tf += dt * TEMPO;
    } else {
      if (!sprung.eingetaucht) {
        // Eingetaucht: Spritzer, Ringe, die Saltos.
        const halb = Math.max(0, Math.round(winkel / 180));
        const err = Math.abs(winkel - halb * 180);
        const fehl = err > KLATSCH || sp.offen < BOMBE;
        const art = sp.offen < BOMBE ? "bombe" : (((winkel % 360) + 360) % 360) < 180 ? "bauch" : "ruecken";
        const kraft = fehl ? (art === "bombe" ? 1.7 : 1.25) : 0.08 + err * 0.03;
        sprung.eingetaucht = true;
        sprung.halbe = halb;
        sprung.err = err;
        sprung.ergebnis = fehl ? art : "gut";
        sprung.eintauchZeit = state.zeit;
        sprung.eintauchY = y;
        sprung.punkteVor = state.punkte;
        platsch(x, kraft, art === "bombe" && fehl ? 0.6 : fehl ? 1.6 : 0.5, winkel - halb * 180, fehl);
        ton("turmspringen.eintauchen", { laut: clamp(0.35 + kraft * 0.6, 0.35, 1.3) });
        const wort = { bombe: "Arschbombe", bauch: "Bauchklatscher", ruecken: "Rückenklatscher" }[art];
        tvZeigen({
          oben: `SPRUNG ${nr + 1} VON ${SPRUENGE} · ${state.H} m`, gross: fehl ? wort : halb ? saltos(halb) : "Ohne Drehung", rechts: "",
          unten: fehl ? "Die Runde ist vorbei" : "", farbe: fehl ? "#ff3b30" : "#3dff8c",
        }, 2.6);
      }
      state.schritt = "wasser";
      sprung.auftauchen = !istFehl(sprung.ergebnis) && state.zeit - sprung.eintauchZeit >= 0.75;
    }
    // Was der Sprung brachte, steht genau in der Aufzeichnung.
    const punkte = Math.max(0, Math.floor(s.punkte));
    if (punkte !== state.punkte) {
      const dazu = punkte - (sprung.punkteVor ?? state.punkte);
      if (state.tv && sprung.eingetaucht && sprung.halbe > 0) {
        // Mehr als eine halbe Drehung je Punkt: Es war perfekt.
        const mal = Math.round(dazu / sprung.halbe);
        sprung.perfekt = mal > 1;
        state.tv.rechts = mal > 1 ? (mal > 2 ? `Perfekt ×${mal}` : "Perfekt") : "";
        state.tv.rechtsFarbe = "#ffd23f";
        state.tv.unten = `+${dazu} ${dazu === 1 ? "Punkt" : "Punkte"}${mal > 1 ? ` (${sprung.halbe} × ${mal})` : ""}`;
        if (mal > 1) {
          state.jubel = 1;
          ton("turmspringen.publikum", { laut: 0.9 }, 500);
        }
      }
      state.punkte = punkte;
      shell.setCount(punkte);
    }
    zuschauer.weiter();
  }

  // ---------------------------------------------------------------------------
  // Tippen und Halten
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Tipp – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los). Der Springer geht sofort an
  // die Kante.
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    shell.setPhase("play");
    gegner?.los();
    state.schritt = "laufen";
    karteZeigen(1.8);
  }

  // Ein neuer Druck (Finger oder Taste): Vor der Runde startet er sie. Sonst
  // zählt nur, dass gehalten wird (state.halten).
  function druck() {
    if (state.phase !== "bereit") return;
    if (!shell.live) losGehts();
  }

  const finger = new Set();
  const haltenNeu = () => { state.halten = finger.size > 0; };

  function fingerAuf(id) {
    const neu = !finger.has(id);
    finger.add(id);
    haltenNeu();
    if (neu) druck();
  }

  function fingerWeg(id) {
    finger.delete(id);
    haltenNeu();
  }

  function alleWeg() {
    finger.clear();
    haltenNeu();
  }

  // Für die Prüfskripte und die Vorführung: aktion() ist ein Tipp (der
  // Start), halte(true/false) hält wie ein Finger.
  function aktion() {
    druck();
  }

  function halte(an) {
    if (an) fingerAuf("auto");
    else fingerWeg("auto");
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    stopLoop();
    klangAus();
    perfektFolge = 0;
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.schritt = "start";
    state.punkte = 0;
    state.plan = [];
    state.sprunge = [];
    state.kette = 0;
    state.besteKette = 0;
    state.perfekte = 0;
    state.aus = "";
    state.grund = "";
    state.blende = 0;
    state.blendeZiel = 0;
    state.tv = null;
    state.schriften = [];
    state.jubel = 0;
    state.stoss = 0;
    state.blitz = 0;
    state.zeitlupe = 0;
    state.zeit = 0;
    state.echt = 0;
    state.startRest = 0;
    // Wer beginnt, ist Zufall – aber nicht der des Plans.
    state.erste = Math.random() < 0.5 ? 0 : 1;
    planBis(SPRUENGE - 1);
    sprungAufbauen(0);
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    promptKnoten = shell.el("p", "cm-prompt ts-prompt", "Halten: drehen · Loslassen: strecken · senkrecht eintauchen");
    shell.play.append(promptKnoten, buildPlatz());
    alleWeg();
    view.cssW = 0;
    view.cssH = 0;
    messen();
    karteZeigen(1e9);

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(900, 200 + ziel * 1.2);
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
    if (state.phase === "ende" || state.phase === "zuschauen") return;
    state.phase = "ende";
    klangAus();
    alleWeg();
    const punkte = state.punkte;
    const geist = gegner?.ende(punkte) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    const anzahl = state.sprunge.length;
    const bester = anzahl ? Math.max(...state.sprunge) : 0;
    const grund = state.aus === "fertig" ? "" : state.grund;
    const sprunge = state.aus === "fertig" ? `Alle ${SPRUENGE} Sprünge` : anzahl === 1 ? "1 Sprung" : `${anzahl} Sprünge`;
    const perfekte = state.perfekte ? `${state.perfekte} perfekt${state.besteKette >= 2 ? `, ${state.besteKette} in Folge` : ""}` : "";
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? `Neuer Rekord! ${sprunge}` : [`${sprunge}, bester ${bester} Punkte`, perfekte, grund, vorher ? `Bestwert ${vorher}` : ""].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("ts-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Turmspringen",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "highDive", fassung: "t2", zufall, einheit: "Punkte", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "highDive", host, art: "tempo", fassung: "t2", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Ein Finger irgendwo im Bild: der Start – und solange er liegt, das
  // Päckchen. Nur Knöpfe bleiben Knöpfe.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    fingerAuf(event.pointerId);
  });
  window.addEventListener("pointerup", (event) => fingerWeg(event.pointerId));
  window.addEventListener("pointercancel", (event) => fingerWeg(event.pointerId));
  // Wer das Fenster verlässt, nimmt auch die Finger vom Bild.
  window.addEventListener("blur", alleWeg);

  // Leertaste, Enter, Pfeil hoch oder runter (W, S): wie ein Finger. Steht
  // der Fokus auf einem Knopf, gilt die Taste dem Knopf.
  const TASTEN = new Set([" ", "Enter", "ArrowUp", "ArrowDown"]);
  const istTaste = (event) => TASTEN.has(event.key) || event.code === "KeyW" || event.code === "KeyS";
  document.addEventListener("keydown", (event) => {
    if (!istTaste(event)) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    fingerAuf("taste");
  });
  document.addEventListener("keyup", (event) => {
    if (istTaste(event)) fingerWeg("taste");
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", stopLoop);

  // Für die Prüfskripte und die Vorführung. aktion() tippt (der Start),
  // halte(an) hält. vorausWinkel() sagt, wo die Achse beim Eintauchen
  // stünde.
  window.LernappTurmspringen = {
    TAKT, ABSTAND, TEMPO, PERFEKT, KLATSCH, W_PAECK, SPRUENGE, BAENDER, KETTE_MAX, OFFEN_GUT,
    state, view, kam, takt, zeichnen, weltText, losGehts, aktion, halte,
    vorausWinkel, planBis, malBei, unterkante, bildX, bildY, FIGUREN,
  };
})();
