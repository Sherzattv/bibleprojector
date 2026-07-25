/**
 * Протокол проекции: что именно показывает экран.
 * Чистая функция — покрыта tests/projection.test.ts.
 */

export interface ProjectionSettings {
  fontScale: number
  showReference: boolean
}

export type ProjectionContent =
  | { kind: 'empty' }
  | { kind: 'blackout' }
  | { kind: 'slide'; text: string; reference: string }
  | { kind: 'note'; text: string; title: string }

export function buildContent(input: {
  blackout: boolean
  kind: 'song' | 'bible' | 'note' | null
  liveSlide: { text: string; reference: string } | null
}): ProjectionContent {
  if (input.blackout) return { kind: 'blackout' }
  if (!input.liveSlide || !input.kind) return { kind: 'empty' }
  if (input.kind === 'note') {
    return { kind: 'note', text: input.liveSlide.text, title: input.liveSlide.reference }
  }
  return { kind: 'slide', text: input.liveSlide.text, reference: input.liveSlide.reference }
}
