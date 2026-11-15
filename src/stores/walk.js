/**
 * The walk: where you have been, and how you got here.
 *
 * Justin, 11 Nov 2026: "reliably shows the user where they've been and how
 * they got where they are." The rabbithole you walked is a chain of
 * recordings, each hop saying who you followed to reach it. Following a
 * picker (stores/picker.js) and trail-to-here (wiki/queue.js) each mark
 * their hops before the song starts; this store records the hop when the
 * recording actually plays, and keeps the whole walk in localStorage, so a
 * refresh shows the same rabbithole instead of forgetting it (Justin: the
 * played list only lived in the page, and a refresh wiped it).
 *
 * The walk records who, not what they played: the instrument for the line's
 * colour is read from the performer graph where the trail is drawn, so a
 * stored walk never goes stale against the wiki.
 *
 * A rabbithole is a chain of connected songs, not everything ever heard
 * (Justin, 15 Nov 2026: "42 songs - what is that, everything I've ever
 * listened to?"). A song played with no connection to the one before it —
 * a Listen link played cold, a track opened by hand — is not another step
 * of the same walk: it closes the walk that was (kept in `past`, so a
 * walked-out rabbithole is not lost — the Oracle's training data) and
 * starts a new one. Every line between two songs says why it connects:
 * the hop carries `via` (who you followed) and `why` (chase, quest, trail,
 * next, record, road) — Justin, 15 Nov 2026: "show _why_ it connected from
 * one song to the next, every single line".
 */

import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';

import { usePlayerStore } from './player.js';
import { useSongStore } from './song.js';

const KEY = 'rabbithole-walk';
/** A refresh keeps the whole rabbithole; a cap keeps it from growing forever. */
const CAP = 200;
/** The rabbitholes walked out before this one, kept beside the walk of now. */
const PAST_CAP = 8;

/**
 * The walk with one more hop appended.
 *
 * Pure. A hop whose recording is already the last one adds nothing: the
 * same recording replayed or re-seeked is not a new place in the walk. A
 * hop for a recording heard earlier and returned to does add one, because
 * the walk is where you have been, in the order you were there.
 *
 * @param {Array} walk The walk so far.
 * @param {Object} entry {cid, song, via, at}: the recording, the page that
 *   names it, who you followed (null where you came in), and when.
 * @return {Array} The walk with the hop, or the same array when nothing changed.
 */
export function pushed( walk, entry ) {
	if ( ! entry || ! entry.cid ) {
		return walk;
	}
	const last = walk[ walk.length - 1 ];
	if ( last && last.cid === entry.cid ) {
		return walk;
	}
	return walk.concat( [ entry ] );
}

/**
 * Whether a hop says how it was reached: the word, or who you followed.
 *
 * Pure. A hop with neither is a song played cold — Justin's rule: that is
 * not a step of the walk you are on, it is the start of a new one.
 *
 * @param {Object} entry A hop: {cid, song, via, why, at}.
 * @return {boolean} Whether it connects to the song before it.
 */
export function connected( entry ) {
	return !!( entry && ( entry.why || entry.via ) );
}

/**
 * The walk with one more hop, or a new walk where the old one closed.
 *
 * Pure. A hop whose recording is already the last one adds nothing, heard
 * again howsoever it was: the same recording replayed or re-seeked is not
 * a new place in the walk, and not a new rabbithole either. A hop for a
 * recording heard earlier and returned to does add one, because the walk
 * is where you have been, in the order you were there.
 *
 * A hop with no connection (no `why`, no `via`) after the walk has begun
 * closes that walk into `past` and starts a new one with the hop (Justin,
 * 15 Nov 2026). The walk of now is `current`; the ones before it are
 * `past`, oldest first, capped at PAST_CAP.
 *
 * @param {Object} state The walk: {current, past}.
 * @param {Object} entry The hop being added: {cid, song, via, why, at}.
 * @return {Object} The walk after the hop: {current, past}. The same
 *   object where nothing changed.
 */
export function advanced( state, entry ) {
	if ( ! entry || ! entry.cid || ! Array.isArray( state.current ) ) {
		return state;
	}
	const current = state.current;
	const last = current[ current.length - 1 ];
	if ( last && last.cid === entry.cid ) {
		return state;
	}
	if ( current.length && ! connected( entry ) ) {
		return {
			current: [ entry ],
			past: state.past.concat( [ { hops: current, closedAt: entry.at || null } ] ).slice( -PAST_CAP ),
		};
	}
	return { current: pushed( current, entry ), past: state.past };
}

