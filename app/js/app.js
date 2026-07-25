/**
 * app.js - Main controller application
 * Integrates all modules for the Bible Projector controller interface
 */

import { parseQuery, fetchVerse, fullTextSearch, getNextVerse, getPrevVerse } from './modules/search.js';
import { showVerse, showNote, hideDisplay, updateDisplaySettings, openDisplayWindow, setDisplayWindow, isDisplayAvailable } from './modules/broadcast.js';
import { addToHistory, renderHistory, getFromHistory, clearHistory as clearHistoryData } from './modules/history.js';
import { loadSettings, saveSettings, getEdit, saveEdit } from './modules/settings.js';
import { clearChildren, createElement, updateStatus } from './modules/dom-utils.js';
import { formatSongText, searchSongs, splitSongSections, toSongProjection, buildSongProjection } from './modules/songs.js';
import * as setlist from './modules/setlist.js';
import { initLayout, revealRail, isOverlayMode, closeAllDrawers } from './modules/layout.js';

// === STATE ===
let currentVerse = null;
let currentSetlistId = null;
let libraryTab = 'songs';
let libraryResults = [];

// === DATABASE REFERENCES ===
// These will be available globally after script loads
const getDatabases = () => ({
    RST: window.BIBLE_DATA,
    NRT: window.NRT_DATA,
    KTB: window.KTB_DATA,
    KYB: window.KYB_DATA
});

const getSongs = () => window.SONGS_RU || [];

// === DOM ELEMENTS ===
const elements = {};

const TAB_CONFIG = {
    songs: { placeholder: 'Название, номер или слова песни…', hint: 'Введите запрос и нажмите Enter' },
    bible: { placeholder: 'Слово или фраза в тексте Библии…', hint: 'Введите запрос и нажмите Enter' },
    history: { placeholder: '', hint: 'История пуста — найдите первый стих' }
};

// === INITIALIZATION ===
function init() {
    cacheElements();

    const loadingBar = document.getElementById('loading-bar');
    const loadingStatus = document.getElementById('loading-status');

    // Track loading progress
    const dbs = getDatabases();
    const codes = ['RST', 'NRT', 'KTB', 'KYB'];
    const total = codes.length;
    const missing = codes.filter((code) => !dbs[code]);
    const loaded = total - missing.length;

    if (loadingBar) loadingBar.style.width = `${(loaded / total) * 100}%`;
    if (loadingStatus) loadingStatus.textContent = `${loaded} / ${total} переводов`;

    // Check if all data is loaded
    if (missing.length) {
        if (loadingStatus) {
            loadingStatus.textContent = `Ошибка: ${missing.join(', ')}`;
            loadingStatus.style.color = 'var(--error)';
        }
        return;
    }

    // Hide loading overlay with fade
    setTimeout(() => {
        elements.loading.style.opacity = '0';
        elements.loading.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            elements.loading.style.display = 'none';
        }, 300);
    }, 200);

    // Load saved settings into UI
    const settings = loadSettings();
    elements.fontSelect.value = settings.font;
    elements.themeSelect.value = settings.theme;
    elements.sizeRange.value = settings.size;

    initLayout();
    setlist.loadSetlist();
    renderSetlist();

    setupEventListeners();
    switchLibraryTab('songs');
}

function cacheElements() {
    const byId = (id) => document.getElementById(id);

    Object.assign(elements, {
        input: byId('search-input'),
        status: byId('status'),
        verseText: byId('verse-text'),
        verseRef: byId('verse-ref'),
        btnBroadcast: byId('btn-broadcast'),
        editArea: byId('edit-area'),
        noteInput: byId('note-input'),
        noteModal: byId('note-modal'),
        translationSelect: byId('translation-select'),
        fontSelect: byId('font-select'),
        themeSelect: byId('theme-select'),
        sizeRange: byId('size-range'),
        settingsModal: byId('settings-modal'),
        loading: byId('loading'),
        slides: byId('slides'),
        slidesTrack: byId('slides-track'),
        setlist: byId('setlist'),
        setlistEmpty: byId('setlist-empty'),
        setlistCount: byId('setlist-count'),
        setlistFile: byId('setlist-file'),
        libraryInput: byId('library-input'),
        librarySearchWrap: byId('library-search-wrap'),
        libraryResults: byId('library-results'),
        libraryMeta: byId('library-meta'),
        btnEdit: byId('btn-edit'),
        btnSave: byId('btn-save'),
        btnCancel: byId('btn-cancel')
    });
}

