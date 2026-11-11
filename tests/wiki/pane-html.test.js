/**
 * The pane shows the article and nothing else: no selector of ways to
 * wear the wiki at the top (Justin and Skyler, #rabbithole, 11 Nov 2026).
 */
import { describe, it, expect } from 'vitest';
import { paneBody, searchResults } from '../../src/wiki/pane-html.js';

describe( 'paneBody', () => {
	const html = paneBody( 'Song:Swords to Ploughshares', { text: '<p>A song.</p>' } );

	it( 'is the article, under its title', () => {
		expect( html ).toContain( 'Song:Swords to Ploughshares</h1>' );
		expect( html ).toContain( '<p>A song.</p>' );
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
