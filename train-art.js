/*
 * train-art.js – Die Lok als Zeichnung, und das Werkzeug dazu.
 *
 * Baut die Lokomotive als SVG aus einzelnen Bauteilen zusammen. Reine
 * Funktionen: rein geht eine Konfiguration, raus kommt ein SVG-Element. Kein
 * Zustand, keine Ereignisse.
 *
 * Zwei Spiele brauchen die Lok: "Halt am Signal" lässt sie am Signal warten,
 * "Wo hält der Zug?" schiebt sie über das Gleis. Alle übrigen brauchen nur
 * el() und shade() – die zwei Handgriffe, mit denen hier jede Zeichnung
 * entsteht.
 *
 * In der App steht in dieser Datei noch viel mehr: die Wagen in fünfzehn
 * Baustufen, die Bahnhöfe und Gebäude der Landschaft, die Zeichen der
 * Reisekarte, die Symbole aller Spiele. Nichts davon kommt hier vor – es
 * gibt keinen Zug, der wächst, und keine Reise.
 *
 * Alle Teile liegen auf demselben Boden (GROUND). Farben werden hier
 * ausgerechnet und als Attribut gesetzt; Umfärben heisst neu bauen, was bei
 * rund zwanzig Elementen je Teil billiger ist als eine Mutations-Logik.
 */
