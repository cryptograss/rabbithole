/**
 * The player: Webamp, wrapped as a model the components render from.
 *
 * One source of truth for what is playing. Webamp's own Redux store holds
 * the audio's status, position and playlist; this subscribes to it and
 * mirrors what the app needs into a reactive `state`, then derives the
 * chart from (song, time) alone: the arrangement in force, the part, the
 * cards and their order. Nothing here draws. The dock component gives it a
 * container to render Webamp into, and that is the only DOM it touches.
 *
 * What used to be timers is now a consequence of state: the chart follows
 * Webamp's current track because the store says which track that is; a
 * song loaded without a play request is paused the first time Webamp
 * reports it playing; pausing freezes the cards because nothing renders
 * from "status changed". Effects (a flourish, a spotlight) were the last
 * place a duration was a timer; they are spans of the song now, in force
 * while the playhead is inside them (timeline.js effectsAt), so they
 * follow a seek and hold through a pause like everything else here.
 *
 * One timer is left, and it is an alarm clock rather than a stopwatch:
 * while the song plays, the model wakes at the chart's next marker to
 * read the time there (_wakeAtNextMarker).
 *
 * The editor (src/editor/TimelineEditor.js) reads this through the names
 * it always has: trackData, webamp, getDuration, isPlaying,
 * getCurrentTime, onTimeUpdate, updateTimeline, updateEnsembleDisplay.
 */

import { reactive, computed, markRaw, toRaw } from 'vue';

import webampClass from './webamp-global.js';
import { webAudioBypassed } from './web-audio.js';
import { followVolume } from './ios-web-audio.js';
import * as timeline from './timeline.js';

/**
 * Two songs are the same recording when they share a track CID, or, with
 * no CID, the same audio URL. The URL alone isn't enough: the same CID can
 * resolve to another encoding's file.
 */
export function sameRecording( a, b ) {
	if ( a._trackCid && b._trackCid ) {
		return a._trackCid === b._trackCid;
	}
	return a.audioFile === b.audioFile;
}

export class WebampPlayer {
	/**
	 * @param {Object} song The track to show first.
	 */
	constructor( song ) {
		this.webamp = null;
		this.container = null;
		/**
		 * What to do when Webamp's next or previous button is pressed:
		 * called with 'next' or 'previous'. Null until something sets it,
		 * in which case the buttons do what Webamp does with them.
		 */
		this.onStep = null;
		this.songsByUrl = new Map();

		this.state = reactive( {
			status: 'STOPPED',
			time: 0,
			duration: 0,
			volume: 75,
			song: null,
			upNext: [],
			// Webamp's main window rolled up to its strip (its own button, or the bar collapsing): the dock's box
			// shrinks to it, and what stands under Webamp moves up (Justin, #connectome, 21 Nov 2026, 23:27Z).
			shaded: false,
			currentSolo: null,
			ready: false,
			error: null,
		} );

		const s = this.state;
		this.processed = computed( () => timeline.processTimeline( s.song ) );
		this.parts = computed( () => timeline.songParts( this.processed.value ) );
		this.partTimes = computed( () => timeline.songPartTimes( this.processed.value ) );
		this.partIndex = computed( () => timeline.currentPartIndex( this.processed.value, s.time ) );
		this.arrangement = computed( () => timeline.currentArrangement( this.processed.value, s.time ) );
		this.cards = computed( () => timeline.cards( s.song, this.processed.value, s.time ) );
		this.effects = computed( () => timeline.effectsAt( s.song, this.processed.value, s.time ) );

		this._timeUpdateCallback = null;
		this._lastArrangement = undefined;
		this._pauseOnNextPlay = false;
		this._unsubscribe = null;
		this._wake = null;

		this.showSong( song );
	}

	/** The editor's name for the current song. Reactive: an edit shows at once. */
	get trackData() {
		return this.state.song;
	}

	set trackData( song ) {
		this.showSong( song );
	}

	/* ------------------------------------------------------------------ */
	/* Webamp                                                               */
	/* ------------------------------------------------------------------ */

