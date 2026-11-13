// @vitest-environment happy-dom
/**
 * Links inside the pane: an article stays in the pane; the wiki's own
 * pages (edit, history, Special) leave for a new tab rather than walking
 * the whole app off to the wiki, player and open editor included
 * (Skyler, 6 Nov 2026).
 */
import { describe, it, expect } from 'vitest';
import { linkIn, titleFromHref, leavesTheApp } from '../../src/wiki/pane-links.js';

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
	it( 'is true for the big connectome graph, where the card\'s dots and lines lead', () => {
		expect( leavesTheApp( '/assets/connectome/?a=Maddie+Denton&b=Justin+Myles+Holmes' ) ).toBe( true );
		expect( leavesTheApp( '/assets/connectome/?p=Maddie+Denton' ) ).toBe( true );
	} );
	it( 'is false for anchors and other sites', () => {
		expect( leavesTheApp( '#On_the_record' ) ).toBe( false );
		expect( leavesTheApp( 'https://justinholmes.com/' ) ).toBe( false );
		expect( leavesTheApp( null ) ).toBe( false );
	} );
} );

/*
 * The connectome card is an SVG whose dots and lines are links. The pane
 * looked for a clicked link by tagName "A", which an SVG link is not, so
 * a click on a dot went past it and the browser left the player for the
 * big graph (blu, #connectome, 13 Nov 2026).
 */
describe( 'linkIn', () => {
	const SVG = 'http://www.w3.org/2000/svg';

	/** A click's path, innermost first, as composedPath() gives it. */
	function pathFrom( el ) {
		const path = [];
		for ( let node = el; node; node = node.parentNode ) {
			path.push( node );
		}
		path.push( window );
		return path;
	}

	function cardDot( attrs ) {
		const div = document.createElement( 'div' );
		const svg = document.createElementNS( SVG, 'svg' );
		const a = document.createElementNS( SVG, 'a' );
		const circle = document.createElementNS( SVG, 'circle' );
		Object.entries( attrs ).forEach( ( [ name, value ] ) => a.setAttribute( name, value ) );
		a.appendChild( circle );
		svg.appendChild( a );
		div.appendChild( svg );
		return { a, circle };
	}

	it( 'finds an HTML link from what was clicked inside it', () => {
		const a = document.createElement( 'a' );
		const b = document.createElement( 'b' );
		a.setAttribute( 'href', '/wiki/Cory_Walker' );
		a.appendChild( b );
		const link = linkIn( pathFrom( b ) );
		expect( link.el ).toBe( a );
		expect( link.href ).toBe( '/wiki/Cory_Walker' );
		expect( link.newTab ).toBe( false );
	} );
	it( 'finds a link drawn in an SVG, from the dot that was clicked', () => {
		const { a, circle } = cardDot( { href: '/assets/connectome/?a=Maddie+Denton&b=Cory+Walker' } );
		const link = linkIn( pathFrom( circle ) );
		expect( link.el ).toBe( a );
		expect( link.href ).toBe( '/assets/connectome/?a=Maddie+Denton&b=Cory+Walker' );
		expect( link.newTab ).toBe( false );
	} );
	it( 'reads an older SVG link\'s xlink:href', () => {
		const { a, circle } = cardDot( {} );
		a.setAttributeNS( 'http://www.w3.org/1999/xlink', 'xlink:href', '/wiki/Cory_Walker' );
		expect( linkIn( pathFrom( circle ) ).href ).toBe( '/wiki/Cory_Walker' );
	} );
	it( 'says when a link asks for a new tab, HTML or SVG', () => {
		const a = document.createElement( 'a' );
		a.setAttribute( 'href', '/wiki/Cory_Walker' );
		a.setAttribute( 'target', '_blank' );
		expect( linkIn( pathFrom( a ) ).newTab ).toBe( true );
		const { circle } = cardDot( { href: '/wiki/Cory_Walker', target: '_blank' } );
		expect( linkIn( pathFrom( circle ) ).newTab ).toBe( true );
	} );
	it( 'is null when the click was on no link', () => {
		const div = document.createElement( 'div' );
		const span = document.createElement( 'span' );
		div.appendChild( span );
		expect( linkIn( pathFrom( span ) ) ).toBeNull();
	} );
} );
