import { describe, it, expect } from 'vitest';
import { fitGrid, fitStart, gridLines, snapTime, planSnap, partTimes } from '../src/editor/section-grid.js';

// Part markers from Barlows as Skyler charted it (rev 12290), first 3 min.
const BARLOWS = [0, 3.2, 11, 19.3, 23.3, 27.3, 31.1, 35.2, 43.1, 51.1, 55.2,
    59.7, 63.2, 67, 75, 83.2, 92.2, 100, 108.2, 116.2, 124.2, 132, 140, 148.3,
    156.3, 164.5, 175.4];

describe('fitGrid', () => {
    it('finds an exact grid', () => {
        const times = [2, 6, 10, 18, 22, 30];
        const g = fitGrid(times);
        expect(g.length).toBeCloseTo(4, 2);
        expect(g.start).toBeCloseTo(2, 2);
        expect(g.caught).toBe(6);
    });

    it('prefers the section to its subdivisions', () => {
        // Everything on a 4s grid also sits on a 2s one; 4 is the answer.
        const g = fitGrid([1, 5, 9, 13, 21, 29, 33]);
        expect(g.length).toBeCloseTo(4, 1);
    });

    it('finds the half-part in Barlows despite hand-placed markers', () => {
        const g = fitGrid(BARLOWS);
        expect(g.length).toBeGreaterThan(3.8);
        expect(g.length).toBeLessThan(4.2);
    });

    it('says nothing with too few markers', () => {
        expect(fitGrid([0, 4, 8])).toBeNull();
    });
});

describe('snapTime', () => {
    it('lands near a line on it', () => {
        expect(snapTime(10.3, 2, 4)).toBe(10);
    });
    it('leaves a time out of reach where it was', () => {
        expect(snapTime(12, 2, 4)).toBe(12);
    });
    it('never reaches further than a second and a half', () => {
        expect(snapTime(11.7, 0, 20)).toBe(11.7);
        expect(snapTime(19, 0, 20)).toBe(20);
    });
    it('does nothing without a grid', () => {
        expect(snapTime(7.3, 0, 0)).toBe(7.3);
    });
});

describe('gridLines / fitStart', () => {
    it('runs from start to the end of the song', () => {
        expect(gridLines(1, 4, 13)).toEqual([1, 5, 9, 13]);
    });
    it('puts the start where the markers are', () => {
        expect(fitStart([2.9, 7.1, 10.9, 15.1], 4)).toBeCloseTo(3, 1);
    });
});

describe('planSnap', () => {
    const entries = [
        { time: 0, data: { part: 'intro' } },
        { time: 4.2, data: { part: 'A' } },
        { time: 7.9, data: { pickup: 'Someone' } },
        { time: 8.3, data: { part: 'B' } },
        { time: 14, data: { part: 'A' } },
    ];
    it('moves part markers only, and only within reach', () => {
        const moves = planSnap(entries, 0, 4);
        expect(moves).toEqual([{ from: 4.2, to: 4 }, { from: 8.3, to: 8 }]);
    });
    it('never moves onto a marker already there', () => {
        const crowded = [...entries, { time: 4, data: { flourish: 'x' } }];
        expect(planSnap(crowded, 0, 4).map(m => m.from)).not.toContain(4.2);
    });
    it('reads part times from entries', () => {
        expect(partTimes(entries)).toEqual([0, 4.2, 8.3, 14]);
    });
});