	/**
	 * Build Webamp into a container. Resolves when its window exists there.
	 *
	 * Webamp renders synchronously once its skin has loaded and the promise
	 * resolves after that render, so when it does, #webamp exists; it is
	 * appended to the end of <body>, and moved here into the container in
	 * the same task, before a frame is painted. Where the window sits inside
	 * the container is a stylesheet rule (app.css), so a drag, zoom or
	 * rotation has nothing to put back.
	 */
	async mount( container ) {
		this.container = container;
		// Everything that can fail to produce a player is inside one try:
		// the bundle missing (webampClass throws), the constructor, and the
		// render. Any of them lands in state.error, which the dock shows;
		// the alternative is "Loading player..." forever, which is how the
		// jsDelivr failure of October 2026 went unseen.
		try {
			const Webamp = webampClass();
			this.webamp = markRaw( new Webamp( {
				zindex: 9999,
				windowLayout: {
					main: { position: { top: 0, left: 0 }, shadeMode: false, closed: false },
					equalizer: { closed: true },
					playlist: { closed: true },
				},
				initialTracks: [ this._webampTrack( this.state.song ) ],
				enableHotkeys: true,
				volume: this.state.volume,
			} ) );
			await this.webamp.renderWhenReady( container );
		} catch ( err ) {
			console.error( 'Webamp initialization failed:', err );
			this.webamp = null;
			this.state.error = err.message;
			return;
		}

		const node = document.getElementById( 'webamp' );
		if ( node && node.parentNode !== container ) {
			container.appendChild( node );
		}
		// Webamp turns a wheel over its window into volume, so scrolling the
		// page past the player changed the volume instead (Justin, 11 Nov
		// 2026). The wheel is the page's: it is stopped here, on the way
		// down, before Webamp's own listener sees it.
		container.addEventListener( 'wheel', ( e ) => e.stopPropagation(), { capture: true, passive: true } );

		// Next and previous belong to the rabbithole, not to Webamp's
		// playlist. Webamp's own next wrapped round to the first track at
		// the end of a record and played it cold, which closed the
		// rabbithole and began another, and its previous reloaded the track
		// it was on (Justin, #rabbithole, 15 Nov 2026, items 37 and 38).
		// The buttons are Webamp's own DOM, so the click is taken on the
		// way down, before its handler sees it, and handed to whoever set
		// `onStep` -- here, the picker store, which knows what the next
		// song of this rabbithole is and what the last one was.
		for ( const kind of [ 'mousedown', 'click' ] ) {
			container.addEventListener( kind, ( e ) => {
				const button = e.target && e.target.closest && e.target.closest( '#next, #previous' );
				if ( ! button || ! this.onStep ) {
					return;
				}
				e.preventDefault();
				e.stopPropagation();
				if ( kind === 'click' ) {
					this.onStep( button.id === 'next' ? 'next' : 'previous' );
				}
			}, { capture: true } );
		}

		// With the Web Audio graph bypassed the volume slider drives a gain
		// node downstream of nothing; point it at the element instead.
		if ( webAudioBypassed ) {
			const media = this.webamp.media;
			if ( followVolume( media ) ) {
				media.setVolume( this.webamp.store.getState().media.volume );
			} else {
				console.warn( 'Web Audio bypassed, but the volume slider could not be rewired' );
			}
		}

		this.webamp.onWillClose( () => this.destroy() );
		this._unsubscribe = this.webamp.store.subscribe( () => this._onStoreChange() );
		this._onStoreChange();
		this.state.ready = true;
	}

