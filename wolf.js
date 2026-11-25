/*
 * wolf.js – Wolf und Schafe: vier Schafe sperren den Wolf ein.
 * ---------------------------------------------------------------------------
 * Die Seite /wolf. Ein Brett mit 8 × 8 Feldern, gespielt wird nur auf den
 * dunklen. Unten stehen vier Schafe, oben der Wolf.
 *
 *   - Ein Schaf geht einen Schritt schräg nach vorn (nach oben) – nie zurück.
 *   - Der Wolf geht einen Schritt schräg, vorwärts oder rückwärts.
 *   - Niemand springt, niemand wird geschlagen.
 *
 * Die Schafe gewinnen, wenn der Wolf nicht mehr ziehen kann. Der Wolf
 * gewinnt, wenn er an allen Schafen vorbei ist (kein Schaf mehr unter ihm –
 * dann holt ihn keines mehr ein) – oder wenn die Schafe nicht mehr ziehen
 * können.
 *
 * Die Rollen wechseln jede Partie: Wer beginnt, hat die Schafe und zieht
 * zuerst; das Gegenüber ist der Wolf. Jedes Gerät zeigt die eigenen Figuren
 * unten: Wer den Wolf hat, sieht das Brett gedreht.
 *
 * Die Felder sind 0 bis 63, zeilenweise von oben links (aus Sicht der
 * Schafe). Ein Zug ist «von-nach», etwa «57-48», getrennt durch Punkte.
 *
 * Menü, Computer als Gegner, Duell, Turnier und Bilanz macht der Rahmen
 * (zwei.js). Hier stehen nur das Brett, die Regeln und der Computer.
 *
 * Der Computer – als Schafe und als Wolf:
 *
 *   leicht    zieht irgendwohin – als Schafe lassen sie bald eine Lücke, als
 *             Wolf trödelt er meist zurück nach oben
 *   einfach   schaut einen Zug weit, ab und zu irgendwohin
 *   mittel    schaut vier Züge weit
 *   schwer    schaut acht Züge weit, als Schafe zehn – so lassen sie den
 *             Wolf praktisch nie durch
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "wolf") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  const N = 8;
  const zeile = (f) => Math.floor(f / N);
  const spalte = (f) => f % N;
  const feld = (r, c) => r * N + c;
  const dunkel = (f) => (zeile(f) + spalte(f)) % 2 === 1;
  // Die Schafe unten auf den dunklen Feldern der letzten Zeile, der Wolf oben
  // auf dem dunklen Feld in der Mitte.
  const SCHAFE_START = [56, 58, 60, 62];
  const WOLF_START = 3;

  const nachbarn = (f, nurVor) => {
    const r = zeile(f); const c = spalte(f);
    const liste = [];
    for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      if (nurVor && dr > 0) continue;
      const nr = r + dr; const nc = c + dc;
      if (nr >= 0 && nr < N && nc >= 0 && nc < N) liste.push(feld(nr, nc));
    }
    return liste;
  };

  // Wer welche Rolle hat: Wer beginnt, hat die Schafe.
  const rollen = (beginnt) => ({ schafe: beginnt, wolf: anderer(beginnt) });

  // Alle Züge einer Seite in einer Stellung (schafe: Felder, wolf: Feld).
  function zuegeVon(st, art) {
    const besetzt = new Set([...st.schafe, st.wolf]);
    if (art === "wolf") return nachbarn(st.wolf, false).filter((f) => !besetzt.has(f)).map((f) => [st.wolf, f]);
    const liste = [];
    for (const s of st.schafe) for (const f of nachbarn(s, true)) if (!besetzt.has(f)) liste.push([s, f]);
    return liste;
  }

  const durch = (st) => st.schafe.every((s) => zeile(s) <= zeile(st.wolf));

  // Nach einem Zug: wer gewonnen hat (die Art), oder null. naechste: wer
  // jetzt zieht.
  function ausgang(st, naechste) {
    if (durch(st)) return "wolf";
    if (!zuegeVon(st, naechste).length) return naechste === "wolf" ? "schafe" : "wolf";
    return null;
  }

  function zieh(st, [von, nach]) {
    if (st.wolf === von) return { schafe: st.schafe, wolf: nach };
    return { schafe: st.schafe.map((s) => (s === von ? nach : s)).sort((a, b) => a - b), wolf: st.wolf };
  }

  // --- Die Regeln -----------------------------------------------------------------
  function lage(zuege, { beginnt }) {
    const r = rollen(beginnt);
    let st = { schafe: [...SCHAFE_START], wolf: WOLF_START };
    let art = "schafe";
    let ende = null;
    let sieger = null;
    let letzter = null;
    for (const z of zuege) {
      const m = /^(\d{1,2})-(\d{1,2})$/.exec(z);
      const zug = m ? [Number(m[1]), Number(m[2])] : null;
      if (ende || !zug || !zuegeVon(st, art).some(([a, b]) => a === zug[0] && b === zug[1])) {
        return { ...st, art, rollen: r, dran: null, ende: ende || null, kaputt: true, letzter, sieger, zahl: zuege.length };
      }
      st = zieh(st, zug);
      letzter = { von: zug[0], nach: zug[1], art };
      art = art === "schafe" ? "wolf" : "schafe";
      sieger = ausgang(st, art);
      if (sieger) ende = r[sieger];
    }
    if (!zuege.length) {
      sieger = ausgang(st, art);
      if (sieger) ende = r[sieger];
    }
    return {
      ...st,
      art,
      rollen: r,
      dran: ende ? null : r[art],
      ende,
      sieger,
      durch: sieger === "wolf" && durch(st),
      letzter,
      zahl: zuege.length,
    };
  }

  const darf = (l, z, sitz) => {
    if (l.dran !== sitz || l.ende) return false;
    const m = /^(\d{1,2})-(\d{1,2})$/.exec(z);
    if (!m || String(Number(m[1])) !== m[1] || String(Number(m[2])) !== m[2]) return false;
    return zuegeVon(l, l.art).some(([a, b]) => a === Number(m[1]) && b === Number(m[2]));
  };

  // --- Der Computer -------------------------------------------------------------
  const zufall = (liste) => liste[Math.floor(Math.random() * liste.length)];

  // Was der Wolf erreichen kann, wenn die Schafe stillstehen: ob er so
  // durchkommt (und in wie vielen Schritten), und wie viele Felder er hat.
  function wolfRaum(st) {
    const besetzt = new Set(st.schafe);
    const unterste = Math.max(...st.schafe.map(zeile));
    const gesehen = new Map([[st.wolf, 0]]);
    const schlange = [st.wolf];
    let weg = 99;
    for (let i = 0; i < schlange.length; i += 1) {
      const f = schlange[i];
      const d = gesehen.get(f);
      if (zeile(f) >= unterste && weg === 99) weg = d;
      for (const n of nachbarn(f, false)) {
        if (besetzt.has(n) || gesehen.has(n)) continue;
        gesehen.set(n, d + 1);
        schlange.push(n);
      }
    }
    return { weg, felder: gesehen.size };
  }
  const wolfWeg = (st) => wolfRaum(st).weg;

  // Wert für die Schafe (der Wolf will ihn klein): Kommt der Wolf durch,
  // zählt, wie weit er noch hat. Kommt er nicht durch, ist es gut – umso
  // besser, je weniger Felder ihm bleiben. Dazu: die Schafe in einer
  // geschlossenen Reihe (wenig Unterschied in der Höhe).
  function wertSchafe(st) {
    const { weg, felder } = wolfRaum(st);
    const hoehen = st.schafe.map(zeile);
    const reihe = Math.max(...hoehen) - Math.min(...hoehen);
    if (weg >= 99) return 1000 - felder * 8 - reihe * 3;
    return weg * 25 - reihe * 6 - felder;
  }

  const SIEG = 100000;
  const schluessel = (st, art) => `${st.schafe.join(",")}|${st.wolf}|${art}`;

  // Minimax mit Alpha-Beta und Gedächtnis (je Zug des Computers). Züge, die
  // gleich gut aussehen, zuerst – dann schneidet die Suche früh ab.
  function suche(st, art, tiefe, alpha, beta, merk) {
    if (durch(st)) return -SIEG - tiefe;
    const zuege = zuegeVon(st, art);
    if (!zuege.length) return art === "wolf" ? SIEG + tiefe : -SIEG - tiefe;
    if (tiefe === 0) return wertSchafe(st);
    const k = schluessel(st, art);
    const da = merk.get(k);
    if (da && da.tiefe >= tiefe) {
      if (da.art === 0) return da.wert;
      if (da.art === 1 && da.wert >= beta) return da.wert;
      if (da.art === -1 && da.wert <= alpha) return da.wert;
    }
    const a0 = alpha; const b0 = beta;
    const naechste = art === "schafe" ? "wolf" : "schafe";
    const kinder = zuege.map((zug) => { const neu = zieh(st, zug); return { neu, vor: durch(neu) ? -SIEG : wertSchafe(neu) }; });
    kinder.sort((x, y) => (art === "schafe" ? y.vor - x.vor : x.vor - y.vor));
    let best = art === "schafe" ? -Infinity : Infinity;
    for (const { neu } of kinder) {
      const w = suche(neu, naechste, tiefe - 1, alpha, beta, merk);
      if (art === "schafe") { if (w > best) best = w; if (best > alpha) alpha = best; } else { if (w < best) best = w; if (best < beta) beta = best; }
      if (alpha >= beta) break;
    }
    merk.set(k, { tiefe, wert: best, art: best <= a0 ? -1 : best >= b0 ? 1 : 0 });
    return best;
  }

  function besteZuege(st, art, tiefe) {
    const merk = new Map();
    const naechste = art === "schafe" ? "wolf" : "schafe";
    let best = art === "schafe" ? -Infinity : Infinity;
    let beste = [];
    for (const zug of zuegeVon(st, art)) {
      const w = suche(zieh(st, zug), naechste, tiefe - 1, -Infinity, Infinity, merk);
      const besser = art === "schafe" ? w > best : w < best;
      if (besser) { best = w; beste = [zug]; } else if (w === best) beste.push(zug);
    }
    return beste;
  }

  function computer(l, sitz, stufe) {
    const art = l.rollen.schafe === sitz ? "schafe" : "wolf";
    const st = { schafe: l.schafe, wolf: l.wolf };
    const zuege = zuegeVon(st, art);
    if (!zuege.length) return null;
    let zug;
    if (stufe === "leicht") {
      // Als Wolf trödelt er: meist zurück nach oben, selten zu den Schafen.
      const zurueck = art === "wolf" ? zuege.filter(([, b]) => zeile(b) < zeile(l.wolf)) : [];
      zug = zurueck.length && Math.random() < 0.65 ? zufall(zurueck) : zufall(zuege);
    }
    else if (stufe === "einfach") zug = Math.random() < 0.4 ? zufall(zuege) : zufall(besteZuege(st, art, 1));
    else if (stufe === "mittel") zug = Math.random() < 0.12 ? zufall(zuege) : zufall(besteZuege(st, art, 4));
    else zug = zufall(besteZuege(st, art, art === "schafe" ? 10 : 8));
    return `${zug[0]}-${zug[1]}`;
  }

  // --- Was über dem Brett steht ---------------------------------------------------
  function satz(l, { ich, name, modus }) {
    if (l.ende || !l.dran || l.zahl > 1 || l.dran !== ich) return null;
    // Zu Beginn: wer welche Rolle hat (das Ende sagt der Rahmen).
    const von = modus === "computer" ? "des Computers" : `von ${name(anderer(ich))}`;
    return l.art === "schafe"
      ? { text: `Du beginnst mit den Schafen \u{1F411} – sperr den Wolf ${von} ein!`, sitz: ich }
      : { text: `Du bist der Wolf \u{1F43A} – brich durch die Schafe ${von}!`, sitz: ich };
  }

  // --- Das Bild -------------------------------------------------------------------
  function figur(art, klasse = "") {
    const f = el("span", `zw-ws-figur ist-${art} ${klasse}`.trim(), art === "wolf" ? "\u{1F43A}" : "\u{1F411}");
    f.setAttribute("aria-hidden", "true");
    return f;
  }

  function held() {
    const bild = el("div", "zw-ws-held");
    for (let r = 0; r < 4; r += 1) for (let c = 0; c < 4; c += 1) {
      const f = el("span", `zw-ws-held-feld${(r + c) % 2 ? " ist-dunkel" : ""}`);
      if (r === 0 && c === 1) f.append(figur("wolf"));
      if (r === 3 && (c === 0 || c === 2)) f.append(figur("schaf"));
      if (r === 2 && c === 3) f.append(figur("schaf"));
      bild.append(f);
    }
    return bild;
  }

  function brett({ zug, ton }) {
    const knoten = el("div", "vr-feld zw-ws");
    knoten.dataset.zuege = "0";
    const gitter = el("div", "zw-ws-gitter");
    gitter.setAttribute("role", "group");
    gitter.setAttribute("aria-label", "Das Brett");
    const felder = [];
    for (let f = 0; f < 64; f += 1) {
      const k = el("button", `zw-ws-feld${dunkel(f) ? " ist-dunkel" : ""}`);
      k.type = "button";
      k.dataset.feld = String(f);
      if (!dunkel(f)) { k.disabled = true; k.tabIndex = -1; k.setAttribute("aria-hidden", "true"); }
      k.addEventListener("click", () => tipp(f));
      felder.push(k);
      gitter.append(k);
    }
    knoten.append(gitter);

    let auswahl = null;
    let letzte = null;
    let gezeigt = { nr: -1, roh: null };

    function meine(l, ich) {
      if (!ich || l.dran !== ich || l.ende) return null;
      return l.art;
    }

    function tipp(f) {
      if (!letzte) return;
      const { lage: l, ich, aus } = letzte;
      const art = aus ? null : meine(l, ich);
      if (!art) return;
      const zuege = zuegeVon(l, art);
      // Ein Ziel der gewählten Figur: ziehen.
      if (auswahl !== null && zuege.some(([a, b]) => a === auswahl && b === f)) {
        const von = auswahl;
        auswahl = null;
        zug(`${von}-${f}`);
        return;
      }
      // Eine eigene Figur, die ziehen kann: wählen (oder abwählen).
      if (zuege.some(([a]) => a === f)) {
        auswahl = auswahl === f ? null : f;
        zeichneAuswahl();
        return;
      }
      // Ein Ziel, zu dem nur eine eigene Figur kann: gleich ziehen.
      const hin = zuege.filter(([, b]) => b === f);
      if (hin.length === 1) {
        auswahl = null;
        zug(`${hin[0][0]}-${hin[0][1]}`);
      }
    }

    function zeichneAuswahl() {
      if (!letzte) return;
      const { lage: l, ich, aus } = letzte;
      const art = aus ? null : meine(l, ich);
      const zuege = art ? zuegeVon(l, art) : [];
      // Der Wolf hat nur eine Figur: Sie ist immer gewählt.
      if (art === "wolf") auswahl = l.wolf;
      if (auswahl !== null && !zuege.some(([a]) => a === auswahl)) auswahl = null;
      const ziele = new Set(zuege.filter(([a]) => a === auswahl).map(([, b]) => b));
      const kann = new Set(zuege.map(([a]) => a));
      felder.forEach((k, f) => {
        if (!dunkel(f)) return;
        k.classList.toggle("ist-gewaehlt", f === auswahl);
        k.classList.toggle("ist-ziel", ziele.has(f));
        k.classList.toggle("ist-kann", kann.has(f) && f !== auswahl);
        k.disabled = !(ziele.has(f) || kann.has(f) || zuege.some(([, b]) => b === f));
      });
      knoten.classList.toggle("ist-dran", Boolean(art));
    }

    function zeichne(args) {
      letzte = args;
      const { lage: l, roh = "", nr, ich, namen } = args;
      // Wer den Wolf hat, sieht das Brett gedreht: die eigene Figur unten.
      const gedreht = Boolean(ich && l.rollen.wolf === ich);
      knoten.classList.toggle("ist-gedreht", gedreht);
      const neuePartie = nr !== gezeigt.nr || gezeigt.roh === null || !(roh === gezeigt.roh || gezeigt.roh === "" || roh.startsWith(`${gezeigt.roh}.`));
      if (neuePartie) auswahl = null;
      const neu = !neuePartie && roh !== gezeigt.roh;
      const schafe = new Set(l.schafe);
      felder.forEach((k, f) => {
        if (!dunkel(f)) return;
        const art = f === l.wolf ? "wolf" : schafe.has(f) ? "schaf" : "";
        const da = k.querySelector(".zw-ws-figur");
        if (!art) { da?.remove(); } else if (!da || !da.classList.contains(`ist-${art}`)) {
          da?.remove();
          k.append(figur(art, neu && l.letzter?.nach === f ? "ist-neu" : ""));
        } else if (neu && l.letzter?.nach === f) {
          da.classList.remove("ist-neu");
          void da.offsetWidth;
          da.classList.add("ist-neu");
        }
        const wem = art === "wolf" ? l.rollen.wolf : art ? l.rollen.schafe : "";
        k.classList.toggle("ist-a", wem === "a");
        k.classList.toggle("ist-b", wem === "b");
        k.classList.toggle("ist-von", Boolean(l.letzter && l.letzter.von === f));
        k.classList.toggle("ist-nach", Boolean(l.letzter && l.letzter.nach === f));
        k.classList.toggle("ist-gefangen", Boolean(l.ende && l.sieger === "schafe" && f === l.wolf));
        k.classList.toggle("ist-sieger", Boolean(l.ende && l.sieger === "wolf" && f === l.wolf));
        const name = (s) => (namen?.[s] || s);
        k.setAttribute("aria-label", `Feld ${"abcdefgh"[spalte(f)]}${8 - zeile(f)}${art ? `, ${art === "wolf" ? "Wolf" : "Schaf"} von ${name(wem)}` : ", frei"}`);
      });
      if (neu) ton("klack");
      gezeigt = { nr, roh };
      knoten.dataset.zuege = String(l.zahl);
      knoten.classList.toggle("ist-aus", Boolean(l.ende));
      zeichneAuswahl();
    }

    return {
      knoten,
      zeichne,
      fokus: () => (felder.find((k) => !k.disabled) || felder[1]).focus({ preventScroll: true }),
    };
  }

  Z.starte({
    id: "wolf",
    titel: "Wolf und Schafe",
    seite: "wolf",
    unter: "Vier Schafe gegen einen Wolf. Die Schafe gehen nur vorwärts und wollen den Wolf einsperren, der Wolf will an ihnen vorbei. Jede Partie wechseln die Rollen.",
    held,
    trenner: ".",
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Zum Lernen" },
      einfach: { name: "Einfach", sterne: 1, satz: "Zum Warmwerden" },
      mittel: { name: "Mittel", sterne: 2, satz: "Eine echte Aufgabe" },
      schwer: { name: "Schwer", sterne: 3, satz: "Als Schafe kaum zu schlagen" },
    },
    texte: { start: "tippe auf eine Figur und dann auf ihr Ziel", remis: "Unentschieden." },
    lage,
    darf,
    brett,
    computer,
    satz,
    vorlesen: (b) => {
      const l = b.lage;
      const n = (s) => b.namen?.[s] || s;
      return `${n(l.rollen.schafe)} hat die Schafe, ${n(l.rollen.wolf)} den Wolf.`;
    },
    fuerPruefung: { zuegeVon, wolfWeg, SCHAFE_START, WOLF_START, rollen },
  });
})();
