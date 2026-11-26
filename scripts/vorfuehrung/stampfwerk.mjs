// Stampfwerk: Die Maus läuft genau nach dem Weg, um den die Takte gebaut
// sind – sie hält vor jedem Hammer und schlüpft durch, sobald er hochgeht.
export default {
  bereit: () => Boolean(window.LernappStampfwerk?.state?.plan?.length > 1 && window.LernappStampfwerk.view.cssW > 0),
  spiele: () => {
    const K = window.LernappStampfwerk;
    const st = K.state;
    const tick = () => {
      requestAnimationFrame(tick);
      if (st.phase === "bereit") { K.druecken(performance.now()); return; }
      if (st.phase !== "spiel" || st.schritt === "aus") return;
      const m = st.maus;
      const p = st.plan[st.plan.findIndex((pl) => pl.letzter + K.ZONE > m.x)];
      const soll = m.x < p.p - 1 ? true : st.uhr >= p.s;
      if (soll && !st.halten) K.druecken(performance.now());
      else if (!soll && st.halten) K.loslassen(performance.now());
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 2500,
  dauer: 10000,
  bild: 3500,
  // Sie rennt gerade mitten unter einem Hammer durch, der über ihr hängt,
  // und nebenan hat eben einer geschlagen: Funken und Glut sind im Bild.
  // Findet sich das nicht bald, genügt weniger.
  bildWenn: () => {
    const K = window.LernappStampfwerk;
    const st = K.state;
    if (st.phase !== "spiel" || st.schritt === "aus") return false;
    window.__smSeit = window.__smSeit || performance.now();
    const gewartet = (performance.now() - window.__smSeit) / 1000;
    if (gewartet > 18) return st.halten;
    const h = st.haemmer[st.naechster];
    const unter = Boolean(h) && st.halten && Math.abs(st.maus.x - h.x) < 7;
    if (!unter || st.punkte < 4) return false;
    if (gewartet > 8) return true;
    const glut = st.haemmer.filter((x) => x.x > st.camX + 20 && x.x < st.camX + K.view.w - 10 && x.glut > 0.5).length;
    return glut >= 1 && st.punkte >= 6;
  },
};
