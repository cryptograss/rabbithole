/**
 * The song the app opens on when no ?track= is given, and the colours a
 * song's cards wear. The selector's list is not here: it is every track
 * with a chart on the wiki (wiki/api.js chartedTracks), so charting a song
 * is what puts it there. It used to be four songs hardcoded here, with
 * hand-written copies of their charts; nothing said why those four
 * (Justin, 7 Nov 2026), and the copies hid the wiki's flourishes.
 */

export const defaultColorScheme = {
	solo: { border: '#4a7c59', background: 'rgba(74, 124, 89, 0.1)', textColor: '#2d5016', glowColor: 'rgba(74, 124, 89, 0.4)' },
	pickup: { border: '#87a96b', background: 'rgba(135, 169, 107, 0.1)', textColor: '#5a7a4a' },
};

/** August, from Vowel Sounds. */
export const DEFAULT_TRACK = 'QmS3QEZFa1c75BBa9vwNEsXkS6GBmS75Cs6RyDJBXqRx8a';
