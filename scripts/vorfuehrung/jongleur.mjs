// Jongleur: Mitten in einer guten Runde – sechs Dinge fliegen im Takt, mit
// goldenen Spuren, darunter eine Keule. Von der Seite hat der Clown eben das
// siebte geworfen, es fliegt im hohen Bogen herein. Der Autopilot wirft jedes
// Ding gleich nach dem Fang, wie es eine sichere Hand täte.
export default {
  bereit: () => Boolean(window.LernappJongleur?.state && window.LernappJongleur.view.cssW > 0),
  spiele: () => {
    const J = window.LernappJongleur;
    // Immer dieselbe Welt (sonst brächte der Clown jedes Mal etwas anderes):
    // die Saat, wie sie ein Live-Abend vorgibt, und eine frische Runde damit.
    if (window.LernappLiveSpiel) window.LernappLiveSpiel.saat = () => 20261025;
    document.querySelector(".cm-bar-left .cm-icon-again")?.click();
    const st = J.state;
    const pilot = () => {
      for (const h of [0, 1]) {
        const d = J.dingVon(st.haende[h].ding);
        if (d && (d.start || st.tick - d.fangTick >= 2)) J.tippe(h);
      }
    };
    // Vorspulen bis kurz vor die Zugabe zum siebten Ding.
    J.tippe(0);
    for (let n = 0; st.phase === "spiel" && st.punkte < 49 && n < 240 * 120; n += 1) {
      pilot();
      J.takt(1 / 240);
    }
    const tick = () => {
      if (st.phase === "ende") return;
      requestAnimationFrame(tick);
      pilot();
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 800,
  dauer: 9000,
  // Das Standbild: wenn das Ding des Clowns gut zur Hälfte geflogen ist.
  bild: 1200,
  bildWenn: () => {
    const J = window.LernappJongleur;
    const z = J?.state?.zugabe;
    if (!z || z.phase !== "flug") return false;
    const d = J.dingVon(z.id);
    const u = (J.state.tick - d.wurfTick) / Math.max(1, d.landTick - d.wurfTick);
    return u > 0.38 && u < 0.5;
  },
};
