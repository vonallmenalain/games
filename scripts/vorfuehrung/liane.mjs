// Lianenschwung: Der Affe schwingt geschickt von Liane zu Liane, lässt im
// richtigen Augenblick los und greift weit – ab und zu über einen Ast hinweg
// («Weit! Schwung!»), und an den Bananen-Lianen holt er sich den Stoss.
export default {
  bereit: () => Boolean(window.LernappLiane?.state?.anker?.length),
  spiele: () => {
    const L = window.LernappLiane;
    const st = L.state;
    // Dieselbe Physik wie im Spiel (liane.js, physik): So rechnet der
    // Autopilot voraus, wohin ein Loslassen jetzt oder etwas später führt.
    const G = 720;
    const LUFT = 0.04;
    const PUMP = 80;
    const V_MAX = 720;
    const UMLENK = 0.55;
    const WEIT_V = 85;
    const H = 1 / 240;
    const PLATSCH = L.WASSER + 12.6 * 1.3;
    // Wie er spielen soll: weit greifen ist gut (WEIT je Ast), Schwung auch
    // – aber nicht mehr als ZIEL_E (sonst rast das Bild nur noch vorbei),
    // nicht über HOCH hinaus (dort hängt keine Liane, und das Wasser
    // verschwindet) und nicht so viel, dass er sich um den Ast dreht (UEBER).
    // Und wer zögert, verliert je Bild ZOEGERN.
    const WEIT = 40;
    const ZIEL_E = 280;
    const HOCH = 260;
    const UEBER = 10;
    const ZOEGERN = 1;
    const physik = (p, a, seil, h) => {
      p.vy -= G * h;
      const luft = 1 - LUFT * h;
      p.vx *= luft;
      p.vy *= luft;
      if (a) {
        const dx = p.x - a.x;
        const dy = p.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        if (d >= seil - 0.5) {
          const tx = -dy / d;
          const ty = dx / d;
          if (p.vx * tx + p.vy * ty > 0) { p.vx += tx * PUMP * h; p.vy += ty * PUMP * h; }
        }
      }
      const v = Math.hypot(p.vx, p.vy);
      if (v > V_MAX) { p.vx *= V_MAX / v; p.vy *= V_MAX / v; }
      p.x += p.vx * h;
      p.y += p.vy * h;
      if (a) {
        const dx = p.x - a.x;
        const dy = p.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        if (d > seil) {
          const rx = dx / d;
          const ry = dy / d;
          p.x = a.x + rx * seil;
          p.y = a.y + ry * seil;
          const vr = p.vx * rx + p.vy * ry;
          if (vr > 0) { p.vx -= rx * vr; p.vy -= ry * vr; }
        }
      }
    };
    // Ein Bild weiter, in so kleinen Schritten wie das Spiel.
    const bild = (p, a, seil, dt) => {
      const n = Math.max(1, Math.ceil(dt / H - 1e-9));
      for (let i = 0; i < n; i += 1) physik(p, a, seil, dt / n);
    };
    // Welchen Ast das Spiel jetzt greifen würde (liane.js, zielSuchen).
    const zielBei = (p, letzter) => {
      let best = -1;
      let bestD = L.REICH;
      for (let i = Math.max(0, letzter - 1); i < st.anker.length; i += 1) {
        const a = st.anker[i];
        if (a.x > p.x + L.REICH) break;
        if (a.x < p.x - 12 || a.y < p.y + 6) continue;
        const d = Math.hypot(a.x - p.x, a.y - p.y);
        if (d <= bestD) { best = i; bestD = d; }
      }
      return best;
    };
    // Wie gut ein Griff an Ast i wäre. Die Liane muss tragen – mit Abstand
    // über dem Wasser.
    const griff = (p, i, letzter, hoch) => {
      if (i <= letzter) return -Infinity;
      const a = st.anker[i];
      const dx = p.x - a.x;
      const dy = p.y - a.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      if (a.y - Math.max(30, d) < L.SICHER + 8) return -Infinity;
      const rx = dx / d;
      const ry = dy / d;
      let vx = p.vx;
      let vy = p.vy;
      const vr = vx * rx + vy * ry;
      const vt = vx * -ry + vy * rx;
      if (vr > 0) {
        const neu = (vt >= 0 ? 1 : -1) * Math.sqrt(vt * vt + UMLENK * vr * vr);
        vx = -ry * neu;
        vy = rx * neu;
      }
      const weit = i - letzter - 1;
      if (weit > 0) vx += WEIT_V * Math.min(2, weit);
      const v = Math.min(V_MAX, Math.hypot(vx, vy));
      const e = (0.5 * v * v + G * p.y) / 1000;
      // Wer so viel Schwung hat, dass er über den Ast hinaus kommt, dreht
      // sich um den Ast statt vorwärts zu schwingen.
      const ueber = e - (G * a.y) / 1000;
      return WEIT * Math.min(3, i - letzter) + Math.min(e, ZIEL_E) - 0.5 * Math.max(0, e - ZIEL_E)
        - 2 * Math.max(0, hoch - HOCH) - 3 * Math.max(0, ueber + UEBER);
    };
    // Ein Flug von p aus. Wer drückt, greift im ersten Bild danach, in dem
    // ein Ast in Reichweite ist (liane.js, takt). Also: Drücken in Bild k
    // gibt den Griff im ersten erreichbaren Bild ab k + 1. Gezählt wird das
    // Schlechtere von k und k + 1 – ein Bild zu spät darf nicht schaden.
    const flug = (p0, letzter, dt, bilder) => {
      const p = { ...p0 };
      const werte = [];
      let hoch = p.y;
      for (let j = 1; j <= bilder; j += 1) {
        bild(p, null, 0, dt);
        hoch = Math.max(hoch, p.y);
        if (p.y < PLATSCH + 4) break;
        const i = zielBei(p, letzter);
        werte.push(i < 0 ? null : griff(p, i, letzter, hoch));
      }
      // g[k]: der Griff, wenn in Bild k gedrückt wird.
      const g = new Array(werte.length + 1).fill(-Infinity);
      for (let k = werte.length - 1; k >= 0; k -= 1) g[k] = werte[k] === null ? g[k + 1] : werte[k];
      // Wer zögert, verliert ein wenig: Sonst schiebt er den Griff Bild für
      // Bild hinaus, bis keiner mehr geht.
      let best = { wert: -Infinity, k: -1, roh: -Infinity };
      let gut = 0;
      for (let k = 0; k < werte.length; k += 1) {
        const wert = Math.min(g[k], g[k + 1]);
        if (wert > -Infinity) gut += 1;
        if (wert - ZOEGERN * k > best.wert) best = { wert: wert - ZOEGERN * k, k, roh: wert };
      }
      // Nur noch wenige Bilder, in denen ein Griff geht: dann jetzt.
      if (gut > 0 && gut <= 3 && g[0] > -Infinity) best = { wert: g[0], k: 0, roh: g[0] };
      return best;
    };

    let dt = 1 / 60;
    let vorher = 0;
    let gedrueckt = false;
    const tick = (jetzt) => {
      if (st.phase === "ende" || st.schritt === "platsch" || st.schritt === "ende") return;
      requestAnimationFrame(tick);
      if (vorher) dt = Math.min(1 / 30, Math.max(1 / 144, dt * 0.9 + ((jetzt - vorher) / 1000) * 0.1));
      vorher = jetzt;
      if (st.phase === "bereit") { L.druecken(); gedrueckt = true; return; }
      if (st.phase !== "spiel") return;
      if (st.schritt === "schwingen") {
        if (!gedrueckt) { L.druecken(); gedrueckt = true; }
        // Loslassen jetzt – oder ein paar Bilder später? Was den besten
        // Griff gibt, gewinnt; ist es «jetzt», lässt er los.
        const a = st.anker[st.haken];
        const p = { ...st.p };
        let bestK = -1;
        let bestWert = -Infinity;
        for (let k = 0; k <= 50; k += 1) {
          if (k > 0) bild(p, a, st.seil, dt);
          if (st.haken === 0 && p.x < a.x) continue;
          const f = flug(p, st.letzter, dt, 80);
          if (f.roh - ZOEGERN * k > bestWert) { bestWert = f.roh - ZOEGERN * k; bestK = k; }
        }
        if (bestK === 0) { L.loslassen(); gedrueckt = false; }
        return;
      }
      if (st.schritt === "fliegen") {
        // Drücken, wenn jetzt der beste Augenblick ist – und gedrückt
        // bleiben, solange der Griff, der dann kommt, gut ist.
        const f = flug(st.p, st.letzter, dt, 90);
        if (!gedrueckt && f.k === 0) { L.druecken(); gedrueckt = true; }
        if (gedrueckt && f.k !== 0 && f.wert > -Infinity) { L.loslassen(); gedrueckt = false; }
      }
    };
    requestAnimationFrame(tick);
  },
  vorlauf: 1200,
  dauer: 8500,
};