// === EVENT LISTENERS ===
function setupEventListeners() {
    const on = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };

    elements.input.addEventListener('keydown', handleSearch);
    document.addEventListener('keydown', handleGlobalKeys);
    elements.translationSelect.addEventListener('change', handleTranslationChange);

    elements.fontSelect.addEventListener('change', handleSettingsUpdate);
    elements.themeSelect.addEventListener('change', handleSettingsUpdate);
    elements.sizeRange.addEventListener('input', handleSettingsUpdate);

    // Transport
    on('btn-broadcast', 'click', broadcastToDisplay);
    on('btn-prev', 'click', goToPrevVerse);
    on('btn-next', 'click', goToNextVerse);
    on('btn-hide', 'click', hideFromDisplay);
    on('btn-open-display', 'click', handleOpenDisplay);
    on('btn-settings', 'click', toggleSettings);
    on('btn-settings-done', 'click', toggleSettings);

    // Preview edit
    on('btn-edit', 'click', toggleEditMode);
    on('btn-save', 'click', commitEdit);
    on('btn-cancel', 'click', cancelEdit);

    // Note modal
    on('btn-note', 'click', openNote);
    on('btn-note-close', 'click', closeNote);
    on('btn-note-send', 'click', sendNote);
    on('btn-note-add', 'click', addNoteToSetlist);

    // Setlist
    on('btn-setlist-add', 'click', addCurrentToSetlist);
    on('btn-setlist-clear', 'click', handleSetlistClear);
    on('btn-setlist-export', 'click', handleSetlistExport);
    on('btn-setlist-import', 'click', () => elements.setlistFile?.click());
    elements.setlistFile?.addEventListener('change', handleSetlistImport);
    elements.setlist.addEventListener('click', handleSetlistClick);

    // Library
    document.querySelectorAll('.tab').forEach((tab) => {
        tab.addEventListener('click', () => switchLibraryTab(tab.dataset.tab));
    });
    elements.libraryInput.addEventListener('keydown', handleLibrarySearch);
    elements.libraryResults.addEventListener('click', handleLibraryClick);

    // Slides
    elements.slidesTrack.addEventListener('click', handleSlideClick);

    // Modal overlays close on backdrop click
    [elements.settingsModal, elements.noteModal].forEach((modal) => {
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });
}

// === SEARCH HANDLER ===
function handleSearch(e) {
    if (e.key !== 'Enter') return;

    const query = elements.input.value.trim();
    if (!query) return;

    updateStatus(elements.status, '⏳ Поиск...');

    const translation = elements.translationSelect.value;
    const db = getDatabases()[translation];

    const parsed = parseQuery(query);
    if (!parsed) {
        updateStatus(elements.status, '❌ Ошибка запроса', 'error');
        return;
    }

    const data = fetchVerse(parsed, db, translation);

    if (data) {
        // Check for saved edits
        const editedText = getEdit(translation, data.bookName, data.chapter, data.verse);
        if (editedText) {
            data.text = editedText;
        }

        setCurrent(data);
        updateStatus(elements.status, `✓ ${data.reference}`, 'success');
        addToHistory(data);
        refreshHistoryTab();

        // Ctrl+Enter or Cmd+Enter broadcasts immediately
        if (e.ctrlKey || e.metaKey) {
            broadcastToDisplay();
        }
    } else {
        updateStatus(elements.status, '❌ Не найдено', 'error');
    }
}

