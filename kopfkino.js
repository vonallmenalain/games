/*
 * kopfkino.js – Kopfkino. Zehn Aufgaben fürs Vorstellungsvermögen.
 * ---------------------------------------------------------------------------
 * Auf der Leinwand steht ein Bild, der Film dazu läuft im Kopf: Ein Blatt
 * wird gefaltet und gelocht – wo sind die Löcher, wenn man es auffaltet? Ein
 * Würfelnetz faltet sich zum Würfel – welche Fläche liegt dem Stern
 * gegenüber? Ein Spielwürfel rollt den Pfeilen nach – was liegt am Ende
 * oben? Wie viele Würfel hat der Stapel, wie sieht er von hinten aus,
 * welche Figur ist dieselbe, nur gedreht, und wie viele Ecken hat der
 * Schnitt durch den Würfel? Dazu, seit der zweiten Fassung: der angemalte
 * Block, der zerlegt wird; der Würfel, der aus dem Netz mit den Zeichen
 * entsteht; das Teil, das die Lücke füllt; der Stapel zu drei Schatten; der
 * Körper, den eine Fläche beim Drehen zieht; der Laser zwischen Spiegeln;
 * das Getriebe; und die Kugelbahn.
 *
 * Erst nach der Antwort läuft der Film wirklich: Das Blatt faltet sich auf,
 * das Netz schliesst sich, der Würfel rollt, die Kamera schwenkt, der Block
 * zieht sich auseinander, das Getriebe läuft an, die Kugel rollt.
 *
 * Fünfzehn Arten, jede in drei Stufen; jede Runde zieht drei leichte, vier
 * mittlere und drei schwere Aufgaben – zehn verschiedene Arten. Bis zu hundert Punkte je Aufgabe,
 * tausend im Ganzen: Richtig muss es sein – und wer im ersten Drittel der
 * Zeit antwortet, bekommt alles, danach fällt es bis auf die Hälfte. Wo sich
 * eine Antwort aus Teilen setzt (Felder, Spalten, eine Zahl), zählt auch
 * «fast».
 *
 * Vor jeder Aufgabe steht, was zu tun ist, mit einem Beispiel, das sich
 * selbst auflöst. Die Uhr läuft erst nach einem Tipp.
 *
 * Die Aufgaben kommen aus zufall.js – ohne Turnier jedes Mal andere, im
 * Turnier für alle dieselben. Aufgezeichnet werden die Züge (geist.js,
 * zuege): jede Aufgabe, jede Eingabe und die Antwort. Damit lassen sich die
 * besten Runden anschauen, und im Multiplayer sehen die anderen dasselbe.
 *
 * Gezeichnet wird auf Canvas 2D, mit einer kleinen Welt in drei Richtungen
 * (male3d): x nach rechts, y nach hinten, z hinauf; die Kamera schaut schräg
 * von oben, ohne Fluchtpunkt.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "mindseye") return;

  const host = document.querySelector("#kn-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall: welche zehn Aufgaben kommen und wie sie aussehen. Die
  // Beispiele der Vorschau und die Funken nehmen Math.random.
  const zufall = window.LernappZufall?.fuer?.("mindsEye") || {
    fest: false, neu() {}, zahl: Math.random,
  };

  // ---------------------------------------------------------------------------
  // Regeln
  // ---------------------------------------------------------------------------
  const PUNKTE_JE_AUFGABE = 100;
  // Die Arten: die sieben der ersten Fassung, dann die acht neuen. Der
  // Schnitt kommt erst ab der mittleren Stufe.
  const ARTEN = ["falten", "netz", "stapel", "ansicht", "drehen", "rollen", "schnitt", "farbe", "muster", "luecke", "schatten", "drehkoerper", "laser", "zahnrad", "kugelbahn"];
  const OHNE_LEICHT = ["schnitt"];
  // Jede Runde: drei leichte, vier mittlere, drei schwere. Zuerst kommen die
  // Arten dran, die in der Runde noch nicht vorkamen – bei fünfzehn Arten
  // sind es also zehn verschiedene.
  const PLAN = [3, 4, 3];
  const AUFGABEN = PLAN[0] + PLAN[1] + PLAN[2];
  const STUFE = ["leicht", "mittel", "schwer"];

  // So lange hat eine Aufgabe (Sekunden). Im ersten Anteil VOLL davon gibt
  // eine richtige Antwort alles, danach fällt es bis zum Schluss auf SPAET.
  const ZEITEN = [14, 18, 24];
  const VOLL = 0.35;
  const SPAET = 0.5;
  // So lange baut sich eine neue Aufgabe auf; erst danach läuft die Zeit.
  const EINZUG = 0.45;
  // Ab wann eine Aufgabe einen Tipp annimmt – nicht den, der sie hinlegte.
  const SPERRE = 0.3;
  // So lange läuft die Auflösung, je Art (Millisekunden).
  const ZEIGEN_MS = {
    falten: 3600, netz: 3600, stapel: 3400, ansicht: 3400, drehen: 3200, rollen: 3800, schnitt: 3200,
    farbe: 3800, muster: 4000, luecke: 3400, schatten: 3400, drehkoerper: 3800, laser: 3400, zahnrad: 4000, kugelbahn: 3600,
  };
  // Die Vorschau: wie in den Geschwistern (Augenmass, Zeitgefühl, Freihand).
  const VORSCHAU = 30;
  const VOR_ZAEHLT = 5;
  const VOR_SPERRE = 0.35;

  // Wo eine Zahl gefragt ist: so viel gibt es für «um eins daneben», «um zwei».
  const FAST = [1, 0.4, 0.15];

  const TOP_COUNT = 5;

  // ---------------------------------------------------------------------------
  // Rechnen
  // ---------------------------------------------------------------------------
  const clamp = (wert, min, max) => Math.max(min, Math.min(max, wert));
  const lerp = (a, b, k) => a + (b - a) * k;
  const weich = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const TAU = Math.PI * 2;
  const GRAD = Math.PI / 180;

  const ganz = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const waehle = (r, liste) => liste[Math.floor(r() * liste.length)];
  function gemischt(r, liste) {
    const kopie = [...liste];
    for (let i = kopie.length - 1; i > 0; i -= 1) {
      const j = Math.floor(r() * (i + 1));
      [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
    }
    return kopie;
  }

  // Vektoren in drei Richtungen: [x, y, z].
  const vPlus = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const vMinus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const vMal = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const vPunkt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const vKreuz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const vLang = (a) => Math.hypot(a[0], a[1], a[2]);
  const vNorm = (a) => { const l = vLang(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  // Eine Drehung als drei Spalten: wohin x, y und z zeigen.
  const EINS = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const mVec = (m, v) => [m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2], m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2], m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2]];
  const mMal = (a, b) => b.map((spalte) => mVec(a, spalte));
  // Die Drehung um die Achse k (Länge 1) um den Winkel w.
  function drehung(k, w) {
    const c = Math.cos(w);
    const s = Math.sin(w);
    const um = (v) => vPlus(vPlus(vMal(v, c), vMal(vKreuz(k, v), s)), vMal(k, vPunkt(k, v) * (1 - c)));
    return [um([1, 0, 0]), um([0, 1, 0]), um([0, 0, 1])];
  }
  // Die 24 Lagen eines Würfels: alle Drehungen, die ihn in sich überführen.
  const LAGEN = (() => {
    const raus = [];
    const achsen = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (const x of achsen) for (const y of achsen) {
      if (vPunkt(x, y) !== 0) continue;
      raus.push([x, y, vKreuz(x, y)]);
    }
    return raus;
  })();
  const rundV = (v) => v.map((x) => Math.round(x));

  // ---------------------------------------------------------------------------
  // Die Aufgaben
  // ---------------------------------------------------------------------------
  /*
   * Jede Aufgabe ist ein Gegenstand mit
   *   art, stufe, kurz, frage, zeit
   *   eingabe   "wahl" (eine von n antippen), "felder" (Felder an und aus,
   *             dann Fertig), "spalten" (in jeder Spalte eine Höhe, dann
   *             Fertig), "zahl" (eintippen, dann Fertig)
   *   soll      die richtige Antwort als Zahl: der Platz der Wahl, die Felder
   *             als Bits, die Spalten zu je drei Bits, die Zahl selbst
   * und dem, was ihre Art zum Zeichnen braucht. r ist der Zufall, eine
   * Funktion wie Math.random.
   */

  // --- Falten und lochen -----------------------------------------------------
  // Ein Blatt aus 4 × 4 Feldern. Jede Faltung legt die eine Hälfte dessen,
  // was noch daliegt, auf die andere. Dann wird gelocht – durch alle Lagen.
  const FALT_N = 4;
  function faltenBau(r, stufe) {
    const zahl = stufe + 1;
    let x0 = 0, x1 = FALT_N, y0 = 0, y1 = FALT_N;
    const falten = [];
    for (let i = 0; i < zahl; i += 1) {
      const quer = x1 - x0 >= 2 && (y1 - y0 < 2 || r() < 0.5);
      if (!quer && y1 - y0 < 2) break;
      // quer: Die Faltlinie steht senkrecht, eine Hälfte klappt zur Seite.
      const vorher = { x0, x1, y0, y1 };
      if (quer) {
        const bei = (x0 + x1) / 2;
        const bleibt = r() < 0.5 ? "klein" : "gross";
        if (bleibt === "klein") x1 = bei; else x0 = bei;
        falten.push({ achse: "x", bei, vorher, nachher: { x0, x1, y0, y1 } });
      } else {
        const bei = (y0 + y1) / 2;
        const bleibt = r() < 0.5 ? "klein" : "gross";
        if (bleibt === "klein") y1 = bei; else y0 = bei;
        falten.push({ achse: "y", bei, vorher, nachher: { x0, x1, y0, y1 } });
      }
    }
    // Ein Loch – auf der schweren Stufe mit zwei Faltungen zwei.
    const felder = [];
    for (let x = x0; x < x1; x += 1) for (let y = y0; y < y1; y += 1) felder.push([x, y]);
    const loecher = gemischt(r, felder).slice(0, stufe === 2 && falten.length < 3 && felder.length > 2 ? 2 : 1);
    // Auffalten: Jede Faltung spiegelt, was da ist, über ihre Linie zurück.
    const stufen = [loecher];
    for (let i = falten.length - 1; i >= 0; i -= 1) {
      const f = falten[i];
      const bisher = stufen[0];
      const gespiegelt = bisher.map(([x, y]) => (f.achse === "x" ? [2 * f.bei - 1 - x, y] : [x, 2 * f.bei - 1 - y]));
      stufen.unshift([...bisher, ...gespiegelt]);
    }
    let soll = 0;
    for (const [x, y] of stufen[0]) soll |= 1 << (y * FALT_N + x);
    return { eingabe: "felder", felder: FALT_N * FALT_N, soll, falten, loecher, stufen };
  }

  // --- Das Würfelnetz --------------------------------------------------------
  // Die elf Netze des Würfels, als Felder [x, y].
  const NETZE = [
    [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2]],
    [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [2, 2]],
    [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [3, 2]],
    [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [2, 2]],
    [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [1, 2]],
    [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [2, 2]],
    [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [3, 2]],
    [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2]],
    [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1], [4, 1]],
  ];
  // Die leichten: das Kreuz und seine Verwandten mit vier Feldern in einer Reihe.
  const NETZE_LEICHT = [0, 1, 2, 3, 5];

  // Das Netz als Baum: Vom Feld in der Mitte aus hängt jedes Feld an einem
  // Nachbarn. Beim Falten dreht es sich um die gemeinsame Kante.
  function netzBaum(felder) {
    const schluessel = (x, y) => `${x}/${y}`;
    const nr = new Map(felder.map(([x, y], i) => [schluessel(x, y), i]));
    // Die Wurzel: das Feld mit den meisten Nachbarn.
    const nachbarn = (i) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ dx, dy, j: nr.get(schluessel(felder[i][0] + dx, felder[i][1] + dy)) })).filter((n) => n.j !== undefined);
    let wurzel = 0;
    felder.forEach((_, i) => { if (nachbarn(i).length > nachbarn(wurzel).length) wurzel = i; });
    const eltern = new Array(felder.length).fill(null);
    const reihe = [wurzel];
    const besucht = new Set([wurzel]);
    for (let k = 0; k < reihe.length; k += 1) {
      for (const n of nachbarn(reihe[k])) {
        if (besucht.has(n.j)) continue;
        besucht.add(n.j);
        eltern[n.j] = { von: reihe[k], dx: n.dx, dy: n.dy };
        reihe.push(n.j);
      }
    }
    return { wurzel, eltern, reihe };
  }

  // Wo jedes Feld des Netzes liegt, wenn es um den Winkel w gefaltet ist
  // (0: flach, 90°: der Würfel). Je Feld { o, ex, ey }: seine Ecke und seine
  // beiden Kanten; die bedruckte Seite schaut nach ex × ey. Gefaltet wird
  // nach unten weg – das Feld in der Mitte bleibt oben liegen, der Druck aussen.
  function netzLage(felder, baum, w) {
    const lage = new Array(felder.length);
    const [wx, wy] = felder[baum.wurzel];
    lage[baum.wurzel] = { o: [wx, wy, 0], ex: [1, 0, 0], ey: [0, 1, 0] };
    const c = Math.cos(w);
    const s = Math.sin(w);
    for (const i of baum.reihe) {
      const e = baum.eltern[i];
      if (!e) continue;
      const p = lage[e.von];
      const n = vKreuz(p.ex, p.ey);
      if (e.dx === 1) lage[i] = { o: vPlus(p.o, p.ex), ex: vMinus(vMal(p.ex, c), vMal(n, s)), ey: p.ey };
      else if (e.dx === -1) { const ex = vPlus(vMal(p.ex, c), vMal(n, s)); lage[i] = { o: vMinus(p.o, ex), ex, ey: p.ey }; }
      else if (e.dy === 1) lage[i] = { o: vPlus(p.o, p.ey), ex: p.ex, ey: vMinus(vMal(p.ey, c), vMal(n, s)) };
      else { const ey = vPlus(vMal(p.ey, c), vMal(n, s)); lage[i] = { o: vMinus(p.o, ey), ex: p.ex, ey }; }
    }
    return lage;
  }

  // Die Aussenkanten des Netzes: jede Seite eines Feldes, an der kein
  // anderes Feld liegt. { feld, seite (0 unten, 1 rechts, 2 oben, 3 links), a, b }
  function netzKanten(felder) {
    const da = new Set(felder.map(([x, y]) => `${x}/${y}`));
    const raus = [];
    felder.forEach(([x, y], feld) => {
      const seiten = [[0, -1, [x, y], [x + 1, y]], [1, 0, [x + 1, y], [x + 1, y + 1]], [0, 1, [x, y + 1], [x + 1, y + 1]], [-1, 0, [x, y], [x, y + 1]]];
      seiten.forEach(([dx, dy, a, b], seite) => { if (!da.has(`${x + dx}/${y + dy}`)) raus.push({ feld, seite, a, b }); });
    });
    return raus;
  }

  function netzBau(r, stufe) {
    // Das Netz, irgendwie gedreht und gespiegelt.
    const roh = NETZE[stufe === 0 ? waehle(r, NETZE_LEICHT) : ganz(r, 0, NETZE.length - 1)];
    const dreh = ganz(r, 0, 3);
    const spiegel = r() < 0.5;
    let felder = roh.map(([x, y]) => {
      let p = [spiegel ? -x : x, y];
      for (let i = 0; i < dreh; i += 1) p = [-p[1], p[0]];
      return p;
    });
    const minX = Math.min(...felder.map((p) => p[0]));
    const minY = Math.min(...felder.map((p) => p[1]));
    felder = felder.map(([x, y]) => [x - minX, y - minY]);
    const baum = netzBaum(felder);
    const zu = netzLage(felder, baum, Math.PI / 2);
    const aussen = zu.map((l) => rundV(vKreuz(l.ex, l.ey)));
    const farben = gemischt(r, [0, 1, 2, 3, 4, 5]);
    const basis = { felder, baum, farben, breit: Math.max(...felder.map((p) => p[0])) + 1, hoch: Math.max(...felder.map((p) => p[1])) + 1 };
    if (stufe < 2) {
      // Welche Fläche liegt dem Stern gegenüber?
      const stern = ganz(r, 0, 5);
      const soll = aussen.findIndex((n) => n[0] === -aussen[stern][0] && n[1] === -aussen[stern][1] && n[2] === -aussen[stern][2]);
      return { ...basis, variante: "flaeche", eingabe: "wahl", wahl: 6, stern, soll };
    }
    // Welche Kante trifft auf die rote? Im Würfel liegen je zwei Aussenkanten
    // aufeinander.
    const kanten = netzKanten(felder);
    const ort = (k, ecke) => {
      const l = zu[k.feld];
      const [x, y] = felder[k.feld];
      return rundV(vPlus(vPlus(l.o, vMal(l.ex, ecke[0] - x)), vMal(l.ey, ecke[1] - y)));
    };
    const name = (k) => [ort(k, k.a), ort(k, k.b)].map((p) => p.join(",")).sort().join("|");
    const rot = ganz(r, 0, kanten.length - 1);
    const soll = kanten.findIndex((k, i) => i !== rot && name(k) === name(kanten[rot]));
    return { ...basis, variante: "kante", eingabe: "wahl", wahl: kanten.length, kanten, rot, soll };
  }

  // --- Der Stapel ------------------------------------------------------------
  // Würfel in Säulen auf einem Raster: hoehen[x][y]. Kein Würfel schwebt.
  // Die Kamera sieht die Seiten, die nach -x und -y schauen.
  function stapelHoehen(r, n, hoch, von, bis, versteckt) {
    let best = null;
    for (let versuch = 0; versuch < 200; versuch += 1) {
      const h = [];
      for (let x = 0; x < n; x += 1) {
        h.push([]);
        // Hinten eher höher, vorn eher niedriger – aber nicht immer.
        for (let y = 0; y < n; y += 1) h[x].push(clamp(Math.round(r() * (hoch + 1.2) - 0.9 + (x + y) * 0.12 * (r() < 0.7 ? 1 : -1)), 0, hoch));
      }
      const summe = h.flat().reduce((s, x) => s + x, 0);
      // Verdeckt: Darüber liegt ein Würfel, und beide Säulen davor sind höher.
      let zu = 0;
      for (let x = 0; x < n; x += 1) for (let y = 0; y < n; y += 1) for (let z = 0; z < h[x][y] - 1; z += 1) {
        if ((x === 0 ? 0 : h[x - 1][y]) > z && (y === 0 ? 0 : h[x][y - 1]) > z) zu += 1;
      }
      best = { hoehen: h, summe, verdeckt: zu };
      if (summe >= von && summe <= bis && zu >= versteckt && h.flat().filter((x) => x > 0).length >= n * n * 0.55) return best;
    }
    return best;
  }

  function stapelBau(r, stufe) {
    const n = stufe === 0 ? 3 : stufe === 1 ? 3 : 4;
    const s = stapelHoehen(r, n, [2, 3, 4][stufe], [5, 11, 19][stufe], [9, 17, 30][stufe], [0, 2, 5][stufe]);
    return { eingabe: "zahl", n, hoehen: s.hoehen, soll: s.summe, verdeckt: s.verdeckt, farbe: ganz(r, 0, 5) };
  }

  // Woher geschaut wird: 0 von links vorn (entlang +x), 1 von rechts vorn
  // (entlang +y), 2 von hinten rechts (entlang -x), 3 von hinten links
  // (entlang -y). Die Spalten der Ansicht von links nach rechts.
  function ansichtSpalten(hoehen, richtung) {
    const n = hoehen.length;
    const raus = [];
    for (let i = 0; i < n; i += 1) {
      let hoch = 0;
      for (let j = 0; j < n; j += 1) {
        const h = richtung === 0 ? hoehen[j][n - 1 - i] : richtung === 1 ? hoehen[i][j] : richtung === 2 ? hoehen[j][i] : hoehen[n - 1 - i][j];
        hoch = Math.max(hoch, h);
      }
      raus.push(hoch);
    }
    return raus;
  }

  function ansichtBau(r, stufe) {
    const n = stufe === 0 ? 3 : 4;
    const hoch = [3, 3, 4][stufe];
    let s = null;
    let spalten = null;
    const richtung = stufe === 2 ? ganz(r, 2, 3) : ganz(r, 0, 1);
    for (let versuch = 0; versuch < 60; versuch += 1) {
      s = stapelHoehen(r, n, hoch, [6, 12, 16][stufe], [12, 22, 30][stufe], 0);
      spalten = ansichtSpalten(s.hoehen, richtung);
      // Nicht alle Spalten gleich hoch – sonst gäbe es nichts zu sehen.
      if (new Set(spalten).size >= 2) break;
    }
    let soll = 0;
    spalten.forEach((h, i) => { soll |= h << (3 * i); });
    return { eingabe: "spalten", n, hoch, hoehen: s.hoehen, richtung, spalten, soll, farbe: ganz(r, 0, 5) };
  }

  // --- Dieselbe Figur --------------------------------------------------------
  const wuerfelSchluessel = (liste) => {
    const mx = Math.min(...liste.map((p) => p[0]));
    const my = Math.min(...liste.map((p) => p[1]));
    const mz = Math.min(...liste.map((p) => p[2]));
    return liste.map((p) => `${p[0] - mx},${p[1] - my},${p[2] - mz}`).sort().join(" ");
  };
  // Die Figur, unabhängig davon, wie sie gedreht ist.
  const gestalt = (liste) => LAGEN.map((m) => wuerfelSchluessel(liste.map((p) => rundV(mVec(m, p))))).sort()[0];

  // Eine Kette aus Würfeln mit Knicken in alle drei Richtungen – so, dass ihr
  // Spiegelbild eine andere Figur ist.
  function figurBau(r, arme) {
    for (let versuch = 0; versuch < 400; versuch += 1) {
      const wuerfel = [[0, 0, 0]];
      let ort = [0, 0, 0];
      let zuletzt = -1;
      let gut = true;
      for (let i = 0; i < arme && gut; i += 1) {
        const achse = waehle(r, [0, 1, 2].filter((a) => a !== zuletzt));
        zuletzt = achse;
        const sinn = r() < 0.5 ? -1 : 1;
        const lang = i === 0 || i === arme - 1 ? ganz(r, 2, 3) : ganz(r, 1, 2);
        for (let k = 0; k < lang; k += 1) {
          ort = [...ort];
          ort[achse] += sinn;
          if (wuerfel.some((p) => p[0] === ort[0] && p[1] === ort[1] && p[2] === ort[2])) { gut = false; break; }
          wuerfel.push(ort);
        }
      }
      if (!gut) continue;
      const spiegel = wuerfel.map((p) => [-p[0], p[1], p[2]]);
      const spanne = [0, 1, 2].map((a) => Math.max(...wuerfel.map((p) => p[a])) - Math.min(...wuerfel.map((p) => p[a])));
      if (gestalt(wuerfel) !== gestalt(spiegel) && Math.min(...spanne) >= 1 && Math.max(...spanne) <= 4) return wuerfel;
    }
    return [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0], [2, 1, 1], [2, 1, 2]];
  }

  function drehenBau(r, stufe) {
    const figur = figurBau(r, [3, 4, 4][stufe]);
    const spiegel = figur.map((p) => [-p[0], p[1], p[2]]);
    const wahl = stufe === 2 ? 4 : 3;
    // Die Lagen: leicht nur um die Hochachse gedreht, sonst irgendwie.
    const umZ = LAGEN.filter((m) => m[2][2] === 1 && !(m[0][0] === 1 && m[1][1] === 1));
    const frei = LAGEN.filter((m) => !(m[0][0] === 1 && m[1][1] === 1 && m[2][2] === 1));
    const lagen = gemischt(r, stufe === 0 ? umZ : frei);
    const soll = ganz(r, 0, wahl - 1);
    const bilder = [];
    for (let i = 0; i < wahl; i += 1) {
      const lage = lagen[i % lagen.length];
      bilder.push({ lage, gespiegelt: i !== soll, wuerfel: (i === soll ? figur : spiegel).map((p) => rundV(mVec(lage, p))) });
    }
    return { eingabe: "wahl", wahl, soll, figur, bilder, farbe: ganz(r, 0, 5) };
  }

  // --- Der Spielwürfel rollt -------------------------------------------------
  // Die Augen eines Spielwürfels in seiner Grundlage: oben 1, unten 6, vorn
  // links (-x) 2, hinten (+x) 5, vorn rechts (-y) 3, hinten (+y) 4 – wie bei
  // einem echten: 1, 2 und 3 liegen gegen den Uhrzeigersinn um ihre Ecke.
  const AUGEN = [[[0, 0, 1], 1], [[0, 0, -1], 6], [[-1, 0, 0], 2], [[1, 0, 0], 5], [[0, -1, 0], 3], [[0, 1, 0], 4]];
  // Welche Zahl in die Richtung n schaut, wenn der Würfel in der Lage m liegt.
  const augeNach = (m, n) => AUGEN.find(([lokal]) => { const w = rundV(mVec(m, lokal)); return w[0] === n[0] && w[1] === n[1] && w[2] === n[2]; })[1];
  // Rollen: eine Vierteldrehung um die Kante, über die es geht.
  const ROLL = { "1,0": [0, 1, 0], "-1,0": [0, -1, 0], "0,1": [-1, 0, 0], "0,-1": [1, 0, 0] };
  const rollLage = (m, dx, dy) => mMal(drehung(ROLL[`${dx},${dy}`], Math.PI / 2), m).map(rundV);

  function rollenBau(r, stufe) {
    const n = 5;
    const schritte = [3, 5, 7][stufe];
    for (let versuch = 0; versuch < 200; versuch += 1) {
      let ort = [ganz(r, 0, n - 1), ganz(r, 0, n - 1)];
      const start = [...ort];
      const weg = [];
      const besucht = new Set([ort.join(",")]);
      let zuletzt = null;
      let wechsel = 0;
      while (weg.length < schritte) {
        const frei = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => {
          const x = ort[0] + dx;
          const y = ort[1] + dy;
          return x >= 0 && x < n && y >= 0 && y < n && !besucht.has(`${x},${y}`);
        });
        if (!frei.length) break;
        // Meist geradeaus, manchmal um die Ecke.
        const gerade = zuletzt && frei.find(([dx, dy]) => dx === zuletzt[0] && dy === zuletzt[1]);
        const zug = gerade && r() < 0.5 ? gerade : waehle(r, frei);
        if (zuletzt && (zug[0] !== zuletzt[0] || zug[1] !== zuletzt[1])) wechsel += 1;
        zuletzt = zug;
        ort = [ort[0] + zug[0], ort[1] + zug[1]];
        besucht.add(ort.join(","));
        weg.push(zug);
      }
      if (weg.length < schritte || wechsel < [0, 1, 2][stufe]) continue;
      const lage = waehle(r, LAGEN);
      let m = lage;
      for (const [dx, dy] of weg) m = rollLage(m, dx, dy);
      const oben = augeNach(m, [0, 0, 1]);
      // Nicht dieselbe Zahl wie am Anfang – das wäre geraten.
      if (oben === augeNach(lage, [0, 0, 1]) && versuch < 150) continue;
      return { eingabe: "wahl", wahl: 6, soll: oben - 1, n, start, weg, lage };
    }
    return { eingabe: "wahl", wahl: 6, soll: augeNach(rollLage(EINS, 1, 0), [0, 0, 1]) - 1, n, start: [1, 2], weg: [[1, 0]], lage: EINS };
  }

  // --- Der Schnitt -----------------------------------------------------------
  // Die zwölf Kanten des Würfels [0,1]³: von a nach b.
  const KANTEN = (() => {
    const raus = [];
    for (let i = 0; i < 8; i += 1) for (let bit = 0; bit < 3; bit += 1) {
      if (i & (1 << bit)) continue;
      const a = [i & 1, (i >> 1) & 1, (i >> 2) & 1];
      const b = [...a];
      b[bit] = 1;
      raus.push([a, b]);
    }
    return raus;
  })();

  // Wo die Ebene durch drei Punkte die Kanten des Würfels schneidet: die
  // Ecken der Schnittfläche, im Kreis geordnet – oder null, wenn sie einer
  // Würfelecke zu nahe kommt.
  function schnittFlaeche(p1, p2, p3) {
    const n = vKreuz(vMinus(p2, p1), vMinus(p3, p1));
    if (vLang(n) < 1e-6) return null;
    const d = vPunkt(n, p1);
    const ecken = [];
    for (const [a, b] of KANTEN) {
      const fa = vPunkt(n, a) - d;
      const fb = vPunkt(n, b) - d;
      if (Math.abs(fa - fb) < 1e-9) { if (Math.abs(fa) < 1e-6) return null; continue; }
      const t = fa / (fa - fb);
      if (t < -1e-9 || t > 1 + 1e-9) continue;
      // Zu nah an einer Ecke: Dann wäre nicht klar, wie viele es sind.
      if (t < 0.08 || t > 0.92) return null;
      ecken.push(vPlus(a, vMal(vMinus(b, a), t)));
    }
    if (ecken.length < 3) return null;
    const mitte = vMal(ecken.reduce((s, p) => vPlus(s, p), [0, 0, 0]), 1 / ecken.length);
    const nn = vNorm(n);
    const u = vNorm(vMinus(ecken[0], mitte));
    const v = vKreuz(nn, u);
    const winkel = (p) => Math.atan2(vPunkt(vMinus(p, mitte), v), vPunkt(vMinus(p, mitte), u));
    return ecken.sort((a, b) => winkel(a) - winkel(b));
  }

  function schnittBau(r, stufe) {
    const wunsch = stufe === 1 ? waehle(r, [3, 4, 4, 5]) : waehle(r, [4, 5, 5, 6, 6]);
    const stellen = [0.25, 0.5, 0.75, 0.33, 0.67];
    for (let versuch = 0; versuch < 3000; versuch += 1) {
      const drei = gemischt(r, KANTEN).slice(0, 3);
      const punkte = drei.map(([a, b]) => vPlus(a, vMal(vMinus(b, a), waehle(r, stellen))));
      // Nicht alle drei auf derselben Seite des Würfels.
      if ([0, 1, 2].some((a) => punkte.every((p) => p[a] === 0) || punkte.every((p) => p[a] === 1))) continue;
      const flaeche = schnittFlaeche(...punkte);
      if (!flaeche || (flaeche.length !== wunsch && versuch < 2500)) continue;
      return { eingabe: "wahl", wahl: 4, soll: flaeche.length - 3, punkte, flaeche };
    }
    const punkte = [[0.5, 0, 0], [0, 0.5, 0], [0, 0, 0.5]];
    return { eingabe: "wahl", wahl: 4, soll: 0, punkte, flaeche: schnittFlaeche(...punkte) };
  }

  // --- Würfel anmalen ----------------------------------------------------------
  // Ein Block aus kleinen Würfeln wird aussen angemalt und dann zerlegt. Wie
  // viele kleine Würfel haben genau so viele farbige Seiten? Auf der schweren
  // Stufe stand der Block beim Anmalen auf dem Boden: Unten bleibt er roh.
  function farbeSeiten(masse, boden, x, y, z) {
    let n = 0;
    if (x === 0) n += 1;
    if (x === masse[0] - 1) n += 1;
    if (y === 0) n += 1;
    if (y === masse[1] - 1) n += 1;
    if (z === masse[2] - 1) n += 1;
    if (z === 0 && boden) n += 1;
    return n;
  }

  function farbeBau(r, stufe) {
    const bloecke = [[[3, 3, 3]], [[3, 3, 4], [4, 4, 4], [2, 3, 4], [3, 4, 4], [2, 4, 4]], [[3, 4, 5], [4, 4, 5], [3, 3, 5], [4, 4, 4], [3, 4, 4]]][stufe];
    for (let versuch = 0; versuch < 200; versuch += 1) {
      const masse = gemischt(r, waehle(r, bloecke));
      const boden = stufe < 2;
      const seiten = stufe === 0 ? waehle(r, [3, 2, 1]) : ganz(r, 0, 3);
      let soll = 0;
      for (let x = 0; x < masse[0]; x += 1) for (let y = 0; y < masse[1]; y += 1) for (let z = 0; z < masse[2]; z += 1) if (farbeSeiten(masse, boden, x, y, z) === seiten) soll += 1;
      // Null lässt sich nicht tippen – und wäre geraten.
      if (soll < 1 || soll > 99) continue;
      return { eingabe: "zahl", masse, boden, seiten, soll, farbe: ganz(r, 0, 5) };
    }
    return { eingabe: "zahl", masse: [3, 3, 3], boden: true, seiten: 2, soll: 12, farbe: 0 };
  }

  // --- Welcher Würfel? ---------------------------------------------------------
  // Ein Netz mit sechs Zeichen, eines je Fläche – und Würfel, von denen genau
  // einer aus dem Netz zu falten ist. Die falschen zeigen zwei Zeichen
  // nebeneinander, die sich gegenüberliegen; oder dieselben drei, aber
  // verkehrt herum um die Ecke; oder (schwer) ein Zeichen verdreht.
  // dreh: wie viele Lagen ein Zeichen hat (1: sieht nach jeder Vierteldrehung
  // gleich aus, 2: nach einer halben, 4: nie).
  const ZEICHEN = [
    { form: "punkt", dreh: 1 }, { form: "ring", dreh: 1 }, { form: "kreuz", dreh: 1 }, { form: "quadrat", dreh: 1 }, { form: "vier", dreh: 1 }, { form: "stern", dreh: 1 },
    { form: "balken", dreh: 2 }, { form: "zwei", dreh: 2 }, { form: "pfeil", dreh: 4 }, { form: "halb", dreh: 4 }, { form: "ecke", dreh: 4 }, { form: "keil", dreh: 4 },
  ];
  // Die drei Seiten, die die Kamera sieht: oben, vorn links (-x), vorn rechts (-y).
  const SICHTBAR = [[0, 0, 1], [-1, 0, 0], [0, -1, 0]];
  const gleichV = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

  // Wie ein Würfel aussieht, wenn er in der Lage m liegt: je sichtbare Seite,
  // welches Zeichen dort steht und wohin es zeigt. zu: die Flächen des
  // gefalteten Netzes (netzLage), belegung[i]: das Zeichen auf Fläche i,
  // dreh[i]: um wie viele Vierteldrehungen es dort gedreht ist.
  function musterAnsicht(zu, zeichen, belegung, dreh, m) {
    return SICHTBAR.map((d) => {
      const i = zu.findIndex((l) => gleichV(rundV(mVec(m, vKreuz(l.ex, l.ey))), d));
      const z = zeichen[belegung[i]];
      const q = ((dreh[i] % 4) + 4) % 4;
      const lokal = [zu[i].ex, zu[i].ey, vMal(zu[i].ex, -1), vMal(zu[i].ey, -1)][q];
      let hin = rundV(mVec(m, lokal));
      if (z.dreh === 1) hin = [0, 0, 0];
      else if (z.dreh === 2 && (hin[0] < 0 || (hin[0] === 0 && (hin[1] < 0 || (hin[1] === 0 && hin[2] < 0))))) hin = vMal(hin, -1);
      return `${belegung[i]}:${hin.join(",")}`;
    }).join(" ");
  }

  function musterBau(r, stufe) {
    const roh = NETZE[stufe === 0 ? waehle(r, NETZE_LEICHT) : ganz(r, 0, NETZE.length - 1)];
    const dreh = ganz(r, 0, 3);
    const spiegel = r() < 0.5;
    let felder = roh.map(([x, y]) => {
      let p = [spiegel ? -x : x, y];
      for (let i = 0; i < dreh; i += 1) p = [-p[1], p[0]];
      return p;
    });
    const minX = Math.min(...felder.map((p) => p[0]));
    const minY = Math.min(...felder.map((p) => p[1]));
    felder = felder.map(([x, y]) => [x - minX, y - minY]);
    const baum = netzBaum(felder);
    const zu = netzLage(felder, baum, Math.PI / 2);
    const aussen = zu.map((l) => rundV(vKreuz(l.ex, l.ey)));
    const gegen = aussen.map((n) => aussen.findIndex((o) => gleichV(o, vMal(n, -1))));
    const wahl = stufe === 0 ? 3 : 4;
    const basis = { felder, baum, breit: Math.max(...felder.map((p) => p[0])) + 1, hoch: Math.max(...felder.map((p) => p[1])) + 1 };
    for (let versuch = 0; versuch < 300; versuch += 1) {
      // Sechs Zeichen: leicht und mittel ohne Richtung, schwer mit.
      const zeichen = (stufe < 2 ? gemischt(r, [0, 1, 2, 3, 4, 5]) : gemischt(r, [...gemischt(r, [8, 9, 10, 11]).slice(0, 3), ...gemischt(r, [6, 7]).slice(0, 1), ...gemischt(r, [0, 1, 2, 3, 4, 5]).slice(0, 2)]))
        .map((nr) => ({ ...ZEICHEN[nr], nr }));
      const farben = stufe < 2 ? gemischt(r, [0, 1, 2, 3, 4, 5]) : null;
      const belegung = [0, 1, 2, 3, 4, 5];
      const lagen = belegung.map(() => ganz(r, 0, 3));
      const echt = new Set(LAGEN.map((m) => musterAnsicht(zu, zeichen, belegung, lagen, m)));
      const arten = [["gegen", "gegen"], ["gegen", "spiegel", "spiegel"], ["spiegel", "dreh", "dreh"]][stufe];
      const soll = ganz(r, 0, wahl - 1);
      const bilder = [];
      const gesehen = new Set();
      let gut = true;
      for (let i = 0; i < wahl && gut; i += 1) {
        const art = i === soll ? "echt" : arten[i < soll ? i : i - 1];
        let bild = null;
        for (let k = 0; k < 60 && !bild; k += 1) {
          const m = waehle(r, LAGEN);
          const b = [...belegung];
          const d = [...lagen];
          const vorn = SICHTBAR.map((s) => aussen.findIndex((n) => gleichV(rundV(mVec(m, n)), s)));
          const [j, l] = gemischt(r, [0, 1, 2]);
          if (art === "gegen") { const o = gegen[vorn[l]]; [b[vorn[j]], b[o]] = [b[o], b[vorn[j]]]; [d[vorn[j]], d[o]] = [d[o], d[vorn[j]]]; }
          else if (art === "spiegel") { [b[vorn[j]], b[vorn[l]]] = [b[vorn[l]], b[vorn[j]]]; [d[vorn[j]], d[vorn[l]]] = [d[vorn[l]], d[vorn[j]]]; }
          else if (art === "dreh") {
            const f = vorn.find((x) => zeichen[b[x]].dreh > 1);
            if (f === undefined) continue;
            d[f] += zeichen[b[f]].dreh === 2 ? 1 : ganz(r, 1, 3);
          }
          const sicht = musterAnsicht(zu, zeichen, b, d, m);
          if ((art === "echt") !== echt.has(sicht) || gesehen.has(sicht)) continue;
          gesehen.add(sicht);
          bild = { m, belegung: b, dreh: d, art };
        }
        if (!bild) gut = false; else bilder.push(bild);
      }
      if (gut) return { ...basis, eingabe: "wahl", wahl, soll, zeichen, farben, lagen, bilder };
    }
    return musterBau(r, 0);
  }

  // --- Lücke füllen ------------------------------------------------------------
  // Einem Würfel aus 3 × 3 × 3 kleinen fehlt ein Stück. Welches der Teile
  // füllt die Lücke? Jeder fehlende Würfel ist von vorn links, von vorn
  // rechts oder von oben zu sehen – nichts fehlt im Verborgenen.
  const LUECKE_N = 3;
  const nachbarn6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const zusammen = (liste) => {
    const da = new Set(liste.map((p) => p.join(",")));
    const reihe = [liste[0]];
    const besucht = new Set([liste[0].join(",")]);
    for (let i = 0; i < reihe.length; i += 1) for (const d of nachbarn6) {
      const q = vPlus(reihe[i], d);
      const s = q.join(",");
      if (da.has(s) && !besucht.has(s)) { besucht.add(s); reihe.push(q); }
    }
    return reihe.length === liste.length;
  };

  // Ein Stück aus zahl Würfeln, das aus dem Block herausgenommen ist – so,
  // dass man jeden fehlenden Würfel sieht.
  function lueckeStueck(r, zahl) {
    const n = LUECKE_N;
    const drin = (p) => p.every((x) => x >= 0 && x < n);
    for (let versuch = 0; versuch < 200; versuch += 1) {
      const weg = [];
      const hat = (p) => weg.some((q) => gleichV(q, p));
      // Zu sehen: vorn links (alles davor fehlt auch), vorn rechts oder oben.
      const offen = (p) => {
        let a = true, b = true, c = true;
        for (let x = 0; x < p[0]; x += 1) if (!hat([x, p[1], p[2]])) a = false;
        for (let y = 0; y < p[1]; y += 1) if (!hat([p[0], y, p[2]])) b = false;
        for (let z = p[2] + 1; z < n; z += 1) if (!hat([p[0], p[1], z])) c = false;
        return a || b || c;
      };
      // Der erste liegt an einer Seite, die man sieht.
      const start = [ganz(r, 0, n - 1), ganz(r, 0, n - 1), ganz(r, 0, n - 1)];
      const seite = ganz(r, 0, 2);
      start[seite] = seite === 2 ? n - 1 : 0;
      weg.push(start);
      for (let schritt = 0; schritt < 80 && weg.length < zahl; schritt += 1) {
        const q = vPlus(waehle(r, weg), waehle(r, nachbarn6));
        if (drin(q) && !hat(q) && offen(q)) weg.push(q);
      }
      if (weg.length === zahl && weg.every(offen)) return weg;
    }
    return [[0, 0, 2], [1, 0, 2], [0, 1, 2]].slice(0, zahl);
  }

  // Ein anderes Stück mit gleich vielen Würfeln: ein Würfel sitzt woanders.
  function lueckeAnders(r, stueck) {
    for (let versuch = 0; versuch < 80; versuch += 1) {
      const rest = gemischt(r, stueck).slice(1);
      if (!zusammen(rest)) continue;
      const neu = vPlus(waehle(r, rest), waehle(r, nachbarn6));
      if (rest.some((q) => gleichV(q, neu))) continue;
      const liste = [...rest, neu];
      const spanne = [0, 1, 2].map((a) => Math.max(...liste.map((p) => p[a])) - Math.min(...liste.map((p) => p[a])));
      if (Math.max(...spanne) <= 2) return liste;
    }
    return null;
  }

  function lueckeBau(r, stufe) {
    const wahl = stufe === 0 ? 3 : 4;
    for (let versuch = 0; versuch < 200; versuch += 1) {
      const zahl = [4, 4, 5][stufe] + (stufe > 0 && r() < 0.4 ? 1 : 0);
      const weg = lueckeStueck(r, zahl);
      if (weg.length !== zahl) continue;
      const form = gestalt(weg);
      const spiegel = weg.map((p) => [-p[0], p[1], p[2]]);
      // Mittel und schwer: ein Stück, das nicht flach liegt.
      const spanne = [0, 1, 2].map((a) => Math.max(...weg.map((p) => p[a])) - Math.min(...weg.map((p) => p[a])));
      if (stufe > 0 && Math.min(...spanne) < 1) continue;
      const formen = new Set([form]);
      const andere = [];
      // Schwer: das Spiegelbild ist dabei, wenn es ein anderes Stück ist.
      if (stufe === 2 && gestalt(spiegel) !== form) { andere.push(spiegel); formen.add(gestalt(spiegel)); }
      for (let k = 0; k < 60 && andere.length < wahl - 1; k += 1) {
        const a = lueckeAnders(r, weg);
        if (!a || formen.has(gestalt(a))) continue;
        formen.add(gestalt(a));
        andere.push(a);
      }
      if (andere.length < wahl - 1) continue;
      const soll = ganz(r, 0, wahl - 1);
      const umZ = LAGEN.filter((m) => m[2][2] === 1 && !(m[0][0] === 1 && m[1][1] === 1));
      const frei = LAGEN.filter((m) => !(m[0][0] === 1 && m[1][1] === 1 && m[2][2] === 1));
      const falsche = gemischt(r, andere);
      const bilder = [];
      for (let i = 0; i < wahl; i += 1) {
        const lage = waehle(r, stufe === 0 ? umZ : frei);
        const stueck = i === soll ? weg : falsche.pop();
        bilder.push({ lage, passt: i === soll, wuerfel: stueck.map((p) => rundV(mVec(lage, p))) });
      }
      return { eingabe: "wahl", wahl, soll, n: LUECKE_N, weg, bilder, farbe: ganz(r, 0, 5) };
    }
    const weg = [[0, 0, 2], [1, 0, 2], [0, 1, 2]];
    return { eingabe: "wahl", wahl: 3, soll: 0, n: LUECKE_N, weg, bilder: [{ lage: EINS, passt: true, wuerfel: weg }, { lage: EINS, passt: false, wuerfel: [[0, 0, 0], [1, 0, 0], [2, 0, 0]] }, { lage: EINS, passt: false, wuerfel: [[0, 0, 0], [1, 0, 0], [1, 0, 1]] }], farbe: 0 };
  }

  // --- Drei Schatten -----------------------------------------------------------
  // Ein Stapel in der Ecke eines Zimmers wirft drei Schatten: an die linke
  // Wand (die Säulen von links nach rechts, entlang x), an die rechte Wand
  // (entlang y) und auf den Boden. Welcher Stapel ist es?
  const SCHATTEN_N = 3;
  function schattenVon(hoehen) {
    const n = hoehen.length;
    return {
      links: hoehen.map((spalte) => Math.max(...spalte)),
      rechts: hoehen[0].map((_, y) => Math.max(...hoehen.map((spalte) => spalte[y]))),
      boden: hoehen.map((spalte) => spalte.map((h) => (h > 0 ? 1 : 0))),
      n,
    };
  }
  const schattenText = (s) => `${s.links.join("")}|${s.rechts.join("")}|${s.boden.map((x) => x.join("")).join("")}`;
  // Keine Säule steht ganz hinter einer höheren verborgen.
  function stapelOffen(h) {
    const n = h.length;
    for (let x = 0; x < n; x += 1) for (let y = 0; y < n; y += 1) {
      if (!h[x][y]) continue;
      for (let k = 1; x - k >= 0 && y - k >= 0; k += 1) if (h[x - k][y - k] >= h[x][y] + k) return false;
    }
    return true;
  }

  function schattenBau(r, stufe) {
    const n = SCHATTEN_N;
    const hoch = [2, 3, 3][stufe];
    const wahl = stufe === 0 ? 3 : 4;
    for (let versuch = 0; versuch < 300; versuch += 1) {
      const h = [];
      for (let x = 0; x < n; x += 1) { h.push([]); for (let y = 0; y < n; y += 1) h[x].push(r() < [0.5, 0.42, 0.3][stufe] ? 0 : ganz(r, 1, hoch)); }
      const summe = h.flat().reduce((s, x) => s + x, 0);
      if (summe < [4, 6, 9][stufe] || summe > [7, 10, 14][stufe] || !stapelOffen(h) || !zusammen(h.flatMap((spalte, x) => spalte.map((v, y) => (v ? [x, y, 0] : null))).filter(Boolean))) continue;
      const echt = schattenVon(h);
      const text = schattenText(echt);
      // Die falschen: ein Würfel sitzt woanders, einer fehlt oder ist zu viel.
      const texte = new Set([JSON.stringify(h)]);
      const andere = [];
      for (let k = 0; k < 200 && andere.length < wahl - 1; k += 1) {
        const g2 = h.map((spalte) => [...spalte]);
        const von = [ganz(r, 0, n - 1), ganz(r, 0, n - 1)];
        const nach = [ganz(r, 0, n - 1), ganz(r, 0, n - 1)];
        const zug = r();
        if (zug < 0.6) { if (!g2[von[0]][von[1]] || g2[nach[0]][nach[1]] >= hoch || (von[0] === nach[0] && von[1] === nach[1])) continue; g2[von[0]][von[1]] -= 1; g2[nach[0]][nach[1]] += 1; }
        else if (zug < 0.8) { if (!g2[von[0]][von[1]]) continue; g2[von[0]][von[1]] -= 1; }
        else { if (g2[nach[0]][nach[1]] >= hoch) continue; g2[nach[0]][nach[1]] += 1; }
        const s = schattenVon(g2);
        if (schattenText(s) === text || texte.has(JSON.stringify(g2)) || !stapelOffen(g2)) continue;
        // Schwer: Nur einer der drei Schatten verrät den Unterschied.
        const anders = (s.links.join("") !== echt.links.join("") ? 1 : 0) + (s.rechts.join("") !== echt.rechts.join("") ? 1 : 0) + (JSON.stringify(s.boden) !== JSON.stringify(echt.boden) ? 1 : 0);
        if (stufe === 2 && anders !== 1 && k < 150) continue;
        texte.add(JSON.stringify(g2));
        andere.push(g2);
      }
      if (andere.length < wahl - 1) continue;
      const soll = ganz(r, 0, wahl - 1);
      const bilder = [];
      for (let i = 0; i < wahl; i += 1) bilder.push(i === soll ? h : andere.pop());
      return { eingabe: "wahl", wahl, soll, n, hoch: Math.max(2, ...bilder.flat(2)), schatten: echt, bilder, farbe: ganz(r, 0, 5) };
    }
    const h = [[1, 0, 0], [2, 1, 0], [0, 0, 0]];
    return { eingabe: "wahl", wahl: 3, soll: 0, n, hoch: 2, schatten: schattenVon(h), bilder: [h, [[1, 1, 0], [2, 0, 0], [0, 0, 0]], [[2, 0, 0], [1, 1, 0], [0, 0, 0]]], farbe: 0 };
  }

  // --- Drehkörper --------------------------------------------------------------
  // Eine flache Form dreht sich um eine Achse – welcher Körper entsteht? Die
  // Form ist ein Vieleck aus Punkten [r, z]: r der Abstand von der Achse, z
  // die Höhe; gegen den Uhrzeigersinn umlaufen.
  const bogen = (mr, mz, rad, von, bis, teile) => { const p = []; for (let i = 0; i <= teile; i += 1) { const w = lerp(von, bis, i / teile); p.push([Math.max(0, mr + Math.cos(w) * rad), mz + Math.sin(w) * rad]); } return p; };
  // Aus Abschnitten übereinander: je [r unten, r oben, Höhe]; loch: der
  // Halbmesser einer Bohrung längs der Achse.
  function profilAus(abschnitte, loch = 0) {
    const p = [[loch, 0]];
    let z = 0;
    for (const [r0, r1, h] of abschnitte) {
      p.push([Math.max(r0, loch), z]);
      z += h;
      p.push([Math.max(r1, loch), z]);
    }
    p.push([loch, z]);
    // Doppelte Punkte fallen weg.
    return p.filter((q, i) => { const v = p[(i + p.length - 1) % p.length]; return Math.abs(q[0] - v[0]) > 1e-9 || Math.abs(q[1] - v[1]) > 1e-9; });
  }
  const PROFILE = {
    zylinder: () => profilAus([[0.8, 0.8, 1.6]]),
    kegel: () => profilAus([[0.95, 0, 1.7]]),
    spitze: () => profilAus([[0, 0.95, 1.7]]),
    stumpf: () => profilAus([[1, 0.5, 1.5]]),
    doppel: () => profilAus([[0, 0.95, 0.85], [0.95, 0, 0.85]]),
    kugel: () => bogen(0, 0.9, 0.9, -Math.PI / 2, Math.PI / 2, 10),
    kuppel: () => [[0, 0], ...bogen(0, 0, 1, 0, Math.PI / 2, 8)],
    scheibe: () => profilAus([[1.05, 1.05, 0.45]]),
    rohr: () => profilAus([[0.9, 0.9, 1.5]], 0.5),
    ring: () => bogen(0.72, 0.36, 0.36, 0, TAU, 12).slice(0, -1),
    stufe: () => profilAus([[1, 1, 0.6], [0.5, 0.5, 0.95]]),
    sanduhr: () => profilAus([[0.9, 0.22, 0.85], [0.22, 0.9, 0.85]]),
    rakete: () => profilAus([[0.6, 0.6, 1.05], [0.6, 0, 0.75]]),
    pilz: () => [[0, 0], [0.3, 0], [0.3, 0.85], ...bogen(0, 0.85, 1, 0, Math.PI / 2, 8)],
    trichter: () => profilAus([[1, 0.6, 1.5]], 0.45),
    kreisel: () => profilAus([[0, 1, 0.7], [1, 1, 0.3], [0.3, 0.3, 0.7]]),
    spule: () => profilAus([[1, 1, 0.35], [0.4, 0.4, 0.9], [1, 1, 0.35]]),
    kelch: () => profilAus([[0.75, 0.2, 0.5], [0.2, 0.2, 0.45], [0.2, 0.95, 0.7]]),
  };
  const PROFIL_LEICHT = ["zylinder", "kegel", "spitze", "stumpf", "doppel", "kugel", "kuppel", "scheibe"];
  // Die mittleren, und womit man sie verwechselt.
  const PROFIL_MITTEL = {
    rohr: ["zylinder", "ring", "trichter"], ring: ["rohr", "scheibe", "kugel"], stufe: ["rakete", "pilz", "spule"], sanduhr: ["doppel", "spule", "kelch"],
    rakete: ["stufe", "kegel", "zylinder"], pilz: ["stufe", "kuppel", "kreisel"], trichter: ["stumpf", "rohr", "kegel"], kreisel: ["doppel", "pilz", "kelch"],
    spule: ["sanduhr", "stufe", "zylinder"], kelch: ["sanduhr", "kreisel", "spitze"],
  };
  const profilText = (p) => p.map(([a, b]) => `${a.toFixed(2)}/${b.toFixed(2)}`).join(" ");

  function drehkoerperBau(r, stufe) {
    const wahl = stufe === 0 ? 3 : 4;
    const soll = ganz(r, 0, wahl - 1);
    let profile = null;
    let namen = null;
    if (stufe === 0) {
      namen = gemischt(r, PROFIL_LEICHT).slice(0, wahl);
      profile = namen.map((name) => PROFILE[name]());
    } else if (stufe === 1) {
      const name = waehle(r, Object.keys(PROFIL_MITTEL));
      const andere = gemischt(r, PROFIL_MITTEL[name]);
      namen = [];
      for (let i = 0; i < wahl; i += 1) namen.push(i === soll ? name : andere.pop());
      profile = namen.map((n) => PROFILE[n]());
    } else {
      // Schwer: drei Abschnitte aus dem Zufall – und Körper, die ihm ähneln:
      // auf dem Kopf, mit einer Stufe statt einer Schräge, mit oder ohne Bohrung.
      const stufen = [0.3, 0.55, 0.8, 1];
      for (let versuch = 0; versuch < 400 && !profile; versuch += 1) {
        const loch = r() < 0.35 ? 0.18 : 0;
        const teile = [];
        let unten = waehle(r, stufen);
        for (let i = 0; i < 3; i += 1) {
          const schraeg = r() < 0.55;
          const oben = schraeg ? waehle(r, stufen.filter((x) => x !== unten)) : unten;
          teile.push([unten, oben, waehle(r, [0.45, 0.6, 0.75])]);
          // Der nächste Abschnitt setzt an oder springt.
          unten = r() < 0.5 ? oben : waehle(r, stufen.filter((x) => x !== oben));
        }
        if (teile.filter((t) => t[0] !== t[1]).length < 1) continue;
        // Nie höher als 1.8 – so passt jeder Körper in seinen Platz.
        const ganzHoch = teile.reduce((summe, t) => summe + t[2], 0);
        if (ganzHoch > 1.8) for (const t of teile) t[2] *= 1.8 / ganzHoch;
        const kopf = teile.map(([a, b, h]) => [b, a, h]).reverse();
        const eckig = teile.map(([a, b, h]) => (a !== b ? [Math.max(a, b), Math.max(a, b), h] : [a, b, h]));
        const anders = teile.map(([a, b, h], i) => (i === 1 ? [b, a, h] : [a, b, h]));
        const kandidaten = [profilAus(kopf, loch), profilAus(eckig, loch), profilAus(teile, loch ? 0 : 0.18), profilAus(anders, loch), profilAus(teile.map(([a, b, h], i) => (i === 2 ? [b, a, h] : [a, b, h])), loch)];
        const echt = profilAus(teile, loch);
        const texte = new Set([profilText(echt)]);
        const falsch = [];
        for (const k of gemischt(r, kandidaten)) { if (!texte.has(profilText(k))) { texte.add(profilText(k)); falsch.push(k); } }
        if (falsch.length < wahl - 1) continue;
        profile = [];
        for (let i = 0; i < wahl; i += 1) profile.push(i === soll ? echt : falsch.pop());
      }
      if (!profile) return drehkoerperBau(r, 1);
    }
    return { eingabe: "wahl", wahl, soll, profile, namen, farbe: ganz(r, 0, 5) };
  }

  // --- Laser und Spiegel -------------------------------------------------------
  // Ein Feld aus n × n Zellen (x nach rechts, y nach unten), in manchen ein
  // schräger Spiegel: 1 «/», 2 «\». Der Strahl tritt an einer Stelle des
  // Rands ein; die Stellen sind rundum gezählt – oben von links nach rechts
  // (0 … n-1), dann rechts von oben nach unten, unten von links nach rechts,
  // links von oben nach unten.
  function laserRand(n, stelle) {
    const seite = Math.floor(stelle / n);
    const i = stelle % n;
    if (seite === 0) return { x: i, y: 0, dx: 0, dy: 1, px: i + 0.5, py: 0 };
    if (seite === 1) return { x: n - 1, y: i, dx: -1, dy: 0, px: n, py: i + 0.5 };
    if (seite === 2) return { x: i, y: n - 1, dx: 0, dy: -1, px: i + 0.5, py: n };
    return { x: 0, y: i, dx: 1, dy: 0, px: 0, py: i + 0.5 };
  }

  // Der Weg des Strahls: die Punkte, an denen er knickt, wo er austritt, und
  // welche Zellen er berührt.
  function laserWeg(n, spiegel, ein) {
    const s = laserRand(n, ein);
    let { x, y, dx, dy } = s;
    const punkte = [[s.px, s.py]];
    const treffer = [];
    const zellen = new Set();
    for (let schritt = 0; schritt < n * n * 4; schritt += 1) {
      if (x < 0 || y < 0 || x >= n || y >= n) break;
      zellen.add(y * n + x);
      const art = spiegel[y * n + x];
      if (art) {
        punkte.push([x + 0.5, y + 0.5]);
        treffer.push(y * n + x);
        [dx, dy] = art === 1 ? [-dy, -dx] : [dy, dx];
      }
      x += dx;
      y += dy;
    }
    const aus = y < 0 ? x : x >= n ? n + y : y >= n ? 2 * n + x : 3 * n + y;
    const rand = laserRand(n, aus);
    punkte.push([rand.px, rand.py]);
    return { punkte, treffer, zellen, aus };
  }

  function laserBau(r, stufe) {
    const n = [4, 5, 6][stufe];
    const mind = [2, 3, 5][stufe];
    const dazu = [1, 2, 4][stufe];
    for (let versuch = 0; versuch < 3000; versuch += 1) {
      const spiegel = new Array(n * n).fill(0);
      for (let i = 0; i < n * n; i += 1) if (r() < [0.3, 0.3, 0.34][stufe]) spiegel[i] = r() < 0.5 ? 1 : 2;
      const ein = ganz(r, 0, 4 * n - 1);
      const weg = laserWeg(n, spiegel, ein);
      const zahl = new Set(weg.treffer).size;
      if (zahl < mind || zahl > mind + 2) continue;
      // Was er nicht trifft, fällt weg – bis auf ein paar Spiegel, die nur da stehen.
      const frei = gemischt(r, spiegel.map((_, i) => i).filter((i) => !weg.zellen.has(i)));
      for (let i = 0; i < n * n; i += 1) if (!weg.treffer.includes(i)) spiegel[i] = 0;
      for (const i of frei.slice(0, dazu)) spiegel[i] = r() < 0.5 ? 1 : 2;
      return { eingabe: "wahl", wahl: 4 * n, soll: weg.aus, n, spiegel, ein, punkte: weg.punkte, treffer: zahl };
    }
    const spiegel = new Array(16).fill(0);
    spiegel[5] = 2; spiegel[13] = 1;
    const weg = laserWeg(4, spiegel, 13);
    return { eingabe: "wahl", wahl: 16, soll: weg.aus, n: 4, spiegel, ein: 13, punkte: weg.punkte, treffer: 2 };
  }

  // --- Zahnräder ---------------------------------------------------------------
  // Räder in einer Ebene: Jedes hängt an einem früheren – über die Zähne (dann
  // dreht es andersherum), über einen geraden Riemen (gleich herum) oder einen
  // gekreuzten (andersherum). Das erste treibt an, im Uhrzeigersinn.
  // rad: { x, y, z (Zähne), von, art ("zahn" | "riemen" | "kreuz"), sinn (1: im Uhrzeigersinn) }
  const ZAHN_MODUL = 0.1;
  const radHalb = (z) => z * ZAHN_MODUL;
  function zahnradBau(r, stufe) {
    const zahl = [4, 6, 8][stufe] + (r() < 0.5 ? 1 : 0);
    const zaehne = stufe === 0 ? [10, 12] : [8, 10, 12, 16];
    for (let versuch = 0; versuch < 400; versuch += 1) {
      const raeder = [{ x: 0, y: 0, z: waehle(r, zaehne), von: -1, art: "", sinn: 1 }];
      let riemen = stufe === 2 ? 2 : stufe === 1 && r() < 0.5 ? 1 : 0;
      let fehl = 0;
      while (raeder.length < zahl && fehl < 200) {
        // Leicht: eine Kette. Sonst verzweigt es sich.
        const von = stufe === 0 || r() < 0.45 ? raeder.length - 1 : ganz(r, 0, raeder.length - 1);
        const e = raeder[von];
        const z = waehle(r, zaehne);
        const art = riemen > 0 && raeder.length > 1 && r() < 0.4 ? (r() < 0.5 ? "riemen" : "kreuz") : "zahn";
        const weit = radHalb(e.z) + radHalb(z) + (art === "zahn" ? 0 : 0.9 + r() * 0.8);
        const w = r() * TAU;
        const neu = { x: e.x + Math.cos(w) * weit, y: e.y + Math.sin(w) * weit, z, von, art, sinn: art === "riemen" ? e.sinn : -e.sinn };
        // Kein Rad berührt ein anderes, an dem es nicht hängt.
        let frei = raeder.every((o, i) => (i === von && art === "zahn") || Math.hypot(o.x - neu.x, o.y - neu.y) >= radHalb(o.z) + radHalb(z) + 0.42);
        // Ein Riemen läuft an keinem anderen Rad vorbei.
        if (frei && art !== "zahn") frei = raeder.every((o, i) => {
          if (i === von) return true;
          const t = clamp(((o.x - e.x) * (neu.x - e.x) + (o.y - e.y) * (neu.y - e.y)) / (weit * weit), 0, 1);
          return Math.hypot(o.x - e.x - (neu.x - e.x) * t, o.y - e.y - (neu.y - e.y) * t) >= radHalb(o.z) + 0.55;
        });
        // Und kein Rad steht einem Riemen im Weg.
        if (frei) frei = raeder.every((o) => {
          if (o.von < 0 || o.art === "zahn") return true;
          const p = raeder[o.von];
          const lang = Math.hypot(o.x - p.x, o.y - p.y);
          const t = clamp(((neu.x - p.x) * (o.x - p.x) + (neu.y - p.y) * (o.y - p.y)) / (lang * lang), 0, 1);
          return Math.hypot(neu.x - p.x - (o.x - p.x) * t, neu.y - p.y - (o.y - p.y) * t) >= radHalb(z) + 0.55;
        });
        if (!frei) { fehl += 1; continue; }
        if (art !== "zahn") riemen -= 1;
        raeder.push(neu);
      }
      if (raeder.length < zahl || (stufe === 2 && riemen > 0)) continue;
      const xs = raeder.flatMap((o) => [o.x - radHalb(o.z), o.x + radHalb(o.z)]);
      const ys = raeder.flatMap((o) => [o.y - radHalb(o.z), o.y + radHalb(o.z)]);
      const breit = Math.max(...xs) - Math.min(...xs);
      const hoch = Math.max(...ys) - Math.min(...ys);
      // Nicht zu lang gestreckt – sonst werden die Räder im Bild zu klein.
      if (Math.max(breit, hoch) > Math.min(breit, hoch) * 1.9) continue;
      let soll = 0;
      raeder.forEach((o, i) => { if (i > 0 && o.sinn === 1) soll |= 1 << (i - 1); });
      if (bits(soll) < 1 || bits(soll) >= zahl - 1) continue;
      // Die Zähne greifen ineinander: Wo sich zwei Räder berühren, trifft ein Zahn auf eine Lücke.
      // Ein kleines Rad dreht schneller als das grosse, an dem es hängt.
      raeder[0].phase = r() * TAU;
      raeder[0].tempo = 1;
      raeder.forEach((o) => {
        if (o.von < 0) return;
        const e = raeder[o.von];
        const w = Math.atan2(o.y - e.y, o.x - e.x);
        o.phase = o.art === "zahn" ? w + Math.PI - (Math.PI - (w - e.phase) * e.z) / o.z : r() * TAU;
        o.tempo = o.art === "zahn" ? (e.tempo * e.z) / o.z : e.tempo;
      });
      return { eingabe: "felder", felder: zahl - 1, soll, raeder, box: { x0: Math.min(...xs), y0: Math.min(...ys), breit, hoch } };
    }
    return zahnradBau(r, 0);
  }

  // --- Kugelbahn ---------------------------------------------------------------
  // Von der Seite gesehen: Ebenen mit schrägen Rampen. rampe: { a, b (die
  // Spalten, die sie überdeckt), sinn (1: fällt nach rechts ab, -1: nach
  // links) }. Die Kugel rollt jede Rampe hinunter und fällt an ihrem tiefen
  // Ende in der nächsten Spalte senkrecht weiter; wo keine Rampe ist, fällt
  // sie durch. Unten stehen die Fächer.
  function kugelWeg(rampen, start) {
    let spalte = start;
    const weg = [];
    rampen.forEach((ebene, nr) => {
      const rampe = ebene.find((s) => s.a <= spalte && spalte <= s.b);
      if (!rampe) return;
      const bis = rampe.sinn > 0 ? rampe.b + 1 : rampe.a - 1;
      weg.push({ ebene: nr, von: spalte, bis, sinn: rampe.sinn });
      spalte = bis;
    });
    return { weg, fach: spalte };
  }

  function kugelbahnBau(r, stufe) {
    const breit = [5, 6, 7][stufe];
    const ebenen = [3, 4, 5][stufe];
    for (let versuch = 0; versuch < 2000; versuch += 1) {
      const rampen = [];
      for (let e = 0; e < ebenen; e += 1) {
        const ebene = [];
        const zwei = stufe > 0 && r() < 0.6;
        let ab = ganz(r, 0, zwei ? 1 : breit - 3);
        for (let k = 0; k < (zwei ? 2 : 1); k += 1) {
          const lang = ganz(r, 1, zwei ? 2 : 3);
          const a = ab;
          const b = Math.min(breit - 1, a + lang - 1);
          if (a > breit - 1) break;
          // Das tiefe Ende zeigt nie zur Wand.
          const sinn = a === 0 ? 1 : b === breit - 1 ? -1 : r() < 0.5 ? 1 : -1;
          if ((sinn > 0 && b + 1 > breit - 1) || (sinn < 0 && a - 1 < 0)) break;
          ebene.push({ a, b, sinn });
          ab = b + 2 + ganz(r, 0, 1);
        }
        if (!ebene.length) break;
        rampen.push(ebene);
      }
      if (rampen.length < ebenen) continue;
      const start = ganz(r, 0, breit - 1);
      const lauf = kugelWeg(rampen, start);
      // Die Kugel trifft (fast) jede Ebene, und sie wechselt die Richtung.
      const richtungen = new Set(lauf.weg.map((w) => w.sinn));
      if (lauf.weg.length < ebenen - (stufe === 2 ? 1 : 0) || (stufe > 0 && richtungen.size < 2) || !rampen[0].some((s) => s.a <= start && start <= s.b)) continue;
      return { eingabe: "wahl", wahl: breit, soll: lauf.fach, breit, ebenen, rampen, start, weg: lauf.weg };
    }
    const rampen = [[{ a: 0, b: 1, sinn: 1 }], [{ a: 2, b: 3, sinn: 1 }], [{ a: 3, b: 4, sinn: -1 }]];
    return { eingabe: "wahl", wahl: 5, soll: kugelWeg(rampen, 0).fach, breit: 5, ebenen: 3, rampen, start: 0, weg: kugelWeg(rampen, 0).weg };
  }

  const BAU = {
    falten: faltenBau, netz: netzBau, stapel: stapelBau, ansicht: ansichtBau, drehen: drehenBau, rollen: rollenBau, schnitt: schnittBau,
    farbe: farbeBau, muster: musterBau, luecke: lueckeBau, schatten: schattenBau, drehkoerper: drehkoerperBau, laser: laserBau, zahnrad: zahnradBau, kugelbahn: kugelbahnBau,
  };

  const KURZ = {
    falten: "Falten und lochen", netz: "Würfelnetz", stapel: "Würfel zählen", ansicht: "Ansicht", drehen: "Dieselbe Figur", rollen: "Würfel rollen", schnitt: "Schnitt",
    farbe: "Würfel anmalen", muster: "Welcher Würfel?", luecke: "Lücke füllen", schatten: "Drei Schatten", drehkoerper: "Drehkörper", laser: "Laser und Spiegel", zahnrad: "Zahnräder", kugelbahn: "Kugelbahn",
  };
  const RICHTUNG = ["von links vorn", "von rechts vorn", "von hinten rechts", "von hinten links"];

  // Was zu tun ist – ein Satz je Aufgabe.
  function frageFuer(a) {
    if (a.art === "falten") return "Das Blatt wird gefaltet und dann gelocht. Tippe alle Felder an, die nach dem Auffalten ein Loch haben.";
    if (a.art === "netz") return a.variante === "kante"
      ? "Das Netz wird zum Würfel gefaltet. Tippe die Kante an, die dann auf der roten Kante liegt."
      : "Das Netz wird zum Würfel gefaltet. Tippe die Fläche an, die dann dem Stern gegenüberliegt.";
    if (a.art === "stapel") return "Wie viele Würfel sind es? Keiner schwebt – auch die verdeckten zählen.";
    if (a.art === "ansicht") return `Wie sieht der Stapel ${RICHTUNG[a.richtung]} aus – aus der Richtung des Pfeils? Tippe in jeder Spalte an, wie hoch sie ist.`;
    if (a.art === "drehen") return "Eine der Figuren unten ist die obere, nur gedreht – die anderen sind ihr Spiegelbild. Tippe die richtige an.";
    if (a.art === "rollen") return "Der Würfel rollt den Pfeilen nach. Welche Zahl liegt am Ende oben? Gegenüber liegen immer zwei, die zusammen 7 ergeben.";
    if (a.art === "farbe") return `${a.boden ? "Der Block aus kleinen Würfeln wurde rundum angemalt" : "Der Block wurde auf dem Boden stehend angemalt – unten blieb er roh –"} und dann zerlegt. Wie viele kleine Würfel haben genau ${["keine farbige Seite", "eine farbige Seite", "zwei farbige Seiten", "drei farbige Seiten"][a.seiten]}?`;
    if (a.art === "muster") return "Das Netz wird zum Würfel gefaltet, die Zeichen aussen. Nur einer der Würfel unten kann so entstehen – tippe ihn an.";
    if (a.art === "luecke") return "Dem Würfel fehlt ein Stück. Welches der Teile füllt die Lücke genau? Es darf gedreht werden, aber nicht gespiegelt.";
    if (a.art === "schatten") return "Ein Stapel aus Würfeln wirft diese Schatten an die beiden Wände und auf den Boden. Welcher Stapel ist es?";
    if (a.art === "drehkoerper") return "Die Fläche dreht sich einmal um die gestrichelte Achse. Welcher Körper entsteht dabei?";
    if (a.art === "laser") return "Der Laserstrahl knickt an jedem Spiegel um die Ecke. Tippe die Stelle am Rand an, an der er das Feld verlässt.";
    if (a.art === "zahnrad") return a.raeder.some((o) => o.art && o.art !== "zahn")
      ? "Das goldene Rad dreht im Uhrzeigersinn. Tippe alle an, die es auch tun. Gerader Riemen: gleich herum, gekreuzter: andersherum."
      : "Das goldene Rad dreht im Uhrzeigersinn. Tippe alle Räder an, die sich ebenfalls im Uhrzeigersinn drehen.";
    if (a.art === "kugelbahn") return "Die Kugel rollt jede Rampe hinunter und fällt an ihrem Ende senkrecht weiter. Tippe das Fach an, in dem sie landet.";
    return "Eine Ebene geht durch die drei roten Punkte und schneidet den Würfel. Wie viele Ecken hat die Schnittfläche?";
  }

  // Eine Aufgabe dieser Art und Stufe.
  function lege(art, stufe, r) {
    const a = { art, stufe, kurz: KURZ[art], zeit: ZEITEN[stufe], ...BAU[art](r, stufe) };
    a.frage = frageFuer(a);
    return a;
  }

  // Die zehn Aufgaben einer Runde.
  function aufgabenFuer() {
    const r = () => zufall.zahl();
    const wieOft = new Map();
    const raus = [];
    PLAN.forEach((zahl, stufe) => {
      const frei = gemischt(r, ARTEN.filter((art) => !(stufe === 0 && OHNE_LEICHT.includes(art))));
      // Zuerst die Arten, die noch selten vorkamen.
      frei.sort((a, b) => (wieOft.get(a) || 0) - (wieOft.get(b) || 0));
      for (const art of frei.filter((x) => (wieOft.get(x) || 0) < 2).slice(0, zahl)) {
        wieOft.set(art, (wieOft.get(art) || 0) + 1);
        raus.push(lege(art, stufe, r));
      }
    });
    return raus;
  }

  /*
   * Die Testrunde (?alle in der Adresse; im Adminbereich «▶ Alle Aufgaben»):
   * jede Art in jeder Stufe, eine nach der anderen – leicht, mittel, schwer,
   * dann die nächste Art. Zum Ausprobieren: Sie geht in keine Bestenliste und
   * wird nicht aufgezeichnet. ?alle=laser,zahnrad nimmt nur diese Arten. Im
   * Turnier, im Live-Modus und beim Zuschauen gibt es sie nicht.
   */
  const TESTRUNDE = (() => {
    const p = new URLSearchParams(window.location.search);
    if (!p.has("alle") || p.has("turnier") || p.has("live") || p.has("zuschauen") || zufall.fest) return null;
    const wunsch = String(p.get("alle") || "").toLowerCase().split(/[\s,]+/).filter(Boolean);
    const arten = ARTEN.filter((art) => wunsch.includes(art));
    return arten.length ? arten : [...ARTEN];
  })();

  function testAufgaben() {
    const r = () => zufall.zahl();
    const raus = [];
    for (const art of TESTRUNDE) for (let stufe = 0; stufe < 3; stufe += 1) if (!(stufe === 0 && OHNE_LEICHT.includes(art))) raus.push(lege(art, stufe, r));
    return raus;
  }

  // Die Runde als Text – für die Prüfung, dass in einem Turnier alle dieselbe bekommen.
  function weltText(aufgaben = state.aufgaben) {
    return (aufgaben || []).map((a) => `${a.art}${a.stufe}:${a.soll}`).join(" ");
  }

  // ---------------------------------------------------------------------------
  // Werten
  // ---------------------------------------------------------------------------
  const bits = (x) => { let n = 0; for (let v = x >>> 0; v; v &= v - 1) n += 1; return n; };

  // Wie richtig eine Antwort ist: 0 … 1.
  function anteilFuer(a, antwort) {
    if (antwort === null || antwort === undefined) return 0;
    if (a.eingabe === "wahl") return antwort === a.soll ? 1 : 0;
    if (a.eingabe === "zahl") return FAST[Math.abs(antwort - a.soll)] || 0;
    if (a.eingabe === "felder") {
      // Jedes richtige Feld zählt, jedes falsche kostet eines.
      const richtig = bits(antwort & a.soll);
      const falsch = bits(antwort & ~a.soll);
      return clamp((richtig - falsch) / bits(a.soll), 0, 1);
    }
    // Spalten: jede für sich – aber nur, wenn überhaupt etwas gesetzt ist.
    if (!antwort) return 0;
    let gut = 0;
    for (let i = 0; i < a.n; i += 1) if (((antwort >> (3 * i)) & 7) === ((a.soll >> (3 * i)) & 7)) gut += 1;
    return gut / a.n;
  }

  // Wie viel die Zeit lässt: alles im ersten Anteil, dann fallend bis SPAET.
  function zeitFaktor(a, sekunden) {
    const k = clamp((sekunden / a.zeit - VOLL) / (1 - VOLL), 0, 1);
    return lerp(1, SPAET, k);
  }

  function punkteFuer(a, antwort, sekunden) {
    const anteil = anteilFuer(a, antwort);
    return Math.round(PUNKTE_JE_AUFGABE * anteil * (anteil > 0 ? zeitFaktor(a, sekunden) : 0));
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase: "bereit" (vor dem ersten Tipp), "vorschau" (was zu tun ist – die
  // Uhr läuft noch nicht), "aufgabe", "zeigen" (die Auflösung läuft),
  // "warten" (beim Zuschauen, bevor der erste Zug da ist), "ende"
  const state = {
    phase: "bereit",
    aufgaben: null,        // die zehn Aufgaben der Runde
    index: 0,
    punkte: 0,
    liste: [],             // je Aufgabe { punkte, anteil, sekunden } – null, solange sie offen ist
    t0: 0,                 // wann die Aufgabe begann (performance.now)
    vorSeit: 0,            // wann ihre Vorschau begann
    tZeig: 0,              // wann die Auflösung begann
    gewendet: 0,           // wann zuletzt gewechselt wurde
    wert: 0,               // die Eingabe, solange sie entsteht: Felder als Bits, Spalten, die Zahl
    getippt: "",           // die Ziffern einer Zahl
    antwort: null,         // die Antwort – null: keine
    wertung: null,         // { punkte, anteil, sekunden }, sobald die Auflösung läuft
    volle: 0,              // Aufgaben mit hundert Punkten
    tickBei: 0,
    funken: [],
    beispiel: null,        // das Beispiel der Vorschau
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let status = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  // Wem zugeschaut wird (live-spiel.js oder ein Lauf aus der Hall of Fame).
  let zuschauer = null;
  // Die Aufzeichnung der Züge (geist.js, zuege).
  let aufnahme = null;

  const view = { dpr: 1, cssW: 0, cssH: 0, frei: 0, u: 1, hoch: true, flach: false, lw: null, text: null, film: null, guete: 1 };

  const aufgabe = () => state.aufgaben?.[state.index] || null;
  // Wie viele Aufgaben die Runde hat: zehn – in der Testrunde alle.
  const anzahl = () => state.aufgaben?.length || AUFGABEN;
  const seit = (jetzt = performance.now()) => (jetzt - state.t0) / 1000;
  const offen = () => state.phase === "aufgabe" && !zuschauer;

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
  function ton(id, o = {}, pause = 50) {
    const ms = performance.now();
    if (ms - (zuletzt.get(id) ?? -1e9) < pause) return;
    zuletzt.set(id, ms);
    klang()?.ton?.(id, o);
  }

  function funkenBei(x, y) {
    if (ruhig()) return;
    for (let i = 0; i < 26; i += 1) {
      const w = Math.random() * TAU;
      const v = 60 + Math.random() * 190;
      state.funken.push({ x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v - 60, alt: 0, leben: 0.5 + Math.random() * 0.6, gross: 1.4 + Math.random() * 2.2 });
    }
  }

  // ---------------------------------------------------------------------------
  // Die Züge
  // ---------------------------------------------------------------------------
  /*
   * Ein Zug (geist.js, zuege; live-spiel.js, zug):
   *   c   Aufgabe mal acht, plus was geschah:
   *         0  die Vorschau der Aufgabe steht da
   *         1  die Aufgabe steht da, ihre Uhr läuft
   *         2  die Eingabe hat sich geändert (a: wie sie jetzt ist)
   *         3  die Antwort (a: die Antwort, b: nach wie vielen Millisekunden)
   *         4  die Zeit war um (a: was bis dahin eingegeben war, b: 1, wenn es zählt)
   * Die Aufgaben kommen aus derselben Saat. Wer zuschaut, sieht dieselbe
   * Eingabe entstehen und dieselbe Auflösung.
   */
  function meldeZug(was, a = 0, b = 0) {
    if (zuschauer) return;
    const zug = { a, b, c: state.index * 8 + was };
    aufnahme?.zug(state.punkte, zug);
    const live = window.LernappLiveSpiel;
    if (shell?.live && live?.zug && live.gestartet?.()) live.zug(state.punkte, zug);
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  // Das Beispiel der Vorschau: eine zweite Aufgabe derselben Art und Stufe.
  function beispielFuer(a) {
    return lege(a.art, a.stufe, Math.random);
  }

  // Die nächste Aufgabe kündigt sich an: erst die Vorschau.
  function aufgabeAuf(index) {
    clearStep();
    state.index = index;
    state.phase = "vorschau";
    state.vorSeit = performance.now();
    state.t0 = state.vorSeit;
    state.gewendet = state.vorSeit;
    state.wert = 0;
    state.getippt = "";
    state.antwort = null;
    state.wertung = null;
    state.tickBei = 0;
    const a = aufgabe();
    state.beispiel = beispielFuer(a);
    if (status) status.textContent = `Aufgabe ${index + 1} von ${anzahl()}: ${a.kurz}. ${a.frage} Tippe, wenn du bereit bist.`;
    ton("kopfkino.neu");
    meldeZug(0);
  }

  // Der Tipp nach der Vorschau: Jetzt steht die Aufgabe da, und ihre Uhr läuft.
  function aufgabeLos() {
    if (state.phase !== "vorschau") return;
    state.phase = "aufgabe";
    state.t0 = performance.now();
    state.gewendet = state.t0;
    const a = aufgabe();
    if (status) status.textContent = `Aufgabe ${state.index + 1} von ${anzahl()}: ${a.frage}`;
    ton("kopfkino.klick");
    meldeZug(1);
  }

  // Wie viel Zeit die Aufgabe schon gekostet hat – das Aufbauen zählt nicht.
  const gebraucht = () => Math.max(0, seit() - EINZUG);

  // Eine Eingabe: ein Feld, eine Spalte, eine Ziffer – oder die Wahl selbst.
  // was: "wahl" (wert: der Platz), "feld" (wert: das Feld), "spalte" (wert:
  // Spalte mal acht plus Höhe), "ziffer" (wert: 0 … 9), "weg" (die letzte
  // Ziffer löschen), "fertig".
  function eingabe(was, wert = 0) {
    if (!offen() || seit() < SPERRE) return;
    const a = aufgabe();
    if (was === "wahl" && a.eingabe === "wahl") { antworte(wert); return; }
    if (was === "fertig") {
      if (a.eingabe === "zahl" ? state.getippt !== "" : a.eingabe !== "wahl" && state.wert !== 0) antworte(a.eingabe === "zahl" ? Number(state.getippt) : state.wert);
      return;
    }
    if (was === "feld" && a.eingabe === "felder") state.wert ^= 1 << wert;
    else if (was === "spalte" && a.eingabe === "spalten") {
      const spalte = wert >> 3;
      const hoch = wert & 7;
      const jetzt = (state.wert >> (3 * spalte)) & 7;
      // Noch einmal auf dieselbe Höhe: eins tiefer.
      const neu = jetzt === hoch ? hoch - 1 : hoch;
      state.wert = (state.wert & ~(7 << (3 * spalte))) | (neu << (3 * spalte));
    } else if (was === "ziffer" && a.eingabe === "zahl") {
      if (state.getippt.length >= 2 || (state.getippt === "" && wert === 0)) return;
      state.getippt += String(wert);
      state.wert = Number(state.getippt);
    } else if (was === "weg" && a.eingabe === "zahl") {
      state.getippt = state.getippt.slice(0, -1);
      state.wert = Number(state.getippt || 0);
    } else return;
    ton("kopfkino.klick", { laut: 0.6 });
    meldeZug(2, state.wert);
  }

  // Die Antwort – wert ist die Antwort, oder null, wenn die Zeit um war und
  // nichts eingegeben war. soll: die Punkte, wie sie gezählt wurden (beim
  // Zuschauen), sekunden: wie lange es dort gedauert hatte.
  function antworte(wert, soll = null, sekunden = null) {
    if (state.phase !== "aufgabe") return;
    clearStep();
    const a = aufgabe();
    const zeit = sekunden === null ? Math.round(gebraucht() * 1000) / 1000 : sekunden;
    state.phase = "zeigen";
    state.tZeig = performance.now();
    state.antwort = wert;
    if (wert !== null && a.eingabe !== "wahl") state.wert = wert;
    const anteil = anteilFuer(a, wert);
    const punkte = Number.isFinite(soll) && soll >= 0 && soll <= PUNKTE_JE_AUFGABE ? soll : punkteFuer(a, wert, zeit);
    state.wertung = { punkte, anteil, sekunden: zeit };
    state.liste[state.index] = { punkte, anteil, sekunden: zeit };
    state.punkte += punkte;
    if (punkte >= PUNKTE_JE_AUFGABE) state.volle += 1;
    shell.setCount(state.punkte);
    if (!zuschauer) {
      if (wert === null) meldeZug(4, 0, 0);
      else if (zeit >= a.zeit) meldeZug(4, wert, 1);
      else meldeZug(3, wert, Math.round(zeit * 1000));
    }
    if (anteil >= 1) {
      ton(punkte >= PUNKTE_JE_AUFGABE ? "kopfkino.voll" : "kopfkino.richtig");
      kids()?.vibrate?.(punkte >= PUNKTE_JE_AUFGABE ? [14, 40, 22] : 12);
      if (punkte >= PUNKTE_JE_AUFGABE && view.lw) funkenBei(view.lw.x + view.lw.w / 2, view.lw.y + view.lw.h * 0.3);
    } else if (anteil > 0) ton("kopfkino.richtig", { laut: 0.5 });
    else ton("kopfkino.falsch");
    ton("kopfkino.film");
    if (status) status.textContent = wert === null ? "Zeit um: 0 Punkte." : anteil >= 1 ? `Richtig: ${punkte} Punkte.` : anteil > 0 ? `Fast: ${punkte} Punkte.` : "Falsch: 0 Punkte.";
    if (!zuschauer) stepTimer = window.setTimeout(weiter, ZEIGEN_MS[a.art]);
  }

  // Die Auflösung ist gelaufen: die nächste Aufgabe – oder das Ergebnis.
  function weiter() {
    if (state.phase !== "zeigen" || zuschauer) return;
    clearStep();
    if (state.index + 1 >= anzahl()) finish();
    else aufgabeAuf(state.index + 1);
  }

  function uhrTakt() {
    if (zuschauer) return;
    if (state.phase === "vorschau") {
      if (performance.now() - state.vorSeit >= VORSCHAU * 1000) aufgabeLos();
      return;
    }
    if (state.phase !== "aufgabe") return;
    const a = aufgabe();
    const rest = a.zeit - gebraucht();
    const sekunde = Math.ceil(rest);
    if (rest > 0 && sekunde <= 3 && sekunde !== state.tickBei) { state.tickBei = sekunde; ton("kopfkino.tick"); }
    // Ist die Zeit um, zählt, was eingegeben ist – eine Wahl gibt es dann nicht.
    if (rest <= 0) {
      const da = a.eingabe === "zahl" ? state.getippt !== "" : a.eingabe !== "wahl" && state.wert !== 0;
      antworte(da ? state.wert : null, null, a.zeit);
    }
  }

  function takt(dt) {
    if (zuschauer && state.phase !== "ende") zuschauenTakt();
    else uhrTakt();
    for (let i = state.funken.length - 1; i >= 0; i -= 1) {
      const f = state.funken[i];
      f.alt += dt;
      if (f.alt >= f.leben) { state.funken.splice(i, 1); continue; }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 320 * dt;
      f.vx *= 1 - 1.8 * dt;
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
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "kn-platz");
    feld = shell.el("div", "kn-feld");
    canvas = document.createElement("canvas");
    canvas.className = "kn-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");
    status = shell.el("p", "cm-sr");
    status.setAttribute("aria-live", "polite");
    platz.append(feld, status);
    return platz;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = clamp(Math.min(window.devicePixelRatio || 1, Math.sqrt(3.4e6 / (cssW * cssH))), 1, 3) * view.guete;
    const frei = Math.min(cssH * 0.3, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    view.hoch = cssH > cssW * 1.05;
    const u = clamp(Math.min(cssW, cssH - frei) / 400, 0.72, 1.3);
    view.u = u;
    const hoehe = cssH - frei;
    // Auf einem breiten Bild steht die Frage links neben der Leinwand und der
    // Filmstreifen rechts – so bleibt der Leinwand die ganze Höhe.
    view.flach = !view.hoch && cssW >= hoehe * 1.5;
    if (view.flach) {
      const h = Math.max(160, hoehe - Math.round(34 * u));
      const w = Math.round(Math.min(cssW * 0.56, h * 1.55));
      const x = Math.round((cssW - w) / 2);
      const y = Math.round(frei + (hoehe - h) / 2 - 6 * u);
      view.lw = { x, y, w, h };
      const spalte = x - Math.round(32 * u);
      view.text = { x: Math.round(16 * u), y: y + Math.round(4 * u), w: Math.min(spalte, 330) };
      const breit = Math.min(spalte, 210 * u);
      view.film = { x: Math.round(x + w + (cssW - x - w - breit) / 2), y, w: breit, h, quer: false };
    } else {
      const kopf = Math.round(102 * u);
      const fuss = Math.round(78 * u);
      const w = Math.min(cssW - 20, 620);
      const h = Math.max(200, Math.min(w * 1.3, hoehe - kopf - fuss - 6));
      const rest = Math.max(0, hoehe - kopf - fuss - h);
      const x = Math.round((cssW - w) / 2);
      const y = Math.round(frei + kopf + rest * 0.4);
      view.lw = { x, y, w, h };
      view.text = { x: x + 2, y: y - kopf + Math.round(4 * u), w: w - 4 };
      view.film = { x, y: y + h + Math.round(24 * u), w, h: fuss - Math.round(30 * u), quer: true };
    }
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
  }

  // Wo ein Zeiger im Bild ist.
  function bildOrt(event) {
    const r = canvas.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Farben und Knöpfe
  // ---------------------------------------------------------------------------
  const SERIF = 'Georgia, "Times New Roman", serif';
  const SANS = "system-ui, sans-serif";
  const HELL = "#f2f0ff";
  const ZART = "rgba(226, 222, 255, 0.62)";
  const GRUEN = "#4ade80";
  const ROT = "#ff6b6b";
  const GOLD = "#ffd166";
  const AKZENT = "#a78bfa";
  const STUFEN_FARBE = ["#4ade80", "#fbbf24", "#ff6b6b"];
  // Die Farben der Würfel und Flächen: [rot, grün, blau].
  const PALETTE = [[244, 114, 96], [250, 190, 70], [110, 200, 130], [86, 180, 233], [167, 139, 250], [240, 130, 190]];
  const PAPIER = [244, 236, 219];
  const farbe = (c, hell = 1, deckt = 1) => `rgba(${Math.round(clamp(c[0] * hell, 0, 255))}, ${Math.round(clamp(c[1] * hell, 0, 255))}, ${Math.round(clamp(c[2] * hell, 0, 255))}, ${deckt})`;

  function rundes(x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
    else g.rect(x, y, w, h);
  }

  // Wo getippt werden kann: jedes Bild trägt hier ein, was es anbietet.
  // { x, y, w, h, was, wert } – oder ein Kreis { cx, cy, r, was, wert }.
  let treffer = [];
  const bietet = (stelle) => { if (malt.lebt) treffer.push(stelle); };
  // Was das Bild gerade malt: die echte Aufgabe (lebt) oder ein Beispiel.
  const malt = { lebt: false };

  // Ein Knopf. zustand: "" | "an" | "gut" | "schlecht" | "aus"
  function knopf(r, text, zustand = "", stelle = null, schrift = 0) {
    const u = view.u;
    g.save();
    rundes(r.x, r.y, r.w, r.h, 10 * u);
    g.fillStyle = zustand === "gut" ? "rgba(74, 222, 128, 0.26)" : zustand === "schlecht" ? "rgba(255, 107, 107, 0.26)" : zustand === "an" ? "rgba(167, 139, 250, 0.42)" : "rgba(255, 255, 255, 0.09)";
    g.fill();
    g.lineWidth = zustand ? 2 : 1.2;
    g.strokeStyle = zustand === "gut" ? GRUEN : zustand === "schlecht" ? ROT : zustand === "an" ? AKZENT : "rgba(226, 222, 255, 0.3)";
    g.globalAlpha = zustand === "aus" ? 0.4 : 1;
    g.stroke();
    if (text) {
      g.fillStyle = HELL;
      g.font = `700 ${Math.round(schrift || clamp(r.h * 0.44, 13, 26))}px ${SANS}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + 1);
    }
    g.restore();
    if (stelle) bietet({ ...r, ...stelle });
  }

  // Ein Rechteck in Bild (oben oder links) und Bedienung (unten oder rechts).
  function teile(r, anteil) {
    const luft = Math.round(8 * view.u);
    if (r.w > r.h * 1.25) {
      const b = Math.round(r.w * Math.min(0.46, anteil + 0.08));
      return { bild: { x: r.x, y: r.y, w: r.w - b - luft, h: r.h }, bedien: { x: r.x + r.w - b, y: r.y, w: b, h: r.h } };
    }
    const b = Math.round(r.h * anteil);
    return { bild: { x: r.x, y: r.y, w: r.w, h: r.h - b - luft }, bedien: { x: r.x, y: r.y + r.h - b, w: r.w, h: b } };
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Welt in drei Richtungen
  // ---------------------------------------------------------------------------
  /*
   * Die Kamera schaut schräg von oben, ohne Fluchtpunkt: gier dreht sie um
   * die Hochachse, neig kippt sie (0: von der Seite, 90°: von oben). Aus
   * einem Punkt der Welt wird ein Punkt im Bild (u nach rechts, v nach unten)
   * und seine Tiefe (t). Bei gier 45° steht sie vorn links oben: Zu sehen
   * sind die Seiten, die nach -x, nach -y und nach oben schauen.
   */
  function sicht(gier, neig) {
    const cg = Math.cos(gier), sg = Math.sin(gier), cn = Math.cos(neig), sn = Math.sin(neig);
    return { u: [cg, -sg, 0], v: [-sg * sn, -cg * sn, -cn], t: [sg * cn, cg * cn, -sn] };
  }
  const ISO = [45 * GRAD, 33 * GRAD];

  // Die Bühne: eine Sicht, ein Massstab und wo der Nullpunkt im Bild liegt –
  // so gewählt, dass die Punkte der Welt mit Rand ins Rechteck passen.
  function buehne(r, gier, neig, punkte, rand = 0.1) {
    const s = sicht(gier, neig);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of punkte) {
      const x = vPunkt(p, s.u);
      const y = vPunkt(p, s.v);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const k = Math.min((r.w * (1 - 2 * rand)) / Math.max(x1 - x0, 1e-6), (r.h * (1 - 2 * rand)) / Math.max(y1 - y0, 1e-6));
    return { s, k, ox: r.x + r.w / 2 - ((x0 + x1) / 2) * k, oy: r.y + r.h / 2 - ((y0 + y1) / 2) * k };
  }
  const imBild = (B, p) => [B.ox + vPunkt(p, B.s.u) * B.k, B.oy + vPunkt(p, B.s.v) * B.k];
  const quader = (x0, y0, z0, x1, y1, z1) => [[x0, y0, z0], [x1, y0, z0], [x0, y1, z0], [x1, y1, z0], [x0, y0, z1], [x1, y0, z1], [x0, y1, z1], [x1, y1, z1]];

  // Die sechs Seiten eines Würfels: wohin sie schauen, und ihre Ecken im
  // Kreis (die erste Kante ist «rechts», die letzte «hinauf» – für das, was
  // auf der Seite steht).
  const SEITEN = [
    { n: [0, 0, 1], e: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
    { n: [0, 0, -1], e: [[-1, 1, -1], [1, 1, -1], [1, -1, -1], [-1, -1, -1]] },
    { n: [0, -1, 0], e: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
    { n: [0, 1, 0], e: [[1, 1, -1], [-1, 1, -1], [-1, 1, 1], [1, 1, 1]] },
    { n: [-1, 0, 0], e: [[-1, 1, -1], [-1, -1, -1], [-1, -1, 1], [-1, 1, 1]] },
    { n: [1, 0, 0], e: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]] },
  ];

  // Ein Würfel mit der Mitte bei mitte, gedreht um m. opt.ohne: Seiten, die
  // an einem Nachbarn liegen; opt.deko(i): was auf der Seite i steht.
  function wuerfel(mitte, c, opt = {}) {
    const m = opt.m || EINS;
    const halb = (opt.gross ?? 1) / 2;
    const flaechen = [];
    SEITEN.forEach((seite, i) => {
      if (opt.ohne?.has(i)) return;
      flaechen.push({ n: mVec(m, seite.n), pkte: seite.e.map((e) => vPlus(mitte, mVec(m, vMal(e, halb)))), farbe: opt.farben?.[i] || c, deko: opt.deko?.(i) || null, deckt: opt.deckt ?? 1 });
    });
    return { mitte, flaechen };
  }

  // Viele Körper malen: von hinten nach vorn, jede Seite, die zur Kamera
  // schaut, in ihrem Licht.
  function male3d(B, koerper) {
    const tiefe = (p) => vPunkt(p, B.s.t);
    // Das Licht kommt immer von links oben hinter der Kamera – wohin sie auch schwenkt.
    const licht = vNorm(vPlus(vPlus(vMal(B.s.u, -0.45), vMal(B.s.t, -0.35)), [0, 0, 1]));
    const reihe = koerper.map((k) => ({ k, d: tiefe(k.mitte) })).sort((a, b) => b.d - a.d);
    g.save();
    g.lineJoin = "round";
    for (const { k } of reihe) {
      for (const f of k.flaechen) {
        const zu = vPunkt(f.n, B.s.t);
        if (zu >= 0 && !f.beid) continue;
        const n = zu >= 0 ? vMal(f.n, -1) : f.n;
        const hell = (0.66 + 0.36 * vPunkt(n, licht)) * (zu >= 0 ? 0.72 : 1);
        const p = f.pkte.map((q) => imBild(B, q));
        g.beginPath();
        p.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
        g.closePath();
        g.fillStyle = farbe(f.farbe, hell, f.deckt ?? 1);
        g.fill();
        g.lineWidth = Math.max(0.8, B.k * 0.022);
        // rand "gleich": in der Farbe der Fläche – dann sieht man keine Naht (Drehkörper).
        g.strokeStyle = f.rand === "gleich" ? g.fillStyle : f.rand || `rgba(20, 14, 40, ${0.5 * (f.deckt ?? 1)})`;
        g.stroke();
        if (f.deko && zu < 0) {
          // Auf der Seite zeichnen: Danach ist sie das Quadrat von 0 bis 1.
          g.save();
          g.transform(p[1][0] - p[0][0], p[1][1] - p[0][1], p[3][0] - p[0][0], p[3][1] - p[0][1], p[0][0], p[0][1]);
          f.deko(hell);
          g.restore();
        }
      }
    }
    g.restore();
  }

  // Die Augen eines Spielwürfels, auf dem Quadrat von 0 bis 1.
  const AUGEN_ORT = {
    1: [[0.5, 0.5]],
    2: [[0.27, 0.27], [0.73, 0.73]],
    3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
    4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
    5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
    6: [[0.27, 0.22], [0.73, 0.22], [0.27, 0.5], [0.73, 0.5], [0.27, 0.78], [0.73, 0.78]],
  };
  function augen(zahl, c = "#1b1630") {
    g.fillStyle = c;
    for (const [x, y] of AUGEN_ORT[zahl]) { g.beginPath(); g.arc(x, y, 0.095, 0, TAU); g.fill(); }
  }

  // Ein Stern, auf dem Quadrat von 0 bis 1.
  function stern(c = "#ffffff") {
    g.fillStyle = c;
    g.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const w = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 0.15 : 0.34;
      g.lineTo(0.5 + Math.cos(w) * r, 0.5 + Math.sin(w) * r);
    }
    g.closePath();
    g.fill();
  }

  // Die Würfel eines Stapels – ohne die Seiten, die an einem Nachbarn liegen.
  // heben(z): um wie viel die Ebene z angehoben ist.
  function stapelKoerper(hoehen, c, heben = () => 0) {
    const n = hoehen.length;
    const hoch = (x, y) => (x < 0 || y < 0 || x >= n || y >= n ? 0 : hoehen[x][y]);
    const raus = [];
    for (let x = 0; x < n; x += 1) for (let y = 0; y < n; y += 1) for (let z = 0; z < hoehen[x][y]; z += 1) {
      const offen = heben(z + 1) - heben(z) > 0.01;
      const ohne = new Set();
      if (!offen && z + 1 < hoehen[x][y]) ohne.add(0);
      if (hoch(x, y - 1) > z) ohne.add(2);
      if (hoch(x, y + 1) > z) ohne.add(3);
      if (hoch(x - 1, y) > z) ohne.add(4);
      if (hoch(x + 1, y) > z) ohne.add(5);
      // Jede Ebene einen Hauch heller als die darunter.
      const ton = [c[0] + z * 9, c[1] + z * 9, c[2] + z * 9];
      raus.push(wuerfel([x + 0.5, y + 0.5, z + 0.5 + heben(z)], ton, { ohne }));
    }
    return raus;
  }

  // Der Boden unter einem Stapel: ein Raster, zart.
  function boden(B, n, deckt = 1) {
    g.save();
    g.globalAlpha = deckt;
    const ecken = [[0, 0, 0], [n, 0, 0], [n, n, 0], [0, n, 0]].map((p) => imBild(B, p));
    g.beginPath();
    ecken.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.closePath();
    g.fillStyle = "rgba(255, 255, 255, 0.05)";
    g.fill();
    g.strokeStyle = "rgba(226, 222, 255, 0.2)";
    g.lineWidth = 1;
    for (let i = 0; i <= n; i += 1) {
      const a = imBild(B, [i, 0, 0]), b = imBild(B, [i, n, 0]), c = imBild(B, [0, i, 0]), d = imBild(B, [n, i, 0]);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.moveTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.stroke();
    }
    g.restore();
  }

  // Eine Schrift mit Schatten, mitten auf (x, y).
  function schrift(text, x, y, gross, c = HELL, fett = 800) {
    g.save();
    g.font = `${fett} ${Math.round(gross)}px ${SANS}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.shadowColor = "rgba(8, 6, 24, 0.85)";
    g.shadowBlur = 8;
    g.fillStyle = c;
    g.fillText(text, x, y);
    g.restore();
  }

  // Wie weit die Auflösung ist: 0 vor a, 1 nach b (Sekunden), weich.
  const fort = (tz, a, b) => (ruhig() ? (tz >= a ? 1 : 0) : weich(a, b, tz));
  // Ein leises Wiegen der Kamera, solange nachgedacht wird.
  const wiegen = (tz) => (ruhig() || tz >= 0 ? 0 : Math.sin(performance.now() / 1300) * 3.2 * GRAD);

  // ---------------------------------------------------------------------------
  // Zeichnen: die Arten
  // ---------------------------------------------------------------------------
  /*
   * Jede Art malt ihre Aufgabe in ein Rechteck r:
   *   tz    wie lange die Auflösung schon läuft (Sekunden) – negativ: Es wird
   *         noch gefragt
   *   e     { klein (ein Beispiel: nur das Bild), wert (die Eingabe bisher),
   *         getippt, antwort (was geantwortet wurde, oder null) }
   * Was sich antippen lässt, trägt sie mit bietet() ein.
   */
  const wahlZustand = (a, e, tz, i) => (tz < 0 ? "" : i === a.soll ? "gut" : i === e.antwort ? "schlecht" : "");

  // Das Feld für eine Zahl: was getippt ist, darunter die Ziffern.
  function zahlenfeld(r, a, tz, e) {
    const u = view.u;
    const breit = r.w > r.h * 1.25;
    const tasten = breit
      ? [["1", "2", "3", "←"], ["4", "5", "6", "0"], ["7", "8", "9", "OK"]]
      : [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["←", "0", "OK"]];
    const anzeige = Math.round(Math.min(r.h * 0.24, 56 * u));
    const luft = Math.round(6 * u);
    const zeilen = tasten.length;
    const spalten = tasten[0].length;
    const tw = Math.min((r.w - luft * (spalten - 1)) / spalten, 92 * u);
    const th = Math.min((r.h - anzeige - luft * (zeilen + 1)) / zeilen, 56 * u);
    const x0 = r.x + (r.w - tw * spalten - luft * (spalten - 1)) / 2;
    const hoehe = anzeige + luft + zeilen * th + (zeilen - 1) * luft;
    const y0 = r.y + Math.max(0, (r.h - hoehe) / 2);
    // Die Anzeige.
    const richtig = tz >= 0 && e.antwort === a.soll;
    g.save();
    rundes(x0, y0, tw * spalten + luft * (spalten - 1), anzeige, 10 * u);
    g.fillStyle = "rgba(10, 8, 28, 0.6)";
    g.fill();
    g.strokeStyle = tz < 0 ? "rgba(226, 222, 255, 0.35)" : richtig ? GRUEN : ROT;
    g.lineWidth = 1.6;
    g.stroke();
    g.font = `800 ${Math.round(anzeige * 0.62)}px ${SANS}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = tz < 0 ? HELL : richtig ? GRUEN : ROT;
    const mitte = x0 + (tw * spalten + luft * (spalten - 1)) / 2;
    const text = tz < 0 ? (e.getippt || "?") : e.antwort === null || e.antwort === undefined ? "–" : String(e.antwort);
    g.fillText(tz >= 0 && !richtig ? `${text}  →  ${a.soll}` : text, mitte, y0 + anzeige / 2 + 1);
    g.restore();
    tasten.forEach((zeile, zi) => zeile.forEach((taste, si) => {
      const k = { x: x0 + si * (tw + luft), y: y0 + anzeige + luft + zi * (th + luft), w: tw, h: th };
      const stelle = taste === "OK" ? { was: "fertig" } : taste === "←" ? { was: "weg" } : { was: "ziffer", wert: Number(taste) };
      knopf(k, taste === "OK" ? "Fertig" : taste, taste === "OK" ? (e.getippt ? "an" : "aus") : "", tz < 0 ? stelle : null, taste === "OK" ? clamp(th * 0.34, 12, 19) : 0);
    }));
  }

  // --- Würfel zählen ---------------------------------------------------------
  function maleStapel(a, r, tz, e) {
    const { bild, bedien } = e.klein ? { bild: r, bedien: null } : teile(r, 0.38);
    const n = a.n;
    const hmax = Math.max(...a.hoehen.flat());
    const luecke = 0.6 * fort(tz, 0.25, 1.2);
    const B = buehne(bild, ISO[0] + wiegen(tz), ISO[1], quader(0, 0, 0, n, n, hmax + luecke * (hmax - 1)), 0.08);
    boden(B, n);
    male3d(B, stapelKoerper(a.hoehen, PALETTE[a.farbe], (z) => z * luecke));
    if (tz >= 0) {
      // Ebene um Ebene: wie viele Würfel sie hat.
      for (let z = 0; z < hmax; z += 1) {
        const zahl = a.hoehen.flat().filter((h) => h > z).length;
        const da = fort(tz, 0.9 + z * 0.28, 1.2 + z * 0.28);
        if (da <= 0) continue;
        const p = imBild(B, [n, 0, z + 0.5 + z * luecke]);
        g.save();
        g.globalAlpha = da;
        schrift(String(zahl), Math.min(p[0] + 20 * view.u, bild.x + bild.w - 14 * view.u), p[1], clamp(B.k * 0.42, 12, 24), GOLD);
        g.restore();
      }
      const da = fort(tz, 1.0 + hmax * 0.28, 1.4 + hmax * 0.28);
      if (da > 0) {
        g.save();
        g.globalAlpha = da;
        schrift(`= ${a.soll}`, bild.x + bild.w / 2, bild.y + bild.h - 14 * view.u, clamp(bild.h * 0.1, 15, 30), GOLD);
        g.restore();
      }
    }
    if (bedien) zahlenfeld(bedien, a, tz, e);
  }

  // --- Ansicht ---------------------------------------------------------------
  // Wohin die Kamera schwenkt, um aus der Richtung zu schauen.
  const BLICK = [90 * GRAD, 0, -90 * GRAD, 180 * GRAD];
  function maleAnsicht(a, r, tz, e) {
    const { bild, bedien } = e.klein ? { bild: r, bedien: null } : teile(r, 0.4);
    const n = a.n;
    const hmax = Math.max(...a.hoehen.flat());
    // Der Pfeil auf dem Boden: von aussen auf den Stapel zu.
    const hin = [[1, 0], [0, 1], [-1, 0], [0, -1]][a.richtung];
    const fuss = [n / 2 - hin[0] * (n / 2 + 1.9), n / 2 - hin[1] * (n / 2 + 1.9), 0];
    const spitze = [n / 2 - hin[0] * (n / 2 + 0.35), n / 2 - hin[1] * (n / 2 + 0.35), 0];
    const welt = [...quader(0, 0, 0, n, n, hmax), fuss];
    const f = fort(tz, 0.25, 1.8);
    const B0 = buehne(bild, ISO[0], ISO[1], welt, 0.1);
    const B1 = buehne(bild, BLICK[a.richtung], 0, quader(0, 0, 0, n, n, hmax), 0.2);
    const B = {
      s: sicht(lerp(ISO[0] + wiegen(tz), BLICK[a.richtung], f), lerp(ISO[1], 0, f)),
      k: lerp(B0.k, Math.min(B1.k, B0.k * 1.25), f), ox: lerp(B0.ox, B1.ox, f), oy: lerp(B0.oy, B1.oy, f),
    };
    boden(B, n, 1 - f);
    // Der Pfeil.
    g.save();
    g.globalAlpha = 1 - f * 0.85;
    const p0 = imBild(B, fuss);
    const p1 = imBild(B, spitze);
    const qv = [-hin[1] * 0.32, hin[0] * 0.32, 0];
    const hals = vPlus(spitze, [-hin[0] * 0.6, -hin[1] * 0.6, 0]);
    const l = imBild(B, vPlus(hals, qv));
    const rr = imBild(B, vMinus(hals, qv));
    g.strokeStyle = GOLD;
    g.fillStyle = GOLD;
    g.lineWidth = Math.max(2.4, B.k * 0.1);
    g.lineCap = "round";
    const h2 = imBild(B, hals);
    g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(h2[0], h2[1]); g.stroke();
    g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(l[0], l[1]); g.lineTo(rr[0], rr[1]); g.closePath(); g.fill();
    g.restore();
    male3d(B, stapelKoerper(a.hoehen, PALETTE[a.farbe]));
    // Steht der Pfeil hinter dem Stapel, scheint er durch – und an seinem
    // Fuss sitzt ein Auge: von hier wird geschaut.
    g.save();
    g.globalAlpha = (1 - f) * 0.45;
    g.strokeStyle = GOLD;
    g.lineWidth = Math.max(2, B.k * 0.07);
    g.setLineDash([5, 5]);
    g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1 - f;
    const auge = Math.max(7, B.k * 0.24);
    g.fillStyle = "#fffaf0";
    g.beginPath(); g.ellipse(p0[0], p0[1], auge, auge * 0.62, 0, 0, TAU); g.fill();
    g.strokeStyle = "#1b1630";
    g.lineWidth = 1.4;
    g.stroke();
    g.fillStyle = "#1b1630";
    g.beginPath(); g.arc(p0[0], p0[1], auge * 0.36, 0, TAU); g.fill();
    g.restore();
    if (!bedien) return;
    // Die Spalten: so breit wie der Stapel, so hoch wie die höchste Säule.
    const u = view.u;
    const knopfHoch = Math.round(Math.min(46 * u, bedien.h * 0.24));
    const luft = Math.round(8 * u);
    const zelle = Math.min((bedien.w * 0.86) / n, (bedien.h - knopfHoch - luft * 2 - 14 * u) / a.hoch, 64 * u);
    const x0 = bedien.x + (bedien.w - zelle * n) / 2;
    const y0 = bedien.y + Math.max(0, (bedien.h - knopfHoch - luft - 14 * u - zelle * a.hoch) / 2);
    for (let c = 0; c < n; c += 1) {
      const ist = (e.wert >> (3 * c)) & 7;
      const soll = a.spalten[c];
      for (let h = 1; h <= a.hoch; h += 1) {
        const z = { x: x0 + c * zelle + 2, y: y0 + (a.hoch - h) * zelle + 2, w: zelle - 4, h: zelle - 4 };
        g.save();
        rundes(z.x, z.y, z.w, z.h, 6 * u);
        g.fillStyle = ist >= h ? farbe(PALETTE[a.farbe], 1, tz >= 0 && ist !== soll ? 0.45 : 0.95) : "rgba(255, 255, 255, 0.06)";
        g.fill();
        g.lineWidth = 1.2;
        g.strokeStyle = "rgba(226, 222, 255, 0.28)";
        g.stroke();
        // Die Auflösung: so hoch ist die Spalte wirklich.
        if (tz >= 0.6 && soll >= h) { g.lineWidth = 2.4; g.strokeStyle = ist === soll ? GRUEN : ROT; g.globalAlpha = fort(tz, 0.6, 1.2); g.stroke(); }
        g.restore();
        if (tz < 0) bietet({ ...z, was: "spalte", wert: c * 8 + h });
      }
    }
    g.save();
    g.font = `600 ${Math.round(10.5 * u)}px ${SANS}`;
    g.fillStyle = ZART;
    g.textBaseline = "top";
    g.textAlign = "left";
    g.fillText("links", x0 + 2, y0 + a.hoch * zelle + 3);
    g.textAlign = "right";
    g.fillText("rechts", x0 + n * zelle - 2, y0 + a.hoch * zelle + 3);
    g.restore();
    const breit = Math.min(bedien.w * 0.6, 200 * u);
    knopf({ x: bedien.x + (bedien.w - breit) / 2, y: bedien.y + bedien.h - knopfHoch, w: breit, h: knopfHoch }, "Fertig", e.wert ? "an" : "aus", tz < 0 ? { was: "fertig" } : null, clamp(knopfHoch * 0.4, 13, 19));
  }

  // --- Dieselbe Figur --------------------------------------------------------
  // Aus einer Drehung ihre Achse und ihr Winkel.
  function achseWinkel(m) {
    const spur = m[0][0] + m[1][1] + m[2][2];
    const w = Math.acos(clamp((spur - 1) / 2, -1, 1));
    if (w < 1e-6) return { achse: [0, 0, 1], winkel: 0 };
    if (Math.PI - w < 1e-6) {
      // Eine halbe Drehung: die Achse ist, was dabei stehen bleibt.
      const spalten = [0, 1, 2].map((i) => [m[i][0] + (i === 0 ? 1 : 0), m[i][1] + (i === 1 ? 1 : 0), m[i][2] + (i === 2 ? 1 : 0)]);
      return { achse: vNorm(spalten.sort((a, b) => vLang(b) - vLang(a))[0]), winkel: w };
    }
    return { achse: vNorm([m[1][2] - m[2][1], m[2][0] - m[0][2], m[0][1] - m[1][0]]), winkel: w };
  }

  // Eine Figur aus Würfeln, um ihre Mitte gedreht, mitten im Rechteck.
  function maleFigur(r, liste, m, c, gier, k) {
    const mitte = vMal(liste.reduce((s, p) => vPlus(s, p), [0, 0, 0]), 1 / liste.length);
    const da = new Set(liste.map((p) => p.join(",")));
    const B = { s: sicht(gier, 30 * GRAD), k, ox: r.x + r.w / 2, oy: r.y + r.h / 2 };
    male3d(B, liste.map((p) => {
      const ohne = new Set();
      SEITEN.forEach((seite, i) => { if (da.has(vPlus(p, seite.n).join(","))) ohne.add(i); });
      return wuerfel(mVec(m, vMinus(p, mitte)), c, { m, ohne });
    }));
  }

  function maleDrehen(a, r, tz, e) {
    const u = view.u;
    const breit = r.w > r.h * 1.25;
    const oben = breit ? { x: r.x, y: r.y, w: r.w * 0.42, h: r.h } : { x: r.x, y: r.y, w: r.w, h: r.h * 0.44 };
    const unten = breit ? { x: r.x + r.w * 0.44, y: r.y, w: r.w * 0.56, h: r.h } : { x: r.x, y: r.y + r.h * 0.46, w: r.w, h: r.h * 0.54 };
    // Die Plätze der Auswahl: nebeneinander, oder zwei mal zwei.
    const spalten = a.wahl === 4 || unten.w < unten.h * 1.3 ? 2 : a.wahl;
    const zeilen = Math.ceil(a.wahl / spalten);
    const luft = Math.round(8 * u);
    const zw = (unten.w - luft * (spalten - 1)) / spalten;
    const zh = (unten.h - luft * (zeilen - 1)) / zeilen;
    const k = Math.min(Math.min(zw, zh) / 6.4, Math.min(oben.w, oben.h) / 7);
    const c = PALETTE[a.farbe];
    const gier = ISO[0] + wiegen(tz);
    // Oben die Figur – in der Auflösung dreht sie sich in die Lage der richtigen.
    const ziel = achseWinkel(a.bilder[a.soll].lage);
    const m = tz < 0 ? EINS : drehung(ziel.achse, ziel.winkel * fort(tz, 0.35, 2.0));
    maleFigur(oben, a.figur, m, c, gier, k * 1.12);
    a.bilder.forEach((b, i) => {
      const z = { x: unten.x + (i % spalten) * (zw + luft), y: unten.y + Math.floor(i / spalten) * (zh + luft), w: zw, h: zh };
      knopf(z, "", wahlZustand(a, e, tz, i), tz < 0 && !e.klein ? { was: "wahl", wert: i } : null);
      maleFigur(z, b.wuerfel, EINS, tz >= 0.4 && b.gespiegelt ? [150, 146, 176] : c, gier, k);
      if (tz >= 0.6 && b.gespiegelt && !e.klein) {
        g.save();
        g.globalAlpha = fort(tz, 0.6, 1.1);
        schrift("Spiegelbild", z.x + z.w / 2, z.y + z.h - 11 * u, 10.5 * u, ZART, 600);
        g.restore();
      }
    });
  }

  // --- Würfel rollen ---------------------------------------------------------
  // Welche Zahl auf welcher Seite des Würfels steht (in seiner Grundlage).
  const SEITEN_AUGE = SEITEN.map((seite) => AUGEN.find(([n]) => n[0] === seite.n[0] && n[1] === seite.n[1] && n[2] === seite.n[2])[1]);
  const WEISS = [246, 243, 236];

  function maleRollen(a, r, tz, e) {
    const { bild, bedien } = e.klein ? { bild: r, bedien: null } : teile(r, 0.2);
    const u = view.u;
    const n = a.n;
    const B = buehne(bild, ISO[0] + wiegen(tz), ISO[1], quader(0, 0, 0, n, n, 1.1), 0.07);
    boden(B, n);
    // Der Weg: Pfeil um Pfeil über den Boden, das letzte Feld golden.
    const orte = [a.start];
    for (const [dx, dy] of a.weg) orte.push([orte[orte.length - 1][0] + dx, orte[orte.length - 1][1] + dy]);
    const ziel = orte[orte.length - 1];
    g.save();
    const ecken = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([x, y]) => imBild(B, [ziel[0] + x, ziel[1] + y, 0]));
    g.beginPath();
    ecken.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.closePath();
    g.fillStyle = "rgba(255, 209, 102, 0.25)";
    g.fill();
    g.strokeStyle = GOLD;
    g.lineWidth = 1.6;
    g.stroke();
    g.strokeStyle = AKZENT;
    g.fillStyle = AKZENT;
    g.lineWidth = Math.max(2, B.k * 0.09);
    g.lineCap = "round";
    a.weg.forEach(([dx, dy], i) => {
      const von = [orte[i][0] + 0.5 + dx * 0.22, orte[i][1] + 0.5 + dy * 0.22, 0];
      const bis = [orte[i][0] + 0.5 + dx * 0.78, orte[i][1] + 0.5 + dy * 0.78, 0];
      const p = imBild(B, von);
      const q = imBild(B, bis);
      g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
      const spitze = imBild(B, [bis[0] + dx * 0.16, bis[1] + dy * 0.16, 0]);
      const li = imBild(B, [bis[0] - dy * 0.17, bis[1] + dx * 0.17, 0]);
      const re = imBild(B, [bis[0] + dy * 0.17, bis[1] - dx * 0.17, 0]);
      g.beginPath(); g.moveTo(spitze[0], spitze[1]); g.lineTo(li[0], li[1]); g.lineTo(re[0], re[1]); g.closePath(); g.fill();
    });
    g.restore();
    // Der Würfel: Er steht am Anfang – und rollt in der Auflösung Feld um Feld.
    const dauer = Math.min(0.42, 2.4 / a.weg.length);
    const lauf = ruhig() ? (tz >= 0 ? a.weg.length : 0) : clamp((tz - 0.35) / dauer, 0, a.weg.length);
    const schritt = Math.min(a.weg.length - 1, Math.floor(lauf));
    let lage = a.lage;
    for (let i = 0; i < schritt; i += 1) lage = rollLage(lage, a.weg[i][0], a.weg[i][1]);
    let mitte = [orte[schritt][0] + 0.5, orte[schritt][1] + 0.5, 0.5];
    const rest = lauf - schritt;
    let m = lage;
    if (rest > 0) {
      const [dx, dy] = a.weg[schritt];
      const kipp = drehung(ROLL[`${dx},${dy}`], (Math.PI / 2) * weich(0, 1, rest));
      const kante = [mitte[0] + dx * 0.5, mitte[1] + dy * 0.5, 0];
      mitte = vPlus(kante, mVec(kipp, vMinus(mitte, kante)));
      m = mMal(kipp, lage);
    }
    male3d(B, [wuerfel(mitte, WEISS, { m, gross: 0.9, deko: (i) => () => augen(SEITEN_AUGE[i]) })]);
    if (tz >= 0 && lauf >= a.weg.length) {
      const p = imBild(B, [ziel[0] + 0.5, ziel[1] + 0.5, 1.45]);
      g.save();
      g.globalAlpha = fort(tz, 0.35 + dauer * a.weg.length, 0.65 + dauer * a.weg.length);
      schrift(`oben: ${a.soll + 1}`, clamp(p[0], bild.x + 40 * u, bild.x + bild.w - 40 * u), Math.max(p[1], bild.y + 14 * u), clamp(B.k * 0.36, 13, 22), GOLD);
      g.restore();
    }
    if (!bedien) return;
    // Die sechs Seiten zur Wahl.
    const spalten = bedien.w > bedien.h * 2.4 ? 6 : bedien.w > bedien.h * 0.8 ? 3 : 2;
    const zeilen = 6 / spalten;
    const luft = Math.round(8 * u);
    const kante = Math.min((bedien.w - luft * (spalten - 1)) / spalten, (bedien.h - luft * (zeilen - 1)) / zeilen, 70 * u);
    const x0 = bedien.x + (bedien.w - kante * spalten - luft * (spalten - 1)) / 2;
    const y0 = bedien.y + (bedien.h - kante * zeilen - luft * (zeilen - 1)) / 2;
    for (let i = 0; i < 6; i += 1) {
      const z = { x: x0 + (i % spalten) * (kante + luft), y: y0 + Math.floor(i / spalten) * (kante + luft), w: kante, h: kante };
      const zustand = wahlZustand(a, e, tz, i);
      g.save();
      rundes(z.x, z.y, z.w, z.h, kante * 0.18);
      g.fillStyle = farbe(WEISS, zustand === "schlecht" ? 0.8 : 1);
      g.fill();
      g.lineWidth = zustand ? 3.2 : 1.2;
      g.strokeStyle = zustand === "gut" ? GRUEN : zustand === "schlecht" ? ROT : "rgba(20, 14, 40, 0.5)";
      g.stroke();
      g.translate(z.x, z.y);
      g.scale(kante, kante);
      augen(i + 1);
      g.restore();
      if (tz < 0) bietet({ ...z, was: "wahl", wert: i });
    }
  }

  // --- Das Würfelnetz --------------------------------------------------------
  function maleNetz(a, r, tz, e) {
    const u = view.u;
    const bild = r;
    const f = fort(tz, 0.3, 1.8);
    const lage = netzLage(a.felder, a.baum, (Math.PI / 2) * f);
    const [wx, wy] = a.felder[a.baum.wurzel];
    const flach = buehne(bild, 0, Math.PI / 2, quader(0, 0, 0, a.breit, a.hoch, 0), 0.14);
    const schwenk = fort(tz, 0.1, 1.2);
    const dreh = fort(tz, 1.9, 3.5);
    const s = sicht(lerp(0, 32 * GRAD, schwenk) + dreh * 200 * GRAD, lerp(Math.PI / 2, 50 * GRAD, schwenk));
    // Erst liegt das Netz mitten im Bild, am Schluss der Würfel.
    const blick = [lerp(a.breit / 2, wx + 0.5, f), lerp(a.hoch / 2, wy + 0.5, f), lerp(0, -0.5, f)];
    const k = Math.min(flach.k, Math.min(bild.w, bild.h) / 4.2) * lerp(1, 1.25, f);
    const B = { s, k, ox: bild.x + bild.w / 2 - vPunkt(blick, s.u) * k, oy: bild.y + bild.h / 2 - vPunkt(blick, s.v) * k };
    const ecken = (i) => { const l = lage[i]; return [l.o, vPlus(l.o, l.ex), vPlus(vPlus(l.o, l.ex), l.ey), vPlus(l.o, l.ey)]; };
    male3d(B, a.felder.map((_, i) => {
      const pkte = ecken(i);
      const l = lage[i];
      return {
        mitte: vMal(vPlus(pkte[0], pkte[2]), 0.5),
        flaechen: [{ n: vKreuz(l.ex, l.ey), pkte, farbe: PALETTE[a.farben[i]], beid: true, deko: a.variante === "flaeche" && i === a.stern ? () => stern() : null }],
      };
    }));
    const umriss = (i, c, dick) => {
      const p = ecken(i).map((q) => imBild(B, q));
      g.save();
      g.beginPath();
      p.forEach((q, j) => (j ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
      g.closePath();
      g.strokeStyle = c;
      g.lineWidth = dick;
      g.lineJoin = "round";
      g.stroke();
      g.restore();
    };
    if (a.variante === "flaeche") {
      if (tz >= 0) {
        umriss(a.soll, GRUEN, 4);
        if (e.antwort !== null && e.antwort !== undefined && e.antwort !== a.soll) umriss(e.antwort, ROT, 4);
      } else if (!e.klein) {
        a.felder.forEach(([x, y], i) => {
          if (i === a.stern) return;
          const p = imBild(B, [x, y + 1, 0]);
          bietet({ x: p[0], y: p[1], w: B.k, h: B.k, was: "wahl", wert: i });
        });
      }
    } else {
      // Die Kanten: die rote, und in der Auflösung die, die auf ihr liegt.
      const strecke = (kante) => {
        const l = lage[kante.feld];
        const [x, y] = a.felder[kante.feld];
        const ort = (ecke) => imBild(B, vPlus(vPlus(l.o, vMal(l.ex, ecke[0] - x)), vMal(l.ey, ecke[1] - y)));
        return [ort(kante.a), ort(kante.b)];
      };
      const linie = (kante, c, dick) => {
        const [p, q] = strecke(kante);
        g.save();
        g.strokeStyle = c;
        g.lineWidth = dick;
        g.lineCap = "round";
        g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
        g.restore();
      };
      if (tz < 0) {
        a.kanten.forEach((kante, i) => {
          if (i === a.rot) return;
          const [p, q] = strecke(kante);
          const mx = (p[0] + q[0]) / 2;
          const my = (p[1] + q[1]) / 2;
          g.save();
          g.beginPath();
          g.arc(mx, my, Math.max(4, B.k * 0.09), 0, TAU);
          g.fillStyle = "rgba(14, 10, 34, 0.9)";
          g.fill();
          g.strokeStyle = HELL;
          g.lineWidth = 1.6;
          g.stroke();
          g.restore();
          if (!e.klein) bietet({ cx: mx, cy: my, r: Math.max(18 * u, B.k * 0.36), was: "wahl", wert: i });
        });
      } else {
        linie(a.kanten[a.soll], GRUEN, 5);
        if (e.antwort !== null && e.antwort !== undefined && e.antwort !== a.soll) linie(a.kanten[e.antwort], "rgba(255, 107, 107, 0.9)", 4);
      }
      linie(a.kanten[a.rot], "#ff4b4b", 5.5);
    }
  }

  // --- Falten und lochen -----------------------------------------------------
  // Ein Stück Papier: die Felder von x0 bis x1, y0 bis y1, im Massstab k.
  function malePapier(x, y, k, b, dunkel = 1) {
    g.fillStyle = farbe(PAPIER, dunkel);
    g.fillRect(x + b.x0 * k, y + b.y0 * k, (b.x1 - b.x0) * k, (b.y1 - b.y0) * k);
    g.strokeStyle = "rgba(90, 70, 40, 0.28)";
    g.lineWidth = 1;
    g.beginPath();
    for (let i = b.x0; i <= b.x1; i += 1) { g.moveTo(x + i * k, y + b.y0 * k); g.lineTo(x + i * k, y + b.y1 * k); }
    for (let i = b.y0; i <= b.y1; i += 1) { g.moveTo(x + b.x0 * k, y + i * k); g.lineTo(x + b.x1 * k, y + i * k); }
    g.stroke();
  }
  const GANZ = { x0: 0, x1: FALT_N, y0: 0, y1: FALT_N };
  function maleLoch(x, y, k, [fx, fy], c = "#17132b") {
    g.fillStyle = c;
    g.beginPath();
    g.arc(x + (fx + 0.5) * k, y + (fy + 0.5) * k, k * 0.24, 0, TAU);
    g.fill();
  }

  function maleFalten(a, r, tz, e) {
    const u = view.u;
    const breit = r.w > r.h * 1.25 && !e.klein;
    const knopfHoch = e.klein ? 0 : Math.round(Math.min(46 * u, r.h * 0.11));
    const streifen = breit ? { x: r.x, y: r.y, w: r.w * 0.4, h: r.h } : { x: r.x, y: r.y, w: r.w, h: r.h * (e.klein ? 0.3 : 0.27) };
    const rest = breit ? { x: r.x + r.w * 0.42, y: r.y, w: r.w * 0.58, h: r.h - knopfHoch - 8 * u } : { x: r.x, y: r.y + streifen.h + 6 * u, w: r.w, h: r.h - streifen.h - knopfHoch - 14 * u };
    // Oben (quer: links) die Schritte: so wird gefaltet, dann gelocht.
    const bilder = a.falten.length + 1;
    const reihen = breit ? Math.ceil(bilder / 2) : 1;
    const jeReihe = Math.ceil(bilder / reihen);
    const klein = Math.min(streifen.h / reihen * 0.82, streifen.w / (jeReihe * 1.42));
    const kk = klein / FALT_N;
    for (let i = 0; i < bilder; i += 1) {
      const x = streifen.x + (streifen.w - jeReihe * klein * 1.42 + klein * 0.42) / 2 + (i % jeReihe) * klein * 1.42;
      const y = streifen.y + (streifen.h - reihen * klein * 1.16 + klein * 0.16) / 2 + Math.floor(i / jeReihe) * klein * 1.16;
      g.save();
      // Wo das ganze Blatt war: gestrichelt.
      g.setLineDash([3, 3]);
      g.strokeStyle = "rgba(226, 222, 255, 0.3)";
      g.lineWidth = 1;
      g.strokeRect(x, y, klein, klein);
      g.setLineDash([]);
      const falt = a.falten[i];
      const da = falt ? falt.vorher : a.falten[a.falten.length - 1].nachher;
      malePapier(x, y, kk, da, 1 - 0.05 * i);
      if (falt) {
        // Die Faltlinie, und der Pfeil von der Hälfte, die umklappt, zur anderen.
        const n = falt.nachher;
        g.strokeStyle = "#7c5cff";
        g.lineWidth = 2;
        g.setLineDash([4, 3]);
        g.beginPath();
        if (falt.achse === "x") { g.moveTo(x + falt.bei * kk, y + da.y0 * kk - 3); g.lineTo(x + falt.bei * kk, y + da.y1 * kk + 3); } else { g.moveTo(x + da.x0 * kk - 3, y + falt.bei * kk); g.lineTo(x + da.x1 * kk + 3, y + falt.bei * kk); }
        g.stroke();
        g.setLineDash([]);
        const bleibt = [(n.x0 + n.x1) / 2, (n.y0 + n.y1) / 2];
        const geht = falt.achse === "x" ? [2 * falt.bei - bleibt[0], bleibt[1]] : [bleibt[0], 2 * falt.bei - bleibt[1]];
        const p = [x + geht[0] * kk, y + geht[1] * kk];
        const q = [x + bleibt[0] * kk, y + bleibt[1] * kk];
        const hin = [(q[0] - p[0]) / Math.hypot(q[0] - p[0], q[1] - p[1]), (q[1] - p[1]) / Math.hypot(q[0] - p[0], q[1] - p[1])];
        g.strokeStyle = "#3b2a8f";
        g.fillStyle = "#3b2a8f";
        g.lineWidth = Math.max(1.6, klein * 0.035);
        g.beginPath();
        g.moveTo(p[0], p[1]);
        g.quadraticCurveTo((p[0] + q[0]) / 2 - hin[1] * klein * 0.22, (p[1] + q[1]) / 2 + hin[0] * klein * 0.22 - klein * 0.12, q[0], q[1]);
        g.stroke();
        const kopf = klein * 0.09;
        g.beginPath();
        g.moveTo(q[0] + hin[0] * kopf * 0.4, q[1] + hin[1] * kopf * 0.4);
        g.lineTo(q[0] - hin[0] * kopf - hin[1] * kopf * 0.8, q[1] - hin[1] * kopf + hin[0] * kopf * 0.8);
        g.lineTo(q[0] - hin[0] * kopf + hin[1] * kopf * 0.8, q[1] - hin[1] * kopf - hin[0] * kopf * 0.8);
        g.closePath();
        g.fill();
      } else {
        for (const loch of a.loecher) maleLoch(x, y, kk, loch);
      }
      // Der Pfeil zum nächsten Bild.
      if (i + 1 < bilder && (i % jeReihe) + 1 < jeReihe) {
        g.fillStyle = ZART;
        g.font = `700 ${Math.round(klein * 0.3)}px ${SANS}`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("›", x + klein * 1.21, y + klein / 2);
      }
      g.restore();
    }
    // Darunter das aufgefaltete Blatt – zum Antippen, und für die Auflösung.
    const seite = Math.min(rest.w * 0.9, rest.h);
    const k = seite / FALT_N;
    const x = rest.x + (rest.w - seite) / 2;
    const y = rest.y + (rest.h - seite) / 2;
    const anzahl = a.falten.length;
    const dauer = 0.62;
    const lauf = tz < 0 ? anzahl : ruhig() ? anzahl : clamp((tz - 0.35) / dauer, 0, anzahl);
    g.save();
    g.setLineDash([4, 4]);
    g.strokeStyle = "rgba(226, 222, 255, 0.28)";
    g.strokeRect(x, y, seite, seite);
    g.setLineDash([]);
    if (tz < 0) {
      // Die Frage: das leere Blatt, mit den Löchern, die schon gesetzt sind.
      malePapier(x, y, k, GANZ);
      for (let i = 0; i < FALT_N * FALT_N; i += 1) {
        const feld = [i % FALT_N, Math.floor(i / FALT_N)];
        if (e.wert & (1 << i)) maleLoch(x, y, k, feld);
        if (!e.klein) bietet({ x: x + feld[0] * k, y: y + feld[1] * k, w: k, h: k, was: "feld", wert: i });
      }
    } else {
      // Die Auflösung: Faltung um Faltung klappt wieder auf.
      const stufe = anzahl - Math.min(anzahl - 1, Math.floor(lauf));
      const teil = lauf >= anzahl ? 1 : lauf - Math.floor(lauf);
      const fertig = lauf >= anzahl;
      const falt = a.falten[stufe - 1];
      const liegt = fertig ? GANZ : falt.nachher;
      malePapier(x, y, k, liegt);
      for (const loch of a.stufen[fertig ? 0 : stufe]) maleLoch(x, y, k, loch);
      if (!fertig && teil > 0) {
        // Die Klappe: die gespiegelte Hälfte, gestaucht – erst liegt sie obenauf.
        const c = -Math.cos(Math.PI * weich(0, 1, teil));
        g.save();
        if (falt.achse === "x") { g.translate(x + falt.bei * k, y); g.scale(c, 1); g.translate(-falt.bei * k, 0); } else { g.translate(x, y + falt.bei * k); g.scale(1, c); g.translate(0, -falt.bei * k); }
        const v = falt.vorher;
        const n = falt.nachher;
        const klappe = falt.achse === "x" ? { x0: n.x0 === v.x0 ? n.x1 : v.x0, x1: n.x0 === v.x0 ? v.x1 : n.x0, y0: v.y0, y1: v.y1 } : { x0: v.x0, x1: v.x1, y0: n.y0 === v.y0 ? n.y1 : v.y0, y1: n.y0 === v.y0 ? v.y1 : n.y0 };
        malePapier(0, 0, k, klappe, c < 0 ? 0.84 : 0.97);
        for (const [lx, ly] of a.stufen[stufe]) maleLoch(0, 0, k, falt.achse === "x" ? [2 * falt.bei - 1 - lx, ly] : [lx, 2 * falt.bei - 1 - ly]);
        g.restore();
      }
      // Was angetippt war: grün, wo ein Loch ist, rot, wo keines ist – und
      // golden gestrichelt, was fehlte.
      const zeig = fort(tz, 0.35 + dauer * anzahl, 0.65 + dauer * anzahl);
      for (let i = 0; i < FALT_N * FALT_N; i += 1) {
        const an = (e.wert >> i) & 1;
        const soll = (a.soll >> i) & 1;
        if (!an && !soll) continue;
        g.save();
        g.lineWidth = 3;
        g.globalAlpha = an ? 1 : zeig;
        g.strokeStyle = an ? (soll ? GRUEN : ROT) : GOLD;
        if (!an) g.setLineDash([4, 3]);
        if (an && !fertig && soll) g.globalAlpha = 0.5;
        g.beginPath();
        g.arc(x + ((i % FALT_N) + 0.5) * k, y + (Math.floor(i / FALT_N) + 0.5) * k, k * 0.36, 0, TAU);
        g.stroke();
        g.restore();
      }
    }
    g.restore();
    if (!e.klein) {
      const b = Math.min(rest.w * 0.6, 200 * u);
      knopf({ x: rest.x + (rest.w - b) / 2, y: r.y + r.h - knopfHoch, w: b, h: knopfHoch }, "Fertig", e.wert ? "an" : "aus", tz < 0 ? { was: "fertig" } : null, clamp(knopfHoch * 0.4, 13, 19));
    }
  }

  // --- Der Schnitt -----------------------------------------------------------
  function maleSchnitt(a, r, tz, e) {
    const { bild, bedien } = e.klein ? { bild: r, bedien: null } : teile(r, 0.2);
    const u = view.u;
    const schwenk = Math.sin(fort(tz, 0.8, 3.0) * Math.PI) * 60 * GRAD;
    const B = buehne(bild, 30 * GRAD, 26 * GRAD, quader(0, 0, 0, 1, 1, 1), 0.17);
    B.s = sicht(30 * GRAD + wiegen(tz) + schwenk, 26 * GRAD);
    const mitte = imBild(B, [0.5, 0.5, 0.5]);
    B.ox += bild.x + bild.w / 2 - mitte[0];
    B.oy += bild.y + bild.h / 2 - mitte[1];
    const vorn = (n) => vPunkt(n, B.s.t) < 0;
    const male = (pkte, fuell, rand, dick = 1.4, strich = null) => {
      const p = pkte.map((q) => imBild(B, q));
      g.save();
      g.beginPath();
      p.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
      if (fuell !== null) { g.closePath(); if (fuell) { g.fillStyle = fuell; g.fill(); } }
      if (rand) { g.strokeStyle = rand; g.lineWidth = dick; g.lineJoin = "round"; g.lineCap = "round"; if (strich) g.setLineDash(strich); g.stroke(); }
      g.restore();
    };
    const seiten = SEITEN.map((seite) => ({ n: seite.n, pkte: seite.e.map((ecke) => ecke.map((x) => (x + 1) / 2)) }));
    // Hinten die Seiten, die wegschauen, und die verdeckten Kanten.
    for (const seite of seiten) if (!vorn(seite.n)) male(seite.pkte, "rgba(255, 255, 255, 0.05)", null);
    const sichtbar = ([p, q]) => {
      // Eine Kante ist zu sehen, wenn eine ihrer beiden Seiten zur Kamera schaut.
      const lang = [0, 1, 2].find((i) => p[i] !== q[i]);
      return [0, 1, 2].filter((i) => i !== lang).some((i) => { const n = [0, 0, 0]; n[i] = p[i] ? 1 : -1; return vorn(n); });
    };
    for (const kante of KANTEN) if (!sichtbar(kante)) male(kante, null, "rgba(226, 222, 255, 0.4)", 1.3, [4, 4]);
    // Die Schnittfläche – erst in der Auflösung.
    const da = fort(tz, 0.25, 0.95);
    if (da > 0) {
      male(a.flaeche, `rgba(255, 209, 102, ${0.5 * da})`, `rgba(255, 209, 102, ${da})`, 2.6);
      for (const p of a.flaeche) { const q = imBild(B, p); g.save(); g.globalAlpha = da; g.fillStyle = GOLD; g.beginPath(); g.arc(q[0], q[1], 3.6 * u, 0, TAU); g.fill(); g.restore(); }
    }
    for (const seite of seiten) if (vorn(seite.n)) male(seite.pkte, "rgba(167, 139, 250, 0.1)", null);
    for (const kante of KANTEN) if (sichtbar(kante)) male(kante, null, "rgba(242, 240, 255, 0.92)", 2);
    // Die drei Punkte.
    for (const p of a.punkte) {
      const q = imBild(B, p);
      g.save();
      g.beginPath();
      g.arc(q[0], q[1], Math.max(4.5, 6 * u), 0, TAU);
      g.fillStyle = "#ff4b4b";
      g.fill();
      g.strokeStyle = "#ffffff";
      g.lineWidth = 1.8;
      g.stroke();
      g.restore();
    }
    if (tz >= 0) {
      g.save();
      g.globalAlpha = fort(tz, 0.7, 1.1);
      schrift(`${a.flaeche.length} Ecken`, bild.x + bild.w / 2, bild.y + bild.h - 13 * u, clamp(bild.h * 0.085, 14, 26), GOLD);
      g.restore();
    }
    if (!bedien) return;
    // Drei, vier, fünf oder sechs Ecken.
    const spalten = bedien.w > bedien.h * 1.6 ? 4 : 2;
    const zeilen = 4 / spalten;
    const luft = Math.round(8 * u);
    const bw = Math.min((bedien.w - luft * (spalten - 1)) / spalten, 130 * u);
    const bh = Math.min((bedien.h - luft * (zeilen - 1)) / zeilen, 66 * u);
    const x0 = bedien.x + (bedien.w - bw * spalten - luft * (spalten - 1)) / 2;
    const y0 = bedien.y + (bedien.h - bh * zeilen - luft * (zeilen - 1)) / 2;
    for (let i = 0; i < 4; i += 1) {
      const z = { x: x0 + (i % spalten) * (bw + luft), y: y0 + Math.floor(i / spalten) * (bh + luft), w: bw, h: bh };
      knopf(z, "", wahlZustand(a, e, tz, i), tz < 0 ? { was: "wahl", wert: i } : null);
      // Das Vieleck und seine Zahl.
      const ecken = i + 3;
      const rad = Math.min(bh * 0.3, bw * 0.2);
      const mx = z.x + bw * 0.32;
      const my = z.y + bh / 2;
      g.save();
      g.beginPath();
      for (let j = 0; j < ecken; j += 1) { const w = -Math.PI / 2 + (j * TAU) / ecken; g.lineTo(mx + Math.cos(w) * rad, my + Math.sin(w) * rad); }
      g.closePath();
      g.fillStyle = "rgba(255, 209, 102, 0.3)";
      g.fill();
      g.strokeStyle = GOLD;
      g.lineWidth = 1.6;
      g.stroke();
      g.fillStyle = HELL;
      g.font = `800 ${Math.round(clamp(bh * 0.46, 14, 28))}px ${SANS}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(String(ecken), z.x + bw * 0.7, my + 1);
      g.restore();
    }
  }

  // --- Gemeinsames für die Arten mit einer Auswahl aus Bildern ------------------
  // Ein Rechteck in das Bild (oben oder links) und die Auswahl (unten oder rechts).
  function obenUnten(r, anteil = 0.44) {
    if (r.w > r.h * 1.25) return { oben: { x: r.x, y: r.y, w: r.w * (anteil - 0.02), h: r.h }, unten: { x: r.x + r.w * anteil, y: r.y, w: r.w * (1 - anteil), h: r.h } };
    return { oben: { x: r.x, y: r.y, w: r.w, h: r.h * anteil }, unten: { x: r.x, y: r.y + r.h * (anteil + 0.02), w: r.w, h: r.h * (1 - anteil - 0.02) } };
  }

  // Die Plätze einer Auswahl: so in Reihen verteilt, dass jeder möglichst gross ist.
  function plaetze(r, zahl) {
    const luft = Math.round(8 * view.u);
    let best = null;
    for (let spalten = 1; spalten <= zahl; spalten += 1) {
      const zeilen = Math.ceil(zahl / spalten);
      const w = (r.w - luft * (spalten - 1)) / spalten;
      const h = (r.h - luft * (zeilen - 1)) / zeilen;
      const mass = Math.min(w, h * 1.1);
      if (!best || mass > best.mass + 0.5) best = { spalten, zeilen, w, h, mass };
    }
    return Array.from({ length: zahl }, (_, i) => {
      const zeile = Math.floor(i / best.spalten);
      // Eine letzte Reihe, die nicht voll ist, steht in der Mitte.
      const inReihe = zeile === best.zeilen - 1 ? zahl - zeile * best.spalten : best.spalten;
      const versatz = ((best.spalten - inReihe) * (best.w + luft)) / 2;
      return { x: r.x + versatz + (i % best.spalten) * (best.w + luft), y: r.y + zeile * (best.h + luft), w: best.w, h: best.h };
    });
  }

  // Eine kleine Zeile unten in einem Platz – was an einem falschen Bild nicht stimmt.
  function fussnote(z, text, tz, ab = 0.6) {
    if (tz < ab) return;
    g.save();
    g.globalAlpha = fort(tz, ab, ab + 0.5);
    // Passt die Zeile nicht in den Platz, wird sie kleiner.
    g.font = `600 ${Math.round(10.5 * view.u)}px ${SANS}`;
    const gross = clamp((10.5 * view.u * (z.w - 8)) / Math.max(1, g.measureText(text).width), 7.5, 10.5 * view.u);
    schrift(text, z.x + z.w / 2, z.y + z.h - 11 * view.u, gross, ZART, 600);
    g.restore();
  }

  // Ein Vieleck in der Welt, flach gemalt.
  function flaeche3(B, pkte, fuell, rand = null, dick = 1) {
    const p = pkte.map((q) => imBild(B, q));
    g.beginPath();
    p.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
    g.closePath();
    if (fuell) { g.fillStyle = fuell; g.fill(); }
    if (rand) { g.strokeStyle = rand; g.lineWidth = dick; g.lineJoin = "round"; g.stroke(); }
  }

  // --- Würfel anmalen ----------------------------------------------------------
  const HOLZ = [226, 208, 172];
  function maleFarbe(a, r, tz, e) {
    const { bild, bedien } = e.klein ? { bild: r, bedien: null } : teile(r, 0.38);
    const [nx, ny, nz] = a.masse;
    // Die Auflösung: Der Block zieht sich auseinander, die gesuchten bleiben leuchtend stehen.
    const auf = 0.8 * fort(tz, 0.3, 1.5);
    const blass = fort(tz, 1.3, 1.9);
    const c = PALETTE[a.farbe];
    const ort = (x, y, z) => [(x + 0.5 - nx / 2) * (1 + auf) + nx / 2, (y + 0.5 - ny / 2) * (1 + auf) + ny / 2, (z + 0.5) * (1 + auf)];
    const klein = ort(0, 0, 0);
    const gross = ort(nx - 1, ny - 1, nz - 1);
    const B = buehne(bild, ISO[0] + wiegen(tz), ISO[1], quader(klein[0] - 0.5, klein[1] - 0.5, klein[2] - 0.5, gross[0] + 0.5, gross[1] + 0.5, gross[2] + 0.5), 0.09);
    const koerper = [];
    for (let x = 0; x < nx; x += 1) for (let y = 0; y < ny; y += 1) for (let z = 0; z < nz; z += 1) {
      // Welche Seiten Farbe haben – in der Reihenfolge von SEITEN.
      const bunt = [z === nz - 1, z === 0 && a.boden, y === 0, y === ny - 1, x === 0, x === nx - 1];
      const ohne = new Set();
      if (auf < 0.01) {
        if (z + 1 < nz) ohne.add(0);
        if (z > 0) ohne.add(1);
        if (y > 0) ohne.add(2);
        if (y + 1 < ny) ohne.add(3);
        if (x > 0) ohne.add(4);
        if (x + 1 < nx) ohne.add(5);
        if (ohne.size === 6) continue;
      }
      const trifft = bunt.filter(Boolean).length === a.seiten;
      const k = wuerfel(ort(x, y, z), HOLZ, { ohne, farben: bunt.map((an) => (an ? c : HOLZ)), deckt: trifft ? 1 : lerp(1, 0.1, blass) });
      if (trifft && blass > 0) for (const f of k.flaechen) f.rand = `rgba(255, 209, 102, ${blass})`;
      koerper.push(k);
    }
    male3d(B, koerper);
    if (tz >= 0) {
      const da = fort(tz, 1.7, 2.2);
      if (da > 0) {
        g.save();
        g.globalAlpha = da;
        schrift(`= ${a.soll}`, bild.x + bild.w / 2, bild.y + bild.h - 14 * view.u, clamp(bild.h * 0.1, 15, 30), GOLD);
        g.restore();
      }
    }
    if (bedien) zahlenfeld(bedien, a, tz, e);
  }

  // --- Welcher Würfel? ---------------------------------------------------------
  // Ein Zeichen, auf dem Quadrat von 0 bis 1 – es zeigt nach rechts.
  function zeichneZeichen(form, c) {
    g.fillStyle = c;
    g.strokeStyle = c;
    g.lineWidth = 0.1;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    if (form === "punkt") { g.arc(0.5, 0.5, 0.2, 0, TAU); g.fill(); }
    else if (form === "ring") { g.arc(0.5, 0.5, 0.23, 0, TAU); g.stroke(); }
    else if (form === "kreuz") { g.moveTo(0.27, 0.27); g.lineTo(0.73, 0.73); g.moveTo(0.73, 0.27); g.lineTo(0.27, 0.73); g.stroke(); }
    else if (form === "quadrat") g.fillRect(0.29, 0.29, 0.42, 0.42);
    else if (form === "vier") { for (const [x, y] of [[0.32, 0.32], [0.68, 0.32], [0.32, 0.68], [0.68, 0.68]]) { g.moveTo(x + 0.09, y); g.arc(x, y, 0.09, 0, TAU); } g.fill(); }
    else if (form === "stern") { for (let i = 0; i < 8; i += 1) { const w = (i * Math.PI) / 4; const rad = i % 2 ? 0.11 : 0.33; g.lineTo(0.5 + Math.cos(w) * rad, 0.5 + Math.sin(w) * rad); } g.closePath(); g.fill(); }
    else if (form === "balken") g.fillRect(0.2, 0.42, 0.6, 0.16);
    else if (form === "zwei") { g.arc(0.3, 0.5, 0.1, 0, TAU); g.moveTo(0.8, 0.5); g.arc(0.7, 0.5, 0.1, 0, TAU); g.fill(); }
    else if (form === "pfeil") { g.moveTo(0.2, 0.5); g.lineTo(0.7, 0.5); g.stroke(); g.beginPath(); g.moveTo(0.84, 0.5); g.lineTo(0.58, 0.33); g.lineTo(0.58, 0.67); g.closePath(); g.fill(); }
    else if (form === "halb") { g.arc(0.42, 0.5, 0.27, -Math.PI / 2, Math.PI / 2); g.closePath(); g.fill(); }
    else if (form === "ecke") { g.moveTo(0.74, 0.27); g.lineTo(0.27, 0.27); g.lineTo(0.27, 0.74); g.stroke(); }
    else { g.moveTo(0.26, 0.26); g.lineTo(0.8, 0.5); g.lineTo(0.26, 0.74); g.closePath(); g.fill(); }
  }

  // Die sechs Flächen des Netzes in der Lage `lage`, um `mitte` mit m gedreht.
  function musterKoerper(a, lage, mitte, m, belegung = null, dreh = null) {
    return a.felder.map((_, i) => {
      const l = lage[i];
      const pkte = [l.o, vPlus(l.o, l.ex), vPlus(vPlus(l.o, l.ex), l.ey), vPlus(l.o, l.ey)].map((p) => vPlus(mitte, mVec(m, vMinus(p, mitte))));
      const nr = belegung ? belegung[i] : i;
      const q = dreh ? dreh[i] : a.lagen[i];
      const zeichen = a.zeichen[nr];
      return {
        mitte: vMal(vPlus(pkte[0], pkte[2]), 0.5),
        flaechen: [{
          n: mVec(m, vKreuz(l.ex, l.ey)), pkte, farbe: a.farben ? PALETTE[a.farben[nr]] : WEISS, beid: true,
          deko: () => { g.translate(0.5, 0.5); g.rotate((q * Math.PI) / 2); g.translate(-0.5, -0.5); zeichneZeichen(zeichen.form, a.farben ? "#ffffff" : "#1b1630"); },
        }],
      };
    });
  }

  const MUSTER_FEHLER = { gegen: "liegen sich gegenüber", spiegel: "falsch herum", dreh: "ein Zeichen verdreht" };
  function maleMuster(a, r, tz, e) {
    const { oben, unten } = obenUnten(r, 0.44);
    if (!a.zu) a.zu = netzLage(a.felder, a.baum, Math.PI / 2);
    const [wx, wy] = a.felder[a.baum.wurzel];
    const zentrum = [wx + 0.5, wy + 0.5, -0.5];
    // Oben das Netz. Die Auflösung: Es faltet sich zum Würfel – und der dreht
    // sich in die Lage des richtigen Bildes.
    const f = fort(tz, 0.3, 1.7);
    const lage = netzLage(a.felder, a.baum, (Math.PI / 2) * f);
    const flach = buehne(oben, 0, Math.PI / 2, quader(0, 0, 0, a.breit, a.hoch, 0), 0.1);
    const schwenk = fort(tz, 0.1, 1.2);
    const s = sicht(lerp(0, ISO[0], schwenk), lerp(Math.PI / 2, ISO[1], schwenk));
    const ziel = achseWinkel(a.bilder[a.soll].m);
    const m = drehung(ziel.achse, ziel.winkel * fort(tz, 1.8, 3.3));
    const blick = [lerp(a.breit / 2, wx + 0.5, f), lerp(a.hoch / 2, wy + 0.5, f), lerp(0, -0.5, f)];
    const k = Math.min(flach.k, Math.min(oben.w, oben.h) / 3.6) * lerp(1, 1.3, f);
    const B = { s, k, ox: oben.x + oben.w / 2 - vPunkt(blick, s.u) * k, oy: oben.y + oben.h / 2 - vPunkt(blick, s.v) * k };
    male3d(B, musterKoerper(a, lage, zentrum, m));
    // Unten die Würfel zur Wahl.
    const gier = ISO[0] + wiegen(tz);
    plaetze(unten, a.wahl).forEach((z, i) => {
      const b = a.bilder[i];
      knopf(z, "", wahlZustand(a, e, tz, i), tz < 0 && !e.klein ? { was: "wahl", wert: i } : null);
      const kk = Math.min(z.w, z.h) / 2.45;
      const T = { s: sicht(gier, ISO[1]), k: kk, ox: z.x + z.w / 2, oy: z.y + z.h / 2 - (tz >= 0.6 && i !== a.soll && !e.klein ? 5 * view.u : 0) };
      // Der Würfel sitzt mit seiner Mitte im Nullpunkt.
      male3d(T, musterKoerper(a, a.zu, zentrum, b.m, b.belegung, b.dreh).map((koerper) => ({ mitte: vMinus(koerper.mitte, zentrum), flaechen: koerper.flaechen.map((fl) => ({ ...fl, pkte: fl.pkte.map((p) => vMinus(p, zentrum)) })) })));
      if (i !== a.soll && !e.klein) fussnote(z, MUSTER_FEHLER[b.art], tz);
    });
  }

  // --- Lücke füllen ------------------------------------------------------------
  function maleLuecke(a, r, tz, e) {
    const { oben, unten } = obenUnten(r, 0.46);
    const n = a.n;
    const c = PALETTE[a.farbe];
    const tief = [c[0] * 0.6, c[1] * 0.6, c[2] * 0.6];
    const weg = new Set(a.weg.map((p) => p.join(",")));
    const gier = ISO[0] + wiegen(tz);
    const B = buehne(oben, gier, ISO[1], quader(0, 0, 0, n, n, n), 0.13);
    const koerper = [];
    for (let x = 0; x < n; x += 1) for (let y = 0; y < n; y += 1) for (let z = 0; z < n; z += 1) {
      if (weg.has(`${x},${y},${z}`)) continue;
      const ohne = new Set();
      const farben = [];
      SEITEN.forEach((seite, i) => {
        const q = vPlus([x, y, z], seite.n);
        const drin = q.every((v) => v >= 0 && v < n);
        const fehlt = drin && weg.has(q.join(","));
        if (drin && !fehlt) ohne.add(i);
        // Die Wände der Lücke liegen im Schatten.
        farben.push(fehlt ? tief : c);
      });
      if (ohne.size < 6) koerper.push(wuerfel([x + 0.5, y + 0.5, z + 0.5], c, { ohne, farben }));
    }
    // Die Auflösung: Das richtige Teil dreht sich in seine Lage und fährt in die Lücke.
    if (tz >= 0) {
      const f = fort(tz, 0.35, 2.1);
      const ziel = achseWinkel(a.bilder[a.soll].lage);
      const m = drehung(ziel.achse, ziel.winkel * (1 - f));
      const mitte = vMal(a.weg.reduce((summe, p) => vPlus(summe, vPlus(p, [0.5, 0.5, 0.5])), [0, 0, 0]), 1 / a.weg.length);
      const fern = vMal(vPlus(vMal(B.s.t, -2.4), [0, 0, 1.2]), 1 - f);
      for (const p of a.weg) koerper.push(wuerfel(vPlus(vPlus(mitte, mVec(m, vMinus(vPlus(p, [0.5, 0.5, 0.5]), mitte))), fern), [255, 209, 102], { m, gross: 0.985 }));
    }
    male3d(B, koerper);
    plaetze(unten, a.wahl).forEach((z, i) => {
      const b = a.bilder[i];
      knopf(z, "", wahlZustand(a, e, tz, i), tz < 0 && !e.klein ? { was: "wahl", wert: i } : null);
      maleFigur(z, b.wuerfel, EINS, tz >= 0.4 && !b.passt ? [150, 146, 176] : tz >= 0.4 ? [255, 209, 102] : c, gier, Math.min(z.w, z.h) / 4.7);
      if (!b.passt && !e.klein) fussnote(z, "passt nicht", tz);
    });
  }

  // --- Drei Schatten -----------------------------------------------------------
  // Das Zimmer: der Boden und zwei Wände, mit den Schatten darauf.
  function maleZimmer(B, n, hoch, schatten, glanz) {
    const dunkel = "rgba(8, 6, 26, 0.74)";
    const gitter = "rgba(226, 222, 255, 0.16)";
    g.save();
    flaeche3(B, [[0, 0, 0], [n, 0, 0], [n, n, 0], [0, n, 0]], "rgba(255, 255, 255, 0.11)", "rgba(226, 222, 255, 0.3)");
    flaeche3(B, [[0, n, 0], [n, n, 0], [n, n, hoch], [0, n, hoch]], "rgba(255, 255, 255, 0.17)", "rgba(226, 222, 255, 0.3)");
    flaeche3(B, [[n, 0, 0], [n, n, 0], [n, n, hoch], [n, 0, hoch]], "rgba(255, 255, 255, 0.07)", "rgba(226, 222, 255, 0.3)");
    for (let i = 0; i < n; i += 1) {
      for (let z = 0; z < hoch; z += 1) {
        flaeche3(B, [[i, n, z], [i + 1, n, z], [i + 1, n, z + 1], [i, n, z + 1]], z < schatten.links[i] ? dunkel : null, gitter);
        flaeche3(B, [[n, i, z], [n, i + 1, z], [n, i + 1, z + 1], [n, i, z + 1]], z < schatten.rechts[i] ? dunkel : null, gitter);
      }
      for (let j = 0; j < n; j += 1) flaeche3(B, [[i, j, 0], [i + 1, j, 0], [i + 1, j + 1, 0], [i, j + 1, 0]], schatten.boden[i][j] ? dunkel : null, gitter);
    }
    // Die Schatten leuchten kurz auf, wenn der Stapel steht.
    if (glanz > 0) {
      g.globalAlpha = glanz;
      for (let i = 0; i < n; i += 1) {
        if (schatten.links[i]) flaeche3(B, [[i, n, 0], [i + 1, n, 0], [i + 1, n, schatten.links[i]], [i, n, schatten.links[i]]], null, GOLD, 2);
        if (schatten.rechts[i]) flaeche3(B, [[n, i, 0], [n, i + 1, 0], [n, i + 1, schatten.rechts[i]], [n, i, schatten.rechts[i]]], null, GOLD, 2);
      }
    }
    g.restore();
  }

  function maleSchatten(a, r, tz, e) {
    const { oben, unten } = obenUnten(r, 0.44);
    const n = a.n;
    const c = PALETTE[a.farbe];
    const gier = ISO[0] + wiegen(tz);
    const B = buehne(oben, gier, ISO[1], quader(0, 0, 0, n, n, a.hoch), 0.08);
    const steht = fort(tz, 0.3, 1.3);
    maleZimmer(B, n, a.hoch, a.schatten, tz >= 0 ? Math.sin(fort(tz, 1.2, 2.4) * Math.PI) : 0);
    // Die Auflösung: Der richtige Stapel senkt sich ins Zimmer.
    if (tz >= 0) {
      g.save();
      g.globalAlpha = clamp(steht * 1.6, 0, 1);
      male3d(B, stapelKoerper(a.bilder[a.soll], c, () => (1 - steht) * 3.2));
      g.restore();
    }
    plaetze(unten, a.wahl).forEach((z, i) => {
      knopf(z, "", wahlZustand(a, e, tz, i), tz < 0 && !e.klein ? { was: "wahl", wert: i } : null);
      const falsch = tz >= 0.4 && i !== a.soll;
      const kasten = { x: z.x + 3, y: z.y + 3, w: z.w - 6, h: z.h - 6 - (falsch && !e.klein ? 12 * view.u : 0) };
      const T = buehne(kasten, gier, ISO[1], quader(0, 0, 0, n, n, a.hoch), 0.06);
      boden(T, n);
      male3d(T, stapelKoerper(a.bilder[i], falsch ? [150, 146, 176] : c));
      if (i !== a.soll && !e.klein && tz >= 0) {
        // Welcher Schatten ihn verrät.
        const s = schattenVon(a.bilder[i]);
        const wo = [s.links.join("") !== a.schatten.links.join("") ? "links" : "", s.rechts.join("") !== a.schatten.rechts.join("") ? "rechts" : "", JSON.stringify(s.boden) !== JSON.stringify(a.schatten.boden) ? "Boden" : ""].filter(Boolean);
        fussnote(z, `anders: ${wo.join(", ")}`, tz);
      }
    });
  }

  // --- Drehkörper --------------------------------------------------------------
  // Ein Vieleck ([r, z], gegen den Uhrzeigersinn) um die Hochachse gedreht:
  // vom Winkel w0 über den Bogen `weit`. Jedes Stück Mantel ist ein Körper
  // für male3d – so ordnen sie sich von hinten nach vorn.
  function drehFlaechen(profil, c, w0 = 0, weit = TAU, teile = 24) {
    const raus = [];
    const n = Math.max(1, Math.ceil((weit / TAU) * teile - 1e-9));
    const schritt = weit / n;
    const P = (p, w) => [p[0] * Math.cos(w), p[0] * Math.sin(w), p[1]];
    for (let i = 0; i < profil.length; i += 1) {
      const p = profil[i];
      const q = profil[(i + 1) % profil.length];
      // Was auf der Achse liegt, hat keine Fläche.
      if (p[0] < 1e-6 && q[0] < 1e-6) continue;
      const nr = q[1] - p[1];
      const nz = p[0] - q[0];
      const lang = Math.hypot(nr, nz) || 1;
      for (let k = 0; k < n; k += 1) {
        const a0 = w0 + k * schritt;
        const a1 = a0 + schritt;
        const am = a0 + schritt / 2;
        const pkte = [P(p, a0), P(p, a1), P(q, a1), P(q, a0)];
        raus.push({
          mitte: [((p[0] + q[0]) / 2) * Math.cos(am), ((p[0] + q[0]) / 2) * Math.sin(am), (p[1] + q[1]) / 2],
          flaechen: [{ n: [(nr / lang) * Math.cos(am), (nr / lang) * Math.sin(am), nz / lang], pkte, farbe: c, rand: "gleich" }],
        });
      }
    }
    return raus;
  }

  // Die flache Form selbst, in der Ebene durch die Achse beim Winkel w.
  function drehBlatt(profil, c, w) {
    const pkte = profil.map((p) => [p[0] * Math.cos(w), p[0] * Math.sin(w), p[1]]);
    const mitte = vMal(pkte.reduce((s, p) => vPlus(s, p), [0, 0, 0]), 1 / pkte.length);
    return { mitte, flaechen: [{ n: [-Math.sin(w), Math.cos(w), 0], pkte, farbe: c, beid: true }] };
  }

  const KOERPER_NAME = {
    zylinder: "Zylinder", kegel: "Kegel", spitze: "Kegel auf der Spitze", stumpf: "Kegelstumpf", doppel: "Doppelkegel", kugel: "Kugel", kuppel: "Halbkugel", scheibe: "Scheibe",
    rohr: "Rohr", ring: "Ring", sanduhr: "Sanduhr", trichter: "Trichter", kreisel: "Kreisel", spule: "Spule", kelch: "Kelch", pilz: "Pilz", rakete: "Rakete", stufe: "Stufe",
  };
  const DREH_RAUM = quader(-1.08, -1.08, 0, 1.08, 1.08, 1.9);
  // Die Körper der Auswahl ändern sich nicht: Jeder wird einmal gemalt und
  // danach als Bild wiederverwendet – sonst wären es in jedem Bild Hunderte
  // von Flächen.
  const drehBilder = new Map();
  function drehBild(profil, c, w, h) {
    const name = `${profilText(profil)}|${c.join(",")}|${Math.round(w)}x${Math.round(h)}|${view.dpr.toFixed(2)}`;
    let bild = drehBilder.get(name);
    if (!bild) {
      if (drehBilder.size > 28) drehBilder.clear();
      bild = document.createElement("canvas");
      bild.width = Math.max(1, Math.ceil(w * view.dpr));
      bild.height = Math.max(1, Math.ceil(h * view.dpr));
      const leinwand = g;
      g = bild.getContext("2d");
      g.scale(view.dpr, view.dpr);
      male3d(buehne({ x: 0, y: 0, w, h }, 30 * GRAD, 27 * GRAD, DREH_RAUM, 0.13), drehFlaechen(profil, c, 0, TAU, 30));
      g = leinwand;
      drehBilder.set(name, bild);
    }
    return bild;
  }
  function maleDrehkoerper(a, r, tz, e) {
    const { oben, unten } = obenUnten(r, 0.42);
    const u = view.u;
    const c = PALETTE[a.farbe];
    const gier = 30 * GRAD + wiegen(tz);
    const neig = 27 * GRAD;
    const profil = a.profile[a.soll];
    const weite = Math.max(...profil.map((p) => p[0]));
    const hoehe = Math.max(...profil.map((p) => p[1]));
    const B = buehne(oben, gier, neig, quader(-weite, -weite, -0.3, weite, weite, hoehe + 0.5), 0.07);
    B.k = Math.min(B.k, Math.min(oben.w, oben.h) / 2.2);
    // Die Achse steht in der Mitte.
    B.ox = oben.x + oben.w / 2;
    B.oy = oben.y + oben.h / 2 - vPunkt([0, 0, (hoehe + 0.2) / 2], B.s.v) * B.k;
    // Das Blatt steht quer zum Blick: Es ragt von der Achse nach rechts.
    const w0 = -30 * GRAD;
    const weit = TAU * fort(tz, 0.45, 2.7);
    const hoch = hoehe;
    // Die Achse: gestrichelt, unten wie oben über die Form hinaus.
    const achse = (von, bis) => {
      const p = imBild(B, [0, 0, von]);
      const q = imBild(B, [0, 0, bis]);
      g.save();
      g.strokeStyle = "rgba(242, 240, 255, 0.85)";
      g.lineWidth = Math.max(1.4, 1.8 * u);
      g.setLineDash([6, 5]);
      g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
      g.restore();
    };
    achse(-0.28, hoch + 0.42);
    // Im kleinen Beispiel der Vorschau reichen weniger Flächen.
    const koerper = weit > 0.001 ? drehFlaechen(profil, c, w0, weit, e.klein ? 16 : 30) : [];
    koerper.push(drehBlatt(profil, weit > 0.001 ? [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8] : c, w0 + weit));
    if (weit > 0.001 && weit < TAU - 0.001) koerper.push(drehBlatt(profil, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8], w0));
    male3d(B, koerper);
    // Vorn steht die Achse wieder heraus, und oben dreht der Pfeil.
    achse(hoch, hoch + 0.42);
    const kreis = (w) => imBild(B, [Math.cos(w) * 0.3, Math.sin(w) * 0.3, hoch + 0.26]);
    g.save();
    g.strokeStyle = GOLD;
    g.fillStyle = GOLD;
    g.lineWidth = Math.max(1.8, 2.2 * u);
    g.lineCap = "round";
    g.beginPath();
    for (let i = 0; i <= 18; i += 1) { const p = kreis(w0 + 0.5 + (i / 18) * 4.6); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }
    g.stroke();
    const spitze = kreis(w0 + 5.35);
    const hinten = kreis(w0 + 4.95);
    const quer = [-(spitze[1] - hinten[1]), spitze[0] - hinten[0]];
    g.beginPath();
    g.moveTo(spitze[0], spitze[1]);
    g.lineTo(hinten[0] + quer[0] * 0.75, hinten[1] + quer[1] * 0.75);
    g.lineTo(hinten[0] - quer[0] * 0.75, hinten[1] - quer[1] * 0.75);
    g.closePath();
    g.fill();
    g.restore();
    if (tz >= 0 && a.namen && KOERPER_NAME[a.namen[a.soll]]) {
      g.save();
      g.globalAlpha = fort(tz, 2.5, 3.0);
      schrift(KOERPER_NAME[a.namen[a.soll]], oben.x + oben.w / 2, oben.y + oben.h - 12 * u, clamp(oben.h * 0.085, 13, 22), GOLD);
      g.restore();
    }
    plaetze(unten, a.wahl).forEach((z, i) => {
      knopf(z, "", wahlZustand(a, e, tz, i), tz < 0 && !e.klein ? { was: "wahl", wert: i } : null);
      g.drawImage(drehBild(a.profile[i], tz >= 0.4 && i !== a.soll ? [150, 146, 176] : c, z.w - 4, z.h - 4), z.x + 2, z.y + 2, z.w - 4, z.h - 4);
    });
  }

  // --- Laser und Spiegel -------------------------------------------------------
  function maleLaser(a, r, tz, e) {
    const u = view.u;
    const n = a.n;
    const zelle = Math.min(r.w, r.h) / (n + 1.9);
    const x0 = r.x + (r.w - zelle * n) / 2;
    const y0 = r.y + (r.h - zelle * n) / 2;
    const ort = ([x, y]) => [x0 + x * zelle, y0 + y * zelle];
    // Das Feld.
    g.save();
    rundes(x0 - 3, y0 - 3, zelle * n + 6, zelle * n + 6, 8 * u);
    g.fillStyle = "rgba(8, 6, 24, 0.72)";
    g.fill();
    g.strokeStyle = "rgba(200, 185, 255, 0.4)";
    g.lineWidth = 1.4;
    g.stroke();
    g.strokeStyle = "rgba(226, 222, 255, 0.12)";
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 1; i < n; i += 1) { g.moveTo(x0 + i * zelle, y0); g.lineTo(x0 + i * zelle, y0 + n * zelle); g.moveTo(x0, y0 + i * zelle); g.lineTo(x0 + n * zelle, y0 + i * zelle); }
    g.stroke();
    g.restore();
    // Der Strahl: vor der Antwort nur sein Anfang, in der Auflösung der ganze Weg.
    const punkte = a.punkte.map(ort);
    const laengen = punkte.slice(1).map((p, i) => Math.hypot(p[0] - punkte[i][0], p[1] - punkte[i][1]));
    const ganzLang = laengen.reduce((s, x) => s + x, 0);
    const dauer = Math.min(2.2, 0.5 + 0.26 * laengen.length);
    const lauf = tz < 0 ? Math.min(zelle * 0.42, laengen[0]) : ruhig() ? ganzLang : Math.max(zelle * 0.42, ganzLang * clamp((tz - 0.3) / dauer, 0, 1));
    const strahl = (dick, farbeStrahl) => {
      g.save();
      g.strokeStyle = farbeStrahl;
      g.lineWidth = dick;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      g.moveTo(punkte[0][0], punkte[0][1]);
      let rest = lauf;
      for (let i = 0; i < laengen.length && rest > 0; i += 1) {
        const k = Math.min(1, rest / laengen[i]);
        g.lineTo(lerp(punkte[i][0], punkte[i + 1][0], k), lerp(punkte[i][1], punkte[i + 1][1], k));
        rest -= laengen[i];
      }
      g.stroke();
      g.restore();
    };
    strahl(zelle * 0.26, "rgba(255, 70, 70, 0.22)");
    strahl(zelle * 0.1, "#ff5252");
    strahl(Math.max(1, zelle * 0.035), "#ffe9e9");
    // Die Spiegel: «/» und «\».
    a.spiegel.forEach((art, i) => {
      if (!art) return;
      const x = i % n;
      const y = Math.floor(i / n);
      const p = art === 1 ? ort([x + 0.14, y + 0.86]) : ort([x + 0.14, y + 0.14]);
      const q = art === 1 ? ort([x + 0.86, y + 0.14]) : ort([x + 0.86, y + 0.86]);
      g.save();
      g.lineCap = "round";
      g.strokeStyle = "#5a6480";
      g.lineWidth = zelle * 0.17;
      g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
      g.strokeStyle = "#dfe7fb";
      g.lineWidth = zelle * 0.09;
      g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
      g.strokeStyle = "rgba(255, 255, 255, 0.9)";
      g.lineWidth = Math.max(1, zelle * 0.025);
      g.beginPath(); g.moveTo(lerp(p[0], q[0], 0.2), lerp(p[1], q[1], 0.2)); g.lineTo(lerp(p[0], q[0], 0.5), lerp(p[1], q[1], 0.5)); g.stroke();
      g.restore();
    });
    // Wo der Strahl schon um die Ecke ging, blitzt der Spiegel.
    if (tz >= 0 && !ruhig()) {
      let weit = 0;
      for (let i = 0; i < laengen.length - 1; i += 1) {
        weit += laengen[i];
        const seit = (lauf - weit) / zelle;
        if (seit <= 0 || seit > 1.4) continue;
        g.save();
        g.globalAlpha = 1 - seit / 1.4;
        g.strokeStyle = "#fff2b0";
        g.lineWidth = 2;
        g.beginPath(); g.arc(punkte[i + 1][0], punkte[i + 1][1], zelle * (0.2 + 0.3 * seit), 0, TAU); g.stroke();
        g.restore();
      }
    }
    // Die Stellen am Rand – und die Quelle des Strahls.
    const fertig = tz >= 0 && lauf >= ganzLang - 0.5;
    for (let i = 0; i < 4 * n; i += 1) {
      const rand = laserRand(n, i);
      const p = ort([rand.px - rand.dx * 0.5, rand.py - rand.dy * 0.5]);
      if (i === a.ein) {
        // Die Quelle: ein kleiner Kasten, der ins Feld zeigt.
        g.save();
        g.translate(p[0], p[1]);
        g.rotate(Math.atan2(rand.dy, rand.dx));
        rundes(-zelle * 0.3, -zelle * 0.2, zelle * 0.52, zelle * 0.4, zelle * 0.08);
        g.fillStyle = "#3a3560";
        g.fill();
        g.strokeStyle = "#cfc6ff";
        g.lineWidth = 1.3;
        g.stroke();
        g.fillStyle = "#ff5252";
        g.beginPath(); g.arc(zelle * 0.22, 0, zelle * 0.085, 0, TAU); g.fill();
        g.restore();
        continue;
      }
      const richtig = tz >= 0 && i === a.soll;
      const falsch = tz >= 0 && i === e.antwort && i !== a.soll;
      const rad = zelle * (e.klein ? 0.13 : 0.19);
      g.save();
      g.beginPath();
      g.arc(p[0], p[1], richtig && fertig ? rad * 1.35 : rad, 0, TAU);
      g.fillStyle = richtig && fertig ? GRUEN : falsch ? ROT : "rgba(14, 10, 34, 0.9)";
      g.fill();
      g.strokeStyle = richtig && fertig ? "#ffffff" : falsch ? "#ffffff" : tz < 0 ? HELL : "rgba(226, 222, 255, 0.4)";
      g.lineWidth = 1.5;
      g.stroke();
      g.restore();
      if (tz < 0 && !e.klein) bietet({ cx: p[0], cy: p[1], r: Math.max(zelle * 0.5, Math.min(20 * u, zelle * 0.7)), was: "wahl", wert: i });
    }
  }

  // --- Zahnräder ---------------------------------------------------------------
  // Ein Zahnrad: z Zähne, Halbmesser rad (im Teilkreis), um winkel gedreht.
  function maleRad(x, y, rad, z, winkel, c, k) {
    const aussen = rad + 0.1 * k;
    const fuss = rad - 0.12 * k;
    const teil = TAU / z;
    g.save();
    g.translate(x, y);
    g.rotate(winkel);
    g.beginPath();
    for (let i = 0; i < z; i += 1) {
      const w = i * teil;
      g.lineTo(Math.cos(w - teil * 0.27) * fuss, Math.sin(w - teil * 0.27) * fuss);
      g.lineTo(Math.cos(w - teil * 0.13) * aussen, Math.sin(w - teil * 0.13) * aussen);
      g.lineTo(Math.cos(w + teil * 0.13) * aussen, Math.sin(w + teil * 0.13) * aussen);
      g.lineTo(Math.cos(w + teil * 0.27) * fuss, Math.sin(w + teil * 0.27) * fuss);
    }
    g.closePath();
    const verlauf = g.createRadialGradient(-rad * 0.3, -rad * 0.3, rad * 0.1, 0, 0, aussen);
    verlauf.addColorStop(0, farbe(c, 1.18));
    verlauf.addColorStop(0.75, farbe(c, 0.92));
    verlauf.addColorStop(1, farbe(c, 0.66));
    g.fillStyle = verlauf;
    g.fill();
    g.strokeStyle = "rgba(14, 10, 34, 0.7)";
    g.lineWidth = Math.max(1, k * 0.03);
    g.lineJoin = "round";
    g.stroke();
    // Die Löcher in der Scheibe – an ihnen sieht man, dass es sich dreht.
    const loecher = z >= 12 ? 5 : 4;
    g.fillStyle = "rgba(14, 10, 34, 0.55)";
    for (let i = 0; i < loecher; i += 1) {
      const w = (i * TAU) / loecher;
      g.beginPath(); g.arc(Math.cos(w) * fuss * 0.58, Math.sin(w) * fuss * 0.58, fuss * 0.17, 0, TAU); g.fill();
    }
    g.fillStyle = farbe(c, 0.6);
    g.beginPath(); g.arc(0, 0, Math.max(2, k * 0.16), 0, TAU); g.fill();
    g.restore();
  }

  // Ein gebogener Pfeil um (x, y): sinn 1 im Uhrzeigersinn.
  function drehPfeil(x, y, rad, sinn, c, dick) {
    const von = -Math.PI * 0.75;
    const bis = von + sinn * Math.PI * 1.25;
    g.save();
    g.strokeStyle = c;
    g.fillStyle = c;
    g.lineWidth = dick;
    g.lineCap = "round";
    g.beginPath();
    g.arc(x, y, rad, von, bis, sinn < 0);
    g.stroke();
    const spitze = bis + sinn * 0.5;
    g.beginPath();
    g.moveTo(x + Math.cos(spitze) * rad, y + Math.sin(spitze) * rad);
    g.lineTo(x + Math.cos(bis) * (rad + dick * 1.8), y + Math.sin(bis) * (rad + dick * 1.8));
    g.lineTo(x + Math.cos(bis) * (rad - dick * 1.8), y + Math.sin(bis) * (rad - dick * 1.8));
    g.closePath();
    g.fill();
    g.restore();
  }

  const STAHL = [150, 166, 196];
  const RIEMEN_RAD = 0.3;
  function maleZahnrad(a, r, tz, e) {
    const u = view.u;
    const knopfHoch = e.klein ? 0 : Math.round(Math.min(46 * u, r.h * 0.11));
    const bild = { x: r.x, y: r.y, w: r.w, h: r.h - knopfHoch - (e.klein ? 0 : 8 * u) };
    // Liegt das Getriebe quer und das Bild hochkant (oder umgekehrt), wird es
    // um ein Viertel gedreht – die Drehrichtungen bleiben, wie sie sind.
    const quer = (a.box.breit > a.box.hoch) !== (bild.w > bild.h);
    const breit = quer ? a.box.hoch : a.box.breit;
    const hoch = quer ? a.box.breit : a.box.hoch;
    const k = Math.min(bild.w / (breit + 0.5), bild.h / (hoch + 0.5));
    const mx = bild.x + bild.w / 2;
    const my = bild.y + bild.h / 2;
    const ort = (o) => {
      const x = o.x - a.box.x0 - a.box.breit / 2;
      const y = o.y - a.box.y0 - a.box.hoch / 2;
      return quer ? [mx - y * k, my + x * k] : [mx + x * k, my + y * k];
    };
    const dazu = quer ? Math.PI / 2 : 0;
    // Die Auflösung: Das Getriebe läuft an.
    const zeit = tz < 0 || ruhig() ? 0 : Math.max(0, tz - 0.35);
    const lauf = 1.5 * (zeit < 0.8 ? (zeit * zeit) / 1.6 : zeit - 0.4);
    const winkel = (o) => o.phase + dazu + o.sinn * o.tempo * lauf;
    // Zuerst die Räder, dann die Riemen darüber.
    a.raeder.forEach((o, i) => {
      const [x, y] = ort(o);
      const an = i > 0 && (e.wert >> (i - 1)) & 1;
      maleRad(x, y, radHalb(o.z) * k, o.z, winkel(o), i === 0 ? [240, 190, 80] : an && tz < 0 ? [176, 150, 250] : STAHL, k);
    });
    a.raeder.forEach((o) => {
      if (o.von < 0 || o.art === "zahn") return;
      const p = ort(a.raeder[o.von]);
      const q = ort(o);
      const lang = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const nx = (-(q[1] - p[1]) / lang) * RIEMEN_RAD * k;
      const ny = ((q[0] - p[0]) / lang) * RIEMEN_RAD * k;
      const kreuz = o.art === "kreuz" ? -1 : 1;
      g.save();
      g.lineCap = "round";
      for (const rand of [1, -1]) {
        g.strokeStyle = "#221d3d";
        g.lineWidth = Math.max(2.5, k * 0.1);
        g.setLineDash([]);
        g.beginPath(); g.moveTo(p[0] + nx * rand, p[1] + ny * rand); g.lineTo(q[0] + nx * rand * kreuz, q[1] + ny * rand * kreuz); g.stroke();
        // Die Rippen des Riemens wandern, wenn er läuft.
        g.strokeStyle = "rgba(226, 222, 255, 0.55)";
        g.lineWidth = Math.max(1, k * 0.035);
        g.setLineDash([k * 0.1, k * 0.14]);
        g.lineDashOffset = -rand * a.raeder[o.von].sinn * a.raeder[o.von].tempo * lauf * RIEMEN_RAD * k;
        g.beginPath(); g.moveTo(p[0] + nx * rand, p[1] + ny * rand); g.lineTo(q[0] + nx * rand * kreuz, q[1] + ny * rand * kreuz); g.stroke();
      }
      g.setLineDash([]);
      for (const m of [p, q]) {
        g.fillStyle = "#221d3d";
        g.beginPath(); g.arc(m[0], m[1], RIEMEN_RAD * k, 0, TAU); g.fill();
        g.strokeStyle = "rgba(226, 222, 255, 0.5)";
        g.lineWidth = 1.2;
        g.stroke();
      }
      g.restore();
    });
    // Was man weiss, was gewählt ist – und in der Auflösung, wie jedes dreht.
    a.raeder.forEach((o, i) => {
      const [x, y] = ort(o);
      const rad = radHalb(o.z) * k;
      const an = i > 0 && (e.wert >> (i - 1)) & 1;
      const soll = i > 0 && (a.soll >> (i - 1)) & 1;
      const dick = Math.max(2, k * 0.07);
      if (i === 0) drehPfeil(x, y, rad * 0.62, 1, "#3a2606", dick);
      else if (tz >= 0) {
        const da = fort(tz, 0.5, 1.1);
        g.save();
        g.globalAlpha = da;
        drehPfeil(x, y, rad * 0.62, o.sinn, o.sinn === 1 ? "#0f3d22" : "rgba(20, 14, 40, 0.75)", dick);
        if (an || soll) {
          g.lineWidth = 3;
          g.strokeStyle = an ? (soll ? GRUEN : ROT) : GOLD;
          if (!an) g.setLineDash([5, 4]);
          g.beginPath(); g.arc(x, y, rad + 0.16 * k, 0, TAU); g.stroke();
        }
        g.restore();
      } else if (an) {
        g.save();
        g.lineWidth = 2.6;
        g.strokeStyle = AKZENT;
        g.beginPath(); g.arc(x, y, rad + 0.16 * k, 0, TAU); g.stroke();
        g.restore();
      }
      if (i > 0 && tz < 0 && !e.klein) bietet({ cx: x, cy: y, r: Math.max(rad + 0.1 * k, 20 * u), was: "feld", wert: i - 1 });
    });
    if (!e.klein) {
      const b = Math.min(r.w * 0.6, 200 * u);
      knopf({ x: r.x + (r.w - b) / 2, y: r.y + r.h - knopfHoch, w: b, h: knopfHoch }, "Fertig", e.wert ? "an" : "aus", tz < 0 ? { was: "fertig" } : null, clamp(knopfHoch * 0.4, 13, 19));
    }
  }

  // --- Kugelbahn ---------------------------------------------------------------
  const KUGEL_RAD = 0.2;
  const KUGEL_SCHRAEG = 0.13;
  function maleKugelbahn(a, r, tz, e) {
    const u = view.u;
    const hoehe = a.ebenen + 2.25;
    const k = Math.min(r.w / (a.breit + 0.5), r.h / hoehe);
    const x0 = r.x + (r.w - a.breit * k) / 2;
    const y0 = r.y + (r.h - hoehe * k) / 2;
    const ebeneY = (nr) => 1.25 + nr;
    const bodenY = a.ebenen + 1.95;
    const X = (x) => x0 + x * k;
    const Y = (y) => y0 + y * k;
    // Wie hoch die Rampe an der Stelle x liegt.
    const rampeY = (nr, rampe, x) => ebeneY(nr) + rampe.sinn * KUGEL_SCHRAEG * (x - (rampe.a + rampe.b + 1) / 2);
    // Die Wand, an der alles hängt.
    g.save();
    rundes(X(0) - 5, Y(0), a.breit * k + 10, hoehe * k, 10 * u);
    g.fillStyle = "rgba(8, 6, 24, 0.5)";
    g.fill();
    g.strokeStyle = "rgba(200, 185, 255, 0.3)";
    g.lineWidth = 1.2;
    g.stroke();
    g.restore();
    // Die Fächer.
    for (let i = 0; i < a.breit; i += 1) {
      const z = { x: X(i) + 2, y: Y(bodenY - 0.62), w: k - 4, h: k * 0.86 };
      const zustand = wahlZustand(a, e, tz, i);
      g.save();
      rundes(z.x, z.y, z.w, z.h, 6 * u);
      g.fillStyle = zustand === "gut" ? "rgba(74, 222, 128, 0.3)" : zustand === "schlecht" ? "rgba(255, 107, 107, 0.3)" : "rgba(255, 255, 255, 0.08)";
      g.fill();
      g.lineWidth = zustand ? 2.4 : 1.2;
      g.strokeStyle = zustand === "gut" ? GRUEN : zustand === "schlecht" ? ROT : "rgba(226, 222, 255, 0.35)";
      g.stroke();
      g.fillStyle = zustand ? HELL : ZART;
      g.font = `700 ${Math.round(clamp(k * 0.3, 10, 20))}px ${SANS}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(String(i + 1), z.x + z.w / 2, z.y + z.h * 0.66);
      g.restore();
      if (tz < 0 && !e.klein) bietet({ ...z, was: "wahl", wert: i });
    }
    // Die Rampen: Bretter mit einer hellen Kante.
    a.rampen.forEach((ebene, nr) => ebene.forEach((rampe) => {
      const p = [X(rampe.a + 0.04), Y(rampeY(nr, rampe, rampe.a))];
      const q = [X(rampe.b + 0.96), Y(rampeY(nr, rampe, rampe.b + 1))];
      g.save();
      g.lineCap = "round";
      g.strokeStyle = "rgba(0, 0, 0, 0.35)";
      g.lineWidth = k * 0.17;
      g.beginPath(); g.moveTo(p[0], p[1] + k * 0.05); g.lineTo(q[0], q[1] + k * 0.05); g.stroke();
      g.strokeStyle = "#a9764a";
      g.lineWidth = k * 0.15;
      g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
      g.strokeStyle = "#e3b987";
      g.lineWidth = Math.max(1.2, k * 0.035);
      g.beginPath(); g.moveTo(p[0], p[1] - k * 0.05); g.lineTo(q[0], q[1] - k * 0.05); g.stroke();
      g.restore();
    }));
    // Der Weg der Kugel: fallen, rollen, fallen … – als Stücke mit ihrer Dauer.
    const stuecke = [];
    let ort = [a.start + 0.5, 0.48];
    for (const w of a.weg) {
      const rampe = a.rampen[w.ebene].find((s) => s.a <= w.von && w.von <= s.b);
      const auf = [w.von + 0.5, rampeY(w.ebene, rampe, w.von + 0.5) - KUGEL_RAD - 0.075];
      stuecke.push({ art: "fall", von: ort, bis: auf, dauer: 0.3 * Math.sqrt(Math.max(0.05, auf[1] - ort[1])) });
      const kante = rampe.sinn > 0 ? rampe.b + 1 : rampe.a;
      const ab = [kante, rampeY(w.ebene, rampe, kante) - KUGEL_RAD - 0.075];
      stuecke.push({ art: "roll", von: auf, bis: ab, dauer: 0.16 + 0.2 * Math.abs(kante - auf[0]) });
      ort = ab;
    }
    const ziel = [a.soll + 0.5, bodenY + 0.02];
    stuecke.push({ art: "fall", von: ort, bis: ziel, dauer: 0.3 * Math.sqrt(Math.max(0.05, ziel[1] - ort[1])) });
    const gesamt = stuecke.reduce((s, x) => s + x.dauer, 0);
    const tempo = Math.max(1, gesamt / 2.5);
    let zeit = tz < 0 ? 0 : ruhig() ? gesamt : Math.max(0, tz - 0.35) * tempo;
    let kugel = stuecke[0].von;
    let gerollt = 0;
    for (const s of stuecke) {
      const t = clamp(zeit / s.dauer, 0, 1);
      if (s.art === "fall") kugel = [lerp(s.von[0], s.bis[0], 1 - (1 - t) ** 2.4), lerp(s.von[1], s.bis[1], t * t)];
      else { const f = t * t * 0.6 + t * 0.4; kugel = [lerp(s.von[0], s.bis[0], f), lerp(s.von[1], s.bis[1], f)]; gerollt += (s.bis[0] - s.von[0]) * f; }
      zeit -= s.dauer;
      if (zeit <= 0) break;
    }
    // Vor der Antwort: der Pfeil, der zeigt, wo sie loslässt.
    if (tz < 0) {
      g.save();
      g.strokeStyle = GOLD;
      g.fillStyle = GOLD;
      g.lineWidth = Math.max(1.6, k * 0.045);
      g.lineCap = "round";
      const px = X(kugel[0]);
      const py = Y(kugel[1] + KUGEL_RAD + 0.08);
      g.beginPath(); g.moveTo(px, py); g.lineTo(px, py + k * 0.2); g.stroke();
      g.beginPath(); g.moveTo(px, py + k * 0.34); g.lineTo(px - k * 0.1, py + k * 0.18); g.lineTo(px + k * 0.1, py + k * 0.18); g.closePath(); g.fill();
      g.restore();
    }
    // Die Kugel: Stahl mit einem Glanzpunkt, der mitrollt.
    const kx = X(kugel[0]);
    const ky = Y(kugel[1]);
    const rad = KUGEL_RAD * k;
    g.save();
    g.fillStyle = "rgba(0, 0, 0, 0.3)";
    g.beginPath(); g.ellipse(kx + rad * 0.15, ky + rad * 0.9, rad * 0.9, rad * 0.28, 0, 0, TAU); g.fill();
    const glanz = g.createRadialGradient(kx - rad * 0.35, ky - rad * 0.4, rad * 0.1, kx, ky, rad);
    glanz.addColorStop(0, "#ffffff");
    glanz.addColorStop(0.35, "#ffd98a");
    glanz.addColorStop(1, "#b9791c");
    g.fillStyle = glanz;
    g.beginPath(); g.arc(kx, ky, rad, 0, TAU); g.fill();
    g.strokeStyle = "rgba(60, 30, 0, 0.6)";
    g.lineWidth = 1;
    g.stroke();
    const dreh = gerollt / KUGEL_RAD;
    g.fillStyle = "rgba(90, 50, 0, 0.55)";
    g.beginPath(); g.arc(kx + Math.cos(dreh) * rad * 0.5, ky + Math.sin(dreh) * rad * 0.5, rad * 0.16, 0, TAU); g.fill();
    g.restore();
  }

  const MALEN = {
    falten: maleFalten, netz: maleNetz, stapel: maleStapel, ansicht: maleAnsicht, drehen: maleDrehen, rollen: maleRollen, schnitt: maleSchnitt,
    farbe: maleFarbe, muster: maleMuster, luecke: maleLuecke, schatten: maleSchatten, drehkoerper: maleDrehkoerper, laser: maleLaser, zahnrad: maleZahnrad, kugelbahn: maleKugelbahn,
  };

  // ---------------------------------------------------------------------------
  // Zeichnen: Leinwand, Vorschau, Kopf, Uhr und Filmstreifen
  // ---------------------------------------------------------------------------
  function umbrechen(text, breit) {
    const zeilen = [];
    let zeile = "";
    for (const wort of text.split(" ")) {
      const neu = zeile ? `${zeile} ${wort}` : wort;
      if (zeile && g.measureText(neu).width > breit) { zeilen.push(zeile); zeile = wort; } else zeile = neu;
    }
    if (zeile) zeilen.push(zeile);
    return zeilen;
  }

  // Die Leinwand: ein dunkles Feld mit einem Schimmer, wie im Kino.
  function zeichneLeinwand() {
    const r = view.lw;
    const u = view.u;
    g.save();
    g.shadowColor = "rgba(124, 92, 255, 0.35)";
    g.shadowBlur = 34;
    rundes(r.x, r.y, r.w, r.h, 16 * u);
    const verlauf = g.createLinearGradient(0, r.y, 0, r.y + r.h);
    verlauf.addColorStop(0, "#2a2752");
    verlauf.addColorStop(1, "#191735");
    g.fillStyle = verlauf;
    g.fill();
    g.restore();
    g.save();
    rundes(r.x, r.y, r.w, r.h, 16 * u);
    g.clip();
    const licht = g.createRadialGradient(r.x + r.w / 2, r.y + r.h * 0.38, r.w * 0.05, r.x + r.w / 2, r.y + r.h * 0.45, Math.max(r.w, r.h) * 0.75);
    licht.addColorStop(0, "rgba(190, 170, 255, 0.2)");
    licht.addColorStop(1, "rgba(190, 170, 255, 0)");
    g.fillStyle = licht;
    g.fillRect(r.x, r.y, r.w, r.h);
    g.restore();
    g.save();
    rundes(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 16 * u);
    g.strokeStyle = "rgba(200, 185, 255, 0.28)";
    g.lineWidth = 1;
    g.stroke();
    g.restore();
  }

  const innen = () => { const p = Math.round(12 * view.u); return { x: view.lw.x + p, y: view.lw.y + p, w: view.lw.w - 2 * p, h: view.lw.h - 2 * p }; };

  // Die Vorschau: was zu tun ist, und ein Beispiel, das sich selbst auflöst.
  function zeichneVorschau(a, r) {
    const u = view.u;
    const jetzt = performance.now();
    const t = (jetzt - state.vorSeit) / 1000;
    g.save();
    g.textAlign = "center";
    g.textBaseline = "top";
    g.fillStyle = STUFEN_FARBE[a.stufe];
    g.font = `700 ${Math.round(11.5 * u)}px ${SANS}`;
    g.fillText(`${TESTRUNDE ? "TESTRUNDE" : "AUFGABE"} ${state.index + 1} VON ${anzahl()}  ·  ${STUFE[a.stufe].toUpperCase()}`, r.x + r.w / 2, r.y + 2 * u);
    g.fillStyle = HELL;
    g.font = `italic 700 ${Math.round(27 * u)}px ${SERIF}`;
    g.fillText(a.kurz, r.x + r.w / 2, r.y + 19 * u);
    g.font = `500 ${Math.round(13.5 * u)}px ${SANS}`;
    g.fillStyle = "rgba(233, 229, 255, 0.88)";
    const zeilen = umbrechen(a.frage, r.w - 8 * u);
    zeilen.forEach((zeile, i) => g.fillText(zeile, r.x + r.w / 2, r.y + 54 * u + i * 17.5 * u));
    const oben = r.y + 54 * u + zeilen.length * 17.5 * u + 8 * u;
    const unten = r.y + r.h - 28 * u;
    const kasten = { x: r.x + r.w * 0.06, y: oben, w: r.w * 0.88, h: Math.max(40, unten - oben) };
    rundes(kasten.x, kasten.y, kasten.w, kasten.h, 12 * u);
    g.fillStyle = "rgba(10, 8, 28, 0.42)";
    g.fill();
    g.strokeStyle = "rgba(200, 185, 255, 0.22)";
    g.setLineDash([5, 4]);
    g.stroke();
    g.setLineDash([]);
    g.restore();
    const b = state.beispiel;
    if (b) {
      // Erst die Frage, dann läuft ihr Film – und wieder von vorn.
      const film = ZEIGEN_MS[b.art] / 1000;
      const lauf = (t % (1.5 + film)) - 1.5;
      const p = Math.round(8 * u);
      g.save();
      rundes(kasten.x, kasten.y, kasten.w, kasten.h, 12 * u);
      g.clip();
      MALEN[b.art](b, { x: kasten.x + p, y: kasten.y + p, w: kasten.w - 2 * p, h: kasten.h - 2 * p }, ruhig() ? 99 : lauf, { klein: true, wert: 0, getippt: "", antwort: undefined });
      g.restore();
    }
    const rest = VORSCHAU - t;
    g.save();
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.globalAlpha = rest <= VOR_ZAEHLT ? 1 : 0.55 + 0.45 * Math.sin(jetzt / 320) ** 2;
    g.fillStyle = rest <= VOR_ZAEHLT ? GOLD : HELL;
    g.font = `700 ${Math.round(14 * u)}px ${SANS}`;
    g.fillText(rest <= VOR_ZAEHLT ? `Es geht los in ${Math.max(1, Math.ceil(rest))}` : zuschauer ? "gleich geht es los" : "Tippe, wenn du bereit bist", r.x + r.w / 2, r.y + r.h - 12 * u);
    g.restore();
  }

  // Vor der ersten Runde: der Titel, und eine Figur, die sich dreht.
  const TITEL_FIGUR = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0], [2, 2, 0], [2, 2, 1], [2, 2, 2], [1, 2, 2]];
  function zeichneTitel(r) {
    const u = view.u;
    const jetzt = performance.now();
    g.save();
    g.textAlign = "center";
    g.textBaseline = "top";
    g.fillStyle = HELL;
    g.font = `italic 700 ${Math.round(42 * u)}px ${SERIF}`;
    g.fillText("Kopfkino", r.x + r.w / 2, r.y + r.h * 0.05);
    g.font = `500 ${Math.round(14 * u)}px ${SANS}`;
    g.fillStyle = "rgba(233, 229, 255, 0.88)";
    g.fillText(TESTRUNDE ? `Testrunde: alle ${anzahl()} Aufgaben. Es zählt nichts.` : "Zehn Aufgaben. Der Film läuft im Kopf.", r.x + r.w / 2, r.y + r.h * 0.05 + 54 * u);
    g.restore();
    const platz = { x: r.x, y: r.y + r.h * 0.26, w: r.w, h: r.h * 0.56 };
    maleFigur(platz, TITEL_FIGUR, drehung([0, 0, 1], ruhig() ? 0.6 : jetzt / 2600), PALETTE[4], ISO[0], Math.min(platz.w, platz.h) / 6.4);
    g.save();
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.globalAlpha = 0.55 + 0.45 * Math.sin(jetzt / 320) ** 2;
    g.fillStyle = HELL;
    g.font = `700 ${Math.round(14 * u)}px ${SANS}`;
    g.fillText(zuschauer || shell?.live ? "gleich geht es los" : "Tippe, um zu beginnen", r.x + r.w / 2, r.y + r.h - 14 * u);
    g.restore();
  }

  // Über der Leinwand (oder links daneben): welche Aufgabe, was zu tun ist.
  function zeichneKopf() {
    const a = aufgabe();
    const t = view.text;
    if (!a || !t || state.phase === "bereit" || state.phase === "warten") return;
    const u = view.u;
    g.save();
    g.textAlign = "left";
    g.textBaseline = "top";
    g.font = `700 ${Math.round(11.5 * u)}px ${SANS}`;
    g.fillStyle = STUFEN_FARBE[a.stufe];
    g.fillText(`${TESTRUNDE ? "TEST" : "AUFGABE"} ${state.index + 1}/${anzahl()}  ·  ${STUFE[a.stufe].toUpperCase()}`, t.x, t.y);
    g.fillStyle = HELL;
    g.font = `italic 700 ${Math.round(22 * u)}px ${SERIF}`;
    g.fillText(a.kurz, t.x, t.y + 16 * u);
    if (state.phase !== "vorschau") {
      g.font = `500 ${Math.round(13.5 * u)}px ${SANS}`;
      g.fillStyle = "rgba(233, 229, 255, 0.82)";
      umbrechen(a.frage, t.w).slice(0, view.flach ? 9 : 3).forEach((zeile, i) => g.fillText(zeile, t.x, t.y + 44 * u + i * 17 * u));
    }
    g.restore();
  }

  // Die Uhr: ein Balken unter der Leinwand. Solange er golden ist, gibt eine
  // richtige Antwort alles; daneben steht, was sie jetzt gäbe.
  function zeichneUhr() {
    if (state.phase !== "aufgabe") return;
    const a = aufgabe();
    const u = view.u;
    const zeit = gebraucht();
    const rest = clamp(1 - zeit / a.zeit, 0, 1);
    const voll = zeit <= a.zeit * VOLL;
    const eng = a.zeit - zeit <= 3;
    const hoch = Math.max(5, 6 * u);
    const breit = view.lw.w - 46 * u;
    const x = view.lw.x;
    const y = view.lw.y + view.lw.h + Math.round(8 * u);
    g.save();
    rundes(x, y, breit, hoch, hoch / 2);
    g.fillStyle = "rgba(226, 222, 255, 0.14)";
    g.fill();
    rundes(x, y, Math.max(hoch, breit * rest), hoch, hoch / 2);
    g.fillStyle = eng ? ROT : voll ? GOLD : HELL;
    g.globalAlpha = eng ? 0.75 + 0.25 * Math.sin(performance.now() / 90) ** 2 : 0.92;
    g.fill();
    g.globalAlpha = 1;
    // Die Marke: bis hierher gibt es alles.
    g.fillStyle = "rgba(20, 14, 40, 0.9)";
    g.fillRect(x + breit * (1 - VOLL) - 1, y - 2, 2, hoch + 4);
    g.font = `800 ${Math.round(14 * u)}px ${SANS}`;
    g.textAlign = "right";
    g.textBaseline = "middle";
    g.fillStyle = voll ? GOLD : HELL;
    g.fillText(String(Math.round(PUNKTE_JE_AUFGABE * zeitFaktor(a, zeit))), view.lw.x + view.lw.w, y + hoch / 2 + 1);
    g.restore();
  }

  // Der Filmstreifen: zehn Bilder, eines je Aufgabe.
  function zeichneFilm() {
    const f = view.film;
    if (!f) return;
    const u = view.u;
    const bild = (i, x, y, w, h) => {
      const e = state.liste[i];
      const dran = i === state.index && state.phase !== "ende" && state.phase !== "bereit" && state.phase !== "warten";
      g.save();
      rundes(x, y, w, h, 5 * u);
      g.fillStyle = !e ? (dran ? "rgba(167, 139, 250, 0.3)" : "rgba(255, 255, 255, 0.06)") : e.punkte >= PUNKTE_JE_AUFGABE ? "rgba(255, 209, 102, 0.28)" : e.punkte >= 50 ? "rgba(74, 222, 128, 0.22)" : e.punkte > 0 ? "rgba(86, 180, 233, 0.22)" : "rgba(255, 107, 107, 0.2)";
      g.fill();
      g.lineWidth = dran ? 2 : 1;
      g.strokeStyle = dran ? AKZENT : !e ? "rgba(226, 222, 255, 0.18)" : e.punkte >= PUNKTE_JE_AUFGABE ? GOLD : e.punkte >= 50 ? GRUEN : e.punkte > 0 ? "#56b4e9" : ROT;
      g.stroke();
      g.font = `${e ? 800 : 600} ${Math.round(clamp(Math.min(w * 0.42, h * 0.5), 10, 20))}px ${SANS}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = e ? (e.punkte >= PUNKTE_JE_AUFGABE ? GOLD : HELL) : "rgba(226, 222, 255, 0.4)";
      g.fillText(e ? String(e.punkte) : String(i + 1), x + w / 2, y + h / 2 + 1);
      g.restore();
    };
    const loch = (x, y, w, h) => { rundes(x, y, w, h, 1.5); g.fill(); };
    // Hat die Runde mehr als zehn Aufgaben (die Testrunde), zeigt der
    // Streifen die zehn, zu denen die aktuelle gehört.
    const ab = Math.floor(Math.min(state.index, anzahl() - 1) / AUFGABEN) * AUFGABEN;
    const platz = (i, x, y, w, h) => { if (ab + i < anzahl()) bild(ab + i, x, y, w, h); };
    g.save();
    rundes(f.x, f.y, f.w, f.h, 8 * u);
    g.fillStyle = "#0c0a1c";
    g.fill();
    g.strokeStyle = "rgba(200, 185, 255, 0.16)";
    g.stroke();
    g.fillStyle = "rgba(226, 222, 255, 0.24)";
    if (f.quer) {
      // Die Löcher oben und unten, dazwischen die zehn Bilder.
      const rand = Math.round(Math.min(9 * u, f.h * 0.2));
      const luft = Math.max(3, f.w * 0.012);
      const w = (f.w - luft * 11) / 10;
      for (let i = 0; i < 30; i += 1) {
        const x = f.x + ((i + 0.5) * f.w) / 30 - 2.5 * u;
        loch(x, f.y + rand * 0.28, 5 * u, rand * 0.44);
        loch(x, f.y + f.h - rand * 0.72, 5 * u, rand * 0.44);
      }
      g.restore();
      for (let i = 0; i < AUFGABEN; i += 1) platz(i, f.x + luft + i * (w + luft), f.y + rand, w, f.h - rand * 2);
    } else {
      // Hochkant: die Löcher links und rechts, die Bilder in zwei Spalten.
      const rand = Math.round(Math.min(11 * u, f.w * 0.1));
      const luft = Math.max(4, f.h * 0.012);
      const h = (f.h - luft * 6) / 5;
      const w = (f.w - rand * 2 - luft) / 2;
      for (let i = 0; i < 20; i += 1) {
        const y = f.y + ((i + 0.5) * f.h) / 20 - 2.5 * u;
        loch(f.x + rand * 0.28, y, rand * 0.44, 5 * u);
        loch(f.x + f.w - rand * 0.72, y, rand * 0.44, 5 * u);
      }
      g.restore();
      for (let i = 0; i < AUFGABEN; i += 1) platz(i, f.x + rand + (i % 2) * (w + luft), f.y + luft + Math.floor(i / 2) * (h + luft), w, h);
    }
  }

  // Was die Antwort gab: ein Schild oben rechts auf der Leinwand.
  function zeichneSchild(tz) {
    const w = state.wertung;
    if (!w || tz < 0.1) return;
    const u = view.u;
    const federn = ruhig() ? 1 : 1 + 0.5 * Math.exp(-(tz - 0.1) * 12) * Math.cos((tz - 0.1) * 18);
    const text = state.antwort === null ? "Zeit um" : w.punkte > 0 ? `+${w.punkte}` : "0";
    const c = w.punkte >= PUNKTE_JE_AUFGABE ? GOLD : w.punkte > 0 ? GRUEN : ROT;
    g.save();
    g.font = `800 ${Math.round(20 * u)}px ${SANS}`;
    const breit = g.measureText(text).width + 26 * u;
    const hoch = 34 * u;
    g.translate(view.lw.x + view.lw.w - breit / 2 - 12 * u, view.lw.y + hoch / 2 + 12 * u);
    g.scale(federn, federn);
    rundes(-breit / 2, -hoch / 2, breit, hoch, hoch / 2);
    g.fillStyle = "rgba(12, 10, 28, 0.86)";
    g.fill();
    g.strokeStyle = c;
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = c;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 0, 1);
    g.restore();
  }

  function zeichnen() {
    if (!g || !view.cssW || !view.lw) return;
    const d = view.dpr;
    const jetzt = performance.now();
    g.setTransform(d, 0, 0, d, 0, 0);
    // Der Saal: dunkel.
    const saal = g.createLinearGradient(0, 0, 0, view.cssH);
    saal.addColorStop(0, "#100e22");
    saal.addColorStop(1, "#0a0916");
    g.fillStyle = saal;
    g.fillRect(0, 0, view.cssW, view.cssH);
    zeichneLeinwand();
    const r = innen();
    const a = aufgabe();
    treffer = [];
    if (state.phase === "bereit" || state.phase === "warten") zeichneTitel(r);
    else if (state.phase === "vorschau" && a) zeichneVorschau(a, r);
    else if (a) {
      const tz = state.phase === "aufgabe" ? -1 : (jetzt - state.tZeig) / 1000;
      malt.lebt = state.phase === "aufgabe" && !zuschauer;
      MALEN[a.art](a, r, tz, { klein: false, wert: state.wert, getippt: state.getippt, antwort: state.antwort });
      malt.lebt = false;
      if (state.phase !== "aufgabe") zeichneSchild(tz);
    }
    // Ein neues Bild blendet auf.
    const blende = ruhig() ? 1 : clamp((jetzt - state.gewendet) / (EINZUG * 1000), 0, 1);
    if (blende < 1) {
      g.save();
      rundes(view.lw.x, view.lw.y, view.lw.w, view.lw.h, 16 * view.u);
      g.fillStyle = `rgba(30, 27, 62, ${1 - weich(0, 1, blende)})`;
      g.fill();
      g.restore();
    }
    zeichneKopf();
    zeichneUhr();
    zeichneFilm();
    if (state.funken.length) {
      g.save();
      for (const f of state.funken) {
        g.globalAlpha = clamp(1 - f.alt / f.leben, 0, 1);
        g.fillStyle = "#ffd98a";
        g.beginPath();
        g.arc(f.x, f.y, f.gross * view.u, 0, TAU);
        g.fill();
      }
      g.restore();
    }
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Dieselben Aufgaben (die Saat hält geist.js oder der Abend), und Zug um
  // Zug, was der andere tat: dieselbe Eingabe, dieselbe Antwort, zur selben Zeit.
  let gesehenBis = -1;
  function zuschauenTakt() {
    if (!zuschauer?.seit) return;
    const jetzt = zuschauer.jetzt();
    for (const zug of zuschauer.seit(gesehenBis, jetzt)) {
      const was = ((zug.c % 8) + 8) % 8;
      const index = clamp(Math.floor(zug.c / 8), 0, AUFGABEN - 1);
      const damals = performance.now() - Math.max(0, jetzt - zug.t);
      if (was === 0) {
        aufgabeAuf(index);
        state.vorSeit = damals;
        state.gewendet = damals;
      } else if (was === 1) {
        if (state.index !== index || state.phase !== "vorschau") aufgabeAuf(index);
        aufgabeLos();
        state.t0 = damals;
        state.gewendet = damals;
      } else if (state.phase === "aufgabe" && state.index === index) {
        const a = aufgabe();
        if (was === 2) {
          state.wert = zug.a;
          state.getippt = a.eingabe === "zahl" && zug.a ? String(zug.a) : "";
        } else if (was === 3 || was === 4) {
          const wert = was === 4 && !zug.b ? null : zug.a;
          if (wert !== null && a.eingabe === "zahl") state.getippt = String(wert);
          antworte(wert, zug.p - state.punkte, was === 3 ? zug.b / 1000 : a.zeit);
          state.tZeig = damals;
        }
      }
      if (zug.p !== state.punkte && was >= 3) { state.punkte = zug.p; shell.setCount(zug.p); }
    }
    gesehenBis = jetzt;
    zuschauer.weiter?.();
  }

  function zuschauenStarten() {
    if (!zuschauer?.seit) return;
    startRun();
    state.phase = "warten";
    shell.setPhase("play");
    gesehenBis = -1;
    zuschauer.los?.();
  }

  // ---------------------------------------------------------------------------
  // Ablauf der Runde
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Tipp – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    shell.setPhase("play");
    aufnahme?.los();
    aufgabeAuf(0);
  }

  function startRun() {
    clearStep();
    stopLoop();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.aufgaben = TESTRUNDE ? testAufgaben() : aufgabenFuer();
    state.phase = "bereit";
    state.index = 0;
    state.punkte = 0;
    state.liste = new Array(anzahl()).fill(null);
    state.wert = 0;
    state.getippt = "";
    state.antwort = null;
    state.wertung = null;
    state.volle = 0;
    state.funken = [];
    state.beispiel = null;
    state.gewendet = performance.now();
    shell.setCount(0);

    shell.clear();
    const prompt = shell.el("p", "cm-prompt kn-prompt", TESTRUNDE
      ? `Testrunde: alle ${anzahl()} Aufgaben nacheinander – nichts wird gespeichert.`
      : "Stell dir vor, was geschieht – richtig und schnell gibt am meisten.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(900, 250 + ziel);
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
    if (zuschauer) return;
    clearStep();
    if (state.phase === "ende") return;
    // Im Live-Modus endet die Runde auch mitten in einer Aufgabe: Es zählt,
    // was bis dahin beantwortet ist.
    state.phase = "ende";
    const punkte = state.punkte;
    if (TESTRUNDE) { testEnde(punkte); return; }
    const geist = aufnahme?.ende() || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    const fertig = state.liste.filter(Boolean);
    const richtig = fertig.filter((e) => e.anteil >= 1).length;
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: [
        rekord ? "Neuer Rekord!" : "",
        `${richtig} von ${anzahl()} richtig`,
        state.volle ? `${state.volle} mit vollen Punkten` : "",
        !rekord && vorher ? `Bestwert ${vorher}` : "",
      ].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("kn-rekord");
    zaehleHoch(punkte);
  }

  // Die Tafel der Testrunde: die Punkte, wie viele richtig waren und wo es
  // daneben ging – ohne Bestenliste, ohne Rekord, ohne Aufzeichnung.
  function testEnde(punkte) {
    const fertig = state.liste.filter(Boolean);
    const richtig = fertig.filter((e) => e.anteil >= 1).length;
    const daneben = state.aufgaben
      .map((a, i) => (state.liste[i] && state.liste[i].anteil < 1 ? `${KURZ[a.art]} (${STUFE[a.stufe]})` : ""))
      .filter(Boolean);
    shell.showResult({
      label: "Testrunde",
      points: punkte,
      detail: [
        `${richtig} von ${anzahl()} richtig`,
        state.volle ? `${state.volle} mit vollen Punkten` : "",
        daneben.length ? `daneben: ${daneben.join(", ")}` : "",
        "nichts gespeichert",
      ].filter(Boolean).join(" · "),
      eintragen: false,
    });
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Bestenliste – lokal und in der Cloud
  // ---------------------------------------------------------------------------
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.kopfkino", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
    : {
      read: () => ({ runs: 0, scores: [] }),
      write(data) { return data; },
      update(fn) { return fn(this.read()); },
      onChange() { return () => {}; },
    };

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Kopfkino",
    area: "konzentration",
    accent: "#8B5CF6",
    accentDark: "#5b34c9",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  // Fassung z2: Seit es fünfzehn Arten gibt, zieht dieselbe Saat andere
  // Aufgaben – Läufe der ersten Fassung (z1) passen nicht mehr dazu.
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "mindsEye", fassung: "z2", zufall, zuege: true, einheit: "Punkte", nochmal: zuschauenStarten,
  }) || null;
  // Die Testrunde wird nicht aufgezeichnet.
  if (!zuschauer && !TESTRUNDE) aufnahme = window.LernappGeist?.zuege?.({ fassung: "z2", zufall }) || null;

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Was an der Stelle (x, y) des Bildes angeboten wird – bei Kreisen der nächste.
  function stelleBei(x, y) {
    let best = null;
    let nah = Infinity;
    for (const s of treffer) {
      if (s.r !== undefined) {
        const d = Math.hypot(x - s.cx, y - s.cy);
        if (d <= s.r && d < nah) { nah = d; best = s; }
      } else if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h && nah === Infinity) best = best || s;
    }
    return best;
  }

  // Ein Tipp: beginnen, die Aufgabe hinlegen, die Auflösung überspringen –
  // oder antworten.
  function tippe(ort = null) {
    if (zuschauer) return;
    const jetzt = performance.now();
    if (state.phase === "bereit") {
      if (!shell.live) losGehts();
    } else if (state.phase === "vorschau") {
      if (jetzt - state.vorSeit >= VOR_SPERRE * 1000) aufgabeLos();
    } else if (state.phase === "zeigen") {
      if (jetzt - state.tZeig >= 1200) weiter();
    } else if (state.phase === "aufgabe" && ort) {
      const s = stelleBei(ort.x, ort.y);
      if (s) eingabe(s.was, s.wert);
    }
  }

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    if (!canvas || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    tippe(bildOrt(event));
  });
  window.addEventListener("keydown", (event) => {
    if (event.repeat || event.target.closest?.("button, a, input") || host.querySelector(".cm-overlay") || zuschauer) return;
    if (state.phase === "aufgabe") {
      // Mit der Tastatur: Ziffern, Rücktaste und Enter.
      const a = aufgabe();
      const ziffer = /^[0-9]$/.test(event.key) ? Number(event.key) : null;
      if (a.eingabe === "zahl") {
        if (ziffer !== null) eingabe("ziffer", ziffer);
        else if (event.key === "Backspace") eingabe("weg");
        else if (event.key === "Enter") eingabe("fertig");
        else return;
      } else if (a.eingabe === "wahl" && ziffer !== null) {
        // Der Schnitt: die Zahl der Ecken. Sonst der Platz – ausser dort, wo ins Bild getippt wird.
        const platz = a.art === "schnitt" ? ziffer - 3 : a.art === "netz" || a.art === "laser" ? -1 : ziffer - 1;
        if (platz < 0 || platz >= a.wahl) return;
        eingabe("wahl", platz);
      } else if (event.key === "Enter") eingabe("fertig");
      else return;
      event.preventDefault();
      return;
    }
    if (event.key !== " " && event.key !== "Enter") return;
    if (state.phase === "bereit" || state.phase === "vorschau" || state.phase === "zeigen") { event.preventDefault(); tippe(); }
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  // Was einzugeben wäre, um eine Aufgabe richtig zu lösen – Schritt für
  // Schritt, wie eingabe() es nimmt. Für die Prüfskripte und die Vorführung.
  function loesung(a) {
    if (a.eingabe === "wahl") return [["wahl", a.soll]];
    const schritte = [];
    if (a.eingabe === "felder") { for (let i = 0; i < a.felder; i += 1) if ((a.soll >> i) & 1) schritte.push(["feld", i]); }
    else if (a.eingabe === "spalten") a.spalten.forEach((h, c) => { if (h) schritte.push(["spalte", c * 8 + h]); });
    else for (const ziffer of String(a.soll)) schritte.push(["ziffer", Number(ziffer)]);
    schritte.push(["fertig", 0]);
    return schritte;
  }

  window.LernappKopfkino = {
    ARTEN, PLAN, AUFGABEN, ZEITEN, VOLL, SPAET, EINZUG, SPERRE, VORSCHAU, FAST, ZEIGEN_MS, NETZE, LAGEN,
    state, view, lege, aufgabenFuer, weltText, anteilFuer, zeitFaktor, punkteFuer, loesung,
    netzBaum, netzLage, netzKanten, ansichtSpalten, gestalt, augeNach, rollLage, schnittFlaeche, sicht,
    farbeSeiten, musterAnsicht, schattenVon, schattenText, profilText, laserRand, laserWeg, kugelWeg, radHalb,
    losGehts, aufgabeLos, eingabe, weiter, takt, zeichnen, stellen: () => treffer, testrunde: () => TESTRUNDE,
  };
})();
