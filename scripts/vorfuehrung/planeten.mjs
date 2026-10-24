// Planetenhüpfer: Der Astronaut springt flink von Planet zu Planet, meist
// mitten hinein («Volltreffer!») und mit viel Sauerstoff (+100) – an
// wandernden Planeten und kreisenden Monden vorbei.
export default {
  bereit: () => Boolean(window.LernappPlaneten?.state?.planeten?.length),
  spiele: () => {
    const P = window.LernappPlaneten;
    const st = P.state;
    const H = 1 / 120;
    // Ein Sprung, der in Bild k (ab jetzt) abginge: Wo landet er? Gerechnet
    // wie im Spiel (planeten.js, physik): geradeaus, die Planeten auf ihren
    // Bahnen, die Monde rundherum.
    const sprung = (theta, hoehe, t0) => {
      const p0 = st.planeten[st.auf];
      const m0 = P.mitte(p0, t0);
      let x = m0.x + Math.cos(theta) * (p0.r + hoehe);
      let y = m0.y + Math.sin(theta) * (p0.r + hoehe);
      const v = P.sprungBei(st.erreicht);
      const vx = Math.cos(theta) * v;
      const vy = Math.sin(theta) * v;
      let mondFrei = Infinity;
      for (let t = H; t < 2.2; t += H) {
        x += vx * H;
        y += vy * H;
        const uhr = t0 + t;
        for (let i = Math.max(0, st.auf - 2); i <= Math.min(st.planeten.length - 1, st.auf + 5); i += 1) {
          const p = st.planeten[i];
          const mond = P.mondBei(p, uhr);
          if (mond) mondFrei = Math.min(mondFrei, Math.hypot(x - mond.x, y - mond.y) - mond.r - 4);
          if (i === st.auf && t < 0.45) continue;
          const m = P.mitte(p, uhr);
          const rx = x - m.x;
          const ry = y - m.y;
          if (Math.hypot(rx, ry) < p.r + p.luft) {
            if (i <= st.auf || mondFrei < 12) return null;
            // Wie dicht an der Mitte vorbei – und wie tief in der Lufthülle
            // die Bahn liegt (Abstand zum Rand, für Bild-Ungenauigkeit).
            const vorbei = Math.abs(rx * vy - ry * vx) / v;
            if (vorbei > p.r + p.luft * 0.55) return null;
            return { i, vorbei: vorbei / p.r };
          }
        }
        if (mondFrei < 0) return null;
      }
      return null;
    };
    let dt = 1 / 60;
    let vorher = 0;
    const tick = (jetzt) => {
      if (st.phase === "ende" || st.schritt === "verloren") return;
      requestAnimationFrame(tick);
      if (vorher) dt = Math.min(1 / 30, Math.max(1 / 144, dt * 0.9 + ((jetzt - vorher) / 1000) * 0.1));
      vorher = jetzt;
      if (st.phase === "bereit") { P.tippen(); return; }
      if (st.phase !== "spiel" || st.schritt !== "lauf" || st.zeit - st.schrittZeit < 0.15) return;
      // Jetzt springen – oder ein paar Bilder später, wenn er dann besser
      // trifft? Mitten hinein (Volltreffer) ist gut genug; Warten kostet
      // Sauerstoff und Tempo.
      const dreh = P.drehBei(st.erreicht) * st.richtung;
      let best = null;
      let hoehe = st.hoehe;
      for (let k = 0; k <= 45; k += 1) {
        const r = sprung(st.theta + dreh * dt * k, hoehe, st.uhr + dt * k);
        if (r) {
          const wert = -2 * Math.max(0, r.vorbei - 0.25) - k * dt + (r.i === st.auf + 1 ? 0 : -0.3);
          if (!best || wert > best.wert) best = { wert, k };
        }
        hoehe += (12 - hoehe) * (1 - Math.exp(-dt * 12));
      }
      if (best && best.k === 0) P.tippen();
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 12000,
  dauer: 10000,
};
