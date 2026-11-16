/**
 * The connectome, inside Rabbithole: what the player says to a graph in a
 * frame, and which links open one.
 *
 * The graph is a page of its own (/assets/connectome/), script and all, so
 * it cannot be shown the way an article is: injected HTML runs no scripts.
 * It goes in a frame, and the two talk by postMessage, same origin only --
 * the protocol the walk drawer already uses (WalkTrail.vue). Told
 * `host=rabbithole`, the graph keeps its ways out inside the player: a
 * song plays here, a page opens in the pane (Justin, #rabbithole, 15 Nov
 * 2026: "let's not have it open in a new tab ... so I can explore the
 * connectome and find the next node I want to chase to").
 *
 * One definition of what the player says, because two frames hear it: the
 * drawer's walk and the graph in the pane.
 */

/** Where the connectome's own page lives. */
export const GRAPH_PATH = '/assets/connectome/';

/**
 * The frame to show for a link, or null when the link is not a graph's.
 *
 * Pure. The graph is told it is inside Rabbithole, which is what makes it
 * talk to the player instead of navigating the window.
 *
 * @param {?string} href The link's href.
 * @return {?string} The src for the frame.
 */
export function graphSrcFor( href ) {
	if ( ! href ) {
		return null;
	}
	let url;
	try {
		url = new URL( href, window.location.origin );
	} catch ( err ) {
		return null;
	}
	if ( url.origin !== window.location.origin || ! url.pathname.startsWith( GRAPH_PATH ) ) {
		return null;
	}
	url.searchParams.set( 'host', 'rabbithole' );
	return url.pathname + url.search;
}

/** Is this frame showing a connectome? */
export function isGraphFrame( frame ) {
	const src = frame && frame.getAttribute && frame.getAttribute( 'src' );
	return !! src && src.indexOf( GRAPH_PATH ) !== -1;
}

/**
 * What the player tells a graph: the walk, the song on now, whether it
 * plays, who is being chased and in which mode, and how much room the
 * graph has.
 *
 * Pure, so what is said is testable without a frame. The chased picker
 * rides along because the graph marks them wherever they appear (Justin,
 * 15 Nov 2026: "the picker I'm currently Chasing ... needs to be very
 * super bigly highlighted").
 *
 * @param {Object} state
 * @return {Object} The message.
 */
export function walkMessage( { hops = [], chasing = null, chaseMode = null, now = null, playing = false, mode = 'full', night = false, at = -1 } = {} ) {
	return {
		rabbithole: 'walk',
		hops: hops.map( ( h ) => ( {
			cid: h.cid,
			song: h.song,
			via: h.via ? { name: h.via.name, instrument: h.via.instrument } : null,
			why: h.why || null,
			at: h.at,
		} ) ),
		chasing,
		chaseMode,
		now,
		playing: !! playing,
		mode,
		// Where in the walk the listener is standing, as an index into the
		// hops: a rabbithole can come back to a recording, and then the
		// song on now does not say which step of it you are on.
		at,
		// Whether Rabbithole is by dark. The graph is a page of its own in
		// a frame, so it cannot read the app's <html>; told, it matches
		// instead of being dark inside a light page (Justin, 15 Nov 2026,
		// item 35).
		night: !! night,
	};
}
