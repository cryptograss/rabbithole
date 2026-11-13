#!/usr/bin/env node
/**
 * A playthrough of Rabbithole in a real browser (headless Chromium), with sound.
 *
 * `npm test` (vitest) checks the parts, in a fake DOM with no audio. This
 * checks the whole, the way a person meets it: press the carrot, and the song
 * is fetched, decoded and played, Webamp's clock moves, and what the song's
 * chart says should happen on screen happens when the song gets there.
 *
 * Its expectations come from the song's chart on the wiki, read through the
 * app's own timeline functions (src/player/timeline.js). So it follows the
 * chart, whatever the chart says this week, and needs no copy of it.
 *
 * "With sound" means the Web Audio graph's analyser reads non-zero energy:
 * the audio was fetched, decoded and played. Nobody listens. The press is
 * Playwright's click, a trusted gesture, so the browser's autoplay rules
 * apply as they would to a person.
 *
 * It only reads. It opens the timeline editor and uses Copy YAML, to see
 * which page Save would write and with what, but it never presses Save.
 *
 *   npm run dev                  # in another shell
 *   npm run test:e2e             # http://127.0.0.1:5173/rabbithole/
 *   npm run test:e2e -- https://pickipedia.xyz/rabbithole/
 *
 * It needs Playwright's Chromium (npx playwright install chromium), or the
 * path of another in RH_CHROMIUM.
 *
 * Exits 1 if any check fails.
 */
import { chromium } from 'playwright';
import yaml from 'js-yaml';
import { processTimeline, entries, songPartTimes, currentArrangement, soloistOf } from '../../src/player/timeline.js';

const BASE = process.argv[ 2 ] || process.env.RH_URL || 'http://127.0.0.1:5173/rabbithole/';

let failures = 0;
function check( name, ok, detail = '' ) {
	if ( ! ok ) {
		failures++;
	}
	console.log( `  ${ ok ? 'ok  ' : 'FAIL' } ${ name }${ detail ? `  (${ detail })` : '' }` );
	return ok;
}

