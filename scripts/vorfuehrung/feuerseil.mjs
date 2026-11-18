// Feuerseil: der Dorfplatz bei Nacht, mitten in einer Strophe mit zwei
// Seilen. Das orange Seil kommt vorn herunter, das blaue steht hinten oben –
// und sie ist gerade im höchsten Punkt des Sprungs.
export default {
  bereit: () => Boolean(window.LernappFeuerseil?.state?.seil && window.LernappFeuerseil.view.cssW > 0),
  spiele: () => {
    const F = window.LernappFeuerseil;
    const st = F.state;
    // Der Pilot: springt so ab, dass das nächste Seil im Scheitel durchgeht –
    // mit so viel Halten, wie die Flammen verlangen.
    let plan = null;
    const pilot = () => {
      if (st.phase === "bereit") { F.druecke(); F.loslassen(); return; }
      if (st.phase !== "spiel" || st.fehler) return;
      if (plan && st.tick >= plan.los && st.gedrueckt) { F.loslassen(); plan = null; }
      if (!st.amBoden || st.gedrueckt) return;
      const [naechstes] = F.vorschau(1);
      if (!naechstes) return;
      let halt = F.HALT_MIN;
      while (halt < 60 && F.sprungProfil(halt).gipfel < naechstes.flamme + 0.12) halt += 4;
      const profil = F.sprungProfil(halt, naechstes.flamme);
      if (st.tick >= naechstes.tick - profil.scheitel) {
        F.druecke();
        plan = { los: st.tick + halt };
      }
    };
    // Bis in die erste Strophe mit zwei Seilen im Zeitraffer. Erwischt es
    // sie vorher (der Pilot kennt nur das nächste Seil), noch einmal von vorn:
    // Jede Runde würfelt ihre Figuren neu.
    const amZiel = () => st.seil.zweit && F.rundeBei(st.seil.n).j >= 1;
    for (let versuch = 0; versuch < 30 && !amZiel(); versuch += 1) {
      if (versuch) document.querySelector(".cm-bar-left .cm-icon-again")?.click();
      plan = null;
      for (let n = 0; n < 240 * 120 && !st.fehler && !amZiel(); n += 1) {
        pilot();
        F.takt(1 / 240);
      }
    }
    const tick = () => {
      if (st.phase === "ende") return;
      requestAnimationFrame(tick);
      pilot();
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 300,
  dauer: 8000,
  // Das Standbild: sie ist oben, das orange Seil geht eben unter ihr durch.
  bild: 600,
  bildWenn: () => {
    const st = window.LernappFeuerseil.state;
    const u = st.seil.u - Math.floor(st.seil.u);
    return !st.amBoden && st.y > 0.28 && (u > 0.9 || u < 0.03);
  },
};
