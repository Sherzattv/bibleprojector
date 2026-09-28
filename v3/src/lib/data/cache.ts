/**
 * Офлайн-доставка данных: манифест — network-first, файлы — cache-first
 * по контент-хэшу, stale-фоллбек при сбое сети.
 * Хранилище и сеть абстрагированы (в рантайме — Cache Storage и fetch,
 * в тестах — фейки). Покрыто tests/data-cache.test.ts.
 */

export interface KVStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}

export interface DataManifest {
  version: string
  files: Record<string, { hash: string }>
}

/** Бросает при сбое сети/HTTP */
export type FetchText = (url: string) => Promise<string>

/**
 * Кэш — оптимизация, а не требование: квота (данных ~43 МБ), приватный режим
 * Firefox или вычищенное хранилище не должны мешать отдать уже полученные
 * данные. Поэтому все обращения к KV обёрнуты и никогда не бросают.
 */
async function kvGet(kv: KVStore, key: string): Promise<string | null> {
  try {
    return await kv.get(key)
  } catch {
    return null
  }
}

/** @returns удалось ли записать (по хэшу нет смысла бить, если тело не легло) */
async function kvSet(kv: KVStore, key: string, value: string): Promise<boolean> {
  try {
    await kv.set(key, value)
    return true
  } catch {
    return false
  }
}

async function kvDelete(kv: KVStore, key: string): Promise<void> {
  try {
    await kv.delete(key)
  } catch {
    // Битая запись останется — переживём, следующая удачная загрузка её перезапишет
  }
}

/**
 * Контент-хэш ровно как на сборке (scripts/convert-core.mjs — hashContent):
 * sha256 от utf8-байт, первые 16 hex-символов.
 * null — если crypto.subtle недоступен (не secure context): сверить нечем,
 * но это не повод ронять загрузку.
 */
export async function hashContent(text: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return null
  try {
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text))
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16)
  } catch {
    return null
  }
}

type Parsed = { ok: true; value: unknown } | { ok: false }

/**
 * Разбор кэшированной строки. Битую запись сразу удаляем: иначе один сохранённый
 * HTML или обрыв записи навсегда превращают файл в ошибку — в кэш-first-ветке
 * сеть мы уже не спросим.
 */
async function parseCached(kv: KVStore, name: string, raw: string): Promise<Parsed> {
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch {
    await kvDelete(kv, `file:${name}`)
    await kvDelete(kv, `hash:${name}`)
    return { ok: false }
  }
}

/**
 * Манифест: сеть в приоритете (узнаём об обновлениях),
 * при сбое — кэшированная копия.
 */
export async function loadManifest(
  url: string,
  kv: KVStore,
  fetchText: FetchText,
): Promise<{ manifest: DataManifest; fromCache: boolean }> {
  try {
    const raw = await fetchText(url)
    const manifest = JSON.parse(raw) as DataManifest
    // Сначала разобрали, потом пишем: 200 + HTML (лендинг на неизвестном пути)
    // не должен осесть в кэше под видом манифеста
    await kvSet(kv, 'manifest', raw)
    return { manifest, fromCache: false }
  } catch (e) {
    const cached = await kvGet(kv, 'manifest')
    if (cached !== null) {
      try {
        return { manifest: JSON.parse(cached) as DataManifest, fromCache: true }
      } catch {
        await kvDelete(kv, 'manifest')
      }
    }
    throw e
  }
}

/**
 * Файл данных: если кэш совпадает с манифестом по хэшу — сеть не нужна;
 * иначе качаем и обновляем кэш; при сбое сети отдаём кэш (пусть устаревший).
 */
export async function loadDataFile(
  name: string,
  url: string,
  manifest: DataManifest,
  kv: KVStore,
  fetchText: FetchText,
): Promise<unknown> {
  const expected = manifest.files?.[name]?.hash
  const [cachedHash, cachedFile] = await Promise.all([
    kvGet(kv, `hash:${name}`),
    kvGet(kv, `file:${name}`),
  ])

  // Разбираем кэш лениво: на устаревшем хэше нет смысла парсить 14 МБ заранее
  let cachedUsable = cachedFile !== null
  if (expected && cachedHash === expected && cachedFile !== null) {
    const hit = await parseCached(kv, name, cachedFile)
    if (hit.ok) return hit.value
    // Битый кэш уже вычищен — не отдаём ошибку наружу, а идём в сеть
    cachedUsable = false
  }

  try {
    const fresh = await fetchText(url)
    // Парсим ДО любой записи: Cloudflare на отсутствующий путь отвечает
    // 200 + text/html, и такой ответ не должен попасть в кэш как данные
    const parsed = JSON.parse(fresh)
    if (await kvSet(kv, `file:${name}`, fresh)) {
      // Хэш считаем от тела, а не переписываем из манифеста: прокси или
      // HTTP-кэш может отдать 200 со старой копией — запомнив под ней новый
      // хэш, мы бы больше никогда её не перекачали.
      // null = сверить нечем (нет crypto.subtle), тогда доверяем манифесту,
      // иначе кэш файлов не заработает вовсе.
      const actual = await hashContent(fresh)
      if (expected && (actual === null || actual === expected)) {
        await kvSet(kv, `hash:${name}`, expected)
      }
    }
    return parsed
  } catch (e) {
    if (cachedUsable && cachedFile !== null) {
      const stale = await parseCached(kv, name, cachedFile)
      if (stale.ok) return stale.value
    }
    throw e
  }
}
