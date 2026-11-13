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
import { useWalkStore } from '../stores/walk.js';

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

/** Play this track in the dock, now. Opens the dock first, so a slow fetch happens in front of the player. */
export async function playTrackInDock( cid ) {
	const layout = useLayoutStore();
	const songs = useSongStore();
	layout.openDock();
	try {
		await songs.playCid( cid );
	} catch ( err ) {
		console.warn( 'Could not play', cid, 'in the dock', err );
	}
}

/** Listen next. */
export async function queueTrack( cid, button ) {
	const songs = useSongStore();
	if ( songs.queuedCids.includes( cid ) ) {
		flashButton( button, 'already queued' );
		return;
	}
	flashButton( button, 'queuing…' );
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
 * Find me a rabbithole from what is playing to the song on screen, through
 * the people who played on both, and queue the songs along the way.
 */
export async function trailToHere( button ) {
	const songs = useSongStore();
	const pane = usePaneStore();

	const target = pane.shownSongTitle;
	const from = songs.current && songs.current.title ? 'Song:' + songs.current.title : null;

	if ( ! from ) {
		flashButton( button, 'nothing playing to start from' );
		return;
	}
	if ( ! target || from === target ) {
		flashButton( button, 'you are already here' );
		return;
	}

	flashButton( button, 'looking…' );
	const graph = await performerGraph();
	const hops = findTrail( graph, from, target );
	if ( ! hops ) {
		flashButton( button, 'no way there from here' );
		return;
	}

	pane.trail = { from, hops };

	const walk = useWalkStore();
	const queued = [];
	for ( const [ i, song ] of trailSongs( from, hops ).slice( 1 ).entries() ) {
		const cid = await songCid( song );
		if ( ! cid || songs.queuedCids.includes( cid ) ) {
			continue;
		}
		// Each song on the trail is reached through the person its hop names.
		walk.mark( cid, { name: hops[ i ].via, instrument: hops[ i ].instrument || null } );
		try {
			if ( await songs.queueCid( cid ) ) {
				queued.push( song );
			}
		} catch ( err ) {
			console.warn( 'Could not queue', song, err );
		}
	}
	flashButton( button, hops.length + ' hop' + ( hops.length === 1 ? '' : 's' ) + ', ' + queued.length + ' queued' );
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
