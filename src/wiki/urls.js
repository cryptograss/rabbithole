/**
 * Addresses: the wiki's, and the app's own.
 *
 * What is left of pane-html.js, which built the pane's markup as strings
 * until the pane became components (14 Nov 2026). A URL is a string by
 * nature; HTML is not.
 */

/** A page's address on PickiPedia itself. */
export function wikiPath( title ) {
	return '/wiki/' + encodeURIComponent( title.replace( / /g, '_' ) ).replace( /%3A/g, ':' );
}

/*
 * The app's own address with this page in the pane: /rabbithole/?track=<cid>&page=<title>.
 * Keeps whatever else the query holds (the track above all), so a reload or a
 * shared link lands back in the player, on this page, with the song. The pane
 * used to push the wiki's own /wiki/<title>, which reloads as the plain wiki
 * with no player at all (Justin, 11 Nov 2026).
 */
export function appAddress( title, from = window.location.href ) {
	const url = new URL( from );
	url.pathname = new URL( import.meta.env.BASE_URL || '/', url.origin ).pathname;
	url.searchParams.set( 'page', title );
	url.hash = '';
	return url.pathname + url.search;
}
