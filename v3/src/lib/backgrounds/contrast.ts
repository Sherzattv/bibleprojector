/**
 * Контраст белого текста с живым фоном. Чистые функции — покрыты
 * tests/backgrounds/backgrounds.test.ts.
 *
 * Берём не среднюю яркость, а 95-й перцентиль: текст читается плохо там,
 * где под ним самый светлый блик, а не там, где фон в среднем тёмный.
 */

function linearize(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/**
 * @param rgba пиксели RGBA (как из readPixels/getImageData)
 * @param dim затемнение поверх фона 0..1 (чёрный слой с этой прозрачностью)
 * @param step шаг выборки в пикселях — весь кадр перебирать незачем
 */
export function contrastOnBackground(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  dim: number,
  step = 4,
): number {
  const keep = 1 - dim
  const lums: number[] = []
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const o = (y * width + x) * 4
      lums.push(
        0.2126 * linearize((rgba[o] / 255) * keep) +
          0.7152 * linearize((rgba[o + 1] / 255) * keep) +
          0.0722 * linearize((rgba[o + 2] / 255) * keep),
      )
    }
  }
  if (!lums.length) return 21
  lums.sort((a, b) => a - b)
  const bright = lums[Math.min(lums.length - 1, Math.floor(lums.length * 0.95))]
  return Math.min(21, 1.05 / (bright + 0.05))
}

export type ContrastLevel = 'good' | 'ok' | 'poor'

/** 7:1 — WCAG AAA, читается из дальнего ряда; 4.5:1 — AA */
export function contrastLevel(ratio: number): ContrastLevel {
  if (ratio >= 7) return 'good'
  if (ratio >= 4.5) return 'ok'
  return 'poor'
}
