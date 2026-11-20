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
import { runningOrderFrom } from '../record-order.js';
import * as wiki from '../wiki/api.js';
import { DEFAULT_TRACK, defaultColorScheme } from '../wiki/demo-songs.js';
import { soundcheck } from '../soundcheck.js';
import { usePlayerStore } from './player.js';
import { GRAPH_START } from '../shell.js';
import { useWalkStore } from './walk.js';

/**
 * A record's running order, as the rabbithole hands it out: the tracks in
 * production, in order. The track the address names starts it whatever
 * its state -- somebody named it. And a record with nothing in production
 * still plays its first track, alone: the record was asked for by name,
 * and a link to it that played nothing would be a dead link. Pure.
 *
 * @param {string[]} order The record's track CIDs, from where it starts.
 * @param {?string} named The track the address names, if it names one.
 * @param {string[]} ready The CIDs in production.
 * @return {string[]}
 */
export function handedFrom( order, named, ready ) {
	const handed = order.filter( ( cid, i ) => ready.includes( cid ) || ( i === 0 && cid === named ) );
	return handed.length ? handed : order.slice( 0, 1 );
}

/**
 * A record's tracks as the header's selector lists them: those in
 * production, in running order, and the one that stands now whatever its
 * state, so the selector shows what is playing. The list is an offer, and
 * the rabbithole offers only what is ready (Justin, 20 Nov 2026: "which
 * songs appear as rabbithole candidates and which don't"). Pure.
 *
 * @param {Array<{cid: string, track_number?: number}>} tracks The record's.
 * @param {string[]} ready The CIDs in production.
 * @param {?string} standing The track loaded now.
 * @return {Array}
 */
export function listedOf( tracks, ready, standing = null ) {
	return ( tracks || [] )
		.filter( ( t ) => t && t.cid && ( ready.includes( t.cid ) || t.cid === standing ) )
		.sort( ( a, b ) => ( a.track_number || 0 ) - ( b.track_number || 0 ) );
}

