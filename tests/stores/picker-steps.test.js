// @vitest-environment happy-dom
/**
 * Next and back belong to the rabbithole.
 *
 * Justin, #rabbithole 15 Nov 2026:
 *
 * - "I just clicked 'next' on Cicada Song and it started a new rabbithole
 *   instead of questing through a picker" (item 38): the floor's pick was
 *   queued with no word on it, and a song played with no word is a song
 *   played cold, which closes the rabbithole you were in.
 * - "I just had an issue where the webamp 'back' and 'forth' buttons
 *   didn't do anything" (item 37), and "If webamp is stopped, and I click
 *   'next', it goes to another song, but doesn't count it in the
 *   rabbithole" (item 39): next plays, so what it reaches is heard.
 * - "it needs to go back _in the rabbithole_ to that song and play through
 *   the rabbithole the same way that it had been playing" (item 40).
 *
 * The player, the song store, the walk and the layout are stubs: this is
 * about which song the rabbithole steps to, and what the walk is told.
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
vi.mock( '../../src/stores/layout.js', () => ( { useLayoutStore: () => globalThis.__layout } ) );

import { usePickerStore } from '../../src/stores/picker.js';

const AUGUST = 'QmAugust';
const CICADA = 'QmCicada';
const SILVER = 'QmSilver';
const PROX = 'QmProximity';

async function settle() {
	for ( let i = 0; i < 12; i++ ) {
		await nextTick();
	}
}

function world( { band = {}, plays = {}, charted = [] } = {} ) {
	const song = ref( null );
	const cards = ref( [] );
	globalThis.__graph = { band, plays, records: {} };
	globalThis.__cids = { 'Song:Cicada Song': CICADA, 'Song:Silver 44': SILVER, 'Song:August': AUGUST, 'Song:Proximity': PROX };
	// The walk, as its store really behaves: a mark with a step moves where
	// you stand, anything else adds a hop at the end (stores/walk.js).
	const marks = [];
	globalThis.__walk = {
		hops: [],
		at: -1,
		marks,
		mark: vi.fn( ( cid, via ) => marks.push( [ cid, via ] ) ),
		/** A recording started: what the store's watcher does with it. */
		heard( cid, song ) {
			const marked = ( marks.filter( ( [ c ] ) => c === cid ).pop() || [] )[ 1 ] || null;
			if ( marked && typeof marked.step === 'number' && globalThis.__walk.hops[ marked.step ]
				&& globalThis.__walk.hops[ marked.step ].cid === cid ) {
				globalThis.__walk.at = marked.step;
				return;
			}
			// Somewhere new from the middle cuts the walk there (stores/walk.js).
			if ( globalThis.__walk.at >= 0 && globalThis.__walk.at < globalThis.__walk.hops.length - 1 ) {
				globalThis.__walk.cut = globalThis.__walk.hops.slice( globalThis.__walk.at + 1 );
				globalThis.__walk.hops = globalThis.__walk.hops.slice( 0, globalThis.__walk.at + 1 );
			}
			const last = globalThis.__walk.hops[ globalThis.__walk.hops.length - 1 ];
			if ( ! last || last.cid !== cid ) {
				globalThis.__walk.hops.push( { cid, song, via: marked && marked.name ? marked : null, why: marked ? marked.why || null : null } );
			}
			globalThis.__walk.at = globalThis.__walk.hops.length - 1;
		},
	};
	globalThis.__layout = { startTraversing: vi.fn(), stopTraversing: vi.fn() };
	globalThis.__player = {
		get song() { return song.value; },
		get cards() { return cards.value; },
		status: 'PLAYING',
		model: {
			dropFromQueue: vi.fn( ( cid ) => {
				const queue = globalThis.__songs.queuedCids;
				const at = queue.indexOf( cid );
				if ( at === -1 ) {
					return [];
				}
				queue.splice( at, 1 );
				return [ at ];
			} ),
			// Webamp, as far as this is concerned: the next song in the
			// queue comes on, and it plays.
			playNext: vi.fn( () => {
				const next = globalThis.__songs.queuedCids.shift();
				if ( ! next ) {
					return false;
				}
				song.value = { _trackCid: next, title: next };
				globalThis.__walk.heard( next, next );
				return true;
			} ),
		},
	};
	globalThis.__songs = {
		get current() { return song.value; },
		queuedCids: [],
		recordRest: [],
		chartedList: async () => charted,
		queueCid: vi.fn( async ( cid ) => {
			globalThis.__songs.queuedCids.push( cid );
			return true;
		} ),
		playCid: vi.fn( async ( cid ) => {
			globalThis.__songs.queuedCids.length = 0;
			song.value = { _trackCid: cid, title: cid };
			globalThis.__walk.heard( cid, cid );
			return song.value;
		} ),
	};
	return {
		song, cards,
		async plays( cid, on = [] ) {
			cards.value = on.map( ( name ) => ( { name } ) );
			song.value = { _trackCid: cid, title: cid };
			globalThis.__walk.heard( cid, cid );
			await settle();
		},
	};
}

