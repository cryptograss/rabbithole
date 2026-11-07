/**
 * What is loaded, where it came from, and the record it belongs to.
 *
 * The current song is the player's: once the model exists, its state.song
 * is the truth, and this store derives the title, the album row, the cover
 * and the URL from it. Before the model exists (the first load, which has
 * to fetch the track before Webamp can be built) `initial` holds the song
 * the dock will start with.
 */

import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';

import { INITIAL_PARAMS } from '../initial-params.js';
import * as wiki from '../wiki/api.js';
import { demoSongs, defaultColorScheme } from '../wiki/demo-songs.js';
import { usePlayerStore } from './player.js';

export const useSongStore = defineStore( 'song', () => {
	const player = usePlayerStore();

	const trackParam = INITIAL_PARAMS.get( 'track' );
	const forcedEncoding = INITIAL_PARAMS.get( 'enc' );

	const initial = ref( null );
	const loading = ref( true );
	const loadError = ref( null );
	const demoKey = ref( 'august' );
	/** Locked to one track by ?track=: the demo selector stays hidden. */
	const lockedToTrack = computed( () => !! trackParam );

	const current = computed( () => player.song || initial.value );

	// The record: title, running order, cover.
	const album = ref( null );
	const artUrl = ref( null );
	const artFailed = ref( false );
	const notice = ref( '' );

	const metadataParts = computed( () => {
		const s = current.value;
		if ( ! s ) {
			return [];
		}
		const parts = [];
		if ( s._record ) {
			parts.push( 'Recorded ' + s._record );
		}
		if ( s._studio ) {
			parts.push( s._studio );
		}
		if ( s._sessionType ) {
			parts.push( s._sessionType );
		}
		if ( s._engineer ) {
			parts.push( 'Engineer: ' + s._engineer );
		}
		return parts;
	} );

	/** Load the track named in the URL, or the first demo song. */
	async function boot() {
		loading.value = true;
		loadError.value = null;
		try {
			if ( trackParam ) {
				const song = await wiki.loadTrack( trackParam, { forcedEncoding } );
				song.colorScheme = defaultColorScheme;
				initial.value = song;
			} else {
				initial.value = await demoSong( demoKey.value );
			}
		} catch ( err ) {
			console.error( 'Failed to load the track:', err );
			loadError.value = err.message;
			// The demo still plays, so the page is not empty.
			try {
				initial.value = await demoSong( 'august' );
			} catch ( inner ) {
				console.error( 'Could not resolve the default track either:', inner );
			}
		} finally {
			loading.value = false;
		}
	}

	async function demoSong( key ) {
		return fetchTrack( demoSongs[ key ].trackCid );
	}

	/** The demo selector: load (not play) one of the four built-in songs. */
	async function pickDemo( key ) {
		if ( ! demoSongs[ key ] ) {
			return;
		}
		demoKey.value = key;
		notice.value = '';
		try {
			const song = await demoSong( key );
			if ( player.model ) {
				player.model.loadSong( song );
			} else {
				initial.value = song;
			}
		} catch ( err ) {
			console.error( 'Could not resolve audio for', key, err );
			notice.value = 'no audio for this track';
		}
	}

	/** Fetch a track from the wiki, ready for the player. */
	async function fetchTrack( cid ) {
		const song = await wiki.loadTrack( cid, { forcedEncoding } );
		song.colorScheme = defaultColorScheme;
		return song;
	}

	/** Play this track now, replacing the playlist. */
	async function playCid( cid ) {
		const song = await fetchTrack( cid );
		if ( player.model ) {
			player.model.loadSong( song );
		} else {
			initial.value = song;
		}
		return song;
	}

	/** Line this track up after what is playing. False if it was already there. */
	async function queueCid( cid ) {
		const song = await fetchTrack( cid );
		return player.model ? player.model.enqueue( song ) : false;
	}

	/** The CIDs lined up after the current track. */
	const queuedCids = computed( () => player.upNext.map( ( s ) => s._trackCid ) );

	/** Changing track in the album list is a navigation: the whole app keys off ?track=. */
	function goToTrack( cid ) {
		const url = new URL( window.location.href );
		url.pathname = new URL( import.meta.env.BASE_URL, window.location.origin ).pathname;
		url.search = '';
		url.searchParams.set( 'track', cid );
		window.location.href = url.toString();
	}

	// The rest of the page catches up with whatever song the player shows:
	// the record, the cover, the URL and the tab's title.
	watch( current, async ( song ) => {
		if ( ! song ) {
			return;
		}
		document.title = song.title ? `${ song.title } · Rabbithole` : 'Rabbithole';

		if ( song._trackCid ) {
			const url = new URL( window.location.href );
			url.searchParams.set( 'track', song._trackCid );
			history.replaceState( { ...history.state, track: song._trackCid }, '', url );
		}

		album.value = null;
		artUrl.value = null;
		artFailed.value = false;
		try {
			const a = await wiki.loadAlbum( song.album );
			if ( current.value !== song ) {
				return;
			}
			album.value = a;
			if ( a ) {
				const art = await wiki.findAlbumArt( a.cid );
				if ( current.value === song ) {
					artUrl.value = art;
				}
			}
		} catch ( err ) {
			console.warn( 'Could not build the album row:', err );
		}
	}, { immediate: true } );

	return {
		initial, loading, loadError, demoKey, lockedToTrack, current,
		album, artUrl, artFailed, notice, metadataParts, queuedCids,
		boot, pickDemo, fetchTrack, playCid, queueCid, goToTrack,
	};
} );
