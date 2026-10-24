// Turmbau: Der Block wird meist genau getroffen, ab und zu ein Stück daneben –
// dann bricht etwas ab, und der Turm wird schmaler. Daneben geht keiner.
export default {
  bereit: () => Boolean(window.LernappTurmbau?.state?.schweber),
  spiele: () => {
    const host = document.querySelector(".cm-stage") || document.body;
    const muster = [0, 0, 0.32, 0, 0, -0.26, 0, 0, 0, 0.2, 0, 0];
    let n = 0;
    const tick = () => {
      requestAnimationFrame(tick);
      const st = window.LernappTurmbau.state;
      const s = st.schweber;
      if (!s || s.fallend || s.einzug > 0.3 || st.phase === "ende") return;
      const unten = st.bloecke[st.bloecke.length - 1];
      const ziel = muster[n % muster.length] * unten.w * 0.5;
      if (Math.abs(s.x - unten.x - ziel) > 2.2) return;
      n += 1;
      host.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 1200,
  dauer: 10000,
};
