// Freihand: Ein Blatt nach dem anderen – die Pilotin zieht jede Form in einem
// Zug, fast richtig: ein wenig verschoben, ein wenig zittrig, wie eine Hand.
// Danach legt der Rotstift die ideale Form darüber, und der Stempel fällt.
export default {
  bereit: () => Boolean(window.LernappFreihand?.state?.blaetter && window.LernappFreihand.view.cssW > 0),
  spiele: () => {
    const F = window.LernappFreihand;
    const st = F.state;
    // Die Form, ein wenig daneben: verschoben, und mit einem Zittern.
    const strichFuer = (a, n) => {
      const weg = a.ziele[0] || F.kreisWeg({ x: 52, y: 54 }, 25, 0.4);
      const dx = Math.sin(n * 2.1) * 0.7;
      const dy = Math.cos(n * 1.3) * 0.7;
      return {
        lang: F.wegLaenge(weg),
        pkte: F.abtasten(weg, 0.6).map((p, i) => ({ x: p.x + dx + Math.sin(i * 0.11 + n) * 0.45, y: p.y + dy + Math.cos(i * 0.09 + n * 2) * 0.45 })),
      };
    };
    // Die ersten Blätter im Zeitraffer, damit die Mappe schon etwas zeigt –
    // bis eines kommt, das sich gut ansieht.
    const schoen = ["kreis", "umkreis", "fuenfeck", "quadrat", "dreieck", "spiegel", "bogen", "welle", "kreisfrei", "doppelt"];
    F.losGehts();
    while (st.index < 6 && !(st.index >= 3 && schoen.includes(st.blaetter[st.index].art))) {
      F.blattLos();
      st.t0 -= 700;
      const { pkte } = strichFuer(st.blaetter[st.index], st.index);
      F.stiftAb(pkte[0], 1, "pen");
      for (let i = 1; i < pkte.length; i += 1) F.stiftZu(pkte[i]);
      F.stiftAuf();
      F.weiter();
    }
    let plan = null;
    const tick = (jetzt) => {
      if (st.phase === "ende") return;
      requestAnimationFrame(tick);
      if (st.phase === "vorschau") {
        // Die Vorschau kurz stehen lassen, dann das Blatt hinlegen.
        if (jetzt - st.vorSeit > 1300) { F.blattLos(); plan = null; }
        return;
      }
      if (st.phase !== "aufgabe") { plan = null; return; }
      if (!plan) {
        const { pkte, lang } = strichFuer(st.blaetter[st.index], st.index);
        plan = { pkte, ab: jetzt + 1000, i: 0, dauer: Math.min(2600, 700 + lang * 11) };
        return;
      }
      if (jetzt < plan.ab) return;
      const soll = Math.min(plan.pkte.length, Math.ceil(((jetzt - plan.ab) / plan.dauer) * plan.pkte.length));
      if (plan.i === 0 && soll > 0) { if (!F.stiftAb(plan.pkte[0], 1, "pen")) return; plan.i = 1; }
      while (plan.i < soll) { F.stiftZu(plan.pkte[plan.i]); plan.i += 1; }
      if (plan.i >= plan.pkte.length) { F.stiftAuf(); plan = null; }
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 900,
  dauer: 10000,
  // Das Standbild: Die Form steht da, der Rotstift hat sie nachgezogen, der
  // Stempel sitzt.
  bild: 1500,
  bildWenn: () => {
    const st = window.LernappFreihand.state;
    return st.phase === "zeigen" && st.index >= 3 && performance.now() - st.tZeig > 1250;
  },
};
