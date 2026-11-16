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

async function settle() {
	for ( let i = 0; i < 12; i++ ) {
		await nextTick();
	}
}

function world( { band = {}, plays = {}, charted = [] } = {} ) {
	const song = ref( null );
	const cards = ref( [] );
	globalThis.__graph = { band, plays, records: {} };
	globalThis.__cids = { 'Song:Cicada Song': CICADA, 'Song:Silver 44': SILVER, 'Song:August': AUGUST };
	globalThis.__walk = { hops: [], mark: vi.fn() };
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
			return song.value;
		} ),
	};
	return {
		song, cards,
		async plays( cid, on = [] ) {
			cards.value = on.map( ( name ) => ( { name } ) );
			song.value = { _trackCid: cid, title: cid };
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

describe( 'back', () => {
	beforeEach( () => setActivePinia( createPinia() ) );

	it( 'plays the song before this one in the walk, and says that is what it is', async () => {
		const w = world( {
			band: { 'Song:Cicada Song': { 'Kyle Tuttle': [ 'banjo' ] } },
			plays: { 'Kyle Tuttle': [ 'Song:Silver 44' ] },
		} );
		const picker = usePickerStore();
		globalThis.__walk.hops = [ { cid: AUGUST, song: 'August' }, { cid: CICADA, song: 'Cicada Song' } ];
		await w.plays( CICADA, [ 'Kyle Tuttle' ] );
		const mode = picker.mode;
		const following = picker.following;

		expect( await picker.back() ).toBe( true );
		expect( globalThis.__songs.playCid ).toHaveBeenCalledWith( AUGUST, { play: true } );
		expect( wordFor( AUGUST ) ).toBe( 'back' );
		// Going back changes where you are, not where you are going.
		expect( picker.mode ).toBe( mode );
		expect( picker.following ).toBe( following );
	} );

	it( 'is nothing to do at the start of a rabbithole', async () => {
		const w = world();
		const picker = usePickerStore();
		globalThis.__walk.hops = [ { cid: AUGUST, song: 'August' } ];
		await w.plays( AUGUST, [] );

		expect( await picker.back() ).toBe( false );
		expect( globalThis.__songs.playCid ).not.toHaveBeenCalled();
	} );

	it( 'takes a step clicked in the graph back to that song, keeping the walk', async () => {
		const w = world();
		const picker = usePickerStore();
		globalThis.__walk.hops = [ { cid: AUGUST }, { cid: SILVER }, { cid: CICADA } ];
		await w.plays( CICADA, [] );

		expect( await picker.playHop( AUGUST ) ).toBe( true );
		expect( wordFor( AUGUST ) ).toBe( 'back' );
	} );
} );
