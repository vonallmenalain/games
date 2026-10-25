// Heisser Draht: Der Ring gleitet sauber am Kupferdraht entlang, durch
// Zickzack, Haarnadeln und an den Magneten vorbei – die Serie wächst, Funkeln
// läuft um den Ring. Einmal geht es knapp: Der Draht glimmt auf, Funken
// springen über.
export default {
  bereit: () => Boolean(window.LernappDraht?.state?.draht?.punkte?.length),
  spiele: () => {
    const D = window.LernappDraht;
    const st = D.state;
    // Wohin der Ring soll: auf die Mitte des Drahts, so weit voraus, wie er
    // in einem Bild läuft – und daneben, um ab (Anteil der Luft).
    const ziel = (voraus, ab) => {
      const m = (st.S + D.tempoBei(st.S / D.METER) * voraus) / D.METER;
      const luft = D.toleranzBei(m) - D.zitterBei(m);
      return D.drahtBei(m) + ab * luft;
    };
    // Erst im Zeitraffer bis dorthin, wo der Draht schon Haken schlägt.
    D.druecken();
    D.loslassen();
    for (let n = 0; st.schritt === "fahrt" && st.meter < 380 && n < 200000; n += 1) {
      D.setzeRing(ziel(1 / 120, 0));
      D.takt(1 / 120);
    }
    // Dann im Bildtakt: meist genau in der Mitte, nach gut neun Sekunden
    // einmal knapp daneben.
    const start = performance.now();
    const tick = (jetzt) => {
      if (st.phase === "ende" || st.schritt === "crash") return;
      requestAnimationFrame(tick);
      const t = (jetzt - start) / 1000;
      const knapp = t > 9.2 && t < 10.2 ? Math.sin(((t - 9.2) / 1) * Math.PI) * 0.82 : 0;
      D.setzeRing(ziel(1 / 60, knapp));
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 2500,
  dauer: 10000,
  // Das Standbild: mitten in der Serie, der Ring funkelt (ms nach dem Start;
  // standbild ist dieselbe Stelle in Sekunden des Films).
  bild: 7000,
  standbild: 4.5,
};
