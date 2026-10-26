// Fledermaus: tief in der dunklen Höhle, ein paar hundert Meter weit. Hinter
// der Fledermaus glühen die Kanten des letzten Rufs violett nach, eben ist
// ein neuer hinausgegangen: Der Ring läuft durch die Höhle, die Kanten vor
// ihr leuchten weiss und cyan auf – und erreicht gerade eine Spinne am
// Faden, deren rote Augen man schon vorher gesehen hat. In diesem Moment
// steht das Bild kurz still, damit das Standbild den Ring noch zeigt.
export default {
  bereit: () => Boolean(window.LernappFledermaus?.state?.hoehle && window.LernappFledermaus.view.cssW > 0),
  spiele: () => {
    const F = window.LernappFledermaus;
    const st = F.state;
    F.hoehleBis(12000);
    const spinne = st.hoehle.dinge.find((d) => d.art === "spinne" && d.x > 3200);
    const ziel = spinne ? spinne.x : 4000;
    // Derselbe Autopilot wie in check-spiele (4g22): Er rechnet mit der
    // Physik des Spiels voraus, wann der nächste Flügelschlag kommt, und
    // nimmt den Plan, der am weitesten vom Fels bleibt.
    const H = 1 / 120;
    const WARTE = [0, 1, 2, 3, 4, 5, 6, 8, 10, 13, 16, 20, 25, 30, 40, 60, 200];
    const plane = () => {
      const f = st.fm;
      let best = null;
      for (const w of WARTE) {
        const p = { x: f.x, y: f.y, vy: f.vy, schub: f.schub, schubA: f.schubA };
        let frei = Infinity;
        let abw = 0;
        let stoss = -1;
        let seit = 99;
        for (let j = 0; j < 108; j += 1) {
          if (j === w) { F.schlagAuf(p); seit = 0; } else if (j > w && seit > 8 && p.vy < 50 && p.y + p.vy * 0.2 < F.pfadBei(p.x + F.tempoBei(p.x) * 0.22) - 3) { F.schlagAuf(p); seit = 0; }
          seit += 1;
          F.fliegeSchritt(p, H);
          if (j % 2 === 0 || j < 30) {
            const a = F.abstand(p.x, p.y) - F.R_FM;
            if (a < frei) frei = a;
            if (a < 0.6) { stoss = j; break; }
          }
          abw += Math.abs(p.y - F.pfadBei(p.x)) / F.halbBei(p.x);
        }
        const wert = stoss >= 0 ? -1e7 + stoss * 1e3 : Math.min(frei, 10) * 1000 - abw * 4;
        if (!best || wert > best.wert) best = { wert, w };
      }
      return best.w;
    };
    let zuletzt = -9;
    let letzterRuf = -9;
    let grosserRuf = -1;
    const steuern = () => {
      if (plane() === 0 && st.zeit - zuletzt > 0.02) { zuletzt = st.zeit; F.schlag(); }
      const vor = ziel - st.fm.x;
      // Unterwegs ruft sie regelmässig; der letzte Ruf vor dem grossen liegt
      // gut eine halbe Sekunde zurück – er glüht hinter ihr violett nach.
      if (vor > 330 && st.zeit - letzterRuf > 1.1) { letzterRuf = st.zeit; st.ladung = Math.max(st.ladung, 2); F.ruf(); }
      if (grosserRuf < 0 && vor < 125) { grosserRuf = st.zeit; st.ladung = Math.max(st.ladung, 2); F.ruf(); }
      // Der Moment: Der Ring hat die Spinne eben erreicht. Dann steht das
      // Bild eine Sekunde still – so lange, wie das Standbild braucht.
      if (grosserRuf >= 0 && !window.__fmBild && st.zeit - grosserRuf > 0.23) {
        window.__fmBild = true;
        const weiter = window.requestAnimationFrame;
        const wartend = [];
        window.requestAnimationFrame = (bild) => { wartend.push(bild); return 0; };
        setTimeout(() => { window.requestAnimationFrame = weiter; wartend.forEach((bild) => weiter(bild)); }, 1500);
      }
    };
    F.schlag();
    // Vorspulen bis vor die Spinne – im Takt des Spiels, in Häppchen, damit
    // der Browser dazwischen Bilder zeigen kann.
    const haeppchen = () => {
      for (let n = 0; st.schritt === "flug" && st.fm.x < ziel - 420 && n < 240; n += 1) {
        steuern();
        F.takt(H);
      }
      if (st.schritt === "flug" && st.fm.x < ziel - 420) { setTimeout(haeppchen, 0); return; }
      const tick = () => {
        if (st.phase !== "spiel" || st.schritt !== "flug") return;
        requestAnimationFrame(tick);
        steuern();
      };
      requestAnimationFrame(tick);
    };
    haeppchen();
  },
  vorlauf: 6000,
  dauer: 9000,
  bild: 1200,
  bildWenn: () => window.__fmBild === true,
};
