// Turmspringen: Abendrot über den Alpen, der siebte Sprung vom 24-m-Turm.
// Der Springer steckt im Päckchen mitten in seinem zweieinhalbfachen Salto,
// um ihn der Kompass mit den grünen Feldern oben und unten, durch die
// Fallstrecke ziehen die Schlieren einer Böe – unten warten der See und die
// Boote mit dem Publikum. Sechs Sprünge sind schon gezählt.
export default {
  bereit: () => Boolean(window.LernappTurmspringen?.state?.sp && window.LernappTurmspringen.view.cssW > 0),
  spiele: () => {
    const S = window.LernappTurmspringen;
    const st = S.state;
    // Der Pilot: springt im Moment ab, hält das Päckchen, bis die Drehung
    // eine halbe mehr als die Pflicht ergibt, und streckt sich dann.
    const pilot = () => {
      if (st.phase === "bereit") S.aktion();
      if (st.schritt === "wippen" && !st.sprung.abgesprungen && Math.abs(S.ringRest()) < 1 / 200) S.aktion();
      if (st.schritt === "flug" && !st.sprung.verpasst) {
        const v = S.vorausWinkel(true).winkel;
        const ziel = Math.max(S.pflichtBei(st.nr) + 1, Math.ceil((v - 10) / 180)) * 180;
        S.halte(v < ziel - 0.5);
      } else {
        S.halte(false);
      }
    };
    // Die ersten sechs Sprünge im Zeitraffer – bis der siebte beginnt.
    for (let n = 0; n < 600000 && st.phase !== "ende" && !(st.nr === 6 && st.schritt === "laufen"); n += 1) {
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
