// Seifenblase: Die Blase steigt durch den Garten, und es wird neben sie
// getippt, wohin die Gasse es verlangt (der Autopilot des Spiels). Das Bild
// entsteht, wenn gerade ein Luftstoss zu sehen ist und über der Blase die
// nächste Reihe wartet.
export default {
  bereit: () => Boolean(window.LernappSeifenblase?.state?.weg?.length && window.LernappSeifenblase.view.cssW > 0),
  spiele: () => {
    const K = window.LernappSeifenblase;
    const st = K.state;
    const tick = () => {
      requestAnimationFrame(tick);
      if (st.phase === "bereit") { K.losGehts(); return; }
      if (st.phase !== "spiel" || st.schritt === "geplatzt") return;
      const p = K.pilot({ abstand: 0.16 });
      if (p) K.tippeWelt(p.x, p.y, performance.now());
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 2500,
  dauer: 10000,
  bild: 6500,
  // Ein Luftstoss im Bild, und eine Reihe ein Stück über der Blase. Findet
  // sich das nicht bald, genügt weniger.
  bildWenn: () => {
    const K = window.LernappSeifenblase;
    const st = K.state;
    if (st.schritt === "geplatzt") return true;
    window.__sbSeit = window.__sbSeit || performance.now();
    const gewartet = (performance.now() - window.__sbSeit) / 1000;
    if (gewartet > 8) return true;
    const stoss = st.stossBilder.some((s) => s.zeit > 0.06 && s.zeit < 0.2 && s.kraft > 20);
    if (!stoss) return false;
    const b = st.blase;
    return st.hindernisse.some((o) => o.box.y0 > b.y + 30 && o.box.y0 < b.y + 90);
  },
};