(() => {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";

  // Gemeinsames Koordinatensystem. Der Boden ist die Schienenoberkante.
  const GROUND = 170;
  const ART_H = 200;
  const WAGON_W = 140;
  const LOCO_W = 200;
  const WHEEL_Y = GROUND - 12;

  // Wie lange ein Rad für eine Umdrehung braucht, bezogen auf das grosse
  // Treibrad der Lok. Kleinere Räder bekommen anteilig weniger Zeit – sie
  // laufen auf demselben Gleis.
  const WHEEL_TURN = 1.5;
  const WHEEL_REF = 23;

  // ---------------------------------------------------------------------------
  // Kleine Helfer
  // ---------------------------------------------------------------------------
  function el(name, attrs = {}, children = []) {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined) continue;
      node.setAttribute(key, String(value));
    }
    children.filter(Boolean).forEach((child) => node.append(child));
    return node;
  }

  function group(attrs, children) { return el("g", attrs, children); }

  function clampByte(value) { return Math.max(0, Math.min(255, Math.round(value))); }

  function toRgb(hex) {
    const clean = String(hex).replace("#", "");
    const full = clean.length === 3 ? [...clean].map((c) => c + c).join("") : clean;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  }

  function toHex(rgb) { return `#${rgb.map((v) => clampByte(v).toString(16).padStart(2, "0")).join("")}`; }

  // amount < 0 dunkelt ab, > 0 hellt auf. Damit bekommt jedes Bauteil ohne
  // zweite Farbe im Konfigurationsobjekt eine Licht- und eine Schattenseite.
  function shade(hex, amount) {
    const rgb = toRgb(hex);
    const target = amount < 0 ? 0 : 255;
    const mix = Math.abs(amount);
    return toHex(rgb.map((v) => v + (target - v) * mix));
  }

  // Wählt Schwarz oder Weiss – je nachdem, was auf der Farbe besser lesbar ist.
  function inkOn(hex) {
    const [r, g, b] = toRgb(hex);
    return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#243047" : "#ffffff";
  }

  // ---------------------------------------------------------------------------
  // Räder
  // ---------------------------------------------------------------------------
  // Vier Radformen. In der App muss man sich das Sonnenrad verdienen; hier
  // baut niemand eine Lok zusammen, gezeichnet wird, was die Konfiguration
  // sagt.
  const WHEEL_SHAPES = ["spoke", "disc", "star", "sun"];

  function wheel(cx, radius, color, shape = "spoke") {
    const rim = shade(color, -0.25);
    const parts = [el("circle", { cx: 0, cy: 0, r: radius, fill: "none", stroke: color, "stroke-width": radius * 0.36 })];

    if (shape === "disc") {
      parts.push(el("circle", { cx: 0, cy: 0, r: radius * 0.62, fill: shade(color, 0.28) }));
      parts.push(el("circle", { cx: 0, cy: 0, r: radius * 0.22, fill: rim }));
      // Ohne eine Marke sähe die Scheibe im Stillstand aus wie in der Fahrt.
      parts.push(el("rect", { x: -radius * 0.09, y: -radius * 0.58, width: radius * 0.18, height: radius * 0.3, rx: radius * 0.09, fill: rim }));
    } else if (shape === "star") {
      const points = [];
      for (let i = 0; i < 10; i += 1) {
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const r = i % 2 === 0 ? radius * 0.72 : radius * 0.3;
        points.push(`${(Math.cos(angle) * r).toFixed(1)},${(Math.sin(angle) * r).toFixed(1)}`);
      }
      parts.push(el("polygon", { points: points.join(" "), fill: shade(color, 0.3) }));
    } else if (shape === "sun") {
      // Das Sonnenrad: eine goldene Scheibe mit acht Strahlen, gleich in
      // welcher Farbe der Reifen ist. Die Strahlen zeigen die Drehung.
      const gold = "#f0b429";
      for (let i = 0; i < 8; i += 1) {
        const angle = (Math.PI / 4) * i;
        parts.push(el("line", {
          x1: (Math.cos(angle) * radius * 0.5).toFixed(1), y1: (Math.sin(angle) * radius * 0.5).toFixed(1),
          x2: (Math.cos(angle) * radius * 0.78).toFixed(1), y2: (Math.sin(angle) * radius * 0.78).toFixed(1),
          stroke: shade(gold, -0.18), "stroke-width": Math.max(2, radius * 0.16), "stroke-linecap": "round",
        }));
      }
      parts.push(el("circle", { cx: 0, cy: 0, r: radius * 0.52, fill: gold }));
      parts.push(el("circle", { cx: 0, cy: 0, r: radius * 0.2, fill: shade(gold, -0.4) }));
    } else {
      const spokes = [];
      for (let i = 0; i < 4; i += 1) {
        const angle = (Math.PI / 4) * i;
        const dx = Math.cos(angle) * radius * 0.74;
        const dy = Math.sin(angle) * radius * 0.74;
        spokes.push(el("line", {
          x1: -dx, y1: -dy, x2: dx, y2: dy,
          stroke: color, "stroke-width": Math.max(2, radius * 0.16), "stroke-linecap": "round",
        }));
      }
      parts.push(...spokes);
      parts.push(el("circle", { cx: 0, cy: 0, r: radius * 0.2, fill: rim }));
    }

    // Kleine Räder drehen sich schneller als grosse – sie laufen auf demselben
    // Gleis und legen bei einer Umdrehung weniger Weg zurück. Die Zeit je
    // Umdrehung steht als CSS-Variable am Rad; die Animation selbst im CSS.
    const turn = (WHEEL_TURN * radius / WHEEL_REF).toFixed(2);
    return group({ transform: `translate(${cx},${WHEEL_Y})` }, [
      // Ein unsichtbarer Kreis, so gross wie das Rad samt Reifen. Ohne ihn
      // atmete die Umrandung der ganzen Lok im Takt der Drehung: ein Stern
      // ist nicht in jeder Stellung gleich breit. Für einen Finger wäre das
      // egal, aber das Ziel soll stillstehen, nicht zittern.
      el("circle", { cx: 0, cy: 0, r: radius * 1.2, fill: "none" }),
      group({ class: "train-wheel", style: `--turn:${turn}s` }, parts),
    ]);
  }

  // ---------------------------------------------------------------------------
  // Tiere am Steuer
  // ---------------------------------------------------------------------------
  // Nur Köpfe: mehr ist im Führerhausfenster nicht zu sehen, und ein Kopf lässt
  // sich klar genug zeichnen, dass ein Kind das Tier auf Anhieb erkennt.
  const DRIVERS = [
    { id: "fox", name: "Fuchs", coat: "#e8763a", inner: "#ffd9b8", ear: "point" },
    { id: "bear", name: "Bär", coat: "#9a6b46", inner: "#d8b48f", ear: "round" },
    { id: "rabbit", name: "Hase", coat: "#f0ece6", inner: "#f7b8c4", ear: "long" },
    { id: "cat", name: "Katze", coat: "#8d8f9c", inner: "#e6e2ee", ear: "point" },
    { id: "panda", name: "Panda", coat: "#f4f1ec", inner: "#2f3138", ear: "round" },
    { id: "frog", name: "Frosch", coat: "#5cb85c", inner: "#c9ea9a", ear: "eyes" },
    { id: "owl", name: "Eule", coat: "#a9814f", inner: "#f3e2c0", ear: "tuft" },
    { id: "penguin", name: "Pinguin", coat: "#3a4250", inner: "#ffffff", ear: "none" },
    { id: "lion", name: "Löwe", coat: "#e0a53c", inner: "#f6dda3", ear: "mane" },
    { id: "mouse", name: "Maus", coat: "#b0b3bd", inner: "#f7c9d4", ear: "big" },
    { id: "squirrel", name: "Eichhörnchen", coat: "#c9743a", inner: "#f2c9a6", ear: "tuft" },
    { id: "ibex", name: "Steinbock", coat: "#a99a86", inner: "#e9e2d6", ear: "horns" },
  ];
  const DRIVER_BY_ID = Object.fromEntries(DRIVERS.map((d) => [d.id, d]));

  // Zeichnet einen Tierkopf um (0,0) herum mit Radius r.
  // Wie weit ein Tier über und neben seinem Kopfkreis hinausragt, in Vielfachen
  // des Kopfradius. Die Werte stammen aus den Ohrformen unten – der Hase mit
  // seinen langen Löffeln braucht mehr als doppelt so viel Höhe wie Kopf.
  // Gebraucht wird das, damit jedes Tier ganz ins Führerhausfenster passt,
  // statt mit den Ohren durch den Rahmen zu stossen.
  const EAR_REACH = {
    point: { up: 1.5, side: 0.85 },
    round: { up: 1.24, side: 1.22 },
    big: { up: 1.34, side: 1.42 },
    long: { up: 2.13, side: 1 },
    tuft: { up: 1.3, side: 1 },
    mane: { up: 1.5, side: 1.5 },
    eyes: { up: 1.12, side: 1 },
    horns: { up: 1.7, side: 1.25 },
  };

  // Der grösste Kopf, der in ein Fenster passt, samt der Höhe, auf der er
  // sitzen muss, damit die Ohrenspitzen knapp unter dem Rahmen bleiben.
  function driverFit(driverId, box, margin = 2, maxR = 16) {
    const driver = DRIVER_BY_ID[driverId] || DRIVERS[0];
    const reach = EAR_REACH[driver.ear] || { up: 1, side: 1 };
    const innerW = box.width - margin * 2;
    const innerH = box.height - margin * 2;
    const r = Math.min(maxR, innerH / (reach.up + 1), innerW / (2 * Math.max(1, reach.side)));
    return { r, cx: box.x + box.width / 2, cy: box.y + margin + reach.up * r };
  }

  function driverHead(driverId, r = 16) {
    const driver = DRIVER_BY_ID[driverId] || DRIVERS[0];
    const { coat, inner, ear } = driver;
    const dark = shade(coat, -0.45);
    const parts = [];

    // Ohren zuerst, damit der Kopf sie überlappt.
    if (ear === "point") {
      parts.push(el("polygon", { points: `${-r * 0.85},${-r * 0.4} ${-r * 0.72},${-r * 1.5} ${-r * 0.1},${-r * 0.78}`, fill: coat }));
      parts.push(el("polygon", { points: `${r * 0.85},${-r * 0.4} ${r * 0.72},${-r * 1.5} ${r * 0.1},${-r * 0.78}`, fill: coat }));
    } else if (ear === "round" || ear === "big") {
      const er = ear === "big" ? r * 0.62 : r * 0.42;
      const ey = ear === "big" ? -r * 0.72 : -r * 0.82;
      parts.push(el("circle", { cx: -r * 0.8, cy: ey, r: er, fill: ear === "round" && driverId === "panda" ? inner : coat }));
      parts.push(el("circle", { cx: r * 0.8, cy: ey, r: er, fill: ear === "round" && driverId === "panda" ? inner : coat }));
    } else if (ear === "long") {
      parts.push(el("ellipse", { cx: -r * 0.42, cy: -r * 1.35, rx: r * 0.24, ry: r * 0.78, fill: coat }));
      parts.push(el("ellipse", { cx: r * 0.42, cy: -r * 1.35, rx: r * 0.24, ry: r * 0.78, fill: coat }));
      parts.push(el("ellipse", { cx: -r * 0.42, cy: -r * 1.3, rx: r * 0.1, ry: r * 0.5, fill: inner }));
      parts.push(el("ellipse", { cx: r * 0.42, cy: -r * 1.3, rx: r * 0.1, ry: r * 0.5, fill: inner }));
    } else if (ear === "tuft") {
      parts.push(el("polygon", { points: `${-r},${-r * 0.5} ${-r * 0.86},${-r * 1.3} ${-r * 0.3},${-r * 0.8}`, fill: coat }));
      parts.push(el("polygon", { points: `${r},${-r * 0.5} ${r * 0.86},${-r * 1.3} ${r * 0.3},${-r * 0.8}`, fill: coat }));
    } else if (ear === "horns") {
      // Zwei Hörner, die aus dem Scheitel nach hinten und oben biegen. Dick
      // genug, dass sie auch im kleinen Fenster noch als Hörner lesen.
      [-1, 1].forEach((side) => {
        parts.push(el("path", {
          d: `M${side * r * 0.42} ${-r * 0.72} C${side * r * 0.8} ${-r * 1.25} ${side * r * 1.3} ${-r * 1.45} ${side * r * 0.95} ${-r * 1.65}`,
          fill: "none", stroke: shade(coat, -0.45), "stroke-width": r * 0.3, "stroke-linecap": "round",
        }));
      });
      parts.push(el("polygon", { points: `${-r * 0.55},${-r * 0.55} ${-r * 0.22},${-r * 1.05} ${-r * 0.05},${-r * 0.7}`, fill: coat }));
      parts.push(el("polygon", { points: `${r * 0.55},${-r * 0.55} ${r * 0.22},${-r * 1.05} ${r * 0.05},${-r * 0.7}`, fill: coat }));
    } else if (ear === "mane") {
      // Die Mähne braucht deutlich mehr Kontrast als der Kopf, sonst liest der
      // Löwe nur als goldene Scheibe. Zackenkranz statt zweiter Kreis.
      const points = [];
      for (let i = 0; i < 20; i += 1) {
        const angle = (Math.PI / 10) * i - Math.PI / 2;
        const rr = i % 2 === 0 ? r * 1.5 : r * 1.14;
        points.push(`${(Math.cos(angle) * rr).toFixed(1)},${(Math.sin(angle) * rr).toFixed(1)}`);
      }
      parts.push(el("polygon", { points: points.join(" "), fill: shade(coat, -0.42) }));
      parts.push(el("circle", { cx: 0, cy: 0, r: r * 1.1, fill: shade(coat, -0.18) }));
    }

    // Kopf
    parts.push(el("circle", { cx: 0, cy: 0, r, fill: coat }));

    if (driverId === "panda") {
      parts.push(el("ellipse", { cx: -r * 0.38, cy: -r * 0.1, rx: r * 0.28, ry: r * 0.32, fill: inner }));
      parts.push(el("ellipse", { cx: r * 0.38, cy: -r * 0.1, rx: r * 0.28, ry: r * 0.32, fill: inner }));
    }
    if (driverId === "penguin") {
      parts.push(el("ellipse", { cx: 0, cy: r * 0.18, rx: r * 0.66, ry: r * 0.72, fill: inner }));
    }
    if (ear === "eyes") {
      // Froschaugen sitzen oben auf dem Kopf und brauchen Weiss, sonst gehen
      // sie im grünen Kopf unter.
      [-1, 1].forEach((side) => {
        parts.push(el("circle", { cx: side * r * 0.56, cy: -r * 0.76, r: r * 0.36, fill: coat }));
        parts.push(el("circle", { cx: side * r * 0.56, cy: -r * 0.76, r: r * 0.26, fill: "#ffffff" }));
        parts.push(el("circle", { cx: side * r * 0.56, cy: -r * 0.72, r: r * 0.14, fill: "#243047" }));
      });
    }

    // Schnauze und Augen
    if (driverId === "owl") {
      // Eulen leben von grossen Augen – zwei helle Scheiben mit dunklem Kern.
      [-1, 1].forEach((side) => {
        parts.push(el("circle", { cx: side * r * 0.38, cy: -r * 0.12, r: r * 0.36, fill: inner }));
        parts.push(el("circle", { cx: side * r * 0.38, cy: -r * 0.12, r: r * 0.18, fill: "#243047" }));
      });
    } else if (driverId !== "frog") {
      parts.push(el("circle", { cx: -r * 0.32, cy: -r * 0.06, r: r * 0.13, fill: dark }));
      parts.push(el("circle", { cx: r * 0.32, cy: -r * 0.06, r: r * 0.13, fill: dark }));
    }
    if (driverId === "owl" || driverId === "penguin") {
      parts.push(el("polygon", { points: `0,${r * 0.12} ${-r * 0.2},${r * 0.42} ${r * 0.2},${r * 0.42}`, fill: "#f0a13c" }));
    } else if (driverId === "frog") {
      parts.push(el("path", { d: `M${-r * 0.4},${r * 0.28} q${r * 0.4},${r * 0.3} ${r * 0.8},0`, fill: "none", stroke: dark, "stroke-width": r * 0.12, "stroke-linecap": "round" }));
    } else {
      parts.push(el("ellipse", { cx: 0, cy: r * 0.36, rx: r * 0.34, ry: r * 0.26, fill: inner }));
      parts.push(el("circle", { cx: 0, cy: r * 0.26, r: r * 0.11, fill: dark }));
    }
    if (driverId === "ibex") {
      parts.push(el("polygon", { points: `${-r * 0.16},${r * 0.58} ${r * 0.16},${r * 0.58} 0,${r * 0.98}`, fill: shade(coat, -0.3) }));
    }

    return group({ class: "train-driver" }, parts);
  }

  // ---------------------------------------------------------------------------
  // Lokomotive
  // ---------------------------------------------------------------------------
  const CHIMNEY_SHAPES = ["classic", "funnel", "double", "slim"];
  const CAB_SHAPES = ["round", "flat", "peak"];
  const LAMP_SHAPES = ["round", "square", "star"];
  const FLAG_PATTERNS = ["plain", "stripes", "dots", "zigzag", "rainbow", "stars", "sun"];
  const WHISTLES = ["hoch", "tief", "doppelt", "dampf", "schiffshorn"];

  let locoUid = 0;

  const DEFAULT_LOCO = {
    driver: "fox",
    body: "#c9483a",
    cab: { shape: "round", color: "#2f6f8f" },
    wheels: { shape: "spoke", color: "#f0b429" },
    chimney: { shape: "classic", smoke: "#dfe6ee" },
    lamp: { shape: "round", color: "#ffe066" },
    whistle: "hoch",
    flag: { pattern: "stripes", color: "#f0b429" },
  };

  function locoConfig(config = {}) {
    return {
      ...DEFAULT_LOCO, ...config,
      cab: { ...DEFAULT_LOCO.cab, ...(config.cab || {}) },
      wheels: { ...DEFAULT_LOCO.wheels, ...(config.wheels || {}) },
      chimney: { ...DEFAULT_LOCO.chimney, ...(config.chimney || {}) },
      lamp: { ...DEFAULT_LOCO.lamp, ...(config.lamp || {}) },
      flag: { ...DEFAULT_LOCO.flag, ...(config.flag || {}) },
    };
  }

  // Die Lok fährt nach rechts: Führerhaus hinten links, Kessel und Kamin vorne
  // rechts, Kuhfänger ganz vorne. Jedes Bauteil ist ein eigenes <g> mit
  // data-part, damit die Werkstatt in Etappe 5 einzeln hineinzoomen kann.
  function buildLoco(config = {}) {
    const c = locoConfig(config);
    const body = c.body;
    const bodyDark = shade(body, -0.28);
    const bodyLight = shade(body, 0.22);
    const cabColor = c.cab.color;

    // --- Rahmen ---
    const frame = group({ "data-part": "frame" }, [
      el("rect", { x: 8, y: GROUND - 22, width: 178, height: 12, rx: 3, fill: shade(bodyDark, -0.3) }),
    ]);

    // --- Führerhaus ---
    // Das Fenster ist eine echte Öffnung, keine weisse Fläche: eine Maske
    // schneidet es aus dem Führerhaus, sodass die Landschaft hinter dem Tier
    // durchscheint. Ohne die Maske sässe der Chauffeur auf einem weissen Feld.
    // Das Fenster ist hoch genug für Ohren: der Hase braucht über dem Kopf mehr
    // als das Doppelte des Kopfradius, und ein quadratisches Fenster liesse
    // seine Löffel entweder abgeschnitten oder den Kopf winzig aussehen.
    const windowBox = { x: 18, y: 74, width: 46, height: 44, rx: 5 };
    const uid = locoUid += 1;
    const maskId = `loco-window-${uid}`;
    const clipId = `loco-glass-${uid}`;

    const cabParts = [el("rect", { x: 10, y: 66, width: 62, height: GROUND - 88, rx: 5, fill: cabColor })];
    if (c.cab.shape === "round") {
      cabParts.unshift(el("path", { d: "M4 68 q34 -20 74 0 v8 h-74 z", fill: shade(cabColor, -0.2) }));
    } else if (c.cab.shape === "peak") {
      cabParts.unshift(el("polygon", { points: "41,48 82,70 0,70", fill: shade(cabColor, -0.2) }));
    } else {
      cabParts.unshift(el("rect", { x: 2, y: 58, width: 78, height: 13, rx: 4, fill: shade(cabColor, -0.2) }));
    }

    const defs = el("defs", {}, [
      el("mask", { id: maskId, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: LOCO_W, height: ART_H }, [
        el("rect", { x: 0, y: 0, width: LOCO_W, height: ART_H, fill: "#ffffff" }),
        el("rect", { ...windowBox, fill: "#000000" }),
      ]),
      // Der Chauffeur sitzt hinter dem Fenster, also endet er am Fenster. Die
      // Grösse unten ist schon so gewählt, dass nichts abgeschnitten wird –
      // dieser Beschnitt ist die Zusicherung, dass auch bei einem später
      // dazukommenden Tier kein Ohr über den Rahmen hinausragt.
      el("clipPath", { id: clipId, clipPathUnits: "userSpaceOnUse" }, [
        el("rect", { ...windowBox }),
      ]),
    ]);

    // Das Reise-Schild: eine kleine Tafel unter dem Fenster, ein Stern je
    // fertiger Karte der Reise. Sie gehört zum Zug, nicht zur Lok-Einstellung
    // – buildTrain reicht die Zahl durch, gespeichert wird sie nirgends.
    // Reise 2 macht Stern um Stern zum Goldstern: heller, auf rotem Grund,
    // mit einem weissen Funken – am selben Schild, für alle zu sehen.
    const journeyStars = Math.max(0, Math.min(6, Math.floor(Number(c.journeyStars) || 0)));
    const journeyGold = Math.max(0, Math.min(journeyStars, Math.floor(Number(c.journeyGold) || 0)));
    if (journeyStars > 0) {
      cabParts.push(el("rect", { x: 15, y: 124, width: 52, height: 17, rx: 3, fill: "#f8f1dc", stroke: shade(cabColor, -0.3), "stroke-width": 1.5 }));
      for (let i = 0; i < journeyStars; i += 1) {
        const gold = i < journeyGold;
        const cx = 22 + i * 8;
        if (gold) cabParts.push(el("circle", { cx, cy: 132.5, r: 3.9, fill: "#c9483a" }));
        cabParts.push(el("polygon", { points: starPoints(cx, 132.5, gold ? 3.7 : 3.6, gold ? 1.7 : 1.6), fill: gold ? "#ffe066" : "#f0b429", stroke: "#b8860b", "stroke-width": 0.6 }));
        if (gold) cabParts.push(el("circle", { cx, cy: 132.5, r: 1, fill: "#ffffff" }));
      }
    }
    const cab = group({ "data-part": "cab", mask: `url(#${maskId})` }, cabParts);

    // Ein goldener Funke über dem Kessel, wenn in der Werkstatt etwas Neues
    // wartet. Er sitzt in der Lücke zwischen Wimpel und Kamin, damit er kein
    // Bauteil verdeckt – und er zeigt vom Startbild aus dorthin, wo es steckt.
    const sparkle = c.sparkle
      ? group({ class: "loco-sparkle", "aria-hidden": "true" }, [
        el("circle", { cx: 102, cy: 22, r: 11, fill: GOLD, opacity: "0.3" }),
        el("polygon", { points: starPoints(102, 22, 9, 3.8), fill: GOLD, stroke: "#ffffff", "stroke-width": 1.4 }),
      ])
      : null;

    // --- Chauffeur in der Fensteröffnung ---
    // Zwei Gruppen: die äussere trägt den Beschnitt, die innere stellt das
    // Tier an seinen Platz. An einem Element ginge das nicht – ein Beschnitt in
    // Nutzerkoordinaten wird im System *nach* dem eigenen transform gelesen und
    // läge dann irgendwo unter der Lok statt auf dem Fenster.
    const fit = driverFit(c.driver, windowBox);
    const driver = group({
      "data-part": "driver",
      "data-driver": c.driver,
      "clip-path": `url(#${clipId})`,
    }, [
      group({ transform: `translate(${fit.cx.toFixed(1)},${fit.cy.toFixed(1)})` }, [
        driverHead(c.driver, Number(fit.r.toFixed(2))),
      ]),
    ]);

    // Der Fensterrahmen kommt über den Chauffeur: so sitzt das Tier sichtbar
    // hinter dem Fenster und nicht davor aufgeklebt.
    const windowFrame = group({ "data-part": "window", "aria-hidden": "true" }, [
      el("rect", { ...windowBox, fill: "none", stroke: shade(cabColor, -0.3), "stroke-width": 4 }),
    ]);

    // --- Kessel ---
    const boiler = group({ "data-part": "body" }, [
      el("rect", { x: 68, y: 92, width: 96, height: GROUND - 114, rx: 28, fill: body }),
      el("rect", { x: 76, y: 98, width: 80, height: 10, rx: 5, fill: bodyLight, opacity: "0.55" }),
      el("circle", { cx: 158, cy: 120, r: 25, fill: bodyDark }),
      el("circle", { cx: 158, cy: 120, r: 16, fill: body }),
    ]);

    // Die Pfeife hört man, statt sie zu sehen – trotzdem braucht sie eine
    // eigene Form auf dem Kessel, sonst gäbe es in der Werkstatt nichts
    // anzutippen. Die vier Klänge unterscheiden sich nur im Ton, deshalb zeigt
    // die Form die Anzahl der Rohre.
    const pipes = { hoch: 1, tief: 1, doppelt: 2, dampf: 3, schiffshorn: 0 }[c.whistle] ?? 1;
    const whistleParts = [el("rect", { x: 92, y: 118, width: 24, height: 12, rx: 4, fill: shade(body, -0.5) })];
    if (c.whistle === "schiffshorn") {
      // Kein Rohr, sondern ein Trichter: das Horn eines Schiffs, nach oben
      // hinten geöffnet.
      whistleParts.push(el("path", { d: "M98 122 L94 92 L122 86 L114 122 Z", fill: shade(body, -0.4) }));
      whistleParts.push(el("path", { d: "M93 93 L123 86 L124 92 L94 99 Z", fill: shade(body, -0.55) }));
    }
    for (let i = 0; i < pipes; i += 1) {
      const x = 104 - (pipes - 1) * 6 + i * 12;
      const height = c.whistle === "tief" ? 40 : 30;
      whistleParts.push(el("rect", { x: x - 4, y: 122 - height, width: 9, height, rx: 3, fill: shade(body, -0.4) }));
      whistleParts.push(el("circle", { cx: x, cy: 122 - height, r: 5.5, fill: shade(body, -0.55) }));
    }
    const whistle = group({ "data-part": "whistle" }, whistleParts);

    // --- Kamin ---
    const smoke = c.chimney.smoke;
    // mouth = Mitte und Oberkante der Kaminöffnung. Der Dampf setzt genau dort
    // an; ohne diesen gemeinsamen Punkt schweben die Wolken neben dem Kamin.
    let mouth;
    let chimneyShape;
    if (c.chimney.shape === "funnel") {
      chimneyShape = [el("path", { d: "M124 92 L128 56 L172 56 L176 92 Z", fill: bodyDark }),
                      el("rect", { x: 124, y: 48, width: 52, height: 10, rx: 4, fill: shade(body, -0.45) })];
      mouth = { x: 150, y: 48 };
    } else if (c.chimney.shape === "double") {
      chimneyShape = [el("rect", { x: 122, y: 60, width: 20, height: 34, rx: 3, fill: bodyDark }),
                      el("rect", { x: 150, y: 52, width: 20, height: 42, rx: 3, fill: bodyDark }),
                      el("rect", { x: 118, y: 54, width: 28, height: 9, rx: 3, fill: shade(body, -0.45) }),
                      el("rect", { x: 146, y: 46, width: 28, height: 9, rx: 3, fill: shade(body, -0.45) })];
      mouth = { x: 160, y: 46 };
    } else if (c.chimney.shape === "slim") {
      chimneyShape = [el("rect", { x: 140, y: 40, width: 18, height: 54, rx: 4, fill: bodyDark }),
                      el("rect", { x: 134, y: 34, width: 30, height: 9, rx: 4, fill: shade(body, -0.45) })];
      mouth = { x: 149, y: 34 };
    } else {
      chimneyShape = [el("path", { d: "M134 92 L138 58 L164 58 L168 92 Z", fill: bodyDark }),
                      el("rect", { x: 130, y: 50, width: 42, height: 11, rx: 4, fill: shade(body, -0.45) })];
      mouth = { x: 151, y: 50 };
    }
    const chimney = group({ "data-part": "chimney" }, chimneyShape);

    // Dampf. Die Wolken sind eine eigene Gruppe, damit train-home.js sie
    // animieren oder – bei prefers-reduced-motion – weglassen kann.
    // Alle drei Wolken sitzen auf der Mündung; erst die Animation trägt sie
    // versetzt nach oben weg. Steht die Animation still (prefers-reduced-motion),
    // liegt trotzdem eine Wolke sichtbar auf dem Kamin statt daneben.
    const steam = group({ "data-part": "steam", class: "train-steam", fill: smoke }, [
      el("circle", { cx: mouth.x, cy: mouth.y - 6, r: 11, class: "train-steam-puff train-steam-1" }),
      el("circle", { cx: mouth.x, cy: mouth.y - 6, r: 8, class: "train-steam-puff train-steam-2" }),
      el("circle", { cx: mouth.x, cy: mouth.y - 6, r: 9, class: "train-steam-puff train-steam-3" }),
    ]);

    // --- Lampe ---
    const lampColor = c.lamp.color;
    const lampShape = c.lamp.shape === "square"
      ? el("rect", { x: 166, y: 98, width: 22, height: 22, rx: 4, fill: lampColor, stroke: bodyDark, "stroke-width": 3 })
      : c.lamp.shape === "star"
        ? el("polygon", { points: starPoints(177, 109, 15, 7), fill: lampColor, stroke: bodyDark, "stroke-width": 3, "stroke-linejoin": "round" })
        : el("circle", { cx: 177, cy: 109, r: 12, fill: lampColor, stroke: bodyDark, "stroke-width": 3 });
    const lamp = group({ "data-part": "lamp" }, [
      lampShape,
      el("circle", { cx: 177, cy: 109, r: 4.5, fill: shade(lampColor, 0.55) }),
    ]);

    // --- Kuhfänger ---
    // Der Kuhfänger sitzt ganz vorne unter der Lampe. Er wird nach den Rädern
    // gezeichnet, sonst verschwindet er hinter dem vorderen Rad.
    const plough = group({ "data-part": "plough" }, [
      el("path", { d: `M176 126 L198 ${GROUND - 4} L176 ${GROUND - 4} Z`, fill: shade(cabColor, -0.15) }),
      el("line", { x1: 182, y1: 141, x2: 182, y2: GROUND - 6, stroke: shade(cabColor, 0.35), "stroke-width": 2.5 }),
      el("line", { x1: 189, y1: 155, x2: 189, y2: GROUND - 6, stroke: shade(cabColor, 0.35), "stroke-width": 2.5 }),
    ]);

    // --- Wimpel ---
    const flagColor = c.flag.color;
    const flagBody = [el("line", { x1: 41, y1: 52, x2: 41, y2: 16, stroke: shade(cabColor, -0.35), "stroke-width": 3 })];
    if (c.flag.pattern === "stripes") {
      flagBody.push(el("polygon", { points: "41,18 78,28 41,38", fill: flagColor }));
      flagBody.push(el("polygon", { points: "41,24 62,29.6 41,35", fill: shade(flagColor, -0.35) }));
    } else if (c.flag.pattern === "dots") {
      flagBody.push(el("polygon", { points: "41,18 78,28 41,38", fill: flagColor }));
      flagBody.push(el("circle", { cx: 51, cy: 25.5, r: 2.8, fill: inkOn(flagColor) }));
      flagBody.push(el("circle", { cx: 60, cy: 28.5, r: 2.8, fill: inkOn(flagColor) }));
    } else if (c.flag.pattern === "zigzag") {
      flagBody.push(el("polygon", { points: "41,18 78,28 41,38 52,28", fill: flagColor }));
    } else if (c.flag.pattern === "rainbow") {
      // Fünf Bänder, jedes so breit, wie der Wimpel an dieser Höhe noch ist:
      // die Spitze liegt bei (78,28), die Kante wandert also je Höhe.
      const edge = (y) => 41 + 37 * (1 - Math.abs(y - 28) / 10);
      ["#ff5d5d", "#ffb347", "#ffe66d", "#6ee7a8", "#6ec6ff"].forEach((color, i) => {
        const y0 = 18 + i * 4;
        const y1 = y0 + 4;
        const points = [`41,${y0}`, `${edge(y0).toFixed(1)},${y0}`];
        if (y0 < 28 && y1 > 28) points.push("78,28");
        points.push(`${edge(y1).toFixed(1)},${y1}`, `41,${y1}`);
        flagBody.push(el("polygon", { points: points.join(" "), fill: color }));
      });
    } else if (c.flag.pattern === "stars") {
      flagBody.push(el("polygon", { points: "41,18 78,28 41,38", fill: flagColor }));
      flagBody.push(el("polygon", { points: starPoints(50, 24, 3.4, 1.5), fill: inkOn(flagColor) }));
      flagBody.push(el("polygon", { points: starPoints(50, 33, 3.4, 1.5), fill: inkOn(flagColor) }));
      flagBody.push(el("polygon", { points: starPoints(61, 28.5, 3.4, 1.5), fill: inkOn(flagColor) }));
    } else if (c.flag.pattern === "sun") {
      // Eine Sonne auf dem Wimpel: der Bonus für zwei ganz goldene Karten.
      flagBody.push(el("polygon", { points: "41,18 78,28 41,38", fill: flagColor }));
      const ink = inkOn(flagColor);
      for (let i = 0; i < 8; i += 1) {
        const angle = (Math.PI / 4) * i;
        flagBody.push(el("line", {
          x1: (53 + Math.cos(angle) * 4.6).toFixed(1), y1: (28 + Math.sin(angle) * 4.6).toFixed(1),
          x2: (53 + Math.cos(angle) * 7).toFixed(1), y2: (28 + Math.sin(angle) * 7).toFixed(1),
          stroke: ink, "stroke-width": 1.4, "stroke-linecap": "round",
        }));
      }
      flagBody.push(el("circle", { cx: 53, cy: 28, r: 3.6, fill: ink }));
    } else {
      flagBody.push(el("polygon", { points: "41,18 78,28 41,38", fill: flagColor }));
    }
    const flag = group({ "data-part": "flag" }, flagBody);

    // --- Räder ---
    const wheelColor = c.wheels.color;
    const wheels = group({ "data-part": "wheels" }, [
      wheel(38, 14, wheelColor, c.wheels.shape),
      wheel(106, 23, wheelColor, c.wheels.shape),
      wheel(160, 14, wheelColor, c.wheels.shape),
      el("line", { x1: 38, y1: WHEEL_Y, x2: 160, y2: WHEEL_Y, stroke: shade(wheelColor, -0.4), "stroke-width": 4, "stroke-linecap": "round", opacity: "0.75" }),
    ]);

    // Der Dampf kommt nach dem Kamin: Die Wolken sind bewegt, und was der
    // Browser nach einem bewegten Teil zeichnet und es überlappt, legt er auf
    // eine eigene Ebene der Grafikkarte – vorher war das die halbe Lok. Zu
    // sehen ist kein Unterschied: Die Wolken werden erst über dem Kamin
    // sichtbar.
    return group({ class: "train-loco", "data-loco": "true" },
      [defs, flag, frame, cab, driver, windowFrame, boiler, whistle, chimney, lamp, wheels, plough, steam, sparkle].filter(Boolean));
  }

  // Das Gold des Funkens über dem Kessel.
  const GOLD = "#f0b429";

  // Ein Stern als Punktfolge: für den Funken, die Lampe und die Wimpel.
  function starPoints(cx, cy, outer, inner, n = 5) {
    const points = [];
    for (let i = 0; i < n * 2; i += 1) {
      const r = i % 2 === 0 ? outer : inner;
      const angle = -Math.PI / 2 + (i * Math.PI) / n;
      points.push(`${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`);
    }
    return points.join(" ");
  }

  window.LernappTrainArt = {
    GROUND, LOCO_W,
    el, group, shade,
    buildLoco, locoConfig,
  };
})();
