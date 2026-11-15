// @vitest-environment happy-dom
/**
 * What the rabbithole queues on its own account, and gives back.
 *
 * A chase's next song, a quest's pick and the charted track the floor
 * reaches for are all ours: queued without anybody asking, and withdrawn
 * when somebody does ask, so Play next means next (Justin's item 15). The
 * floor's pick was not recorded as ours, so it could not be withdrawn and
 * Play next landed behind it (re, #rabbithole, 15 Nov 2026).
 *
 * The player, the song store, the walk and the wiki are stubs here: this
 * is about which song the picker store queues and what it remembers, not
 * about Webamp.
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

import { usePickerStore } from '../../src/stores/picker.js';

const AUGUST = 'QmAugust';
const CICADA = 'QmCicada';
const SILVER = 'QmSilver';

/** Let the watcher's awaits run out. */
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
	globalThis.__player = {
		get song() { return song.value; },
		get cards() { return cards.value; },
		status: 'PLAYING',
		model: {
			// Webamp's playlist, as far as this test is concerned: a
			// withdrawn song is really gone from the queue.
			dropFromQueue: vi.fn( ( cid ) => {
				const queue = globalThis.__songs.queuedCids;
				const at = queue.indexOf( cid );
				if ( at === -1 ) {
					return [];
				}
				queue.splice( at, 1 );
				return [ at ];
			} ),
			playNext: vi.fn(),
		},
	};
	globalThis.__songs = {
		get current() { return song.value; },
		queuedCids: [],
		recordRest: [],
		charted,
		chartedList: async () => charted,
		queueCid: vi.fn( async ( cid ) => {
			globalThis.__songs.queuedCids.push( cid );
			return true;
		} ),
	};
	return {
		song, cards,
		/** A recording starts. */
		async plays( cid, on = [] ) {
			cards.value = on.map( ( name ) => ( { name } ) );
			song.value = { _trackCid: cid, title: cid };
			await settle();
		},
	};
}

describe( 'what the rabbithole queued itself', () => {
	beforeEach( () => setActivePinia( createPinia() ) );

	it( 'is the quest\'s pick, and it gives way to a song asked for by hand', async () => {
		const w = world( {
			band: { 'Song:August': { 'Kyle Tuttle': [ 'banjo' ] } },
			plays: { 'Kyle Tuttle': [ 'Song:Cicada Song' ] },
		} );
		const picker = usePickerStore();
		await w.plays( AUGUST, [ 'Kyle Tuttle' ] );

		expect( picker.following ).toBe( 'Kyle Tuttle' );
		expect( globalThis.__songs.queuedCids ).toEqual( [ CICADA ] );

		picker.giveWay();
		expect( globalThis.__songs.queuedCids ).toEqual( [] );
		expect( picker.next ).toBe( null );
	} );

	it( 'is the floor\'s charted track when no picker can name one, and gives way too', async () => {
		// Nobody in the band is in the graph: the quest has nothing, and
		// the song still has to go somewhere when it ends (item 28).
		const w = world( { charted: [ { cid: AUGUST }, { cid: SILVER } ] } );
		const picker = usePickerStore();
		await w.plays( AUGUST, [ 'Somebody Uncharted' ] );

		expect( picker.following ).toBe( null );
		expect( globalThis.__songs.queuedCids ).toEqual( [ SILVER ] );

		picker.giveWay();
		expect( globalThis.__songs.queuedCids ).toEqual( [] );
	} );

	it( 'is nobody\'s to withdraw once it is the song playing', async () => {
		// Withdrawing the song that is playing would be a way to stop the
		// music, which is not what standing aside means.
		const w = world( { charted: [ { cid: AUGUST }, { cid: SILVER }, { cid: CICADA } ] } );
		const picker = usePickerStore();
		await w.plays( AUGUST, [] );
		// Which charted track the floor reaches for is its own business.
		const lined = globalThis.__songs.queuedCids[ 0 ];
		expect( globalThis.__songs.queuedCids ).toHaveLength( 1 );
		expect( lined ).not.toBe( AUGUST );

		// It comes on, and something else is lined up behind it.
		globalThis.__songs.queuedCids.length = 0;
		await w.plays( lined, [] );
		expect( globalThis.__songs.queuedCids ).toHaveLength( 1 );

		picker.giveWay();
		expect( globalThis.__player.model.dropFromQueue ).not.toHaveBeenCalledWith( lined );
		expect( globalThis.__songs.queuedCids ).toEqual( [] );
	} );

	it( 'leaves the queue alone when a person has already filled it', async () => {
		const w = world( {
			band: { 'Song:August': { 'Kyle Tuttle': [ 'banjo' ] } },
			plays: { 'Kyle Tuttle': [ 'Song:Cicada Song' ] },
			charted: [ { cid: SILVER } ],
		} );
		globalThis.__songs.queuedCids.push( SILVER );
		const picker = usePickerStore();
		await w.plays( AUGUST, [ 'Kyle Tuttle' ] );

		expect( globalThis.__songs.queueCid ).not.toHaveBeenCalled();
		// And standing aside takes nothing of theirs with it.
		picker.giveWay();
		expect( globalThis.__songs.queuedCids ).toEqual( [ SILVER ] );
		// The quest still says who this song handed you.
		expect( picker.following ).toBe( 'Kyle Tuttle' );
	} );
} );
