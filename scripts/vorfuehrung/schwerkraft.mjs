// Schwerkraft-Läufer: Der Roboter rennt immer schneller durch den
// Neon-Korridor und kehrt die Schwerkraft genau im richtigen Augenblick um –
// über Lücken, an Blöcken vorbei, unter und auf die Stege.
export default {
  bereit: () => Boolean(window.LernappSchwerkraft?.state?.bahnen),
  spiele: () => {
    const S = window.LernappSchwerkraft;
    const st = S.state;
    const DT = 1 / 240;
    const SICHT = 1.5;           // so viele Sekunden plant er voraus
    const kopie = (l) => ({ ...l });
    // Der Planer aus check-spiele (4g8): Gibt es von l aus einen Weg bis
    // bisX? Ohne Tipp vorausrechnen; wo er scheitert, die Augenblicke davor
    // durchprobieren, in denen ein Tipp ginge – von hinten.
    const weg = (start, bisX) => {
      const besucht = new Set();
      const suche = (l) => {
        const c = kopie(l);
        const kandidaten = [];
        for (;;) {
          if (c.x >= bisX) return true;
          if (S.kannKehren(c)) kandidaten.push(kopie(c));
          if (S.bewege(c, DT)) break;
        }
        for (let i = kandidaten.length - 1; i >= 0; i -= 1) {
          const k = kandidaten[i];
          const key = `${k.richtung}|${k.auf ? k.auf.x0 : k.steht ? "s" : "k"}|${Math.round(k.x / 3)}`;
          if (besucht.has(key)) continue;
          besucht.add(key);
          const d = kopie(k);
          S.kehre(d);
          if (suche(d)) return true;
        }
        return false;
      };
      return suche(start);
    };
    // Wo der nächste Tipp hingehört: Von den Stellen, an denen er umkehren
    // kann und danach durchkommt, die Mitte – nicht ihr Rand. Null, wenn er
    // vorerst keinen braucht.
    const zielX = () => {
      const l = st.l;
      const bisX = l.x + S.tempoBei(l.x) * SICHT;
      const c = kopie(l);
      const stellen = [];
      let stirbt = false;
      for (let n = 0; ; n += 1) {
        if (c.x >= bisX) break;
        if (n % 3 === 0 && S.kannKehren(c)) stellen.push(kopie(c));
        if (S.bewege(c, DT)) { stirbt = true; break; }
      }
      if (!stirbt) return null;
      // Von hinten: die letzte Stelle, die geht, und so weit davor, wie es
      // ohne Unterbruch weiter geht.
      const reihe = [];
      for (let i = stellen.length - 1; i >= 0 && reihe.length < 40; i -= 1) {
        const d = kopie(stellen[i]);
        S.kehre(d);
        if (weg(d, bisX + S.tempoBei(bisX) * 0.3)) reihe.push(stellen[i].x);
        else if (reihe.length) break;
      }
      if (!reihe.length) return stellen.length ? stellen[stellen.length - 1].x : null;
      return reihe[Math.floor(reihe.length / 2)];
    };
    let dt = 1 / 60;
    let vorher = 0;
    let ziel = null;
    const tick = (jetzt) => {
      if (st.phase === "ende" || st.schritt === "aus") return;
      requestAnimationFrame(tick);
      if (vorher) dt = Math.min(1 / 30, Math.max(1 / 144, dt * 0.9 + ((jetzt - vorher) / 1000) * 0.1));
      vorher = jetzt;
      if (st.phase === "bereit") { S.tippen(); return; }
      if (st.phase !== "spiel" || st.schritt !== "lauf") return;
      const l = st.l;
      if (!S.kannKehren(l)) { ziel = null; return; }
      if (ziel === null) ziel = zielX();
      if (ziel === null) return;
      // Im Bild, das der Stelle am nächsten liegt.
      if (l.x + (S.tempoBei(l.x) * dt) / 2 >= ziel) {
        S.tippen();
        ziel = null;
      }
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 8000,
  dauer: 9500,
};
