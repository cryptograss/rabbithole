// @vitest-environment happy-dom
/**
 * Links inside the pane: an article stays in the pane; the wiki's own
 * pages (edit, history, Special) leave for a new tab rather than walking
 * the whole app off to the wiki, player and open editor included
 * (Skyler, 6 Nov 2026).
 */
import { describe, it, expect } from 'vitest';
import { titleFromHref, leavesTheApp } from '../../src/wiki/pane-links.js';

describe( 'titleFromHref', () => {
	it( 'names an article', () => {
		expect( titleFromHref( '/wiki/Cory_Walker' ) ).toBe( 'Cory Walker' );
		expect( titleFromHref( '/wiki/Song:Paint_Exchange' ) ).toBe( 'Song:Paint Exchange' );
	} );
	it( 'is null for what the pane does not show', () => {
		expect( titleFromHref( '/wiki/Special:RecentChanges' ) ).toBeNull();
		expect( titleFromHref( '/index.php?title=Song:August&action=edit' ) ).toBeNull();
		expect( titleFromHref( 'https://example.com/' ) ).toBeNull();
	} );
} );

describe( 'leavesTheApp', () => {
	it( 'is true for the wiki\'s own pages the pane cannot hold', () => {
		expect( leavesTheApp( '/index.php?title=Song:August&action=edit' ) ).toBe( true );
		expect( leavesTheApp( '/index.php?title=Song:August&action=history' ) ).toBe( true );
		expect( leavesTheApp( '/wiki/Special:RecentChanges' ) ).toBe( true );
	} );
	it( 'is false for anchors and other sites', () => {
		expect( leavesTheApp( '#On_the_record' ) ).toBe( false );
		expect( leavesTheApp( 'https://justinholmes.com/' ) ).toBe( false );
		expect( leavesTheApp( null ) ).toBe( false );
	} );
} );
