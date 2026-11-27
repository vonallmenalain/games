// Wasserläufer: Er dreht sich auf den Seerosenblättern, und der Autopilot
// des Spiels rudert genau dann, wenn der Schlag auf dem nächsten Blatt
// landet. Das Bild entsteht, wenn er gerade gleitet – mit Ringen hinter
// sich und dem nächsten Blatt vor sich.
export default {
  bereit: () => Boolean(window.LernappWasserlaeufer?.state?.blaetter?.length > 3 && window.LernappWasserlaeufer.view.cssW > 0),
  spiele: () => {
    const K = window.LernappWasserlaeufer;
    const st = K.state;
    const tick = () => {
      requestAnimationFrame(tick);
      if (st.phase === "bereit") { K.losGehts(); return; }
      if (st.phase !== "spiel" || st.schritt === "tot") return;
      if (K.pilot()) K.tippen(performance.now());
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 2500,
  dauer: 10000,
  bild: 5500,
  // Er gleitet über offenes Wasser, eben erst abgestossen. Findet sich das
  // nicht bald, genügt weniger.
  bildWenn: () => {
    const K = window.LernappWasserlaeufer;
    const st = K.state;
    if (st.schritt === "tot") return true;
    window.__waSeit = window.__waSeit || performance.now();
    const gewartet = (performance.now() - window.__waSeit) / 1000;
    if (gewartet > 8) return true;
    const L = st.l;
    return !L.sitz && st.t - st.letzterSchlag > 0.12 && st.t - st.letzterSchlag < 0.3;
  },
};
