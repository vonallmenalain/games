// Gratwanderung: Der Steinbock nimmt Kehre um Kehre genau in der Mitte –
// «perfekt», eine nach der anderen. Im Morgenrot, die Kamera halb so tief wie
// vor dem Start: So stehen Sonne, ferne Ketten und Nebelmeer mit im Bild.
export default {
  bereit: () => Boolean(window.LernappGratwanderung?.state?.kehren?.length),
  spiele: () => {
    const G = window.LernappGratwanderung;
    const st = G.state;
    st.blickFest = 0.4;
    const tick = () => {
      requestAnimationFrame(tick);
      if (st.phase === "bereit") { G.losGehts(); return; }
      if (st.phase !== "spiel" || st.schritt !== "lauf") return;
      // Gewendet wird, wo die eigene Spur die Mitte des nächsten Stücks
      // kreuzt: Davor ist daneben · r negativ, danach positiv.
      const b = st.bock;
      const k = st.kehren[st.naechste];
      const daneben = b.x - (k.x + k.s * (b.z - k.z));
      if (b.r !== k.s && daneben * b.r >= -G.tempoBei(b.z) / 120) G.tippen(performance.now());
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 2500,
  dauer: 10000,
  bild: 4200,
  // Kurz nach einer perfekten Kehre: «Perfekt ×3» steht über dem Steinbock,
  // der goldene Ring liegt noch im Schnee.
  bildWenn: () => {
    const st = window.LernappGratwanderung.state;
    return st.reihe >= 3 && st.ringe.length > 0 && st.ringe[0].t > 0.12 && st.ringe[0].t < 0.3;
  },
};
