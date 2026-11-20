/*
 * The card a shared bacon graph's link shows (Justin, #connectome, 20 Nov
 * 2026). public/bacon.html is a Caddy template: served for /bacon, it reads
 * the built index.html and writes a head for the address over the app's own
 * title and description, which it finds by their exact text. Caddy is not
 * run here (the template was run on Caddy 2.11.7, the server's, before it was
 * merged); what is held here is what would break it without a word: the two
 * lines it looks for, and the pictures it names.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const at = ( rel ) => fileURLToPath( new URL( '../../' + rel, import.meta.url ) );
const index = readFileSync( at( 'index.html' ), 'utf8' );
const template = readFileSync( at( 'public/bacon.html' ), 'utf8' );

/** Every string the template swaps out of index.html: the second argument of each `replace`. */
function swapped() {
	const last = template.slice( template.lastIndexOf( 'readFile "index.html"' ) );
	return [ ...last.matchAll( /replace (?:"((?:[^"\\]|\\.)*)"|`([^`]*)`) \$/g ) ].map( ( m ) => m[ 1 ] !== undefined ? m[ 1 ] : m[ 2 ] );
}

describe( 'the bacon graph\'s social card', () => {
	it( 'swaps the app\'s title and its description, each found once in index.html as written', () => {
		const found = swapped();
		expect( found ).toHaveLength( 2 );
		expect( found[ 0 ] ).toBe( '<title>Rabbithole</title>' );
		for ( const text of found ) {
			expect( index.split( text ).length - 1, text ).toBe( 1 );
		}
	} );

	it( 'names pictures that are there, 1200 by 630 as it says', () => {
		const named = [ ...template.matchAll( /\$pic :?= "([a-z-]+)"/g ) ].map( ( m ) => m[ 1 ] );
		expect( [ ...new Set( named ) ].sort() ).toEqual( [ 'oracle', 'six-degrees' ] );
		for ( const name of new Set( named ) ) {
			const png = readFileSync( at( `public/cards/${ name }.png` ) );
			expect( png.subarray( 1, 4 ).toString( 'latin1' ) ).toBe( 'PNG' );
			expect( [ png.readUInt32BE( 16 ), png.readUInt32BE( 20 ) ] ).toEqual( [ 1200, 630 ] );
		}
	} );

	it( 'escapes every word it takes from the address', () => {
		// The head is one printf: each of its arguments goes through html.
		const args = template.slice( template.indexOf( '$head := printf' ), template.indexOf( '$desc := printf' ) ).split( '`' ).pop();
		expect( args.match( /\(html \$\w+\)/g ) ).toHaveLength( 9 );
		expect( args.replace( /\(html \$\w+\)/g, '' ).trim() ).toBe( '-}}\n{{-' );
		expect( template ).toContain( '$desc := printf `<meta name="description" content="%s">` (html $say)' );
	} );
} );
