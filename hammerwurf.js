/*
 * hammerwurf.js – Hammerwurf.
 * ---------------------------------------------------------------------------
 * Ein Stadion am Abend, von oben gesehen: der Wurfkreis im Käfig, davor der
 * Rasen mit dem Sektor. Der Werfer dreht sich mit dem Hammer, Drehung um
 * Drehung schneller. Ein Tipp lässt los: Der Hammer fliegt in die Richtung,
 * in die er sich gerade bewegt. Mehr gibt es nicht zu tun – nur das Wann.
 *
 * Und das Wann ist zweierlei. Wohin: Nur im Sektor zählt der Wurf, daneben
 * ist er ungültig, noch weiter daneben schlägt der Hammer ins Netz. Wie
 * weit: Je länger er sich dreht, desto schneller wird der Hammer und desto
 * weiter fliegt er – aber desto kürzer ist auch der Augenblick, in dem er
 * in den Sektor zeigt. Nach DREH_MAX Drehungen verliert der Werfer das
 * Gleichgewicht und tritt über den Ring.
 *
 * Jeder Wurf muss über die Qualifikationslinie, und die rückt nach jedem
 * Wurf weiter hinaus. Wer anfangs mit einer Drehung auskommt, braucht bald
 * drei, dann fünf – das Risiko wählt jeder selbst, Wurf für Wurf, und
 * irgendwann reicht keine Drehung mehr. Gezählt werden die Meter aller
 * Würfe. Ein Wurf genau auf die Mittellinie (MITTE, ein Drittel des
 * Sektors) gibt Bonusmeter: +5, und in Folge +10, +15, +20.
 *
 * Der erste Fehler beendet die Runde: Netz, ungültig, zu kurz, übergetreten.
 * Der Sektor wird nach hinten schmaler.
 *
 * Gewürfelt wird nur der Wind (zufall.js), Wurf für Wurf: Rückenwind trägt
 * weiter, Gegenwind weniger weit. Die Fahne und die Karte vor dem Wurf
 * zeigen ihn. Ohne Turnier jedes Mal anders, im Turnier für alle im selben
 * Versuch gleich.
 *
 * Gerechnet wird in Metern: Der Wurfkreis liegt bei (0, 0), y zählt das Feld
 * hinauf, die Mittellinie des Sektors zeigt nach oben (90°). Der Hammer
 * dreht gegen den Uhrzeiger; sein Winkel th zählt wie in der Mathematik.
 * Losgelassen fliegt er tangential: in Richtung th + 90°. Genau auf der
 * Mittellinie fliegt also, wer loslässt, wenn der Hammer rechts vom Werfer
 * ist (th = 0).
 *
 * Gegner (geist.js): Platz 1 und die eigene Bestmarke als Zielmarke. Jeder
 * Wurf ist ein Zug (geist.js, zuege; live-spiel.js, zug) – Richtung, Tempo
 * und was daraus wurde. Wer zuschaut, sieht den Werfer sich drehen und den
 * Hammer genau so fliegen wie damals.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "hammer") return;

  const host = document.querySelector("#hw-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall: nur der Wind. Gras, Staub und Funken würfeln Math.random –
  // sie hängen daran, wie jemand wirft.
  const zufall = window.LernappZufall?.fuer?.("hammerThrow") || {
    fest: false, neu() {}, zahl: Math.random,
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const TAKT = 1 / 240;            // gerechnet wird in festen kleinen Schritten
  const RING_R = 1.07;             // der Wurfkreis (m)
  const KAEFIG_R = 3.4;            // der Käfig um den Kreis
  const HAMMER_R = 1.85;           // so weit dreht der Hammer um den Werfer

  // Die Drehung, in Umdrehungen je Sekunde: Sie beginnt mit W0 und wird
  // gleichmässig schneller (W_PLUS je Sekunde). Nach DREH_MAX Drehungen ist
  // sie bei gut W_MAX – und der Werfer tritt über.
  const W0 = 0.6;
  const W_PLUS = 0.133;
  const DREH_MAX = 5;
  const W_MAX = Math.sqrt(W0 * W0 + 2 * W_PLUS * DREH_MAX);
  const ANSCHWUNG = 0.7;           // so lange holt er aus, bevor er sich dreht (s)

  // Die Weite: aus dem Tempo beim Loslassen, ohne Wind von WEITE0 bis
  // WEITE_MAX Meter, dazu der Wind (WIND_MAX m/s, je m/s WIND_ANTEIL).
  const WEITE0 = 22;
  const WEITE_MAX = 90;
  const WIND_MAX = 2.5;
  const WIND_ANTEIL = 0.035;

  // Der Sektor: so viel Grad links und rechts der Mittellinie, anfangs und
  // ab dem zehnten Wurf. Daneben liegt noch NETZ_RAND Grad offener Käfig –
  // weiter daneben schlägt er ins Netz.
  const SEKTOR = [22, 15];
  const NETZ_RAND = 7;
  const MITTE = 1 / 3;             // so viel des Sektors um die Mittellinie ist «Mitte!»
  const BONUS = 5;                 // Bonusmeter je «Mitte!» in Folge …
  const BONUS_MAX = 4;             // … höchstens so oft

  // Die Qualifikation: Wurf n (ab 0) muss über Q0 + Q_PLUS · n Meter.
  const Q0 = 18;
  const Q_PLUS = 6.5;

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.hammerwurf", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
    : {
      read: () => ({ runs: 0, scores: [] }),
      write(data) { return data; },
      update(fn) { return fn(this.read()); },
      onChange() { return () => {}; },
    };

  // ---------------------------------------------------------------------------
  // Kleine Rechnungen
  // ---------------------------------------------------------------------------
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, k) => a + (b - a) * k;
  const rad = (d) => (d * Math.PI) / 180;
  const grad = (r) => (r * 180) / Math.PI;
  const TAU = Math.PI * 2;
  // Ein Winkel zwischen −180° und 180°.
  const normGrad = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  const sektorBei = (n) => lerp(SEKTOR[0], SEKTOR[1], clamp(n / 10, 0, 1));
  const quali = (n) => Q0 + Q_PLUS * n;
  // Das Tempo nach t Sekunden Drehung und wie viele Umdrehungen bis dahin.
  const tempoBei = (t) => W0 + W_PLUS * t;
  const drehungenBei = (t) => W0 * t + (W_PLUS * t * t) / 2;
  // Wann die Drehung DREH_MAX voll ist.
  const DREH_ENDE = (-W0 + W_MAX) / W_PLUS;
  // Die Weite ohne Wind aus dem Tempo (Umdrehungen je Sekunde).
  const weiteAus = (w) => WEITE0 + (WEITE_MAX - WEITE0) * clamp((w - W0) / (W_MAX - W0), 0, 1);

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch kein Tipp), "spiel", "zuschauen", "ende"
  // schritt: "anschwung" (er holt aus), "drehen", "flug", "liegt" (der
  //          Hammer ist gelandet, die Weite steht da), "aus"
  const state = {
    phase: "bereit",
    schritt: "anschwung",
    punkte: 0,
    wurf: 0,               // der wievielte Wurf (ab 0)
    plan: [],              // der Wind je Wurf (m/s, plus: Rückenwind)
    t: 0,                  // Zeit in diesem Schritt
    dreh: 0,               // Zeit, seit er sich dreht
    th: -Math.PI / 2,      // wo der Hammer steht
    w: 0,                  // wie schnell er gerade dreht (Umdrehungen/s)
    flug: null,            // { phi, weite, dauer, t, x, y, aus, mitte, ziel }
    marken: [],            // wo die Würfe dieser Runde lagen
    kette: 0,              // «Mitte!» hintereinander
    besteKette: 0,
    mitten: 0,
    weiteste: 0,
    aus: "",               // "netz", "ungueltig", "kurz", "uebertreten"
    punkteNach: undefined, // beim Zuschauen: die Punkte nach dem laufenden Wurf
    staub: [],
    schriften: [],
    spur: [],
    cam: { x: 0, y: 3, h: 15 },
    stoss: 0,
    zeit: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  // Die Gegner (geist.js): Platz 1 und die eigene Bestmarke als Zielmarke.
  let gegner = null;
  // Die Aufzeichnung der Würfe (geist.js, zuege).
  let aufnahme = null;
  // Wem zugeschaut wird (Hall of Fame oder Multiplayer) und bis wohin.
  let zuschauer = null;
  let gesehenBis = -Infinity;

  const view = { dpr: 1, cssW: 0, cssH: 0, frei: 0, s: 30 };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Klänge (klang.js)
  // ---------------------------------------------------------------------------
  // Jeder Klang hat eine Mindestpause in echter Zeit – die Prüfskripte
  // rechnen ganze Runden am Stück.
  const zuletzt = new Map();
  let leise = false;
  function ton(id, o = {}, pause = 60) {
    if (leise) return;
    const ms = performance.now();
    if (ms - (zuletzt.get(id) ?? -1e9) < pause) return;
    zuletzt.set(id, ms);
    klang()?.ton?.(id, o);
  }
  // Das Sausen des Hammers: lauter und höher, je schneller er dreht.
  let sausen = null;
  function sausenTakt() {
    const an = state.schritt === "drehen" && (state.phase === "spiel" || state.phase === "zuschauen");
    if (!an) { sausen?.stop(); sausen = null; return; }
    if (!sausen || !sausen.laeuft) sausen = klang()?.kulisse?.("hammerwurf.sausen") || null;
    const k = clamp((state.w - W0) / (W_MAX - W0), 0, 1);
    sausen?.setze(0.3 + 0.7 * k);
    sausen?.laut(0.5 + 0.5 * k);
  }
  function klangAus() {
    sausen?.stop();
    sausen = null;
  }
  const brumm = (muster) => { if (state.phase === "spiel") kids()?.vibrate?.(muster); };

  // ---------------------------------------------------------------------------
  // Der Plan: der Wind
  // ---------------------------------------------------------------------------
  // Je Wurf eine Zahl. Die ersten beiden Würfe gehen ohne Wind.
  function planBis(n) {
    while (state.plan.length <= n) {
      const i = state.plan.length;
      const z = zufall.zahl();
      state.plan.push(i < 2 ? 0 : Math.round((z * 2 - 1) * WIND_MAX * 10) / 10);
    }
  }
  const windBei = (n) => { planBis(n); return state.plan[n]; };

  // Die gewürfelte Welt in Worten (für die Prüfung): der Wind der ersten
  // zwölf Würfe.
  function weltText() {
    planBis(11);
    return state.plan.slice(0, 12).map((w) => w.toFixed(1)).join(" ");
  }

  // ---------------------------------------------------------------------------
  // Ein Wurf
  // ---------------------------------------------------------------------------
  // Was ein Wurf ergibt, aus der Richtung (Grad, 90 = Mittellinie) und dem
  // Tempo – dieselbe Rechnung beim Spielen und beim Zuschauen.
  function ergebnis(phiGrad, w, n) {
    const abw = Math.abs(normGrad(phiGrad - 90));
    const sektor = sektorBei(n);
    const roh = weiteAus(w) * (1 + WIND_ANTEIL * windBei(n));
    const weite = Math.round(roh * 10) / 10;
    let aus = "";
    if (abw > sektor + NETZ_RAND) aus = "netz";
    else if (abw > sektor) aus = "ungueltig";
    else if (weite < quali(n)) aus = "kurz";
    const mitte = !aus && abw <= sektor * MITTE;
    return { abw, weite, aus, mitte };
  }

  // Ein Wurf beginnt: Er steht im Ring, der Hammer liegt hinter ihm.
  function wurfAufbauen(n) {
    state.wurf = n;
    state.schritt = "anschwung";
    state.t = 0;
    state.dreh = 0;
    state.th = -Math.PI / 2;
    state.w = 0;
    state.flug = null;
    state.spur = [];
    planBis(n + 1);
  }

  /*
   * Loslassen: Der Hammer fliegt tangential weiter, in Richtung th + 90°.
   * Die Flugzeit wächst mit der Weite; das Bild zeigt seinen Bogen über
   * den Schatten.
   */
  function loslassen(th, w) {
    const n = state.wurf;
    const phi = grad(th) + 90;
    const e = ergebnis(phi, w, n);
    const phiR = rad(phi);
    // Ins Netz fliegt er nur bis an den Käfig.
    const weit = e.aus === "netz" ? KAEFIG_R : e.weite;
    state.flug = {
      phi: phiR, weite: e.weite, ziel: weit, abw: e.abw, aus: e.aus, mitte: e.mitte,
      dauer: e.aus === "netz" ? 0.22 : 0.75 + e.weite / 95, t: 0,
      x0: Math.cos(th) * HAMMER_R, y0: Math.sin(th) * HAMMER_R, x: 0, y: 0, h: 0,
    };
    state.th = th;
    state.w = w;
    state.schritt = "flug";
    state.t = 0;
    ton("hammerwurf.abwurf", { laut: 0.6 + 0.5 * clamp((w - W0) / (W_MAX - W0), 0, 1) });
    if (state.phase === "spiel") {
      brumm(14);
      // Der Zug: Richtung, Tempo und wie der Wurf ausgeht. Die Punkte kommen
      // mit, so wie sie nach dem Wurf stehen werden.
      meldeZug(phi, w, e);
    }
  }

  // Er hat sich DREH_MAX Mal gedreht und nicht losgelassen: Er verliert das
  // Gleichgewicht und tritt über den Ring – der Hammer schleift aus.
  function uebertreten() {
    state.schritt = "aus";
    state.aus = "uebertreten";
    state.t = 0;
    // Der Hammer schleift neben dem Ring aus.
    const hx = Math.cos(state.th) * (HAMMER_R + 0.5);
    const hy = Math.sin(state.th) * (HAMMER_R + 0.5);
    state.flug = { phi: state.th, weite: 0, ziel: 0, abw: 0, aus: "uebertreten", mitte: false, dauer: 0, t: 0, x0: hx, y0: hy, x: hx, y: hy, h: 0 };
    staubBei(hx, hy, "#cdb98a", 8);
    state.stoss = 0.6;
    schrift("Übergetreten!", 0, 3.4, "#ff7a6b", 26, 2);
    ton("hammerwurf.netz");
    ton("fehler", { verzoegerung: 0.2 }, 300);
    brumm([30, 40, 60]);
    if (state.phase === "spiel") {
      meldeZug(grad(state.th) + 90, state.w, { aus: "uebertreten", weite: 0, mitte: false });
      stepTimer = window.setTimeout(finish, 1600);
    }
  }

  // Der Hammer ist unten: Weite, Bonus, Fehler.
  function landen() {
    const f = state.flug;
    const n = state.wurf;
    state.schritt = "liegt";
    state.t = 0;
    if (f.aus === "netz") {
      state.aus = "netz";
      state.stoss = 1;
      staubBei(f.x, f.y, "#d9d4c8", 10);
      schrift("Ins Netz!", f.x, f.y + 2, "#ff7a6b", 26, 2);
      ton("hammerwurf.netz");
      ton("fehler", { verzoegerung: 0.15 }, 300);
      brumm([30, 40, 60]);
      if (state.phase === "spiel") stepTimer = window.setTimeout(finish, 1700);
      return;
    }
    staubBei(f.x, f.y, "#cdb98a", 18);
    state.stoss = 0.35 + clamp(f.weite / 200, 0, 0.3);
    ton("hammerwurf.aufschlag", { laut: 0.9 });
    state.marken.push({ x: f.x, y: f.y, weite: f.weite, aus: f.aus, mitte: f.mitte, n });
    if (f.aus) {
      state.aus = f.aus;
      schrift(f.aus === "kurz" ? "Zu kurz!" : "Ungültig!", f.x, f.y + 4, "#ff7a6b", 26, 2);
      schrift(`${f.weite.toFixed(1)} m`, f.x, f.y + 9, "#ffffff", 18, 2);
      ton("fehler", { verzoegerung: 0.2 }, 300);
      brumm([30, 40, 60]);
      if (state.phase === "spiel") stepTimer = window.setTimeout(finish, 1900);
      return;
    }
    // Gültig: die Meter, und für die Mitte der Bonus.
    let plus = Math.floor(f.weite);
    if (f.mitte) {
      state.kette += 1;
      state.mitten += 1;
      state.besteKette = Math.max(state.besteKette, state.kette);
      plus += BONUS * Math.min(state.kette, BONUS_MAX);
    } else {
      state.kette = 0;
    }
    if (state.phase === "zuschauen") state.punkte = state.punkteNach ?? state.punkte + plus;
    else state.punkte += plus;
    state.weiteste = Math.max(state.weiteste, f.weite);
    shell.setCount(state.punkte);
    schrift(`${f.weite.toFixed(1)} m`, f.x, f.y + 5, "#ffffff", 26, 1.8);
    if (f.mitte) {
      const bonus = BONUS * Math.min(state.kette, BONUS_MAX);
      schrift(state.kette >= 2 ? `Mitte ×${state.kette}! +${bonus} m` : `Mitte! +${bonus} m`, f.x, f.y + 10, "#ffd23f", 18, 1.8);
      ton("perfekt", { laut: 0.8 }, 200);
      funken(f.x, f.y, 16);
      brumm([10, 30, 14]);
    } else {
      brumm(12);
    }
    if (f.weite >= 70) ton("hammerwurf.publikum", { laut: 0.6 + clamp((f.weite - 70) / 40, 0, 0.5), verzoegerung: 0.3 }, 500);
  }

  // Nach einem gültigen Wurf: der nächste.
  function naechsterWurf() {
    wurfAufbauen(state.wurf + 1);
  }

  // ---------------------------------------------------------------------------
  // Der Takt
  // ---------------------------------------------------------------------------
  function schrittTakt(h) {
    state.t += h;
    switch (state.schritt) {
      case "anschwung": {
        // Er schwingt den Hammer zweimal über dem Kopf vor – dann beginnt
        // die Drehung, bei th = −90° (hinter ihm).
        state.th = -Math.PI / 2 + Math.sin((state.t / ANSCHWUNG) * Math.PI) * 0.5;
        if (state.t >= ANSCHWUNG) {
          state.schritt = "drehen";
          state.t = 0;
          state.dreh = 0;
          state.th = -Math.PI / 2;
        }
        break;
      }
      case "drehen": {
        state.dreh += h;
        state.w = tempoBei(state.dreh);
        state.th = -Math.PI / 2 + TAU * drehungenBei(state.dreh);
        // Beim Zuschauen bestimmt der Zug, wann losgelassen wird – zur Not
        // auch nach der letzten Drehung.
        if (state.dreh >= DREH_ENDE && state.phase !== "zuschauen") uebertreten();
        break;
      }
      case "flug": {
        const f = state.flug;
        f.t += h;
        const u = clamp(f.t / f.dauer, 0, 1);
        // Vom Hammer aus geradeaus, quer zu seinem Abstand vom Werfer: Nach
        // d Metern ist er sqrt(HAMMER_R² + d²) vom Ring weg.
        const d = Math.sqrt(Math.max(0, f.ziel * f.ziel - HAMMER_R * HAMMER_R)) * u;
        f.x = f.x0 + Math.cos(f.phi) * d;
        f.y = f.y0 + Math.sin(f.phi) * d;
        f.h = f.aus === "netz" ? 0.8 * (1 - u) : 4 * u * (1 - u) * (3 + f.weite * 0.28);
        if (u >= 1) landen();
        break;
      }
      case "liegt": {
        // Die Weite steht einen Augenblick da, dann geht es weiter.
        if (state.t >= 1.5 && !state.aus && (state.phase === "spiel" || state.phase === "zuschauen")) naechsterWurf();
        break;
      }
      default:
        break;
    }
  }

  function takt(dt) {
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.2);
    if (state.phase === "zuschauen") zuschauenTakt();
    if (state.phase === "spiel" || state.phase === "zuschauen") {
      const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
      for (let i = 0; i < n; i += 1) schrittTakt(dt / n);
    } else if (state.phase === "bereit") {
      // Vor dem ersten Tipp wiegt er den Hammer hin und her.
      state.th = -Math.PI / 2 + (ruhig() ? 0 : Math.sin(state.zeit * 2.2) * 0.35);
    }
    // Die Spur des Hammers: wo er eben noch war.
    if (state.schritt === "drehen") {
      state.spur.push({ x: Math.cos(state.th) * HAMMER_R, y: Math.sin(state.th) * HAMMER_R });
      if (state.spur.length > 14) state.spur.shift();
    } else if (state.schritt === "flug" && state.flug) {
      state.spur.push({ x: state.flug.x, y: state.flug.y, h: state.flug.h });
      if (state.spur.length > 22) state.spur.shift();
    } else if (state.spur.length) {
      state.spur.shift();
    }
    nebenbei(dt);
    kameraTakt(dt);
    sausenTakt();
    if (state.phase === "spiel") gegner?.takt(state.punkte);
  }

  function nebenbei(dt) {
    for (let i = state.staub.length - 1; i >= 0; i -= 1) {
      const t = state.staub[i];
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.vx *= 1 - 2.2 * dt;
      t.vy *= 1 - 2.2 * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.staub.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
  }

  // Die Kamera: beim Drehen nah am Ring – der Sektor beginnt im Bild. Beim
  // Abwurf zieht sie gleich so weit auf, dass die ganze Bahn bis zum
  // Aufschlag zu sehen ist, mit der gelben Linie; danach fährt sie zurück.
  function kameraZiel() {
    const f = state.flug;
    if ((state.schritt === "flug" || state.schritt === "liegt" || (state.schritt === "aus" && f)) && f) {
      const weit = Math.max(f.ziel, quali(state.wurf));
      return { x: 0, y: Math.max(3.2, weit * 0.5 - 1), h: Math.max(15, weit * 1.08 + 10) };
    }
    return { x: 0, y: 3.2, h: 15 };
  }

  function kameraTakt(dt) {
    const z = kameraZiel();
    const k = 1 - Math.exp(-dt * (state.schritt === "flug" ? 4.5 : 2.4));
    state.cam.x += (z.x - state.cam.x) * k;
    state.cam.y += (z.y - state.cam.y) * k;
    state.cam.h += (z.h - state.cam.h) * k;
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    messen();
    takt(dt);
    zeichnen();
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  function staubBei(x, y, farbe, anzahl) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * TAU;
      const v = 1.5 + Math.random() * 4;
      state.staub.push({ x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v, r: 0.25 + Math.random() * 0.45, farbe, leben: 0.6 + Math.random() * 0.6, max: 1.2 });
    }
  }

  function funken(x, y, anzahl) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * TAU;
      const v = 3 + Math.random() * 6;
      state.staub.push({ x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v, r: 0.12 + Math.random() * 0.2, farbe: i % 2 ? "#ffd23f" : "#fff4c2", leben: 0.5 + Math.random() * 0.5, max: 1, funke: true });
    }
  }

  // Eine Schrift in der Welt (x, y in Metern), gross in Bildpunkten.
  function schrift(text, x, y, farbe, gross, dauer = 1.4) {
    state.schriften.push({ text, x, y, farbe, gross, leben: dauer, max: dauer });
    if (state.schriften.length > 5) state.schriften.shift();
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "hw-platz");
    feld = shell.el("div", "hw-feld");
    canvas = document.createElement("canvas");
    canvas.className = "hw-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");
    // Der Hinweis vor dem ersten Tipp: ein Finger, der tippt.
    const tipp = shell.el("span", "hw-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    const ring = document.createElementNS(ns, "circle");
    ring.setAttribute("cx", "32");
    ring.setAttribute("cy", "32");
    ring.setAttribute("r", "22");
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", "#ffffff");
    ring.setAttribute("stroke-width", "4");
    ring.setAttribute("class", "hw-tipp-ring");
    const punkt = document.createElementNS(ns, "circle");
    punkt.setAttribute("cx", "32");
    punkt.setAttribute("cy", "32");
    punkt.setAttribute("r", "9");
    punkt.setAttribute("fill", "#ffffff");
    svg.append(ring, punkt);
    tipp.append(svg);
    feld.append(tipp);
    platz.append(feld);
    return platz;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
  }

  // Von der Welt ins Bild: Die Kamera zeigt cam.h Meter in der Höhe (oder,
  // im Hochformat, in der Breite), mit cam.y etwas unter der Mitte.
  function kamera() {
    const nutzH = view.cssH - view.frei;
    const kurz = Math.min(view.cssW, nutzH);
    view.s = kurz / state.cam.h;
    view.mx = view.cssW / 2;
    view.my = view.frei + nutzH * 0.56;
  }
  const bx = (x) => view.mx + (x - state.cam.x) * view.s;
  const by = (y) => view.my - (y - state.cam.y) * view.s;
  const wackel = () => (ruhig() ? 0 : Math.sin(state.zeit * 61) * 5 * state.stoss);

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  function zeichnen() {
    if (!g) return;
    kamera();
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, wackel() * view.dpr);
    zeichneRasen();
    zeichneSektor();
    zeichneMarken();
    zeichneKaefig();
    zeichneSpur();
    zeichneWerfer();
    zeichneHammerImFlug();
    zeichneStaub();
    zeichneFahne();
    zeichneSchriften();
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    zeichneAnzeige();
    zeichneDrehungen();
  }

  // Der Rasen: gemäht in Bahnen quer zum Feld, dunkler zum Rand hin wie unter
  // Flutlicht.
  function zeichneRasen() {
    const W = view.cssW;
    const H = view.cssH;
    g.fillStyle = "#2f6b2e";
    g.fillRect(-10, -10, W + 20, H + 20);
    const bahn = 5;
    const y0 = Math.floor((state.cam.y - (H / view.s)) / bahn) * bahn;
    const y1 = state.cam.y + H / view.s;
    for (let y = y0; y < y1; y += bahn) {
      if (Math.round(y / bahn) % 2) continue;
      g.fillStyle = "rgba(255, 255, 255, 0.045)";
      g.fillRect(0, by(y + bahn), W, bahn * view.s);
    }
    // Das Licht: hell in der Mitte, dunkel an den Rändern.
    const licht = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.2, W / 2, H * 0.45, Math.max(W, H) * 0.85);
    licht.addColorStop(0, "rgba(255, 244, 214, 0.08)");
    licht.addColorStop(1, "rgba(5, 12, 20, 0.55)");
    g.fillStyle = licht;
    g.fillRect(-10, -10, W + 20, H + 20);
  }

  // Der Sektor: zwei weisse Linien vom Ring hinaus, dazwischen Bögen alle zehn
  // Meter mit ihrer Zahl, die Mittellinie fein, und die Qualifikationslinie
  // gelb.
  function zeichneSektor() {
    const n = state.wurf;
    const s = rad(sektorBei(n));
    const weit = Math.max(110, state.cam.y + state.cam.h * 1.5);
    const mitte = Math.PI / 2;
    // Die Fläche im Sektor ein wenig heller.
    g.fillStyle = "rgba(255, 255, 255, 0.05)";
    g.beginPath();
    g.moveTo(bx(0), by(0));
    g.lineTo(bx(Math.cos(mitte - s) * weit), by(Math.sin(mitte - s) * weit));
    g.lineTo(bx(Math.cos(mitte + s) * weit), by(Math.sin(mitte + s) * weit));
    g.closePath();
    g.fill();
    // «Mitte!»: ein schmaler Keil, kaum zu sehen – wer ihn sucht, findet ihn.
    const m = s * MITTE;
    g.fillStyle = "rgba(255, 210, 63, 0.07)";
    g.beginPath();
    g.moveTo(bx(0), by(0));
    g.lineTo(bx(Math.cos(mitte - m) * weit), by(Math.sin(mitte - m) * weit));
    g.lineTo(bx(Math.cos(mitte + m) * weit), by(Math.sin(mitte + m) * weit));
    g.closePath();
    g.fill();
    // Die Linien.
    g.strokeStyle = "rgba(255, 255, 255, 0.92)";
    g.lineWidth = Math.max(1.5, 0.12 * view.s);
    g.beginPath();
    for (const seite of [-1, 1]) {
      g.moveTo(bx(Math.cos(mitte + seite * s) * RING_R), by(Math.sin(mitte + seite * s) * RING_R));
      g.lineTo(bx(Math.cos(mitte + seite * s) * weit), by(Math.sin(mitte + seite * s) * weit));
    }
    g.stroke();
    // Die Bögen alle zehn Meter.
    g.lineWidth = Math.max(1, 0.06 * view.s);
    g.strokeStyle = "rgba(255, 255, 255, 0.35)";
    g.font = `800 ${Math.round(clamp(view.s * 1.1, 11, 18))}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let r = 10; r <= 100; r += 10) {
      if (by(r) < -40 || by(r) > view.cssH + 40) continue;
      g.beginPath();
      g.arc(bx(0), by(0), r * view.s, -mitte - s, -mitte + s);
      g.stroke();
      if (view.s * 10 > 26) {
        g.fillStyle = "rgba(255, 255, 255, 0.55)";
        g.fillText(`${r}`, bx(Math.cos(mitte + s) * r) - 16, by(Math.sin(mitte + s) * r));
      }
    }
    // Die Qualifikation dieses Wurfs.
    const q = quali(n);
    if (by(q) > -30 && by(q) < view.cssH + 30) {
      g.strokeStyle = "#ffd23f";
      g.lineWidth = Math.max(2, 0.16 * view.s);
      g.setLineDash([Math.max(4, view.s * 0.8), Math.max(3, view.s * 0.5)]);
      g.beginPath();
      g.arc(bx(0), by(0), q * view.s, -mitte - s - 0.02, -mitte + s + 0.02);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = "#ffd23f";
      g.font = `900 ${Math.round(clamp(view.s * 1.2, 12, 20))}px system-ui, sans-serif`;
      g.fillText(`Q ${q.toFixed(1)}`, clamp(bx(Math.cos(mitte - s) * q) + 24, 40, view.cssW - 40), by(Math.sin(mitte - s) * q));
    }
  }

  // Wo die Würfe dieser Runde lagen: kleine Fähnchen mit der Weite.
  function zeichneMarken() {
    for (const m of state.marken) {
      const X = bx(m.x);
      const Y = by(m.y);
      if (X < -40 || X > view.cssW + 40 || Y < -40 || Y > view.cssH + 40) continue;
      const farbe = m.aus ? "#ff7a6b" : m.mitte ? "#ffd23f" : "#ffffff";
      g.fillStyle = "rgba(60, 40, 20, 0.55)";
      g.beginPath();
      g.ellipse(X, Y, Math.max(3, 0.6 * view.s), Math.max(2, 0.4 * view.s), 0, 0, TAU);
      g.fill();
      g.strokeStyle = farbe;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(X, Y);
      g.lineTo(X, Y - 18);
      g.stroke();
      g.fillStyle = farbe;
      g.beginPath();
      g.moveTo(X, Y - 18);
      g.lineTo(X + 11, Y - 14);
      g.lineTo(X, Y - 10);
      g.closePath();
      g.fill();
    }
  }

  // Der Käfig: ein Netz im Halbkreis um den Ring, offen zum Sektor hin – so
  // weit, wie der Sektor und NETZ_RAND zusammen.
  function zeichneKaefig() {
    const n = state.wurf;
    const offen = rad(sektorBei(n) + NETZ_RAND);
    const mitte = Math.PI / 2;
    // Der Betonkreis mit weissem Rand.
    g.fillStyle = "#8d8f94";
    g.beginPath();
    g.arc(bx(0), by(0), (RING_R + 0.5) * view.s, 0, TAU);
    g.fill();
    g.fillStyle = "#6f7277";
    g.beginPath();
    g.arc(bx(0), by(0), RING_R * view.s, 0, TAU);
    g.fill();
    g.strokeStyle = "#ffffff";
    g.lineWidth = Math.max(1.5, 0.08 * view.s);
    g.beginPath();
    g.arc(bx(0), by(0), RING_R * view.s, 0, TAU);
    g.stroke();
    // Das Netz.
    const von = -(mitte + offen);
    const bis = -(mitte - offen) - TAU;
    g.strokeStyle = state.aus === "netz" && state.stoss > 0.05 ? "#ffb0a8" : "rgba(235, 240, 245, 0.85)";
    g.lineWidth = Math.max(2, 0.14 * view.s);
    g.beginPath();
    g.arc(bx(0), by(0), KAEFIG_R * view.s, von, bis, true);
    g.stroke();
    // Die Maschen als feine Striche, und die Pfosten.
    g.strokeStyle = "rgba(235, 240, 245, 0.28)";
    g.lineWidth = 1;
    const schritte = 26;
    for (let i = 0; i <= schritte; i += 1) {
      const a = von - ((TAU - 2 * offen) * i) / schritte;
      g.beginPath();
      g.moveTo(bx(Math.cos(-a) * (KAEFIG_R - 0.3)), by(Math.sin(-a) * (KAEFIG_R - 0.3)));
      g.lineTo(bx(Math.cos(-a) * (KAEFIG_R + 0.3)), by(Math.sin(-a) * (KAEFIG_R + 0.3)));
      g.stroke();
    }
    g.fillStyle = "#d8dde4";
    for (let i = 0; i <= 6; i += 1) {
      const a = von - ((TAU - 2 * offen) * i) / 6;
      g.beginPath();
      g.arc(bx(Math.cos(-a) * KAEFIG_R), by(Math.sin(-a) * KAEFIG_R), Math.max(2.5, 0.16 * view.s), 0, TAU);
      g.fill();
    }
  }

  // Die Spur des Hammers: beim Drehen ein Bogen hinter ihm, im Flug eine
  // Linie, die verblasst.
  function zeichneSpur() {
    const spur = state.spur;
    if (spur.length < 2) return;
    g.lineCap = "round";
    for (let i = 1; i < spur.length; i += 1) {
      const k = i / spur.length;
      const a = spur[i - 1];
      const b = spur[i];
      g.strokeStyle = `rgba(255, 255, 255, ${0.5 * k})`;
      g.lineWidth = Math.max(1, 0.22 * view.s * k);
      g.beginPath();
      g.moveTo(bx(a.x), by(a.y + (a.h || 0) * 0.35));
      g.lineTo(bx(b.x), by(b.y + (b.h || 0) * 0.35));
      g.stroke();
    }
    g.lineCap = "butt";
  }

  // Der Werfer von oben: Schultern, Kopf, die Arme zum Hammer – er schaut
  // immer dorthin, wo der Hammer ist. Dazu Draht und Kugel, solange er sie
  // hält.
  function zeichneWerfer() {
    const s = view.s;
    const X = bx(0);
    const Y = by(0);
    const haelt = state.schritt === "anschwung" || state.schritt === "drehen" || state.phase === "bereit";
    const th = state.th;
    // Wohin er schaut: zum Hammer; nach dem Wurf dem Hammer hinterher.
    const blick = haelt ? th : state.flug ? state.flug.phi : th;
    g.save();
    g.translate(X, Y);
    g.rotate(-blick);
    // Schatten.
    g.fillStyle = "rgba(0, 0, 0, 0.25)";
    g.beginPath();
    g.ellipse(0.15 * s, 0.15 * s, 0.45 * s, 0.38 * s, 0, 0, TAU);
    g.fill();
    // Die Arme: zum Hammer gestreckt (in der Blickrichtung, +x).
    if (haelt) {
      g.strokeStyle = "#f1c7a0";
      g.lineWidth = Math.max(2, 0.13 * s);
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(0.05 * s, -0.22 * s);
      g.lineTo(0.62 * s, -0.02 * s);
      g.moveTo(0.05 * s, 0.22 * s);
      g.lineTo(0.62 * s, 0.02 * s);
      g.stroke();
    }
    // Schultern (Trikot).
    g.fillStyle = "#e8262f";
    g.beginPath();
    g.ellipse(0, 0, 0.26 * s, 0.42 * s, 0, 0, TAU);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillRect(-0.05 * s, -0.42 * s, 0.1 * s, 0.84 * s);
    // Der Kopf.
    g.fillStyle = "#3a2a22";
    g.beginPath();
    g.arc(0.02 * s, 0, 0.17 * s, 0, TAU);
    g.fill();
    g.restore();
    if (!haelt) return;
    // Draht und Kugel.
    const hx = bx(Math.cos(th) * HAMMER_R);
    const hy = by(Math.sin(th) * HAMMER_R);
    const gx = bx(Math.cos(th) * 0.62);
    const gy = by(Math.sin(th) * 0.62);
    g.strokeStyle = "rgba(220, 225, 230, 0.9)";
    g.lineWidth = Math.max(1, 0.04 * s);
    g.beginPath();
    g.moveTo(gx, gy);
    g.lineTo(hx, hy);
    g.stroke();
    kugel(hx, hy, 0);
  }

  // Die Kugel: dunkles Eisen mit Glanz, ihr Schatten umso weiter weg, je
  // höher sie fliegt.
  function kugel(X, Y, h) {
    const s = view.s;
    const r = Math.max(4, 0.2 * s * (1 + h * 0.03));
    if (h > 0.05) {
      g.fillStyle = "rgba(0, 0, 0, 0.3)";
      g.beginPath();
      g.ellipse(X + h * 0.12 * s, Y + h * 0.12 * s, r, r * 0.75, 0, 0, TAU);
      g.fill();
    }
    const y = Y - h * 0.35 * s;
    const k = g.createRadialGradient(X - r * 0.35, y - r * 0.35, r * 0.1, X, y, r);
    k.addColorStop(0, "#d6dbe2");
    k.addColorStop(0.45, "#5c6470");
    k.addColorStop(1, "#1d2229");
    g.fillStyle = k;
    g.beginPath();
    g.arc(X, y, r, 0, TAU);
    g.fill();
  }

  function zeichneHammerImFlug() {
    const f = state.flug;
    if (!f || state.schritt === "anschwung" || state.schritt === "drehen") return;
    kugel(bx(f.x), by(f.y), state.schritt === "flug" ? f.h : 0);
  }

  function zeichneStaub() {
    for (const t of state.staub) {
      const k = clamp(t.leben / t.max, 0, 1);
      g.globalAlpha = t.funke ? k : k * 0.6;
      g.fillStyle = t.farbe;
      g.beginPath();
      g.arc(bx(t.x), by(t.y), Math.max(1, t.r * view.s * (t.funke ? 1 : 1.6 - k * 0.6)), 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  // Die Windfahne neben dem Käfig: Sie zeigt den Wind dieses Wurfs –
  // Rückenwind feldwärts (nach oben), Gegenwind zurück.
  function zeichneFahne() {
    const wind = windBei(state.wurf);
    const X = bx(-KAEFIG_R - 1.8);
    const Y = by(1.2);
    const s = view.s;
    g.fillStyle = "#d8d8d8";
    g.beginPath();
    g.arc(X, Y, Math.max(2, 0.12 * s), 0, TAU);
    g.fill();
    if (!wind) return;
    const d = wind > 0 ? -1 : 1;
    const lang = (0.6 + Math.abs(wind) / WIND_MAX) * 0.9 * s;
    const welle = Math.sin(state.zeit * (6 + Math.abs(wind) * 2)) * 0.12 * s;
    g.fillStyle = wind > 0 ? "#3dff8c" : "#ff9f6b";
    g.beginPath();
    g.moveTo(X - 0.25 * s, Y);
    g.quadraticCurveTo(X + welle, Y + d * lang * 0.5, X, Y + d * lang);
    g.quadraticCurveTo(X + 0.12 * s + welle, Y + d * lang * 0.5, X + 0.25 * s, Y);
    g.closePath();
    g.fill();
  }

  function zeichneSchriften() {
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const t of state.schriften) {
      const k = clamp(t.leben / t.max, 0, 1);
      const X = clamp(bx(t.x), 70, view.cssW - 70);
      const Y = clamp(by(t.y) - (1 - k) * 18, view.frei + 70, view.cssH - 30);
      g.globalAlpha = Math.min(1, k * 2.5);
      g.font = `900 ${Math.round(t.gross)}px system-ui, sans-serif`;
      g.lineWidth = Math.max(3, t.gross * 0.2);
      g.lineJoin = "round";
      g.strokeStyle = "rgba(8, 20, 12, 0.8)";
      g.strokeText(t.text, X, Y);
      g.fillStyle = t.farbe;
      g.fillText(t.text, X, Y);
    }
    g.globalAlpha = 1;
  }

  function pille(text, x, y, gross, grund, farbe) {
    g.font = `900 ${gross}px system-ui, sans-serif`;
    const w = g.measureText(text).width + gross * 1.4;
    const h = gross * 1.7;
    g.fillStyle = grund;
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, h / 2);
    else g.rect(x, y, w, h);
    g.fill();
    g.fillStyle = farbe;
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText(text, x + gross * 0.7, y + h / 2 + 1);
    return h;
  }

  // Oben links, unter den Knöpfen: die Meter, darunter Wurf, Qualifikation,
  // Wind und die Reihe der «Mitte!».
  function zeichneAnzeige() {
    if (state.phase === "bereit") return;
    g.save();
    g.translate(0, view.frei);
    const gross = clamp(view.cssH * 0.05, 14, 24);
    const x = 12;
    let y = 12;
    y += pille(`${state.punkte} m`, x, y, Math.round(gross), "rgba(10, 24, 14, 0.62)", "#ffffff") + 6;
    const klein = Math.round(gross * 0.6);
    y += pille(`Wurf ${state.wurf + 1} · über ${quali(state.wurf).toFixed(1)} m`, x, y, klein, "rgba(255, 210, 63, 0.92)", "#2a1d00") + 5;
    const wind = windBei(state.wurf);
    if (wind) {
      y += pille(`${wind > 0 ? "Rückenwind" : "Gegenwind"} ${Math.abs(wind).toFixed(1)} m/s`, x, y, klein, "rgba(10, 24, 14, 0.55)", wind > 0 ? "#9ff5bd" : "#ffc2a8") + 5;
    }
    if (state.kette > 0) {
      pille(`Nächste Mitte: +${BONUS * Math.min(state.kette + 1, BONUS_MAX)} m`, x, y, klein, "rgba(10, 24, 14, 0.55)", "#ffd23f");
    }
    g.restore();
  }

  // Unter dem Ring, solange er dreht: die wievielte Drehung – und wie weit
  // der Hammer jetzt flöge. Die letzte Drehung leuchtet rot.
  function zeichneDrehungen() {
    if (state.schritt !== "drehen" || state.phase === "bereit") return;
    const d = drehungenBei(state.dreh);
    const nr = Math.min(DREH_MAX, Math.floor(d) + 1);
    const letzte = nr >= DREH_MAX;
    const gross = Math.round(clamp(view.cssH * 0.045, 14, 22));
    g.font = `900 ${gross}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const weite = weiteAus(state.w) * (1 + WIND_ANTEIL * windBei(state.wurf));
    const text = `${nr}. Drehung · ${Math.floor(weite)} m`;
    const w = g.measureText(text).width + gross * 1.4;
    // Unter dem Käfig – oder, wo dort kein Platz ist (quer), rechts daneben.
    const unten = by(0) + KAEFIG_R * view.s + 28;
    const passt = unten + gross < view.cssH - 6;
    const X = passt ? bx(0) : Math.min(view.cssW - w / 2 - 10, bx(KAEFIG_R) + w / 2 + 16);
    const Y = passt ? unten : by(0);
    g.fillStyle = letzte ? "rgba(255, 59, 48, 0.88)" : "rgba(10, 24, 14, 0.62)";
    g.beginPath();
    if (g.roundRect) g.roundRect(X - w / 2, Y - gross * 0.85, w, gross * 1.7, gross * 0.85);
    else g.rect(X - w / 2, Y - gross * 0.85, w, gross * 1.7);
    g.fill();
    g.fillStyle = weite >= quali(state.wurf) ? "#ffffff" : "#ffc2a8";
    g.fillText(text, X, Y + 1);
  }

  // ---------------------------------------------------------------------------
  // Im Multiplayer und beim Anschauen: die Würfe als Züge
  // ---------------------------------------------------------------------------
  /*
   * Ein Zug je Wurf (und einer fürs Übertreten):
   *
   *   a   die Richtung beim Loslassen, Grad mal 1000 (90 000: Mittellinie)
   *   b   das Tempo, Umdrehungen je Sekunde mal 10 000
   *   c   Wurf × 8 + wie: 0 gültig, 1 Mitte, 2 ungültig, 3 Netz, 4 zu kurz,
   *       5 übergetreten
   *
   * Wer zuschaut, lässt den Werfer sich drehen, bis der Zug dran ist, und
   * lässt dann genau so los – die Weite folgt aus derselben Rechnung und
   * demselben Wind.
   */
  const AUS_CODE = { "": 0, mitte: 1, ungueltig: 2, netz: 3, kurz: 4, uebertreten: 5 };

  function meldeZug(phi, w, e) {
    if (state.phase !== "spiel") return;
    // Die Punkte nach diesem Wurf: bei einem gültigen die Meter und der Bonus.
    let p = state.punkte;
    if (!e.aus) p += Math.floor(e.weite) + (e.mitte ? BONUS * Math.min(state.kette + 1, BONUS_MAX) : 0);
    const wie = e.aus ? AUS_CODE[e.aus] : e.mitte ? 1 : 0;
    const ort = { a: Math.round(normGrad(phi) * 1000), b: Math.round(w * 10000), c: (state.wurf + 1) * 8 + wie };
    aufnahme?.zug(p, ort);
    const live = window.LernappLiveSpiel;
    if (shell?.live && live?.zug && live.gestartet?.()) live.zug(p, ort);
  }

  // Einen Zug abspielen: Steht der Werfer noch beim vorigen Wurf, geht es
  // sofort zu diesem; dreht er, lässt er jetzt los.
  function zugAnwenden(probe) {
    const nr = Math.floor(probe.c / 8) - 1;
    if (nr < 0) return;
    const wie = probe.c % 8;
    if (nr > state.wurf || (nr === state.wurf && state.schritt !== "anschwung" && state.schritt !== "drehen")) {
      // Was dazwischen lag, steht schon da.
      if (state.flug && state.schritt === "flug") { state.flug.t = state.flug.dauer; schrittTakt(0); }
      wurfAufbauen(nr);
    }
    if (state.schritt === "anschwung") { state.schritt = "drehen"; state.dreh = 0; }
    // Die Punkte nach diesem Wurf stehen in der Aufzeichnung – gezeigt
    // werden sie erst, wenn der Hammer unten ist (landen).
    state.punkteNach = probe.p;
    if (wie === 5) {
      state.dreh = DREH_ENDE;
      uebertreten();
      shell.setCount(state.punkte);
      return;
    }
    const phi = probe.a / 1000;
    const w = probe.b / 10000;
    loslassen(rad(phi - 90), w);
  }

  function zuschauenTakt() {
    if (!zuschauer?.seit) return;
    const jetzt = zuschauer.jetzt();
    zuschauer.seit(gesehenBis, jetzt).forEach((probe) => {
      zugAnwenden(probe);
      gesehenBis = probe.t;
    });
    // Beim Zuschauen dreht er nie über: Kommt der Zug später, dreht er
    // gleichmässig weiter.
    if (state.schritt === "drehen" && state.dreh > DREH_ENDE - 0.05) state.dreh = DREH_ENDE - 0.05;
    zuschauer.weiter?.();
  }

  function zuschauenStarten() {
    if (!zuschauer?.seit) return;
    startRun();
    state.phase = "zuschauen";
    shell.setPhase("play");
    gesehenBis = -Infinity;
    state.punkteNach = undefined;
    zuschauer.los?.();
    zuschauenTakt();
  }

  // ---------------------------------------------------------------------------
  // Tippen
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Tipp – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    shell.setPhase("play");
    gegner?.los();
    aufnahme?.los();
    wurfAufbauen(0);
  }

  // Ein Tipp: vor der Runde der Start, beim Drehen das Loslassen.
  function tippen() {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    if (state.phase === "bereit") {
      if (!shell.live) losGehts();
      return;
    }
    if (state.schritt === "drehen") loslassen(state.th, state.w);
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    clearStep();
    stopLoop();
    klangAus();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.punkte = 0;
    state.plan = [];
    state.marken = [];
    state.kette = 0;
    state.besteKette = 0;
    state.mitten = 0;
    state.weiteste = 0;
    state.aus = "";
    state.staub = [];
    state.schriften = [];
    state.stoss = 0;
    state.zeit = 0;
    state.cam = { x: 0, y: 3.2, h: 15 };
    state.punkteNach = undefined;
    planBis(12);
    wurfAufbauen(0);
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt hw-prompt", "Er dreht sich, immer schneller – tippe, und er lässt los. Triff den Sektor, wirf über die gelbe Linie.");
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
    const dauer = Math.min(900, 200 + ziel * 1.5);
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

  const GRUND = {
    netz: "Ins Netz – früher oder später loslassen",
    ungueltig: "Neben dem Sektor",
    kurz: "Zu kurz – eine Drehung mehr",
    uebertreten: `Übergetreten – nach ${DREH_MAX} Drehungen loslassen`,
  };

  function finish() {
    if (state.phase === "zuschauen") return;
    clearStep();
    stopLoop();
    klangAus();
    if (state.phase === "ende") return;
    state.phase = "ende";
    const punkte = state.punkte;
    const geist = aufnahme?.ende(gegner?.ende(punkte) || null) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    const gueltig = state.marken.filter((m) => !m.aus).length;
    const wuerfe = gueltig === 1 ? "1 gültiger Wurf" : `${gueltig} gültige Würfe`;
    const weiteste = state.weiteste ? `weitester ${state.weiteste.toFixed(1)} m` : "";
    shell.showResult({
      label: "Deine Meter",
      points: punkte,
      detail: rekord ? `Neuer Rekord! ${wuerfe}` : [[wuerfe, weiteste].filter(Boolean).join(", "), GRUND[state.aus] || "", vorher ? `Bestwert ${vorher} m` : ""].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("hw-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Hammerwurf",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "hammerThrow", fassung: "z1", zufall, zuege: true, nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "hammerThrow", host, art: "ziel" }) || null;
    aufnahme = window.LernappGeist?.zuege?.({ fassung: "z1", zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    tippen();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter" && event.key !== "ArrowUp") return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    tippen();
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); klangAus(); });

  // Für die Prüfskripte und die Vorführung.
  window.LernappHammerwurf = {
    TAKT, W0, W_MAX, DREH_MAX, DREH_ENDE, HAMMER_R, SEKTOR, NETZ_RAND, MITTE, BONUS, BONUS_MAX,
    state, view, takt, zeichnen, tippen, losGehts, weltText, planBis, windBei,
    sektorBei, quali, tempoBei, drehungenBei, weiteAus, ergebnis, normGrad,
  };
})();
