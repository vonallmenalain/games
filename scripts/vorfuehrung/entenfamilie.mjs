// Entenfamilie: der dritte Fluss. Die Mutter schwimmt mit vier Küken durch
// die grüne Welle, links und rechts ziehen ein Floss und ein Motorboot
// vorbei, dahinter die Seerosen.
export default {
  bereit: () => Boolean(window.LernappEntenfamilie?.state && window.LernappEntenfamilie.view.cssW > 0),
  spiele: () => {
    const E = window.LernappEntenfamilie;
    const st = E.state;
    // Der Pilot: wartet am Ufer auf die Welle und schwimmt dann ohne Halt.
    let fluss = -1;
    let start = Infinity;
    const pilot = () => {
      if (st.fluss !== fluss) {
        fluss = st.fluss;
        const w = E.wartenBisWelle(st.fluesse[st.fluss].takt + 0.5);
        start = w === null ? Infinity : st.uhr + w;
      }
      if (st.uhr >= start) E.druecken(); else E.loslassen();
    };
    E.druecken();
    E.loslassen();
    // Die ersten zwei Flüsse im Zeitraffer.
    for (let n = 0; n < 240 * 80 && st.phase === "spiel" && st.geschafft < 2; n += 1) {
      pilot();
      E.takt(1 / 240);
    }
    const tick = () => {
      if (st.phase !== "spiel") return;
      requestAnimationFrame(tick);
      pilot();
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 300,
  dauer: 8000,
  // Das Standbild: die Familie mitten im Fluss.
  bild: 1000,
  bildWenn: () => {
    const st = window.LernappEntenfamilie.state;
    const f = st.fluesse[st.fluss];
    const m = st.enten[0];
    return Boolean(f) && m.y > f.y0 + 2.2 && st.enten[st.enten.length - 1].y > f.y0 + 0.3;
  },
};
