/**
 * What a link inside the wiki pane is: an article the pane can show, a
 * wiki page it cannot (an edit form, a history, a Special page), or
 * somewhere else entirely.
 */

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

/** A link into the wiki that is not an article the pane can show. */
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
	return url.pathname.startsWith( '/index.php' ) || url.pathname.startsWith( '/wiki/' );
}
