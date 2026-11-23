/*
 * viererreihe-ki.js – Das Brett und der Computer von «Viererreihe».
 * ---------------------------------------------------------------------------
 * Nur Rechnen, kein Bild: Diese Datei kennt das Brett (sieben Spalten, sechs
 * Reihen), weiss, wann vier in einer Reihe liegen, und sucht einen Zug für
 * den Computer. Die Seite (viererreihe.js) zeichnet, scripts/pruefen-vierer.mjs
 * spielt die Stufen ohne Browser gegeneinander.
 *
 * Das Brett:
 *
 *   z[c * 6 + r]   wer in Spalte c (0 links … 6 rechts), Reihe r (0 unten …
 *                  5 oben) liegt: 0 leer, 1 oder 2
 *   h[c]           wie viele Steine in Spalte c liegen
 *   n              wie viele Steine es insgesamt sind
 *
 * Eine Partie steht als Text: die Spalten der Züge, der Reihe nach
 * («3342…»). So steht sie auch in der Realtime Database (duell/<raum>/stand),
 * und jedes Gerät baut daraus dasselbe Brett.
 *
 * Die Stufen sind für Kinder gemacht – «ganz leicht» für eine Fünfjährige,
 * die anderen drei für ein Kind von sieben bis neun Jahren:
 *
 *   leicht    («Ganz leicht») setzt irgendwohin und nimmt einen fertigen
 *             Vierer fast nie. Zum Lernen, wie die Reihe entsteht.
 *   einfach   setzt meist irgendwohin (die Mitte etwas öfter), nimmt einen
 *             fertigen Vierer nur jedes zweite Mal und sieht eine Gefahr nur
 *             selten. Wer aufpasst, gewinnt.
 *   mittel    gewinnt fast immer, wenn es geht, hält meist dagegen, wenn drei
 *             drohen, und legt nie einen Stein, über dem du gleich gewinnst.
 *             Sonst schaut es zwei Züge voraus oder setzt irgendwohin – eine
 *             echte Aufgabe, aber zu schaffen.
 *
 * Geeicht an einem nachgemachten Kind (sieht den eigenen Vierer meist, eine
 * Gefahr oft, denkt manchmal zwei Züge voraus): Gegen «einfach» gewinnt es
 * acht bis neun von zehn Partien, gegen «mittel» zwei bis vier, gegen
 * «schwer» so gut wie keine. Eines von fünf Jahren (sieht den eigenen Vierer
 * jedes zweite Mal, eine Gefahr selten, denkt nicht voraus) gewinnt gegen
 * «ganz leicht» etwa acht von zehn, gegen «einfach» nur jede zweite.
 *   schwer    rechnet so weit, wie es in gut einer halben Sekunde geht
 *             (meist zehn Züge und mehr), mit Gedächtnis für schon gesehene
 *             Stellungen. Kaum zu schlagen.
 */
