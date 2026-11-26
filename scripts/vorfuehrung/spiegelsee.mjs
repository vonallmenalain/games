// Spiegelsee: Die Läuferin rennt am Ufer, und jeder Sprung kommt genau nach
// dem Weg, um den die Strecke gebaut ist. Das Bild entsteht nach dem
// Erwachen des Sees, wenn unten schon die Nacht ist.
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
  // Der See erwacht, die Läuferin hoch in der Luft (ihr Spiegelbild tief
  // im Wasser), und voraus stehen Hindernisse in beiden Welten. Findet
  // sich das nicht bald, genügt weniger.
  bildWenn: () => {
    const K = window.LernappSpiegelsee;
    const st = K.state;
    if (st.schritt === "sturz") return true;
    window.__sgSeit = window.__sgSeit || performance.now();
    const gewartet = (performance.now() - window.__sgSeit) / 1000;
    if (gewartet > 16) return true;
    if (K.nachtK() < 1) return false;
    const r = st.laeuferin;
    if (r.sprung === null) return false;
    const tau = st.t - r.sprung;
    if (tau < 0.2 || tau > 0.4) return false;
    const voraus = st.hindernisse.filter((o) => o.a > r.x + 20 && o.a < r.x + 220);
    if (gewartet > 8) return voraus.length >= 1;
    return voraus.some((o) => o.welt === "unten") && voraus.some((o) => o.welt === "oben");
  },
};
