// Hammerwurf: Das Stadion von oben, der vierte Wurf. Der Hammer fliegt
// genau die Mittellinie hinauf, unten im Rasen stecken die Fähnchen der
// ersten drei Würfe, die gelbe Linie ist schon weit draussen.
export default {
  bereit: () => Boolean(window.LernappHammerwurf?.state && window.LernappHammerwurf.view.cssW > 0),
  spiele: () => {
    const H = window.LernappHammerwurf;
    const st = H.state;
    // Der Pilot: lässt los, wenn der Hammer fast genau auf die Mittellinie
    // zeigt und die Weite ein paar Meter über der Linie liegt.
    const pilot = () => {
      if (st.phase === "bereit") H.tippen();
      if (st.schritt !== "drehen") return;
      const abw = Math.abs(H.normGrad((st.th * 180) / Math.PI));
      const weite = H.weiteAus(st.w) * (1 + 0.035 * H.windBei(st.wurf));
      if (abw <= H.sektorBei(st.wurf) * 0.2 && weite >= H.quali(st.wurf) + 6) H.tippen();
    };
    // Die ersten drei Würfe im Zeitraffer.
    for (let n = 0; n < 120 * 120 && st.phase !== "ende" && st.wurf < 3; n += 1) {
      pilot();
      H.takt(1 / 120);
    }
    const tick = () => {
      if (st.phase === "ende") return;
      requestAnimationFrame(tick);
      pilot();
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 400,
  dauer: 8000,
  // Das Standbild: der Hammer im Flug, ein gutes Stück draussen.
  bild: 1200,
  bildWenn: () => {
    const st = window.LernappHammerwurf.state;
    return st.schritt === "flug" && st.flug && st.flug.t > st.flug.dauer * 0.45;
  },
};
