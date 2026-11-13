/**
 * What a link inside the wiki pane is: an article the pane can show, a
 * page of the wiki's it cannot (an edit form, a history, a Special page,
 * the big connectome graph), or somewhere else entirely.
 */

const XLINK = 'http://www.w3.org/1999/xlink';

/**
 * The link a click landed in, from the click's path: the element, the
 * href it names, and whether it asks for a new tab. Null when the click
 * was on no link.
 *
 * A link drawn in an SVG is a link too. The connectome card is one SVG
 * whose every dot and line is an <a>, and an SVG <a> is not an HTML one:
 * its tagName is "a", not "A", and its target is an object, not a
 * string. Looked for as "A", a dot was no link at all to the pane, so
 * the browser followed it and walked the whole app off to the big graph,
 * the song with it (blu, #connectome, 13 Nov 2026).
 */
export function linkIn( path ) {
	const el = path.find( ( node ) => node.localName === 'a' );
	if ( ! el ) {
		return null;
	}
	return {
		el,
		href: el.getAttribute( 'href' ) || el.getAttributeNS( XLINK, 'href' ),
		newTab: el.getAttribute( 'target' ) === '_blank',
	};
}

/** The article title a /wiki/ link names, or null when it is not one the pane shows. */
export function titleFromHref( href ) {
	if ( ! href || ! href.startsWith( '/wiki/' ) ) {
		return null;
	}
	const title = decodeURIComponent( href.slice( '/wiki/'.length ) ).replace( /_/g, ' ' );
	if ( /^(Special|File|Category):/.test( title ) ) {
		return null;
	}
	return title;
}

/**
 * A link into the wiki that is not an article the pane can show: an edit
 * form, a history, a Special page, or one of the wiki's static pages
 * under /assets/, which is where the big connectome graph lives
 * (/assets/connectome/). The card's dots, lines and "explore" all link
 * there.
 */
export function leavesTheApp( href ) {
	if ( ! href || href.startsWith( '#' ) ) {
		return false;
	}
	let url;
	try {
		url = new URL( href, window.location.origin );
	} catch ( err ) {
		return false;
	}
	if ( url.origin !== window.location.origin ) {
		return false;
	}
	return url.pathname.startsWith( '/index.php' ) || url.pathname.startsWith( '/wiki/' )
		|| url.pathname.startsWith( '/assets/' );
}
