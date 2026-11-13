/**
 * UNSAID renderer — cream paper, typewriter ink, burning words.
 */
(function (root) {
  const Render = {
    canv: null,
    ctx: null,
    dpr: 1,
    w: 0,
    h: 0,
    cellW: 0,
    cellH: 0,
    ox: 0,
    oy: 0,
    particles: [],
    scorches: [],
    paper: null,
    fontReady: false,
    stage: { x: 0, y: 0, w: 0, h: 0 },
  };

  const INK = '#1a140e';
  const PAPER = '#ead9b4';
  const SCORCH = '#5a2a0e';

  Render.init = function (canvas) {
    Render.canv = canvas;
    Render.ctx = canvas.getContext('2d');
    if (document.fonts && document.fonts.load) {
      Promise.all([
        document.fonts.load('16px "Courier Prime"'),
        document.fonts.load('bold 22px "Courier Prime"'),
      ]).then(() => { Render.fontReady = true; }).catch(() => { Render.fontReady = true; });
    } else {
      Render.fontReady = true;
    }
  };

  Render.resize = function (cssW, cssH) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    Render.dpr = dpr;
    Render.w = cssW;
    Render.h = cssH;
    Render.canv.width = Math.round(cssW * dpr);
    Render.canv.height = Math.round(cssH * dpr);
    Render.canv.style.width = cssW + 'px';
    Render.canv.style.height = cssH + 'px';
    Render.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Render.paper = null;
  };

  function makePaper(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.floor(w));
    c.height = Math.max(2, Math.floor(h));
    const ctx = c.getContext('2d');
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, c.width, c.height);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 22;
      d[i] = Math.max(0, Math.min(255, d[i] + n - 2));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n - 6));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n - 14));
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = 'rgba(80,50,20,0.03)';
    ctx.lineWidth = 1;
    for (let y = 0; y < c.height; y += 7) {
      ctx.beginPath();
      ctx.moveTo(0, y + Math.random());
      ctx.lineTo(c.width, y + Math.random() * 2);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.2, c.width / 2, c.height / 2, c.height * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(80,50,20,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  Render.layout = function (level, stage, camera) {
    Render.stage = stage;
    const maxWord = Math.max(4, level.maxLen || 4);
    const fitW = stage.w / level.width;
    const fitH = stage.h / level.height;
    // Prefer showing the whole room. 28px still fits WALL/DOOR at 2x.
    const minFit = 24;
    let cw, ch;
    if (fitW >= minFit) {
      cw = fitW;
      ch = Math.max(36, Math.min(Math.floor(fitH), Math.max(36, Math.round(cw * 0.9))));
      // Keep a typed-line feeling for very short maps, but give words room.
      if (level.height <= 4) ch = Math.max(36, Math.min(ch, 48));
    } else {
      cw = Math.max(36, Math.min(54, maxWord * 10));
      ch = Math.max(36, Math.floor(cw * 0.7));
    }
    Render.cellW = cw;
    Render.cellH = ch;
    const gw = cw * level.width;
    const gh = ch * level.height;
    let ox = stage.x + Math.floor((stage.w - gw) / 2);
    let oy = stage.y + Math.floor((stage.h - gh) / 2);
    if (camera) {
      if (gw > stage.w + 0.5) {
        ox = Math.round(stage.x + stage.w / 2 - (camera.x + 0.5) * cw);
        ox = Math.min(stage.x, Math.max(stage.x + stage.w - gw, ox));
      }
      if (gh > stage.h + 0.5) {
        oy = Math.round(stage.y + stage.h / 2 - (camera.y + 0.5) * ch);
        oy = Math.min(stage.y, Math.max(stage.y + stage.h - gh, oy));
      }
    }
    Render.ox = ox;
    Render.oy = oy;
  };

  Render.cellCenter = function (x, y) {
    return {
      x: Render.ox + (x + 0.5) * Render.cellW,
      y: Render.oy + (y + 0.5) * Render.cellH,
    };
  };

  Render.screenToGrid = function (sx, sy, level) {
    const x = Math.floor((sx - Render.ox) / Render.cellW);
    const y = Math.floor((sy - Render.oy) / Render.cellH);
    if (!level || x < 0 || y < 0 || x >= level.width || y >= level.height) return null;
    return { x, y };
  };

  Render.burst = function (x, y, color, n, life) {
    const count = n || 22;
    const lifeMax = life || 70;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 24 + Math.random() * 90;
      Render.particles.push({
        x, y,
        vx: Math.cos(a) * s * 0.012,
        vy: Math.sin(a) * s * 0.012 - 0.18,
        life: lifeMax,
        max: lifeMax,
        color: color || (Math.random() < 0.55 ? '#e25822' : '#1a140e'),
        r: 1.2 + Math.random() * 2.6,
      });
    }
  };

  Render.scorchAt = function (x, y) {
    const p = Render.cellCenter(x, y);
    Render.scorches.push({ x: p.x, y: p.y, life: 160, max: 160 });
  };

  Render.tickParticles = function (dt) {
    const arr = Render.particles;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life -= dt * 0.05;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.0008 * dt;
      if (p.life <= 0) arr.splice(i, 1);
    }
    const sc = Render.scorches;
    for (let i = sc.length - 1; i >= 0; i--) {
      sc[i].life -= dt * 0.025;
      if (sc[i].life <= 0) sc.splice(i, 1);
    }
  };

  function font(size, bold) {
    return (bold ? 'bold ' : '') + size + 'px "Courier Prime", "Courier New", Courier, monospace';
  }

  Render.draw = function (frame) {
    const ctx = Render.ctx;
    const w = Render.w;
    const h = Render.h;
    if (!Render.paper || Render.paper.width !== Math.floor(w) || Render.paper.height !== Math.floor(h)) {
      Render.paper = makePaper(w, h);
    }
    ctx.drawImage(Render.paper, 0, 0, w, h);

    if (frame.level) {
      const st = Render.stage || { x: 0, y: 0, w: w, h: h };
      ctx.save();
      ctx.beginPath();
      ctx.rect(st.x, st.y, st.w, st.h);
      ctx.clip();
      drawRoom(ctx, frame);
      for (const s of Render.scorches) {
        ctx.globalAlpha = 0.28 * (s.life / s.max);
        ctx.fillStyle = '#4a1c0c';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, Render.cellW * 0.4, Render.cellH * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const p of Render.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  };

  function drawRoom(ctx, frame) {
    const level = frame.level;
    const state = frame.state;
    const preview = frame.preview || [];
    const previewSet = new Set(preview.map((c) => c.x + ',' + c.y));
    const cw = Render.cellW;
    const ch = Render.cellH;
    const fs = Math.max(11, Math.min(20, Math.floor(cw / (level.maxLen * 0.62))));

    ctx.strokeStyle = 'rgba(26,20,14,0.04)';
    ctx.lineWidth = 1;
    for (let y = 0; y <= level.height; y++) {
      const yy = Render.oy + y * ch + 0.5;
      ctx.beginPath();
      ctx.moveTo(Render.ox, yy);
      ctx.lineTo(Render.ox + level.width * cw, yy);
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        const word = state.grid[y][x] || '';
        const px = Render.ox + x * cw;
        const py = Render.oy + y * ch;
        const cx = px + cw / 2;
        const cy = py + ch / 2;
        const isPreview = previewSet.has(x + ',' + y);

        if (word === 'PAGE') {
          ctx.fillStyle = 'rgba(80,50,20,0.08)';
          ctx.fillRect(px, py, cw, ch);
          continue;
        }

        if (isPreview) {
          ctx.fillStyle = 'rgba(180, 40, 10, 0.16)';
          ctx.fillRect(px + 1, py + 1, cw - 2, ch - 2);
        }

        if (word === 'WATER') {
          ctx.fillStyle = 'rgba(40, 70, 90, 0.1)';
          ctx.fillRect(px + 2, py + 2, cw - 4, ch - 4);
        }

        if (word === 'DOOR' || word === 'LATER' || word === 'DOORWAY') {
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.2;
          ctx.strokeRect(px + 4, py + 4, cw - 8, ch - 8);
        }

        if (word) {
          const wfs = word.length > 5 ? Math.max(11, fs - 2) : fs;
          ctx.font = font(wfs, false);
          ctx.fillStyle = isPreview ? SCORCH : INK;
          if (word === 'WATER') ctx.fillStyle = isPreview ? SCORCH : '#24343c';
          ctx.fillText(word, cx, cy + 0.5);
        }
      }
    }

    const gx = frame.playerDraw ? frame.playerDraw.x : state.x;
    const gy = frame.playerDraw ? frame.playerDraw.y : state.y;
    const p = {
      x: Render.ox + (gx + 0.5) * Render.cellW,
      y: Render.oy + (gy + 0.5) * Render.cellH,
    };
    ctx.font = font(Math.max(fs + 4, 16), true);
    ctx.fillStyle = INK;
    ctx.fillText('ME', p.x, p.y + 0.5);

    if (frame.pathDots) {
      ctx.fillStyle = 'rgba(26,20,14,0.35)';
      frame.pathDots.forEach((pt, i) => {
        const c = Render.cellCenter(pt.x, pt.y);
        const blink = 0.35 + 0.35 * Math.sin((frame.time || 0) * 0.006 + i * 0.7);
        ctx.globalAlpha = blink;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    if (frame.demoDraw) {
      const d = frame.demoDraw;
      const c = Render.cellCenter(d.x, d.y);
      ctx.globalAlpha = 0.45;
      ctx.font = font(Math.max(fs + 6, 18), true);
      ctx.fillStyle = '#6a2010';
      ctx.fillText('ME', c.x, c.y);
      ctx.globalAlpha = 1;
    }
  }

  root.UnsaidRender = Render;
})(typeof globalThis !== 'undefined' ? globalThis : this);
