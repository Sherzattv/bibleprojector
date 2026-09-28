/**
 * Нормализация текста для показа и поиска.
 * Чистые функции — покрыты tests/utils/text.test.ts.
 */

/**
 * Убрать разметку из текста стиха. Часть переводов несёт теги прямо в
 * тексте (заголовки NRT, слова Христа в KYB) — на экран и в поиск идёт
 * только видимый текст.
 */
export function stripMarkup(text: string): string {
  return text.replace(/<[^>]*>/g, '')
}

/** Ключ сравнения без учёта регистра и «ё»: «Ёлка» и «елка» совпадают */
export function foldText(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е')
}
