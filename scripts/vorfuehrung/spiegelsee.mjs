// Spiegelsee: Die Läuferin rennt am Ufer, und jeder Sprung kommt genau nach
// dem vorgeschlagenen Weg, um den die Strecke gebaut ist (an Gabelungen der,
// der hält). Das Bild entsteht nach dem Erwachen des Sees, wenn unten schon
// die Nacht ist – ohne Ansage oben im Bild.
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
  bild: 11500,
  // Der See ist erwacht, die Läuferin springt auf dem ersten Steg (eine
  // Etage höher, ihr Spiegelbild tief im Wasser) oder vor Hindernissen in
  // beiden Welten. Findet sich das nicht bald, genügt weniger.
  bildWenn: () => {
    const K = window.LernappSpiegelsee;
    const st = K.state;
    if (st.schritt === "sturz") return true;
    window.__sgSeit = window.__sgSeit || performance.now();
    const gewartet = (performance.now() - window.__sgSeit) / 1000;
    if (gewartet > 16) return true;
    if (K.nachtK() < 1) return false;
    if (st.ansage && gewartet < 3) return false;
    if (K.nebelBei?.(st.laeuferin.x + 60) > 0.1 && gewartet < 14) return false;
    const r = st.laeuferin;
    // Oben auf dem ersten Steg, laufend (im Sprung ragte sie quer oben aus
    // dem Bild), ein Hindernis voraus.
    if (r.sprung === null && K.bodenBei(0, r.x) > 15 && st.hindernisse.some((o) => o.a > r.x + 15 && o.a < r.x + 120)) return true;
    if (r.sprung === null) return false;
    const tau = st.t - r.sprung;
    if (tau < 0.15 || tau > 0.3) return false;
    const voraus = st.hindernisse.filter((o) => o.a > r.x + 20 && o.a < r.x + 220);
    if (gewartet > 6) return voraus.length >= 1;
    return voraus.some((o) => o.welt === "unten") && voraus.some((o) => o.welt === "oben");
  },
};
