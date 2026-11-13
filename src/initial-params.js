/*
 * The query string, read once and kept.
 *
 * The pane soft-navigates with history.replaceState to /wiki/<page>, and
 * that drops the query. Anything read from location.search after the first
 * navigation finds nothing, which is how ?rhdiag=1 came to do nothing at
 * all while the file plainly contained it.
 */
export const INITIAL_PARAMS = new URLSearchParams(
	typeof window !== 'undefined' ? window.location.search : ''
);

/** The page's own address, before the pane rewrites it to an article's. */
export const PAGE_URL = typeof window !== 'undefined' ? window.location.href : '';

/**
 * Whether the address is a Listen button's: a track or a record named,
 * and no page.
 *
 * "Listen in Rabbithole" on a Song page, and "Play in Rabbithole" on a
 * Release page, both land at ?track=<cid>, and a person who pressed a
 * button that says Listen expects to hear something (Justin, #rabbithole,
 * 12 Nov 2026). The app itself writes ?track=<cid>&page=<title> as the
 * pane moves, so a reload, or a link copied from the address bar, names a
 * page: those open quiet, as before. Autoplay is otherwise the browser's
 * to allow; if it refuses, the player sits loaded and the carrot waits.
 *
 * @param {URLSearchParams} params
 * @return {boolean}
 */
export function cameToListen( params ) {
	return ( params.has( 'track' ) || params.has( 'record' ) ) && ! params.has( 'page' );
}
