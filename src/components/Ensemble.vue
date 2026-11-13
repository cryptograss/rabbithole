<script setup>
/*
 * The band, one card each, in the order the arrangement wants them.
 *
 * The cards are what the player model says they are at this moment, and
 * nothing else: there is no second writer, no timer and no rebuild. When
 * the order changes, the cards slide (TransitionGroup's move), which is
 * what Packery used to be for.
 *
 * Effects are records on the model with a lifetime; a card wears the
 * classes for the ones that name it, and the whole ensemble the ones that
 * name nobody.
 */
import { computed } from 'vue';
import { usePlayerStore } from '../stores/player.js';
import { usePaneStore } from '../stores/pane.js';
import { useLayoutStore } from '../stores/layout.js';
import { glowShadows } from '../player/glow.js';
import MusicianCard from './MusicianCard.vue';

const player = usePlayerStore();
const pane = usePaneStore();
const layout = useLayoutStore();

const sorted = computed( () => player.cards.slice().sort( ( a, b ) => a.weight - b.weight || a.name.localeCompare( b.name ) ) );

const spotlight = computed( () => player.effects.find( ( e ) => e.kind === 'spotlight' ) || null );
const bandFlash = computed( () => player.effects.find( ( e ) => e.kind === 'bandFlash' ) || null );
const bandMoment = computed( () => player.effects.some( ( e ) => e.kind === 'flash' && e.target === null ) );

const ensembleStyle = computed( () => {
	if ( ! bandFlash.value ) {
		return null;
	}
	const glow = glowShadows( bandFlash.value.color, bandFlash.value.intensity );
	return { '--glow-max': glow.max, '--pulse': bandFlash.value.pulse + 's', '--cycles': bandFlash.value.cycles };
} );

function effectsFor( name ) {
	return player.effects.filter( ( e ) => e.target === name );
}

function select( name ) {
	// Tapping a card is navigating yourself, so the follow stops.
	layout.stopFollowing();
	pane.open( name );
}
</script>

<template>
	<TransitionGroup
		id="ensemble-display"
		tag="div"
		name="cards"
		class="musician-list ensemble"
		:class="{ 'band-flash-active': !!bandFlash, flash: bandMoment }"
		:style="ensembleStyle"
	>
		<MusicianCard
			v-for="card in sorted"
			:key="card.name"
			:card="card"
			:effects="effectsFor( card.name )"
			:dim="!!spotlight && spotlight.target !== card.name"
			@select="select( card.name )"
		/>
	</TransitionGroup>
</template>
