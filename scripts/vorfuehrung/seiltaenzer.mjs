// Seiltänzer: Hoch über den Gipfeln im Polarlicht kommen die Böen, treiben
// Schnee durchs Bild, und er hält mit der Stange dagegen – Schritt für Schritt.
export default {
  bereit: () => Boolean(window.LernappSeiltaenzer?.state?.l),
  spiele: () => {
    const T = window.LernappSeiltaenzer;
    const st = T.state;
    // Er hält erst dagegen, wenn er ein wenig schief steht – so wiegt er
    // sich sichtbar auf dem Seil, und eine Böe drückt ihn erst ein Stück weg.
    let halten = false;
    const tick = () => {
      requestAnimationFrame(tick);
      if (st.schritt !== "lauf") return;
      const kippt = st.l.th + 0.4 * st.l.w;
      if (kippt < -0.05) halten = true;
      else if (kippt > 0.05) halten = false;
      if (halten) T.druecken(); else T.loslassen();
    };
    T.druecken();
    T.loslassen();
    requestAnimationFrame(tick);
  },
  // Nach gut 100 s ist er bei den Gipfeln (ab 320 m) – dort kommen die Böen
  // alle paar Sekunden und am stärksten.
  vorlauf: 103000,
  dauer: 8500,
};
