/**
 * The wiki article, as HTML the pane can wear.
 *
 * The pane is a shadow root, which is the whole trick: MediaWiki's own
 * stylesheet goes in with the content and cannot reach back out to restyle
 * the dock. Without it the wiki arrives naked, because a div full of
 * parsed wikitext inherits nothing. Three ways to wear it, switchable from
 * the pane itself: `content` (the article and nothing else), `header` (a
 * small header we own: title, a search that works, a way out), `skin`
 * (MonoBook's full chrome, fetched and injected). Injected HTML runs no
 * scripts, so on `skin` the pane itself answers MonoBook's search form
 * (WikiPane's submit listener), and the search box is a real one.
 */

export const PANE_MODES = [ 'content', 'header', 'skin' ];

/*
 * The same modules a real article page loads, in the same skin. The one
 * that matters most is ext.pickipediaContent.styles, the extension's own
 * stylesheet: it draws the proposal markers and the studio blocks.
 */
export const WIKI_STYLESHEETS = [
	'/load.php?lang=en&modules=ext.pickipediaContent.styles%7Cskins.monobook.styles&only=styles&skin=monobook',
	'/load.php?lang=en&modules=site.styles&only=styles&skin=monobook',
];

/** The element that stands in for <body> inside the shadow root, in skin mode. */
export const SHADOW_BODY = 'mw-shadow-body';
const SHADOW_HTML = 'mw-shadow-html';

/**
 * MonoBook's layout is written against the document: `body .portlet`,
 * `body:not(.skin--responsive) #column-content`, `html { font-size }`.
 * A shadow root has no body and no html, so those rules never match, and
 * the chrome arrived unpositioned, piled under the article (Justin, 6 Nov
 * 2026). This rewrites the selectors to the stand-in elements skin mode
 * wraps the page in. Only a selector's own `body`/`html` token moves: one
 * at the start of a selector, or after a comma, or after the brace that
 * opens an @media block. `tbody`, `.body` and the like are untouched.
 */
export function skinStyles( css ) {
	return css.replace( /(^|[,{}])(\s*)(body|html)(?![-\w])/g, ( m, before, space, tag ) =>
		before + space + '.' + ( tag === 'body' ? SHADOW_BODY : SHADOW_HTML ) );
}

export const PANE_STYLES = [
	...WIKI_STYLESHEETS.map( ( href ) => '<link rel="stylesheet" href="' + href + '">' ),
	'<style>',
	':host { display: block; font-size: 14px; line-height: 1.5;',
	'  color: #202122; font-family: -apple-system, BlinkMacSystemFont,',
	'  "Segoe UI", Roboto, sans-serif; }',
	'img { max-width: 100%; height: auto; }',
	'table { max-width: 100%; }',
	'.pane-title { font-size: 22px; font-weight: 700; color: #2d5016;',
	'  margin: 0 0 .4em; border-bottom: 1px solid #e5e7e1;',
	'  padding-bottom: .2em; }',
	'.pane-loading { color: #6b7566; font-size: 13px; }',
	'h2 { font-size: 18px; margin: 1em 0 .3em; }',
	'h3 { font-size: 15px; margin: .8em 0 .3em; }',
	'.mw-editsection { display: none; }',
	'.pane-chrome { display: flex; align-items: center; gap: 8px;',
	'  padding: 6px 8px; margin: -4px -4px 10px; background: #f3f5f1;',
	'  border-bottom: 1px solid #d8ddd3; font-size: 13px;',
	'  position: sticky; top: 0; z-index: 5; }',
	'.pane-chrome .pane-search { flex: 1 1 auto; min-width: 60px;',
	'  padding: 4px 6px; border: 1px solid #c3cbbb; border-radius: 3px;',
	'  font: inherit; }',
	'.pane-chrome a { color: #2d5016; text-decoration: none; }',
	'.pane-chrome a:hover { text-decoration: underline; }',
	'.pane-mode { font: inherit; padding: 3px; border: 1px solid #c3cbbb;',
	'  border-radius: 3px; background: #fff; }',
	'.pane-results { list-style: none; padding: 0; margin: 0; }',
	'.pane-results li { padding: 5px 0; border-bottom: 1px solid #eceee8; }',
	'.pane-results a { font-weight: 600; }',
	'.pane-results .snippet { color: #5a6354; font-size: 12px; }',
	'</style>',
].join( '' );