// === GLOBAL KEYBOARD SHORTCUTS ===
function handleGlobalKeys(e) {
    // Don't trigger if user is typing in an input
    const activeTag = document.activeElement?.tagName;
    const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA';

    if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal-overlay.active');
        if (openModal) {
            openModal.classList.remove('active');
            return;
        }
        if (isOverlayMode()) return; // layout.js закрывает выдвижные панели
        hideFromDisplay();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && currentVerse) {
        broadcastToDisplay();
    }
    // Arrow navigation (only when not typing)
    if (!isTyping && currentVerse) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            goToNextVerse();
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            goToPrevVerse();
        }
    }
}

// === TRANSLATION CHANGE ===
function handleTranslationChange(e) {
    if (!currentVerse || currentVerse.type === 'song') return;

    const newTranslation = e.target.value;
    const db = getDatabases()[newTranslation];

    updateStatus(elements.status, '⏳ Обновление...');

    const parsed = {
        canonicalCode: currentVerse.canonicalCode,
        chapter: currentVerse.chapter,
        verse: currentVerse.verse,
        bookName: currentVerse.bookName
    };

    const data = fetchVerse(parsed, db, newTranslation);

    if (data) {
        const editedText = getEdit(newTranslation, data.bookName, data.chapter, data.verse);
        if (editedText) {
            data.text = editedText;
        }

        const wasBroadcasting = elements.status.classList.contains('broadcasting');
        setCurrent(data);
        updateStatus(elements.status, `✓ ${data.reference} (${newTranslation})`, 'success');
        addToHistory(data);
        refreshHistoryTab();

        // If currently broadcasting, update display
        if (wasBroadcasting) {
            broadcastToDisplay();
        }
    } else {
        updateStatus(elements.status, `⚠️ Нет в ${newTranslation}`, 'error');
    }
}

// === PREVIEW ===
/**
 * Единая точка смены того, что лежит в предпросмотре:
 * текст, ссылка, кнопка эфира и сетка слайдов всегда согласованы.
 * @param {Object|null} data
 * @param {number|null} [setlistId] - id пункта порядка служения, если грузим оттуда
 */
function setCurrent(data, setlistId = null) {
    currentVerse = data;
    currentSetlistId = setlistId;

    if (!data) {
        elements.verseText.textContent = 'Введите ссылку и нажмите Enter…';
        elements.verseText.classList.add('placeholder');
        elements.verseRef.textContent = '';
        elements.btnBroadcast.disabled = true;
        renderSlides();
        renderSetlist();
        return;
    }

    elements.verseText.innerHTML = data.text;
    elements.verseText.classList.remove('placeholder');
    elements.verseRef.textContent = data.reference;
    elements.btnBroadcast.disabled = false;

    renderSlides();
    renderSetlist();
}

function displayPreview(data) {
    setCurrent(data, currentSetlistId);
}

// === SLIDE GRID ===
function renderSlides() {
    const sections = currentVerse?.type === 'song' ? currentVerse.sections : null;
    clearChildren(elements.slidesTrack);

    if (!sections || sections.length < 2) {
        elements.slides.classList.remove('is-visible');
        return;
    }

    elements.slides.classList.add('is-visible');
    const fragment = document.createDocumentFragment();

    sections.forEach((section, index) => {
        const chip = createElement('button', {
            className: `slide-chip${index === (currentVerse.sectionIndex || 0) ? ' is-active' : ''}`,
            dataset: { index: String(index) }
        });
        chip.type = 'button';
        chip.setAttribute('role', 'listitem');

        const label = createElement('span', {
            className: 'slide-chip__label',
            textContent: section.label || `Часть ${index + 1}`
        });
        const preview = createElement('span', {
            className: 'slide-chip__preview',
            textContent: section.rawText.replace(/^\[[^\]]+\]\s*/m, '').replace(/\s+/g, ' ').trim()
        });

        chip.append(label, preview);
        fragment.appendChild(chip);
    });

    elements.slidesTrack.appendChild(fragment);
}

