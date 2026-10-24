// Zwei Spuren: Beide Bobs fahren sicher durch ihre Kanäle – sie holen jeden
// Stern, weichen Tannen, Steinen und Schneemännern aus und schaffen die
// Doppeltipps. Gewechselt wird nicht im letzten Augenblick, sondern gut eine
// halbe Sekunde vorher, wie es eine ruhige Hand täte. Nach einer guten
// Viertelminute ist es schon dicht und schnell: Muster in beiden Kanälen.
export default {
  bereit: () => Boolean(window.LernappSpuren?.state?.dinge?.length),
  spiele: () => {
    const Z = window.LernappSpuren;
    const st = Z.state;
    // Der erste Tipp startet nur.
    Z.tippe("links");
    const tick = () => {
      requestAnimationFrame(tick);
      if (st.phase !== "spiel") return;
      const v = Z.tempoBei(st.weg);
      for (const bahn of [0, 1]) {
        // Was im Kanal als Nächstes kommt, und welche Spur es verlangt.
        const ding = Z.naechste(bahn);
        if (!ding || st.schlitten[bahn].ziel === ding.soll) continue;
        if (ding.ab < v * 0.55 + 40) Z.tippe(bahn);
      }
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 18000,
  dauer: 10000,
  // Ms nach dem Start: mitten in der Fahrt, wenn beide Kanäle voll sind.
  bild: 21200,
};
