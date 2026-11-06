// @vitest-environment happy-dom
/**
 * Skin mode dresses the wiki page in MonoBook inside a shadow root.
 *
 * MonoBook writes its layout against body and html, which a shadow root
 * does not have; the chrome arrived unpositioned, under the article, for
 * three weeks before Justin asked why the wiki looked naked (6 Nov 2026).
 * The selectors are rewritten to stand-in elements, and only they.
 */
import { describe, it, expect } from 'vitest';
import { skinStyles, paneBody, SHADOW_BODY } from '../../src/wiki/pane-html.js';

describe( 'skinStyles', () => {
	it( 'moves body and html selectors onto the stand-ins', () => {
		expect( skinStyles( 'body{margin:0}html{font-size:100%}' ) )
			.toBe( '.mw-shadow-body{margin:0}.mw-shadow-html{font-size:100%}' );
	} );

	it( 'rewrites each selector of a list, with its pseudo-classes', () => {
		expect( skinStyles( 'body:not(.skin--responsive) #column-content,body.skin--responsive .portlet{float:left}' ) )
			.toBe( '.mw-shadow-body:not(.skin--responsive) #column-content,.mw-shadow-body.skin--responsive .portlet{float:left}' );
	} );

	it( 'reaches inside @media blocks', () => {
		expect( skinStyles( '@media screen and (min-width:551px){body .portlet{width:11.6em}}' ) )
			.toBe( '@media screen and (min-width:551px){.mw-shadow-body .portlet{width:11.6em}}' );
	} );

	it( 'leaves tbody, .body, and declarations alone', () => {
		const css = 'tbody tr{color:red}.body{x:1}#htmlish{y:2}a{background:url(body.png)}';
		expect( skinStyles( css ) ).toBe( css );
	} );
} );

describe( 'paneBody in skin mode', () => {
	const page = '<html><body class="mediawiki skin-monobook skin--responsive ns-3008">'
		+ '<div id="globalWrapper"><div id="column-one"><div class="portlet">nav</div></div>'
		+ '<script>/* furniture */</script></div></body></html>';

	it( 'wraps the page in a stand-in body wearing the real body classes, with the rewritten styles', () => {
		const html = paneBody( 'Song:Swords', { text: '' }, 'skin', page, 'body .portlet{float:left}' );
		expect( html ).toContain( '<style>.mw-shadow-body .portlet{float:left}</style>' );
		expect( html ).toContain( `class="${ SHADOW_BODY } mediawiki skin-monobook skin--responsive ns-3008"` );
		expect( html ).toContain( 'id="globalWrapper"' );
		expect( html ).not.toContain( '<script' );
	} );
} );
