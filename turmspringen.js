/*
 * turmspringen.js – Turmspringen.
 * ---------------------------------------------------------------------------
 * Ein Sprungturm aus Stahl steht in einem Bergsee, die Alpen dahinter. Eine
 * Runde ist eine Serie von Sprüngen von immer höheren Plattformen: 10, 12,
 * 15, 17, 20, 22, 24 und schliesslich 27 Meter, wo es dann bleibt. Gezählt
 * werden die Punkte aller Sprünge. Die Runde endet bei einem Klatscher, einer
 * Arschbombe – oder wenn ein Sprung seine Pflicht nicht schafft.
 *
 * Jeder Sprung hat drei Momente:
 *
 *   Absprung   Der Springer läuft an die Kante und wippt. Bei jedem Wippen
 *              zieht sich ein Ring auf seine Füsse zusammen; wer tippt, wenn
 *              er sie trifft, springt mit voller Kraft («Perfekt», einen
 *              Wimpernschlag lang Zeitlupe): hoch, und mit dem richtigen
 *              Drall. Zu früh springt er flach und dreht zu wenig, zu spät
 *              kippt er schon und dreht zu viel. Dreimal wippt er – wer dann
 *              noch nicht getippt hat, verliert das Gleichgewicht.
 *   Flug       Halten heisst Päckchen: Er zieht die Knie an die Brust und
 *              dreht sich sechsmal schneller. Loslassen heisst strecken: Er
 *              öffnet sich, und die Drehung wird langsam – aufhören kann sie
 *              nie. Der Drehimpuls bleibt, wie er beim Absprung war; nur wie
 *              eng er sich macht, entscheidet, wie schnell er dreht. Böen
 *              drehen ihn unterwegs vor oder zurück. Sie sind als Schlieren
 *              zu sehen: orange dreht vor, blau zurück.
 *   Eintauchen Ins Wasser geht es senkrecht: Kopf voran nach einem halben,
 *              anderthalb, zweieinhalb Salto, Füsse voran nach einem ganzen,
 *              zwei, drei. Wie genau, gibt die Note (bis 10), und gestreckt
 *              muss er sein. Punkte gibt es: halbe Saltos mal Note. Liegt er
 *              mehr als KLATSCH Grad daneben, ist es ein Bauch- oder
 *              Rückenklatscher; im Päckchen eine Arschbombe.
 *
 * Jede Höhe hat ihre Pflicht: so viele halbe Saltos mindestens. Mehr ist
 * erlaubt und bringt mehr – das Risiko wählt jeder selbst. Schwerer wird es
 * mit jedem Sprung: höher, mehr Pflicht, ein engeres Fenster an der Kante,
 * mehr und stärkere Böen. Ab dem dreizehnten Sprung verlangt die Pflicht mehr
 * Drehung, als in der Zeit bis zum Wasser geht – dort endet jede Runde.
 * Dazu wird es Abend, und die letzten Sprünge gehen unter Flutlicht in die
 * Nacht.
 *
 * Wind und Böen jedes Sprungs kommen aus dem Zufall (zufall.js), Sprung um
 * Sprung, jeder zieht immer gleich viele Zahlen: ohne Turnier jedes Mal
 * anders, im Turnier für alle im selben Versuch dieselben. Der Turm ist
 * immer derselbe.
 *
 * Gerechnet wird in Metern: x nach vorne (rechts), y nach oben, die
 * Wasserfläche bei 0, die Kante der Plattform bei x = 0. Der Fall läuft um
 * TEMPO langsamer als in echt – sonst bliebe zum Öffnen keine Zeit.
 *
 * Mechanik aus dem Skispringen: der Ring an der Kante, die Böen als
 * Schlieren, die Tageszeiten über den Alpen und das Flutlicht, die Anzeige
 * wie im Fernsehen und das Gerippe des Springers.
 *
 * Die Gegner (geist.js) springen als halb durchsichtige Springer mit – so,
 * wie sie in ihrer besten Runde gesprungen sind (a, b: Ort in Dezimetern,
 * die Sprünge hintereinander, ABSTAND Meter auseinander; c: die Drehung mal
 * 100). Zu sehen ist, wer gerade von derselben Plattform springt. Und die
 * besten Runden lassen sich anschauen (?zuschauen=, geist.js): mit derselben
 * Saat, also mit demselben Wind und denselben Böen.
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

  // Der Zufall. Nur der Plan zieht daraus – Wind und Böen. Spritzer,
  // Zuschauer und Funken nehmen Math.random, damit der Plan nicht davon
  // abhängt, wie jemand springt.
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
  const HOEHEN = [10, 12, 15, 17, 20, 22, 24, 27];
  // Die Pflicht: so viele halbe Saltos mindestens, Sprung für Sprung. Danach
  // jede dritte Höhe eine halbe Drehung mehr – ab 7 schafft es niemand.
  const PFLICHT = [1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6];

  // Der Körper. Stehend liegt der Schwerpunkt so hoch über den Füssen.
  const SCHWERPUNKT = 1.0;
  const KANTE_X = -0.3;            // dort steht der Schwerpunkt an der Kante

  // Die Drehung (Grad/s): gestreckt nach einem perfekten Absprung. Im
  // Päckchen VERHAELTNIS mal schneller – der Drehimpuls bleibt.
  const W_STRECK = 75;
  const VERHAELTNIS = 6;
  const SCHLIESSEN = 11;           // so schnell zieht er sich zusammen (1/s)
  const OEFFNEN = 9;               // so schnell streckt er sich (1/s)

  // Der Absprung: so schnell nach oben und nach vorne (m/s), perfekt.
  const V_AB = 4.2;
  const V_VOR = 1.3;

  // Das Wippen an der Kante (s, in der Zeit des Spiels).
  const WIPP = 1.15;               // so lange dauert ein Wippen
  const WIPP_START = 0.95;         // so lange nach dem Ankommen kommt der erste Moment
  const WIPP_ANZAHL = 3;           // so oft wippt er, dann kippt er
  const RING_VOR = 0.8;            // so lange vor dem Moment zieht sich der Ring zusammen
  const FRUEH_MAX = 0.32;          // früher getippt zählt nicht
  const SPAET_MAX = 0.16;          // so lange danach zählt ein Tipp noch

  // Das Eintauchen (Grad neben der Senkrechten).
  const RIP = 3;                   // so genau gibt es die 10
  const KLATSCH = 30;              // weiter daneben ist es ein Klatscher
  const BOMBE = 0.35;              // weniger offen ist es eine Arschbombe
  const OFFEN_GUT = 0.92;          // so offen zählt als gestreckt

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

  // Wie es mit jedem Sprung schwerer wird (n zählt ab 0).
  const hoeheBei = (n) => HOEHEN[Math.min(n, HOEHEN.length - 1)];
  const pflichtBei = (n) => (n < PFLICHT.length ? PFLICHT[n] : 7 + Math.floor((n - PFLICHT.length) / 3));
  const schwer = (n, tau) => 1 - Math.exp(-n / tau);
  const perfektBei = (n) => lerp(0.06, 0.03, schwer(n, 5));        // ± so genau ist «perfekt» an der Kante
  const gutBei = (n) => lerp(0.14, 0.08, schwer(n, 5));            // ± so genau ist «gut»
  const boeenBei = (n) => (n < 1 ? 0 : Math.min(4, 1 + Math.floor((n - 1) * 0.5))); // so viele Böen je Sprung
  const boeStaerkeBei = (n) => Math.min(240, 70 + 22 * n);         // so stark drehen sie (Grad/s)
  // Die Tageszeit: Morgen, Mittag, Nachmittag, Abendrot, Dämmerung (mit
  // Flutlicht), Nacht – je zwei Sprünge.
  const tagBei = (n) => Math.min(5, Math.floor(n / 2));
  const flutlichtBei = (n) => tagBei(n) >= 4;

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts getippt), "spiel", "zuschauen", "ende"
  // schritt: "start" (hinten auf der Plattform), "laufen" (an die Kante),
  //          "wippen", "flug", "wasser", "wechsel" (zum nächsten Sprung)
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,               // die Punkte aller Sprünge – die Zahl der Runde
    nr: 0,                   // der wievielte Sprung (ab 0)
    H: 10,                   // die Höhe dieses Sprungs (m)
    plan: [],                // Wind und Böen je Sprung
    boeen: [],               // die Böen dieses Sprungs
    sprung: null,            // was bei diesem Sprung geschah
    sprunge: [],             // die Punkte der Sprünge bisher
    sp: null,                // der Springer
    halten: false,           // gedrückt: Päckchen
    startRest: 0,
    weiterIn: 0,
    aus: "",                 // warum die Runde endet: "klatscher", "bombe", "pflicht"
    grund: "",
    blende: 0,               // schwarz zwischen zwei Sprüngen
    blendeZiel: 0,
    tv: null,                // die Anzeige unten
    ring: null,              // der Ring an der Kante nach dem Tipp
    wellen: [],              // Ringe auf dem Wasser
    teile: [],
    schriften: [],
    hilfe: "",               // im ersten Sprung: was jetzt zu tun ist
    kompass: 0,              // wie deutlich der Kompass steht (0 bis 1)
    nahWasser: 0,            // wie nah das Wasser ist (0 bis 1)
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
   *   wind    der Wind in m/s: plus treibt nach vorne, minus zurück. Die
   *           Fahnen zeigen ihn; er versetzt den Springer nur ein wenig.
   *   boeen   Schichten in der Luft (yc: Mitte, halb: halbe Dicke in m), in
   *           denen er gedreht wird: dreh > 0 nach vorne, dreh < 0 zurück
   *           (Grad/s). Gleichmässig über die Höhe verteilt, nie übereinander.
   */
  const ZAHLEN_JE_SPRUNG = 20;

  function neuerSprung(n) {
    const z = [];
    for (let i = 0; i < ZAHLEN_JE_SPRUNG; i += 1) z.push(zufall.zahl());
    const H = hoeheBei(n);
    const wind = lerp(-1.2, 1.2, z[0]);
    const boeen = [];
    const anzahl = boeenBei(n);
    for (let i = 0; i < anzahl; i += 1) {
      const q = z.slice(1 + i * 4, 5 + i * 4);
      const yc = lerp(2.5, H - 1.5, (i + 0.2 + q[0] * 0.6) / anzahl);
      const halb = lerp(1.6, 3, q[1]);
      const dir = q[2] < 0.5 ? -1 : 1;
      boeen.push({ yc, halb, dreh: dir * boeStaerkeBei(n) * lerp(0.7, 1, q[3]) });
    }
    return { n, H, wind, boeen };
  }

  function planBis(n) {
    while (state.plan.length <= n) state.plan.push(neuerSprung(state.plan.length));
  }

  // Was die Böen in der Höhe y tun: drehen (Grad/s), an- und abschwellend
  // über ihre Dicke.
  function boeBei(y, liste = state.boeen) {
    for (const b of liste || []) {
      const u = (y - (b.yc - b.halb)) / (2 * b.halb);
      if (u <= 0 || u >= 1) continue;
      const s = Math.sin(Math.PI * u);
      return { dreh: b.dreh * s * s, k: s * s, b };
    }
    return { dreh: 0, k: 0, b: null };
  }

  // Die gewürfelte Welt in Worten: Wind und Böen der ersten fünf Sprünge.
  // Im Turnier bekommen alle denselben Text.
  function weltText() {
    planBis(4);
    return state.plan.slice(0, 5).map((p) => `${p.H}m w${p.wind.toFixed(2)} `
      + p.boeen.map((b) => `${b.yc.toFixed(1)}±${b.halb.toFixed(1)}:${b.dreh.toFixed(1)}`).join(",")).join(" | ");
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
  // steht auf einem Sockel im Wasser.
  const TURM_L = -3.3;
  const TURM_R = -0.75;
  const DECK_L = -3.7;

  function zeichneTurm() {
    const H = state.H;
    const T = tz();
    const z = kam.z;
    const unten = -7;
    const X = bildX;
    const Y = bildY;
    if (X(0.2) < -20 || X(DECK_L - 0.6) > view.cssW + 20) return;
    const oben = Math.min(H - 0.35, (view.oy + 20) / z);
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
    g.lineTo(X(lx), Y(H + 0.9));
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
    g.fillRect(X(DECK_L), Y(H), -DECK_L * z, dick * z);
    g.fillStyle = mische(T.bau[0], "#5aa0c8", 0.25);
    g.fillRect(X(DECK_L), Y(H) - Math.max(1.5, 0.07 * z), -DECK_L * z, Math.max(1.5, 0.07 * z));
    for (let k = 0; k < 4; k += 1) {
      g.fillStyle = k % 2 ? "#ffffff" : "#e8262f";
      g.fillRect(X(-0.32 + k * 0.08), Y(H), Math.max(1, 0.08 * z), dick * z);
    }
    // Das Schild mit der Höhe.
    const schild = Math.max(10, 0.5 * z);
    g.fillStyle = "rgba(14, 18, 34, 0.85)";
    const sx = X((TURM_L + TURM_R) / 2);
    const sy = Y(H - 0.9);
    g.font = `900 ${Math.round(schild * 0.75)}px system-ui, sans-serif`;
    const text = `${H} m`;
    const sw = g.measureText(text).width + schild * 0.8;
    g.beginPath();
    if (g.roundRect) g.roundRect(sx - sw / 2, sy - schild * 0.6, sw, schild * 1.2, schild * 0.25);
    else g.rect(sx - sw / 2, sy - schild * 0.6, sw, schild * 1.2);
    g.fill();
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, sx, sy + 1);
    // Das Geländer hinten, offen nach vorne.
    g.strokeStyle = T.bau[0];
    g.lineWidth = Math.max(1, 0.07 * z);
    g.beginPath();
    for (const px of [DECK_L, -2.4, -1.4]) {
      g.moveTo(X(px), Y(H));
      g.lineTo(X(px), Y(H + 1.05));
    }
    g.moveTo(X(DECK_L), Y(H + 1.05));
    g.lineTo(X(-1.4), Y(H + 1.05));
    g.moveTo(X(DECK_L), Y(H + 0.55));
    g.lineTo(X(-1.4), Y(H + 0.55));
    g.stroke();
    // Die Fahne am Mast hinten – sie weht mit dem Wind.
    const plan = state.plan[state.nr];
    const wind = plan ? plan.wind : 0.5;
    g.strokeStyle = "#d8d8d8";
    g.lineWidth = Math.max(1, 0.06 * z);
    g.beginPath();
    g.moveTo(X(DECK_L + 0.1), Y(H));
    g.lineTo(X(DECK_L + 0.1), Y(H + 2.9));
    g.stroke();
    zeichneFahne(DECK_L + 0.1, H + 2.85, 1.15, 0.75, wind);
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

  // Die Wasserlinie: kleine Wellen, ein heller Saum – und die Ringe, wo
  // jemand eingetaucht ist.
  function zeichneWasserlinie() {
    const wasser = bildY(0);
    if (wasser < -10 || wasser > view.cssH + 10) return;
    const T = tz();
    const z = kam.z;
    g.strokeStyle = mische(T.see[0], "#ffffff", 0.45);
    g.globalAlpha = 0.85;
    g.lineWidth = Math.max(1.2, 0.08 * z);
    g.beginPath();
    for (let x = 0; x <= view.cssW + 8; x += 8) {
      const wx = (x - view.ox) / z;
      const y = wasser + Math.sin(wx * 1.7 + state.echt * 2.1) * 0.05 * z + Math.sin(wx * 0.6 - state.echt * 1.3) * 0.04 * z;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    g.globalAlpha = 1;
    for (const w of state.wellen) {
      const k = clamp(w.alter / w.dauer, 0, 1);
      const r = (0.4 + k * w.weit) * z;
      g.strokeStyle = `rgba(255, 255, 255, ${0.6 * (1 - k)})`;
      g.lineWidth = Math.max(1, 0.1 * z * (1 - k) + 0.5);
      g.beginPath();
      g.ellipse(bildX(w.x), wasser, r, r * 0.14, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }

  // Die Böen als Schlieren quer durch die Fallstrecke: orange ziehen sie
  // nach vorne (sie drehen ihn vor), blau zurück. Wer vorbei ist, sieht sie
  // verblassen.
  function zeichneBoeen() {
    if (!state.boeen?.length) return;
    const z = kam.z;
    const zeit = state.echt;
    const sp = state.sp;
    g.lineCap = "round";
    for (const b of state.boeen) {
      const unten = b.yc - b.halb;
      const obenY = b.yc + b.halb;
      if (bildY(unten) < -20 || bildY(obenY) > view.cssH + 20) continue;
      const vorbei = sp && state.schritt !== "start" && state.schritt !== "laufen" && state.schritt !== "wippen"
        ? clamp(1 - (unten - sp.y) / 4, 0, 1) : 1;
      if (vorbei <= 0) continue;
      const vor = b.dreh > 0;
      const farbe = vor ? "255, 176, 92" : "130, 210, 255";
      const stark = clamp(Math.abs(b.dreh) / 240, 0.25, 1);
      for (let n = 0; n < 14; n += 1) {
        const h = (k) => hash01(n * 3.17 + k * 7.1 + b.yc * 1.3);
        const v = h(1);
        const y = lerp(unten, obenY, 0.1 + 0.8 * v);
        const lauf = (zeit * (0.5 + h(2) * 0.5) + h(3)) % 1;
        const x = vor ? lerp(-3, 9, lauf) : lerp(9, -3, lauf);
        const lang = (1.2 + h(4) * 1.4) * (vor ? 1 : -1);
        const a = Math.sin(Math.PI * lauf) * Math.sin(Math.PI * (0.1 + 0.8 * v)) * (0.35 + stark * 0.5) * vorbei;
        if (a < 0.03) continue;
        const X = bildX(x);
        const Y = bildY(y);
        const d = lang * z;
        g.strokeStyle = `rgba(${farbe}, ${a})`;
        g.lineWidth = Math.max(1.2, 0.09 * z);
        g.beginPath();
        g.moveTo(X - d, Y);
        g.quadraticCurveTo(X - d / 2, Y + Math.sin(zeit * 3 + n) * 0.25 * z * (vor ? 1 : -1), X, Y);
        g.stroke();
        const p = Math.max(2, 0.18 * z) * Math.sign(d);
        g.beginPath();
        g.moveTo(X - p, Y - Math.abs(p));
        g.lineTo(X, Y);
        g.lineTo(X - p, Y + Math.abs(p));
        g.stroke();
      }
    }
    g.lineCap = "butt";
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
   * Ein Gerippe in Metern, im Rahmen des Körpers: y zeigt zum Kopf, x nach
   * vorne (dorthin, wohin er schaut). Eine Haltung sagt, wie Rumpf,
   * Oberschenkel, Unterschenkel, die Arme und der Kopf stehen (Grad: 90 nach
   * oben, -90 nach unten, 0 nach vorne). Gezeichnet wird um den Schwerpunkt –
   * um ihn dreht er sich. Im Flug mischt sich die Haltung aus Päckchen und
   * gestreckt, genau so weit, wie er offen ist.
   */
  const KOERPER = { ober: 0.44, unter: 0.44, rumpf: 0.58, arm: 0.6, hals: 0.18, kopf: 0.12 };
  const POSEN = {
    stehen: { rumpf: 90, hueft: -90, knie: -90, armV: -94, armH: -86, kopf: 0 },
    ausholen: { rumpf: 70, hueft: -60, knie: -120, armV: -165, armH: -155, kopf: 8 },
    arme: { rumpf: 92, hueft: -88, knie: -92, armV: 100, armH: 95, kopf: 0 },
    gestreckt: { rumpf: 90, hueft: -90, knie: -90, armV: 91, armH: 89, kopf: -4 },
    fuesse: { rumpf: 90, hueft: -90, knie: -90, armV: -92, armH: -88, kopf: 0 },
    paeckchen: { rumpf: 50, hueft: 30, knie: -100, armV: -70, armH: -78, kopf: -25 },
    fallen: { rumpf: 110, hueft: -60, knie: -125, armV: 150, armH: 40, kopf: 20 },
    klatsch: { rumpf: 90, hueft: -80, knie: -110, armV: 10, armH: 170, kopf: 15 },
    schwimmen: { rumpf: 90, hueft: -105, knie: -135, armV: 18, armH: 160, kopf: 0 },
    jubel: { rumpf: 92, hueft: -100, knie: -130, armV: 128, armH: 58, kopf: -12 },
  };
  const POSE_FELDER = ["rumpf", "hueft", "knie", "armV", "armH", "kopf"];

  function poseZu(pose, ziel, rate, dt) {
    const k = 1 - Math.exp(-rate * dt);
    for (const f of POSE_FELDER) pose[f] += (ziel[f] - pose[f]) * k;
  }

  function poseMisch(a, b, k, aus = {}) {
    for (const f of POSE_FELDER) aus[f] = a[f] + (b[f] - a[f]) * k;
    return aus;
  }

  // So gross wird der Springer gezeichnet (Bildpunkte je Meter): gut
  // anderthalbmal so gross wie echt, und nie kleiner als gut 50 Bildpunkte
  // hoch.
  const figurMass = () => Math.max(kam.z * 1.55, 26, view.minD * 0.07);

  const FARBEN = { haut: "#f1c7a0", hautD: "#d9a57c", hose: "#e3262f", haar: "#3a2a22" };

  // Die Gelenke einer Haltung, um den Schwerpunkt herum.
  function gelenke(pose) {
    const r = (w, l, von) => [von[0] + l * Math.cos(rad(w)), von[1] + l * Math.sin(rad(w))];
    const H = [0, 0];
    const S = r(pose.rumpf, KOERPER.rumpf, H);
    const K = r(pose.rumpf + pose.kopf, KOERPER.hals, S);
    const kn = r(pose.hueft, KOERPER.ober, H);
    const fu = r(pose.knie, KOERPER.unter, kn);
    const knH = r(pose.hueft - 5, KOERPER.ober, H);
    const fuH = r(pose.knie - 4, KOERPER.unter, knH);
    const hV = r(pose.armV, KOERPER.arm, S);
    const hH = r(pose.armH, KOERPER.arm, S);
    const sx = H[0] * 0.42 + S[0] * 0.28 + kn[0] * 0.16 + fu[0] * 0.06 + K[0] * 0.08;
    const sy = H[1] * 0.42 + S[1] * 0.28 + kn[1] * 0.16 + fu[1] * 0.06 + K[1] * 0.08;
    const m = (p) => [p[0] - sx, p[1] - sy];
    return { H: m(H), S: m(S), K: m(K), kn: m(kn), fu: m(fu), knH: m(knH), fuH: m(fuH), hV: m(hV), hH: m(hH) };
  }

  /*
   * Der Springer, sein Schwerpunkt an (x, y), gedreht um winkel Grad nach
   * vorne (0: aufrecht, 180: kopfüber), in der Haltung pose. farbe: als
   * Geist, ganz in dieser Farbe.
   */
  function zeichneSpringer(x, y, winkel, pose, { farbe = null, alpha = 1, fs = figurMass() } = {}) {
    const X = bildX(x);
    const Y = bildY(y);
    if (X < -fs * 3 || X > view.cssW + fs * 3 || Y < -fs * 3 || Y > view.cssH + fs * 3) return;
    const F = farbe ? { haut: farbe, hautD: farbe, hose: farbe, haar: farbe } : FARBEN;
    const j = gelenke(pose);
    g.save();
    g.globalAlpha = alpha;
    g.translate(X, Y);
    g.rotate(rad(winkel));
    g.scale(fs, -fs);
    g.lineCap = "round";
    g.lineJoin = "round";
    const linie = (a, b, breit, farbeL) => {
      g.strokeStyle = farbeL;
      g.lineWidth = breit;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.stroke();
    };
    // Hinten: Arm und Bein, etwas dunkler.
    linie(j.S, j.hH, 0.1, F.hautD);
    linie(j.H, j.knH, 0.17, F.hautD);
    linie(j.knH, j.fuH, 0.13, F.hautD);
    // Der Rumpf, die Badehose um die Hüfte.
    linie(j.H, j.S, 0.27, F.haut);
    const hoseBis = [j.H[0] + (j.S[0] - j.H[0]) * 0.28, j.H[1] + (j.S[1] - j.H[1]) * 0.28];
    linie(j.H, hoseBis, 0.29, F.hose);
    const hoseBein = [j.H[0] + (j.kn[0] - j.H[0]) * 0.3, j.H[1] + (j.kn[1] - j.H[1]) * 0.3];
    linie(j.H, hoseBein, 0.2, F.hose);
    // Der Kopf mit Haar.
    g.fillStyle = F.haut;
    g.beginPath();
    g.arc(j.K[0], j.K[1], KOERPER.kopf, 0, Math.PI * 2);
    g.fill();
    if (!farbe) {
      const kr = Math.atan2(j.K[1] - j.S[1], j.K[0] - j.S[0]);
      g.fillStyle = F.haar;
      g.beginPath();
      g.arc(j.K[0], j.K[1], KOERPER.kopf * 1.03, kr - 1.9, kr + 0.7);
      g.closePath();
      g.fill();
    }
    // Vorne: Bein und Arm.
    linie(j.H, j.kn, 0.18, F.haut);
    linie(j.kn, j.fu, 0.14, F.haut);
    linie(j.S, j.hV, 0.105, F.haut);
    g.restore();
  }

  // Die Gegner (geist.js): halb durchsichtige Springer in ihrer Farbe – nur,
  // wer gerade von derselben Plattform springt. Wie eng er sich macht, folgt
  // aus seiner Drehung: Wer schnell dreht, ist im Päckchen.
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
      const offen = clamp(1 - (w - W_STRECK * 1.4) / (W_STRECK * (VERHAELTNIS - 1.4)), 0, 1);
      const pose = y > state.H - 0.3 && x < 0.3 ? POSEN.stehen : y < 0.4 ? POSEN.schwimmen : poseMisch(POSEN.paeckchen, POSEN.gestreckt, offen);
      zeichneSpringer(x, y, y < 0.4 ? 0 : winkel, pose, { farbe: o.farbe, alpha: 0.45 * o.blass });
      da.push({ ...o, sx: bildX(x), sy: bildY(y) - figurMass() * 1.3, weit: "" });
    });
    if (da.length) window.LernappGeist.namen(g, da, { breit: view.cssW, hoch: view.cssH });
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Anzeigen
  // ---------------------------------------------------------------------------
  /*
   * Der Kompass um den Springer: oben und unten grün – dort muss seine Achse
   * stehen, wenn er ins Wasser geht (oben: Kopf voran, unten: Füsse voran).
   * Hellgrün ist die 10, gelb kostet Note, rot ist der Klatscher. Der weisse
   * Zeiger ist seine Achse, der Punkt sein Kopf. Je näher das Wasser, desto
   * deutlicher.
   */
  function zeichneKompass() {
    const sp = state.sp;
    if (!sp || state.kompass <= 0.01) return;
    const fs = figurMass();
    const cx = bildX(sp.x);
    const cy = bildY(sp.y);
    const r = clamp(fs * 1.55, 34, 70);
    g.save();
    g.globalAlpha = state.kompass * (0.55 + 0.45 * state.nahWasser);
    g.lineCap = "butt";
    g.strokeStyle = "rgba(10, 14, 30, 0.5)";
    g.lineWidth = 10;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
    // Die Felder: um oben (-90°) und um unten (90°).
    const feld = (mitte, von, bis, farbe, breit = 6) => {
      g.strokeStyle = farbe;
      g.lineWidth = breit;
      g.beginPath();
      g.arc(cx, cy, r, rad(mitte + von), rad(mitte + bis));
      g.stroke();
    };
    for (const mitte of [-90, 90]) {
      feld(mitte, -KLATSCH, KLATSCH, "#ff9f1c");
      feld(mitte, -18, 18, "#ffd23f");
      feld(mitte, -9, 9, "#9be86a");
      feld(mitte, -RIP, RIP, "#3dff8c", 8);
    }
    feld(-90 + KLATSCH, 0, 180 - 2 * KLATSCH, "rgba(255, 59, 48, 0.55)");
    feld(90 + KLATSCH, 0, 180 - 2 * KLATSCH, "rgba(255, 59, 48, 0.55)");
    // Der Zeiger: seine Achse, der Kopf als Punkt.
    const w = rad(sp.winkel - 90);
    const dx = Math.cos(w);
    const dy = Math.sin(w);
    g.strokeStyle = "#ffffff";
    g.lineWidth = 2.5;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(cx - dx * (r + 7), cy - dy * (r + 7));
    g.lineTo(cx - dx * (r - 7), cy - dy * (r - 7));
    g.moveTo(cx + dx * (r - 9), cy + dy * (r - 9));
    g.lineTo(cx + dx * (r + 9), cy + dy * (r + 9));
    g.stroke();
    const fehl = Math.abs(((sp.winkel % 180) + 180) % 180 - 90);
    const err = 90 - fehl;
    g.fillStyle = err <= RIP ? "#3dff8c" : err <= 18 ? "#ffd23f" : err <= KLATSCH ? "#ff9f1c" : "#ff3b30";
    g.beginPath();
    g.arc(cx + dx * (r + 9), cy + dy * (r + 9), 5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(10, 14, 30, 0.7)";
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
  }

  // Der Ring an der Kante: zieht sich auf die Füsse zusammen; wenn er den
  // festen Ring trifft, ist der Moment. Nach dem Tipp geht er in der Farbe
  // des Absprungs auf.
  function zeichneRinge() {
    const sp = state.sp;
    if (!sp) return;
    if (state.schritt === "wippen" && state.phase === "spiel" && !state.sprung.abgesprungen) {
      const rest = ringRest();
      if (rest < RING_VOR && rest > -SPAET_MAX) {
        const X = bildX(KANTE_X + 0.15);
        const Y = bildY(state.H + 0.05);
        const r0 = 13;
        const r = r0 + Math.max(0, rest / RING_VOR) * 64;
        const a = clamp(1.25 - rest / RING_VOR, 0, 1);
        g.lineWidth = 3;
        g.strokeStyle = "rgba(255, 255, 255, 0.9)";
        g.beginPath();
        g.arc(X, Y, r0, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = `rgba(255, 210, 63, ${a})`;
        g.lineWidth = 4;
        g.beginPath();
        g.arc(X, Y, r, 0, Math.PI * 2);
        g.stroke();
        if (state.nr === 0) {
          g.font = "900 14px system-ui, sans-serif";
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.lineWidth = 4;
          g.strokeStyle = "rgba(10, 14, 30, 0.7)";
          g.globalAlpha = a;
          g.strokeText("Tippen!", X, Y + r0 + 20);
          g.fillStyle = "#ffffff";
          g.fillText("Tippen!", X, Y + r0 + 20);
          g.globalAlpha = 1;
        }
      }
    }
    const r = state.ring;
    if (r) {
      const u = clamp((state.echt - r.t) / 0.5, 0, 1);
      g.globalAlpha = 1 - u;
      g.strokeStyle = r.farbe;
      g.lineWidth = 4 * (1 - u) + 1;
      g.beginPath();
      g.arc(bildX(r.x), bildY(r.y), 13 + u * 40, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }
  }

  function zeichneTeile() {
    if (!state.teile.length) return;
    const z = kam.z;
    for (let durchgang = 0; durchgang < 2; durchgang += 1) {
      if (durchgang) g.globalCompositeOperation = "lighter";
      for (const t of state.teile) {
        const hell = t.art === "funke";
        if (hell !== Boolean(durchgang)) continue;
        const k = clamp(t.leben / t.max, 0, 1);
        const X = bildX(t.x);
        const Y = bildY(t.y);
        if (X < -30 || X > view.cssW + 30 || Y < -30 || Y > view.cssH + 30) continue;
        g.fillStyle = t.farbe;
        if (t.art === "blase") {
          g.globalAlpha = Math.min(1, k * 2) * 0.7;
          g.strokeStyle = t.farbe;
          g.lineWidth = 1;
          g.beginPath();
          g.arc(X, Y, Math.max(1.2, t.r * z), 0, Math.PI * 2);
          g.stroke();
        } else if (t.art === "gischt") {
          g.globalAlpha = k * 0.6;
          g.beginPath();
          g.arc(X, Y, Math.max(1.5, t.r * z * (1.8 - k * 0.8)), 0, Math.PI * 2);
          g.fill();
        } else {
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

  // Oben links, unter den Knöpfen: die Punkte, darunter Sprung, Höhe und
  // Pflicht – im Flug, wie weit es noch bis zum Wasser ist.
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
    y += pille(`Sprung ${state.nr + 1} · ${state.H} m`, x, y, klein, "rgba(12, 16, 34, 0.55)", "#ffffff") + 5;
    y += pille(`Pflicht ${saltos(pflichtBei(state.nr))}`, x, y, klein, "rgba(47, 211, 107, 0.9)", "#0b2a17") + 5;
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
    zeichneBoeen();
    zeichneGeister();
    const sp = state.sp;
    if (sp) zeichneSpringer(sp.x, sp.y, sp.winkel, sp.pose);
    zeichneUnterwasser();
    zeichneWasserlinie();
    zeichneTeile();
    zeichneFlutlicht();
    zeichneRinge();
    zeichneKompass();
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
  const TEILE_MAX = 260;

  function teil(t) {
    if (state.teile.length >= TEILE_MAX) state.teile.shift();
    state.teile.push(t);
  }

  // Spritzer beim Eintauchen: Tropfen, die hochfliegen und zurückfallen, und
  // eine Wolke aus Gischt. kraft 0 ist ein «Rip» (fast nichts), 1 ein
  // Klatscher.
  function spritzer(x, kraft, breit = 1) {
    const anzahl = Math.round((ruhig() ? 8 : 26) * (0.15 + kraft));
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.PI * (0.5 + (Math.random() - 0.5) * (0.5 + breit * 0.8));
      const v = (3 + Math.random() * 6) * (0.4 + kraft);
      teil({
        art: "tropfen", x: x + (Math.random() - 0.5) * 0.8 * breit, y: 0.05,
        vx: Math.cos(w) * v, vy: Math.sin(w) * v, r: 0.05 + Math.random() * 0.08,
        farbe: i % 3 ? "#ffffff" : "#cfefff", leben: 0.8 + Math.random() * 0.6, max: 1.4,
      });
    }
    for (let i = 0; i < Math.round(anzahl * 0.5); i += 1) {
      teil({
        art: "gischt", x: x + (Math.random() - 0.5) * 1.6 * breit, y: 0.2 + Math.random() * 0.6 * (0.3 + kraft),
        vx: (Math.random() - 0.5) * 2, vy: Math.random() * 1.5 * kraft, r: 0.25 + Math.random() * 0.35,
        farbe: "#ffffff", leben: 0.7 + Math.random() * 0.6, max: 1.3,
      });
    }
  }

  // Luftblasen unter Wasser.
  function blasen(x, y, anzahl) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      teil({
        art: "blase", x: x + (Math.random() - 0.5) * 0.7, y: y + (Math.random() - 0.5) * 0.7,
        vx: (Math.random() - 0.5) * 0.5, vy: 0.8 + Math.random() * 1.6, r: 0.04 + Math.random() * 0.08,
        farbe: "#dff6ff", leben: 1 + Math.random() * 1.2, max: 2.2,
      });
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

  // Die Karte vor dem Sprung: Höhe, Pflicht, Wind und Böen.
  function karteZeigen(dauer) {
    const plan = state.plan[state.nr];
    if (!plan) return;
    const vor = plan.wind >= 0;
    const b = plan.boeen.length;
    tvZeigen({
      oben: `SPRUNG ${state.nr + 1}${state.H >= 27 ? " · KLIPPE" : ""}`,
      gross: `${state.H} m`,
      rechts: `Pflicht ${saltos(pflichtBei(state.nr))}`,
      rechtsFarbe: "#3dff8c",
      unten: `Wind ${vor ? "→" : "←"} ${Math.abs(plan.wind).toFixed(1)} m/s · ${b ? (b === 1 ? "1 Böe" : `${b} Böen`) : "keine Böen"}`,
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

  // Perfekt – an der Kante und beim Eintauchen: die Harfe, nur die erste in
  // Folge.
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
  function neuerSpringer(H) {
    return {
      x: DECK_L + 1, y: H + SCHWERPUNKT, vx: 0, vy: 0, winkel: 0, offen: 1, wS: 0, tf: 0,
      armeOben: 1, pose: { ...POSEN.stehen },
    };
  }

  function neuerSprungZustand() {
    return {
      abgesprungen: false, verpasst: false, art: "", ankunft: -1, e: 0,
      eingetaucht: false, halbe: 0, err: 0, note: 0, punkte: 0, ergebnis: "", seitHalb: 0,
      eintauchZeit: -1, auftauchen: false,
    };
  }

  // Ein Sprung: für den ersten und jeden weiteren – im Spiel und beim
  // Zuschauen.
  function sprungAufbauen(nr) {
    planBis(nr + 1);
    state.nr = nr;
    state.H = hoeheBei(nr);
    state.boeen = state.plan[nr].boeen;
    state.sp = neuerSpringer(state.H);
    state.sprung = neuerSprungZustand();
    state.teile = [];
    state.wellen = [];
    state.ring = null;
    state.hilfe = "";
    state.kompass = 0;
    state.nahWasser = 0;
    kam.bereit = false;
    kam.wasserY = undefined;
  }

  // Die Momente an der Kante: WIPP_ANZAHL, je WIPP auseinander.
  const momentBei = (k) => state.sprung.ankunft + WIPP_START + k * WIPP;

  // Wie lange noch bis zum nächsten Moment (negativ: kurz danach) – für den
  // Ring und den Autopiloten der Tests.
  function ringRest() {
    const sprung = state.sprung;
    if (!sprung || state.schritt !== "wippen" || sprung.ankunft < 0) return 9;
    for (let k = 0; k < WIPP_ANZAHL; k += 1) {
      const rest = momentBei(k) - state.zeit;
      if (rest > -SPAET_MAX) return rest;
    }
    return -9;
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

  // An der Kante: Er wippt – tief in die Knie mit den Armen hinten, dann auf
  // die Zehen mit den Armen oben. Oben ist der Moment.
  function wippAnteil() {
    const seit = state.zeit - state.sprung.ankunft;
    if (seit < WIPP_START - WIPP / 2) return clamp(seit / (WIPP_START - WIPP / 2), 0, 1) * 0.5;
    const u = (((seit - WIPP_START) / WIPP) % 1 + 1) % 1;
    return 0.5 + 0.5 * Math.cos(u * Math.PI * 2);
  }

  function wippenSchritt() {
    const sp = state.sp;
    const tief = 1 - wippAnteil();
    sp.y = state.H + SCHWERPUNKT - 0.14 * tief;
    if (state.zeit > momentBei(WIPP_ANZAHL - 1) + SPAET_MAX && !state.sprung.abgesprungen) verpasst();
  }

  // Ein Tipp an der Kante: der Moment, in dessen Fenster er fällt – oder
  // keiner (dann zählt er nicht).
  function tippFenster() {
    for (let k = 0; k < WIPP_ANZAHL; k += 1) {
      const e = state.zeit - momentBei(k);
      if (e >= -FRUEH_MAX && e <= SPAET_MAX) return e;
    }
    return null;
  }

  /*
   * Der Absprung, e Sekunden nach dem Moment (negativ: davor). Wie genau,
   * entscheidet, wie hoch er springt und wie viel Drall er mitnimmt: Zu
   * früh springt er flach und dreht zu wenig, zu spät kippt er schon über
   * die Kante und dreht zu viel.
   */
  function abspringen(e) {
    const sp = state.sp;
    const sprung = state.sprung;
    const n = state.nr;
    const perf = perfektBei(n);
    const gut = gutBei(n);
    const a = Math.abs(e);
    let q;
    let art;
    if (a <= perf) { q = 1; art = "perfekt"; }
    else if (a <= gut) { q = 1 - 0.12 * ((a - perf) / (gut - perf)); art = "gut"; }
    else if (e < 0) { q = Math.max(0.45, 0.88 - ((a - gut) / (FRUEH_MAX - gut)) * 0.43); art = "frueh"; }
    else { q = Math.max(0.45, 0.88 - ((a - gut) / Math.max(0.01, SPAET_MAX - gut)) * 0.43); art = "spaet"; }
    const plan = state.plan[n];
    sprung.abgesprungen = true;
    sprung.art = art;
    sprung.e = e;
    sp.vy = V_AB * q;
    sp.vx = V_VOR * (0.8 + 0.2 * q) + plan.wind * 0.15;
    sp.wS = W_STRECK * clamp(1 + e * 2.2, 0.6, 1.5);
    sp.x = KANTE_X;
    sp.y = state.H + SCHWERPUNKT;
    sp.tf = 0;
    state.schritt = "flug";
    if (state.phase !== "spiel") return;
    const farbe = { perfekt: "#3dff8c", gut: "#ffffff", frueh: "#ffb347", spaet: "#ffb347" }[art];
    state.ring = { x: KANTE_X + 0.15, y: state.H + 0.05, t: state.echt, farbe };
    ton("turmspringen.absprung", { laut: art === "perfekt" ? 1 : art === "gut" ? 0.9 : 0.7 });
    perfektTon(art === "perfekt", 0.9);
    if (art === "perfekt") {
      schrift("Perfekt!", "#ffd23f", 24, 1.1);
      funken(KANTE_X + 0.2, state.H + 0.2, 14, ["#fff4c2", "#ffd23f", "#ffb02e"]);
      if (!ruhig()) state.zeitlupe = 0.45;
      state.blitz = 0.6;
      kids()?.vibrate?.(16);
    } else if (art === "gut") {
      schrift("Gut", "#ffffff", 20, 0.9);
      kids()?.vibrate?.(10);
    } else {
      schrift(art === "frueh" ? "Zu früh" : "Zu spät", "#ffb347", 20, 1);
      kids()?.vibrate?.(8);
    }
  }

  // Dreimal gewippt, nie getippt: Er verliert das Gleichgewicht und kippt
  // vornüber – mit den Armen in der Luft, ohne dass jemand ihn lenkt.
  function verpasst() {
    const sp = state.sp;
    const sprung = state.sprung;
    sprung.verpasst = true;
    sprung.abgesprungen = true;
    sprung.art = "verpasst";
    sp.vy = 0.8;
    sp.vx = 0.9;
    sp.wS = W_STRECK * 0.7;
    sp.tf = 0;
    state.schritt = "flug";
    if (state.phase !== "spiel") return;
    perfektTon(false);
    schrift("Verpasst!", "#ff7a6b", 22, 1.1);
    kids()?.vibrate?.([20, 30]);
  }

  // Wie schnell er dreht (Grad/s): sein Drall, geteilt durch wie weit er
  // offen ist – im Päckchen VERHAELTNIS mal schneller.
  const drehBei = (wS, offen) => wS / lerp(1 / VERHAELTNIS, 1, offen);

  // Wie weit sein tiefster Punkt unter dem Schwerpunkt liegt: gestreckt die
  // Hände (kopfüber) oder die Füsse, im Päckchen ein Knäuel.
  function unterkante(winkel, offen) {
    const w = rad(winkel);
    const uy = Math.cos(w);
    const quer = 0.15 * Math.abs(Math.sin(w));
    const strecke = uy >= 0 ? 0.95 * uy : lerp(0.6, 1.25, offen) * -uy;
    return Math.max(lerp(0.55, 0.15, offen), strecke + quer);
  }

  // Ein Schritt im Fall: Schwerkraft, die Drehung aus Drall und Haltung, die
  // Böe in dieser Höhe.
  function fallSchritt(p, hp, ziel) {
    p.offen = naeher(p.offen, ziel, ziel < p.offen ? SCHLIESSEN : OEFFNEN, hp);
    p.winkel += (drehBei(p.wS, p.offen) + boeBei(p.y).dreh) * hp;
    p.vy -= G * hp;
    p.x += p.vx * hp;
    p.y += p.vy * hp;
  }

  function flugSchritt(h) {
    const sp = state.sp;
    const sprung = state.sprung;
    const hp = h * TEMPO;
    sp.tf += hp;
    const ziel = state.halten && !sprung.verpasst ? 0 : 1;
    fallSchritt(sp, hp, ziel);
    // Jede halbe Drehung ein kleines Zeichen am Springer.
    const halb = Math.floor(sp.winkel / 180 + 0.5);
    if (halb > sprung.seitHalb) {
      sprung.seitHalb = halb;
      if (state.phase === "spiel" && sp.y > 2) schrift(halbe(halb), "#ffffff", 15, 0.55, { folgt: false, x: sp.x + 2.6, y: sp.y + 0.6 });
    }
    if (sp.y - unterkante(sp.winkel, sp.offen) <= 0) eintauchen();
  }

  // Bis zum Wasser vorausrechnen: Wo steht seine Achse, wenn er jetzt
  // öffnet (oder im Päckchen bleibt)? Für den Kompass im ersten Sprung und
  // den Autopiloten der Tests.
  function vorausWinkel(oeffnen = true) {
    const sp = state.sp;
    if (!sp || state.schritt !== "flug") return { winkel: sp?.winkel || 0, tau: 9, offen: 1 };
    const p = { x: sp.x, y: sp.y, vx: sp.vx, vy: sp.vy, winkel: sp.winkel, offen: sp.offen, wS: sp.wS };
    const ziel = oeffnen ? 1 : 0;
    const hp = 1 / 120;
    for (let t = 0; t < 6; t += hp) {
      fallSchritt(p, hp, ziel);
      if (p.y - unterkante(p.winkel, p.offen) <= 0) return { winkel: p.winkel, tau: (t + hp) / TEMPO, offen: p.offen };
    }
    return { winkel: p.winkel, tau: 9, offen: p.offen };
  }

  /*
   * Er taucht ein. Wie viele halbe Saltos es waren, sagt die Senkrechte, der
   * seine Achse am nächsten ist; wie weit er daneben liegt, die Note. Offen
   * muss er sein: Wer zu spät streckt, verliert Note, wer im Päckchen bleibt,
   * macht eine Arschbombe. Liegt er quer, ist es ein Klatscher.
   */
  function eintauchen() {
    const sp = state.sp;
    const sprung = state.sprung;
    const n = state.nr;
    const halb = Math.max(0, Math.round(sp.winkel / 180));
    const err = Math.abs(sp.winkel - halb * 180);
    const offen = sp.offen;
    const pflicht = pflichtBei(n);
    let ergebnis;
    let note = 0;
    if (offen < BOMBE) ergebnis = "bombe";
    else if (err > KLATSCH) {
      const lage = ((sp.winkel % 360) + 360) % 360;
      ergebnis = lage < 180 ? "bauch" : "ruecken";
    } else {
      let roh = err <= RIP ? 10 : 10 - (err - RIP) / 2.7;
      roh -= Math.max(0, OFFEN_GUT - offen) * 15;
      note = clamp(Math.round(roh * 2) / 2, 0.5, 10);
      ergebnis = halb >= pflicht ? "gut" : "pflicht";
    }
    const punkte = ergebnis === "gut" || ergebnis === "pflicht" ? Math.round(halb * note) : 0;
    sprung.eingetaucht = true;
    sprung.halbe = halb;
    sprung.err = err;
    sprung.note = note;
    sprung.punkte = punkte;
    sprung.ergebnis = ergebnis;
    sprung.eintauchZeit = state.zeit;
    state.punkte += punkte;
    state.sprunge.push(punkte);
    shell.setCount(state.punkte);
    state.schritt = "wasser";
    state.weiterIn = 3.1;
    state.hilfe = "";
    sp.y = Math.min(sp.y, unterkante(sp.winkel, sp.offen));
    sp.vy *= 0.35;
    sp.vx *= 0.3;
    const fehl = ergebnis === "bombe" || ergebnis === "bauch" || ergebnis === "ruecken";
    const kraft = fehl ? (ergebnis === "bombe" ? 1.7 : 1.25) : 0.08 + (10 - note) * 0.09;
    spritzer(sp.x, kraft, ergebnis === "bombe" ? 0.6 : fehl ? 1.6 : 0.5);
    state.wellen.push({ x: sp.x, alter: 0, dauer: 2.4, weit: 2.5 + kraft * 3 });
    blasen(sp.x, -0.6, fehl ? 10 : 18);
    kids()?.vibrate?.(fehl ? [30, 40, 60] : note >= 9.5 ? [10, 30, 14] : 14);
    fahrtwind.aus();
    // Der Platsch: leise beim sauberen Eintauchen, laut beim Klatscher.
    ton("turmspringen.eintauchen", { laut: clamp(0.35 + kraft * 0.6, 0.35, 1.3) });
    perfektTon(note >= 9.5, 0.8, 0.05);
    if (note >= 9.5) ton("turmspringen.rip", { laut: 0.9 });

    const oben = `SPRUNG ${n + 1} · ${state.H} m`;
    if (fehl) {
      state.aus = ergebnis === "bombe" ? "bombe" : "klatscher";
      const wort = { bombe: "Arschbombe", bauch: "Bauchklatscher", ruecken: "Rückenklatscher" }[ergebnis];
      state.grund = wort;
      state.stoss = 1;
      if (!ruhig()) state.zeitlupe = 0.4;
      schrift(`${wort}!`, "#ff7a6b", 24, 1.8);
      tvZeigen({ oben, gross: wort, rechts: "0 Punkte", rechtsFarbe: "#ff7a6b", unten: `Pflicht ${saltos(pflicht)}`, untenFarbe: "#ffb0a8", farbe: "#ff3b30" }, state.weiterIn);
      ton("fehler", { verzoegerung: 0.25 }, 300);
      return;
    }
    const geschafft = ergebnis === "gut";
    if (!geschafft) state.aus = "pflicht";
    state.stoss = 0.25;
    const noten = [note, note, note].map((x, i) => (i === 1 ? x : clamp(x + (Math.random() < 0.5 ? -0.5 : 0.5) * (Math.random() < 0.6 ? 1 : 0), 0, 10)));
    tvZeigen({
      oben,
      gross: saltos(halb),
      rechts: `Note ${note.toFixed(1)}`,
      rechtsFarbe: note >= 9 ? "#ffd23f" : note >= 7 ? "#ffffff" : "#ffb347",
      unten: geschafft ? `+${punkte} Punkte · Pflicht ${halbe(pflicht)} ✓` : `+${punkte} Punkte · Pflicht ${halbe(pflicht)} – nicht geschafft`,
      untenFarbe: geschafft ? "#9ff5bd" : "#ffb0a8",
      farbe: geschafft ? "#3dff8c" : "#ff3b30",
      noten,
    }, state.weiterIn);
    if (note >= 9.5) {
      schrift(err <= RIP ? "Rip!" : "Perfekt!", "#ffd23f", 24, 1.3);
      if (flutlichtBei(n)) {
        for (let k = 0; k < 3; k += 1) funken(lerp(-4, 16, Math.random()), state.H + 6 + Math.random() * 8, 22, ["#ffd23f", "#ff7ab6", "#7ae0ff", "#ffffff"], 1.3);
      }
    } else if (note < 6) {
      schrift("Spritzer", "#ffb347", 20, 1.1);
    }
    if (!geschafft) {
      schrift("Pflicht verfehlt", "#ff7a6b", 20, 1.6, { folgt: false, x: sp.x, y: 3 });
      ton("fehler", { verzoegerung: 0.3 }, 300);
    } else if (note >= 8) {
      // Das Publikum jubelt einen Augenblick später – am lautesten bei einer
      // hohen Note mit vielen Drehungen.
      state.jubel = 1;
      const laut = 0.6 + (note >= 9.5 ? 0.3 : 0) + Math.min(0.3, halb * 0.05);
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
      if (Math.random() < h * 30) blasen(sp.x, sp.y, 1);
    } else {
      sprung.auftauchen = true;
      sp.vy = naeher(sp.vy, 1.6, 3, h);
      sp.y = Math.min(-0.25, sp.y + sp.vy * h);
      sp.winkel = naeher(sp.winkel, Math.round(sp.winkel / 360) * 360, 3.5, h);
      if (sp.y < -0.3 && Math.random() < h * 12) blasen(sp.x, sp.y + 0.5, 1);
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

  // Die Haltung, die zum Augenblick gehört. Im Flug: gemischt aus Päckchen
  // und gestreckt, so weit er offen ist – die Arme gestreckt über dem Kopf,
  // wenn als Nächstes der Kopf ins Wasser käme, sonst am Körper.
  const armeZiel = (winkel) => (Math.ceil((winkel - 20) / 180) % 2 !== 0 ? 1 : 0);

  function poseWaehlen(dt) {
    const sp = state.sp;
    if (!sp) return;
    const s = state.schritt;
    if (s === "wippen") {
      poseMisch(POSEN.ausholen, POSEN.arme, wippAnteil(), sp.pose);
    } else if (s === "flug") {
      if (state.sprung.verpasst) {
        poseZu(sp.pose, POSEN.fallen, 8, dt);
        return;
      }
      sp.armeOben = naeher(sp.armeOben, armeZiel(sp.winkel), 7, dt);
      const offen = poseMisch(POSEN.fuesse, POSEN.gestreckt, sp.armeOben);
      poseMisch(POSEN.paeckchen, offen, glatt(sp.offen), sp.pose);
    } else if (s === "wasser") {
      const sprung = state.sprung;
      const fehl = state.aus === "klatscher" || state.aus === "bombe";
      const ziel = fehl ? POSEN.klatsch : !sprung.auftauchen ? POSEN.gestreckt
        : sprung.note >= 8 && sprung.ergebnis === "gut" ? POSEN.jubel : POSEN.schwimmen;
      poseZu(sp.pose, ziel, 5, dt);
    } else {
      poseZu(sp.pose, POSEN.stehen, 6, dt);
    }
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
    if (sp && state.phase !== "zuschauen") poseWaehlen(dt);
    // Der Kompass erscheint nach dem Absprung und geht beim Eintauchen;
    // deutlicher, je näher das Wasser.
    const fliegt = state.schritt === "flug" && sp && !state.sprung?.verpasst;
    state.kompass = clamp((state.kompass || 0) + (fliegt ? dt * 5 : -dt * 4), 0, 1);
    state.nahWasser = fliegt ? clamp(1 - (sp.y - 1) / Math.max(4, state.H * 0.35), 0, 1) : 0;
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

  // Im ersten Sprung sagt das Spiel, was zu tun ist: halten, bis die
  // Drehung reicht – loslassen, wenn sie aufgeht.
  function hilfeTakt() {
    if (state.nr !== 0 || state.schritt !== "flug" || state.sprung.verpasst) { state.hilfe = ""; return; }
    const ziel = pflichtBei(0) * 180;
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
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      if (t.art === "blase") {
        t.vx *= 1 - 1.5 * dt;
        t.x += Math.sin(state.echt * 6 + i) * 0.2 * dt;
        if (t.y > -0.05) t.leben = 0;
      } else if (t.art === "gischt") {
        t.vy -= 1.5 * dt;
        t.vx *= 1 - 1.2 * dt;
      } else {
        t.vy -= (t.art === "funke" ? 4 : 9.8) * dt;
        t.vx *= 1 - 0.8 * dt;
        if (t.art === "tropfen" && t.y < 0 && t.vy < 0) t.leben = 0;
      }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
    for (let i = state.wellen.length - 1; i >= 0; i -= 1) {
      state.wellen[i].alter += dt;
      if (state.wellen[i].alter > state.wellen[i].dauer) state.wellen.splice(i, 1);
    }
    if (state.ring && state.echt - state.ring.t > 0.6) state.ring = null;
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
  // Saat (geist.js, zuschauer), startRun würfelt damit denselben Wind und
  // dieselben Böen, und der Springer steht Bild für Bild dort, wo er damals
  // war. Aus a folgt der Sprung, aus der Drehung je Sekunde, wie eng er sich
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
    // Wie schnell er dreht, in Grad je Sekunde des Spiels: daraus, wie eng
    // er sich machte.
    if (sp.zw !== undefined && dt > 0) {
      const w = Math.abs(winkel - sp.zw) / dt / TEMPO;
      const offen = clamp(1 - (w - W_STRECK * 1.4) / (W_STRECK * (VERHAELTNIS - 1.4)), 0, 1);
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
      state.schritt = x < KANTE_X - 0.05 ? "laufen" : "wippen";
      const tief = clamp((state.H + SCHWERPUNKT - y) / 0.14, 0, 1);
      if (state.schritt === "wippen") poseMisch(POSEN.ausholen, POSEN.arme, 1 - tief, sp.pose);
      else poseZu(sp.pose, POSEN.stehen, 6, dt);
    } else if (!sprung.eingetaucht && y - unterkante(winkel, sp.offen) > 0.05) {
      if (state.schritt !== "flug") ton("turmspringen.absprung", { laut: 0.9 });
      state.schritt = "flug";
      sprung.abgesprungen = true;
      sp.armeOben = naeher(sp.armeOben, armeZiel(winkel), 7, dt);
      const offen = poseMisch(POSEN.fuesse, POSEN.gestreckt, sp.armeOben);
      poseMisch(POSEN.paeckchen, offen, glatt(sp.offen), sp.pose);
    } else {
      if (!sprung.eingetaucht) {
        // Eingetaucht: Spritzer, Ringe, die Saltos.
        const halb = Math.max(0, Math.round(winkel / 180));
        const err = Math.abs(winkel - halb * 180);
        const fehl = err > KLATSCH || sp.offen < BOMBE;
        const kraft = fehl ? 1.3 : 0.08 + err * 0.03;
        sprung.eingetaucht = true;
        sprung.halbe = halb;
        sprung.ergebnis = fehl ? "fehl" : "gut";
        sprung.eintauchZeit = state.zeit;
        sprung.punkteVor = state.punkte;
        spritzer(x, kraft, fehl ? 1.6 : 0.5);
        state.wellen.push({ x, alter: 0, dauer: 2.4, weit: 2.5 + kraft * 3 });
        blasen(x, -0.6, 14);
        ton("turmspringen.eintauchen", { laut: clamp(0.35 + kraft * 0.6, 0.35, 1.3) });
        const wort = sp.offen < BOMBE ? "Arschbombe" : (((winkel % 360) + 360) % 360) < 180 ? "Bauchklatscher" : "Rückenklatscher";
        tvZeigen({
          oben: `SPRUNG ${nr + 1} · ${state.H} m`, gross: fehl ? wort : saltos(halb), rechts: "",
          unten: `Pflicht ${saltos(pflichtBei(nr))}`, farbe: fehl ? "#ff3b30" : "#3dff8c",
        }, 3);
      }
      state.schritt = "wasser";
      sprung.auftauchen = y > -0.6 && state.zeit - sprung.eintauchZeit > 0.6;
      const ziel = sprung.ergebnis === "fehl" ? POSEN.klatsch : sprung.auftauchen ? POSEN.schwimmen : POSEN.gestreckt;
      poseZu(sp.pose, ziel, 5, dt);
    }
    // Was der Sprung brachte, steht genau in der Aufzeichnung.
    const punkte = Math.max(0, Math.floor(s.punkte));
    if (punkte !== state.punkte) {
      const dazu = punkte - (sprung.punkteVor ?? state.punkte);
      if (state.tv && sprung.eingetaucht && sprung.halbe > 0) {
        const note = Math.round((dazu / sprung.halbe) * 2) / 2;
        state.tv.rechts = `Note ${note.toFixed(1)}`;
        state.tv.rechtsFarbe = note >= 9 ? "#ffd23f" : "#ffffff";
        state.tv.unten = `+${dazu} Punkte · Pflicht ${halbe(pflichtBei(nr))}`;
        if (note >= 8) {
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

  // Ein Tipp an der Kante: Absprung – aber nur im Fenster eines Moments.
  function tippen() {
    if (state.schritt !== "wippen" || state.sprung.abgesprungen) return;
    const e = tippFenster();
    if (e !== null) abspringen(e);
  }

  // Ein neuer Druck (Finger oder Taste).
  function druck() {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    if (state.phase === "bereit") {
      if (!shell.live) losGehts();
      return;
    }
    tippen();
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

  // Für die Prüfskripte und die Vorführung: aktion() ist ein Tipp (Start,
  // Absprung), halte(true/false) hält wie ein Finger.
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
    planBis(4);
    sprungAufbauen(0);
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    promptKnoten = shell.el("p", "cm-prompt ts-prompt", "Kante: tippen · Halten: Päckchen · Loslassen: strecken");
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
    const grund = state.aus === "pflicht" ? "Pflicht verfehlt" : state.grund;
    const sprunge = anzahl === 1 ? "1 Sprung" : `${anzahl} Sprünge`;
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : [`${sprunge}, bester ${bester} Punkte`, grund, vorher ? `Bestwert ${vorher}` : ""].filter(Boolean).join(" · "),
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
    host, spiel: "highDive", fassung: "t1", zufall, einheit: "Punkte", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "highDive", host, art: "tempo", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Ein Finger irgendwo im Bild: Start, Absprung – und solange er liegt,
  // das Päckchen. Nur Knöpfe bleiben Knöpfe.
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

  // Für die Prüfskripte und die Vorführung. aktion() tippt (Start,
  // Absprung), halte(an) hält. ringRest() sagt, wann an der Kante der
  // Moment kommt, vorausWinkel(), wo die Achse beim Eintauchen stünde.
  window.LernappTurmspringen = {
    TAKT, ABSTAND, TEMPO, RIP, KLATSCH, W_STRECK, VERHAELTNIS,
    state, view, kam, takt, zeichnen, weltText, losGehts, aktion, halte, tippen,
    ringRest, vorausWinkel, planBis, hoeheBei, pflichtBei, perfektBei, gutBei, boeBei, unterkante, bildX, bildY,
  };
})();
