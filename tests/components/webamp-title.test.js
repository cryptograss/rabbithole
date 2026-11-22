// @vitest-environment happy-dom
/*
 * Webamp's own title is the way back to the track (Justin, #connectome, 22 Nov 2026, 00:55Z: "That leaves us with
 * no way to click back to the track we're on - can we make it so that clicking the title in webamp does that?
 * Returns us to the track centered in a bacon graph, and turns traverse bacon graphs back on?").
 *
 * Here: the click, taken on the way down off whichever letter of the marquee was under the pointer; and what the
 * dock does with it, which is to set traverse mode to bacon graphs, whereupon the pane goes to the track's own
 * graph at once (App.vue watches layout.chosen).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { titleGoesBack } from '../../src/player/model.js';
import { useLayoutStore } from '../../src/stores/layout.js';

/** Webamp's marquee as it renders it: a span per character inside #marquee. */
function webampBox( word = 'August' ) {
	const box = document.createElement( 'div' );
	box.innerHTML = '<div id="webamp"><div id="main-window"><div id="marquee" class="text" title="Song Title">' +
		[ ...word ].map( ( c ) => `<span class="character">${ c }</span>` ).join( '' ) +
		'</div><div id="next"></div></div></div>';
	document.body.append( box );
	return box;
}

describe( 'Webamp\'s title, clicked', () => {
	it( 'calls the hook off any letter of it, and keeps the click from Webamp', () => {
		const box = webampBox();
		const back = vi.fn();
		titleGoesBack( box, back );
		const letter = box.querySelectorAll( '#marquee .character' )[ 3 ];
		const e = new window.MouseEvent( 'click', { bubbles: true, cancelable: true } );
		letter.dispatchEvent( e );
		expect( back ).toHaveBeenCalledTimes( 1 );
		expect( e.defaultPrevented ).toBe( true );
	} );

	it( 'says what it does, where Webamp said what it is', () => {
		const box = webampBox();
		titleGoesBack( box, () => {} );
		expect( box.querySelector( '#marquee' ).title ).toBe( 'Back to this song, in a bacon graph' );
	} );

	it( 'leaves every other press of Webamp\'s alone', () => {
		const box = webampBox();
		const back = vi.fn();
		titleGoesBack( box, back );
		box.querySelector( '#next' ).dispatchEvent( new window.MouseEvent( 'click', { bubbles: true, cancelable: true } ) );
		expect( back ).not.toHaveBeenCalled();
	} );
} );

describe( 'what the dock does with it', () => {
	beforeEach( () => setActivePinia( createPinia() ) );
	it( 'turns traverse to bacon graphs and asks for the track, not for whoever is taking a solo', () => {
		const layout = useLayoutStore();
		layout.setTraverse( 'pages' );
		layout.stopTraversing();
		expect( layout.traverse ).toBe( 'off' );
		const chosen = layout.chosen, asked = layout.backToTrack;
		layout.toTheTrack();                                        // what WebampDock hands the model as its onTitle
		expect( layout.traverse ).toBe( 'bacon' );                  // bacon graphs, though the rocker was last on pages
		expect( layout.resume ).toBe( null );
		expect( layout.backToTrack ).toBe( asked + 1 );             // App.vue takes the pane to the track's own graph
		expect( layout.chosen ).toBe( chosen );                     // and not to the soloist, which `chosen` would
	} );
} );
