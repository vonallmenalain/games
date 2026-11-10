// Die Welle: Der Surfer steckt in der Röhre, das Dach ist über ihm zu – und
// voraus, in der Öffnung, steht die Abendsonne über dem Meer.
export default {
  bereit: () => Boolean(window.LernappWelle?.state?.welt && window.LernappWelle.view.cssW > 0),
  spiele: () => {
    const W = window.LernappWelle;
    const st = W.state;
    // Scharf bleiben, auch wenn der Rechner für die Aufnahme langsam zeichnet.
    W.guete(1);
    // Der Pilot: hält gut fünf Meter Abstand zum Schaum – über die Höhe an
    // der Wand. Kommt ein schneller Abschnitt, nimmt er vorher Reserve.
    const pilot = () => {
      const d = st.zp - st.zs;
      const t = st.spielzeit;
      const naht = Math.max(W.faktorBei(t), W.faktorBei(t + 0.6), W.faktorBei(t + 1.2));
      const reserve = naht > 1.12 ? 3.5 * (naht - 1) / 0.4 : 0;
      const vd = st.v * Math.cos(st.psi) - W.tempoBei(t) * W.faktorBei(t);
      const ziel = Math.max(0.2, Math.min(0.88, 0.62 + 0.07 * (d - 5.2 - reserve) + 0.03 * vd - (naht > 1.12 ? 0.1 * (naht - 1) / 0.4 : 0)));
      W.halte(st.h + (st.v * Math.sin(st.psi) / W.WAND) * 0.12 < ziel);
    };
    // Der schöne Moment: mitten in der Röhre, keine Schrift im Bild, und der
    // Schaum zieht nicht gerade an.
    // (streng beim Vorspulen; fürs Bild danach reicht es, wenn er noch in der
    // Röhre steckt – ein langsamer Rechner zeichnet in der Zwischenzeit kaum
    // ein Bild.)
    window.__welleMoment = (streng = false) => {
      if (st.phase !== "spiel" || st.spielzeit > 62) return true;
      if (W.schriften.length || (st.karte && st.zeit - st.karte.seit < st.karte.dauer)) return false;
      const d = st.zp - st.zs;
      if (!streng) return d > 3.4 && d < 7.4 && st.h > 0.3 && st.h < 0.8;
      if (W.faktorBei(st.spielzeit) > 1.05 || W.faktorBei(st.spielzeit + 2.5) > 1.05) return false;
      return d > 4.4 && d < 6.2 && st.h > 0.42 && st.h < 0.72;
    };
    W.losGehts();
    // Vorspulen bis dorthin – gerechnet, nicht gezeichnet.
    for (let n = 0; n < 300000 && st.phase === "spiel" && !(st.spielzeit > 28 && window.__welleMoment(true)); n += 1) {
      pilot();
      W.takt(1 / 120);
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
  // Das Standbild: mitten in der Röhre, die Öffnung gross voraus.
  bild: 800,
  bildWenn: () => window.__welleMoment(),
};
