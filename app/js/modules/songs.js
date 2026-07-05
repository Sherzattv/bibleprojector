/**
 * songs.js - Search and formatting helpers for worship songs
 */

const normalize = (value) => (value || '')
    .toString()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Convert plain song text to safe display HTML.
 * Section labels like [Куплет 1] are styled as separate lines.
 * @param {string} text
 * @returns {string}
 */
export function formatSongText(text) {
    return (text || '')
        .split('\n')
        .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return '<br>';
            const escaped = escapeHtml(trimmed);
            if (/^\[[^\]]+\]$/.test(trimmed)) {
                return `<span class="song-section-label">${escaped}</span>`;
            }
            return escaped;
        })
        .join('<br>');
}

/**
 * Create projection-ready object from a song record.
 * @param {Object} song
 * @returns {Object|null}
 */
export function toSongProjection(song) {
    if (!song) return null;

    return {
        type: 'song',
        id: song.id,
        title: song.title,
        text: formatSongText(song.text),
        reference: song.songNumber ? `${song.title} · № ${song.songNumber}` : song.title,
        rawText: song.text,
        copyright: song.copyright || ''
    };
}

/**
 * Search songs by title, number, theme, alternate title and lyrics.
 * Title/number matches are ranked above lyric matches.
 * @param {string} query
 * @param {Array<Object>} songs
 * @param {number} limit
 * @returns {Array<Object>}
 */
export function searchSongs(query, songs = [], limit = 30) {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return [];

    const terms = normalizedQuery.split(' ').filter(Boolean);
    const scored = [];

    for (const song of songs || []) {
        const title = normalize(song.title);
        const alternateTitle = normalize(song.alternateTitle);
        const number = normalize(song.songNumber);
        const theme = normalize(song.theme);
        const text = normalize(song.text);
        const haystack = `${title} ${alternateTitle} ${number} ${theme} ${text}`;

        if (!terms.every((term) => haystack.includes(term))) continue;

        let score = 0;
        if (title === normalizedQuery) score += 100;
        if (title.startsWith(normalizedQuery)) score += 60;
        if (title.includes(normalizedQuery)) score += 35;
        if (alternateTitle.includes(normalizedQuery)) score += 25;
        if (number === normalizedQuery) score += 50;
        if (theme.includes(normalizedQuery)) score += 10;
        if (text.includes(normalizedQuery)) score += 5;

        scored.push({ song, score });
    }

    return scored
        .sort((a, b) => b.score - a.score || a.song.title.localeCompare(b.song.title, 'ru'))
        .slice(0, limit)
        .map(({ song }) => song);
}

/**
 * Find a song by id.
 * @param {number|string} id
 * @param {Array<Object>} songs
 * @returns {Object|null}
 */
export function getSongById(id, songs = []) {
    const numericId = Number(id);
    return songs.find((song) => song.id === numericId) || null;
}

function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
