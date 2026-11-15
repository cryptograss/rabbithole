<script setup>
/*
 * You are already listening, and you asked for another track. Three ways to
 * have it, and none of them is "we interrupted your song for you".
 *
 * Justin, #rabbithole 15 Nov 2026, item 15: "It needs to pop up a dialogue
 * with three options: 'play now', 'play next', and 'chase to here' - and
 * these all need to work."
 *
 * Chase to here is the trail: a rabbithole from what is playing to the
 * track you clicked, through the people who played on both, each song on
 * the way queued. It can take a moment and it can come back empty-handed,
 * so the dialogue stays up and says what happened.
 */
import { computed, ref } from 'vue';

import { useListenStore } from '../stores/listen.js';
import { useSongStore } from '../stores/song.js';
import { playTrackInDock, queueTrack, trailToTrack } from '../wiki/queue.js';

const listen = useListenStore();
const songs = useSongStore();

const busy = ref( '' );

const playing = computed( () => ( songs.current && songs.current.title ) || 'what is playing' );
const wanted = computed( () => ( listen.asking && listen.asking.song ) || 'that track' );

async function playNow() {
	const { cid } = listen.asking;
	listen.close();
	await playTrackInDock( cid );
}

async function playNext() {
	const { cid } = listen.asking;
	busy.value = 'next';
	await queueTrack( cid );
	listen.close();
}

async function chaseHere() {
	const { cid } = listen.asking;
	busy.value = 'chase';
	const found = await trailToTrack( cid, ( message ) => {
		listen.said = message;
	} );
	busy.value = '';
	if ( found ) {
		listen.close();
	}
}
</script>

<template>
	<div v-if="listen.asking" class="listen-choice-veil" @click.self="listen.close()">
		<div class="listen-choice" role="dialog" aria-modal="true" aria-label="What to do with this track">
			<p class="listen-choice-says">
				<strong>{{ playing }}</strong> is playing.
			</p>
			<p class="listen-choice-asks">What about <strong>{{ wanted }}</strong>?</p>
			<div class="listen-choice-buttons">
				<button type="button" :disabled="!!busy" @click="playNow()">Play now</button>
				<button type="button" :disabled="!!busy" @click="playNext()">Play next</button>
				<button type="button" :disabled="!!busy"
					title="Find a rabbithole from here to there, through the people who played on both, and queue every song on the way"
					@click="chaseHere()">Chase to here</button>
			</div>
			<p v-if="listen.said" class="listen-choice-said">{{ listen.said }}</p>
			<button class="listen-choice-close" type="button" title="Leave it alone" @click="listen.close()">×</button>
		</div>
	</div>
</template>
