// Kopfkino: Aufgabe um Aufgabe – die Pilotin gibt die richtige Antwort ein,
// Schritt für Schritt, und danach läuft der Film: Das Netz faltet sich, der
// Würfel rollt, der Stapel zieht sich auseinander.
export default {
  bereit: () => Boolean(window.LernappKopfkino?.state?.aufgaben && window.LernappKopfkino.view.cssW > 0),
  spiele: () => {
    const K = window.LernappKopfkino;
    const st = K.state;
    // Die ersten Aufgaben im Zeitraffer, damit der Filmstreifen schon etwas
    // zeigt – bis eine kommt, deren Film sich gut ansieht.
    const schoen = ["netz", "rollen", "stapel", "drehen"];
    K.losGehts();
    while (st.index < 6 && !(st.index >= 2 && schoen.includes(st.aufgaben[st.index].art))) {
      K.aufgabeLos();
      st.t0 -= 2500;
      for (const [was, wert] of K.loesung(st.aufgaben[st.index])) K.eingabe(was, wert);
      K.weiter();
    }
    let plan = null;
    const tick = (jetzt) => {
      if (st.phase === "ende") return;
      requestAnimationFrame(tick);
      if (st.phase === "vorschau") {
        if (jetzt - st.vorSeit > 1300) { K.aufgabeLos(); plan = null; }
        return;
      }
      if (st.phase !== "aufgabe") { plan = null; return; }
      if (!plan) { plan = { schritte: K.loesung(st.aufgaben[st.index]), i: 0, ab: jetzt + 1400 }; return; }
      if (jetzt < plan.ab || plan.i >= plan.schritte.length) return;
      const [was, wert] = plan.schritte[plan.i];
      K.eingabe(was, wert);
      plan.i += 1;
      plan.ab = jetzt + 380;
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 900,
  dauer: 10000,
  // Das Standbild: mitten im Film der Auflösung.
  bild: 1500,
  bildWenn: () => {
    const st = window.LernappKopfkino.state;
    const tz = (performance.now() - st.tZeig) / 1000;
    return st.phase === "zeigen" && st.index >= 2 && tz > 1.15 && tz < 1.7;
  },
};
