/*
 * vorschau.js – die kleinen Filme auf den Spielkacheln.
 *
 * Auf der Startseite und im Turnier zeigt eine Kachel, wie das Spiel aussieht
 * und wie es gespielt wird, bevor jemand hineintippt: kein Standbild, sondern
 * ein kurzer Film in derselben Bildsprache wie das Spiel selbst. Im Turmbau
 * schwingt ein Block, ein Finger tippt, der Block fällt, was übersteht, bricht
 * ab – und irgendwann geht einer daneben, und alles beginnt von vorn.
 *
 * Gespielt wird nichts: Ein Film ist ein Drehbuch, das in jeder Schleife
 * gleich abläuft. Er rechnet aber mit denselben Massen wie das Spiel (Farben,
 * Block, Sockel, Himmel), damit die Kachel nicht etwas verspricht, das das
 * Spiel dann anders zeigt.
 *
 *   LernappVorschau.hat(spiel)            gibt es für dieses Spiel einen Film?
 *   LernappVorschau.satz(spiel)           ein Satz, wie man es spielt
 *   LernappVorschau.zeige(leinwand, spiel) den Film auf diese Leinwand
 *
 * Alle Filme teilen sich einen Bildtakt, und gezeichnet wird nur, was im Bild
 * ist: Eine Seite mit zwanzig Kacheln soll nicht zwanzig Filme rechnen, von
 * denen man drei sieht. Ist die Seite im Hintergrund, steht der Takt.
 *
 * Wer weniger Bewegung eingestellt hat, sieht ein Standbild aus dem Film –
 * den Turm mitten im Bau.
 *
 * Wird eine Kachel neu gebaut (die Turnierseite zeichnet sich neu, sobald
 * jemand gespielt hat), bekommt der neue Film nicht den Anfang, sondern läuft
 * dort weiter, wo der alte war: Ein Film, der bei jedem Auffrischen von vorn
 * beginnt, sieht nach Fehler aus.
 */
