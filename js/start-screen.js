/* Стартовый экран: терминальная загрузка, часы, фон-анимация, вход по Enter */
(function() {
    var boot = document.getElementById('stBoot');
    var clock = document.getElementById('stClock');
    var startLink = document.getElementById('startLink');
    var stage = document.getElementById('startThing');
    var canvas = document.getElementById('stCanvas');

    function alive(node) {
        return !!node && document.body.contains(node);
    }

    function cookie(name, value) {
        try {
            if (value === undefined) {
                var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
                return m ? decodeURIComponent(m[1]) : null;
            }
            document.cookie = name + '=' + encodeURIComponent(value) + ';path=/;max-age=31536000';
        } catch (e) {}
        return null;
    }

    /* ---------- часы в правом углу ---------- */
    function pad(n) {
        return (n < 10 ? '0' : '') + n;
    }

    function tickClock() {
        if (!clock) return false;
        var d = new Date();
        clock.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
        return true;
    }

    if (tickClock()) {
        var clockTimer = setInterval(function() {
            if (!alive(clock)) {
                clearInterval(clockTimer);
                return;
            }
            tickClock();
        }, 1000);
    }

    /* ---------- строки загрузки печатаются по очереди ---------- */
    var lines = [
        { label: '> инициализация.........', value: 'ok', cls: 'ok' },
        { label: '> проектов в портфолио..', value: '6', cls: 'num' },
        { label: '> статус................', value: 'открыт к заказам', cls: 'ok' }
    ];

    function typeLine(index) {
        if (!alive(boot) || index >= lines.length) return;

        var item = lines[index];
        var row = document.createElement('div');
        row.className = 'st-line';

        var label = document.createElement('span');
        label.className = 'st-label';

        var value = document.createElement('span');
        value.className = 'st-val st-val-' + item.cls;

        row.appendChild(label);
        row.appendChild(value);
        boot.appendChild(row);

        var pos = 0;
        var typer = setInterval(function() {
            if (!alive(row)) {
                clearInterval(typer);
                return;
            }
            pos++;
            label.textContent = item.label.slice(0, pos);
            if (pos >= item.label.length) {
                clearInterval(typer);
                value.textContent = item.value;
                value.classList.add('is-on');
                setTimeout(function() {
                    if (index + 1 >= lines.length) {
                        if (alive(boot)) {
                            var caret = document.createElement('span');
                            caret.className = 'st-caret';
                            row.appendChild(caret);
                        }
                        return;
                    }
                    typeLine(index + 1);
                }, 180);
            }
        }, 18);
    }

    setTimeout(function() {
        typeLine(0);
    }, 420);

    /* ---------- фон: созвездие ---------- */
    var bg = null;

    if (canvas && stage && window.PivoBg) {
        bg = window.PivoBg.create(canvas);
    }

    if (bg) {
        bg.resize();
        bg.start();

        stage.addEventListener('mousemove', function(e) {
            var rect = canvas.getBoundingClientRect();
            bg.pointer(e.clientX - rect.left, e.clientY - rect.top);
        });

        stage.addEventListener('mouseleave', function() {
            bg.pointerOut();
        });
    }

    /* ---------- клавиатура: Enter/Space — вход ---------- */
    document.addEventListener('keydown', function(e) {
        var tag = (e.target && e.target.tagName) || '';

        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (!alive(stage) || !startLink) return;
        e.preventDefault();
        startLink.click();
    });
})();
