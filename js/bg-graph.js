/* ============================================================
   ФОН САЙТА — радиальный граф в центре экрана.
   Тот же язык, что был у графа контактов: пучок нитей из ядра,
   звёздная пыль, импульсы по нитям, искры и отклик на курсор.
   Рисуется как фон: приглушённо, под контентом сайта.
   ============================================================ */
window.PivoGraph = (function() {
    function create(canvas, options) {
        if (!canvas || !canvas.getContext) return null;

        var opts = options || {};
        var dim = typeof opts.dim === 'number' ? opts.dim : 1;
        var ctx = canvas.getContext('2d');
        var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

        var W = 0;
        var H = 0;
        var cx = 0;
        var cy = 0;
        var R = 0;
        var rays = [];
        var dust = [];
        var core = [];
        var pulses = [];
        var sparks = [];
        var mouseX = -9999;
        var mouseY = -9999;
        var rafId = null;
        var running = false;
        var lastNow = 0;
        var nextPulseAt = 0;
        var corePulse = 0;
        var pulseTimer = null;

        var GREEN = '126, 240, 168';

        /* Детерминированный генератор — рисунок стабилен между перезагрузками */
        function mulberry32(a) {
            return function() {
                a |= 0;
                a = (a + 0x6D2B79F5) | 0;
                var t = Math.imul(a ^ (a >>> 15), 1 | a);
                t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
        }

        /* ---------- построение сцены ---------- */
        function build() {
            var rnd = mulberry32(20261018);
            var i, j, k;

            rays = [];
            for (i = 0; i < 78; i++) {
                var parts = [];
                k = 2 + Math.floor(rnd() * 5);
                for (j = 0; j < k; j++) {
                    parts.push({
                        t: 0.14 + rnd() * 0.86,
                        jr: (rnd() * 2 - 1) * 8,
                        size: rnd() < 0.72 ? 1.6 : 2.4,
                        ph: rnd() * 6.283,
                        sp: 0.4 + rnd() * 1.1,
                        baseA: 0.14 + rnd() * 0.4
                    });
                }
                rays.push({
                    a: (i / 78) * Math.PI * 2 + (rnd() - 0.5) * 0.07,
                    len: R * (0.6 + rnd() * 0.4),
                    bend: (rnd() * 2 - 1) * 0.2,
                    start: 8 + rnd() * 22,
                    alpha: 0.05 + rnd() * 0.09,
                    parts: parts,
                    sw: 0.06 + rnd() * 0.08,
                    swp: rnd() * 6.283,
                    swayA: 0.05 + rnd() * 0.06,
                    swayS: 0.5 + rnd() * 0.45,
                    swayP: rnd() * 6.283
                });
            }

            dust = [];
            for (i = 0; i < 260; i++) {
                var gx = 0;
                var gy = 0;
                for (k = 0; k < 3; k++) { gx += rnd(); gy += rnd(); }
                gx = (gx / 3) * 2 - 1;
                gy = (gy / 3) * 2 - 1;
                var sx = gx * R * 0.9;
                var sy = gy * R * 0.84;
                if (Math.sqrt(sx * sx + sy * sy) > R * 1.02) continue;
                dust.push({
                    x: sx,
                    y: sy,
                    size: 1.4 + rnd() * 1.6,
                    baseA: 0.05 + rnd() * 0.2,
                    ph: rnd() * 6.283,
                    sp: 0.3 + rnd() * 1.0,
                    dr: rnd() * 6.283,
                    ds: 0.1 + rnd() * 0.2
                });
            }

            core = [];
            for (i = 0; i < 110; i++) {
                var ca = rnd() * Math.PI * 2;
                var cr = Math.pow(rnd(), 1.7) * 28;
                core.push({
                    x: Math.cos(ca) * cr,
                    y: Math.sin(ca) * cr,
                    size: 1.5 + rnd() * 2.4,
                    baseA: 0.18 + rnd() * 0.5,
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

        function rayPoint(r, t, T) {
            var g = rayGeom(r, T);
            var dx = Math.cos(g.a);
            var dy = Math.sin(g.a);
            var px = -dy;
            var py = dx;
            var x0 = cx + dx * r.start;
            var y0 = cy + dy * r.start;
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
                px: px,
                py: py
            };
        }

        /* Курсорное поле: мягкое отталкивание частиц */
        var MR = 130;
        function cursorField(x, y) {
            if (reduced || mouseX < -999) return null;
            var dx = x - mouseX;
            var dy = y - mouseY;
            var d2 = dx * dx + dy * dy;
            if (d2 > MR * MR) return null;
            var d = Math.sqrt(d2) || 1;
            var f = 1 - d / MR;
            var k = f * f * 14 / d;
            return { x: dx * k, y: dy * k, f: f * f };
        }

        /* ---------- отрисовка ---------- */
        function draw(now) {
            var T = now / 1000;
            var dt = Math.min(0.048, Math.max(0, (now - lastNow) / 1000));
            lastNow = now;
            var i, j;

            if (!reduced) corePulse = Math.max(0, corePulse - dt * 0.75);

            ctx.clearRect(0, 0, W, H);

            /* нити из ядра */
            for (i = 0; i < rays.length; i++) {
                var th = rays[i];
                var s0 = rayPoint(th, 0, T);
                var sm = rayPoint(th, 0.5, T);
                var s1 = rayPoint(th, 1, T);
                var flash = 0;

                if (!reduced && mouseX > -999) {
                    var cm = cursorField((s0.x + s1.x) / 2, (s0.y + s1.y) / 2);
                    if (cm) flash = cm.f * 0.09;
                }

                ctx.beginPath();
                ctx.moveTo(s0.x, s0.y);
                ctx.quadraticCurveTo(sm.x, sm.y, s1.x, s1.y);
                ctx.strokeStyle = 'rgba(214, 219, 224, ' + ((th.alpha + flash) * dim).toFixed(3) + ')';
                ctx.lineWidth = 1;
                ctx.stroke();

                for (j = 0; j < th.parts.length; j++) {
                    var p = th.parts[j];
                    var pt = rayPoint(th, p.t, T);
                    var a = p.baseA * dim;
                    if (!reduced) a *= 0.72 + 0.28 * Math.sin(T * p.sp + p.ph);
                    if (a <= 0.02) continue;
                    var cf = cursorField(pt.x, pt.y);
                    ctx.fillStyle = 'rgba(226, 229, 233, ' + a.toFixed(3) + ')';
                    ctx.fillRect(
                        pt.x + pt.px * p.jr + (cf ? cf.x : 0) - p.size / 2,
                        pt.y + pt.py * p.jr + (cf ? cf.y : 0) - p.size / 2,
                        p.size,
                        p.size
                    );
                }
            }

            /* звёздная пыль вокруг ядра */
            for (i = 0; i < dust.length; i++) {
                var st = dust[i];
                var sa = st.baseA * dim;
                if (!reduced) sa *= 0.7 + 0.3 * Math.sin(T * st.sp + st.ph);
                var stx = cx + st.x;
                var sty = cy + st.y;
                var a2 = sa;

                if (!reduced) {
                    stx += Math.sin(T * st.ds + st.dr) * 1.4;
                    sty += Math.cos(T * st.ds * 0.9 + st.dr) * 1.2;
                    var cf2 = cursorField(stx, sty);
                    if (cf2) {
                        stx += cf2.x;
                        sty += cf2.y;
                        a2 = Math.min(1, a2 + cf2.f * 0.2 * dim);
                    }
                }

                if (a2 <= 0.02) continue;
                ctx.fillStyle = 'rgba(214, 218, 223, ' + a2.toFixed(3) + ')';
                ctx.fillRect(stx - st.size / 2, sty - st.size / 2, st.size, st.size);
            }

            /* ядро */
            var boost = 1 + corePulse * 0.9;
            for (i = 0; i < core.length; i++) {
                var cp = core[i];
                var ca = cp.baseA * boost * dim;
                if (!reduced) ca *= 0.75 + 0.25 * Math.sin(T * cp.sp + cp.ph);
                var cox = reduced ? 0 : Math.sin(T * cp.ds + cp.dr) * 0.7;
                var coy = reduced ? 0 : Math.cos(T * cp.ds * 0.9 + cp.dr) * 0.7;
                ctx.fillStyle = 'rgba(232, 235, 238, ' + ca.toFixed(3) + ')';
                ctx.fillRect(cx + cp.x + cox - cp.size / 2, cy + cp.y + coy - cp.size / 2, cp.size, cp.size);
            }

            /* импульсы бегут по нитям */
            if (!reduced) {
                pulses = pulses.filter(function(pl) { return (now - pl.t0) / pl.dur < 1; });

                for (i = 0; i < pulses.length; i++) {
                    var pl = pulses[i];
                    var tp = (now - pl.t0) / pl.dur;
                    if (!pl.sparked && tp >= 0.97) {
                        pl.sparked = true;
                        var endPt = rayPoint(pl.th, 1, T);
                        sparks.push({ x: endPt.x, y: endPt.y, t0: now });
                    }
                    var trail = [0, 0.025, 0.05];
                    var alphas = [0.85, 0.4, 0.16];
                    var sizes = [2.6, 2, 1.5];

                    for (j = 0; j < trail.length; j++) {
                        var tt = tp - trail[j];
                        if (tt < 0.04 || tt > 1) continue;
                        var ppt = rayPoint(pl.th, tt, T);
                        var ssz = sizes[j] * (pl.big ? 1.45 : 1);
                        ctx.fillStyle = 'rgba(255, 255, 255, ' + (alphas[j] * dim).toFixed(3) + ')';
                        ctx.fillRect(ppt.x - ssz / 2, ppt.y - ssz / 2, ssz, ssz);
                    }
                }

                if (now > nextPulseAt) {
                    nextPulseAt = now + 900 + Math.random() * 900;
                    pulses.push({
                        th: rays[Math.floor(Math.random() * rays.length)],
                        t0: now,
                        dur: 1250,
                        big: Math.random() < 0.1
                    });
                }
            }

            /* искры */
            if (sparks.length) {
                sparks = sparks.filter(function(s) { return now - s.t0 < 620; });
                for (i = 0; i < sparks.length; i++) {
                    var sp = sparks[i];
                    var q = Math.min(1, (now - sp.t0) / 620);
                    var qe = 1 - Math.pow(1 - q, 2);
                    for (var m = 0; m < 4; m++) {
                        var ang = (m / 4) * Math.PI * 2 + q * 1.5;
                        var dist = 1.5 + qe * 11;
                        var ss = 2.2 * (1 - q);
                        if (ss < 0.4) continue;
                        ctx.fillStyle = 'rgba(190, 250, 214, ' + ((1 - q) * 0.75 * dim).toFixed(3) + ')';
                        ctx.fillRect(sp.x + Math.cos(ang) * dist - ss / 2, sp.y + Math.sin(ang) * dist - ss / 2, ss, ss);
                    }
                }
            }
        }

        /* ---------- цикл ---------- */
        function frame(now) {
            if (!document.body.contains(canvas)) {
                rafId = null;
                running = false;
                window.removeEventListener('resize', resize);
                return;
            }
            draw(now);
            rafId = requestAnimationFrame(frame);
        }

        function start() {
            if (running) return;
            running = true;
            lastNow = performance.now();
            if (reduced) {
                draw(lastNow);
                return;
            }
            rafId = requestAnimationFrame(frame);
        }

        function pause() {
            running = false;
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        }

        function clear() {
            if (W && H) ctx.clearRect(0, 0, W, H);
        }

        function resize() {
            if (!document.body.contains(canvas)) return;
            W = canvas.clientWidth;
            H = canvas.clientHeight;
            if (!W || !H) return;
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            cx = W / 2;
            cy = H / 2;
            R = Math.min(W * 0.5, H * 0.62);
            build();
            pulses = [];
            sparks = [];
            nextPulseAt = 0;
            if (running && reduced) draw(performance.now());
        }

        window.addEventListener('resize', resize);

        pulseTimer = setInterval(function() {
            if (running && !reduced) corePulse = 1;
        }, 15000);

        return {
            resize: resize,
            start: start,
            stop: function() { pause(); clear(); },
            pointer: function(x, y) { mouseX = x; mouseY = y; },
            pointerOut: function() { mouseX = -9999; mouseY = -9999; },
            isRunning: function() { return running; }
        };
    }

    return { create: create };
})();
