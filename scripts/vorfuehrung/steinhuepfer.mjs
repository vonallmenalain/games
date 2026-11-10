// Steinhüpfer: Die Sonne steigt eben über den Sattel, der Stein hat gerade
// aufgesetzt – vor ihm sein Ring auf dem stillen Wasser, unter ihm sein
// Spiegelbild.
export default {
  bereit: () => Boolean(window.LernappSteinhuepfer?.state?.welt && window.LernappSteinhuepfer.view.cssW > 0),
  spiele: () => {
    const S = window.LernappSteinhuepfer;
    const st = S.state;
    // Scharf bleiben, auch wenn der Rechner für die Aufnahme langsam zeichnet.
    S.guete(1);
    // Immer derselbe See: die Runde noch einmal beginnen, mit fester Saat.
    // (Der erste Neustart weckt den Ton – klang.js füllt dabei sein Rauschen
    // aus Math.random; erst der zweite würfelt, was hier festgelegt ist.)
    const neustart = () => document.querySelector(".cm-bar-left .cm-icon-again")?.click();
    neustart();
    const echt = Math.random;
    let saat = 11;
    Math.random = () => { saat = (saat * 1664525 + 1013904223) >>> 0; return saat / 4294967296; };
    neustart();
    Math.random = echt;
    // Der Pilot: wirft genau in der Mitte und tippt genau beim Aufsetzen –
    // jeder Tipp wird zu Beginn des Bogens für dessen Ende vorgemerkt.
    let geworfen = false;
    let letzter = null;
    const pilot = () => {
      if (!geworfen && st.schritt === "ausholen") { geworfen = true; S.halte(false, S.mitteZeit()); }
      if (st.schritt === "flug" && st.bogen !== letzter) { letzter = st.bogen; S.tippe(S.aufsetzZeit()); }
    };
    window.__steinPilot = pilot;
    S.halte(true);
    // Vorspulen bis kurz vor den Sonnenaufgang – gerechnet, nicht gezeichnet.
    for (let n = 0; n < 200000 && st.phase === "spiel" && st.z < 150; n += 1) {
      pilot();
      S.takt(1 / 120);
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
  // Das Standbild: Die Zeit bleibt stehen, und das Spiel rechnet genau bis zum
  // schönen Moment – der erste Hüpfer auf stillem Wasser, nachdem die Sonne
  // über dem Grat steht, und ein Stück in den Bogen hinein: Der Ring liegt
  // vorn im Bild, der Stein steigt, sein Spiegelbild sinkt.
  bild: 300,
  bildWenn: () => {
    const S = window.LernappSteinhuepfer;
    const st = S.state;
    if (st.phase !== "spiel") return true;
    window.requestAnimationFrame = () => 0;
    const pilot = window.__steinPilot;
    const still = () => !S.boeBei(st.z) && !S.boeBei(st.z + 40) && S.pegelBei(st.z) === 0;
    let huepfer = st.huepfer;
    for (let n = 0; n < 100000 && st.phase === "spiel" && st.schritt !== "sinkt" && st.schritt !== "ufer"; n += 1) {
      pilot();
      S.takt(1 / 240);
      if (st.huepfer === huepfer) continue;
      huepfer = st.huepfer;
      if (st.z > 212 && still()) break;
    }
    for (let n = 0; n < 2000 && st.schritt === "flug" && (st.zeit - st.bogen.t0) / st.bogen.T < 0.17; n += 1) {
      pilot();
      S.takt(1 / 240);
    }
    // Ohne Schrift mitten im Bild.
    st.schriften.length = 0;
    st.karte = null;
    S.zeichnen();
    return true;
  },
};
