/*
 * ninja.js – Zeitlupen-Ninja.
 * ---------------------------------------------------------------------------
 * Gerüst: Das Spiel wird gerade gebaut. Bis dahin steht hier nur die Bühne.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "ninja") return;

  const host = document.querySelector("#nj-stage");
  const shellApi = window.LernappGameShell;
  if (!host || !shellApi) return;

  const zufall = window.LernappZufall?.fuer?.("timeNinja") || { neu() {}, zahl: () => Math.random() };
  let shell = null;

  function startRun() {
    zufall.neu();
    shell.clear();
    shell.setPhase("intro");
    const feld = shell.el("div", "nj-feld");
    const canvas = document.createElement("canvas");
    canvas.className = "nj-canvas";
    feld.append(canvas);
    shell.play.append(shell.el("p", "cm-prompt nj-prompt", "Kommt bald."), feld);
  }

  shell = shellApi.mount({
    host,
    title: "Zeitlupen-Ninja",
    area: "konzentration",
    clock: false,
    onRestart: startRun,
    live: { los: () => {}, stopp: () => {} },
  });
  startRun();

  window.LernappNinja = { weltText: () => "" };
})();
