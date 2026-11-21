// @vitest-environment happy-dom
/*
 * A new song turns traverse mode on, in an entry of its own.
 *
 * Justin, #connectome, 21 Nov 2026, 01:56Z: "When exploring, if I click the rabbithole play button, it starts the
 * track which is good, but it still doesn't kick it into bacon graph traverse. It seems to me that any time a new
 * song starts, it needs to go back to bacon traverse mode. And if the user wants to keep doing what they were
 * doing, they can just click "back", right?"
 *
 * Here: what counts as a new song (traverse.js), and that the pane store gives the music an entry of its own over
 * one the reader made, so Back is back to theirs, and that an entry on another page of the graph's loads.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { aSongStarts } from '../../src/traverse.js';

describe( 'a new song starts', () => {
	it( 'when a different recording stands than did', () => {
		expect( aSongStarts( { cid: 'QmPaint', oldCid: 'QmAugust', booted: 'QmAugust' } ) ).toBe( true );
		expect( aSongStarts( { cid: 'QmAugust', oldCid: 'QmPaint', booted: 'QmAugust' } ) ).toBe( true );   // back to the first one is a start too
	} );
	it( 'when the first one is asked for where none stood: come by /bacon, a play button on a graph', () => {
		expect( aSongStarts( { cid: 'QmPaint', oldCid: null, booted: null } ) ).toBe( true );
	} );
	it( 'not when it is the song the visit opened with: the address named it, and says where the pane opens', () => {
		expect( aSongStarts( { cid: 'QmAugust', oldCid: null, booted: 'QmAugust' } ) ).toBe( false );
	} );
	it( 'not when the same recording is played again, or nothing stands', () => {
		expect( aSongStarts( { cid: 'QmAugust', oldCid: 'QmAugust', booted: null } ) ).toBe( false );
		expect( aSongStarts( { cid: null, oldCid: 'QmAugust', booted: null } ) ).toBe( false );
		expect( aSongStarts() ).toBe( false );
	} );
} );

describe( 'the music takes an entry of its own over the reader\'s', () => {
	let pane, layout, push, replace;
	const SONG = { _trackCid: 'QmX', title: 'Paint Exchange', _metadataTitle: 'Release:QmX/Metadata' };
	beforeEach( async () => {
		vi.resetModules();
		setActivePinia( createPinia() );
		window.history.replaceState( null, '', '/bacon' );
		const { usePaneStore } = await import( '../../src/stores/pane.js' );
		const { useLayoutStore } = await import( '../../src/stores/layout.js' );
		pane = usePaneStore();
		layout = useLayoutStore();
		// The reader came by /bacon and steered to a picker: the frame is there, and the entry is theirs.
		pane.openGraph( '/bacon?p=Cory+Walker' );
		layout.stopTraversing();
		pane.heardGraphAt( { at: '/bacon?p=Cory+Walker', step: true, n: 2, s: 'abc' } );
		push = vi.spyOn( window.history, 'pushState' );
		replace = vi.spyOn( window.history, 'replaceState' );
	} );
	const last = ( spy ) => spy.mock.calls[ spy.mock.calls.length - 1 ][ 0 ];

	it( 'pushes the song\'s graph, the music\'s, and moves the one frame there by word into a view of its own', () => {
		expect( window.history.state ).toEqual( { graph: '/bacon?p=Cory+Walker', n: 2, s: 'abc' } );
		layout.startTraversing();
		pane.bacon( SONG );
		expect( last( push ) ).toEqual( { graph: '/bacon?cut=QmX', music: true } );
		expect( replace ).not.toHaveBeenCalled();                    // the reader's entry is left as they had it
		// `fresh`: the frame gives the view a number of its own, so the step before keeps its drawing.
		expect( pane.view ).toMatchObject( { kind: 'graph', traverse: true, to: '?cut=QmX', fresh: true, cid: 'QmX' } );
	} );
	it( 'and from then the solos move it in place, in that entry', () => {
		layout.startTraversing();
		pane.bacon( SONG );
		pane.heardGraphAt( { at: '/bacon?cut=QmX', step: false, n: 3, s: 'abc' } );
		push.mockClear();
		pane.bacon( SONG, 'Cory Walker' );
		expect( push ).not.toHaveBeenCalled();
		expect( pane.view ).toMatchObject( { to: '?p=Cory+Walker&playing=QmX', fresh: false } );
	} );
	it( 'does the same where the reader had steered away from the music\'s own graph', () => {
		// Traverse mode was on at the song; they clicked a picker (a step), which turned it off.
		window.history.replaceState( null, '', '/bacon' );
		layout.startTraversing();
		pane.bacon( { _trackCid: 'QmA', title: 'August' } );
		pane.heardGraphAt( { at: '/bacon?p=Kyle+Tuttle', step: true, n: 5, s: 'abc' } );
		pane.letGraphBe();
		layout.stopTraversing();
		push.mockClear();
		// The next song starts.
		layout.startTraversing();
		pane.bacon( SONG );
		expect( last( push ) ).toEqual( { graph: '/bacon?cut=QmX', music: true } );
		expect( pane.view ).toMatchObject( { to: '?cut=QmX', fresh: true } );
	} );
	it( 'over a page the reader was reading, too', async () => {
		vi.doMock( '../../src/wiki/api.js', async ( original ) => ( {
			...( await original() ),
			parsePage: async ( title ) => ( { text: '<p>' + title + '</p>', displaytitle: title } ),
		} ) );
		window.history.replaceState( { wikiTitle: 'Kyle Tuttle' }, '', '/rabbithole/?page=Kyle_Tuttle' );
		layout.startTraversing();
		pane.bacon( SONG );
		expect( last( push ) ).toEqual( { graph: '/bacon?cut=QmX', music: true } );
	} );
	it( 'Back onto the reader\'s entry sends the frame to their step, as drawn', () => {
		layout.startTraversing();
		pane.bacon( SONG );
		// Back: the browser is on the reader's entry again.
		pane.showGraph( { graph: '/bacon?p=Cory+Walker', n: 2, s: 'abc' } );
		expect( pane.stepWord ).toEqual( { rabbithole: 'step', to: '/bacon?p=Cory+Walker', n: 2, s: 'abc' } );
		expect( pane.view ).toMatchObject( { kind: 'graph', to: null } );
	} );
} );

describe( 'Back to a page of the graph\'s the frame has left', () => {
	let pane, layout;
	beforeEach( async () => {
		vi.resetModules();
		setActivePinia( createPinia() );
		window.history.replaceState( null, '', '/bacon/challenge/Cory_Walker' );
		const { usePaneStore } = await import( '../../src/stores/pane.js' );
		const { useLayoutStore } = await import( '../../src/stores/layout.js' );
		pane = usePaneStore();
		layout = useLayoutStore();
		layout.stopTraversing();
		pane.openGraph( '/bacon/challenge/Cory_Walker' );
		pane.heardGraphAt( { at: '/bacon/challenge/Cory_Walker?p=Kyle+Tuttle', step: true, n: 2, s: 'abc' } );
	} );

	it( 'loads it: a new song took the frame from a challenge to the song\'s graph, and a step is not sent across pages', () => {
		const was = pane.graphSrc;
		expect( was ).toContain( '/bacon/challenge/Cory_Walker' );
		layout.startTraversing();
		pane.bacon( { _trackCid: 'QmX', title: 'Paint Exchange' } );
		expect( pane.graphSrc ).toContain( '/bacon?cut=QmX' );        // read from the path, so it loaded
		expect( window.history.state ).toEqual( { graph: '/bacon?cut=QmX', music: true } );
		// Back, with traverse mode off again as App.vue sets it.
		layout.stopTraversing();
		pane.stepWord = null;
		pane.showGraph( { graph: '/bacon/challenge/Cory_Walker?p=Kyle+Tuttle', n: 2, s: 'abc' } );
		expect( pane.graphSrc ).toContain( '/bacon/challenge/Cory_Walker?p=Kyle+Tuttle' );
		expect( pane.graphSrc ).toContain( 'steer=1' );
		expect( pane.stepWord ).toBe( null );
	} );
	it( 'and within one page a step is still a word, not a load', () => {
		const was = pane.graphSrc;
		pane.showGraph( { graph: '/bacon/challenge/Cory_Walker', n: 1, s: 'abc' } );
		expect( pane.graphSrc ).toBe( was );
		expect( pane.stepWord ).toMatchObject( { rabbithole: 'step', n: 1 } );
	} );
} );
