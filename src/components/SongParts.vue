<script setup>
/*
 * The song laid out left to right, the block you are in lit. A long song
 * goes on two rows of equal count, so the second row lines up under the
 * first as the rest of the song (Barlows has 35 parts).
 */
import { computed } from 'vue';
import { usePlayerStore } from '../stores/player.js';

const player = usePlayerStore();

const twoRows = computed( () => player.parts.length > 20 );
const style = computed( () => ( {
	'--parts-per-row': twoRows.value ? Math.ceil( player.parts.length / 2 ) : player.parts.length,
} ) );
</script>

<template>
	<div id="parts-chart" class="parts-chart" :class="{ 'two-rows': twoRows }" :style="style">
		<div
			v-for="( part, i ) in player.parts"
			:id="'part-' + i"
			:key="i"
			class="part-box"
			:class="{ active: i === player.partIndex }"
			title="Jump to this part"
			style="cursor: pointer"
			@click="player.seekToPart( i )"
		>{{ part }}</div>
	</div>
</template>
