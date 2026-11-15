/**
 * The chart as pure functions: turning a song's timeline into times, parts
 * and who is playing when. Nothing here needs a Webamp or a DOM.
 */
import { describe, it, expect } from 'vitest';
import { sectionStarts, happensOnce, entries } from '../../src/player/timeline.js';
import {
	processTimeline, songParts, songPartTimes, currentPartIndex, currentArrangement,
	currentInstruments, musicianStatus, momentTimes, dynamicWeight, baseWeights, cards, soloistOf, soloistsOf,
} from '../../src/player/timeline.js';

describe( 'processTimeline', () => {
	it( 'passes a timeline through untouched when there are no sections', () => {
		const timeline = { 0: { part: 'intro' }, 12.5: { part: 'A' } };
		expect( processTimeline( { timeline } ) ).toBe( timeline );
	} );

	it( 'lays sections out after the last explicit time, one section length apart', () => {
		const processed = processTimeline( {
			standardSectionLength: 10,
			timeline: { 0: { part: 'intro' }, 4: { part: 'intro' }, section1: { part: 'A' }, section2: { part: 'B' } },
		} );
		const times = Object.keys( processed ).map( Number ).sort( ( a, b ) => a - b );
		// Sections accumulate from the highest explicit time (4), not from 0.
		expect( times ).toEqual( [ 0, 4, 14, 24 ] );
	} );

	it( 'honours a per-section length over the standard one', () => {
		const processed = processTimeline( {
			standardSectionLength: 10,
			timeline: { 0: { part: 'intro' }, section1: { part: 'A', length: 6 }, section2: { part: 'B' } },
		} );
		expect( Object.keys( processed ).map( Number ).sort( ( a, b ) => a - b ) ).toEqual( [ 0, 6, 16 ] );
	} );

	it( 'marks section starts, so a part strip can tell them from sub-moments', () => {
		const processed = processTimeline( {
			standardSectionLength: 10,
			timeline: { section1: { part: 'A', 3: { solo: 'Maddie Denton' } } },
		} );
		expect( processed[ 10 ] ).toMatchObject( { part: 'A', _isSectionStart: true } );
		// A sub-moment's key is read as an absolute time, not as an offset
		// inside its section. Pinned as the behaviour, not endorsed as right.
		expect( processed[ 3 ] ).toMatchObject( { solo: 'Maddie Denton', _isSubMoment: true } );
		expect( processed[ 3 ]._isSectionStart ).toBeUndefined();
	} );

	it( 'keeps the section\'s part off its sub-moments: they are inside a pass', () => {
		const processed = processTimeline( {
			standardSectionLength: 10,
			timeline: { section1: { part: 'A', solo: 'Justin Holmes', 3: { pickup: 'Maddie Denton' }, 5: { part: 'B' } } },
		} );
		// The pickup inherits who is playing, not the pass it sits inside:
		// written back out in seconds it would otherwise read as a new A.
		expect( processed[ 3 ].solo ).toBe( 'Justin Holmes' );
		expect( processed[ 3 ].part ).toBeUndefined();
		// A sub-moment that names its own part keeps it.
		expect( processed[ 5 ].part ).toBe( 'B' );
	} );
} );

/*
 * Everything a chart writes at a second is in force at that second: laying
 * the sections out never drops one thing because another lands on it.
 */
