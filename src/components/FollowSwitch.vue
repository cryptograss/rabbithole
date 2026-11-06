<script setup>
/*
 * Follow the solo into each player's page, and the carrot that plays.
 * The switch's full name lives in its tooltip; on a narrow screen the
 * caption is the short one.
 */
import { useLayoutStore } from '../stores/layout.js';
import { usePlayerStore } from '../stores/player.js';

const layout = useLayoutStore();
const player = usePlayerStore();

const LONG = 'Auto-switch artist profiles';
const SHORT = 'Follow artist';
</script>

<template>
	<label class="auto-switch" :title="LONG + ': follow the solo into each player\'s page'">
		<span class="toggle-switch">
			<input id="auto-switch-toggle" v-model="layout.follow" type="checkbox">
			<span class="toggle-slider"></span>
		</span>
		<span class="auto-switch-caption">{{ layout.narrow ? SHORT : LONG }}</span>
	</label>
	<button id="inline-play-btn" class="inline-carrot-btn" :class="{ playing: player.playing }" title="Play/Pause" @click="player.togglePlay()">
		<span class="inline-carrot-leaves"><span></span><span></span><span></span></span>{{ player.playing ? '❚❚' : '▶' }}
	</button>
</template>
