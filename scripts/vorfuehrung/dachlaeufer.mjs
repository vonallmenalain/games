// Dachläufer: Der Bote rennt über die Dächer der Altstadt, genau nach dem
// Weg, um den die Strecke gebaut ist – er springt ab, wo der Weg abspringt,
// und hält so lange, wie der Weg hält.
export default {
  bereit: () => Boolean(window.LernappDachlaeufer?.state?.daecher?.length && window.LernappDachlaeufer.view.cssW > 0),
  spiele: () => {
    const K = window.LernappDachlaeufer;
    const st = K.state;
    let soll = 0;
    const tick = () => {
      requestAnimationFrame(tick);
      const jetzt = performance.now();
      if (st.phase === "bereit") { K.druecken(jetzt); K.loslassen(jetzt); return; }
      if (st.phase !== "spiel" || st.schritt === "sturz") return;
      const k = st.lf;
      const r = st.daecher[k.dach];
      if (st.gedrueckt && (k.boden || !k.traegt || k.halt >= soll - 0.004)) K.loslassen(jetzt);
      if (k.boden && !st.gedrueckt && k.x >= r.t - 2) { K.druecken(jetzt); soll = r.halt; }
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 1500,
  dauer: 10000,
  bild: 2500,
  // Er ist mitten im Sprung, hoch über der Lücke (so sieht man, worum es
  // geht), und die Sonne steht noch über den Bergen. Findet sich das nicht
  // bald, genügt irgendein Sprung.
  bildWenn: () => {
    const K = window.LernappDachlaeufer;
    const st = K.state;
    const k = st.lf;
    if (st.phase !== "spiel" || k.boden || k.traegt) return false;
    window.__dlSeit = window.__dlSeit || performance.now();
    const gewartet = (performance.now() - window.__dlSeit) / 1000;
    if (gewartet > 12) return true;
    const a = st.daecher[k.ab];
    const b = st.daecher[k.ab + 1];
    if (!b) return false;
    const ueberLuecke = k.x > a.x1 + 6 && k.x < b.x0 - 6;
    return ueberLuecke && Math.abs(k.vy) < 140 && st.punkte < 110 && b.x0 - a.x1 > 70;
  },
};
