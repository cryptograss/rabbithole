import { describe, it, expect } from 'vitest';
import { musicianEntries, statusAt, compactMusicians } from '../src/musician-status.js';

const names = ['Kyle', 'Justin', 'Harry'];

describe('statusAt', () => {
    it('starts everyone out and holds a change until the next one', () => {
        const tl = {
            0: { musicians: { Justin: 'in' } },
            30: { musicians: { Kyle: 'in' } },
            60: { musicians: { Justin: 'out' } },
        };
        const e = musicianEntries(tl);
        expect(statusAt(e, 'Kyle', 10)).toBe('out');
        expect(statusAt(e, 'Justin', 10)).toBe('in');
        expect(statusAt(e, 'Justin', 45)).toBe('in');
        expect(statusAt(e, 'Kyle', 45)).toBe('in');
        expect(statusAt(e, 'Justin', 90)).toBe('out');
    });

    it('band moves everyone, and named people override it in the same block', () => {
        const e = musicianEntries({ 0: { musicians: { band: 'in', Kyle: 'out' } } });
        expect(statusAt(e, 'Justin', 5)).toBe('in');
        expect(statusAt(e, 'Kyle', 5)).toBe('out');
    });

    it('exclusive reports what a marker inherits, not what it sets', () => {
        const e = musicianEntries({ 0: { musicians: { Justin: 'in' } }, 30: { musicians: { Kyle: 'in' } } });
        expect(statusAt(e, 'Kyle', 30)).toBe('in');
        expect(statusAt(e, 'Kyle', 30, { exclusive: true })).toBe('out');
    });
});

describe('compactMusicians', () => {
    it('collapses seventeen copies of the same band to one line', () => {
        const everyone = { Kyle: 'in', Justin: 'in', Harry: 'in' };
        const tl = {};
        [0, 10, 20, 30, 40].forEach(t => { tl[t] = { part: 'A', musicians: { ...everyone } }; });
        const { timeline, removed } = compactMusicians(tl, names);
        expect(timeline[0].musicians).toEqual({ band: 'in' });
        expect(timeline[10].musicians).toBeUndefined();
        expect(timeline[40].part).toBe('A');
        expect(removed).toBe(4);
    });

    it('keeps real changes, and says everyone-but when that is shorter', () => {
        const tl = {
            0: { musicians: { Kyle: 'in', Justin: 'in', Harry: 'in' } },
            50: { musicians: { Harry: 'out' } },
            80: { musicians: { Harry: 'in' } },
        };
        const { timeline } = compactMusicians(tl, names);
        expect(timeline[0].musicians).toEqual({ band: 'in' });
        expect(timeline[50].musicians).toEqual({ Harry: 'out' });
        expect(timeline[80].musicians).toEqual({ Harry: 'in' });
    });

    it('does not change what the player would show', () => {
        const tl = {
            0: { musicians: { Kyle: 'in', Justin: 'in', Harry: 'out' } },
            20: { musicians: { Kyle: 'in', Justin: 'in', Harry: 'in' } },
            40: { musicians: { Kyle: 'in', Justin: 'out', Harry: 'in' } },
        };
        const { timeline } = compactMusicians(tl, names);
        const a = musicianEntries(tl);
        const b = musicianEntries(timeline);
        [0, 10, 20, 30, 40, 50].forEach(t => names.forEach(n => {
            expect(statusAt(b, n, t)).toBe(statusAt(a, n, t));
        }));
    });

    it('leaves a click-authored timeline alone', () => {
        const tl = { 0: { musicians: { Kyle: 'in' } }, section1: { part: 'A' } };
        const result = compactMusicians(tl, names);
        expect(result.skipped).toBe(true);
        expect(result.timeline).toEqual(tl);
    });

    it('drops a marker that said nothing but who was in', () => {
        const tl = { 0: { musicians: { Kyle: 'in' } }, 10: { musicians: { Kyle: 'in' } } };
        const { timeline } = compactMusicians(tl, ['Kyle']);
        expect(timeline[10]).toBeUndefined();
    });
});
