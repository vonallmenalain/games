// Kletterwand: gut zwanzig Meter über dem Platz, die Abendsonne über dem Tal.
// Der Pilot tippt Griff um Griff an – meist genau auf den Bolzen, ab und zu
// knapp daneben –, und die Kletterin steigt den Turm hinauf.
export default {
  bereit: () => Boolean(window.LernappKletterwand?.state?.wand && window.LernappKletterwand.view.cssW > 0),
  spiele: () => {
    const K = window.LernappKletterwand;
    const st = K.state;
    // Scharf bleiben, auch wenn der Rechner für die Aufnahme langsam zeichnet.
    K.guete(1);
    // Wie weit neben der Mitte der Finger aufsetzt, in Anteilen des Halbmessers.
    const neben = [0.1, 0.25, 0.05, 0.6, 0.15, 0.3, 0.1, 0.2, 0.7, 0.1, 0.15, 0.35];
    let n = 0;
    const tippe = () => {
      const q = K.pilot(st.wand, st.k);
      if (!q) return;
      const ort = K.griffOrt(q, st.k.t);
      const weg = neben[n % neben.length] * q.r;
      const w = n * 2.4;
      const p = K.imBild([ort.x + Math.cos(w) * weg, ort.y + Math.sin(w) * weg, 0.04]);
      const flaeche = document.querySelector("#kw-stage canvas");
      const r = flaeche.getBoundingClientRect();
      flaeche.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: "touch", clientX: r.left + p.x, clientY: r.top + p.y,
      }));
      n += 1;
    };
    // Die ersten zwanzig Meter im Zeitraffer: Bild für Bild gerechnet, ohne
    // zu zeichnen.
    for (let wache = 0; wache < 80 && st.k.hoch < 20 && !st.endet; wache += 1) {
      tippe();
      for (let i = 0; i < 28; i += 1) K.takt(1 / 60);
    }
    // Von da an in der Zeit des Spiels: ein Griff alle halbe Sekunde, jeder
    // fünfte mit einem Zögern.
    let naechster = st.zeit + 0.4;
    const tick = () => {
      if (st.phase === "ende" || st.endet) return;
      requestAnimationFrame(tick);
      if (st.zeit < naechster) return;
      tippe();
      naechster = st.zeit + 0.5 + (n % 5 === 0 ? 0.25 : 0);
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 600,
  dauer: 10000,
  // Das Standbild: mitten in einem Zug – eine Hand ist unterwegs zum nächsten
  // Griff, die andere hält.
  bild: 1200,
  bildWenn: () => {
    const K = window.LernappKletterwand;
    const zug = K.fig.zug;
    if (K.state.endet || !zug || zug.sprung || zug.fehl) return false;
    const k = K.fig.hand[zug.hand].k;
    return k > 0.5 && k < 0.82;
  },
};
