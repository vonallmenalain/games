// Brückenbauer: Die erste Brücke liegt nur auf dem Pfeiler, danach kippt der
// Balken jedes Mal genau auf die rote Mitte – «Genau ×2», «×3», «×4» … Der
// Arbeiter geht Brücke um Brücke weiter; gefallen wird nie.
export default {
  bereit: () => Boolean(window.LernappBruecke?.state?.pfeiler?.length),
  spiele: () => {
    const B = window.LernappBruecke;
    const host = document.querySelector(".cm-stage") || document.body;
    // Wohin die Spitze soll, als Anteil der halben Pfeilerbreite neben der
    // Mitte: die erste ein Stück daneben (noch im Vorlauf), danach genau – so
    // wächst die Reihe durch den ganzen Film.
    const daneben = (n) => (n === 0 ? 0.5 : 0);
    let n = 0;
    let unten = false;
    let ziel = 0;
    let wartenSeit = 0;
    let vorher = 0;
    const tick = (jetzt) => {
      requestAnimationFrame(tick);
      const st = B.state;
      if (st.phase === "ende") return;
      if (!unten) {
        if (st.schritt !== "warten") { wartenSeit = 0; return; }
        // Ein Augenblick Ruhe, bevor der Finger wieder aufs Bild geht.
        if (!wartenSeit) wartenSeit = jetzt;
        if (jetzt - wartenSeit < 160) return;
        const p = st.pfeiler[st.hier + 1];
        ziel = p.x + daneben(n) * (p.w / 2 - 2);
        n += 1;
        unten = true;
        vorher = 0;
        host.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        return;
      }
      // Der Druck kam nicht an: Finger wieder hoch, nächster Versuch.
      if (st.schritt === "warten") {
        unten = false;
        window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
        return;
      }
      if (st.schritt !== "wachsen" || !st.balken) return;
      // Loslassen, wenn die Spitze jetzt näher am Ziel liegt als nach dem
      // nächsten Bild.
      const spitze = st.balken.x + st.balken.len;
      const schritt = Math.max(0.5, st.balken.len - vorher);
      vorher = st.balken.len;
      if (spitze + schritt / 2 < ziel) return;
      unten = false;
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 1200,
  dauer: 10000,
};