/** What the walk was told about a recording. */
function wordFor( cid ) {
	const call = globalThis.__walk.mark.mock.calls.filter( ( [ c ] ) => c === cid ).pop();
	return call ? ( call[ 1 ] || {} ).why || null : null;
}

describe( 'the floor says what it is', () => {
	beforeEach( () => setActivePinia( createPinia() ) );

	it( 'marks the track it reaches for, so the rabbithole does not close behind it', async () => {
		// Nobody on this song is in the graph: the quest has nowhere to go,
		// which is where Cicada Song left it after a whole record.
		const w = world( { charted: [ { cid: CICADA }, { cid: SILVER } ] } );
		usePickerStore();
		await w.plays( CICADA, [ 'Somebody Uncharted' ] );

		expect( globalThis.__songs.queuedCids ).toEqual( [ SILVER ] );
		expect( wordFor( SILVER ) ).toBe( 'wander' );
	} );
} );

describe( 'forward', () => {
	beforeEach( () => setActivePinia( createPinia() ) );

	it( 'plays what is lined up, and travels with it', async () => {
		const w = world( {
			band: { 'Song:August': { 'Kyle Tuttle': [ 'banjo' ] } },
			plays: { 'Kyle Tuttle': [ 'Song:Cicada Song' ] },
		} );
		const picker = usePickerStore();
		await w.plays( AUGUST, [ 'Kyle Tuttle' ] );
		expect( globalThis.__songs.queuedCids ).toEqual( [ CICADA ] );

		expect( await picker.forward() ).toBe( true );
		expect( w.song.value._trackCid ).toBe( CICADA );
		expect( globalThis.__layout.startTraversing ).toHaveBeenCalled();
	} );

	it( 'lines something up first when the queue has run dry', async () => {
		const w = world( { charted: [ { cid: CICADA }, { cid: SILVER } ] } );
		const picker = usePickerStore();
		await w.plays( CICADA, [ 'Somebody Uncharted' ] );
		// A person took the queue away: Play next, then stopping a chase.
		globalThis.__songs.queuedCids.length = 0;

		expect( await picker.forward() ).toBe( true );
		expect( w.song.value._trackCid ).toBe( SILVER );
		// And it arrived with a word, so it is a step of this rabbithole.
		expect( wordFor( SILVER ) ).toBe( 'wander' );
	} );
} );

