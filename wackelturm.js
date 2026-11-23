/*
 * wackelturm.js – Wackelturm zu zweit: zusammen hoch hinaus.
 * ---------------------------------------------------------------------------
 * Die Seite /wackelturm. Ein Spiel miteinander (gemeinsam): Abwechselnd
 * lässt jede einen Klotz auf den Turm fallen. Der Klotz schwingt über dem
 * Turm hin und her; ein Tipp lässt ihn fallen. Erreicht der Turm die
 * Zielhöhe, ist es geschafft; kippt er, ist es vorbei.
 *
 * Ob er kippt, ist reine Rechnung, kein Zufall – beide Geräte rechnen
 * gleich: Für jeden Klotz muss der Schwerpunkt von ihm und allem, was auf
 * ihm liegt, über dem Klotz darunter liegen (über der Platte, ganz unten),
 * und jeder Klotz muss den darunter berühren.
 *
 * Wie breit die Klötze sind, kommt aus der Saat der Partie. Gegen den
 * Computer ist er der Partner; die Stufe macht die Klötze schmaler, das
 * Schwingen schneller und den Turm höher.
 *
 * Ein Zug: «D512» – der Klotz fällt mit seiner Mitte bei 512 (die Welt ist
 * 1000 breit). Durch Punkte getrennt.
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "wackelturm") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  const HOEHE = 70;           // ein Klotz, in Welt-Einheiten (die Welt ist 1000 breit)
  const PLATTE = { mitte: 500, breite: 420 };
  // Ziel, Breiten der Klötze, Schwingen (eine Runde in ms), Spielraum des
  // Schwingens um die Turmspitze.
  const ARTEN = {
    leicht: { ziel: 7, breiten: [280, 320, 360], runde: 3600, weit: 220 },
    einfach: { ziel: 9, breiten: [240, 280, 320], runde: 3000, weit: 260 },
    mittel: { ziel: 11, breiten: [200, 240, 280, 320], runde: 2500, weit: 300 },
    schwer: { ziel: 14, breiten: [160, 200, 240, 280], runde: 2000, weit: 340 },
  };
  const DUELL = { ziel: 10, breiten: [220, 260, 300, 340], runde: 2800, weit: 280 };

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
  // Die Breiten der Klötze einer Partie.
  function breiten(saat, art) {
    const rnd = wuerfel((Number(saat) ^ 0x70e) >>> 0);
    return Array.from({ length: art.ziel }, () => art.breiten[Math.floor(rnd() * art.breiten.length)]);
  }

  // Hält der Turm? Für jeden Klotz (von oben nach unten): der Schwerpunkt
  // von ihm und allem darüber muss über dem Klotz darunter liegen. Zurück
  // kommt, ob er hält, und wie knapp (0 = mitten drauf, 1 = an der Kante).
  function haelt(kloetze) {
    let knapp = 0;
    for (let i = 1; i < kloetze.length; i += 1) {
      const unten = kloetze[i - 1]; const oben = kloetze[i];
      if (Math.abs(oben.x - unten.x) >= (oben.b + unten.b) / 2) return { haelt: false, knapp: 1, wo: i };
    }
    for (let j = kloetze.length - 1; j >= 0; j -= 1) {
      let masse = 0; let moment = 0;
      for (let i = j; i < kloetze.length; i += 1) { masse += kloetze[i].b; moment += kloetze[i].b * kloetze[i].x; }
      const sp = moment / masse;
      const trag = j === 0 ? PLATTE : { mitte: kloetze[j - 1].x, breite: kloetze[j - 1].b };
      const abstand = Math.abs(sp - trag.mitte) / (trag.breite / 2);
      if (abstand > 1) return { haelt: false, knapp: 1, wo: j, kippt: Math.sign(sp - trag.mitte) };
      knapp = Math.max(knapp, abstand);
    }
    return { haelt: true, knapp };
  }

  // --- Die Regeln -----------------------------------------------------------------
  function lage(zuege, { beginnt, saat, stufe }) {
    const art = ARTEN[stufe] || DUELL;
    const b = breiten(saat, art);
    const kloetze = [];
    let dran = beginnt;
    let ende = null;
    let kipp = null;
    let knapp = 0;
    for (const z of zuege) {
      const m = /^D(\d{1,4})$/.exec(z);
      const x = m ? Number(m[1]) : -1;
      if (!m || ende || x > 1000) return { art, kloetze, dran: null, ende, kaputt: true, naechste: b[kloetze.length] || 0, knapp };
      kloetze.push({ x, b: b[kloetze.length], von: dran });
      const h = haelt(kloetze);
      knapp = h.knapp;
      if (!h.haelt) { ende = "v"; kipp = h; } else if (kloetze.length >= art.ziel) ende = "g";
      dran = anderer(dran);
    }
    return { art, kloetze, dran: ende ? null : dran, ende, kipp, knapp, naechste: b[kloetze.length] || 0, hoehe: HOEHE };
  }

  const darf = (l, zug, sitz) => l.dran === sitz && /^D(\d{1,4})$/.test(zug) && Number(zug.slice(1)) <= 1000;

  // --- Der Computer (als Partner) -------------------------------------------------
  // Er zielt so, dass der Schwerpunkt wieder zur Mitte rückt – und trifft
  // ein bisschen daneben.
  function computer(l, sitz) {
    if (l.dran !== sitz) return null;
    const k = l.kloetze;
    const oben = k[k.length - 1] || { x: PLATTE.mitte, b: PLATTE.breite };
    let masse = l.naechste; let moment = 0;
    for (const s of k) { masse += s.b; moment += s.b * s.x; }
    // Wo müsste der neue Klotz liegen, damit alles über der Platten-Mitte steht?
    const ideal = (PLATTE.mitte * masse - moment) / l.naechste;
    const spiel = oben.b / 3;
    const ziel = Math.max(oben.x - spiel, Math.min(oben.x + spiel, ideal));
    const streu = (Math.random() + Math.random() + Math.random() - 1.5) * 18;
    return { zug: `D${Math.round(Math.max(0, Math.min(1000, ziel + streu)))}`, warte: 900 + Math.random() * 500 };
  }

  // --- Was über dem Turm steht ------------------------------------------------------
  function satz(l, { ich, name, modus }) {
    if (l.ende) return null;
    const er = (sitz) => (sitz === ich ? "Du" : modus === "computer" ? "Der Computer" : name(sitz));
    const noch = l.art.ziel - l.kloetze.length;
    const wackel = l.kloetze.length && l.knapp > 0.7 ? "Uiii, das wackelt! " : "";
    if (!l.kloetze.length) {
      if (l.dran === ich) return { text: "Du beginnst – tippe, um den Klotz fallen zu lassen!", sitz: ich };
      return { text: modus === "computer" ? "Der Computer beginnt" : `${name(l.dran)} ist dran`, sitz: l.dran };
    }
    if (l.dran === ich) return { text: `${wackel}Du bist dran – noch ${noch} ${noch === 1 ? "Klotz" : "Klötze"}!`, sitz: ich };
    return { text: `${wackel}${er(l.dran)} ist dran – noch ${noch}`, sitz: l.dran };
  }

  // --- Das Bild -------------------------------------------------------------------
  function held() {
    const bild = el("div", "zw-wt-held");
    [[0, 0, 70, "a"], [1, 8, 56, "b"], [2, -6, 62, "a"], [3, 10, 48, "b"]].forEach(([i, x, b, sitz]) => {
      const k = el("span", `zw-wt-held-klotz ist-${sitz}`);
      k.style.setProperty("--i", String(i));
      k.style.setProperty("--x", String(x));
      k.style.setProperty("--b", String(b));
      bild.append(k);
    });
    return bild;
  }

  function brett({ zug, ton, knopf, ruhig }) {
    const knoten = el("div", "zw-wt");
    const kopf = el("div", "zw-wt-kopf");
    const hoehe = el("span", "zw-wt-hoehe");
    kopf.append(hoehe);
    const himmel = el("div", "zw-wt-himmel");
    const welt = el("div", "zw-wt-welt");
    const turm = el("div", "zw-wt-turm");
    const platte = el("div", "zw-wt-platte");
    const zielLinie = el("div", "zw-wt-ziel");
    const schwinger = el("div", "zw-wt-klotz ist-schwinger");
    welt.append(zielLinie, turm, platte, schwinger);
    himmel.append(welt);
    himmel.addEventListener("pointerdown", (e) => { e.preventDefault(); fallen(); });
    const los = knopf("Fallen lassen!", "mini-knopf mini-knopf-voll vr-los zw-wt-los", () => fallen());
    knoten.append(kopf, himmel, los);

    let jetzt = null;
    let start = performance.now();
    let rahmen = 0;
    let xJetzt = 500;
    let gezeigt = -1;
    const klotzKnoten = [];

    const meinZug = () => Boolean(jetzt && !jetzt.aus && jetzt.ich && jetzt.lage.dran === jetzt.ich);

    function fallen() {
      if (!meinZug()) return;
      ton("tipp");
      zug(`D${Math.round(xJetzt)}`);
    }

    // Wo der schwingende Klotz gerade ist: über der Turmspitze hin und her.
    function schwingen(t) {
      const b = jetzt;
      if (!b) return;
      const l = b.lage;
      const oben = l.kloetze[l.kloetze.length - 1];
      const mitte = oben ? oben.x : PLATTE.mitte;
      const phase = ((t - start) % l.art.runde) / l.art.runde;
      xJetzt = Math.max(l.naechste / 2, Math.min(1000 - l.naechste / 2, mitte + Math.sin(phase * 2 * Math.PI) * l.art.weit));
      schwinger.style.setProperty("--x", xJetzt.toFixed(1));
      rahmen = window.requestAnimationFrame(schwingen);
    }

    function zeichne(b) {
      if (!b) return;
      const vorher = jetzt;
      jetzt = b;
      const l = b.lage;
      const neuePartie = !vorher || vorher.nr !== b.nr || l.kloetze.length < klotzKnoten.length;
      if (neuePartie) { klotzKnoten.splice(0).forEach((k) => k.remove()); start = performance.now(); knoten.classList.remove("ist-gekippt"); }
      // Die Klötze: Neue fallen von oben herein.
      l.kloetze.forEach((k, i) => {
        let n = klotzKnoten[i];
        if (!n) {
          n = el("div", `zw-wt-klotz ist-${k.von}`);
          turm.append(n);
          klotzKnoten.push(n);
          if (!neuePartie && !ruhig()) n.classList.add("ist-neu");
        }
        n.style.setProperty("--x", String(k.x));
        n.style.setProperty("--b", String(k.b));
        n.style.setProperty("--i", String(i));
      });
      welt.style.setProperty("--n", String(l.kloetze.length));
      welt.style.setProperty("--ziel", String(l.art.ziel));
      // Wackeln: der Turm neigt sich, je knapper es steht.
      turm.style.setProperty("--neigung", `${(l.ende === "v" ? 0 : (l.knapp || 0) * 1.6).toFixed(2)}deg`);
      if (l.ende === "v" && l.kipp) {
        knoten.classList.add("ist-gekippt");
        turm.style.setProperty("--kippt", String(l.kipp.kippt || 1));
      }
      // Der schwingende Klotz: nur, solange gespielt wird.
      const spielt = !l.ende;
      schwinger.hidden = !spielt;
      schwinger.className = `zw-wt-klotz ist-schwinger ist-${l.dran || "a"}`;
      schwinger.style.setProperty("--b", String(l.naechste || 0));
      schwinger.style.setProperty("--i", String(l.kloetze.length + 2.2));
      window.cancelAnimationFrame(rahmen);
      if (spielt) rahmen = window.requestAnimationFrame(schwingen);
      hoehe.textContent = `${l.kloetze.length} von ${l.art.ziel} Klötzen`;
      los.disabled = !meinZug();
      los.hidden = Boolean(l.ende);
      knoten.classList.toggle("ist-dran", meinZug());
      if (gezeigt >= 0 && l.kloetze.length > gezeigt) {
        if (l.ende === "v") window.setTimeout(() => ton("platsch"), 250);
        else ton("klack");
      }
      gezeigt = l.kloetze.length;
    }

    return {
      knoten,
      zeichne,
      fokus: () => los.focus({ preventScroll: true }),
    };
  }

  Z.starte({
    id: "wackelturm",
    titel: "Wackelturm zu zweit",
    seite: "wackelturm",
    unter: "Zusammen! Abwechselnd lasst ihr einen Klotz auf den Turm fallen – tippt im richtigen Moment. Kippt er, ist es vorbei; erreicht er die Wolke, habt ihr es geschafft.",
    held,
    trenner: ".",
    gemeinsam: true,
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Breite Klötze, sieben hoch" },
      einfach: { name: "Einfach", sterne: 1, satz: "Neun hoch" },
      mittel: { name: "Mittel", sterne: 2, satz: "Schmaler, elf hoch" },
      schwer: { name: "Schwer", sterne: 3, satz: "Schmal, schnell, vierzehn hoch" },
    },
    texte: { start: "tippe, um den Klotz fallen zu lassen", geschafft: "Geschafft – der Turm steht bis zur Wolke!", verpasst: "Oh nein – der Turm ist umgekippt." },
    lage,
    darf,
    brett,
    computer,
    // Was der Lautsprecher beim Satz noch vorliest: wie hoch der Turm ist.
    vorlesen: (b) => `${b.lage.kloetze.length} von ${b.lage.art.ziel} Klötzen`,
    satz,
    neuePartie: () => ({ saat: Math.floor(Math.random() * 4294967295) }),
    // Für die Prüfung: ob ein Turm hält.
    fuerPruefung: { haelt, PLATTE },
  });
})();
