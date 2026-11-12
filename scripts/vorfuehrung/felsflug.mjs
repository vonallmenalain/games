// Felsflug: Der Flieger zieht im Morgenlicht durch den engen Gang, dicht an
// der Felswand entlang – die Serie steht, voraus fällt die Sonne in
// Schleiern in die Schlucht, und etwas wartet dort: eine Hängebrücke, ein
// Wasserfall oder ein Felsbogen.
export default {
  bereit: () => Boolean(window.LernappFelsflug?.state?.welt && window.LernappFelsflug.view.cssW > 0),
  spiele: () => {
    const S = window.LernappFelsflug;
    const st = S.state;
    // Scharf bleiben, auch wenn der Rechner für die Aufnahme langsam zeichnet.
    S.guete(1);
    // Der Pilot: dem freien Weg nach, ein wenig zu einer Wand hin – nie mehr
    // als gut einen Meter, und nur so weit, dass bis knapp eine halbe
    // Sekunde voraus fast drei Meter Luft zum Fels bleiben. Er nimmt die
    // Kurve voraus und gleicht aus, wo er danebenliegt.
    let seite = 1;
    let wechsel = 0;
    let neben = 0;
    const rand = (z) => {
      let r = 99;
      for (let t = -0.15; t <= 0.45; t += 0.05) {
        const q = z + S.tempoBei(z) * t;
        const f = S.freiBei(q);
        const w = S.wegBei(q);
        r = Math.min(r, seite < 0 ? w - f.l : f.r - w);
      }
      return r;
    };
    const pilot = () => {
      if (st.schritt !== "flug") return;
      // Ab und zu die Seite, deren Wand näher ist.
      if (st.flugzeit > wechsel) {
        const f = S.freiBei(st.z);
        const neu = st.x - f.l < f.r - st.x ? -1 : 1;
        if (neu !== seite) neben = 0;
        seite = neu;
        wechsel = st.flugzeit + 3;
      }
      const v = S.tempoBei(st.z);
      const zz = st.z + v * 0.12;
      neben += clamp(clamp(rand(zz) - 2.8, 0, 1.2) - neben, -5 / 120, 5 / 120);
      const steig = (S.wegBei(zz + 2) - S.wegBei(zz - 2)) / 4;
      const soll = steig * v + (S.wegBei(zz) + seite * neben - st.x - st.vx * 0.12) * 5;
      const d = soll - st.vx;
      S.lenke(d > 3 ? 1 : d < -3 ? -1 : 0);
    };
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    // Der schöne Moment: in der Sonne, nah am Fels, keine Tanne dicht vor der
    // Linse – und voraus etwas zum Anschauen. streng: fürs Vorspulen (ein
    // langsamer Rechner zeichnet in der Zwischenzeit kaum ein Bild).
    window.__felsflugMoment = (streng = false) => {
      if (st.phase !== "spiel" || st.schritt !== "flug" || st.z > 3300) return true;
      if (st.karte && st.echt - st.karte.seit < st.karte.dauer) return false;
      if (st.sonne < (streng ? 0.65 : 0.5) || st.naehe < (streng ? 0.25 : 0.12) || st.serie < 1.15) return false;
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
