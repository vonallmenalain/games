// Marsrover: Der Rover fährt über die Ebene, und jeder Befehl geht genau so
// früh los, dass er beim geplanten Absprung ankommt – um den Verzug, der
// beim Tippen gilt, vor dem Weg, um den die Strecke gebaut ist.
export default {
  bereit: () => Boolean(window.LernappMarsrover?.state?.weg?.length && window.LernappMarsrover.view.cssW > 0),
  spiele: () => {
    const K = window.LernappMarsrover;
    const st = K.state;
    let i = 0;
    const tick = () => {
      requestAnimationFrame(tick);
      if (st.phase === "bereit") { K.tippen(performance.now()); return; }
      if (st.phase !== "spiel" || st.schritt === "sturz") return;
      const w = st.weg[i];
      if (!w) return;
      if (st.t + K.verzugBei(st.t) >= w.t - 0.006) { K.tippen(performance.now()); i += 1; }
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 2500,
  dauer: 10000,
  bild: 5000,
  // Der Rover hoch in der Luft, ein Signal ist unterwegs zu ihm, und voraus
  // stehen mindestens zwei Hindernisse, darunter ein Fels oder ein Bogen.
  // Findet sich das nicht bald, genügt weniger.
  bildWenn: () => {
    const K = window.LernappMarsrover;
    const st = K.state;
    if (st.schritt === "sturz") return true;
    window.__mrSeit = window.__mrSeit || performance.now();
    const gewartet = (performance.now() - window.__mrSeit) / 1000;
    if (gewartet > 16) return true;
    const r = st.rover;
    if (r.sprung === null) return false;
    const tau = st.t - r.sprung;
    if (tau < 0.22 || tau > 0.46) return false;
    const unterwegs = st.befehle.some((b) => b.zustand === 0);
    const voraus = st.hindernisse.filter((o) => o.a > r.x + 30 && o.a < r.x + 250);
    if (gewartet > 8) return unterwegs || voraus.length >= 1;
    return unterwegs && voraus.length >= 2 && voraus.some((o) => o.art !== "krater");
  },
};