export function escapeHtml( s ) {
	return String( s ).replace( /[&<>"]/g, ( c ) => ( { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ c ] ) );
}

export function wikiPath( title ) {
	return '/wiki/' + encodeURIComponent( title.replace( / /g, '_' ) ).replace( /%3A/g, ':' );
}

function modeSwitcher( current ) {
	return '<select class="pane-mode" title="How much of the wiki to show">'
		+ PANE_MODES.map( ( m ) => `<option value="${ m }"${ m === current ? ' selected' : '' }>${ m }</option>` ).join( '' )
		+ '</select>';
}

/** The article, wrapped in the containers MonoBook's rules hang off. */
function article( title, parsed ) {
	return '<div id="globalWrapper"><div id="column-content">'
		+ '<div id="content" class="mw-body"><div class="mw-body-content">'
		+ '<h1 class="pane-title firstHeading">' + ( parsed.displaytitle || escapeHtml( title ) ) + '</h1>'
		+ parsed.text
		+ '</div></div></div></div>';
}

/**
 * The pane's body for a parsed article.
 *
 * @param {string} title
 * @param {{text: string, displaytitle?: string}} parsed From action=parse.
 * @param {string} mode One of PANE_MODES.
 * @param {string|null} fullPageHtml The real page's HTML, for `skin`, or null.
 * @param {string} skinCss The wiki's stylesheets as text, for `skin`: they go
 *   in rewritten (skinStyles) so MonoBook's body-scoped layout applies.
 */
export function paneBody( title, parsed, mode, fullPageHtml = null, skinCss = '' ) {
	const path = wikiPath( title );

	if ( mode === 'skin' && fullPageHtml ) {
		const doc = new DOMParser().parseFromString( fullPageHtml, 'text/html' );
		const wrapper = doc.getElementById( 'globalWrapper' );
		if ( wrapper ) {
			wrapper.querySelectorAll( 'script, #siteNotice' ).forEach( ( el ) => el.remove() );
			// The real page's body classes (skin-monobook, skin--responsive,
			// ns-3008, action-view...) are what MonoBook's rules key off.
			const bodyClasses = ( doc.body && doc.body.className ) || 'mediawiki skin-monobook';
			return '<style>' + skinStyles( skinCss ) + '</style>'
				+ '<div class="pane-chrome">' + modeSwitcher( mode )
				+ '<span>MonoBook, as the wiki renders it</span></div>'
				+ '<div class="' + SHADOW_HTML + '"><div class="' + SHADOW_BODY + ' ' + escapeHtml( bodyClasses ) + '">'
				+ wrapper.outerHTML
				+ '</div></div>';
		}
	}

	if ( mode === 'header' ) {
		return '<div class="pane-chrome">' + modeSwitcher( mode )
			+ '<input class="pane-search" type="search" placeholder="Search PickiPedia" aria-label="Search PickiPedia">'
			+ '<a href="' + path + '" target="_blank" rel="noopener">open ↗</a>'
			+ '</div>' + article( title, parsed );
	}

	return '<div class="pane-chrome">' + modeSwitcher( mode )
		+ '<span>article only</span></div>' + article( title, parsed );
}

/** Search results, in place of an article. */
export function searchResults( text, hits, mode ) {
	return '<div class="pane-chrome">' + modeSwitcher( mode )
		+ '<input class="pane-search" type="search" value="' + escapeHtml( text ) + '" placeholder="Search PickiPedia" aria-label="Search PickiPedia">'
		+ '</div>'
		+ '<div id="globalWrapper"><div id="column-content"><div id="content" class="mw-body"><div class="mw-body-content">'
		+ '<h1 class="pane-title">' + hits.length + ' result' + ( hits.length === 1 ? '' : 's' )
		+ ' for ' + escapeHtml( text ) + '</h1><ul class="pane-results">'
		+ hits.map( ( hit ) => '<li><a href="' + wikiPath( hit.title ) + '">' + escapeHtml( hit.title ) + '</a>'
			+ '<div class="snippet">' + ( hit.snippet || '' ) + '</div></li>' ).join( '' )
		+ '</ul></div></div></div></div>';
}

export function loadingBody( title ) {
	return '<div class="pane-loading">Loading ' + escapeHtml( title ) + '…</div>';
}

export function failedBody( title ) {
	return '<div class="pane-loading">Could not load ' + escapeHtml( title )
		+ ' — <a href="' + wikiPath( title ) + '">open it directly</a>.</div>';
}
