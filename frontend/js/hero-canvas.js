/* =====================================================
   FitTrack AI — hero-canvas.js  (Refined / Subtle)
   Elegant floating dots + constellation + cursor glow
   ===================================================== */
(function () {
  'use strict';

  const canvas = document.createElement('canvas');
  canvas.id = 'heroCanvas';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');

  const cursorGlow = document.createElement('div');
  cursorGlow.id = 'cursorGlow';
  document.body.prepend(cursorGlow);

  let W = window.innerWidth, H = window.innerHeight;
  let mouseX = W / 2, mouseY = H / 2;
  let targetX = W / 2, targetY = H / 2;
  let frame = 0;

  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  window.addEventListener('mousemove', e => {
    targetX = e.clientX; targetY = e.clientY;
    cursorGlow.style.left = e.clientX + 'px';
    cursorGlow.style.top  = e.clientY + 'px';
  });
  window.addEventListener('touchmove', e => {
    if (e.touches[0]) {
      targetX = e.touches[0].clientX; targetY = e.touches[0].clientY;
    }
  }, { passive: true });

  function rgba(r,g,b,a) { return `rgba(${r},${g},${b},${a})`; }

  /* ── Blobs: slower, fewer, more subdued ── */
  const BLOBS = [
    { ax:0.78, ay:0.28, r:380, cr:124, cg:58,  cb:237, speed:0.010, parallax:0.028, phase:0   },
    { ax:0.12, ay:0.70, r:300, cr:6,   cg:182, cb:212, speed:0.012, parallax:0.018, phase:2.1 },
    { ax:0.88, ay:0.72, r:220, cr:16,  cg:185, cb:129, speed:0.016, parallax:0.032, phase:4.3 },
    { ax:0.42, ay:0.12, r:180, cr:167, cg:139, cb:250, speed:0.009, parallax:0.015, phase:1.5 },
  ];

  BLOBS.forEach(b => { b.cx = b.ax * W; b.cy = b.ay * H; });

  function drawBlobs(t) {
    BLOBS.forEach(b => {
      const dx = (mouseX / W - 0.5) * b.parallax * W;
      const dy = (mouseY / H - 0.5) * b.parallax * H;
      const fx = Math.sin(t * b.speed + b.phase) * 50;
      const fy = Math.cos(t * b.speed * 0.7 + b.phase) * 35;
      b.cx = b.ax * W + dx + fx;
      b.cy = b.ay * H + dy + fy;

      const pr = b.r + Math.sin(t * 0.025 + b.phase) * 18;
      const g  = ctx.createRadialGradient(b.cx, b.cy, 0, b.cx, b.cy, pr);
      g.addColorStop(0,   rgba(b.cr,b.cg,b.cb, 0.13));
      g.addColorStop(0.5, rgba(b.cr,b.cg,b.cb, 0.05));
      g.addColorStop(1,   rgba(b.cr,b.cg,b.cb, 0));
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, pr, 0, Math.PI*2);
      ctx.fillStyle = g;
      ctx.fill();
    });
  }

  /* ── Particles: dots only, fewer, refined ── */
  const COLORS = [
    [124,58,237],[167,139,250],[6,182,212],[16,185,129],[236,72,153],[245,158,11]
  ];

  class Dot {
    constructor() { this.reset(true); }
    reset(init) {
      this.x  = Math.random() * W;
      this.y  = init ? Math.random() * H : H + 10;
      this.r  = 1.2 + Math.random() * 2.2;
      this.vx = (Math.random() - 0.5) * 0.25;
      this.vy = -(0.18 + Math.random() * 0.32);
      this.alpha = 0;
      this.maxAlpha = 0.3 + Math.random() * 0.35;
      this.parallax = 0.008 + Math.random() * 0.018;
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.alpha < this.maxAlpha) this.alpha = Math.min(this.maxAlpha, this.alpha + 0.002);

      // Cursor repulsion
      const pdx = (mouseX/W - 0.5)*this.parallax*80;
      const pdy = (mouseY/H - 0.5)*this.parallax*50;
      const cx  = this.x + pdx;
      const cy  = this.y + pdy;
      const dist = Math.hypot(cx - mouseX, cy - mouseY);
      if (dist < 90) {
        const f = (90 - dist) / 90 * 0.6;
        this.x += (cx - mouseX) / dist * f;
        this.y += (cy - mouseY) / dist * f;
      }
      this.drawX = this.x + pdx;
      this.drawY = this.y + pdy;

      if (this.y < -20 || this.x < -30 || this.x > W + 30) this.reset(false);
    }
    draw() {
      const [r,g,b] = this.color;
      // Glow
      const gl = ctx.createRadialGradient(this.drawX,this.drawY,0,this.drawX,this.drawY,this.r*4);
      gl.addColorStop(0, rgba(r,g,b,this.alpha*0.8));
      gl.addColorStop(1, rgba(r,g,b,0));
      ctx.beginPath();
      ctx.arc(this.drawX,this.drawY,this.r*4,0,Math.PI*2);
      ctx.fillStyle = gl;
      ctx.fill();
      // Core
      ctx.beginPath();
      ctx.arc(this.drawX,this.drawY,this.r,0,Math.PI*2);
      ctx.fillStyle = rgba(r,g,b,this.alpha);
      ctx.fill();
    }
  }

  const dots = Array.from({ length: 35 }, () => new Dot());

  /* ── Constellation ── */
  function drawConstellation() {
    for (let i = 0; i < dots.length; i++) {
      for (let j = i+1; j < dots.length; j++) {
        const dist = Math.hypot(dots[i].drawX-dots[j].drawX, dots[i].drawY-dots[j].drawY);
        if (dist < 140) {
          ctx.beginPath();
          ctx.moveTo(dots[i].drawX, dots[i].drawY);
          ctx.lineTo(dots[j].drawX, dots[j].drawY);
          ctx.strokeStyle = `rgba(124,58,237,${(1 - dist/140)*0.07})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  /* ── Grid ── */
  function drawGrid() {
    const sp = 70;
    const ox = ((mouseX/W - 0.5)*15 % sp + sp) % sp;
    const oy = ((mouseY/H - 0.5)*15 % sp + sp) % sp;
    ctx.fillStyle = 'rgba(124,58,237,0.04)';
    for (let x = ox; x < W; x += sp)
      for (let y = oy; y < H; y += sp) {
        ctx.beginPath(); ctx.arc(x,y,1,0,Math.PI*2); ctx.fill();
      }
  }

  /* ── Cursor light ── */
  function drawCursorLight() {
    const g = ctx.createRadialGradient(mouseX,mouseY,0,mouseX,mouseY,200);
    g.addColorStop(0,  'rgba(124,58,237,0.05)');
    g.addColorStop(0.5,'rgba(6,182,212,0.02)');
    g.addColorStop(1,  'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(mouseX,mouseY,200,0,Math.PI*2);
    ctx.fillStyle = g; ctx.fill();
  }

  /* ── Main loop ── */
  function animate(ts) {
    frame = ts;
    mouseX += (targetX - mouseX) * 0.055;
    mouseY += (targetY - mouseY) * 0.055;

    ctx.clearRect(0,0,W,H);

    // Deep dark background
    const bg = ctx.createLinearGradient(0,0,W,H);
    bg.addColorStop(0, '#050510');
    bg.addColorStop(0.5, '#070714');
    bg.addColorStop(1, '#040410');
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,W,H);

    drawGrid();
    drawBlobs(frame*0.001);
    drawCursorLight();
    drawConstellation();
    dots.forEach(d => { d.update(); d.draw(); });

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
})();
