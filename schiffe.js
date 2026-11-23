/*
 * schiffe.js – Schiffe versenken: die Flotte verstecken, das Meer des
 * anderen absuchen.
 * ---------------------------------------------------------------------------
 * Die Seite /schiffe. Jede versteckt vier Schiffe in ihrem Meer (8 × 8
 * Felder): eines mit vier Feldern, zwei mit drei, eines mit zwei. Schiffe
 * liegen gerade und berühren sich nicht, auch nicht über Eck. Dann wird
 * abwechselnd geschossen: «Wasser» – der andere ist dran; «Treffer» oder
 * «Versenkt» – noch einmal. Wer zuerst alle Schiffe des anderen versenkt
 * hat, gewinnt; dann zeigt er, wo seine eigenen lagen.
 *
 * Menü, Computer als Gegner, Duell, Turnier und Bilanz macht der Rahmen
 * (zwei.js). Hier stehen das Meer, die Regeln und der Computer.
 *
 * Das Geheimnis bleibt auf dem Gerät. Die eigene Flotte steht nur im
 * Speicher dieses Geräts (localStorage, «schiffe.flotten», je Raum, Partie
 * und Platz), nicht in der Datenbank. Auf einen Schuss antwortet das Gerät
 * dessen, auf den geschossen wurde, von selbst (auto). Fehlt die Flotte dort
 * – ein anderes Gerät, der Speicher gelöscht –, legt es eine neue hin, die
 * zu allen bisherigen Antworten passt; gespielt wird dann mit der.
 *
 * Eine Partie steht als Text, Züge durch Punkte getrennt:
 *
 *   Ba, Bb       bereit: a (oder b) hat die Schiffe versteckt
 *   S27          ein Schuss auf Feld 27 (Zeile 3, Spalte 3; 0 bis 63)
 *   W, T         die Antwort: Wasser, Treffer
 *   V26,27,28    die Antwort: versenkt – das ganze Schiff
 *   Z0,1,2,3;…   am Ende: der Sieger zeigt seine Flotte
 *
 * Wer eröffnet (a), hat Schiffe in Koralle, das Gegenüber (b) in Gold. Gegen
 * den Computer liegt dessen Flotte in der Saat der Partie.
 *
 * Der Computer:
 *
 *   leicht    schiesst irgendwohin; nach einem Treffer nur manchmal daneben
 *   einfach   sucht nach einem Treffer oft rundherum
 *   mittel    sucht nach einem Treffer fast immer rundherum, folgt meist
 *             einer Reihe von Treffern, lässt das Wasser um versenkte
 *             Schiffe oft aus
 *   schwer    zählt, wo die übrigen Schiffe noch liegen können, und
 *             schiesst dorthin, wo es am wahrscheinlichsten ist
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "schiffe") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  const N = 8;
  const FELDER = N * N;
  const FLOTTE = [4, 3, 3, 2];
  const SPEICHER = "schiffe.flotten";

  const zeile = (f) => Math.floor(f / N);
  const spalte = (f) => f % N;
  const feldBei = (r, c) => (r >= 0 && r < N && c >= 0 && c < N ? r * N + c : -1);
  const kreuz = (f) => [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dr, dc]) => feldBei(zeile(f) + dr, spalte(f) + dc)).filter((x) => x >= 0);
  const rundum = (f) => {
    const aus = [];
    for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
      const x = feldBei(zeile(f) + dr, spalte(f) + dc);
      if (x >= 0) aus.push(x);
    }
    return aus;
  };
  // Das Schiff und das Wasser darum: Dort liegt kein anderes Schiff.
  const zone = (schiff) => new Set(schiff.flatMap(rundum));
  const sortiert = (liste) => [...liste].sort((x, y) => x - y);

  // --- Schiffe ------------------------------------------------------------------
  function schiffGueltig(zellen) {
    if (!Array.isArray(zellen) || zellen.length < 2 || zellen.length > 4) return false;
    const s = sortiert(zellen);
    if (s.some((f) => !Number.isInteger(f) || f < 0 || f >= FELDER)) return false;
    const waag = s.every((f, i) => zeile(f) === zeile(s[0]) && spalte(f) === spalte(s[0]) + i);
    const senk = s.every((f, i) => spalte(f) === spalte(s[0]) && zeile(f) === zeile(s[0]) + i);
    return waag || senk;
  }

  function flotteGueltig(schiffe) {
    if (!Array.isArray(schiffe) || schiffe.length !== FLOTTE.length) return false;
    if (!schiffe.every(schiffGueltig)) return false;
    if (JSON.stringify(schiffe.map((s) => s.length).sort()) !== JSON.stringify([...FLOTTE].sort())) return false;
    for (let i = 0; i < schiffe.length; i += 1) {
      const um = zone(schiffe[i]);
      for (let j = i + 1; j < schiffe.length; j += 1) if (schiffe[j].some((f) => um.has(f))) return false;
    }
    return true;
  }

  // Alle Lagen eines Schiffs der Länge l.
  const LAGEN = new Map(FLOTTE.map((l) => [l, (() => {
    const aus = [];
    for (let r = 0; r < N; r += 1) for (let c = 0; c + l <= N; c += 1) aus.push(Array.from({ length: l }, (_, i) => feldBei(r, c + i)));
    for (let c = 0; c < N; c += 1) for (let r = 0; r + l <= N; r += 1) aus.push(Array.from({ length: l }, (_, i) => feldBei(r + i, c)));
    return aus;
  })()]));

  // Ein Zufall mit Saat: dieselbe Saat, dieselbe Flotte (der Computer).
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
  const mischen = (liste, rnd) => {
    const a = [...liste];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  /*
   * Schiffe der Längen laengen ins Meer legen – zufällig, aber so, dass sie
   * kein Feld aus verboten belegen, jedes Feld aus muss belegen, und nicht
   * an die festen Schiffe (fest) stossen. null, wenn es nicht geht.
   */
  function platziere(laengen, { rnd = Math.random, verboten = new Set(), muss = new Set(), fest = [] } = {}) {
    const reihe = [...laengen].sort((x, y) => y - x);
    let schritte = 0;
    function weiter(i, gesperrt, offen) {
      schritte += 1;
      if (schritte > 40000) return null;
      if (i === reihe.length) return offen.size ? null : [];
      const platz = reihe.slice(i).reduce((s, l) => s + l, 0);
      if (offen.size > platz) return null;
      const ziel = offen.size ? Math.min(...offen) : -1;
      let lagen = mischen(LAGEN.get(reihe[i]), rnd).filter((s) => !s.some((f) => gesperrt.has(f) || verboten.has(f)));
      // Muss ein Treffer noch gedeckt werden, zuerst die Lagen, die ihn decken.
      if (ziel >= 0) lagen = [...lagen.filter((s) => s.includes(ziel)), ...lagen.filter((s) => !s.includes(ziel))];
      for (const s of lagen) {
        const neuGesperrt = new Set(gesperrt);
        zone(s).forEach((f) => neuGesperrt.add(f));
        const neuOffen = new Set([...offen].filter((f) => !s.includes(f)));
        // Ein Treffer, der jetzt im Wasser um dieses Schiff liegt, ist verloren.
        if ([...neuOffen].some((f) => neuGesperrt.has(f))) continue;
        const rest = weiter(i + 1, neuGesperrt, neuOffen);
        if (rest) return [s, ...rest];
      }
      return null;
    }
    const gesperrt = new Set();
    fest.forEach((s) => zone(s).forEach((f) => gesperrt.add(f)));
    const offen = new Set([...muss].filter((f) => !fest.some((s) => s.includes(f))));
    return weiter(0, gesperrt, offen);
  }

  const zufallsFlotte = (rnd = Math.random) => platziere(FLOTTE, { rnd });
  const computerFlotte = (saat) => platziere(FLOTTE, { rnd: wuerfel((Number(saat) ^ 0x5eed) >>> 0) });

  const flotteText = (schiffe) => `Z${schiffe.map((s) => sortiert(s).join(",")).join(";")}`;
  function flotteAusText(z) {
    if (!/^Z\d{1,2}(,\d{1,2}){1,3}(;\d{1,2}(,\d{1,2}){1,3}){3}$/.test(z)) return null;
    const schiffe = z.slice(1).split(";").map((s) => s.split(",").map(Number));
    return flotteGueltig(schiffe) ? schiffe.map(sortiert) : null;
  }

  // --- Die Regeln -----------------------------------------------------------------
  // Was noch schwimmt: die Längen der Flotte ohne die schon versenkten.
  function uebrig(versenkt) {
    const rest = [...FLOTTE];
    for (const s of versenkt) {
      const i = rest.indexOf(s.length);
      if (i >= 0) rest.splice(i, 1);
    }
    return rest;
  }

  // «V…» als Antwort auf den Schuss von «von» auf «feld»: ein ganzes Schiff,
  // das den Schuss enthält, sonst nur Felder, die schon Treffer waren.
  function versenktAus(z, l, von, feld) {
    const m = /^V(\d{1,2}(?:,\d{1,2}){1,3})$/.exec(z);
    if (!m) return null;
    const schiff = sortiert(m[1].split(",").map(Number));
    if (!schiffGueltig(schiff) || !schiff.includes(feld)) return null;
    if (!schiff.every((f) => f === feld || l.schuesse[von][f] === "T")) return null;
    if (!uebrig(l.versenkt[von]).includes(schiff.length)) return null;
    return schiff;
  }

  function lage(zuege, { beginnt }) {
    const l = {
      phase: "aufstellen",
      dran: "beide",
      ende: null,
      bereit: { a: false, b: false },
      // schuesse[x][feld]: was x dort getroffen hat – W, T oder V.
      schuesse: { a: {}, b: {} },
      // versenkt[x]: die Schiffe, die x versenkt hat (also die des anderen).
      versenkt: { a: [], b: [] },
      // Ein Schuss, auf dessen Antwort man wartet: { von, feld }.
      offen: null,
      // Was zuletzt geschah: { von, feld, ergebnis, schiff }.
      letzter: null,
      // Die Flotte, die einer am Ende gezeigt hat.
      flotte: { a: null, b: null },
      antworten: 0,
    };
    const kaputt = () => ({ ...l, dran: null, kaputt: true });
    for (const z of zuege) {
      if (l.phase === "aufstellen") {
        const m = /^B([ab])$/.exec(z);
        if (!m || l.bereit[m[1]]) return kaputt();
        l.bereit[m[1]] = true;
        if (l.bereit.a && l.bereit.b) { l.phase = "schiessen"; l.dran = beginnt; }
      } else if (l.phase === "schiessen") {
        const m = /^S([1-9]?\d)$/.exec(z);
        const feld = m ? Number(m[1]) : -1;
        if (!m || feld >= FELDER || l.schuesse[l.dran][feld]) return kaputt();
        l.offen = { von: l.dran, feld };
        l.phase = "antwort";
        l.dran = anderer(l.offen.von);
      } else if (l.phase === "antwort") {
        const { von, feld } = l.offen;
        let schiff = null;
        if (z !== "W" && z !== "T") {
          schiff = versenktAus(z, l, von, feld);
          if (!schiff) return kaputt();
        }
        const ergebnis = schiff ? "V" : z;
        if (schiff) {
          schiff.forEach((f) => { l.schuesse[von][f] = "V"; });
          l.versenkt[von].push(schiff);
        } else l.schuesse[von][feld] = ergebnis;
        l.letzter = { von, feld, ergebnis, schiff };
        l.offen = null;
        l.antworten += 1;
        if (ergebnis === "W") { l.phase = "schiessen"; l.dran = anderer(von); } else if (l.versenkt[von].length === FLOTTE.length) { l.phase = "zeigen"; l.dran = von; } else { l.phase = "schiessen"; l.dran = von; }
      } else if (l.phase === "zeigen") {
        const flotte = flotteAusText(z);
        if (!flotte) return kaputt();
        l.flotte[l.dran] = flotte;
        l.ende = l.dran;
        l.phase = "ende";
        l.dran = null;
      } else return kaputt();
    }
    return l;
  }

  function darf(l, zug, sitz) {
    if (l.phase === "aufstellen") return zug === `B${sitz}` && !l.bereit[sitz];
    if (l.dran !== sitz) return false;
    if (l.phase === "schiessen") {
      const m = /^S([1-9]?\d)$/.exec(zug);
      return Boolean(m) && Number(m[1]) < FELDER && !l.schuesse[sitz][Number(m[1])];
    }
    if (l.phase === "antwort") return zug === "W" || zug === "T" || Boolean(versenktAus(zug, l, l.offen.von, l.offen.feld));
    if (l.phase === "zeigen") return Boolean(flotteAusText(zug));
    return false;
  }

  // Die Antwort einer Flotte auf den Schuss von «von» auf «feld».
  function antwortAuf(flotte, l, von, feld) {
    const schiff = flotte.find((s) => s.includes(feld));
    if (!schiff) return "W";
    const ganz = schiff.every((f) => f === feld || l.schuesse[von][f] === "T");
    return ganz ? `V${sortiert(schiff).join(",")}` : "T";
  }

  // --- Die eigene Flotte, auf diesem Gerät ----------------------------------------
  const schluessel = (raum, nr, sitz) => `${raum}|${nr}|${sitz}`;
  function flottenLesen() {
    try { return JSON.parse(localStorage.getItem(SPEICHER) || "{}") || {}; } catch { return {}; }
  }
  function flotteMerken(raum, nr, sitz, flotte) {
    const alle = flottenLesen();
    alle[schluessel(raum, nr, sitz)] = { f: flotte, t: Date.now() };
    // Nur die letzten paar Partien behalten.
    const behalten = Object.entries(alle).sort((x, y) => (y[1]?.t || 0) - (x[1]?.t || 0)).slice(0, 12);
    try { localStorage.setItem(SPEICHER, JSON.stringify(Object.fromEntries(behalten))); } catch { /* ohne Speicher eben nur im Kopf */ }
  }
  function flotteLesen(raum, nr, sitz) {
    const f = flottenLesen()[schluessel(raum, nr, sitz)]?.f;
    return flotteGueltig(f) ? f.map(sortiert) : null;
  }

  // Passt die Flotte zu allem, was das Gerät schon geantwortet hat?
  function passt(flotte, l, sitz) {
    const von = anderer(sitz);
    const s = l.schuesse[von];
    const belegt = new Set(flotte.flat());
    return Object.entries(s).every(([f, e]) => (e === "W" ? !belegt.has(Number(f)) : belegt.has(Number(f))))
      && l.versenkt[von].every((v) => flotte.some((x) => sortiert(x).join() === sortiert(v).join()));
  }

  // Eine Flotte, die zu den bisherigen Antworten passt – wenn die eigene
  // fehlt.
  function passendeFlotte(l, sitz) {
    const von = anderer(sitz);
    const s = l.schuesse[von];
    const fest = l.versenkt[von].map(sortiert);
    const verboten = new Set(Object.keys(s).filter((f) => s[f] === "W").map(Number));
    const muss = new Set(Object.keys(s).filter((f) => s[f] === "T").map(Number));
    const neu = platziere(uebrig(fest), { verboten, muss, fest });
    return neu ? [...fest, ...neu.map(sortiert)] : null;
  }

  function meineFlotte(raum, nr, sitz, l) {
    const da = flotteLesen(raum, nr, sitz);
    if (da && passt(da, l, sitz)) return da;
    const neu = passendeFlotte(l, sitz);
    if (neu) flotteMerken(raum, nr, sitz, neu);
    return neu;
  }

  function auto(l, sitz, { raum, nr }) {
    if (l.dran !== sitz || (l.phase !== "antwort" && l.phase !== "zeigen")) return null;
    const flotte = meineFlotte(raum, nr, sitz, l);
    if (!flotte) return null;
    return l.phase === "zeigen" ? flotteText(flotte) : antwortAuf(flotte, l, l.offen.von, l.offen.feld);
  }

  // --- Der Computer -------------------------------------------------------------
  const wahl = (liste, rnd = Math.random) => liste[Math.floor(rnd() * liste.length)];

  // Was «sitz» übers Meer des anderen weiss.
  function wissen(l, sitz) {
    const s = l.schuesse[sitz];
    const offen = [];
    for (let f = 0; f < FELDER; f += 1) if (!s[f]) offen.push(f);
    const umVersenkt = new Set();
    l.versenkt[sitz].forEach((schiff) => zone(schiff).forEach((f) => umVersenkt.add(f)));
    const klug = offen.filter((f) => !umVersenkt.has(f));
    const treffer = Object.keys(s).filter((f) => s[f] === "T").map(Number);
    return { s, offen, klug, treffer, umVersenkt };
  }

  // Die Felder neben den Treffern – und wenn zwei Treffer in einer Reihe
  // liegen, die beiden Enden der Reihe.
  function rundumTreffer(treffer, erlaubt) {
    const ok = new Set(erlaubt);
    return [...new Set(treffer.flatMap(kreuz))].filter((f) => ok.has(f));
  }
  function reihenEnden(treffer, erlaubt) {
    const ok = new Set(erlaubt);
    const t = new Set(treffer);
    const aus = new Set();
    for (const f of treffer) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        if (!t.has(feldBei(zeile(f) + dr, spalte(f) + dc))) continue;
        let r = zeile(f); let c = spalte(f);
        while (t.has(feldBei(r - dr, c - dc))) { r -= dr; c -= dc; }
        const vorne = feldBei(r - dr, c - dc);
        while (t.has(feldBei(r, c))) { r += dr; c += dc; }
        const hinten = feldBei(r, c);
        if (ok.has(vorne)) aus.add(vorne);
        if (ok.has(hinten)) aus.add(hinten);
      }
    }
    return [...aus];
  }

  // Wo die übrigen Schiffe noch liegen können: jede mögliche Lage zählt für
  // ihre Felder, eine Lage über Treffern viel mehr.
  function dichte(l, sitz, w) {
    const wert = new Array(FELDER).fill(0);
    const gesperrt = new Set(w.umVersenkt);
    Object.entries(w.s).forEach(([f, e]) => { if (e !== "T") gesperrt.add(Number(f)); });
    const t = new Set(w.treffer);
    for (const len of new Set(uebrig(l.versenkt[sitz]))) {
      for (const lage of LAGEN.get(len)) {
        if (lage.some((f) => gesperrt.has(f))) continue;
        const deckt = lage.filter((f) => t.has(f)).length;
        if (t.size && !deckt) continue;
        const gewicht = 1 + deckt * 30;
        lage.forEach((f) => { if (!w.s[f]) wert[f] += gewicht; });
      }
    }
    let best = -1;
    let beste = [];
    w.klug.forEach((f) => {
      if (wert[f] > best) { best = wert[f]; beste = [f]; } else if (wert[f] === best) beste.push(f);
    });
    return best > 0 ? wahl(beste) : null;
  }

  function ziel(l, sitz, stufe) {
    const w = wissen(l, sitz);
    const klug = w.klug.length ? w.klug : w.offen;
    if (stufe === "leicht") {
      if (w.treffer.length && Math.random() < 0.25) {
        const n = rundumTreffer(w.treffer, w.offen);
        if (n.length) return wahl(n);
      }
      return wahl(w.offen);
    }
    if (stufe === "einfach") {
      if (w.treffer.length && Math.random() < 0.6) {
        const n = rundumTreffer(w.treffer, w.offen);
        if (n.length) return wahl(n);
      }
      return wahl(Math.random() < 0.3 ? klug : w.offen);
    }
    if (stufe === "mittel") {
      if (w.treffer.length && Math.random() < 0.9) {
        const enden = Math.random() < 0.7 ? reihenEnden(w.treffer, klug) : [];
        if (enden.length) return wahl(enden);
        const n = rundumTreffer(w.treffer, klug);
        if (n.length) return wahl(n);
      }
      return wahl(Math.random() < 0.6 ? klug : w.offen);
    }
    return dichte(l, sitz, w) ?? wahl(klug);
  }

  function computer(l, sitz, stufe, { saat }) {
    if (l.phase === "aufstellen") return l.bereit[sitz] ? null : { zug: `B${sitz}`, warte: 500 };
    if (l.dran !== sitz) return null;
    const flotte = computerFlotte(saat);
    if (l.phase === "antwort") return { zug: antwortAuf(flotte, l, l.offen.von, l.offen.feld), warte: 260 };
    if (l.phase === "zeigen") return { zug: flotteText(flotte), warte: 200 };
    if (l.phase === "schiessen") return `S${ziel(l, sitz, stufe)}`;
    return null;
  }

  // --- Was über dem Meer steht ----------------------------------------------------
  function satz(l, { ich, name, modus }) {
    const gegen = ich ? anderer(ich) : null;
    if (l.phase === "aufstellen") {
      if (ich && !l.bereit[ich]) return { text: "Verstecke deine Schiffe – dann «Fertig!»", sitz: ich };
      if (ich) return { text: modus === "computer" ? "Der Computer versteckt seine Schiffe" : `${name(gegen)} versteckt noch die Schiffe`, sitz: gegen };
      return { text: "Beide verstecken ihre Schiffe", sitz: null };
    }
    if (l.phase === "zeigen") return { text: l.dran === ich ? "Alle Schiffe versenkt!" : `${name(l.dran)} hat alle Schiffe versenkt`, sitz: l.dran };
    if (l.phase === "antwort") {
      const von = l.offen.von;
      return { text: von === ich ? "Und …?" : `${name(von)} hat geschossen …`, sitz: von };
    }
    if (l.phase !== "schiessen") return null;
    const z = l.letzter;
    const nochmal = z && z.von === l.dran && z.ergebnis !== "W";
    const was = z?.ergebnis === "V" ? "Versenkt!" : "Treffer!";
    if (l.dran === ich) {
      if (!z) return { text: "Du beginnst – tippe ins Meer gegenüber", sitz: ich };
      if (nochmal) return { text: `${was} Du darfst nochmal.`, sitz: ich };
      return { text: "Wasser! Jetzt du.", sitz: ich };
    }
    if (modus === "computer") {
      if (!z) return { text: "Der Computer beginnt", sitz: l.dran };
      return { text: nochmal ? `${was} Der Computer darf nochmal` : "Der Computer überlegt", sitz: l.dran };
    }
    return { text: nochmal ? `${was} ${name(l.dran)} darf nochmal` : `${name(l.dran)} ist dran`, sitz: l.dran };
  }

  // --- Das Bild -------------------------------------------------------------------
  // Ein Schiff als Rumpf über dem Gitter (in Zellen: --c, --r, --l).
  function rumpf(schiff, klasse) {
    const s = sortiert(schiff);
    const waag = s.length > 1 && zeile(s[0]) === zeile(s[1]);
    const r = el("span", `zw-sv-rumpf ${waag ? "ist-waag" : "ist-senk"} ${klasse}`.trim());
    r.style.setProperty("--c", String(spalte(s[0])));
    r.style.setProperty("--r", String(zeile(s[0])));
    r.style.setProperty("--l", String(s.length));
    return r;
  }

  function held() {
    const bild = el("div", "zw-sv-held");
    const zellen = { 7: "w", 11: "w", 13: "t", 14: "t", 17: "w", 22: "w" };
    for (let f = 0; f < 25; f += 1) {
      const z = el("span", `zw-sv-held-feld${zellen[f] ? ` ist-${zellen[f]}` : ""}`);
      bild.append(z);
    }
    const s = el("span", "zw-sv-held-schiff");
    bild.append(s);
    return bild;
  }

  function meerBauen(art, beiFeld) {
    const knoten = el("section", `zw-sv-meer ist-${art}`);
    const kopf = el("div", "zw-sv-kopf");
    const name = el("span", "zw-sv-name");
    const rest = el("span", "zw-sv-rest");
    rest.setAttribute("aria-hidden", "true");
    kopf.append(name, rest);
    const gitter = el("div", "zw-sv-gitter");
    gitter.setAttribute("role", "group");
    const zellen = [];
    for (let f = 0; f < FELDER; f += 1) {
      const z = el("button", "zw-sv-zelle");
      z.type = "button";
      z.dataset.feld = String(f);
      z.addEventListener("click", () => beiFeld(f));
      z.addEventListener("keydown", (e) => {
        const ziel = { ArrowLeft: feldBei(zeile(f), spalte(f) - 1), ArrowRight: feldBei(zeile(f), spalte(f) + 1), ArrowUp: feldBei(zeile(f) - 1, spalte(f)), ArrowDown: feldBei(zeile(f) + 1, spalte(f)) }[e.key];
        if (ziel === undefined) return;
        e.preventDefault();
        if (ziel >= 0) zellen[ziel].focus();
      });
      zellen.push(z);
      gitter.append(z);
    }
    const schiffe = el("div", "zw-sv-schiffe");
    schiffe.setAttribute("aria-hidden", "true");
    gitter.append(schiffe);
    knoten.append(kopf, gitter);
    return { knoten, name, rest, gitter, schiffe, zellen };
  }

  // Die Flotte als kleine Rümpfe: welche noch schwimmen.
  function restZeichnen(wohin, versenkt, sitz) {
    wohin.innerHTML = "";
    const weg = versenkt.map((s) => s.length);
    [...FLOTTE].sort((x, y) => y - x).forEach((len) => {
      const i = weg.indexOf(len);
      const sunk = i >= 0;
      if (sunk) weg.splice(i, 1);
      const r = el("span", `zw-sv-rest-schiff ist-${sitz}${sunk ? " ist-weg" : ""}`);
      r.style.setProperty("--l", String(len));
      wohin.append(r);
    });
  }

  function brett({ zug, ton, knopf, ruhig, vorlesen }) {
    const knoten = el("div", "zw-sv");
    const gegner = meerBauen("gegner", (f) => schiessen(f));
    const meins = meerBauen("meins", (f) => stellen(f));
    const werkzeug = el("div", "zw-sv-werkzeug");
    const tipp = el("p", "zw-sv-tipp", "Tippe ein Schiff an, dann ein freies Feld: Es fährt dorthin. Noch ein Tipp aufs Schiff dreht es.");
    tipp.append(" ", vorlesen?.("Versteck deine Schiffe. Tippe ein Schiff an, dann ein freies Feld: Es fährt dorthin. Noch ein Tipp aufs Schiff dreht es. Oder tippe auf Neu verteilen. Wenn alles passt, tippe auf Fertig.") || "");
    const neuMischen = knopf("Neu verteilen", "mini-knopf mini-knopf-still zw-sv-mischen", () => {
      entwurf = zufallsFlotte();
      auswahl = -1;
      ton("tipp");
      zeichne(jetzt);
    });
    const fertig = knopf("Fertig!", "mini-knopf mini-knopf-voll vr-los zw-sv-fertig", () => bereit());
    werkzeug.append(neuMischen, fertig);
    knoten.append(gegner.knoten, meins.knoten, tipp, werkzeug);

    let jetzt = null;          // das letzte Bild
    let entwurf = null;        // die Flotte, solange sie noch versteckt wird
    let auswahl = -1;          // das Schiff, das gerade verschoben wird
    let partie = null;         // nr der Partie, für die der Entwurf gilt
    let gesehen = -1;          // wie viele Antworten schon gezeigt sind
    let schussGeschickt = -1;  // ein Schuss, der noch unterwegs ist
    let neu = null;            // was gerade getroffen wurde: { meer, feld, bis }

    const ichVon = (b) => b?.ich || null;
    const stellenErlaubt = (b) => Boolean(b && b.ich && !b.aus && b.lage.phase === "aufstellen" && !b.lage.bereit[b.ich]);

    function wackeln(knoten) {
      if (ruhig() || !knoten.animate) return;
      knoten.animate([{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }], { duration: 220 });
    }

    // Ein Schiff an einen neuen Ort oder in die andere Richtung.
    function versuche(i, schiff) {
      const andere = entwurf.filter((_, j) => j !== i);
      const neu = [...andere.slice(0, i), schiff, ...andere.slice(i)];
      if (!flotteGueltig(neu)) return false;
      entwurf = neu.map(sortiert);
      return true;
    }
    function drehen(i) {
      const s = entwurf[i];
      const waag = zeile(s[0]) === zeile(s[1]);
      const len = s.length;
      // Um jedes Feld des Schiffs drehen, zuerst ums vordere.
      for (const um of s) {
        for (let k = 0; k < len; k += 1) {
          const r0 = waag ? zeile(um) - k : zeile(um);
          const c0 = waag ? spalte(um) : spalte(um) - k;
          const neu = Array.from({ length: len }, (_, j) => (waag ? feldBei(r0 + j, c0) : feldBei(r0, c0 + j)));
          if (neu.every((f) => f >= 0) && versuche(i, neu)) return true;
        }
      }
      return false;
    }
    function fahren(i, f) {
      const s = entwurf[i];
      const len = s.length;
      const waag = zeile(s[0]) === zeile(s[1]);
      for (const richtung of [waag, !waag]) {
        for (let k = 0; k < len; k += 1) {
          const r0 = richtung ? zeile(f) : zeile(f) - k;
          const c0 = richtung ? spalte(f) - k : spalte(f);
          const neu = Array.from({ length: len }, (_, j) => (richtung ? feldBei(r0, c0 + j) : feldBei(r0 + j, c0)));
          if (neu.every((x) => x >= 0) && versuche(i, neu)) return true;
        }
      }
      return false;
    }

    function stellen(f) {
      if (!stellenErlaubt(jetzt) || !entwurf) return;
      const i = entwurf.findIndex((s) => s.includes(f));
      if (i >= 0 && i === auswahl) {
        if (drehen(i)) ton("tipp"); else wackeln(meins.zellen[f]);
      } else if (i >= 0) {
        auswahl = i;
        ton("tipp");
      } else if (auswahl >= 0) {
        if (fahren(auswahl, f)) ton("klack"); else wackeln(meins.zellen[f]);
      }
      zeichne(jetzt);
    }

    function bereit() {
      if (!stellenErlaubt(jetzt) || !entwurf) return;
      flotteMerken(jetzt.raum, jetzt.nr, jetzt.ich, entwurf);
      auswahl = -1;
      zug(`B${jetzt.ich}`);
    }

    function schiessen(f) {
      const b = jetzt;
      if (!b || b.aus || !b.ich || b.lage.phase !== "schiessen" || b.lage.dran !== b.ich) return;
      if (b.lage.schuesse[b.ich][f] || wissen(b.lage, b.ich).umVersenkt.has(f)) return;
      schussGeschickt = f;
      gegner.zellen[f].classList.add("ist-ziel");
      zug(`S${f}`);
    }

    function zeichne(b) {
      if (!b) return;
      jetzt = b;
      const l = b.lage;
      const ich = ichVon(b);
      const sicht = ich || "a";          // wer zuschaut, sieht es von a aus
      const gegen = anderer(sicht);
      const namen = b.namen || { a: "", b: "" };

      // Eine neue Partie: ein neuer Entwurf.
      if (partie !== `${b.raum}|${b.nr}`) {
        partie = `${b.raum}|${b.nr}`;
        entwurf = null;
        auswahl = -1;
        gesehen = -1;
        schussGeschickt = -1;
        neu = null;
      }
      let flotte = null;
      if (ich && l.phase === "aufstellen" && !l.bereit[ich]) {
        if (!entwurf) entwurf = zufallsFlotte();
        flotte = entwurf;
      } else if (ich) {
        flotte = meineFlotte(b.raum, b.nr, ich, l);
      } else flotte = l.flotte[sicht];

      // Wo gerade etwas geschieht, ist das Meer gross.
      const aufstellen = l.phase === "aufstellen";
      // Am Ende das Meer gegenüber: Dort zeigt der Sieger seine Flotte.
      const angriff = !aufstellen && (l.phase === "antwort" ? l.offen.von === sicht : l.phase === "schiessen" ? l.dran === sicht : true);
      knoten.dataset.fokus = aufstellen ? "aufstellen" : angriff ? "angriff" : "abwehr";
      gegner.knoten.classList.toggle("ist-gross", !aufstellen && angriff);
      gegner.knoten.classList.toggle("ist-klein", !aufstellen && !angriff);
      gegner.knoten.hidden = aufstellen;
      meins.knoten.classList.toggle("ist-gross", aufstellen || !angriff);
      meins.knoten.classList.toggle("ist-klein", !aufstellen && angriff);
      werkzeug.hidden = !stellenErlaubt(b);
      tipp.hidden = !stellenErlaubt(b);

      gegner.name.textContent = namen[gegen] || "";
      meins.name.textContent = !ich ? namen[sicht] : "Dein Meer";
      gegner.knoten.dataset.sitz = gegen;
      meins.knoten.dataset.sitz = sicht;
      restZeichnen(gegner.rest, l.versenkt[sicht], gegen);
      restZeichnen(meins.rest, l.versenkt[gegen], sicht);

      // Das Meer gegenüber: meine Schüsse.
      const w = wissen(l, sicht);
      const meinZug = Boolean(ich && !b.aus && l.phase === "schiessen" && l.dran === ich);
      if (l.phase !== "schiessen" || l.dran !== ich) schussGeschickt = -1;
      gegner.zellen.forEach((z, f) => {
        const e = l.schuesse[sicht][f] || "";
        const offen = l.offen && l.offen.von === sicht && l.offen.feld === f;
        z.className = `zw-sv-zelle${e === "W" ? " ist-wasser" : e === "T" ? " ist-treffer" : e === "V" ? " ist-treffer ist-versenkt" : ""}${!e && w.umVersenkt.has(f) ? " ist-zone" : ""}${offen || schussGeschickt === f ? " ist-ziel" : ""}`;
        z.disabled = !meinZug || Boolean(e) || w.umVersenkt.has(f) || schussGeschickt >= 0;
        z.setAttribute("aria-label", `${String.fromCharCode(65 + spalte(f))}${zeile(f) + 1}: ${e === "W" ? "Wasser" : e === "T" ? "Treffer" : e === "V" ? "versenkt" : w.umVersenkt.has(f) ? "sicher Wasser" : "noch unbekannt"}`);
      });
      gegner.schiffe.innerHTML = "";
      l.versenkt[sicht].forEach((s) => gegner.schiffe.append(rumpf(s, `ist-${gegen} ist-versenkt`)));
      // Am Ende zeigt der Sieger, wo seine Schiffe lagen.
      const gezeigt = l.flotte[gegen];
      if (gezeigt) gezeigt.filter((s) => !l.versenkt[sicht].some((v) => v.join() === sortiert(s).join())).forEach((s) => gegner.schiffe.append(rumpf(s, `ist-${gegen} ist-gezeigt`)));

      // Mein Meer: meine Schiffe und die Schüsse des anderen.
      const stellt = stellenErlaubt(b);
      meins.knoten.classList.toggle("ist-stellen", stellt);
      meins.zellen.forEach((z, f) => {
        const e = l.schuesse[gegen][f] || "";
        const offen = l.offen && l.offen.von === gegen && l.offen.feld === f;
        z.className = `zw-sv-zelle${e === "W" ? " ist-wasser" : e ? " ist-treffer" : ""}${e === "V" ? " ist-versenkt" : ""}${offen ? " ist-ziel" : ""}`;
        z.disabled = !stellt;
        const schiff = flotte?.find((s) => s.includes(f));
        z.setAttribute("aria-label", `${String.fromCharCode(65 + spalte(f))}${zeile(f) + 1}: ${schiff ? "Schiff" : "Wasser"}${e === "W" ? ", daneben geschossen" : e ? ", getroffen" : ""}`);
      });
      meins.schiffe.innerHTML = "";
      (flotte || []).forEach((s, i) => {
        const versenkt = l.versenkt[gegen].some((v) => v.join() === sortiert(s).join());
        meins.schiffe.append(rumpf(s, `ist-${sicht}${versenkt ? " ist-versenkt" : ""}${stellt && i === auswahl ? " ist-gewaehlt" : ""}`));
      });

      // Was gerade passiert ist: ein Platsch, ein Treffer. Die Zelle behält
      // ihr «ist-neu», bis es vorbei ist – auch wenn zwischendurch neu
      // gezeichnet wird.
      if (gesehen >= 0 && l.antworten > gesehen && l.letzter) {
        const { von, feld, ergebnis } = l.letzter;
        neu = { meer: von === sicht ? gegner : meins, feld, bis: Date.now() + 900 };
        ton(ergebnis === "W" ? "platsch" : "treffer");
        if (ergebnis === "V") window.setTimeout(() => ton("klack"), 200);
      }
      if (neu && Date.now() < neu.bis) neu.meer.zellen[neu.feld].classList.add("ist-neu");
      gesehen = l.antworten;
      knoten.classList.toggle("ist-dran", meinZug);
    }

    return {
      knoten,
      zeichne,
      fokus: () => {
        const b = jetzt;
        if (stellenErlaubt(b)) fertig.focus({ preventScroll: true });
        else gegner.zellen.find((z) => !z.disabled)?.focus({ preventScroll: true });
      },
    };
  }

  Z.starte({
    id: "schiffe",
    titel: "Schiffe versenken",
    seite: "schiffe",
    unter: "Versteck deine vier Schiffe und such die des anderen. Wasser – der andere ist dran; Treffer – nochmal! Wer zuerst alle versenkt, gewinnt.",
    held,
    trenner: ".",
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Zum Lernen" },
      einfach: { name: "Einfach", sterne: 1, satz: "Zum Warmwerden" },
      mittel: { name: "Mittel", sterne: 2, satz: "Eine echte Aufgabe" },
      schwer: { name: "Schwer", sterne: 3, satz: "Rechnet, wo deine Schiffe liegen" },
    },
    texte: { start: "tippe ins Meer gegenüber", remis: "Unentschieden." },
    lage,
    darf,
    brett,
    computer,
    auto,
    satz,
    neuePartie: () => ({ saat: Math.floor(Math.random() * 4294967295) }),
  });
})();
