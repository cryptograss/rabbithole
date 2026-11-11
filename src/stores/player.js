/**
 * The one player, for every component that needs it.
 *
 * The model is made when the dock mounts (it needs a container to render
 * Webamp into) and lives for the page. Until then `model` is null and the
 * derived values here are empty, which is what a dock that is still
 * loading should show.
 */

import { defineStore } from 'pinia';
import { shallowRef, computed, markRaw } from 'vue';

import { WebampPlayer } from '../player/model.js';

export const usePlayerStore = defineStore( 'player', () => {
	const model = shallowRef( null );

	function create( song ) {
		if ( model.value ) {
			return model.value;
		}
		model.value = markRaw( new WebampPlayer( song ) );
		return model.value;
	}

	const state = computed( () => ( model.value ? model.value.state : null ) );
	const song = computed( () => ( state.value ? state.value.song : null ) );
	const status = computed( () => ( state.value ? state.value.status : 'STOPPED' ) );
	const playing = computed( () => status.value === 'PLAYING' );
	const time = computed( () => ( state.value ? state.value.time : 0 ) );
	const duration = computed( () => ( state.value ? state.value.duration : 0 ) );
	const upNext = computed( () => ( state.value ? state.value.upNext : [] ) );
	const currentSolo = computed( () => ( state.value ? state.value.currentSolo : null ) );
	const effects = computed( () => ( state.value ? state.value.effects : [] ) );
	const ready = computed( () => !! ( state.value && state.value.ready ) );
	const error = computed( () => ( state.value ? state.value.error : null ) );

	const cards = computed( () => ( model.value ? model.value.cards.value : [] ) );
	const parts = computed( () => ( model.value ? model.value.parts.value : [] ) );
	const partIndex = computed( () => ( model.value ? model.value.partIndex.value : -1 ) );

	/*
	 * How much of the carrot the rabbit has eaten, 0 to 1: how far through
	 * the song you are, nibbled smoothly as it plays. It went a part at a
	 * time (Skyler and magent, #rabbithole, 8 Nov 2026), which jumped and
	 * read as a glitch (Justin, 11 Nov); Skyler wanted the rabbit to be
	 * seen eating it away as the song plays.
	 */
	const eaten = computed( () => (
		duration.value > 0 ? Math.max( 0, Math.min( 1, time.value / duration.value ) ) : 0
	) );

	function togglePlay() {
		if ( model.value ) {
			model.value.togglePlay();
		}
	}

	function seekToPart( index ) {
		if ( model.value ) {
			model.value.seekToPart( index );
		}
	}

	function seekToFraction( fraction ) {
		if ( model.value && duration.value > 0 ) {
			model.value.seekToTime( Math.max( 0, Math.min( 1, fraction ) ) * duration.value );
		}
	}

	return {
		model, create,
		song, status, playing, time, duration, upNext, currentSolo, effects, ready, error,
		cards, parts, partIndex, eaten,
		togglePlay, seekToPart, seekToFraction,
	};
} );