export const useSongStore = defineStore( 'song', () => {
	const player = usePlayerStore();

	const trackParam = INITIAL_PARAMS.get( 'track' );
	/** ?record=<cid>: a whole record, played in running order. */
	const recordParam = INITIAL_PARAMS.get( 'record' );
	/** The record's tracks still to line up once the player stands. */
	const recordRest = ref( [] );
	const forcedEncoding = INITIAL_PARAMS.get( 'enc' );

	const initial = ref( null );
	const loading = ref( true );
	const loadError = ref( null );
	/**
	 * Every track with a chart on the wiki, each with its state; the part
	 * of it in production (`ready`, below) is the song selector's list, and
	 * what the rabbithole falls back to when a chase and a quest have both
	 * run out (Justin's item 28). It used to be fetched only when the
	 * address named no track, since only the selector wanted it; on a
	 * visit from a Listen link the list was empty and the fallback had
	 * nothing to reach for (re, #rabbithole, 15 Nov 2026).
	 */
	const charted = ref( [] );
	let chartedPromise = null;

	/** The charted list, when it arrives. Asked of the wiki once. */
	function chartedList() {
		if ( ! chartedPromise ) {
			chartedPromise = wiki.chartedTracks().then( ( list ) => {
				charted.value = list;
				return list;
			} ).catch( ( err ) => {
				console.warn( 'Could not list the charted songs:', err );
				chartedPromise = null;
				return [];
			} );
		}
		return chartedPromise;
	}
	/**
	 * What the rabbithole may hand a listener: the charted tracks in
	 * production (wiki/api.js, STATES). The song selector's list, the
	 * floor's, and the gate a chase, a quest, a trail and a record's
	 * running order all ask at (Justin, 16 and 20 Nov 2026).
	 */
	const ready = computed( () => wiki.readyTracks( charted.value ) );

	/** The ready list, when it arrives. */
	function readyList() {
		return chartedList().then( ( list ) => wiki.readyTracks( list ) );
	}

	/** May the rabbithole hand this recording out? A track nobody can vouch for, it may not. */
	async function isReady( cid ) {
		return !! cid && ( await readyList() ).some( ( t ) => t.cid === cid );
	}

	/** Locked to one track by ?track=, or one record by ?record=: the song selector stays hidden. */
	const lockedToTrack = computed( () => !! trackParam || !! recordParam );

	const current = computed( () => player.song || initial.value );

	// The record: title, running order, cover, and the page it goes by.
	const album = ref( null );
	/** The record's own page on the wiki ([[4masks]]), the way back to it. */
	const recordPage = ref( null );
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

	let playWhenReady = false;
	watch( () => player.ready, ( ready ) => {
		if ( ready && playWhenReady ) {
			playWhenReady = false;
			player.model.play();
		}
	} );

	/** Load the track named in the URL, or the default song. */
	async function boot() {
		if ( GRAPH_START && ! trackParam && ! recordParam ) {
			// Come by /bacon with no track named (shell.js): nothing stands until something is asked for.
			chartedList();
			loading.value = false;
			return;
		}
		loading.value = true;
		// However the visit arrived, the rabbithole needs to know what it
		// can play; the track loads without waiting for the answer.
		chartedList();
		loadError.value = null;
		try {
			if ( recordParam ) {
				initial.value = await bootRecord();
			} else if ( trackParam ) {
				// ?track= is a CID, or a readable alias: a Release: redirect to one.
				const { cid, alias } = await wiki.resolveTrack( trackParam );
				const song = await wiki.loadTrack( cid, { forcedEncoding } );
				song.colorScheme = defaultColorScheme;
				song._alias = alias;
				initial.value = song;
			} else {
				initial.value = await fetchTrack( DEFAULT_TRACK );
			}
		} catch ( err ) {
			console.error( 'Failed to load the track:', err );
			loadError.value = err.message;
			// The default song still plays, so the page is not empty.
			try {
				initial.value = await fetchTrack( DEFAULT_TRACK );
			} catch ( inner ) {
				console.error( 'Could not resolve the default track either:', inner );
			}
		} finally {
			// ?soundcheck, where the app is being developed: every effect
			// in fifty seconds, laid over this song (soundcheck.js).
			if ( import.meta.env.DEV && INITIAL_PARAMS.has( 'soundcheck' ) && initial.value ) {
				soundcheck( initial.value );
			}
			loading.value = false;
		}
	}

	/**
	 * The record ?record= names: its first playable track (or the one a
	 * reload names) to start with; the rest wait in recordRest for
	 * queueRecordRest, since Webamp's playlist exists only once it stands.
	 */
	async function bootRecord() {
		const { cid } = await wiki.resolveTrack( recordParam );
		const record = await wiki.loadAlbum( cid );
		if ( ! record ) {
			throw new Error( 'Record Release page not found, or it lists no tracks: ' + recordParam );
		}
		const from = trackParam ? ( await wiki.resolveTrack( trackParam ) ).cid : null;
		const order = handedFrom( runningOrderFrom( record.tracks, from ), from, ( await readyList() ).map( ( t ) => t.cid ) );
		for ( let i = 0; i < order.length; i++ ) {
			try {
				const song = await fetchTrack( order[ i ] );
				recordRest.value = order.slice( i + 1 );
				return song;
			} catch ( err ) {
				console.warn( 'Skipping a track of the record that will not load:', order[ i ], err );
			}
		}
		throw new Error( 'No track of this record will play: ' + recordParam );
	}

	/** Line up the rest of the record, in running order. A track that will not load is skipped. */
	async function queueRecordRest() {
		const rest = recordRest.value;
		recordRest.value = [];
		const walk = useWalkStore();
		for ( const cid of rest ) {
			// Next on the record is how each connects to the one before it;
			// unmarked, the walk would read the record as songs played cold.
			walk.mark( cid, { why: 'record' } );
			try {
				await queueCid( cid );
			} catch ( err ) {
				console.warn( 'Skipping a track of the record that will not load:', cid, err );
			}
		}
	}

	/** The song selector: load (not play) a charted track. */
	async function pickTrack( cid ) {
		notice.value = '';
		try {
			const song = await fetchTrack( cid );
			if ( player.model ) {
				player.model.loadSong( song );
			} else {
				initial.value = song;
			}
		} catch ( err ) {
			console.error( 'Could not resolve audio for', cid, err );
			notice.value = 'no audio for this track';
		}
	}

	/** Fetch a track from the wiki, ready for the player. */
	async function fetchTrack( cid ) {
		const song = await wiki.loadTrack( cid, { forcedEncoding } );
		song.colorScheme = defaultColorScheme;
		return song;
	}

	/**
	 * Play this track now, replacing the playlist.
	 *
	 * `play` starts it whatever was happening before: a Listen button is a
	 * request to hear something, so it plays rather than sitting loaded
	 * (Justin's item 14).
	 */
	async function playCid( cid, { play = false } = {} ) {
		const song = await fetchTrack( cid );
		if ( player.model ) {
			player.model.loadSong( song, { play } );
		} else {
			// No player yet: this song is what it is made with (WebampDock), and it plays once the player stands.
			// Until one shell (shell.js) there was always a player by the time anything was asked for.
			initial.value = song;
			playWhenReady = playWhenReady || play;
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
			// The address names the track by the readable alias it came with,
			// else by its CID.
			const url = new URL( window.location.href );
			url.searchParams.set( 'track', song._alias || song._trackCid );
			history.replaceState( { ...history.state, track: song._trackCid }, '', url );
		}

		album.value = null;
		recordPage.value = null;
		artUrl.value = null;
		artFailed.value = false;
		try {
			const a = await wiki.loadAlbum( song.album );
			if ( current.value !== song ) {
				return;
			}
			album.value = a;
			if ( a ) {
				const [ page, art ] = await Promise.all( [ wiki.recordPageOf( a.cid ), wiki.findAlbumArt( a.cid ) ] );
				if ( current.value === song ) {
					recordPage.value = page;
					artUrl.value = art;
				}
			}
		} catch ( err ) {
			console.warn( 'Could not build the album row:', err );
		}
	}, { immediate: true } );

	return {
		initial, loading, loadError, charted, ready, lockedToTrack, current,
		album, recordPage, artUrl, artFailed, notice, metadataParts, queuedCids, recordRest,
		boot, pickTrack, fetchTrack, playCid, queueCid, queueRecordRest, goToTrack, chartedList, readyList, isReady,
	};
} );
