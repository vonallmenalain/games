// Schwarm: Der Schwarm ist schon gewachsen, die Sonne steht tief – und voraus
// wartet ein Felsbogen, durch den er sich gleich zwängt.
export default {
  bereit: () => Boolean(window.LernappSchwarm?.state?.welt && window.LernappSchwarm.view.cssW > 0),
  spiele: () => {
    const S = window.LernappSchwarm;
    const st = S.state;
    // Scharf bleiben, auch wenn der Rechner für die Aufnahme langsam zeichnet.
    S.guete(1);
    // Der Pilot: dem freien Weg nach, und zu jedem Trupp, der nah daran liegt.
    const pilot = () => {
      let ziel = S.wegBei(st.z + S.tempoBei(st.z) * 0.3);
      const trupp = st.welt.trupps.find((t) => t.zustand === "offen" && t.z > st.z + 4 && t.z < st.z + 70);
      if (trupp && trupp.art !== "gross" && Math.abs(trupp.x - S.wegBei(trupp.z)) < 12) ziel = trupp.x;
      const d = ziel - st.x - st.vx * 0.12;
      S.lenke(d > 0.7 ? 1 : d < -0.7 ? -1 : 0);
    };
    // Ein Felsbogen ein Stück voraus?
    const bogenVoraus = () => st.welt.dinge.some((d) => d.art === "bogen" && d.z > st.z + 120 && d.z < st.z + 170);
    S.losGehts();
    for (let n = 0; n < 300000 && st.phase === "spiel" && st.z < 2400 && !(st.z > 600 && S.vg.n > 170 && bogenVoraus()); n += 1) {
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
  // Das Standbild: der Bogen gross voraus, die Sonne dahinter.
  bild: 800,
  bildWenn: () => {
    const S = window.LernappSchwarm;
    const st = S.state;
    if (st.phase !== "spiel") return true;
    // Nicht, solange der Name des Lichts im Bild steht.
    if (st.karte && st.zeit - st.karte.seit < st.karte.dauer) return false;
    return st.z > 2500 || st.welt.dinge.some((d) => d.art === "bogen" && d.z > st.z + 48 && d.z < st.z + 78);
  },
};
