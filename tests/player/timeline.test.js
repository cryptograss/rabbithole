/**
 * The player's pure logic: turning a song's timeline into times, parts and
 * who is playing when.
 *
 * These call methods on the prototype rather than constructing the player,
 * because the constructor builds a Webamp and a DOM. Everything here reads
 * only `this.trackData` and the caches it sets.
 */
import { describe, it, expect } from 'vitest';
import WebampChartifacts from '../../src/player/webamp-chartifacts.js';

// A receiver with the prototype behind it, so the methods under test can call
// their siblings, but without running the constructor -- which builds a Webamp
// and a DOM.
function player( fields ) {
	return Object.assign( Object.create( WebampChartifacts.prototype ), fields );
}

function withTrack( trackData, extra = {} ) {
	return player( { trackData, ...extra } );
}

describe( 'processTimelineKeys', () => {
	it( 'passes a timeline through untouched when there are no sections', () => {
		const timeline = { 0: { part: 'intro' }, 12.5: { part: 'A' } };
		const self = withTrack( { timeline } );

		expect( self.processTimelineKeys() ).toBe( timeline );
	} );

	it( 'lays sections out after the last explicit time, one section length apart', () => {
		const self = withTrack( {
			standardSectionLength: 10,
			timeline: {
				0: { part: 'intro' },
				4: { part: 'intro' },
				section1: { part: 'A' },
				section2: { part: 'B' },
			},
		} );

		const times = Object.keys( self.processTimelineKeys() ).map( Number ).sort( ( a, b ) => a - b );

		// Sections accumulate from the highest explicit time (4), not from 0.
		expect( times ).toEqual( [ 0, 4, 14, 24 ] );
	} );

	it( 'honours a per-section length over the standard one', () => {
		const self = withTrack( {
			standardSectionLength: 10,
			timeline: {
				0: { part: 'intro' },
				section1: { part: 'A', length: 6 },
				section2: { part: 'B' },
			},
		} );

		const times = Object.keys( self.processTimelineKeys() ).map( Number ).sort( ( a, b ) => a - b );

		expect( times ).toEqual( [ 0, 6, 16 ] );
	} );

	it( 'marks section starts, so a part strip can tell them from sub-moments', () => {
		const self = withTrack( {
			standardSectionLength: 10,
			timeline: { section1: { part: 'A', 3: { solo: 'Maddie Denton' } } },
		} );

		const processed = self.processTimelineKeys();

		expect( processed[ 10 ] ).toMatchObject( { part: 'A', _isSectionStart: true } );
		// A sub-moment's key is read as an absolute time, not as an offset
		// inside its section -- so this one lands at 3, before the section it
		// was written inside, and is flagged as a sub-moment rather than a
		// section start. Pinned here as the behaviour, not endorsed as right:
		// it is worth asking whether a sub-moment key should be relative.
		expect( processed[ 3 ] ).toMatchObject( { part: 'A', _isSubMoment: true } );
		expect( processed[ 3 ]._isSectionStart ).toBeUndefined();
	} );

	it( 'caches, so repeated reads during playback do not redo the work', () => {
		const self = withTrack( { standardSectionLength: 10, timeline: { section1: { part: 'A' } } } );

		const first = self.processTimelineKeys();
		const second = self.processTimelineKeys();

		expect( second ).toBe( first );
	} );
} );

describe( 'getMusicianStatus', () => {
	const track = ( {
		timeline: {
			0: { musicians: { band: 'out', 'Justin Holmes': 'in' } },
			10: { musicians: { band: 'in' } },
			20: { musicians: { 'Maddie Denton': 'out' } },
		},
	} );
	const self = () => withTrack( track );

	it( 'reads a musician as out before anything says otherwise', () => {
		expect( self().getMusicianStatus( 'Maddie Denton', 0 ) ).toBe( 'out' );
	} );

	it( 'lets a band shortcut bring everybody in', () => {
		expect( self().getMusicianStatus( 'Maddie Denton', 15 ) ).toBe( 'in' );
	} );

	it( 'lets a later individual entry override the band', () => {
		expect( self().getMusicianStatus( 'Maddie Denton', 25 ) ).toBe( 'out' );
		expect( self().getMusicianStatus( 'Justin Holmes', 25 ) ).toBe( 'in' );
	} );

	it( 'ignores entries in the future', () => {
		expect( self().getMusicianStatus( 'Maddie Denton', 19 ) ).toBe( 'in' );
	} );
} );

describe( 'calculateDynamicWeight', () => {
	// Justin's feature-scene commit (15 September 2025) made several musicians
	// featurable at once. The half of it that styles the cards was lost for
	// thirteen months; this is the half that survived, and these pin it down.
	const fields = {
		trackData: { timeline: {} },
		musicianWeights: { 'Kyle Tuttle': 30 },
		recentSoloists: [],
	};

	it.each( [
		[ 'lead', 1 ],
		[ 'cooldown', 5 ],
		[ 'harmony', 7 ],
		[ 'rhythm', 8 ],
	] )( 'sorts a %s scene to weight %i', ( scene, weight ) => {
		const arrangement = { feature: { 'Kyle Tuttle': scene } };

		expect( player( fields ).calculateDynamicWeight( 'Kyle Tuttle', 0, arrangement ) ).toBe( weight );
	} );

	it( 'gives an unknown scene a middling weight rather than dropping it', () => {
		const arrangement = { feature: { 'Kyle Tuttle': 'kazoo solo' } };

		expect( player( fields ).calculateDynamicWeight( 'Kyle Tuttle', 0, arrangement ) ).toBe( 6 );
	} );

	it( 'still honours the older solo shape, with no feature map', () => {
		const arrangement = { solo: 'Kyle Tuttle' };

		expect( player( fields ).calculateDynamicWeight( 'Kyle Tuttle', 0, arrangement ) ).toBe( 1 );
	} );

	it( 'pushes everybody else down behind the recent soloists', () => {
		const withRecent = player( { ...fields, recentSoloists: [ 'Maddie Denton', 'John Mailander' ] } );

		expect( withRecent.calculateDynamicWeight( 'Kyle Tuttle', 0, null ) ).toBe( 30 + 2 * 5 );
	} );
} );

describe( 'the parts strip as an index into the song', () => {
	// A part and its start time have to come out of the same pass, or clicking
	// the strip seeks to the wrong place the moment the two filters drift.
	const self = withTrack( {
		standardSectionLength: 10,
		timeline: {
			0: { part: 'intro' },
			section1: { part: 'A' },
			section2: { part: 'B' },
		},
	} );

	it( 'gives one start time per part, in the same order', () => {
		const parts = self.extractSongParts();
		const times = self.extractSongPartTimes();

		expect( parts ).toEqual( [ 'intro', 'A', 'B' ] );
		expect( times ).toHaveLength( parts.length );
		expect( times ).toEqual( [ 0, 10, 20 ] );
	} );

	it( 'seeks just past a part start, not exactly onto it', () => {
		const seeked = [];
		const player = withTrack( self.trackData, { webamp: { seekToTime: ( t ) => seeked.push( t ) } } );

		expect( player.seekToPart( 2 ) ).toBe( true );
		expect( seeked[ 0 ] ).toBeGreaterThan( 20 );
		expect( seeked[ 0 ] ).toBeLessThan( 20.5 );
	} );

	it( 'does nothing for a part that is not there', () => {
		const player = withTrack( self.trackData, { webamp: { seekToTime: () => {} } } );

		expect( player.seekToPart( 99 ) ).toBe( false );
	} );
} );
