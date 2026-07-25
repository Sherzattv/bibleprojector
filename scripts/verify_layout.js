/**
 * Проверка контракта раскладки: ни при каком состоянии панелей
 * страница не должна скроллиться по горизонтали.
 */
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.OUT_DIR || path.join(projectRoot, '.layout-shots');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png'
};

// ES-модули не грузятся с file:// (CORS), поэтому поднимаем свой статик-сервер.
const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(projectRoot, rel);

    if (!file.startsWith(projectRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404).end('not found');
        return;
    }

    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const URL = `http://127.0.0.1:${server.address().port}/app/controller.html`;

fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
    { name: '2560x1440', width: 2560, height: 1440 },
    { name: '1920x1080', width: 1920, height: 1080 },
    { name: '1440x900', width: 1440, height: 900 },
    { name: '1280x800', width: 1280, height: 800 },
    { name: '1180x820', width: 1180, height: 820 },
    { name: '1024x768', width: 1024, height: 768 },
    { name: '820x1180', width: 820, height: 1180 },
    { name: '390x844', width: 390, height: 844 },
    { name: '320x568', width: 320, height: 568 }
];

// Длинные значения без пробелов — худший случай для min-content раздувания.
const STRESS = {
    verse: 'Length'.repeat(1) + ' ' + 'о'.repeat(120) + ' ' +
        'Иисус сказал ему: Я есмь путь и истина и жизнь; никто не приходит к Отцу, как только через Меня.',
    songTitle: 'Аллилуйя-аллилуйя-аллилуйя-слава-Богу-вовеки-веков-длиннющее-название-без-единого-пробела'
};

// Ждём, пока закончатся ВСЕ анимации/переходы (ширины колонок и сдвиг
// выдвижных панелей идут 0.28s). Фиксированный sleep здесь давал редкие
// ложные срабатывания: замер попадал в середину перехода.
const settle = async () => {
    // Бесконечные анимации (фоновая «аврора», пульс статуса) никогда не
    // резолвят .finished — их обязательно нужно отфильтровать, иначе
    // ожидание зависнет навсегда.
    const finite = document.getAnimations().filter(
        (a) => a.effect?.getComputedTiming().iterations !== Infinity
    );
    await Promise.race([
        Promise.allSettled(finite.map((a) => a.finished)),
        new Promise((r) => setTimeout(r, 2000))
    ]);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
};

const audit = () => {
    const de = document.documentElement;
    const overflowing = [];

    document.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;

        // Закрытая выдвижная панель намеренно «припаркована» за левым/правым
        // краем через translateX(±100%) — это не выход за экран.
        const rail = el.closest('.rail');
        if (rail && !rail.classList.contains('is-open') &&
            window.matchMedia('(max-width: 1100px)').matches) return;

        // элемент вылез за правый край вьюпорта более чем на 1px
        if (r.right > de.clientWidth + 1 || r.left < -1) {
            const tag = el.tagName.toLowerCase();
            const cls = (el.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.');
            overflowing.push(`${tag}${cls ? '.' + cls : ''} [${Math.round(r.left)}..${Math.round(r.right)}]`);
        }
    });

    return {
        docScrollW: de.scrollWidth,
        docClientW: de.clientWidth,
        overlayMode: window.matchMedia('(max-width: 1100px)').matches,
        horizontalScroll: de.scrollWidth > de.clientWidth,
        overflowing: overflowing.slice(0, 8)
    };
};

const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  ⚠️  pageerror:', e.message));

await page.setViewport({ width: 1920, height: 1080 });
console.log('Загрузка контроллера (43 МБ данных)…');
await page.goto(URL, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => document.getElementById('loading')?.style.display === 'none', { timeout: 60000 });
console.log('Загружено.\n');

