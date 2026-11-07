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

// "Follow the solo" says what moves the page; "artist profiles" read like
// a social-media follow (Skyler and magent, #rabbithole, 7 Nov 2026).
const LONG = 'Follow the solo';
const SHORT = 'Follow solo';
</script>

<template>
	<label class="auto-switch" :title="LONG + ': each player\'s page opens as they take the solo'">
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
