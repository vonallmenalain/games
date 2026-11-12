// Seiltänzer: Hoch über der Schlucht im Abendrot, eine Dohle sitzt auf dem
// Ende seiner Stange, und er hält mit der Stange dagegen – Schritt für
// Schritt.
export default {
  bereit: () => Boolean(window.LernappSeiltaenzer?.state?.l),
  spiele: () => {
    const T = window.LernappSeiltaenzer;
    const st = T.state;
    // Er hält erst dagegen, wenn er ein wenig schief steht – so wiegt er
    // sich sichtbar auf dem Seil. Einen Vogel, der ihn gleich rammt, sieht er
    // kommen und lehnt sich kurz vorher hinein.
    const tick = () => {
      requestAnimationFrame(tick);
      if (st.schritt !== "lauf") return;
      const kippt = st.l.th + 0.35 * st.l.w;
      let r = kippt > 0.05 ? -1 : kippt < -0.05 ? 1 : 0;
      const kommt = st.welt.ereignisse.find((e) => e.art === "ramme" && e.x0 > st.l.x && (e.x0 - st.l.x) / st.l.v < 0.2);
      if (kommt) r = -kommt.dir;
      T.lehnen(r);
    };
    T.lehnen(1);
    T.lehnen(0);
    requestAnimationFrame(tick);
  },
  vorlauf: 4000,
  dauer: 8500,
  // Das Standbild: Ein Vogel sitzt auf der Stange, und er steht fast gerade.
  bild: 4500,
  bildWenn: () => {
    const st = window.LernappSeiltaenzer.state;
    if (st.schritt !== "lauf") return true;
    const e = st.welt.ereignisse[st.ereignis];
    if (e?.art !== "vogel") return false;
    const sitzt = e.voegel.filter((v) => st.l.x > v.an + st.l.v * 0.3 && st.l.x < v.ab - st.l.v * 0.6);
    return sitzt.length > 0 && Math.abs(st.l.th) < 0.12;
  },
};
