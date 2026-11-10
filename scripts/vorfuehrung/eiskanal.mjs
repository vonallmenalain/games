// Eiskanal: Der Bob liegt hoch in einer Steilwand, über hundert Kilometer in
// der Stunde schnell – das Eis glänzt im Flutlicht, die Lippe glüht, und über
// der Bahn steht das Nordlicht.
export default {
  bereit: () => Boolean(window.LernappEiskanal?.state?.bahn?.zier && window.LernappEiskanal.view.cssW > 0),
  spiele: () => {
    const S = window.LernappEiskanal;
    const st = S.state;
    // Scharf bleiben, auch wenn der Rechner für die Aufnahme langsam zeichnet.
    S.guete(1);
    // Der Pilot: zur ruhigen Linie hin, vor allem gegen den Schwung.
    const pilot = () => {
      const k = S.bahnBei(st.s + st.v * 0.25).k;
      const f = S.linieBei(st.v, k) * 0.95 - st.phi - st.w * 1.2;
      S.lenke(f > 0.25 ? 1 : f < -0.25 ? -1 : 0);
    };
    // Der schöne Moment: hoch an der Wand, schnell, keine Schrift im Bild –
    // und der Blick geht dorthin, wo das Nordlicht steht. streng: Die Kurve
    // dauert noch ein Stück (fürs Vorspulen; ein langsamer Rechner zeichnet
    // in der Zwischenzeit kaum ein Bild).
    window.__eiskanalMoment = (streng = false) => {
      if (st.phase !== "spiel" || st.schritt !== "fahrt" || st.s > 1330) return true;
      if (st.karte && st.zeit - st.karte.seit < st.karte.dauer) return false;
      if (Math.abs(st.phi) < (streng ? 0.85 : 0.7) || Math.abs(st.phi) > (streng ? 1.05 : 1.25) || st.v < 26) return false;
      if (!streng) return true;
      // Das Nordlicht steht dort, wohin die Bahn am Start zeigt (Richtung 0).
      const nachNorden = Math.cos(S.bahnBei(st.s).richt) > 0.25;
      const voraus = S.bahnBei(st.s + 60).k;
      return nachNorden && Math.abs(voraus) > 0.018 && voraus * st.phi < 0;
    };
    S.losGehts();
    // Vorspulen bis dorthin – gerechnet, nicht gezeichnet.
    for (let n = 0; n < 300000 && st.phase === "spiel" && !(st.s > 520 && window.__eiskanalMoment(true)); n += 1) {
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
  // Das Standbild: mitten in der Steilwand.
  bild: 700,
  bildWenn: () => window.__eiskanalMoment(),
};
