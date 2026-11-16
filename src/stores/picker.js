/**
 * Who the rabbithole follows to the next song: the picker you chose, or
 * the one the song chose for you.
 *
 * One setting, two states (Justin, #rabbithole, 15 Nov 2026, items 27
 * and 28):
 *
 * - A *chase* is aimed at a picker you picked. Their songs play, one after
 *   another, until you stop. Justin, 7 Nov 2026: "It's not obvious how to
 *   follow a picker, nor what song will play next if I do." So the offer
 *   is made where you meet a picker, on their page, and it names the song
 *   before you take it.
 * - A *quest* is the rest of the time, which is most of it: every song
 *   hands you one of its own band, and that picker's next song is what
 *   plays when this one ends. A picker whose every song this rabbithole
 *   has already played is passed over, unless that is true of the whole
 *   band, when there is nowhere new to go and any of them will do.
 *
 * Either way one song is lined up behind what is playing, never more, so a
 * song that ends goes to the next song, no matter what (item 28). When
 * neither a chase nor a quest can name one -- a picker played out, a band
 * played out -- any charted track this rabbithole has not heard does.
 *
 * The songs come from the wiki's performer graph (Has performer), the same
 * one the rabbithole trail walks. What has played comes from the walk
 * (stores/walk.js): it is the record of this rabbithole, and it outlives a
 * refresh.
 */

import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';

import { recordsOn } from '../trail.js';
import { recordsOf } from '../wiki/api.js';
import { performerGraph, songCid } from '../wiki/queue.js';
import { useLayoutStore } from './layout.js';
import { usePlayerStore } from './player.js';
import { useSongStore } from './song.js';
import { useWalkStore } from './walk.js';

/** A page title as the graph spells a person: spaces, not underscores. */
export function personName( title ) {
	return title ? title.replace( /_/g, ' ' ).trim() : null;
}

/**
 * How the walk says a hop was made by following someone: who, what they
 * played on the song they led to, as the performer graph has it, and the
 * word for why the two songs connect.
 *
 * The word is the difference between a picker you chose and one a song
 * chose for you, which is what the walk's every line has to say (Justin,
 * 15 Nov 2026: "show _why_ it connected from one song to the next, every
 * single line"). Pure.
 *
 * @param {Object} graph The performer graph.
 * @param {string} song The song page led to.
 * @param {string} name Who was followed.
 * @param {string} why 'chase' or 'quest'.
 */