describe( 'a moment on the second something else is written', () => {
	// Paint Exchange's shape: no section1, moments kept under the section
	// before the one they sound in, and one of them on a section's start.
	const PAINT = {
		standardSectionLength: 11.75,
		timeline: {
			'0': { part: 'A' },
			section2: {
				'28': { flourish: 'John Mailander', flourishColor: 'gold' },
				'12.8': { musicians: { band: 'in' } },
				'23.5': { flourish: 'John Mailander', flourishDuration: 5, flourishIntensity: 0.4 },
			},
			section3: { part: 'A', '36': { flourish: 'Justin Holmes' } },
			section4: {},
			section5: { part: 'B', bandFlash: true },
		},
	};

	it( 'keeps a moment written where a later section starts, as part of how that section starts', () => {
		const processed = processTimeline( PAINT );
		// section2 is at 11.75 and section3 at 23.5, which is where the moment is.
		expect( processed[ 23.5 ] ).toEqual( {
			part: 'A', flourish: 'John Mailander', flourishDuration: 5, flourishIntensity: 0.4, _isSectionStart: true,
		} );
		// Nothing else moved, and the parts strip is what it was.
		expect( entries( processed ).map( ( e ) => e.time ) ).toEqual( [ 0, 11.75, 12.8, 23.5, 28, 35.25, 36, 47 ] );
		expect( songParts( processed ) ).toEqual( [ 'A', 'A', 'B' ] );
	} );

	it( 'keeps a moment written on its own section\'s first second', () => {
		const processed = processTimeline( {
			standardSectionLength: 10,
			timeline: { '0': { part: 'intro' }, section1: { part: 'A', solo: 'Kyle Tuttle', '10': { flourish: 'Gaven Largent' } } },
		} );
		expect( processed[ 10 ] ).toEqual( { part: 'A', solo: 'Kyle Tuttle', flourish: 'Gaven Largent', _isSectionStart: true } );
	} );

	it( 'lets the moment have the last word for that second, as it does anywhere in a pass', () => {
		const processed = processTimeline( {
			standardSectionLength: 10,
			timeline: { '0': {}, section1: { '20': { solo: 'Maddie Denton' } }, section2: { part: 'B', solo: 'Kyle Tuttle' } },
		} );
		expect( processed[ 20 ] ).toEqual( { part: 'B', solo: 'Maddie Denton', _isSectionStart: true } );
	} );

	it( 'keeps both a marker written in seconds and a moment written on it', () => {
		const marker = { part: 'intro', solo: 'Justin Holmes' };
		const processed = processTimeline( {
			standardSectionLength: 10,
			timeline: { '0': marker, '4': { part: 'A' }, section1: { part: 'B', '0': { flourish: 'Kyle Tuttle' } } },
		} );
		expect( processed[ 0 ] ).toEqual( { part: 'intro', solo: 'Justin Holmes', flourish: 'Kyle Tuttle' } );
		// A marker with nothing written on it is the chart's own object still.
		expect( processTimeline( { standardSectionLength: 10, timeline: { '0': marker, section1: {} } } )[ 0 ] ).toBe( marker );
	} );
} );

describe( 'what a moment takes from its pass', () => {
	it( 'is who is playing, and nothing that happens once', () => {
		expect( [ 'part', 'flourish', 'flourishDuration', 'flourishColor', 'spotlight', 'spotlightBlackout',
			'spotlightGlow', 'bandFlash', 'bandFlashDuration' ].every( happensOnce ) ).toBe( true );
		expect( [ 'solo', 'pickup', 'musicians', 'instrumentChanges', 'feature', 'length' ].some( happensOnce ) ).toBe( false );
	} );

	it( 'does not fire the pass\'s lights again at every moment inside it', () => {
		const processed = processTimeline( {
			standardSectionLength: 10,
			timeline: {
				section1: {
					part: 'B', solo: 'Kaitlyn Raitz', bandFlash: true, flourish: 'Cory Walker', flourishDuration: 5,
					spotlight: 'Kaitlyn Raitz', spotlightBlackout: 5,
					'13': { pickup: 'Sam Grisman' },
					'15': { flourish: 'Sam Grisman' },
				},
			},
		} );
		expect( processed[ 13 ] ).toEqual( { solo: 'Kaitlyn Raitz', pickup: 'Sam Grisman', _isSubMoment: true } );
		// Its own flourish, at its own length: the pass's five seconds were the pass's.
		expect( processed[ 15 ] ).toEqual( { solo: 'Kaitlyn Raitz', flourish: 'Sam Grisman', _isSubMoment: true } );
	} );
} );

describe( 'sectionStarts', () => {
	it( 'is each section in order, where it starts, skipping numbers a chart skips', () => {
		const starts = sectionStarts( {
			standardSectionLength: 10,
			timeline: { '0': {}, '4': {}, section7: { part: 'C' }, section2: { part: 'A', length: 6 }, section3: { part: 'B' } },
		} );
		expect( starts.map( ( s ) => [ s.name, s.time ] ) ).toEqual( [ [ 'section2', 10 ], [ 'section3', 20 ], [ 'section7', 30 ] ] );
		expect( starts[ 0 ].data ).toEqual( { part: 'A', length: 6 } );
	} );

	it( 'reads every section a chart has, not the first twenty', () => {
		const timeline = { '0': { part: 'intro' } };
		for ( let i = 1; i <= 25; i++ ) {
			timeline[ `section${ i }` ] = { part: i % 2 ? 'A' : 'B' };
		}
		const track = { standardSectionLength: 10, timeline };
		expect( sectionStarts( track ) ).toHaveLength( 25 );
		const processed = processTimeline( track );
		expect( processed[ 250 ] ).toEqual( { part: 'A', _isSectionStart: true } );
		expect( songParts( processed ) ).toHaveLength( 26 );
	} );

	it( 'is not thrown by a key that is neither a time nor a section', () => {
		const starts = sectionStarts( { standardSectionLength: 10, timeline: { '0': {}, notes: 'check the B part', section1: {} } } );
		expect( starts.map( ( s ) => s.time ) ).toEqual( [ 10 ] );
	} );

	it( 'is nothing for a chart with no section length', () => {
		expect( sectionStarts( { timeline: { section1: {} } } ) ).toEqual( [] );
		expect( sectionStarts( null ) ).toEqual( [] );
	} );
} );

