/**
 * The four built-in songs: the app opens on August when no ?track= is
 * given, and the others are reachable from the demo selector. Each is only
 * a name and a trackCid. Its chart, ensemble and audio come from the wiki,
 * the same way a link's do (loadTrack), so there is one chart per song and
 * the one the editor saves is the one that plays. They used to carry
 * hand-written copies of their charts, which the player played and the
 * editor then saved over the wiki's: Justin's flourishes on August and
 * Paint Exchange lived only on the wiki and never fired (7 Nov 2026).
 */

export const defaultColorScheme = {
	solo: { border: '#4a7c59', background: 'rgba(74, 124, 89, 0.1)', textColor: '#2d5016', glowColor: 'rgba(74, 124, 89, 0.4)' },
	pickup: { border: '#87a96b', background: 'rgba(135, 169, 107, 0.1)', textColor: '#5a7a4a' },
};

export const demoSongs = {
	august: { title: 'August', album: 'Vowel Sounds', trackCid: 'QmS3QEZFa1c75BBa9vwNEsXkS6GBmS75Cs6RyDJBXqRx8a' },
	'silver-44': { title: 'Silver 44', album: '4masks', trackCid: 'QmXJ8Ko7nx4SDrvRh3J5AZDjHf46UWbW3SaVymRhEhqHBv' },
	'barlows-jig': { title: "Barlow's Jig", album: 'Vowel Sounds', trackCid: 'QmX4AtCi3kZr3up9KhVG18nZxbtJ1vrMpWj3J1FeSUHLmN' },
	'paint-exchange': { title: 'Paint Exchange', album: '4masks', trackCid: 'QmcBuh5HCvVCCdCz6KqWf891QkXeKc3T7QBaToYE8mSLtS' },
};

/** The demo selector's labels, long and short (the album is the cover's job on a phone). */
export const demoLabels = Object.fromEntries(
	Object.entries( demoSongs ).map( ( [ key, s ] ) => [ key, { long: `${ s.title } - ${ s.album }`, short: s.title } ] )
);
