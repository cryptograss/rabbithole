// @vitest-environment happy-dom
/*
 * Traverse mode at /bacon (Justin, #connectome, 20 Nov 2026, 13:59Z: "I still show that, by default, traverse
 * is off - I want it to be bacon graphs by default"). Come by /bacon to the song's own graph, it starts on bacon
 * graphs, as Rabbithole does; come to anyone else's, the reader steers, and it comes on at the song.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { isSongsOwnGraph } from '../../src/shell.js';

const SONG = 'QmcBuh5HCvVCCdCz6KqWf891QkXeKc3T7QBaToYE8mSLtS';

describe( 'the song\'s own graph', () => {
	it( 'is the track\'s cut, at nobody, whatever else the graph is told', () => {
		expect( isSongsOwnGraph( '/bacon?s=Paint+Exchange&cut=' + SONG, SONG ) ).toBe( true );
		expect( isSongsOwnGraph( '/bacon?cut=' + SONG, SONG ) ).toBe( true );
	} );
	it( 'is not a picker\'s graph, another song\'s, a kept graph, or any graph with no track', () => {
		expect( isSongsOwnGraph( '/bacon?cut=' + SONG + '&p=Cory+Walker', SONG ) ).toBe( false );
		expect( isSongsOwnGraph( '/bacon?p=Cory+Walker&playing=' + SONG, SONG ) ).toBe( false );
		expect( isSongsOwnGraph( '/bacon?cut=QmOther', SONG ) ).toBe( false );
		expect( isSongsOwnGraph( '/bacon/c0123456789', SONG ) ).toBe( false );
		expect( isSongsOwnGraph( '/bacon?cut=' + SONG, null ) ).toBe( false );
		expect( isSongsOwnGraph( null, SONG ) ).toBe( false );
	} );
} );

describe( 'traverse mode, come by /bacon', () => {
	async function layoutAt( address ) {
		window.history.replaceState( null, '', address );
		vi.resetModules();
		setActivePinia( createPinia() );
		const { useLayoutStore } = await import( '../../src/stores/layout.js' );
		return useLayoutStore();
	}
	afterEach( () => window.history.replaceState( null, '', '/' ) );

	it( 'starts on bacon graphs at the song\'s own graph (Justin\'s address)', async () => {
		const layout = await layoutAt( '/bacon?s=Paint+Exchange&cut=' + SONG + '&track=' + SONG );
		expect( layout.traverse ).toBe( 'bacon' );
	} );
	it( 'starts off at a picker\'s graph with the song standing, and comes on as bacon graphs at the song', async () => {
		const layout = await layoutAt( '/bacon?p=Cory+Walker&track=' + SONG );
		expect( layout.traverse ).toBe( 'off' );
		expect( layout.resumeTraversing() ).toBe( 'bacon' );
	} );
	it( 'starts off with nothing to play: the reader steers', async () => {
		const layout = await layoutAt( '/bacon?p=Cory+Walker' );
		expect( layout.traverse ).toBe( 'off' );
	} );
	it( 'starts on bacon graphs in Rabbithole, as before', async () => {
		const layout = await layoutAt( '/rabbithole/?track=' + SONG );
		expect( layout.traverse ).toBe( 'bacon' );
	} );
} );

describe( 'a step of the rabbithole\'s own turns traverse mode on (Justin, 15 Nov 2026)', () => {
	let layout;
	beforeEach( async () => {
		setActivePinia( createPinia() );
		const { useLayoutStore } = await import( '../../src/stores/layout.js' );
		layout = useLayoutStore();
	} );

	it( 'as one of the rocker\'s three, never a bare true', () => {
		layout.setTraverse( 'off' );
		layout.startTraversing();
		expect( layout.traverse ).toBe( 'bacon' );
	} );
	it( 'as it was before the reader went somewhere', () => {
		layout.setTraverse( 'pages' );
		layout.stopTraversing();
		layout.startTraversing();
		expect( layout.traverse ).toBe( 'pages' );
	} );
	it( 'and leaves a mode that is on as it is', () => {
		layout.setTraverse( 'pages' );
		layout.startTraversing();
		expect( layout.traverse ).toBe( 'pages' );
	} );
} );
