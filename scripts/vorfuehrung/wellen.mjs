// Wellenreiter: Der Surfer drückt bergab, hebt am Kamm ab und setzt auf der
// Rückseite der nächsten Welle auf – perfekt, wieder und wieder: Flow.
export default {
  bereit: () => Boolean(window.LernappWellen?.state?.s),
  spiele: () => {
    const W = window.LernappWellen;
    const st = W.state;
    // Wie er landet, wenn er von jetzt an schwer (oder leicht) bleibt.
    const landet = (schwer) => {
      let u = st.s.u; let y = st.s.y; let vu = st.s.vu; let vy = st.s.vy;
      const g = schwer ? W.G_SCHWER : W.G_LEICHT;
      for (let i = 0; i < 1200; i += 1) {
        vy -= g / 240; u += vu / 240; y += vy / 240;
        if (y <= W.wasserBei(u)) {
          const s = W.steigungBei(u);
          const len = Math.hypot(1, s);
          const vn = (vu * -s + vy) / len;
          const vt = (vu + vy * s) / len;
          const w = Math.atan2(Math.abs(vn), Math.max(1, Math.abs(vt)));
          return { perfekt: s < -0.05 && w < W.PERFEKT_WINKEL * 0.92 && vt > 0, hart: w > W.SCHLECHT_WINKEL };
        }
      }
      return { perfekt: false, hart: true };
    };
    // Am Wasser: bergab drücken. In der Luft: leicht bleiben, solange das
    // perfekt aufsetzt – sonst schwer, wenn erst das passt.
    const will = () => {
      if (st.amBoden) return W.steigungBei(st.s.u) < -0.02;
      const leicht = landet(false);
      if (leicht.perfekt) return false;
      const schwer = landet(true);
      return schwer.perfekt || (leicht.hart && !schwer.hart);
    };
    const tick = () => {
      requestAnimationFrame(tick);
      if (st.phase !== "spiel") return;
      if (will()) W.druecken(); else W.loslassen();
    };
    W.druecken();
    W.loslassen();
    requestAnimationFrame(tick);
  },
  // Nach gut einer halben Minute: im Flow, im goldenen Abendlicht.
  vorlauf: 34000,
  dauer: 10000,
};