	/** Everything the app mirrors from Webamp's store, on every change of it. */
	_onStoreChange() {
		if ( ! this.webamp ) {
			return;
		}
		const wa = this.webamp.store.getState();
		const status = wa.media.status;

		if ( status === 'PLAYING' && this._pauseOnNextPlay ) {
			// A song was loaded, not played: setTracksToPlay starts the audio
			// as soon as it loads, and loading is not a request to hear it.
			this._pauseOnNextPlay = false;
			this.webamp.pause();
			return;
		}
		this.state.status = status;
		this.state.volume = wa.media.volume;
		const main = wa.windows && wa.windows.genWindows && wa.windows.genWindows.main;
		this.state.shaded = !! ( main && main.shade );

		this._followTrack( wa );

		const t = this._now( wa );
		if ( t !== this.state.time || this._lastArrangement === undefined ) {
			this._tick( t );
		}
		this._wakeAtNextMarker();

		this.state.duration = this._durationFrom( wa );

		const next = this.upNext( wa );
		if ( next.length !== this.state.upNext.length || next.some( ( s, i ) => s !== toRaw( this.state.upNext[ i ] ) ) ) {
			this.state.upNext = next;
		}
	}

	/**
	 * Where the playhead is, in seconds.
	 *
	 * The audio's own clock, which is right whenever it is asked. Webamp's
	 * store only hears the time when the browser reports it, about four
	 * times a second, so a time read from the store is up to a quarter of
	 * a second old. Without a media object to ask (a stand-in for Webamp,
	 * in the tests), the store's is what there is.
	 */
	_now( wa ) {
		const media = this.webamp && this.webamp.media;
		const asked = media && typeof media.timeElapsed === 'function' ? media.timeElapsed() : NaN;
		return isFinite( asked ) ? asked : ( wa.media.timeElapsed || 0 );
	}

	/**
	 * While the song plays, wake when the playhead reaches the chart's
	 * next marker, and read the time there.
	 *
	 * The cards and the effects are right about any time they are given;
	 * what they were given was the time as of the browser's last report,
	 * which comes about four times a second whatever the music is doing.
	 * So a break lit its card, and a band flash landed, anywhere up to a
	 * quarter of a second after the note -- a different amount each time,
	 * which is what "wonky" is (Justin, #visual-effects, 15 Nov 2026). The
	 * chart says when its next marker is, so the model is awake for it.
	 *
	 * Waking early is harmless (the time read is before the marker,
	 * nothing changes, and this is set again for what is left), and so is
	 * a song that has stalled: the clock is asked, never assumed.
	 */
	_wakeAtNextMarker() {
		clearTimeout( this._wake );
		this._wake = null;
		if ( this.state.status !== 'PLAYING' ) {
			return;
		}
		const next = timeline.nextMarker( this.processed.value, this.state.time );
		if ( next === null ) {
			return;
		}
		this._wake = setTimeout( () => {
			this._wake = null;
			this._onStoreChange();
		}, Math.max( 0, next - this.state.time ) * 1000 + 4 );
	}

	/** The playhead moved: the chart's one input. */
	_tick( time ) {
		this.state.time = time;
		const arrangement = this.arrangement.value;
		this.state.currentSolo = timeline.soloistOf( arrangement );
		this._lastArrangement = arrangement;

		if ( this._timeUpdateCallback ) {
			this._timeUpdateCallback( time, arrangement );
		}
	}

	/** The track Webamp wants, as Webamp's own playlist wants it. */
	_webampTrack( song ) {
		return {
			url: song.audioFile,
			defaultName: song.title,
			// Given rather than fetched: with metadata, Webamp does not read
			// ID3 tags out of the file, which on IPFS meant a second fetch of
			// the audio and the "Cannot cancel a locked stream" noise.
			metaData: { artist: song.artist || '', title: song.title || '', album: song.albumTitle || '' },
		};
	}

	_songForTrack( wa, id ) {
		if ( id === null || id === undefined ) {
			return null;
		}
		const track = wa.tracks && wa.tracks[ id ];
		return ( track && this.songsByUrl.get( track.url ) ) || null;
	}

	/** The chart follows Webamp's current track: when a song ends, the next is Webamp's. */
	_followTrack( wa ) {
		const song = this._songForTrack( wa, wa.playlist && wa.playlist.currentTrack );
		if ( ! song || ! this.state.song || song.audioFile === this.state.song.audioFile ) {
			return;
		}
		this.showSong( song );
	}

