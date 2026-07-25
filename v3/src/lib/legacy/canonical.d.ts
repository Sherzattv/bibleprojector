export type TranslationCode = 'RST' | 'NRT' | 'KTB' | 'KYB'
export type BookLanguage = 'ru' | 'kz' | 'ky'

export interface BookInfo {
  order: number
  ru: string
  kz: string
  ky: string
  abbr: string[]
}

export const BOOK_INFO: Record<string, BookInfo>
export const TRANSLATION_MAPS: Record<string, Record<string, number>>

export function getCanonicalCode(input: string): string | null
export function getBookId(canonicalCode: string, translation: string): number | null
export function getBookTitle(canonicalCode: string, lang?: BookLanguage): string
export function getSupportedTranslations(): TranslationCode[]
