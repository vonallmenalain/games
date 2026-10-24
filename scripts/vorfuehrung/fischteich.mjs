// Fischteich: Fisch um Fisch wird angetippt, jeder genau einmal – das Rad
// füllt sich, das Häkchen kommt, und ist der Teich leer, schwimmt im nächsten
// einer mehr. Doppelt getippt wird nie.
export default {
  bereit: () => Boolean(window.LernappFischteich?.state?.fische?.length),
  spiele: () => {
    const F = window.LernappFischteich;
    let warte = 0;
    const tick = (jetzt) => {
      requestAnimationFrame(tick);
      const st = F.state;
      if (st.phase !== "play") return;
      // Erst wenn das Rad über dem letzten Fang voll ist – und dann nach einem
      // kurzen Blick über den Teich, wie bei einem Kind.
      if (performance.now() < st.sperreBis || jetzt < warte) return;
      const frei = st.fische.filter((f) => !f.gefangen);
      if (!frei.length) return;
      // Der Fisch, der am weitesten vom Rand schwimmt: Den sieht man am besten.
      const mitte = (f) => Math.abs(f.x - 0.5) + Math.abs(f.y - 0.5);
      const fisch = frei.sort((a, b) => mitte(a) - mitte(b))[0];
      const box = fisch.node.getBoundingClientRect();
      const ort = { bubbles: true, cancelable: true, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2, pointerId: 1, isPrimary: true };
      fisch.node.dispatchEvent(new PointerEvent("pointerdown", ort));
      fisch.node.dispatchEvent(new PointerEvent("pointerup", ort));
      fisch.node.click();
      warte = jetzt + 1500 + 180 + Math.random() * 160;
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 1200,
  dauer: 10000,
};
