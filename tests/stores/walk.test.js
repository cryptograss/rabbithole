// @vitest-environment happy-dom
/**
 * The walk: where you have been, and who you followed to get there.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { reactive, nextTick } from 'vue';

import { advanced, connected, drawerDoes, followedVia, heard, pushed, revive, stored, useWalkStore } from '../../src/stores/walk.js';
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

describe( 'connected', () => {
	it( 'is true for a word or a picker, and false for a song played cold', () => {
		expect( connected( { cid: 'Qa', why: 'next' } ) ).toBe( true );
		expect( connected( { cid: 'Qa', via: { name: 'Kyle Tuttle' } } ) ).toBe( true );
		expect( connected( { cid: 'Qa' } ) ).toBe( false );
		expect( connected( null ) ).toBe( false );
	} );
} );

describe( 'advanced', () => {
	const cold = { cid: 'Qb', song: 'Proximity', via: null, why: null, at: 2 };
	const led = { cid: 'Qb', song: 'Proximity', via: { name: 'Cory Walker', instrument: 'banjo' }, why: null, at: 2 };

	it( 'chains a hop that says how it was reached', () => {
		const state = { current: [ { cid: 'Qa', song: 'August', via: null, why: null, at: 1 } ], past: [] };
		const next = advanced( state, led );
		expect( next.current ).toHaveLength( 2 );
		expect( next.past ).toBe( state.past );
	} );

	// Justin, 15 Nov 2026: "If I play a song, without connection to a previous
	// song, then that's a new rabbithole."
	it( 'closes the walk on a song played cold, and starts a new one with it', () => {
		const first = { cid: 'Qa', song: 'August', via: null, why: null, at: 1 };
		const state = { current: [ first ], past: [] };
		const next = advanced( state, cold );
		expect( next.current ).toEqual( [ cold ] );
		expect( next.past ).toEqual( [ { hops: [ first ], closedAt: 2 } ] );
	} );

	it( 'lets the first song be played cold: a walk has to begin somewhere', () => {
		const next = advanced( { current: [], past: [] }, cold );
		expect( next.current ).toEqual( [ cold ] );
		expect( next.past ).toEqual( [] );
	} );

	it( 'adds nothing for the recording already on, however it was reached', () => {
		const state = { current: [ { cid: 'Qa', song: 'August', via: null, why: null, at: 1 } ], past: [] };
		// Replayed, with a connection or cold: the same recording is not a
		// new place in the walk, and not a new rabbithole either.
		expect( advanced( state, { ...cold, cid: 'Qa' } ) ).toBe( state );
		expect( advanced( state, { ...led, cid: 'Qa' } ) ).toBe( state );
	} );

	it( 'keeps eight rabbitholes at most behind the walk of now', () => {
		let state = { current: [], past: [] };
		for ( let i = 0; i < 12; i++ ) {
			state = advanced( state, { cid: 'Qc' + i, song: 'Song ' + i, via: null, why: null, at: i } );
			state = advanced( state, { cid: 'Qd' + i, song: 'Other ' + i, via: null, why: null, at: i } );
		}
		expect( state.past ).toHaveLength( 8 );
		expect( state.current ).toEqual( [ { cid: 'Qd11', song: 'Other 11', via: null, why: null, at: 11 } ] );
	} );
} );

describe( 'revive and stored', () => {
	it( 'keeps a via with its instrument across a refresh', () => {
		const walk = [ { cid: 'Qs', song: 'Silver 44', via: { name: 'Kyle Tuttle', instrument: 'banjo' }, why: 'chase', at: 1 } ];
		expect( revive( stored( walk ) ).current ).toEqual( walk );
	} );

	// The older shape said only who: the word for why came with Justin's
	// every-line rule. A hop that said who gains "followed".
	it( 'brings an older walk back as the walk of now, its who gained a why', () => {
		const old = [ { cid: 'Qs', song: 'Silver 44', via: { name: 'Kyle Tuttle', instrument: 'banjo' }, at: 1 } ];
		expect( revive( JSON.stringify( old ) ) ).toEqual( {
			current: [ { ...old[ 0 ], why: 'followed' } ],
			past: [],
		} );
	} );

	it( 'keeps the rabbitholes closed before this one', () => {
		const state = {
			current: [ { cid: 'Qb', song: 'Proximity', via: null, why: null, at: 2 } ],
			past: [ { hops: [ { cid: 'Qa', song: 'August', via: null, why: null, at: 1 } ], closedAt: 2 } ],
		};
		expect( revive( stored( state ) ) ).toEqual( state );
	} );

	it( 'treats junk as an empty walk', () => {
		expect( revive( 'not json' ) ).toEqual( { current: [], past: [] } );
		expect( revive( '{"cid":"Qa"}' ) ).toEqual( { current: [], past: [] } );
	} );

	// A walk stored() can't read - null, junk, or no current - comes back
	// as an empty walk, never a throw: stored() is revive()'s mirror. (blu,
	// 15 Nov: it was an assignment to a const. The app's own walk was safe
	// behind revive(), but a cold `vite` start's dependency scan failed on
	// it, on re's read.)
	it( 'stores nothing as an empty walk', () => {
		expect( JSON.parse( stored( null ) ) ).toEqual( { current: [], past: [] } );
		expect( JSON.parse( stored( 'junk' ) ) ).toEqual( { current: [], past: [] } );
		expect( JSON.parse( stored( { past: [] } ) ) ).toEqual( { current: [], past: [] } );
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
		const model = { state: reactive( { song: { _trackCid: 'Qa', title: 'August' }, status: 'PLAYING', upNext: [] } ) };
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
		expect( revive( window.localStorage.getItem( 'rabbithole-walk' ) ).current[ 1 ].via ).toEqual( { name: 'Kyle Tuttle', instrument: 'banjo' } );
	} );

	// Justin, 15 Nov 2026: "32 hops ... I certainly haven't let it play for 32 tracks". Every visit loads a song;
	// it joins the walk when it plays.
	it( 'leaves out a song that only sat loaded, and takes it in when it plays', async () => {
		const player = usePlayerStore();
		const model = { state: reactive( { song: { _trackCid: 'Qa', title: 'August' }, status: 'STOPPED', upNext: [] } ) };
		player.model = model;
		const walk = useWalkStore();
		await nextTick();
		expect( walk.hops ).toEqual( [] );
		model.state.status = 'PLAYING';
		await nextTick();
		expect( walk.hops.map( ( h ) => h.cid ) ).toEqual( [ 'Qa' ] );
		model.state.status = 'PAUSED';
		model.state.song = { _trackCid: 'Qs', title: 'Silver 44' };
		await nextTick();
		expect( walk.hops.map( ( h ) => h.cid ) ).toEqual( [ 'Qa' ] );          // loaded, not yet heard
	} );

	// Justin, 15 Nov 2026: a song played with no connection to the one before
	// it is a new rabbithole. The one it closed is kept, not thrown away.
	it( 'closes the walk on a song played cold, and keeps the closed one', async () => {
		const player = usePlayerStore();
		const model = { state: reactive( { song: { _trackCid: 'Qa', title: 'August' }, status: 'PLAYING', upNext: [] } ) };
		player.model = model;
		const walk = useWalkStore();
		walk.mark( 'Qs', { why: 'next' } );
		model.state.song = { _trackCid: 'Qs', title: 'Silver 44' };            // queued next: chains
		await nextTick();
		expect( walk.hops.map( ( h ) => [ h.cid, h.why ] ) ).toEqual( [ [ 'Qa', null ], [ 'Qs', 'next' ] ] );
		model.state.song = { _trackCid: 'Qc', title: 'Proximity' };            // played cold: closes
		await nextTick();
		expect( walk.hops.map( ( h ) => h.cid ) ).toEqual( [ 'Qc' ] );
		expect( walk.past ).toHaveLength( 1 );
		expect( walk.past[ 0 ].hops.map( ( h ) => h.cid ) ).toEqual( [ 'Qa', 'Qs' ] );
	} );

	it( 'chains a replay of the recording already on, and starts no new rabbithole', async () => {
		const player = usePlayerStore();
		const model = { state: reactive( { song: { _trackCid: 'Qa', title: 'August' }, status: 'PAUSED', upNext: [] } ) };
		player.model = model;
		const walk = useWalkStore();
		model.state.status = 'PLAYING';
		await nextTick();
		model.state.status = 'PAUSED';
		model.state.status = 'PLAYING';                                       // seeked and replayed
		await nextTick();
		expect( walk.hops ).toHaveLength( 1 );
		expect( walk.past ).toEqual( [] );
	} );

	it( 'closes the walk of now when the drawer starts a new rabbithole', async () => {
		const player = usePlayerStore();
		const model = { state: reactive( { song: { _trackCid: 'Qa', title: 'August' }, status: 'PLAYING', upNext: [] } ) };
		player.model = model;
		const walk = useWalkStore();
		await nextTick();
		walk.close();
		expect( walk.hops ).toEqual( [] );
		expect( walk.past ).toHaveLength( 1 );
		expect( walk.past[ 0 ].hops.map( ( h ) => h.cid ) ).toEqual( [ 'Qa' ] );
	} );
} );

describe( 'followedVia', () => {
	it( 'is who the drawer says was followed, and no one for anything else', () => {
		expect( followedVia( { name: 'Kyle Tuttle', instrument: 'banjo' } ) ).toEqual( { name: 'Kyle Tuttle', instrument: 'banjo' } );
		expect( followedVia( { name: ' Harry Clark ' } ) ).toEqual( { name: 'Harry Clark', instrument: null } );
		expect( followedVia( { name: '' } ) ).toBe( null );
		expect( followedVia( { name: 7 } ) ).toBe( null );
		expect( followedVia( 'Kyle' ) ).toBe( null );
		expect( followedVia( undefined ) ).toBe( null );
	} );

	it( 'is what the walk records for the song it marks', async () => {
		window.localStorage.clear();
		setActivePinia( createPinia() );
		const model = { state: reactive( { song: null, status: 'STOPPED', upNext: [] } ) };
		usePlayerStore().model = model;
		const walk = useWalkStore();
		walk.mark( 'Qr', followedVia( { name: 'Samson Grisman', instrument: 'bass' } ) );
		model.state.song = { _trackCid: 'Qr', title: 'Moon Factory' };
		model.state.status = 'PLAYING';
		await nextTick();
		expect( walk.hops ).toEqual( [ expect.objectContaining( { cid: 'Qr', via: { name: 'Samson Grisman', instrument: 'bass' } } ) ] );
	} );
} );

describe( 'drawerDoes', () => {
	it( 'does only what the graph\'s word names', () => {
		expect( drawerDoes( { connectome: true, open: true } ) ).toEqual( { open: true } );
		expect( drawerDoes( { connectome: 'close' } ) ).toEqual( { close: true } );
		expect( drawerDoes( { connectome: true, play: 'QmA' } ) ).toEqual( { play: 'QmA', via: null } );
		expect( drawerDoes( { connectome: true, play: 'QmA', via: { name: 'Kyle Tuttle', instrument: 'banjo' } } ) )
			.toEqual( { play: 'QmA', via: { name: 'Kyle Tuttle', instrument: 'banjo' } } );
		expect( drawerDoes( { connectome: true, page: 'Harry Clark' } ) ).toEqual( { page: 'Harry Clark', close: true } );
		expect( drawerDoes( { rabbithole: 'walk' } ) ).toBe( null );
		expect( drawerDoes( { connectome: true } ) ).toBe( null );
		expect( drawerDoes( null ) ).toBe( null );
	} );

	// re, 15 Nov 2026: "start a new rabbithole" left the drawer open, so it came back open by itself
	// when the next song played.
	it( 'shuts the drawer when a new walk starts', () => {
		expect( drawerDoes( { connectome: true, clear: true } ) ).toEqual( { clear: true, close: true } );
	} );
} );

describe( 'heard', () => {
	it( 'is the recording once it plays, and nothing while it only sits loaded', () => {
		expect( heard( 'QmA', false ) ).toBe( null );
		expect( heard( 'QmA', true ) ).toBe( 'QmA' );
		expect( heard( null, true ) ).toBe( null );
	} );
} );
