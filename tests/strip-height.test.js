/*
 * The strip's height is written in one place.
 *
 * On 14 Nov 2026 Skyler saw the song chart cut in half on a phone: the
 * component had laid out two rows, and a rule in the narrow-screen
 * section pinned the chart at one row's 28px, so the second row was
 * clipped by `overflow: hidden`. Two heights for one thing, and the
 * one that lost was the one that knew how many rows there were.
 *
 * So: nothing may give the chart or the strip a height in pixels. The
 * chart's height comes from --parts-rows (set by SongParts.vue, which
 * measures), and everything that has to clear the strip -- the bar,
 * its padding, the article beside it -- reads --rh-strip.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(
	fileURLToPath( new URL( '../src/styles/app.css', import.meta.url ) ),
	'utf8'
);

/** Every `selector { ... }` in the file, media queries and all. */
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

describe( 'the song strip', () => {
	it( 'is never given a height in pixels', () => {
		const pinned = rules().filter(
			( r ) =>
				/\.parts-chart\s*$|\.parts-strip\s*$|\.data-section\s*$/.test( r.selector ) &&
				/(^|[;{\s])height:\s*\d/.test( r.body )
		);
		expect(
			pinned.map( ( r ) => r.selector ),
			'a height in px beats the row count the chart measured'
		).toEqual( [] );
	} );

	it( 'is what the bar clears, in both layouts', () => {
		expect( css ).toMatch( /--rh-strip:\s*calc\(/ );
		expect( css ).toMatch( /padding-bottom:\s*var\(--rh-strip\)/ );
		expect( css ).toMatch( /height:\s*var\(--rh-strip\)/ );
		// the grip's rail on the dock's top edge, the player, and the strip (21 Nov 2026: the grip)
		expect( css ).toMatch( /--rh-dock:\s*calc\(\s*var\(--rh-grip\)\s*\+\s*var\(--rh-dock-body\)\s*\+\s*var\(--rh-strip\)\s*\)/ );
	} );

	it( 'grows by a row when the chart lays out two', () => {
		expect( css ).toMatch(
			/body\.bottom-bar:has\(\s*\.parts-chart\.two-rows\s*\)\s*\{[^}]*--rh-strip-rows:\s*2/
		);
	} );
} );
