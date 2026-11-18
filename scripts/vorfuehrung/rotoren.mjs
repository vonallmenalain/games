// Zwei Rotoren: Der Pilot fliegt mitten durch die Lichttore – links rot,
// rechts grün, dahinter die Stadt bei Nacht.
export default {
  bereit: () => Boolean(window.LernappRotoren?.state?.welt && window.LernappRotoren.view.cssW > 0),
  spiele: () => {
    const R = window.LernappRotoren;
    const st = R.state;
    R.druecken("links");
    R.druecken("rechts");
    let n = 0;
    const tick = () => {
      if (st.phase !== "spiel" || st.endet) { R.allesLos(); return; }
      requestAnimationFrame(tick);
      n += 1;
      if (n % 2) return;
      const [links, rechts] = R.pilot(st.welt, st.d);
      if (links) R.druecken("links"); else R.loslassen("links");
      if (rechts) R.druecken("rechts"); else R.loslassen("rechts");
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 9000,
  dauer: 10000,
  // Das Standbild: kurz vor einem Tor, schräg im Flug.
  bild: 9000,
  bildWenn: () => {
    const R = window.LernappRotoren;
    const d = R.state.d;
    const tor = R.state.welt.tore[d.tor];
    return Math.hypot(tor.x - d.x, tor.y - d.y) < 4.5 && Math.abs(d.w) > 0.2 && d.tor >= 3;
  },
};
