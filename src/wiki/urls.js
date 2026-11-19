/**
 * Addresses: the wiki's, and the app's own.
 *
 * What is left of pane-html.js, which built the pane's markup as strings
 * until the pane became components (14 Nov 2026). A URL is a string by
 * nature; HTML is not.
 */

import { isGraphAddress, SHELL_KEYS } from '../shell.js';

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
	if ( isGraphAddress( url.pathname ) ) {
		// From the graph's address (shell.js): what said where the graph was stays behind.
		for ( const key of [ ...url.searchParams.keys() ] ) {
			if ( ! SHELL_KEYS.includes( key ) || key === 'play' ) {
				url.searchParams.delete( key );
			}
		}
	}
	url.pathname = new URL( import.meta.env.BASE_URL || '/', url.origin ).pathname;
	url.searchParams.set( 'page', title );
	url.hash = '';
	return url.pathname + url.search;
}

/*
 * PickiPedia's sign-in page, returning into Rabbithole on the same song,
 * wiki page and open editor (Special:Rabbithole on the wiki redirects back
 * to /rabbithole/?...; without returnto, Special:UserLogin lands on
 * Main_Page — Skyler, #interfaces, 15 Nov 2026).
 */
export function loginHref( {
	track = null,
	page = null,
	edit = false,
	search = typeof window !== 'undefined' ? window.location.search : '',
} = {} ) {
	const returnParams = new URLSearchParams( search );
	if ( track ) {
		returnParams.set( 'track', track );
	}
	if ( page ) {
		returnParams.set( 'page', page );
	}
	if ( edit ) {
		returnParams.set( 'action', 'edit' );
	} else if ( returnParams.get( 'action' ) === 'edit' ) {
		returnParams.delete( 'action' );
	}
	const login = new URLSearchParams( {
		title: 'Special:UserLogin',
		returnto: 'Special:Rabbithole',
	} );
	const query = returnParams.toString();
	if ( query ) {
		login.set( 'returntoquery', query );
	}
	return '/index.php?' + login.toString();
}
