/**
 * The four built-in songs, with hand-written timelines the wiki does not
 * have yet. The app opens on August when no ?track= is given; the others
 * are reachable from the demo selector. Each names a trackCid, which
 * resolveDemoSong() turns into audio from IPFS.
 */

export const defaultColorScheme = {
	solo: { border: '#4a7c59', background: 'rgba(74, 124, 89, 0.1)', textColor: '#2d5016', glowColor: 'rgba(74, 124, 89, 0.4)' },
	pickup: { border: '#87a96b', background: 'rgba(135, 169, 107, 0.1)', textColor: '#5a7a4a' },
};

export const demoSongs = {
	august: {
		title: 'August',
		album: 'Vowel Sounds',
		duration: 180,
		trackCid: 'QmS3QEZFa1c75BBa9vwNEsXkS6GBmS75Cs6RyDJBXqRx8a',
		ensemble: {
			'Justin Holmes': [ 'guitar', 'tin whistle' ],
			'Kyle Tuttle': [ '5-string banjo' ],
			'Harry Clark': [ 'mandolin' ],
			'Maddie Denton': [ 'fiddle' ],
			'Skyler Golden': [ 'bass' ],
			'Gaven Largent': [ 'dobro' ],
		},
		timeline: {
			0: {
				musicians: {
					'Justin Holmes': 'in', 'Kyle Tuttle': 'out', 'Harry Clark': 'out',
					'Maddie Denton': 'out', 'Skyler Golden': 'out', 'Gaven Largent': 'out',
				},
				solo: 'Justin Holmes',
				part: 'intro',
			},
			7.2: { musicians: { 'Maddie Denton': 'in' }, pickup: 'Maddie Denton' },
			8.3: { musicians: { band: 'in' }, solo: 'Maddie Denton', part: 'A' },
			22: { solo: 'Justin Holmes', part: 'A', instrumentChanges: { 'Justin Holmes': 'tin whistle' } },
			36: { solo: 'Justin Holmes', part: 'B' },
			50: { solo: 'Harry Clark', part: 'A' },
			64: { solo: 'Harry Clark', part: 'A' },
			78: { solo: 'Kyle Tuttle', part: 'B' },
			92: { solo: 'Justin Holmes', part: 'A' },
			106: { solo: 'Justin Holmes', part: 'A' },
			120: { solo: 'Justin Holmes', part: 'B' },
			134: { solo: 'Maddie Denton', part: 'B' },
			148: { solo: 'Justin Holmes', part: 'outro' },
		},
		standardSectionLength: 13.68,
	},
	'silver-44': {
		title: 'Silver 44',
		album: '4masks',
		duration: 215,
		trackCid: 'QmXJ8Ko7nx4SDrvRh3J5AZDjHf46UWbW3SaVymRhEhqHBv',
		ensemble: {
			'Justin Holmes': [ 'guitar', 'tin whistle', 'vocals' ],
			'Kyle Tuttle': [ '5-string banjo' ],
			'Harry Clark': [ 'mandolin' ],
			'Maddie Denton': [ 'fiddle' ],
			'Skyler Golden': [ 'bass' ],
		},
		timeline: {
			0: { musicians: { band: 'in' }, solo: 'Kyle Tuttle', part: 'intro' },
			21.5: { solo: 'Justin Holmes', part: 'A', instrumentChanges: { 'Justin Holmes': 'tin whistle' } },
			43: { solo: 'Justin Holmes', part: 'A' },
			64.5: { solo: 'Justin Holmes', part: 'B' },
			86: { solo: 'Justin Holmes', part: 'B' },
			107.5: { solo: 'Harry Clark', part: 'A' },
			129: { solo: 'Harry Clark', part: 'A' },
			150.5: { solo: 'Maddie Denton', part: 'B' },
			172: { solo: 'Kyle Tuttle', part: 'B' },
			193.5: { solo: 'Justin Holmes', part: 'outro' },
		},
		standardSectionLength: 21.5,
	},
	'barlows-jig': {
		title: "Barlow's Jig",
		album: 'Vowel Sounds',
		duration: 160,
		trackCid: 'QmX4AtCi3kZr3up9KhVG18nZxbtJ1vrMpWj3J1FeSUHLmN',
		ensemble: {
			'Justin Holmes': [ 'guitar' ],
			'Kyle Tuttle': [ '5-string banjo' ],
			'Harry Clark': [ 'mandolin' ],
			'Maddie Denton': [ 'fiddle' ],
			'Skyler Golden': [ 'bass' ],
			'Gaven Largent': [ 'dobro' ],
		},
		timeline: {
			0: { musicians: { band: 'in' }, solo: 'Maddie Denton', part: 'A' },
			16: { solo: 'Maddie Denton', part: 'A' },
			32: { solo: 'Maddie Denton', part: 'B' },
			48: { solo: 'Maddie Denton', part: 'B' },
			64: { solo: 'Harry Clark', part: 'A' },
			80: { solo: 'Harry Clark', part: 'A' },
			96: { solo: 'Kyle Tuttle', part: 'B' },
			112: { solo: 'Kyle Tuttle', part: 'B' },
			128: { solo: 'Maddie Denton', part: 'A' },
			144: { solo: 'Maddie Denton', part: 'outro' },
		},
		standardSectionLength: 16,
	},
	'paint-exchange': {
		title: 'Paint Exchange',
		album: '4masks',
		duration: 240,
		trackCid: 'QmcBuh5HCvVCCdCz6KqWf891QkXeKc3T7QBaToYE8mSLtS',
		ensemble: {
			'Justin Holmes': [ 'mandolin', 'throatsinging' ],
			'Cory Walker': [ '5-string banjo' ],
			'Samson Grisman': [ 'bass' ],
			'John Mailander': [ 'fiddle' ],
			'Kaitlyn Raitz': [ 'cello' ],
			'Harry Clark': [ 'guitar' ],
		},
		timeline: {
			0: {
				musicians: {
					'Justin Holmes': 'in', 'Cory Walker': 'out', 'Samson Grisman': 'out',
					'John Mailander': 'out', 'Kaitlyn Raitz': 'out', 'Harry Clark': 'out',
				},
				solo: 'Justin Holmes',
				part: 'A',
			},
			13: { musicians: { band: 'in' } },
			27: { solo: 'John Mailander' },
			47: { part: 'B' },
			59: { part: 'A' },
			72: { solo: 'Kaitlyn Raitz' },
			83: { solo: 'Harry Clark' },
			106: { solo: 'Samson Grisman', part: 'B' },
			118: { solo: 'Cory Walker', part: 'A' },
			166: { solo: 'John Mailander', part: 'B' },
			183: { solo: 'Justin Holmes', instrumentChanges: { 'Justin Holmes': 'throatsinging' } },
			190: { part: 'A' },
		},
		standardSectionLength: 20,
	},
};

/** The demo selector's labels, long and short (the album is the cover's job on a phone). */
export const demoLabels = Object.fromEntries(
	Object.entries( demoSongs ).map( ( [ key, s ] ) => [ key, { long: `${ s.title } - ${ s.album }`, short: s.title } ] )
);
