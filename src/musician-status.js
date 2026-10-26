/**
 * Who is in and who is out, as a rule the player and the editor share.
 *
 * The rule, which the player has always followed: everyone starts OUT, a
 * `musicians` block changes people, and a change holds until the next one
 * that mentions that person. `band: in` or `band: out` moves everybody at
 * once. So a timeline only needs to say what CHANGES -- the YAML for a
 * tune where six people play from the top is one line, not seventeen
 * copies of the same six.
 *
 * Within one block `band` is applied first and named people after it, so
 * `{band: in, Kyle Tuttle: out}` means everyone but Kyle. The player used
 * to treat the two as exclusive and ignore the names; no existing
 * timeline mixes them, so nothing written so far changes meaning.
 *
 * Kept free of the DOM and of Webamp so it can be tested, and so the
 * editor can show what a marker INHERITS without asking the player.
 *
 * Skyler and Justin, 2026-10-26: "once they're in they stay in unless we
 * give an out directive" -- and the YAML should be something a person can
 * read and say "ohh, that second B part doesn't have fiddle".
 */

/** [{time, arrangement}] with a musicians block, oldest first. */
export function musicianEntries(timeline) {
    return Object.entries(timeline || {})
        .filter(([key, value]) => !isNaN(parseFloat(key)) && value && value.musicians)
        .map(([key, value]) => ({ time: Number(key), arrangement: value }))
        .sort((a, b) => a.time - b.time);
}

function apply(status, musicians, name) {
    let next = status;
    if (musicians.band === 'in' || musicians.band === 'out') next = musicians.band;
    if (musicians[name] === 'in' || musicians[name] === 'out') next = musicians[name];
    return next;
}

/**
 * One person's status at a time.
 *
 * @param {Array} entries  from musicianEntries(), or the player's processed timeline
 * @param {string} name
 * @param {number} time
 * @param {{exclusive?: boolean}} options  exclusive: stop BEFORE a marker at
 *        exactly `time` -- what a marker inherits, rather than what it sets
 */
export function statusAt(entries, name, time, { exclusive = false } = {}) {
    let status = 'out';
    for (const { time: t, arrangement } of entries) {
        if (exclusive ? t >= time : t > time) break;
        if (!arrangement || !arrangement.musicians) continue;
        status = apply(status, arrangement.musicians, name);
    }
    return status;
}

/**
 * Rewrite a timeline so every `musicians` block says only what changes.
 *
 * Writes `band: in` when that is the shorter way to say it -- everyone
 * joining at once, or everyone but a few -- and drops a block that
 * changes nobody. Leaves a timeline alone if it uses `section` keys,
 * because their times are worked out by the player and cannot be put in
 * order here; better to leave the file as written than to guess.
 *
 * @returns {{timeline: Object, removed: number, rewritten: number, skipped: boolean}}
 */
export function compactMusicians(timeline, names = []) {
    const clone = JSON.parse(JSON.stringify(timeline || {}));
    const keys = Object.keys(clone);

    if (keys.some(k => isNaN(parseFloat(k)))) {
        return { timeline: clone, removed: 0, rewritten: 0, skipped: true };
    }

    const everyone = new Set(names.filter(n => n && n !== 'band'));
    keys.forEach(k => {
        const m = clone[k] && clone[k].musicians;
        if (m) Object.keys(m).forEach(n => { if (n !== 'band') everyone.add(n); });
    });
    const roster = [...everyone];

    const state = {};
    roster.forEach(n => { state[n] = 'out'; });

    let removed = 0;
    let rewritten = 0;

    keys.sort((a, b) => Number(a) - Number(b)).forEach(key => {
        const marker = clone[key];
        if (!marker || !marker.musicians) return;

        const next = {};
        roster.forEach(n => { next[n] = apply(state[n], marker.musicians, n); });

        const changed = roster.filter(n => next[n] !== state[n]);

        let block = null;
        if (changed.length) {
            const explicit = {};
            changed.forEach(n => { explicit[n] = next[n]; });

            // `band: v` and then correct the exceptions, if that is shorter.
            let best = explicit;
            ['in', 'out'].forEach(v => {
                const exceptions = roster.filter(n => next[n] !== v);
                if (1 + exceptions.length < Object.keys(best).length) {
                    const viaBand = { band: v };
                    exceptions.forEach(n => { viaBand[n] = next[n]; });
                    best = viaBand;
                }
            });
            block = best;
        }

        const before = JSON.stringify(marker.musicians);
        if (block) {
            marker.musicians = block;
            if (JSON.stringify(block) !== before) rewritten += 1;
        } else {
            delete marker.musicians;
            removed += 1;
        }

        roster.forEach(n => { state[n] = next[n]; });

        // A marker that said nothing but who was in has nothing left.
        if (!Object.keys(marker).length) delete clone[key];
    });

    return { timeline: clone, removed, rewritten, skipped: false };
}

/**
 * Names the timeline uses that match nobody on the ensemble.
 *
 * The player matches on the exact spelling, so "harry clark" against a
 * "Harry Clark" card binds to nothing: the card plays the whole tune while
 * the file says he is out until 2:48. Nothing fails; it is just wrong.
 * Where the only difference is capitals or stray spaces we say which
 * spelling was probably meant.
 *
 * re, 2026-10-26: Tidy preserved that pair verbatim -- the same typo that
 * hid Harry for three hours, kept as a dead pair.
 *
 * @returns {Array<{name: string, suggestion: string|null, where: string[]}>}
 */
export function unmatchedNames(timeline, names = []) {
    const known = new Set(names);
    const fold = n => String(n).trim().toLowerCase().replace(/\s+/g, ' ');
    const byFolded = {};
    names.forEach(n => { byFolded[fold(n)] = n; });

    const seen = {};
    const note = (name, where) => {
        if (!name || name === 'band' || known.has(name)) return;
        (seen[name] = seen[name] || new Set()).add(where);
    };

    Object.entries(timeline || {}).forEach(([key, marker]) => {
        if (!marker || typeof marker !== 'object') return;
        note(marker.solo, key + ' solo');
        note(marker.pickup, key + ' pickup');
        Object.keys(marker.musicians || {}).forEach(n => note(n, key + ' musicians'));
        Object.keys(marker.instrumentChanges || {}).forEach(n => note(n, key + ' instrument'));
    });

    return Object.entries(seen).map(([name, where]) => ({
        name,
        suggestion: byFolded[fold(name)] || null,
        where: [...where],
    }));
}
