/**
 * The section grid: where the click says the parts change.
 *
 * Justin, 2026-10-26: "My biggest fear as a user in this interface is
 * imprecision. I don't want to have to click a tiny exact spot in my song
 * where something important happens." And 2026-10-31, of Barlows: "That
 * song is to a click, so I'd expect standardSectionLength to significantly
 * reduce the workload."
 *
 * On a click, the parts change on a grid: a start, and a section length.
 * Find that grid from the markers already placed, draw it, and let a
 * marker dropped near a line land on the line.
 *
 * Pure functions, no DOM, so they can be tested on their own.
 */

/** Times of the markers that start a part -- the ones a grid is about. */
export function partTimes(entries) {
    return entries
        .filter(e => e.data && e.data.part)
        .map(e => e.time)
        .sort((a, b) => a - b);
}

/**
 * Fit a grid to marker times: the section length, and where it starts.
 *
 * Try every length from minLength to maxLength, each at the start that
 * suits it best, and count the markers that land within tolerance of a
 * line. Short lengths always win that count -- a grid of one-second lines
 * catches everything a four-second one does -- so the answer is the
 * longest length that catches nearly as many as the best. Then a line
 * through (section number, time) by least squares, over the markers that
 * fit, so one sloppy marker does not set the tempo.
 *
 * Returns null when there are too few markers to say anything.
 */
export function fitGrid(times, { minLength = 2.5, maxLength = 20, tolerance = 0.4 } = {}) {
    const t = [...times].sort((a, b) => a - b);
    if (t.length < 4) return null;

    const caught = (length, start) =>
        t.filter(x => {
            const k = Math.round((x - start) / length);
            return Math.abs(x - (start + k * length)) <= tolerance;
        }).length;

    const tried = [];
    for (let L = minLength; L <= maxLength; L += 0.01) {
        const start = fitStart(t, L);
        tried.push({ length: L, start, n: caught(L, start) });
    }
    const best = Math.max(...tried.map(c => c.n));
    if (best < 4) return null;
    const pick = tried.filter(c => c.n >= best * 0.9).pop();

    let { length, start } = pick;
    for (let pass = 0; pass < 2; pass++) {
        const ks = [], ys = [];
        t.forEach(x => {
            const k = Math.round((x - start) / length);
            if (Math.abs(x - (start + k * length)) <= tolerance) { ks.push(k); ys.push(x); }
        });
        if (new Set(ks).size < 2) break;
        const n = ks.length;
        const mk = ks.reduce((a, b) => a + b, 0) / n;
        const my = ys.reduce((a, b) => a + b, 0) / n;
        let sxx = 0, sxy = 0;
        for (let i = 0; i < n; i++) {
            sxx += (ks[i] - mk) ** 2;
            sxy += (ks[i] - mk) * (ys[i] - my);
        }
        length = sxy / sxx;
        start = my - length * mk;
    }

    start = ((start % length) + length) % length;
    const round = x => Math.round(x * 100) / 100;
    return { length: round(length), start: round(start), caught: caught(length, start), of: t.length };
}

/**
 * Where the grid starts, for a given length, when nobody has said: the
 * phase that puts the part markers closest to lines. Circular mean, so a
 * marker just before a line and one just after it average to the line.
 */
export function fitStart(times, length) {
    if (!length || !times.length) return 0;
    let s = 0, c = 0;
    times.forEach(x => {
        const a = (2 * Math.PI * x) / length;
        s += Math.sin(a);
        c += Math.cos(a);
    });
    const phase = Math.atan2(s, c) / (2 * Math.PI) * length;
    return Math.round((((phase % length) + length) % length) * 100) / 100;
}

/** Every grid line from start to the end of the song. */
export function gridLines(start, length, duration) {
    const lines = [];
    if (!(length > 0)) return lines;
    for (let t = start; t <= duration + 1e-9 && lines.length < 2000; t += length) {
        lines.push(Math.round(t * 100) / 100);
    }
    return lines;
}

/**
 * The time a marker should land at: the nearest line, if one is within
 * reach, otherwise where it was put. Reach is a fraction of a section, and
 * never more than a second and a half, so a pickup half a beat early stays
 * where it was played.
 */
export function snapTime(time, start, length, { reach = 0.3, maxReach = 1.5 } = {}) {
    if (!(length > 0)) return time;
    const k = Math.round((time - start) / length);
    const line = Math.round((start + k * length) * 10) / 10;
    const within = Math.min(length * reach, maxReach);
    return Math.abs(line - time) <= within && line >= 0 ? line : time;
}

/**
 * What snapping every part marker would do: a list of moves, without
 * making any. A move is skipped when another marker already holds the
 * line, so nothing is ever overwritten.
 */
export function planSnap(entries, start, length, options) {
    const taken = new Set(entries.map(e => e.time));
    const moves = [];
    entries
        .filter(e => e.data && e.data.part)
        .forEach(e => {
            const to = snapTime(e.time, start, length, options);
            if (to === e.time || taken.has(to)) return;
            taken.delete(e.time);
            taken.add(to);
            moves.push({ from: e.time, to });
        });
    return moves;
}