function handleSlideClick(e) {
    const chip = e.target.closest('.slide-chip');
    if (!chip || !currentVerse) return;

    if (applySongSection(currentVerse, Number(chip.dataset.index))) {
        displayPreview(currentVerse);
        updateStatus(elements.status, `✓ ${currentVerse.reference}`, 'success');
        if (isDisplayAvailable()) broadcastToDisplay();
    }
}

// === BROADCAST ===
function broadcastToDisplay() {
    if (!currentVerse) return;

    if (!isDisplayAvailable()) {
        updateStatus(elements.status, '⚠️ Откройте экран', 'error');
        return;
    }

    // Заметка идёт на экран отдельным типом сообщения — без ссылки на стих.
    if (currentVerse.type === 'note') {
        showNote(currentVerse.rawText || '');
        updateStatus(elements.status, '📡 ЗАМЕТКА', 'broadcasting');
        return;
    }

    showVerse(currentVerse);
    updateStatus(elements.status, `📡 ${currentVerse.reference}`, 'broadcasting');
}

function hideFromDisplay() {
    hideDisplay();
    updateStatus(elements.status, '⏳ Готов');
}

function applySongSection(song, index) {
    if (!song || song.type !== 'song' || !song.sections?.length) return false;
    if (index < 0 || index >= song.sections.length) return false;

    const section = song.sections[index];
    song.sectionIndex = index;
    song.text = section.html;
    song.reference = section.label ? `${song.baseReference || song.title} · ${section.label}` : (song.baseReference || song.title);
    return true;
}

// === VERSE NAVIGATION ===
function goToNextVerse() {
    navigate(1);
}

function goToPrevVerse() {
    navigate(-1);
}

/**
 * Шаг по слайдам песни или по стихам; на границе песни/главы
 * переходит к следующему пункту порядка служения, если он есть.
 * @param {number} step - +1 вперёд, -1 назад
 */
function navigate(step) {
    if (!currentVerse) return;

    if (currentVerse.type === 'song') {
        const nextIndex = (currentVerse.sectionIndex || 0) + step;
        if (applySongSection(currentVerse, nextIndex)) {
            displayPreview(currentVerse);
            updateStatus(elements.status, `✓ ${currentVerse.reference}`, 'success');
            if (isDisplayAvailable()) broadcastToDisplay();
        } else if (!stepSetlist(step)) {
            updateStatus(elements.status, step > 0 ? '⚠️ Конец песни' : '⚠️ Начало песни', 'error');
        }
        return;
    }

    if (currentVerse.type === 'note') {
        if (!stepSetlist(step)) {
            updateStatus(elements.status, '⚠️ Край списка', 'error');
        }
        return;
    }

    const translation = elements.translationSelect.value;
    const db = getDatabases()[translation];
    const target = step > 0
        ? getNextVerse(currentVerse, db, translation)
        : getPrevVerse(currentVerse, db, translation);

    if (target) {
        // Check for saved edits
        const editedText = getEdit(translation, target.bookName, target.chapter, target.verse);
        if (editedText) {
            target.text = editedText;
        }

        setCurrent(target, currentSetlistId);
        addToHistory(target);
        refreshHistoryTab();
        updateStatus(elements.status, `✓ ${target.reference}`, 'success');

        // Auto-broadcast if we were already broadcasting
        if (isDisplayAvailable()) broadcastToDisplay();
    } else if (!stepSetlist(step)) {
        updateStatus(elements.status, step > 0 ? '⚠️ Конец' : '⚠️ Начало', 'error');
    }
}

/**
 * Перейти к соседнему пункту порядка служения.
 * @param {number} step
 * @returns {boolean} удалось ли перейти
 */
