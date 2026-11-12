/**
 * The pane shows the article and nothing else: no selector of ways to
 * wear the wiki at the top (Justin and Skyler, #rabbithole, 11 Nov 2026).
 */
import { describe, it, expect } from 'vitest';
import { paneBody, searchResults } from '../../src/wiki/pane-html.js';

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
