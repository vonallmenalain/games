/*
 * kanu.js – Kanu zu zweit: zusammen den Fluss hinunter.
 * ---------------------------------------------------------------------------
 * Die Seite /kanu. Ein Spiel miteinander, in Echtzeit (echtzeit.js). Ein
 * Kanu, zwei Paddel: Koralle (a) paddelt links, Gold (b) rechts. Ein
 * Schlag links schiebt das Kanu nach rechts, einer rechts nach links – wie
 * im echten Kanu. Paddeln beide fast gleichzeitig, geht es geradeaus und
 * schneller. Der Fluss trägt das Kanu auch allein, nur langsam.
 *
 * Unterwegs liegen Felsen (ein Felsen kostet ein Herz, von dreien) und
 * Tore aus zwei Fähnchen (wer durchfährt, sammelt einen Stern). Kommt das
 * Kanu mit mindestens einem Herz ins Ziel, ist es geschafft.
 *
 * Wie lang der Fluss ist und wie viele Felsen und Tore er hat, kommt aus
 * der Saat und der Stufe (gegen den Computer) oder, zu zweit, der wie-
 * vielten Partie. Die Simulation (simuliere) rechnet in Ticks zu 100 ms
 * aus den Schlägen – jedes Gerät gleich.
 *
 * Ein Zug ist «S» (Los!), «a37:L» / «b37:R» (ein Schlag bei Tick 37) oder
 * «E412» (bei Tick 412 ist es aus).
 *
 * Der Computer paddelt rechts: Er schaut voraus, will er nach links, paddelt
 * er öfter; soll es nach rechts gehen, hält er still und ruft «Paddel du!».
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "kanu") return;

  const Z = window.LernappZwei;
  const E = window.LernappEchtzeit;
  if (!Z || !E) return;
  const el = Z.el;

  const HERZEN = 3;
  const STROM = 4; // so schnell trägt der Fluss (Einheiten je Sekunde)
  const RAND = 15; // so nah ans Ufer kann das Kanu (x von RAND bis 100 − RAND)
  const MAX_TICK = 2400;
  const STUFE_GRAD = { leicht: 0, einfach: 1, mittel: 2, schwer: 3 };
  const SEITE = { a: "L", b: "R" };

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

  // Der Fluss: Länge, Felsen, Tore – aus Saat und Grad.
  function flussVon(saat, stufe) {
    const grad = gradVon(saat, stufe);
    const rnd = wuerfel(((Number(saat) >>> 0) ^ 0x51ab) >>> 0);
    const laenge = 560 + grad * 110;
    const zahl = 8 + grad * 4;
    const felsen = [];
    const tore = [];
    let y = 70;
    for (let i = 0; i < zahl && y < laenge - 40; i += 1) {
      const r = 6 + Math.floor(rnd() * 3);
      felsen.push({ x: 24 + rnd() * 52, y, r });
      // Zwischen zwei Felsen manchmal ein Tor.
      if (rnd() < 0.45 + grad * 0.05) {
        const ty = y + 14 + rnd() * 6;
        tore.push({ x: 26 + rnd() * 48, y: ty, w: 30 - grad * 2 });
      }
      y += Math.max(26, 44 - grad * 5) + rnd() * 16;
    }
    return { grad, laenge, felsen, tore };
  }

  // --- Die Simulation ---------------------------------------------------------
  function start() {
    return { tick: -1, x: 50, vx: 0, y: 0, v: STROM, herzen: HERZEN, durch: 0, verpasst: 0, getroffen: [], tore: [], schlag: { a: -99, b: -99 }, paar: { a: -99, b: -99 }, ende: null, endTick: null, zuletzt: null };
  }

  function schlag(s, wer, tick) {
    // Höchstens fünf Schläge je Sekunde zählen.
    if (tick - s.schlag[wer] < 2) return;
    const anderer = wer === "a" ? "b" : "a";
    s.vx += wer === "a" ? 7 : -7;
    s.v += 1.5;
    // Fast gleichzeitig: geradeaus und schneller – je Paar von Schlägen
    // einmal.
    if (tick - s.schlag[anderer] <= 4 && s.paar[anderer] !== s.schlag[anderer]) {
      s.v += 1.2;
      s.paar[anderer] = s.schlag[anderer];
      s.paar[wer] = tick;
    }
    s.schlag[wer] = tick;
    s.zuletzt = { wer, tick };
  }

  function schritt(s, fluss) {
    s.tick += 1;
    s.x += s.vx * 0.1;
    s.vx *= 0.88;
    if (s.x < RAND) { s.x = RAND; s.vx = Math.abs(s.vx) * 0.3; s.v *= 0.95; }
    if (s.x > 100 - RAND) { s.x = 100 - RAND; s.vx = -Math.abs(s.vx) * 0.3; s.v *= 0.95; }
    s.v = STROM + (s.v - STROM) * 0.97;
    s.y += s.v * 0.1;
    fluss.felsen.forEach((f, i) => {
      if (s.getroffen.includes(i) || Math.abs(f.y - s.y) > 6 || Math.abs(f.x - s.x) > f.r + 4) return;
      s.getroffen.push(i);
      s.herzen -= 1;
      s.vx = (s.x >= f.x ? 1 : -1) * 14;
      s.v = STROM * 0.5;
      if (s.herzen <= 0 && !s.ende) { s.ende = "v"; s.endTick = s.tick; }
    });
    fluss.tore.forEach((t, i) => {
      if (s.tore[i] !== undefined || s.y < t.y) return;
      s.tore[i] = Math.abs(s.x - t.x) <= t.w / 2;
      if (s.tore[i]) s.durch += 1; else s.verpasst += 1;
    });
    if (!s.ende && s.y >= fluss.laenge) { s.ende = "g"; s.endTick = s.tick; }
  }

  // Der Stand bei Tick bis, aus den Schlägen (nach Tick geordnet).
  function simuliere(fluss, aktionen, bis) {
    const s = start();
    let i = 0;
    for (let t = 0; t <= bis && !s.ende; t += 1) {
      while (i < aktionen.length && aktionen[i].tick <= t) { schlag(s, aktionen[i].wer, t); i += 1; }
      schritt(s, fluss);
    }
    return s;
  }

  // --- Die Regeln -----------------------------------------------------------------
  const gueltig = (wer, art) => art === SEITE[wer];

  function lage(zuege, { saat, stufe }) {
    const fluss = flussVon(saat, stufe);
    const z = E.lese(zuege, { aktionGueltig: gueltig, maxTick: MAX_TICK });
    const grund = { fluss, zahl: zuege.length, aktionen: z.aktionen, letzter: z.letzter, gestartet: z.gestartet };
    if (z.kaputt) return { ...grund, phase: "fahrt", dran: null, ende: null, kaputt: true, stand: simuliere(fluss, z.aktionen, Math.max(0, z.letzterTick)) };
    if (!z.gestartet) return { ...grund, phase: "bereit", dran: "beide", ende: null, stand: start() };
    if (z.ende !== null) {
      const s = simuliere(fluss, z.aktionen.filter((a) => a.tick <= z.ende), z.ende);
      return { ...grund, phase: "ende", dran: null, ende: s.ende || "v", stand: s, endeTick: z.ende };
    }
    return { ...grund, phase: "fahrt", dran: "beide", ende: null, stand: simuliere(fluss, z.aktionen, Math.max(0, z.letzterTick)), letzterTick: z.letzterTick };
  }

  function darf(l, zug, sitz) {
    if (l.ende || l.kaputt) return false;
    if (zug === "S") return l.phase === "bereit";
    if (l.phase !== "fahrt") return false;
    const e = E.ENDE.exec(zug);
    if (e) {
      const t = Number(e[1]);
      return t <= MAX_TICK && Boolean(simuliere(l.fluss, l.aktionen.filter((a) => a.tick <= t), t).ende);
    }
    return E.darfAktion(l, zug, sitz, { aktionGueltig: gueltig, maxTick: MAX_TICK });
  }

  // --- Der Computer und die Planerin für die Prüfung -------------------------
  // Wohin es gehen soll: um den nächsten Felsen herum, sonst durchs nächste
  // Tor, sonst in die Mitte.
  function wohin(fluss, s) {
    const fels = fluss.felsen.find((f, i) => !s.getroffen.includes(i) && f.y > s.y - 2 && f.y - s.y < 55 && Math.abs(f.x - s.x) < f.r + 14);
    if (fels) {
      const links = fels.x - fels.r - 9;
      const rechts = fels.x + fels.r + 9;
      const gehtLinks = links >= RAND + 2;
      const gehtRechts = rechts <= 100 - RAND - 2;
      if (gehtLinks && (!gehtRechts || Math.abs(s.x - links) <= Math.abs(s.x - rechts))) return links;
      return rechts;
    }
    const tor = fluss.tore.find((t, i) => s.tore[i] === undefined && t.y > s.y && t.y - s.y < 70);
    if (tor) return tor.x;
    return 50;
  }

  // Ein Schlag ja oder nein, für eine Seite – wie ein guter Partner.
  function willSchlagen(fluss, s, wer, tick, { boese = false } = {}) {
    const ziel = boese ? (fluss.felsen.find((f, i) => !s.getroffen.includes(i) && f.y > s.y)?.x ?? 50) : wohin(fluss, s);
    const abstand = ziel - s.x - s.vx * 0.8;
    const takt = tick - s.schlag[wer];
    // a schiebt nach rechts, b nach links.
    const hilft = wer === "a" ? abstand > 3 : abstand < -3;
    const stoert = wer === "a" ? abstand < -3 : abstand > 3;
    if (hilft) return takt >= 3;
    if (stoert) return false;
    return takt >= 6;
  }

  // Die Uhr der Partie (das Brett stellt sie, sonst der Computer), damit
  // der Computer weiss, welcher Tick gerade ist.
  const uhrVon = (modus, nr, saat) => E.uhrFuer(`kanu|${modus}|${nr}|${saat}`);
  let ruf = false;

  function computer(l, sitz, stufe, { nr, saat } = {}) {
    if (l.ende || l.phase !== "fahrt") return null;
    const uhr = uhrVon("computer", nr, saat);
    uhr.stellen(l.letzterTick ?? -1);
    const jetzt = uhr.tick();
    const eigene = l.letzter?.[sitz] ?? -1;
    // Was er weiss: alle Schläge bis jetzt.
    for (let t = Math.max(jetzt, eigene + 1); t < jetzt + 12; t += 1) {
      const s = simuliere(l.fluss, l.aktionen, t);
      if (s.ende) return null;
      if (willSchlagen(l.fluss, s, sitz, t)) {
        ruf = false;
        return { zug: `${sitz}${t}:${SEITE[sitz]}`, warte: Math.max(0, (t - jetzt) * E.TICK_MS) };
      }
      // Soll es zum Kind hin gehen? Dann ruft er.
      const ziel = wohin(l.fluss, s);
      ruf = sitz === "b" ? ziel - s.x > 6 : ziel - s.x < -6;
    }
    return { zug: `${sitz}${jetzt + 12}:${SEITE[sitz]}`, warte: 12 * E.TICK_MS };
  }

  // Eine ganze Fahrt, beide Seiten wie der Computer (oder boese: auf die
  // Felsen zu) – für die Prüfungen.
  function fahrt(fluss, { boese = false } = {}) {
    const s = start();
    const aktionen = [];
    for (let t = 0; t <= MAX_TICK && !s.ende; t += 1) {
      for (const wer of ["a", "b"]) {
        if (willSchlagen(fluss, s, wer, t, { boese })) { schlag(s, wer, t); aktionen.push({ wer, tick: t, art: SEITE[wer] }); }
      }
      schritt(s, fluss);
    }
    return { aktionen, ende: s.ende, endTick: s.endTick, stand: s };
  }

  // --- Was über dem Fluss steht ---------------------------------------------------
  function satz(l, { ich, modus }) {
    if (l.ende) return null;
    if (l.phase === "bereit") return { text: "Du beginnst – tippt «Los!», dann paddelt los!", sitz: ich || null };
    if (!ich) return null;
    const s = l.stand;
    if (modus === "computer" && ruf) return { text: "Nach rechts! Paddel du!", sitz: "a" };
    return { text: ich === "a" ? "Du paddelst links – das Kanu geht nach rechts." : "Du paddelst rechts – das Kanu geht nach links.", sitz: ich, nochHerzen: s.herzen };
  }

  // --- Das Bild -------------------------------------------------------------------
  function held() {
    const bild = el("div", "zw-ka-held");
    bild.append(el("span", "zw-ka-held-ufer ist-links"), el("span", "zw-ka-held-ufer ist-rechts"), el("span", "zw-ka-held-fels"),
      el("span", "zw-ka-held-fahne ist-links"), el("span", "zw-ka-held-fahne ist-rechts"));
    const boot = el("span", "zw-ka-boot ist-held");
    boot.append(el("span", "zw-ka-sitz ist-a"), el("span", "zw-ka-sitz ist-b"));
    bild.append(boot);
    return bild;
  }

  function brett({ zug, ton, ruhig, knopf }) {
    const knoten = el("div", "vr-feld zw-ka");
    knoten.dataset.zuege = "0";
    const kopf = el("div", "zw-ka-kopf");
    const herzen = el("span", "zw-ka-herzen");
    const sterne = el("span", "zw-ka-sterne");
    const weg = el("div", "zw-ka-weg");
    const wegBalken = el("span", "zw-ka-weg-balken");
    weg.append(wegBalken);
    kopf.append(herzen, weg, sterne);
    const fluss = el("div", "zw-ka-fluss");
    const welt = el("div", "zw-ka-welt");
    const boot = el("div", "zw-ka-boot");
    const paddel = { a: el("span", "zw-ka-paddel ist-a"), b: el("span", "zw-ka-paddel ist-b") };
    boot.append(el("span", "zw-ka-sitz ist-a"), el("span", "zw-ka-sitz ist-b"), paddel.a, paddel.b);
    fluss.append(el("span", "zw-ka-ufer ist-links"), el("span", "zw-ka-ufer ist-rechts"), welt, boot);
    const unten = el("div", "zw-ka-unten");
    const los = knopf("Los!", "zw-ka-los mini-knopf mini-knopf-voll", () => zug("S"));
    const paddeln = el("button", "zw-ka-paddeln");
    paddeln.type = "button";
    paddeln.addEventListener("pointerdown", (e) => { e.preventDefault(); schlagen(); });
    paddeln.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); schlagen(); } });
    unten.append(los, paddeln);
    knoten.append(kopf, fluss, unten);

    let letzte = null;
    let flussFuer = "";
    let felsEl = [];
    let torEl = [];
    let zielEl = null;
    let lauf = 0;
    let uhr = E.uhr();
    let endeGeschickt = -1;
    let gezeigt = { nr: -1, zahl: -1, herzen: HERZEN, durch: 0 };

    function schlagen() {
      if (!letzte) return;
      const { lage: l, ich, aus } = letzte;
      if (aus || !ich || l.phase !== "fahrt" || l.ende) return;
      const t = Math.max(uhr.tick(), (l.letzter?.[ich] ?? -1));
      zug(`${ich}${t}:${SEITE[ich]}`);
      paddel[ich].classList.remove("ist-schlag");
      void paddel[ich].offsetWidth;
      paddel[ich].classList.add("ist-schlag");
      ton("platsch");
    }

    function weltBauen(f) {
      welt.innerHTML = "";
      felsEl = f.felsen.map((fe) => {
        const e = el("span", "zw-ka-fels");
        e.style.setProperty("--r", String(fe.r));
        welt.append(e);
        return e;
      });
      torEl = f.tore.map((t) => {
        const e = el("span", "zw-ka-tor");
        e.style.setProperty("--w", String(t.w));
        e.append(el("span", "zw-ka-fahne ist-links"), el("span", "zw-ka-fahne ist-rechts"));
        welt.append(e);
        return e;
      });
      zielEl = el("span", "zw-ka-ziel", "\u{1F3C1}");
      welt.append(zielEl);
    }

    // Was man sieht: 130 Einheiten Fluss, das Kanu im unteren Viertel.
    const SICHT = 130;
    function malen(s, f) {
      const oben = s.y + SICHT * 0.78;
      const yPos = (y) => `${((oben - y) / SICHT) * 100}%`;
      f.felsen.forEach((fe, i) => {
        const e = felsEl[i];
        e.style.left = `${fe.x}%`;
        e.style.top = yPos(fe.y);
        e.classList.toggle("ist-getroffen", s.getroffen.includes(i));
      });
      f.tore.forEach((t, i) => {
        const e = torEl[i];
        e.style.left = `${t.x}%`;
        e.style.top = yPos(t.y);
        e.classList.toggle("ist-durch", s.tore[i] === true);
        e.classList.toggle("ist-verpasst", s.tore[i] === false);
      });
      zielEl.style.top = yPos(f.laenge);
      boot.style.left = `${s.x}%`;
      boot.style.top = yPos(s.y);
      boot.style.setProperty("--neigung", `${Math.max(-25, Math.min(25, s.vx * 2.2))}deg`);
      fluss.style.setProperty("--wellen", `${(s.y * 4) % 400}px`);
      herzen.textContent = "❤️".repeat(Math.max(0, s.herzen)) + "\u{1F90D}".repeat(Math.max(0, HERZEN - s.herzen));
      herzen.setAttribute("aria-label", `${s.herzen} von ${HERZEN} Herzen`);
      sterne.textContent = `⭐ ${s.durch}`;
      wegBalken.style.width = `${Math.min(100, (s.y / f.laenge) * 100)}%`;
      if (s.herzen < gezeigt.herzen) { ton("treffer"); fluss.classList.remove("ist-rums"); void fluss.offsetWidth; fluss.classList.add("ist-rums"); }
      if (s.durch > gezeigt.durch) ton("da");
      gezeigt.herzen = s.herzen;
      gezeigt.durch = s.durch;
    }

    function schleife() {
      lauf = 0;
      if (!letzte) return;
      const { lage: l } = letzte;
      if (l.phase !== "fahrt") return;
      const jetzt = uhr.tick();
      const s = simuliere(l.fluss, l.aktionen, jetzt);
      malen(s, l.fluss);
      // Ist es aus – und kommt kein Schlag mehr, der früher war –, sagt
      // dieses Gerät es allen.
      if (s.ende && jetzt >= (l.letzterTick ?? -1) && endeGeschickt !== l.zahl) {
        endeGeschickt = l.zahl;
        zug(`E${s.endTick}`);
      }
      lauf = window.requestAnimationFrame(schleife);
    }

    function zeichne(args) {
      const { lage: l, nr, ich, aus, modus, saat } = args;
      letzte = args;
      uhr = uhrVon(modus, nr, saat);
      const schluessel = `${nr}|${l.fluss.laenge}|${l.fluss.felsen.length}|${l.fluss.felsen[0]?.x}`;
      if (schluessel !== flussFuer) { weltBauen(l.fluss); flussFuer = schluessel; gezeigt = { nr, zahl: -1, herzen: HERZEN, durch: 0 }; endeGeschickt = -1; }
      if (l.gestartet) uhr.stellen(l.letzterTick ?? -1);
      const fahrt = l.phase === "fahrt";
      los.hidden = l.phase !== "bereit";
      los.disabled = Boolean(aus || !ich);
      // Vor dem Start «Los!», während der Fahrt das Paddel, danach nichts
      // (dann stehen unten «Nochmal» und «Menü»).
      paddeln.hidden = l.phase !== "fahrt";
      const meins = ich || "a";
      paddeln.className = `zw-ka-paddeln ist-${meins}`;
      paddeln.textContent = meins === "a" ? "⬅️ Paddeln (links)" : "Paddeln (rechts) ➡️";
      paddeln.disabled = !(fahrt && ich && !aus);
      paddeln.classList.toggle("ist-ruf", Boolean(modus === "computer" && ruf && fahrt));
      knoten.dataset.zuege = String(l.zahl);
      knoten.dataset.phase = l.phase;
      knoten.classList.toggle("ist-aus", Boolean(l.ende));
      knoten.classList.toggle("ist-geschafft", l.ende === "g");
      if (fahrt && !ruhig()) { if (!lauf) lauf = window.requestAnimationFrame(schleife); } else {
        if (lauf) { window.cancelAnimationFrame(lauf); lauf = 0; }
        malen(l.phase === "ende" ? l.stand : fahrt ? simuliere(l.fluss, l.aktionen, uhr.tick()) : l.stand, l.fluss);
        if (fahrt && ruhig()) window.setTimeout(() => { if (letzte === args) zeichne(args); }, 250);
      }
      gezeigt.zahl = l.zahl;
    }

    return {
      knoten,
      zeichne,
      fokus: () => (!los.hidden ? los : paddeln).focus({ preventScroll: true }),
    };
  }

  // Zu zweit wird der Fluss mit jeder zweiten Partie länger und felsiger.
  function neuePartie(stufe, { nr = 0 } = {}) {
    const grad = stufe ? 0 : Math.min(3, Math.floor((Number(nr) || 0) / 2));
    return { saat: ((grad << 29) | Math.floor(Math.random() * 0x1fffffff)) >>> 0 };
  }

  Z.starte({
    id: "kanu",
    titel: "Kanu zu zweit",
    seite: "kanu",
    unter: "Zusammen! Jede hat ein Paddel – links oder rechts. Links paddeln schiebt das Kanu nach rechts, rechts nach links, beide zusammen geradeaus. Um die Felsen, durch die Tore, ins Ziel!",
    held,
    trenner: ".",
    gemeinsam: true,
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Ein kurzer Bach" },
      einfach: { name: "Einfach", sterne: 1, satz: "Mehr Felsen" },
      mittel: { name: "Mittel", sterne: 2, satz: "Ein langer Fluss" },
      schwer: { name: "Schwer", sterne: 3, satz: "Wildwasser" },
    },
    texte: { start: "tippt «Los!»", geschafft: "Geschafft – ihr seid im Ziel!", verpasst: "Die Herzen sind weg – nicht geschafft." },
    lage,
    darf,
    brett,
    computer,
    satz,
    neuePartie,
    vorlesen: (b) => (b.lage.ende ? "" : `Noch ${b.lage.stand.herzen} Herzen, ${b.lage.stand.durch} Sterne.`),
    fuerPruefung: { flussVon, simuliere, fahrt, gradVon, HERZEN, MAX_TICK, start, SEITE },
  });
})();
