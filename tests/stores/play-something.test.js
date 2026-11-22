// @vitest-environment happy-dom
/*
 * The carrot pressed with no song on: one of the ready songs, one not heard yet where there is one, played, and
 * traverse mode on bacon graphs (Justin, #connectome, 22 Nov 2026, 00:14Z).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock( '../../src/player/webamp-global.js', () => ( { default: () => class {} } ) );

import { playSomething } from '../../src/wiki/queue.js';
import { useSongStore } from '../../src/stores/song.js';
import { useLayoutStore } from '../../src/stores/layout.js';
import { useWalkStore } from '../../src/stores/walk.js';

describe( 'playSomething', () => {
	let songs, played;
	beforeEach( () => {
		setActivePinia( createPinia() );
		songs = useSongStore();
		played = vi.spyOn( songs, 'playCid' ).mockResolvedValue( true );
	} );

	it( 'plays a ready song not yet heard, and turns traverse on to bacon graphs', async () => {
		vi.spyOn( songs, 'readyList' ).mockResolvedValue( [ { cid: 'Qa', title: 'August' }, { cid: 'Qp', title: 'Paint Exchange' } ] );
		vi.spyOn( useWalkStore(), 'hops', 'get' ).mockReturnValue( [ { cid: 'Qa' } ] );
		const layout = useLayoutStore();
		layout.stopTraversing();
		expect( await playSomething( ( list ) => list[ 0 ] ) ).toBe( 'Qp' );
		expect( played ).toHaveBeenCalledWith( 'Qp', { play: true } );
		expect( layout.traverse ).toBe( 'bacon' );
	} );

	it( 'plays nothing, and leaves traverse as it was, when no song is ready', async () => {
		vi.spyOn( songs, 'readyList' ).mockResolvedValue( [] );
		const layout = useLayoutStore();
		layout.stopTraversing();
		expect( await playSomething() ).toBe( null );
		expect( played ).not.toHaveBeenCalled();
		expect( layout.traverse ).toBe( 'off' );
	} );
} );
