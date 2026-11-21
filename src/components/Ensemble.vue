<script setup>
/*
 * The band, one card each, and the stage a spotlight plays on.
 *
 * The light moves and the pickers stay where they stand: a break fills a
 * card where it is, a singer steps to the front, and that is the only
 * thing that changes the order (player/timeline.js micOrder).
 *
 * This draws the list of who is here and in what order, and nothing else
 * about them; each card reads the player for itself. So the list is drawn
 * again when the order changes, not on every tick of the clock, and a
 * card sliding to a new place (TransitionGroup's move) is left alone to
 * finish.
 */
import { computed } from 'vue';
import { usePlayerStore } from '../stores/player.js';
import { usePaneStore } from '../stores/pane.js';
import { useLayoutStore } from '../stores/layout.js';
import { usePickerStore } from '../stores/picker.js';
import MusicianCard from './MusicianCard.vue';
import SpotlightStage from './SpotlightStage.vue';
import RabbitMoved from './RabbitMoved.vue';

const player = usePlayerStore();
const pane = usePaneStore();
const layout = useLayoutStore();
const picker = usePickerStore();

/*
 * Who is on, in order. The same array while the order is the same: the
 * cards come back as new objects on every tick, and an order rebuilt from
 * them would be a new order as far as anything watching it could tell.
 */
const order = computed( ( was ) => {
	const now = player.cards.slice()
		.sort( ( a, b ) => a.weight - b.weight || a.name.localeCompare( b.name ) )
		.map( ( c ) => c.name );
	return was && was.length === now.length && was.every( ( name, i ) => name === now[ i ] ) ? was : now;
} );

/*
 * The spotlight, while the pane is dark for it -- and only while the song
 * is playing: the lights are up whenever the music stops, so the player
 * is never something you have to find in the dark.
 */
const spot = computed( ( was ) => {
	const now = player.playing ? player.effects.find( ( e ) => e.kind === 'spotlight' && e.dark ) : null;
	if ( ! now ) {
		return null;
	}
	return was && was.key === now.key ? was : now;
} );

const cards = new Map();

function keep( name, component ) {
	if ( component ) {
		cards.set( name, component );
	} else {
		cards.delete( name );
	}
}

/** Where a picker's name is on the screen: where it steps out from, and back to. */
function whereIs( name ) {
	const card = cards.get( name );
	return card ? card.whoRect() : null;
}

function select( name ) {
	// Tapping a card is navigating yourself, so the follow stops.
	layout.stopTraversing();
	pane.open( name );
}
</script>

<template>
	<TransitionGroup
		id="ensemble-display"
		tag="div"
		name="cards"
		class="musician-list ensemble"
		:class="{ paused: ! player.playing }"
	>
		<MusicianCard
			v-for="( name, i ) in order"
			:key="name"
			:ref="( c ) => keep( name, c )"
			:name="name"
			:rank="i"
			:chased="picker.following === name"
			:away="!! spot && spot.target === name"
			@select="select( name )"
		/>
	</TransitionGroup>
	<!-- The rabbit went from one card to another, or had nowhere to go: said under the cards (RabbitMoved.vue). -->
	<RabbitMoved />
	<SpotlightStage :effect="spot" :where-is="whereIs" />
</template>
