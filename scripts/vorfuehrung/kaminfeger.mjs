// Kaminfeger: Er springt von Wand zu Wand die Gasse hinauf, genau nach dem
// Weg, um den die Gasse gebaut ist – rutscht, wo etwas über der Landung
// hängt, und springt sonst gleich weiter.
export default {
  bereit: () => Boolean(window.LernappKaminfeger?.state?.plan?.length && window.LernappKaminfeger.view.cssW > 0),
  spiele: () => {
    const K = window.LernappKaminfeger;
    const st = K.state;
    const tick = () => {
      requestAnimationFrame(tick);
      if (st.phase === "bereit") { K.tippen(performance.now()); return; }
      if (st.phase !== "spiel") return;
      if ((st.schritt === "halt" || st.schritt === "rutsch") && st.kf.y <= st.plan[st.spruenge].t + 0.5) K.tippen(performance.now());
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 2500,
  dauer: 10000,
  bild: 3500,
  // Er rutscht gerade an der Wand (so ist er gut zu erkennen), unter den
  // Wolken, und im Bild hängt allerlei: mindestens vier Arten von
  // Hindernissen, darunter eine Laterne und etwas, das weit in die Gasse
  // ragt. Findet sich das nicht bald, genügt weniger.
  bildWenn: () => {
    const K = window.LernappKaminfeger;
    const st = K.state;
    if (st.schritt !== "rutsch" || st.kf.vr < 12) return false;
    window.__kfSeit = window.__kfSeit || performance.now();
    const gewartet = (performance.now() - window.__kfSeit) / 1000;
    if (gewartet > 18) return true;
    if (st.punkte > 82) return false;
    const von = st.camY + 16;
    const bis = st.camY + K.view.h - 24;
    const arten = new Set([...st.hindernisse[-1], ...st.hindernisse[1]].filter((h) => h.y0 > von && h.y1 < bis).map((h) => h.art));
    const gross = arten.has("schild") || arten.has("balkon");
    if (gewartet > 7) return arten.size >= 3 && (gross || arten.has("laterne"));
    return arten.size >= 4 && arten.has("laterne") && gross;
  },
};
