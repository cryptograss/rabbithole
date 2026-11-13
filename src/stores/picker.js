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

import { recordsOn } from '../trail.js';
import { recordsOf } from '../wiki/api.js';
import { performerGraph, songCid } from '../wiki/queue.js';
import { usePlayerStore } from './player.js';
import { useSongStore } from './song.js';
import { useWalkStore } from './walk.js';

/** A page title as the graph spells a person: spaces, not underscores. */
export function personName( title ) {
	return title ? title.replace( /_/g, ' ' ).trim() : null;
}

/**
 * How the walk says a hop was made by following someone: who, and what
 * they played on the song they led to, as the performer graph has it.
 * Pure.
 */
export function viaPicker( graph, song, name ) {
	const instruments = ( ( graph && graph.band && graph.band[ song ] ) || {} )[ name ] || [];
	return { name, instrument: instruments[ 0 ] || null };
}

/**
 * The first of a picker's songs worth playing next: not the recording
 * playing, not one already played while following, not one already queued.
 * Pure: give it the songs and a way to find each one's recording.
 *
 * Recordings are compared by CID, never by title. The graph names a song
 * by its Song: page and the track by its own title, and the two differ:
 * "Barlow's Jig" is the track "Barlows". Compared by title, following
 * never saw that Barlows was already playing and queued it again behind
 * itself: "Up next: Barlows · Barlows" (Justin, 11 Nov 2026).
 *
 * And the recording has to be one the picker is on. A song is cut more than
 * once, with different bands: Harry Clark is on Barlow's Jig from Vowel
 * Sounds, and the recording the song's page plays is the one from 4masks,
 * which he is not on. Following him landed there (Justin, 11 Nov 2026).
 * So the names of the recording's record are held against the records the
 * picker's credits on the song are on; when either side is unknown, nothing
 * is ruled out.
 */
export async function firstPlayable( songsOf, {
	currentCid, playedCids, queuedCids, cidOf, recordsOf = async () => [], recordsOn = () => [],
} ) {
	for ( const song of songsOf ) {
		const cid = await cidOf( song );
		if ( ! cid || cid === currentCid || playedCids.has( cid ) || queuedCids.includes( cid ) ) {
			continue;
		}
		const names = await recordsOf( cid );
		const theirs = recordsOn( song );
		if ( names.length && theirs.length && ! names.some( ( n ) => theirs.includes( n ) ) ) {
			continue;
		}
		return { song, cid };
	}
	return null;
}

export const usePickerStore = defineStore( 'picker', () => {
	const player = usePlayerStore();
	const songs = useSongStore();
	const walk = useWalkStore();

	/** Who is being followed, or null. */
	const following = ref( null );
	/** What following them has queued: {song, cid}, or null. */
	const next = ref( null );
	/**
	 * What following the picker on screen would play next:
	 * {name, next: {song, cid} | null}, or null when the page is not a picker's.
	 */
	const offer = ref( null );
	/** Every recording that has been on, by CID. */
	const playedCids = new Set();

	const currentCid = () => ( songs.current && songs.current._trackCid ) || null;

	async function nextFor( name ) {
		const graph = await performerGraph();
		return firstPlayable( graph.plays[ name ] || [], {
			currentCid: currentCid(), playedCids, queuedCids: songs.queuedCids, cidOf: songCid,
			recordsOf, recordsOn: ( song ) => recordsOn( graph, song, name ),
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
		const name = following.value;
		next.value = await nextFor( name );
		if ( next.value ) {
			// Marked before it is queued, so however soon it starts, the
			// walk knows it came by following this picker.
			walk.mark( next.value.cid, viaPicker( await performerGraph(), next.value.song, name ) );
			await songs.queueCid( next.value.cid );
		}
		if ( offer.value && offer.value.name === following.value ) {
			offer.value = { name: following.value, next: next.value };
		}
	}

	/*
	 * Following starts the picker's next song at once when nothing is
	 * playing. Queued behind a song that had already ended, it waited for
	 * an end that had come and gone: "Following Jake Stargel. Plays next:
	 * Barlow's Jig", and then nothing (Justin, 11 Nov 2026). A paused song
	 * is still the song you're on, so following waits for it.
	 */
	async function follow( name ) {
		following.value = name;
		await queueNext();
		if ( next.value && player.status === 'STOPPED' ) {
			player.model.playNext();
		}
	}

	function stop() {
		following.value = null;
		next.value = null;
	}

	// Every song that has been on counts as played, the first one too, so
	// following never lines up something you just heard.
	watch( currentCid, ( cid ) => {
		if ( cid ) {
			playedCids.add( cid );
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
