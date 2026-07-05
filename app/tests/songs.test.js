/**
 * Tests for songs.js module
 */

import { describe, it, expect } from 'vitest';
import { formatSongText, getSongById, searchSongs, toSongProjection } from '../js/modules/songs.js';

const songs = [
    {
        id: 1,
        title: 'Великий Бог',
        songNumber: '101',
        theme: 'Прославление',
        text: '[Куплет 1]\nВеликий Бог, Тебя хвалю\n\n[Припев 1]\nАллилуйя'
    },
    {
        id: 2,
        title: 'Благодать',
        alternateTitle: 'Amazing Grace',
        text: '[Куплет 1]\nО благодать, спасен Тобой'
    }
];

describe('searchSongs', () => {
    it('finds songs by title', () => {
        const results = searchSongs('великий', songs);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Великий Бог');
    });

    it('finds songs by lyrics', () => {
        const results = searchSongs('спасен', songs);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Благодать');
    });

    it('finds songs by alternate title and ignores ё/е differences', () => {
        const results = searchSongs('amazing спасён', songs);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Благодать');
    });

    it('respects result limit', () => {
        const results = searchSongs('куплет', songs, 1);
        expect(results).toHaveLength(1);
    });

    it('returns empty array for empty query', () => {
        expect(searchSongs('', songs)).toEqual([]);
    });
});

describe('song formatting', () => {
    it('formats section labels and escapes HTML', () => {
        const html = formatSongText('[Куплет 1]\nЛюбовь < Бог');
        expect(html).toContain('song-section-label');
        expect(html).toContain('&lt;');
    });

    it('creates projection-ready song object', () => {
        const projected = toSongProjection(songs[0]);
        expect(projected.type).toBe('song');
        expect(projected.reference).toBe('Великий Бог · № 101');
        expect(projected.text).toContain('Аллилуйя');
    });

    it('finds song by id', () => {
        expect(getSongById('2', songs)?.title).toBe('Благодать');
    });
});
