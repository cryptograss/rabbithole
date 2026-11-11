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
} );

describe( 'personName', () => {
	it( 'spells a page title the way the graph spells a person', () => {
		expect( personName( 'Kyle_Tuttle' ) ).toBe( 'Kyle Tuttle' );
	} );
} );
