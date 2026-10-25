/*
 * fledermaus.js – Fledermaus.
 * ---------------------------------------------------------------------------
 * Gerüst: Das Spiel wird gerade gebaut. Bis dahin steht hier nur die Bühne.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "bat") return;

  const host = document.querySelector("#fm-stage");
  const shellApi = window.LernappGameShell;
  if (!host || !shellApi) return;

  const zufall = window.LernappZufall?.fuer?.("batEcho") || { neu() {}, zahl: () => Math.random() };
  let shell = null;

  function startRun() {
    zufall.neu();
    shell.clear();
    shell.setPhase("intro");
    const feld = shell.el("div", "fm-feld");
    const canvas = document.createElement("canvas");
    canvas.className = "fm-canvas";
    feld.append(canvas);
    shell.play.append(shell.el("p", "cm-prompt fm-prompt", "Kommt bald."), feld);
  }

  shell = shellApi.mount({
    host,
    title: "Fledermaus",
    area: "konzentration",
    clock: false,
    onRestart: startRun,
    live: { los: () => {}, stopp: () => {} },
  });
  startRun();

  window.LernappFledermaus = { weltText: () => "" };
})();
