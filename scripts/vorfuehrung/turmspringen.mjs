// Turmspringen: Abendrot über den Alpen, der sechste Sprung. Der Springer
// steckt im Päckchen mitten in seinem Doppelsalto – unten warten der See
// und die Boote mit dem Publikum. Fünf Sprünge sind schon gezählt, die
// letzten perfekt.
export default {
  bereit: () => Boolean(window.LernappTurmspringen?.state?.sp && window.LernappTurmspringen.view.cssW > 0),
  spiele: () => {
    const S = window.LernappTurmspringen;
    const st = S.state;
    // Der Pilot: hält das Päckchen, bis die Drehung beim Strecken sein Ziel
    // ergibt – je höher, desto mehr halbe Drehungen –, und streckt sich dann.
    const ZIEL = [2, 2, 3, 3, 4, 4, 4, 5];
    const pilot = () => {
      if (st.phase === "bereit") S.aktion();
      if (st.schritt === "flug") S.halte(S.vorausWinkel(true).winkel < ZIEL[st.nr] * 180 - 0.5);
      else S.halte(false);
    };
    // Die ersten fünf Sprünge im Zeitraffer – bis der sechste beginnt.
    for (let n = 0; n < 600000 && st.phase !== "ende" && !(st.nr === 5 && st.schritt === "laufen"); n += 1) {
      pilot();
      S.takt(1 / 120);
    }
    const tick = () => {
      if (st.phase === "ende") return;
      requestAnimationFrame(tick);
      pilot();
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 600,
  dauer: 9000,
  // Das Standbild: im Päckchen, mitten in der Fallstrecke.
  bild: 1500,
  bildWenn: () => {
    const st = window.LernappTurmspringen.state;
    return st.schritt === "flug" && st.sp.offen < 0.2 && st.sp.y < st.H * 0.72 && st.sp.y > st.H * 0.4;
  },
};
