/*
 * schach.js – Schach, mit allen Regeln.
 * ---------------------------------------------------------------------------
 * Die Seite /schach. Wer eine Partie beginnt, spielt «Weiss» (zieht zuerst,
 * die Figuren unten auf Reihe 1 und 2) – in Koralle, wenn das a ist, in
 * Gold, wenn b. Von Partie zu Partie wechselt das, wie in jedem Spiel zu
 * zweit. Die eigenen Figuren stehen immer unten.
 *
 * Alle Regeln: Rochade, en passant, Umwandlung (Dame, Turm, Läufer,
 * Springer), Schach, Matt, Patt. Unentschieden auch bei zu wenig Material,
 * nach 50 Zügen ohne Schlagen oder Bauernzug, und wenn dieselbe Stellung zum
 * dritten Mal vorkommt. Tippt man eine Figur an, zeigen Punkte, wohin sie
 * darf.
 *
 * Menü, Computer als Gegner, Duell, Turnier und Bilanz macht der Rahmen
 * (zwei.js). Hier stehen das Brett, die Regeln und der Computer.
 *
 * Ein Zug wie im Schachcomputer: Start- und Zielfeld, bei einer Umwandlung
 * die neue Figur dazu – «e2e4», «e7e8q». Durch Punkte getrennt.
 *
 * Der Computer:
 *
 *   leicht    zieht irgendwohin, schlägt manchmal
 *   einfach   schaut einen Zug weit, greift aber oft daneben
 *   mittel    schaut zwei Züge weit und rechnet Schlagabtausche zu Ende
 *   schwer    schaut so weit, wie es in knapp einer Sekunde geht
 *             (Alpha-Beta, Figurentabellen, Schlagabtausche)
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "schach") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  // --- Brett und Figuren ------------------------------------------------------------
  // Feld i: Zeile r = i >> 3 (0 = Reihe 8, oben), Spalte c = i & 7 (0 = a).
  // Figur: Art (1 Bauer, 2 Springer, 3 Läufer, 4 Turm, 5 Dame, 6 König),
  // schwarz mit 8 dazu. 0 ist leer.
  const BAUER = 1; const SPRINGER = 2; const LAEUFER = 3; const TURM = 4; const DAME = 5; const KOENIG = 6;
  const SCHWARZ = 8;
  const art = (p) => p & 7;
  const farbeVon = (p) => (p & SCHWARZ ? "s" : "w");
  const feldName = (i) => `${"abcdefgh"[i & 7]}${8 - (i >> 3)}`;
  const feldAus = (t) => ("abcdefgh".indexOf(t[0]) + (8 - Number(t[1])) * 8);
  const ZEICHEN_UMWANDLUNG = { q: DAME, r: TURM, b: LAEUFER, n: SPRINGER };
  const NAMEN = { 1: "Bauer", 2: "Springer", 3: "Läufer", 4: "Turm", 5: "Dame", 6: "König" };
  const GLYPHE = { 1: "♟︎", 2: "♞︎", 3: "♝︎", 4: "♜︎", 5: "♛︎", 6: "♚︎" };

  const START = [
    TURM | SCHWARZ, SPRINGER | SCHWARZ, LAEUFER | SCHWARZ, DAME | SCHWARZ, KOENIG | SCHWARZ, LAEUFER | SCHWARZ, SPRINGER | SCHWARZ, TURM | SCHWARZ,
    ...new Array(8).fill(BAUER | SCHWARZ),
    ...new Array(32).fill(0),
    ...new Array(8).fill(BAUER),
    TURM, SPRINGER, LAEUFER, DAME, KOENIG, LAEUFER, SPRINGER, TURM,
  ];

  const R = (i) => i >> 3;
  const C = (i) => i & 7;
  const auf = (r, c) => (r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1);
  const SPRUENGE = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KOENIGS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const SCHRAEG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const GERADE = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  // Rochaderechte als Bits: 1 Weiss kurz, 2 Weiss lang, 4 Schwarz kurz, 8 Schwarz lang.
  function neueStellung() {
    return { b: [...START], am: "w", rochade: 15, ep: -1, halb: 0, voll: 1 };
  }
  const kopie = (s) => ({ ...s, b: [...s.b] });

  // Greift «von» (Farbe) das Feld i an?
  function angegriffen(b, i, von) {
    const r = R(i); const c = C(i);
    const s = von === "s" ? SCHWARZ : 0;
    // Bauern: Weiss schlägt nach oben (r - 1), also steht ein weisser
    // Angreifer eine Reihe tiefer (r + 1).
    const br = von === "w" ? r + 1 : r - 1;
    for (const dc of [-1, 1]) { const j = auf(br, c + dc); if (j >= 0 && b[j] === (BAUER | s)) return true; }
    for (const [dr, dc] of SPRUENGE) { const j = auf(r + dr, c + dc); if (j >= 0 && b[j] === (SPRINGER | s)) return true; }
    for (const [dr, dc] of KOENIGS) { const j = auf(r + dr, c + dc); if (j >= 0 && b[j] === (KOENIG | s)) return true; }
    for (const [dr, dc] of SCHRAEG) {
      for (let k = 1; k < 8; k += 1) {
        const j = auf(r + dr * k, c + dc * k);
        if (j < 0) break;
        if (b[j]) { if (b[j] === (LAEUFER | s) || b[j] === (DAME | s)) return true; break; }
      }
    }
    for (const [dr, dc] of GERADE) {
      for (let k = 1; k < 8; k += 1) {
        const j = auf(r + dr * k, c + dc * k);
        if (j < 0) break;
        if (b[j]) { if (b[j] === (TURM | s) || b[j] === (DAME | s)) return true; break; }
      }
    }
    return false;
  }
  const koenigVon = (b, f) => b.indexOf(KOENIG | (f === "s" ? SCHWARZ : 0));
  const imSchach = (s, f = s.am) => angegriffen(s.b, koenigVon(s.b, f), f === "w" ? "s" : "w");

  // Ein Zug: { von, nach, um (Umwandlung), ep (en passant geschlagen), roch (Rochade) }.
  function pseudoZuege(s, nurSchlagen = false) {
    const aus = [];
    const b = s.b;
    const f = s.am;
    const eigen = (p) => p && farbeVon(p) === f;
    const fremd = (p) => p && farbeVon(p) !== f;
    const hin = (von, nach, extra = {}) => aus.push({ von, nach, um: 0, ...extra });
    for (let i = 0; i < 64; i += 1) {
      const p = b[i];
      if (!eigen(p)) continue;
      const r = R(i); const c = C(i); const a = art(p);
      if (a === BAUER) {
        const vor = f === "w" ? -1 : 1;
        const startReihe = f === "w" ? 6 : 1;
        const letzte = f === "w" ? 0 : 7;
        const mitUm = (von, nach, extra = {}) => {
          if (R(nach) === letzte) for (const um of [DAME, TURM, LAEUFER, SPRINGER]) hin(von, nach, { ...extra, um });
          else hin(von, nach, extra);
        };
        const eins = auf(r + vor, c);
        if (!nurSchlagen && eins >= 0 && !b[eins]) {
          mitUm(i, eins);
          const zwei = auf(r + 2 * vor, c);
          if (r === startReihe && !b[zwei]) hin(i, zwei);
        }
        for (const dc of [-1, 1]) {
          const j = auf(r + vor, c + dc);
          if (j < 0) continue;
          if (fremd(b[j])) mitUm(i, j);
          else if (j === s.ep) hin(i, j, { ep: auf(r, c + dc) });
        }
      } else if (a === SPRINGER || a === KOENIG) {
        for (const [dr, dc] of a === SPRINGER ? SPRUENGE : KOENIGS) {
          const j = auf(r + dr, c + dc);
          if (j < 0 || eigen(b[j])) continue;
          if (nurSchlagen && !b[j]) continue;
          hin(i, j);
        }
        if (a === KOENIG && !nurSchlagen) {
          const gegen = f === "w" ? "s" : "w";
          const reihe = f === "w" ? 7 : 0;
          const kurz = f === "w" ? 1 : 4;
          const lang = f === "w" ? 2 : 8;
          const k = auf(reihe, 4);
          if (i === k && !angegriffen(b, k, gegen)) {
            if ((s.rochade & kurz) && !b[k + 1] && !b[k + 2] && b[k + 3] === (TURM | (f === "s" ? SCHWARZ : 0))
              && !angegriffen(b, k + 1, gegen) && !angegriffen(b, k + 2, gegen)) hin(k, k + 2, { roch: 1 });
            if ((s.rochade & lang) && !b[k - 1] && !b[k - 2] && !b[k - 3] && b[k - 4] === (TURM | (f === "s" ? SCHWARZ : 0))
              && !angegriffen(b, k - 1, gegen) && !angegriffen(b, k - 2, gegen)) hin(k, k - 2, { roch: -1 });
          }
        }
      } else {
        const richtungen = a === LAEUFER ? SCHRAEG : a === TURM ? GERADE : [...SCHRAEG, ...GERADE];
        for (const [dr, dc] of richtungen) {
          for (let k = 1; k < 8; k += 1) {
            const j = auf(r + dr * k, c + dc * k);
            if (j < 0 || eigen(b[j])) break;
            if (!nurSchlagen || b[j]) hin(i, j);
            if (b[j]) break;
          }
        }
      }
    }
    return aus;
  }

  // Einen Zug ausführen (s wird verändert); zurück kommt, was zum
  // Zurücknehmen nötig ist.
  const ECKEN = { 63: 1, 56: 2, 7: 4, 0: 8 };
  function ziehe(s, z) {
    const b = s.b;
    const p = b[z.von];
    const geschlagen = z.ep !== undefined && z.ep >= 0 ? b[z.ep] : b[z.nach];
    const vorher = { rochade: s.rochade, ep: s.ep, halb: s.halb, geschlagen };
    b[z.nach] = z.um ? (z.um | (p & SCHWARZ)) : p;
    b[z.von] = 0;
    if (z.ep !== undefined && z.ep >= 0) b[z.ep] = 0;
    if (z.roch === 1) { b[z.nach - 1] = b[z.nach + 1]; b[z.nach + 1] = 0; }
    if (z.roch === -1) { b[z.nach + 1] = b[z.nach - 2]; b[z.nach - 2] = 0; }
    // Rochaderechte: König oder Turm bewegt, Turm geschlagen.
    if (art(p) === KOENIG) s.rochade &= s.am === "w" ? ~3 : ~12;
    s.rochade &= ~(ECKEN[z.von] || 0) & ~(ECKEN[z.nach] || 0);
    s.ep = art(p) === BAUER && Math.abs(z.nach - z.von) === 16 ? (z.von + z.nach) / 2 : -1;
    s.halb = art(p) === BAUER || geschlagen ? 0 : s.halb + 1;
    if (s.am === "s") s.voll += 1;
    s.am = s.am === "w" ? "s" : "w";
    return vorher;
  }
  function zurueck(s, z, vorher) {
    const b = s.b;
    s.am = s.am === "w" ? "s" : "w";
    if (s.am === "s") s.voll -= 1;
    const p = b[z.nach];
    b[z.von] = z.um ? (BAUER | (p & SCHWARZ)) : p;
    if (z.ep !== undefined && z.ep >= 0) { b[z.nach] = 0; b[z.ep] = vorher.geschlagen; } else b[z.nach] = vorher.geschlagen;
    if (z.roch === 1) { b[z.nach + 1] = b[z.nach - 1]; b[z.nach - 1] = 0; }
    if (z.roch === -1) { b[z.nach - 2] = b[z.nach + 1]; b[z.nach + 1] = 0; }
    s.rochade = vorher.rochade; s.ep = vorher.ep; s.halb = vorher.halb;
  }

  function legaleZuege(s, nurSchlagen = false) {
    const f = s.am;
    return pseudoZuege(s, nurSchlagen).filter((z) => {
      const v = ziehe(s, z);
      const ok = !imSchach(s, f);
      zurueck(s, z, v);
      return ok;
    });
  }

  // Eine Stellung aus einer FEN-Zeile (für die Prüfung, und später für
  // Aufgaben).
  function ausFen(fen) {
    const [teile, am, roch, ep, halb, voll] = fen.trim().split(/\s+/);
    const b = [];
    for (const ch of teile.replace(/\//g, "")) {
      if (/\d/.test(ch)) for (let k = 0; k < Number(ch); k += 1) b.push(0);
      else b.push({ p: BAUER, n: SPRINGER, b: LAEUFER, r: TURM, q: DAME, k: KOENIG }[ch.toLowerCase()] | (ch === ch.toLowerCase() ? SCHWARZ : 0));
    }
    let rochade = 0;
    if (roch.includes("K")) rochade |= 1;
    if (roch.includes("Q")) rochade |= 2;
    if (roch.includes("k")) rochade |= 4;
    if (roch.includes("q")) rochade |= 8;
    return { b, am: am === "b" ? "s" : "w", rochade, ep: ep === "-" ? -1 : feldAus(ep), halb: Number(halb) || 0, voll: Number(voll) || 1 };
  }

  const zugText = (z) => `${feldName(z.von)}${feldName(z.nach)}${z.um ? "qrbn"[[DAME, TURM, LAEUFER, SPRINGER].indexOf(z.um)] : ""}`;
  const stellungsSchluessel = (s) => `${s.b.join(",")}|${s.am}|${s.rochade}|${s.ep}`;

  function zuWenig(b) {
    const rest = b.filter((p) => p && art(p) !== KOENIG);
    if (!rest.length) return true;
    if (rest.length === 1 && (art(rest[0]) === LAEUFER || art(rest[0]) === SPRINGER)) return true;
    // Nur Läufer, alle auf Feldern derselben Farbe.
    if (rest.every((p) => art(p) === LAEUFER)) {
      const felder = b.map((p, i) => (p && art(p) === LAEUFER ? (R(i) + C(i)) % 2 : -1)).filter((x) => x >= 0);
      return felder.every((x) => x === felder[0]);
    }
    return false;
  }

  // --- Die Regeln (für den Rahmen) ------------------------------------------------
  let zwischen = { schluessel: "", lage: null };

  function lage(zuege, { roh, beginnt }) {
    const schluessel = `${beginnt}|${roh}`;
    if (zwischen.schluessel === schluessel) return zwischen.lage;
    const s = neueStellung();
    const farbe = { [beginnt]: "w", [anderer(beginnt)]: "s" };
    const sitzVon = (f) => (farbe.a === f ? "a" : "b");
    const gesehen = new Map([[stellungsSchluessel(s), 1]]);
    const geschlagen = { a: [], b: [] };
    let letzter = null;
    let legal = legaleZuege(s);
    let ende = null;
    let grund = "";
    for (const t of zuege) {
      const z = legal.find((x) => zugText(x) === t);
      if (!z || ende) {
        const kaputt = { brett: s.b, farbe, dran: null, ende: null, kaputt: true, legal: [], geschlagen, letzter };
        zwischen = { schluessel, lage: kaputt };
        return kaputt;
      }
      const wer = sitzVon(s.am);
      const v = ziehe(s, z);
      if (v.geschlagen) geschlagen[wer].push(art(v.geschlagen));
      letzter = { von: z.von, nach: z.nach, sitz: wer, schlag: Boolean(v.geschlagen), roch: z.roch || 0, um: z.um };
      const k = stellungsSchluessel(s);
      gesehen.set(k, (gesehen.get(k) || 0) + 1);
      legal = legaleZuege(s);
      if (!legal.length) {
        if (imSchach(s)) { ende = wer; grund = "matt"; } else { ende = "u"; grund = "patt"; }
      } else if (zuWenig(s.b)) { ende = "u"; grund = "material"; }
      else if (s.halb >= 100) { ende = "u"; grund = "fuenfzig"; }
      else if (gesehen.get(k) >= 3) { ende = "u"; grund = "wiederholung"; }
    }
    const aus = {
      brett: [...s.b],
      farbe,
      dran: ende ? null : sitzVon(s.am),
      ende,
      grund,
      // Im Schach steht, wer am Zug ist – auch der mattgesetzte König.
      schach: imSchach(s),
      amZug: sitzVon(s.am),
      legal: ende ? [] : legal.map(zugText),
      geschlagen,
      letzter,
      stellung: s,
    };
    zwischen = { schluessel, lage: aus };
    return aus;
  }

  const darf = (l, zug, sitz) => l.dran === sitz && l.legal.includes(zug);

  // --- Der Computer -------------------------------------------------------------
  const WERT = [0, 100, 320, 330, 500, 900, 0];
  // Figurentabellen (aus Sicht von Weiss, Feld 0 = a8).
  const TABELLE = {
    1: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    2: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    3: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    4: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    5: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    6: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
  };
  const KOENIG_ENDE = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];

  // Wert der Stellung für die Seite am Zug.
  function bewerte(s) {
    const b = s.b;
    let wert = 0;
    let figuren = 0;
    for (let i = 0; i < 64; i += 1) if (b[i] && art(b[i]) !== KOENIG && art(b[i]) !== BAUER) figuren += WERT[art(b[i])];
    const endspiel = figuren <= 1600;
    for (let i = 0; i < 64; i += 1) {
      const p = b[i];
      if (!p) continue;
      const a = art(p);
      const weiss = !(p & SCHWARZ);
      const j = weiss ? i : (7 - R(i)) * 8 + C(i);
      const t = a === KOENIG && endspiel ? KOENIG_ENDE[j] : TABELLE[a][j];
      const v = WERT[a] + t;
      wert += weiss ? v : -v;
    }
    return s.am === "w" ? wert : -wert;
  }

  const MATT = 100000;
  function ordne(s, liste) {
    const b = s.b;
    const punkte = (z) => (b[z.nach] ? 10 * WERT[art(b[z.nach])] - WERT[art(b[z.von])] : 0) + (z.um ? WERT[z.um] : 0) + (z.ep >= 0 ? 900 : 0);
    return liste.sort((x, y) => punkte(y) - punkte(x));
  }

  function ruhe(s, alpha, beta, uhr, tiefe = 0) {
    if ((++uhr.knoten & 1023) === 0 && uhr.vorbei()) throw uhr;
    const steht = bewerte(s);
    if (steht >= beta) return beta;
    if (steht > alpha) alpha = steht;
    if (tiefe > 6) return alpha;
    for (const z of ordne(s, legaleZuege(s, true))) {
      const v = ziehe(s, z);
      const wert = -ruhe(s, -beta, -alpha, uhr, tiefe + 1);
      zurueck(s, z, v);
      if (wert >= beta) return beta;
      if (wert > alpha) alpha = wert;
    }
    return alpha;
  }

  function suche(s, tiefe, alpha, beta, uhr, ply, mitRuhe) {
    if ((++uhr.knoten & 1023) === 0 && uhr.vorbei()) throw uhr;
    const liste = legaleZuege(s);
    if (!liste.length) return imSchach(s) ? -MATT + ply : 0;
    if (s.halb >= 100) return 0;
    if (tiefe <= 0) return mitRuhe ? ruhe(s, alpha, beta, uhr) : bewerte(s);
    for (const z of ordne(s, liste)) {
      const v = ziehe(s, z);
      const wert = -suche(s, tiefe - 1, -beta, -alpha, uhr, ply + 1, mitRuhe);
      zurueck(s, z, v);
      if (wert >= beta) return beta;
      if (wert > alpha) alpha = wert;
    }
    return alpha;
  }

  // Die Züge mit ihrem Wert, so tief es geht.
  function bewerteZuege(s, { tiefe, zeit, mitRuhe }) {
    const ende = Date.now() + zeit;
    const uhr = { knoten: 0, vorbei: () => Date.now() > ende };
    let liste = ordne(s, legaleZuege(s)).map((z) => ({ z, wert: 0 }));
    for (let t = 1; t <= tiefe; t += 1) {
      try {
        const neu = [];
        let alpha = -Infinity;
        for (const e of liste) {
          const v = ziehe(s, e.z);
          // Breites Fenster für alle, damit auch die zweitbesten stimmen.
          const wert = -suche(s, t - 1, -MATT - 1, MATT + 1, uhr, 1, mitRuhe);
          zurueck(s, e.z, v);
          neu.push({ z: e.z, wert });
          if (wert > alpha) alpha = wert;
        }
        liste = neu.sort((x, y) => y.wert - x.wert);
        if (liste[0].wert > MATT - 100) break;
      } catch (e) {
        if (e !== uhr) throw e;
        break;
      }
    }
    return liste;
  }

  const wahl = (liste) => liste[Math.floor(Math.random() * liste.length)];

  function computer(l, sitz, stufe) {
    if (l.dran !== sitz || !l.legal.length) return null;
    const s = kopie(l.stellung);
    const liste = legaleZuege(s);
    if (stufe === "leicht") {
      const schlagen = liste.filter((z) => s.b[z.nach] || z.ep >= 0);
      return zugText(schlagen.length && Math.random() < 0.3 ? wahl(schlagen) : wahl(liste));
    }
    if (stufe === "einfach") {
      if (Math.random() < 0.3) return zugText(wahl(liste));
      const bewertet = bewerteZuege(s, { tiefe: 1, zeit: 300, mitRuhe: false });
      const gut = bewertet.filter((e) => e.wert >= bewertet[0].wert - 120);
      return zugText(wahl(gut).z);
    }
    if (stufe === "mittel") {
      const bewertet = bewerteZuege(s, { tiefe: 2, zeit: 600, mitRuhe: true });
      const gut = bewertet.filter((e) => e.wert >= bewertet[0].wert - 25);
      return zugText(wahl(gut).z);
    }
    const bewertet = bewerteZuege(s, { tiefe: 6, zeit: 900, mitRuhe: true });
    const gut = bewertet.filter((e) => e.wert >= bewertet[0].wert - 5);
    return zugText(wahl(gut).z);
  }

  // --- Was über dem Brett steht -----------------------------------------------------
  function satz(l, { ich, name, modus }) {
    const er = (sitz) => (sitz === ich ? "Du" : modus === "computer" ? "Der Computer" : name(sitz));
    if (l.ende && l.ende !== "u") {
      if (l.ende === ich) return { text: "Schachmatt – du hast gewonnen!", sitz: ich };
      return { text: `Schachmatt – ${er(l.ende)} hat gewonnen.`, sitz: l.ende };
    }
    if (l.ende === "u") {
      const warum = { patt: "Patt", material: "Zu wenig Figuren für ein Matt", fuenfzig: "50 Züge ohne Schlagen", wiederholung: "Dieselbe Stellung zum dritten Mal" }[l.grund] || "Unentschieden";
      return { text: `${warum} – unentschieden.`, sitz: null };
    }
    if (!l.dran) return null;
    const weiss = l.farbe[l.dran] === "w";
    if (l.schach && !l.ende) return { text: l.dran === ich ? "Schach! Rette deinen König." : `Schach! ${er(l.dran)} muss den König retten.`, sitz: l.dran };
    if (!l.letzter && l.dran === ich) return { text: `Du beginnst${weiss ? "" : ""} – tippe eine Figur an`, sitz: ich };
    return null;
  }

  // --- Das Bild -------------------------------------------------------------------
  function held() {
    const bild = el("div", "zw-sc-held");
    const stellung = { 0: [TURM, "b"], 2: [KOENIG, "b"], 5: [BAUER, "b"], 10: [DAME, "a"], 13: [SPRINGER, "a"], 15: [KOENIG, "a"] };
    for (let i = 0; i < 16; i += 1) {
      const f = el("span", `zw-sc-held-feld${((i >> 2) + (i & 3)) % 2 ? " ist-dunkel" : ""}`);
      const st = stellung[i];
      if (st) f.append(el("span", `zw-sc-figur ist-${st[1]}`, GLYPHE[st[0]]));
      bild.append(f);
    }
    return bild;
  }

  function brett({ zug, ton, ruhig }) {
    const knoten = el("div", "zw-sc");
    const geschlagen = { oben: el("div", "zw-sc-geschlagen"), unten: el("div", "zw-sc-geschlagen") };
    const feld = el("div", "zw-sc-feld");
    feld.setAttribute("role", "grid");
    feld.setAttribute("aria-label", "Schachbrett");
    const felder = [];
    for (let i = 0; i < 64; i += 1) {
      const k = el("button", "zw-sc-zelle");
      k.type = "button";
      k.addEventListener("click", () => tippe(Number(k.dataset.feld)));
      felder.push(k);
      feld.append(k);
    }
    const wahlKnoten = el("div", "zw-sc-umwandlung");
    wahlKnoten.hidden = true;
    knoten.append(geschlagen.oben, feld, geschlagen.unten, wahlKnoten);

    let jetzt = null;
    let gewaehlt = -1;
    let gezeigt = null;
    let dreh = false;

    const meinZug = () => Boolean(jetzt && !jetzt.aus && jetzt.ich && jetzt.dran === jetzt.ich);

    function tippe(i) {
      if (!meinZug()) return;
      const l = jetzt.lage;
      const p = l.brett[i];
      const meineFarbe = l.farbe[jetzt.ich];
      if (p && farbeVon(p) === meineFarbe) {
        gewaehlt = gewaehlt === i ? -1 : i;
        ton("tipp");
        zeichne(jetzt);
        return;
      }
      if (gewaehlt < 0) return;
      const basis = `${feldName(gewaehlt)}${feldName(i)}`;
      const moegliche = l.legal.filter((z) => z.startsWith(basis));
      if (!moegliche.length) { gewaehlt = -1; zeichne(jetzt); return; }
      if (moegliche.length === 1) { gewaehlt = -1; zug(moegliche[0]); return; }
      // Umwandlung: Welche Figur soll es werden?
      wahlKnoten.innerHTML = "";
      wahlKnoten.append(el("p", "zw-sc-umwandlung-text", "Dein Bauer ist durch! Was soll er werden?"));
      const reihe = el("div", "zw-sc-umwandlung-reihe");
      for (const [ch, a] of [["q", DAME], ["r", TURM], ["b", LAEUFER], ["n", SPRINGER]]) {
        const k = el("button", `zw-sc-umwandlung-knopf ist-${jetzt.ich}`);
        k.type = "button";
        k.append(el("span", `zw-sc-figur ist-${jetzt.ich}`, GLYPHE[a]), el("span", "zw-sc-umwandlung-name", NAMEN[a]));
        k.addEventListener("click", () => { wahlKnoten.hidden = true; gewaehlt = -1; zug(`${basis}${ch}`); });
        reihe.append(k);
      }
      wahlKnoten.append(reihe);
      wahlKnoten.hidden = false;
      reihe.querySelector("button")?.focus({ preventScroll: true });
    }

    function zeichne(b) {
      jetzt = b;
      const l = b.lage;
      const ich = b.ich || "a";
      dreh = l.farbe[ich] === "s";
      if (!meinZug()) { gewaehlt = -1; wahlKnoten.hidden = true; }
      const neuePartie = !gezeigt || gezeigt.nr !== b.nr || !b.roh.startsWith(gezeigt.roh);
      const dazu = neuePartie ? [] : b.roh.slice(gezeigt.roh.length).split(".").filter(Boolean);
      const ziele = new Set(gewaehlt >= 0 ? l.legal.filter((z) => z.startsWith(feldName(gewaehlt))).map((z) => feldAus(z.slice(2, 4))) : []);
      const waehlbar = new Set(meinZug() ? l.legal.map((z) => feldAus(z.slice(0, 2))) : []);
      const koenigImSchach = l.schach && l.amZug ? koenigVon(l.brett, l.farbe[l.amZug]) : -1;
      for (let pos = 0; pos < 64; pos += 1) {
        // pos: wo das Feld steht (oben links 0); i: welches Feld es ist.
        const i = dreh ? 63 - pos : pos;
        const k = felder[pos];
        k.dataset.feld = String(i);
        const p = l.brett[i];
        const sitz = p ? (l.farbe.a === farbeVon(p) ? "a" : "b") : "";
        const dunkel = (R(i) + C(i)) % 2 === 1;
        k.className = `zw-sc-zelle${dunkel ? " ist-dunkel" : ""}${l.letzter && (l.letzter.von === i || l.letzter.nach === i) ? " ist-letzter" : ""}${i === gewaehlt ? " ist-gewaehlt" : ""}${ziele.has(i) ? (p ? " ist-ziel ist-schlag" : " ist-ziel") : ""}${i === koenigImSchach ? " ist-schach" : ""}`;
        const glyphe = p ? GLYPHE[art(p)] : "";
        let figur = k.firstChild;
        if (glyphe) {
          if (!figur || figur.textContent !== glyphe || !figur.classList.contains(`ist-${sitz}`)) {
            k.innerHTML = "";
            figur = el("span", `zw-sc-figur ist-${sitz}`, glyphe);
            k.append(figur);
          }
          figur.classList.toggle("ist-neu", dazu.length === 1 && l.letzter?.nach === i && !ruhig());
        } else if (figur) k.innerHTML = "";
        // Die Koordinaten am Rand: a–h unten, 1–8 links.
        const reiheRand = pos % 8 === 0;
        const linieRand = pos >= 56;
        if (reiheRand) k.dataset.reihe = String(8 - R(i)); else delete k.dataset.reihe;
        if (linieRand) k.dataset.linie = "abcdefgh"[C(i)]; else delete k.dataset.linie;
        k.disabled = !(waehlbar.has(i) || ziele.has(i) || (gewaehlt >= 0 && meinZug()));
        k.setAttribute("aria-label", `${feldName(i)}${p ? `, ${NAMEN[art(p)]} ${sitz === "a" ? "Koralle" : "Gold"}` : ""}${ziele.has(i) ? ", hierhin ziehen" : ""}`);
      }
      // Geschlagene Figuren: die des Gegenübers oben, die eigenen unten.
      const gegen = anderer(ich);
      const reihe = (wo, sitz, liste) => {
        wo.innerHTML = "";
        [...liste].sort((x, y) => WERT[y] - WERT[x]).forEach((a) => wo.append(el("span", `zw-sc-figur ist-${anderer(sitz)}`, GLYPHE[a])));
      };
      reihe(geschlagen.oben, gegen, l.geschlagen[gegen]);
      reihe(geschlagen.unten, ich, l.geschlagen[ich]);
      if (dazu.length && l.letzter) {
        ton(l.letzter.schlag ? "treffer" : "klack");
        if (l.schach && !l.ende) window.setTimeout(() => ton("dran"), 180);
      }
      knoten.classList.toggle("ist-dran", meinZug());
      knoten.classList.toggle("ist-gedreht", dreh);
      gezeigt = { nr: b.nr, roh: b.roh };
    }

    return {
      knoten,
      zeichne,
      fokus: () => felder.find((k) => !k.disabled)?.focus({ preventScroll: true }),
    };
  }

  Z.starte({
    id: "schach",
    titel: "Schach",
    seite: "schach",
    unter: "Das ganze Schach, mit allen Regeln. Tippe eine Figur an – Punkte zeigen, wohin sie darf. Wer beginnt, spielt Weiss.",
    held,
    trenner: ".",
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Zum Lernen" },
      einfach: { name: "Einfach", sterne: 1, satz: "Zum Warmwerden" },
      mittel: { name: "Mittel", sterne: 2, satz: "Eine echte Aufgabe" },
      schwer: { name: "Schwer", sterne: 3, satz: "Rechnet tief" },
    },
    texte: { start: "tippe eine Figur an", remis: "Unentschieden." },
    lage,
    darf,
    brett,
    computer,
    satz,
    // Für scripts/pruefen.mjs: die Regeln von innen.
    fuerPruefung: { neueStellung, ausFen, legaleZuege, ziehe, zurueck, zugText, imSchach, zuWenig },
  });
})();
