<script setup>
/*
 * The folded sidebar: a carrot to play, through a ring for where you are, and the
 * band as initials, lit the way their cards are. Everything here is read
 * from the player; nothing is polled.
 *
 * Justin, #connectome, 22 Nov 2026, 00:14Z: "When collapsed, we see the
 * ensemble initials, and very mild versions of the effects. Let's make those
 * effects much more visible on this collapsed version, and also include
 * effects other than solo." So each initial wears what its card wears: taking
 * it, leading in, a featured part (harmony and the rest), singing, sitting
 * out; and the chart's lights, each in its own colour and pulse: the
 * spotlight, the flourish, the whole band's flash, coming in.
 *
 * And with no song on, the carrot picks one and plays it (playSomething).
 */
import { computed } from 'vue';
import { usePlayerStore } from '../stores/player.js';
import { usePaneStore } from '../stores/pane.js';
import { useLayoutStore } from '../stores/layout.js';
import { formatTime } from '../player/timeline.js';
import { instrumentIcon, initials } from '../instruments.js';
import { fxColor } from '../player/glow.js';
import { playSomething } from '../wiki/queue.js';
import { useSongStore } from '../stores/song.js';
import CarrotButton from './CarrotButton.vue';

const player = usePlayerStore();
const songs = useSongStore();
const pane = usePaneStore();
const layout = useLayoutStore();

const progress = computed( () => {
	const duration = player.duration || ( player.song && player.song.duration ) || 180;
	return player.time / duration;
} );

const SCENES = [ 'lead', 'pickup', 'out' ];

/** The light on one of the band, as their card has it: the rarest wins (MusicianCard.vue). */
function lightOf( c ) {
	const mine = player.effects.filter( ( e ) => e.target === c.name );
	const band = player.effects.find( ( e ) => e.kind === 'bandFlash' );
	return mine.find( ( e ) => e.kind === 'spotlight' ) || mine.find( ( e ) => e.kind === 'flourish' ) || band ||
		mine.find( ( e ) => e.kind === 'enter' ) || null;
}

const musicians = computed( () => player.cards.filter( ( c ) => ! c.engineer ).map( ( c ) => {
	const fx = lightOf( c );
	return {
		name: c.name,
		icon: c.singing ? '🎤' : instrumentIcon( player.song && player.song.ensemble ? player.song.ensemble[ c.name ] : [] ),
		initials: initials( c.name ),
		classes: [ c.scene && SCENES.includes( c.scene ) ? c.scene : ( c.scene ? 'featured' : null ), {
			singing: c.singing,
			star: c.star,
			fx: !! fx,
			[ 'fx-' + ( fx && fx.kind ) ]: !! fx,
		} ],
		style: fx ? {
			'--fx-color': fxColor( fx.color ),
			'--fx-pulse': Math.max( 0.5, Math.min( 6, fx.pulse || 1.2 ) ) + 's',
		} : null,
		scene: c.scene,
	};
} ) );

/** The carrot: with a song on, play or pause it; with none, choose one and play it. */
function press() {
	if ( ! songs.current && ! player.song ) {
		playSomething();
		return;
	}
	player.togglePlay();
}

function go( name ) {
	layout.stopTraversing();
	pane.open( name );
}
</script>

<template>
	<div class="mini-player">
		<CarrotButton id="mini-play-btn" :playing="player.playing" :progress="progress" :eaten="player.eaten" :size="songs.current || player.song ? 52 : 32"
			@toggle="press()" />
		<div id="mini-time" class="mini-time">{{ formatTime( player.time ) }}</div>
		<div id="mini-musicians" class="mini-musicians">
			<div v-for="m in musicians" :key="m.name" class="mini-musician" :class="m.classes" :style="m.style"
				:data-musician="m.name" :data-scene="m.scene || null" :title="m.name + ( m.scene && m.scene !== 'out' ? ' (' + m.scene + ')' : '' )" @click="go( m.name )">
				<span class="icon">{{ m.icon }}</span>
				<span class="name">{{ m.initials }}</span>
			</div>
		</div>
	</div>
</template>
