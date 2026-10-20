/* Фоновая анимация «созвездие»: частицы, связи, падающие звёзды и сканирующая строка.
   Один и тот же движок для стартового экрана и для «Стандартного» фона сайта. */
window.PivoBg = (function() {
    function create(canvas, options) {
        if (!canvas || !canvas.getContext) return null;

        var opts = options || {};
        var ctx = canvas.getContext('2d');
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var W = 0;
        var H = 0;
        var pointer = { x: -9999, y: -9999 };
        var dots = [];
        var stars = [];
        var starTimer = 1.8;
        var scan = { t: 0 };
        var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        var rafId = null;
        var lastTs = 0;
        var running = false;
        var dim = typeof opts.dim === 'number' ? opts.dim : 1;

        /* ---------- данные ---------- */

        function buildDots() {
            var count = Math.max(30, Math.min(68, Math.round(W * H / 21000)));
            dots = [];
            for (var i = 0; i < count; i++) {
                dots.push({
                    x: Math.random() * W,
                    y: Math.random() * H,
                    vx: (Math.random() - 0.5) * 0.26,
                    vy: (Math.random() - 0.5) * 0.26,
                    r: 0.7 + Math.random() * 1.3,
                    green: Math.random() < 0.34,
                    tw: Math.random() * Math.PI * 2
                });
            }
        }

        /* ---------- отрисовка ---------- */

        function drawDots(step, ms) {
            var i, j, a, b, dx, dy, d, alpha, tw;

            ctx.clearRect(0, 0, W, H);

            for (i = 0; i < dots.length; i++) {
                a = dots[i];
                a.x += a.vx * step;
                a.y += a.vy * step;
                a.tw += 0.02 * step;
                if (a.x < -20) a.x = W + 20;
                if (a.x > W + 20) a.x = -20;
                if (a.y < -20) a.y = H + 20;
                if (a.y > H + 20) a.y = -20;
            }

            ctx.lineWidth = 1;

            for (i = 0; i < dots.length; i++) {
                a = dots[i];

                for (j = i + 1; j < dots.length; j++) {
                    b = dots[j];
                    dx = a.x - b.x;
                    dy = a.y - b.y;
                    d = Math.sqrt(dx * dx + dy * dy);
                    if (d < 132) {
                        alpha = (1 - d / 132) * 0.17 * dim;
                        ctx.strokeStyle = 'rgba(126, 240, 168, ' + alpha.toFixed(3) + ')';
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                }

                dx = a.x - pointer.x;
                dy = a.y - pointer.y;
                d = Math.sqrt(dx * dx + dy * dy);
                if (d < 170) {
                    alpha = (1 - d / 170) * 0.28 * dim;
                    ctx.strokeStyle = 'rgba(255, 255, 255, ' + alpha.toFixed(3) + ')';
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(pointer.x, pointer.y);
                    ctx.stroke();
                }
            }

            for (i = 0; i < dots.length; i++) {
                a = dots[i];
                tw = 0.55 + Math.sin(a.tw) * 0.25;
                ctx.beginPath();
                ctx.fillStyle = a.green
                    ? 'rgba(126, 240, 168, ' + (tw * dim).toFixed(3) + ')'
                    : 'rgba(255, 255, 255, ' + (tw * 0.7 * dim).toFixed(3) + ')';
                ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
                ctx.fill();
            }

            drawStars(step, ms);
        }

        /* падающие звёзды — редкие штрихи по экрану */
        function drawStars(step, ms) {
            starTimer -= ms / 1000;

            if (starTimer <= 0) {
                starTimer = 2.6 + Math.random() * 4.2;
                var left = Math.random() < 0.5;
                var speed = (5 + Math.random() * 4) * (left ? 1 : -1);
                stars.push({
                    x: left ? -40 : W + 40,
                    y: H * 0.1 + Math.random() * H * 0.8,
                    vx: speed,
                    vy: (Math.random() - 0.5) * 0.8,
                    len: 70 + Math.random() * 100
                });
            }

            ctx.lineCap = 'round';

            for (var i = stars.length - 1; i >= 0; i--) {
                var s = stars[i];
                s.x += s.vx * step;
                s.y += s.vy * step;

                if (s.x < -220 || s.x > W + 220) {
                    stars.splice(i, 1);
                    continue;
                }

                var dir = s.vx < 0 ? 1 : -1;
                var tx = s.x + dir * s.len;
                var ty = s.y + dir * s.len * (s.vy / Math.abs(s.vx));

                var grd = ctx.createLinearGradient(s.x, s.y, tx, ty);
                grd.addColorStop(0, 'rgba(226, 255, 240, ' + (0.6 * dim).toFixed(3) + ')');
                grd.addColorStop(0.3, 'rgba(126, 240, 168, ' + (0.26 * dim).toFixed(3) + ')');
                grd.addColorStop(1, 'rgba(126, 240, 168, 0)');

                ctx.strokeStyle = grd;
                ctx.lineWidth = 1.3;
                ctx.beginPath();
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(tx, ty);
                ctx.stroke();

                ctx.fillStyle = 'rgba(236, 255, 246, ' + (0.8 * dim).toFixed(3) + ')';
                ctx.beginPath();
                ctx.arc(s.x, s.y, 1.4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.lineCap = 'butt';
        }

        /* сканирующая строка — медленно проходит экран и замирает */
        function drawScanner(ms) {
            scan.t += ms / 1000;

            var period = 11;
            var prog = (scan.t % period) / period;
            if (prog > 0.7) return;

            var p = prog / 0.7;
            var y = -60 + p * (H + 120);

            var band = ctx.createLinearGradient(0, y - 70, 0, y + 70);
            band.addColorStop(0, 'rgba(126, 240, 168, 0)');
            band.addColorStop(0.5, 'rgba(126, 240, 168, ' + (0.05 * dim).toFixed(3) + ')');
            band.addColorStop(1, 'rgba(126, 240, 168, 0)');
            ctx.fillStyle = band;
            ctx.fillRect(0, y - 70, W, 140);

            ctx.fillStyle = 'rgba(160, 255, 200, ' + (0.15 * dim).toFixed(3) + ')';
            ctx.fillRect(0, y, W, 1);
        }

        /* ---------- цикл ---------- */

        function frame(ts) {
            if (!document.body.contains(canvas)) {
                rafId = null;
                running = false;
                window.removeEventListener('resize', resize);
                return;
            }
            var ms = lastTs ? Math.min(64, ts - lastTs) : 16;
            lastTs = ts;
            var step = ms / 16.67;
            drawDots(step, ms);
            drawScanner(ms);
            rafId = requestAnimationFrame(frame);
        }

        function start() {
            if (running) return;
            running = true;
            lastTs = 0;
            if (reduced) {
                cancelAnimationFrame(rafId);
                rafId = 0;
                drawDots(1, 16);
                drawScanner(16);
                return;
            }
            rafId = requestAnimationFrame(frame);
        }

        function pause() {
            running = false;
            lastTs = 0;
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
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);
            scan.t = 0;
            stars = [];
            starTimer = 1.8;
            buildDots();
            if (running && reduced) {
                drawDots(1, 16);
                drawScanner(16);
            }
        }

        window.addEventListener('resize', resize);

        return {
            resize: resize,
            start: start,
            stop: function() { pause(); clear(); },
            pointer: function(x, y) { pointer.x = x; pointer.y = y; },
            pointerOut: function() { pointer.x = -9999; pointer.y = -9999; },
            isRunning: function() { return running; }
        };
    }

    return { create: create };
})();
