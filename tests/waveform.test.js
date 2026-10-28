import { describe, it, expect } from 'vitest';
import { computePeaks, peakBetween } from '../src/editor/waveform.js';

describe('computePeaks', () => {
    it('keeps the loudest sample per slice, either sign', () => {
        const left = new Float32Array([0.1, -0.5, 0.2, 0.3, 0, 0]);
        const peaks = computePeaks([left], 6, 3); // 2 samples per peak
        expect(Array.from(peaks).map(v => +v.toFixed(2))).toEqual([0.5, 0.3, 0]);
    });

    it('takes the louder channel', () => {
        const l = new Float32Array([0.1, 0.1]);
        const r = new Float32Array([-0.9, 0.2]);
        expect(Array.from(computePeaks([l, r], 2, 1)).map(v => +v.toFixed(2))).toEqual([0.9]);
    });

    it('handles a ragged final slice', () => {
        const d = new Float32Array([0, 0, 0, 0.4, 0.7]);
        expect(computePeaks([d], 4, 2).length).toBe(3);
    });
});

describe('peakBetween', () => {
    const peaks = new Float32Array([0.1, 0.2, 0.9, 0.3]);
    it('finds the max in a window of seconds', () => {
        expect(+peakBetween(peaks, 0.01, 0.03, 100).toFixed(2)).toBe(0.9);
    });
    it('always reads at least one slice', () => {
        expect(+peakBetween(peaks, 0.02, 0.02, 100).toFixed(2)).toBe(0.9);
    });
});
