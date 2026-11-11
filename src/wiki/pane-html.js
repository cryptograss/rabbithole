/**
 * The wiki article, as HTML the pane can wear.
 *
 * The pane is a shadow root, which is the whole trick: MediaWiki's own
 * stylesheet goes in with the content and cannot reach back out to restyle
 * the dock. Without it the wiki arrives naked, because a div full of
 * parsed wikitext inherits nothing.
 *
 * The pane shows the article and nothing else. It used to offer three
 * ways to wear the wiki (content, header, MonoBook's whole skin) from a
 * selector at the top of the pane; that was scaffolding from building
 * against a broken-looking backdrop, and the first thing a listener saw,
 * unexplained. Taken out (Justin and Skyler, #rabbithole, 11 Nov 2026).
 */

/*
 * The same modules a real article page loads, in the same skin. The ones
 * that matter most are the extensions' own stylesheets: pickipediaContent
 * draws the studio blocks and the rows on a picker's page, and
 * pickipediaVerification draws the proposal markers. Without the second
 * every proposed line wore a bare "[unverified]" (Justin, 11 Nov 2026).
 */
const WIKI_STYLESHEETS = [
	'/load.php?lang=en&modules=ext.pickipediaContent.styles%7Cext.pickipediaVerification.styles%7Cskins.monobook.styles&only=styles&skin=monobook',
	'/load.php?lang=en&modules=site.styles&only=styles&skin=monobook',
];

/*
 * The pane wears MonoBook's page, not only its article: the grey paper
 * with the wave along the top, the white article box with its thin
 * border, and the skin's own sans-serif at the skin's size. MonoBook
 * puts those on <body>, which a shadow root has none of, so they are
 * restated on :host. A plain white pane with the app's own font was
 * jarring beside the wiki (Justin, 11 Nov 2026).
 */
export const PANE_STYLES = [
	...WIKI_STYLESHEETS.map( ( href ) => '<link rel="stylesheet" href="' + href + '">' ),
	'<style>',
	':host { display: block; font-family: sans-serif; font-size: 11px;',
	'  line-height: 1.5; color: #000; background: #f9f9f9',
	'  url("/skins/MonoBook/resources/images/headbg.svg") 0 0 no-repeat;',
	'  min-height: 100%; }',
	'img { max-width: 100%; height: auto; }',
	'table { max-width: 100%; }',
	// MonoBook floats the article beside a sidebar column the pane has
	// not got: the box sits in the pane with a margin of paper around it.
	'#globalWrapper #column-content { float: none; margin: 0; width: auto; }',
	'#globalWrapper #content.mw-body { margin: 10px; }',
	'.pane-title { margin: 0 0 .4em; }',
	'.pane-loading { color: #6b7566; font-size: 13px; }',
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

/** The article, wrapped in the containers MonoBook's rules hang off. */
function article( title, parsed ) {
	return '<div id="globalWrapper"><div id="column-content">'
		+ '<div id="content" class="mw-body"><div class="mw-body-content">'
		+ '<h1 class="pane-title firstHeading">' + ( parsed.displaytitle || escapeHtml( title ) ) + '</h1>'
		+ parsed.text
		+ '</div></div></div></div>';
}

/** The pane's body for a parsed article: the article, nothing more. */
export function paneBody( title, parsed ) {
	return article( title, parsed );
}

/** Search results, in place of an article. */
export function searchResults( text, hits ) {
	return '<div class="pane-chrome">'
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
