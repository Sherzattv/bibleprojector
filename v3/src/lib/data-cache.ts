/**
 * Офлайн-доставка данных: манифест — network-first, файлы — cache-first
 * по контент-хэшу, stale-фоллбек при сбое сети.
 * Хранилище и сеть абстрагированы (в рантайме — Cache Storage и fetch,
 * в тестах — фейки). Покрыто tests/data-cache.test.ts.
 */

export interface KVStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
}

export interface DataManifest {
  version: string
  files: Record<string, { hash: string }>
}

/** Бросает при сбое сети/HTTP */
export type FetchText = (url: string) => Promise<string>

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
    await kv.set('manifest', raw)
    return { manifest, fromCache: false }
  } catch (e) {
    const cached = await kv.get('manifest')
    if (cached !== null) {
      return { manifest: JSON.parse(cached) as DataManifest, fromCache: true }
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
    kv.get(`hash:${name}`),
    kv.get(`file:${name}`),
  ])

  if (expected && cachedHash === expected && cachedFile !== null) {
    return JSON.parse(cachedFile)
  }

  try {
    const fresh = await fetchText(url)
    await kv.set(`file:${name}`, fresh)
    if (expected) await kv.set(`hash:${name}`, expected)
    return JSON.parse(fresh)
  } catch (e) {
    if (cachedFile !== null) return JSON.parse(cachedFile)
    throw e
  }
}
