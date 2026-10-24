// Der Heizer: Die Schicht läuft schon ein paar Sekunden. Kohle kommt immer auf
// den Kessel, der als nächster leer wäre, und nie ins Rote; der Umriss des
// dritten Kessels füllt sich, er geht auf, und die Hände verteilen auf drei.
export default {
  bereit: () => Boolean(window.LernappHeizer?.state && document.querySelector(".cm-start")),
  spiele: () => {
    const H = window.LernappHeizer;
    // Der Knopf auf dem Startbild – die Schicht beginnt.
    document.querySelector(".cm-start")?.click();
    let warte = 0;
    const tick = (jetzt) => {
      requestAnimationFrame(tick);
      const st = H.state;
      if (st.phase !== "play" || jetzt < warte) return;
      // Der Kessel, der als nächster leer wäre: wenig Druck, schneller Verbrauch.
      const dran = [...st.kessel].sort((a, b) => a.wert / a.tempo - b.wert / b.tempo)[0];
      // Nachgelegt wird, sobald eine Schaufel ganz hineinpasst, ohne dass der
      // Zeiger ins Rote steigt.
      if (!dran || dran.wert > H.GEFAHR - H.KOHLE - 0.5) return;
      const box = dran.node.getBoundingClientRect();
      dran.node.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: "touch",
        clientX: box.left + box.width / 2, clientY: box.top + box.height * 0.8,
      }));
      warte = jetzt + 170;
    };
    requestAnimationFrame(tick);
  },
  // Die Schicht beginnt mit dem Autopiloten: Der Umriss des dritten Kessels
  // steht ab 6,4 s da, er geht bei 9 s auf, der vierte kündigt sich ab 15,4 s an.
  vorlauf: 5600,
  dauer: 10000,
};
