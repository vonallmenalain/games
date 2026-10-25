// Slalom: Der Fahrer zieht Tor um Tor knapp an der inneren Stange vorbei –
// «perfekt», eine Reihe nach der anderen, und immer schneller.
export default {
  bereit: () => Boolean(window.LernappSlalom?.state?.kurs),
  spiele: () => {
    const S = window.LernappSlalom;
    const st = S.state;
    const rand = S.R_STANGE + S.R_FAHRER;
    // Wohin er durchs Tor will: nahe an die innere Stange (dort ist es
    // «perfekt»), aber mit Abstand, damit er sie nicht mitnimmt.
    const fenster = (t) => {
      const stange = t.innen < 0 ? S.stangeL(t) : S.stangeR(t);
      const weit = Math.max(7, t.breite * 0.26);
      return { stange, nah: rand + 1, weit: weit - 1.2, ziel: stange - t.innen * (rand + (weit - rand) * 0.45) };
    };
    // Wo er bei t.y ist, wenn er jetzt auf die Richtung phi2 umsteigt
    // (Kante mit Verzug, wie im Spiel).
    const xBei = (sk, t, phi2) => {
      const W = S.drehBei(sk.y);
      let x = sk.x, y = sk.y, phi = sk.phi, w = sk.w;
      const r = Math.sign(phi2 - phi) || 1;
      for (let k = 0; k < 800 && y < t.y; k += 1) {
        if ((r > 0 && phi < phi2) || (r < 0 && phi > phi2)) {
          w += (r * W - w) * (1 - Math.exp(-1 / 120 / 0.07));
          phi += w / 120;
        } else { phi = phi2; w = 0; }
        x += sk.v * Math.sin(phi) / 120;
        y += sk.v * Math.cos(phi) / 120;
      }
      return x;
    };
    const tick = () => {
      requestAnimationFrame(tick);
      if (st.schritt !== "fahrt") return;
      const sk = st.sk;
      const tore = st.kurs.tore;
      const i = tore.findIndex((q) => q.zustand === "offen" && q.y > sk.y);
      if (i < 0 || !tore[i + 1]) return;
      const t1 = tore[i];
      const t2 = tore[i + 1];
      const f1 = fenster(t1);
      const f2 = fenster(t2);
      let soll = Math.atan2(f1.ziel - sk.x, Math.max(1, t1.y - sk.y));
      // Schon zum nächsten Tor umsteigen? Nur, wenn er dieses dann noch im
      // goldenen Stück trifft.
      const phi2 = Math.atan2(f2.ziel - f1.ziel, t2.y - t1.y);
      const ab = (xBei(sk, t1, phi2) - f1.stange) * -t1.innen;
      if (ab > f1.nah && ab < f1.weit) soll = phi2;
      S.lenke(soll > sk.phi + sk.w * 0.05 ? 1 : -1);
    };
    S.lenke(1);
    requestAnimationFrame(tick);
  },
  vorlauf: 4000,
  dauer: 8000,             // kurz: Der Wald kostet quer viel Platz im Film
};
