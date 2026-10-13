/*
 * live-spiel.js – Ein Spiel als Runde eines Multiplayers.
 * ---------------------------------------------------------------------------
 * Im Multiplayer spielt niemand für sich. Die Spielseite steckt in einem
 * Rahmen der Live-Seite (live.js), und die sagt ihr, wann es losgeht, mit
 * welcher Welt und wie lange. Die Adresse trägt nur, welche Runde gemeint
 * ist (/turmbau?live=K7QMX2PA9Z&nr=3) – alles andere fragt diese Datei beim Rahmen
 * nach (LernappLiveRahmen.runde).
 *
 * Was sie tut:
 *
 *   Countdown    Bis zum Start liegt eine Tafel über dem Spiel, und jede
 *                Eingabe ist gesperrt. Gestartet wird nicht auf einen Tipp,
 *                sondern zur Serverzeit (startUm): Jedes Gerät rechnet sie in
 *                seine eigene Uhr um (versatz) und zählt selbst herunter. So
 *                laufen alle auf die Zehntelsekunde zusammen los, egal wie
 *                lange die Nachricht unterwegs war.
 *   Welt         Die Saat der Runde (zufall.js fragt saat()) – alle spielen
 *                dieselbe Welt.
 *   Punkte       Was die Bühne zählt (setCount) und, in den Spielen mit Geist
 *                im Bild, wo die Figur ist (geist.js, takt) – an den Rahmen,
 *                der es in die Datenbank schreibt.
 *   Zeitende     Hat der Multiplayer ein Zeitlimit, endet die Runde zur Serverzeit
 *                endeUm, auch mitten im Lauf (das Spiel gibt dafür stopp mit).
 *   Ende         Statt der Tafel mit «Noch einmal» – eine Runde gibt es hier
 *                nur einmal – geht das Ergebnis an den Rahmen und in die Hall
 *                of Fame (keine Übungsrunde). Eine Sekunde später zeigt die
 *                Seite, wie es bei den anderen steht.
 *   Gegner       In den Spielen mit Figur im Bild laufen die anderen als
 *                Geister mit (geist.js fragt gegner()): aus ihrer Lage, die
 *                zehnmal je Sekunde kommt, je so weit zurück, dass fast
 *                immer die nächste Probe schon da ist – gemessen, nicht
 *                geschätzt, meist um eine Fünftelsekunde. Dazwischen läuft
 *                eine weiche Kurve; nichts springt (siehe Die Lage der
 *                anderen).
 *   Zuschauen    Wer ausgeschieden ist, schaut eine Sekunde später dem zu,
 *                der vorne liegt und noch spielt: Das Spiel stellt seine
 *                Figur dorthin, wo der andere ist – dieselbe Wiedergabe wie
 *                beim Anschauen der besten Läufe (geist.js, zuschauer), nur
 *                aus der Lage statt aus einer Aufzeichnung, noch eine
 *                Zehntelsekunde weiter zurück, damit die Kamera ruhig bleibt.
 *                Oben lässt sich jeder antippen, der noch spielt. Wer gar
 *                nicht mitspielt, kann von Anfang an zuschauen.
 *
 * Ein Spiel braucht dafür nur dreierlei, beim Aufbau der Bühne mitgegeben
 * (game-shell.js, mount): los – die Runde beginnt jetzt, ohne Tipp –, stopp
 * – die Zeit ist um, das Ergebnis bitte jetzt – und, wo es eine Figur im Bild
 * hat, zuschauen – zeig ab jetzt diese Quelle statt der eigenen Figur.
 *
 * Ohne ?live= in der Adresse tut diese Datei nichts. Mit, aber ohne Rahmen
 * (jemand hat den Link der Runde allein geöffnet), führt sie zum Multiplayer.
 */
