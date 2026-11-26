// Bienenflug: Die Biene kreist um die Blüte und kehrt genau dort um, wo der
// Weg es vorsieht, um den die Runde gebaut ist – sie holt jeden Pollen und
// weicht jeder Wespe aus.
export default {
  bereit: () => Boolean(window.LernappBienenflug?.state?.weg?.length && window.LernappBienenflug.view.cssW > 0),
  spiele: () => {
    const K = window.LernappBienenflug;
    const st = K.state;
    const tick = () => {
      requestAnimationFrame(tick);
      if (st.phase === "bereit") { K.tippen(performance.now()); return; }
      if (st.phase !== "spiel" || st.schritt !== "flug") return;
      if (K.stueckBei(st.t).dir !== st.biene.dir) K.tippen(performance.now());
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 2500,
  dauer: 10000,
  bild: 5000,
  // Eine Wespe fliegt gerade über die Blüte, eine zweite kündigt sich an, es
  // liegt Pollen auf der Bahn, und die Biene ist nicht gerade in der Kehre.
  // Findet sich das nicht bald, genügt weniger.
  bildWenn: () => {
    const K = window.LernappBienenflug;
    const st = K.state;
    if (st.schritt !== "flug") return true;
    window.__bfSeit = window.__bfSeit || performance.now();
    const gewartet = (performance.now() - window.__bfSeit) / 1000;
    if (gewartet > 18) return true;
    const t = st.t;
    const mitten = st.wespen.filter((w) => t > w.t1 + 0.12 && t < w.t2 - 0.12).length;
    const angesagt = st.wespen.filter((w) => t > w.ab + 0.3 && t < w.t1 - 0.2).length;
    const pollen = st.pollen.filter((p) => p.zustand === 0 && t > p.von + 0.25 && t < p.bis - 0.4).length;
    const ruhigeBiene = t - st.biene.t0 > 0.25;
    if (!ruhigeBiene || mitten < 1 || pollen < 1) return false;
    if (gewartet > 8) return true;
    return angesagt >= 1 && pollen >= 2;
  },
};