(() => {
  "use strict";

  const SPALTEN = 7;
  const REIHEN = 6;
  const FELDER = SPALTEN * REIHEN;
  // Von der Mitte nach aussen: Wer die Mitte zuerst ansieht, findet den
  // besten Zug früher – und die Suche spart sich den Rest.
  const ORDNUNG = [3, 2, 4, 1, 5, 0, 6];
  const SIEG = 1000000;

  const STUFEN = ["leicht", "einfach", "mittel", "schwer"];

  // --- Das Brett ---------------------------------------------------------------
  function neuesBrett() {
    return { z: new Int8Array(FELDER), h: new Int8Array(SPALTEN), n: 0 };
  }

  const frei = (b, c) => c >= 0 && c < SPALTEN && b.h[c] < REIHEN;

  function setze(b, c, p) {
    const r = b.h[c];
    b.z[c * REIHEN + r] = p;
    b.h[c] = r + 1;
    b.n += 1;
    return r;
  }

  function nimm(b, c) {
    const r = b.h[c] - 1;
    b.z[c * REIHEN + r] = 0;
    b.h[c] = r;
    b.n -= 1;
  }

  const wer = (b, c, r) => (c < 0 || c >= SPALTEN || r < 0 || r >= REIHEN ? -1 : b.z[c * REIHEN + r]);

  const RICHTUNGEN = [[1, 0], [0, 1], [1, 1], [1, -1]];

  // Liegt der Stein in (c, r) in einer Reihe von vier oder mehr? Gibt die
  // Felder dieser Reihe (oder Reihen) zurück, sonst null.
  function viererBei(b, c, r) {
    const p = wer(b, c, r);
    if (p <= 0) return null;
    let alle = null;
    for (const [dc, dr] of RICHTUNGEN) {
      const linie = [[c, r]];
      for (let k = 1; wer(b, c + dc * k, r + dr * k) === p; k += 1) linie.push([c + dc * k, r + dr * k]);
      for (let k = 1; wer(b, c - dc * k, r - dr * k) === p; k += 1) linie.unshift([c - dc * k, r - dr * k]);
      if (linie.length >= 4) alle = (alle || []).concat(linie);
    }
    return alle;
  }

  // Schneller als viererBei, für die Suche: nur ja oder nein.
  function gewinnt(b, c, r, p) {
    for (let i = 0; i < 4; i += 1) {
      const dc = RICHTUNGEN[i][0];
      const dr = RICHTUNGEN[i][1];
      let anzahl = 1;
      for (let k = 1; k < 4 && wer(b, c + dc * k, r + dr * k) === p; k += 1) anzahl += 1;
      for (let k = 1; k < 4 && wer(b, c - dc * k, r - dr * k) === p; k += 1) anzahl += 1;
      if (anzahl >= 4) return true;
    }
    return false;
  }

  // Würde p mit einem Stein in Spalte c gewinnen?
  function gewinntMit(b, c, p) {
    if (!frei(b, c)) return false;
    const r = setze(b, c, p);
    const ja = gewinnt(b, c, r, p);
    nimm(b, c);
    return ja;
  }

  /*
   * Eine Partie aus ihrem Text: die Spalten der Züge, beginnt der Spieler
   * «beginner» (1 oder 2). Gibt das Brett, wer am Zug ist, und – wenn sie zu
   * Ende ist – wer gewonnen hat (sieger 1/2, 0 unentschieden) und welche
   * Felder die Reihe bilden. Ein Zug in eine volle Spalte oder nach dem Ende
   * macht den Text ungültig (gueltig: false); was bis dahin lag, gilt.
   */
  function ausZuegen(text, beginner = 1) {
    const b = neuesBrett();
    let p = beginner;
    let sieger = null;
    let reihe = null;
    let letzter = null;
    let gueltig = true;
    for (const zeichen of String(text || "")) {
      const c = zeichen.charCodeAt(0) - 48;
      if (sieger !== null || !frei(b, c)) { gueltig = false; break; }
      const r = setze(b, c, p);
      letzter = { c, r, p };
      const vier = viererBei(b, c, r);
      if (vier) { sieger = p; reihe = vier; }
      else if (b.n === FELDER) sieger = 0;
      p = 3 - p;
    }
    return { brett: b, amZug: p, sieger, reihe, letzter, gueltig };
  }

  // --- Wie gut steht p? ------------------------------------------------------------
  // Alle 69 Viererfenster des Bretts, je als vier Feldnummern.
  const FENSTER = [];
  for (let c = 0; c < SPALTEN; c += 1) {
    for (let r = 0; r < REIHEN; r += 1) {
      for (const [dc, dr] of RICHTUNGEN) {
        const ec = c + dc * 3;
        const er = r + dr * 3;
        if (ec < 0 || ec >= SPALTEN || er < 0 || er >= REIHEN) continue;
        FENSTER.push([0, 1, 2, 3].map((k) => (c + dc * k) * REIHEN + (r + dr * k)));
      }
    }
  }
  // Was ein Fenster wert ist, je nachdem, wie viele Steine eines Spielers
  // darin liegen (und keiner des anderen).
  const WERT = [0, 1, 5, 40];

  function bewerte(b, p) {
    const z = b.z;
    let summe = 0;
    for (let i = 0; i < FENSTER.length; i += 1) {
      const f = FENSTER[i];
      let mein = 0;
      let dein = 0;
      for (let k = 0; k < 4; k += 1) {
        const v = z[f[k]];
        if (v === p) mein += 1;
        else if (v !== 0) dein += 1;
      }
      if (mein && !dein) summe += WERT[mein];
      else if (dein && !mein) summe -= WERT[dein];
    }
    // Die Mitte gehört zu den meisten Fenstern.
    for (let r = 0; r < REIHEN; r += 1) {
      const v = z[3 * REIHEN + r];
      if (v === p) summe += 3;
      else if (v !== 0) summe -= 3;
    }
    return summe;
  }

  // --- Die Suche ---------------------------------------------------------------------
  // Zobrist: zwei 32-Bit-Zahlen je Feld und Spieler. Der Schlüssel einer
  // Stellung passt als eine Zahl in die Map (52 Bit sind sicher).
  function zahlenFolge(saat) {
    let s = saat >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (t ^ (t >>> 14)) >>> 0;
    };
  }
  const zz = zahlenFolge(20261123);
  const ZOB_A = [new Uint32Array(FELDER), new Uint32Array(FELDER), new Uint32Array(FELDER)];
  const ZOB_B = [new Uint32Array(FELDER), new Uint32Array(FELDER), new Uint32Array(FELDER)];
  for (let p = 1; p <= 2; p += 1) {
    for (let i = 0; i < FELDER; i += 1) { ZOB_A[p][i] = zz(); ZOB_B[p][i] = zz() & 0xfffff; }
  }

  function schluessel(b) {
    let a = 0;
    let c = 0;
    for (let i = 0; i < FELDER; i += 1) {
      const v = b.z[i];
      if (v) { a ^= ZOB_A[v][i]; c ^= ZOB_B[v][i]; }
    }
    return { a: a >>> 0, b: c >>> 0 };
  }

  const GENAU = 0;
  const UNTEN = 1; // der Wert ist mindestens so gross
  const OBEN = 2; //  der Wert ist höchstens so gross

  /*
   * Negamax mit Alpha-Beta: Wie viel ist die Stellung für p wert, der am Zug
   * ist, wenn beide bis zur Tiefe gut spielen? Ein Sieg ist SIEG weniger die
   * Zahl der Steine – ein früher Sieg ist besser als ein später, eine späte
   * Niederlage besser als eine frühe.
   */
  function sucher({ bis = Infinity, gedaechtnis = new Map() } = {}) {
    let knoten = 0;
    let abgebrochen = false;
    let za = 0;
    let zb = 0;

    function negamax(b, tiefe, alpha, beta, p) {
      knoten += 1;
      if ((knoten & 1023) === 0 && Date.now() > bis) abgebrochen = true;
      if (abgebrochen) return 0;
      if (b.n === FELDER) return 0;
      // Kann p sofort gewinnen?
      for (let i = 0; i < SPALTEN; i += 1) {
        const c = ORDNUNG[i];
        if (b.h[c] < REIHEN && gewinntMit(b, c, p)) return SIEG - (b.n + 1);
      }
      if (tiefe <= 0) return bewerte(b, p);
      // Besser als «p gewinnt mit dem übernächsten Stein» geht es nicht, und
      // schlechter als «der andere gewinnt mit dem nächsten» auch nicht.
      const hoechstens = SIEG - (b.n + 3);
      if (beta > hoechstens) { beta = hoechstens; if (alpha >= beta) return beta; }

      const alphaVorher = alpha;
      const key = za * 1048576 + zb;
      const gemerkt = gedaechtnis.get(key);
      let zuerst = -1;
      if (gemerkt) {
        zuerst = gemerkt.zug;
        if (gemerkt.tiefe >= tiefe) {
          if (gemerkt.art === GENAU) return gemerkt.wert;
          if (gemerkt.art === UNTEN && gemerkt.wert > alpha) alpha = gemerkt.wert;
          else if (gemerkt.art === OBEN && gemerkt.wert < beta) beta = gemerkt.wert;
          if (alpha >= beta) return gemerkt.wert;
        }
      }

      // Was der andere sofort gewinnen könnte, muss p besetzen – hat er zwei
      // solche Stellen, ist es verloren.
      const q = 3 - p;
      let zwang = -1;
      for (let i = 0; i < SPALTEN; i += 1) {
        const c = ORDNUNG[i];
        if (b.h[c] < REIHEN && gewinntMit(b, c, q)) {
          if (zwang >= 0) return -(SIEG - (b.n + 2));
          zwang = c;
        }
      }

      let bester = -Infinity;
      let besterZug = -1;
      const reihe = zwang >= 0 ? [zwang] : (zuerst >= 0 ? [zuerst, ...ORDNUNG.filter((c) => c !== zuerst)] : ORDNUNG);
      for (let i = 0; i < reihe.length; i += 1) {
        const c = reihe[i];
        if (b.h[c] >= REIHEN) continue;
        const r = setze(b, c, p);
        const feld = c * REIHEN + r;
        za ^= ZOB_A[p][feld]; zb ^= ZOB_B[p][feld];
        // Ein Zug direkt unter eine Siegstelle des anderen schenkt sie ihm.
        const wert = -negamax(b, tiefe - 1, -beta, -alpha, q);
        za ^= ZOB_A[p][feld]; zb ^= ZOB_B[p][feld];
        nimm(b, c);
        if (abgebrochen) return 0;
        if (wert > bester) { bester = wert; besterZug = c; }
        if (bester > alpha) alpha = bester;
        if (alpha >= beta) break;
      }

      const art = bester <= alphaVorher ? OBEN : bester >= beta ? UNTEN : GENAU;
      if (gedaechtnis.size > 1500000) gedaechtnis.clear();
      gedaechtnis.set(key, { tiefe, wert: bester, art, zug: besterZug });
      return bester;
    }

    // Die Werte aller Züge an der Wurzel, je bis zur Tiefe.
    function wurzel(b, p, tiefe, reihenfolge) {
      const s = schluessel(b);
      const werte = new Map();
      for (const c of reihenfolge) {
        if (!frei(b, c)) continue;
        const r = setze(b, c, p);
        let wert;
        if (gewinnt(b, c, r, p)) wert = SIEG - b.n;
        else {
          const feld = c * REIHEN + r;
          za = s.a ^ ZOB_A[p][feld];
          zb = s.b ^ ZOB_B[p][feld];
          wert = -negamax(b, tiefe - 1, -Infinity, Infinity, 3 - p);
        }
        nimm(b, c);
        if (abgebrochen) return null;
        werte.set(c, wert);
      }
      return werte;
    }

    return { wurzel, knoten: () => knoten, abgebrochen: () => abgebrochen };
  }

  /*
   * Die Werte aller freien Spalten für p, so tief wie bis maxTiefe und in
   * der Zeit (ms) möglich – Tiefe um Tiefe, und die letzte, die ganz fertig
   * wurde, gilt. Gibt { werte: Map(spalte → wert), tiefe }.
   */
  function bewerteZuege(b, p, { maxTiefe = 8, zeit = 600, gedaechtnis = null } = {}) {
    const bis = Date.now() + zeit;
    const s = sucher({ bis, gedaechtnis: gedaechtnis || new Map() });
    let reihenfolge = ORDNUNG.filter((c) => frei(b, c));
    let ergebnis = null;
    let erreicht = 0;
    const rest = FELDER - b.n;
    for (let tiefe = 1; tiefe <= Math.min(maxTiefe, rest); tiefe += 1) {
      const werte = s.wurzel(b, p, tiefe, reihenfolge);
      if (!werte) break;
      ergebnis = werte;
      erreicht = tiefe;
      // Die besten zuerst – bei gleichem Wert bleibt die Mitte vorne.
      reihenfolge = [...reihenfolge].sort((x, y) => werte.get(y) - werte.get(x));
      // Steht es fest (Sieg oder Niederlage gefunden), hilft tiefer nichts.
      const best = Math.max(...werte.values());
      if (Math.abs(best) > SIEG / 2) break;
      if (Date.now() > bis) break;
    }
    if (!ergebnis) {
      // Nicht einmal eine Tiefe geschafft (sehr langsames Gerät): einen
      // Schritt weit schauen geht immer.
      ergebnis = sucher({}).wurzel(b, p, 1, reihenfolge);
      erreicht = 1;
    }
    return { werte: ergebnis, tiefe: erreicht };
  }

  // --- Die Stufen ---------------------------------------------------------------
  function zufallAus(liste, zufall) {
    return liste[Math.floor(zufall() * liste.length) % liste.length];
  }

  // Irgendeine Spalte, die Mitte etwas öfter.
  function gewichtet(spalten, zufall) {
    const GEWICHT = [1, 2, 3, 4, 3, 2, 1];
    const summe = spalten.reduce((s, c) => s + GEWICHT[c], 0);
    let wurf = zufall() * summe;
    for (const c of spalten) {
      wurf -= GEWICHT[c];
      if (wurf < 0) return c;
    }
    return spalten[spalten.length - 1];
  }

  // Spalten, in denen p sofort gewinnt.
  function siegSpalten(b, p) {
    return ORDNUNG.filter((c) => gewinntMit(b, c, p));
  }

  // Ein Stein hier liesse den anderen gleich darüber gewinnen.
  function schenkt(b, c, p) {
    if (!frei(b, c)) return false;
    setze(b, c, p);
    const ja = gewinntMit(b, c, 3 - p);
    nimm(b, c);
    return ja;
  }

  /*
   * Der Zug des Computers. p ist seine Farbe, stufe eine aus STUFEN.
   * zufall: eine Funktion wie Math.random (für die Prüfung festzulegen).
   * Gibt die Spalte.
   */
  function computerZug(b, p, stufe = "mittel", { zufall = Math.random, zeit = 650 } = {}) {
    const spalten = ORDNUNG.filter((c) => frei(b, c));
    if (!spalten.length) return -1;
    if (spalten.length === 1) return spalten[0];
    const q = 3 - p;
    const sieg = siegSpalten(b, p);
    const gefahr = siegSpalten(b, q);

    if (stufe === "leicht") {
      // Für die Kleinsten: irgendwohin, und den eigenen Vierer fast nie.
      if (sieg.length && zufall() < 0.15) return sieg[0];
      return zufallAus(spalten, zufall);
    }

    if (stufe === "einfach") {
      if (sieg.length && zufall() < 0.5) return sieg[0];
      if (gefahr.length && zufall() < 0.3) return gefahr[0];
      return gewichtet(spalten, zufall);
    }

    if (stufe === "mittel") {
      if (sieg.length && zufall() < 0.9) return sieg[0];
      if (gefahr.length && zufall() < 0.7) return gefahr[0];
      const sicher = spalten.filter((c) => !schenkt(b, c, p));
      const wahl = sicher.length ? sicher : spalten;
      // Ab und zu einfach irgendwohin, wo nichts anbrennt.
      if (zufall() < 0.45) return gewichtet(wahl, zufall);
      const { werte } = bewerteZuege(b, p, { maxTiefe: 2, zeit: 250 });
      const kandidaten = wahl.filter((c) => werte.has(c));
      if (!kandidaten.length) return gewichtet(wahl, zufall);
      const best = Math.max(...kandidaten.map((c) => werte.get(c)));
      const nahe = kandidaten.filter((c) => werte.get(c) >= best - 6);
      return zufallAus(nahe, zufall);
    }

    // schwer
    if (sieg.length) return sieg[0];
    if (b.n === 0) return 3;
    const { werte } = bewerteZuege(b, p, { maxTiefe: 42, zeit });
    const best = Math.max(...werte.values());
    const beste = [...werte.keys()].filter((c) => werte.get(c) === best);
    return zufallAus(beste, zufall);
  }

  window.LernappVierer = {
    SPALTEN,
    REIHEN,
    FELDER,
    STUFEN,
    SIEG,
    neuesBrett,
    frei,
    setze,
    nimm,
    viererBei,
    gewinntMit,
    ausZuegen,
    bewerte,
    bewerteZuege,
    computerZug,
  };
})();
