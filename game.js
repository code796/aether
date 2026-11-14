(() => {
  "use strict";

  /* ================================================================
     AETHER CLASH: RUNE SLINGERS — 16-BIT RETRO ARCADE BRAWLER
     Zero-dependency Vanilla HTML5 Canvas + ES6+ JavaScript
     ================================================================ */

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const WIDTH = 1280;
  const HEIGHT = 720;
  ctx.imageSmoothingEnabled = false;

  /* ================================================================
     PHYSICS & GAME RULES CONSTANTS (1:1 GODOT 4 SPEC PARITY)
     ================================================================ */
  const PF = '"Press Start 2P", monospace';

  const WORLD_GRAVITY = 1240.0;
  const STRIDE_SPEED = 335.0;
  const LEAP_IMPULSE = -535.0;
  const VAULT_RECOIL = 295.0;
  const CAST_DELAY = 0.22;
  const SPELL_VELOCITY = 1020.0;
  const ARCANE_KNOCKBACK = 670.0;
  const MOMENTUM_DECAY = 1450.0;
  const ABYSS_Y = 920.0;
  const ROUND_TIME = 60;
  const WINS_TO_MATCH = 2;

  // Suspended stone monolith platform
  const MONOLITH = {
    x: 280,
    y: 460,
    width: 720,
    height: 38,
    trimHeight: 5,
    bodyColor: "#1f1b33",
    trimColor: "#d500f9"
  };

  // Color Palette
  const TEAL = "#1b8a8f";
  const TEAL_DARK = "#126b6f";
  const CRIMSON = "#8b1a1a";
  const CRIMSON_LT = "#c62828";
  const CRIMSON_DK = "#4a0e0e";
  const GOLD = "#ffab00";
  const GOLD_BR = "#ffd600";
  const GOLD_PALE = "#fff8e1";
  const MAGENTA = "#ff4081";

  /* ================================================================
     FIGHTER ROSTER CONFIGURATION
     Loaded as individual transparent PNGs (Zero CORS / Canvas Tainting)
     ================================================================ */
  const FIGHTERS = [
    {
      id: "vanguard",
      name: "VANGUARD",
      file: "char_vanguard.png",
      color: "#5b8a3c",
      desc: "Dual Swordsman",
      quote: "Blade of the Monolith"
    },
    {
      id: "sentinel",
      name: "SENTINEL",
      file: "char_sentinel.png",
      color: "#4a6fa5",
      desc: "Shield & Sword",
      quote: "Iron Bastion Guard"
    },
    {
      id: "gunner",
      name: "GUNNER",
      file: "char_gunner.png",
      color: "#7b5ea7",
      desc: "Marksman Knight",
      quote: "Arcane Cannonier"
    },
    {
      id: "berserker",
      name: "BERSERKER",
      file: "char_berserker.png",
      color: "#c62828",
      desc: "Raging Brawler",
      quote: "Fierce Serrated Edge"
    }
  ];

  // Preload character images directly
  const fighterImages = [];
  let imagesLoadedCount = 0;

  for (let i = 0; i < FIGHTERS.length; i++) {
    const img = new Image();
    img.onload = () => {
      imagesLoadedCount++;
    };
    img.onerror = () => {
      console.warn("Could not load image: " + FIGHTERS[i].file);
    };
    img.src = FIGHTERS[i].file;
    fighterImages.push(img);
  }

  /* ================================================================
     WEB AUDIO API RETRO CHIPTUNE SYNTHESIZER (ZERO ASSETS)
     ================================================================ */
  class RetroAudio {
    constructor() {
      this.ctx = null;
      this.bgmGain = null;
      this.sfxGain = null;
      this.bgmTimer = null;
      this.bgmStep = 0;
      this.initOnUserGesture();
    }

    init() {
      if (this.ctx) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
        this.bgmGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.bgmGain.gain.value = 0.16;
        this.sfxGain.gain.value = 0.28;
        this.bgmGain.connect(this.ctx.destination);
        this.sfxGain.connect(this.ctx.destination);
        this.startBGM();
      } catch (e) {
        console.warn("Web Audio API not supported", e);
      }
    }

    initOnUserGesture() {
      const unlock = () => {
        this.init();
        if (this.ctx && this.ctx.state === "suspended") {
          this.ctx.resume();
        }
        window.removeEventListener("keydown", unlock);
        window.removeEventListener("click", unlock);
      };
      window.addEventListener("keydown", unlock, { once: false });
      window.addEventListener("click", unlock, { once: false });
    }

    setBGM(enabled) {
      if (this.bgmGain) {
        this.bgmGain.gain.value = enabled ? 0.16 : 0.0;
      }
    }

    setSFX(enabled) {
      if (this.sfxGain) {
        this.sfxGain.gain.value = enabled ? 0.28 : 0.0;
      }
    }

    playTone(freq, type, duration, sweepFreq = null) {
      if (!this.ctx || this.ctx.state !== "running") return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type || "square";
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (sweepFreq) {
          osc.frequency.exponentialRampToValueAtTime(sweepFreq, this.ctx.currentTime + duration);
        }
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    }

    playNoise(duration) {
      if (!this.ctx || this.ctx.state !== "running") return;
      try {
        const bufferSize = Math.floor(this.ctx.sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1100, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + duration);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        whiteNoise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        whiteNoise.start();
      } catch (e) {}
    }

    blip() {
      this.playTone(880, "square", 0.04, 1320);
    }

    lockIn() {
      this.playTone(440, "triangle", 0.06, 880);
      setTimeout(() => this.playTone(880, "square", 0.12, 1760), 60);
    }

    jump() {
      this.playTone(180, "triangle", 0.14, 520);
    }

    cast() {
      this.playTone(720, "sawtooth", 0.12, 220);
    }

    vault() {
      this.playNoise(0.18);
      this.playTone(160, "square", 0.22, 540);
    }

    hit() {
      this.playNoise(0.14);
      this.playTone(220, "square", 0.1, 80);
    }

    ringOut() {
      this.playNoise(0.45);
      this.playTone(320, "sawtooth", 0.45, 55);
    }

    roundStart() {
      this.playTone(330, "triangle", 0.2, 440);
      setTimeout(() => this.playTone(660, "square", 0.35, 880), 220);
    }

    victoryFanfare() {
      const notes = [440, 554, 659, 880];
      notes.forEach((f, idx) => {
        setTimeout(() => this.playTone(f, "square", 0.18), idx * 120);
      });
      setTimeout(() => this.playTone(1108, "triangle", 0.45), 520);
    }

    startBGM() {
      if (this.bgmTimer) return;
      const bassNotes = [110, 110, 130.8, 146.8, 110, 110, 164.8, 146.8, 98, 98, 110, 130.8, 98, 98, 146.8, 130.8];
      const leadNotes = [220, 0, 261.6, 293.7, 329.6, 0, 293.7, 261.6, 196, 0, 220, 261.6, 293.7, 329.6, 392, 440];

      this.bgmTimer = setInterval(() => {
        if (!this.ctx || this.ctx.state !== "running") return;
        const idx = this.bgmStep % 16;
        const bFreq = bassNotes[idx];
        const lFreq = leadNotes[idx];

        if (bFreq > 0) {
          try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(bFreq, this.ctx.currentTime);
            gain.gain.setValueAtTime(0.14, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
            osc.connect(gain);
            gain.connect(this.bgmGain);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.13);
          } catch (e) {}
        }

        if (lFreq > 0 && Math.floor(this.bgmStep / 16) % 2 === 1) {
          try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = "square";
            osc.frequency.setValueAtTime(lFreq, this.ctx.currentTime);
            gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
            osc.connect(gain);
            gain.connect(this.bgmGain);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.19);
          } catch (e) {}
        }

        if (idx % 4 === 2) {
          this.playNoise(0.05);
        }

        this.bgmStep++;
      }, 135);
    }
  }

  const audio = new RetroAudio();

  /* ================================================================
     GAME STATES & GLOBAL VARIABLES
     ================================================================ */
  const S = { TITLE: 0, SELECT: 1, FIGHT: 2, RESULT: 3 };
  const FP = { COUNTDOWN: 0, ACTIVE: 1, ROUND_END: 2 };

  let gameState = S.TITLE;
  let fightPhase = FP.COUNTDOWN;

  // Character Select
  let p1Sel = 0;
  let p2Sel = 1;
  let p1Lock = false;
  let p2Lock = false;
  let selTimer = 0;

  // Match State
  let p1Wins = 0;
  let p2Wins = 0;
  let p1Score = 0;
  let p2Score = 0;
  let roundNum = 1;
  let roundTimer = ROUND_TIME;
  let countdownT = 0;
  let roundEndT = 0;
  let roundWinner = 0;
  let roundReason = "";
  let screenShake = 0;

  // Toggles & Time
  let bgmOn = true;
  let sfxOn = true;
  let helpOpen = false;
  let globalTime = 0;

  /* ================================================================
     INPUT SYSTEM
     ================================================================ */
  const keysDown = new Set();
  const keysJust = new Set();
  const PREVENT_CODES = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"]);
  let mX = 0, mY = 0, mClick = false;

  window.addEventListener("keydown", (e) => {
    if (PREVENT_CODES.has(e.code)) e.preventDefault();
    if (!e.repeat) keysJust.add(e.code);
    keysDown.add(e.code);
  });

  window.addEventListener("keyup", (e) => keysDown.delete(e.code));
  window.addEventListener("blur", () => {
    keysDown.clear();
    keysJust.clear();
  });

  function getCanvasCoords(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (WIDTH / r.width),
      y: (e.clientY - r.top) * (HEIGHT / r.height)
    };
  }

  canvas.addEventListener("mousemove", (e) => {
    const p = getCanvasCoords(e);
    mX = p.x;
    mY = p.y;
  });

  canvas.addEventListener("click", (e) => {
    const p = getCanvasCoords(e);
    mX = p.x;
    mY = p.y;
    mClick = true;
    audio.init();
  });

  /* ================================================================
     DRAWING & COLOR HELPERS
     ================================================================ */
  function hexToRgb(h) {
    const c = h.replace("#", "");
    return [
      parseInt(c.substring(0, 2), 16),
      parseInt(c.substring(2, 4), 16),
      parseInt(c.substring(4, 6), 16)
    ];
  }

  function lerpColor(a, b, t) {
    t = Math.max(0, Math.min(1, t));
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    return `rgb(${Math.round(ca[0] + (cb[0] - ca[0]) * t)}, ${Math.round(ca[1] + (cb[1] - ca[1]) * t)}, ${Math.round(ca[2] + (cb[2] - ca[2]) * t)})`;
  }

  function inRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
  }

  function inDiamond(px, py, cx, cy, half) {
    return Math.abs(px - cx) + Math.abs(py - cy) <= half;
  }

  function aabbOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function formatTimer(s) {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return m + ":" + (ss < 10 ? "0" : "") + ss;
  }

  function formatScore(n) {
    return String(Math.max(0, Math.floor(n))).padStart(7, "0");
  }

  function pxText(text, x, y, size, color, align = "left", baseline = "top", withShadow = true) {
    ctx.imageSmoothingEnabled = false;
    ctx.font = `${size}px ${PF}`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (withShadow) {
      ctx.fillStyle = "#000000";
      ctx.fillText(text, x + 2, y + 2);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawBevelBtn(x, y, w, h, hover = false) {
    ctx.fillStyle = CRIMSON_DK;
    ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.fillStyle = hover ? "#e53935" : CRIMSON_LT;
    ctx.fillRect(x, y, w, 3);
    ctx.fillRect(x, y, 3, h);
    ctx.fillStyle = hover ? CRIMSON_LT : CRIMSON;
    ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    ctx.fillStyle = CRIMSON_DK;
    ctx.fillRect(x + w - 3, y, 3, h);
    ctx.fillRect(x, y + h - 3, w, 3);
  }

  function drawDiamondPath(cx, cy, h) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - h);
    ctx.lineTo(cx + h, cy);
    ctx.lineTo(cx, cy + h);
    ctx.lineTo(cx - h, cy);
    ctx.closePath();
  }

  function drawDiamond(cx, cy, half, fill, border) {
    ctx.fillStyle = border;
    drawDiamondPath(cx, cy, half + 5);
    ctx.fill();
    ctx.fillStyle = fill;
    drawDiamondPath(cx, cy, half);
    ctx.fill();
  }

  function drawSegmentedBar(x, y, w, h, pct, dir = "ltr") {
    const segs = 20;
    const gap = 2;
    const segW = (w - (segs - 1) * gap) / segs;
    const filled = Math.ceil(pct * segs);

    for (let i = 0; i < segs; i++) {
      const idx = dir === "rtl" ? segs - 1 - i : i;
      const sx = x + idx * (segW + gap);
      if (i < filled) {
        const t = i / segs;
        ctx.fillStyle = lerpColor("#ffd600", "#ff1744", t);
      } else {
        ctx.fillStyle = "#1a162b";
      }
      ctx.fillRect(sx, y, segW, h);
    }

    ctx.strokeStyle = "#433a65";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
  }

  /* ================================================================
     STAGE BACKGROUND: 16-BIT TWILIGHT SKYLINE & NEON STREET
     ================================================================ */
  let cityCanvas = null;

  function buildCityStage() {
    cityCanvas = document.createElement("canvas");
    cityCanvas.width = WIDTH;
    cityCanvas.height = HEIGHT;
    const c = cityCanvas.getContext("2d");
    c.imageSmoothingEnabled = false;

    // Twilight gradient sky
    const skyGrad = c.createLinearGradient(0, 0, 0, 500);
    skyGrad.addColorStop(0, "#08061a");
    skyGrad.addColorStop(0.35, "#15103a");
    skyGrad.addColorStop(0.7, "#281552");
    skyGrad.addColorStop(1, "#180c30");
    c.fillStyle = skyGrad;
    c.fillRect(0, 0, WIDTH, 500);

    c.fillStyle = "#070512";
    c.fillRect(0, 500, WIDTH, 220);

    // Stars
    for (let i = 0; i < 75; i++) {
      const sx = (i * 293 + 19) % WIDTH;
      const sy = (i * 179 + 11) % 320;
      const sr = (i % 3 === 0) ? 2 : 1;
      c.fillStyle = `rgba(215, 195, 255, ${0.2 + (i % 5) * 0.12})`;
      c.fillRect(sx, sy, sr, sr);
    }

    // Glowing Moon
    c.fillStyle = "rgba(255, 230, 200, 0.12)";
    c.beginPath();
    c.arc(1060, 90, 48, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(255, 255, 255, 0.08)";
    c.beginPath();
    c.arc(1060, 90, 36, 0, Math.PI * 2);
    c.fill();

    // Distant skyline buildings
    const farCols = ["#0e0c1f", "#110f25", "#14112c"];
    let bx = -10;
    for (let i = 0; i < 22; i++) {
      const bw = 48 + ((i * 37) % 55);
      const bh = 100 + ((i * 71) % 150);
      c.fillStyle = farCols[i % 3];
      c.fillRect(bx, 460 - bh, bw, bh + 40);
      bx += bw + ((i * 11) % 10);
    }

    // Midground brick buildings with lit windows
    const midCols = ["#16132f", "#1c1839", "#201b42"];
    bx = -15;
    for (let i = 0; i < 15; i++) {
      const bw = 65 + ((i * 41) % 70);
      const bh = 140 + ((i * 67) % 180);
      const by = 470 - bh;
      c.fillStyle = midCols[i % 3];
      c.fillRect(bx, by, bw, bh + 30);

      // Window grid
      const wRows = Math.floor(bh / 24);
      const wCols = Math.floor(bw / 18);
      for (let wr = 0; wr < wRows; wr++) {
        for (let wc = 0; wc < wCols; wc++) {
          if ((wr * 7 + wc * 13 + i) % 3 === 0) {
            c.fillStyle = `rgba(255, 225, 120, ${0.25 + ((wr + wc) % 3) * 0.15})`;
          } else {
            c.fillStyle = "rgba(40, 32, 65, 0.6)";
          }
          c.fillRect(bx + 6 + wc * 18, by + 8 + wr * 24, 10, 14);
        }
      }

      // Vertical Glowing Neon Signs
      if (i % 3 === 1) {
        const neons = [
          { text: "ARCADE", col: "#00e5ff" },
          { text: "BAR",    col: "#ff007f" },
          { text: "RUNE",   col: "#ffd600" },
          { text: "FIGHT",  col: "#d500f9" }
        ];
        const n = neons[i % neons.length];
        const nx = bx + Math.floor(bw / 2) - 10;
        const ny = by + 20;

        c.fillStyle = "#0c0a1a";
        c.fillRect(nx - 2, ny - 4, 24, n.text.length * 15 + 8);
        c.strokeStyle = n.col;
        c.lineWidth = 1;
        c.strokeRect(nx - 2, ny - 4, 24, n.text.length * 15 + 8);

        c.save();
        c.shadowColor = n.col;
        c.shadowBlur = 10;
        c.fillStyle = n.col;
        c.font = `9px ${PF}`;
        c.textAlign = "center";
        for (let ch = 0; ch < n.text.length; ch++) {
          c.fillText(n.text[ch], nx + 10, ny + ch * 15 + 10);
        }
        c.restore();
      }

      bx += bw + ((i * 17) % 18);
    }

    // Streetlamps
    c.fillStyle = "#221c3d";
    c.fillRect(170, 350, 4, 110);
    c.fillRect(166, 345, 12, 6);
    c.fillStyle = "rgba(255, 210, 120, 0.22)";
    c.beginPath();
    c.arc(172, 348, 26, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = "#221c3d";
    c.fillRect(1090, 360, 4, 100);
    c.fillRect(1086, 355, 12, 6);
    c.fillStyle = "rgba(255, 210, 120, 0.22)";
    c.beginPath();
    c.arc(1092, 358, 26, 0, Math.PI * 2);
    c.fill();
  }
  buildCityStage();

  /* ================================================================
     CRT TV BEZEL & SCANLINES
     ================================================================ */
  function drawScanlines() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    for (let y = 0; y < HEIGHT; y += 3) {
      ctx.fillRect(0, y, WIDTH, 1);
    }
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(
      WIDTH / 2, HEIGHT / 2, HEIGHT * 0.35,
      WIDTH / 2, HEIGHT / 2, HEIGHT * 0.82
    );
    g.addColorStop(0, "rgba(0, 0, 0, 0)");
    g.addColorStop(1, "rgba(0, 0, 0, 0.5)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function drawCRTBezel() {
    const b = 14;
    ctx.fillStyle = "#0a0a0e";
    ctx.fillRect(0, 0, WIDTH, b);
    ctx.fillRect(0, HEIGHT - b, WIDTH, b);
    ctx.fillRect(0, 0, b, HEIGHT);
    ctx.fillRect(WIDTH - b, 0, b, HEIGHT);

    ctx.fillStyle = "#1e1b2e";
    ctx.fillRect(b, b, WIDTH - b * 2, 2);
    ctx.fillRect(b, b, 2, HEIGHT - b * 2);
    ctx.fillStyle = "#0c0a14";
    ctx.fillRect(b, HEIGHT - b - 2, WIDTH - b * 2, 2);
    ctx.fillRect(WIDTH - b - 2, b, 2, HEIGHT - b * 2);
  }

  /* ================================================================
     START SCREEN PARTICLES
     ================================================================ */
  const clouds = [];
  const dust = [];

  function initStartParticles() {
    clouds.length = 0;
    dust.length = 0;
    for (let i = 0; i < 6; i++) {
      clouds.push({
        x: Math.random() * WIDTH,
        y: 80 + Math.random() * 160,
        w: 130 + Math.random() * 170,
        h: 26 + Math.random() * 30,
        sp: 16 + Math.random() * 24,
        a: 0.35 + Math.random() * 0.3
      });
    }
    for (let i = 0; i < 40; i++) {
      dust.push(createDustParticle());
    }
  }

  function createDustParticle() {
    return {
      x: WIDTH / 2 - 130 + Math.random() * 260,
      y: HEIGHT - 8 - Math.random() * 30,
      vx: (Math.random() - 0.5) * 35,
      vy: -(26 + Math.random() * 55),
      sz: 4 + Math.random() * 8,
      a: 0.55 + Math.random() * 0.35
    };
  }

  initStartParticles();

  /* ================================================================
     KINETIC RUNE SPELL ENTITY
     ================================================================ */
  class KineticRune {
    constructor(caster, x, y, dirX, dirY) {
      this.caster = caster;
      this.x = x;
      this.y = y;
      this.dirX = dirX;
      this.dirY = dirY;
      this.size = 16;
      this.visualSize = 18;
      this.rotation = Math.PI / 4;
      this.active = true;
    }

    update(dt) {
      this.x += this.dirX * SPELL_VELOCITY * dt;
      this.y += this.dirY * SPELL_VELOCITY * dt;
      this.rotation += 12.0 * dt;

      if (
        this.x < -60 || this.x > WIDTH + 60 ||
        this.y < -60 || this.y > HEIGHT + 60
      ) {
        this.active = false;
      }
    }

    getBounds() {
      const half = this.size / 2;
      return {
        left: this.x - half,
        right: this.x + half,
        top: this.y - half,
        bottom: this.y + half
      };
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.shadowColor = "#d500f9";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#d500f9";
      ctx.fillRect(-this.visualSize / 2, -this.visualSize / 2, this.visualSize, this.visualSize);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#f3e5f5";
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
  }

  /* ================================================================
     RUNE SLINGER (FIGHTER) ENTITY
     ================================================================ */
  class RuneSlinger {
    constructor(config) {
      this.pNum = config.pNum;
      this.fighterIdx = config.fighterIdx;
      this.spawnX = config.spawnX;
      this.spawnY = config.spawnY;
      this.initialFacing = config.initialFacing;
      this.controls = config.controls;

      this.width = 36;
      this.height = 44;
      this.displayHeight = 92; // 2x crisp pixel scaling

      this.reset();
    }

    reset() {
      this.x = this.spawnX;
      this.y = this.spawnY;
      this.vx = 0;
      this.vy = 0;
      this.kineticMomentumX = 0;
      this.destabilizeFactor = 1.0;
      this.facingX = this.initialFacing;
      this.onFloor = false;
      this.graceJumpTimer = 0;
      this.spellCooldown = 0;
      this.scaleX = 1.0;
      this.scaleY = 1.0;
      this.aimX = this.initialFacing;
      this.aimY = 0;
      this.hitFlashTimer = 0;
      this.isKO = false;
    }

    isActionDown(action) {
      return this.controls[action].some((c) => keysDown.has(c));
    }

    isActionJustPressed(action) {
      return this.controls[action].some((c) => keysJust.has(c));
    }

    update(dt, runes) {
      if (this.isKO) return;

      this.spellCooldown = Math.max(0, this.spellCooldown - dt);
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);

      // Coyote Time & Gravity
      if (this.onFloor) {
        this.graceJumpTimer = 0.10;
      } else {
        this.graceJumpTimer -= dt;
        this.vy += WORLD_GRAVITY * dt;
      }

      // Leap (Jump)
      if (this.isActionJustPressed("leap") && this.graceJumpTimer > 0) {
        this.vy = LEAP_IMPULSE;
        this.onFloor = false;
        this.graceJumpTimer = 0;
        this.animateSquash(0.82, 1.22);
        if (sfxOn) audio.jump();
      }

      // Horizontal Stride
      const west = this.isActionDown("west") ? 1 : 0;
      const east = this.isActionDown("east") ? 1 : 0;
      const dirInput = east - west;

      if (dirInput !== 0) {
        this.facingX = Math.sign(dirInput);
      }

      // Aiming: Downward for Aether-Vault, else horizontal facing direction
      if (this.isActionDown("focusDown")) {
        this.aimX = 0;
        this.aimY = 1;
      } else {
        this.aimX = this.facingX;
        this.aimY = 0;
      }

      this.vx = dirInput * STRIDE_SPEED + this.kineticMomentumX;

      // Momentum Decay
      const decayStep = MOMENTUM_DECAY * dt;
      if (Math.abs(this.kineticMomentumX) <= decayStep) {
        this.kineticMomentumX = 0;
      } else {
        this.kineticMomentumX -= Math.sign(this.kineticMomentumX) * decayStep;
      }

      // Cast Kinetic Rune
      if (this.isActionJustPressed("cast") && this.spellCooldown <= 0) {
        this.unleashRune(runes);
        this.spellCooldown = CAST_DELAY;
      }

      // Collision Resolution
      this.moveAndCollide(dt);

      // Squash/Stretch Decay
      const lerpFactor = Math.min(1, 15.0 * dt);
      this.scaleX += (1.0 - this.scaleX) * lerpFactor;
      this.scaleY += (1.0 - this.scaleY) * lerpFactor;
    }

    moveAndCollide(dt) {
      const halfW = this.width / 2;
      const halfH = this.height / 2;

      // Horizontal step
      this.x += this.vx * dt;

      if (
        this.y + halfH > MONOLITH.y &&
        this.y - halfH < MONOLITH.y + MONOLITH.height
      ) {
        if (
          this.vx > 0 &&
          this.x + halfW > MONOLITH.x &&
          this.x - halfW < MONOLITH.x
        ) {
          this.x = MONOLITH.x - halfW;
          this.vx = 0;
          this.kineticMomentumX = 0;
        } else if (
          this.vx < 0 &&
          this.x - halfW < MONOLITH.x + MONOLITH.width &&
          this.x + halfW > MONOLITH.x + MONOLITH.width
        ) {
          this.x = MONOLITH.x + MONOLITH.width + halfW;
          this.vx = 0;
          this.kineticMomentumX = 0;
        }
      }

      // Vertical step
      const prevBottom = this.y + halfH;
      this.y += this.vy * dt;
      this.onFloor = false;

      const withinX =
        this.x + halfW > MONOLITH.x &&
        this.x - halfW < MONOLITH.x + MONOLITH.width;

      if (withinX) {
        // Landing on top
        if (
          this.vy >= 0 &&
          prevBottom <= MONOLITH.y + 8 &&
          this.y + halfH >= MONOLITH.y
        ) {
          this.y = MONOLITH.y - halfH;
          this.vy = 0;
          this.onFloor = true;
        }
        // Hitting underside
        else if (
          this.vy < 0 &&
          this.y - halfH <= MONOLITH.y + MONOLITH.height &&
          this.y + halfH > MONOLITH.y + MONOLITH.height
        ) {
          this.y = MONOLITH.y + MONOLITH.height + halfH;
          this.vy = 0;
        }
      }
    }

    unleashRune(runes) {
      const spawnOffset = 38.0;
      const rune = new KineticRune(
        this,
        this.x + this.aimX * spawnOffset,
        this.y + this.aimY * spawnOffset,
        this.aimX,
        this.aimY
      );
      runes.push(rune);

      this.kineticMomentumX -= this.aimX * VAULT_RECOIL;

      if (this.aimY === 1) {
        this.vy = -VAULT_RECOIL * 1.85;
        this.onFloor = false;
        this.animateSquash(1.28, 0.72);
        if (sfxOn) audio.vault();
      } else {
        if (sfxOn) audio.cast();
      }
    }

    absorbSpellImpact(dirX, dirY, baseForce) {
      this.kineticMomentumX = dirX * baseForce * this.destabilizeFactor;
      this.vy = -255.0;
      this.onFloor = false;
      this.destabilizeFactor += 0.25;
      this.animateSquash(0.72, 1.28);
      this.hitFlashTimer = 0.18;
      screenShake = 7;
      if (sfxOn) audio.hit();
    }

    animateSquash(sx, sy) {
      this.scaleX = sx;
      this.scaleY = sy;
    }

    getBounds() {
      const halfW = this.width / 2;
      const halfH = this.height / 2;
      return {
        left: this.x - halfW,
        right: this.x + halfW,
        top: this.y - halfH,
        bottom: this.y + halfH
      };
    }

    draw() {
      ctx.save();
      ctx.imageSmoothingEnabled = false;

      const halfH = this.height / 2;
      const fDef = FIGHTERS[this.fighterIdx];
      const img = fighterImages[this.fighterIdx];

      // Anchor sprite bottom precisely at feet (this.y + halfH)
      ctx.translate(this.x, this.y + halfH);
      ctx.scale(this.scaleX * (this.facingX < 0 ? -1 : 1), this.scaleY);

      if (img && img.complete && img.naturalWidth > 0) {
        const targetH = this.displayHeight;
        const targetW = Math.round(targetH * (img.naturalWidth / img.naturalHeight));

        ctx.drawImage(img, -targetW / 2, -targetH, targetW, targetH);

        // Hit flash overlay
        if (this.hitFlashTimer > 0) {
          ctx.globalCompositeOperation = "source-atop";
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, this.hitFlashTimer * 6)})`;
          ctx.fillRect(-targetW / 2, -targetH, targetW, targetH);
          ctx.globalCompositeOperation = "source-over";
        }

        // Knockback heat tint (shifts toward glowing magenta #ff4081)
        const overload = (this.destabilizeFactor - 1.0) / 2.5;
        if (overload > 0.04) {
          ctx.globalCompositeOperation = "source-atop";
          ctx.fillStyle = `rgba(255, 64, 129, ${Math.min(0.55, overload * 0.45)})`;
          ctx.fillRect(-targetW / 2, -targetH, targetW, targetH);
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        // Crisp vector fallback
        const overload = (this.destabilizeFactor - 1.0) / 2.5;
        ctx.fillStyle = lerpColor(fDef.color, MAGENTA, overload);
        ctx.fillRect(-this.width / 2, -this.height, this.width, this.height);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.width / 2, -this.height, this.width, this.height);
      }

      ctx.restore();

      // Focus Aim Indicator Orb
      ctx.save();
      let orbX = this.x + (this.facingX > 0 ? 32 : -32);
      let orbY = this.y - 6;
      if (this.aimY === 1) {
        orbX = this.x;
        orbY = this.y + 36;
      }
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 8;
      ctx.fillRect(orbX - 4, orbY - 4, 8, 8);
      ctx.restore();
    }
  }

  /* ================================================================
     MATCH SPAWNING & RESET
     ================================================================ */
  let sage1 = null;
  let sage2 = null;
  let sages = [];
  let runes = [];

  function spawnFighters() {
    sage1 = new RuneSlinger({
      pNum: 1,
      fighterIdx: p1Sel,
      spawnX: 400,
      spawnY: 380,
      initialFacing: 1,
      controls: {
        west: ["KeyA"],
        east: ["KeyD"],
        leap: ["KeyW"],
        focusDown: ["KeyS"],
        cast: ["KeyF", "Space"]
      }
    });

    sage2 = new RuneSlinger({
      pNum: 2,
      fighterIdx: p2Sel,
      spawnX: 880,
      spawnY: 380,
      initialFacing: -1,
      controls: {
        west: ["ArrowLeft"],
        east: ["ArrowRight"],
        leap: ["ArrowUp"],
        focusDown: ["ArrowDown"],
        cast: ["KeyK", "Enter"]
      }
    });

    sages = [sage1, sage2];
    runes = [];
  }

  function resetRound() {
    runes = [];
    if (sage1) sage1.reset();
    if (sage2) sage2.reset();
    roundTimer = ROUND_TIME;
    fightPhase = FP.COUNTDOWN;
    countdownT = 2.4;
    roundEndT = 0;
    roundWinner = 0;
    roundReason = "";
    screenShake = 0;
    if (sfxOn) audio.roundStart();
  }

  /* ================================================================
     SCREEN 1: START SCREEN
     ================================================================ */
  function updateTitle(dt) {
    for (const c of clouds) {
      c.x += c.sp * dt;
      if (c.x > WIDTH + 60) c.x = -c.w - 30;
    }

    for (const d of dust) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.a -= 0.28 * dt;
      if (d.a <= 0 || d.y < HEIGHT * 0.52) {
        Object.assign(d, createDustParticle());
      }
    }

    if (mClick && !helpOpen) {
      // START Diamond button
      if (inDiamond(mX, mY, WIDTH / 2, 535, 52)) {
        if (sfxOn) audio.lockIn();
        gameState = S.SELECT;
        p1Lock = false;
        p2Lock = false;
        selTimer = 0;
        return;
      }

      // BGM toggle button
      if (inRect(mX, mY, 32, 548, 54, 54)) {
        bgmOn = !bgmOn;
        audio.setBGM(bgmOn);
        if (sfxOn) audio.blip();
      }

      // SFX toggle button
      if (inRect(mX, mY, 32, 612, 54, 54)) {
        sfxOn = !sfxOn;
        audio.setSFX(sfxOn);
        if (sfxOn) audio.blip();
      }

      // Help Modal button (?)
      if (inRect(mX, mY, WIDTH - 86, 580, 54, 54)) {
        helpOpen = true;
        if (sfxOn) audio.blip();
      }
    }

    if (helpOpen && mClick) {
      if (!inRect(mX, mY, WIDTH / 2 - 290, HEIGHT / 2 - 210, 580, 420)) {
        helpOpen = false;
        if (sfxOn) audio.blip();
      }
    }

    if (keysJust.has("Escape")) {
      helpOpen = false;
    }

    if ((keysJust.has("Enter") || keysJust.has("Space")) && !helpOpen) {
      if (sfxOn) audio.lockIn();
      gameState = S.SELECT;
      p1Lock = false;
      p2Lock = false;
      selTimer = 0;
    }
  }

  function renderTitle() {
    ctx.imageSmoothingEnabled = false;

    // Retro teal sky
    ctx.fillStyle = TEAL;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Dark teal angular mountains
    ctx.fillStyle = TEAL_DARK;
    for (let i = 0; i < 14; i++) {
      const bx = i * 110 - 50;
      const bh = 110 + ((i * 53) % 110);
      ctx.beginPath();
      ctx.moveTo(bx, 480);
      ctx.lineTo(bx + 55, 480 - bh);
      ctx.lineTo(bx + 110, 480);
      ctx.closePath();
      ctx.fill();
    }

    // Geometric Diamond Accents behind logo
    ctx.save();
    ctx.fillStyle = "rgba(11, 70, 73, 0.45)";
    for (let i = 0; i < 7; i++) {
      const dx = WIDTH / 2 - 390 + i * 130;
      const dy = 210;
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-36, -36, 72, 72);
      ctx.restore();
    }
    ctx.restore();

    // Drifting clouds
    for (const c of clouds) {
      ctx.fillStyle = `rgba(255, 255, 255, ${c.a})`;
      ctx.fillRect(c.x, c.y, c.w, c.h * 0.55);
      ctx.fillRect(c.x + c.w * 0.12, c.y - c.h * 0.35, c.w * 0.28, c.h * 0.45);
      ctx.fillRect(c.x + c.w * 0.38, c.y - c.h * 0.5, c.w * 0.32, c.h * 0.55);
      ctx.fillRect(c.x + c.w * 0.68, c.y - c.h * 0.2, c.w * 0.22, c.h * 0.32);
    }

    // Dust plumes
    for (const d of dust) {
      if (d.a > 0) {
        ctx.fillStyle = `rgba(235, 215, 185, ${d.a.toFixed(2)})`;
        ctx.fillRect(d.x, d.y, d.sz, d.sz);
      }
    }

    // --- MASSIVE JAGGED GRAFFITI LOGO ---
    ctx.save();
    const cx = WIDTH / 2;

    // Dark maroon jagged explosive backing
    ctx.fillStyle = CRIMSON_DK;
    ctx.beginPath();
    const jaggedPts = [
      [-380, 110], [-260, 80], [-180, 50], [0, 40], [180, 50], [270, 80], [380, 110],
      [340, 170], [390, 230], [330, 280], [280, 310], [120, 305], [0, 315], [-120, 305],
      [-280, 310], [-340, 270], [-390, 220], [-340, 160]
    ];
    ctx.moveTo(cx + jaggedPts[0][0], jaggedPts[0][1]);
    for (let p = 1; p < jaggedPts.length; p++) {
      ctx.lineTo(cx + jaggedPts[p][0], jaggedPts[p][1]);
    }
    ctx.closePath();
    ctx.fill();

    ctx.font = `52px ${PF}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 3D Drop-extrusion
    ctx.fillStyle = "#ff6f00";
    for (let d = 1; d <= 6; d++) {
      ctx.fillText("AETHER", cx, 155 + d);
      ctx.fillText("CLASH", cx, 225 + d);
    }

    // Black jagged outline
    ctx.fillStyle = "#000000";
    for (let ox = -4; ox <= 4; ox++) {
      for (let oy = -4; oy <= 4; oy++) {
        if (Math.abs(ox) + Math.abs(oy) > 5) continue;
        ctx.fillText("AETHER", cx + ox, 155 + oy);
        ctx.fillText("CLASH", cx + ox, 225 + oy);
      }
    }

    // Golden yellow fill
    ctx.fillStyle = GOLD_BR;
    ctx.fillText("AETHER", cx, 155);
    ctx.fillText("CLASH", cx, 225);

    // Pixel highlight
    ctx.fillStyle = GOLD_PALE;
    ctx.globalAlpha = 0.35;
    ctx.fillText("AETHER", cx, 153);
    ctx.fillText("CLASH", cx, 223);
    ctx.globalAlpha = 1.0;
    ctx.restore();

    // Subtitle
    pxText("16-BIT RUNE SLINGERS", WIDTH / 2, 280, 13, GOLD, "center");

    // --- DIAMOND START BUTTON ---
    const sc = WIDTH / 2, sy = 535, sh = 52;
    const sHov = inDiamond(mX, mY, sc, sy, sh);
    drawDiamond(sc, sy, sh, sHov ? "#d32f2f" : CRIMSON, CRIMSON_DK);

    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    drawDiamondPath(sc, sy, sh - 6);
    ctx.stroke();

    pxText("◀", sc - sh - 20, sy - 7, 13, "#ffffff", "center", "top", false);
    pxText("▶", sc + sh + 20, sy - 7, 13, "#ffffff", "center", "top", false);
    pxText("START", sc, sy - 7, 15, "#ffffff", "center");

    // --- CREDITS BANNER (ENLARGED RETRO ARCADE TYPOGRAPHY) ---
    const credSize = 13;
    ctx.font = `${credSize}px ${PF}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    // Line 1: Made and Developed By: Rudra Pathak
    const credL1 = "Made and Developed By: ";
    const credB1 = "Rudra Pathak";
    const wL1 = ctx.measureText(credL1).width;
    const wB1 = ctx.measureText(credB1).width;
    const x1 = Math.round((WIDTH - (wL1 + wB1)) / 2);
    const y1 = 612;

    // Shadow
    ctx.fillStyle = "#000000";
    ctx.fillText(credL1, x1 + 2, y1 + 2);
    ctx.fillText(credB1, x1 + wL1 + 2, y1 + 2);
    ctx.fillText(credB1, x1 + wL1 + 3, y1 + 2);

    // Text & Bold Double-Pass
    ctx.fillStyle = "#e0f7fa";
    ctx.fillText(credL1, x1, y1);
    ctx.fillStyle = GOLD_BR;
    ctx.fillText(credB1, x1 + wL1, y1);
    ctx.fillText(credB1, x1 + wL1 + 1, y1);
    ctx.fillText(credB1, x1 + wL1 + 2, y1); // Heavy bold pixel stroke

    // Line 2: Project Idea: HackClub Haven Chd
    const credL2 = "Project Idea: ";
    const credB2 = "HackClub Haven Chd";
    const wL2 = ctx.measureText(credL2).width;
    const wB2 = ctx.measureText(credB2).width;
    const x2 = Math.round((WIDTH - (wL2 + wB2)) / 2);
    const y2 = 644;

    // Shadow
    ctx.fillStyle = "#000000";
    ctx.fillText(credL2, x2 + 2, y2 + 2);
    ctx.fillText(credB2, x2 + wL2 + 2, y2 + 2);
    ctx.fillText(credB2, x2 + wL2 + 3, y2 + 2);

    // Text & Bold Double-Pass
    ctx.fillStyle = "#e0f7fa";
    ctx.fillText(credL2, x2, y2);
    ctx.fillStyle = GOLD_BR;
    ctx.fillText(credB2, x2 + wL2, y2);
    ctx.fillText(credB2, x2 + wL2 + 1, y2);
    ctx.fillText(credB2, x2 + wL2 + 2, y2); // Heavy bold pixel stroke

    // --- SOUND BUTTONS ---
    const bgmHov = inRect(mX, mY, 32, 548, 54, 54);
    drawBevelBtn(32, 548, 54, 54, bgmHov);
    drawMusicNoteIcon(32, 548, 54);
    if (!bgmOn) {
      ctx.strokeStyle = "#ff1744";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(38, 554);
      ctx.lineTo(80, 596);
      ctx.stroke();
    }

    const sfxHov = inRect(mX, mY, 32, 612, 54, 54);
    drawBevelBtn(32, 612, 54, 54, sfxHov);
    drawSpeakerIcon(32, 612, 54);
    if (!sfxOn) {
      ctx.strokeStyle = "#ff1744";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(38, 618);
      ctx.lineTo(80, 660);
      ctx.stroke();
    }

    // --- HELP BUTTON ---
    const helpHov = inRect(mX, mY, WIDTH - 86, 580, 54, 54);
    drawBevelBtn(WIDTH - 86, 580, 54, 54, helpHov);
    pxText("?", WIDTH - 59, 593, 24, "#ffffff", "center");

    // --- HELP MODAL ---
    if (helpOpen) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const mx = WIDTH / 2 - 290;
      const my = HEIGHT / 2 - 210;
      const mw = 580;
      const mh = 420;

      ctx.fillStyle = CRIMSON_DK;
      ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
      ctx.fillStyle = "#0c0a1a";
      ctx.fillRect(mx, my, mw, mh);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2;
      ctx.strokeRect(mx + 4, my + 4, mw - 8, mh - 8);

      pxText("HOW TO PLAY", WIDTH / 2, my + 18, 16, GOLD_BR, "center");

      const col1 = mx + 30;
      const col2 = mx + 310;

      pxText("PLAYER 1 (WASD)", col1, my + 60, 10, "#00b0ff");
      pxText("MOVE:  A / D", col1, my + 85, 9, "#cccccc");
      pxText("JUMP:  W", col1, my + 105, 9, "#cccccc");
      pxText("AIM DOWN:  S", col1, my + 125, 9, "#cccccc");
      pxText("CAST:  F or SPACE", col1, my + 145, 9, "#cccccc");

      pxText("PLAYER 2 (ARROWS)", col2, my + 60, 10, GOLD);
      pxText("MOVE:  ◀ / ▶", col2, my + 85, 9, "#cccccc");
      pxText("JUMP:  ▲", col2, my + 105, 9, "#cccccc");
      pxText("AIM DOWN:  ▼", col2, my + 125, 9, "#cccccc");
      pxText("CAST:  K or ENTER", col2, my + 145, 9, "#cccccc");

      pxText("AETHER-VAULT RECOVERY", WIDTH / 2, my + 195, 10, MAGENTA, "center");
      pxText("HOLD DOWN + CAST IN MID-AIR TO FIRE DOWN", WIDTH / 2, my + 218, 8, "#ffffff", "center");
      pxText("AND ROCKET BACK ONTO THE MONOLITH!", WIDTH / 2, my + 236, 8, "#ffffff", "center");

      pxText("NO HEALTH BARS! KNOCK ENEMIES INTO ABYSS!", WIDTH / 2, my + 280, 8, GOLD_BR, "center");
      pxText("EACH HIT MULTIPLIES KNOCKBACK FORCE!", WIDTH / 2, my + 300, 8, "#ff80ab", "center");
      pxText("MANUAL RESET: R", WIDTH / 2, my + 335, 9, "#aaaaaa", "center");

      pxText("CLICK OUTSIDE OR PRESS ESC TO CLOSE", WIDTH / 2, my + 380, 8, "#666666", "center");
    }
  }

  function drawMusicNoteIcon(x, y, s) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + s * 0.62, y + s * 0.18, s * 0.08, s * 0.52);
    ctx.fillRect(x + s * 0.36, y + s * 0.58, s * 0.34, s * 0.2);
    ctx.fillRect(x + s * 0.62, y + s * 0.18, s * 0.24, s * 0.08);
    ctx.fillRect(x + s * 0.78, y + s * 0.18, s * 0.08, s * 0.2);
  }

  function drawSpeakerIcon(x, y, s) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + s * 0.2, y + s * 0.35, s * 0.2, s * 0.3);
    ctx.beginPath();
    ctx.moveTo(x + s * 0.4, y + s * 0.25);
    ctx.lineTo(x + s * 0.6, y + s * 0.15);
    ctx.lineTo(x + s * 0.6, y + s * 0.85);
    ctx.lineTo(x + s * 0.4, y + s * 0.75);
    ctx.closePath();
    ctx.fill();

    if (sfxOn) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + s * 0.7, y + s * 0.5, s * 0.12, -0.6, 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + s * 0.7, y + s * 0.5, s * 0.22, -0.5, 0.5);
      ctx.stroke();
    }
  }

  /* ================================================================
     SCREEN 2: CHARACTER SELECT SCREEN
     ================================================================ */
  function updateSelect(dt) {
    // P1 Navigation
    if (!p1Lock) {
      if (keysJust.has("KeyD")) {
        p1Sel = (p1Sel + 1) % FIGHTERS.length;
        if (sfxOn) audio.blip();
      }
      if (keysJust.has("KeyA")) {
        p1Sel = (p1Sel - 1 + FIGHTERS.length) % FIGHTERS.length;
        if (sfxOn) audio.blip();
      }
    }
    if (keysJust.has("KeyF") || keysJust.has("Space")) {
      p1Lock = !p1Lock;
      if (sfxOn) audio.lockIn();
    }

    // P2 Navigation
    if (!p2Lock) {
      if (keysJust.has("ArrowRight")) {
        p2Sel = (p2Sel + 1) % FIGHTERS.length;
        if (sfxOn) audio.blip();
      }
      if (keysJust.has("ArrowLeft")) {
        p2Sel = (p2Sel - 1 + FIGHTERS.length) % FIGHTERS.length;
        if (sfxOn) audio.blip();
      }
    }
    if (keysJust.has("KeyK") || keysJust.has("Enter")) {
      p2Lock = !p2Lock;
      if (sfxOn) audio.lockIn();
    }

    // Mouse support for 4 cards
    if (mClick) {
      const cardW = 200;
      const cardH = 200;
      const gap = 36;
      const totalW = FIGHTERS.length * cardW + (FIGHTERS.length - 1) * gap;
      const startX = (WIDTH - totalW) / 2;
      const gridY = 100;

      for (let i = 0; i < FIGHTERS.length; i++) {
        const cx = startX + i * (cardW + gap);
        if (inRect(mX, mY, cx, gridY, cardW, cardH)) {
          if (!p1Lock) {
            p1Sel = i;
            if (sfxOn) audio.blip();
          } else if (!p2Lock) {
            p2Sel = i;
            if (sfxOn) audio.blip();
          }
          break;
        }
      }
    }

    if (p1Lock && p2Lock) {
      selTimer += dt;
      if (selTimer > 1.2) {
        p1Wins = 0;
        p2Wins = 0;
        p1Score = 0;
        p2Score = 0;
        roundNum = 1;
        spawnFighters();
        resetRound();
        gameState = S.FIGHT;
      }
    } else {
      selTimer = 0;
    }

    if (keysJust.has("Escape")) {
      gameState = S.TITLE;
      if (sfxOn) audio.blip();
    }
  }

  function renderSelect() {
    ctx.imageSmoothingEnabled = false;

    // Grid backdrop
    ctx.fillStyle = "#0c0a20";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.strokeStyle = "rgba(213, 0, 249, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x < WIDTH; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke();
    }
    for (let y = 0; y < HEIGHT; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke();
    }

    pxText("SELECT YOUR FIGHTER", WIDTH / 2, 32, 22, GOLD_BR, "center");

    // 4-Card Hero Grid
    const cardW = 200;
    const cardH = 200;
    const gap = 36;
    const totalW = FIGHTERS.length * cardW + (FIGHTERS.length - 1) * gap;
    const startX = (WIDTH - totalW) / 2;
    const gridY = 95;

    for (let i = 0; i < FIGHTERS.length; i++) {
      const f = FIGHTERS[i];
      const img = fighterImages[i];
      const fx = startX + i * (cardW + gap);
      const fy = gridY;

      // Card Box
      ctx.fillStyle = "#14122d";
      ctx.fillRect(fx, fy, cardW, cardH);
      ctx.strokeStyle = "#322960";
      ctx.lineWidth = 2;
      ctx.strokeRect(fx, fy, cardW, cardH);

      // Character Sprite
      if (img && img.complete && img.naturalWidth > 0) {
        const dh = 126;
        const dw = Math.round(dh * (img.naturalWidth / img.naturalHeight));
        ctx.drawImage(img, fx + (cardW - dw) / 2, fy + 12, dw, dh);
      } else {
        ctx.fillStyle = f.color;
        ctx.fillRect(fx + 60, fy + 30, 80, 100);
      }

      // Fighter Name & Archetype
      pxText(f.name, fx + cardW / 2, fy + cardH - 42, 11, "#ffffff", "center");
      pxText(f.desc, fx + cardW / 2, fy + cardH - 22, 8, "#8888bb", "center");

      // Player 1 Cursor (Cyan)
      if (i === p1Sel) {
        const pulse = 0.65 + 0.35 * Math.sin(globalTime * 8);
        ctx.strokeStyle = `rgba(0, 176, 255, ${pulse})`;
        ctx.lineWidth = 4;
        ctx.strokeRect(fx - 4, fy - 4, cardW + 8, cardH + 8);
        if (p1Lock) {
          ctx.fillStyle = "rgba(0, 176, 255, 0.22)";
          ctx.fillRect(fx, fy, cardW, cardH);
        }
        pxText("P1", fx + 8, fy + 8, 10, "#00b0ff");
      }

      // Player 2 Cursor (Gold)
      if (i === p2Sel) {
        const pulse = 0.65 + 0.35 * Math.sin(globalTime * 8 + 2.5);
        ctx.strokeStyle = `rgba(255, 171, 0, ${pulse})`;
        ctx.lineWidth = 4;
        ctx.strokeRect(fx - 6, fy - 6, cardW + 12, cardH + 12);
        if (p2Lock) {
          ctx.fillStyle = "rgba(255, 171, 0, 0.22)";
          ctx.fillRect(fx, fy, cardW, cardH);
        }
        pxText("P2", fx + cardW - 32, fy + 8, 10, GOLD);
      }
    }

    // Enlarged Previews
    const prevW = 220;
    const prevH = 240;

    // P1 Preview (Left)
    const p1X = 140;
    const p1Y = 360;
    ctx.fillStyle = "#100d27";
    ctx.fillRect(p1X, p1Y, prevW, prevH);
    ctx.strokeStyle = "#00b0ff";
    ctx.lineWidth = 3;
    ctx.strokeRect(p1X, p1Y, prevW, prevH);

    const f1 = FIGHTERS[p1Sel];
    const img1 = fighterImages[p1Sel];
    if (img1 && img1.complete && img1.naturalWidth > 0) {
      const dh1 = 165;
      const dw1 = Math.round(dh1 * (img1.naturalWidth / img1.naturalHeight));
      ctx.drawImage(img1, p1X + (prevW - dw1) / 2, p1Y + 14, dw1, dh1);
    }
    pxText(f1.name, p1X + prevW / 2, p1Y + prevH - 46, 13, "#00b0ff", "center");
    pxText(p1Lock ? "READY!" : "F / SPACE TO LOCK", p1X + prevW / 2, p1Y + prevH - 22, 8, p1Lock ? "#00e676" : "#888888", "center");

    // P2 Preview (Right)
    const p2X = WIDTH - 140 - prevW;
    const p2Y = 360;
    ctx.fillStyle = "#100d27";
    ctx.fillRect(p2X, p2Y, prevW, prevH);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 3;
    ctx.strokeRect(p2X, p2Y, prevW, prevH);

    const f2 = FIGHTERS[p2Sel];
    const img2 = fighterImages[p2Sel];
    if (img2 && img2.complete && img2.naturalWidth > 0) {
      const dh2 = 165;
      const dw2 = Math.round(dh2 * (img2.naturalWidth / img2.naturalHeight));
      ctx.save();
      ctx.translate(p2X + prevW / 2, p2Y + 14);
      ctx.scale(-1, 1);
      ctx.drawImage(img2, -dw2 / 2, 0, dw2, dh2);
      ctx.restore();
    }
    pxText(f2.name, p2X + prevW / 2, p2Y + prevH - 46, 13, GOLD, "center");
    pxText(p2Lock ? "READY!" : "K / ENTER TO LOCK", p2X + prevW / 2, p2Y + prevH - 22, 8, p2Lock ? "#00e676" : "#888888", "center");

    // VS Center Emblem
    if (p1Lock && p2Lock) {
      const flash = Math.sin(globalTime * 14) > 0;
      pxText("VS", WIDTH / 2, 440, 44, flash ? "#ffffff" : GOLD_BR, "center");
      pxText("GET READY!", WIDTH / 2, 520, 14, "#00e676", "center");
    } else {
      pxText("VS", WIDTH / 2, 440, 38, "#3a3459", "center");
    }

    // Bottom Navigation Hint
    pxText("P1: A/D (MOVE) + F (LOCK)  |  P2: ◀/▶ (MOVE) + K (LOCK)", WIDTH / 2, HEIGHT - 46, 9, "#777799", "center");
    pxText("PRESS ESC TO RETURN TO TITLE", WIDTH / 2, HEIGHT - 24, 8, "#555577", "center");
  }

  /* ================================================================
     SCREEN 3: FIGHTING ARENA & CRT ARCADE HUD
     ================================================================ */
  function updateFight(dt) {
    if (fightPhase === FP.COUNTDOWN) {
      countdownT -= dt;
      if (countdownT <= 0) {
        fightPhase = FP.ACTIVE;
      }
      return;
    }

    if (fightPhase === FP.ROUND_END) {
      roundEndT -= dt;
      if (roundEndT <= 0) {
        if (p1Wins >= WINS_TO_MATCH || p2Wins >= WINS_TO_MATCH) {
          gameState = S.RESULT;
          if (sfxOn) audio.victoryFanfare();
        } else {
          roundNum++;
          resetRound();
        }
      }
      return;
    }

    // Active Fight Update
    roundTimer -= dt;

    for (const s of sages) {
      s.update(dt, runes);
    }

    // Update Kinetic Runes & Collisions
    for (const rune of runes) {
      if (!rune.active) continue;
      rune.update(dt);
      if (!rune.active) continue;

      const rBounds = rune.getBounds();
      for (const target of sages) {
        if (target === rune.caster) continue;
        if (aabbOverlap(rBounds, target.getBounds())) {
          target.absorbSpellImpact(rune.dirX, rune.dirY, ARCANE_KNOCKBACK);
          rune.active = false;

          // Award 10,000 pts per hit
          if (rune.caster === sage1) {
            p1Score += 10000;
          } else {
            p2Score += 10000;
          }
          break;
        }
      }
    }
    runes = runes.filter((r) => r.active);

    // Abyss Ring-Out Check (y > 920)
    if (sage1.y > ABYSS_Y) {
      sage1.isKO = true;
      p2Score += 50000;
      handleRoundVictory(2, "RING OUT!");
    } else if (sage2.y > ABYSS_Y) {
      sage2.isKO = true;
      p1Score += 50000;
      handleRoundVictory(1, "RING OUT!");
    }

    // Time Up Condition
    if (roundTimer <= 0) {
      roundTimer = 0;
      if (sage1.destabilizeFactor < sage2.destabilizeFactor) {
        sage2.isKO = true;
        handleRoundVictory(1, "TIME UP!");
      } else if (sage2.destabilizeFactor < sage1.destabilizeFactor) {
        sage1.isKO = true;
        handleRoundVictory(2, "TIME UP!");
      } else {
        handleRoundVictory(0, "DRAW!");
      }
    }

    // Manual Arena Reset (KeyR)
    if (keysJust.has("KeyR")) {
      resetRound();
    }
  }

  function handleRoundVictory(winner, reason) {
    roundWinner = winner;
    roundReason = reason;
    if (winner === 1) p1Wins++;
    if (winner === 2) p2Wins++;

    fightPhase = FP.ROUND_END;
    roundEndT = 3.2;
    screenShake = 12;
    if (sfxOn) audio.ringOut();
  }

  function renderFight() {
    ctx.imageSmoothingEnabled = false;
    ctx.save();

    // Screen Shake
    if (screenShake > 0.1) {
      const sx = (Math.random() - 0.5) * screenShake;
      const sy = (Math.random() - 0.5) * screenShake;
      ctx.translate(sx, sy);
      screenShake *= 0.91;
    }

    // Twilight City Stage
    if (cityCanvas) {
      ctx.drawImage(cityCanvas, 0, 0);
    }

    // Suspended Stone Monolith Platform
    ctx.fillStyle = "#2c254a";
    ctx.fillRect(MONOLITH.x - 4, MONOLITH.y + 4, MONOLITH.width + 8, MONOLITH.height + 6);
    ctx.fillStyle = MONOLITH.bodyColor;
    ctx.fillRect(MONOLITH.x, MONOLITH.y, MONOLITH.width, MONOLITH.height);

    // Brick texture
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    for (let bx = MONOLITH.x; bx < MONOLITH.x + MONOLITH.width; bx += 26) {
      ctx.fillRect(bx, MONOLITH.y + 7, 24, 12);
      ctx.fillRect(bx + 13, MONOLITH.y + 21, 24, 12);
    }

    // Glowing Purple Rune Trim
    ctx.save();
    ctx.shadowColor = MONOLITH.trimColor;
    ctx.shadowBlur = 14;
    ctx.fillStyle = MONOLITH.trimColor;
    ctx.fillRect(MONOLITH.x, MONOLITH.y, MONOLITH.width, MONOLITH.trimHeight);
    ctx.restore();

    // Kinetic Runes
    for (const rune of runes) {
      rune.draw();
    }

    // Fighters
    for (const s of sages) {
      s.draw();
    }

    ctx.restore();

    // Arcade HUD Elements
    renderTopHUD();
    renderBottomHUD();

    // Countdown / Round End Overlay
    if (fightPhase === FP.COUNTDOWN) {
      const count = Math.ceil(countdownT);
      if (count > 0 && countdownT > 0.35) {
        pxText(`ROUND ${roundNum}`, WIDTH / 2, 280, 22, GOLD_BR, "center");
        pxText(String(count), WIDTH / 2, 330, 48, "#ffffff", "center");
      } else {
        pxText("FIGHT!", WIDTH / 2, 305, 38, "#ff1744", "center");
      }
    }

    if (fightPhase === FP.ROUND_END) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.fillRect(0, 210, WIDTH, 240);

      pxText(roundReason, WIDTH / 2, 240, 32, GOLD_BR, "center");
      if (roundWinner > 0) {
        const wName = roundWinner === 1 ? FIGHTERS[p1Sel].name : FIGHTERS[p2Sel].name;
        const wCol = roundWinner === 1 ? "#00b0ff" : GOLD;
        pxText(`PLAYER ${roundWinner} (${wName}) WINS!`, WIDTH / 2, 295, 14, wCol, "center");
      } else {
        pxText("DRAW MATCH!", WIDTH / 2, 295, 14, "#cccccc", "center");
      }
      pxText(`WINS:  ${p1Wins}  —  ${p2Wins}`, WIDTH / 2, 340, 11, "#ffffff", "center");
    }

    // CRT TV Effects
    drawScanlines();
    drawVignette();
    drawCRTBezel();
  }

  function renderTopHUD() {
    ctx.fillStyle = "rgba(10, 8, 24, 0.88)";
    ctx.fillRect(16, 16, WIDTH - 32, 68);
    ctx.strokeStyle = "#38305c";
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, WIDTH - 32, 68);

    // --- P1 TOP HUD (LEFT) ---
    const p1px = 24;
    const p1py = 22;

    ctx.fillStyle = "#15122e";
    ctx.fillRect(p1px, p1py, 56, 56);
    ctx.strokeStyle = "#00b0ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(p1px, p1py, 56, 56);

    const f1 = FIGHTERS[p1Sel];
    const img1 = fighterImages[p1Sel];
    if (img1 && img1.complete && img1.naturalWidth > 0) {
      const ph = 50;
      const pw = Math.round(ph * (img1.naturalWidth / img1.naturalHeight));
      ctx.drawImage(img1, p1px + (56 - pw) / 2, p1py + 3, pw, ph);
    }

    // [L] Badge
    ctx.fillStyle = "#00b0ff";
    ctx.fillRect(p1px + 62, p1py, 22, 16);
    pxText("L", p1px + 66, p1py + 3, 9, "#000000", "left", "top", false);

    pxText(f1.name, p1px + 90, p1py + 3, 10, GOLD_BR);
    pxText(`WINS: ${p1Wins}`, p1px + 90, p1py + 20, 8, "#aaaaaa");

    // Knockback Instability Bar
    const barW = 210;
    const barH = 14;
    const p1Pct = Math.min(1.0, (sage1 ? sage1.destabilizeFactor - 1.0 : 0) / 2.5);
    drawSegmentedBar(p1px + 90, p1py + 38, barW, barH, p1Pct, "ltr");
    const p1Disp = sage1 ? Math.round((sage1.destabilizeFactor - 1.0) * 100) : 0;
    pxText(`${p1Disp}%`, p1px + 90 + barW + 8, p1py + 39, 9, lerpColor("#ffd600", "#ff1744", p1Pct));

    // --- CENTER BOXED DIGITAL TIMER ---
    const tBoxW = 90;
    const tBoxH = 40;
    const tBoxX = WIDTH / 2 - tBoxW / 2;
    const tBoxY = 20;

    ctx.fillStyle = "#080614";
    ctx.fillRect(tBoxX, tBoxY, tBoxW, tBoxH);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.strokeRect(tBoxX, tBoxY, tBoxW, tBoxH);

    const timerColor = roundTimer <= 10 ? "#ff1744" : "#ffffff";
    pxText(formatTimer(roundTimer), WIDTH / 2, tBoxY + 7, 16, timerColor, "center");
    pxText(`ROUND ${roundNum}`, WIDTH / 2, tBoxY + 44, 9, GOLD, "center");

    // --- P2 TOP HUD (RIGHT) ---
    const p2px = WIDTH - 80;
    const p2py = 22;

    ctx.fillStyle = "#15122e";
    ctx.fillRect(p2px, p2py, 56, 56);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.strokeRect(p2px, p2py, 56, 56);

    const f2 = FIGHTERS[p2Sel];
    const img2 = fighterImages[p2Sel];
    if (img2 && img2.complete && img2.naturalWidth > 0) {
      const ph = 50;
      const pw = Math.round(ph * (img2.naturalWidth / img2.naturalHeight));
      ctx.save();
      ctx.translate(p2px + 28, p2py + 3);
      ctx.scale(-1, 1);
      ctx.drawImage(img2, -pw / 2, 0, pw, ph);
      ctx.restore();
    }

    // [R] Badge
    ctx.fillStyle = GOLD;
    ctx.fillRect(p2px - 26, p2py, 22, 16);
    pxText("R", p2px - 22, p2py + 3, 9, "#000000", "left", "top", false);

    pxText(f2.name, p2px - 32, p2py + 3, 10, GOLD_BR, "right");
    pxText(`WINS: ${p2Wins}`, p2px - 32, p2py + 20, 8, "#aaaaaa", "right");

    // Knockback Instability Bar (RTL)
    const p2Pct = Math.min(1.0, (sage2 ? sage2.destabilizeFactor - 1.0 : 0) / 2.5);
    drawSegmentedBar(p2px - 32 - barW, p2py + 38, barW, barH, p2Pct, "rtl");
    const p2Disp = sage2 ? Math.round((sage2.destabilizeFactor - 1.0) * 100) : 0;
    pxText(`${p2Disp}%`, p2px - 32 - barW - 44, p2py + 39, 9, lerpColor("#ffd600", "#ff1744", p2Pct));
  }

  function renderBottomHUD() {
    const bottomY = HEIGHT - 82;
    ctx.fillStyle = "rgba(10, 8, 24, 0.88)";
    ctx.fillRect(16, bottomY, WIDTH - 32, 66);
    ctx.strokeStyle = "#38305c";
    ctx.lineWidth = 2;
    ctx.strokeRect(16, bottomY, WIDTH - 32, 66);

    const py = bottomY + 10;

    // --- P1 COMMAND PANEL (LEFT) ---
    pxText("P1", 28, py, 9, "#00b0ff");

    const v1 = sage1 ? Math.max(0, 1.0 - sage1.spellCooldown / CAST_DELAY) : 1.0;
    pxText("VAULT:", 54, py, 8, "#aaaaaa");
    ctx.fillStyle = "#161329";
    ctx.fillRect(116, py, 80, 10);
    ctx.fillStyle = v1 >= 1.0 ? "#00e676" : "#ff9100";
    ctx.fillRect(116, py, 80 * v1, 10);
    ctx.strokeStyle = "#443a6d";
    ctx.lineWidth = 1;
    ctx.strokeRect(116, py, 80, 10);
    pxText(`${Math.round(v1 * 100)}%`, 204, py, 7, "#cccccc");

    pxText("◀▶ + [F]  SHOT", 28, py + 18, 7, "#8888aa");
    pxText("▼  + [F]  AETHER-VAULT", 28, py + 32, 7, MAGENTA);

    // --- P2 COMMAND PANEL (RIGHT) ---
    pxText("P2", WIDTH - 46, py, 9, GOLD, "right");

    const v2 = sage2 ? Math.max(0, 1.0 - sage2.spellCooldown / CAST_DELAY) : 1.0;
    pxText("VAULT:", WIDTH - 240, py, 8, "#aaaaaa");
    ctx.fillStyle = "#161329";
    ctx.fillRect(WIDTH - 180, py, 80, 10);
    ctx.fillStyle = v2 >= 1.0 ? "#00e676" : "#ff9100";
    ctx.fillRect(WIDTH - 180, py, 80 * v2, 10);
    ctx.strokeStyle = "#443a6d";
    ctx.lineWidth = 1;
    ctx.strokeRect(WIDTH - 180, py, 80, 10);
    pxText(`${Math.round(v2 * 100)}%`, WIDTH - 94, py, 7, "#cccccc");

    pxText("[K] + ◀▶  SHOT", WIDTH - 28, py + 18, 7, "#8888aa", "right");
    pxText("[K] + ▼  AETHER-VAULT", WIDTH - 28, py + 32, 7, MAGENTA, "right");

    // --- CENTER STACKED 7-DIGIT ARCADE SCORES ---
    ctx.fillStyle = "rgba(5, 4, 15, 0.65)";
    ctx.fillRect(WIDTH / 2 - 170, py - 3, 340, 48);
    ctx.strokeStyle = "#433a69";
    ctx.lineWidth = 1;
    ctx.strokeRect(WIDTH / 2 - 170, py - 3, 340, 48);

    pxText(`P1 SCORE: ${formatScore(p1Score)}`, WIDTH / 2, py + 4, 9, "#ffd600", "center");
    pxText(`P2 SCORE: ${formatScore(p2Score)}`, WIDTH / 2, py + 26, 9, "#ff4444", "center");
  }

  /* ================================================================
     SCREEN 4: ROUND RESULTS & REPLAY SCREEN
     ================================================================ */
  function updateResult(dt) {
    if (mClick) {
      if (inRect(mX, mY, WIDTH / 2 - 200, 485, 170, 52)) {
        if (sfxOn) audio.lockIn();
        p1Wins = 0;
        p2Wins = 0;
        p1Score = 0;
        p2Score = 0;
        roundNum = 1;
        spawnFighters();
        resetRound();
        gameState = S.FIGHT;
        return;
      }

      if (inRect(mX, mY, WIDTH / 2 + 30, 485, 200, 52)) {
        if (sfxOn) audio.lockIn();
        p1Lock = false;
        p2Lock = false;
        gameState = S.SELECT;
        return;
      }
    }

    if (keysJust.has("KeyR")) {
      if (sfxOn) audio.lockIn();
      p1Wins = 0;
      p2Wins = 0;
      p1Score = 0;
      p2Score = 0;
      roundNum = 1;
      spawnFighters();
      resetRound();
      gameState = S.FIGHT;
    }

    if (keysJust.has("Escape")) {
      if (sfxOn) audio.blip();
      p1Lock = false;
      p2Lock = false;
      gameState = S.SELECT;
    }
  }

  function renderResult() {
    ctx.imageSmoothingEnabled = false;

    if (cityCanvas) {
      ctx.globalAlpha = 0.3;
      ctx.drawImage(cityCanvas, 0, 0);
      ctx.globalAlpha = 1.0;
    }
    ctx.fillStyle = "rgba(7, 5, 18, 0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const matchWinner = p1Wins >= WINS_TO_MATCH ? 1 : 2;
    const wName = matchWinner === 1 ? FIGHTERS[p1Sel].name : FIGHTERS[p2Sel].name;
    const wCol = matchWinner === 1 ? "#00b0ff" : GOLD;
    const lSel = matchWinner === 1 ? p2Sel : p1Sel;
    const lDef = FIGHTERS[lSel];

    const panelW = 760;
    const panelH = 340;
    const px = WIDTH / 2 - panelW / 2;
    const py = 110;

    ctx.fillStyle = CRIMSON_DK;
    ctx.fillRect(px, py, panelW, panelH);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 3;
    ctx.strokeRect(px + 4, py + 4, panelW - 8, panelH - 8);

    // K.O.! Banner
    ctx.save();
    ctx.font = `44px ${PF}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "#000000";
    for (let ox = -4; ox <= 4; ox++) {
      for (let oy = -4; oy <= 4; oy++) {
        ctx.fillText("K.O.!", WIDTH / 2 + ox, py + 52 + oy);
      }
    }
    ctx.fillStyle = GOLD_BR;
    ctx.fillText("K.O.!", WIDTH / 2, py + 52);
    ctx.restore();

    pxText(`PLAYER ${matchWinner}  (${wName})`, WIDTH / 2, py + 92, 14, wCol, "center");
    pxText("WINS THE MATCH!", WIDTH / 2, py + 116, 16, "#ffffff", "center");

    // Final Scores
    pxText("FINAL ARCADE SCORES", WIDTH / 2, py + 155, 10, GOLD, "center");
    pxText(`P1: ${formatScore(p1Score)}`, WIDTH / 2 - 100, py + 180, 10, "#ffd600", "center");
    pxText(`P2: ${formatScore(p2Score)}`, WIDTH / 2 + 100, py + 180, 10, "#ff4444", "center");
    pxText(`MATCH SCORE:  ${p1Wins}  —  ${p2Wins}`, WIDTH / 2, py + 210, 10, "#ffffff", "center");

    // Winner Stance
    const wImg = fighterImages[matchWinner === 1 ? p1Sel : p2Sel];
    if (wImg && wImg.complete && wImg.naturalWidth > 0) {
      const wh = 90;
      const ww = Math.round(wh * (wImg.naturalWidth / wImg.naturalHeight));
      ctx.drawImage(wImg, WIDTH / 2 - 140, py + 235, ww, wh);
    }

    // Defeated Fighter Display
    const lImg = fighterImages[lSel];
    if (lImg && lImg.complete && lImg.naturalWidth > 0) {
      const lh = 75;
      const lw = Math.round(lh * (lImg.naturalWidth / lImg.naturalHeight));
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.drawImage(lImg, WIDTH / 2 + 50, py + 245, lw, lh);
      ctx.restore();
      pxText("DEFEATED", WIDTH / 2 + 50 + lw / 2, py + 320, 8, "#ff5252", "center");
    }

    // Interactive Buttons
    const remHov = inRect(mX, mY, WIDTH / 2 - 200, 485, 170, 52);
    drawBevelBtn(WIDTH / 2 - 200, 485, 170, 52, remHov);
    pxText("REMATCH", WIDTH / 2 - 115, 502, 11, "#ffffff", "center");

    const chgHov = inRect(mX, mY, WIDTH / 2 + 30, 485, 200, 52);
    drawBevelBtn(WIDTH / 2 + 30, 485, 200, 52, chgHov);
    pxText("CHANGE", WIDTH / 2 + 130, 496, 9, "#ffffff", "center");
    pxText("FIGHTER", WIDTH / 2 + 130, 514, 9, "#ffffff", "center");

    pxText("R: REMATCH  |  ESC: CHARACTER SELECT", WIDTH / 2, HEIGHT - 36, 8, "#777799", "center");

    // CRT Effects
    drawScanlines();
    drawVignette();
    drawCRTBezel();
  }

  /* ================================================================
     MAIN LOOP
     ================================================================ */
  let lastTimestamp = performance.now();

  function gameLoop(now) {
    const dt = Math.min((now - lastTimestamp) / 1000, 0.05);
    lastTimestamp = now;
    globalTime += dt;

    ctx.imageSmoothingEnabled = false;

    switch (gameState) {
      case S.TITLE:
        updateTitle(dt);
        renderTitle();
        break;
      case S.SELECT:
        updateSelect(dt);
        renderSelect();
        break;
      case S.FIGHT:
        updateFight(dt);
        renderFight();
        break;
      case S.RESULT:
        updateResult(dt);
        renderResult();
        break;
    }

    keysJust.clear();
    mClick = false;
    requestAnimationFrame(gameLoop);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      requestAnimationFrame(gameLoop);
    });
  } else {
    requestAnimationFrame(gameLoop);
  }
})();
