// @vitest-environment happy-dom
/**
 * Traverse mode's bacon graph is one frame in the pane, moved by message
 * rather than loaded again (Justin, #connectome, 18 Nov 2026).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePaneStore } from '../../src/stores/pane.js';

const SONG = { _trackCid: 'QmSong', title: 'August', _metadataTitle: 'Release:QmSong' };

describe( 'the pane\'s bacon graph', () => {
	beforeEach( () => setActivePinia( createPinia() ) );

	it( 'opens the song\'s own graph in a frame, told it is inside Rabbithole', () => {
		const pane = usePaneStore();
		expect( pane.bacon( SONG ) ).toBe( true );
		expect( pane.view.kind ).toBe( 'graph' );
		expect( pane.view.src ).toBe( '/bacon?cut=QmSong&host=rabbithole' );
		expect( pane.view.card ).toBe( null );
	} );

	it( 'moves the same frame to a soloist, with their card, and back', () => {
		const pane = usePaneStore();
		pane.bacon( SONG );
		pane.bacon( SONG, 'Harry Clark' );
		expect( pane.view.src ).toBe( '/bacon?cut=QmSong&host=rabbithole' );   // not loaded again
		expect( pane.view.to ).toBe( '?p=Harry+Clark&playing=QmSong' );
		expect( pane.view.card ).toBe( 'Harry Clark' );
		pane.bacon( SONG );
		expect( pane.view.to ).toBe( '?cut=QmSong' );
		expect( pane.view.card ).toBe( null );
	} );

	it( 'says no for a song the graph does not hold', () => {
		const pane = usePaneStore();
		pane.markUnheld( 'QmSong' );
		expect( pane.bacon( SONG ) ).toBe( false );
	} );

	it( 'leaves the graph to a reader who moved it: no more asks, and no card', () => {
		const pane = usePaneStore();
		pane.bacon( SONG, 'Harry Clark' );
		pane.letGraphBe();
		expect( pane.view.to ).toBe( null );
		expect( pane.view.card ).toBe( null );
	} );

	it( 'knows the song\'s own pages', () => {
		const pane = usePaneStore();
		expect( pane.isSongPage( 'Song:August', SONG ) ).toBe( true );
		expect( pane.isSongPage( 'Release:QmSong', SONG ) ).toBe( true );
		expect( pane.isSongPage( 'Harry Clark', SONG ) ).toBe( false );
	} );
} );
