// Felsflug: Der Flieger zieht im Morgenlicht dicht an der Felswand entlang –
// die Serie steht, voraus fällt die Sonne in Schleiern in die Schlucht, und
// etwas wartet dort: eine Hängebrücke, ein Wasserfall oder ein Felsbogen.
export default {
  bereit: () => Boolean(window.LernappFelsflug?.state?.welt && window.LernappFelsflug.view.cssW > 0),
  spiele: () => {
    const S = window.LernappFelsflug;
    const st = S.state;
    // Scharf bleiben, auch wenn der Rechner für die Aufnahme langsam zeichnet.
    S.guete(1);
    // Der Pilot: so nah an die Wand, wie es sicher geht. Für jede Stelle
    // voraus zählt, wie weit er bis dorthin noch ausweichen könnte.
    let seite = 0;
    const pilot = () => {
      if (st.schritt !== "flug") return;
      const v = S.tempoBei(st.z);
      const quer = S.querBei(st.z) * 0.7;
      let l = -1e9;
      let r = 1e9;
      for (let t = 0; t <= 1.3; t += 0.04) {
        const f = S.freiBei(st.z + v * t);
        const kann = quer * Math.max(0, t - 0.25);
        l = Math.max(l, f.l + 3 - kann);
        r = Math.min(r, f.r - 3 + kann);
      }
      let ziel = (l + r) / 2;
      if (r > l) {
        if (!seite) seite = st.x - l < r - st.x ? -1 : 1;
        if (seite < 0 && r - st.x < st.x - l - 6) seite = 1;
        else if (seite > 0 && st.x - l < r - st.x - 6) seite = -1;
        ziel = seite < 0 ? l : r;
      }
      const d = ziel - st.x - st.vx * 0.1;
      S.lenke(d > 0.5 ? 1 : d < -0.5 ? -1 : 0);
    };
    // Der schöne Moment: in der Sonne, nah am Fels, keine Tanne dicht vor der
    // Linse – und voraus etwas zum Anschauen. streng: fürs Vorspulen (ein
    // langsamer Rechner zeichnet in der Zwischenzeit kaum ein Bild).
    window.__felsflugMoment = (streng = false) => {
      if (st.phase !== "spiel" || st.schritt !== "flug" || st.z > 3300) return true;
      if (st.karte && st.echt - st.karte.seit < st.karte.dauer) return false;
      if (st.sonne < (streng ? 0.65 : 0.5) || st.naehe < (streng ? 0.3 : 0.15) || st.serie < 1.3) return false;
      if (st.welt.dinge.some((d) => d.art !== "turm" && d.z > st.z - 40 && d.z < st.z + (streng ? 45 : 25))) return false;
      if (!streng) return true;
      // Auch voraus liegt die Schlucht im Licht – und kein dunkler Bogen.
      const hell = (dz) => S.sonneBei(S.wegBei(st.z + dz), S.bodenBei(st.z + dz) + S.FLUG_Y, st.z + dz) > 0.6;
      if (!hell(45) || !hell(100) || st.welt.zier.some((d) => d.art === "sturz" && d.z > st.z - 20 && d.z < st.z + 220)) return false;
      if (st.z > 1500) return true;
      return st.welt.zier.some((d) => ["haengebruecke", "wasserfall"].includes(d.art) && d.z > st.z + 70 && d.z < st.z + 190);
    };
    S.losGehts();
    // Vorspulen bis dorthin – gerechnet, nicht gezeichnet.
    for (let n = 0; n < 300000 && st.phase === "spiel" && !(st.z > 600 && window.__felsflugMoment(true)); n += 1) {
      pilot();
      S.takt(1 / 120);
    }
    const tick = () => {
      if (st.phase !== "spiel") return;
      requestAnimationFrame(tick);
      pilot();
      // Fürs Bild: keine Schrift am Flieger («Haarscharf +6»), nur die Serie.
      st.schriften.length = 0;
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 600,
  dauer: 9000,
  // Das Standbild: dicht am Fels, im Licht.
  bild: 700,
  bildWenn: () => window.__felsflugMoment(),
};
