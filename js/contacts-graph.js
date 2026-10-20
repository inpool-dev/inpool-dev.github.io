/* ============================================================
   КОНТАКТЫ — граф связей (canvas)
   Пучок нитей из ядра + звёздная пыль + импульсы по нитям.
   Наведение на метку подсвечивает её сектор зелёным и
   «проращивает» волокна от ядра к чипу (сокет + кольца).
   Клик по чипу — переход (или копирование, если это кнопка).
   ============================================================ */
(function () {
  "use strict";

  var wrap = document.getElementById("ctViz");
  if (!wrap) return;
  var canvas = wrap.querySelector("canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Детерминированный генератор — рисунок стабилен между открытиями */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var W = 0, H = 0, cx = 0, cy = 0, R = 0;
  var rays = [], stars = [], core = [], pulses = [], sparks = [];
  var chips = [], hoverAngle = null;
  var fibers = null, fading = [];
  var mouseX = -9999, mouseY = -9999;
  var rafId = 0, running = false, lastNow = 0;
  var nextPulseAt = 0, corePulse = 0;

  var GREEN = "126, 240, 168";

  /* ---------- построение сцены ---------- */
  function build() {
    var rnd = mulberry32(20261018);
    var i, j, k;

    /* Нити из ядра наружу */
    rays = [];
    for (i = 0; i < 96; i++) {
      var parts = [];
      k = 2 + Math.floor(rnd() * 5);
      for (j = 0; j < k; j++) {
        parts.push({
          t: 0.14 + rnd() * 0.86,
          jr: (rnd() * 2 - 1) * 8,
          size: rnd() < 0.72 ? 1.6 : 2.4,
          ph: rnd() * 6.283,
          sp: 0.4 + rnd() * 1.1,
          baseA: 0.16 + rnd() * 0.45
        });
      }
      rays.push({
        a: (i / 96) * Math.PI * 2 + (rnd() - 0.5) * 0.07,
        len: R * (0.62 + rnd() * 0.38),
        bend: (rnd() * 2 - 1) * 0.2,
        start: 8 + rnd() * 22,
        alpha: 0.05 + rnd() * 0.1,
        parts: parts,
        sw: 0.06 + rnd() * 0.08,
        swp: rnd() * 6.283,
        swayA: 0.05 + rnd() * 0.06,
        swayS: 0.5 + rnd() * 0.45,
        swayP: rnd() * 6.283
      });
    }

    /* Звёздная пыль */
    stars = [];
    for (i = 0; i < 340; i++) {
      var gx = 0, gy = 0;
      for (k = 0; k < 3; k++) { gx += rnd(); gy += rnd(); }
      gx = (gx / 3) * 2 - 1;
      gy = (gy / 3) * 2 - 1;
      var sx = gx * R * 0.9, sy = gy * R * 0.84;
      if (Math.sqrt(sx * sx + sy * sy) > R * 1.02) continue;
      stars.push({
        x: sx, y: sy,
        size: 1.4 + rnd() * 1.6,
        baseA: 0.05 + rnd() * 0.24,
        ph: rnd() * 6.283,
        sp: 0.3 + rnd() * 1.0,
        dr: rnd() * 6.283,
        ds: 0.1 + rnd() * 0.2
      });
    }

    /* Ядро */
    core = [];
    for (i = 0; i < 120; i++) {
      var ca = rnd() * Math.PI * 2;
      var cr = Math.pow(rnd(), 1.7) * 30;
      core.push({
        x: Math.cos(ca) * cr,
        y: Math.sin(ca) * cr,
        size: 1.5 + rnd() * 2.5,
        baseA: 0.22 + rnd() * 0.6,
        ph: rnd() * 6.283,
        sp: 0.5 + rnd() * 1.6,
        dr: rnd() * 6.283,
        ds: 0.2 + rnd() * 0.24
      });
    }
  }

  /* Живая геометрия нити: «дыхание» длины и покачивание конца */
  function rayGeom(r, T) {
    if (reduced) return { a: r.a, len: r.len, sway: 0 };
    return {
      a: r.a + Math.sin(T * r.sw + r.swp + r.a * 0.9) * 0.016,
      len: r.len * (1 + Math.sin(T * r.sw * 1.3 + r.swp) * 0.05),
      sway: Math.sin(T * r.swayS + r.swayP) * r.swayA
    };
  }

  /* Точка на нити (квадратичная кривая) */
  function rayPoint(r, t, T) {
    var g = rayGeom(r, T);
    var dx = Math.cos(g.a), dy = Math.sin(g.a);
    var px = -dy, py = dx;
    var x0 = cx + dx * r.start, y0 = cy + dy * r.start;
    var swayEnd = g.sway * g.len;
    var x1 = cx + dx * g.len + px * swayEnd;
    var y1 = cy + dy * g.len + py * swayEnd;
    var mx = (x0 + x1) / 2 + px * (r.bend + g.sway * 0.45) * g.len * 0.5;
    var my = (y0 + y1) / 2 + py * (r.bend + g.sway * 0.45) * g.len * 0.5;
    var u = 1 - t;
    var off = g.sway * g.len * 0.55 * Math.pow(t, 1.45);
    return {
      x: u * u * x0 + 2 * u * t * mx + t * t * x1 + px * off,
      y: u * u * y0 + 2 * u * t * my + t * t * y1 + py * off,
      px: px, py: py
    };
  }

  /* Курсорное поле: мягкое отталкивание частиц */
  var MR = 120;
  function cursorField(x, y) {
    if (mouseX < -999) return null;
    var dx = x - mouseX, dy = y - mouseY;
    var d2 = dx * dx + dy * dy;
    if (d2 > MR * MR) return null;
    var d = Math.sqrt(d2) || 1;
    var f = 1 - d / MR;
    var k = f * f * 14 / d;
    return { x: dx * k, y: dy * k, f: f * f };
  }

  /* Координаты элемента внутри области графа (в пикселях канваса) */
  function localRect(el) {
    var wr = wrap.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    var s = (W && wr.width) ? wr.width / W : 1;
    if (!s || !isFinite(s) || s <= 0) s = 1;
    return {
      x: (r.left - wr.left) / s,
      y: (r.top - wr.top) / s,
      w: r.width / s,
      h: r.height / s
    };
  }

  /* Точка на кромке чипа, обращённая к ядру */
  function chipAttach(chip) {
    var lr = localRect(chip);
    var ccx = lr.x + lr.w / 2;
    var ccy = lr.y + lr.h / 2;
    var dx = ccx - cx, dy = ccy - cy;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= d; dy /= d;
    var hw = lr.w / 2 + 6, hh = lr.h / 2 + 6;
    var t = Math.min(dx !== 0 ? hw / Math.abs(dx) : Infinity, dy !== 0 ? hh / Math.abs(dy) : Infinity);
    return { x: ccx - dx * t, y: ccy - dy * t, dx: dx, dy: dy };
  }

  /* Пучок волокон, прорастающих из ядра к метке */
  function startFibers(chip) {
    var att = chipAttach(chip);
    var strands = [];
    var edgeAlongY = Math.abs(att.dx) > Math.abs(att.dy);
    for (var i = 0; i < 5; i++) {
      var kk = i / 4 - 0.5;
      var sa = chip._angle + kk * 0.34 + (Math.random() - 0.5) * 0.1;
      var sr = 8 + Math.random() * 28;
      var sx = cx + Math.cos(sa) * sr;
      var sy = cy + Math.sin(sa) * sr;
      var j = (Math.random() - 0.5) * 26;
      var ex = att.x + (edgeAlongY ? 0 : j);
      var ey = att.y + (edgeAlongY ? j : 0);
      var ddx = ex - sx, ddy = ey - sy;
      var dl = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      var px = -ddy / dl, py = ddx / dl;
      var bend = (Math.random() - 0.5) * dl * 0.3;
      var parts = [{
        t: Math.random() * 0.6,
        sp: 0.8 + Math.random() * 0.6,
        size: 2 + Math.random() * 0.8
      }];
      if (Math.random() < 0.5) {
        parts.push({ t: Math.random() * 0.6, sp: 0.7 + Math.random() * 0.5, size: 1.8 });
      }
      strands.push({
        sx: sx, sy: sy, ex: ex, ey: ey,
        mx: (sx + ex) / 2 + px * bend,
        my: (sy + ey) / 2 + py * bend,
        px: px, py: py,
        delay: i * 46 + Math.random() * 70,
        dur: 460 + Math.random() * 300,
        ph: Math.random() * 6.283,
        wph: Math.random() * 6.283,
        landed: false,
        parts: parts
      });
    }
    return {
      chip: chip,
      attach: att,
      strands: strands,
      t0: null,
      attachT: null,
      fadeStart: null,
      fading: false,
      fullAt: Math.max.apply(null, strands.map(function (s) { return s.delay + s.dur; }))
    };
  }

  function fiberPoint(s, t, T) {
    var wig = Math.sin(T * 0.9 + s.wph) * 1.6;
    var mx = s.mx + s.px * wig;
    var my = s.my + s.py * wig;
    var u = 1 - t;
    return {
      x: u * u * s.sx + 2 * u * t * mx + t * t * s.ex,
      y: u * u * s.sy + 2 * u * t * my + t * t * s.ey
    };
  }

  /* ---------- отрисовка ---------- */

  function drawFiberSet(fs, now, T, dt) {
    if (fs.t0 === null) fs.t0 = now;
    var alpha = Math.min(1, (now - fs.t0) / 160);
    if (fs.fading) {
      if (fs.fadeStart === null) fs.fadeStart = now;
      alpha *= Math.max(0, 1 - (now - fs.fadeStart) / 320);
      if (alpha <= 0.01) return false;
    }
    var el = now - fs.t0;
    var allDone = true;
    var i, s, p;

    for (i = 0; i < fs.strands.length; i++) {
      s = fs.strands[i];
      p = Math.max(0, Math.min(1, (el - s.delay) / s.dur));
      if (p <= 0) { allDone = false; continue; }
      if (p < 1) allDone = false;
      var e = 1 - Math.pow(1 - p, 3);
      if (p >= 1 && !s.landed) {
        s.landed = true;
        sparks.push({ x: s.ex, y: s.ey, t0: now });
      }
      var steps = 22;
      ctx.beginPath();
      ctx.moveTo(s.sx, s.sy);
      for (var q = 1; q <= steps; q++) {
        var pt = fiberPoint(s, e * (q / steps), T);
        ctx.lineTo(pt.x, pt.y);
      }
      var shimmer = 0.86 + 0.14 * Math.sin(T * 1.3 + s.ph);
      ctx.strokeStyle = "rgba(" + GREEN + ", " + (0.1 * alpha) + ")";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = "rgba(160, 245, 195, " + (0.6 * shimmer * alpha) + ")";
      ctx.lineWidth = 1.1;
      ctx.stroke();

      if (p < 1) {
        var head = fiberPoint(s, e, T);
        ctx.fillStyle = "rgba(236, 255, 244, " + (0.95 * alpha) + ")";
        ctx.fillRect(head.x - 1.6, head.y - 1.6, 3.2, 3.2);
      }
    }

    /* Сокет в точке прикрепления + расходящиеся кольца */
    if (allDone && el >= fs.fullAt) {
      if (fs.attachT === null) {
        fs.attachT = now;
        sparks.push({ x: fs.attach.x, y: fs.attach.y, t0: now });
      }
      var a = fs.attach;
      ctx.fillStyle = "rgba(214, 250, 224, " + (0.9 * alpha) + ")";
      ctx.fillRect(a.x - 2, a.y - 2, 4, 4);
      var rt = now - fs.attachT;
      [[0, 620], [170, 720]].forEach(function (ring) {
        var qq = (rt - ring[0]) / ring[1];
        if (qq <= 0 || qq >= 1) return;
        var qe = 1 - Math.pow(1 - qq, 2);
        var size = 6 + qe * 26;
        ctx.strokeStyle = "rgba(" + GREEN + ", " + (0.5 * (1 - qq) * alpha) + ")";
        ctx.lineWidth = 1;
        ctx.strokeRect(a.x - size / 2, a.y - size / 2, size, size);
      });
    }

    /* Частицы бегут вдоль готовых волокон */
    for (i = 0; i < fs.strands.length; i++) {
      s = fs.strands[i];
      if (el - s.delay < s.dur) continue;
      for (var j = 0; j < s.parts.length; j++) {
        var pp = s.parts[j];
        pp.t += pp.sp * dt;
        if (pp.t >= 1) {
          pp.t = 0;
          pp.sp = 0.8 + Math.random() * 0.6;
          sparks.push({ x: s.ex + (Math.random() - 0.5) * 3, y: s.ey + (Math.random() - 0.5) * 3, t0: now });
        }
        var fpt = fiberPoint(s, pp.t, T);
        var near = 0.5 + 0.5 * pp.t;
        var sz = pp.size * (0.85 + 0.35 * pp.t);
        ctx.fillStyle = "rgba(216, 250, 228, " + ((0.3 + 0.6 * near) * alpha) + ")";
        ctx.fillRect(fpt.x - sz / 2, fpt.y - sz / 2, sz, sz);
      }
    }
    return true;
  }

  function inSector(a) {
    if (hoverAngle === null) return false;
    var d = (a - hoverAngle) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d) < 0.42;
  }

  function draw(now) {
    var T = now / 1000;
    var dt = Math.min(0.048, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    var i;

    if (!reduced) {
      corePulse = Math.max(0, corePulse - dt * 0.75);
    }

    ctx.clearRect(0, 0, W, H);

    /* Нити */
    for (i = 0; i < rays.length; i++) {
      var th = rays[i];
      var lit = inSector(th.a);
      var s0 = rayPoint(th, 0, T);
      var sm = rayPoint(th, 0.5, T);
      var s1 = rayPoint(th, 1, T);
      var flash = 0;

      if (!reduced && mouseX > -999) {
        var cm = cursorField((s0.x + s1.x) / 2, (s0.y + s1.y) / 2);
        if (cm) flash = Math.max(flash, cm.f * 0.1);
      }

      ctx.beginPath();
      ctx.moveTo(s0.x, s0.y);
      ctx.quadraticCurveTo(sm.x, sm.y, s1.x, s1.y);
      if (lit) {
        ctx.strokeStyle = "rgba(" + GREEN + ", " + Math.min(1, 0.5 + flash * 2) + ")";
        ctx.lineWidth = 1.1;
      } else {
        ctx.strokeStyle = "rgba(214, 219, 224, " + (th.alpha + flash) + ")";
        ctx.lineWidth = 1;
      }
      ctx.stroke();

      for (var j = 0; j < th.parts.length; j++) {
        var p = th.parts[j];
        var pt = rayPoint(th, p.t, T);
        var a = lit ? Math.min(1, p.baseA * 1.7 + 0.25) : p.baseA;
        if (!reduced) a *= 0.72 + 0.28 * Math.sin(T * p.sp + p.ph);
        var cf = reduced ? null : cursorField(pt.x, pt.y);
        var ox = cf ? cf.x : 0, oy = cf ? cf.y : 0;
        if (a <= 0.02) continue;
        ctx.fillStyle = lit ? "rgba(210, 250, 224, " + a + ")" : "rgba(226, 229, 233, " + a + ")";
        var sz = p.size * (lit ? 1.15 : 1);
        var px = pt.x + pt.px * p.jr + ox;
        var py = pt.y + pt.py * p.jr + oy;
        ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      }
    }

    /* Звёздная пыль */
    for (i = 0; i < stars.length; i++) {
      var st = stars[i];
      var sa = st.baseA;
      if (!reduced) sa *= 0.7 + 0.3 * Math.sin(T * st.sp + st.ph);
      var stx = cx + st.x, sty = cy + st.y;
      var a2 = sa;
      if (!reduced) {
        stx += Math.sin(T * st.ds + st.dr) * 1.4;
        sty += Math.cos(T * st.ds * 0.9 + st.dr) * 1.2;
        var cf2 = cursorField(stx, sty);
        if (cf2) {
          stx += cf2.x; sty += cf2.y;
          a2 = Math.min(1, a2 + cf2.f * 0.25);
        }
      }
      if (a2 <= 0.02) continue;
      ctx.fillStyle = "rgba(214, 218, 223, " + a2 + ")";
      ctx.fillRect(stx - st.size / 2, sty - st.size / 2, st.size, st.size);
    }

    /* Ядро */
    var boost = 1 + corePulse * 0.9;
    for (i = 0; i < core.length; i++) {
      var cp = core[i];
      var ca = cp.baseA * boost;
      if (!reduced) ca *= 0.75 + 0.25 * Math.sin(T * cp.sp + cp.ph);
      var cox = reduced ? 0 : Math.sin(T * cp.ds + cp.dr) * 0.7;
      var coy = reduced ? 0 : Math.cos(T * cp.ds * 0.9 + cp.dr) * 0.7;
      ctx.fillStyle = "rgba(232, 235, 238, " + ca + ")";
      ctx.fillRect(cx + cp.x + cox - cp.size / 2, cy + cp.y + coy - cp.size / 2, cp.size, cp.size);
    }

    /* Импульсы по нитям */
    if (!reduced) {
      pulses = pulses.filter(function (pl) { return (now - pl.t0) / pl.dur < 1; });
      for (i = 0; i < pulses.length; i++) {
        var pl = pulses[i];
        var tp = (now - pl.t0) / pl.dur;
        if (!pl.sparked && tp >= 0.97) {
          pl.sparked = true;
          var endPt = rayPoint(pl.th, 1, T);
          sparks.push({ x: endPt.x, y: endPt.y, t0: now });
        }
        var trail = [0, 0.025, 0.05];
        var alphas = [0.95, 0.45, 0.18];
        var sizes = [2.6, 2, 1.5];
        for (j = 0; j < trail.length; j++) {
          var tt = tp - trail[j];
          if (tt < 0.04 || tt > 1) continue;
          var ppt = rayPoint(pl.th, tt, T);
          var ssz = sizes[j] * (pl.big ? 1.45 : 1);
          ctx.fillStyle = "rgba(255, 255, 255, " + alphas[j] + ")";
          ctx.fillRect(ppt.x - ssz / 2, ppt.y - ssz / 2, ssz, ssz);
        }
      }
      if (now > nextPulseAt) {
        nextPulseAt = now + 850 + Math.random() * 900;
        pulses.push({
          th: rays[Math.floor(Math.random() * rays.length)],
          t0: now,
          dur: 1250,
          big: Math.random() < 0.1
        });
        if (Math.random() < 0.18) {
          pulses.push({
            th: rays[Math.floor(Math.random() * rays.length)],
            t0: now + 240 + Math.random() * 220,
            dur: 1250,
            big: false
          });
        }
      }
    }

    /* Волокна к подсвеченной метке */
    if (fibers && !drawFiberSet(fibers, now, T, dt)) fibers = null;
    for (i = fading.length - 1; i >= 0; i--) {
      if (!drawFiberSet(fading[i], now, T, dt)) fading.splice(i, 1);
    }

    /* Искры */
    if (sparks.length) {
      sparks = sparks.filter(function (s) { return now - s.t0 < 620; });
      for (i = 0; i < sparks.length; i++) {
        var sp = sparks[i];
        var q = Math.min(1, (now - sp.t0) / 620);
        var qe = 1 - Math.pow(1 - q, 2);
        for (var m = 0; m < 4; m++) {
          var ang = (m / 4) * Math.PI * 2 + q * 1.5;
          var dist = 1.5 + qe * 11;
          var ss = 2.2 * (1 - q);
          if (ss < 0.4) continue;
          ctx.fillStyle = "rgba(190, 250, 214, " + ((1 - q) * 0.85) + ")";
          ctx.fillRect(sp.x + Math.cos(ang) * dist - ss / 2, sp.y + Math.sin(ang) * dist - ss / 2, ss, ss);
        }
      }
    }
  }

  /* ---------- цикл ---------- */
  function frame(now) {
    draw(now);
    rafId = requestAnimationFrame(frame);
  }
  function startLoop() {
    if (running) return;
    running = true;
    lastNow = performance.now();
    rafId = requestAnimationFrame(frame);
  }
  function stopLoop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  /* ---------- метки ---------- */
  function measureChips() {
    chips = Array.prototype.slice.call(wrap.querySelectorAll(".ct-chip"));
    chips.forEach(function (chip) {
      var lr = localRect(chip);
      chip._angle = Math.atan2(lr.y + lr.h / 2 - cy, lr.x + lr.w / 2 - cx);
      if (chip._wired) return;
      chip._wired = true;
      chip.addEventListener("mouseenter", function () {
        hoverAngle = chip._angle;
        chip.classList.add("is-lit");
        if (reduced) return;
        if (fibers) {
          fibers.fading = true;
          fading.push(fibers);
          if (fading.length > 3) fading.shift();
        }
        fibers = startFibers(chip);
      });
      chip.addEventListener("mouseleave", function () {
        hoverAngle = null;
        chip.classList.remove("is-lit");
        if (reduced || !fibers || fibers.chip !== chip) return;
        fibers.fading = true;
        fading.push(fibers);
        if (fading.length > 3) fading.shift();
        fibers = null;
      });
    });
  }

  /* ---------- размеры и запуск ---------- */
  function setup() {
    var w = wrap.clientWidth;
    var h = wrap.clientHeight;
    if (w < 60 || h < 60) return false;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = w;
    H = h;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2;
    cy = H / 2;
    R = Math.min(W * 0.55, H * 0.72);
    build();
    fibers = null;
    fading = [];
    sparks = [];
    pulses = [];
    nextPulseAt = 0;
    corePulse = 0;
    measureChips();
    return true;
  }

  wrap.addEventListener("mousemove", function (e) {
    var r = wrap.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  });
  wrap.addEventListener("mouseleave", function () {
    mouseX = -9999;
    mouseY = -9999;
  });

  function activate() {
    if (!setup()) return;
    if (reduced) {
      draw(performance.now());
    } else {
      startLoop();
    }
  }

  /* Пересборка сцены, когда область реально изменила размер */
  var syncTimer = null;
  function scheduleSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      syncTimer = null;
      if (wrap.clientWidth < 60 || wrap.clientHeight < 60) return;
      if (wrap.clientWidth === W && wrap.clientHeight === H) return;
      var wasRunning = running;
      setup();
      if (reduced || !wasRunning) draw(performance.now());
    }, 140);
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) activate();
        else stopLoop();
      });
    }, { threshold: 0 }).observe(wrap);
  } else {
    activate();
  }

  if ("ResizeObserver" in window) {
    new ResizeObserver(scheduleSync).observe(wrap);
  }
  window.addEventListener("resize", scheduleSync);

  /* Мягкий «выдох» ядра — раз в 12–20 секунд */
  setInterval(function () {
    if (running && !reduced) corePulse = 1;
  }, 15000);
})();
