// Skispringen: Abendrot über den Alpen, die vierte Schanze (HS 165). Der
// Springer liegt im V über dem Hang, der Bogen über ihm steht im Grünen,
// unten leuchtet die Qualifikationslinie – drei Sprünge sind schon gezählt.
// Er springt genau an der Kante ab, hält die Lage gegen die Böen und landet
// im Telemark.
export default {
  bereit: () => Boolean(window.LernappSkispringen?.state?.sch && window.LernappSkispringen.view.cssW > 0),
  spiele: () => {
    const S = window.LernappSkispringen;
    const st = S.state;
    // Der Pilot: tippt, wenn die Kante in diesem Bild kommt, lehnt gegen die
    // Abweichung (mit etwas Vorhalt) und landet, wenn sich die Ringe treffen.
    const pilot = () => {
      if (st.phase === "bereit") S.aktion();
      if (st.schritt === "anlauf" && S.zeitBisKante() < 1 / 120) S.aktion();
      if (st.schritt === "flug") {
        const f = st.sp.k + st.sp.kw * 0.12;
        S.lenke(f > 1.5 ? -1 : f < -1.5 ? 1 : 0);
        if (st.sprung.tele < 0 && st.anflug && st.tauVoraus <= S.TELE_ZIEL) S.aktion();
      } else {
        S.lenke(0);
      }
    };
    // Die ersten drei Sprünge im Zeitraffer – bis die vierte Schanze steht.
    for (let n = 0; n < 400000 && st.phase !== "ende" && !(st.nr === 3 && st.schritt === "start"); n += 1) {
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
  // Das Standbild: mitten im Flug, die Lage im Grünen.
  bild: 800,
  bildWenn: () => {
    const st = window.LernappSkispringen.state;
    return st.schritt === "flug" && st.sp.tf > 1.3 && Math.abs(st.sp.k) < 3;
  },
};
