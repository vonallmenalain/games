// Wo hält der Zug?: Die Lok wird vom Bahnhof 0 aus über das Gleis geschoben
// und hält fast immer genau an der gesuchten Zahl – das Schild fährt hin, «+10».
// Ab und zu steht sie ein Stück daneben («+9»), weit daneben nie.
export default {
  bereit: () => Boolean(window.LernappZahlengleis?.state && document.querySelector(".zg-gleis .zg-marke")),
  spiele: () => {
    const Z = window.LernappZahlengleis;
    // Wie weit neben der Zahl die Lok hält, in Anteilen der Strecke: meist
    // genau, jede vierte ein bis zwei Prozent daneben.
    const neben = [0, 0, 0.013, 0, 0, -0.016, 0, 0, 0.011, 0];
    let zug = null;
    let index = -1;
    const lage = (p) => {
      const marken = document.querySelectorAll(".zg-marke");
      const a = marken[0].getBoundingClientRect();
      const b = marken[marken.length - 1].getBoundingClientRect();
      const links = a.left + a.width / 2;
      return links + (b.left + b.width / 2 - links) * p;
    };
    const druck = (art, p) => {
      const gleis = document.querySelector(".zg-gleis");
      const box = gleis.getBoundingClientRect();
      gleis.dispatchEvent(new PointerEvent(art, {
        bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: "touch",
        clientX: lage(p), clientY: box.top + box.height * 0.55,
      }));
    };
    const sanft = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
    const tick = (jetzt) => {
      requestAnimationFrame(tick);
      const st = Z.state;
      if (st.phase !== "aufgabe") { zug = null; return; }
      if (st.index !== index) {
        // Eine neue Zahl: kurz lesen, dann die Lok greifen.
        index = st.index;
        const ziel = Math.max(0, Math.min(1, st.zahl / st.gleis.bis + neben[index % neben.length]));
        zug = { ziel, start: jetzt + 380, dauer: 520 + 700 * ziel, unten: false };
        return;
      }
      if (!zug || jetzt < zug.start) return;
      if (!zug.unten) { zug.unten = true; druck("pointerdown", 0); return; }
      const k = Math.min(1, (jetzt - zug.start) / zug.dauer);
      druck("pointermove", zug.ziel * sanft(k));
      // Am Ziel noch einen Augenblick halten, dann loslassen.
      if (jetzt - zug.start >= zug.dauer + 160) {
        druck("pointerup", zug.ziel);
        zug = null;
      }
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 700,
  dauer: 10000,
};
