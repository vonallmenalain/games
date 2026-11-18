// Augenmass: Ein Tipp beendet die Vorschau jedes Blattes. Dann zieht der
// Finger unten rechts auf dem Blatt, und das Fadenkreuz geht denselben Weg
// mit – erst grob hin, loslassen, nachgreifen, genau hin. Der Knopf
// «Bestätigen» setzt es: meist auf den halben Millimeter, ab und zu ein,
// zwei daneben. Danach zeichnet sich die Lösung ein.
export default {
  bereit: () => Boolean(window.LernappAugenmass?.state?.blaetter && window.LernappAugenmass.view.cssW > 0),
  spiele: () => {
    const A = window.LernappAugenmass;
    const st = A.state;
    const flaeche = document.querySelector("#am-stage canvas");
    const sende = (art, ort, id = 1, ziel = flaeche) => ziel.dispatchEvent(new PointerEvent(art, {
      bubbles: true, cancelable: true, pointerId: id, isPrimary: id === 1, pointerType: "touch", clientX: ort.x, clientY: ort.y,
    }));
    const tipp = () => { const b = A.imBild({ x: 50, y: 50 }); sende("pointerdown", b); sende("pointerup", b); };
    // Wie weit neben der Lösung das Fadenkreuz am Ende liegt, in Millimetern.
    const neben = [[0.2, -0.1], [0.4, 0.3], [-0.1, 0.2], [1.3, -0.6], [0.3, 0.1], [-0.4, 0.3], [0.1, 0.1], [2.3, 1.1], [-0.3, -0.2], [0.4, 0]];
    const sanft = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
    // Ein Zug: Der Finger setzt bei «wo» auf (Anteile des Blattes) und zieht
    // so, dass das Fadenkreuz in «dauer» Millisekunden von seiner Stelle
    // nach «nach» wandert.
    const zugVon = (wo, nach, start, dauer) => ({ wo, nach, start, dauer, unten: false, finger: null, von: null });
    let plan = [];
    let index = -1;
    // Der erste Tipp legt das erste Blatt auf.
    tipp();
    const tick = (jetzt) => {
      requestAnimationFrame(tick);
      // Die Vorschau: kurz hinschauen, dann tippen – das Blatt liegt da.
      if (st.phase === "vorschau") {
        plan = [];
        if (jetzt - st.vorSeit > 700) tipp();
        return;
      }
      if (st.phase !== "aufgabe") { plan = []; return; }
      const a = A.blatt();
      if (st.index !== index) {
        // Ein neues Blatt: kurz lesen, dann ziehen.
        index = st.index;
        if (a.art === "tunnel") { plan = [{ tunnel: true }]; return; }
        const [dx, dy] = neben[index % neben.length];
        const ziel = A.aufBahn(a, { x: a.ziel.x + dx, y: a.ziel.y + dy });
        const grob = A.aufBahn(a, { x: ziel.x + (index % 2 ? 9 : -9), y: ziel.y + 6 });
        plan = [
          zugVon({ x: 0.74, y: 0.86 }, grob, jetzt + 1000, 620),
          zugVon({ x: 0.82, y: 0.8 }, ziel, jetzt + 1950, 520),
          { knopf: true, start: jetzt + 2900, unten: false },
        ];
        return;
      }
      const zug = plan[0];
      if (!zug) return;
      if (zug.tunnel) {
        // Im Tunnel: Die Kugel rollt von selbst los; der Tipp kommt, wenn
        // sie beim Pfeil sein muss.
        if (!st.los) return;
        if (A.kugelWeg(a, A.tunnelZeit()) >= a.sm - 0.5) { sende("pointerdown", A.imBild(a.ziel)); plan = []; }
        return;
      }
      if (jetzt < zug.start) return;
      if (zug.knopf) {
        // Der Daumen der anderen Hand drückt «Bestätigen».
        const r = A.knopf().getBoundingClientRect();
        const mitte = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        if (!zug.unten) { zug.unten = true; sende("pointerdown", mitte, 2, A.knopf()); return; }
        if (jetzt - zug.start >= 110) { sende("pointerup", mitte, 2, A.knopf()); plan = []; }
        return;
      }
      if (!zug.unten) {
        // Aufsetzen und über den Schlupf hinaus – erst dann geht das Fadenkreuz mit.
        zug.unten = true;
        const kante = flaeche.getBoundingClientRect();
        zug.finger = { x: kante.left + A.view.x0 + A.view.seite * zug.wo.x, y: kante.top + A.view.y0 + A.view.seite * zug.wo.y };
        sende("pointerdown", zug.finger);
        zug.finger = { x: zug.finger.x + A.SCHLUPF + 1, y: zug.finger.y };
        sende("pointermove", zug.finger);
        zug.von = { x: st.zeiger.x, y: st.zeiger.y };
        return;
      }
      const k = sanft(Math.min(1, (jetzt - zug.start) / zug.dauer));
      sende("pointermove", { x: zug.finger.x + (zug.nach.x - zug.von.x) * k * A.view.s, y: zug.finger.y + (zug.nach.y - zug.von.y) * k * A.view.s });
      // Am Ziel noch einen Augenblick halten, dann loslassen.
      if (jetzt - zug.start >= zug.dauer + 180) {
        sende("pointerup", { x: zug.finger.x + (zug.nach.x - zug.von.x) * A.view.s, y: zug.finger.y + (zug.nach.y - zug.von.y) * A.view.s });
        plan.shift();
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
