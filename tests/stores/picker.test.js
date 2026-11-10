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
			current: 'Song:August', played: new Set( [ 'Song:Victory' ] ), queuedCids: [], cidOf,
		} );
		expect( next ).toEqual( { song: 'Song:Silver 44', cid: 'Qs' } );
	} );

	it( 'skips songs with no recording and songs already queued', async () => {
		const next = await firstPlayable( [ 'Song:Unrecorded', 'Song:Victory', 'Song:Silver 44' ], {
			current: null, played: new Set(), queuedCids: [ 'Qv' ], cidOf,
		} );
		expect( next ).toEqual( { song: 'Song:Silver 44', cid: 'Qs' } );
	} );

	it( 'is null when there is nothing left to play', async () => {
		expect( await firstPlayable( [ 'Song:August' ], {
			current: 'Song:August', played: new Set(), queuedCids: [], cidOf,
		} ) ).toBe( null );
	} );
} );

describe( 'personName', () => {
	it( 'spells a page title the way the graph spells a person', () => {
		expect( personName( 'Kyle_Tuttle' ) ).toBe( 'Kyle Tuttle' );
	} );
} );