// Наполняем интерфейс худшим случаем: длинный стих + длинные пункты списка.
await page.evaluate((stress) => {
    document.getElementById('verse-text').textContent = stress.verse;
    document.getElementById('verse-ref').textContent = stress.songTitle;

    const items = [];
    for (let i = 0; i < 12; i++) {
        items.push({
            id: i + 1,
            kind: i % 2 ? 'song' : 'verse',
            title: i % 2 ? stress.songTitle : `Первое послание к Коринфянам ${i + 1}:1-25`,
            payload: i % 2
                ? { type: 'song', id: i, title: stress.songTitle, rawText: '[Куплет 1]\n' + stress.verse, baseReference: stress.songTitle }
                : { type: 'verse', reference: `1 Кор ${i + 1}:1`, text: stress.verse, canonicalCode: '1CO', chapter: i + 1, verse: '1', bookName: '1-е Коринфянам' }
        });
    }
    localStorage.setItem('bible_setlist', JSON.stringify({ version: 1, items }));
}, STRESS);

await page.reload({ waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => document.getElementById('loading')?.style.display === 'none', { timeout: 60000 });
await page.evaluate((stress) => {
    document.getElementById('verse-text').textContent = stress.verse;
    document.getElementById('verse-ref').textContent = stress.songTitle;
}, STRESS);

// Наполняем библиотеку результатами поиска песен.
await page.evaluate(() => {
    const input = document.getElementById('library-input');
    input.value = 'бог';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
});
await new Promise((r) => setTimeout(r, 400));

// Колоночный режим: перебираем все комбинации свёрнут/развёрнут.
const COLUMN_STATES = [
    { name: 'оба-развёрнуты', left: 'expanded', right: 'expanded' },
    { name: 'левый-свёрнут', left: 'collapsed', right: 'expanded' },
    { name: 'правый-свёрнут', left: 'expanded', right: 'collapsed' },
    { name: 'оба-свёрнуты', left: 'collapsed', right: 'collapsed' }
];

// Оверлейный режим: важна не «свёрнутость», а открытая поверх сцены панель.
const DRAWER_STATES = [
    { name: 'панели-закрыты', open: null },
    { name: 'порядок-открыт', open: 'left' },
    { name: 'библиотека-открыта', open: 'right' }
];

const applyColumnState = (s) => {
    const app = document.getElementById('app');
    app.setAttribute('data-left', s.left);
    app.setAttribute('data-right', s.right);
};

const applyDrawerState = (s) => {
    document.getElementById('scrim')?.click();
    if (s.open === 'left') document.getElementById('toggle-left-mobile')?.click();
    if (s.open === 'right') document.getElementById('toggle-right-mobile')?.click();
};

let failures = 0;

for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.evaluate(settle);

    const overlay = await page.evaluate(() => window.matchMedia('(max-width: 1100px)').matches);
    const states = overlay ? DRAWER_STATES : COLUMN_STATES;

    for (const state of states) {
        await page.evaluate(overlay ? applyDrawerState : applyColumnState, state);
        await page.evaluate(settle);

        const res = await page.evaluate(audit);
        const ok = !res.horizontalScroll && res.overflowing.length === 0;
        if (!ok) failures++;

        console.log(
            `${ok ? '✅' : '❌'} ${vp.name.padEnd(10)} ${(overlay ? '▤ ' : '▥ ') + state.name.padEnd(20)} ` +
            `scrollW=${res.docScrollW} clientW=${res.docClientW}` +
            (res.overflowing.length ? `\n      выходят за экран: ${res.overflowing.join(' | ')}` : '')
        );
    }

    if (overlay) await page.evaluate(() => document.getElementById('scrim')?.click());
}

// Скриншоты ключевых состояний
await page.setViewport({ width: 1440, height: 900 });
for (const state of [COLUMN_STATES[0], COLUMN_STATES[1]]) {
    await page.evaluate(applyColumnState, state);
    await page.evaluate(settle);
    await page.screenshot({ path: `${OUT}/desktop-${state.name}.png` });
}

await page.setViewport({ width: 390, height: 844 });
await new Promise((r) => setTimeout(r, 250));
await page.screenshot({ path: `${OUT}/mobile.png` });
await page.evaluate(() => document.getElementById('toggle-left-mobile')?.click());
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: `${OUT}/mobile-setlist.png` });

console.log(`\n${failures === 0 ? '✅ Горизонтального выхода за экран нет ни в одной комбинации.' : `❌ Провалов: ${failures}`}`);
console.log(`Скриншоты: ${OUT}`);

await browser.close();
server.close();
process.exit(failures === 0 ? 0 : 1);
