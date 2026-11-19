// @vitest-environment happy-dom
/**
 * A picker's card is their page's own {{MusicianInfo}} box, as the wiki drew
 * it (Justin, #connectome, 18 Nov 2026).
 */
import { describe, it, expect } from 'vitest';
import { infoboxOf } from '../../src/wiki/infobox.js';

const PAGE = '<div class="mw-content-ltr mw-parser-output">' +
	'<table class="wikitable" style="float: right; width: 280px;"><tbody><tr><th colspan="2"><figure><img src="/images/a.png" alt="A"></figure></th></tr>' +
	'<tr><th>Instrument</th><td>banjo</td></tr></tbody></table>' +
	'<p>Cory plays banjo.</p><table class="wikitable"><tr><td>a later table</td></tr></table>' +
	'<div class="connectome-card"><div class="cc-head">the card</div></div></div>';

describe( 'the box out of a picker\'s page', () => {
	it( 'is the first wikitable in the article, picture and all', () => {
		const box = infoboxOf( PAGE );
		expect( box ).toContain( 'Instrument' );
		expect( box ).toContain( '/images/a.png' );
		expect( box ).not.toContain( 'a later table' );
		expect( box ).not.toContain( 'connectome-card' );
	} );

	it( 'is found floated beside the text when something wraps it', () => {
		const wrapped = '<div class="mw-parser-output"><div class="proposed"><table class="wikitable" style="float:right"><tr><th>Scene</th><td>Nashville</td></tr></table></div></div>';
		expect( infoboxOf( wrapped ) ).toContain( 'Nashville' );
	} );

	it( 'is nothing for a page with no box', () => {
		expect( infoboxOf( '<div class="mw-parser-output"><p>Only words.</p></div>' ) ).toBe( '' );
		expect( infoboxOf( '' ) ).toBe( '' );
	} );
} );
