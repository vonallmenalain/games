// Freitaucher: ab dem dritten Tauchgang, wo die Quallen schweben. Der
// Taucher gleitet mit langen Flossen in die Tiefe, um ihn der Luftring, vor
// ihm glänzt eine Perle auf dem Grund. Zwei Tauchgänge sind schon gezählt.
export default {
  bereit: () => Boolean(window.LernappFreitaucher?.state?.taucher && window.LernappFreitaucher.view.cssW > 0),
  spiele: () => {
    const F = window.LernappFreitaucher;
    const st = F.state;
    // Der Pilot: zur wertvollsten Muschel, die noch geht, und wieder hinauf,
    // sobald das Netz zwei trägt oder die Luft knapp wird.
    const pilot = () => {
      const t = st.taucher;
      const p = st.platz;
      if (st.phase === "bereit") { F.schwimme(0, -1); return; }
      if (st.schritt !== "oben" && st.schritt !== "tauchen") { F.lass(); return; }
      const d = -t.y;
      const offen = p.muscheln.filter((m) => !m.leer && m.tiefe <= 26 && Math.abs(m.x) < 30);
      offen.sort((a, b) => (b.wert - a.wert) || (Math.abs(a.x) - Math.abs(b.x)));
      const ziel = offen[0];
      if (!ziel || st.netz.length >= 2 || (st.schritt === "tauchen" && t.luft < st.bedarf + 0.14)) {
        if (d > 0.4) F.schwimme(0, 1); else F.lass();
        return;
      }
      const h = F.haende(t);
      const dx = ziel.x - h.x;
      const dy = ziel.y + 0.2 - h.y;
      if (d > F.NEUTRAL + 2 && dy < -3 && Math.abs(dx) < 3 && t.vy < -1.2) { F.lass(); return; }
      F.schwimme(dx, dy);
    };
    for (let n = 0; n < 200000 && !(st.nr === 2 && st.schritt === "oben" && st.phase === "spiel"); n += 1) {
      pilot();
      F.takt(1 / 120);
    }
    const tick = () => {
      if (st.phase === "ende") return;
      requestAnimationFrame(tick);
      pilot();
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 600,
  dauer: 9000,
  // Das Standbild: in der Tiefe, eine Perle nah vor den Händen.
  bild: 2500,
  bildWenn: () => {
    const F = window.LernappFreitaucher;
    const st = F.state;
    const t = st.taucher;
    if (st.schritt !== "tauchen" || -t.y < 8) return false;
    const h = F.haende(t);
    return st.platz.muscheln.some((m) => !m.leer && Math.hypot(m.x - h.x, m.y - h.y) < 4.5);
  },
};
