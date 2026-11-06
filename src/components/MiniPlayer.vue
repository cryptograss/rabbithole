<script setup>
/*
 * The folded sidebar: a carrot to play, a ring for where you are, and the
 * band as initials, lit the way their cards are. Everything here is read
 * from the player; nothing is polled.
 */
import { computed } from 'vue';
import { usePlayerStore } from '../stores/player.js';
import { usePaneStore } from '../stores/pane.js';
import { useLayoutStore } from '../stores/layout.js';
import { formatTime } from '../player/timeline.js';
import { instrumentIcon, initials } from '../instruments.js';

const player = usePlayerStore();
const pane = usePaneStore();
const layout = useLayoutStore();

const CIRCUMFERENCE = 2 * Math.PI * 18;
const dashOffset = computed( () => {
	const duration = player.duration || ( player.song && player.song.duration ) || 180;
	const fraction = Math.max( 0, Math.min( 1, player.time / duration ) );
	return CIRCUMFERENCE * ( 1 - fraction );
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
		<div class="carrot-leaves-external">
			<span></span><span></span><span></span>
		</div>
		<button id="mini-play-btn" class="mini-player-btn" :class="{ playing: player.playing }" title="Play/Pause" @click="player.togglePlay()">
			{{ player.playing ? '❚❚' : '▶' }}
		</button>
		<div class="mini-progress-ring">
			<svg width="44" height="44">
				<circle class="bg" cx="22" cy="22" r="18"></circle>
				<circle id="mini-progress-circle" class="progress" cx="22" cy="22" r="18"
					:stroke-dasharray="CIRCUMFERENCE" :stroke-dashoffset="dashOffset"></circle>
			</svg>
		</div>
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
