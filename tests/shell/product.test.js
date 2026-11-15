/**
 * Guards on how the pieces are wired together, rather than on what any one
 * of them computes. Every assertion corresponds to something that went
 * wrong and went unnoticed in the single-file shell:
 *
 *  - two days of work went into a shell the deployed route did not serve,
 *    because nothing said which file was the product;
 *  - a scene the player can put on a card had no styling anywhere;
 *  - a stylesheet sat in the repo that no page loaded;
 *  - timers coordinated what state should have.
 *
 * They read files as text on purpose: these cost nothing to run.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';

const root = resolve( __dirname, '../..' );
const read = ( p ) => readFileSync( resolve( root, p ), 'utf8' );

/** Every file under a directory of the source, directories walked through. */
function filesUnder( dir ) {
	return readdirSync( resolve( root, dir ) ).flatMap( ( name ) => (
		statSync( resolve( root, dir, name ) ).isDirectory()
			? filesUnder( dir + '/' + name )
			: [ dir + '/' + name ]
	) );
}

describe( 'which file is the product', () => {
	it( 'is index.html, the app, and nothing else is a shell', () => {
		const pages = readdirSync( root ).filter( ( f ) => f.endsWith( '.html' ) );
		expect( pages ).toEqual( [ 'index.html' ] );
	} );

	it( 'loads Webamp as a classic script before the app, from public/', () => {
		const html = read( 'index.html' );
		// A root-relative path to public/: Vite prefixes the base in dev and
		// in the build alike. (%BASE_URL% is prefixed twice in dev.)
		expect( html ).toMatch( /<script src="\/vendor\/webamp\.bundle\.js"><\/script>/ );
		expect( html.indexOf( 'webamp.bundle.js' ) ).toBeLessThan( html.indexOf( 'src/main.js' ) );
		expect( existsSync( resolve( root, 'public/vendor/webamp.bundle.js' ) ) ).toBe( true );
	} );

	it( 'is served from /rabbithole/ and installs as an app', () => {
		const config = read( 'vite.config.js' );
		expect( config ).toContain( "base: '/rabbithole/'" );
		expect( config ).toContain( 'VitePWA(' );
		expect( config ).toContain( "display: 'standalone'" );
	} );
} );

describe( 'stylesheets', () => {
	it( 'are all loaded by the app', () => {
		// The app's own sheets are imported by main.js; the pane's are
		// imported as text by the module that adopts them into its shadow
		// root, where a <link> in the page would never reach. Either way a
		// sheet nobody imports is a sheet nobody loads.
		const source = [ 'src/main.js', ...filesUnder( 'src/wiki' ), ...filesUnder( 'src/components' ) ]
			.map( read ).join( '\n' );
		const sheets = readdirSync( resolve( root, 'src/styles' ) ).filter( ( f ) => f.endsWith( '.css' ) );
		for ( const sheet of sheets ) {
			expect( source, `${ sheet } is in src/styles but nothing imports it` ).toContain( `styles/${ sheet }` );
		}
	} );

	it( 'style every scene the chart can put on a card', () => {
		const css = read( 'src/styles/app.css' ) + read( 'src/styles/scenes.css' );
		for ( const scene of [ 'lead', 'pickup', 'out', 'cooldown', 'harmony', 'rhythm' ] ) {
			expect( css, `no rule for .musician-card.${ scene }` ).toMatch( new RegExp( `\\.musician-card\\.${ scene }\\b` ) );
		}
	} );

	it( 'style the effects the model can fire', () => {
		const css = read( 'src/styles/app.css' );
		for ( const cls of [ 'flourish-active', 'spotlight-active', 'fx-dim', 'band-flash-active' ] ) {
			expect( css ).toContain( '.' + cls );
		}
		expect( css ).toContain( '.cards-move' );
	} );

	it( 'black out the player pane for a spotlight, from both ends', () => {
		// Justin's item 22 (15 Nov 2026): the player pane goes dark for the
		// length of a spotlight. Two halves, and either one alone does
		// nothing: App.vue wears the class off the live effect, app.css
		// says what wearing it looks like.
		expect( read( 'src/App.vue' ) ).toMatch( /kind === 'spotlight'/ );
		expect( read( 'src/App.vue' ) ).toMatch( /id="rabbithole-sidebar"[^>]*:class="\{ spotlit \}"/ );
		expect( read( 'src/styles/app.css' ) ).toContain( '#rabbithole-sidebar.spotlit' );
	} );

	it( 'give Webamp\'s window one home per layout', () => {
		const css = read( 'src/styles/app.css' );
		expect( css ).toMatch( /body\.bottom-bar #webamp div:has\(> #main-window\)/ );
		expect( css ).toMatch( /body:not\(\.bottom-bar\) #webamp div:has\(> #main-window\)/ );
	} );
} );

describe( 'no timers coordinate the shell', () => {
	// The audit's finding, pinned: components and stores wait for state,
	// never for a clock. Effects (model.js) are the one place a duration is
	// a duration, and the flash on a Listen button (queue.js) is a label.
	const files = [ 'src/App.vue', ...filesUnder( 'src/components' ), ...filesUnder( 'src/stores' ) ];

	it.each( files )( '%s has no setTimeout, setInterval or MutationObserver', ( file ) => {
		expect( read( file ) ).not.toMatch( /setTimeout\(|setInterval\(|MutationObserver/ );
	} );
} );
