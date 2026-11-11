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
 * The same modules a real article page loads, in the same skin. The one
 * that matters most is ext.pickipediaContent.styles, the extension's own
 * stylesheet: it draws the proposal markers and the studio blocks.
 */
const WIKI_STYLESHEETS = [
	'/load.php?lang=en&modules=ext.pickipediaContent.styles%7Cskins.monobook.styles&only=styles&skin=monobook',
	'/load.php?lang=en&modules=site.styles&only=styles&skin=monobook',
];

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
	// MonoBook boxes the article in a grey border, which inside the pane
	// was a frame inside a frame, standing off from the player.
	'#content { border: 0; }',
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
