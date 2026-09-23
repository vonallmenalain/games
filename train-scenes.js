/*
 * train-scenes.js – Die Landschaften, durch die der Zug fährt.
 *
 * Jede Szene hat dieselbe Tiefenstruktur: Wolken, ferne Hügel, Mittelgrund und
 * Vordergrund. Nur der Inhalt wechselt. Weil die Struktur gleich bleibt, liegt
 * die Geometrie der Ebenen im CSS und hier stehen ausschliesslich Farben und
 * Formen.
 *
 * Die Kacheln müssen an der linken und rechten Kante gleich aussehen, sonst
 * springt die Schleife sichtbar. Bei den Hügeln sorgt dafür eine gerade Anzahl
 * Segmente, bei allem anderen genügt Abstand zum Rand.
 */
(() => {
  "use strict";

  const art = window.LernappTrainArt;
  if (!art) return;
  const { el, group, shade } = art;

  const W = 600;
  const H = 200;

  function tile(children) {
    return el("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", "aria-hidden": "true" }, children);
  }

  // Wellenzug mit gerader Anzahl Segmente – nur so passt die Steigung an der
  // Nahtstelle wieder zusammen.
  function hills(top, amplitude, fill) {
    const step = W / 6;
    let d = `M0 ${H} L0 ${top} Q${step / 2} ${top - amplitude} ${step} ${top}`;
    for (let i = 2; i <= 6; i += 1) d += ` T${step * i} ${top}`;
    return el("path", { d: `${d} L${W} ${H} Z`, fill });
  }

  function tree(x, y, scale, trunk, crown) {
    return group({ transform: `translate(${x},${y}) scale(${scale})` }, [
      el("rect", { x: -5, y: -18, width: 10, height: 26, rx: 3, fill: trunk }),
      el("circle", { cx: 0, cy: -34, r: 24, fill: crown }),
      el("circle", { cx: -16, cy: -22, r: 16, fill: crown }),
      el("circle", { cx: 16, cy: -22, r: 16, fill: shade(crown, -0.1) }),
    ]);
  }

  function fir(x, y, scale, trunk, crown) {
    return group({ transform: `translate(${x},${y}) scale(${scale})` }, [
      el("rect", { x: -4, y: -14, width: 8, height: 20, rx: 2, fill: trunk }),
      el("polygon", { points: "0,-70 20,-34 -20,-34", fill: crown }),
      el("polygon", { points: "0,-54 25,-14 -25,-14", fill: shade(crown, -0.12) }),
    ]);
  }

  function palm(x, y, scale, trunk, leaf) {
    const fronds = [0, 1, 2, 3, 4].map((i) => {
      const angle = -160 + i * 40;
      return el("path", {
        d: "M0 0 q34 -14 62 4 q-30 -2 -62 8 z",
        fill: i % 2 ? shade(leaf, -0.12) : leaf,
        transform: `rotate(${angle})`,
      });
    });
    return group({ transform: `translate(${x},${y}) scale(${scale})` }, [
      el("path", { d: "M0 8 q-8 -34 4 -62", fill: "none", stroke: trunk, "stroke-width": 10, "stroke-linecap": "round" }),
      group({ transform: "translate(4,-62)" }, fronds),
    ]);
  }

  function bush(x, y, scale, color) {
    return group({ transform: `translate(${x},${y}) scale(${scale})` }, [
      el("circle", { cx: -12, cy: 0, r: 12, fill: color }),
      el("circle", { cx: 4, cy: -5, r: 15, fill: shade(color, 0.08) }),
      el("circle", { cx: 18, cy: 1, r: 11, fill: shade(color, -0.08) }),
    ]);
  }

  // ---------------------------------------------------------------------------
  // Die Nahebene
  // ---------------------------------------------------------------------------
  // Sie bekommt einen eigenen, flachen Ausschnitt. Die anderen Ebenen sind
  // hohe Bänder und vertragen den 600×200-Ausschnitt; die Nahebene ist ein
  // schmaler Streifen ganz unten am Bild. Mit dem hohen Ausschnitt wurde alles
  // darin waagrecht gestaucht und senkrecht gezogen – daher die zerquetschte
  // Wiese. Ein Ausschnitt im Seitenverhältnis des Streifens behebt das.
  const NW = 600;
  const NH = 64;

  function nearTile(children) {
    return el("svg", { viewBox: `0 0 ${NW} ${NH}`, preserveAspectRatio: "none", "aria-hidden": "true" }, children);
  }

  // Der Boden mit welliger Oberkante. Die Anzahl Segmente ist gerade, damit die
  // Kachel links und rechts gleich hoch anfängt und die Schleife nicht springt.
  function nearGround(top, fill, amplitude = 5) {
    const step = NW / 6;
    let d = `M0 ${NH} L0 ${top} Q${step / 2} ${top - amplitude} ${step} ${top}`;
    for (let i = 2; i <= 6; i += 1) d += ` T${step * i} ${top}`;
    return el("path", { d: `${d} L${NW} ${NH} Z`, fill });
  }

  // Ein Büschel Gras: drei Halme, die aus einem Punkt wachsen. Einzelne Striche
  // in gleichem Abstand sähen aus wie ein Kamm.
  function grassClump(x, base, height, color) {
    return group({ transform: `translate(${x},${base})` }, [
      el("path", { d: `M0 0 q-2 -${height * 0.6} -7 -${height}`, fill: "none", stroke: color, "stroke-width": 3, "stroke-linecap": "round" }),
      el("path", { d: `M0 0 q1 -${height * 0.7} 0 -${height * 1.25}`, fill: "none", stroke: shade(color, 0.12), "stroke-width": 3.2, "stroke-linecap": "round" }),
      el("path", { d: `M0 0 q3 -${height * 0.6} 8 -${height * 0.9}`, fill: "none", stroke: color, "stroke-width": 3, "stroke-linecap": "round" }),
    ]);
  }

  // Eine Blume mit Stiel, fünf Blüten und Mitte – nicht bloss ein Punkt.
  function flower(x, base, height, color) {
    const petals = [0, 1, 2, 3, 4].map((i) => {
      const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
      return el("circle", { cx: (Math.cos(angle) * 4).toFixed(1), cy: (Math.sin(angle) * 4).toFixed(1), r: 3.4, fill: color });
    });
    return group({ transform: `translate(${x},${base})` }, [
      el("path", { d: `M0 0 q1 -${height * 0.6} 0 -${height}`, fill: "none", stroke: "#4f8a3c", "stroke-width": 2.2, "stroke-linecap": "round" }),
      group({ transform: `translate(0,${-height})` }, [...petals, el("circle", { cx: 0, cy: 0, r: 2.4, fill: "#ffd166" })]),
    ]);
  }

  function grassTile(base, blade, accent, flowers) {
    const parts = [
      nearGround(20, shade(base, -0.08)),
      nearGround(26, base),
    ];
    // Halme in unregelmässigem Abstand: gleichmässig verteilt sähe es nach
    // Zaun aus, nicht nach Wiese.
    [8, 26, 41, 63, 84, 99, 121, 140, 158, 176, 197, 214, 232, 251, 273, 290,
     308, 327, 349, 366, 384, 403, 425, 442, 460, 479, 501, 518, 536, 555, 573, 590]
      .forEach((x, i) => {
        parts.push(grassClump(x, 30 + (i % 3) * 3, 11 + (i % 4) * 4, i % 5 === 0 ? shade(blade, 0.18) : blade));
      });
    parts.push(bush(96, 30, 0.5, accent));
    parts.push(bush(352, 28, 0.58, shade(accent, 0.08)));
    flowers.forEach((color, i) => {
      parts.push(flower(52 + i * 118, 32 + (i % 2) * 3, 13 + (i % 3) * 3, color));
    });
    return nearTile(parts);
  }

  function cloudTile(color, opacity = 0.9) {
    return tile([
      el("ellipse", { cx: 90, cy: 60, rx: 46, ry: 24, fill: color, opacity }),
      el("ellipse", { cx: 128, cy: 68, rx: 34, ry: 18, fill: color, opacity }),
      el("ellipse", { cx: 330, cy: 40, rx: 38, ry: 20, fill: color, opacity: opacity * 0.82 }),
      el("ellipse", { cx: 366, cy: 46, rx: 28, ry: 15, fill: color, opacity: opacity * 0.82 }),
      el("ellipse", { cx: 480, cy: 88, rx: 30, ry: 15, fill: color, opacity: opacity * 0.66 }),
    ]);
  }

  // ---------------------------------------------------------------------------
  // Vorschaubilder
  // ---------------------------------------------------------------------------
  // Für die Szenenwahl. Ein Hügel mit Sonne sähe bei allen sechs gleich aus –
  // erst die typischen Formen machen den Unterschied erkennbar, und darauf
  // kommt es an, wenn kein Wort danebenstehen darf.
  const TW = 120;
  const TH = 76;

  function thumbHill(top, fill) {
    return el("path", { d: `M0 ${TH} L0 ${top} Q20 ${top - 12} 40 ${top} T80 ${top} T120 ${top} L120 ${TH} Z`, fill });
  }

  function thumbTree(x, y, scale, trunk, crown) {
    return group({ transform: `translate(${x},${y}) scale(${scale})` }, [
      el("rect", { x: -1.6, y: -6, width: 3.2, height: 8, fill: trunk }),
      el("circle", { cx: 0, cy: -11, r: 7.5, fill: crown }),
    ]);
  }

  function thumbFir(x, y, scale, trunk, crown) {
    return group({ transform: `translate(${x},${y}) scale(${scale})` }, [
      el("rect", { x: -1.4, y: -5, width: 2.8, height: 6, fill: trunk }),
      el("polygon", { points: "0,-22 7,-9 -7,-9", fill: crown }),
      el("polygon", { points: "0,-16 9,-4 -9,-4", fill: shade(crown, -0.12) }),
    ]);
  }

  function thumbPalm(x, y, scale, trunk, leaf) {
    return group({ transform: `translate(${x},${y}) scale(${scale})` }, [
      el("path", { d: "M0 2 q-3 -11 2 -19", fill: "none", stroke: trunk, "stroke-width": 3, "stroke-linecap": "round" }),
      el("path", { d: "M2 -18 q9 -6 15 0 q-8 -1 -15 3 z", fill: leaf }),
      el("path", { d: "M2 -18 q-9 -6 -15 0 q8 -1 15 3 z", fill: shade(leaf, -0.12) }),
      el("path", { d: "M2 -18 q2 -9 -3 -13 q-1 8 0 13 z", fill: shade(leaf, 0.1) }),
    ]);
  }

  // ---------------------------------------------------------------------------
  // Die Szenen
  // ---------------------------------------------------------------------------
  const SCENES = [
    {
      id: "wiese",
      thumb: () => [
        thumbHill(46, "#9fc9a6"), thumbHill(54, "#8fc45e"),
        thumbTree(28, 62, 1, "#7b5c3a", "#4f9350"),
        thumbTree(90, 64, 0.8, "#7b5c3a", "#57a058"),
      ],
      label: "Wiese und Hügel",
      free: true,
      sky: ["#a8ddf0", "#dff1f7"],
      ground: "#8fc45e",
      groundDark: "#6da645",
      light: { color: "#ffd166", glow: 0.35 },
      layers: {
        clouds: () => cloudTile("#ffffff"),
        far: () => tile([hills(96, 54, "#9fc9a6"), hills(132, 34, "#86b98f")]),
        mid: () => tile([
          hills(150, 22, "#6faa6b"),
          tree(70, 176, 1, "#7b5c3a", "#4f9350"),
          tree(210, 182, 0.8, "#7b5c3a", "#57a058"),
          tree(360, 174, 1.1, "#6d5133", "#478a48"),
          tree(500, 180, 0.85, "#7b5c3a", "#4f9350"),
        ]),
        near: () => grassTile("#7ab455", "#68a047", "#5d9a4e", ["#ffd166", "#ff8fa3", "#ffffff", "#ffd166", "#c9a7f5"]),
      },
    },
    {
      id: "wald",
      thumb: () => [
        thumbHill(46, "#7fae87"), thumbHill(56, "#6f9e50"),
        thumbFir(22, 66, 1, "#5b4229", "#2f6b3b"),
        thumbFir(46, 70, 0.8, "#5b4229", "#377643"),
        thumbFir(78, 66, 1.05, "#4d3722", "#2a6236"),
        thumbFir(102, 70, 0.85, "#5b4229", "#347040"),
      ],
      label: "Wald",
      free: true,
      sky: ["#bfe3ea", "#e8f4ef"],
      ground: "#6f9e50",
      groundDark: "#537c3c",
      light: { color: "#fff0b8", glow: 0.28 },
      layers: {
        clouds: () => cloudTile("#f4fbf7", 0.7),
        far: () => tile([hills(104, 44, "#7fae87"), hills(140, 28, "#68986f")]),
        mid: () => tile([
          hills(156, 18, "#4e8250"),
          fir(50, 184, 1, "#5b4229", "#2f6b3b"),
          fir(130, 190, 0.78, "#5b4229", "#377643"),
          fir(250, 182, 1.15, "#4d3722", "#2a6236"),
          fir(360, 190, 0.85, "#5b4229", "#347040"),
          fir(470, 184, 1.05, "#4d3722", "#2f6b3b"),
          fir(552, 192, 0.72, "#5b4229", "#377643"),
        ]),
        near: () => grassTile("#5f9445", "#4e7f38", "#3f6f31", ["#ffffff", "#ffd166", "#e8b4ff", "#ffffff", "#ffd166"]),
      },
    },
    {
      id: "dschungel",
      thumb: () => [
        thumbHill(44, "#6fbd8f"), thumbHill(56, "#3f8f57"),
        thumbPalm(30, 68, 1.1, "#7b5c3a", "#2f7d4b"),
        thumbPalm(84, 70, 0.95, "#6d5133", "#368a54"),
        el("path", { d: "M60 0 q4 14 -2 24", fill: "none", stroke: "#3f8f57", "stroke-width": 2.5, "stroke-linecap": "round" }),
      ],
      label: "Dschungel",
      sky: ["#8fd6c2", "#dff4e6"],
      ground: "#3f8f57",
      groundDark: "#2e6f43",
      light: { color: "#ffe8a3", glow: 0.3 },
      layers: {
        clouds: () => tile([
          el("ellipse", { cx: 120, cy: 54, rx: 52, ry: 22, fill: "#ffffff", opacity: "0.55" }),
          el("ellipse", { cx: 380, cy: 44, rx: 44, ry: 18, fill: "#ffffff", opacity: "0.45" }),
          // Lianen, die von oben hereinhängen.
          el("path", { d: "M180 0 q10 40 -4 76", fill: "none", stroke: "#3f8f57", "stroke-width": 5, "stroke-linecap": "round", opacity: "0.7" }),
          el("path", { d: "M430 0 q-12 46 6 84", fill: "none", stroke: "#3f8f57", "stroke-width": 5, "stroke-linecap": "round", opacity: "0.6" }),
        ]),
        far: () => tile([hills(92, 58, "#6fbd8f"), hills(128, 36, "#55a475")]),
        mid: () => tile([
          hills(148, 24, "#3f8f57"),
          palm(80, 186, 1, "#7b5c3a", "#2f7d4b"),
          palm(230, 192, 0.82, "#6d5133", "#368a54"),
          palm(390, 184, 1.1, "#7b5c3a", "#2a7344"),
          palm(520, 190, 0.9, "#6d5133", "#368a54"),
        ]),
        // Breite Blätter statt Halme – der Dschungelboden ist bedeckt, nicht
        // bewachsen.
        near: () => {
          const parts = [nearGround(22, "#357c4a"), nearGround(28, "#3f8f57")];
          for (let x = 4; x < NW; x += 37) {
            const lift = (x % 3) * 3;
            parts.push(el("path", {
              d: `M${x} ${34 + lift} q14 -20 30 -4 q-16 12 -30 4 z`,
              fill: x % 74 < 37 ? "#48a061" : "#3d9256",
            }));
          }
          parts.push(flower(128, 30, 15, "#ff8fa3"));
          parts.push(flower(396, 33, 12, "#ffd166"));
          return nearTile(parts);
        },
      },
    },
    {
      id: "berge",
      thumb: () => [
        el("polygon", { points: "0,76 22,30 44,76", fill: "#8fa6bd" }),
        el("polygon", { points: "30,76 60,18 90,76", fill: "#7d95ad" }),
        el("polygon", { points: "76,76 100,34 124,76", fill: "#8fa6bd" }),
        el("polygon", { points: "50,32 60,18 70,32 64,29 60,34 56,29", fill: "#f4f8fb" }),
        el("rect", { x: 0, y: 62, width: 120, height: 14, fill: "#8e9aa8" }),
      ],
      label: "Berge und Tunnel",
      sky: ["#9ec9e8", "#e6f1f8"],
      ground: "#8e9aa8",
      groundDark: "#6f7b89",
      light: { color: "#fff4d6", glow: 0.32 },
      layers: {
        clouds: () => cloudTile("#ffffff", 0.85),
        far: () => tile([
          el("polygon", { points: "0,200 90,64 180,200", fill: "#8fa6bd" }),
          el("polygon", { points: "60,200 190,40 320,200", fill: "#7d95ad" }),
          el("polygon", { points: "260,200 380,70 500,200", fill: "#8fa6bd" }),
          el("polygon", { points: "430,200 545,46 660,200", fill: "#7d95ad" }),
          el("polygon", { points: "160,90 190,40 220,90 205,84 190,94 175,84", fill: "#f4f8fb" }),
          el("polygon", { points: "518,92 545,46 572,92 559,86 545,96 531,86", fill: "#f4f8fb" }),
        ]),
        mid: () => tile([
          hills(150, 20, "#6f8496"),
          // Ein Tunnelmund im Mittelgrund: das Ziel jeder Bergstrecke.
          el("path", { d: "M300 200 L300 150 a34 34 0 0 1 68 0 L368 200 Z", fill: "#5a6b7a" }),
          el("path", { d: "M310 200 L310 154 a24 24 0 0 1 48 0 L358 200 Z", fill: "#2b3440" }),
          el("rect", { x: 292, y: 140, width: 84, height: 12, rx: 4, fill: "#7d8d9c" }),
        ]),
        // Geröll: flache Steine in Grössen durcheinander, dazwischen ein paar
        // zähe Grasbüschel. Gleich grosse Kiesel sähen aus wie Pflaster.
        near: () => {
          const parts = [nearGround(22, "#7f8b99", 3), nearGround(28, "#8e9aa8", 3)];
          for (let x = 6; x < NW; x += 21) {
            const size = 5 + (x % 4) * 2.2;
            parts.push(el("ellipse", {
              cx: x, cy: 36 + (x % 5) * 4, rx: size, ry: size * 0.6,
              fill: x % 3 === 0 ? "#9fabb8" : "#77828f",
            }));
          }
          [64, 214, 366, 512].forEach((x, i) => parts.push(grassClump(x, 31 + (i % 2) * 3, 9 + (i % 2) * 3, "#5f7a5c")));
          parts.push(bush(152, 30, 0.46, "#5f7a5c"));
          parts.push(bush(430, 29, 0.5, "#54704f"));
          return nearTile(parts);
        },
      },
    },
    {
      id: "see",
      thumb: () => [
        thumbHill(40, "#8fb9c4"),
        el("rect", { x: 0, y: 46, width: 120, height: 20, fill: "#57b6d8" }),
        el("path", { d: "M0 52 q10 -3 20 0 t20 0 t20 0 t20 0 t20 0 t20 0", fill: "none", stroke: "#8fd8ee", "stroke-width": 2 }),
        group({ transform: "translate(46,46)" }, [
          el("polygon", { points: "0,0 0,-15 10,0", fill: "#ffffff" }),
          el("path", { d: "M-5 0 h17 l-3 4 h-11 z", fill: "#e2694f" }),
        ]),
        el("rect", { x: 0, y: 62, width: 120, height: 14, fill: "#e8d9a8" }),
      ],
      label: "See und Küste",
      sky: ["#a4dcf2", "#e4f4fb"],
      ground: "#e8d9a8",
      groundDark: "#cbb886",
      light: { color: "#ffd98a", glow: 0.34 },
      layers: {
        clouds: () => cloudTile("#ffffff", 0.8),
        far: () => tile([
          hills(104, 40, "#8fb9c4"),
          el("rect", { x: 0, y: 128, width: W, height: 72, fill: "#57b6d8" }),
          el("path", { d: "M0 140 q30 -8 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0", fill: "none", stroke: "#8fd8ee", "stroke-width": 4 }),
          // Zwei Segel: der See braucht etwas, das sich bewegt.
          group({ transform: "translate(180,128)" }, [
            el("polygon", { points: "0,0 0,-38 24,0", fill: "#ffffff" }),
            el("path", { d: "M-12 0 h40 l-6 8 h-28 z", fill: "#e2694f" }),
          ]),
          group({ transform: "translate(440,132) scale(0.8)" }, [
            el("polygon", { points: "0,0 0,-38 24,0", fill: "#f6f9fb" }),
            el("path", { d: "M-12 0 h40 l-6 8 h-28 z", fill: "#4a8fb0" }),
          ]),
        ]),
        mid: () => tile([
          el("path", { d: "M0 200 L0 158 q60 -14 120 -2 t120 4 t120 -6 t120 2 t120 6 L600 200 Z", fill: "#e8d9a8" }),
          el("path", { d: "M60 168 q6 -22 2 -34 M66 168 q10 -20 18 -30 M54 168 q-6 -18 -12 -26", fill: "none", stroke: "#8aa85f", "stroke-width": 3.5, "stroke-linecap": "round" }),
          el("path", { d: "M470 170 q6 -24 2 -36 M478 170 q12 -20 20 -28", fill: "none", stroke: "#8aa85f", "stroke-width": 3.5, "stroke-linecap": "round" }),
        ]),
        // Sand mit Muscheln, Kieseln und ein paar Halmen Strandhafer.
        near: () => {
          const parts = [nearGround(22, "#dccb96", 4), nearGround(28, "#e8d9a8", 4)];
          for (let x = 16; x < NW; x += 63) {
            parts.push(group({ transform: `translate(${x},${40 + (x % 3) * 3})` }, [
              el("path", { d: "M0 0 a9 9 0 0 1 -9 -9 h18 a9 9 0 0 1 -9 9 z", fill: x % 126 < 63 ? "#f6ede0" : "#f2dfc4" }),
              el("path", { d: "M0 0 v-8 M-4 -1 l-2 -7 M4 -1 l2 -7", fill: "none", stroke: "#d8c8a4", "stroke-width": 1.2 }),
            ]));
          }
          [40, 168, 300, 448, 566].forEach((x, i) => {
            parts.push(el("ellipse", { cx: x, cy: 44 + (i % 2) * 4, rx: 6, ry: 3.4, fill: "#cbb98c" }));
          });
          [92, 246, 392, 528].forEach((x, i) => parts.push(grassClump(x, 30 + (i % 2) * 3, 13 + (i % 3) * 4, "#a7bd72")));
          return nearTile(parts);
        },
      },
    },
    {
      id: "nacht",
      thumb: () => [
        el("circle", { cx: 30, cy: 16, r: 1.6, fill: "#ffffff" }),
        el("circle", { cx: 52, cy: 28, r: 1.2, fill: "#ffffff", opacity: "0.8" }),
        el("circle", { cx: 70, cy: 12, r: 1.8, fill: "#ffffff" }),
        el("circle", { cx: 14, cy: 32, r: 1.2, fill: "#ffffff", opacity: "0.7" }),
        el("circle", { cx: 104, cy: 30, r: 1.4, fill: "#ffffff", opacity: "0.8" }),
        thumbHill(46, "#31456a"), thumbHill(56, "#2c3f5c"),
        thumbFir(26, 66, 1, "#16203a", "#1b2c47"),
        thumbFir(88, 68, 0.9, "#16203a", "#20334f"),
        el("circle", { cx: 66, cy: 62, r: 2, fill: "#ffe98a" }),
      ],
      label: "Nacht und Sterne",
      sky: ["#1b2a52", "#3c4f80"],
      // Ein dunkler Himmel: Hier steht die Schrift der Bühne hell statt dunkel
      // (game-shell.js, data-himmel).
      dunkel: true,
      ground: "#2c3f5c",
      groundDark: "#1d2c44",
      light: { color: "#f4f0d8", glow: 0.4 },
      layers: {
        clouds: () => {
          const parts = [];
          for (let i = 0; i < 26; i += 1) {
            const x = (i * 97) % W;
            const y = 12 + ((i * 53) % 110);
            const r = 1.6 + (i % 3);
            parts.push(el("circle", { cx: x, cy: y, r, fill: "#ffffff", opacity: String(0.5 + (i % 4) * 0.12) }));
          }
          parts.push(el("ellipse", { cx: 320, cy: 70, rx: 40, ry: 16, fill: "#5a6f9e", opacity: "0.45" }));
          return tile(parts);
        },
        far: () => tile([hills(96, 52, "#31456a"), hills(132, 32, "#293a5c")]),
        mid: () => tile([
          hills(150, 20, "#22314e"),
          fir(70, 184, 1, "#16203a", "#1b2c47"),
          fir(220, 190, 0.8, "#16203a", "#20334f"),
          fir(380, 182, 1.1, "#131c33", "#1b2c47"),
          fir(510, 190, 0.9, "#16203a", "#20334f"),
        ]),
        // Dunkles Gras, und statt Blumen leuchten Glühwürmchen darüber.
        near: () => {
          const parts = [nearGround(22, "#25334c"), nearGround(28, "#2c3f5c")];
          [10, 32, 58, 79, 104, 128, 151, 177, 203, 228, 254, 279, 305, 330, 356,
           381, 407, 432, 458, 483, 509, 534, 560, 585]
            .forEach((x, i) => parts.push(grassClump(x, 31 + (i % 3) * 3, 10 + (i % 4) * 3, i % 4 === 0 ? "#3d5578" : "#334764")));
          [80, 210, 340, 470, 560].forEach((x, i) => {
            parts.push(el("circle", { cx: x, cy: 16 - (i % 3) * 5, r: 6, fill: "#ffe98a", opacity: "0.18" }));
            parts.push(el("circle", { cx: x, cy: 16 - (i % 3) * 5, r: 2.6, fill: "#ffe98a", opacity: "0.9" }));
          });
          return nearTile(parts);
        },
      },
    },
    // Die Savanne. In der App ist sie eine Belohnung und steht deshalb hinter
    // den sechs Landschaften, die der Zug freigibt.
    {
      id: "savanne",
      reward: "scene-savanne",
      thumb: () => [
        thumbHill(48, "#e0c46a"), thumbHill(58, "#d1a94a"),
        group({ transform: "translate(30,66)" }, [
          el("rect", { x: -1.5, y: -14, width: 3, height: 16, fill: "#6d4b2a" }),
          el("path", { d: "M-14 -14 q14 -12 28 0 q-14 3 -28 0 z", fill: "#4f8a3c" }),
        ]),
        group({ transform: "translate(86,68)" }, [
          el("rect", { x: -1.2, y: -11, width: 2.4, height: 13, fill: "#6d4b2a" }),
          el("path", { d: "M-11 -11 q11 -9 22 0 q-11 2.5 -22 0 z", fill: "#5a9646" }),
        ]),
        el("rect", { x: 0, y: 66, width: 120, height: 10, fill: "#c9a13c" }),
      ],
      label: "Savanne",
      sky: ["#ffd28a", "#ffefc9"],
      ground: "#d9b44a",
      groundDark: "#b8913a",
      light: { color: "#ff9f1c", glow: 0.38 },
      layers: {
        clouds: () => tile([
          el("ellipse", { cx: 150, cy: 70, rx: 50, ry: 16, fill: "#ffffff", opacity: "0.5" }),
          el("ellipse", { cx: 420, cy: 50, rx: 40, ry: 13, fill: "#ffffff", opacity: "0.4" }),
          // Ein Vogelschwarm in der Ferne: drei Bögen, sonst nichts.
          el("path", { d: "M300 90 q5 -6 10 0 M312 86 q5 -6 10 0 M290 98 q5 -6 10 0", fill: "none", stroke: "#8a6b3c", "stroke-width": 1.6, "stroke-linecap": "round", opacity: "0.7" }),
        ]),
        far: () => tile([
          hills(110, 30, "#e0c46a"),
          hills(140, 22, "#d1a94a"),
          // Giraffen am Horizont: lange Hälse, sonst nichts.
          group({ transform: "translate(150,138)", fill: "#c98a3f" }, [
            el("rect", { x: -12, y: -14, width: 24, height: 12, rx: 5 }),
            el("rect", { x: 6, y: -40, width: 5, height: 30, rx: 2 }),
            el("rect", { x: 3, y: -46, width: 11, height: 8, rx: 3 }),
            el("rect", { x: -10, y: -3, width: 4, height: 8 }), el("rect", { x: 6, y: -3, width: 4, height: 8 }),
          ]),
          group({ transform: "translate(470,140) scale(0.8)", fill: "#b8742f" }, [
            el("rect", { x: -12, y: -14, width: 24, height: 12, rx: 5 }),
            el("rect", { x: -11, y: -40, width: 5, height: 30, rx: 2 }),
            el("rect", { x: -14, y: -46, width: 11, height: 8, rx: 3 }),
            el("rect", { x: -10, y: -3, width: 4, height: 8 }), el("rect", { x: 6, y: -3, width: 4, height: 8 }),
          ]),
        ]),
        mid: () => tile([
          hills(154, 16, "#c9a13c"),
          ...[70, 260, 430, 560].map((x, i) => group({ transform: `translate(${x},${186 - (i % 2) * 6}) scale(${0.9 + (i % 3) * 0.15})` }, [
            el("rect", { x: -4, y: -34, width: 8, height: 40, rx: 3, fill: "#6d4b2a" }),
            el("path", { d: "M-40 -34 q40 -34 80 0 q-40 8 -80 0 z", fill: i % 2 ? "#5a9646" : "#4f8a3c" }),
          ])),
        ]),
        near: () => {
          const parts = [nearGround(22, "#c9a13c", 4), nearGround(28, "#d9b44a", 4)];
          [10, 34, 58, 80, 104, 128, 152, 176, 200, 224, 248, 272, 296, 320, 344, 368, 392, 416, 440, 464, 488, 512, 536, 560, 584]
            .forEach((x, i) => parts.push(grassClump(x, 31 + (i % 3) * 3, 12 + (i % 4) * 4, i % 4 === 0 ? "#e0c46a" : "#b8913a")));
          [140, 330, 500].forEach((x, i) => parts.push(el("ellipse", { cx: x, cy: 44 + (i % 2) * 3, rx: 9, ry: 4.5, fill: "#a8896a" })));
          return nearTile(parts);
        },
      },
    },
    // Der Weltraum: Sterne statt Wolken, die Erde am Horizont, graue
    // Kraterhügel und Mondstaub statt Gras.
    {
      id: "weltraum",
      reward: "scene-weltraum",
      thumb: () => [
        ...[[14, 10], [40, 22], [70, 8], [98, 26], [24, 40], [86, 44]].map(([x, y], i) => el("circle", { cx: x, cy: y, r: i % 2 ? 1.2 : 1.8, fill: "#ffffff", opacity: "0.9" })),
        el("circle", { cx: 92, cy: 30, r: 11, fill: "#3d7be0" }),
        el("path", { d: "M84 26 q5 -4 9 0 q-2 5 -9 0 z M92 34 q6 -3 8 2 q-5 3 -8 -2 z", fill: "#5cb85c" }),
        thumbHill(52, "#5b6480"), thumbHill(60, "#8f96a8"),
        el("ellipse", { cx: 40, cy: 68, rx: 9, ry: 3, fill: "#7d8598" }),
        el("rect", { x: 0, y: 70, width: 120, height: 6, fill: "#9aa2b4" }),
      ],
      label: "Weltraum",
      sky: ["#0b1030", "#1c2752"],
      dunkel: true,
      ground: "#9aa2b4",
      groundDark: "#7d8598",
      light: { color: "#fff3b0", glow: 0.25 },
      layers: {
        clouds: () => tile([
          ...Array.from({ length: 26 }, (_, i) => el("circle", { cx: (i * 233) % W, cy: 8 + ((i * 71) % 110), r: i % 3 === 0 ? 2 : 1.3, fill: "#ffffff", opacity: String(0.55 + (i % 4) * 0.11) })),
          el("path", { d: "M470 40 l-40 12", stroke: "#ffffff", "stroke-width": 2, "stroke-linecap": "round", opacity: "0.5" }),
          el("circle", { cx: 472, cy: 39, r: 3, fill: "#ffffff" }),
        ]),
        far: () => tile([
          el("circle", { cx: 130, cy: 96, r: 40, fill: "#3d7be0" }),
          el("path", { d: "M104 82 q16 -12 30 -2 q-8 14 -30 2 z M136 104 q18 -8 26 6 q-14 10 -26 -6 z M110 116 q10 -6 18 2 q-8 8 -18 -2 z", fill: "#5cb85c" }),
          el("path", { d: "M100 70 a40 40 0 0 1 20 -12", fill: "none", stroke: "#ffffff", "stroke-width": 5, "stroke-linecap": "round", opacity: "0.55" }),
          hills(118, 24, "#5b6480"),
          hills(142, 16, "#4a536d"),
        ]),
        mid: () => tile([
          hills(154, 12, "#7d8598"),
          ...[60, 200, 330, 470, 560].map((x, i) => group({}, [
            el("ellipse", { cx: x, cy: 176 + (i % 2) * 6, rx: 22 + (i % 3) * 6, ry: 6, fill: "#6a7188" }),
            el("ellipse", { cx: x, cy: 174 + (i % 2) * 6, rx: 18 + (i % 3) * 5, ry: 4, fill: "#8f96a8" }),
          ])),
        ]),
        near: () => {
          const parts = [nearGround(22, "#7d8598", 3), nearGround(28, "#9aa2b4", 3)];
          [30, 110, 190, 270, 350, 430, 510, 580].forEach((x, i) => parts.push(el("ellipse", { cx: x, cy: 44 + (i % 2) * 4, rx: 7 + (i % 3) * 2, ry: 4, fill: i % 2 ? "#6a7188" : "#8f96a8" })));
          return nearTile(parts);
        },
      },
    },
  ];

  const BY_ID = Object.fromEntries(SCENES.map((scene) => [scene.id, scene]));
  // Die Landschaften, die der Zug freigibt – ohne die Belohnungen der Reise.
  const REGULAR = SCENES.filter((scene) => !scene.reward);

  // ---------------------------------------------------------------------------
  // Die Landschaft aufbauen
  // ---------------------------------------------------------------------------
  // Steht hier und nicht im Startbild, weil die Spielseiten dieselbe Landschaft
  // zeigen: das Kind soll beim Wechsel ins Spiel nicht die Welt wechseln. Zwei
  // Kopien derselben Ebenen gingen beim nächsten Umbau auseinander.
  //
  // Wie schnell eine Ebene zieht, hängt an ihrer Tiefe: Wolken brauchen zwei
  // ein halb Minuten für einen Durchlauf, das Gras keine halbe.
  const LAYER_SPEED = { clouds: 150, far: 96, mid: 54, near: 26 };
  const LAYER_NAMES = ["clouds", "far", "mid", "near"];

  function buildScene(scene) {
    const wrap = document.createElement("div");
    wrap.className = "scene";
    wrap.dataset.scene = scene.id;
    wrap.style.setProperty("--sky-top", scene.sky[0]);
    wrap.style.setProperty("--sky-bottom", scene.sky[1]);
    wrap.style.setProperty("--ground", scene.ground);
    wrap.style.setProperty("--ground-dark", scene.groundDark);

    const sun = document.createElement("div");
    sun.className = "scene-sun";
    sun.setAttribute("aria-hidden", "true");
    sun.append(el("svg", { viewBox: "0 0 100 100" }, [
      el("circle", { cx: 50, cy: 50, r: 42, fill: scene.light.color, opacity: String(scene.light.glow) }),
      el("circle", { cx: 50, cy: 50, r: 30, fill: scene.light.color }),
    ]));
    wrap.append(sun);

    LAYER_NAMES.forEach((name) => {
      const bandEl = document.createElement("div");
      bandEl.className = `scene-layer scene-layer-${name}${name === "near" ? " is-front" : ""}`;
      bandEl.style.setProperty("--speed", `${LAYER_SPEED[name]}s`);
      const strip = document.createElement("div");
      strip.className = "scene-strip";
      strip.append(scene.layers[name](), scene.layers[name]());
      bandEl.append(strip);
      wrap.append(bandEl);
    });

    // Vögel gibt es nur, wo sie hingehören: nicht in der Nacht, nicht im All.
    if (scene.id !== "nacht" && scene.id !== "weltraum") {
      const birds = document.createElement("div");
      birds.className = "scene-birds";
      birds.setAttribute("aria-hidden", "true");
      [1, 2, 3].forEach((i) => {
        const bird = document.createElement("div");
        bird.className = `scene-bird scene-bird-${i}`;
        bird.append(el("svg", { viewBox: "0 0 40 20" }, [
          el("path", { d: "M2 12 q8 -9 16 0 q8 -9 20 -2", fill: "none", stroke: scene.id === "berge" ? "#4a5b6b" : "#5a6b7a", "stroke-width": 2.4, "stroke-linecap": "round" }),
        ]));
        birds.append(bird);
      });
      wrap.append(birds);
    }

    return wrap;
  }

  // Die Landschaft, die das Kind zuletzt gewählt hat. Ob sie nach dem Stand
  // dieses Geräts gerade frei wäre, wird hier absichtlich nicht geprüft: die
  // Sperre gehört in die Auswahl auf dem Startbild, nicht vor das Bild. Gleich
  // nach dem Laden ist der Fortschritt aus der Cloud oft noch unterwegs, und
  // eine Landschaft, die deshalb als gesperrt galt, liess erst die Wiese
  // erscheinen und sprang dann um – auf dem Startbild wie im Spiel. Und nach
  // einem Zurücksetzen des Fortschritts sollen Lok und Landschaft bleiben.
  function savedScene() {
    let saved = null;
    try { saved = localStorage.getItem("lernapp.train.scene"); } catch { saved = null; }
    return BY_ID[saved] || SCENES[0];
  }

  // In der App lassen sich Landschaften freispielen – eine je fertig gebautem
  // Wagen, und eine bekommt, wer eine Reisekarte vollendet. Beides gibt es
  // hier nicht: Hinter jedem Spiel steht dieselbe Landschaft, und welche das
  // ist, steht auf dem Gerät (savedScene) – bei einem Besucher also die
  // erste.
  window.LernappScenes = {
    SCENES, BY_ID, buildScene, savedScene, LAYER_SPEED,
    tile, nearTile, hills, nearGround, grassClump, flower, tree, fir, palm, bush, grassTile, cloudTile,
    W, H, NW, NH, TW, TH,
  };
})();
