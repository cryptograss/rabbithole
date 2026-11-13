/**
 * The pane shows the article and nothing else: no selector of ways to
 * wear the wiki at the top (Justin and Skyler, #rabbithole, 11 Nov 2026).
 */
import { describe, it, expect } from 'vitest';
import { PANE_STYLES, paneBody, searchResults } from '../../src/wiki/pane-html.js';

describe( 'paneBody', () => {
	const html = paneBody( 'Song:Swords to Ploughshares', { text: '<p>A song.</p>' } );

	it( 'is the article, under its title', () => {
		expect( html ).toMatch( /<h1 class="pane-title firstHeading"><a [^>]*>Song:Swords to Ploughshares</ );
		expect( html ).toContain( '<p>A song.</p>' );
	} );

	/*
	 * The title is the way out to the regular wiki page, in a new tab, so
	 * the song plays on; inside the pane there was no telling how to escape
	 * (Justin, 12 Nov 2026).
	 */
	it( 'makes the title a link to the page on PickiPedia, in a new tab', () => {
		expect( html ).toContain( '<a class="pane-escape" href="/wiki/Song:Swords_to_Ploughshares" target="_blank" rel="noopener"' );
	} );

	it( 'carries no mode selector and no chrome bar', () => {
		expect( html ).not.toContain( 'pane-mode' );
		expect( html ).not.toContain( 'pane-chrome' );
		expect( html ).not.toContain( '<select' );
	} );
} );

describe( 'searchResults', () => {
	it( 'keeps its search box, and no mode selector', () => {
		const html = searchResults( 'banjo', [ { title: 'Cory Walker', snippet: 'banjo' } ] );
		expect( html ).toContain( 'class="pane-search"' );
		expect( html ).not.toContain( 'pane-mode' );
		expect( html ).toContain( '1 result for banjo' );
	} );
} );

/*
 * {{Listen in Rabbithole}} hides its "find a trail here" button, since a
 * trail needs a song already playing to start from; the pane is the one
 * place that is true, so its stylesheet is what shows the button (Justin,
 * #rabbithole, 12 Nov 2026).
 */
describe( 'PANE_STYLES', () => {
	it( 'shows the trail button the template renders hidden', () => {
		expect( PANE_STYLES ).toContain( '.pp-trail-rh { display: inline-flex !important; }' );
	} );

	/*
	 * The record box floats right at 20em; in a narrow pane the text
	 * beside it came out a word to a line (Justin, 12 Nov 2026). The
	 * pane measures itself, not the window, since it sits beside the dock.
	 */
	it( 'unfloats the record box when the pane itself is narrow', () => {
		expect( PANE_STYLES ).toContain( ':host { container-type: inline-size; }' );
		expect( PANE_STYLES ).toMatch( /@container \(max-width: 560px\) \{\s*\.pp-record-box \{ float: none;/ );
	} );
} );
