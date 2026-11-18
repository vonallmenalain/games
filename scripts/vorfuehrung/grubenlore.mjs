// Höhlenfahrt: Der Pilot bremst so spät wie möglich – Funken an den Rädern,
// vorn die nächste Stelle, hinten der Einsturz.
export default {
  bereit: () => Boolean(window.LernappGrubenlore?.state?.welt && window.LernappGrubenlore.view.cssW > 0),
  spiele: () => {
    const L = window.LernappGrubenlore;
    const st = L.state;
    L.druecken();
    L.loslassen();
    const tick = () => {
      if (st.phase !== "spiel" || st.endet) return;
      requestAnimationFrame(tick);
      if (L.pilot(st.welt, st.z)) L.druecken(); else L.loslassen();
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 9000,
  dauer: 10000,
  // Das Standbild: mitten im Bremsen vor einer Stelle.
  bild: 9000,
  bildWenn: () => {
    const L = window.LernappGrubenlore;
    return L.state.bremst && L.state.bremsZeit > 0.12 && L.state.z.v > 7;
  },
};
