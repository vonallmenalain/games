// Holzfäller: Goldene Stunde auf der Lichtung, die Stämme fliegen zu zweit
// und zu dritt. Der Autopilot schneidet einen nach dem anderen, wie eine
// ruhige, schnelle Hand: gut eine Drittelsekunde je Wisch, meist mitten
// durch den roten Strich, ab und zu knapp daneben. Äste und Nagelstämme
// lässt er aus. Das Bild entsteht gleich nach einem perfekten Schnitt, wenn
// die Hälften auseinanderfliegen.
export default {
  bereit: () => Boolean(window.LernappHolzfaeller?.state && window.LernappHolzfaeller.view.cssW > 0),
  spiele: () => {
    const H = window.LernappHolzfaeller;
    const st = H.state;
    const gesehen = new Map();
    let letzter = -9;
    const tick = () => {
      if (st.phase === "ende") return;
      requestAnimationFrame(tick);
      if (st.phase === "bereit") {
        const z = H.ziele()[0];
        if (z) H.wischen([[z.ax, z.ay], [z.bx, z.by]]);
        letzter = 0;
        return;
      }
      if (st.phase !== "spiel" || st.aus) return;
      const zeit = st.tick / 240;
      const ziele = H.ziele();
      for (const z of ziele) if (z.sichtbar && !gesehen.has(`${z.id}|${z.u}`)) gesehen.set(`${z.id}|${z.u}`, zeit);
      if (zeit - letzter < 0.34) return;
      // Zuerst, was am ehesten hinunterfällt – sobald es eine Weile im Bild ist.
      const kandidaten = ziele.filter((z) => z.sichtbar && zeit - gesehen.get(`${z.id}|${z.u}`) > 0.22).sort((a, b) => a.rest - b.rest);
      for (const z of kandidaten) {
        const d = Math.random() < 0.75 ? 0 : (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 3);
        const lx = z.bx - z.ax;
        const ly = z.by - z.ay;
        const l = Math.hypot(lx, ly);
        const ox = (-ly / l) * d;
        const oy = (lx / l) * d;
        const p = H.probe(z.ax + ox, z.ay + oy, z.bx + ox, z.by + oy);
        if (p.length !== 1 || p[0].id !== z.id || p[0].art === "ast" || p[0].art === "daneben") continue;
        H.wischen([[z.ax + ox, z.ay + oy], [z.bx + ox, z.by + oy]]);
        letzter = zeit;
        break;
      }
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 9000,
  dauer: 10000,
  // Ms nach dem Start: gegen Welle fünfzehn – zwei, drei Stämme in der Luft,
  // Äste und Nagelstämme dabei.
  bild: 14000,
  // Dann der Augenblick gleich nach einem perfekten Schnitt, mit Stücken in
  // der Luft – ohne Ansage oben und ohne Schriften übereinander.
  bildWenn: () => {
    const st = window.LernappHolzfaeller.state;
    return st.echt - st.letztePerfekt < 0.09 && st.stuecke.length >= 5 && !st.banner && st.schriften.length <= 2;
  },
};
