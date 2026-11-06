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
	const player = read( 'src/player/rabbithole-player.js' );

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

describe( 'the queue', () => {
	// One queue: Webamp's playlist. The shell kept its own array for a
	// while, waiting on a track-end hook the player never fired, and a
	// queued song was never reached (audit, 5 Nov 2026, item 1).
	it( 'is Webamp\'s playlist, with no copy in the shell and no end-of-track hook', () => {
		const shell = read( 'pickipedia-demo.html' );
		const player = read( 'src/player/rabbithole-player.js' );

		expect( shell ).not.toMatch( /const rabbitholeQueue/ );
		expect( player ).not.toMatch( /playNextInRabbithole/ );
		expect( shell ).toMatch( /rabbitholePlayer\.enqueue\(/ );
		expect( shell ).toMatch( /onSongChange:/ );
describe( 'where Webamp\'s window lives', () => {
	// A rule, not a correction. Five loops used to poll for the window and
	// write our position back over Webamp's, so the player drew in one
	// place and jumped to another (audit, 5 Nov 2026, item 3).
	it( 'is a stylesheet rule the player writes, with no observer and no poll', () => {
		const player = read( 'src/player/rabbithole-player.js' );
		const shell = read( 'pickipedia-demo.html' );

		expect( player ).toMatch( /div:has\(> #main-window\)/ );
		expect( player ).not.toMatch( /MutationObserver/ );
		expect( player ).not.toMatch( /waitForMainWindow/ );
		expect( shell ).not.toMatch( /MutationObserver/ );
		expect( shell ).not.toMatch( /pinWebamp|holdWebampStill|wireVolume\(tries|waitForAudio\(tries/ );
/*
 * The save to PickiPedia reads the wiki's answer. MediaWiki says
 * result: Success with nochange when the page already had the text, which
 * is how an edit that never reached the wiki showed "Saved!" (5 and 6 Nov
 * 2026). And in the raw view, Save applies what is typed first, so an
 * unapplied textarea can't be saved around.
 */
describe( 'saving to PickiPedia', () => {
	const demo = read( 'pickipedia-demo.html' );
	const save = demo.slice( demo.indexOf( 'async function saveToWiki' ) );

	it( 'reads the edit result and the nochange flag', () => {
		expect( save ).toContain( "edit.result !== 'Success'" );
		expect( save ).toContain( "'nochange' in edit" );
		expect( save ).toContain( 'markSaved({ unchanged: true })' );
		expect( save ).toContain( 'markSaved({ revisionId: edit.newrevid })' );
	} );

	it( 'applies typed raw YAML before saving', () => {
		expect( save ).toContain( 'editorInstance.applyPendingRawYaml()' );
	} );

	it( 'never says Saved on its own authority', () => {
		expect( save ).not.toContain( "'Saved!'" );
		expect( demo ).not.toContain( "'Save to PickiPedia' : 'Saved'" );
	} );
} );
