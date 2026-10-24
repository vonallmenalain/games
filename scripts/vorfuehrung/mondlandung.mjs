// Mondlandung: Die Fähre hüpft sparsam von Plattform zu Plattform – kurz
// Schub, lange gleiten, im Leitstrahl spät bremsen und sanft aufsetzen
// («Sparsam! +200»), dann tanken und weiter.
export default {
  bereit: () => Boolean(window.LernappMondlandung?.state?.platten?.length),
  spiele: () => {
    const M = window.LernappMondlandung;
    const st = M.state;
    // Der sparsame Pilot aus check-spiele (4g7), im Bildtakt: Schub, bis die
    // Bahn ohne weiteren Schub übers Gelände in den Leitstrahl führt, dann
    // gleiten und im Leitstrahl so spät wie möglich bremsen.
    const bremsweg = (v) => (v > 0 ? (v * v) / (2 * (M.SCHUB - M.G)) : 0);
    const pilot = () => {
      const f = st.f;
      if (st.schritt === "gelandet" || st.schritt === "start") {
        // Kurz stehen bleiben, damit man sieht, was die Landung gebracht hat.
        const los = st.schritt === "start" || st.zeit - st.schrittZeit > 0.45;
        M.schub(los);
        M.neige(0);
        return;
      }
      if (st.schritt !== "flug") { M.schub(false); M.neige(null); return; }
      const p = st.platten[st.auf + 1];
      const mitte = (p.x0 + p.x1) / 2;
      if (st.strahl) {
        M.neige(0);
        M.schub(-f.vy > 25 && f.y - 13 - p.y < bremsweg(-f.vy) * 1.15 + 6);
        return;
      }
      // Wohin führt die Bahn ohne Schub? Übers Gelände in den Leitstrahl,
      // hoch genug, um dort noch zu bremsen?
      let x = f.x;
      let y = f.y;
      const vx = f.vx;
      let vy = f.vy;
      let gut = false;
      const r = Math.sign(mitte - f.x) || 1;
      for (let i = 0; i < 600; i += 1) {
        vy -= M.G / 60;
        x += vx / 60;
        y += vy / 60;
        const drueber = x > p.x0 - 18 && x < p.x1 + 18;
        if (!drueber && y - 13 <= M.bodenBei(x) + 12) break;
        if (drueber && vy < 0 && y - 13 - p.y < 160) { gut = y - 13 - p.y > bremsweg(-vy) * 1.3 + 14; break; }
        if (vy < 0 && y - 13 < p.y - 10) break;
      }
      if (gut) { M.neige(0); M.schub(false); return; }
      const zuSchnell = Math.sign(f.vx) === r && Math.abs(f.vx) > Math.max(40, Math.abs(mitte - f.x) * 0.9);
      M.neige(zuSchnell ? 0 : r * 0.5);
      M.schub(true);
    };
    const tick = () => {
      if (st.phase === "ende" || st.schritt === "crash" || st.gestrandet) { M.schub(false); return; }
      requestAnimationFrame(tick);
      pilot();
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 3500,
  dauer: 10000,
};
