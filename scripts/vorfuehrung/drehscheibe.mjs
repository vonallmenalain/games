// Drehscheibe: Pfeil um Pfeil fliegt in die drehende Scheibe, immer in die
// grösste Lücke, Äpfel nimmt er gern mit. Ist sie voll, zerspringt sie, und
// die nächste dreht anders – abgeprallt wird nie.
export default {
  bereit: () => Boolean(window.LernappDrehscheibe?.state?.scheibe),
  spiele: () => {
    const D = window.LernappDrehscheibe;
    const host = document.querySelector(".cm-stage") || document.body;
    // So lange fliegt ein Pfeil, bis er im Holz steckt – dazu ein Bild, bis
    // das Spiel ihn loslässt.
    const FLUG = 0.047 + 0.012;
    let vorherWinkel = null;
    let vorherZeit = 0;
    let geworfen = 0;
    let wartetSeit = 0;
    const tick = (jetzt) => {
      requestAnimationFrame(tick);
      const st = D.state;
      if (st.phase === "ende") return;
      // Wie schnell die Scheibe sich gerade dreht, aus den letzten zwei Bildern.
      const dt = (jetzt - vorherZeit) / 1000;
      const omega = vorherWinkel === null || dt <= 0 || dt > 0.1 ? 0 : (st.winkel - vorherWinkel) / dt;
      vorherWinkel = st.winkel;
      vorherZeit = jetzt;
      if (st.schritt !== "zielen" || st.flug || st.auf < 1 || st.nachladen > 0 || !st.scheibe) { wartetSeit = 0; return; }
      // Ein Atemzug zwischen zwei Würfen, wie bei einer Hand.
      if (jetzt - geworfen < 170) return;
      if (!wartetSeit) wartetSeit = jetzt;
      const sch = st.scheibe;
      // Wo der Pfeil in der Scheibe steckte, flöge er jetzt los.
      const landet = D.norm(Math.PI - (st.winkel + omega * FLUG));
      const naechster = Math.min(...sch.stecken.map((p) => D.abstand(p.w, landet)), 9);
      // Die grösste Lücke zwischen zwei steckenden Pfeilen: Ihre Mitte ist der
      // beste Platz. Wer zu lange wartet, nimmt auch einen etwas engeren.
      const winkel = sch.stecken.map((p) => D.norm(p.w)).sort((a, b) => a - b);
      const luecke = winkel.length < 2 ? Math.PI * 2
        : Math.max(...winkel.map((w, i) => (i + 1 < winkel.length ? winkel[i + 1] : winkel[0] + Math.PI * 2) - w));
      // Nie näher als boden an einen steckenden Pfeil (abprallen würde er
      // erst unter 0,15). Pendelt eine Scheibe nur über einen Teil des Rands,
      // kommt die schönste Lücke vielleicht nie vorbei – dann tut es mit der
      // Zeit auch eine engere.
      const geduld = Math.min(1, (jetzt - wartetSeit) / 2500);
      const boden = 0.36 - 0.1 * geduld;
      const genug = Math.max(boden, Math.min(0.62, (luecke / 2) * 0.85) * (1 - 0.45 * geduld));
      const apfel = sch.aepfel.some((a) => !a.weg && D.abstand(a.w, landet) < 0.12);
      if (naechster < boden || (naechster < genug && !apfel)) return;
      geworfen = jetzt;
      wartetSeit = 0;
      host.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 1200,
  dauer: 10000,
};
