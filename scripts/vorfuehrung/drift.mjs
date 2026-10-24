// Drift-Rennen: Der Wagen driftet Kurve um Kurve die Passstrasse hinauf –
// gedrückt genau am Kurvenanfang, losgelassen genau in die neue Gerade:
// «Perfekt!» in Serie.
export default {
  bereit: () => Boolean(window.LernappDrift?.state?.bahn),
  spiele: () => {
    const D = window.LernappDrift;
    const st = D.state;
    let dt = 1 / 60;
    let vorher = 0;
    let gedrueckt = false;
    let fertig = null;            // die Kurve, um die schon gedriftet wurde
    const tick = (jetzt) => {
      if (st.phase === "ende" || st.schritt === "crash") return;
      requestAnimationFrame(tick);
      if (vorher) dt = Math.min(1 / 30, Math.max(1 / 144, dt * 0.9 + ((jetzt - vorher) / 1000) * 0.1));
      vorher = jetzt;
      // Der erste Druck startet den Wagen; gedriftet wird erst danach.
      if (st.phase === "bereit") { D.druecken(); D.loslassen(); return; }
      if (st.phase !== "spiel" || st.schritt !== "fahrt") return;
      const v = D.tempoBei(st.auto.s);
      // Was jetzt gedrückt oder losgelassen wird, gilt ab dem nächsten Bild
      // – mit der Lage von jetzt. Also: im Bild, das dem richtigen Punkt am
      // nächsten liegt.
      // Losgelassen wird, sobald der Wagen so genau in die Gerade zeigt, dass
      // es «perfekt» ist (drift.js, perfektBei) – nicht erst im besten Bild:
      // Ein langes Bild drehte ihn sonst darüber hinaus.
      if (st.dreh) {
        const rest = D.winkelDiff(st.dreh.kurve.a1, st.auto.a) * st.dreh.sig;
        const perfekt = Math.max((2.2 * Math.PI) / 180, (v / st.dreh.r) * 0.03);
        if (rest <= perfekt * 0.85 && gedrueckt) { D.loslassen(); gedrueckt = false; }
        return;
      }
      const k = D.aktiveKurve();
      if (k && k !== fertig && st.auto.s >= k.s0 - (v * dt) / 2 && !gedrueckt) {
        fertig = k;
        D.druecken();
        gedrueckt = true;
      }
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 15000,
  dauer: 8000,
};
