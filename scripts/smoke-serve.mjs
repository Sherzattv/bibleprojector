#!/usr/bin/env node
/**
 * Дымовой тест раздачи собранного dist/ через настоящий edge-роутер.
 *
 * Зачем отдельный тест: `wrangler deploy --dry-run` в CI не обслуживает ни
 * одного HTTP-запроса — он валидирует конфиг и выходит. А html_handling и
 * not_found_handling это поведение роутера ВО ВРЕМЯ запроса: статически они
 * не проверяются никак. Именно поэтому баг с html_handling:"none" (когда
 * "/app/" не находил dist/app/index.html и уходил в not_found_handling,
 * отдавая лендинг вместо приложения) спокойно прошёл CI.
 *
 * Тест поднимает `wrangler dev` на уже собранном dist/ и дёргает реальные
 * URL. Запускать после `npm run build`:
 *
 *     npm run build && npm run smoke
 *
 * Порт: SMOKE_PORT (по умолчанию 8790 — 8788 занят ручным preview).
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.SMOKE_PORT || 8790);
const BASE = `http://127.0.0.1:${PORT}`;

// Старт wrangler dev тянет за собой скачивание/запуск workerd, на холодной
// CI-машине это заметно дольше локального запуска.
const READY_TIMEOUT_MS = 120_000;
const READY_POLL_MS = 250;
const REQUEST_TIMEOUT_MS = 20_000;

// Маркеры выбраны так, чтобы отличать лендинг от приложения по телу ответа.
// Лендинг: фраза из <p class="lead"> в site/index.html.
// Приложение: точка монтирования Svelte из v3/index.html.
const LANDING_MARKER = 'Бесплатный пульт для служения';
const APP_MARKER = '<div id="app">';
const NOT_FOUND_MARKER = 'Такой страницы здесь нет'; // из site/404.html

const failures = [];
const passes = [];

function fail(name, detail) {
  failures.push(`${name}\n      ${detail}`);
  console.log(`  FAIL  ${name}`);
  console.log(`        ${detail}`);
}

function pass(name, detail) {
  passes.push(name);
  console.log(`  ok    ${name}${detail ? `  (${detail})` : ''}`);
}

async function get(path) {
  const res = await fetch(BASE + path, {
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return { status: res.status, type: res.headers.get('content-type') || '', body: await res.text() };
}

/**
 * @param {object} spec
 * @param {string} spec.path            запрашиваемый путь
 * @param {number} spec.status          ожидаемый HTTP-код
 * @param {string} [spec.type]          подстрока, которая должна быть в Content-Type
 * @param {string[]} [spec.contains]    подстроки, которые обязаны быть в теле
 * @param {string[]} [spec.notContains] подстроки, которых в теле быть не должно
 * @param {string} [spec.why]           что именно ломается, если проверка упала
 */
async function expect({ path, status, type, contains = [], notContains = [], why }) {
  const name = `${path} → ${status}`;
  let res;
  try {
    res = await get(path);
  } catch (err) {
    fail(name, `запрос не выполнился: ${err.message}`);
    return;
  }

  const problems = [];
  if (res.status !== status) problems.push(`код ${res.status}, ожидался ${status}`);
  if (type && !res.type.includes(type)) problems.push(`Content-Type "${res.type}", ожидался с "${type}"`);
  for (const needle of contains) {
    if (!res.body.includes(needle)) problems.push(`в теле нет "${needle}"`);
  }
  for (const needle of notContains) {
    if (res.body.includes(needle)) problems.push(`в теле есть лишнее "${needle}"`);
  }

  if (problems.length) fail(name, problems.join('; ') + (why ? ` — ${why}` : ''));
  else pass(name, res.type.split(';')[0]);
}

/** Убирает //- и /* *\/-комментарии, не трогая их внутри строковых литералов. */
function stripJsoncComments(input) {
  let out = '';
  let inString = false;
  let inLine = false;
  let inBlock = false;
  let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    const n = input[i + 1];
    if (inLine) {
      if (c === '\n') {
        inLine = false;
        out += c;
      }
      continue;
    }
    if (inBlock) {
      if (c === '*' && n === '/') {
        inBlock = false;
        i++;
      }
      continue;
    }
    if (inString) {
      out += c;
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    if (c === '/' && n === '/') {
      inLine = true;
      i++;
      continue;
    }
    if (c === '/' && n === '*') {
      inBlock = true;
      i++;
      continue;
    }
    out += c;
  }
  return out;
}

/**
 * Готовит конфиг для dev-сервера на основе настоящего wrangler.jsonc.
 *
 * Единственное отличие от боевого конфига — выброшенная секция "build":
 * `wrangler dev` выполняет build.command сам, а там `npm run build`, который
 * сносит dist/, делает `npm ci --prefix v3` и пересобирает приложение. В CI
 * сборка уже прошла шагом раньше, повторять её незачем (плюс watcher wrangler
 * перезапускал бы её на каждое изменение файлов). Секция "assets" —
 * html_handling и not_found_handling, ради которых всё и затевалось —
 * копируется как есть, поэтому тестируется именно боевая конфигурация.
 *
 * .wrangler/smoke.config.json перезаписывается на каждом запуске. Руками его
 * переиспользовать не стоит: `wrangler dev -c .wrangler/smoke.config.json`
 * поднимет конфиг от прошлого прогона (например, от намеренно сломанного при
 * проверке самого теста) и покажет поведение, которого в wrangler.jsonc нет.
 */
