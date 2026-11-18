// Augenmass: Der Finger setzt das Fadenkreuz neben die Stelle, schiebt es
// unter der Lupe hin und lässt los – meist auf den halben Millimeter, ab und
// zu ein, zwei daneben. Danach zeichnet sich die Lösung ein.
export default {
  bereit: () => Boolean(window.LernappAugenmass?.state?.blaetter && window.LernappAugenmass.view.cssW > 0),
  spiele: () => {
    const A = window.LernappAugenmass;
    const st = A.state;
    const druck = (art, ort) => {
      const b = A.imBild(ort);
      document.querySelector("#am-stage canvas").dispatchEvent(new PointerEvent(art, {
        bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: "touch", clientX: b.x, clientY: b.y,
      }));
    };
    // Wie weit neben der Lösung der Finger loslässt, in Millimetern.
    const neben = [[0.2, -0.1], [0.4, 0.3], [-0.1, 0.2], [1.3, -0.6], [0.3, 0.1], [-0.4, 0.3], [0.1, 0.1], [2.3, 1.1], [-0.3, -0.2], [0.4, 0]];
    const sanft = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
    let zug = null;
    let index = -1;
    // Der erste Tipp legt das erste Blatt auf.
    druck("pointerdown", { x: 50, y: 50 });
    const tick = (jetzt) => {
      requestAnimationFrame(tick);
      if (st.phase !== "aufgabe") { zug = null; return; }
      const a = A.blatt();
      if (st.index !== index) {
        // Ein neues Blatt: kurz lesen, dann den Finger daneben aufsetzen.
        index = st.index;
        if (a.art === "tunnel") { zug = { tunnel: true }; return; }
        const [dx, dy] = neben[index % neben.length];
        const ziel = A.aufBahn(a, { x: a.ziel.x + dx, y: a.ziel.y + dy });
        const von = A.aufBahn(a, { x: ziel.x + (index % 2 ? 13 : -13), y: ziel.y + 8 });
        zug = { von, ziel, start: jetzt + 1150, dauer: 850, unten: false };
        return;
      }
      if (!zug) return;
      if (zug.tunnel) {
        // Im Tunnel: tippen, wenn die Kugel beim Pfeil sein muss.
        if (A.kugelWeg(a, A.seit()) >= a.sm - 0.5) { druck("pointerdown", a.ziel); zug = null; }
        return;
      }
      if (jetzt < zug.start) return;
      if (!zug.unten) { zug.unten = true; druck("pointerdown", zug.von); return; }
      const k = sanft(Math.min(1, (jetzt - zug.start) / zug.dauer));
      druck("pointermove", { x: zug.von.x + (zug.ziel.x - zug.von.x) * k, y: zug.von.y + (zug.ziel.y - zug.von.y) * k });
      // Am Ziel noch einen Augenblick halten, dann loslassen.
      if (jetzt - zug.start >= zug.dauer + 380) {
        druck("pointerup", zug.ziel);
        zug = null;
      }
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 700,
  dauer: 10000,
  // Das Standbild: ein Blatt beim Nachmessen – die Lösung ist eingezeichnet,
  // der Stempel steht, und ein paar Kästchen sind schon gefüllt.
  bild: 9000,
  bildWenn: () => {
    const st = window.LernappAugenmass.state;
    return Boolean(st.wertung) && st.index >= 2 && st.phase === "zeigen" && performance.now() - st.tZeig > 1100 && performance.now() - st.tZeig < 1500;
  },
};