describe( 'the parts strip as an index into the song', () => {
	// Explicit times 0 and 4; the sections then run from 4: 14 and 24. The
	// sub-moment inside section1 is at an absolute 13.
	const processed = processTimeline( {
		standardSectionLength: 10,
		timeline: {
			0: { part: 'intro' },
			4: { pickup: 'Harry Clark' },
			section1: { part: 'A', 13: { solo: 'Maddie Denton' } },
			section2: { part: 'B' },
		},
	} );

	it( 'lists the parts in order, skipping sub-moments and markers with no part', () => {
		expect( songParts( processed ) ).toEqual( [ 'intro', 'A', 'B' ] );
	} );

	it( 'gives one start time per part, in the same order', () => {
		expect( songPartTimes( processed ) ).toEqual( [ 0, 14, 24 ] );
	} );

	it( 'knows which part the playhead is in', () => {
		expect( currentPartIndex( processed, 0 ) ).toBe( 0 );
		expect( currentPartIndex( processed, 12 ) ).toBe( 0 );
		expect( currentPartIndex( processed, 15 ) ).toBe( 1 );
		expect( currentPartIndex( processed, 99 ) ).toBe( 2 );
	} );

	it( 'reads the arrangement in force as the latest entry at or before the time', () => {
		expect( currentArrangement( processed, 13.5 ) ).toMatchObject( { solo: 'Maddie Denton' } );
		expect( currentArrangement( processed, 14 ) ).toMatchObject( { part: 'A', _isSectionStart: true } );
		expect( currentArrangement( processed, 3.9 ) ).toMatchObject( { part: 'intro' } );
	} );
} );

describe( 'who is in, and on what', () => {
	const track = {
		ensemble: { 'Justin Holmes': [ 'guitar', 'tin whistle' ], 'Maddie Denton': [ 'fiddle' ] },
		timeline: {
			0: { musicians: { band: 'out', 'Justin Holmes': 'in' } },
			10: { musicians: { band: 'in' } },
			20: { musicians: { 'Maddie Denton': 'out' }, instrumentChanges: { 'Justin Holmes': 'tin whistle' } },
		},
	};
	const processed = processTimeline( track );

	it( 'reads a musician as out before anything says otherwise, and in after the band comes in', () => {
		expect( musicianStatus( processed, 'Maddie Denton', 0 ) ).toBe( 'out' );
		expect( musicianStatus( processed, 'Maddie Denton', 15 ) ).toBe( 'in' );
		expect( musicianStatus( processed, 'Maddie Denton', 25 ) ).toBe( 'out' );
		expect( musicianStatus( processed, 'Justin Holmes', 25 ) ).toBe( 'in' );
	} );

	it( 'starts everyone on their first instrument and applies a change', () => {
		expect( currentInstruments( track, currentArrangement( processed, 5 ) ) ).toEqual( { 'Justin Holmes': 'guitar', 'Maddie Denton': 'fiddle' } );
		expect( currentInstruments( track, currentArrangement( processed, 25 ) )[ 'Justin Holmes' ] ).toBe( 'tin whistle' );
	} );

	it( 'finds the moments somebody comes in or drops out, after the top', () => {
		expect( momentTimes( track.timeline ) ).toEqual( [ 10, 20 ] );
	} );
} );

describe( 'the order of the cards', () => {
	it.each( [
		[ 'lead', 1 ], [ 'cooldown', 5 ], [ 'harmony', 7 ], [ 'rhythm', 8 ],
	] )( 'sorts a %s scene to weight %i', ( scene, weight ) => {
		expect( dynamicWeight( 'Kyle Tuttle', { feature: { 'Kyle Tuttle': scene } } ) ).toBe( weight );
	} );

	it( 'gives an unknown scene a middling weight rather than dropping it', () => {
		expect( dynamicWeight( 'Kyle Tuttle', { feature: { 'Kyle Tuttle': 'kazoo solo' } } ) ).toBe( 6 );
	} );

	it( 'still honours the older solo shape, with no feature map', () => {
		expect( dynamicWeight( 'Kyle Tuttle', { solo: 'Kyle Tuttle' } ) ).toBe( 1 );
	} );

	it( 'pushes everybody else down behind the recent soloists', () => {
		const base = { 'Kyle Tuttle': 30 };
		expect( dynamicWeight( 'Kyle Tuttle', null, { baseWeights: base, recentSoloists: [ 'Maddie Denton', 'John Mailander' ] } ) ).toBe( 30 + 2 * 5 );
		expect( dynamicWeight( 'Maddie Denton', null, { baseWeights: base, recentSoloists: [ 'Maddie Denton', 'John Mailander' ] } ) ).toBe( 10 );
	} );

	it( 'numbers the ensemble in its own order', () => {
		expect( baseWeights( { a: [], b: [], c: [] } ) ).toEqual( { a: 100, b: 110, c: 120 } );
	} );
} );

