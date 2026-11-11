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
 * from "status changed". Effects (a flourish, a spotlight) are the one
 * place a duration is still a duration.
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

// How long any one highlight may hold, in seconds. The timelines ask for
// more in places (Paint Exchange: 8.5s of spotlight, 7s of flourish) and at
// that length an effect stops reading as emphasis and starts reading as a
// bug.
export const SPOTLIGHT_MAX_SECONDS = 4;

let effectIds = 0;

export class WebampPlayer {
	/**
	 * @param {Object} song The track to show first.
	 */
	constructor( song ) {
		this.webamp = null;
		this.container = null;
		this.songsByUrl = new Map();

		this.state = reactive( {
			status: 'STOPPED',
			time: 0,
			duration: 0,
			volume: 75,
			song: null,
			upNext: [],
			currentSolo: null,
			recentSoloists: [],
			effects: [],
			ready: false,
			error: null,
		} );

		const s = this.state;
		this.processed = computed( () => timeline.processTimeline( s.song ) );
		this.parts = computed( () => timeline.songParts( this.processed.value ) );
		this.partTimes = computed( () => timeline.songPartTimes( this.processed.value ) );
		this.partIndex = computed( () => timeline.currentPartIndex( this.processed.value, s.time ) );
		this.arrangement = computed( () => timeline.currentArrangement( this.processed.value, s.time ) );
		this.cards = computed( () => timeline.cards( s.song, this.processed.value, s.time, {
			currentSolo: s.currentSolo, recentSoloists: s.recentSoloists,
		} ) );

		this._timeUpdateCallback = null;
		this._lastArrangement = undefined;
		this._upcomingMoments = [];
		this._pauseOnNextPlay = false;
		this._effectTimers = new Set();
		this._unsubscribe = null;

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
		container.style.position = 'relative';
		// Webamp turns a wheel over its window into volume, so scrolling the
		// page past the player changed the volume instead (Justin, 11 Nov
		// 2026). The wheel is the page's: it is stopped here, on the way
		// down, before Webamp's own listener sees it.
		container.addEventListener( 'wheel', ( e ) => e.stopPropagation(), { capture: true, passive: true } );

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

		this._followTrack( wa );

		const t = wa.media.timeElapsed || 0;
		if ( t !== this.state.time || this._lastArrangement === undefined ) {
			this._tick( t );
		}

		this.state.duration = this._durationFrom( wa );

		const next = this.upNext( wa );
		if ( next.length !== this.state.upNext.length || next.some( ( s, i ) => s !== toRaw( this.state.upNext[ i ] ) ) ) {
			this.state.upNext = next;
		}
	}

	/** The playhead moved: the chart's one input, and what the effects key off. */
	_tick( time ) {
		this.state.time = time;
		const arrangement = this.arrangement.value;
		const solo = timeline.soloistOf( arrangement );

		if ( solo !== this.state.currentSolo ) {
			if ( this.state.currentSolo ) {
				this._addRecentSoloist( this.state.currentSolo );
			}
			this.state.currentSolo = solo;
		}

		if ( arrangement !== this._lastArrangement ) {
			this._lastArrangement = arrangement;
			this._effectsFor( arrangement );
		}

		this._checkMoments( time );

		if ( this._timeUpdateCallback ) {
			this._timeUpdateCallback( time, arrangement );
		}
	}

	_addRecentSoloist( name ) {
		const list = this.state.recentSoloists.filter( ( n ) => n !== name );
		list.unshift( name );
		this.state.recentSoloists = list.slice( 0, 3 );
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
		this.state.recentSoloists = [];
		this.state.effects = [];
		this._lastArrangement = undefined;
		this._upcomingMoments = timeline.momentTimes( raw.timeline );
		if ( this.webamp ) {
			this._onStoreChange();
		}
	}

