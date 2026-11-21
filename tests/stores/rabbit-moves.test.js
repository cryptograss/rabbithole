// @vitest-environment happy-dom
/**
 * The rabbit moves on when the picker it was chasing has no next song.
 *
 * Justin, #connectome, 21 Nov 2026, 01:56Z: "I just heard August and then
 * Paint Exchange, and the rabbit was on Harry. Then new next song. I'm
 * guessing that's because there isn't another Harry song? In that event,
 * the rabbit needs to change to another picker for whom a next song is
 * available."
 *
 * The player, the song store, the walk and the wiki are stubs, as in
 * picker-queue.test.js: this is about who the rabbit is on and what it
 * lines up, not about Webamp.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref, nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';

vi.mock( '../../src/wiki/api.js', () => ( { recordsOf: async () => [] } ) );
vi.mock( '../../src/wiki/queue.js', () => ( {
	performerGraph: async () => globalThis.__graph,
	songCid: async ( song ) => globalThis.__cids[ song ] || null,
} ) );
vi.mock( '../../src/stores/player.js', () => ( { usePlayerStore: () => globalThis.__player } ) );
vi.mock( '../../src/stores/song.js', () => ( { useSongStore: () => globalThis.__songs } ) );
vi.mock( '../../src/stores/walk.js', () => ( { useWalkStore: () => globalThis.__walk } ) );

import { usePickerStore, rabbitMovesTo } from '../../src/stores/picker.js';

const AUGUST = 'QmAugust';
const PAINT = 'QmPaint';
const JIG = 'QmJig';
const REUBEN = 'QmReuben';

async function settle() {
	for ( let i = 0; i < 24; i++ ) {
		await nextTick();
	}
}

/** The three songs of 20 Nov 2026, and who the wiki says is on them. Harry Clark and Cory Walker are on August and Paint Exchange; Cory is on Barlow's Jig too. */
function world( { ready = [ AUGUST, PAINT, JIG, REUBEN ], plays } = {} ) {
	const song = ref( null );
	const cards = ref( [] );
	const hops = ref( [] );
	globalThis.__graph = {
		band: {}, records: {},
		plays: plays || {
			'Harry Clark': [ 'Song:August', 'Song:Paint Exchange' ],
			'Cory Walker': [ 'Song:August', 'Song:Paint Exchange', "Song:Barlow's Jig" ],
			'Sam Grisman': [ 'Song:Paint Exchange' ],
		},
	};
	globalThis.__cids = { 'Song:August': AUGUST, 'Song:Paint Exchange': PAINT, "Song:Barlow's Jig": JIG };
	globalThis.__walk = { get hops() { return hops.value; }, at: -1, mark: vi.fn() };
	const queue = [];
	globalThis.__player = {
		get song() { return song.value; },
		get cards() { return cards.value; },
		status: 'PLAYING',
		model: {
			dropFromQueue: vi.fn( ( cid ) => {
				const at = queue.indexOf( cid );
				return at === -1 ? [] : queue.splice( at, 1 ) && [ at ];
			} ),
			playNext: vi.fn(),
		},
	};
	const list = () => ready.map( ( cid ) => ( { cid, title: cid === REUBEN ? "Reuben's Train" : cid } ) );
	globalThis.__songs = {
		get current() { return song.value; },
		queuedCids: queue,
		recordRest: [],
		readyList: async () => list(),
		isReady: async ( cid ) => ready.includes( cid ),
		queueCid: vi.fn( async ( cid ) => {
			queue.push( cid );
			return true;
		} ),
	};
	return {
		queue,
		/** A recording starts, with this band on its cards; what was queued behind the last one is spent, and the walk has heard it. */
		async plays( cid, on ) {
			queue.length = 0;
			hops.value = hops.value.concat( [ { cid } ] );
			cards.value = on.map( ( name ) => ( { name } ) );
			song.value = { _trackCid: cid, title: cid };
			await settle();
		},
	};
}

describe( 'where the rabbit goes (rabbitMovesTo)', () => {
	const first = ( list ) => list[ 0 ];
	it( 'is another of the band who has a song, never the one who ran out', () => {
		const has = ( name ) => name !== 'Sam Grisman';
		expect( rabbitMovesTo( [ 'Harry Clark', 'Sam Grisman', 'Cory Walker' ], { from: 'Harry Clark', hasNext: has, choose: first } ) ).toBe( 'Cory Walker' );
	} );
	it( 'is nobody when none of the others has one: it does not settle for a picker who leads nowhere', () => {
		expect( rabbitMovesTo( [ 'Harry Clark', 'Sam Grisman' ], { from: 'Harry Clark', hasNext: () => false } ) ).toBe( null );
		expect( rabbitMovesTo( [ 'Harry Clark' ], { from: 'Harry Clark', hasNext: () => true } ) ).toBe( null );
		expect( rabbitMovesTo( [], {} ) ).toBe( null );
	} );
	it( 'chooses among those who have one, and only those', () => {
		const seen = [];
		rabbitMovesTo( [ 'A', 'B', 'C', 'D' ], { from: 'A', hasNext: ( n ) => n !== 'C', choose: ( list ) => ( seen.push( ...list ), list[ 0 ] ) } );
		expect( seen ).toEqual( [ 'B', 'D' ] );
	} );
} );

