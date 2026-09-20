/*
 * strand-art.js – Die Schätze am Strand.
 *
 * Achtunddreissig Gegenstände, jeder in einem Kasten von 64 × 64. Sie müssen
 * sich zu zwanzigst nebeneinander noch auseinanderhalten lassen, deshalb trennt
 * sie beides: die Silhouette und die Farbe. Zwei runde Dinge in ähnlichem Blau
 * wären für ein Kind, das sich zwölf Sachen gemerkt hat, dasselbe Ding.
 *
 * Gezeichnet statt Emoji: achtunddreissig Emoji sehen auf jedem Gerät anders
 * aus, und einige sind auf kleinen Bildschirmen kaum zu unterscheiden.
 */
(() => {
  "use strict";

  const art = window.LernappTrainArt;
  if (!art) return;
  const { el, group, shade } = art;

  const INK = "#22333b";

  // Kurzschreibweisen. Jede Figur ist eine Liste von Formen; die Kontur setzt
  // die Gruppe, damit sie überall gleich dick ist.
  const p = (d, fill, extra = {}) => el("path", { d, fill, ...extra });
  const c = (cx, cy, r, fill, extra = {}) => el("circle", { cx, cy, r, fill, ...extra });
  const e = (cx, cy, rx, ry, fill, extra = {}) => el("ellipse", { cx, cy, rx, ry, fill, ...extra });
  const r = (x, y, w, h, fill, rx = 0, extra = {}) => el("rect", { x, y, width: w, height: h, rx, fill, ...extra });
  // Feine Striche ohne eigene Kontur: Augen, Rillen, Nähte.
  const line = (d, stroke = INK, width = 1.6) =>
    el("path", { d, fill: "none", stroke, "stroke-width": width, "stroke-linecap": "round" });
  const eye = (cx, cy, rr = 2.1) => c(cx, cy, rr, INK, { stroke: "none" });

  // ---------------------------------------------------------------------------
  // Die Schätze
  // ---------------------------------------------------------------------------
  const TREASURES = [
    {
      id: "krebs", name: "Krebs", color: "#e4572e",
      draw: (col) => [
        line("M17 38 l-9 4 M17 43 l-9 8 M19 47 l-6 9", col, 3.4),
        line("M47 38 l9 4 M47 43 l9 8 M45 47 l6 9", col, 3.4),
        line("M20 34 l-7 -6 M44 34 l7 -6", col, 3.4),
        c(11, 25, 7, col), c(53, 25, 7, col),
        line("M6 22 l7 3 -7 3", INK, 1.6),
        line("M58 22 l-7 3 7 3", INK, 1.6),
        e(32, 40, 16, 11, col),
        line("M26 31 v-5 M38 31 v-5", col, 2.4),
        eye(26, 24, 2.6), eye(38, 24, 2.6),
        line("M26 44 q6 4 12 0"),
      ],
    },
    {
      id: "burg", name: "Sandburg", color: "#e0ac4a",
      draw: (col) => [
        p("M10 52 v-20 h8 v-8 h6 v8 h8 v-12 h4 v12 h8 v-8 h6 v8 h8 v20 z", col),
        r(27, 40, 10, 12, shade(col, -0.22), 1),
        line("M32 24 v-8 l10 4 -10 4", "#e63946", 2),
        line("M18 44 h6 M40 44 h6", shade(col, -0.18), 2),
      ],
    },
    {
      id: "schaufel", name: "Schaufel", color: "#2d9cdb",
      draw: (col) => [
        r(18, 6, 28, 9, shade(col, 0.3), 4.5),
        r(28, 13, 8, 20, shade(col, 0.3), 2),
        p("M14 31 h36 l-4 13 q-14 10 -28 0 z", col),
        line("M24 35 v7 M32 35 v9 M40 35 v7", shade(col, -0.25), 1.8),
      ],
    },
    {
      id: "eimer", name: "Eimer", color: "#eb5757",
      draw: (col) => [
        p("M16 22 q16 -14 32 0", "none", { stroke: shade(col, -0.3), "stroke-width": 3 }),
        p("M14 22 h36 l-5 32 h-26 z", col),
        r(14, 22, 36, 6, shade(col, 0.25), 2),
      ],
    },
    {
      id: "schirm", name: "Sonnenschirm", color: "#f2545b",
      draw: (col) => [
        line("M32 24 v30", "#8d6e4a", 3.4),
        p("M6 26 a26 18 0 0 1 52 0 z", "#fdf6ec"),
        p("M32 8 a26 18 0 0 1 26 18 h-13 a13 18 0 0 0 -13 -18 z", col),
        p("M6 26 a26 18 0 0 1 13 -15.6 a13 18 0 0 0 0 15.6 z", col),
        line("M32 54 q6 2 6 -4", "#8d6e4a", 3),
      ],
    },
    {
      id: "brille", name: "Sonnenbrille", color: "#3b4252",
      draw: (col) => [
        p("M8 24 h20 v10 a10 10 0 0 1 -20 0 z", col),
        p("M36 24 h20 v10 a10 10 0 0 1 -20 0 z", col),
        line("M28 27 q4 -3 8 0", col, 3),
        line("M8 24 l-4 -4 M56 24 l4 -4", col, 3),
      ],
    },
    {
      id: "seepferd", name: "Seepferdchen", color: "#f2994a",
      draw: (col) => [
        p("M40 12 q-14 -4 -16 8 q-2 10 4 14 q6 4 4 12 q-2 8 -10 8 q10 6 16 -2 q6 -8 2 -18 q-3 -8 2 -12 q4 -3 8 2 q2 -10 -10 -12 z", col),
        line("M38 14 l6 -6 M34 20 l4 -8", shade(col, -0.25), 2.4),
        eye(35, 20, 1.9),
      ],
    },
    {
      id: "fisch", name: "Fisch", color: "#23b5d3",
      draw: (col) => [
        p("M46 32 l12 -10 v20 z", col),
        e(28, 32, 20, 12, col),
        p("M28 20 q4 -8 8 -2", shade(col, -0.2)),
        eye(18, 29),
        line("M36 24 q4 8 0 16", shade(col, -0.25), 2),
      ],
    },
    {
      id: "frosch", name: "Frosch", color: "#4caf50",
      draw: (col) => [
        e(16, 46, 8, 5, col), e(48, 46, 8, 5, col),
        e(32, 38, 19, 14, col),
        c(22, 22, 8, col), c(42, 22, 8, col),
        eye(22, 22, 3), eye(42, 22, 3),
        line("M24 44 q8 5 16 0"),
      ],
    },
    {
      id: "muschel", name: "Muschel", color: "#f48fb1",
      draw: (col) => [
        p("M32 54 C10 42 6 20 20 10 C26 5 38 5 44 10 C58 20 54 42 32 54 z", col),
        line("M32 54 L20 14 M32 54 v-42 M32 54 L44 14", shade(col, -0.3), 2),
      ],
    },
    {
      id: "seestern", name: "Seestern", color: "#ff7043",
      draw: (col) => [
        p("M32 6 L40 24 L60 26 L45 39 L50 58 L32 48 L14 58 L19 39 L4 26 L24 24 z", col),
        c(32, 32, 4, shade(col, 0.3), { stroke: "none" }),
      ],
    },
    {
      id: "schnecke", name: "Schnecke", color: "#a1662f",
      draw: (col) => [
        p("M8 52 q-2 -12 10 -14 q6 -1 10 -6 q3 -4 7 -1 q4 3 1 7 q-3 4 -3 14 z", shade(col, 0.42)),
        line("M31 30 l-2 -9 M36 31 l4 -8", shade(col, 0.42), 2.2),
        c(29, 20, 1.8, INK, { stroke: "none" }), c(41, 22, 1.8, INK, { stroke: "none" }),
        c(40, 32, 16, col),
        p("M40 32 m0 -10 a10 10 0 1 1 -7 17 a6 6 0 1 0 7 -11", shade(col, 0.32)),
      ],
    },
    {
      id: "ball", name: "Wasserball", color: "#fdfdfd",
      draw: () => [
        c(32, 32, 24, "#fdfdfd"),
        p("M32 8 a24 24 0 0 1 20 12 a40 40 0 0 0 -20 -4 z", "#ef476f"),
        p("M52 20 a24 24 0 0 1 -4 28 a40 40 0 0 0 -8 -22 z", "#118ab2"),
        p("M48 48 a24 24 0 0 1 -32 0 a40 40 0 0 0 16 -8 a40 40 0 0 0 16 8 z", "#ffd166"),
        p("M16 48 a24 24 0 0 1 -4 -28 a40 40 0 0 0 12 20 z", "#06d6a0"),
      ],
    },
    {
      id: "latsche", name: "Badeschlappen", color: "#9b51e0",
      draw: (col) => [
        p("M32 6 c11 0 15 9 14 21 c-1 12 -3 21 -5 25 c-2 4 -16 4 -18 0 c-2 -4 -4 -13 -5 -25 c-1 -12 3 -21 14 -21 z", col),
        p("M32 10 c9 0 12 8 11 18 c-1 11 -3 19 -4 22 c-2 3 -12 3 -14 0 c-1 -3 -3 -11 -4 -22 c-1 -10 2 -18 11 -18 z", shade(col, 0.42)),
        line("M21 30 q7 -9 11 -12 q4 3 11 12", col, 3.4),
        c(32, 17, 3, col),
      ],
    },
    {
      id: "surfbrett", name: "Surfbrett", color: "#ffd166",
      draw: (col) => [
        p("M32 4 q16 14 16 28 q0 14 -16 28 q-16 -14 -16 -28 q0 -14 16 -28 z", col),
        line("M32 12 v40", "#e63946", 3),
      ],
    },
    {
      id: "segelboot", name: "Segelboot", color: "#2f80ed",
      draw: (col) => [
        line("M32 6 v34", "#8d6e4a", 2.6),
        p("M34 8 q16 14 12 28 h-12 z", "#fdfdfd"),
        p("M30 14 q-10 10 -8 22 h8 z", col),
        p("M8 42 h48 l-8 12 h-32 z", col),
      ],
    },
    {
      id: "anker", name: "Anker", color: "#7a8896",
      draw: (col) => [
        c(32, 12, 6, "none", { stroke: col, "stroke-width": 4 }),
        line("M32 18 v32", col, 5),
        line("M18 24 h28", col, 5),
        p("M10 36 q0 20 22 20 q22 0 22 -20", "none", { stroke: col, "stroke-width": 5, "stroke-linecap": "round" }),
      ],
    },
    {
      id: "leuchtturm", name: "Leuchtturm", color: "#e63946",
      draw: (col) => [
        p("M22 54 l4 -34 h12 l4 34 z", "#fdfdfd"),
        p("M25 28 h14 l1 8 h-16 z", col),
        p("M23 44 h18 l1 8 h-20 z", col),
        r(24, 12, 16, 8, col, 2),
        p("M22 12 h20 l-4 -6 h-12 z", shade(col, -0.25)),
        line("M42 16 l10 -4 M42 18 l10 4", "#ffd166", 2.4),
      ],
    },
    {
      id: "moewe", name: "Möwe", color: "#fdfdfd",
      draw: () => [
        p("M32 34 q-14 -18 -28 -8 q10 2 12 12 q8 6 16 4 z", "#fdfdfd"),
        p("M32 34 q14 -18 28 -8 q-10 2 -12 12 q-8 6 -16 4 z", "#fdfdfd"),
        e(32, 38, 10, 8, "#fdfdfd"),
        c(32, 26, 7, "#fdfdfd"),
        p("M38 26 l8 3 -8 3 z", "#f4a261"),
        eye(33, 24, 1.8),
      ],
    },
    {
      id: "palme", name: "Palme", color: "#2f9e44",
      draw: (col) => [
        p("M30 54 q-2 -22 4 -32 h5 q-6 12 -3 32 z", "#8d6e4a"),
        p("M34 20 q-16 -12 -26 0 q12 -6 26 4 z", col),
        p("M34 20 q16 -12 26 0 q-12 -6 -26 4 z", col),
        p("M34 20 q-12 -16 -2 -18 q0 8 6 16 z", shade(col, -0.15)),
        p("M34 20 q14 -10 16 2 q-8 -4 -14 2 z", shade(col, -0.15)),
      ],
    },
    {
      id: "kokosnuss", name: "Kokosnuss", color: "#6d4c41",
      draw: (col) => [
        c(32, 34, 20, col),
        c(25, 27, 3.2, shade(col, -0.4), { stroke: "none" }),
        c(35, 25, 3.2, shade(col, -0.4), { stroke: "none" }),
        c(30, 34, 3.2, shade(col, -0.4), { stroke: "none" }),
        line("M14 40 q18 8 36 0", shade(col, 0.25), 2.4),
      ],
    },
    {
      id: "eis", name: "Eis", color: "#ff8fab",
      draw: (col) => [
        p("M20 28 h24 l-12 28 z", "#e0ac4a"),
        line("M24 34 l8 10 M40 34 l-8 10", shade("#e0ac4a", -0.25), 1.8),
        c(24, 22, 9, col), c(40, 22, 9, "#fdf0d5"), c(32, 16, 9, "#a8dadc"),
      ],
    },
    {
      id: "melone", name: "Melone", color: "#ef476f",
      draw: (col) => [
        p("M6 46 a26 26 0 0 1 52 0 z", "#2f9e44"),
        p("M11 46 a21 21 0 0 1 42 0 z", "#fdfdfd"),
        p("M15 46 a17 17 0 0 1 34 0 z", col),
        c(24, 38, 2, INK, { stroke: "none" }), c(32, 41, 2, INK, { stroke: "none" }), c(40, 38, 2, INK, { stroke: "none" }),
      ],
    },
    {
      id: "tuch", name: "Badetuch", color: "#00b4d8",
      draw: (col) => [
        r(8, 16, 48, 32, "#fdfdfd", 4),
        r(8, 22, 48, 6, col), r(8, 36, 48, 6, col),
      ],
    },
    {
      id: "hut", name: "Sonnenhut", color: "#e9c46a",
      draw: (col) => [
        e(32, 42, 28, 10, col),
        p("M14 42 a18 16 0 0 1 36 0 z", shade(col, 0.15)),
        p("M14 40 h36 v4 h-36 z", "#e76f51"),
      ],
    },
    {
      id: "schnorchel", name: "Schnorchel", color: "#118ab2",
      draw: (col) => [
        p("M18 12 v26 a10 10 0 0 0 14 0", "none", { stroke: col, "stroke-width": 5, "stroke-linecap": "round" }),
        r(14, 6, 8, 8, shade(col, -0.2), 2),
        p("M30 30 h22 a4 4 0 0 1 4 4 v8 a4 4 0 0 1 -4 4 h-22 z", "#a8dadc"),
        line("M34 46 v8 h16 v-8", col, 3),
      ],
    },
    {
      id: "qualle", name: "Qualle", color: "#b892ff",
      draw: (col) => [
        p("M8 34 a24 22 0 0 1 48 0 z", col),
        line("M16 34 q-2 12 4 20 M26 34 q-4 12 2 22 M38 34 q4 12 -2 22 M48 34 q2 12 -4 20", shade(col, -0.15), 3),
        eye(25, 26, 2), eye(39, 26, 2),
      ],
    },
    {
      id: "krake", name: "Krake", color: "#7b2cbf",
      draw: (col) => [
        p("M6 48 q4 -10 10 -4 q4 4 8 0 q4 -6 8 0 q4 4 8 0 q6 -6 10 4 z", col),
        p("M12 36 a20 20 0 0 1 40 0 z", col),
        e(32, 30, 20, 16, col),
        eye(25, 28, 3), eye(39, 28, 3),
        line("M28 38 q4 3 8 0"),
      ],
    },
    {
      id: "schildkroete", name: "Schildkröte", color: "#55a630",
      draw: (col) => [
        e(52, 36, 8, 6, shade(col, 0.25)),
        e(12, 44, 7, 5, shade(col, 0.25)), e(52, 46, 7, 5, shade(col, 0.25)),
        p("M8 40 a24 20 0 0 1 48 0 z", col),
        p("M32 22 v18 M18 32 l-4 8 M46 32 l4 8", "none", { stroke: shade(col, -0.3), "stroke-width": 2 }),
        eye(56, 34, 1.8),
      ],
    },
    {
      id: "wal", name: "Wal", color: "#4361ee",
      draw: (col) => [
        p("M50 34 q8 -12 12 -10 q-3 6 -2 10 q-1 4 2 10 q-4 2 -12 -10 z", col),
        p("M8 34 q0 -14 22 -14 q20 0 22 14 q-2 14 -22 14 q-22 0 -22 -14 z", col),
        p("M10 38 q10 12 30 8 q10 -3 12 -8 q-14 6 -42 0 z", shade(col, 0.5)),
        p("M28 20 q-2 -8 4 -12 q-3 8 2 12 z", col),
        line("M16 16 q2 -8 8 -10 M16 16 q-4 -8 -10 -8", "#a8dadc", 3),
        eye(17, 31),
        line("M9 38 q6 4 12 3"),
      ],
    },
    {
      id: "flasche", name: "Flaschenpost", color: "#74c69d",
      draw: (col) => [
        r(28, 6, 8, 10, "#c9a227", 2),
        p("M26 16 h12 q4 8 4 14 v20 a6 6 0 0 1 -6 6 h-8 a6 6 0 0 1 -6 -6 v-20 q0 -6 4 -14 z", col),
        r(24, 34, 16, 12, "#fdf0d5", 2),
        line("M27 38 h10 M27 42 h8", "#b08968", 1.6),
      ],
    },
    {
      id: "kiste", name: "Schatzkiste", color: "#8b5e34",
      draw: (col) => [
        p("M10 30 a22 14 0 0 1 44 0 z", shade(col, 0.15)),
        r(10, 30, 44, 22, col, 2),
        r(10, 30, 44, 5, "#c9a227"),
        r(28, 32, 8, 12, "#c9a227", 2),
        c(32, 38, 2, INK, { stroke: "none" }),
      ],
    },
    {
      id: "drachen", name: "Drachen", color: "#ff006e",
      draw: (col) => [
        p("M32 5 L52 25 L32 47 L12 25 z", col),
        p("M32 5 L32 47 M12 25 L52 25", "none", { stroke: shade(col, 0.5), "stroke-width": 2 }),
        line("M32 47 q-7 5 0 8 q7 4 0 7", "#3b4252", 2.2),
      ],
    },
    {
      id: "kiesel", name: "Kieselstein", color: "#adb5bd",
      draw: (col) => [
        p("M32 52 C14 52 6 42 10 30 C14 18 26 12 38 14 C52 16 58 28 54 40 C51 48 44 52 32 52 z", col),
        line("M20 32 q8 -6 18 -2", shade(col, 0.45), 2.4),
      ],
    },
    {
      id: "reifen", name: "Schwimmreifen", color: "#ff595e",
      draw: (col) => [
        c(32, 32, 24, col),
        p("M32 8 a24 24 0 0 1 17 7 l-11 11 a9 9 0 0 0 -6 -2 z", "#fdfdfd"),
        p("M32 56 a24 24 0 0 1 -17 -7 l11 -11 a9 9 0 0 0 6 2 z", "#fdfdfd"),
        c(32, 32, 9, "#a8dadc"),
      ],
    },
    {
      id: "creme", name: "Sonnencreme", color: "#ff9f1c",
      draw: (col) => [
        r(27, 6, 10, 8, shade(col, -0.2), 2),
        p("M22 14 h20 a4 4 0 0 1 4 4 v32 a4 4 0 0 1 -4 4 h-20 a4 4 0 0 1 -4 -4 v-32 a4 4 0 0 1 4 -4 z", "#fdfdfd"),
        r(18, 26, 28, 14, col),
        c(32, 33, 4, "#fdfdfd", { stroke: "none" }),
        line("M32 25 v-3 M32 41 v3 M24 33 h-3 M40 33 h3", "#fdfdfd", 2),
      ],
    },
    {
      id: "ente", name: "Badeente", color: "#ffd60a",
      draw: (col) => [
        p("M10 44 a20 12 0 0 0 40 0 q4 -4 4 -10 h-44 z", col),
        c(42, 20, 12, col),
        p("M52 20 h10 a4 4 0 0 1 -4 6 h-6 z", "#f77f00"),
        eye(44, 17, 2.2),
        line("M18 36 q8 6 16 2", shade(col, -0.25), 2),
      ],
    },
    {
      id: "alge", name: "Alge", color: "#14746f",
      draw: (col) => [
        p("M32 56 q-6 -18 0 -34 q4 -12 0 -18", "none", { stroke: col, "stroke-width": 4, "stroke-linecap": "round" }),
        p("M32 44 q-14 -2 -16 -14 q10 2 16 8 z", col),
        p("M32 32 q14 -2 16 -14 q-10 2 -16 8 z", col),
        p("M32 20 q-10 -2 -12 -12 q8 2 12 6 z", shade(col, 0.2)),
      ],
    },
  ];

  const BY_ID = Object.fromEntries(TREASURES.map((item) => [item.id, item]));

  // Ein Schatz als fertiges SVG. Die Kontur sitzt auf der Gruppe: ein einziger
  // Wert für alle Figuren, und keine Form kann sie vergessen.
  function treasureSvg(id, extra = {}) {
    const item = BY_ID[id];
    if (!item) return null;
    return el("svg", {
      viewBox: "0 0 64 64", class: "st-art", "aria-hidden": "true", ...extra,
    }, [
      group({
        stroke: INK, "stroke-width": 1.8, "stroke-linejoin": "round", "stroke-linecap": "round",
        "stroke-opacity": 0.55,
      }, item.draw(item.color)),
    ]);
  }

  window.LernappStrandArt = { TREASURES, BY_ID, treasureSvg, INK };
})();