	/**
	 * A person chose this song: show it, and make it what Webamp plays.
	 * This replaces the playlist, queue and all: picking a song is "play
	 * this instead". Choosing a song loads it; it starts only if something
	 * was already playing (Skyler, 25 Oct 2026).
	 */
	loadSong( song ) {
		this.showSong( song );
		if ( ! this.webamp ) {
			return;
		}
		const wasPlaying = this.webamp.getMediaStatus() === 'PLAYING';
		this.webamp.stop();
		this.webamp.setTracksToPlay( [ this._webampTrack( toRaw( song ) ) ] );
		this._pauseOnNextPlay = ! wasPlaying;
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
	 * instant preview. Moments already passed do not fire again; effects
	 * are not fired for an edit.
	 */
	updateTimeline( newTimeline ) {
		if ( ! this.state.song ) {
			return;
		}
		this.state.song.timeline = newTimeline;
		const time = this.state.time;
		this._upcomingMoments = timeline.momentTimes( newTimeline ).filter( ( t ) => t > time );
		this._lastArrangement = this.arrangement.value;
		this.state.currentSolo = timeline.soloistOf( this._lastArrangement );
		if ( this._timeUpdateCallback ) {
			this._timeUpdateCallback( time, this._lastArrangement );
		}
	}

	/** Kept for the editor; the cards already follow the data. */
	updateEnsembleDisplay() {}

	/* ------------------------------------------------------------------ */
	/* Effects: the one place a duration is a duration                      */
	/* ------------------------------------------------------------------ */

	_addEffect( effect, seconds ) {
		const same = this.state.effects.find( ( e ) => e.kind === effect.kind && e.target === effect.target );
		if ( same ) {
			return;
		}
		const record = { id: ++effectIds, ...effect, seconds };
		this.state.effects = [ ...this.state.effects, record ];
		const timer = setTimeout( () => {
			this._effectTimers.delete( timer );
			this.state.effects = this.state.effects.filter( ( e ) => e.id !== record.id );
		}, seconds * 1000 );
		this._effectTimers.add( timer );
	}

	/** What a new arrangement asks for: a flourish, a spotlight, a band flash. */
	_effectsFor( arrangement ) {
		if ( ! arrangement ) {
			return;
		}
		if ( arrangement.flourish ) {
			this._addEffect( {
				kind: 'flourish',
				target: arrangement.flourish,
				color: arrangement.flourishColor || 'coral',
				intensity: ( arrangement.flourishIntensity || 0.7 ) * 0.6,
				pulse: arrangement.flourishPulseSpeed || 1.2,
			}, Math.min( arrangement.flourishDuration || 1.5, SPOTLIGHT_MAX_SECONDS ) );
		}
		if ( arrangement.spotlight ) {
			// A card highlight, not a blackout: the other players recede to
			// 0.55 rather than vanish, and the page is untouched (Skyler:
			// "it should highlight the name subtly").
			const asked = ( arrangement.spotlightBlackout || 3 ) + ( arrangement.spotlightGlow || 2 );
			this._addEffect( {
				kind: 'spotlight',
				target: arrangement.spotlight,
				color: arrangement.spotlightColor || 'coral',
				intensity: 0.9,
				pulse: 1.5,
			}, Math.min( asked, SPOTLIGHT_MAX_SECONDS ) );
		}
		if ( arrangement.bandFlash ) {
			this._addEffect( {
				kind: 'bandFlash',
				target: null,
				color: arrangement.bandFlashColor || 'coral',
				intensity: arrangement.bandFlashIntensity || 0.5,
				pulse: arrangement.bandFlashPulseSpeed || 0.6,
			}, arrangement.bandFlashDuration || 0.8 );
		}
	}

	/** Moments: somebody comes in or drops out, and their card flashes once. */
	_checkMoments( time ) {
		const keep = [];
		for ( const momentTime of this._upcomingMoments ) {
			const since = time - momentTime;
			if ( since < 0 ) {
				keep.push( momentTime );
			} else if ( since <= 1 ) {
				this._triggerMoment( momentTime );
			}
			// Older than a second: missed, and not worth flashing late.
		}
		this._upcomingMoments = keep;
	}

	_triggerMoment( momentTime ) {
		const arrangement = this.state.song && this.state.song.timeline[ momentTime ];
		if ( ! arrangement ) {
			return;
		}
		const musicians = arrangement.musicians;
		if ( musicians ) {
			if ( musicians.band === 'in' || musicians.band === 'out' ) {
				this._addEffect( { kind: 'flash', target: null }, 0.3 );
			} else {
				Object.entries( musicians ).forEach( ( [ name, status ] ) => {
					if ( status === 'in' || status === 'out' ) {
						this._addEffect( { kind: 'flash', target: name }, 0.3 );
					}
				} );
			}
		}
		if ( arrangement.detail === 'band-in' ) {
			this._addEffect( { kind: 'flash', target: null }, 0.3 );
		}
	}

	destroy() {
		if ( this._unsubscribe ) {
			this._unsubscribe();
			this._unsubscribe = null;
		}
		this._effectTimers.forEach( ( t ) => clearTimeout( t ) );
		this._effectTimers.clear();
		this._timeUpdateCallback = null;
	}
}
