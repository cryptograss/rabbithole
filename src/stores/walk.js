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
 */

import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

import { usePlayerStore } from './player.js';
import { useSongStore } from './song.js';

const KEY = 'rabbithole-walk';
/** A refresh keeps the whole rabbithole; a cap keeps it from growing forever. */
const CAP = 200;

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
 * A walk as it was stored, junk tolerated.
 *
 * Pure. localStorage can hold anything a browser felt like keeping: a
 * hand-edited value, an older shape, a string where an array belongs. A
 * walk that cannot be trusted is an empty one, never an error.
 *
 * @param {string} raw What localStorage held.
 * @return {Array} The hops worth keeping, oldest first.
 */
export function revive( raw ) {
	let value;
	try {
		value = JSON.parse( raw );
	} catch ( e ) {
		return [];
	}
	if ( ! Array.isArray( value ) ) {
		return [];
	}
	const hops = [];
	for ( const entry of value ) {
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
			at: typeof entry.at === 'number' ? entry.at : null,
		} );
	}
	return hops.slice( -CAP );
}

/**
 * The walk as it is stored: JSON, oldest first, capped.
 *
 * Pure, so the cap is testable without a browser.
 *
 * @param {Array} walk The walk.
 * @return {string} What goes into localStorage.
 */
export function stored( walk ) {
	return JSON.stringify( Array.isArray( walk ) ? walk.slice( -CAP ) : [] );
}

export const useWalkStore = defineStore( 'walk', () => {
	const player = usePlayerStore();
	const songs = useSongStore();

	/** Every recording that has been on, oldest first. */
	const hops = ref( revive( window.localStorage.getItem( KEY ) ) );

	/** Hops waiting for their recording to start: cid -> via. */
	const pending = new Map();

	function persist() {
		try {
			window.localStorage.setItem( KEY, stored( hops.value ) );
		} catch ( e ) {
			/* A full or blocked store is not a broken walk. */
		}
	}

	/**
	 * Say how a recording about to play was reached: who you followed, or
	 * what hop of a trail-to-here it is. Called before the song starts, so
	 * the hop carries its via when the watcher sees it.
	 */
	function mark( cid, via ) {
		if ( cid ) {
			pending.set( cid, via || null );
		}
	}

	function clear() {
		pending.clear();
		hops.value = [];
		persist();
	}

	// The recording that is on now joins the walk, with the via marked for
	// it if there was one. The first recording of a visit is where you came
	// in: it has no via.
	watch( () => player.song && player.song._trackCid, ( cid ) => {
		if ( ! cid ) {
			return;
		}
		const via = pending.get( cid ) || null;
		pending.delete( cid );
		const next = pushed( hops.value, {
			cid,
			song: ( songs.current && songs.current.title ) || null,
			via,
			at: Date.now(),
		} );
		if ( next !== hops.value ) {
			hops.value = next;
			persist();
		}
	}, { immediate: true } );

	return { hops, mark, clear };
} );
