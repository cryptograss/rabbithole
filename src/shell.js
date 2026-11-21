/**
 * One shell: Rabbithole and the bacon graph are one app.
 *
 * Justin, #connectome, 19 Nov 2026, 19:10Z: "I want to be sure that we
 * don't have parallel logical paths happening. If I start in rabbithole
 * and get to some particular state of the bacon explorer, that will be
 * precisely the same application state as if I start in the bacon
 * explorer, navigate to that state, and start rabbithole by clicking
 * 'play', right?" And at 20:45Z: "build one shell in place of the dock."
 *
 * So /bacon is this app too (the server sends the same index.html for it;
 * maybelle-config, pickipedia-vps's Caddy). Come by /bacon, the pane opens
 * on the graph the address names, and nothing is loaded to play: no track stands, so the player's own
 * chrome -- its bar across the top, its side -- is put away, and the graph
 * has the window. The first play loads the track and the player comes out
 * of the left side (along the bottom on a phone). From there it is the app
 * a Listen link opens, in the state that app is in once its reader has
 * gone to the same place in the graph: one pane, one graph frame in it,
 * one player, one history.
 *
 * The graph is the explorer's page in a frame, as it has been in the pane
 * since 15 Nov. What is new is who keeps the history: the shell. The frame
 * says each step it takes ({ connectome: true, at, step, n, s }); the
 * shell puts it in the browser's history and in the address, beside the
 * pane's pages, in the order they happened; Back and Forward come to the
 * shell, which shows the page or sends the frame back to that step
 * ({ rabbithole: 'step', to, n, s }), drawn as it was.
 */
import { INITIAL_PARAMS } from './initial-params.js';

/** Is this path the graph's: /bacon, a kept graph's, a challenge's? */
export function isGraphAddress( pathname ) {
	return /^\/bacon(\/|$)/.test( pathname || '' );
}

/** Came by /bacon: the pane starts on the graph, and nothing plays until asked. */
export const GRAPH_START = typeof window !== 'undefined' && isGraphAddress( window.location.pathname );

/** What in an address is the shell's own, and not the graph's. `page` is the graph's at /bacon: a page's own graph. */
export const SHELL_KEYS = [ 'track', 'record', 'play', 'layout', 'enc', 'action', 'webaudio', 'rhdiag', 'soundcheck' ];
/** What the frame's own address carries to say it is hosted: never part of the shell's. */
const FRAME_KEYS = [ 'host', 'shell', 'steer', 'bar' ];

/**
 * Where the graph is, out of an address of either kind (the shell's own,
 * or a frame's src): the path and what of the query is the graph's. Pure.
 *
 * @param {string} href
 * @param {string} [origin]
 * @return {?string} Like "/bacon?p=Cory+Walker", or null when it is no graph's.
 */
export function graphAt( href, origin = 'https://pickipedia.xyz' ) {
	let url;
	try {
		url = new URL( href, origin );
	} catch ( err ) {
		return null;
	}
	if ( ! isGraphAddress( url.pathname ) ) {
		return null;
	}
	for ( const key of SHELL_KEYS.concat( FRAME_KEYS ) ) {
		url.searchParams.delete( key );
	}
	const query = url.searchParams.toString();
	return url.pathname.replace( /(.)\/$/, '$1' ) + ( query ? '?' + query : '' );
}

/**
 * The frame's src for a place in the graph: hosted, in the shell, and whether the reader is steering. Pure.
 *
 * `bar=1`: the shell's one bar carries the graph's link button, its FAQ and the way to PickiPedia (Justin,
 * #connectome, 21 Nov 2026, 01:56Z: "Let's get all that stuff on one unified top bar"), so the graph puts its own
 * bar away. A graph that does not know the word keeps its bar, and nothing is lost.
 */
export function frameSrc( at, steering = false ) {
	const url = new URL( at, 'https://pickipedia.xyz' );
	url.searchParams.set( 'host', 'rabbithole' );
	url.searchParams.set( 'shell', '1' );
	url.searchParams.set( 'bar', '1' );
	if ( steering ) {
		url.searchParams.set( 'steer', '1' );
	}
	return url.pathname + url.search;
}

/** The shell's address for a place in the graph, with the track that stands, if one does. Pure. */
export function shellAddress( at, track = null ) {
	const url = new URL( at, 'https://pickipedia.xyz' );
	if ( track ) {
		url.searchParams.set( 'track', track );
	}
	return url.pathname + url.search;
}

/**
 * Does moving the frame by word do, or does it need loading again? By word
 * within the plain graph (/bacon and a query); a kept graph and a challenge
 * are read from the path, so they load. Pure.
 */
export function movesByWord( from, to ) {
	const a = new URL( from, 'https://pickipedia.xyz' ), b = new URL( to, 'https://pickipedia.xyz' );
	return a.pathname === '/bacon' && b.pathname === '/bacon' && !! b.search;
}

/** The place in the graph this visit came for, when it came by /bacon. */
export function startAt() {
	return GRAPH_START ? graphAt( window.location.href, window.location.origin ) : null;
}

/**
 * Is this place the song's own bacon graph: the graph of the track that
 * stands (?cut=<track>), at nobody? There, traverse mode starts on bacon
 * graphs, as it does in Rabbithole (Justin, #connectome, 20 Nov 2026: "I
 * want it to be bacon graphs by default"). Anywhere else the reader came
 * to a place of their own choosing, and steers: off, to come back on as
 * bacon graphs at the song. Pure.
 *
 * @param {?string} at Like "/bacon?cut=Qm...&s=Paint+Exchange" (graphAt's).
 * @param {?string} track The track in the address, if one is.
 * @return {boolean}
 */
export function isSongsOwnGraph( at, track ) {
	if ( ! at || ! track ) {
		return false;
	}
	const url = new URL( at, 'https://pickipedia.xyz' );
	return url.pathname === '/bacon' && url.searchParams.get( 'cut' ) === track && ! url.searchParams.get( 'p' );
}

/** Came by /bacon to the song's own graph (isSongsOwnGraph). */
export function startsOnSong() {
	return GRAPH_START && isSongsOwnGraph( startAt(), INITIAL_PARAMS.get( 'track' ) );
}

/** A Listen link's play=1, which at /bacon is the only thing that starts a song on arrival: a reload opens quiet. */
export function graphStartPlays() {
	const asked = INITIAL_PARAMS.get( 'play' );
	return asked !== null && asked !== '0' && asked !== 'no';
}