/**
 * The recording that counts as heard: the one loaded, once it plays.
 *
 * Pure. Null while nothing is loaded, or while what is loaded is still
 * waiting for its first note.
 *
 * @param {string|null} cid The recording loaded.
 * @param {boolean} playing Whether the player is playing.
 * @return {string|null} The recording heard, or null.
 */
export function heard( cid, playing ) {
	return cid && playing ? cid : null;
}

/**
 * Who was followed, as the graph in the drawer says it: a road not taken from
 * the song on now, taken there (Justin, 15 Nov 2026: "showing other unused but
 * potential connections and allowing the user to explore those").
 *
 * Pure. The word comes from a frame, so it is checked like anything stored:
 * a name, and an instrument if there is one; anything else is no one.
 *
 * @param {*} via What the frame sent.
 * @return {Object|null} {name, instrument}, or null.
 */
export function followedVia( via ) {
	if ( ! via || typeof via.name !== 'string' || ! via.name.trim() ) {
		return null;
	}
	return { name: via.name.trim().slice( 0, 200 ), instrument: typeof via.instrument === 'string' && via.instrument ? via.instrument.slice( 0, 100 ) : null };
}

/**
 * What the drawer does at a word from the graph in it.
 *
 * Pure. The word comes from a frame, so only what it names is done: open;
 * close (Escape inside the frame); play a recording, following someone to it
 * where it says who; open a page in the pane, shutting the drawer; or close
 * the walk of now, which shuts the drawer too (re, 15 Nov 2026: left open,
 * the drawer, gone with the empty walk, came back open by itself when the
 * next song played). A new rabbithole starts by itself now — a song played
 * with no connection closes the walk (Justin, 15 Nov 2026) — so the word
 * closes the one you are on and keeps it in `past`.
 *
 * @param {*} d What the frame sent.
 * @return {Object|null} What to do: {open}, {close}, {play, via}, {page, close}
 *   or {clear, close}; null for anything else.
 */
export function drawerDoes( d ) {
	if ( d && d.connectome === 'close' ) {
		return { close: true };
	}
	if ( ! d || d.connectome !== true ) {
		return null;
	}
	if ( d.open ) {
		return { open: true };
	}
	if ( d.play ) {
		return { play: String( d.play ), via: followedVia( d.via ) };
	}
	if ( d.page ) {
		return { page: String( d.page ), close: true };
	}
	if ( d.clear ) {
		return { clear: true, close: true };
	}
	return null;
}

/**
 * The hops worth keeping out of whatever a walk was stored as.
 *
 * Pure. Junk in a hop is dropped; a hop that says only who it followed
 * (the older shape) gains the word "followed", so every line the drawer
 * draws can say why it connects.
 *
 * @param {Array} list The hops as they were stored.
 * @return {Array} The hops worth keeping, oldest first.
 */
function hopsOf( list ) {
	const hops = [];
	for ( const entry of Array.isArray( list ) ? list : [] ) {
		if ( ! entry || typeof entry.cid !== 'string' || ! entry.cid ) {
			continue;
		}
		const via = entry.via && typeof entry.via.name === 'string' && entry.via.name
			? { name: entry.via.name, instrument: typeof entry.via.instrument === 'string' ? entry.via.instrument : null }
			: null;
		hops.push( {
			cid: entry.cid,
			song: typeof entry.song === 'string' ? entry.song : null,
			via,
			why: typeof entry.why === 'string' && entry.why ? entry.why : ( via ? 'followed' : null ),
			at: typeof entry.at === 'number' ? entry.at : null,
		} );
	}
	return hops.slice( -CAP );
}

/**
 * A walk as it was stored, junk tolerated.
 *
 * Pure. localStorage can hold anything a browser felt like keeping: a
 * hand-edited value, an older shape, a string where an array belongs. A
 * walk that cannot be trusted is an empty one, never an error. The older
 * shape — a bare array of hops, what was stored before walks closed —
 * comes back as the one walk you are on, nothing behind it.
 *
 * @param {string} raw What localStorage held.
 * @return {Object} {current, past}: the walk of now, and the ones before it.
 */
