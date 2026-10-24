// Hügelflieger: Der Vogel saust schwer die Hänge hinab, hebt leicht an der
// Kuppe ab, gleitet und setzt genau im Winkel des nächsten Abhangs auf –
// Perfekt um Perfekt, bis er On Fire ist und mit Feuerspur fliegt.
export default {
  bereit: () => Boolean(window.LernappHuegel?.state?.huegel?.length),
  spiele: () => {
    const H = window.LernappHuegel;
    const st = H.state;
    // Dieselbe Physik wie im Spiel (huegel.js, physik), in der Luft.
    const G_LEICHT = 520;
    const G_SCHWER = 3600;
    const SCHRITT = 1 / 120;
    const ZU_HOCH = 5;              // so viel kostet jede Einheit zu hoch
    const luft = (v, schwer, feuer, h) => {
      v.vy -= (schwer ? G_SCHWER : G_LEICHT) * h;
      if (!schwer && v.vy < 0) {
        const ab = -v.vy * (1 - Math.exp(-1.5 * h));
        v.vy += ab;
        v.vx += ab * 0.35;
      }
      if (feuer) {
        const t = Math.max(1, Math.hypot(v.vx, v.vy));
        v.vx += (v.vx / t) * 140 * h;
        v.vy += (v.vy / t) * 140 * h;
      }
      v.x += v.vx * h;
      v.y += v.vy * h;
      const schnell = Math.hypot(v.vx, v.vy);
      const bremse = 1 - (0.012 + Math.max(0, schnell - (feuer ? 850 : 650)) * 0.0012) * h;
      v.vx *= bremse;
      v.vy *= bremse;
      const hoechstens = feuer ? 1150 * 1.3 : 1150;
      if (schnell > hoechstens) { v.vx *= hoechstens / schnell; v.vy *= hoechstens / schnell; }
    };
    // Ein Flug: zuerst bis Sekunde vor schwer (das drückt ihn hinunter),
    // dann leicht gleiten, ab Sekunde ab wieder schwer. Wie landet er?
    // Perfekt auf einem Abhang ist das Ziel, danach zählt das Tempo. Und er
    // soll im Bild bleiben: So hoch zoomt die Kamera höchstens heraus
    // (huegel.js, takt – 2.6-fach, mit Rand).
    const flug = (vor, ab) => {
      const v = { ...st.v };
      let zeit = st.flugZeit;
      let oben = v.y;
      let tief = H.bodenBei(v.x);
      const sicht = H.view.h0 * 2.6 * 0.85 - 90 - 40;
      for (let t = 0; t < 4; t += SCHRITT) {
        luft(v, t < vor || t >= ab, st.feuer, SCHRITT);
        zeit += SCHRITT;
        oben = Math.max(oben, v.y);
        const boden = H.bodenBei(v.x);
        tief = Math.min(tief, boden);
        if (v.y > boden) continue;
        const zuHoch = Math.max(0, oben - tief - sicht) * ZU_HOCH;
        const s = H.steigungBei(v.x);
        const len = Math.hypot(1, s);
        const vn = (v.vx * -s + v.vy) / len;
        const vt = (v.vx + v.vy * s) / len;
        if (zeit <= 0.22) return vt - zuHoch;
        const winkel = Math.atan2(Math.abs(vn), Math.max(1, Math.abs(vt)));
        if (s < -0.05 && winkel < 0.48 && vt > 0) return 2000 + vt - winkel * 300 - zuHoch;
        if (winkel > 0.66) return vt * 0.82 - 2000 - zuHoch;
        return vt - zuHoch;
      }
      return -Math.max(0, oben - tief - sicht) * ZU_HOCH;
    };
    let dt = 1 / 60;
    let vorher = 0;
    const tick = (jetzt) => {
      if (st.phase !== "spiel" && st.phase !== "bereit") { H.loslassen(); return; }
      requestAnimationFrame(tick);
      if (vorher) dt = Math.min(1 / 30, Math.max(1 / 144, dt * 0.9 + ((jetzt - vorher) / 1000) * 0.1));
      vorher = jetzt;
      if (st.phase === "bereit") { H.druecken(); return; }
      let schwer;
      if (st.amBoden) {
        // Am Boden: bergab schwer, bergauf leicht (wie in check-spiele).
        schwer = H.steigungBei(st.v.x) < -0.02;
      } else {
        // In der Luft: Wann schwer werden, damit die Landung passt? Jetzt,
        // oder erst nach ein paar Bildern Gleiten?
        let best = { wert: -Infinity, vor: 0, ab: 0 };
        for (const vor of [0, 3, 8, 15]) {
          for (let k = vor; k <= 180; k += 3) {
            const wert = flug(vor * dt, k * dt);
            if (wert > best.wert + 1) best = { wert, vor, ab: k };
          }
        }
        schwer = best.vor > 0 || best.ab === 0;
      }
      if (schwer && !H.gedrueckt) H.druecken();
      if (!schwer && H.gedrueckt) H.loslassen();
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 5000,
  dauer: 8000,
};
