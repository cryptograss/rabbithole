// @vitest-environment happy-dom
/**
 * Traverse mode's rocker and its coming back on (Justin, #connectome, 18 Nov
 * 2026): bacon graphs by default; the reader going somewhere turns it off,
 * coming back to the song turns it on as it was; set by hand, it stays set.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLayoutStore } from '../../src/stores/layout.js';

describe( 'traverse mode, as the layout keeps it', () => {
	beforeEach( () => setActivePinia( createPinia() ) );

	it( 'starts on bacon graphs', () => {
		expect( useLayoutStore().traverse ).toBe( 'bacon' );
	} );

	it( 'goes off when the reader goes somewhere, and back on as it was when they come back', () => {
		const layout = useLayoutStore();
		layout.setTraverse( 'pages' );
		layout.stopTraversing();
		expect( layout.traverse ).toBe( 'off' );
		expect( layout.resumeTraversing() ).toBe( 'pages' );
		expect( layout.traverse ).toBe( 'pages' );
	} );

	it( 'remembers the mode through a second step away', () => {
		const layout = useLayoutStore();
		layout.stopTraversing();
		layout.stopTraversing();
		expect( layout.resumeTraversing() ).toBe( 'bacon' );
	} );

	it( 'stays off when it was set off by hand', () => {
		const layout = useLayoutStore();
		layout.setTraverse( 'off' );
		layout.stopTraversing();
		expect( layout.resumeTraversing() ).toBe( 'off' );
	} );

	it( 'counts a setting on the rocker, and ignores a mode it does not have', () => {
		const layout = useLayoutStore();
		const before = layout.chosen;
		layout.setTraverse( 'pages' );
		layout.setTraverse( 'sideways' );
		expect( layout.traverse ).toBe( 'pages' );
		expect( layout.chosen ).toBe( before + 1 );
	} );
} );