export function viaPicker( graph, song, name, why ) {
	const instruments = ( ( graph && graph.band && graph.band[ song ] ) || {} )[ name ] || [];
	return { name, instrument: instruments[ 0 ] || null, why };
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

/** One of them, at random: a quest is not a running order. */
export function anyOf( list ) {
	return list[ Math.floor( Math.random() * list.length ) ];
}

/**
 * Who this song hands you: one of its own band, not the one the song
 * before handed you, and not a picker whose every song this rabbithole
 * has already played -- unless that is true of the whole band, when the
 * rabbithole has nowhere new to go and any of them will do (Justin's item
 * 27, 15 Nov 2026).
 *
 * Pure: the band's names in, one name out.
 *
 * @param {string[]} names The band, as the chart names them.
 * @param {Object} [options]
 * @param {?string} [options.last] Who the song before handed you.
 * @param {Function} [options.unplayed] Has this picker a song still to play?
 * @param {Function} [options.choose] Which of the candidates; random by default.
 * @return {?string} The picker, or null when there is no band to ask.
 */
export function questPick( names, { last = null, unplayed = () => true, choose = anyOf } = {} ) {
	const others = names.filter( ( name ) => name !== last );
	// A band of one hands you the same picker again rather than nobody.
	const band = others.length ? others : names;
	const fresh = band.filter( unplayed );
	const from = fresh.length ? fresh : band;
	return from.length ? choose( from ) : null;
}

/**
 * Something to play after this one when nothing else can name it: a
 * charted track this rabbithole has not heard, else any other track at
 * all. The floor under item 28 -- "if you're listening to a song in
 * Rabbithole, and the song ends, it always, no matter what, needs to go
 * to the next song".
 *
 * Pure.
 *
 * @param {Array} tracks Every charted track: {cid, title, album}.
 * @param {Object} [options]
 * @param {?string} [options.currentCid] What is playing, which is not next.
 * @param {Set} [options.playedCids] What this rabbithole has played.
 * @param {Function} [options.choose] Which of the candidates; random by default.
 * @return {?Object} The track, or null when there is no other one.
 */
export function anotherTrack( tracks, { currentCid = null, playedCids = new Set(), choose = anyOf } = {} ) {
	const others = ( tracks || [] ).filter( ( t ) => t && t.cid && t.cid !== currentCid );
	const fresh = others.filter( ( t ) => ! playedCids.has( t.cid ) );
	const from = fresh.length ? fresh : others;
	return from.length ? choose( from ) : null;
}

export const usePickerStore = defineStore( 'picker', () => {
	const player = usePlayerStore();
	const songs = useSongStore();
	const walk = useWalkStore();

	/** 'chase' once you have chosen a picker, 'quest' the rest of the time. */
	const mode = ref( 'quest' );
	/** Who is being followed to the next song: your pick, or the song's. */
	const following = ref( null );
	/** What following them has queued: {song, cid}, or null. */
	const next = ref( null );
	/**
	 * The recording the rabbithole queued on its own account, by CID: a
	 * chase's next song, a quest's pick, or the charted track the floor
	 * reached for. One field, because what matters about all three is the
	 * same thing -- it is ours, so it is ours to withdraw when a person
	 * asks for a song by hand (re, #rabbithole, 15 Nov 2026: the floor's
	 * pick was not recorded, and Play next landed behind it).
	 */
	const ours = ref( null );
	/**
	 * What following the picker on screen would play next:
	 * {name, next: {song, cid} | null}, or null when the page is not a picker's.
	 */
	const offer = ref( null );

	/**
	 * Every recording this rabbithole has played, by CID. The walk is the
	 * one record of that, so there is no second list to keep: it already
	 * holds every recording that has been on, the first one too, and it
	 * survives a refresh.
	 */
	const playedCids = computed( () => new Set( walk.hops.map( ( hop ) => hop.cid ) ) );

	const currentCid = () => ( songs.current && songs.current._trackCid ) || null;

	async function nextFor( name ) {
		const graph = await performerGraph();
		return firstPlayable( graph.plays[ name ] || [], {
			currentCid: currentCid(), playedCids: playedCids.value, queuedCids: songs.queuedCids, cidOf: songCid,
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
		// Being chased, their page says so and offers to stop. Handed to you
		// by a quest, it still offers the chase, which is a different thing:
		// a quest moves on at the end of the song, a chase does not.
		if ( mode.value === 'chase' && following.value === name ) {
			offer.value = { name, next: next.value };
			return;
		}
		const n = await nextFor( name );
		if ( mine === asked ) {
			offer.value = { name, next: n };
		}
	}

	/**
	 * Queue a recording on the rabbithole's own account. Everything the
	 * app lines up goes through here, so there is one place that knows
	 * what is ours and one place that records it.
	 */
	async function queueOurs( cid ) {
		if ( await songs.queueCid( cid ) ) {
			ours.value = cid;
			return true;
		}
		return false;
	}

	/** Line up the followed picker's next song, and remember it. */
	async function queueNext() {
		const name = following.value;
		next.value = await nextFor( name );
		if ( next.value ) {
			// Marked before it is queued, so however soon it starts, the
			// walk knows it came by following this picker.
			walk.mark( next.value.cid, viaPicker( await performerGraph(), next.value.song, name, mode.value ) );
			await queueOurs( next.value.cid );
		}
		if ( offer.value && offer.value.name === following.value ) {
			offer.value = { name: following.value, next: next.value };
		}
	}

	let questing = 0;
	/**
	 * This song's turn to choose: one of its band, and their next song
	 * behind this one. Asked again for every song, so the picker changes
	 * as the songs do.
	 */
	async function quest() {
		const mine = ++questing;
		const band = player.cards.map( ( card ) => card.name );
		const graph = await performerGraph();
		// Only a picker the graph knows has anywhere to lead.
		const known = band.filter( ( name ) => ( graph.plays[ name ] || [] ).length );
		const nexts = new Map();
		for ( const name of known ) {
			nexts.set( name, await nextFor( name ) );
		}
		if ( mine !== questing || mode.value !== 'quest' ) {
			return;
		}
		const name = questPick( known, {
			last: following.value,
			unplayed: ( who ) => !! nexts.get( who ),
		} );
		following.value = name;
		next.value = null;
		const theirs = name ? nexts.get( name ) : null;
		// One song behind this one, never more: a record playing through, or
		// a trail queued to here, is already the answer to what comes next.
		if ( theirs && ! songs.queuedCids.length ) {
			walk.mark( theirs.cid, viaPicker( graph, theirs.song, name, 'quest' ) );
			if ( await queueOurs( theirs.cid ) ) {
				next.value = theirs;
			}
		}
	}

	/**
	 * Standing behind the end of the walk: the song lined up is the walk's
	 * own next one, so the rabbithole plays on through itself whether the
	 * next button asks for it or this song simply ends.
	 *
	 * Without it only the button replayed the walk: a song that ended
	 * where you stood played whatever the quest had lined up, and that
	 * song joined the walk after the hop you had walked back from -- a
	 * step nobody took (re, #rabbithole, 16 Nov 2026).
	 *
	 * @return {Promise<boolean>} Whether the walk is what comes next.
	 */
	async function queueTheWalk() {
		const hops = walk.hops;
		const ahead = walk.at >= 0 && walk.at < hops.length - 1 ? hops[ walk.at + 1 ] : null;
		if ( ! ahead ) {
			return false;
		}
		// The picker on the cards is the one the walk followed here.
		if ( mode.value !== 'chase' ) {
			following.value = ahead.via && ahead.via.name ? ahead.via.name : null;
			next.value = { song: ahead.song, cid: ahead.cid };
		}
		if ( songs.queuedCids.includes( ahead.cid ) ) {
			return true;
		}
		giveWay();
		walk.mark( ahead.cid, { step: walk.at + 1 } );
		await queueOurs( ahead.cid );
		return true;
	}

	/**
	 * What the rabbithole lined up by itself gets out of the way: a person
	 * asking for a song by hand means that song, next (item 15). A chase
	 * or a quest lines another up when the next song starts, so nothing is
	 * lost by standing aside, and what the person queued is untouched (re,
	 * #rabbithole, 15 Nov 2026: stopping a chase used to take the whole
	 * queue with it).
	 */
	function giveWay() {
		if ( ours.value && player.model ) {
			player.model.dropFromQueue( ours.value );
		}
		if ( next.value && next.value.cid === ours.value ) {
			next.value = null;
		}
		ours.value = null;
	}

	/**
	 * Nothing lined up behind what is playing: put something there, so the
	 * song that ends goes to the next song (item 28). The rest of the
	 * record, where one is playing through, is already that.
	 *
	 * The charted list is waited for rather than read where it stands: on
	 * a visit from a Listen link it arrives a moment after the song does,
	 * and a floor that read it too early found nothing and left the song
	 * to end in silence (re, 15 Nov 2026).
	 */
	async function lineUpSomething() {
		if ( songs.queuedCids.length || songs.recordRest.length ) {
			return;
		}
		const track = anotherTrack( await songs.chartedList(), {
			currentCid: currentCid(), playedCids: playedCids.value,
		} );
		if ( track && ! songs.queuedCids.length ) {
			// It says what it is. A hop with no word is a song played cold,
			// which closes the rabbithole and starts another -- and the
			// rabbithole reaching for a song itself is the opposite of
			// that: it is the rabbithole carrying on when nobody on this
			// song has anywhere left to lead (Justin, #rabbithole, 15 Nov
			// 2026: "I just clicked 'next' on Cicada Song and it started a
			// new rabbithole instead of questing through a picker").
			walk.mark( track.cid, { why: 'wander' } );
			await queueOurs( track.cid );
		}
	}

	/**
	 * Play a recording this rabbithole has already been to, standing where
	 * it stands in the walk: a step along the chain, not a new one.
	 *
	 * Justin, 15 Nov 2026, item 40: "it needs to go back _in the
	 * rabbithole_ to that song and play through the rabbithole the same
	 * way that it had been playing, unless I make a change to the picker
	 * or quest/chase mode." So the mode and the chased picker are left as
	 * they are, and the walk is told which hop this is rather than being
	 * given a new one -- a step back that wrote its own hop left the next
	 * step back on the song just left (re, 16 Nov 2026).
	 *
	 * @param {string} cid The recording.
	 * @param {?number} step Its place in the walk, where the caller knows
	 *   it (the graph sends one); else it is looked up.
	 * @return {Promise<boolean>} Whether anything was played.
	 */
	async function playHop( cid, step = null ) {
		if ( ! cid ) {
			return false;
		}
		const hops = walk.hops;
		const named = typeof step === 'number' && hops[ step ] && hops[ step ].cid === cid;
		const index = named ? step : hops.findIndex( ( hop ) => hop.cid === cid );
		// What the rabbithole lined up for later stands aside: the song
		// asked for is the one that plays.
		giveWay();
		// Not in this walk at all: it is a song played cold, and the walk
		// store will read it as the start of another, which is what it is.
		walk.mark( cid, index < 0 ? null : { step: index } );
		try {
			await songs.playCid( cid, { play: true } );
		} catch ( err ) {
			console.warn( 'Could not play', cid, err );
			return false;
		}
		return true;
	}

	/**
	 * The next song of this rabbithole, now: what is lined up, and if
	 * nothing is, whatever the chase, the quest or the floor can name.
	 *
	 * This is what Webamp's next button means here. Webamp's own next
	 * walks its playlist, which at the end of a record wrapped round to
	 * the first track and played it cold -- a song with no word, so the
	 * rabbithole closed and another began (Justin, 15 Nov 2026). And it
	 * plays, whatever the player was doing: next on a stopped player that
	 * loads a song in silence is a button that does nothing (item 39).
	 *
	 * @return {Promise<boolean>} Whether there was a next song.
	 */
	async function forward() {
		const hops = walk.hops;
		// Standing behind the end of the walk, forward is the walk's own
		// next song, the way a browser's forward button is: you go back
		// and "play through the rabbithole the same way that it had been
		// playing" (item 40). At the end it extends the walk instead.
		if ( walk.at >= 0 && walk.at < hops.length - 1 ) {
			useLayoutStore().startTraversing();
			return playHop( hops[ walk.at + 1 ].cid, walk.at + 1 );
		}
		if ( ! songs.queuedCids.length ) {
			if ( mode.value === 'chase' && following.value ) {
				await queueNext();
			} else {
				await quest();
			}
			await lineUpSomething();
		}
		if ( ! player.model ) {
			return false;
		}
		// Stepping on is listening (Justin's item 32).
		useLayoutStore().startTraversing();
		return player.model.playNext();
	}

	/**
	 * Back a step: the recording before this one in this rabbithole,
	 * played on. Webamp's previous button, which used to reload the
	 * current track or stall (item 37).
	 *
	 * @return {Promise<boolean>} Whether there was one behind this.
	 */
	async function back() {
		const hops = walk.hops;
		const here = walk.at;
		if ( here > 0 && hops[ here - 1 ] ) {
			return playHop( hops[ here - 1 ].cid, here - 1 );
		}
		return false;
	}

	/*
	 * A chase starts the picker's next song at once when nothing is
	 * playing. Queued behind a song that had already ended, it waited for
	 * an end that had come and gone: "Following Jake Stargel. Plays next:
	 * Barlow's Jig", and then nothing (Justin, 11 Nov 2026). A paused song
	 * is still the song you're on, so a chase waits for it.
	 */
	async function chase( name ) {
		// Chasing somebody is "their songs next": the quest's own pick
		// stands aside, and anything the person queued stays put.
		giveWay();
		mode.value = 'chase';
		following.value = name;
		await queueNext();
		if ( next.value && player.status === 'STOPPED' ) {
			player.model.playNext();
		}
	}

	/** Stop chasing: the songs choose again, starting with this one. */
	function stop() {
		giveWay();
		mode.value = 'quest';
		following.value = null;
		return quest().then( lineUpSomething );
	}

	/*
	 * A recording started. A chase lines up the chased picker's next song
	 * as soon as the one it queued begins, so the queue shows what plays
	 * next and nothing piles up. A quest hands this song's band to the
	 * next song. Either way something is behind it by the time it ends.
	 */
	watch( () => player.song && player.song._trackCid, async ( cid ) => {
		if ( ! cid ) {
			return;
		}
		if ( cid === ours.value ) {
			ours.value = null;
		}
		if ( await queueTheWalk() ) {
			return;
		}
		if ( mode.value === 'chase' ) {
			// One song ahead and no more: the chase lines up another when
			// the one it queued starts, or when it has none -- which is
			// where a Play next left it, having asked the chase to stand
			// aside.
			if ( following.value && ( ! next.value || cid === next.value.cid ) ) {
				await queueNext();
			}
		} else {
			await quest();
		}
		await lineUpSomething();
	}, { immediate: true } );

	return { mode, following, next, ours, offer, look, chase, stop, giveWay, forward, back, playHop };
} );
