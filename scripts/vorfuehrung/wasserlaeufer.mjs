// Wasserläufer: Er steht auf einem Seerosenblatt, und der Autopilot des
// Spiels zielt wie mit einer Schleuder – der Pfeil zeigt Richtung und
// Stärke, der Ring auf dem Blatt, wie lange es noch trägt. Das Bild
// entsteht beim Zielen, mit gut gespannten Beinen.
export default {
  bereit: () => Boolean(window.LernappWasserlaeufer?.state?.blaetter?.length > 3 && window.LernappWasserlaeufer.view.cssW > 0),
  spiele: () => {
    const K = window.LernappWasserlaeufer;
    const st = K.state;
    const tick = () => {
      requestAnimationFrame(tick);
      if (st.phase === "bereit") { K.losGehts(); return; }
      if (st.phase !== "spiel" || st.schritt === "tot") return;
      const z = K.pilot({ reaktion: 0.6, zeigen: true });
      if (z) K.schleudern(z.w, z.st, performance.now());
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 2500,
  dauer: 10000,
  bild: 5500,
  // Er zielt, ein paar Blätter weit oben, kräftig gespannt. Findet sich
  // das nicht bald, genügt weniger.
  bildWenn: () => {
    const K = window.LernappWasserlaeufer;
    const st = K.state;
    if (st.schritt === "tot") return true;
    window.__waSeit = window.__waSeit || performance.now();
    const gewartet = (performance.now() - window.__waSeit) / 1000;
    if (gewartet > 8) return true;
    const z = st.zug;
    return Boolean(st.l.sitz && z?.aktiv && z.st > (gewartet > 5 ? 0.3 : 0.55) && st.punkte >= (gewartet > 4 ? 1 : 3));
  },
};
