/**
 * Which of a picker's songs following them plays next.
 */
import { describe, it, expect } from 'vitest';
import { firstPlayable, personName } from '../../src/stores/picker.js';

const cids = { 'Song:August': 'Qa', 'Song:Victory': 'Qv', 'Song:Silver 44': 'Qs' };
const cidOf = async ( song ) => cids[ song ] || null;

describe( 'firstPlayable', () => {
	it( 'skips the song playing and songs already played', async () => {
		const next = await firstPlayable( [ 'Song:August', 'Song:Victory', 'Song:Silver 44' ], {
			currentCid: 'Qa', playedCids: new Set( [ 'Qv' ] ), queuedCids: [], cidOf,
		} );
		expect( next ).toEqual( { song: 'Song:Silver 44', cid: 'Qs' } );
	} );

	it( 'skips songs with no recording and songs already queued', async () => {
		const next = await firstPlayable( [ 'Song:Unrecorded', 'Song:Victory', 'Song:Silver 44' ], {
			currentCid: null, playedCids: new Set(), queuedCids: [ 'Qv' ], cidOf,
		} );
		expect( next ).toEqual( { song: 'Song:Silver 44', cid: 'Qs' } );
	} );

	it( 'is null when there is nothing left to play', async () => {
		expect( await firstPlayable( [ 'Song:August' ], {
			currentCid: 'Qa', playedCids: new Set(), queuedCids: [], cidOf,
		} ) ).toBe( null );
	} );

	it( 'knows the song playing by its recording, whatever the page calls it', async () => {
		// The page is "Barlow's Jig"; the track playing is titled "Barlows".
		// Compared by title they differed, and Barlows was queued behind
		// itself (Justin, 11 Nov 2026).
		const jig = { "Song:Barlow's Jig": 'Qb', 'Song:Victory': 'Qv' };
		const next = await firstPlayable( [ "Song:Barlow's Jig", 'Song:Victory' ], {
			currentCid: 'Qb', playedCids: new Set(), queuedCids: [], cidOf: async ( s ) => jig[ s ],
		} );
		expect( next ).toEqual( { song: 'Song:Victory', cid: 'Qv' } );
	} );

	it( 'skips a recording the picker is not on, when the song was cut twice', async () => {
		// Harry Clark is on Barlow's Jig from Vowel Sounds. The song's page
		// plays the 4masks recording, with David Grier. Following Harry
		// landed on it (Justin, 11 Nov 2026).
		// A record goes by its page's name and its Release's title; the
		// credit names the page.
		const jig = { "Song:Barlow's Jig": 'Qb4', 'Song:Silver 44': 'Qs' };
		const names = [ '4masks', 'Justin Myles Holmes - 4masks (RC1)' ];
		const harry = { "Song:Barlow's Jig": [ 'Vowel Sounds' ], 'Song:Silver 44': [ '4masks' ] };
		const next = await firstPlayable( [ "Song:Barlow's Jig", 'Song:Silver 44' ], {
			currentCid: null, playedCids: new Set(), queuedCids: [],
			cidOf: async ( s ) => jig[ s ], recordsOf: async () => names, recordsOn: ( s ) => harry[ s ] || [],
		} );
		expect( next ).toEqual( { song: 'Song:Silver 44', cid: 'Qs' } );
	} );

	it( 'rules nothing out when the recording or the credit names no record', async () => {
		const lone = await firstPlayable( [ "Song:Reuben's Train" ], {
			currentCid: null, playedCids: new Set(), queuedCids: [],
			cidOf: async () => 'Qr', recordsOf: async () => [], recordsOn: () => [ 'Vowel Sounds' ],
		} );
		expect( lone ).toEqual( { song: "Song:Reuben's Train", cid: 'Qr' } );

		const uncut = await firstPlayable( [ 'Song:August' ], {
			currentCid: null, playedCids: new Set(), queuedCids: [],
			cidOf: async () => 'Qa', recordsOf: async () => [ '4masks' ], recordsOn: () => [],
		} );
		expect( uncut ).toEqual( { song: 'Song:August', cid: 'Qa' } );
	} );
} );

describe( 'personName', () => {
	it( 'spells a page title the way the graph spells a person', () => {
		expect( personName( 'Kyle_Tuttle' ) ).toBe( 'Kyle Tuttle' );
	} );
} );
