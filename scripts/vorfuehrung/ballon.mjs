// Ballonfahrt: Im Abendrot fährt der Ballon die Gasse entlang – unter den
// Gewittern durch, über Berge, Felsnadeln und Felsbögen hinweg.
export default {
  bereit: () => Boolean(window.LernappBallon?.state?.f),
  spiele: () => {
    const B = window.LernappBallon;
    const st = B.state;
    const tick = () => {
      requestAnimationFrame(tick);
      if (st.schritt !== "fahrt") return;
      // Die Mitte der Gasse voraus, gemittelt – und welche Hitze es braucht,
      // um rechtzeitig dort zu sein (Wärme → Auftrieb → Steigen, mit Verzug).
      const f = st.f;
      let ziel = 0;
      for (const t of [0.3, 0.6, 0.9, 1.2]) ziel += B.mitteBei(f.x + f.vx * t) / 4;
      const vyZiel = Math.max(-0.8 * B.VT, Math.min(0.8 * B.VT, (ziel - f.y) * 1.8));
      const kraft = B.DAEMPF * vyZiel + (vyZiel - f.vy) * 4;
      if (st.hitze < 0.5 + kraft / (2 * B.AUF)) B.druecken(); else B.loslassen();
    };
    B.druecken();
    B.loslassen();
    requestAnimationFrame(tick);
  },
  // Gewitter hängen erst ab 600 m; nach gut 80 s ist er um 1260 m, im Abendrot.
  vorlauf: 80000,
  dauer: 10000,
};