/** What the page shows now: Webamp's clock, the audio, the carrot, the cards, the pane's page. */
function look( page ) {
	return page.evaluate( () => {
		const digits = [ ...document.querySelectorAll( '#time .digit' ) ]
			.map( ( d ) => ( d.className.match( /digit-(\d)/ ) || [] )[ 1 ] ).join( '' );
		const analyser = ( window.__rhAnalysers || [] )[ 0 ];
		let energy = null;
		if ( analyser ) {
			const bins = new Uint8Array( analyser.frequencyBinCount );
			analyser.getByteFrequencyData( bins );
			energy = bins.reduce( ( sum, v ) => sum + v, 0 );
		}
		// What's gone of the carrot is a black rect in its mask, from its edge to
		// the tip; with none of it gone there's no rect, and the carrot is whole.
		const gone = document.querySelector( '.carrot-btn:not([hidden]) mask rect.carrot-gone' );
		const name = ( card ) => ( card.querySelector( '.musician-name' ) || card ).textContent
			.replace( /⭐/g, '' ).replace( /\(.*$/, '' ).trim();
		return {
			clock: /^\d{4}$/.test( digits ) ? Number( digits.slice( 0, 2 ) ) * 60 + Number( digits.slice( 2 ) ) : null,
			audio: analyser ? analyser.context.state : null,
			energy,
			edgeX: gone ? Number( gone.getAttribute( 'x' ) ) : null,
			lead: [ ...document.querySelectorAll( '.musician-card.lead' ) ].map( name ),
			flourish: [ ...document.querySelectorAll( '.musician-card.flourish-active' ) ].map( name ),
			// The page in the pane: the address names it as ?page= (or, on the
			// wiki itself, as /wiki/<title>).
			pane: ( new URLSearchParams( location.search ).get( 'page' )
				|| decodeURIComponent( location.pathname ).replace( /^.*\/wiki\//, '' ) ).replace( /_/g, ' ' ),
		};
	} );
}

/** Look until `test` holds, for at most `seconds`; the last look either way. */
async function until( page, test, seconds ) {
	const end = Date.now() + seconds * 1000;
	let seen = await look( page );
	while ( ! test( seen ) && Date.now() < end ) {
		await page.waitForTimeout( 250 );
		seen = await look( page );
	}
	return seen;
}

/** A song's chart, from its /Metadata page on the wiki, as the app reads it. */
async function chartOf( cid ) {
	const api = new URL( '/api.php', BASE );
	api.search = new URLSearchParams( { action: 'query', prop: 'revisions', rvprop: 'content|ids', rvslots: 'main',
		titles: `Release:${ cid }/Metadata`, format: 'json', formatversion: '2' } );
	const page = ( await ( await fetch( api ) ).json() ).query.pages[ 0 ];
	if ( ! page.revisions ) {
		throw new Error( `no chart on the wiki at Release:${ cid }/Metadata` );
	}
	const revision = page.revisions[ 0 ];
	return { revid: revision.revid, data: yaml.load( revision.slots.main.content ) };
}

/** The same object, keys sorted at every level, as JSON: for comparing two charts. */
function canonical( value ) {
	return JSON.stringify( value, ( _key, v ) => ( v && typeof v === 'object' && ! Array.isArray( v )
		? Object.fromEntries( Object.keys( v ).sort().map( ( k ) => [ k, v[ k ] ] ) ) : v ) );
}

const songTitle = ( page ) => page.locator( '#song-title-display' )
	.evaluate( ( h ) => h.firstChild.textContent.trim() );

// RH_CHROMIUM: a Chromium of your own, when Playwright's download isn't there.
const browser = await chromium.launch( { executablePath: process.env.RH_CHROMIUM || undefined } );
try {
	await run();
} catch ( e ) {
	// A check that can't even be made (no such button, no chart) is a failure too, said once.
	check( 'the playthrough ran to the end', false, e.message.split( '\n' )[ 0 ] );
} finally {
	await browser.close();
}

console.log( failures ? `${ failures } failed` : 'all passed' );
process.exit( failures ? 1 : 0 );

async function run() {
	console.log( `Rabbithole at ${ BASE }` );

	// --- Desktop: a song, played --------------------------------------------
	const context = await browser.newContext( { viewport: { width: 1280, height: 800 } } );
	await context.addInitScript( () => {
		window.__rhAnalysers = [];
		const make = BaseAudioContext.prototype.createAnalyser;
		BaseAudioContext.prototype.createAnalyser = function () {
			const analyser = make.call( this );
			window.__rhAnalysers.push( analyser );
			return analyser;
		};
	} );
	const page = await context.newPage();
	await page.goto( BASE );
	await page.locator( '#song-title-display' ).waitFor();
	const song = await songTitle( page );

	let seen = await until( page, ( s ) => s.pane === `Song:${ song }`, 15 );
	check( 'a song opens on its own Song: page', seen.pane === `Song:${ song }`, `${ song }; pane: ${ seen.pane }` );

	const select = page.locator( '#song-selector:visible' ).first();
	const songs = await select.locator( 'option' ).allTextContents();
	check( 'the dropdown lists the songs charted on the wiki', songs.length > 1 && songs.includes( song ),
		`${ songs.length }: ${ songs.join( ', ' ) }` );
	const cid = await select.inputValue();
	const { revid, data: chart } = await chartOf( cid );
	const processed = processTimeline( chart );
	const partTimes = songPartTimes( processed );
	const soloAt = ( t ) => soloistOf( currentArrangement( processed, t ) ) || null;
	console.log( `  chart: Release:${ cid }/Metadata, revision ${ revid }, ${ partTimes.length } parts` );

	const before = await look( page );
	await page.locator( '.carrot-btn:visible' ).first().click();
	seen = await until( page, ( s ) => s.clock >= ( before.clock || 0 ) + 2, 15 );
	check( 'pressing the carrot plays: Webamp\'s clock moves', seen.clock >= ( before.clock || 0 ) + 2,
		`${ before.clock } s, then ${ seen.clock } s` );
	check( 'the audio is running', seen.audio === 'running', `AudioContext ${ seen.audio }` );
	seen = await until( page, ( s ) => s.energy > 0, 5 );
	check( 'with sound: the analyser hears the song', seen.energy > 0, `energy ${ seen.energy }` );

	// Follow the solo, as the song gets there by itself.
	const now = seen.clock;
	const next = entries( processed ).find( ( e ) => e.time > now + 0.5 && soloAt( e.time ) && soloAt( e.time ) !== soloAt( now ) );
	if ( next && next.time - now < 25 ) {
		const who = soloAt( next.time );
		seen = await until( page, ( s ) => s.pane === who, next.time - now + 6 );
		check( `following the solo: at ${ next.time } s the pane opens ${ who }`, seen.pane === who, `pane: ${ seen.pane }, at ${ seen.clock } s` );
		check( `${ who }'s card leads, starred`, seen.lead.includes( who ), `leading: ${ seen.lead.join( ', ' ) || 'nobody' }` );
	} else {
		console.log( '  (no solo changes hands in the next 25 s; the seek below checks following)' );
	}

	// Jump into a later part that someone else solos.
	const chips = page.locator( '[title="Jump to this part"]' );
	check( 'the parts strip has a chip for each part', await chips.count() === partTimes.length,
		`${ await chips.count() } chips, ${ partTimes.length } parts` );
	const here = soloAt( ( await look( page ) ).clock );
	let target = -1;
	for ( let i = Math.floor( partTimes.length / 2 ); i < partTimes.length && target < 0; i++ ) {
		const who = soloAt( partTimes[ i ] + 0.01 );
		if ( who && who !== here ) {
			target = i;
		}
	}
	if ( check( 'the chart has a later part soloed by someone else', target >= 0 ) ) {
		const who = soloAt( partTimes[ target ] + 0.01 );
		await chips.nth( target ).click();
		seen = await until( page, ( s ) => Math.abs( s.clock - partTimes[ target ] ) <= 2 && s.pane === who, 8 );
		check( `jumping to part ${ target + 1 } seeks there`, Math.abs( seen.clock - partTimes[ target ] ) <= 2,
			`part starts ${ partTimes[ target ] } s; clock ${ seen.clock } s` );
		check( `and the pane follows to ${ who }`, seen.pane === who, `pane: ${ seen.pane }` );
		const after = seen.clock;
		seen = await until( page, ( s ) => s.clock >= after + 2, 6 );
		check( 'after a seek the clock keeps moving', seen.clock >= after + 2, `${ after } s, then ${ seen.clock } s` );

		// The carrot goes as the song goes: its edge moves from the tip toward
		// the greens, and seeking back gives it back.
		const late = seen.edgeX;
		await chips.nth( 1 ).click();
		seen = await until( page, ( s ) => s.edgeX !== null && late !== null && s.edgeX > late, 4 );
		const partTwo = seen.edgeX;
		check( 'the carrot goes as the song goes: back at part 2 it is longer', late !== null && partTwo !== null && partTwo > late,
			`edge x ${ late } at part ${ target + 1 }, ${ partTwo } at part 2` );
		await chips.nth( 0 ).click();
		seen = await until( page, ( s ) => s.edgeX === null || s.edgeX > partTwo, 4 );
		check( 'back at the start the carrot is (nearly) whole', seen.edgeX === null || seen.edgeX > partTwo,
			`edge x ${ seen.edgeX }, was ${ partTwo } at part 2` );
	}

	// A flourish, when the song reaches it.
	const flourishes = entries( processed ).filter( ( e ) => e.arrangement.flourish );
	if ( flourishes.length ) {
		const { time, arrangement } = flourishes[ 0 ];
		let part = 0;
		partTimes.forEach( ( t, i ) => {
			if ( t <= time ) {
				part = i;
			}
		} );
		await chips.nth( part ).click();
		seen = await until( page, ( s ) => s.flourish.includes( arrangement.flourish ), time - partTimes[ part ] + 5 );
		check( `the flourish fires: ${ arrangement.flourish } at ${ time } s`, seen.flourish.includes( arrangement.flourish ),
			`at ${ seen.clock } s, flourishing: ${ seen.flourish.join( ', ' ) || 'nobody' }` );
	} else {
		console.log( '  (this chart has no flourishes)' );
	}

	// Pause.
	await page.locator( '.carrot-btn:visible' ).first().click();
	await page.waitForTimeout( 500 );
	const paused = await look( page );
	await page.waitForTimeout( 2500 );
	seen = await look( page );
	check( 'pressing the carrot again pauses', seen.clock === paused.clock, `${ paused.clock } s, then ${ seen.clock } s` );

	// Follow a picker: their card, then their page offers to follow them.
	const card = page.locator( '.musician-card' ).filter( { hasNotText: seen.pane } ).first();
	const picker = ( await card.locator( '.musician-name' ).textContent() ).replace( /⭐/g, '' ).replace( /\(.*$/, '' ).trim();
	await card.click();
	seen = await until( page, ( s ) => s.pane === picker, 8 );
	check( `a card opens that person's page: ${ picker }`, seen.pane === picker, `pane: ${ seen.pane }` );
	const follow = page.locator( '[data-follow]' );
	await follow.first().waitFor( { timeout: 8000 } ).catch( () => {} );
	const offer = ( await follow.count() ) ? ( await follow.first().evaluate( ( b ) => b.parentElement.textContent ) ) : '';
	check( `their page offers to follow ${ picker }, naming the next song`, /First up:/.test( offer ), offer.replace( /\s+/g, ' ' ).trim().slice( 0, 140 ) || 'no Follow button' );

	// Tapping a card is steering the pane yourself, so Follow the solo turns off; a new song
	// opens its page only while it's on (#32: "a person reading something keeps reading").
	const followSolo = page.getByRole( 'checkbox', { name: 'Follow the solo' } );
	check( 'tapping a card turns Follow the solo off', ! ( await followSolo.isChecked() ) );
	await page.getByText( 'Follow the solo', { exact: true } ).first().click();   // the switch; its checkbox is hidden
	check( 'and it turns back on', await followSolo.isChecked() );

	// Pick another song from the dropdown: it opens on its own page, and the editor would save to it.
	const others = ( await select.locator( 'option' ).evaluateAll( ( os ) => os.map( ( o ) => ( { cid: o.value, title: o.textContent.trim() } ) ) ) )
		.filter( ( o ) => o.cid !== cid );
	const other = others[ others.length - 1 ];
	await select.selectOption( other.cid );
	await page.waitForFunction( ( t ) => document.querySelector( '#song-title-display' )?.firstChild.textContent.trim() === t, other.title, { timeout: 15000 } ).catch( () => {} );
	seen = await until( page, ( s ) => s.pane === `Song:${ other.title }`, 15 );
	check( `picking ${ other.title } from the dropdown opens Song:${ other.title }`, seen.pane === `Song:${ other.title }`, `pane: ${ seen.pane }` );

	const pencil = page.locator( '#editor-toggle-btn' );
	check( 'the title carries the ✎ "edit timeline"', ( await pencil.count() ) > 0 && /✎/.test( await pencil.textContent() ) && /edit timeline/i.test( await pencil.textContent() ),
		( await pencil.count() ) ? `button reads "${ ( await pencil.textContent() ).trim() }"` : 'no editor button' );
	if ( await pencil.count() ) {
		await pencil.first().click();
		await page.locator( '#editor-panel' ).waitFor( { timeout: 15000 } );
		const save = page.locator( '#save-to-wiki-btn' );
		await page.waitForTimeout( 1500 );
		check( 'the editor opens with nothing to save', await save.isDisabled(), `Save reads "${ ( await save.textContent() ).trim() }"` );
		await context.grantPermissions( [ 'clipboard-read', 'clipboard-write' ] );
		await page.locator( '#export-yaml-btn' ).click();
		const box = page.locator( '.yaml-export-box' );
		await box.waitFor( { timeout: 5000 } );
		const target = ( await box.locator( 'code' ).first().textContent() ).trim();
		check( `Save would write ${ other.title }'s own page`, target === `Release:${ other.cid }/Metadata`, target );
		const shown = yaml.load( await box.locator( 'textarea, pre' ).first().evaluate( ( el ) => el.value ?? el.textContent ) );
		const wiki = ( await chartOf( other.cid ) ).data;
		check( `and what it would write is the wiki's chart for ${ other.title }`, canonical( shown.timeline ) === canonical( wiki.timeline ),
			`${ Object.keys( shown.timeline || {} ).length } timeline entries shown, ${ Object.keys( wiki.timeline || {} ).length } on the wiki` );
	}
	await context.close();

	// --- A phone: always the bottom bar ------------------------------------
	const phone = await browser.newContext( { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } );
	const small = await phone.newPage();
	await small.goto( BASE );
	await small.locator( '#song-title-display' ).waitFor();
	const bar = await small.evaluate( () => document.body.classList.contains( 'bottom-bar' ) );
	const switches = await small.getByText( /switch to (the )?(bottom bar|sidebar)/i ).count();
	check( 'a phone gets the bottom bar, with no layout switch', bar && switches === 0, `bottom bar: ${ bar }; switches: ${ switches }` );
	await small.setViewportSize( { width: 844, height: 390 } );
	await small.waitForTimeout( 500 );
	check( 'sideways too', await small.evaluate( () => document.body.classList.contains( 'bottom-bar' ) ) );
	await phone.close();
}
