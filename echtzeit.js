/*
 * echtzeit.js – Der Baustein für Spiele zu zweit, die in Echtzeit laufen.
 * ---------------------------------------------------------------------------
 * Die Spiele zu zweit (zwei.js) gehen Zug um Zug: Jeder Zug hängt etwas an
 * die Züge der Partie, und jedes Gerät rechnet daraus dasselbe Bild. Ein
 * Echtzeit-Spiel (Kanu, Weichen, Raumschiff) braucht dazu eine Uhr:
 *
 *   «S»          Los! – ab hier zählt die Uhr (Ticks zu 100 ms). Jedes Gerät
 *                stellt seine Uhr, wenn es «S» sieht (nach einem Neuladen so,
 *                dass sie hinter dem letzten Zug steht).
 *   «a37:L»      Eine Aktion: wer, bei welchem Tick, was. Je Spielerin
 *                laufen die Ticks nur vorwärts.
 *   «E412»       Das Ende bei Tick 412: Wer zuerst sieht, dass es aus ist,
 *                schickt es. Gerechnet wird nur mit den Aktionen bis dorthin
 *                – so kommen alle Geräte auf denselben Ausgang, auch wenn
 *                eine Aktion spät ankam.
 *
 * Das Spiel bringt eine Simulation mit: simuliere(aktionen, bisTick) → der
 * Stand bei diesem Tick, mit ende null, «g» (geschafft) oder «v». Aktionen
 * werden nach Tick geordnet, bei gleichem Tick erst a, dann b (und je
 * Spielerin in der Reihenfolge der Züge) – so hängt nichts daran, wessen
 * Zug zuerst ankam. Die Simulation muss bei denselben Aktionen immer
 * dasselbe ergeben.
 *
 * Der Baustein: LernappEchtzeit.lese(zuege) → { gestartet, aktionen, ende,
 * kaputt, letzterTick }, darfAktion(…), und eine Uhr je Partie:
 * uhrFuer(schluessel) – der Schlüssel sagt, welche Partie (Modus, Nummer,
 * Saat), damit eine Computer-Partie und ein Duell mit derselben Nummer
 * nicht dieselbe Uhr teilen.
 */
(() => {
  "use strict";

  const TICK_MS = 100;
  const AKTION = /^([ab])(0|[1-9]\d{0,4}):([A-Z][0-9A-Z]{0,3})$/;
  const ENDE = /^E(0|[1-9]\d{0,4})$/;

  // Die Züge lesen: ob gestartet, die Aktionen (geordnet), das Ende.
  function lese(zuege, { aktionGueltig = () => true, maxTick = 99999 } = {}) {
    const aktionen = [];
    const letzter = { a: -1, b: -1 };
    let gestartet = false;
    let ende = null;
    for (let i = 0; i < zuege.length; i += 1) {
      const z = zuege[i];
      if (!gestartet) {
        if (z !== "S") return { gestartet, aktionen, ende, kaputt: true, letzterTick: -1 };
        gestartet = true;
        continue;
      }
      if (ende !== null) return { gestartet, aktionen, ende, kaputt: true, letzterTick: Math.max(letzter.a, letzter.b) };
      const e = ENDE.exec(z);
      if (e) { ende = Number(e[1]); continue; }
      const m = AKTION.exec(z);
      if (!m) return { gestartet, aktionen, ende, kaputt: true, letzterTick: Math.max(letzter.a, letzter.b) };
      const wer = m[1];
      const tick = Number(m[2]);
      if (tick < letzter[wer] || tick > maxTick || !aktionGueltig(wer, m[3])) return { gestartet, aktionen, ende, kaputt: true, letzterTick: Math.max(letzter.a, letzter.b) };
      letzter[wer] = tick;
      aktionen.push({ wer, tick, art: m[3], i });
    }
    aktionen.sort((x, y) => x.tick - y.tick || (x.wer === y.wer ? x.i - y.i : x.wer < y.wer ? -1 : 1));
    return { gestartet, aktionen, ende, kaputt: false, letzterTick: Math.max(letzter.a, letzter.b), letzter };
  }

  // Ob eine Aktion jetzt passt: Format, eigene Ticks nur vorwärts.
  function darfAktion(l, zug, sitz, { aktionGueltig = () => true, maxTick = 99999 } = {}) {
    if (!l.gestartet || l.ende) return false;
    const m = AKTION.exec(zug);
    if (!m || m[1] !== sitz) return false;
    const tick = Number(m[2]);
    return tick >= (l.letzter?.[sitz] ?? -1) && tick <= maxTick && aktionGueltig(sitz, m[3]);
  }

  // Die Uhr einer Partie: gestellt, wenn «S» zum ersten Mal da ist – nach
  // einem Neuladen so, dass sie hinter dem letzten Zug steht.
  function uhr() {
    let t0 = null;
    return {
      stellen(letzterTick = -1) {
        if (t0 !== null) return;
        t0 = performance.now() - Math.max(0, letzterTick + 1) * TICK_MS;
      },
      tick() { return t0 === null ? 0 : Math.max(0, Math.floor((performance.now() - t0) / TICK_MS)); },
      // Wie weit zwischen zwei Ticks (für flüssige Bewegung).
      bruch() { return t0 === null ? 0 : ((performance.now() - t0) / TICK_MS) % 1; },
      laeuft: () => t0 !== null,
    };
  }

  // Je Partie eine Uhr – das Brett und der Computer finden sie über
  // denselben Schlüssel.
  const uhren = new Map();
  function uhrFuer(schluessel) {
    if (!uhren.has(schluessel)) {
      if (uhren.size > 30) uhren.clear();
      uhren.set(schluessel, uhr());
    }
    return uhren.get(schluessel);
  }

  window.LernappEchtzeit = { TICK_MS, lese, darfAktion, uhr, uhrFuer, AKTION, ENDE };
})();