describe( 'a chase whose picker runs out', () => {
	beforeEach( () => setActivePinia( createPinia() ) );

	it( 'goes on with another of the band who has a song, and says who', async () => {
		const w = world();
		const picker = usePickerStore();
		await w.plays( AUGUST, [ 'Harry Clark', 'Cory Walker' ] );
		await picker.chase( 'Harry Clark' );
		await settle();
		expect( w.queue ).toEqual( [ PAINT ] );                      // Harry's other song
		expect( picker.moved ).toBe( null );

		// Paint Exchange comes on: Harry has nothing left. Cory has Barlow's Jig; Sam has nothing unplayed.
		await w.plays( PAINT, [ 'Harry Clark', 'Cory Walker', 'Sam Grisman' ] );
		expect( picker.mode ).toBe( 'chase' );
		expect( picker.following ).toBe( 'Cory Walker' );
		expect( w.queue ).toEqual( [ JIG ] );
		expect( picker.next ).toEqual( { song: "Song:Barlow's Jig", cid: JIG } );
		expect( picker.moved ).toEqual( { from: 'Harry Clark', to: 'Cory Walker', song: "Song:Barlow's Jig", cid: JIG } );
		// The walk will say the next song came by chasing Cory.
		expect( globalThis.__walk.mark ).toHaveBeenLastCalledWith( JIG, { name: 'Cory Walker', instrument: null, why: 'chase' } );
	} );

	it( 'with nobody on the song to go to, stays put, takes the rabbithole\'s own pick, and says so', async () => {
		// The live case once the three are tagged: Reuben's Train is ready and credits nobody.
		const w = world( { ready: [ AUGUST, PAINT, REUBEN ] } );
		const picker = usePickerStore();
		await w.plays( AUGUST, [ 'Harry Clark', 'Cory Walker' ] );
		await picker.chase( 'Harry Clark' );
		await settle();
		await w.plays( PAINT, [ 'Harry Clark', 'Cory Walker', 'Sam Grisman' ] );
		expect( picker.following ).toBe( 'Harry Clark' );
		expect( w.queue ).toEqual( [ REUBEN ] );
		expect( picker.moved ).toEqual( { from: 'Harry Clark', to: null, song: "Reuben's Train", cid: REUBEN } );
		expect( globalThis.__walk.mark ).toHaveBeenLastCalledWith( REUBEN, { why: 'wander' } );
	} );

	it( 'with nothing in production at all, lines up nothing and says the music stops here', async () => {
		// The live wiki on 21 Nov 2026, 02:00Z: none of the charted tracks says `state: production`.
		const w = world( { ready: [] } );
		const picker = usePickerStore();
		await w.plays( AUGUST, [ 'Harry Clark', 'Cory Walker' ] );
		await picker.chase( 'Harry Clark' );
		await settle();
		expect( w.queue ).toEqual( [] );
		await w.plays( PAINT, [ 'Harry Clark', 'Cory Walker', 'Sam Grisman' ] );
		expect( picker.following ).toBe( 'Harry Clark' );
		expect( w.queue ).toEqual( [] );
		expect( picker.moved ).toEqual( { from: 'Harry Clark', to: null, song: null, cid: null } );
	} );

	it( 'leaves a song a person queued where it is: that is what comes next', async () => {
		const w = world();
		const picker = usePickerStore();
		await w.plays( AUGUST, [ 'Harry Clark', 'Cory Walker' ] );
		await picker.chase( 'Harry Clark' );
		await settle();
		// Paint Exchange starts with something already queued by hand behind it.
		globalThis.__songs.queueCid.mockClear();
		const plays = w.plays( PAINT, [ 'Harry Clark', 'Cory Walker' ] );
		w.queue.push( REUBEN );
		await plays;
		expect( picker.following ).toBe( 'Harry Clark' );
		expect( globalThis.__songs.queueCid ).not.toHaveBeenCalled();
		expect( picker.moved ).toBe( null );
	} );

	it( 'says nothing of an old move once the reader chases somebody themselves, or stops', async () => {
		const w = world();
		const picker = usePickerStore();
		await w.plays( AUGUST, [ 'Harry Clark', 'Cory Walker' ] );
		await picker.chase( 'Harry Clark' );
		await settle();
		await w.plays( PAINT, [ 'Harry Clark', 'Cory Walker' ] );
		expect( picker.moved ).not.toBe( null );
		await picker.stop();
		expect( picker.moved ).toBe( null );
		expect( picker.mode ).toBe( 'quest' );
	} );

	it( 'the next button asks the same: no song of theirs, so the rabbit moves before it plays on', async () => {
		const w = world();
		const picker = usePickerStore();
		await w.plays( AUGUST, [ 'Harry Clark', 'Cory Walker' ] );
		await picker.chase( 'Harry Clark' );
		await settle();
		await w.plays( PAINT, [ 'Harry Clark', 'Cory Walker' ] );
		// Whatever was lined up is gone (a person cleared the queue); next is pressed.
		w.queue.length = 0;
		picker.heardMoved();
		await picker.chase( 'Harry Clark' );                         // chased again by hand: he still has nothing
		await settle();
		w.queue.length = 0;
		await picker.forward();
		expect( picker.following ).toBe( 'Cory Walker' );
		expect( w.queue ).toEqual( [ JIG ] );
		expect( globalThis.__player.model.playNext ).toHaveBeenCalled();
	} );
} );

