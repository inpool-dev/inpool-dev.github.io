# pivodeveloper

Сайт-портфолио: чёрный экран, анимированный стартовый экран, граф-навигация и модальные окна
**BIO / Портфолио / Услуги / Контакты / Клипы**.

**Живой сайт:** https://inpool-dev.github.io/

## Локально

Просто открыть `index.html` — или поднять статический сервер:

```bash
npx serve .
```

## Публикация на GitHub Pages

1. Создать **публичный** репозиторий на GitHub (без README — он уже есть).
2. Добавить remote и запушить:

```bash
git remote add origin https://github.com/USER/REPO.git
git push -u origin main
```

3. Дальше всё само: workflow `.github/workflows/deploy.yml` включит Pages
   (`actions/configure-pages` с `enablement: true`) и выложит сайт.
   Следить можно во вкладке **Actions** → *Deploy to GitHub Pages*.

4. Через 1–2 минуты сайт будет доступен:

   - `https://USER.github.io/REPO/` — обычный репозиторий
   - `https://USER.github.io/` — если репозиторий назван `USER.github.io`

> Альтернатива без Actions: **Settings → Pages → Deploy from a branch →
> Branch: `main`, папка `/ (root)`**.

## Структура

| Путь | Что внутри |
| --- | --- |
| `index.html` | разметка, старт-экран, все модалки и логика интерфейса |
| `css/styles.css` | основные стили (фон, граф-навигация, модалки, плеер, адаптив) |
| `css/bootstrap.min.css`, `css/Navigation-Clean.css` | вендорные стили |
| `js/bg-anim.js` | фоновое созвездие (canvas) |
| `js/bg-graph.js` | радиальный граф в центре |
| `js/start-screen.js`, `js/ok.js` | стартовый экран и вход |
| `js/typed.js` | печатающийся текст в hero |
| `media/*.mp4` | клипы: 720p, H.264 + AAC, `faststart` (прогрессивное воспроизведение) |
| `images/` | аватар, курсор, фавикон |

## Что учтено

- Все пути относительные — работает и в подпапке (`/repo/`), и в корне домена.
- Адаптив: мобильные (≤900px) — навигация уходит в строку внизу, модалки скроллятся,
  плеер сжимается, тач-перемотка по полосе, на iOS — системный фуллскрин видео.
- Видео сжаты для веба (101 МБ вместо 253 МБ), каждый файл < 100 МБ — ограничение GitHub.
- `.nojekyll` — чтобы GitHub Pages не трогал файлы через Jekyll.