describe( 'cards', () => {
	const track = {
		ensemble: { 'Justin Holmes': [ 'guitar' ], 'Harry Clark': [ 'mandolin' ], 'Maddie Denton': [ 'fiddle' ] },
		engineer: 'Sean Sullivan',
		timeline: {
			0: { part: 'intro', pickup: 'Maddie Denton', musicians: { band: 'in' } },
			46.7: { part: 'A', solo: 'Harry Clark' },
		},
	};
	const processed = processTimeline( track );

	it( 'is one card per person, with the engineer last', () => {
		const list = cards( track, processed, 0 );
		expect( list.map( ( c ) => c.name ) ).toEqual( [ 'Justin Holmes', 'Harry Clark', 'Maddie Denton', 'Sean Sullivan' ] );
		expect( list[ 3 ] ).toMatchObject( { engineer: true, instrument: 'console' } );
	} );

	it( 'puts the soloist first, starred, and names the pickup', () => {
		const at0 = cards( track, processed, 0 );
		expect( at0.find( ( c ) => c.name === 'Maddie Denton' ).scene ).toBe( 'pickup' );

		const solo = soloistOf( currentArrangement( processed, 50 ) );
		const at50 = cards( track, processed, 50, { currentSolo: solo } );
		const harry = at50.find( ( c ) => c.name === 'Harry Clark' );
		expect( harry ).toMatchObject( { scene: 'lead', star: true, weight: 1 } );
		expect( at50.slice().sort( ( a, b ) => a.weight - b.weight )[ 0 ].name ).toBe( 'Harry Clark' );
	} );

	it( 'leaves a pickup where it is in the order', () => {
		// It used to sort to 5, which walked the card to second place and
		// then to first a beat later when they took it (Justin, item 21,
		// 15 Nov 2026). Maddie is third in the ensemble and stays third.
		const at0 = cards( track, processed, 0 );
		const order = at0.filter( ( c ) => ! c.engineer ).sort( ( a, b ) => a.weight - b.weight ).map( ( c ) => c.name );
		expect( order ).toEqual( [ 'Justin Holmes', 'Harry Clark', 'Maddie Denton' ] );

		// A named pickup scene is the same: seen, not re-sorted.
		const featured = { ...track, timeline: { 0: { part: 'intro', feature: { 'Maddie Denton': 'pickup' } } } };
		const list = cards( featured, processTimeline( featured ), 0 );
		expect( list.find( ( c ) => c.name === 'Maddie Denton' ).weight )
			.toBe( list.find( ( c ) => c.name === 'Justin Holmes' ).weight + 20 );
	} );

	it( 'reads nobody soloing as null, so "nobody" equals "nobody"', () => {
		expect( soloistOf( { part: 'A' } ) ).toBeNull();
		expect( soloistOf( undefined ) ).toBeNull();
	} );
} );

/*
 * More than one person takes it at once: a cappella harmony on Reuben's
 * Train (Justin, 12 Nov 2026). `solo` is then a list, and every name on it
 * is starred and weighted as the lead.
 */
describe( 'more than one soloist', () => {
	const two = { part: 'B', solo: [ 'Justin Holmes', 'Skyler Golden' ] };

	it( 'names them all, the first of them as the soloist', () => {
		expect( soloistsOf( two ) ).toEqual( [ 'Justin Holmes', 'Skyler Golden' ] );
		expect( soloistsOf( { solo: 'Kuba Hejhal' } ) ).toEqual( [ 'Kuba Hejhal' ] );
		expect( soloistsOf( { part: 'A' } ) ).toEqual( [] );
		expect( soloistOf( two ) ).toBe( 'Justin Holmes' );
	} );

	it( 'weights each of them as the lead', () => {
		expect( dynamicWeight( 'Skyler Golden', two ) ).toBe( 1 );
		expect( dynamicWeight( 'Justin Holmes', two ) ).toBe( 1 );
		expect( dynamicWeight( 'Kuba Hejhal', two ) ).toBe( 100 );
	} );

	it( 'stars both cards', () => {
		const track = { ensemble: { 'Justin Holmes': [ 'guitar' ], 'Skyler Golden': [ 'bass' ], 'Kuba Hejhal': [ 'fiddle' ] },
			timeline: { 0: { part: 'A', musicians: { band: 'in' } }, 200: two } };
		const processed = processTimeline( track );
		const starred = cards( track, processed, 201, { currentSolo: soloistOf( currentArrangement( processed, 201 ) ) } )
			.filter( ( c ) => c.star ).map( ( c ) => c.name ).sort();
		expect( starred ).toEqual( [ 'Justin Holmes', 'Skyler Golden' ] );
	} );
} );
