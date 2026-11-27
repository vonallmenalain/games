// Spiegelsee: Die Läuferin rennt am Ufer, und jeder Sprung kommt genau nach
// dem vorgeschlagenen Weg, um den die Strecke gebaut ist. Das Bild entsteht
// nach dem Erwachen des Sees, wenn unten schon die Nacht ist – ohne Ansage
// oben im Bild.
export default {
  bereit: () => Boolean(window.LernappSpiegelsee?.state?.weg?.length && window.LernappSpiegelsee.view.cssW > 0),
  spiele: () => {
    const K = window.LernappSpiegelsee;
    const st = K.state;
    let i = 0;
    const tick = () => {
      requestAnimationFrame(tick);
      if (st.phase === "bereit") { K.tippen(performance.now()); return; }
      if (st.phase !== "spiel" || st.schritt === "sturz") return;
      const w = st.weg[i];
      if (!w) return;
      if (st.t >= w.t - 0.006) { K.tippen(performance.now()); i += 1; }
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 2500,
  dauer: 10000,
  // Nach dem ersten Spiegeltor (um 250 m) und dem Tor zurück (bei 350 m):
  // Die Welt steht wieder aufrecht, unten ist die Nacht, und bis zur
  // nächsten Landschaft ist keine Ansage im Bild (um 365–385 m) – die
  // Läuferin läuft, voraus Hindernisse in beiden Welten. Findet sich das
  // nicht, springt sie später vor Hindernissen in beiden Welten.
  bild: 20500,
  bildWenn: () => {
    const K = window.LernappSpiegelsee;
    const st = K.state;
    if (st.schritt === "sturz") return true;
    window.__sgSeit = window.__sgSeit || performance.now();
    if ((performance.now() - window.__sgSeit) / 1000 > 20) return true;
    const r = st.laeuferin;
    if (K.nachtK() < 1 || K.kippBei(st.t).mass !== 1 || st.ansage) return false;
    if (K.landNr(r.x + 160) !== K.landNr(r.x) || K.nebelBei(r.x + 60) > 0.1) return false;
    const voraus = st.hindernisse.filter((o) => o.a > r.x + 20 && o.a < r.x + 220);
    const beide = voraus.some((o) => o.welt === "unten") && voraus.some((o) => o.welt === "oben");
    if (r.sprung === null) return r.x > 3600 && r.x < K.LAND_AB && beide;
    const tau = st.t - r.sprung;
    return tau >= 0.15 && tau <= 0.3 && beide;
  },
};