function stepSetlist(step) {
    if (currentSetlistId === null) return false;

    const items = setlist.getItems();
    const index = items.findIndex((item) => item.id === currentSetlistId);
    if (index === -1) return false;

    const target = items[index + step];
    if (!target) return false;

    loadSetlistItem(target.id);
    return true;
}

// === SETLIST (Порядок служения) ===
function renderSetlist() {
    const items = setlist.getItems();
    clearChildren(elements.setlist);

    elements.setlistCount.textContent = String(items.length);
    elements.setlistEmpty.hidden = items.length > 0;

    const fragment = document.createDocumentFragment();

    items.forEach((item, index) => {
        const row = createElement('div', {
            className: `setlist-item${item.id === currentSetlistId ? ' is-current' : ''}`,
            dataset: { id: String(item.id) }
        });
        row.setAttribute('role', 'listitem');

        const badge = createElement('div', {
            className: 'setlist-item__index',
            textContent: String(index + 1)
        });

        const main = createElement('div', { className: 'setlist-item__main' });
        const title = createElement('div', {
            className: 'setlist-item__title',
            textContent: item.title
        });
        const meta = createElement('div', { className: 'setlist-item__meta' });
        meta.append(
            createElement('span', {
                className: 'setlist-item__kind',
                textContent: kindLabel(item.kind)
            }),
            createElement('span', {
                className: 'setlist-item__snippet',
                textContent: setlistSnippet(item)
            })
        );
        main.append(title, meta);

        const tools = createElement('div', { className: 'setlist-item__tools' });
        tools.append(
            toolButton('up', '▲', 'Выше'),
            toolButton('down', '▼', 'Ниже'),
            toolButton('remove', '✕', 'Убрать')
        );

        row.append(badge, main, tools);
        fragment.appendChild(row);
    });

    elements.setlist.appendChild(fragment);
}

function toolButton(action, glyph, label) {
    const btn = createElement('button', {
        className: 'setlist-item__tool',
        textContent: glyph,
        dataset: { action }
    });
    btn.type = 'button';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    return btn;
}

function kindLabel(kind) {
    if (kind === 'song') return 'песня';
    if (kind === 'note') return 'заметка';
    return 'стих';
}

function setlistSnippet(item) {
    const payload = item.payload || {};
    const source = payload.type === 'song' ? payload.rawText : (payload.text || '');
    return source
        .replace(/<[^>]*>/g, ' ')
        .replace(/\[[^\]]+\]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60);
}

function handleSetlistClick(e) {
    const row = e.target.closest('.setlist-item');
    if (!row) return;

    const id = Number(row.dataset.id);
    const tool = e.target.closest('.setlist-item__tool');

    if (!tool) {
        loadSetlistItem(id);
        if (isOverlayMode()) closeAllDrawers();
        return;
    }

    const { action } = tool.dataset;
    if (action === 'up') setlist.moveItem(id, -1);
    if (action === 'down') setlist.moveItem(id, 1);
    if (action === 'remove') {
        setlist.removeItem(id);
        if (currentSetlistId === id) currentSetlistId = null;
    }
    renderSetlist();
}

/**
 * Загрузить пункт порядка служения в предпросмотр.
 * @param {number} id
 */
function loadSetlistItem(id) {
    const item = setlist.getItem(id);
    if (!item) return;

    const projection = projectionFromPayload(item.payload);
    if (!projection) return;

    setCurrent(projection, item.id);
    updateStatus(elements.status, `✓ ${projection.reference}`, 'success');

    if (isDisplayAvailable()) broadcastToDisplay();
}

/**
 * Восстановить проекционный объект из сохранённого пункта.
 * Стих перезапрашивается в текущем переводе, чтобы порядок служения
 * работал на любом языке; при неудаче используется сохранённый текст.
 * @param {Object} payload
 * @returns {Object|null}
 */
