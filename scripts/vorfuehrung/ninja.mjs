// Zeitlupen-Ninja: Raum 7 eines nächtlichen Dojo-Hofs. Der Ninja schleicht
// in Zeitlupe zwischen Pfeilen hindurch – die Welt ist kühl und steht fast,
// die Pfeile hängen mit ihrer Flugbahn in der Luft, Kirschblüten schweben.
// Ein Autopilot, der die Zukunft kennt (wie in check-spiele.mjs, 4g23),
// plant drei Räume voraus; gespielt wird mit einem Drittel des Tempos, so
// läuft auch die Welt nur mit einem Drittel.
export default {
  bereit: () => Boolean(window.LernappNinja?.state && window.LernappNinja.view.cssW > 0),
  spiele: () => {
    const N = window.LernappNinja;
    const st = N.state;
    const R = Math.SQRT1_2;
    const AKTIONEN = [[0, 1], [R, R], [1, 0], [R, -R], [0, -1], [-R, -R], [-1, 0], [-R, R], null];
    // tempo: so stark ist jede Eingabe (1 = volles Tempo); ein Entscheid
    // dauert dafür entsprechend mehr Schritte.
    const pilot = ({ raeume, tempo = 1, aufzeichnen = false }) => {
      const entscheid = Math.round(24 / tempo);
      const eingaben = [];
      const fuehre = (a, n, merken) => {
        for (let i = 0; i < n; i += 1) {
          const e = a ? { x: a[0] * tempo, y: a[1] * tempo } : { x: (i % 2 ? -1 : 1) * tempo, y: 0 };
          N.steuere(e.x, e.y);
          if (merken) eingaben.push(e);
          N.schritt();
          if (st.schritt !== "lauf") return;
        }
      };
      const wert = () => {
        if (st.schritt === "wechsel") return -1000;
        const rand = N.HALB - Math.abs(st.ninja.x);
        return Math.min(5000, N.wegZumTor(st.ninja.x, st.ninja.y)) + Math.max(0, 18 - rand) * 1.5;
      };
      N.sim(true);
      while (st.phase === "spiel" && st.geschafft < raeume) {
        if (st.schritt === "wechsel") { N.steuere(0, 0); N.schritt(); continue; }
        if (st.schritt !== "lauf") break;
        const wurzel = N.sichern();
        let strahl = [{ k: wurzel, erste: -1, wert: wert() }];
        let bester = null;
        for (let d = 0; d < 5 && !(bester && bester.wert < -500); d += 1) {
          const zellen = new Map();
          for (const knoten of strahl) {
            for (let ai = 0; ai < AKTIONEN.length; ai += 1) {
              N.zurueck(knoten.k);
              fuehre(AKTIONEN[ai], entscheid, false);
              if (st.schritt === "aus") continue;
              const kind = { k: N.sichern(), erste: d === 0 ? ai : knoten.erste, wert: wert() };
              if (kind.wert < -500) { bester = kind; break; }
              const zelle = `${Math.round(st.ninja.x / 3)},${Math.round(st.ninja.y / 3)}`;
              if (!zellen.has(zelle) || zellen.get(zelle).wert > kind.wert) zellen.set(zelle, kind);
            }
            if (bester && bester.wert < -500) break;
          }
          if (bester && bester.wert < -500) break;
          const neu = [...zellen.values()].sort((a, b) => a.wert - b.wert);
          if (!neu.length) break;
          strahl = neu.slice(0, 24);
          bester = strahl[0];
        }
        N.zurueck(wurzel);
        fuehre(bester ? AKTIONEN[bester.erste] : null, entscheid, aufzeichnen);
      }
      N.steuere(null);
      N.sim(false);
      return eingaben;
    };
    // Im Zeitraffer bis in Raum 7, dann drei Räume in Zeitlupe vorausplanen
    // und von dort aus im Bildtakt spielen.
    N.losGehts();
    pilot({ raeume: 6 });
    while (st.schritt === "wechsel") N.schritt();
    N.kam.y = st.raum * N.SCHRITT + N.RAUM_H / 2 + N.view.versatz;
    N.kam.nach = N.kam.y;
    N.kam.t = 1;
    const k = N.sichern();
    const plan = pilot({ raeume: 9, tempo: 1 / 3, aufzeichnen: true });
    N.zurueck(k);
    N.plane(plan);
  },
  vorlauf: 1500,
  dauer: 9000,
  // Das Standbild: sobald Pfeile oder Sterne nah beim Ninja in der Luft hängen.
  bild: 2600,
  bildWenn: () => {
    const N = window.LernappNinja;
    const st = N?.state;
    if (!st || st.schritt !== "lauf") return false;
    const y0 = st.raum * N.SCHRITT;
    const nx = st.ninja.x;
    const ny = st.ninja.y - y0;
    const nah = st.pfeile.filter((p) => p.weg > 0 && Math.hypot(p.ox + p.dx * p.weg - nx, p.oy + p.dy * p.weg - ny) < 75).length
      + st.sterne.filter((s) => Math.hypot(s.x - nx, s.y - ny) < 75).length;
    return nah >= 2;
  },
  standbild: 3,
};
