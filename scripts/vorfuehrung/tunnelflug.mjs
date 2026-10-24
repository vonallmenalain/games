// Tunnelflug: Das Flugzeug fliegt ruhig und sicher durch den Tunnel, der
// schon eng und schnell geworden ist – durch Kurven und an Felsnasen vorbei.
export default {
  bereit: () => Boolean(window.LernappTunnelflug?.state?.tunnel?.punkte?.length),
  spiele: () => {
    const T = window.LernappTunnelflug;
    const st = T.state;
    // Dieselbe Physik wie im Spiel (tunnelflug.js, physik) und die äussersten
    // Punkte desselben Umrisses: So rechnet der Autopilot voraus.
    const G = 560;
    const SCHUB = 1180;
    const UMRISS = [{ x: 14, y: 0 }, { x: 3, y: 6.2 }, { x: 3, y: -4.6 }, { x: -6, y: -3.6 }, { x: -9.5, y: 8.5 }, { x: -12, y: 1 }];
    const SICHT = 1.1;           // so viele Sekunden rechnet er voraus
    // Die Wände wie wandBei, nur ohne neue Objekte: zwischen den
    // Stützpunkten gerade.
    let punkte = [];
    const wand = (x, oben) => {
      const k = (x - punkte[0].x) / T.SEG;
      const i = Math.max(0, Math.min(punkte.length - 2, Math.floor(k)));
      const u = Math.max(0, Math.min(1, k - i));
      const a = oben ? punkte[i].oben : punkte[i].unten;
      const b = oben ? punkte[i + 1].oben : punkte[i + 1].unten;
      return a + (b - a) * u;
    };
    const mitte = (x) => (wand(x, true) + wand(x, false)) / 2;
    // Der einfache Teil: Halten, wenn die Mitte ein Stück voraus höher liegt,
    // als das Flugzeug bald ist (wie in check-spiele).
    const folgen = (x, y, vy, v) => {
      let ziel = 0;
      for (const d of [10, 25, 45, 70]) ziel += mitte(x + (d * v) / 200) / 4;
      return ziel - y - vy * 0.16 > 0;
    };
    // Davor ein Stück von Hand: n1 Bilder so, n2 Bilder umgekehrt.
    const FOLGEN = [{ a: true, n1: 0, n2: 0 }];
    for (const a of [true, false]) {
      for (const n1 of [1, 2, 3, 5, 8, 12, 18]) {
        for (const n2 of [0, 2, 4, 7, 11, 16]) FOLGEN.push({ a, n1, n2 });
      }
    }
    let dt = 1 / 60;
    let vorher = 0;
    let gedrueckt = false;
    const tick = (jetzt) => {
      if (st.phase === "ende" || st.schritt === "crash") return;
      requestAnimationFrame(tick);
      if (vorher) dt = Math.min(1 / 30, Math.max(1 / 144, dt * 0.9 + ((jetzt - vorher) / 1000) * 0.1));
      vorher = jetzt;
      if (st.phase === "bereit") { T.druecken(); gedrueckt = true; return; }
      if (st.phase !== "spiel" || st.schritt !== "flug") return;
      const n = Math.max(1, Math.ceil(dt * 240 - 1e-9));
      const h = dt / n;
      const bilder = Math.ceil(SICHT / dt);
      // Wo das Flugzeug in jedem der nächsten Bilder steht: Das Tempo hängt
      // nur an der Strecke, nicht am Halten.
      const xs = [];
      let x = st.f.x;
      for (let j = 0; j < bilder; j += 1) {
        for (let i = 0; i < n; i += 1) x += T.tempoBei(x) * h;
        xs.push(x);
      }
      T.tunnelBis(x + 200);
      punkte = st.tunnel.punkte;
      let best = null;
      for (const f of FOLGEN) {
        let y = st.f.y;
        let vy = st.f.vy;
        let frei = Infinity;
        let abweichung = 0;
        let stoss = -1;
        for (let j = 0; j < bilder; j += 1) {
          const xj = xs[j];
          const v = T.tempoBei(xj);
          const halten = j < f.n1 ? f.a : j < f.n1 + f.n2 ? !f.a : folgen(j ? xs[j - 1] : st.f.x, y, vy, v);
          for (let i = 0; i < n; i += 1) {
            vy = Math.max(-T.VY_MAX, Math.min(T.VY_MAX, vy + (halten ? SCHUB - G : -G) * h));
            y += vy * h;
          }
          const neig = Math.atan2(vy, v) * 0.75;
          const c = Math.cos(neig);
          const s = Math.sin(neig);
          for (const p of UMRISS) {
            const px = xj + p.x * c - p.y * s;
            const py = y + p.x * s + p.y * c;
            frei = Math.min(frei, wand(px, true) - py, py - wand(px, false));
          }
          if (frei < 0.5) { stoss = j; break; }
          abweichung += Math.abs(y - mitte(xj)) * dt;
        }
        // Wer anstösst, so spät wie möglich; sonst erst Abstand zur Wand
        // (bis 14 genügt), dann möglichst in der Mitte.
        const wert = stoss >= 0 ? -1e7 + stoss * 1e4 : Math.min(frei, 14) * 1000 - abweichung * 10;
        const halten = f.n1 > 0 ? f.a : folgen(st.f.x, st.f.y, st.f.vy, T.tempoBei(st.f.x));
        if (!best || wert > best.wert) best = { wert, halten };
      }
      if (best.halten && !gedrueckt) { T.druecken(); gedrueckt = true; }
      if (!best.halten && gedrueckt) { T.loslassen(); gedrueckt = false; }
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 20000,
  dauer: 10000,
};
