/**
 * What a "Listen in Rabbithole" button inside the pane means.
 *
 * Justin, 18 Oct 2026: listen now, listen next, or find me a rabbithole
 * from here to there. Following the link would reload the app and throw
 * away the player, the queue and whatever is playing, the one thing a
 * dock exists to avoid. So the click is caught, the track CID is lifted
 * out of the href, and the running player is handed the song. The href
 * stays as it is: outside this app, following it is the right behaviour.
 *
 * The queue is Webamp's own playlist; the app keeps no copy. A trail is a
 * path through the performer graph (src/trail.js), queued song by song.
 */

import { buildGraph, findTrail, trailSongs } from '../trail.js';
import * as wiki from './api.js';
import { useSongStore } from '../stores/song.js';
import { usePaneStore } from '../stores/pane.js';
import { useLayoutStore } from '../stores/layout.js';
import { useListenStore } from '../stores/listen.js';
import { usePlayerStore } from '../stores/player.js';
import { useWalkStore } from '../stores/walk.js';
// The picker store imports this module in turn, for the performer graph.
// Both sides reach for the other only inside a function, by which time
// each module has finished loading.
import { usePickerStore } from '../stores/picker.js';

let graphPromise = null;

export function performerGraph() {
	if ( ! graphPromise ) {
		graphPromise = wiki.performerResults()
			.then( ( results ) => buildGraph( results ) )
			.catch( ( err ) => {
				console.warn( 'Could not read the performer graph', err );
				graphPromise = null;
				return { band: {}, plays: {} };
			} );
	}
	return graphPromise;
}

const cidForSong = {};

export async function songCid( songTitle ) {
	if ( cidForSong[ songTitle ] === undefined ) {
		cidForSong[ songTitle ] = await wiki.trackCidForSong( songTitle );
	}
	return cidForSong[ songTitle ];
}

/**
 * Say something happened, where the thing happened: the button says so
 * itself, briefly, then goes back to what it said. Queueing is invisible
 * by nature, since nothing about the page changes.
 */
export function flashButton( button, message ) {
	if ( ! button ) {
		return;
	}
	const label = button.querySelector( 'span' ) || button;
	if ( label.dataset.restLabel === undefined ) {
		label.dataset.restLabel = label.textContent;
	}
	clearTimeout( label._flashTimer );
	label.textContent = message;
	label._flashTimer = setTimeout( () => {
		label.textContent = label.dataset.restLabel;
	}, 2200 );
}

/**
 * Play this track in the dock, now. Opens the dock first, so a slow fetch
 * happens in front of the player.
 *
 * It plays: a button that says Listen is the consent (Justin's item 14).
 * Picking a song from a selector still only loads it.
 */
export async function playTrackInDock( cid ) {
	const layout = useLayoutStore();
	const songs = useSongStore();
	layout.openDock();
	try {
		await songs.playCid( cid, { play: true } );
	} catch ( err ) {
		console.warn( 'Could not play', cid, 'in the dock', err );
	}
}

/**
 * A track asked for, from anywhere: the pane's buttons, a connectome in
 * the pane, the walk's own drawer.
 *
 * One rule, in one place: nothing playing, it plays; something playing,
 * the three answers are offered (Justin's item 15, and item 36 on 15 Nov
 * 2026: "I'm still not getting options when I click any of the 'listen in
 * rabbithole' buttons, on a page or in a bacon graph"). A graph used to
 * play its pick over whatever was on without asking.
 *
 * @param {string} cid The recording asked for.
 * @param {?Object} via Who was followed to it, where that is known.
 */
export async function askOrPlay( cid, via = null ) {
	const player = usePlayerStore();
	const listen = useListenStore();
	const playing = player.song && player.song._trackCid;
	if ( player.playing && cid !== playing ) {
		await listen.ask( cid, null, via );
		return;
	}
	if ( via ) {
		useWalkStore().mark( cid, via );
	}
	await playTrackInDock( cid );
}

/**
 * A track named somewhere that is about getting there rather than about
 * hearing it now: the record's own row of tracks, under a song.
 *
 * Justin's item 20, 15 Nov 2026: "Clicking that ought to change to that
 * page. It ought to only start playing that song if nothing is currently
 * playing." So the pane goes to the track's song page, and the music is
 * interrupted only when there is no music.
 */
