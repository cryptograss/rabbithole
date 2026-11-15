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
		const css = read( 'src/styles/ensemble.css' );
		for ( const scene of [ 'lead', 'pickup', 'out', 'cooldown', 'harmony', 'rhythm' ] ) {
			expect( css, `no rule for .musician-card.${ scene }` ).toMatch( new RegExp( `\\.musician-card\\.${ scene }\\b` ) );
		}
	} );

	it( 'style every state a card can be put in, and put a card in every state that is styled', () => {
		// Two halves again: the card names a class for each effect in
		// force, the sheet says what each looks like, and a name on only
		// one side is a light that never comes on.
		const css = read( 'src/styles/ensemble.css' );
		const card = read( 'src/components/MusicianCard.vue' );
		for ( const cls of [ 'fx-flourish', 'fx-glow', 'fx-band', 'fx-enter', 'is-lit', 'is-away', 'singing' ] ) {
			expect( css, `no rule for .${ cls }` ).toContain( '.' + cls );
			expect( card, `the card never wears ${ cls }` ).toMatch( new RegExp( `['\\s]${ cls }['\\s:,]` ) );
		}
		expect( css ).toContain( '.cards-move' );
	} );

	it( 'black out the player pane for a spotlight, from both ends', () => {
		// Justin's item 22 (15 Nov 2026): the player pane goes dark for the
		// length of a spotlight. The pane names itself, and the stage is
		// laid over whatever carries that name; either half alone is a
		// stage with nowhere to stand.
		expect( read( 'src/styles/app.css' ) ).toMatch( /#rabbithole-sidebar \{\s*anchor-name: --rh-player-pane;/ );
		expect( read( 'src/styles/ensemble.css' ) ).toMatch( /\.rh-spotlight \{[^}]*position-anchor: --rh-player-pane;/ );
		expect( read( 'src/components/Ensemble.vue' ) ).toContain( '<SpotlightStage' );
		expect( read( 'src/components/SpotlightStage.vue' ) ).toContain( 'class="rh-spotlight"' );
	} );

	it( 'move nothing for anyone who has asked for less motion', () => {
		const css = read( 'src/styles/ensemble.css' );
		const reduced = css.slice( css.indexOf( '@media (prefers-reduced-motion: reduce)' ) );
		expect( reduced ).toMatch( /animation: none !important/ );
		expect( reduced ).toMatch( /\.rh-spotlight \{\s*display: none;/ );
		expect( reduced ).toContain( '.cards-move' );
	} );

	it( 'touch no shadow and no box\'s size in a keyframe', () => {
		// The glow used to be five box-shadows pulsed by keyframes, which
		// repaints the card and whatever it overlaps on every frame.
		const css = read( 'src/styles/ensemble.css' ).replace( /\/\*[\s\S]*?\*\//g, '' );
		// Each @keyframes, brace for brace: some are written on one line.
		const frames = [ ...css.matchAll( /@keyframes [\w-]+\s*\{/g ) ].map( ( m ) => {
			const from = m.index + m[ 0 ].length;
			let depth = 1;
			let to = from;
			while ( depth && to < css.length ) {
				depth += css[ to ] === '{' ? 1 : css[ to ] === '}' ? -1 : 0;
				to++;
			}
			return css.slice( from, to - 1 );
		} );
		expect( frames.length ).toBeGreaterThan( 15 );
		expect( frames.join( '\n' ) ).not.toMatch( /box-shadow|width|height|inset|padding|margin|\btop:|\bleft:/ );
	} );

	it( 'give Webamp\'s window one home per layout', () => {
		const css = read( 'src/styles/app.css' );
		expect( css ).toMatch( /body\.bottom-bar #webamp div:has\(> #main-window\)/ );
		expect( css ).toMatch( /body:not\(\.bottom-bar\) #webamp div:has\(> #main-window\)/ );
	} );
} );

describe( 'no timers coordinate the shell', () => {
	// The audit's finding, pinned: components and stores wait for state,
	// never for a clock. The model keeps one alarm, for the chart's next
	// marker (model.js), and the flash on a Listen button (queue.js) is a
	// label.
	const files = [ 'src/App.vue', ...filesUnder( 'src/components' ), ...filesUnder( 'src/stores' ) ];

	it.each( files )( '%s has no setTimeout, setInterval or MutationObserver', ( file ) => {
		expect( read( file ) ).not.toMatch( /setTimeout\(|setInterval\(|MutationObserver/ );
	} );
} );
