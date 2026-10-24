// Windschichten: Der Ballon reitet die goldenen Schichten nach Osten – er
// steigt und sinkt rechtzeitig vor jedem Wechsel, über ihm der blaue
// Gegenwind, unter ihm die orange schnelle Schicht mit ihrem Gewitter über
// dem Tal, dazu Berge und ein «perfekt!» nach dem anderen.
export default {
  bereit: () => Boolean(window.LernappBallon?.state?.f),
  spiele: () => {
    const B = window.LernappBallon;
    const st = B.state;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    // Immer dieselbe Welt (Saat 61): So steht im Standbild sicher der schöne
    // Moment, nicht irgendeiner.
    B.festeWelt(61);
    // Er folgt dem sicheren Weg (zielBei, die Höhe des Messpunkts) ein Stück
    // voraus und heizt, wenn die Hülle kühler ist, als es dafür nötig wäre
    // (Wärme → Auftrieb → Steigen, alles mit Verzug).
    const tick = () => {
      requestAnimationFrame(tick);
      if (st.phase === "bereit") { B.druecken(); B.loslassen(); return; }
      if (st.schritt !== "fahrt") return;
      const f = st.f;
      const v = Math.max(40, f.vx);
      let ziel = 0;
      for (const t of [0.3, 0.6, 0.9, 1.2]) ziel += (B.zielBei(f.x + v * t) - B.MESS) / 4;
      const vyZiel = clamp((ziel - f.y) * 1.8, -0.8 * B.VT, 0.8 * B.VT);
      const kraft = B.DAEMPF * vyZiel + (vyZiel - f.vy) * 4;
      if (st.hitze < 0.5 + kraft / (2 * B.AUF)) B.druecken(); else B.loslassen();
    };
    requestAnimationFrame(tick);
  },
  // Nach 25 s ist er um 200 m: die Schichten schon enger, die ersten
  // Gewitter in den schnellen, der Himmel am Vormittag.
  vorlauf: 25000,
  dauer: 10000,
  // Das Standbild: 32 s nach dem Start (bild, in ms), also 7 s in den Film
  // (standbild, in s – so liest es filme-aufnehmen.mjs).
  bild: 32000,
  standbild: 7,
};