	_durationFrom( wa ) {
		// The length lives on the track, not on `media`, which carries no
		// length at all; Webamp fills in tracks[id].duration once the audio
		// reports it.
		const tracks = wa.tracks || {};
		const order = ( wa.playlist && wa.playlist.trackOrder ) || [];
		const current = wa.playlist && wa.playlist.currentTrack;
		const id = current !== undefined && current !== null ? current : order[ 0 ];
		const track = tracks[ id ] || tracks[ order[ 0 ] ];
		return track && isFinite( track.duration ) && track.duration > 0 ? track.duration : 0;
	}

	/* ------------------------------------------------------------------ */
	/* Songs and the queue                                                  */
	/* ------------------------------------------------------------------ */

	/**
	 * Show a song: its chart, its cards, its parts. Audio is not touched.
	 * Called by loadSong when a person picks one, and by _followTrack when
	 * Webamp has moved on to the next track by itself.
	 */
	showSong( song ) {
		if ( ! song ) {
			return;
		}
		const raw = toRaw( song );
		this.songsByUrl.set( raw.audioFile, raw );
		this.state.song = raw;
		this.state.currentSolo = null;
		this._lastArrangement = undefined;
		if ( this.webamp ) {
			this._onStoreChange();
		}
	}

	/**
	 * A person chose this song: show it, and make it what Webamp plays.
	 * This replaces the playlist, queue and all: picking a song is "play
	 * this instead". Choosing a song loads it; it starts only if something
	 * was already playing (Skyler, 25 Oct 2026) -- or if the caller asks
	 * for it, which is what a button saying Listen, or Play now, means
	 * (Justin's items 14 and 15, 15 Nov 2026).
	 *
	 * @param {Object} song
	 * @param {Object} [options]
	 * @param {boolean} [options.play] Start it whatever was happening before.
	 */
	loadSong( song, { play = false } = {} ) {
		this.showSong( song );
		if ( ! this.webamp ) {
			return;
		}
		const wasPlaying = this.webamp.getMediaStatus() === 'PLAYING';
		this.webamp.stop();
		this.webamp.setTracksToPlay( [ this._webampTrack( toRaw( song ) ) ] );
		this._pauseOnNextPlay = ! ( play || wasPlaying );
	}

	/**
	 * Put a song at the end of Webamp's playlist. It plays when whatever is
	 * before it has finished, because that is what a playlist does. A song
	 * already ahead stays where it is; this says so by returning false.
	 */
	enqueue( song ) {
		const raw = toRaw( song );
		this.songsByUrl.set( raw.audioFile, raw );
		if ( ! this.webamp ) {
			return false;
		}
		if ( this.upNext().some( ( s ) => sameRecording( s, raw ) ) ) {
			return false;
		}
		this.webamp.appendTracks( [ this._webampTrack( raw ) ] );
		return true;
	}

	/**
	 * Take one recording out of the queue, if it is waiting behind the
	 * current track.
	 *
	 * What the rabbithole lines up by itself -- a quest's pick, a chase's
	 * next song -- gets out of the way of a song a person asks for by
	 * hand, so Play next means next (Justin's item 15). It used to take
	 * the whole queue, which threw away songs the person had queued
	 * themselves (re, #rabbithole, 15 Nov 2026). Webamp's own playlist is
	 * the queue, so this is its own REMOVE_TRACKS, the way the shade
	 * toggle is.
	 *
	 * @param {?string} cid The recording to take out.
	 * @return {Array} The playlist ids removed.
	 */
	dropFromQueue( cid ) {
		if ( ! this.webamp || ! cid ) {
			return [];
		}
		const wa = this.webamp.store.getState();
		const order = ( wa.playlist && wa.playlist.trackOrder ) || [];
		const at = order.indexOf( wa.playlist && wa.playlist.currentTrack );
		const ids = ( at < 0 ? [] : order.slice( at + 1 ) ).filter( ( id ) => {
			const song = this._songForTrack( wa, id );
			return song && song._trackCid === cid;
		} );
		if ( ids.length ) {
			this.webamp.store.dispatch( { type: 'REMOVE_TRACKS', ids } );
		}
		return ids;
	}

