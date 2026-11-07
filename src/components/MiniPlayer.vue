<script setup>
/*
 * The folded sidebar: a carrot to play, through a ring for where you are, and the
 * band as initials, lit the way their cards are. Everything here is read
 * from the player; nothing is polled.
 */
import { computed } from 'vue';
import { usePlayerStore } from '../stores/player.js';
import { usePaneStore } from '../stores/pane.js';
import { useLayoutStore } from '../stores/layout.js';
import { formatTime } from '../player/timeline.js';
import { instrumentIcon, initials } from '../instruments.js';
import CarrotButton from './CarrotButton.vue';

const player = usePlayerStore();
const pane = usePaneStore();
const layout = useLayoutStore();

const progress = computed( () => {
	const duration = player.duration || ( player.song && player.song.duration ) || 180;
	return player.time / duration;
} );

const musicians = computed( () => player.cards.filter( ( c ) => ! c.engineer ).map( ( c ) => ( {
	name: c.name,
	icon: instrumentIcon( player.song && player.song.ensemble ? player.song.ensemble[ c.name ] : [] ),
	initials: initials( c.name ),
	lead: c.scene === 'lead',
	out: c.scene === 'out',
} ) ) );

function go( name ) {
	layout.stopFollowing();
	pane.open( name );
}
</script>

<template>
	<div class="mini-player">
		<CarrotButton id="mini-play-btn" :playing="player.playing" :progress="progress" :size="52"
			@toggle="player.togglePlay()" />
		<div id="mini-time" class="mini-time">{{ formatTime( player.time ) }}</div>
		<div id="mini-musicians" class="mini-musicians">
			<div v-for="m in musicians" :key="m.name" class="mini-musician" :class="{ lead: m.lead, out: m.out }"
				:data-musician="m.name" :title="m.name" @click="go( m.name )">
				<span class="icon">{{ m.icon }}</span>
				<span class="name">{{ m.initials }}</span>
			</div>
		</div>
	</div>
</template>