export async function openTrack( cid ) {
	const layout = useLayoutStore();
	const pane = usePaneStore();
	const player = usePlayerStore();
	const songs = useSongStore();

	const page = await wiki.songPageOf( cid, null ).catch( () => null );
	if ( page ) {
		// Going somewhere yourself is the end of traverse mode, as every
		// other navigation in the pane is.
		layout.stopTraversing();
		pane.open( page );
	}
	if ( player.playing ) {
		return;
	}
	layout.openDock();
	try {
		await songs.playCid( cid, { play: true } );
	} catch ( err ) {
		console.warn( 'Could not play', cid, 'in the dock', err );
	}
}

/**
 * Listen next.
 *
 * Next means next: whatever the rabbithole lined up by itself stands
 * aside first, so the song a person asked for is the one that plays when
 * this one ends. It landed second, behind the quest's pick (re,
 * #rabbithole, 15 Nov 2026).
 */
export async function queueTrack( cid, button ) {
	const songs = useSongStore();
	if ( songs.queuedCids.includes( cid ) ) {
		flashButton( button, 'already queued' );
		return;
	}
	flashButton( button, 'queuing…' );
	usePickerStore().giveWay();
	// Queued next is how it connects to what is playing (Justin, 15 Nov
	// 2026): the walk says so, or the song would read as played cold and
	// close the rabbithole.
	useWalkStore().mark( cid, { why: 'next' } );
	try {
		await songs.queueCid( cid );
	} catch ( err ) {
		console.warn( 'Could not queue', cid, err );
		flashButton( button, 'could not load that track' );
		return;
	}
	const waiting = songs.queuedCids.length;
	flashButton( button, waiting === 1 ? 'queued — plays next' : 'queued — ' + waiting + ' waiting' );
}

/**
 * Find me a rabbithole from what is playing to a song, through the people
 * who played on both, and queue the songs along the way.
 *
 * @param {?string} target The song's page, e.g. "Song:Barlows".
 * @param {Function} say Called with each thing worth saying as it happens.
 * @return {?{hops: number, queued: number}} Null when there was no trail.
 */
export async function queueTrail( target, say = () => {} ) {
	const songs = useSongStore();
	const pane = usePaneStore();

	const from = songs.current && songs.current.title ? 'Song:' + songs.current.title : null;

	if ( ! from ) {
		say( 'nothing playing to start from' );
		return null;
	}
	if ( ! target || from === target ) {
		say( 'you are already here' );
		return null;
	}

	say( 'looking…' );
	const graph = await performerGraph();
	const hops = findTrail( graph, from, target );
	if ( ! hops ) {
		say( 'no way there from here' );
		return null;
	}

	pane.trail = { from, hops };

	// The trail is the way to the song you asked for: the rabbithole's own
	// pick stands aside so the first hop plays next.
	usePickerStore().giveWay();

	const walk = useWalkStore();
	const queued = [];
	for ( const [ i, song ] of trailSongs( from, hops ).slice( 1 ).entries() ) {
		const cid = await songCid( song );
		if ( ! cid || songs.queuedCids.includes( cid ) ) {
			continue;
		}
		// Each song on the trail is reached through the person its hop names.
		walk.mark( cid, { name: hops[ i ].via, instrument: hops[ i ].instrument || null, why: 'trail' } );
		try {
			if ( await songs.queueCid( cid ) ) {
				queued.push( song );
			}
		} catch ( err ) {
			console.warn( 'Could not queue', song, err );
		}
	}
	say( hops.length + ' hop' + ( hops.length === 1 ? '' : 's' ) + ', ' + queued.length + ' queued' );
	return { hops: hops.length, queued: queued.length };
}

/** The trail button on a song's page: a rabbithole to the page on screen. */
export async function trailToHere( button ) {
	const pane = usePaneStore();
	return queueTrail( pane.shownSongTitle, ( message ) => flashButton( button, message ) );
}

/**
 * "Chase to here" in the dialogue: a rabbithole from what is playing to the
 * track that was clicked, wherever its link was (Justin's item 15).
 */
export async function trailToTrack( cid, say = () => {} ) {
	const page = await wiki.songPageOf( cid, null ).catch( () => null );
	if ( ! page ) {
		say( 'no song page for that track to trail to' );
		return null;
	}
	return queueTrail( page, say );
}

/** What a Listen button's href asks for: {cid, action} or null. */
export function listenRequest( href ) {
	try {
		const url = new URL( href, window.location.origin );
		if ( ! url.pathname.includes( '/rabbithole/' ) ) {
			return null;
		}
		const cid = url.searchParams.get( 'track' );
		if ( ! cid ) {
			return null;
		}
		return { cid, action: url.searchParams.get( 'action' ) };
	} catch ( err ) {
		return null;
	}
}
