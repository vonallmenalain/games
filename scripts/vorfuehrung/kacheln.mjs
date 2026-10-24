// Kacheln-Knobeln: Das Muster leuchtet auf, verschwindet – und wird Kachel
// um Kachel richtig nachgetippt. Danach kommt das nächste, grössere Muster.
// Daneben getippt wird nie. Der Film beginnt mit dem dritten Muster (fünf
// Kacheln) kurz vor dem Verlöschen und endet, wenn das fünfte aufleuchtet.
export default {
  bereit: () => Boolean(window.LernappKacheln?.state && document.querySelector(".kk-kachel")),
  spiele: () => {
    const K = window.LernappKacheln;
    let warte = 0;
    let runde = -1;
    const tick = (jetzt) => {
      requestAnimationFrame(tick);
      const st = K.state;
      if (st.phase !== "tippen") return;
      // Nach dem Verlöschen erst einen Augenblick hinschauen, dann im Takt
      // einer Hand – der Reihe nach, wie man ein Raster liest.
      if (runde !== st.runde) { runde = st.runde; warte = jetzt + 420; return; }
      if (jetzt < warte) return;
      const naechste = [...st.offen].sort((a, b) => a - b)[0];
      if (naechste === undefined) return;
      const kachel = document.querySelectorAll(".kk-kachel")[naechste];
      if (!kachel) return;
      const box = kachel.getBoundingClientRect();
      const ort = { bubbles: true, cancelable: true, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2, pointerId: 1, isPrimary: true };
      kachel.dispatchEvent(new PointerEvent("pointerdown", ort));
      kachel.dispatchEvent(new PointerEvent("pointerup", ort));
      kachel.click();
      warte = jetzt + 340;
    };
    requestAnimationFrame(tick);
  },
  // Gemessen ab dem Start des Autopiloten: Das dritte Muster leuchtet von
  // 7,8 s bis 10,9 s, getippt wird bis 12,4 s, das vierte leuchtet von 12,8 s
  // bis 15,9 s, das fünfte ab 18,1 s.
  vorlauf: 10000,
  dauer: 9000,
  // Quer stiesse das Raster oben und unten an den Rand – auf der breiten
  // Bühne der Startseite wird dort ohnehin noch etwas abgeschnitten.
  stil: ".kk-raster { height: min(76%, 96vw * var(--kk-reihen, 3) / var(--kk-spalten, 4)) !important; }",
};