	/**
	 * Skip to the next song in the queue and play it. False when nothing
	 * is queued.
	 */
	playNext() {
		if ( ! this.webamp || ! this.upNext().length ) {
			return false;
		}
		this._pauseOnNextPlay = false;
		this.webamp.nextTrack();
		this.webamp.play();
		return true;
	}

	/** The songs after the current track, in the order they will play. */
	upNext( wa ) {
		if ( ! wa ) {
			if ( ! this.webamp ) {
				return [];
			}
			wa = this.webamp.store.getState();
		}
		const order = ( wa.playlist && wa.playlist.trackOrder ) || [];
		const current = wa.playlist && wa.playlist.currentTrack;
		const at = order.indexOf( current );
		return order.slice( at + 1 ).map( ( id ) => this._songForTrack( wa, id ) ).filter( Boolean );
	}

	/* ------------------------------------------------------------------ */
	/* Transport                                                            */
	/* ------------------------------------------------------------------ */

	play() {
		this._pauseOnNextPlay = false;
		if ( this.webamp ) {
			this.webamp.play();
		}
	}

	pause() {
		if ( this.webamp ) {
			this.webamp.pause();
		}
	}

	togglePlay() {
		if ( this.isPlaying() ) {
			this.pause();
		} else {
			this.play();
		}
	}

	seekToTime( seconds ) {
		if ( this.webamp ) {
			this.webamp.seekToTime( Math.max( 0, seconds ) );
		}
	}

	/**
	 * Jump to a part by its index in the strip. Nudged past the boundary:
	 * seeking exactly onto a part's start lands on the frame before the
	 * arrangement changes often enough to look like the click did nothing.
	 */
	seekToPart( index ) {
		const time = this.partTimes.value[ index ];
		if ( time === undefined || ! this.webamp ) {
			return false;
		}
		this.seekToTime( time + 0.05 );
		return true;
	}

	/** Shade or unshade Webamp's main window, to match the collapsed bar. */
	setShaded( shaded ) {
		if ( ! this.webamp ) {
			return;
		}
		const store = this.webamp.store;
		const isShaded = store.getState().windows.genWindows.main.shade;
		if ( shaded !== isShaded ) {
			store.dispatch( { type: 'TOGGLE_WINDOW_SHADE_MODE', windowId: 'main' } );
		}
	}

	getDuration() {
		return this.state.duration;
	}

	getCurrentTime() {
		return this.state.time;
	}

	isPlaying() {
		return this.state.status === 'PLAYING';
	}

	/* ------------------------------------------------------------------ */
	/* The editor's hooks                                                   */
	/* ------------------------------------------------------------------ */

	/** Called with (time, arrangement) on every tick. One listener: the editor. */
	onTimeUpdate( callback ) {
		this._timeUpdateCallback = callback;
	}

	/**
	 * Hot-swap the timeline without reloading the audio: the editor's
	 * instant preview.
	 *
	 * The player keeps its own copy of the chart. The editor hands over
	 * the same object every time -- its working timeline, edited in place
	 * -- and assigning a property the value it already holds changes
	 * nothing, so everything drawn from it (the parts strip under the
	 * player, the cards) stayed on the first edit and ignored the rest.
	 * Skyler, 15 Nov 2026: new parts were not showing under the player.
	 */
	updateTimeline( newTimeline ) {
		if ( ! this.state.song ) {
			return;
		}
		this.state.song.timeline = { ...newTimeline };
		const time = this.state.time;
		this._lastArrangement = this.arrangement.value;
		this.state.currentSolo = timeline.soloistOf( this._lastArrangement );
		if ( this._timeUpdateCallback ) {
			this._timeUpdateCallback( time, this._lastArrangement );
		}
	}

	/** Kept for the editor; the cards already follow the data. */
	updateEnsembleDisplay() {}

	destroy() {
		if ( this._unsubscribe ) {
			this._unsubscribe();
			this._unsubscribe = null;
		}
		clearTimeout( this._wake );
		this._wake = null;
		this._timeUpdateCallback = null;
	}
}
