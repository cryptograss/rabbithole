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
 * Whether the address is a Listen button's, and the song starts on arrival.
 *
 * A button that says Listen is the consent: somebody who pressed one
 * expects to hear something (Justin, #rabbithole, 12 Nov 2026). Justin
 * again, 15 Nov 2026, item 14: "if you click a 'listen in rabbithole',
 * with a play button, from anywhere -- a wiki page, one of the graphs that
 * we've built in connectome (ie, the oracle) -- it needs to autoplay when
 * you get there."
 *
 * So a link says so itself, with `play=1`, rather than being guessed at
 * from what else is in the address: anything that builds a Listen button
 * can put it there, including a graph whose links also name the page to
 * open. `play=0` is a link that deliberately opens quiet.
 *
 * Without it, the old rule stands, for every button already written: a
 * track or a record named and no page. The app itself writes
 * ?track=<cid>&page=<title> as the pane moves, so a reload, or a link
 * copied from the address bar, opens quiet. Autoplay is the browser's to
 * allow; if it refuses, the player sits loaded and the carrot waits.
 *
 * @param {URLSearchParams} params
 * @return {boolean}
 */
export function cameToListen( params ) {
	const asked = params.get( 'play' );
	if ( asked !== null ) {
		return asked !== '0' && asked !== 'no';
	}
	return ( params.has( 'track' ) || params.has( 'record' ) ) && ! params.has( 'page' );
}

/**
 * Whether the address came to edit the chart: ?track=<cid>&action=edit.
 *
 * The link a song page offers beside the chart it is about — "chart it in
 * Rabbithole", from {{Studio cut}} (14 Nov 2026). Somebody who clicked it
 * came to edit, so the editor opens with the page rather than waiting
 * behind the ✎.
 *
 * @param {URLSearchParams} params
 * @return {boolean}
 */
export function cameToEdit( params ) {
	return params.get( 'action' ) === 'edit';
}
