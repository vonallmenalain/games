// Polwechsel: Die Kugel fällt durch den Schacht, und es wird umgepolt, wann
// der Weg es verlangt (genau zu den geplanten Zeiten). Vorweg wird bis in
// die Kristallhöhle gerechnet – dort glitzert der Magnetit. Das Bild
// entsteht, wenn die Kugel gerade quer fliegt und unter ihr eine Sperre
// wartet.
export default {
  bereit: () => Boolean(window.LernappPolwechsel?.state?.weg?.length && window.LernappPolwechsel.view.cssW > 0),
  spiele: () => {
    const K = window.LernappPolwechsel;
    const st = K.state;
    let j = 0;
    const auto = () => { while (st.weg[j] && st.weg[j].t <= st.t) { if (st.schritt === "fall") K.tippen(); j += 1; } };
    K.tippen();
    for (let n = 0; n < 2000000 && st.t < 27 && st.schritt === "fall"; n += 1) {
      K.planBis(st.t + 6, 4);
      auto();
      K.takt(1 / 240);
    }
    st.ansage = null;
    const tick = () => {
      requestAnimationFrame(tick);
      if (st.phase === "spiel") auto();
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 1500,
  dauer: 9000,
  bild: 2500,
  // Die Kugel unterwegs von einer Wand zur anderen, und eine Sperre ein
  // Stück unter ihr. Findet sich das nicht bald, genügt weniger.
  bildWenn: () => {
    const K = window.LernappPolwechsel;
    const st = K.state;
    if (st.schritt === "sturz") return true;
    window.__pwSeit = window.__pwSeit || performance.now();
    const gewartet = (performance.now() - window.__pwSeit) / 1000;
    if (gewartet > 6) return true;
    const k = st.kugel;
    const quer = Math.abs(k.x) > 5 && Math.abs(k.x) < 19;
    const sperre = st.sperren.some((s) => s.y0 > k.y + 30 && s.y0 < k.y + 90);
    return quer && sperre;
  },
};
