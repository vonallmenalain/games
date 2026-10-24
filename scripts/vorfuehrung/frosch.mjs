// Froschsprung: In der Dämmerung springt der Frosch von Blatt zu Blatt, auch
// auf die treibenden – genau in die Mitte, «perfekt», eine lange Reihe.
export default {
  bereit: () => Boolean(window.LernappFrosch?.state?.blaetter?.length),
  spiele: () => {
    const F = window.LernappFrosch;
    const st = F.state;
    const host = document.querySelector(".cm-stage") || document.body;
    let unten = false;
    let vorher = performance.now();
    let schritt = 1 / 60;
    // Wie weit er die Mitte des nächsten Blattes verfehlt, wenn er mit
    // dieser Ladung springt – mit dem Treiben während des Flugs.
    const fehlt = (ladung, spaeter = 0) => {
      const ziel = st.blaetter[st.auf + 1];
      const hier = st.blaetter[st.auf];
      const w = F.reichweite(ladung);
      const x = st.frosch.x + F.blattX(hier, st.uhr + spaeter) - F.blattX(hier, st.uhr);
      return F.blattX(ziel, st.uhr + spaeter + F.flugzeit(w)) - (x + w);
    };
    const tick = (jetzt) => {
      requestAnimationFrame(tick);
      schritt = Math.min(0.05, Math.max(0.004, (jetzt - vorher) / 1000));
      vorher = jetzt;
      if (st.schritt === "platsch" || st.phase === "ende") return;
      if (st.schritt !== "sitzt" && st.schritt !== "start") return;
      if (!unten) {
        unten = true;
        host.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        return;
      }
      if (!st.laedt) return;
      // Loslassen, wenn es jetzt besser passt als im nächsten Bild – und
      // gut genug für die Mitte.
      const ziel = st.blaetter[st.auf + 1];
      const jetztFehlt = Math.abs(fehlt(st.ladung));
      const dann = Math.abs(fehlt(F.pendel((st.ladeUhr + schritt) / F.ladeZeit(st.auf)), schritt));
      const gut = Math.max(3.5, ziel.r * F.PERFEKT_ANTEIL) * 0.7;
      if (jetztFehlt < gut && jetztFehlt <= dann) {
        unten = false;
        window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      }
    };
    requestAnimationFrame(tick);
  },
  // Ab dem sechsten Blatt treiben manche; nach 10 s ist er um das zehnte.
  vorlauf: 10000,
  dauer: 9500,
};