describe( 'what the reader is told, and for how long', () => {
	beforeEach( () => setActivePinia( createPinia() ) );

	it( 'the word goes when the next song comes on', async () => {
		const w = world( { ready: [ AUGUST, PAINT, JIG, REUBEN, 'QmExtra' ], plays: {
			'Harry Clark': [ 'Song:August', 'Song:Paint Exchange' ],
			'Cory Walker': [ 'Song:August', 'Song:Paint Exchange', "Song:Barlow's Jig", 'Song:Extra' ],
		} } );
		globalThis.__cids[ 'Song:Extra' ] = 'QmExtra';
		const picker = usePickerStore();
		await w.plays( AUGUST, [ 'Harry Clark', 'Cory Walker' ] );
		await picker.chase( 'Harry Clark' );
		await settle();
		await w.plays( PAINT, [ 'Harry Clark', 'Cory Walker' ] );
		expect( picker.moved ).toMatchObject( { from: 'Harry Clark', to: 'Cory Walker' } );
		// Barlow's Jig comes on: Cory has another, so nothing new is said, and the old word is gone.
		await w.plays( JIG, [ 'Cory Walker' ] );
		expect( picker.following ).toBe( 'Cory Walker' );
		expect( w.queue ).toEqual( [ 'QmExtra' ] );
		expect( picker.moved ).toBe( null );
	} );

	it( 'or when the reader has read it', async () => {
		const w = world();
		const picker = usePickerStore();
		await w.plays( AUGUST, [ 'Harry Clark', 'Cory Walker' ] );
		await picker.chase( 'Harry Clark' );
		await settle();
		await w.plays( PAINT, [ 'Harry Clark', 'Cory Walker' ] );
		picker.heardMoved();
		expect( picker.moved ).toBe( null );
		expect( picker.following ).toBe( 'Cory Walker' );            // the rabbit stays where it went
	} );

	it( 'a picker chased by hand who has nothing keeps the rabbit, and what follows is said', async () => {
		const w = world( { ready: [ AUGUST, PAINT, REUBEN ] } );
		const picker = usePickerStore();
		await w.plays( AUGUST, [ 'Harry Clark', 'Sam Grisman' ] );
		await picker.chase( 'Sam Grisman' );                         // only Paint Exchange, which is ready: he has one
		await settle();
		expect( picker.moved ).toBe( null );
		await w.plays( PAINT, [ 'Harry Clark', 'Sam Grisman' ] );
		await picker.chase( 'Harry Clark' );                         // both of his are played
		await settle();
		expect( picker.following ).toBe( 'Harry Clark' );
		expect( picker.moved ).toEqual( { from: 'Harry Clark', to: null, song: "Reuben's Train", cid: REUBEN } );
	} );

	it( 'a quest whose band has nowhere left to lead says what follows: the rabbithole\'s pick, or nothing', async () => {
		const w = world( { ready: [ AUGUST, REUBEN ], plays: { 'Harry Clark': [ 'Song:August' ] } } );
		const picker = usePickerStore();
		await w.plays( AUGUST, [ 'Harry Clark' ] );
		expect( picker.mode ).toBe( 'quest' );
		expect( w.queue ).toEqual( [ REUBEN ] );
		expect( picker.moved ).toEqual( { from: null, to: null, song: "Reuben's Train", cid: REUBEN } );

		setActivePinia( createPinia() );
		const none = world( { ready: [], plays: { 'Harry Clark': [ 'Song:August', 'Song:Paint Exchange' ] } } );
		const quiet = usePickerStore();
		await none.plays( PAINT, [ 'Harry Clark' ] );
		expect( none.queue ).toEqual( [] );
		expect( quiet.moved ).toEqual( { from: null, to: null, song: null, cid: null } );
	} );

	it( 'a quest that does have somebody to follow says nothing', async () => {
		const w = world();
		const picker = usePickerStore();
		await w.plays( AUGUST, [ 'Harry Clark' ] );
		expect( picker.following ).toBe( 'Harry Clark' );
		expect( w.queue ).toEqual( [ PAINT ] );
		expect( picker.moved ).toBe( null );
	} );
} );