(() => {
  "use strict";

  const clamp = (wert, min, max) => Math.max(min, Math.min(max, wert));
  const ruhig = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  const SCHRIFT = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

  // Weiche Überblendung zwischen 0 und 1 – ohne Knick an den Enden.
  function sanft(von, bis, wert) {
    const k = clamp((wert - von) / (bis - von || 1), 0, 1);
    return k * k * (3 - 2 * k);
  }

  // Immer dieselbe Zahl zu derselben Eingabe: Wolken und Funken sollen in
  // jeder Schleife gleich stehen.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function rgb(hex) {
    const h = hex.replace("#", "");
    const voll = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return [0, 2, 4].map((i) => parseInt(voll.slice(i, i + 2), 16));
  }
  function hex(teile) {
    return `#${teile.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("")}`;
  }
  // Wie train-art.js (shade): heller zu Weiss, dunkler zu Schwarz.
  function schattiere(farbe, anteil) {
    const ziel = anteil < 0 ? 0 : 255;
    const k = Math.abs(anteil);
    return hex(rgb(farbe).map((v) => v + (ziel - v) * k));
  }
  function mische(a, b, k) {
    const ra = rgb(a);
    const rb = rgb(b);
    return hex(ra.map((v, i) => v + (rb[i] - v) * k));
  }

  // Ein Rechteck mit runden Ecken, ohne roundRect – wie im Spiel, das läuft
  // auch auf alten Geräten.
  function rundRect(g, x, y, w, h, r) {
    const rad = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    g.beginPath();
    g.moveTo(x + rad, y);
    g.lineTo(x + w - rad, y);
    g.quadraticCurveTo(x + w, y, x + w, y + Math.sign(h) * rad);
    g.lineTo(x + w, y + h - Math.sign(h) * rad);
    g.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    g.lineTo(x + rad, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - Math.sign(h) * rad);
    g.lineTo(x, y + Math.sign(h) * rad);
    g.quadraticCurveTo(x, y, x + rad, y);
    g.closePath();
  }

  // Der Finger: ein Punkt, der drückt, und ein Ring, der aufgeht – derselbe
  // Hinweis wie vor dem ersten Tipp im Spiel (.tb-tipp). k läuft von 0 bis 1.
  function tippe(g, x, y, k, farbe) {
    if (k <= 0 || k >= 1) return;
    const druck = k < 0.25 ? 1 - 0.22 * (k / 0.25) : 0.78 + 0.22 * sanft(0.25, 0.6, k);
    const weg = 1 - sanft(0.55, 1, k);
    g.save();
    g.strokeStyle = "#ffffff";
    g.lineWidth = 2.4;
    g.shadowColor = "rgba(31, 42, 51, 0.45)";
    g.shadowBlur = 6;
    g.beginPath();
    g.arc(x, y, 9 + 22 * sanft(0.1, 0.9, k), 0, Math.PI * 2);
    g.globalAlpha = weg * (1 - sanft(0.1, 0.95, k));
    g.stroke();
    g.globalAlpha = weg * 0.95;
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(x, y, 9 * druck, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = farbe;
    g.beginPath();
    g.arc(x, y, 4 * druck, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // Ein Schild in Pillenform, wie die Combo im Spiel (.tb-combo) und der
  // Zähler oben rechts (game-shell.js).
  function pille(g, x, y, text, { farbe, groesse = 13, anker = "mitte", haken = false, skal = 1 }) {
    g.save();
    g.font = `900 ${groesse}px ${SCHRIFT}`;
    const tw = g.measureText(text).width;
    const hakenW = haken ? groesse * 0.95 : 0;
    const w = tw + hakenW + groesse * 1.1;
    const h = groesse * 1.75;
    const x0 = anker === "rechts" ? x - w : anker === "links" ? x : x - w / 2;
    g.translate(x0 + w / 2, y + h / 2);
    g.scale(skal, skal);
    g.translate(-w / 2, -h / 2);
    g.shadowColor = "rgba(31, 42, 51, 0.22)";
    g.shadowBlur = 8;
    g.shadowOffsetY = 2;
    g.fillStyle = "rgba(255, 255, 255, 0.94)";
    rundRect(g, 0, 0, w, h, h / 2);
    g.fill();
    g.shadowColor = "transparent";
    let tx = groesse * 0.55;
    if (haken) {
      g.strokeStyle = "#3fbf74";
      g.lineWidth = groesse * 0.2;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      g.moveTo(tx + groesse * 0.05, h * 0.52);
      g.lineTo(tx + groesse * 0.32, h * 0.72);
      g.lineTo(tx + groesse * 0.78, h * 0.3);
      g.stroke();
      tx += hakenW;
    }
    g.fillStyle = farbe;
    g.textBaseline = "middle";
    g.fillText(text, tx, h / 2 + 0.5);
    g.restore();
  }

  // ---------------------------------------------------------------------------
  // Turmbau
  // ---------------------------------------------------------------------------
  // Masse und Farben wie in turmbau.js. Nur der Ausschnitt ist enger (SICHT
  // statt 300 Einheiten in der Höhe), damit die Blöcke auf einer Kachel gross
  // genug sind, und der Block schwingt schneller: Ein Film hat keine Zeit für
  // eine Schwingung von drei Sekunden.
  const TURM = {
    SICHT: 212,
    BLOCK_H: 26,
    START_W: 124,
    GRUND: 46,
    SCHWEBE: 26 * 1.6,
    FALL_G: 2600,
    RAND: 8,
    FARBEN: [
      "#e2694f", "#ef8f3c", "#f0b429", "#a8cf5c", "#5fb87a", "#3fb8b8",
      "#4a90d9", "#7c5ce6", "#9a6fd0", "#ef86a8", "#e8543f", "#c97a3c",
    ],
    SOCKEL_FARBE: "#9aa7b4",
    HIMMEL: [
      { t: 0, oben: "#79c7ee", unten: "#dff2fc" },
      { t: 0.3, oben: "#6aaee2", unten: "#ffe6b8" },
      { t: 0.55, oben: "#b96a8f", unten: "#f6a463" },
      { t: 0.78, oben: "#4a3f74", unten: "#a86a84" },
      { t: 1, oben: "#141c38", unten: "#2c3a63" },
    ],
    // Das Drehbuch: wo der Finger den Block loslässt, als Abstand zur Mitte
    // des Blocks darunter. 0 ist ein genauer Treffer, "daneben" das Ende.
    // Erst drei genaue, dann einer zu weit rechts (ein Stück bricht ab), ein
    // paar genaue mit Combo und dem Stück Breite zurück, einer zu weit links –
    // und am Schluss einer ganz daneben.
    DREHBUCH: [0, 24, 0, 0, -20, 0, 0, 0, 30, "daneben"],
  };

  function turmFilm() {
    const T = TURM;
    const sockel = { x: 0, y: 0, w: T.START_W * 1.34, h: T.BLOCK_H * 1.15, sockel: true };
    const wolken = [...Array(6).keys()].map((i) => ({
      x: hash01(i * 2.3 + 0.4),
      y: 0.12 + hash01(i * 9.1) * 0.42,
      r: 13 + hash01(i * 4.4) * 9,
      v: 0.008 + hash01(i * 6.6) * 0.01,
    }));
    let s = null;
    const view = { w: 360, h: T.SICHT, s: 1 };

    function neu() {
      s = {
        zeit: 0,
        schritt: 0,          // wievielte Zeile des Drehbuchs
        bloecke: [sockel],
        teile: [],
        funken: [],
        breite: T.START_W,
        combo: 0,
        perfekte: 0,
        punkte: 0,
        schweber: null,
        camY: -T.GRUND,
        himmel: 0,
        stoss: 0,
        tipp: null,          // { x, y, k } – der Finger
        comboPop: 0,
        ende: 0,             // Sekunden seit dem Fehlwurf
        blende: 0,           // die Überblendung in die nächste Schleife
      };
      neuerSchweber();
    }

    const spitze = () => {
      const oben = s.bloecke[s.bloecke.length - 1];
      return oben.y + oben.h;
    };

    function neuerSchweber() {
      const unten = s.bloecke[s.bloecke.length - 1];
      const n = s.punkte;
      const seite = n % 2 === 0 ? -1 : 1;
      const platz = view.w / 2 - s.breite / 2 - T.RAND;
      const weite = Math.max(18, Math.min(platz, 52 + n * 3.2));
      const ziel = T.DREHBUCH[s.schritt];
      // Der Fehlwurf am Schluss: so weit daneben, dass nichts mehr aufliegt –
      // aber nie weiter, als der Block schwingt.
      const abstand = ziel === "daneben"
        ? Math.min(weite - 1, unten.w / 2 + s.breite / 2 + 6) * (n % 2 === 0 ? 1 : -1)
        : ziel;
      s.schweber = {
        x: unten.x + seite * weite,
        y: spitze() + T.SCHWEBE,
        w: s.breite,
        h: T.BLOCK_H,
        farbe: T.FARBEN[(s.bloecke.length - 1) % T.FARBEN.length],
        mitte: unten.x,
        weite,
        periode: Math.max(0.95, 1.9 * Math.pow(0.95, n)),
        phase: seite < 0 ? -Math.PI / 2 : Math.PI / 2,
        einzug: 1,
        fallend: false,
        vy: 0,
        stauch: 0,
        glanz: 0,
        zielX: unten.x + abstand,
        // Wie lange er mindestens schwingt, bevor der Finger kommt – ein
        // wenig verschieden, sonst tippt der Film im Takt einer Uhr.
        warte: 0.5 + ((n * 7) % 5) * 0.09,
        vorher: null,
        daneben: ziel === "daneben",
      };
    }

    function funken(x, y, farbe, anzahl, saat) {
      for (let i = 0; i < anzahl; i += 1) {
        const h = (k) => hash01(saat * 31 + i * 7 + k);
        const winkel = Math.PI * (0.15 + h(1) * 0.7);
        const tempo = 40 + h(2) * 90;
        s.funken.push({
          x: x + (h(3) - 0.5) * 20,
          y,
          vx: Math.cos(winkel) * tempo * (h(4) < 0.5 ? -1 : 1),
          vy: Math.sin(winkel) * tempo,
          r: 1.6 + h(5) * 2.2,
          leben: 0.45 + h(6) * 0.25,
          max: 0.7,
          farbe,
        });
      }
    }

    function abbrechen(von, bis, block, richtung) {
      const w = bis - von;
      if (w <= 0.4) return;
      const rechts = richtung > 0;
      s.teile.push({
        x: (von + bis) / 2, y: block.y, w, h: block.h, farbe: block.farbe,
        vx: (rechts ? 1 : -1) * (24 + w * 0.5), vy: 30, dreh: 0,
        vdreh: (rechts ? -1 : 1) * 2.3,
      });
    }

    function landen() {
      const b = s.schweber;
      const unten = s.bloecke[s.bloecke.length - 1];
      b.fallend = false;
      b.y = spitze();
      s.schweber = null;
      const a1 = unten.x - unten.w / 2;
      const a2 = unten.x + unten.w / 2;
      const b1 = b.x - b.w / 2;
      const b2 = b.x + b.w / 2;
      const links = Math.max(a1, b1);
      const rechts = Math.min(a2, b2);
      const genau = Math.abs(b.x - unten.x) <= Math.max(4.5, b.w * 0.075);
      if (genau) {
        b.x = unten.x;
      } else {
        if (b1 < links) abbrechen(b1, links, b, -1);
        if (b2 > rechts) abbrechen(rechts, b2, b, 1);
        b.x = (links + rechts) / 2;
        b.w = Math.max(3, rechts - links);
      }
      b.stauch = 1;
      unten.stauch = Math.max(unten.stauch || 0, 0.4);
      s.bloecke.push(b);
      s.punkte += 1;
      if (genau) {
        s.combo += 1;
        s.perfekte += 1;
        b.glanz = 1;
        s.stoss = 1;
        funken(b.x, b.y, "#fff3c4", 10, s.punkte);
        if (s.combo >= 2) s.comboPop = 1;
        // Drei genaue hintereinander: ein Stück Breite zurück.
        if (s.perfekte % 3 === 0 && s.breite < T.START_W) {
          s.breite = Math.min(T.START_W, b.w + T.START_W * 0.06);
          funken(b.x, b.y + b.h, "#ffffff", 12, s.punkte + 50);
        } else {
          s.breite = b.w;
        }
      } else {
        s.combo = 0;
        s.perfekte = 0;
        s.breite = b.w;
      }
      s.schritt += 1;
      neuerSchweber();
    }

    function daneben() {
      const b = s.schweber;
      s.schweber = null;
      const rechts = b.x > s.bloecke[s.bloecke.length - 1].x;
      s.teile.push({ x: b.x, y: b.y, w: b.w, h: b.h, farbe: b.farbe, vx: rechts ? 26 : -26, vy: b.vy, dreh: 0, vdreh: (rechts ? -1 : 1) * 2.2 });
      const oben = s.bloecke[s.bloecke.length - 1];
      if (!oben.sockel) oben.wackel = 1;
      s.combo = 0;
      s.ende = 0.0001;
    }

    function schritt(dt) {
      s.zeit += dt;
      if (s.stoss > 0) s.stoss = Math.max(0, s.stoss - dt / 0.09);
      if (s.comboPop > 0) s.comboPop = Math.max(0, s.comboPop - dt / 0.26);
      if (s.tipp) {
        s.tipp.k += dt / 0.62;
        if (s.tipp.k >= 1) s.tipp = null;
      }

      const hoehe = Math.max(0, spitze() - sockel.h);
      const zielHimmel = clamp(hoehe / (16 * T.BLOCK_H), 0, 0.62);
      s.himmel += (zielHimmel - s.himmel) * (1 - Math.exp(-2.5 * dt));

      const b = s.schweber;
      if (b) {
        if (b.einzug > 0) b.einzug = Math.max(0, b.einzug - dt / 0.22);
        if (b.fallend) {
          b.vy -= T.FALL_G * dt;
          b.y += b.vy * dt;
          if (b.y <= spitze()) {
            const unten = s.bloecke[s.bloecke.length - 1];
            const ueber = Math.min(unten.x + unten.w / 2, b.x + b.w / 2) - Math.max(unten.x - unten.w / 2, b.x - b.w / 2);
            if (ueber <= 0) daneben();
            else landen();
          }
        } else {
          b.phase += (Math.PI * 2 / b.periode) * dt;
          b.x = b.mitte + b.weite * Math.sin(b.phase);
          b.y = spitze() + T.SCHWEBE;
          b.warte -= dt;
          // Der Finger tippt, wenn der Block über seinem Ziel ist.
          const d = b.x - b.zielX;
          if (b.warte <= 0 && b.einzug <= 0 && b.vorher !== null && Math.sign(d) !== Math.sign(b.vorher)) {
            b.x = b.zielX;
            b.fallend = true;
            b.vy = -40;
            s.tipp = { k: 0 };
          }
          b.vorher = d;
        }
      }

      for (let i = s.teile.length - 1; i >= 0; i -= 1) {
        const t = s.teile[i];
        t.vy -= T.FALL_G * 0.32 * dt;
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        t.dreh += t.vdreh * dt;
        if (t.y + t.h < s.camY - 80) s.teile.splice(i, 1);
      }
      for (let i = s.funken.length - 1; i >= 0; i -= 1) {
        const f = s.funken[i];
        f.vy -= T.FALL_G * 0.22 * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.leben -= dt;
        if (f.leben <= 0) s.funken.splice(i, 1);
      }
      s.bloecke.forEach((block) => {
        if (block.stauch > 0) block.stauch = Math.max(0, block.stauch - dt / 0.11);
        if (block.glanz > 0) block.glanz = Math.max(0, block.glanz - dt / 0.19);
        if (block.wackel > 0) block.wackel = Math.max(0, block.wackel - dt * 2.2);
      });

      const zielCam = Math.max(-T.GRUND, spitze() - view.h * 0.56);
      s.camY += (zielCam - s.camY) * (1 - Math.exp(-5 * dt));

      // Nach dem Fehlwurf: kurz zusehen, wie er fällt, dann blendet der Film
      // in die nächste Schleife.
      if (s.ende > 0) {
        s.ende += dt;
        if (s.ende > 1.5) s.blende = Math.min(1, (s.ende - 1.5) / 0.35);
        if (s.ende > 1.85) {
          neu();
          s.blende = 1;
          s.einblenden = true;
        }
      } else if (s.einblenden) {
        s.blende = Math.max(0, s.blende - dt / 0.35);
        if (s.blende <= 0) s.einblenden = false;
      }
    }

    function himmelFarben(t) {
      let i = 0;
      while (i < T.HIMMEL.length - 2 && t > T.HIMMEL[i + 1].t) i += 1;
      const von = T.HIMMEL[i];
      const bis = T.HIMMEL[i + 1];
      const k = clamp((t - von.t) / (bis.t - von.t), 0, 1);
      return { oben: mische(von.oben, bis.oben, k), unten: mische(von.unten, bis.unten, k) };
    }

    function zeichneBlock(g, block) {
      const k = block.stauch || 0;
      const w = block.w * (1 + 0.12 * k);
      const h = block.h * (1 - 0.2 * k);
      const wackel = block.wackel ? Math.sin(s.zeit * 26) * 3.2 * block.wackel : 0;
      const x = block.x + wackel - w / 2;
      const r = Math.min(5, h * 0.32);
      rundRect(g, x, block.y, w, h, r);
      g.fillStyle = block.farbe;
      g.fill();
      rundRect(g, x + 2, block.y + h - Math.min(5, h * 0.28), w - 4, Math.min(5, h * 0.28), 2);
      g.fillStyle = schattiere(block.farbe, 0.3);
      g.fill();
      g.fillStyle = schattiere(block.farbe, -0.24);
      g.fillRect(x + 2, block.y, w - 4, Math.min(2.6, h * 0.14));
      if (block.glanz > 0) {
        const auf = 1 - block.glanz;
        g.globalAlpha = block.glanz;
        g.strokeStyle = "#fff8dc";
        g.lineWidth = 2.6;
        rundRect(g, x - 2 - 8 * auf, block.y - 2 - 8 * auf, w + 4 + 16 * auf, h + 4 + 16 * auf, r + 4);
        g.stroke();
        g.globalAlpha = 1;
      }
    }

    function zeichneSockel(g, block) {
      const x = block.x - block.w / 2;
      rundRect(g, x, block.y, block.w, block.h, 5);
      g.fillStyle = T.SOCKEL_FARBE;
      g.fill();
      g.fillStyle = schattiere(T.SOCKEL_FARBE, 0.26);
      g.fillRect(x + 3, block.y + block.h - 4, block.w - 6, 4);
      g.strokeStyle = schattiere(T.SOCKEL_FARBE, -0.22);
      g.lineWidth = 1.6;
      g.beginPath();
      for (let i = 1; i < 4; i += 1) {
        const fx = x + (block.w * i) / 4;
        g.moveTo(fx, block.y + 3);
        g.lineTo(fx, block.y + block.h - 5);
      }
      g.stroke();
    }

    function huegel(g, W, H, y, hoehe, wellen, farbe, versatz) {
      if (y - hoehe > H + 4) return;
      g.fillStyle = farbe;
      g.beginPath();
      g.moveTo(0, H + 12);
      for (let i = 0; i <= 18; i += 1) {
        const k = i / 18;
        g.lineTo(k * W, y - Math.abs(Math.sin(k * Math.PI * wellen + versatz)) * hoehe);
      }
      g.lineTo(W, H + 12);
      g.closePath();
      g.fill();
    }

    function zeichne(g, v) {
      const W = v.cssW;
      const H = v.cssH;
      view.s = H / T.SICHT;
      view.w = W / view.s;
      view.h = T.SICHT;
      const sc = view.s;
      const stoss = ruhig() ? 0 : -2.4 * s.stoss;

      // Der Himmel, in Bildpunkten.
      g.setTransform(v.dpr, 0, 0, v.dpr, 0, stoss * v.dpr);
      const farben = himmelFarben(s.himmel);
      const verlauf = g.createLinearGradient(0, 0, 0, H);
      verlauf.addColorStop(0, farben.oben);
      verlauf.addColorStop(1, farben.unten);
      g.fillStyle = verlauf;
      g.fillRect(0, -8, W, H + 16);

      const par = (s.camY + T.GRUND) * sc;
      const kurz = Math.min(W, H);
      const sonneAuf = 1 - sanft(0.46, 0.66, s.himmel);
      if (sonneAuf > 0.01) {
        const x = W * 0.24;
        const y = H * (0.2 + 1.05 * sanft(0, 0.62, s.himmel));
        const r = kurz * 0.085;
        const schein = g.createRadialGradient(x, y, r * 0.35, x, y, r * 2.6);
        schein.addColorStop(0, "rgba(255, 232, 150, 0.55)");
        schein.addColorStop(1, "rgba(255, 255, 255, 0)");
        g.globalAlpha = sonneAuf;
        g.fillStyle = schein;
        g.beginPath();
        g.arc(x, y, r * 2.6, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#ffe38a";
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }

      const wolkenAuf = (1 - sanft(0.3, 0.62, s.himmel)) * 0.92;
      if (wolkenAuf > 0.01) {
        const band = H * 0.95;
        g.globalAlpha = wolkenAuf;
        g.fillStyle = "#ffffff";
        wolken.forEach((w) => {
          const treib = ruhig() ? 0 : s.zeit * w.v;
          const x = (((w.x + treib) % 1.3) - 0.15) * W;
          const y = ((w.y * band + par * 0.4) % band + band) % band;
          const r = w.r * sc;
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.arc(x + r * 0.9, y - r * 0.3, r * 0.78, 0, Math.PI * 2);
          g.arc(x + r * 1.75, y + r * 0.05, r * 0.62, 0, Math.PI * 2);
          g.arc(x + r * 0.85, y + r * 0.42, r * 0.72, 0, Math.PI * 2);
          g.fill();
        });
        g.globalAlpha = 1;
      }

      const dunkel = sanft(0.4, 1, s.himmel);
      huegel(g, W, H, H - 8 * sc + par * 0.2, 26 * sc, 3, mische("#7cb98d", "#2c3a52", dunkel), 0.6);
      huegel(g, W, H, H + 10 * sc + par * 0.42, 34 * sc, 2, mische("#57a26b", "#1e2a3e", dunkel), 2.1);

      // Die Welt: Nullpunkt auf dem Boden in der Bildmitte, y nach oben.
      const f = sc * v.dpr;
      g.setTransform(f, 0, 0, -f, (W / 2) * v.dpr, (H + sc * s.camY + stoss) * v.dpr);
      if (s.camY < 4) {
        g.fillStyle = "#7a5b3c";
        g.fillRect(-view.w, -T.GRUND - 60, view.w * 2, T.GRUND + 60);
        g.fillStyle = "#5f9f52";
        g.fillRect(-view.w, -15, view.w * 2, 15);
        g.fillStyle = "#78b863";
        g.fillRect(-view.w, -5, view.w * 2, 5);
      }
      const unten = s.camY - 20;
      const oben = s.camY + view.h + 20;
      s.bloecke.forEach((block) => {
        if (block.y + block.h < unten || block.y > oben) return;
        if (block.sockel) zeichneSockel(g, block);
        else zeichneBlock(g, block);
      });
      s.teile.forEach((t) => {
        g.save();
        g.translate(t.x, t.y + t.h / 2);
        g.rotate(t.dreh);
        rundRect(g, -t.w / 2, -t.h / 2, t.w, t.h, Math.min(4, t.h * 0.3));
        g.fillStyle = t.farbe;
        g.fill();
        g.fillStyle = schattiere(t.farbe, -0.22);
        g.fillRect(-t.w / 2 + 1, -t.h / 2, t.w - 2, Math.min(2.4, t.h * 0.14));
        g.restore();
      });
      const b = s.schweber;
      if (b) {
        g.globalAlpha = 1 - b.einzug;
        zeichneBlock(g, { ...b, y: b.y + b.einzug * 20, stauch: 0, glanz: 0 });
        g.globalAlpha = 1;
      }
      s.funken.forEach((fu) => {
        const k = fu.leben / fu.max;
        g.globalAlpha = clamp(k, 0, 1);
        g.fillStyle = fu.farbe;
        g.beginPath();
        g.arc(fu.x, fu.y, fu.r * k, 0, Math.PI * 2);
        g.fill();
      });
      g.globalAlpha = 1;

      // Darüber, wieder in Bildpunkten: der Finger, die Combo, der Zähler.
      g.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      if (s.tipp) tippe(g, W * 0.18, H * 0.62, s.tipp.k, "#F5A623");
      if (s.combo >= 2) {
        const pop = s.comboPop > 0 ? 1 + 0.18 * Math.sin(Math.PI * (1 - s.comboPop)) : 1;
        pille(g, W / 2, 10, `×${s.combo}`, { farbe: "#b9741a", groesse: 13, skal: pop });
      }
      pille(g, W - 10, 10, String(s.punkte), { farbe: "#2f6f4f", groesse: 13, anker: "rechts", haken: true });
      // Nach dem Fehlwurf: was der Turm gebracht hat. Darum geht es im Spiel.
      if (s.ende > 0.35) {
        const k = clamp((s.ende - 0.35) / 0.3, 0, 1);
        const zurueck = 1.70158;
        const auf = 1 + (zurueck + 1) * Math.pow(k - 1, 3) + zurueck * Math.pow(k - 1, 2);
        g.globalAlpha = k;
        pille(g, W / 2, H * 0.34, `${s.punkte} Blöcke`, { farbe: "#b9741a", groesse: 18, skal: 0.6 + 0.4 * auf });
        g.globalAlpha = 1;
      }

      if (s.blende > 0) {
        g.globalAlpha = s.blende;
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, W, H);
        g.globalAlpha = 1;
      }
    }

    // Das Standbild für wenig Bewegung: der Turm mitten im Bau, mit
    // abgebrochenem Stück und dem nächsten Block darüber.
    function standbild() {
      neu();
      for (let i = 0; i < 60 * 6.2; i += 1) schritt(1 / 60);
      s.tipp = null;
    }

    neu();
    return { schritt, zeichne, standbild };
  }

  const FILME = {
    towerStack: { film: turmFilm, satz: "Tippe, wenn der Block genau über dem Turm ist." },
  };

  // ---------------------------------------------------------------------------
  // Der gemeinsame Bildtakt
  // ---------------------------------------------------------------------------
  const laufend = new Map();     // spiel → { leinwand, film, g, view, sichtbar }
  let takt = 0;
  let zuletzt = 0;

  const sichtbarkeit = "IntersectionObserver" in window
    ? new IntersectionObserver((eintraege) => {
      eintraege.forEach((e) => {
        laufend.forEach((l) => { if (l.leinwand === e.target) l.sichtbar = e.isIntersecting; });
      });
      anstossen();
    }, { rootMargin: "80px" })
    : null;

  const groesse = "ResizeObserver" in window
    ? new ResizeObserver((eintraege) => {
      eintraege.forEach((e) => {
        laufend.forEach((l) => { if (l.leinwand === e.target) { messen(l); zeichneEinmal(l); } });
      });
    })
    : null;

  function messen(l) {
    const cssW = Math.max(40, l.leinwand.clientWidth);
    const cssH = Math.max(40, l.leinwand.clientHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    l.view = { cssW, cssH, dpr };
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (l.leinwand.width !== pw) l.leinwand.width = pw;
    if (l.leinwand.height !== ph) l.leinwand.height = ph;
  }

  function zeichneEinmal(l) {
    if (!l.g || !l.view) return;
    l.g.setTransform(1, 0, 0, 1, 0, 0);
    l.g.clearRect(0, 0, l.leinwand.width, l.leinwand.height);
    l.film.zeichne(l.g, l.view);
  }

  function bild(jetzt) {
    takt = 0;
    const dt = Math.min(0.05, Math.max(0, (jetzt - (zuletzt || jetzt)) / 1000));
    zuletzt = jetzt;
    let weiter = false;
    laufend.forEach((l) => {
      if (!l.leinwand.isConnected) {
        // Die Kachel ist weg. Der Film bleibt gemerkt – kommt sie neu,
        // läuft er dort weiter.
        sichtbarkeit?.unobserve(l.leinwand);
        groesse?.unobserve(l.leinwand);
        return;
      }
      if (!l.sichtbar || ruhig()) return;
      l.film.schritt(dt);
      zeichneEinmal(l);
      weiter = true;
    });
    if (weiter && document.visibilityState === "visible") takt = window.requestAnimationFrame(bild);
    else zuletzt = 0;
  }

  function anstossen() {
    if (takt || document.visibilityState !== "visible" || ruhig()) return;
    zuletzt = 0;
    takt = window.requestAnimationFrame(bild);
  }

  document.addEventListener("visibilitychange", anstossen);

  function zeige(leinwand, spiel) {
    const eintrag = FILME[spiel];
    if (!leinwand || !eintrag) return null;
    const g = leinwand.getContext("2d");
    if (!g) return null;
    const alt = laufend.get(spiel);
    const film = alt ? alt.film : eintrag.film();
    if (alt && alt.leinwand !== leinwand) {
      sichtbarkeit?.unobserve(alt.leinwand);
      groesse?.unobserve(alt.leinwand);
    }
    const l = { leinwand, film, g, view: null, sichtbar: !sichtbarkeit };
    laufend.set(spiel, l);
    if (ruhig() && !alt) film.standbild();
    messen(l);
    zeichneEinmal(l);
    sichtbarkeit?.observe(leinwand);
    groesse?.observe(leinwand);
    anstossen();
    return l;
  }

  window.LernappVorschau = {
    hat: (spiel) => Boolean(FILME[spiel]),
    satz: (spiel) => FILME[spiel]?.satz || "",
    zeige,
  };
})();