function projectionFromPayload(payload) {
    if (!payload) return null;

    if (payload.type === 'song') {
        return buildSongProjection({
            id: payload.id,
            title: payload.title,
            rawText: payload.rawText,
            baseReference: payload.baseReference,
            copyright: payload.copyright
        });
    }

    if (payload.type === 'note') {
        return {
            type: 'note',
            text: formatSongText(payload.text),
            rawText: payload.text,
            reference: 'Заметка'
        };
    }

    const translation = elements.translationSelect.value;
    const db = getDatabases()[translation];
    const refetched = payload.canonicalCode
        ? fetchVerse({
            canonicalCode: payload.canonicalCode,
            chapter: payload.chapter,
            verse: payload.verse,
            bookName: payload.bookName
        }, db, translation)
        : null;

    if (refetched) {
        const editedText = getEdit(translation, refetched.bookName, refetched.chapter, refetched.verse);
        if (editedText) refetched.text = editedText;
        return refetched;
    }

    return { ...payload };
}

function addCurrentToSetlist() {
    if (!currentVerse) {
        updateStatus(elements.status, '⚠️ Нечего добавлять', 'error');
        return;
    }

    const item = setlist.addItem(currentVerse);
    if (!item) {
        updateStatus(elements.status, '⚠️ Список переполнен', 'error');
        return;
    }

    renderSetlist();
    updateStatus(elements.status, `＋ ${item.title}`, 'success');
}

function handleSetlistClear() {
    if (!setlist.count()) return;
    if (!window.confirm('Очистить порядок служения?')) return;

    setlist.clear();
    currentSetlistId = null;
    renderSetlist();
}

function handleSetlistExport() {
    const blob = new window.Blob([setlist.exportSetlist()], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'poryadok-sluzheniya.json';
    link.click();
    window.URL.revokeObjectURL(url);
}

async function handleSetlistImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const ok = setlist.importSetlist(text);

    currentSetlistId = null;
    renderSetlist();
    updateStatus(elements.status, ok ? '✓ Порядок загружен' : '❌ Неверный файл', ok ? 'success' : 'error');
    e.target.value = '';
}

// === LIBRARY (Песни / Библия / История) ===
function switchLibraryTab(tab) {
    if (!TAB_CONFIG[tab]) return;

    libraryTab = tab;
    libraryResults = [];

    document.querySelectorAll('.tab').forEach((el) => {
        el.setAttribute('aria-selected', String(el.dataset.tab === tab));
    });
    elements.libraryResults.setAttribute('aria-labelledby', `tab-${tab}`);

    const config = TAB_CONFIG[tab];
    elements.librarySearchWrap.hidden = tab === 'history';
    elements.libraryInput.placeholder = config.placeholder;
    elements.libraryInput.value = '';

    if (tab === 'history') {
        refreshHistoryTab();
        return;
    }

    elements.libraryMeta.textContent = tab === 'songs'
        ? `В каталоге: ${getSongs().length} песен`
        : `Перевод: ${elements.translationSelect.value}`;
    showLibraryPlaceholder(config.hint);
}

function handleLibrarySearch(e) {
    if (e.key !== 'Enter') return;

    const query = elements.libraryInput.value.trim();
    if (!query) return;

    if (libraryTab === 'songs') {
        libraryResults = searchSongs(query, getSongs(), 40);
        renderLibraryResults(libraryResults.map((song) => ({
            title: song.songNumber ? `${song.title} · № ${song.songNumber}` : song.title,
            snippet: song.text.replace(/^\[[^\]]+\]\s*/gm, '').slice(0, 200)
        })), 'Песни не найдены');
    } else {
        const translation = elements.translationSelect.value;
        libraryResults = fullTextSearch(query, getDatabases()[translation], translation, 30);
        renderLibraryResults(libraryResults.map((verse) => ({
            title: verse.reference,
            html: verse.text
        })), 'Ничего не найдено');
    }
}

