// @vitest-environment happy-dom
/**
 * The pane shows the article and nothing else: no selector of ways to
 * wear the wiki at the top (Justin and Skyler, #rabbithole, 11 Nov 2026).
 *
 * These were assertions about a string of HTML a module built. The markup
 * is a component now, so they are assertions about what it renders, and
 * the pane's own styles are a stylesheet, so the rules they looked for
 * are looked for there.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { mount } from '@vue/test-utils';
import PaneArticle from '../../../src/components/pane/PaneArticle.vue';
import PaneSearch from '../../../src/components/pane/PaneSearch.vue';
import PaneNotice from '../../../src/components/pane/PaneNotice.vue';
import { WIKI_STYLESHEETS, PANE_CSS } from '../../../src/wiki/pane-styles.js';

const css = ( name ) => readFileSync( resolve( __dirname, '../../../src/styles/' + name ), 'utf8' );

describe( 'an article in the pane', () => {
	const w = mount( PaneArticle, {
		props: { title: 'Song:Swords to Ploughshares', text: '<p>A song.</p>' },
	} );

	it( 'is the article, under its title', () => {
		expect( w.get( 'h1.pane-title' ).text() ).toContain( 'Song:Swords to Ploughshares' );
		expect( w.html() ).toContain( '<p>A song.</p>' );
	} );

	/*
	 * The title is the way out to the regular wiki page, in a new tab, so
	 * the song plays on; inside the pane there was no telling how to escape
	 * (Justin, 12 Nov 2026).
	 */
	it( 'makes the title a link to the page on PickiPedia, in a new tab', () => {
		const a = w.get( 'a.pane-escape' );
		expect( a.attributes( 'href' ) ).toBe( '/wiki/Song:Swords_to_Ploughshares' );
		expect( a.attributes( 'target' ) ).toBe( '_blank' );
		expect( a.attributes( 'rel' ) ).toBe( 'noopener' );
	} );

	it( 'carries no mode selector and no chrome bar', () => {
		expect( w.html() ).not.toContain( 'pane-mode' );
		expect( w.html() ).not.toContain( 'pane-chrome' );
		expect( w.find( 'select' ).exists() ).toBe( false );
	} );

	it( 'keeps the wiki\'s own containers, which MonoBook\'s rules hang off', () => {
		expect( w.find( '#globalWrapper #column-content #content.mw-body .mw-body-content' ).exists() ).toBe( true );
	} );

	/* The chase and the trail go above the article; the pill beside the name. */
	it( 'has room above the article and beside the title', () => {
		const slotted = mount( PaneArticle, {
			props: { title: 'Harry Clark', text: '<p>A picker.</p>' },
			slots: { default: '<div class="pp-chase">offer</div>', title: '<button class="pp-chasing">pill</button>' },
		} );
		expect( slotted.get( '.mw-body-content > .pp-chase' ).text() ).toBe( 'offer' );
		expect( slotted.get( 'h1.pane-title > .pp-chasing' ).text() ).toBe( 'pill' );
	} );
} );

describe( 'search results', () => {
	const w = mount( PaneSearch, {
		props: { text: 'banjo', hits: [ { title: 'Cory Walker', snippet: 'banjo' } ] },
	} );

	it( 'keeps its search box, and no mode selector', () => {
		expect( w.get( 'input.pane-search' ).element.value ).toBe( 'banjo' );
		expect( w.html() ).not.toContain( 'pane-mode' );
		expect( w.text() ).toContain( '1 result for banjo' );
	} );

	it( 'asks for the search on Enter', async () => {
		await w.get( 'input.pane-search' ).trigger( 'keydown', { key: 'Enter' } );
		expect( w.emitted( 'search' ) ).toEqual( [ [ 'banjo' ] ] );
	} );
} );

describe( 'a page that is on its way, or could not be had', () => {
	it( 'says which, and keeps the way out to the wiki', () => {
		expect( mount( PaneNotice, { props: { kind: 'loading', title: 'Cory Walker' } } ).text() )
			.toContain( 'Loading Cory Walker' );
		const failed = mount( PaneNotice, { props: { kind: 'failed', title: 'Nobody At All' } } );
		expect( failed.text() ).toContain( 'Could not load Nobody At All' );
		expect( failed.get( 'a' ).attributes( 'href' ) ).toBe( '/wiki/Nobody_At_All' );
	} );
} );

describe( 'the pane\'s styles', () => {
	it( 'load the connectome card\'s stylesheet, which hides its hover tips', () => {
		expect( WIKI_STYLESHEETS.join( ' ' ) ).toContain( 'ext.pickipediaContent.connectome.styles' );
	} );

	it( 'load the wiki\'s night sheet, which darkens the article under pp-night', () => {
		expect( WIKI_STYLESHEETS.join( ' ' ) ).toContain( 'ext.pickipediaContent.night.styles' );
	} );

	it( 'show the trail button the template renders hidden', () => {
		expect( css( 'pane.css' ) ).toMatch( /\.pp-trail-rh\s*{[^}]*display:\s*inline-flex\s*!important/ );
	} );

	it( 'unfloat the record box when the pane itself is narrow', () => {
		const sheet = css( 'pane.css' );
		expect( sheet ).toContain( 'container-type: inline-size' );
		expect( sheet ).toMatch( /@container \(max-width: 560px\)/ );
	} );

	/*
	 * Three sheets go into the shadow root, and nothing else can: a <link>
	 * in the page does not reach inside one. (Their text is empty here --
	 * vitest does not process CSS imports -- so the rules themselves are
	 * read from the files above.)
	 */
	it( 'are the sheets the shadow root adopts: the three of day, and night', () => {
		expect( PANE_CSS ).toHaveLength( 4 );
		const adopts = readFileSync( resolve( __dirname, '../../../src/wiki/pane-styles.js' ), 'utf8' );
		for ( const sheet of [ 'pane.css', 'pane-chase.css', 'pane-trail.css', 'pane-night.css' ] ) {
			expect( adopts ).toContain( `../styles/${ sheet }?inline` );
		}
		expect( css( 'pane-chase.css' ) ).toContain( '.pp-chasing' );
		expect( css( 'pane-trail.css' ) ).toContain( '.pp-trail' );
	} );
} );
