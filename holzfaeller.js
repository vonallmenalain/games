/*
 * holzfaeller.js – Holzfäller.
 * ---------------------------------------------------------------------------
 * Gerüst: Das Spiel wird gerade gebaut. Bis dahin steht hier nur die Bühne.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "lumber") return;

  const host = document.querySelector("#hl-stage");
  const shellApi = window.LernappGameShell;
  if (!host || !shellApi) return;

  const zufall = window.LernappZufall?.fuer?.("lumberCut") || { neu() {}, zahl: () => Math.random() };
  let shell = null;

  function startRun() {
    zufall.neu();
    shell.clear();
    shell.setPhase("intro");
    const feld = shell.el("div", "hl-feld");
    const canvas = document.createElement("canvas");
    canvas.className = "hl-canvas";
    feld.append(canvas);
    shell.play.append(shell.el("p", "cm-prompt hl-prompt", "Kommt bald."), feld);
  }

  shell = shellApi.mount({
    host,
    title: "Holzfäller",
    area: "konzentration",
    clock: false,
    onRestart: startRun,
    live: { los: () => {}, stopp: () => {} },
  });
  startRun();

  window.LernappHolzfaeller = { weltText: () => "" };
})();
