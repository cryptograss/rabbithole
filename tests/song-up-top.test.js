/*
 * What is playing heads the page it is about, in either layout.
 *
 * It used to live in the dock when the dock was the bottom bar: 250px
 * of a row the ensemble was starving in, so two of six cards showed
 * and the rest scrolled (Skyler, 14 Nov 2026, on a desktop). On a
 * phone it was worse -- the cover, the title and the track list took
 * two rows of a 256px dock on an 844px screen.
 *
 * So the song's line is in the page's column, once, and the dock is
 * controls. A rule that places it, or any part of it, back in the bar
 * puts the cards back in a 290px gutter, which is what this guards.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = ( p ) => readFileSync( fileURLToPath( new URL( p, import.meta.url ) ), 'utf8' );
const css = read( '../src/styles/app.css' );
const app = read( '../src/App.vue' );

/** Every `selector { ... }` in the stylesheet, media queries and all. */
function rules() {
	const found = [];
	const re = /([^{}]+)\{([^{}]*)\}/g;
	let m;
	while ( ( m = re.exec( css ) ) ) {
		const selector = m[ 1 ].replace( /\/\*[\s\S]*?\*\//g, '' ).trim();
		if ( selector && ! selector.startsWith( '@' ) ) {
			found.push( { selector, body: m[ 2 ] } );
		}
	}
	return found;
}

/** The song's line and the pieces of it. */
const SONG_PARTS = /\.song-info-header|\.song-title-display|\.album-row|\.album-art|\.album-track-select|\.song-select|\.record-line|\.recording-metadata|\.up-next/;

describe( 'what is playing', () => {
	it( 'is rendered once, in the page\'s column', () => {
		expect( app.match( /<SongInfo\b/g ) ).toHaveLength( 1 );
		expect( app ).toMatch( /<div class="pane-column">\s*<SongInfo \/>/ );
	} );

	it( 'is not placed in the dock by any bar rule', () => {
		const placed = rules().filter(
			( r ) =>
				/bottom-bar/.test( r.selector ) &&
				SONG_PARTS.test( r.selector ) &&
				! /\.pane-column/.test( r.selector )
		);
		expect(
			placed.map( ( r ) => r.selector ),
			'the dock is controls; the song heads the page'
		).toEqual( [] );
	} );

	it( 'leaves the bar\'s middle to the cards', () => {
		// Webamp and the header are the bar's two fixed ends; everything
		// between them is the ensemble's, which is what makes six cards
		// fit at 1200px.
		expect( css ).toMatch( /body\.bottom-bar #ensemble-display\s*\{[^}]*flex:\s*1 1 auto/ );
	} );
} );

describe( 'the page beside the bar', () => {
	it( 'is the window minus the dock, said once', () => {
		expect( css ).toMatch(
			/body\.bottom-bar \.pane-column\s*\{[^}]*height:\s*calc\(100vh - var\(--rh-dock\)\)/
		);
		// Collapsed, the dock is 40px -- as the dock's height, so the
		// page and the editor panel follow from it rather than from
		// three copies of `calc(100vh - 40px)`.
		expect( css ).toMatch( /body\.bottom-bar\.bar-collapsed\s*\{\s*--rh-dock:\s*40px/ );
		expect( css ).not.toMatch( /calc\(100vh - 40px\)/ );
	} );
} );
