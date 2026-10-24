// Kranhafen: Der Container pendelt, und er wird im richtigen Augenblick
// losgelassen – fast jeder landet «Perfekt!» mitten auf dem Stapel, Reihe um
// Reihe, bis das Schiff voll ist, tutet und das nächste einläuft.
export default {
  bereit: () => Boolean(window.LernappKranhafen?.state?.kiste),
  spiele: () => {
    const K = window.LernappKranhafen;
    const host = document.querySelector(".cm-stage") || document.body;
    // Wie lange auf diesen Container schon gewartet wird: Kommt die Mitte
    // nicht vorbei, tut es mit der Zeit auch ein sicherer Platz daneben.
    let kiste = null;
    let seit = 0;
    const tick = (jetzt) => {
      requestAnimationFrame(tick);
      const st = K.state;
      if (st.phase === "ende") return;
      // Wo der Container landen würde, liesse man ihn jetzt los.
      const v = K.vorhersage();
      if (!v) return;
      if (st.kiste !== kiste) { kiste = st.kiste; seit = jetzt; }
      const geduld = jetzt - seit;
      const gut = v.perfekt || (geduld > 2600 && !v.daneben && !v.knapp && Math.abs(v.ende) < 8);
      if (!gut) return;
      host.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 1200,
  dauer: 10000,
};
