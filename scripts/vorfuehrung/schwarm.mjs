// Schwarm: Der Schwarm ist schon gewachsen, die Kette läuft, die Sonne steht
// tief – und voraus wartet eine Felswand, durch deren Spalt er sich gleich
// geballt zwängt.
export default {
  bereit: () => Boolean(window.LernappSchwarm?.state?.welt && window.LernappSchwarm.view.cssW > 0),
  spiele: () => {
    const S = window.LernappSchwarm;
    const st = S.state;
    // Scharf bleiben, auch wenn der Rechner für die Aufnahme langsam zeichnet.
    S.guete(1);
    // Der Pilot: genau durch die Mitte jeder Lücke; geballt, wo der
    // aufgefächerte Schwarm nicht hindurchpasst, und wenn der Falke zustösst.
    const pilot = () => {
      const W = st.welt;
      const v = S.tempoBei(st.z);
      const m = S.masse();
      let tor = null;
      for (let i = W.torVon; i < W.tore.length; i += 1) if (W.tore[i].zustand === "offen") { tor = W.tore[i]; break; }
      const ziel = tor && (tor.z - st.z) / v < 0.9 ? tor.x : S.wegBei(st.z + v * 0.3);
      const d = ziel - st.x - st.vx * 0.2;
      let ball = false;
      const R = S.radiusBei(S.vg.n);
      for (let i = W.torVon; i < W.tore.length; i += 1) {
        const t = W.tore[i];
        if (t.z > st.z + v * 3) break;
        if (R + 0.6 < t.halb) continue;
        const bis = (t.z - st.z) / v;
        if (bis < S.BALL_VERZUG + 0.24 + R * 1.4 / v * 0.75 && !(st.hinten > t.z + S.DURCH + 0.3)) ball = true;
      }
      for (let i = W.falkeVon; i < W.falken.length; i += 1) {
        const f = W.falken[i];
        if (f.zustand !== "offen" && f.zustand !== "stoss") continue;
        const bis = (f.z - st.z) / v;
        if (bis < 0.3 + S.BALL_VERZUG && bis > -0.15) ball = true;
      }
      S.ballen(ball);
      S.lenke(ball ? 0 : d > 0.08 ? 1 : d < -0.08 ? -1 : 0);
    };
    // Eine Felswand ein Stück voraus?
    const wandVoraus = () => st.welt.tore.some((t) => t.art === "wand" && t.z > st.z + 120 && t.z < st.z + 170);
    S.losGehts();
    for (let n = 0; n < 300000 && st.phase === "spiel" && st.z < 2400 && !(st.z > 800 && st.kette >= 5 && wandVoraus()); n += 1) {
      pilot();
      S.takt(1 / 120);
    }
    const tick = () => {
      if (st.phase !== "spiel") return;
      requestAnimationFrame(tick);
      pilot();
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 600,
  dauer: 9000,
  // Das Standbild: die Wand gross voraus, der Spalt im Licht.
  bild: 800,
  bildWenn: () => {
    const S = window.LernappSchwarm;
    const st = S.state;
    if (st.phase !== "spiel") return true;
    // Nicht, solange eine Tafel im Bild steht.
    if (st.karte && st.zeit - st.karte.seit < st.karte.dauer) return false;
    return st.z > 2500 || st.welt.tore.some((t) => t.art === "wand" && t.z > st.z + 40 && t.z < st.z + 70);
  },
};
