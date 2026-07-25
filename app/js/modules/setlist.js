/**
 * setlist.js - Порядок служения
 *
 * Заранее собранный список того, что пойдёт на экран: стихи, песни, заметки.
 * Хранится в localStorage, переживает перезагрузку, экспортируется в JSON.
 *
 * Модуль намеренно не знает ничего про DOM — только данные.
 */

const STORAGE_KEY = 'bible_setlist';
const MAX_ITEMS = 200;

/** @type {Array<Object>} */
let items = [];
let nextId = 1;

/**
 * Собрать пункт порядка служения из проекционного объекта
 * (стих из search.js или песня из songs.js).
 * @param {Object} source
 * @returns {Object|null}
 */
export function createItem(source) {
    if (!source) return null;

    if (source.type === 'song') {
        return {
            id: nextId++,
            kind: 'song',
            title: source.baseReference || source.title || 'Песня',
            payload: {
                type: 'song',
                id: source.id,
                title: source.title,
                baseReference: source.baseReference,
                rawText: source.rawText,
                copyright: source.copyright || ''
            }
        };
    }

    if (source.type === 'note') {
        return {
            id: nextId++,
            kind: 'note',
            title: source.title || 'Заметка',
            payload: { type: 'note', text: source.text || '' }
        };
    }

    if (!source.reference) return null;

    return {
        id: nextId++,
        kind: 'verse',
        title: source.reference,
        payload: {
            type: 'verse',
            reference: source.reference,
            bookName: source.bookName,
            bookId: source.bookId,
            canonicalCode: source.canonicalCode,
            chapter: source.chapter,
            verse: source.verse,
            translation: source.translation,
            text: source.text
        }
    };
}

/**
 * @returns {Array<Object>} текущий порядок служения
 */
export function getItems() {
    return items;
}

/**
 * @returns {number}
 */
export function count() {
    return items.length;
}

/**
 * Найти пункт по id.
 * @param {number} id
 * @returns {Object|null}
 */
export function getItem(id) {
    return items.find((item) => item.id === Number(id)) || null;
}

/**
 * Добавить пункт в конец списка.
 * @param {Object} source - проекционный объект (стих/песня/заметка)
 * @returns {Object|null} добавленный пункт
 */
export function addItem(source) {
    if (items.length >= MAX_ITEMS) return null;

    const item = createItem(source);
    if (!item) return null;

    items.push(item);
    persist();
    return item;
}

/**
 * Удалить пункт по id.
 * @param {number} id
 * @returns {boolean}
 */
export function removeItem(id) {
    const index = items.findIndex((item) => item.id === Number(id));
    if (index === -1) return false;

    items.splice(index, 1);
    persist();
    return true;
}

/**
 * Сдвинуть пункт на `offset` позиций (-1 вверх, +1 вниз).
 * @param {number} id
 * @param {number} offset
 * @returns {boolean} произошло ли перемещение
 */
export function moveItem(id, offset) {
    const from = items.findIndex((item) => item.id === Number(id));
    if (from === -1) return false;

    const to = from + offset;
    if (to < 0 || to >= items.length) return false;

    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    persist();
    return true;
}

/**
 * Очистить порядок служения.
 */
export function clear() {
    items = [];
    persist();
}

/**
 * Сериализовать порядок служения для экспорта.
 * @returns {string} JSON
 */
export function exportSetlist() {
    return JSON.stringify({ version: 1, items }, null, 2);
}

/**
 * Загрузить порядок служения из JSON (заменяет текущий).
 * @param {string} json
 * @returns {boolean} успех
 */
export function importSetlist(json) {
    try {
        const parsed = JSON.parse(json);
        const list = Array.isArray(parsed) ? parsed : parsed?.items;
        if (!Array.isArray(list)) return false;

        items = list
            .filter((item) => item && item.payload && item.title)
            .slice(0, MAX_ITEMS)
            .map((item) => ({
                id: nextId++,
                kind: item.kind || item.payload.type || 'verse',
                title: String(item.title),
                payload: item.payload
            }));

        persist();
        return true;
    } catch (e) {
        console.error('Failed to import setlist:', e);
        return false;
    }
}

/**
 * Восстановить порядок служения из localStorage.
 */
export function loadSetlist() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return;

        const parsed = JSON.parse(saved);
        const list = Array.isArray(parsed) ? parsed : parsed?.items;
        if (!Array.isArray(list)) return;

        items = list.filter((item) => item && item.payload && item.title);
        nextId = items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
    } catch (e) {
        console.error('Failed to load setlist:', e);
    }
}

function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items }));
    } catch (e) {
        console.error('Failed to save setlist:', e);
    }
}
