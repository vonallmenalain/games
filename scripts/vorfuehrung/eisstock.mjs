// Eisstock: Bahn um Bahn – der Pilot spannt die Schleuder auf den besten
// Schub, lässt los, und der Stock gleitet ins Ziel: über die Bande, durch den
// Schnee, an den Balken vorbei.
export default {
  bereit: () => Boolean(window.LernappEisstock?.state?.bahnen && window.LernappEisstock.view.cssW > 0),
  spiele: () => {
    const E = window.LernappEisstock;
    const st = E.state;
    // Die ersten Bahnen im Zeitraffer, damit die Reihe schon etwas zeigt –
    // bis eine kommt, die sich gut ansieht.
    const schoen = ["bande", "zickzack", "stoss", "schnee", "gasse"];
    E.losGehts();
    while (st.index < 6 && !(st.index >= 2 && schoen.includes(st.bahnen[st.index].art))) {
      E.bahnLos();
      const best = E.loese(st.bahnen[st.index], 3);
      E.schiebeAb(best.winkel, best.kraft);
      for (let i = 0; i < 400 && st.phase === "fahrt"; i += 1) E.takt(0.2);
      E.weiter();
    }
    let plan = null;
    const tick = (jetzt) => {
      if (st.phase === "ende") return;
      requestAnimationFrame(tick);
      if (st.phase === "vorschau") {
        if (jetzt - st.vorSeit > 1300) { E.bahnLos(); plan = null; }
        return;
      }
      if (st.phase !== "aufgabe") { plan = null; return; }
      if (!plan) {
        // Der beste Schub – und wie der Finger dafür zieht (Bildpunkte).
        const best = E.loese(st.bahnen[st.index], 3);
        const lang = best.kraft * E.view.zug;
        const hin = E.view.quer ? [Math.cos(best.winkel), Math.sin(best.winkel)] : [Math.sin(best.winkel), -Math.cos(best.winkel)];
        const eis = E.view.eis;
        const von = [eis.x + eis.w * 0.5, eis.y + eis.h * 0.5];
        plan = { von, bis: [von[0] - hin[0] * lang, von[1] - hin[1] * lang], ab: performance.now() + 500, sitzt: false };
        return;
      }
      const t = (jetzt - plan.ab) / 1000;
      if (t < 0) return;
      if (!plan.sitzt) { plan.sitzt = E.zielBeginn(plan.von[0], plan.von[1], "pilot"); return; }
      // Erst zügig spannen, dann fein nachstellen, dann loslassen.
      const k = Math.min(1, t / 1.1);
      const sanft = 1 - (1 - k) ** 3;
      E.zielZu(plan.von[0] + (plan.bis[0] - plan.von[0]) * sanft, plan.von[1] + (plan.bis[1] - plan.von[1]) * sanft);
      if (t > 1.5) { E.zielEnde(); plan = null; }
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 900,
  dauer: 10000,
  // Das Standbild: Der Stock liegt, das Massband ist gezogen.
  bild: 1500,
  bildWenn: () => {
    const st = window.LernappEisstock.state;
    const tz = (performance.now() - st.tZeig) / 1000;
    return st.phase === "zeigen" && st.index >= 2 && tz > 0.6 && tz < 1.3;
  },
};