function renderLibraryResults(rows, emptyText) {
    clearChildren(elements.libraryResults);
    elements.libraryMeta.textContent = `Найдено: ${rows.length}`;

    if (!rows.length) {
        showLibraryPlaceholder(emptyText);
        return;
    }

    const list = createElement('div', { className: 'search-results' });
    list.setAttribute('role', 'list');

    rows.forEach((row, index) => {
        const item = createElement('div', {
            className: 'search-result-item',
            dataset: { index: String(index) }
        });
        item.setAttribute('role', 'listitem');

        const ref = createElement('div', {
            className: 'search-result-ref',
            textContent: row.title
        });

        const text = createElement('div', { className: 'search-result-text' });
        if (row.html) {
            text.innerHTML = row.html; // из данных перевода, не из пользовательского ввода
        } else {
            text.textContent = row.snippet;
        }

        const add = createElement('button', {
            className: 'result-add',
            textContent: '＋',
            dataset: { action: 'add' }
        });
        add.type = 'button';
        add.title = 'Добавить в порядок служения';
        add.setAttribute('aria-label', `Добавить «${row.title}» в порядок служения`);

        item.append(ref, text, add);
        list.appendChild(item);
    });

    elements.libraryResults.appendChild(list);
}

function showLibraryPlaceholder(text) {
    clearChildren(elements.libraryResults);
    elements.libraryResults.appendChild(
        createElement('div', { className: 'empty-state', textContent: text })
    );
}

function handleLibraryClick(e) {
    // Вкладка «История» обслуживается делегированием из history.js —
    // здесь её трогать не нужно, иначе клик отработает дважды.
    if (libraryTab === 'history') return;

    const item = e.target.closest('.search-result-item');
    if (!item) return;

    const record = libraryResults[Number(item.dataset.index)];
    if (!record) return;

    const projection = libraryTab === 'songs' ? toSongProjection(record) : record;
    if (!projection) return;

    // ＋ добавляет в порядок служения, клик по карточке — открывает в предпросмотре
    if (e.target.closest('[data-action="add"]')) {
        const added = setlist.addItem(projection);
        if (added) {
            renderSetlist();
            updateStatus(elements.status, `＋ ${added.title}`, 'success');
        }
        return;
    }

    setCurrent(projection);
    updateStatus(elements.status, `✓ ${projection.reference}`, 'success');

    if (libraryTab === 'bible') {
        addToHistory(projection);
    }
    if (isOverlayMode()) closeAllDrawers();
    if (isDisplayAvailable()) broadcastToDisplay();
}

function refreshHistoryTab() {
    if (libraryTab !== 'history') return;

    clearChildren(elements.libraryResults);
    const list = createElement('div', { className: 'history-list' });
    list.setAttribute('role', 'list');
    elements.libraryResults.appendChild(list);

    renderHistory(list, loadFromHistory);
    elements.libraryMeta.textContent = `Записей: ${list.childElementCount}`;

    if (!list.childElementCount) {
        showLibraryPlaceholder(TAB_CONFIG.history.hint);
        return;
    }

    const clear = createElement('button', {
        className: 'btn btn-dashed btn-sm btn-block',
        textContent: '🗑 Очистить историю'
    });
    clear.type = 'button';
    clear.style.marginTop = '10px';
    clear.addEventListener('click', () => {
        clearHistoryData();
        refreshHistoryTab();
    });
    elements.libraryResults.appendChild(clear);
}

function loadFromHistory(index) {
    const verse = getFromHistory(index);
    if (!verse) return;

    setCurrent(verse);
    if (isOverlayMode()) closeAllDrawers();
    broadcastToDisplay();
}

// === NOTES ===
function openNote() {
    elements.noteModal.classList.add('active');
    elements.noteInput.focus();
}

function closeNote() {
    elements.noteModal.classList.remove('active');
}

