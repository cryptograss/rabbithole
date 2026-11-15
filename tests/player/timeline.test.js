/**
 * The chart as pure functions: turning a song's timeline into times, parts
 * and who is playing when. Nothing here needs a Webamp or a DOM.
 */
import { describe, it, expect } from 'vitest';
import {
	processTimeline, songParts, songPartTimes, currentPartIndex, currentArrangement,
	currentInstruments, musicianStatus, baseWeights, cards, soloistOf, soloistsOf,
	singersOf, micOrder, effectsAt, nextMarker,
} from '../../src/player/timeline.js';
import { isVoice } from '../../src/instruments.js';
import { soundcheckTimeline } from '../../src/soundcheck.js';

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

	it( 'says when the chart next has something to say', () => {
		expect( nextMarker( processed, 0 ) ).toBe( 10 );
		expect( nextMarker( processed, 10 ) ).toBe( 20 );
		expect( nextMarker( processed, 20 ) ).toBeNull();
	} );
} );

/*
 * The light moves and the pickers stay where they stand; only a singer
 * changes places (Justin, #visual-effects, 15 Nov 2026).
 */
describe( 'the order of the cards', () => {
	const track = {
		ensemble: {
			'Justin Holmes': [ 'guitar', 'vocals' ], 'Kyle Tuttle': [ '5-string banjo' ],
			'Maddie Denton': [ 'fiddle' ], 'Lauren Luz': [ 'vocals' ],
		},
		timeline: {
			0: { part: 'intro', musicians: { band: 'in' } },
			10: { part: 'A', solo: 'Kyle Tuttle' },
			20: { part: 'A', solo: 'Lauren Luz' },
			30: { part: 'B', solo: 'Maddie Denton' },
			40: { part: 'A', solo: 'Justin Holmes', instrumentChanges: { 'Justin Holmes': 'vocals' } },
			50: { part: 'B', solo: 'Justin Holmes' },
		},
	};
	const processed = processTimeline( track );
	const order = ( time ) => cards( track, processed, time ).slice().sort( ( a, b ) => a.weight - b.weight ).map( ( c ) => c.name );

	it( 'numbers the ensemble in its own order', () => {
		expect( baseWeights( { a: [], b: [], c: [] } ) ).toEqual( { a: 100, b: 110, c: 120 } );
	} );

	it( 'leaves a picker where they stand for a break', () => {
		expect( order( 5 ) ).toEqual( [ 'Justin Holmes', 'Kyle Tuttle', 'Maddie Denton', 'Lauren Luz' ] );
		expect( order( 15 ) ).toEqual( order( 5 ) );
		expect( cards( track, processed, 15 ).find( ( c ) => c.name === 'Kyle Tuttle' ) )
			.toMatchObject( { scene: 'lead', star: true, singing: false } );
	} );

	it( 'knows a voice by its name, and an instrument that only sounds like one', () => {
		for ( const voice of [ 'vocals', 'Vocals', 'harmony vocals', 'lead vocal', 'voice', 'throatsinging',
			'throat singing', 'guitar/ throatsinging', 'vocals and guitar', 'guitar, vocals', 'singing' ] ) {
			expect( isVoice( voice ), voice ).toBe( true );
		}
		for ( const instrument of [ 'guitar', 'tin whistle', 'six-whistle', 'single-row melodeon', 'singing saw',
			'singing bowl', 'voice flute', 'no one cares', '', undefined, null ] ) {
			expect( isVoice( instrument ), String( instrument ) ).toBe( false );
		}
	} );

	it( 'knows a singer by what they have in hand when they take it', () => {
		// Somebody whose only instrument is their voice, and somebody who
		// put the guitar down for the verse.
		expect( singersOf( track, currentArrangement( processed, 25 ) ) ).toEqual( [ 'Lauren Luz' ] );
		expect( singersOf( track, currentArrangement( processed, 45 ) ) ).toEqual( [ 'Justin Holmes' ] );
		// The same picker taking it on the guitar is a break, not a verse.
		expect( singersOf( track, currentArrangement( processed, 55 ) ) ).toEqual( [] );
		expect( singersOf( track, currentArrangement( processed, 15 ) ) ).toEqual( [] );
		expect( singersOf( track, { feature: { 'Lauren Luz': 'harmony' } } ) ).toEqual( [ 'Lauren Luz' ] );
		expect( singersOf( track, { solo: [ 'Lauren Luz', 'Kyle Tuttle' ] } ) ).toEqual( [ 'Lauren Luz' ] );
	} );

	it( 'brings a singer to the front, with the microphone and not the star', () => {
		expect( order( 25 ) ).toEqual( [ 'Lauren Luz', 'Justin Holmes', 'Kyle Tuttle', 'Maddie Denton' ] );
		expect( cards( track, processed, 25 ).find( ( c ) => c.name === 'Lauren Luz' ) )
			.toMatchObject( { scene: 'lead', singing: true, star: false, weight: 1 } );
	} );

	it( 'keeps whoever has sung at the front, the latest singer first', () => {
		// The fiddle's break: Lauren has stopped singing and stays put.
		expect( order( 35 ) ).toEqual( [ 'Lauren Luz', 'Justin Holmes', 'Kyle Tuttle', 'Maddie Denton' ] );
		expect( cards( track, processed, 35 ).find( ( c ) => c.name === 'Lauren Luz' ).singing ).toBe( false );
		expect( micOrder( track, processed, 45 ) ).toEqual( [ 'Justin Holmes', 'Lauren Luz' ] );
		expect( order( 55 ) ).toEqual( [ 'Justin Holmes', 'Lauren Luz', 'Kyle Tuttle', 'Maddie Denton' ] );
	} );

	it( 'reads the order off the chart, so seeking back puts everybody back', () => {
		expect( micOrder( track, processed, 15 ) ).toEqual( [] );
		expect( order( 15 ) ).toEqual( [ 'Justin Holmes', 'Kyle Tuttle', 'Maddie Denton', 'Lauren Luz' ] );
	} );

	it( 'still wears a named scene, in place', () => {
		const featured = { ...track, timeline: { 0: { part: 'A', feature: { 'Kyle Tuttle': 'cooldown', 'Maddie Denton': 'kazoo solo' } } } };
		const list = cards( featured, processTimeline( featured ), 0 );
		expect( list.find( ( c ) => c.name === 'Kyle Tuttle' ) ).toMatchObject( { scene: 'cooldown', weight: 110 } );
		expect( list.find( ( c ) => c.name === 'Maddie Denton' ) ).toMatchObject( { scene: 'kazoo solo', weight: 120 } );
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

	it( 'stars the soloist where they stand, and names the pickup', () => {
		const at0 = cards( track, processed, 0 );
		expect( at0.find( ( c ) => c.name === 'Maddie Denton' ).scene ).toBe( 'pickup' );

		const at50 = cards( track, processed, 50 );
		const harry = at50.find( ( c ) => c.name === 'Harry Clark' );
		expect( harry ).toMatchObject( { scene: 'lead', star: true, weight: 110 } );
		expect( at50.slice().sort( ( a, b ) => a.weight - b.weight )[ 0 ].name ).toBe( 'Justin Holmes' );
	} );

	it( 'says how long the arrangement in force lasts, so a pickup knows how long it has', () => {
		expect( cards( track, processed, 20 )[ 0 ] ).toMatchObject( { since: 0, until: 46.7 } );
		expect( cards( track, processed, 50 )[ 0 ] ).toMatchObject( { since: 46.7, until: Infinity } );
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
 * is starred.
 */
describe( 'more than one soloist', () => {
	const two = { part: 'B', solo: [ 'Justin Holmes', 'Skyler Golden' ] };

	it( 'names them all, the first of them as the soloist', () => {
		expect( soloistsOf( two ) ).toEqual( [ 'Justin Holmes', 'Skyler Golden' ] );
		expect( soloistsOf( { solo: 'Kuba Hejhal' } ) ).toEqual( [ 'Kuba Hejhal' ] );
		expect( soloistsOf( { part: 'A' } ) ).toEqual( [] );
		expect( soloistOf( two ) ).toBe( 'Justin Holmes' );
	} );

	it( 'stars both cards', () => {
		const track = { ensemble: { 'Justin Holmes': [ 'guitar' ], 'Skyler Golden': [ 'bass' ], 'Kuba Hejhal': [ 'fiddle' ] },
			timeline: { 0: { part: 'A', musicians: { band: 'in' } }, 200: two } };
		const processed = processTimeline( track );
		const starred = cards( track, processed, 201 )
			.filter( ( c ) => c.star ).map( ( c ) => c.name ).sort();
		expect( starred ).toEqual( [ 'Justin Holmes', 'Skyler Golden' ] );
	} );
} );

/*
 * An effect is a span of the song: in force while the playhead is inside
 * it, whatever brought the playhead there.
 */
describe( 'the effects in force', () => {
	const track = {
		ensemble: { 'Justin Holmes': [ 'mandolin' ], 'Cory Walker': [ 'banjo' ], 'Kaitlyn Raitz': [ 'cello' ] },
		timeline: {
			0: { part: 'A', musicians: { 'Justin Holmes': 'in' } },
			10: { musicians: { band: 'in' } },
			20: { flourish: 'Cory Walker', flourishColor: 'gold', flourishDuration: 2, flourishIntensity: 0.8, flourishPulseSpeed: 2 },
			30: { bandFlash: true },
			40: { solo: 'Kaitlyn Raitz', spotlight: 'Kaitlyn Raitz', spotlightBlackout: 5, spotlightGlow: 3.5 },
			60: { musicians: { 'Cory Walker': 'out' } },
			70: { flourish: 'Cory Walker', flourishDuration: 500 },
		},
	};
	const processed = processTimeline( track );
	const at = ( time ) => effectsAt( track, processed, time );
	const kinds = ( time ) => at( time ).map( ( e ) => e.kind + ( e.target ? ':' + e.target : '' ) ).sort();

	it( 'has nothing in force where the chart asks for nothing', () => {
		expect( at( 5 ) ).toEqual( [] );
		expect( at( 15 ) ).toEqual( [] );
	} );

	it( 'holds a flourish for as long as the chart asks, as the chart describes it', () => {
		expect( at( 20 ) ).toEqual( [ {
			key: 'flourish:Cory Walker:20', kind: 'flourish', target: 'Cory Walker',
			start: 20, end: 22, color: 'gold', intensity: 0.8, pulse: 2,
		} ] );
		expect( kinds( 21.9 ) ).toEqual( [ 'flourish:Cory Walker' ] );
		expect( kinds( 22 ) ).toEqual( [] );
	} );

	it( 'is the same effect on every tick, by its key', () => {
		expect( at( 20.1 )[ 0 ].key ).toBe( at( 21.5 )[ 0 ].key );
	} );

	it( 'is in force wherever the playhead lands inside it, and not after', () => {
		// A seek into the middle, with nothing having "fired".
		expect( kinds( 42 ) ).toEqual( [ 'spotlight:Kaitlyn Raitz' ] );
		expect( kinds( 39.9 ) ).toEqual( [] );
		expect( kinds( 49 ) ).toEqual( [] );
	} );

	it( 'gives a spotlight its dark and then its glow, as long as the chart asks for each', () => {
		expect( at( 40 )[ 0 ] ).toMatchObject( { dark: true, start: 40, end: 48.5, color: 'coral' } );
		expect( at( 44.9 )[ 0 ].dark ).toBe( true );
		expect( at( 45 )[ 0 ].dark ).toBe( false );
		expect( at( 48.4 )[ 0 ].dark ).toBe( false );
	} );

	it( 'flashes the whole band, as nobody in particular', () => {
		expect( at( 30.2 ) ).toMatchObject( [ { kind: 'bandFlash', target: null, color: 'coral', intensity: 0.5 } ] );
		expect( at( 31 ) ).toEqual( [] );
	} );

	it( 'says who came in, where they came in, and not who was already there', () => {
		expect( kinds( 10.5 ) ).toEqual( [ 'enter:Cory Walker', 'enter:Kaitlyn Raitz' ] );
		expect( kinds( 11 ) ).toEqual( [] );
		// Nobody arrives at the top of a song, and dropping out is not arriving.
		expect( kinds( 0.2 ) ).toEqual( [] );
		expect( kinds( 60.2 ) ).toEqual( [] );
	} );

	it( 'bounds what a typing mistake can ask for', () => {
		expect( at( 70 )[ 0 ].end ).toBe( 82 );
	} );

	it( 'is only ever for somebody who has a card', () => {
		// "Kaitlyn" is nobody's card: the pane used to go dark for her anyway.
		const typo = {
			ensemble: track.ensemble,
			engineer: 'Jake Stargel',
			timeline: {
				0: { part: 'A' },
				10: { spotlight: 'Kaitlyn', flourish: [ 'Cory', 'Justin Holmes' ] },
				20: { flourish: 'Jake Stargel' },
			},
		};
		const done = processTimeline( typo );
		expect( effectsAt( typo, done, 10.5 ).map( ( e ) => e.key ) ).toEqual( [ 'flourish:Justin Holmes:10' ] );
		// The engineer has a card, at the foot of the list.
		expect( effectsAt( typo, done, 20.5 ).map( ( e ) => e.key ) ).toEqual( [ 'flourish:Jake Stargel:20' ] );
	} );

	it( 'has one spotlight at a time: a later one takes the stage, and the earlier does not come back', () => {
		const two = {
			ensemble: track.ensemble,
			timeline: {
				0: { part: 'A' },
				10: { spotlight: 'Kaitlyn Raitz', spotlightBlackout: 8, spotlightGlow: 6 },
				12: { spotlight: 'Cory Walker', spotlightBlackout: 2, spotlightGlow: 0 },
			},
		};
		const done = processTimeline( two );
		const spots = ( time ) => effectsAt( two, done, time ).filter( ( e ) => e.kind === 'spotlight' ).map( ( e ) => e.target );
		expect( spots( 11 ) ).toEqual( [ 'Kaitlyn Raitz' ] );
		expect( spots( 13 ) ).toEqual( [ 'Cory Walker' ] );
		// Cory's is over at 14, and Kaitlyn's would have run to 24.
		expect( spots( 15 ) ).toEqual( [] );
	} );

	it( 'has one of everything in the soundcheck', () => {
		const band = [ 'a', 'b', 'c', 'd', 'e', 'f' ];
		const check = { ensemble: Object.fromEntries( band.map( ( n ) => [ n, [ 'guitar' ] ] ) ), timeline: soundcheckTimeline( band ) };
		const done = processTimeline( check );
		const seen = new Set();
		const scenes = new Set();
		let moved = false;
		for ( let t = 0; t < 52; t += 0.25 ) {
			effectsAt( check, done, t ).forEach( ( e ) => seen.add( e.kind ) );
			cards( check, done, t ).forEach( ( c ) => {
				scenes.add( c.scene );
				moved = moved || ( c.singing && c.weight === 1 );
			} );
		}
		expect( [ ...seen ].sort() ).toEqual( [ 'bandFlash', 'enter', 'flourish', 'spotlight' ] );
		expect( scenes ).toContain( 'lead' );
		expect( scenes ).toContain( 'pickup' );
		expect( scenes ).toContain( 'out' );
		expect( moved ).toBe( true );
	} );
} );
