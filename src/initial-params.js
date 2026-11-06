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