describe( 'back and forward along the walk', () => {
	beforeEach( () => setActivePinia( createPinia() ) );

	/** A rabbithole three songs long, the last one playing. */
	async function walked( w ) {
		await w.plays( AUGUST, [] );
		globalThis.__walk.hops[ 0 ].why = null;
		await w.plays( SILVER, [] );
		await w.plays( CICADA, [] );
		return globalThis.__walk;
	}

	it( 'plays the song before where you stand', async () => {
		const w = world();
		const picker = usePickerStore();
		const walk = await walked( w );
		const mode = picker.mode;

		expect( await picker.back() ).toBe( true );
		expect( w.song.value._trackCid ).toBe( SILVER );
		expect( globalThis.__songs.playCid ).toHaveBeenCalledWith( SILVER, { play: true } );
		// The chain is the same chain: going back is not a new place.
		expect( walk.hops.map( ( h ) => h.cid ) ).toEqual( [ AUGUST, SILVER, CICADA ] );
		expect( walk.at ).toBe( 1 );
		// And where you are going is untouched.
		expect( picker.mode ).toBe( mode );
	} );

	it( 'goes back two songs when you press it twice', async () => {
		// re, #rabbithole, 16 Nov 2026: a step back that wrote a hop of its
		// own left the next step back on the song just left, so previous
		// bounced between two songs instead of walking out.
		const w = world();
		const picker = usePickerStore();
		const walk = await walked( w );

		await picker.back();
		await picker.back();
		expect( w.song.value._trackCid ).toBe( AUGUST );
		expect( walk.at ).toBe( 0 );
		expect( walk.hops.map( ( h ) => h.cid ) ).toEqual( [ AUGUST, SILVER, CICADA ] );
	} );

	it( 'is nothing to do at the start of a rabbithole', async () => {
		const w = world();
		const picker = usePickerStore();
		await w.plays( AUGUST, [] );

		expect( await picker.back() ).toBe( false );
		expect( globalThis.__songs.playCid ).not.toHaveBeenCalled();
	} );

	it( 'plays the rabbithole forward again from where you went back to', async () => {
		// Justin's item 40: "play through the rabbithole the same way that
		// it had been playing".
		const w = world( { charted: [ { cid: AUGUST }, { cid: SILVER }, { cid: CICADA } ] } );
		const picker = usePickerStore();
		const walk = await walked( w );
		await picker.back();
		await picker.back();

		expect( await picker.forward() ).toBe( true );
		expect( w.song.value._trackCid ).toBe( SILVER );
		expect( walk.at ).toBe( 1 );
		expect( await picker.forward() ).toBe( true );
		expect( w.song.value._trackCid ).toBe( CICADA );
		expect( walk.hops ).toHaveLength( 3 );
	} );

	it( 'takes a step clicked in the graph to that place in the walk', async () => {
		const w = world();
		const picker = usePickerStore();
		const walk = await walked( w );

		expect( await picker.playHop( AUGUST, 0 ) ).toBe( true );
		expect( walk.at ).toBe( 0 );
		expect( walk.hops ).toHaveLength( 3 );
	} );

	it( 'knows which August you are standing on when the walk has two', async () => {
		// Where you are is a place, not a song: a rabbithole can come back
		// to a recording, and then the song you are on does not say where
		// in the walk you are.
		const w = world();
		const picker = usePickerStore();
		await w.plays( AUGUST, [] );
		await w.plays( SILVER, [] );
		await w.plays( AUGUST, [] );
		await w.plays( CICADA, [] );
		expect( globalThis.__walk.hops.map( ( h ) => h.cid ) ).toEqual( [ AUGUST, SILVER, AUGUST, CICADA ] );

		// Clicked the first August in the graph: that is where you stand.
		await picker.playHop( AUGUST, 0 );
		expect( globalThis.__walk.at ).toBe( 0 );
		// And there is nothing before the first song of a rabbithole.
		expect( await picker.back() ).toBe( false );
	} );

	it( 'lines the walk\'s own next song up while you stand behind the end', async () => {
		// re, #rabbithole, 16 Nov 2026: only the next button replayed the
		// walk. A song that ended where you stood played the quest's pick,
		// and it joined the walk after the hop you had walked back from --
		// a step nobody took.
		const w = world( {
			// The quest and the floor both have somewhere fresh to go:
			// Proximity, which this rabbithole has not played.
			band: { [ 'Song:' + SILVER ]: { 'Kyle Tuttle': [ 'banjo' ] } },
			plays: { 'Kyle Tuttle': [ 'Song:Proximity' ] },
			charted: [ { cid: AUGUST }, { cid: SILVER }, { cid: CICADA }, { cid: PROX } ],
		} );
		const picker = usePickerStore();
		const walk = await walked( w );

		await picker.back();
		await settle();
		// Not a quest's pick, nor the floor's: the song the walk goes to.
		expect( globalThis.__songs.queuedCids ).toEqual( [ CICADA ] );

		// And when this song ends by itself, that is what plays.
		globalThis.__player.model.playNext();
		await settle();
		expect( w.song.value._trackCid ).toBe( CICADA );
		expect( walk.at ).toBe( 2 );
		expect( walk.hops.map( ( h ) => h.cid ) ).toEqual( [ AUGUST, SILVER, CICADA ] );
	} );

	it( 'plays a song that is not in this walk as what it is: a song played cold', async () => {
		const w = world();
		const picker = usePickerStore();
		await walked( w );

		expect( await picker.playHop( 'QmSomewhereElse' ) ).toBe( true );
		// Nothing claimed it was a step of this walk.
		expect( globalThis.__walk.mark ).toHaveBeenCalledWith( 'QmSomewhereElse', null );
	} );
} );
