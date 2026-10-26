// Fallschirm: Sprung 6 am späten Nachmittag, über dem See mit der Insel als
// Ziel. Der Springer fällt, ein Heissluftballon steigt aus der Tiefe auf ihn
// zu, und er gleitet daran vorbei. Die Welt ist fest (eine feste Saat), der
// Autopilot plant wie im Prüfskript voraus: Für die nächsten Hindernisse
// wählt er je eine Seite und rechnet den Weg mit den Schritten des Spiels
// durch.
export default {
  bereit: () => Boolean(window.LernappFallschirm?.state && window.LernappFallschirm.view.cssW > 0),
  spiele: () => {
    const F = window.LernappFallschirm;
    const st = F.state;
    const H = 1 / 240;
    const zielX = (sp, ts) => sp.x0 + sp.beweg * ts;
    const vorausFall = (soll, bisZ) => {
      const sp = st.sp;
      let { x, z, vx, vz } = st.j;
      let ts = st.ts;
      for (let n = 0; n < 240 * 8 && z > bisZ; n += 1) {
        const d = soll(ts, z) - x - vx * 0.22;
        const lenk = Math.abs(d) < 0.25 ? 0 : Math.sign(d);
        vz += 100 * (1 - (vz / sp.v) ** 2) * H;
        z -= vz * H;
        vx += (lenk * F.V_QUER_FREI + F.windHoehe(sp.wind, z) * 0.25 - vx) * (1 - Math.exp(-H / 0.28));
        x += vx * H;
        ts += H;
        for (const h of sp.hindernisse) {
          const lage = F.hindernisLage(h, ts);
          if (z >= lage.z - h.dz && z <= lage.z + h.dz && Math.abs(x - lage.x) < h.r + F.R_FREI + 0.35) return { treffer: true, x, ts };
        }
      }
      return { treffer: false, x, ts };
    };
    let plan = null;
    let planZeit = -1;
    let planSprung = 0;
    const planeFall = () => {
      const sp = st.sp;
      const bisZ = sp.hMin + 10;
      const tSchirm = 0.8 + Math.max(10, bisZ - 45) / F.V_SINK;
      const zielEnde = (ts) => zielX(sp, ts + tSchirm) - sp.wind * 1.5;
      const kommende = sp.hindernisse.filter((h) => !h.getroffen && st.j.z > F.hindernisLage(h, st.ts).z - h.dz)
        .sort((a, b) => a.tK - b.tK).slice(0, 3);
      let seiten = [[]];
      for (let m = 0; m < kommende.length; m += 1) seiten = seiten.flatMap((w) => [[...w, -1], [...w, 1]]);
      let bester = null;
      for (const wahl of seiten) {
        const soll = (ts, z) => {
          for (let m = 0; m < kommende.length; m += 1) {
            const h = kommende[m];
            const lage = F.hindernisLage(h, ts);
            if (z > lage.z - h.dz) {
              const tK = Math.max(ts, F.tFall(st.sprung, Math.min(z, lage.z + h.dz)));
              // Knapp am Ballon vorbei – so steht er schön im Bild.
              return F.hindernisLage(h, tK).x + wahl[m] * (h.r + F.R_FREI + (h.art === "ballon" ? 1.2 : 1.8));
            }
          }
          return zielEnde(ts);
        };
        const r = vorausFall(soll, bisZ);
        const fehl = r.treffer ? 1e6 : Math.abs(r.x - zielEnde(r.ts));
        if (!bester || fehl < bester.fehl) bester = { soll, fehl };
      }
      return bester;
    };
    const schritt = (dt) => {
      const j = st.j;
      const sp = st.sp;
      let lenk = 0;
      if (st.schritt === "frei") {
        if (!plan || st.ts - planZeit > 0.05 || planSprung !== st.sprung) {
          plan = planeFall();
          planZeit = st.ts;
          planSprung = st.sprung;
        }
        const d = plan.soll(st.ts, j.z) - j.x - j.vx * 0.22;
        lenk = Math.abs(d) < 0.25 ? 0 : Math.sign(d);
      } else if (st.schritt === "schirm" || st.schritt === "auf") {
        const tRest = Math.max(0.3, j.z / Math.max(1, j.vz));
        const r = ((zielX(sp, st.ts + tRest) - j.x) / Math.max(0.5, tRest * 0.6) - st.wind.x) / F.V_QUER;
        lenk = r > 0.15 ? 1 : r < -0.15 ? -1 : 0;
      }
      F.lenke(lenk);
      const mitte = (F.FLARE_BAND.butter[0] + F.FLARE_BAND.butter[1]) / 2;
      if ((st.schritt === "frei" && st.ts > 0.7 && j.z <= sp.hMin + 10) || (st.schritt === "schirm" && !st.flare && j.z <= mitte)) F.wisch();
      if (dt) F.takt(dt);
    };
    // Eine feste Welt: die Saat aus einem festen «Zufall».
    const zufall = Math.random;
    Math.random = () => 6 / 400;
    document.querySelector(".cm-bar-left .cm-icon-again").click();
    Math.random = zufall;
    F.losGehts();
    // Vorspulen bis zum sechsten Sprung, dann im Bildtakt weiter.
    for (let n = 0; st.sprung < 6 && st.phase === "spiel" && n < 120 * 300; n += 1) schritt(1 / 120);
    const tick = () => {
      if (st.phase !== "spiel") return;
      requestAnimationFrame(tick);
      schritt(0);
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 1500,
  dauer: 9000,
  // Das Standbild: im freien Fall, wenn der Ballon 30 bis 45 m unter ihm
  // ist – dort bleibt die Welt stehen, bis das Bild gemacht ist.
  bild: 1500,
  bildWenn: () => {
    const F = window.LernappFallschirm;
    const st = F.state;
    const b = st.sp?.hindernisse.find((h) => h.art === "ballon");
    const jetzt = st.schritt === "frei" && b && st.j.z - b.z > 30 && st.j.z - b.z < 45;
    if (jetzt) F.anhalten(true);
    return jetzt;
  },
};
