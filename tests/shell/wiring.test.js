/**
 * Guards on how the pieces are wired together, rather than on what any one of
 * them computes.
 *
 * Every assertion here corresponds to something that actually went wrong and
 * went unnoticed:
 *
 *  - two days of work went into the shell the deployed URL route does not
 *    serve, because nothing said which file was the product;
 *  - a scene the player can put on a card had no styling anywhere, because the
 *    half of a commit that set the class was dropped and only the CSS was left;
 *  - a stylesheet sat in the repo that no page loaded, which is how a pickup
 *    animation went missing for thirteen months.
 *
 * They read files as text on purpose. A test that needs a browser would not
 * have been written, and these cost nothing to run.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

const root = resolve( __dirname, '../..' );
const read = ( p ) => readFileSync( resolve( root, p ), 'utf8' );

// The shell Caddy serves for a path with no file behind it. The route lives in
// maybelle-config: handle_path /rabbithole/* { try_files {path} {path}/ /shell.html }
const FALLBACK_SHELL = 'shell.html';

describe( 'which file is the product', () => {
	it( 'ships the shell the URL fallback serves', () => {
		const names = readdirSync( root ).filter( ( f ) => f.endsWith( '.html' ) );

		expect( names ).toContain( FALLBACK_SHELL );
	} );

	// KNOWN, and waiting on Justin: which of the shells is the product. Marked
	// failing on purpose -- it.fails() passes while the drift is real and starts
	// failing the moment somebody resolves it, which is the prompt to delete
	// this marker and let the assertion stand.
	it.fails( 'keeps the PickiPedia shell and the fallback shell from drifting apart', () => {
		// Both exist today and they are different pages: shell.html is from
		// April and carries the old sidebar, pickipedia-demo.html carries the
		// bottom bar. Whichever way that is resolved -- merge them, or delete
		// one -- this test says so out loud rather than letting a deep link
		// quietly serve the older one.
		const fallback = read( FALLBACK_SHELL );
		const demo = read( 'pickipedia-demo.html' );

		const bothAreShells =
			fallback.includes( 'webamp' ) && demo.includes( 'webamp' );
		expect( bothAreShells ).toBe( true );

		const sameLayout =
			fallback.includes( 'bottom-bar' ) === demo.includes( 'bottom-bar' );
		expect(
			sameLayout,
			'shell.html and pickipedia-demo.html disagree about the layout, and ' +
			'shell.html is the one a deep link gets. Merge them or delete one.'
		).toBe( true );
	} );
} );

describe( 'card scenes', () => {
	const player = read( 'src/player/webamp-chartifacts.js' );

	// The scenes Justin's feature map can name, from the weighting switch.
	const scenes = [ ...player.matchAll( /case '([a-z]+)':/g ) ].map( ( m ) => m[ 1 ] );

	it( 'knows the scenes the weighting switch handles', () => {
		expect( scenes ).toContain( 'lead' );
		expect( scenes ).toContain( 'cooldown' );
		expect( scenes ).toContain( 'harmony' );
		expect( scenes ).toContain( 'rhythm' );
	} );

	it( 'puts the scene on the card as well as sorting by it', () => {
		// The half that was lost: `const classes = [ musicianScene ]`. Without
		// it the cards reorder by scene and never change colour, which reads as
		// "the highlights do not work" and is invisible in a static page.
		expect(
			/\[\s*musicianScene\s*\]/.test( player ),
			'the player sorts by scene but never puts it on the card'
		).toBe( true );
	} );

	it( 'has styling for every scene it can emit', () => {
		const styles = [
			...readdirSync( resolve( root, 'src/styles' ) )
				.filter( ( f ) => f.endsWith( '.css' ) )
				.map( ( f ) => read( `src/styles/${ f }` ) ),
			...readdirSync( root ).filter( ( f ) => f.endsWith( '.html' ) ).map( read ),
			player,
		].join( '\n' );

		const unstyled = scenes.filter( ( scene ) => !styles.includes( `.${ scene }` ) );

		expect( unstyled, `scenes with no styling anywhere: ${ unstyled.join( ', ' ) }` ).toEqual( [] );
	} );
} );

describe( 'stylesheets', () => {
	it( 'loads every stylesheet it ships', () => {
		const pages = readdirSync( root )
			.filter( ( f ) => f.endsWith( '.html' ) )
			.map( read )
			.join( '\n' );

		const orphans = readdirSync( resolve( root, 'src/styles' ) )
			.filter( ( f ) => f.endsWith( '.css' ) )
			.filter( ( f ) => !pages.includes( f ) );

		expect( orphans, `stylesheets no page loads: ${ orphans.join( ', ' ) }` ).toEqual( [] );
	} );
} );
