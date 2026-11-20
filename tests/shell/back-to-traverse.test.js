// @vitest-environment happy-dom
/*
 * Back to where the music had the pane turns traverse mode on again.
 *
 * Justin, #connectome, 20 Nov 2026: "If someone turns traverse off by navigating, but then uses 'back' to get all
 * the way back to where they were when traverse was on, it needs to turn back on, whether they're going all the
 * way back to the song node, or if they departed traverse on a picker."
 *
 * An entry of the history written while traverse mode is on is the music's, and says so (`music`). Here: when
 * coming onto one is coming back (traverse.js), and which entries the pane store marks.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { comesBackToTheMusic } from '../../src/traverse.js';

describe( 'coming back to the music', () => {
	const away = { traverse: 'off', resume: 'bacon', standing: true };
	const musics = { graph: '/bacon?p=Cory+Walker&playing=QmX', n: 3, s: 'abc', music: true };

	it( 'is Back onto the music\'s entry, having gone off reading', () => {
		expect( comesBackToTheMusic( musics, away ) ).toBe( true );
		expect( comesBackToTheMusic( { wikiTitle: 'Cory Walker', music: true }, { ...away, resume: 'pages' } ) ).toBe( true );
	} );
	it( 'is not Back onto an entry the reader made', () => {
		expect( comesBackToTheMusic( { graph: '/bacon?p=Cory+Walker', n: 4, s: 'abc' }, away ) ).toBe( false );
		expect( comesBackToTheMusic( { wikiTitle: 'Cory Walker' }, away ) ).toBe( false );
		expect( comesBackToTheMusic( null, away ) ).toBe( false );
	} );
	it( 'stays off when it was set off on the rocker: there is nothing to resume', () => {
		expect( comesBackToTheMusic( musics, { traverse: 'off', resume: null, standing: true } ) ).toBe( false );
		expect( comesBackToTheMusic( musics, { traverse: 'off', resume: 'off', standing: true } ) ).toBe( false );
	} );
	it( 'is the reader steering when traverse mode is on: Back away from where the music is', () => {
		expect( comesBackToTheMusic( musics, { traverse: 'bacon', resume: null, standing: true } ) ).toBe( false );
		expect( comesBackToTheMusic( musics, { traverse: 'pages', resume: 'bacon', standing: true } ) ).toBe( false );
	} );
	it( 'needs a song standing for the pane to travel with', () => {
		expect( comesBackToTheMusic( musics, { ...away, standing: false } ) ).toBe( false );
	} );
} );

describe( 'which entries of the history are the music\'s', () => {
	let pane, layout, push, replace;
	const SONG = { _trackCid: 'QmX', title: 'Paint Exchange', _metadataTitle: 'Release:QmX/Metadata' };
	beforeEach( async () => {
		vi.resetModules();
		setActivePinia( createPinia() );
		window.history.replaceState( null, '', '/rabbithole/?track=QmX' );
		vi.doMock( '../../src/wiki/api.js', async ( original ) => ( {
			...( await original() ),
			parsePage: async ( title ) => ( { text: '<p>' + title + '</p>', displaytitle: title } ),
			songPageOf: async () => 'Song:Paint Exchange',
		} ) );
		const { usePaneStore } = await import( '../../src/stores/pane.js' );
		const { useLayoutStore } = await import( '../../src/stores/layout.js' );
		pane = usePaneStore();
		layout = useLayoutStore();
		push = vi.spyOn( window.history, 'pushState' );
		replace = vi.spyOn( window.history, 'replaceState' );
	} );
	const last = ( spy ) => spy.mock.calls[ spy.mock.calls.length - 1 ][ 0 ];

	it( 'the graph traverse mode opens, and not one the reader opens', () => {
		pane.bacon( SONG );
		expect( last( replace ) ).toEqual( { graph: '/bacon?cut=QmX', music: true } );
		pane.openGraph( '/bacon?p=Cory+Walker', {}, { step: true } );
		expect( last( push ) ).toEqual( { graph: '/bacon?p=Cory+Walker' } );
	} );
	it( 'where the music moves the frame, and where the frame says again that it is', () => {
		pane.bacon( SONG );
		expect( layout.traverse ).toBe( 'bacon' );
		pane.heardGraphAt( { at: '/bacon?p=Cory+Walker&playing=QmX', step: false, n: 1, s: 'abc' } );
		expect( last( replace ) ).toEqual( { graph: '/bacon?p=Cory+Walker&playing=QmX', n: 1, s: 'abc', music: true } );
		expect( push ).not.toHaveBeenCalled();
	} );
	it( 'never a step the reader took, though traverse mode is still on when it is heard', () => {
		pane.bacon( SONG );
		pane.heardGraphAt( { at: '/bacon?p=Cory+Walker&playing=QmX', step: false, n: 1, s: 'abc' } );
		replace.mockClear();
		// The frame says the step, then that the reader moved it: the step is heard with traverse mode still on.
		pane.heardGraphAt( { at: '/bacon?p=Kyle+Tuttle', step: true, n: 2, s: 'abc' } );
		expect( last( push ) ).toEqual( { graph: '/bacon?p=Kyle+Tuttle', n: 2, s: 'abc' } );
		// And the music's entry, behind it, was not written again: it still says it is the music's.
		expect( replace ).not.toHaveBeenCalled();
	} );
	it( 'nor anything heard once the reader has steered', () => {
		pane.bacon( SONG );
		pane.heardGraphAt( { at: '/bacon?p=Kyle+Tuttle', step: true, n: 2, s: 'abc' } );
		layout.stopTraversing();
		pane.heardGraphAt( { at: '/bacon?p=Kyle+Tuttle&turn=1', step: false, n: 2, s: 'abc' } );
		expect( last( replace ) ).toEqual( { graph: '/bacon?p=Kyle+Tuttle&turn=1', n: 2, s: 'abc' } );
	} );
	it( 'a page traverse mode opens says so, and a page the reader opens does not', async () => {
		await pane.open( 'Cory Walker', { music: true } );
		expect( last( push ) ).toEqual( { wikiTitle: 'Cory Walker', music: true } );
		await pane.open( 'Kyle Tuttle' );
		expect( last( push ) ).toEqual( { wikiTitle: 'Kyle Tuttle' } );
		await pane.openSong( SONG, { push: false, music: true } );
		await vi.waitFor( () => expect( last( replace ) ).toEqual( { wikiTitle: 'Song:Paint Exchange', music: true } ) );
	} );
	it( 'a page already asked for is still marked when the music asks for it', async () => {
		await pane.open( 'Cory Walker', { push: false } );
		await pane.open( 'Cory Walker', { music: true } );
		expect( last( push ) ).toEqual( { wikiTitle: 'Cory Walker', music: true } );
	} );
} );

describe( 'the pane goes where the music is now, in the entry come back to', () => {
	let pane, push, replace;
	const SONG = { _trackCid: 'QmX', title: 'Paint Exchange' };
	beforeEach( async () => {
		vi.resetModules();
		setActivePinia( createPinia() );
		window.history.replaceState( null, '', '/rabbithole/?track=QmX' );
		const { usePaneStore } = await import( '../../src/stores/pane.js' );
		pane = usePaneStore();
		pane.bacon( SONG );
		push = vi.spyOn( window.history, 'pushState' );
		replace = vi.spyOn( window.history, 'replaceState' );
	} );
	const last = ( spy ) => spy.mock.calls[ spy.mock.calls.length - 1 ][ 0 ];

	it( 'moves the one frame by word, rewriting the entry and pushing none', () => {
		// Back came onto the music's entry: the frame is sent to the step, then on to where the music is.
		window.history.replaceState( { graph: '/bacon?p=Cory+Walker&playing=QmX', n: 1, s: 'abc', music: true }, '', '/bacon?p=Cory+Walker&playing=QmX&track=QmX' );
		pane.showGraph( window.history.state );
		expect( pane.stepWord ).toMatchObject( { rabbithole: 'step', n: 1, s: 'abc' } );
		pane.bacon( SONG, null, { inPlace: true } );
		expect( pane.view ).toMatchObject( { kind: 'graph', traverse: true, to: '?cut=QmX', fresh: false } );
		expect( push ).not.toHaveBeenCalled();
		// The frame's own number for the entry stands: it was sent to that step, and draws the next under it.
		expect( last( replace ) ).toEqual( { graph: '/bacon?cut=QmX', n: 1, s: 'abc', music: true } );
	} );
	it( 'keeps the frame\'s own number for the entry when the music is where the entry was', () => {
		window.history.replaceState( { graph: '/bacon?cut=QmX', n: 1, s: 'abc', music: true }, '', '/bacon?cut=QmX&track=QmX' );
		pane.showGraph( window.history.state );
		pane.bacon( SONG, null, { inPlace: true } );
		expect( last( replace ) ).toEqual( { graph: '/bacon?cut=QmX', n: 1, s: 'abc', music: true } );
	} );
	it( 'rewrites a page\'s entry too, where the music had the pane on a page', () => {
		window.history.replaceState( { wikiTitle: 'Cory Walker', music: true }, '', '/rabbithole/?track=QmX&page=Cory+Walker' );
		pane.bacon( SONG, null, { inPlace: true } );
		expect( push ).not.toHaveBeenCalled();
		expect( last( replace ) ).toEqual( { graph: '/bacon?cut=QmX', music: true } );
	} );
	it( 'leaves the number behind when the entry is rewritten for another place, not come back to', () => {
		window.history.replaceState( { graph: '/bacon?p=Kyle+Tuttle', n: 4, s: 'abc' }, '', '/bacon?p=Kyle+Tuttle&track=QmX' );
		pane.letGraphBe();
		pane.openGraph( '/bacon?p=Cory+Walker' );
		expect( last( replace ) ).toEqual( { graph: '/bacon?p=Cory+Walker' } );
	} );
	it( 'and without the word, a graph opened over a page is still a step of its own', () => {
		window.history.replaceState( { wikiTitle: 'Cory Walker' }, '', '/rabbithole/?track=QmX&page=Cory+Walker' );
		pane.letGraphBe();
		pane.openGraph( '/bacon?p=Kyle+Tuttle' );
		expect( last( push ) ).toEqual( { graph: '/bacon?p=Kyle+Tuttle' } );
	} );
} );
