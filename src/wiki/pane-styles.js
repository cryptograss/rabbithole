/**
 * The pane's styles, put into its shadow root.
 *
 * Two kinds, and they arrive differently. The wiki's own stylesheets are
 * the wiki's files, fetched from it by URL, so they go in as <link>s. Ours
 * are files in this repository (src/styles/pane*.css), imported as text
 * and adopted by the shadow root: a constructed sheet, built once per
 * page load and shared by every root that adopts it, rather than a <style>
 * element rebuilt on every render.
 *
 * They were a list of quoted strings in a JS module, which is how a
 * stylesheet goes unread and unlinted (Justin, #rabbithole, 14 Nov 2026).
 */

import paneCss from '../styles/pane.css?inline';
import chaseCss from '../styles/pane-chase.css?inline';
import trailCss from '../styles/pane-trail.css?inline';

/** Our own sheets, in the order they cascade. */
export const PANE_CSS = [ paneCss, chaseCss, trailCss ];

/*
 * MonoBook's stylesheets, and the extensions whose markup the articles
 * carry. pickipediaContent dresses the record box and the connectome
 * card; pickipediaVerification draws the proposal markers. Without the
 * second, every proposed line wore a bare "[unverified]" (Justin, 11 Nov
 * 2026). The connectome card's sheet is what hides each neighbour's hover
 * tip until it is pointed at; without it all fifteen tips stood open at
 * once, stacked over the card in big type (Skyler, #connectome, 13 Nov
 * 2026).
 */
export const WIKI_STYLESHEETS = [
	'/load.php?lang=en&modules=ext.pickipediaContent.styles%7Cext.pickipediaContent.connectome.styles%7Cext.pickipediaVerification.styles%7Cskins.monobook.styles&only=styles&skin=monobook',
	'/load.php?lang=en&modules=site.styles&only=styles&skin=monobook',
];

let sheets = null;

/** Our sheets as constructed stylesheets, or null where that is not supported. */
function constructed() {
	if ( sheets !== null ) {
		return sheets;
	}
	try {
		sheets = PANE_CSS.map( ( css ) => {
			const sheet = new CSSStyleSheet();
			sheet.replaceSync( css );
			return sheet;
		} );
	} catch ( err ) {
		// Safari before 16.4, and some test DOMs: fall back to a <style>.
		sheets = null;
	}
	return sheets;
}

/**
 * Put the styles in a shadow root. Call it once, when the root is made:
 * adopted sheets survive every change of what is inside it, which is why
 * the pane can replace its whole content without replacing its styles.
 */
export function adoptPaneStyles( root ) {
	// A shadow root outlives the component that made it: attachShadow on an
	// element that already has one is an error, so the pane reuses it, and
	// dressing it twice would stack a second copy of every sheet.
	if ( root.__paneStyled ) {
		return;
	}
	root.__paneStyled = true;
	const made = constructed();
	if ( made && 'adoptedStyleSheets' in root ) {
		root.adoptedStyleSheets = [ ...root.adoptedStyleSheets, ...made ];
	} else {
		const style = document.createElement( 'style' );
		style.textContent = PANE_CSS.join( '\n' );
		root.append( style );
	}
	WIKI_STYLESHEETS.forEach( ( href ) => {
		const link = document.createElement( 'link' );
		link.rel = 'stylesheet';
		link.href = href;
		root.append( link );
	} );
}
