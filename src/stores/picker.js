/**
 * Following a picker: after this song, play the songs one musician is on,
 * one after another.
 *
 * Justin, 7 Nov 2026: "It's not obvious how to follow a picker, nor what
 * song will play next if I do." So the offer is made where you meet a
 * picker, on their page, and it names the song before you take it. The
 * songs come from the wiki's performer graph (Has performer), the same one
 * the rabbithole trail walks. Each is queued in Webamp's playlist one at a
 * time, the next one when the last one starts, so the queue always shows
 * what plays next and nothing piles up.
 */

import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

import { performerGraph, songCid } from '../wiki/queue.js';
import { usePlayerStore } from './player.js';
import { useSongStore } from './song.js';

/** A page title as the graph spells a person: spaces, not underscores. */
export function personName( title ) {
	return title ? title.replace( /_/g, ' ' ).trim() : null;
}

/**
 * The first of a picker's songs worth playing next: not the one playing, not
 * one already played while following, not one already queued. Pure: give it
 * the songs and a way to find each one's recording.
 */
export async function firstPlayable( songsOf, { current, played, queuedCids, cidOf } ) {
	for ( const song of songsOf ) {
		if ( song === current || played.has( song ) ) {
			continue;
		}
		const cid = await cidOf( song );
		if ( cid && ! queuedCids.includes( cid ) ) {
			return { song, cid };
		}
	}
	return null;
}

export const usePickerStore = defineStore( 'picker', () => {
	const player = usePlayerStore();
	const songs = useSongStore();

	/** Who is being followed, or null. */
	const following = ref( null );
	/** What following them has queued: {song, cid}, or null. */
	const next = ref( null );
	/**
	 * What following the picker on screen would play next:
	 * {name, next: {song, cid} | null}, or null when the page is not a picker's.
	 */
	const offer = ref( null );
	const played = new Set();

	const currentSong = () => ( songs.current && songs.current.title ? 'Song:' + songs.current.title : null );

	async function nextFor( name ) {
		const graph = await performerGraph();
		return firstPlayable( graph.plays[ name ] || [], {
			current: currentSong(), played, queuedCids: songs.queuedCids, cidOf: songCid,
		} );
	}

	let asked = 0;
	/** The page on screen changed: if it is a picker's, work out the offer. */
	async function look( title ) {
		const name = personName( title );
		const mine = ++asked;
		const graph = await performerGraph();
		if ( mine !== asked ) {
			return;
		}
		if ( ! name || ! graph.plays[ name ] ) {
			offer.value = null;
			return;
		}
		if ( following.value === name ) {
			offer.value = { name, next: next.value };
			return;
		}
		const n = await nextFor( name );
		if ( mine === asked ) {
			offer.value = { name, next: n };
		}
	}

	async function queueNext() {
		next.value = await nextFor( following.value );
		if ( next.value ) {
			await songs.queueCid( next.value.cid );
		}
		if ( offer.value && offer.value.name === following.value ) {
			offer.value = { name: following.value, next: next.value };
		}
	}

	async function follow( name ) {
		following.value = name;
		await queueNext();
	}

	function stop() {
		following.value = null;
		next.value = null;
	}

	// Every song that has been on counts as played, the first one too, so
	// following never lines up something you just heard.
	watch( currentSong, ( song ) => {
		if ( song ) {
			played.add( song );
		}
	}, { immediate: true } );

	// The song following queued has started: line up the picker's next one.
	watch( () => player.song && player.song._trackCid, ( cid ) => {
		if ( following.value && next.value && cid === next.value.cid ) {
			queueNext();
		}
	} );

	return { following, next, offer, look, follow, stop };
} );
