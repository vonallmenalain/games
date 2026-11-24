/*
 * malen.js – Malen und Raten: Eine malt, die andere rät.
 * ---------------------------------------------------------------------------
 * Die Seite /malen. Ein Spiel miteinander (gemeinsam): sechs Runden, die
 * Rollen wechseln jede Runde. Wer malt, sieht ein Wort mit seinem Bild (91
 * Wörter: Tiere, Essen, Sachen, Fahrzeuge, Wetter …) und malt es mit dem
 * Finger. Damit nicht immer dieselben kommen, merkt sich das Gerät die Wörter
 * der letzten Partien (malen.zuletzt) und wählt für eine neue Partie eine
 * Saat, deren Wörter möglichst keines davon sind. Wer rät, sieht die
 * Striche, während sie entstehen, und tippt auf eine der Antworten (Bild und Wort – auch wer noch nicht
 * liest, kann raten). Drei Versuche je Runde. Werden vier der sechs Wörter
 * erraten, ist es geschafft.
 *
 * Gegen den Computer wechselt es auch jede Runde. Malt er, zeichnet er sein
 * Bild des Wortes Strich für Strich, und man rät. Malt man selbst, schaut er
 * zu und rät, sobald genug auf dem Papier ist und eine Weile nichts dazukommt
 * (oder sofort auf «Fertig – rate!»): Er vergleicht die Zeichnung mit seinen
 * eigenen Bildern der Wörter, die zur Wahl stehen. Die Stufe bestimmt, wie
 * viele Antworten zur Wahl stehen – und wie viel er zeichnet, bevor man raten
 * muss.
 *
 * Die Striche gehen nicht über die Züge, sondern über einen eigenen Ort in
 * der Datenbank (LernappZwei.live, partie/<raum>/live/<partie>-<runde>):
 * Punkte von 0 bis 1000, «x,y;x,y|x,y;…». Ein Zug ist nur das Raten: «R2:3»
 * – in Runde 2 die Antwort 3.
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "malen") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  const RUNDEN = 6;
  const ZIEL = 4;
  const VERSUCHE = 3;

  // --- Die Wörter, und wie der Computer sie malt --------------------------------
  // Hilfen: ein Kreis, ein Bogen, eine Linie, ein Vieleck (Punkte 0–1000).
  const kreis = (cx, cy, r, n = 28) => Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)]);
  const oval = (cx, cy, rx, ry, n = 30) => Array.from({ length: n + 1 }, (_, i) => [cx + rx * Math.cos((2 * Math.PI * i) / n), cy + ry * Math.sin((2 * Math.PI * i) / n)]);
  const bogen = (cx, cy, r, von, bis, n = 18) => Array.from({ length: n + 1 }, (_, i) => { const w = ((von + ((bis - von) * i) / n) * Math.PI) / 180; return [cx + r * Math.cos(w), cy + r * Math.sin(w)]; });
  const linie = (x1, y1, x2, y2) => [[x1, y1], [x2, y2]];
  const strahlen = (cx, cy, r1, r2, n) => Array.from({ length: n }, (_, i) => { const w = (2 * Math.PI * i) / n; return linie(cx + r1 * Math.cos(w), cy + r1 * Math.sin(w), cx + r2 * Math.cos(w), cy + r2 * Math.sin(w)); });

  const WOERTER = [
    { wort: "Sonne", bild: "🌞", malen: () => [kreis(500, 500, 170), ...strahlen(500, 500, 230, 330, 10)] },
    { wort: "Haus", bild: "🏠", malen: () => [[[300, 460], [300, 800], [700, 800], [700, 460]], [[260, 480], [500, 240], [740, 480]], [[450, 800], [450, 650], [550, 650], [550, 800]], [[360, 540], [420, 540], [420, 600], [360, 600], [360, 540]]] },
    { wort: "Baum", bild: "🌳", malen: () => [[[460, 870], [460, 600], [540, 600], [540, 870]], kreis(500, 420, 210), bogen(430, 400, 60, 200, 340, 8), bogen(580, 460, 50, 200, 340, 8)] },
    { wort: "Katze", bild: "🐱", malen: () => [kreis(500, 540, 220), [[330, 400], [300, 220], [440, 340]], [[560, 340], [700, 220], [670, 400]], kreis(420, 510, 25, 12), kreis(580, 510, 25, 12), [[480, 590], [500, 610], [520, 590]], linie(300, 590, 440, 600), linie(300, 640, 440, 620), linie(700, 590, 560, 600), linie(700, 640, 560, 620)] },
    { wort: "Fisch", bild: "🐟", malen: () => [oval(450, 500, 240, 140), [[680, 500], [840, 370], [840, 630], [680, 500]], kreis(330, 470, 20, 10), bogen(450, 500, 90, -50, 50, 8)] },
    { wort: "Auto", bild: "🚗", malen: () => [[[180, 620], [820, 620], [820, 490], [660, 490], [580, 370], [380, 370], [300, 490], [180, 490], [180, 620]], kreis(330, 630, 75), kreis(670, 630, 75), [[400, 400], [400, 480], [560, 480], [500, 400], [400, 400]]] },
    { wort: "Blume", bild: "🌸", malen: () => [kreis(500, 380, 60, 16), ...Array.from({ length: 6 }, (_, i) => kreis(500 + 125 * Math.cos((i * Math.PI) / 3), 380 + 125 * Math.sin((i * Math.PI) / 3), 70, 16)), linie(500, 520, 500, 880), oval(580, 700, 70, 30, 14)] },
    { wort: "Herz", bild: "❤️", malen: () => [Array.from({ length: 41 }, (_, i) => { const t = (2 * Math.PI * i) / 40; return [500 + 16 * Math.sin(t) ** 3 * 18, 470 - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 18]; })] },
    { wort: "Stern", bild: "⭐", malen: () => [Array.from({ length: 11 }, (_, i) => { const w = (Math.PI / 5) * i - Math.PI / 2; const r = i % 2 ? 150 : 340; return [500 + r * Math.cos(w), 520 + r * Math.sin(w)]; })] },
    { wort: "Mond", bild: "🌙", malen: () => [bogen(500, 500, 300, 60, 300, 24), bogen(620, 500, 240, 105, 255, 20)] },
    { wort: "Ball", bild: "⚽", malen: () => [kreis(500, 500, 280), Array.from({ length: 6 }, (_, i) => { const w = (2 * Math.PI * i) / 5 - Math.PI / 2; return [500 + 90 * Math.cos(w), 500 + 90 * Math.sin(w)]; }), ...strahlen(500, 500, 90, 280, 5)] },
    { wort: "Schiff", bild: "⛵", malen: () => [[[220, 640], [780, 640], [690, 790], [310, 790], [220, 640]], linie(500, 640, 500, 200), [[520, 230], [740, 590], [520, 590], [520, 230]], [[480, 300], [300, 590], [480, 590]]] },
    { wort: "Apfel", bild: "🍎", malen: () => [kreis(500, 570, 240), [[500, 340], [520, 220]], oval(590, 260, 70, 32, 14)] },
    { wort: "Rakete", bild: "🚀", malen: () => [[[440, 760], [440, 360], [500, 180], [560, 360], [560, 760], [440, 760]], [[440, 620], [350, 760], [440, 760]], [[560, 620], [650, 760], [560, 760]], kreis(500, 430, 45, 14), [[470, 760], [500, 870], [530, 760]]] },
    { wort: "Pilz", bild: "🍄", malen: () => [[...bogen(500, 540, 290, 180, 360, 22), [210, 540]], [[430, 540], [420, 820], [580, 820], [570, 540]], kreis(420, 430, 35, 12), kreis(580, 410, 40, 12), kreis(500, 330, 30, 12)] },
    { wort: "Eis", bild: "🍦", malen: () => [[[370, 470], [630, 470], [500, 880], [370, 470]], [...bogen(500, 470, 140, 180, 360, 18), [360, 470]], linie(420, 560, 560, 620), linie(440, 680, 540, 720)] },
    { wort: "Brille", bild: "👓", malen: () => [kreis(330, 520, 130), kreis(670, 520, 130), bogen(500, 520, 50, 200, 340, 8), linie(200, 500, 110, 440), linie(800, 500, 890, 440)] },
    { wort: "Schnecke", bild: "🐌", malen: () => [Array.from({ length: 60 }, (_, i) => { const w = i * 0.32; const r = 8 + i * 3.4; return [560 + r * Math.cos(w), 480 + r * Math.sin(w)]; }), [[160, 720], [800, 720], [800, 660]], [[230, 720], [200, 560], [260, 560], [300, 720]], linie(220, 560, 190, 450), linie(250, 560, 280, 450)] },
    { wort: "Schlange", bild: "🐍", malen: () => [Array.from({ length: 50 }, (_, i) => [150 + i * 13, 560 + 120 * Math.sin(i / 5)]), kreis(800, 470, 55, 14), [[850, 470], [920, 450], [900, 470], [920, 490]]] },
    { wort: "Ballon", bild: "🎈", malen: () => [oval(500, 400, 200, 250), [[480, 650], [520, 650], [500, 680], [480, 650]], Array.from({ length: 20 }, (_, i) => [500 + 30 * Math.sin(i / 2), 680 + i * 12])] },
  ];

  // Weitere Hilfen: ein Rechteck, ein Zickzack, ein Strich durch Punkte.
  const rechteck = (x1, y1, x2, y2) => [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]];
  const zickzack = (x1, y1, x2, y2, n, h) => Array.from({ length: n * 2 + 1 }, (_, i) => {
    const t = i / (n * 2);
    const nx = -(y2 - y1); const ny = x2 - x1; const l = Math.hypot(nx, ny) || 1;
    const aus = i % 2 ? h : 0;
    return [x1 + (x2 - x1) * t + (nx / l) * aus, y1 + (y2 - y1) * t + (ny / l) * aus];
  });
  const punkte = (liste, r = 18) => liste.map(([x, y]) => kreis(x, y, r, 10));

  const MEHR = [
    // Tiere
    { wort: "Hund", bild: "🐶", malen: () => [kreis(500, 500, 210), oval(275, 470, 65, 150), oval(725, 470, 65, 150), ...punkte([[430, 450], [570, 450]], 22), oval(500, 560, 50, 34, 14), bogen(500, 600, 70, 20, 160, 10)] },
    { wort: "Maus", bild: "🐭", malen: () => [kreis(500, 560, 200), kreis(320, 340, 110), kreis(680, 340, 110), ...punkte([[440, 520], [560, 520]], 20), kreis(500, 610, 26, 10), linie(470, 620, 300, 600), linie(470, 640, 300, 680), linie(530, 620, 700, 600), linie(530, 640, 700, 680)] },
    { wort: "Hase", bild: "🐰", malen: () => [kreis(500, 620, 190), oval(420, 260, 55, 170), oval(580, 260, 55, 170), ...punkte([[440, 590], [560, 590]], 20), oval(500, 660, 30, 22, 10), bogen(470, 700, 30, 20, 160, 6), bogen(530, 700, 30, 20, 160, 6)] },
    { wort: "Bär", bild: "🐻", malen: () => [kreis(500, 540, 220), kreis(320, 340, 80), kreis(680, 340, 80), oval(500, 620, 100, 75), ...punkte([[420, 480], [580, 480]], 22), oval(500, 590, 38, 26, 12)] },
    { wort: "Schwein", bild: "🐷", malen: () => [kreis(500, 540, 230), [[320, 380], [300, 230], [420, 330]], [[580, 330], [700, 230], [680, 380]], oval(500, 600, 95, 65), ...punkte([[465, 600], [535, 600]], 16), ...punkte([[410, 470], [590, 470]], 20)] },
    { wort: "Frosch", bild: "🐸", malen: () => [oval(500, 580, 300, 200), kreis(360, 380, 85), kreis(640, 380, 85), ...punkte([[360, 380], [640, 380]], 30), bogen(500, 560, 190, 30, 150, 16)] },
    { wort: "Vogel", bild: "🐦", malen: () => [oval(470, 560, 220, 150), kreis(650, 400, 100), [[745, 390], [850, 420], [745, 445]], kreis(670, 380, 16, 8), [[260, 520], [130, 440], [150, 600], [255, 590]], bogen(450, 540, 120, 200, 340, 12), linie(440, 705, 420, 820), linie(520, 705, 540, 820)] },
    { wort: "Ente", bild: "🦆", malen: () => [oval(450, 620, 250, 140), kreis(640, 400, 100), [[730, 410], [860, 430], [860, 460], [735, 455]], kreis(660, 380, 16, 8), bogen(430, 600, 120, 200, 340, 12), [[120, 820], [300, 790], [500, 830], [700, 790], [880, 820]]] },
    { wort: "Schmetterling", bild: "🦋", malen: () => [oval(500, 520, 30, 220, 16), oval(330, 400, 150, 130), oval(670, 400, 150, 130), oval(360, 640, 110, 100), oval(640, 640, 110, 100), [[490, 310], [430, 190]], [[510, 310], [570, 190]]] },
    { wort: "Spinne", bild: "🕷️", malen: () => [kreis(500, 560, 150), kreis(500, 360, 80), ...[-1, 1].flatMap((s) => [0, 1, 2, 3].map((i) => [[500 + s * 130, 500 + i * 45], [500 + s * 280, 420 + i * 70], [500 + s * 340, 560 + i * 90]]))] },
    { wort: "Biene", bild: "🐝", malen: () => [oval(500, 580, 230, 150), linie(420, 440, 420, 720), linie(520, 430, 520, 730), linie(620, 450, 620, 710), oval(430, 360, 90, 110), oval(580, 360, 90, 110), [[730, 580], [820, 580]], kreis(330, 550, 16, 8)] },
    { wort: "Marienkäfer", bild: "🐞", malen: () => [kreis(500, 560, 260), linie(500, 300, 500, 820), [...bogen(500, 300, 110, 180, 360, 14), [390, 300]], ...punkte([[390, 470], [610, 470], [380, 640], [620, 640], [500, 740]], 34)] },
    { wort: "Schildkröte", bild: "🐢", malen: () => [[...bogen(470, 640, 270, 180, 360, 24), [200, 640]], linie(200, 640, 740, 640), kreis(820, 590, 80), kreis(840, 570, 12, 8), oval(300, 690, 50, 40), oval(640, 690, 50, 40), [[380, 470], [470, 420], [560, 470], [560, 560], [380, 560], [380, 470]]] },
    { wort: "Wal", bild: "🐳", malen: () => [[[150, 520], ...bogen(470, 560, 320, 180, 360, 24), [790, 560], [700, 660], [450, 690], [250, 650], [150, 520]], [[150, 520], [80, 420], [200, 460], [190, 360]], kreis(640, 560, 18, 8), [[500, 240], [500, 140]], bogen(500, 180, 70, 200, 340, 10)] },
    { wort: "Elefant", bild: "🐘", malen: () => [kreis(500, 440, 190), oval(270, 440, 120, 170), oval(730, 440, 120, 170), [[470, 580], [460, 720], [420, 830], [470, 850], [520, 740], [530, 580]], ...punkte([[440, 400], [560, 400]], 18)] },
    { wort: "Pinguin", bild: "🐧", malen: () => [oval(500, 540, 210, 320), oval(500, 600, 130, 220), ...punkte([[450, 330], [550, 330]], 18), [[470, 380], [500, 430], [530, 380]], oval(420, 870, 70, 28), oval(580, 870, 70, 28)] },
    { wort: "Eule", bild: "🦉", malen: () => [oval(500, 560, 250, 300), kreis(410, 450, 85), kreis(590, 450, 85), ...punkte([[410, 450], [590, 450]], 30), [[470, 540], [500, 600], [530, 540]], [[300, 320], [330, 200], [400, 290]], [[600, 290], [670, 200], [700, 320]]] },
    { wort: "Krebs", bild: "🦀", malen: () => [oval(500, 600, 230, 140), [[330, 500], [220, 360]], [[670, 500], [780, 360]], [[180, 380], ...bogen(220, 300, 80, 200, 470, 14)], [[820, 380], ...bogen(780, 300, 80, 70, -200, 14)], linie(440, 480, 420, 380), linie(560, 480, 580, 380), ...punkte([[420, 370], [580, 370]], 20), linie(300, 650, 180, 740), linie(700, 650, 820, 740), linie(330, 700, 240, 800), linie(670, 700, 760, 800)] },
    { wort: "Igel", bild: "🦔", malen: () => [[[180, 700], ...zickzack(200, 650, 700, 420, 8, -90).slice(1), [780, 520], [880, 640], [780, 700], [180, 700]], kreis(760, 600, 16, 8), kreis(880, 640, 22, 8)] },
    // Essen
    { wort: "Banane", bild: "🍌", malen: () => [[...bogen(520, 170, 450, 30, 150, 22), ...bogen(520, 40, 440, 140, 40, 20), [910, 395]], [[880, 360], [930, 300]]] },
    { wort: "Birne", bild: "🍐", malen: () => [[...bogen(500, 640, 210, -40, 220, 22), ...bogen(500, 400, 120, 200, 340, 14)], linie(500, 280, 520, 180), oval(590, 220, 60, 28, 12)] },
    { wort: "Kirsche", bild: "🍒", malen: () => [kreis(360, 680, 130), kreis(640, 680, 130), [[360, 550], [480, 300], [520, 220]], [[640, 550], [560, 300], [520, 220]], oval(620, 220, 90, 40, 14)] },
    { wort: "Erdbeere", bild: "🍓", malen: () => [[[260, 380], [740, 380], [700, 620], [500, 860], [300, 620], [260, 380]], [[300, 380], [380, 260], [440, 370], [500, 240], [560, 370], [620, 260], [700, 380]], ...punkte([[400, 470], [600, 470], [500, 560], [420, 640], [580, 640]], 14)] },
    { wort: "Karotte", bild: "🥕", malen: () => [[[380, 300], [620, 300], [500, 900], [380, 300]], [[500, 300], [420, 140]], [[500, 300], [500, 120]], [[500, 300], [580, 140]], linie(430, 440, 520, 430), linie(460, 580, 540, 570)] },
    { wort: "Traube", bild: "🍇", malen: () => [...[[400, 380], [500, 380], [600, 380], [450, 480], [550, 480], [500, 580], [400, 580], [600, 580], [500, 680]].map(([x, y]) => kreis(x, y, 55, 14)), [[500, 320], [520, 200]], oval(600, 230, 70, 30, 12)] },
    { wort: "Zitrone", bild: "🍋", malen: () => [[[180, 500], ...bogen(500, 680, 340, 200, 340, 22), [820, 500], ...bogen(500, 320, 340, 20, 160, 22).slice(1), [180, 500]]] },
    { wort: "Ananas", bild: "🍍", malen: () => [oval(500, 620, 190, 260), linie(350, 470, 640, 790), linie(360, 690, 600, 400), linie(420, 380, 660, 650), [[400, 370], [360, 160], [470, 300], [500, 110], [530, 300], [640, 160], [600, 370]]] },
    { wort: "Melone", bild: "🍉", malen: () => [[...bogen(500, 360, 380, 0, 180, 26), [880, 360]], [...bogen(500, 360, 310, 0, 180, 22)], ...punkte([[400, 470], [500, 520], [600, 470], [450, 600], [550, 600]], 16)] },
    { wort: "Torte", bild: "🎂", malen: () => [rechteck(220, 480, 780, 800), oval(500, 480, 280, 50), linie(220, 640, 780, 640), rechteck(330, 300, 370, 470), rechteck(480, 300, 520, 470), rechteck(630, 300, 670, 470), oval(350, 260, 18, 34, 10), oval(500, 260, 18, 34, 10), oval(650, 260, 18, 34, 10)] },
    { wort: "Lutscher", bild: "🍭", malen: () => [Array.from({ length: 50 }, (_, i) => { const w = i * 0.4; const r = 10 + i * 4; return [500 + r * Math.cos(w), 360 + r * Math.sin(w)]; }), kreis(500, 360, 210), linie(500, 570, 500, 900)] },
    { wort: "Pizza", bild: "🍕", malen: () => [[[200, 250], [800, 250], [500, 880], [200, 250]], [[200, 250], [500, 180], [800, 250]], kreis(450, 380, 50, 14), kreis(590, 400, 45, 14), kreis(500, 560, 45, 14)] },
    { wort: "Ei", bild: "🥚", malen: () => [Array.from({ length: 41 }, (_, i) => { const t = (2 * Math.PI * i) / 40; const s = Math.sin(t); return [500 + 215 * Math.cos(t), 560 + (s < 0 ? 330 : 240) * s]; })] },
    { wort: "Käse", bild: "🧀", malen: () => [[[180, 700], [820, 700], [820, 520], [180, 380], [180, 700]], linie(180, 380, 820, 520), kreis(360, 600, 45, 12), kreis(600, 620, 35, 12), kreis(700, 580, 25, 10)] },
    // Sachen
    { wort: "Regenschirm", bild: "☂️", malen: () => [[...bogen(500, 480, 330, 180, 360, 24), ...[830, 720, 610, 500, 390, 280, 170].map((x, i) => [x, i % 2 ? 450 : 480])], [[500, 480], [500, 800], ...bogen(560, 800, 60, 180, 0, 8)], linie(500, 150, 500, 110)] },
    { wort: "Schlüssel", bild: "🔑", malen: () => [kreis(300, 500, 120), kreis(300, 500, 40, 12), [[420, 480], [860, 480], [860, 520], [420, 520]], [[740, 520], [740, 610], [800, 610], [800, 520]]] },
    { wort: "Glocke", bild: "🔔", malen: () => [[[250, 700], ...bogen(500, 450, 220, 180, 360, 20), [750, 700], [250, 700]], linie(500, 230, 500, 180), kreis(500, 750, 50, 14)] },
    { wort: "Uhr", bild: "⏰", malen: () => [kreis(500, 540, 260), linie(500, 540, 500, 380), linie(500, 540, 620, 600), kreis(500, 540, 18, 8), [...bogen(310, 300, 80, 180, 360, 12), [230, 300]], [...bogen(690, 300, 80, 180, 360, 12), [610, 300]], linie(330, 760, 280, 840), linie(670, 760, 720, 840)] },
    { wort: "Buch", bild: "📖", malen: () => [[[500, 320], [200, 260], [200, 720], [500, 780], [800, 720], [800, 260], [500, 320], [500, 780]], linie(260, 380, 440, 410), linie(260, 480, 440, 510), linie(560, 410, 740, 380), linie(560, 510, 740, 480)] },
    { wort: "Stift", bild: "✏️", malen: () => [[[150, 430], [700, 430], [860, 500], [700, 570], [150, 570], [150, 430]], linie(700, 430, 700, 570), linie(150, 430, 150, 570), rechteck(100, 430, 150, 570), [[820, 482], [860, 500], [820, 518]]] },
    { wort: "Schere", bild: "✂️", malen: () => [kreis(280, 360, 100), kreis(280, 660, 100), [[370, 400], [850, 640]], [[370, 620], [850, 380]]] },
    { wort: "Hammer", bild: "🔨", malen: () => [rechteck(460, 400, 540, 880), [[260, 230], [740, 230], [740, 400], [260, 400], [260, 230]]] },
    { wort: "Glühbirne", bild: "💡", malen: () => [[...bogen(500, 400, 220, 140, 400, 26)], rechteck(410, 600, 590, 740), linie(410, 650, 590, 650), linie(410, 695, 590, 695), [[450, 740], [500, 800], [550, 740]], [[440, 560], [470, 430], [500, 500], [530, 430], [560, 560]]] },
    { wort: "Kerze", bild: "🕯️", malen: () => [rechteck(400, 380, 600, 860), linie(500, 380, 500, 320), [[500, 120], ...bogen(500, 250, 70, -60, 240, 16).slice(4), [500, 120]], oval(500, 860, 160, 30, 16)] },
    { wort: "Krone", bild: "👑", malen: () => [[[200, 700], [200, 330], [350, 520], [500, 250], [650, 520], [800, 330], [800, 700], [200, 700]], linie(200, 620, 800, 620), ...punkte([[200, 310], [500, 230], [800, 310]], 24)] },
    { wort: "Hut", bild: "🎩", malen: () => [oval(500, 720, 330, 60), rechteck(320, 300, 680, 700), linie(320, 620, 680, 620)] },
    { wort: "Schuh", bild: "👟", malen: () => [[[150, 720], [150, 420], [380, 420], [480, 540], [760, 580], [860, 660], [860, 720], [150, 720]], linie(150, 670, 860, 670), linie(300, 460, 360, 520), linie(330, 430, 400, 500)] },
    { wort: "T-Shirt", bild: "👕", malen: () => [[[400, 220], [180, 330], [250, 470], [320, 430], [320, 800], [680, 800], [680, 430], [750, 470], [820, 330], [600, 220], [400, 220]], bogen(500, 220, 100, 0, 180, 12)] },
    { wort: "Tasse", bild: "☕", malen: () => [[[250, 420], [300, 800], [620, 800], [670, 420], [250, 420]], bogen(700, 590, 100, -80, 80, 12), oval(460, 420, 210, 40), [[380, 340], [360, 280], [390, 220], [370, 160]], [[520, 340], [500, 280], [530, 220], [510, 160]]] },
    { wort: "Geschenk", bild: "🎁", malen: () => [rechteck(220, 400, 780, 820), rechteck(190, 320, 810, 400), linie(500, 320, 500, 820), oval(420, 260, 80, 50, 14), oval(580, 260, 80, 50, 14)] },
    { wort: "Trommel", bild: "🥁", malen: () => [oval(500, 400, 280, 80), linie(220, 400, 220, 720), linie(780, 400, 780, 720), Array.from({ length: 19 }, (_, i) => { const w = (Math.PI * i) / 18; return [500 + 280 * Math.cos(w), 720 + 80 * Math.sin(w)]; }), zickzack(220, 560, 780, 560, 5, 80), [[320, 150], [460, 360]], [[680, 150], [540, 360]]] },
    { wort: "Gitarre", bild: "🎸", malen: () => [kreis(420, 640, 190), kreis(560, 470, 140), kreis(470, 580, 60, 14), [[620, 360], [850, 130], [880, 160], [650, 390]]] },
    { wort: "Zug", bild: "🚂", malen: () => [rechteck(500, 300, 760, 700), rechteck(160, 440, 500, 700), rechteck(220, 300, 290, 440), rechteck(560, 360, 700, 480), kreis(270, 760, 70), kreis(640, 760, 70), [[180, 260], [250, 200], [330, 240], [400, 180]]] },
    { wort: "Flugzeug", bild: "✈️", malen: () => [oval(500, 500, 360, 70), [[460, 470], [380, 200], [470, 200], [580, 470]], [[460, 530], [380, 800], [470, 800], [580, 530]], [[160, 480], [120, 360], [200, 360], [240, 470]]] },
    { wort: "Velo", bild: "🚲", malen: () => [kreis(270, 640, 150), kreis(730, 640, 150), [[270, 640], [430, 440], [620, 440], [730, 640]], [[430, 440], [500, 640], [620, 440]], linie(270, 640, 500, 640), linie(400, 400, 470, 400), [[620, 440], [600, 340], [680, 320]]] },
    { wort: "Bus", bild: "🚌", malen: () => [rechteck(120, 300, 880, 700), rechteck(170, 360, 320, 500), rechteck(360, 360, 510, 500), rechteck(550, 360, 700, 500), rechteck(740, 360, 840, 600), kreis(300, 710, 70), kreis(700, 710, 70)] },
    { wort: "Anker", bild: "⚓", malen: () => [kreis(500, 220, 60, 16), linie(500, 280, 500, 820), linie(370, 380, 630, 380), [...bogen(500, 560, 280, 20, 160, 20)], [[200, 640], [230, 560]], [[800, 640], [770, 560]]] },
    { wort: "Zelt", bild: "⛺", malen: () => [[[150, 800], [500, 200], [850, 800], [150, 800]], [[420, 800], [500, 560], [580, 800]], linie(500, 200, 500, 140)] },
    { wort: "Wolke", bild: "☁️", malen: () => [[[260, 670], [740, 670], ...bogen(740, 580, 90, 90, -90, 10), ...bogen(590, 470, 140, -10, -170, 14), ...bogen(390, 510, 110, -40, -170, 12), ...bogen(270, 590, 80, -100, -270, 10), [260, 670]]] },
    { wort: "Regenbogen", bild: "🌈", malen: () => [bogen(500, 720, 380, 180, 360, 30), bogen(500, 720, 300, 180, 360, 26), bogen(500, 720, 220, 180, 360, 22)] },
    { wort: "Blitz", bild: "⚡", malen: () => [[[580, 120], [300, 540], [500, 540], [400, 880], [720, 420], [520, 420], [580, 120]]] },
    { wort: "Schneemann", bild: "⛄", malen: () => [kreis(500, 700, 190), kreis(500, 400, 130), rechteck(420, 160, 580, 270), linie(370, 270, 630, 270), ...punkte([[455, 380], [545, 380]], 16), [[500, 410], [600, 430], [500, 440]], linie(370, 620, 220, 520), linie(630, 620, 780, 520)] },
    { wort: "Schneeflocke", bild: "❄️", malen: () => [0, 60, 120].flatMap((g) => { const w = (g * Math.PI) / 180; const p = (r) => [500 + r * Math.cos(w), 500 + r * Math.sin(w)]; return [[p(-320), p(320)]]; }).concat([0, 60, 120, 180, 240, 300].map((g) => { const w = (g * Math.PI) / 180; const m = [500 + 220 * Math.cos(w), 500 + 220 * Math.sin(w)]; const a = w + 0.6; const b = w - 0.6; return [[m[0] + 80 * Math.cos(a), m[1] + 80 * Math.sin(a)], m, [m[0] + 80 * Math.cos(b), m[1] + 80 * Math.sin(b)]]; })) },
    { wort: "Berg", bild: "⛰️", malen: () => [[[100, 800], [420, 250], [600, 560], [700, 420], [900, 800], [100, 800]], [[330, 400], [380, 440], [420, 400], [460, 440], [500, 390]]] },
    { wort: "Kaktus", bild: "🌵", malen: () => [[[440, 820], [440, 250], ...bogen(500, 250, 60, 180, 360, 10), [560, 820]], [[440, 560], [330, 560], [330, 420]], [[560, 480], [670, 480], [670, 340]], [[360, 820], [640, 820], [600, 900], [400, 900], [360, 820]]] },
    { wort: "Würfel", bild: "🎲", malen: () => [rechteck(220, 380, 620, 780), [[220, 380], [380, 220], [780, 220], [620, 380]], [[780, 220], [780, 620], [620, 780]], ...punkte([[310, 470], [420, 580], [530, 690]], 32), ...punkte([[700, 380], [700, 560]], 26)] },
    { wort: "Drachen", bild: "🪁", malen: () => [[[500, 140], [720, 380], [500, 700], [280, 380], [500, 140]], linie(500, 140, 500, 700), linie(280, 380, 720, 380), [[500, 700], [450, 780], [540, 840], [470, 920]], [[470, 760], [420, 740], [430, 790]]] },
    { wort: "Brief", bild: "✉️", malen: () => [rechteck(180, 300, 820, 720), [[180, 300], [500, 540], [820, 300]]] },
    { wort: "Tür", bild: "🚪", malen: () => [rechteck(330, 160, 670, 880), rechteck(370, 210, 630, 480), kreis(610, 560, 22, 10)] },
    { wort: "Zahn", bild: "🦷", malen: () => [[[300, 380], ...bogen(400, 330, 110, 180, 320, 10), [500, 290], ...bogen(600, 330, 110, 220, 360, 10), [710, 380], [660, 820], [580, 840], [520, 640], [480, 640], [420, 840], [340, 820], [300, 380]]] },
    { wort: "Hand", bild: "✋", malen: () => [[[320, 880], [300, 560], [220, 420], [260, 390], [340, 480], [340, 220], [400, 220], [410, 440], [430, 160], [490, 160], [490, 440], [520, 180], [580, 180], [570, 450], [620, 250], [680, 260], [660, 560], [640, 880], [320, 880]]] },
    { wort: "Smiley", bild: "🙂", malen: () => [kreis(500, 500, 290), ...punkte([[400, 420], [600, 420]], 30), bogen(500, 520, 160, 20, 160, 14)] },
  ];

  WOERTER.push(...MEHR);

  // --- Was zuletzt dran war (auf diesem Gerät) ------------------------------------
  const ZULETZT = "malen.zuletzt";
  const ZULETZT_HOECHSTENS = 36;
  function zuletztLesen() {
    try {
      const l = JSON.parse(localStorage.getItem(ZULETZT) || "[]");
      return Array.isArray(l) ? l.filter((w) => typeof w === "string") : [];
    } catch { return []; }
  }
  function zuletztMerken(woerter) {
    const neu = [...woerter, ...zuletztLesen().filter((w) => !woerter.includes(w))].slice(0, ZULETZT_HOECHSTENS);
    try { localStorage.setItem(ZULETZT, JSON.stringify(neu)); } catch { /* dann eben nicht */ }
  }

  function wuerfel(saat) {
    let t = (Number(saat) >>> 0) || 1;
    return () => {
      t = (t + 0x6d2b79f5) >>> 0;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  const mischen = (liste, rnd) => { const a = [...liste]; for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // --- Wie der Computer eine Zeichnung errät ---------------------------------------
  /*
   * Er vergleicht sie mit seinen eigenen Bildern der Wörter, die zur Wahl
   * stehen: Beide werden auf ein Raster von 32 × 32 gelegt (Grösse und Lage
   * egal: das Bild füllt das Raster), dann zählt, wie weit die Striche des
   * einen im Mittel von denen des anderen weg sind – in beide Richtungen.
   * Das Wort mit dem kleinsten Abstand rät er zuerst.
   */
  const RASTER = 32;
  function rastern(striche) {
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const s of striche) for (const [x, y] of s) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (!Number.isFinite(x0)) return null;
    const seite = Math.max(x1 - x0, y1 - y0, 1);
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const feld = new Uint8Array(RASTER * RASTER);
    const fuell = RASTER - 5;
    const setze = (x, y) => {
      const gx = Math.round(RASTER / 2 + ((x - mx) / seite) * fuell);
      const gy = Math.round(RASTER / 2 + ((y - my) / seite) * fuell);
      if (gx >= 0 && gy >= 0 && gx < RASTER && gy < RASTER) feld[gy * RASTER + gx] = 1;
    };
    const schritt = seite / fuell / 2;
    for (const s of striche) {
      if (s.length === 1) setze(s[0][0], s[0][1]);
      for (let i = 1; i < s.length; i += 1) {
        const [ax, ay] = s[i - 1];
        const [bx, by] = s[i];
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / schritt));
        for (let k = 0; k <= n; k += 1) setze(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n);
      }
    }
    return feld;
  }
  // Wie weit jedes Feld vom nächsten Strich weg ist (zwei Durchgänge).
  function abstaende(feld) {
    const d = new Float32Array(RASTER * RASTER);
    for (let i = 0; i < d.length; i += 1) d[i] = feld[i] ? 0 : 999;
    const S = 1.41;
    for (let y = 0; y < RASTER; y += 1) for (let x = 0; x < RASTER; x += 1) {
      const i = y * RASTER + x;
      if (x > 0) d[i] = Math.min(d[i], d[i - 1] + 1);
      if (y > 0) {
        d[i] = Math.min(d[i], d[i - RASTER] + 1);
        if (x > 0) d[i] = Math.min(d[i], d[i - RASTER - 1] + S);
        if (x < RASTER - 1) d[i] = Math.min(d[i], d[i - RASTER + 1] + S);
      }
    }
    for (let y = RASTER - 1; y >= 0; y -= 1) for (let x = RASTER - 1; x >= 0; x -= 1) {
      const i = y * RASTER + x;
      if (x < RASTER - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
      if (y < RASTER - 1) {
        d[i] = Math.min(d[i], d[i + RASTER] + 1);
        if (x < RASTER - 1) d[i] = Math.min(d[i], d[i + RASTER + 1] + S);
        if (x > 0) d[i] = Math.min(d[i], d[i + RASTER - 1] + S);
      }
    }
    return d;
  }
  const vorlagen = new Map();
  function vorlage(wort) {
    if (!vorlagen.has(wort)) { const feld = rastern(WOERTER[wort].malen()); vorlagen.set(wort, { feld, abstand: abstaende(feld) }); }
    return vorlagen.get(wort);
  }
  function abstand(feld, abstandFeld, anderes) {
    let summe = 0;
    let n = 0;
    for (let i = 0; i < feld.length; i += 1) if (feld[i]) { summe += Math.min(abstandFeld[i], 12); n += 1; }
    return n ? summe / n : 99;
  }
  // Die Wörter (Nummern in WOERTER), vom ähnlichsten zum unähnlichsten.
  function erkenne(striche, woerter) {
    const feld = rastern(striche);
    if (!feld) return [...woerter];
    const eigen = abstaende(feld);
    return woerter
      .map((w) => { const v = vorlage(w); return { w, wert: abstand(feld, v.abstand) + abstand(v.feld, eigen) }; })
      .sort((p, q) => p.wert - q.wert)
      .map((p) => p.w);
  }
  // Wie lang alle Striche zusammen sind (0–1000 je Seite).
  const tinte = (striche) => striche.reduce((n, s) => n + s.reduce((m, p, i) => (i ? m + Math.hypot(p[0] - s[i - 1][0], p[1] - s[i - 1][1]) : m), 0), 0);

  // Wie viele Antworten zur Wahl stehen, und wie viel der Computer malt.
  const STUFEN = { leicht: { wahl: 3, anteil: 1 }, einfach: { wahl: 4, anteil: 1 }, mittel: { wahl: 6, anteil: 0.8 }, schwer: { wahl: 8, anteil: 0.6 } };
  const DUELL = { wahl: 6, anteil: 1 };

  // Die Runden einer Partie: sechs verschiedene Wörter, und je Runde die
  // Antworten (das richtige darunter).
  function runden(saat, stufe) {
    const art = STUFEN[stufe] || DUELL;
    const rnd = wuerfel((Number(saat) ^ 0x3a1e) >>> 0);
    const reihe = mischen(WOERTER.map((_, i) => i), rnd).slice(0, RUNDEN);
    return reihe.map((wort) => {
      const andere = mischen(WOERTER.map((_, i) => i).filter((i) => i !== wort), rnd).slice(0, art.wahl - 1);
      const wahl = mischen([wort, ...andere], rnd);
      return { wort, wahl, richtig: wahl.indexOf(wort) };
    });
  }

  // Eine neue Partie: unter bis zu 60 zufälligen Saaten die erste, deren sechs
  // Wörter keines der zuletzt gespielten sind (sonst die mit den wenigsten).
  function neuePartie(stufe) {
    const zuletzt = new Set(zuletztLesen());
    let beste = 0;
    let wenigste = Infinity;
    for (let i = 0; i < 60; i += 1) {
      const saat = Math.floor(Math.random() * 4294967295);
      const schon = runden(saat, stufe).filter((r) => zuletzt.has(WOERTER[r.wort].wort)).length;
      if (schon < wenigste) { wenigste = schon; beste = saat; }
      if (!schon) break;
    }
    return { saat: beste };
  }

  // --- Die Regeln -----------------------------------------------------------------
  function lage(zuege, { beginnt, saat, stufe }) {
    const rs = runden(saat, stufe);
    // Wer malt, wechselt jede Runde – auch gegen den Computer.
    const maler = (r) => (r % 2 === 0 ? beginnt : anderer(beginnt));
    const l = { runden: rs, runde: 0, falsch: [], erraten: 0, verlauf: [], ende: null, stufe: stufe || null };
    for (const z of zuege) {
      const m = /^R(\d):(\d)$/.exec(z);
      if (!m || l.ende || Number(m[1]) !== l.runde || Number(m[2]) >= rs[l.runde].wahl.length || l.falsch.includes(Number(m[2]))) {
        return { ...l, maler: maler(l.runde), dran: null, kaputt: true };
      }
      const wahl = Number(m[2]);
      const r = rs[l.runde];
      if (wahl === r.richtig) {
        l.erraten += 1;
        l.verlauf.push({ runde: l.runde, erraten: true, falsch: [...l.falsch] });
        l.runde += 1;
        l.falsch = [];
      } else {
        l.falsch.push(wahl);
        if (l.falsch.length >= VERSUCHE) {
          l.verlauf.push({ runde: l.runde, erraten: false, falsch: [...l.falsch] });
          l.runde += 1;
          l.falsch = [];
        }
      }
      if (l.runde >= RUNDEN) l.ende = l.erraten >= ZIEL ? "g" : "v";
    }
    const m = l.ende ? maler(RUNDEN - 1) : maler(l.runde);
    return { ...l, maler: m, rater: anderer(m), dran: l.ende ? null : anderer(m), letzte: l.verlauf[l.verlauf.length - 1] || null };
  }

  function darf(l, zug, sitz) {
    const m = /^R(\d):(\d)$/.exec(zug);
    return Boolean(m) && !l.ende && l.dran === sitz && Number(m[1]) === l.runde && Number(m[2]) < l.runden[l.runde].wahl.length && !l.falsch.includes(Number(m[2]));
  }

  // --- Der Computer ---------------------------------------------------------------
  // Was man gerade malt (gegen den Computer), damit er es erraten kann.
  const kinderBild = { stueck: "", striche: [], stand: 0, malt: false, zuletzt: 0, fertig: 0 };
  const horcher = new Set();
  const melden = () => { for (const f of [...horcher]) f(); };
  let ruhigJetzt = () => false;

  // Malt er, macht er keinen Zug (das Bild entsteht im Brett). Malt man
  // selbst, wartet er, bis genug auf dem Papier ist und eine Weile nichts
  // dazukommt – oder bis «Fertig – rate!» getippt wird – und rät dann das
  // Wort, dessen Bild der Zeichnung am ähnlichsten ist. Nach einem Fehlversuch
  // wartet er wieder, bis etwas dazugemalt wird (oder eine längere Weile).
  const MINDEST_TINTE = 400;
  function computer(l, sitz, stufe, { nr } = {}) {
    if (l.ende || l.dran !== sitz || l.maler === sitz) return null;
    const stueck = `${nr}-${l.runde}`;
    const r = l.runden[l.runde];
    const nochmal = l.falsch.length > 0;
    const anfang = Date.now();
    const standVorher = kinderBild.stueck === stueck ? kinderBild.stand : -1;
    const fertigVorher = kinderBild.stueck === stueck ? kinderBild.fertig : 0;
    return new Promise((fertig) => {
      let uhr = 0;
      const raus = (antwort) => { horcher.delete(pruefen); window.clearTimeout(uhr); fertig(antwort); };
      const los = () => {
        const offen = r.wahl.filter((_, i) => !l.falsch.includes(i));
        const wort = erkenne(kinderBild.striche, offen)[0];
        raus({ zug: `R${l.runde}:${r.wahl.indexOf(wort)}`, warte: ruhigJetzt() ? 80 : 600 });
      };
      function pruefen() {
        window.clearTimeout(uhr);
        // Eine andere Runde oder Partie: Hier gibt es nichts mehr zu raten.
        if (kinderBild.stueck !== stueck) { if (kinderBild.stueck) raus(null); return; }
        if (kinderBild.malt) return;
        const genug = tinte(kinderBild.striche);
        if (kinderBild.fertig > fertigVorher && genug > 0) { los(); return; }
        if (genug < MINDEST_TINTE) return;
        const neu = kinderBild.stand !== standVorher;
        const pause = ruhigJetzt() ? 400 : !nochmal ? 3000 : neu ? 2500 : 8000;
        const seit = Date.now() - Math.max(kinderBild.zuletzt, anfang);
        if (seit >= pause) { los(); return; }
        uhr = window.setTimeout(pruefen, pause - seit + 30);
      }
      horcher.add(pruefen);
      pruefen();
    });
  }

  // --- Was über dem Bild steht -------------------------------------------------------
  function satz(l, { ich, name, modus }) {
    if (l.ende) return null;
    const er = (sitz) => (sitz === ich ? "Du" : modus === "computer" ? "Der Computer" : name(sitz));
    const vorher = l.letzte && l.letzte.runde === l.runde - 1 ? (l.letzte.erraten ? `Richtig – ${WOERTER[l.runden[l.letzte.runde].wort].wort}! ` : `Schade – es war ${WOERTER[l.runden[l.letzte.runde].wort].wort}. `) : "";
    if (l.falsch.length) {
      const rest = VERSUCHE - l.falsch.length;
      const versuche = `${rest} ${rest === 1 ? "Versuch" : "Versuche"}`;
      if (l.rater === ich) return { text: `Nicht ganz – noch ${versuche}`, sitz: l.rater };
      const geraten = WOERTER[l.runden[l.runde].wahl[l.falsch[l.falsch.length - 1]]].wort;
      if (l.maler === ich) return { text: `${er(l.rater)} meinte «${geraten}» – mal noch etwas dazu! Noch ${versuche}`, sitz: l.rater };
      return { text: `${er(l.rater)} meinte «${geraten}» – noch ${versuche}`, sitz: l.rater };
    }
    // Ganz am Anfang: wer beginnt (zu malen).
    if (l.runde === 0 && !l.verlauf.length) {
      if (l.maler === ich) return { text: "Du beginnst – male das Wort!", sitz: ich };
      return { text: modus === "computer" ? "Der Computer beginnt zu malen – was ist es?" : `${name(l.maler)} ist dran und malt – was ist es?`, sitz: l.maler };
    }
    if (l.maler === ich) return { text: `${vorher}Du malst – ${modus === "computer" ? "der Computer" : name(l.rater)} rät`, sitz: ich };
    if (l.rater === ich) return { text: `${vorher}${er(l.maler)} malt – was ist es?`, sitz: l.maler };
    return { text: `${vorher}${er(l.maler)} malt, ${er(l.rater)} rät`, sitz: l.maler };
  }

  // --- Das Bild -------------------------------------------------------------------
  const STRICH = (b) => b.map((s) => s.map(([x, y]) => `${Math.round(Math.max(0, Math.min(1000, x)))},${Math.round(Math.max(0, Math.min(1000, y)))}`).join(";")).join("|");
  const LESEN = (text) => String(text || "").split("|").filter(Boolean).map((s) => s.split(";").map((p) => p.split(",").map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite)));

  function held() {
    const bild = el("div", "zw-mr-held");
    const papier = el("span", "zw-mr-held-papier");
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 1000 1000");
    for (const s of WOERTER[0].malen()) {
      const p = document.createElementNS(NS, "polyline");
      p.setAttribute("points", s.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(" "));
      svg.append(p);
    }
    papier.append(svg);
    bild.append(papier, el("span", "zw-mr-held-stift", "✏️"));
    return bild;
  }

  function brett({ zug, ton, knopf, ruhig, vorlesen }) {
    ruhigJetzt = ruhig;
    const knoten = el("div", "zw-mr");
    const kopf = el("div", "zw-mr-kopf");
    const rundeText = el("span", "zw-mr-runde");
    const punkte = el("span", "zw-mr-punkte");
    kopf.append(rundeText, punkte);
    const auftrag = el("div", "zw-mr-auftrag");
    let auftragWort = "";
    const auftragLaut = vorlesen?.(() => `Male: ${auftragWort}`, { titel: "Vorlesen, was du malst" });
    const papier = el("div", "zw-mr-papier");
    const leinwand = el("canvas", "zw-mr-leinwand");
    leinwand.setAttribute("aria-label", "Das Bild");
    papier.append(leinwand);
    const werkzeug = el("div", "zw-mr-werkzeug");
    const loeschen = knopf("Alles löschen", "mini-knopf mini-knopf-still zw-mr-loeschen", () => { meine = []; senden(true); malenNeu(); });
    // Gegen den Computer: «Fertig – rate!» lässt ihn sofort raten.
    const fertigKnopf = knopf("Fertig – rate!", "mini-knopf mini-knopf-voll zw-mr-fertig", () => {
      if (!meine.length) return;
      kinderBild.fertig += 1;
      ton("tipp");
      melden();
    });
    werkzeug.append(loeschen, fertigKnopf);
    const antworten = el("div", "zw-mr-antworten");
    knoten.append(kopf, auftrag, papier, werkzeug, antworten);

    let jetzt = null;
    let stueck = "";        // «partie-runde»: was gerade gemalt wird
    let meine = [];         // meine Striche (wer malt)
    let fremde = [];        // die Striche, die ankommen (wer rät)
    let abmelden = null;
    let zeichnenUhr = 0;
    let senden = () => {};
    let gezeigt = { stueck: "", striche: 0 };
    let gefundenGezeigt = 0;

    // --- Malen mit dem Finger
    let aktiv = null;
    const punkt = (e) => {
      const r = leinwand.getBoundingClientRect();
      return [Math.round(((e.clientX - r.left) / r.width) * 1000), Math.round(((e.clientY - r.top) / r.height) * 1000)];
    };
    const darfMalen = () => Boolean(jetzt && !jetzt.aus && jetzt.ich && jetzt.lage.maler === jetzt.ich && ["duell", "computer"].includes(jetzt.modus));
    leinwand.addEventListener("pointerdown", (e) => {
      if (!darfMalen()) return;
      e.preventDefault();
      leinwand.setPointerCapture?.(e.pointerId);
      aktiv = [punkt(e)];
      meine.push(aktiv);
      malenNeu();
      senden();
    });
    leinwand.addEventListener("pointermove", (e) => {
      if (!aktiv) return;
      const p = punkt(e);
      const letzter = aktiv[aktiv.length - 1];
      if (Math.hypot(p[0] - letzter[0], p[1] - letzter[1]) < 6) return;
      aktiv.push(p);
      malenNeu();
      senden();
    });
    const ende = () => { if (!aktiv) return; aktiv = null; senden(true); };
    leinwand.addEventListener("pointerup", ende);
    leinwand.addEventListener("pointercancel", ende);

    function groesse() {
      const r = leinwand.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(r.width * dpr));
      if (leinwand.width !== w) { leinwand.width = w; leinwand.height = w; }
      return w;
    }
    function malenNeu(striche = null, bis = Infinity) {
      const w = groesse();
      const ctx = leinwand.getContext("2d");
      ctx.clearRect(0, 0, w, w);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = w * 0.014;
      ctx.strokeStyle = "#2a2150";
      const alle = striche || (darfMalen() ? meine : fremde);
      let n = 0;
      for (const s of alle) {
        if (!s.length) continue;
        ctx.beginPath();
        ctx.moveTo((s[0][0] / 1000) * w, (s[0][1] / 1000) * w);
        for (let i = 1; i < s.length; i += 1) {
          if (n >= bis) break;
          ctx.lineTo((s[i][0] / 1000) * w, (s[i][1] / 1000) * w);
          n += 1;
        }
        if (s.length === 1) ctx.lineTo((s[0][0] / 1000) * w + 0.5, (s[0][1] / 1000) * w);
        ctx.stroke();
        if (n >= bis) break;
      }
    }

    // Der Computer malt: Strich für Strich, so viel die Stufe erlaubt.
    function computerMalt(l) {
      window.clearInterval(zeichnenUhr);
      const r = l.runden[l.runde];
      const ganz = WOERTER[r.wort].malen();
      const anteil = (STUFEN[l.stufe] || DUELL).anteil;
      const striche = ganz.slice(0, Math.max(1, Math.ceil(ganz.length * anteil)));
      const punkteGesamt = striche.reduce((n, s) => n + s.length, 0);
      if (ruhig()) { fremde = striche; malenNeu(); return; }
      let bis = 0;
      fremde = striche;
      zeichnenUhr = window.setInterval(() => {
        bis += 3;
        malenNeu(striche, bis);
        if (bis >= punkteGesamt) window.clearInterval(zeichnenUhr);
      }, 30);
    }

    let gemerkt = "";
    function neuesStueck(b) {
      const l = b.lage;
      const partieSchluessel = `${b.raum}|${b.nr}`;
      if (gemerkt !== partieSchluessel && l.runden?.length) { gemerkt = partieSchluessel; zuletztMerken(l.runden.map((r) => WOERTER[r.wort].wort)); }
      const neu = `${b.nr}-${l.runde}`;
      if (neu === stueck) return;
      stueck = neu;
      meine = [];
      fremde = [];
      abmelden?.();
      abmelden = null;
      window.clearInterval(zeichnenUhr);
      if (b.modus === "computer") {
        // Was das Kind malt, sieht der Computer (für sein Raten).
        Object.assign(kinderBild, { stueck: neu, striche: [], stand: 0, malt: false, zuletzt: Date.now(), fertig: 0 });
        melden();
      }
      if (l.ende) { malenNeu([]); return; }
      if (b.modus === "computer" && l.maler !== b.ich) { senden = () => {}; computerMalt(l); return; }
      if (b.modus === "computer") {
        senden = () => {
          Object.assign(kinderBild, { striche: meine, stand: kinderBild.stand + 1, zuletzt: Date.now(), malt: Boolean(aktiv) });
          fertigKnopf.disabled = !meine.length;
          melden();
        };
        malenNeu();
        return;
      }
      const kanal = Z.live?.(b.raum);
      if (!kanal) { malenNeu([]); return; }
      if (l.maler === b.ich) {
        let zuletzt = 0;
        let ausstehend = 0;
        senden = (sofort = false) => {
          const los = () => { zuletzt = Date.now(); kanal.schreibe(stueck, STRICH(meine)); };
          window.clearTimeout(ausstehend);
          if (sofort || Date.now() - zuletzt > 180) los(); else ausstehend = window.setTimeout(los, 180);
        };
        senden(true);
      } else {
        senden = () => {};
        abmelden = kanal.hoere(stueck, (text) => { fremde = LESEN(text); malenNeu(); });
      }
      malenNeu();
    }

    function zeichne(b) {
      if (!b) return;
      jetzt = b;
      const l = b.lage;
      neuesStueck(b);
      const ich = b.ich;
      rundeText.textContent = l.ende ? "Fertig" : `Runde ${l.runde + 1} von ${RUNDEN}`;
      // Was ihr zusammen gefunden habt – die Bilder, und wie viele noch fehlen.
      punkte.innerHTML = "";
      const gefunden = l.verlauf.filter((v) => v.erraten).map((v) => WOERTER[l.runden[v.runde].wort]);
      if (gefunden.length) {
        const bilder = el("span", "zw-mr-gefunden");
        if (gefunden.length < gefundenGezeigt) gefundenGezeigt = 0;
        gefunden.forEach((w, i) => { const g = el("span", `zw-mr-gefunden-bild${i >= gefundenGezeigt ? " ist-neu" : ""}`, w.bild); g.title = w.wort; bilder.append(g); });
        punkte.append(bilder);
      }
      gefundenGezeigt = gefunden.length;
      const wieViele = l.erraten >= ZIEL ? `${l.erraten} gefunden` : `${l.erraten} von ${ZIEL} gefunden`;
      punkte.append(el("span", "zw-mr-gefunden-zahl", wieViele));
      punkte.setAttribute("aria-label", `${wieViele}${gefunden.length ? `: ${gefunden.map((w) => w.wort).join(", ")}` : ""}`);
      // Der Auftrag: wer malt, sieht das Wort.
      const r = l.runden[Math.min(l.runde, RUNDEN - 1)];
      auftrag.innerHTML = "";
      if (!l.ende && darfMalen()) {
        auftragWort = WOERTER[r.wort].wort;
        auftrag.append(el("span", "zw-mr-auftrag-bild", WOERTER[r.wort].bild), el("span", "zw-mr-auftrag-wort", `Male: ${auftragWort}`));
        if (auftragLaut) auftrag.append(auftragLaut);
      }
      auftrag.hidden = !auftrag.childElementCount;
      werkzeug.hidden = !darfMalen();
      fertigKnopf.hidden = b.modus !== "computer";
      fertigKnopf.disabled = !meine.length;
      papier.classList.toggle("ist-malen", darfMalen());
      // Die Antworten: wer rät, tippt; die anderen sehen sie auch.
      antworten.innerHTML = "";
      // Hochkant in Reihen zu höchstens vier: acht in 4 + 4, sechs in 3 + 3.
      const zahlAntworten = l.ende ? 0 : r.wahl.length;
      antworten.style.setProperty("--zw-mr-spalten", String(zahlAntworten <= 4 ? Math.max(1, zahlAntworten) : Math.ceil(zahlAntworten / 2)));
      if (!l.ende) {
        const raten = Boolean(!b.aus && ich && l.rater === ich);
        r.wahl.forEach((w, i) => {
          const k = knopf("", `zw-mr-antwort${l.falsch.includes(i) ? " ist-falsch" : ""}`, () => { if (raten && !l.falsch.includes(i)) zug(`R${l.runde}:${i}`); });
          k.dataset.antwort = String(i);
          k.append(el("span", "zw-mr-antwort-bild", WOERTER[w].bild), el("span", "zw-mr-antwort-wort", WOERTER[w].wort));
          k.disabled = !raten || l.falsch.includes(i);
          antworten.append(k);
        });
      }
      antworten.classList.toggle("ist-aus", !(ich && l.rater === ich));
      // Wer malt, braucht die Antworten nicht – Platz fürs Papier.
      antworten.hidden = Boolean(!l.ende && darfMalen());
      knoten.classList.toggle("ist-dran", Boolean(ich && l.rater === ich && !b.aus));
      // Ein Ton: richtig oder daneben.
      const zahl = b.zuege.length;
      if (gezeigt.stueck && zahl > gezeigt.striche) {
        const zuletzt = b.zuege[zahl - 1];
        const [, rn, wn] = /^R(\d):(\d)$/.exec(zuletzt) || [];
        const war = l.runden[Number(rn)];
        ton(war && Number(wn) === war.richtig ? "treffer" : "platsch");
      }
      gezeigt = { stueck, striche: zahl };
      if (b.modus !== "computer" || l.ende || darfMalen()) malenNeu();
    }

    window.addEventListener("resize", () => { if (jetzt) malenNeu(); });

    return {
      knoten,
      zeichne,
      fokus: () => antworten.querySelector("button:not([disabled])")?.focus({ preventScroll: true }),
    };
  }

  Z.starte({
    id: "malen",
    titel: "Malen und Raten",
    seite: "malen",
    unter: "Zusammen! Eine malt ein Wort, die andere rät – sechs Runden, abwechselnd. Werden vier erraten, habt ihr es geschafft.",
    held,
    trenner: ".",
    gemeinsam: true,
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Drei Antworten, ganze Bilder" },
      einfach: { name: "Einfach", sterne: 1, satz: "Vier Antworten" },
      mittel: { name: "Mittel", sterne: 2, satz: "Sechs Antworten, nicht ganz fertig gemalt" },
      schwer: { name: "Schwer", sterne: 3, satz: "Acht Antworten, nur halb gemalt" },
    },
    texte: { start: "rate, was gemalt wird", geschafft: "Geschafft – ihr habt genug erraten!", verpasst: "Leider nicht geschafft – zu wenig erraten." },
    lage,
    darf,
    brett,
    computer,
    // Was der Lautsprecher beim Satz noch vorliest: die Runde, was gefunden
    // ist – und wer rät, hört die Antworten zur Wahl.
    vorlesen: (b) => {
      const l = b.lage;
      const gefunden = l.erraten >= ZIEL ? `${l.erraten} gefunden` : `${l.erraten} von ${ZIEL} gefunden`;
      if (l.ende) return gefunden;
      const r = l.runden[l.runde];
      const teile = [`Runde ${l.runde + 1} von ${RUNDEN}`, gefunden];
      if (b.ich && !b.aus && l.rater === b.ich) teile.push(`Zur Wahl: ${r.wahl.filter((_, i) => !l.falsch.includes(i)).map((w) => WOERTER[w].wort).join(", ")}`);
      return teile.join(". ");
    },
    satz,
    neuePartie,
    fuerPruefung: { WOERTER, erkenne, tinte, runden, neuePartie, zuletztMerken, zuletztLesen },
  });
})();
