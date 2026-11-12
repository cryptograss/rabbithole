/**
 * The chart as pure functions: turning a song's timeline into times, parts
 * and who is playing when. Nothing here needs a Webamp or a DOM.
 */
import { describe, it, expect } from 'vitest';
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
		expect( processed[ 3 ] ).toMatchObject( { part: 'A', _isSubMoment: true } );
		expect( processed[ 3 ]._isSectionStart ).toBeUndefined();
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