function sendNote() {
    const text = elements.noteInput.value.trim();
    if (!text) return;

    if (isDisplayAvailable()) {
        showNote(text);
        updateStatus(elements.status, '📡 ЗАМЕТКА', 'broadcasting');
        closeNote();
    } else {
        updateStatus(elements.status, '⚠️ Откройте экран', 'error');
    }
}

function addNoteToSetlist() {
    const text = elements.noteInput.value.trim();
    if (!text) return;

    const added = setlist.addItem({
        type: 'note',
        text,
        title: text.replace(/\s+/g, ' ').slice(0, 40)
    });

    if (added) {
        renderSetlist();
        updateStatus(elements.status, `＋ ${added.title}`, 'success');
        closeNote();
    }
}

// === SETTINGS ===
function toggleSettings() {
    elements.settingsModal.classList.toggle('active');
}

function handleSettingsUpdate() {
    const settings = {
        font: elements.fontSelect.value,
        theme: elements.themeSelect.value,
        size: elements.sizeRange.value
    };

    saveSettings(settings);
    updateDisplaySettings(settings);
}

// === EDIT MODE ===
function toggleEditMode() {
    if (!currentVerse) return;

    elements.verseText.hidden = true;
    elements.editArea.value = currentVerse.rawText || currentVerse.text;
    elements.editArea.classList.add('active');
    elements.btnEdit.hidden = true;
    elements.btnSave.hidden = false;
    elements.btnCancel.hidden = false;
    elements.editArea.focus();
}

function cancelEdit() {
    elements.verseText.hidden = false;
    elements.editArea.classList.remove('active');
    elements.btnEdit.hidden = false;
    elements.btnSave.hidden = true;
    elements.btnCancel.hidden = true;
}

function commitEdit() {
    if (!currentVerse) return;

    const editedText = elements.editArea.value.trim();
    const wasBroadcasting = elements.status.classList.contains('broadcasting');

    if (currentVerse.type === 'song') {
        currentVerse.rawText = editedText;
        currentVerse.sections = splitSongSections(editedText);
        const applied = applySongSection(
            currentVerse,
            Math.min(currentVerse.sectionIndex || 0, Math.max(currentVerse.sections.length - 1, 0))
        );
        if (!applied) {
            currentVerse.text = formatSongText(editedText);
        }
    } else {
        currentVerse.text = editedText;
        const translation = elements.translationSelect.value;
        saveEdit(translation, currentVerse.bookName, currentVerse.chapter, currentVerse.verse, currentVerse.text);
    }

    displayPreview(currentVerse);
    cancelEdit();

    if (wasBroadcasting) broadcastToDisplay();
}

// === DISPLAY WINDOW ===
async function handleOpenDisplay() {
    const win = await openDisplayWindow();
    setDisplayWindow(win);

    // Apply settings after slight delay
    setTimeout(handleSettingsUpdate, 1000);
}

// === REGISTER SERVICE WORKER ===
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('✅ Service Worker зарегистрирован'))
        .catch(err => console.log('❌ Service Worker ошибка:', err));
}

// === GLOBAL BINDINGS ===
// Оставлены для внешних вызовов (тесты, консоль, старые ярлыки).
window.broadcastToDisplay = broadcastToDisplay;
window.hideFromDisplay = hideFromDisplay;
window.goToNextVerse = goToNextVerse;
window.goToPrevVerse = goToPrevVerse;
window.toggleSettings = toggleSettings;
window.openDisplayWindow = handleOpenDisplay;
window.showNote = sendNote;
window.clearHistory = function () {
    clearHistoryData();
    refreshHistoryTab();
};
window.openSongSearch = function () {
    revealRail('right');
    switchLibraryTab('songs');
    elements.libraryInput.focus();
};
window.openTextSearch = function () {
    revealRail('right');
    switchLibraryTab('bible');
    elements.libraryInput.focus();
};

// === START ===
window.addEventListener('load', init);
