// Seifenblase: Die Blase fliegt die Rennstrecke entlang, und es wird neben
// sie getippt, wohin die Bahn es verlangt (der Autopilot des Spiels, etwas
// schneller als der Zeitplan). Das Bild entsteht, wenn gerade ein Luftstoss
// zu sehen ist und die Bahn vor der Blase eine Kurve macht.
export default {
  bereit: () => Boolean(window.LernappSeifenblase?.state?.bahn?.x?.length > 10 && window.LernappSeifenblase.view.cssW > 0),
  spiele: () => {
    const K = window.LernappSeifenblase;
    const st = K.state;
    const tick = () => {
      requestAnimationFrame(tick);
      if (st.phase === "bereit") { K.losGehts(); return; }
      if (st.phase !== "spiel" || st.schritt === "geplatzt") return;
      const p = K.pilot({ abstand: 0.12, raser: 110, kurve: 160 });
      if (p) K.tippeWelt(p.x, p.y, performance.now());
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 2500,
  dauer: 10000,
  bild: 6500,
  // Ein Luftstoss im Bild, und vor der Blase biegt die Bahn ab. Findet sich
  // das nicht bald, genügt weniger.
  bildWenn: () => {
    const K = window.LernappSeifenblase;
    const st = K.state;
    if (st.schritt === "geplatzt") return true;
    window.__sbSeit = window.__sbSeit || performance.now();
    const gewartet = (performance.now() - window.__sbSeit) / 1000;
    if (gewartet > 8) return true;
    const stoss = st.stossBilder.some((s) => s.zeit > 0.06 && s.zeit < 0.2 && s.kraft > 20);
    if (!stoss) return false;
    const B = st.bahn;
    let dreh = 0;
    for (let i = st.blase.i + 10; i < Math.min(B.x.length, st.blase.i + 70); i += 1) dreh += Math.abs(B.k[i]) * K.DS;
    return dreh > 1.2;
  },
};
