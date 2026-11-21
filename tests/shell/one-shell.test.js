// @vitest-environment happy-dom
/*
 * One shell (src/shell.js; Justin, #connectome, 19 Nov 2026): /bacon is this app, the graph is one frame in the
 * pane, and the shell keeps the one history. Here: which addresses are the graph's, what of an address is the
 * graph's and what the shell's, and how the pane store keeps the history as the frame says where it is.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { isGraphAddress, graphAt, frameSrc, shellAddress, movesByWord } from '../../src/shell.js';
import { appAddress } from '../../src/wiki/urls.js';

describe( 'the graph\'s addresses', () => {
	it( 'knows /bacon, a kept graph and a challenge, and nothing else', () => {
		[ '/bacon', '/bacon/', '/bacon/c0123456789', '/bacon/challenge', '/bacon/challenge/Tony_Rice' ].forEach( ( p ) => expect( isGraphAddress( p ) ).toBe( true ) );
		[ '/rabbithole/', '/baconator', '/wiki/Bacon', '', undefined ].forEach( ( p ) => expect( isGraphAddress( p ) ).toBe( false ) );
	} );
	it( 'takes the graph\'s part of an address: not the track, the play, or what says a frame is hosted', () => {
		expect( graphAt( '/bacon?p=Cory+Walker&track=QmX&play=1&layout=bar' ) ).toBe( '/bacon?p=Cory+Walker' );
		expect( graphAt( '/bacon?cut=QmX&host=rabbithole&shell=1&bar=1&steer=1' ) ).toBe( '/bacon?cut=QmX' );
		expect( graphAt( '/bacon?cut=QmX&host=rabbithole&shell=1&bar=1' ) ).toBe( '/bacon?cut=QmX' );
		expect( graphAt( '/bacon/challenge/Tony_Rice/?p=Kyle+Tuttle&track=QmX' ) ).toBe( '/bacon/challenge/Tony_Rice?p=Kyle+Tuttle' );
		expect( graphAt( '/bacon/' ) ).toBe( '/bacon' );
		expect( graphAt( '/bacon?page=69th+Annual+Grammy+Awards' ) ).toBe( '/bacon?page=69th+Annual+Grammy+Awards' );   // a page's own graph: the graph's word here
		expect( graphAt( '/rabbithole/?track=QmX' ) ).toBe( null );
	} );
	it( 'frames a place hosted, in the shell, and says when the reader steers', () => {
		expect( frameSrc( '/bacon?p=Cory+Walker' ) ).toBe( '/bacon?p=Cory+Walker&host=rabbithole&shell=1&bar=1' );
		expect( frameSrc( '/bacon', true ) ).toBe( '/bacon?host=rabbithole&shell=1&bar=1&steer=1' );
		expect( frameSrc( '/bacon/challenge/Tony_Rice', true ) ).toBe( '/bacon/challenge/Tony_Rice?host=rabbithole&shell=1&bar=1&steer=1' );
	} );
	it( 'writes the shell\'s address: the place, and the track that stands', () => {
		expect( shellAddress( '/bacon?p=Cory+Walker', 'QmX' ) ).toBe( '/bacon?p=Cory+Walker&track=QmX' );
		expect( shellAddress( '/bacon', null ) ).toBe( '/bacon' );
		expect( graphAt( shellAddress( '/bacon?p=Cory+Walker', 'QmX' ) ) ).toBe( '/bacon?p=Cory+Walker' );          // and back
	} );
	it( 'moves the frame by word within the plain graph, and loads a kept graph, a challenge, the Oracle', () => {
		expect( movesByWord( '/bacon?cut=QmX', '/bacon?p=Cory+Walker' ) ).toBe( true );
		expect( movesByWord( '/bacon', '/bacon?p=Cory+Walker' ) ).toBe( true );
		expect( movesByWord( '/bacon?cut=QmX', '/bacon' ) ).toBe( false );
		expect( movesByWord( '/bacon?cut=QmX', '/bacon/challenge/Tony_Rice' ) ).toBe( false );
		expect( movesByWord( '/bacon/challenge/Tony_Rice?p=Kyle+Tuttle', '/bacon?p=Cory+Walker' ) ).toBe( false );   // a word would be a jump of the game's
		expect( movesByWord( '/bacon/c0123456789', '/bacon?p=Cory+Walker' ) ).toBe( false );
	} );
	it( 'leaves the graph\'s words behind when the pane goes to a page', () => {
		expect( appAddress( 'Cory Walker', 'https://pickipedia.xyz/bacon?p=Kyle+Tuttle&keep=Cory+Walker&track=QmX&play=1' ) )
			.toBe( '/?track=QmX&page=Cory+Walker' );
		expect( appAddress( 'Cory Walker', 'https://pickipedia.xyz/rabbithole/?track=QmX&layout=bar' ) ).toBe( '/?track=QmX&layout=bar&page=Cory+Walker' );
	} );
} );

describe( 'the one history, kept by the shell', () => {
	let pane, layout, push, replace;
	beforeEach( async () => {
		setActivePinia( createPinia() );
		window.history.replaceState( null, '', '/rabbithole/?track=QmX' );
		( { usePaneStore: pane } = await import( '../../src/stores/pane.js' ) );
		( { useLayoutStore: layout } = await import( '../../src/stores/layout.js' ) );
		pane = pane();
		push = vi.spyOn( window.history, 'pushState' );
		replace = vi.spyOn( window.history, 'replaceState' );
	} );

	it( 'makes the entry in sight the graph\'s when the pane opens on one, and keeps the track in the address', () => {
		pane.openGraph( '/bacon?cut=QmX' );
		expect( push ).not.toHaveBeenCalled();
		expect( replace ).toHaveBeenLastCalledWith( { graph: '/bacon?cut=QmX' }, '', '/bacon?cut=QmX&track=QmX' );
	} );
	it( 'puts a step the reader took in the history, and rewrites the entry for anything else', () => {
		pane.openGraph( '/bacon?cut=QmX' );
		expect( pane.heardGraphAt( { at: '/bacon?p=Cory+Walker', step: true, n: 2, s: 'abc' } ) ).toBe( true );
		expect( push ).toHaveBeenLastCalledWith( { graph: '/bacon?p=Cory+Walker', n: 2, s: 'abc' }, '', '/bacon?p=Cory+Walker&track=QmX' );
		// The reader moved the graph, so traverse mode is off (WikiPane, at the frame's `moved`): the entry is theirs.
		layout().stopTraversing();
		pane.heardGraphAt( { at: '/bacon?p=Cory+Walker&turn=1', step: false, n: 2, s: 'abc' } );
		expect( push ).toHaveBeenCalledTimes( 1 );
		expect( replace ).toHaveBeenLastCalledWith( { graph: '/bacon?p=Cory+Walker&turn=1', n: 2, s: 'abc' }, '', '/bacon?p=Cory+Walker&turn=1&track=QmX' );
	} );
	it( 'hears nothing that is not the graph\'s address', () => {
		pane.openGraph( '/bacon?cut=QmX' );
		expect( pane.heardGraphAt( { at: '/wiki/Main_Page', step: true } ) ).toBe( false );
		expect( pane.heardGraphAt( { at: 'https://evil.example/bacon', step: true } ) ).toBe( true );   // only its path and query are read
		expect( push ).toHaveBeenLastCalledWith( expect.objectContaining( { graph: '/bacon' } ), '', '/bacon?track=QmX' );
	} );
	it( 'moves the one frame by word for a graph opened from a page, as a step of its own', () => {
		pane.openGraph( '/bacon?cut=QmX' );
		const src = pane.graphSrc;
		window.history.replaceState( { wikiTitle: 'Cory Walker' }, '', '/rabbithole/?track=QmX&page=Cory+Walker' );
		pane.openGraph( '/bacon?p=Cory+Walker&host=rabbithole' );
		expect( pane.graphSrc ).toBe( src );                                                // the same frame
		expect( pane.view ).toMatchObject( { kind: 'graph', to: '?p=Cory+Walker', fresh: true } );
		expect( push ).toHaveBeenLastCalledWith( { graph: '/bacon?p=Cory+Walker' }, '', '/bacon?p=Cory+Walker&track=QmX' );
	} );
	it( 'loads a challenge, which is read from the path', () => {
		pane.openGraph( '/bacon?cut=QmX' );
		pane.openGraph( '/bacon/challenge/Tony_Rice', {}, { step: true } );
		expect( pane.graphSrc ).toBe( '/bacon/challenge/Tony_Rice?host=rabbithole&shell=1&bar=1' );
		expect( pane.view.to ).toBe( null );
	} );
	it( 'comes back to a step of the graph\'s with a word for the frame, and nothing written', () => {
		pane.openGraph( '/bacon?cut=QmX' );
		push.mockClear();
		replace.mockClear();
		pane.showGraph( { graph: '/bacon?p=Cory+Walker', n: 2, s: 'abc' } );
		expect( pane.view ).toEqual( { kind: 'graph', src: pane.graphSrc, to: null } );
		expect( pane.stepWord ).toEqual( { rabbithole: 'step', to: '/bacon?p=Cory+Walker', n: 2, s: 'abc' } );
		expect( push ).not.toHaveBeenCalled();
		// The address alone is brought up to what stands now (the track), the entry's state as it was.
		expect( replace ).toHaveBeenCalledTimes( 1 );
		expect( replace ).toHaveBeenLastCalledWith( window.history.state, '', '/bacon?p=Cory+Walker&track=QmX' );
	} );
	it( 'lets the graph be once the reader moves it, wherever it was opened from', () => {
		pane.openGraph( '/bacon?cut=QmX' );
		window.history.replaceState( { wikiTitle: 'X' }, '', '/rabbithole/?page=X' );
		pane.openGraph( '/bacon?p=Cory+Walker' );
		pane.letGraphBe();
		expect( pane.view ).toMatchObject( { to: null, fresh: false } );
	} );
} );
