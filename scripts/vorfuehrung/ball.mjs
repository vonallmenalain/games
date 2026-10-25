// Ball hochhalten: Es ist später Nachmittag, der Ball fliegt hoch über den
// Bolzplatz, ein Zielring hängt daneben in der Luft. Der Ball wird bald
// links, bald rechts getroffen und fliegt mal hierhin, mal dorthin, durch
// den Ring, um eine Böe herum – meist sauber, ab und zu perfekt.
export default {
  bereit: () => Boolean(window.LernappBall?.state && window.LernappBall.view.cssW > 0),
  spiele: () => {
    const B = window.LernappBall;
    const st = B.state;
    const ZIELE = [-45, 0, 45, 0];
    let n = 0;
    // Wann und wohin: getippt wird, wenn der Ball unten ist und fällt. Ziel
    // ist ein Ring (erst, wenn er eine Weile hängt – fürs Standbild; bis
    // dahin spielt er auf der anderen Seite), sonst links, Mitte, rechts,
    // Mitte – die Mitte meist perfekt. Gegen eine Böe hält er vor.
    const pilot = () => {
      const b = B.ball;
      if (st.phase !== "spiel" || st.schritt !== "flug") return;
      if (!(b.vy < 0 && b.y < 120 && st.zeit - st.letzterKick > 0.25)) return;
      const k = st.kontakte;
      const gg = B.gBei(k);
      const hub = Math.max(B.APEX - b.y, B.HUB_MIN);
      const vy = Math.sqrt(2 * gg * hub);
      const haengt = st.plan.ringe.find((r) => r.t0 >= 0 && r.getroffen < 0 && k < r.bis);
      const ring = haengt && st.zeit - haengt.t0 > 4.5 ? haengt : null;
      const balken = st.plan.balken.find((s) => s.raus > 0.05 || (k >= s.ab - 1 && k < s.bis));
      let vx;
      if (ring && !balken) {
        const d = vy * vy - 2 * gg * (ring.y - b.y);
        const t = (vy - Math.sqrt(Math.max(0, d))) / gg;
        vx = (ring.x - b.x) / Math.max(0.15, t);
      } else {
        n += 1;
        const ziel = balken ? -balken.seite * 70 : haengt ? -Math.sign(haengt.x) * 40 : ZIELE[n % ZIELE.length];
        const T = vy / gg + Math.sqrt(2 * (b.y + hub - 100) / gg);
        vx = (ziel - b.x) / T;
      }
      vx -= st.wind.ax * 0.6;
      const off = Math.max(-0.92, Math.min(0.92, -vx / B.vxBei(k) + (Math.random() - 0.5) * 0.12));
      B.tippe(b.x + off * b.r, b.y);
    };
    // Vorspulen bis in den späten Nachmittag – bis gerade ein Ring auftaucht.
    B.tippe(B.ball.x, B.ball.y);
    for (let n = 0; st.schritt === "flug" && n < 200000; n += 1) {
      const k = st.kontakte;
      if (k >= 11 && (st.plan.ringe.some((r) => r.ab === k) || k >= 22)) break;
      pilot();
      B.takt(1 / 120);
    }
    const tick = () => {
      if (st.phase === "ende") return;
      requestAnimationFrame(tick);
      pilot();
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 600,
  dauer: 10000,
  // Das Standbild: 2.6 s nach dem Start, 2 s im Film – der Ring hängt da,
  // der Ball fliegt.
  bild: 2600,
  standbild: 2,
};