(() => {
  "use strict";

  const kids = () => window.LernappKids || null;
  const mini = () => window.LernappMini || null;

  function ausDerAdresse() {
    try {
      const p = new URLSearchParams(window.location.search);
      const code = String(p.get("live") || "").trim().toUpperCase();
      const nr = Number(p.get("nr"));
      if (!/^[A-Z2-9]{4,12}$/.test(code) || !Number.isInteger(nr) || nr < 0) return null;
      return { code, nr };
    } catch { return null; }
  }

  const adresse = ausDerAdresse();

  // Der Rahmen: die Live-Seite, in der diese Seite steckt. Dieselbe Herkunft,
  // also ein gewöhnlicher Aufruf – keine Nachrichten hin und her.
  function findeRahmen() {
    if (!adresse) return null;
    try {
      if (window.parent === window) return null;
      return window.parent.LernappLiveRahmen || null;
    } catch { return null; }
  }

  const rahmen = findeRahmen();
  let runde = null;
  try { runde = rahmen?.runde?.(adresse.code, adresse.nr) || null; } catch { runde = null; }

  const aktiv = () => Boolean(runde);
  // Wie oft die eigene Lage hinausgeht: zehnmal je Sekunde.
  const LAGE_MS = 90;
  // Wie weit die anderen hinter der Wirklichkeit gezeigt werden (verzug):
  // gemessen je Spieler, hier nur, wo es beginnt und wo es aufhört.
  const VERZUG_START = 200;
  const VERZUG_MIN = 60;
  const VERZUG_MAX = 700;
  const VERZUG_RAND = 20;
  // Wie schnell der Verzug wandern darf: 8 Millisekunden je Zehntelsekunde –
  // der Geist läuft dabei höchstens 8 % schneller oder langsamer.
  const VERZUG_TEMPO = 0.08;
  // Beim Zuschauen noch ein Stück mehr: Der, dem man zuschaut, ist die Figur,
  // und die Kamera hängt an ihr.
  const ZUSCHAU_EXTRA = 100;
  // Wie weit voraus gerechnet wird, wenn die nächste Probe doch einmal auf
  // sich warten lässt – länger stünde der Geist besser still.
  const VORAUS_MAX = 250;
  // Was eine späte Probe am Bild korrigiert, verschwindet in dieser Zeit.
  const GLATT_MS = 110;
  // Mehr als so weit daneben ist kein Ruckeln, sondern ein Sprung.
  const SPRUNG = 600;
  const PUFFER_MS = 6000;
  const verwaist = () => Boolean(adresse) && !runde;

  // Die Serverzeit, so gut dieses Gerät sie kennt.
  const versatz = () => { try { return Number(rahmen?.versatz?.()) || 0; } catch { return 0; } };
  const serverJetzt = () => Date.now() + versatz();
  // Wie lange die Runde schon läuft – auf allen Geräten dieselbe Zahl.
  const zeit = () => (runde ? serverJetzt() - runde.startUm : 0);

  function el(tag, klasse, text) {
    const knoten = document.createElement(tag);
    if (klasse) knoten.className = klasse;
    if (text !== undefined) knoten.textContent = text;
    return knoten;
  }

  const z = {
    host: null,
    los: null,
    stopp: null,
    gestartet: false,
    fertig: false,
    gestoppt: 0,
    sperre: true,
    punkte: 0,
    gesendet: { p: -1, ms: 0 },
    lageMs: 0,
    daten: { spieler: {}, punkte: {} },
    tafel: null,
    leiste: null,
    zahl: null,
    ticker: null,
    tafelAb: 0,
    bahnen: new Map(),
    laeufe: new Map(),
    zuschauen: null,
    gewaehlt: false,
    zielWegSeit: 0,
    zuschauHaken: null,
    nurZuschauen: false,
  };

  // --- Eingaben sperren -------------------------------------------------------
  // Vor dem Start und nach dem eigenen Ende gehört kein Tipp dem Spiel. Die
  // Spiele hören auf der Bühne und auf dem ganzen Dokument; davor steht nur
  // das Fenster selbst. Was im Kopf der Bühne steht (Ton, Vollbild) und was
  // diese Datei als frei markiert, bleibt bedienbar.
  const GESPERRT = ["pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend", "click", "keydown", "keyup"];
  function sperrt(ereignis) {
    if (!z.sperre) return;
    const ziel = ereignis.target;
    if (ziel?.closest?.("[data-live-frei], .cm-bar, .cm-vollbild")) return;
    if (ereignis.type.startsWith("key") && ereignis.key === "Tab") return;
    ereignis.stopPropagation();
    if (ereignis.cancelable && ereignis.type !== "touchstart" && ereignis.type !== "touchend") ereignis.preventDefault();
  }

  // --- An den Rahmen ----------------------------------------------------------
  function sende(fertig = false) {
    if (!rahmen || !runde) return;
    const jetzt = Date.now();
    if (!fertig && z.gesendet.p === z.punkte) return;
    if (!fertig && jetzt - z.gesendet.ms < 450) return;
    z.gesendet = { p: z.punkte, ms: jetzt };
    try { rahmen.melde({ p: z.punkte, fertig, t: Math.max(0, Math.round(zeit())) }); } catch { /* der Rahmen ist weg */ }
  }

  function punkte(wert) {
    if (!runde || z.fertig || !z.gestartet) return;
    const n = Math.max(0, Math.round(Number(wert) || 0));
    if (!Number.isFinite(n)) return;
    z.punkte = n;
    sende(false);
  }

  // Wo die Figur gerade ist – für die anderen, die sie im Bild mitlaufen
  // sehen. Zehnmal je Sekunde; dazwischen rechnen sie selbst.
  function lage(wert, ort) {
    if (!runde || z.fertig || !z.gestartet || !ort) return;
    const jetzt = Date.now();
    if (jetzt - z.lageMs < LAGE_MS) return;
    z.lageMs = jetzt;
    const zahl = (x) => (Number.isFinite(Number(x)) ? Math.round(Number(x)) : 0);
    try {
      rahmen.lage({ t: Math.max(0, Math.round(zeit())), a: zahl(ort.a), b: zahl(ort.b), c: zahl(ort.c), p: zahl(wert) });
    } catch { /* der Rahmen ist weg */ }
  }

  // --- Was die anderen machen ---------------------------------------------
  function name(kennung) {
    return z.daten.spieler?.[kennung]?.name || runde?.namen?.[kennung] || "?";
  }

  // Wer in dieser Runde mitspielt, mit seinen Punkten – die meisten vorn.
  function stand() {
    if (!runde) return [];
    const dabei = Object.keys(runde.dabei || {});
    const p = z.daten.punkte || {};
    return dabei.map((kennung) => {
      const e = p[kennung] || {};
      const ich = kennung === runde.ich.kennung;
      return {
        kennung,
        name: name(kennung),
        ich,
        p: ich ? Math.max(z.punkte, Number(e.p) || 0) : Math.max(0, Number(e.p) || 0),
        fertig: ich ? z.fertig : Boolean(e.fertig),
        online: z.daten.spieler?.[kennung]?.online !== false,
      };
    }).sort((a, b) => b.p - a.p || a.name.localeCompare(b.name, "de"));
  }

  function setze(knoten, text) {
    if (knoten && knoten.textContent !== text) knoten.textContent = text;
  }

  // «30 Sekunden», «2 Minuten», «1½ Minuten» – wie lange die Runde dauert.
  function dauerText(ms) {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s} Sekunden`;
    const min = s / 60;
    const ganz = Math.floor(min);
    const halb = min - ganz >= 0.5 ? "½" : "";
    return `${ganz}${halb} ${ganz === 1 && !halb ? "Minute" : "Minuten"}`;
  }

  function uhrText(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  // Die Leiste oben: die Zeit, falls es ein Limit gibt, und alle mit ihren
  // Punkten. Ausgeschiedene stehen blass da.
  function zeichneLeiste() {
    if (!z.leiste) return;
    const liste = stand();
    const kinder = [];
    if (runde.endeUm) {
      const rest = runde.endeUm - serverJetzt();
      const uhr = el("span", `lv-chip lv-uhr${rest < 10000 && rest > 0 ? " ist-knapp" : ""}`, uhrText(z.gestartet ? rest : runde.endeUm - runde.startUm));
      kinder.push(uhr);
    }
    let platz = 0;
    // Wer zuschauen kann, tippt einen Namen an – und schaut dem zu.
    const waehlbar = Boolean(z.zuschauHaken) && z.fertig && Date.now() >= z.tafelAb;
    liste.forEach((s, i) => {
      if (i === 0 || s.p !== liste[i - 1].p) platz = i + 1;
      const klick = waehlbar && !s.ich && !s.fertig && s.online && hatBahn(s.kennung);
      const klasse = `lv-chip${s.ich ? " ist-ich" : ""}${s.fertig ? " ist-fertig" : ""}${s.online ? "" : " ist-weg"}${s.kennung === z.zuschauen ? " ist-ziel" : ""}${klick ? " ist-waehlbar" : ""}`;
      const chip = el(klick ? "button" : "span", klasse);
      if (klick) {
        chip.type = "button";
        chip.dataset.liveFrei = "";
        chip.dataset.kennung = s.kennung;
        chip.title = `${s.name} zuschauen`;
      }
      chip.append(el("span", "lv-chip-platz", String(platz)), el("span", "lv-chip-name", s.ich ? "du" : s.name), el("span", "lv-chip-wert", String(s.p)));
      kinder.push(chip);
    });
    if (z.nurZuschauen && rahmen?.schliessen && !runde.gross) {
      const zu = el("button", "lv-chip lv-chip-zu", "Schliessen");
      zu.type = "button";
      zu.dataset.liveFrei = "";
      zu.dataset.zu = "";
      kinder.unshift(zu);
    }
    const alt = [...z.leiste.children].map((k) => k.className + k.textContent).join("|");
    const neu = kinder.map((k) => k.className + k.textContent).join("|");
    if (alt !== neu) z.leiste.replaceChildren(...kinder);
  }

  // --- Die Lage der anderen ---------------------------------------------------
  /*
   * Je Spieler eine Spur: die letzten Sekunden seiner Lage (proben, je
   * { t, a, b, c, p }, t in Millisekunden seit dem gemeinsamen Start) und wie
   * weit hinter der Wirklichkeit er gezeigt wird (verzug).
   *
   * Warum hinterher: Die Lage kommt zehnmal je Sekunde, und bis eine Probe
   * da ist, vergeht noch einmal eine Zehntelsekunde oder zwei. Wer den
   * anderen «jetzt» zeigen will, muss raten, wo er inzwischen ist – und
   * springt zurück, sobald die nächste Probe etwas anderes sagt. Das war das
   * Ruckeln. Statt dessen steht jeder gerade so weit zurück, dass fast immer
   * schon die Probe danach da ist, und dazwischen läuft eine weiche Kurve.
   *
   * Wie weit das ist, misst jedes Gerät selbst: Bei jeder neuen Probe, wie
   * alt die bis dahin neueste schon war (bedarf). Die zweitgrösste der
   * letzten zwanzig Messungen ist das Ziel, und der Verzug wandert langsam
   * dorthin (VERZUG_TEMPO). Kommt eine Probe doch einmal zu spät, geht es ein
   * Stück in der alten Richtung weiter; was die Probe dann noch korrigiert,
   * verschwindet in einer Zehntelsekunde (glatt) statt in einem Sprung.
   */
  function neueSpur() {
    return { proben: [], bedarf: [], verzug: VERZUG_START, ziel: VERZUG_START, uhr: 0, glatt: { a: 0, b: 0, seit: 0 } };
  }

  // In den Spielen, in denen c ein Winkel ist (mal 100), gleitet er mit;
  // sonst ist c ein Zustand (Ast, Schub …) und springt.
  const cIstWinkel = () => Boolean(runde && mini()?.ANSEHBAR?.[runde.spiel]?.winkel);

  function merkeLage(lagen) {
    if (!lagen || typeof lagen !== "object") return;
    Object.entries(lagen).forEach(([kennung, l]) => {
      if (!l || kennung === runde.ich.kennung || Number(l.n) !== runde.nr) return;
      const t = Number(l.t);
      if (!Number.isFinite(t)) return;
      let spur = z.bahnen.get(kennung);
      if (!spur) { spur = neueSpur(); z.bahnen.set(kennung, spur); }
      const { proben } = spur;
      const letzte = proben[proben.length - 1];
      if (letzte && t <= letzte.t) return;
      const neu = { t, a: Number(l.a) || 0, b: Number(l.b) || 0, c: Number(l.c) || 0, p: Number(l.p) || 0 };
      if (!letzte) { proben.push(neu); return; }

      const bedarf = zeit() - letzte.t;
      spur.bedarf.push(bedarf);
      if (spur.bedarf.length > 20) spur.bedarf.shift();
      const sortiert = [...spur.bedarf].sort((x, y) => x - y);
      const hoch = sortiert[Math.max(0, sortiert.length - 2)];
      spur.ziel = Math.max(VERZUG_MIN, Math.min(VERZUG_MAX, hoch + VERZUG_RAND));

      // Was die neue Probe an der Stelle ändert, die gerade im Bild ist –
      // das bleibt als Versatz stehen und verschwindet dann.
      const jetzt = geistZeit() - verzugVon(spur);
      const winkel = cIstWinkel();
      const vorher = kurve(proben, jetzt, false, winkel);
      const alt = glatt(spur);
      proben.push(neu);
      while (proben.length > 4 && proben[0].t < t - PUFFER_MS) proben.shift();
      const nachher = kurve(proben, jetzt, false, winkel);
      const da = vorher.a + alt.a - nachher.a;
      const db = vorher.b + alt.b - nachher.b;
      spur.glatt = Math.hypot(da, db) > SPRUNG ? { a: 0, b: 0, seit: 0 } : { a: da, b: db, seit: performance.now() };
    });
  }

  const hatBahn = (kennung) => (z.bahnen.get(kennung)?.proben.length || 0) > 0;
  const istFertig = (kennung) => Boolean(z.daten.punkte?.[kennung]?.fertig) || z.daten.spieler?.[kennung]?.online === false;

  // Wie weit dieser Spieler gerade zurücksteht – auf dem Weg zu seinem Ziel,
  // nie mit einem Ruck.
  function verzugVon(spur) {
    const jetzt = performance.now();
    const dt = spur.uhr ? Math.min(250, jetzt - spur.uhr) : 0;
    spur.uhr = jetzt;
    const schritt = dt * VERZUG_TEMPO;
    spur.verzug += Math.max(-schritt, Math.min(schritt, spur.ziel - spur.verzug));
    return spur.verzug;
  }

  // Der Rest der letzten Korrektur.
  function glatt(spur) {
    const g = spur.glatt;
    if (!g.seit) return { a: 0, b: 0 };
    const f = Math.exp(-(performance.now() - g.seit) / GLATT_MS);
    if (f < 0.01) { g.seit = 0; return { a: 0, b: 0 }; }
    return { a: g.a * f, b: g.b * f };
  }

  // Wie schnell sich k an Probe i ändert: aus beiden Nachbarn gemittelt
  // (harmonisch), null an einer Umkehr. So läuft die Kurve weich durch jede
  // Probe, ohne über sie hinauszuschiessen.
  function steigung(proben, i, k) {
    const p = proben[i];
    const vor = proben[i - 1];
    const nach = proben[i + 1];
    const d0 = vor ? (p[k] - vor[k]) / Math.max(1, p.t - vor.t) : null;
    const d1 = nach ? (nach[k] - p[k]) / Math.max(1, nach.t - p.t) : null;
    if (d0 === null) return d1 ?? 0;
    if (d1 === null) return d0;
    if (d0 * d1 <= 0) return 0;
    return (2 * d0 * d1) / (d0 + d1);
  }

  // Ein Stück Kurve von p0 nach p1 (kubisch, mit den Steigungen m0 und m1),
  // h Millisekunden lang, an der Stelle s zwischen 0 und 1.
  function hermite(p0, p1, m0, m1, h, s) {
    const s2 = s * s;
    const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * h * m0 + (3 * s2 - 2 * s3) * p1 + (s3 - s2) * h * m1;
  }

  // Wo jemand zur Zeit ms war: zwischen zwei Proben auf der Kurve, hinter der
  // letzten ein Stück in seiner Richtung weiter – ausser er ist fertig, dann
  // bleibt er stehen. c springt, wenn es kein Winkel ist; ein Winkel, der
  // sich zwischen zwei Proben um mehr als eine Vierteldrehung dreht, auch.
  function kurve(proben, ms, fertig, winkel) {
    if (!proben.length) return { a: 0, b: 0, c: 0 };
    const erste = proben[0];
    if (ms <= erste.t) return { a: erste.a, b: erste.b, c: erste.c };
    const n = proben.length;
    const letzte = proben[n - 1];
    if (ms >= letzte.t) {
      if (fertig || n < 2) return { a: letzte.a, b: letzte.b, c: letzte.c };
      const weiter = Math.min(ms - letzte.t, VORAUS_MAX);
      return { a: letzte.a + steigung(proben, n - 1, "a") * weiter, b: letzte.b + steigung(proben, n - 1, "b") * weiter, c: letzte.c };
    }
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mitte = (lo + hi) >> 1;
      if (proben[mitte].t <= ms) lo = mitte; else hi = mitte;
    }
    const s0 = proben[lo];
    const s1 = proben[hi];
    const h = Math.max(1, s1.t - s0.t);
    const s = (ms - s0.t) / h;
    const dc = s1.c - s0.c;
    return {
      a: hermite(s0.a, s1.a, steigung(proben, lo, "a"), steigung(proben, hi, "a"), h, s),
      b: hermite(s0.b, s1.b, steigung(proben, lo, "b"), steigung(proben, hi, "b"), h, s),
      c: winkel && Math.abs(dc) < 157 ? s0.c + dc * s : s < 0.5 ? s0.c : s1.c,
    };
  }

  // Ein Lauf, wie geist.js ihn kennt (abspieler) – nur aus der Lage, die
  // gerade hereinkommt, um den Verzug dieses Spielers zurück.
  function liveLauf(kennung) {
    if (z.laeufe.has(kennung)) return z.laeufe.get(kennung);
    const spur = () => z.bahnen.get(kennung) || neueSpur();
    const letzteT = (s) => s.proben[s.proben.length - 1]?.t ?? 0;
    const lauf = {
      mitOrt: true,
      saat: null,
      vorlauf: 0,
      get dauer() {
        const s = spur();
        return istFertig(kennung) && s.proben.length ? letzteT(s) + s.verzug : Infinity;
      },
      // Die Zeit des Laufs, die zur Zeit ms im Bild steht.
      zeitBei: (ms) => ms - verzugVon(spur()),
      ort(ms) {
        const s = spur();
        const o = kurve(s.proben, ms - verzugVon(s), istFertig(kennung), cIstWinkel());
        const g = glatt(s);
        return { a: o.a + g.a, b: o.b + g.b, c: o.c };
      },
      // Die Punkte zur Zeit ms – hinter der letzten Probe, was er zuletzt
      // gemeldet hat.
      wert(ms) {
        const s = spur();
        const t = ms - s.verzug;
        let p = 0;
        for (let i = 0; i < s.proben.length && s.proben[i].t <= t; i += 1) p = s.proben[i].p;
        const gemeldet = Number(z.daten.punkte?.[kennung]?.p) || 0;
        return s.proben.length && t >= letzteT(s) ? Math.max(p, gemeldet) : p;
      },
      fertig(ms) {
        const s = spur();
        return istFertig(kennung) && s.proben.length > 0 && ms - s.verzug > letzteT(s);
      },
    };
    z.laeufe.set(kennung, lauf);
    return lauf;
  }

  // Die Zeit, nach der die Geister im Bild stehen: beim Spielen jetzt, beim
  // Zuschauen ein Stück dahinter – dieselbe wie die der Figur. Jeder Lauf
  // zieht davon noch seinen eigenen Verzug ab.
  const geistZeit = () => (z.zuschauen ? zeit() - ZUSCHAU_EXTRA : zeit());

  /*
   * Wer als Geist im Bild mitläuft (geist.js, gegner): alle anderen, von
   * denen eine Lage da ist – wer vorne liegt in Gold. Beim Zuschauen ist der,
   * dem man zuschaut, dabei (ziel): Das Spiel zeichnet ihn nicht als Geist –
   * er ist ja die Figur –, aber sein Name steht an ihr.
   */
  function gegner() {
    if (!runde) return [];
    const farbe = window.LernappGeist?.FARBE || { erster: "#ffd23f", alle: "#d9c7ff" };
    const liste = stand();
    const vorne = liste.find((s) => !s.ich)?.kennung;
    const raus = [];
    liste.forEach((s) => {
      if (s.ich || !hatBahn(s.kennung)) return;
      const ziel = s.kennung === z.zuschauen;
      if (runde.gegner === false && !ziel) return;
      raus.push({
        art: s.kennung === vorne ? "erster" : "alle",
        name: s.name,
        punkte: s.p,
        lauf: liveLauf(s.kennung),
        ich: false,
        farbe: s.kennung === vorne ? farbe.erster : farbe.alle,
        ziel,
        kennung: s.kennung,
      });
    });
    // Gezeichnet wird von hinten nach vorn: die vielen, dann wer vorne liegt.
    return raus.sort((a, b) => Number(a.art === "erster") - Number(b.art === "erster"));
  }

  // --- Zuschauen ------------------------------------------------------------
  function starteZuschauen(kennung, { gewaehlt = false } = {}) {
    if (!z.zuschauHaken || !hatBahn(kennung)) return;
    const lauf = liveLauf(kennung);
    z.zuschauen = kennung;
    z.gewaehlt = gewaehlt;
    z.zielWegSeit = 0;
    const quelle = {
      live: true,
      kennung,
      lauf,
      get name() { return name(kennung); },
      los() {},
      zeit: geistZeit,
      // Wie geist.js, zuschauer: Ort, Tempo und Beschleunigung nach oben –
      // und die Zeit seines Laufs, die gerade im Bild ist (nach ihr stellt
      // der Planetenhüpfer seine Planeten, der Hügelflieger seine Sonne).
      stand() {
        const t = geistZeit();
        const ort = lauf.ort(t);
        const vor = lauf.ort(t - 60);
        const nach = lauf.ort(t + 60);
        const oben = lauf.ort(t - 250);
        const unten = lauf.ort(t + 250);
        return {
          a: ort.a, b: ort.b, c: ort.c,
          va: (nach.a - vor.a) / 0.12,
          vb: (nach.b - vor.b) / 0.12,
          ab: (unten.b - 2 * ort.b + oben.b) / 0.0625,
          punkte: lauf.wert(t),
          t: lauf.zeitBei(t),
        };
      },
      weiter: () => true,
    };
    if (z.tafel) z.tafel.hidden = true;
    z.host.dataset.live = "zuschauen";
    try { z.zuschauHaken(quelle); } catch (fehler) { console.warn("Zuschauen ging nicht", fehler); }
    zeichneLeiste();
  }

  function beendeZuschauen() {
    z.zuschauen = null;
    z.gewaehlt = false;
    z.host.dataset.live = "fertig";
    zeichneTafel();
  }

  // Nach dem eigenen Ende: wem zuschauen? Dem, der vorne liegt und noch
  // spielt. Ist der fertig, eine gute Sekunde später dem nächsten. Spielt
  // niemand mehr, kommt die Tafel.
  function zuschauTakt() {
    if (!z.zuschauHaken || !z.fertig || Date.now() < z.tafelAb || !z.gestartet) return;
    const liste = stand();
    const laeuft = (s) => !s.ich && !s.fertig && s.online && hatBahn(s.kennung);
    const ziel = z.zuschauen ? liste.find((s) => s.kennung === z.zuschauen) : null;
    if (ziel && laeuft(ziel)) { z.zielWegSeit = 0; return; }
    if (ziel && !z.zielWegSeit) { z.zielWegSeit = Date.now(); return; }
    if (ziel && Date.now() - z.zielWegSeit < 1200) return;
    const naechster = liste.find(laeuft);
    if (naechster) starteZuschauen(naechster.kennung);
    else if (z.zuschauen) beendeZuschauen();
  }

  // Nach dem eigenen Ende: wie es bei den anderen steht.
  function zeichneTafel() {
    if (!z.tafel || !z.fertig || Date.now() < z.tafelAb) return;
    if (z.zuschauen) { z.tafel.hidden = true; return; }
    // Wer zuschauen kann, wartet kurz, ob es jemanden gibt – erst dann die
    // Tafel.
    if (z.zuschauHaken && !z.tafelErlaubt) return;
    const liste = stand();
    const laufen = liste.filter((s) => !s.fertig && s.online).length;
    const karte = el("div", "lv-karte");
    karte.append(el("p", "lv-marke", runde.uebung ? runde.uebungText || "Übungsrunde" : `Runde ${runde.rundeText || ""}`.trim()));
    if (!z.nurZuschauen) {
      karte.append(el("p", "lv-gross", `${z.punkte}`));
      karte.append(el("p", "lv-klein", z.gestoppt ? "Die Zeit ist um." : "Deine Punkte in dieser Runde."));
    }
    const ol = el("ol", "lv-liste");
    let platz = 0;
    liste.forEach((s, i) => {
      if (i === 0 || s.p !== liste[i - 1].p) platz = i + 1;
      const li = el("li", `${s.ich ? "ist-ich" : ""}${s.fertig ? " ist-fertig" : ""}`.trim());
      li.append(el("span", "lv-platz", `${platz}.`), el("span", "lv-name", s.ich ? `${s.name} (du)` : s.name), el("span", "lv-wert", String(s.p)));
      if (!s.fertig && s.online) li.append(el("span", "lv-spielt", "spielt"));
      ol.append(li);
    });
    karte.append(ol);
    karte.append(el("p", "lv-klein", laufen ? (laufen === 1 ? "Einer spielt noch." : `${laufen} spielen noch.`) : "Alle sind fertig – gleich kommt die Auswertung."));
    const alt = z.tafel.textContent;
    const box = el("div");
    box.append(karte);
    if (alt !== box.textContent) z.tafel.replaceChildren(karte);
    z.tafel.hidden = false;
  }

  // --- Der Ablauf ---------------------------------------------------------
  function takt() {
    if (!runde) return;
    const jetzt = serverJetzt();
    const rest = runde.startUm - jetzt;
    if (!z.gestartet) {
      const countdown = Math.max(1000, (Number(runde.countdown) || 5) * 1000);
      if (rest > countdown) {
        setze(z.zahl, "");
        z.start.dataset.stufe = "warten";
      } else if (rest > 0) {
        // Die letzte Sekunde nicht im Takt der Uhr (alle 100 ms), sondern auf
        // die Millisekunde: Sonst lägen zwei Geräte bis zu einem Takt
        // auseinander.
        if (!z.startGeplant && rest <= 1000) {
          z.startGeplant = true;
          window.setTimeout(starte, Math.max(0, runde.startUm - serverJetzt()));
        }
        const n = String(Math.ceil(rest / 1000));
        if (z.zahl.textContent !== n) {
          setze(z.zahl, n);
          z.start.dataset.stufe = "zaehlen";
          z.zahl.classList.remove("is-pop");
          void z.zahl.offsetWidth;
          z.zahl.classList.add("is-pop");
          kids()?.playJingle?.("star");
        }
      } else {
        starte();
      }
    } else if (!z.fertig && !z.gestoppt && runde.endeUm && jetzt >= runde.endeUm) {
      z.gestoppt = Date.now();
      try { z.stopp?.(); } catch (fehler) { console.warn("Das Spiel liess sich nicht anhalten", fehler); }
    } else if (!z.fertig && z.gestoppt && Date.now() - z.gestoppt > 1500) {
      // Ein Spiel, das nicht hält, beendet die Runde trotzdem – mit dem, was
      // es bis jetzt gezählt hat. Manche brauchen einen Augenblick für ihr
      // Ende (der Heizer räumt erst auf); den bekommen sie.
      fertig({ punkte: z.punkte });
    }
    zuschauTakt();
    // Ohne jemanden, dem man zuschauen könnte, nach einer Weile die Tafel.
    if (z.fertig && !z.zuschauen && Date.now() >= z.tafelAb + 600) z.tafelErlaubt = true;
    zeichneLeiste();
    zeichneTafel();
  }

  function starte() {
    if (z.gestartet) return;
    z.gestartet = true;
    z.gestartetUm = serverJetzt();
    z.sperre = false;
    setze(z.zahl, "Los!");
    z.start.dataset.stufe = "los";
    kids()?.playJingle?.("unlock");
    kids()?.vibrate?.([10, 30, 10]);
    window.setTimeout(() => { z.start.hidden = true; }, 650);
    if (z.nurZuschauen) return;
    try { z.los?.(); } catch (fehler) { console.warn("Das Spiel liess sich nicht starten", fehler); }
  }

  /*
   * Die Runde ist für dieses Gerät zu Ende: das Ergebnis an den Rahmen, in
   * die Hall of Fame (ausser in der Übung) und eine Sekunde später die Tafel
   * mit den anderen.
   */
  function fertig({ punkte: wert, geist = null } = {}) {
    if (!runde || z.fertig) return;
    if (wert !== undefined) z.punkte = Math.max(0, Math.round(Number(wert) || 0));
    z.fertig = true;
    z.sperre = true;
    sende(true);
    const spiel = mini()?.spielId?.() || runde.spiel;
    if (!runde.uebung && z.punkte > 0 && spiel) {
      Promise.resolve().then(() => mini()?.melde?.(spiel, z.punkte, geist)).catch((fehler) => {
        console.warn("Die Runde kam nicht in die Hall of Fame", fehler);
      });
    }
    z.host.dataset.live = "fertig";
    z.tafelAb = Date.now() + 1000;
    window.setTimeout(zeichneTafel, 1020);
  }

  /*
   * Baut, was die Bühne im Live-Modus braucht. game-shell.js ruft das beim
   * Aufbau, mit
   *
   *   host   die Bühne
   *   vor    das Element, vor dem die Leiste stehen soll (die Spielfläche)
   *   los        was die Runde jetzt startet
   *   stopp      was sie jetzt beendet
   *   zuschauen  was ab jetzt eine fremde Figur zeigt (nur Spiele mit Figur)
   */
  function buehne({ host, vor = null, los, stopp, zuschauen = null }) {
    if (!runde || !host || z.host) return;
    z.host = host;
    z.los = los;
    z.stopp = stopp;
    z.zuschauHaken = typeof zuschauen === "function" ? zuschauen : null;
    host.dataset.live = "warten";
    // Wer nicht mitspielt, schaut von Anfang an zu: kein eigener Lauf, keine
    // Punkte, kein Eintrag.
    if (runde.nurZuschauen) {
      z.nurZuschauen = true;
      z.fertig = true;
      z.tafelAb = 0;
      host.dataset.live = "fertig";
    }

    z.leiste = el("div", "lv-leiste");
    z.leiste.setAttribute("aria-label", "Wer wie viele Punkte hat");
    if (vor && vor.parentNode === host) host.insertBefore(z.leiste, vor);
    else host.append(z.leiste);

    z.start = el("div", "lv-start");
    z.start.dataset.stufe = "warten";
    const karte = el("div", "lv-start-karte");
    // Eine Übung sagt nur, dass sie eine ist: «Übungsrunde 1 von 2».
    karte.append(
      el("p", "lv-marke", z.nurZuschauen ? "Du schaust zu" : runde.uebung ? runde.uebungText || "Übungsrunde" : `Runde ${runde.rundeText || ""}`.trim()),
      el("p", "lv-titel", runde.titel || ""),
    );
    if (!runde.uebung) karte.append(el("p", "lv-klein", runde.endeUm ? dauerText(runde.endeUm - runde.startUm) : "Bis alle ausgeschieden sind."));
    z.zahl = el("p", "lv-zahl");
    z.zahl.setAttribute("aria-live", "assertive");
    karte.append(z.zahl);
    z.start.append(karte);
    host.append(z.start);

    z.tafel = el("div", "lv-tafel");
    z.tafel.hidden = true;
    host.append(z.tafel);

    GESPERRT.forEach((typ) => window.addEventListener(typ, sperrt, { capture: true, passive: false }));

    try {
      rahmen.hoere((daten) => {
        z.daten = { spieler: daten?.spieler || {}, punkte: daten?.punkte || {} };
        merkeLage(daten?.lage);
      });
    } catch { /* ohne Nachrichten vom Rahmen steht nur die eigene Zahl da */ }

    // Einen Namen oben antippen: diesem zuschauen. «Schliessen» beim reinen
    // Zuschauen: zurück zum Multiplayer.
    z.leiste.addEventListener("click", (ereignis) => {
      const knopf = ereignis.target.closest?.("button");
      if (!knopf) return;
      if (knopf.dataset.zu !== undefined) { try { rahmen.schliessen?.(); } catch { /* egal */ } return; }
      if (knopf.dataset.kennung) starteZuschauen(knopf.dataset.kennung, { gewaehlt: true });
    });

    z.ticker = window.setInterval(takt, 100);
    takt();
  }

  // Jemand hat den Link einer Runde allein geöffnet: Hier läuft nichts – der
  // Weg führt zum Multiplayer.
  function zeigeVerwaist(host) {
    if (!verwaist() || !host) return;
    const tafel = el("div", "lv-start");
    tafel.dataset.stufe = "warten";
    const karte = el("div", "lv-start-karte");
    karte.append(el("p", "lv-marke", "Multiplayer"), el("p", "lv-titel", "Diese Runde gehört zu einem Multiplayer."));
    const weg = el("a", "lv-knopf", "Zum Multiplayer");
    weg.href = `/live?code=${encodeURIComponent(adresse.code)}`;
    weg.dataset.liveFrei = "";
    karte.append(weg);
    tafel.append(karte);
    host.append(tafel);
    z.sperre = true;
    GESPERRT.forEach((typ) => window.addEventListener(typ, sperrt, { capture: true, passive: false }));
  }

  window.addEventListener("pagehide", () => {
    if (z.ticker) window.clearInterval(z.ticker);
    z.ticker = null;
  });

  window.LernappLiveSpiel = {
    aktiv,
    verwaist,
    zeigeVerwaist,
    // Die Saat der Runde, für zufall.js – null, wenn hier nicht live gespielt wird.
    saat: () => (runde && Number.isInteger(runde.saat) ? runde.saat >>> 0 : null),
    zeit,
    serverJetzt,
    buehne,
    punkte,
    lage,
    fertig,
    gestartet: () => z.gestartet,
    // Wie viele Millisekunden nach dem gemeinsamen Start dieses Gerät
    // losgelaufen ist – für die Prüfung.
    startVerzug: () => (z.gestartet && runde ? z.gestartetUm - runde.startUm : null),
    istFertig: () => z.fertig,
    runde: () => runde,
    stand,
    gegner,
    geistZeit,
    // Wem gerade zugeschaut wird – null, wenn niemandem.
    zuschauen: () => z.zuschauen,
  };
})();
