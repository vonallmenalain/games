/*
 * raumschiff.js – Raumschiff-Crew: zusammen durchs All zum Planeten.
 * ---------------------------------------------------------------------------
 * Die Seite /raumschiff. Ein Spiel miteinander, in Echtzeit (echtzeit.js).
 * Das Raumschiff fliegt von selbst nach rechts, auf drei Bahnen (oben,
 * Mitte, unten). Zwei Aufgaben an Bord:
 *
 *   Die Pilotin steuert ▲ ▼ – an den Asteroiden vorbei (sie liegen auf
 *   einer oder zwei Bahnen), und wenn es geht, durch die Sterne.
 *
 *   Die Schild-Chefin schaltet den Schild ein, wenn ein Meteorschauer
 *   kommt: Er reicht über alle drei Bahnen, ausweichen geht nicht. Der
 *   Schild hält kurz und muss dann laden.
 *
 * Wer die Partie beginnt, steuert; die andere hat den Schild. Ein Treffer
 * kostet ein Herz (von dreien). Erreicht das Schiff den Planeten mit
 * mindestens einem Herz, ist es geschafft.
 *
 * Wie lang der Flug ist und wie dicht die Steine kommen, hängt an der Stufe
 * (gegen den Computer) oder, zu zweit, der wievielten Partie. Gerechnet wird
 * in Ticks zu 100 ms, mit ganzen Zahlen – jedes Gerät gleich.
 *
 * Ein Zug ist «S» (Los!), «a37:U» / «a37:D» (eine Bahn hoch / runter),
 * «b52:S» (Schild an) oder «E412» (bei Tick 412 ist es aus).
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "raumschiff") return;

  const Z = window.LernappZwei;
  const E = window.LernappEchtzeit;
  if (!Z || !E) return;
  const el = Z.el;

  const HERZEN = 3;
  const MAX_TICK = 3000;
  const BAHNEN = 3;
  const STUFE_GRAD = { leicht: 0, einfach: 1, mittel: 2, schwer: 3 };
  // Der Schild: so lange an, danach so lange laden (Ticks).
  const DAUER = 14;
  const LADEN = 26;
  // Wie weit man voraus sieht (Zehntel), und wo das Schiff steht (in %).
  const SICHT = 620;
  const SCHIFF_X = 16;
  // Je Grad: Länge, Tempo (Zehntel je Tick), Abstand der Hindernisse, wie
  // oft zwei Bahnen zu sind, jedes wievielte Hindernis ein Meteorschauer.
  const GRADE = [
    { laenge: 4200, tempo: 8, abstand: 400, doppelt: 0, schauer: 4 },
    { laenge: 5000, tempo: 9, abstand: 350, doppelt: 0.35, schauer: 4 },
    { laenge: 5800, tempo: 10, abstand: 310, doppelt: 0.5, schauer: 3 },
    { laenge: 6600, tempo: 11, abstand: 280, doppelt: 0.6, schauer: 3 },
  ];

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
  const gradVon = (saat, stufe) => (stufe && STUFE_GRAD[stufe] !== undefined ? STUFE_GRAD[stufe] : Math.min(3, (Number(saat) >>> 29) & 3));
  const anderer = (s) => (s === "a" ? "b" : "a");
  // Wer steuert: wer beginnt. Die andere hat den Schild.
  const pilotin = (beginnt) => beginnt;

  // Der Flugplan: Asteroiden (eine oder zwei Bahnen), Meteorschauer (alle
  // Bahnen), Sterne dazwischen. Ohne Steuern und Schild träfe das Schiff
  // mindestens dreimal etwas – sonst wäre es kein Spiel.
  function planVon(saat, stufe) {
    const grad = gradVon(saat, stufe);
    const g = GRADE[grad];
    const rnd = wuerfel(((Number(saat) >>> 0) ^ 0x3c51) >>> 0);
    const objekte = [];
    let d = 520;
    let k = 0;
    let letzterSchauer = -1e9;
    while (d < g.laenge - 300) {
      if (k % g.schauer === g.schauer - 1 && d - letzterSchauer >= 760) {
        objekte.push({ art: "M", d });
        letzterSchauer = d;
      } else if (rnd() < g.doppelt) {
        const frei = Math.floor(rnd() * BAHNEN);
        objekte.push({ art: "A", d, bahnen: [0, 1, 2].filter((b) => b !== frei) });
      } else {
        objekte.push({ art: "A", d, bahnen: [Math.floor(rnd() * BAHNEN)] });
      }
      if (rnd() < 0.75) objekte.push({ art: "*", d: d + Math.floor(g.abstand / 2), bahn: Math.floor(rnd() * BAHNEN) });
      d += g.abstand + Math.floor(rnd() * 60);
      k += 1;
    }
    // Mindestens drei Treffer, wenn niemand etwas tut (das Schiff bleibt in
    // der Mitte).
    let treffer = objekte.filter((o) => o.art === "M" || (o.art === "A" && o.bahnen.includes(1))).length;
    for (const o of objekte) {
      if (treffer >= 3) break;
      if (o.art === "A" && !o.bahnen.includes(1)) { o.bahnen = o.bahnen.length === 2 ? [0, 1] : [1]; treffer += 1; }
    }
    objekte.sort((x, y) => x.d - y.d);
    return { grad, tempo: g.tempo, laenge: g.laenge, objekte };
  }

  // --- Die Simulation (nur ganze Zahlen) ---------------------------------------
  function start() {
    return {
      tick: -1, d: 0, bahn: 1, bewegt: -9,
      schild: { an: -99, bis: -99, bereit: 0 },
      herzen: HERZEN, sterne: 0, abgewehrt: 0,
      getroffen: [], gesammelt: [], abgeprallt: [], naechstes: 0,
      ende: null, endTick: null,
    };
  }

  function aktion(s, art, n) {
    if (art === "U") { s.bahn = Math.max(0, s.bahn - 1); s.bewegt = n; }
    else if (art === "D") { s.bahn = Math.min(BAHNEN - 1, s.bahn + 1); s.bewegt = n; }
    else if (art === "S" && n >= s.schild.bereit) s.schild = { an: n, bis: n + DAUER - 1, bereit: n + DAUER + LADEN };
  }

  const schildAn = (s, t = s.tick) => t >= s.schild.an && t <= s.schild.bis;

  function schritt(s, plan) {
    s.tick += 1;
    s.d += plan.tempo;
    while (s.naechstes < plan.objekte.length && plan.objekte[s.naechstes].d <= s.d) {
      const i = s.naechstes;
      const o = plan.objekte[i];
      s.naechstes += 1;
      if (o.art === "*") { if (o.bahn === s.bahn) { s.sterne += 1; s.gesammelt.push(i); } continue; }
      if (o.art === "A" && !o.bahnen.includes(s.bahn)) continue;
      if (schildAn(s)) { s.abgewehrt += 1; s.abgeprallt.push(i); continue; }
      s.herzen -= 1;
      s.getroffen.push(i);
    }
    if (!s.ende && s.herzen <= 0) { s.ende = "v"; s.endTick = s.tick; }
    else if (!s.ende && s.d >= plan.laenge) { s.ende = "g"; s.endTick = s.tick; }
  }

  function simulator(plan, aktionen) {
    const s = start();
    let i = 0;
    return {
      s,
      bis(t) {
        while (s.tick < t && !s.ende) {
          const n = s.tick + 1;
          while (i < aktionen.length && aktionen[i].tick <= n) { aktion(s, aktionen[i].art, n); i += 1; }
          schritt(s, plan);
        }
        return s;
      },
    };
  }
  const simuliere = (plan, aktionen, bis) => simulator(plan, aktionen).bis(bis);

  // --- Was eine gute Crew tut ---------------------------------------------------
  // Die Pilotin: Liegt auf ihrer Bahn bald ein Asteroid, auf die nächste
  // freie Bahn; sonst, wenn es sicher ist, zum nächsten Stern. Eine Bahn
  // je zwei Ticks.
  function pilotWill(plan, s, { vorsicht = 12 } = {}) {
    if (s.tick + 1 - s.bewegt < 2) return null;
    const vor = plan.objekte.slice(s.naechstes);
    const stein = vor.find((o) => o.art === "A" && o.d - s.d <= plan.tempo * vorsicht);
    let ziel = s.bahn;
    if (stein && stein.bahnen.includes(s.bahn)) {
      const frei = [0, 1, 2].filter((b) => !stein.bahnen.includes(b));
      frei.sort((x, y) => Math.abs(x - s.bahn) - Math.abs(y - s.bahn) || Math.abs(x - 1) - Math.abs(y - 1));
      ziel = frei[0];
    } else if (!stein) {
      const stern = vor.find((o) => o.art === "*" && o.d - s.d <= plan.tempo * 16);
      const naechsterStein = vor.find((o) => o.art === "A");
      if (stern && (!naechsterStein || naechsterStein.d > stern.d || !naechsterStein.bahnen.includes(stern.bahn))) ziel = stern.bahn;
    } else {
      return null;
    }
    if (ziel === s.bahn) return null;
    return ziel < s.bahn ? "U" : "D";
  }

  // Die Schild-Chefin: Kommt ein Meteorschauer in den nächsten Ticks und
  // ist der Schild geladen, schaltet sie ihn ein.
  function schildWill(plan, s) {
    const n = s.tick + 1;
    if (n < s.schild.bereit || schildAn(s, n)) return null;
    const schauer = plan.objekte.slice(s.naechstes).find((o) => o.art === "M");
    if (!schauer) return null;
    const ticks = Math.ceil((schauer.d - s.d) / plan.tempo);
    return ticks <= 6 ? "S" : null;
  }

  const was = (plan, s, rolle) => (rolle === "pilot" ? pilotWill(plan, s) : schildWill(plan, s));
  const rolleVon = (sitz, beginnt) => (sitz === pilotin(beginnt) ? "pilot" : "schild");

  // --- Die Regeln -----------------------------------------------------------------
  const gueltigFuer = (beginnt) => (wer, art) => ((art === "U" || art === "D") ? wer === pilotin(beginnt) : art === "S" ? wer !== pilotin(beginnt) : false);

  function lage(zuege, { saat, stufe, beginnt = "a" }) {
    const plan = planVon(saat, stufe);
    const z = E.lese(zuege, { aktionGueltig: gueltigFuer(beginnt), maxTick: MAX_TICK });
    const grund = { plan, beginnt, zahl: zuege.length, aktionen: z.aktionen, letzter: z.letzter, gestartet: z.gestartet };
    if (z.kaputt) return { ...grund, phase: "flug", dran: null, ende: null, kaputt: true, stand: simuliere(plan, z.aktionen, Math.max(0, z.letzterTick)) };
    if (!z.gestartet) return { ...grund, phase: "bereit", dran: "beide", ende: null, stand: start() };
    if (z.ende !== null) {
      const s = simuliere(plan, z.aktionen.filter((a) => a.tick <= z.ende), z.ende);
      return { ...grund, phase: "ende", dran: null, ende: s.ende || "v", stand: s, endeTick: z.ende };
    }
    return { ...grund, phase: "flug", dran: "beide", ende: null, stand: simuliere(plan, z.aktionen, Math.max(0, z.letzterTick)), letzterTick: z.letzterTick };
  }

  function darf(l, zug, sitz) {
    if (l.ende || l.kaputt) return false;
    if (zug === "S") return l.phase === "bereit";
    if (l.phase !== "flug") return false;
    const e = E.ENDE.exec(zug);
    if (e) {
      const t = Number(e[1]);
      return t <= MAX_TICK && Boolean(simuliere(l.plan, l.aktionen.filter((a) => a.tick <= t), t).ende);
    }
    return E.darfAktion(l, zug, sitz, { aktionGueltig: gueltigFuer(l.beginnt), maxTick: MAX_TICK });
  }

  // --- Der Computer und die Planerin für die Prüfung -------------------------
  const uhrVon = (modus, nr, saat) => E.uhrFuer(`raumschiff|${modus}|${nr}|${saat}`);

  // Der Computer schaut voraus, wann er etwas tun muss – die Zukunft hängt
  // nur an den Zügen; tut das Kind etwas, rechnet er neu.
  function computer(l, sitz, stufe, { nr, saat } = {}) {
    if (l.ende || l.phase !== "flug") return null;
    const uhr = uhrVon("computer", nr, saat);
    uhr.stellen(l.letzterTick ?? -1);
    const jetzt = uhr.tick();
    const rolle = rolleVon(sitz, l.beginnt);
    const ab = Math.max(jetzt, (l.letzter?.[sitz] ?? -1) + 1, 0);
    const sim = simulator(l.plan, l.aktionen);
    sim.bis(ab - 1);
    for (let t = ab; t <= MAX_TICK; t += 1) {
      if (sim.s.ende) return null;
      const art = was(l.plan, sim.s, rolle);
      if (art) return { zug: `${sitz}${t}:${art}`, warte: Math.max(0, (t - jetzt) * E.TICK_MS) };
      sim.bis(t);
    }
    return null;
  }

  // Ein ganzer Flug, beide wie der Computer (oder böse: niemand tut etwas)
  // – für die Prüfungen.
  function fahrt(plan, { beginnt = "a", boese = false } = {}) {
    const s = start();
    const aktionen = [];
    for (let t = 0; t <= MAX_TICK && !s.ende; t += 1) {
      if (!boese) {
        for (const wer of ["a", "b"]) {
          const art = was(plan, { ...s, tick: t - 1 }, rolleVon(wer, beginnt));
          if (art) { aktion(s, art, t); aktionen.push({ wer, tick: t, art }); }
        }
      }
      schritt(s, plan);
    }
    return { aktionen, ende: s.ende, endTick: s.endTick, stand: s };
  }

  // --- Was über dem Bild steht ---------------------------------------------------
  function satz(l, { ich }) {
    if (l.ende) return null;
    if (l.phase === "bereit") return { text: "Du beginnst – tippt «Los!», dann ab ins All!", sitz: ich || null };
    if (!ich) return null;
    return rolleVon(ich, l.beginnt) === "pilot"
      ? { text: "Du steuerst – weich den Asteroiden aus!", sitz: ich }
      : { text: "Du hast den Schild – an, wenn Meteore kommen!", sitz: ich };
  }

  // --- Das Bild -------------------------------------------------------------------
  const bahnY = (b) => 20 + b * 30;

  function held() {
    const bild = el("div", "zw-rs-held");
    bild.append(el("span", "zw-rs-held-stein ist-1"), el("span", "zw-rs-held-stein ist-2"), el("span", "zw-rs-stern ist-held", "★"));
    const schiff = el("span", "zw-rs-schiff ist-held");
    schiff.append(el("span", "zw-rs-fenster ist-a"), el("span", "zw-rs-fenster ist-b"), el("span", "zw-rs-flamme"));
    bild.append(schiff);
    return bild;
  }

  function brett({ zug, ton, ruhig, knopf }) {
    const knoten = el("div", "vr-feld zw-rs");
    knoten.dataset.zuege = "0";
    const kopf = el("div", "zw-rs-kopf");
    const herzen = el("span", "zw-rs-herzen");
    const weg = el("div", "zw-rs-weg");
    const wegBalken = el("span", "zw-rs-weg-balken");
    weg.append(wegBalken);
    const sterne = el("span", "zw-rs-sterne");
    kopf.append(herzen, weg, sterne);
    const all = el("div", "zw-rs-all");
    const welt = el("div", "zw-rs-welt");
    const schiff = el("div", "zw-rs-schiff");
    const schild = el("span", "zw-rs-schild");
    schiff.append(el("span", "zw-rs-fenster ist-a"), el("span", "zw-rs-fenster ist-b"), el("span", "zw-rs-flamme"), schild);
    const warnung = el("span", "zw-rs-warnung", "!");
    const planet = el("span", "zw-rs-planet");
    all.append(el("span", "zw-rs-bahn ist-0"), el("span", "zw-rs-bahn ist-1"), el("span", "zw-rs-bahn ist-2"), planet, welt, schiff, warnung);
    const unten = el("div", "zw-rs-unten");
    const los = knopf("Los!", "zw-rs-los mini-knopf mini-knopf-voll", () => zug("S"));
    const hoch = el("button", "zw-rs-knopf ist-hoch", "▲");
    const runter = el("button", "zw-rs-knopf ist-runter", "▼");
    const schildKnopf = el("button", "zw-rs-knopf ist-schild");
    const schildText = el("span", "zw-rs-schild-text", "Schild an!");
    const ladung = el("span", "zw-rs-ladung");
    const ladungBalken = el("span", "zw-rs-ladung-balken");
    ladung.append(ladungBalken);
    schildKnopf.append(schildText, ladung);
    hoch.setAttribute("aria-label", "Eine Bahn hoch");
    runter.setAttribute("aria-label", "Eine Bahn runter");
    for (const [k, art] of [[hoch, "U"], [runter, "D"], [schildKnopf, "S"]]) {
      k.type = "button";
      k.dataset.art = art;
      k.addEventListener("pointerdown", (e) => { e.preventDefault(); handeln(art); });
      k.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); handeln(art); } });
    }
    unten.append(los, hoch, runter, schildKnopf);
    knoten.append(kopf, all, unten);

    let letzte = null;
    let planFuer = "";
    let objektEl = [];
    let lauf = 0;
    let uhr = E.uhr();
    let endeGeschickt = -1;
    let gezeigt = { herzen: HERZEN, sterne: 0, abgewehrt: 0 };

    function handeln(art) {
      if (!letzte) return;
      const { lage: l, ich, aus } = letzte;
      if (aus || !ich || l.phase !== "flug" || l.ende || !gueltigFuer(l.beginnt)(ich, art)) return;
      const t = Math.max(uhr.tick(), (l.letzter?.[ich] ?? -1));
      zug(`${ich}${t}:${art}`);
      ton(art === "S" ? "da" : "tipp");
    }

    function objekteBauen(plan) {
      welt.innerHTML = "";
      objektEl = plan.objekte.map((o) => {
        let e;
        if (o.art === "*") e = el("span", "zw-rs-stern", "★");
        else if (o.art === "M") {
          e = el("span", "zw-rs-schauer");
          for (let i = 0; i < 6; i += 1) e.append(el("span", `zw-rs-meteor ist-${i}`));
        } else {
          e = el("span", "zw-rs-gruppe");
          o.bahnen.forEach((b) => { const st = el("span", `zw-rs-stein ist-${(o.d + b) % 3}`); st.style.top = `${bahnY(b)}%`; e.append(st); });
        }
        e.hidden = true;
        welt.append(e);
        return e;
      });
    }

    function malen(s, plan, bruch, l) {
      const ich = letzte?.ich;
      const d = s.d + (s.ende ? 0 : plan.tempo * bruch);
      const xVon = (od) => SCHIFF_X + ((od - d) / SICHT) * (96 - SCHIFF_X);
      plan.objekte.forEach((o, i) => {
        const e = objektEl[i];
        const abstand = o.d - d;
        const weg = s.gesammelt.includes(i) || (s.abgeprallt.includes(i) && abstand < -40);
        e.hidden = weg || abstand > SICHT + 30 || abstand < -90;
        if (e.hidden) return;
        e.style.left = `${xVon(o.d)}%`;
        if (o.art === "*") e.style.top = `${bahnY(o.bahn)}%`;
        e.classList.toggle("ist-getroffen", s.getroffen.includes(i));
        e.classList.toggle("ist-abgewehrt", s.abgeprallt.includes(i));
      });
      const schauer = plan.objekte.slice(s.naechstes).find((o) => o.art === "M");
      warnung.hidden = !(schauer && schauer.d - d > SICHT * 0.55 && schauer.d - d < SICHT + 260);
      planet.hidden = plan.laenge - d > SICHT + 120;
      if (!planet.hidden) planet.style.left = `${xVon(plan.laenge) + 6}%`;
      schiff.style.top = `${bahnY(s.bahn)}%`;
      const an = schildAn(s, s.tick + 1) || (s.ende && schildAn(s));
      schild.classList.toggle("ist-an", Boolean(an));
      all.style.setProperty("--sterne-x", `${-((d * 1.5) % 600)}px`);
      herzen.textContent = "❤️".repeat(Math.max(0, s.herzen)) + "\u{1F90D}".repeat(Math.max(0, HERZEN - s.herzen));
      herzen.setAttribute("aria-label", `${s.herzen} von ${HERZEN} Herzen`);
      sterne.textContent = `⭐ ${s.sterne}`;
      wegBalken.style.width = `${Math.min(100, (d / plan.laenge) * 100)}%`;
      // Die Knöpfe: nur die eigenen, der Schild mit seiner Ladung.
      const rolle = ich ? rolleVon(ich, l.beginnt) : null;
      const flug = l.phase === "flug" && !letzte?.aus;
      hoch.hidden = runter.hidden = rolle !== "pilot" || l.phase !== "flug";
      schildKnopf.hidden = rolle !== "schild" || l.phase !== "flug";
      hoch.disabled = !flug || s.bahn === 0;
      runter.disabled = !flug || s.bahn === BAHNEN - 1;
      const n = s.tick + 1;
      const geladen = n >= s.schild.bereit;
      schildKnopf.disabled = !flug || !geladen;
      ladungBalken.style.width = `${geladen ? 100 : Math.max(0, Math.min(100, ((n - (s.schild.bis + 1)) / LADEN) * 100))}%`;
      schildText.textContent = schildAn(s, n) ? "Schild ist an" : geladen ? "Schild an!" : "lädt …";
      // Leicht und einfach: Der richtige Knopf leuchtet.
      const hilfe = plan.grad <= 1 && flug && rolle ? was(plan, s, rolle) : null;
      hoch.classList.toggle("ist-ruf", hilfe === "U" && rolle === "pilot" && Boolean(plan.objekte.slice(s.naechstes).find((o) => o.art === "A" && o.bahnen.includes(s.bahn) && o.d - s.d <= plan.tempo * 12)));
      runter.classList.toggle("ist-ruf", hilfe === "D" && rolle === "pilot" && Boolean(plan.objekte.slice(s.naechstes).find((o) => o.art === "A" && o.bahnen.includes(s.bahn) && o.d - s.d <= plan.tempo * 12)));
      schildKnopf.classList.toggle("ist-ruf", Boolean(rolle === "schild" && flug && geladen && plan.grad <= 1 && schauer && schauer.d - s.d <= plan.tempo * 14));
      if (s.herzen < gezeigt.herzen) { ton("treffer"); all.classList.remove("ist-rums"); void all.offsetWidth; all.classList.add("ist-rums"); }
      if (s.sterne > gezeigt.sterne) ton("da");
      if (s.abgewehrt > gezeigt.abgewehrt) ton("klack");
      gezeigt.herzen = s.herzen;
      gezeigt.sterne = s.sterne;
      gezeigt.abgewehrt = s.abgewehrt;
    }

    function schleife() {
      lauf = 0;
      if (!letzte) return;
      const { lage: l } = letzte;
      if (l.phase !== "flug") return;
      const jetzt = uhr.tick();
      const s = simuliere(l.plan, l.aktionen, jetzt);
      malen(s, l.plan, s.ende ? 0 : uhr.bruch(), l);
      // Ist es aus – und kommt nichts mehr, was früher war –, sagt dieses
      // Gerät es allen.
      if (s.ende && jetzt >= (l.letzterTick ?? -1) && endeGeschickt !== l.zahl) {
        endeGeschickt = l.zahl;
        zug(`E${s.endTick}`);
      }
      lauf = window.requestAnimationFrame(schleife);
    }

    function zeichne(args) {
      const { lage: l, nr, aus, ich, modus, saat } = args;
      letzte = args;
      uhr = uhrVon(modus, nr, saat);
      const schluessel = `${modus}|${nr}|${saat}`;
      if (schluessel !== planFuer) { objekteBauen(l.plan); planFuer = schluessel; gezeigt = { herzen: HERZEN, sterne: 0, abgewehrt: 0 }; endeGeschickt = -1; }
      if (l.gestartet) uhr.stellen(l.letzterTick ?? -1);
      const flug = l.phase === "flug";
      los.hidden = l.phase !== "bereit";
      los.disabled = Boolean(aus || !ich);
      knoten.dataset.zuege = String(l.zahl);
      knoten.dataset.phase = l.phase;
      knoten.classList.toggle("ist-aus", Boolean(l.ende));
      knoten.classList.toggle("ist-geschafft", l.ende === "g");
      if (flug && !ruhig()) { if (!lauf) lauf = window.requestAnimationFrame(schleife); } else {
        if (lauf) { window.cancelAnimationFrame(lauf); lauf = 0; }
        malen(l.phase === "ende" ? l.stand : flug ? simuliere(l.plan, l.aktionen, uhr.tick()) : l.stand, l.plan, 0, l);
        if (flug && ruhig()) window.setTimeout(() => { if (letzte === args) zeichne(args); }, 250);
      }
    }

    return {
      knoten,
      zeichne,
      fokus: () => [los, hoch, schildKnopf].find((k) => !k.hidden)?.focus({ preventScroll: true }),
    };
  }

  // Zu zweit wird der Flug mit jeder zweiten Partie länger und dichter.
  function neuePartie(stufe, { nr = 0 } = {}) {
    const grad = stufe ? 0 : Math.min(3, Math.floor((Number(nr) || 0) / 2));
    return { saat: ((grad << 29) | Math.floor(Math.random() * 0x1fffffff)) >>> 0 };
  }

  Z.starte({
    id: "raumschiff",
    titel: "Raumschiff-Crew",
    seite: "raumschiff",
    unter: "Zusammen! Eine steuert das Raumschiff an den Asteroiden vorbei, die andere schaltet den Schild ein, wenn Meteore kommen. Bis zum Planeten!",
    held,
    trenner: ".",
    gemeinsam: true,
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Ein kurzer Flug" },
      einfach: { name: "Einfach", sterne: 1, satz: "Mehr Asteroiden" },
      mittel: { name: "Mittel", sterne: 2, satz: "Ein langer Flug" },
      schwer: { name: "Schwer", sterne: 3, satz: "Durch den Asteroidengürtel" },
    },
    texte: { start: "tippt «Los!»", geschafft: "Geschafft – ihr seid beim Planeten!", verpasst: "Die Herzen sind weg – nicht geschafft." },
    lage,
    darf,
    brett,
    computer,
    satz,
    neuePartie,
    vorlesen: (b) => (b.lage.ende ? "" : `Noch ${b.lage.stand.herzen} Herzen, ${b.lage.stand.sterne} Sterne.`),
    fuerPruefung: { planVon, simuliere, fahrt, gradVon, pilotin, rolleVon, HERZEN, MAX_TICK, DAUER, LADEN },
  });
})();
