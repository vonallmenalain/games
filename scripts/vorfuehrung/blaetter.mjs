// Blätter im Strom: Welle um Welle treiben die Blätter übers Wasser, und
// jede wird richtig gewischt – mal wohin sie schwimmen, mal wohin sie zeigen.
export default {
  bereit: () => Boolean(window.LernappBlaetter?.state && document.querySelector(".cm-start")),
  spiele: () => {
    const B = window.LernappBlaetter;
    const st = B.state;
    const host = document.querySelector(".cm-stage") || document.body;
    // So lange schaut er jede Welle an, bevor er wischt (ms) – lange genug,
    // dass man die Blätter treiben sieht.
    const bedenken = [1100, 850, 1300, 950, 1200, 800, 1050, 1250];
    let n = 0;
    let welle = null;
    let wischtAb = 0;
    let finger = 1;
    const wische = (richtung) => {
      const r = B.RICHTUNG[richtung];
      const box = host.getBoundingClientRect();
      const x = box.left + box.width * 0.5;
      const y = box.top + box.height * 0.55;
      finger += 1;
      const art = { bubbles: true, pointerId: finger, pointerType: "touch", isPrimary: true };
      host.dispatchEvent(new PointerEvent("pointerdown", { ...art, clientX: x, clientY: y }));
      host.dispatchEvent(new PointerEvent("pointermove", { ...art, clientX: x + r.dx * 20, clientY: y + r.dy * 20 }));
      host.dispatchEvent(new PointerEvent("pointermove", { ...art, clientX: x + r.dx * 48, clientY: y + r.dy * 48 }));
      host.dispatchEvent(new PointerEvent("pointerup", { ...art, clientX: x + r.dx * 60, clientY: y + r.dy * 60 }));
    };
    const tick = (jetzt) => {
      if (st.phase === "over") return;
      requestAnimationFrame(tick);
      const w = st.welle;
      if (st.phase !== "play" || !w || w.fertig) return;
      if (w !== welle) {
        welle = w;
        wischtAb = jetzt + bedenken[n % bedenken.length];
        n += 1;
      }
      if (jetzt >= wischtAb) wische(w.antwort);
    };
    document.querySelector(".cm-start").click();
    requestAnimationFrame(tick);
  },
  vorlauf: 2500,           // die Runde hat 45 s – die Aufnahme liegt weit davor
  dauer: 10000,
};
