// @vitest-environment happy-dom
/**
 * A track asked for from anywhere: it plays, or it asks.
 *
 * Justin, #rabbithole 15 Nov 2026, item 36: "I'm still not getting options
 * when I click any of the 'listen in rabbithole' buttons, on a page or in
 * a bacon graph." A connectome in the pane or in the drawer played its
 * pick straight over whatever was on; only the pane's own buttons asked.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock( '../../src/stores/player.js', () => ( { usePlayerStore: () => globalThis.__player } ) );
vi.mock( '../../src/stores/song.js', () => ( { useSongStore: () => globalThis.__songs } ) );
vi.mock( '../../src/stores/walk.js', () => ( { useWalkStore: () => globalThis.__walk } ) );
vi.mock( '../../src/stores/layout.js', () => ( { useLayoutStore: () => globalThis.__layout } ) );
vi.mock( '../../src/stores/listen.js', () => ( { useListenStore: () => globalThis.__listen } ) );
vi.mock( '../../src/stores/pane.js', () => ( { usePaneStore: () => globalThis.__pane } ) );
vi.mock( '../../src/stores/picker.js', () => ( { usePickerStore: () => globalThis.__picker } ) );
vi.mock( '../../src/wiki/api.js', () => ( {
	performerResults: async () => [],
	songPageOf: async () => null,
	trackCidForSong: async () => null,
} ) );

import { askOrPlay } from '../../src/wiki/queue.js';

const AUGUST = 'QmAugust';
const SILVER = 'QmSilver';

function world( { playing = false, on = AUGUST } = {} ) {
	globalThis.__player = { playing, song: on ? { _trackCid: on } : null };
	globalThis.__songs = { playCid: vi.fn( async () => ( {} ) ) };
	globalThis.__walk = { mark: vi.fn() };
	globalThis.__layout = { openDock: vi.fn(), stopTraversing: vi.fn(), startTraversing: vi.fn() };
	globalThis.__listen = { ask: vi.fn( async () => {} ) };
	globalThis.__pane = { open: vi.fn() };
	globalThis.__picker = { giveWay: vi.fn() };
}

describe( 'askOrPlay', () => {
	beforeEach( () => setActivePinia( createPinia() ) );

	it( 'asks the three questions when something else is playing', async () => {
		world( { playing: true } );
		await askOrPlay( SILVER, { name: 'Harry Clark', instrument: 'mandolin' } );
		expect( globalThis.__listen.ask ).toHaveBeenCalledWith( SILVER, null, { name: 'Harry Clark', instrument: 'mandolin' } );
		expect( globalThis.__songs.playCid ).not.toHaveBeenCalled();
	} );

	it( 'just plays when the dock is quiet, and says who was followed there', async () => {
		world( { playing: false } );
		await askOrPlay( SILVER, { name: 'Harry Clark', instrument: 'mandolin' } );
		expect( globalThis.__listen.ask ).not.toHaveBeenCalled();
		expect( globalThis.__walk.mark ).toHaveBeenCalledWith( SILVER, { name: 'Harry Clark', instrument: 'mandolin' } );
		expect( globalThis.__songs.playCid ).toHaveBeenCalledWith( SILVER, { play: true } );
	} );

	it( 'does not ask about the song already playing: it plays it again', async () => {
		world( { playing: true, on: AUGUST } );
		await askOrPlay( AUGUST );
		expect( globalThis.__listen.ask ).not.toHaveBeenCalled();
		expect( globalThis.__songs.playCid ).toHaveBeenCalledWith( AUGUST, { play: true } );
	} );
} );
