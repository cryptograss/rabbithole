// @vitest-environment happy-dom
/**
 * The walk: where you have been, and who you followed to get there.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { reactive, nextTick } from 'vue';

import { pushed, revive, stored, useWalkStore } from '../../src/stores/walk.js';
import { usePlayerStore } from '../../src/stores/player.js';
import { viaPicker } from '../../src/stores/picker.js';

describe( 'pushed', () => {
	it( 'adds a new recording, and not the one already on', () => {
		const a = { cid: 'Qa' };
		const walk = pushed( [], a );
		expect( walk ).toEqual( [ a ] );
		expect( pushed( walk, { cid: 'Qa' } ) ).toBe( walk );
		expect( pushed( walk, { cid: 'Qb' } ) ).toHaveLength( 2 );
	} );
} );

describe( 'revive and stored', () => {
	it( 'keeps a via with its instrument across a refresh', () => {
		const walk = [ { cid: 'Qs', song: 'Silver 44', via: { name: 'Kyle Tuttle', instrument: 'banjo' }, at: 1 } ];
		expect( revive( stored( walk ) ) ).toEqual( walk );
	} );

	it( 'treats junk as an empty walk', () => {
		expect( revive( 'not json' ) ).toEqual( [] );
		expect( revive( '{"cid":"Qa"}' ) ).toEqual( [] );
	} );
} );

describe( 'viaPicker', () => {
	it( 'names the picker and what they played on the song they led to', () => {
		const graph = { band: { 'Song:Silver 44': { 'Kyle Tuttle': [ 'banjo' ] } } };
		expect( viaPicker( graph, 'Song:Silver 44', 'Kyle Tuttle' ) ).toEqual( { name: 'Kyle Tuttle', instrument: 'banjo' } );
		expect( viaPicker( graph, 'Song:Nowhere', 'Kyle Tuttle' ) ).toEqual( { name: 'Kyle Tuttle', instrument: null } );
	} );
} );

describe( 'useWalkStore', () => {
	beforeEach( () => {
		window.localStorage.clear();
		setActivePinia( createPinia() );
	} );

	it( 'gives a marked hop its via when that recording starts', async () => {
		const player = usePlayerStore();
		// The model as the app makes it: a plain object with a reactive state.
		const model = { state: reactive( { song: { _trackCid: 'Qa', title: 'August' }, upNext: [] } ) };
		player.model = model;
		const walk = useWalkStore();
		// Silver 44 was queued by following Kyle Tuttle: the via is marked
		// before the song starts (the bug: nothing marked it, so every hop
		// said "where you came in").
		walk.mark( 'Qs', { name: 'Kyle Tuttle', instrument: 'banjo' } );
		model.state.song = { _trackCid: 'Qs', title: 'Silver 44' };
		await nextTick();
		expect( walk.hops.map( ( h ) => [ h.cid, h.via && h.via.name ] ) ).toEqual( [
			[ 'Qa', null ], [ 'Qs', 'Kyle Tuttle' ],
		] );
		expect( revive( window.localStorage.getItem( 'rabbithole-walk' ) )[ 1 ].via ).toEqual( { name: 'Kyle Tuttle', instrument: 'banjo' } );
	} );
} );