function writeDevConfig() {
  const src = join(ROOT, 'wrangler.jsonc');
  const cfg = JSON.parse(stripJsoncComments(readFileSync(src, 'utf8')));
  delete cfg.build;
  delete cfg.$schema; // путь относительный, а конфиг переезжает в .wrangler/
  // Конфиг лежит не в корне, поэтому "./dist" разворачиваем в абсолютный путь.
  if (cfg.assets?.directory) cfg.assets.directory = resolve(ROOT, cfg.assets.directory);
  const dest = join(ROOT, '.wrangler', 'smoke.config.json');
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(cfg, null, 2));
  return { dest, assets: cfg.assets };
}

async function waitForServer(child) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`wrangler dev завершился с кодом ${child.exitCode} ещё до готовности порта`);
    }
    try {
      // Сам код ответа не важен: важно, что порт принимает соединения.
      await fetch(BASE + '/', { signal: AbortSignal.timeout(2_000) });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, READY_POLL_MS));
    }
  }
  throw new Error(`порт ${PORT} не ответил за ${READY_TIMEOUT_MS / 1000} с`);
}

async function main() {
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
    console.error('dist/index.html не найден — сначала выполните `npm run build`.');
    process.exit(1);
  }

  const { dest: configPath, assets } = writeDevConfig();
  console.log(`Конфиг раздачи под тестом: ${JSON.stringify(assets, null, 2)}`);

  const log = [];
  const child = spawn(
    'npx',
    [
      'wrangler',
      'dev',
      '--config',
      configPath,
      '--ip',
      '127.0.0.1',
      '--port',
      String(PORT),
      // Никаких обращений к аккаунту Cloudflare: тест должен идти на форке и без секретов.
      '--local',
      '--show-interactive-dev-session=false',
    ],
    {
      cwd: ROOT,
      // Своя группа процессов: wrangler порождает workerd, и убивать надо всё
      // дерево, иначе порт остаётся занятым и следующий прогон падает.
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' },
    },
  );
  child.stdout.on('data', (b) => log.push(b.toString()));
  child.stderr.on('data', (b) => log.push(b.toString()));

  const stop = () => {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* уже мёртв */
    }
  };
  process.on('exit', stop);
  process.on('SIGINT', () => {
    stop();
    process.exit(130);
  });

  try {
    await waitForServer(child);
  } catch (err) {
    console.error(`Не удалось поднять wrangler dev: ${err.message}`);
    console.error('--- вывод wrangler ---');
    console.error(log.join('').slice(-4000));
    stop();
    process.exit(1);
  }

  console.log(`\nДымовой тест раздачи на ${BASE}\n`);

  // 1. Лендинг в корне.
  await expect({
    path: '/',
    status: 200,
    type: 'text/html',
    contains: [LANDING_MARKER],
  });

  // 2. Приложение по /app/ — и это НЕ лендинг.
  //    Падает при html_handling:"none": каталог не резолвится в index.html,
  //    запрос уходит в not_found_handling и возвращает корневую страницу.
  await expect({
    path: '/app/',
    status: 200,
    type: 'text/html',
    contains: [APP_MARKER, '/app/assets/'],
    notContains: [LANDING_MARKER],
    why: 'по /app/ отдаётся лендинг вместо приложения (проверьте html_handling)',
  });

  // 3. Данные приложения отдаются как JSON, а не как HTML.
  await expect({
    path: '/app/data/manifest.json',
    status: 200,
    type: 'application/json',
    notContains: [LANDING_MARKER],
  });

  // 4. Отсутствующие пути — честный 404 с нашей страницей.
  //    Падает при not_found_handling:"single-page-application": там 200 + HTML.
  for (const missing of [
    '/no-such-page-smoke-test',
    '/app/data/no-such-file.json', // 200+HTML тут отравлял бы клиентский кэш
    '/app/assets/no-such-chunk.js', // 200+HTML тут ломал бы strict-MIME → белый экран
  ]) {
    await expect({
      path: missing,
      status: 404,
      notContains: [LANDING_MARKER],
      why: 'несуществующий путь отдаётся как 200 (проверьте not_found_handling)',
    });
  }

  // 5. Кастомная страница 404 реально доезжает в dist/ и используется.
  await expect({
    path: '/no-such-page-smoke-test',
    status: 404,
    type: 'text/html',
    contains: [NOT_FOUND_MARKER],
    why: 'site/404.html не попал в dist/ или not_found_handling ≠ "404-page"',
  });

  // 6. Служебные файлы лендинга не должны были пострадать от смены роутинга.
  await expect({ path: '/robots.txt', status: 200, type: 'text/plain' });
  await expect({ path: '/sitemap.xml', status: 200, type: 'xml' });
  await expect({ path: '/llms.txt', status: 200, type: 'text/plain' });

  // 7. Превью для соцсетей: файл на месте и с правильным типом.
  await expect({ path: '/og-image.png', status: 200, type: 'image/png' });

  stop();

  console.log('');
  if (failures.length) {
    console.error(`Провалено ${failures.length} из ${failures.length + passes.length}:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`Все ${passes.length} проверок пройдены.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
