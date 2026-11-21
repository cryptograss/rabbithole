// @vitest-environment happy-dom
/*
 * Come by /bacon to explore, the drawer starts folded; it starts open only where the address brings a song.
 *
 * Justin, #connectome, 21 Nov 2026, 22:14Z: "let's have the left pane (rabbithole) collapsed by default for bacon
 * exploring - have it only be expanded by default if a song is loaded and ready to play."
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { startsFolded } from '../../src/shell.js';
import { useLayoutStore } from '../../src/stores/layout.js';

const q = ( s ) => new URLSearchParams( s );

describe( 'startsFolded', () => {
	it( 'folds at /bacon with nothing to play', () => {
		expect( startsFolded( true, q( '' ) ) ).toBe( true );
		expect( startsFolded( true, q( 'p=Harry+Clark' ) ) ).toBe( true );
	} );
	it( 'stays open where the address brings a track or a record', () => {
		expect( startsFolded( true, q( 'cut=Qm1&track=Qm1' ) ) ).toBe( false );
		expect( startsFolded( true, q( 'record=Qm2' ) ) ).toBe( false );
	} );
	it( 'leaves Rabbithole\'s own address as it was: open', () => {
		expect( startsFolded( false, q( '' ) ) ).toBe( false );
	} );
} );

describe( 'foldDock', () => {
	beforeEach( () => setActivePinia( createPinia() ) );
	it( 'folds whichever drawer stands, and openDock opens it again', () => {
		const layout = useLayoutStore();
		layout.foldDock();
		expect( layout.isBar ? layout.collapsed : layout.minimized ).toBe( true );
		layout.openDock();
		expect( layout.isBar ? layout.collapsed : layout.minimized ).toBe( false );
	} );
} );
