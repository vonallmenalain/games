// Flaggenkommando: die Brücke des Schiffs in der dritten Welle. Der Kapitän
// hat eben beide Flaggen gehoben, der Matrose unten zieht nach – die Frist
// läuft noch im goldenen Teil.
export default {
  bereit: () => Boolean(window.LernappFlaggen?.state?.bild && window.LernappFlaggen.view.cssW > 0),
  spiele: () => {
    const F = window.LernappFlaggen;
    const st = F.state;
    // Der Pilot: stellt nach einer Fünftelsekunde ein, was der Kapitän zeigt –
    // erst senken, was zu viel ist, dann heben, was fehlt.
    const pilot = (reaktion) => {
      if (st.phase === "bereit") { F.druecke(0); F.loslassen(0); return; }
      if (st.phase !== "spiel" || st.fehler || !st.offen || st.tick - st.kommandoTick < reaktion) return;
      for (const h of [0, 1]) { const f = h ? F.GELB : F.ROT; if ((st.pose & f) && !(st.ziel & f)) F.loslassen(h); }
      for (const h of [0, 1]) { const f = h ? F.GELB : F.ROT; if (!(st.pose & f) && (st.ziel & f)) F.druecke(h); }
    };
    // Bis vor das erste Kommando mit beiden Flaggen im Zeitraffer.
    const amZiel = () => F.kommandoBei(st.nr).pose === 3 && !st.offen;
    for (let n = 0; n < 240 * 200 && !st.fehler && !amZiel(); n += 1) {
      pilot(40);
      F.takt(1 / 240);
    }
    // Ab da gemächlich: Im Bild soll die Frist noch laufen.
    const tick = () => {
      if (st.phase === "ende") return;
      requestAnimationFrame(tick);
      pilot(st.ziel === 3 ? 110 : 48);
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 300,
  dauer: 8000,
  // Das Standbild: Er zeigt beide, unten ist erst eine oben.
  bild: 300,
  bildWenn: () => {
    const st = window.LernappFlaggen.state;
    return st.ziel === 3 && st.offen && !st.ansage && st.tick - st.kommandoTick > 60 && window.LernappFlaggen.armKapitaen(0) > 0.98 && window.LernappFlaggen.armKapitaen(1) > 0.98;
  },
};
