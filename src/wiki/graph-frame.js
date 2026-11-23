/**
 * The connectome, inside Rabbithole: what the player says to a graph in a
 * frame, and which links open one.
 *
 * The graph is a page of its own (/bacon), script and all, so
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

/**
 * Where the graph's page lives: /bacon (Justin, #connectome, 16 Nov 2026).
 * Its files stay in /assets/connectome/, and a page parsed before the move
 * still links the old address, which the wiki sends on to /bacon.
 */
export const GRAPH_PATH = '/bacon';
const OLD_PAGES = [ '/assets/connectome/', '/assets/connectome/index.html' ];
/** A bacon graph kept as shared, /bacon/ and its ID (pickipedia:blu/bacon-keep): the same page, drawing what was kept. */
const KEPT_PATH = /^\/bacon\/[cfmr][0-9a-hjkmnp-tv-z]{10}\/?$/;

/** A challenge, /bacon/challenge and whom to find: the same page, which reads the name from the address. */
const CHALLENGE_PATH = /^\/bacon\/challenge(\/[^/]+)?\/?$/;

/** Is this path the graph's page, at either address, a kept graph's, or a challenge's? */
function isGraphPath( path ) {
	return path === GRAPH_PATH || path === GRAPH_PATH + '/' || OLD_PAGES.includes( path ) || KEPT_PATH.test( path ) ||
		CHALLENGE_PATH.test( path );
}

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
	if ( url.origin !== window.location.origin || ! isGraphPath( url.pathname ) ) {
		return null;
	}
	url.searchParams.set( 'host', 'rabbithole' );
	const own = KEPT_PATH.test( url.pathname ) || CHALLENGE_PATH.test( url.pathname );
	return ( own ? url.pathname.replace( /\/$/, '' ) : GRAPH_PATH ) + url.search;
}

/** Is this frame showing a connectome? */
export function isGraphFrame( frame ) {
	const src = frame && frame.getAttribute && frame.getAttribute( 'src' );
	if ( ! src ) {
		return false;
	}
	try {
		return isGraphPath( new URL( src, window.location.origin ).pathname );
	} catch ( err ) {
		return false;
	}
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
export function walkMessage( { hops = [], chasing = null, chaseMode = null, now = null, playing = false, mode = 'full', night = false, at = -1, steering = false } = {} ) {
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
		// Whether the reader is steering the graph (traverse mode off) or the
		// music is: steering, the graph shows its search bar and the way come
		// (shell.js; the graph's own page under "one shell").
		steering: !! steering,
	};
}

/**
 * What the ensemble list is showing, for a graph to show too (Justin,
 * #connectome, 20 Nov 2026, 14:16Z: "The effects in the ensemble chart are
 * looking great. I want to also see them in some form in the bacon graph. If
 * a picker is visible and they get a flourish, show the flourish in the
 * graph as well as the ensemble list. Same for solos, etc.").
 *
 * One entry for each card of the band (not the engineer, who was not
 * playing): the name the chart gives them and their page's own, which is the
 * graph's; the instrument the card shows; the scene the card wears (lead,
 * pickup, out, ...); whether somebody is
 * coming in; and the one light the card shows, chosen as the card chooses it
 * (MusicianCard.vue: a spotlight over a flourish over the band's flash), in
 * the colour and at the beat the card has it.
 *
 * Pure. `color` turns a chart's colour name into one a stylesheet takes
 * (player/glow.js fxColor).
 *
 * @return {Object} The message.
 */
export function fxMessage( { cards = [], effects = [], playing = false, track = null, titles = {}, color = ( c ) => c } = {} ) {
	const band = effects.find( ( e ) => e.kind === 'bandFlash' ) || null;
	const say = ( e ) => ( {
		kind: e.kind,
		color: color( e.color ),
		level: Math.max( 0.35, Math.min( 1.3, Number( e.intensity ) || 0.7 ) ),
		pulse: Math.max( 0.5, Math.min( 6, Number( e.pulse ) || 1.2 ) ),
	} );
	return {
		rabbithole: 'fx',
		playing: !! playing,
		// The song on now, by its track: the graph flashes its whole band pink when a new one starts (Justin,
		// #connectome, 23 Nov 2026, 18:30Z: "If you're looking at a bacon graph when a song starts, let's always
		// give a nice pink flash to everybody in the ensemble of that song").
		track: track || null,
		band: cards.filter( ( c ) => c && ! c.engineer ).map( ( c ) => {
			const mine = effects.filter( ( e ) => e.target === c.name );
			const light = mine.find( ( e ) => e.kind === 'spotlight' ) || mine.find( ( e ) => e.kind === 'flourish' ) || band;
			return {
				name: c.name,
				title: titles[ c.name ] || null,
				scene: c.scene || null,
				singing: !! c.singing,
				// what the card says they have in hand now, an instrument change and all: the graph writes it in
				// brackets after their name (Justin, 23 Nov 2026: "change instruments consistent with the
				// rabbithole display")
				instrument: c.instrument || null,
				enter: mine.some( ( e ) => e.kind === 'enter' ),
				light: light ? say( light ) : null,
			};
		} ),
	};
}

/**
 * What the one bar asks of the graph in the shell's frame: the graph's link
 * button and its FAQ are in Rabbithole's bar now (Justin, #connectome, 21
 * Nov 2026, 01:56Z: "integrate the top bar of rabbithole with the top bar
 * of /bacon/ ... Let's get all that stuff on one unified top bar"), and the
 * graph, told `bar=1` in its address (shell.js frameSrc), puts its own bar
 * away. `share`: the link to this graph, to keep or to share; `faq`: the
 * questions and answers. The graph shows either inside itself.
 *
 * Pure. An ask it does not know is no ask.
 *
 * @param {string} act 'share' or 'faq'.
 * @return {?Object} The message, or null.
 */
export function barMessage( act ) {
	return act === 'share' || act === 'faq' ? { rabbithole: 'bar', act } : null;
}
