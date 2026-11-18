// Die Welle: Die Surferin steckt in der Röhre, das Dach ist über ihr zu – und
// voraus, in der Öffnung, steht die Abendsonne über dem Meer.
export default {
  bereit: () => Boolean(window.LernappWelle?.state?.welt && window.LernappWelle.view.cssW > 0),
  spiele: () => {
    const W = window.LernappWelle;
    const st = W.state;
    // Scharf bleiben, auch wenn der Rechner für die Aufnahme langsam zeichnet.
    W.guete(1);
    // Die Pilotin: Mit der Höhe an der Wand stellt sie ein, wie tief sie in
    // der Röhre steckt (hoch ist langsam) – gut fünf Meter vor dem Schaum.
    // Zieht er an oder kommt er zu nahe, pumpt sie rauf und runter.
    const merk = { auf: true, pumpt: false };
    const pilot = () => {
      const d = st.zp - st.zs;
      const t = st.spielzeit;
      const naht = Math.max(W.faktorBei(t + 0.6), W.faktorBei(t + 1.4), W.faktorBei(t + 2.2));
      if (d < 3.6 || (naht > 1.12 && d < 9.5)) merk.pumpt = true;
      else if (d > 5.4) merk.pumpt = false;
      if (merk.pumpt) {
        if (merk.auf && st.h > 0.72) merk.auf = false;
        if (!merk.auf && st.h < 0.4) merk.auf = true;
        W.lenke(merk.auf ? 1 : -1);
        return;
      }
      const ziel = Math.max(0.4, Math.min(0.8, 0.62 + 0.05 * (d - 5.2)));
      W.lenke(st.h < ziel - 0.05 ? 1 : st.h > ziel + 0.05 ? -1 : 0);
    };
    // Der schöne Moment: mitten in der Röhre, keine Schrift im Bild, und der
    // Schaum zieht nicht gerade an.
    // (streng beim Vorspulen; fürs Bild danach reicht es, wenn sie noch in der
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