export function revive( raw ) {
	let value;
	try {
		value = JSON.parse( raw );
	} catch ( e ) {
		return { current: [], past: [] };
	}
	if ( Array.isArray( value ) ) {
		value = { current: value, past: [] };
	}
	if ( ! value || ! Array.isArray( value.current ) ) {
		return { current: [], past: [] };
	}
	return {
		current: hopsOf( value.current ),
		past: ( Array.isArray( value.past ) ? value.past : [] )
			.slice( -PAST_CAP )
			.map( ( walk ) => ( {
				hops: hopsOf( walk && walk.hops ),
				closedAt: walk && typeof walk.closedAt === 'number' ? walk.closedAt : null,
			} ) )
			.filter( ( walk ) => walk.hops.length ),
	};
}

/**
 * The walk as it is stored: JSON, oldest first, capped.
 *
 * Pure, so the cap is testable without a browser. A bare array (the older
 * shape, and what the store's tests hold) is the walk of now, nothing
 * behind it.
 *
 * @param {Object|Array} walk The walk: {current, past}, or a bare array.
 * @return {string} What goes into localStorage.
 */
export function stored( walk ) {
	let state = Array.isArray( walk ) ? { current: walk, past: [] } : walk;
	if ( ! state || ! Array.isArray( state.current ) ) {
		state = { current: [], past: [] };
	}
	return JSON.stringify( {
		current: state.current.slice( -CAP ),
		past: ( Array.isArray( state.past ) ? state.past : [] ).slice( -PAST_CAP ).map( ( closed ) => ( {
			hops: ( closed && Array.isArray( closed.hops ) ? closed.hops : [] ).slice( -CAP ),
			closedAt: closed ? closed.closedAt : null,
		} ) ),
	} );
}

export const useWalkStore = defineStore( 'walk', () => {
	const player = usePlayerStore();
	const songs = useSongStore();

	/** The walk of now, and the rabbitholes walked out before it. */
	const state = ref( revive( window.localStorage.getItem( KEY ) ) );
	/** The walk of now: every recording of it that has been on, oldest first. */
	const hops = computed( () => state.value.current );
	/** The walks closed before this one, oldest first. */
	const past = computed( () => state.value.past );

	/** Hops waiting for their recording to start: cid -> via. */
	const pending = new Map();

	function persist() {
		try {
			window.localStorage.setItem( KEY, stored( state.value ) );
		} catch ( e ) {
			/* A full or blocked store is not a broken walk. */
		}
	}

	/**
	 * Say how a recording about to play was reached: who you followed and
	 * why (the word: chase, quest, trail, next, record, road), or nothing
	 * when it is played cold. Called before the song starts, so the hop
	 * carries its connection when the watcher sees it.
	 */
	function mark( cid, via ) {
		if ( cid ) {
			pending.set( cid, via || null );
		}
	}

	/**
	 * Close the walk of now, whatever there is of it, and keep it in
	 * `past`: a rabbithole walked out is not lost (the Oracle's training
	 * data). The drawer's "start a new rabbithole" asks for this.
	 */
	function close() {
		const current = state.value.current;
		if ( ! current.length ) {
			return;
		}
		state.value = {
			current: [],
			past: state.value.past.concat( [ { hops: current, closedAt: Date.now() } ] ).slice( -PAST_CAP ),
		};
		persist();
	}

	function clear() {
		pending.clear();
		state.value = { current: [], past: [] };
		persist();
	}

	// The recording that is on now joins the walk once it plays, with the via
	// marked for it if there was one. The first recording of a visit is where
	// you came in: it has no via. Loading isn't hearing (Justin, 15 Nov 2026:
	// "32 hops ... I certainly haven't let it play for 32 tracks"): every visit
	// loads a song, and it counted whether or not a note of it played.
	watch( () => heard( player.song && player.song._trackCid, player.playing ), ( cid ) => {
		if ( ! cid ) {
			return;
		}
		const marked = pending.get( cid ) || null;
		pending.delete( cid );
		const next = advanced( state.value, {
			cid,
			song: ( songs.current && songs.current.title ) || null,
			via: marked && marked.name ? { name: marked.name, instrument: marked.instrument || null } : null,
			why: marked && typeof marked.why === 'string' && marked.why ? marked.why : null,
			at: Date.now(),
		} );
		if ( next.current !== state.value.current || next.past !== state.value.past ) {
			state.value = next;
			persist();
		}
	}, { immediate: true } );

	return { hops, past, mark, close, clear };
} );
