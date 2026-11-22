<script setup>
/*
 * Where Webamp lives. The model is made here, once, with the first song,
 * and given this element to render into; from then on the model is the
 * player store's and this component only holds the box.
 *
 * The box itself has no Vue children: Webamp's #webamp node is appended
 * into it by the model, and Vue must never try to reconcile around a node
 * it did not make. The loading and error lines are siblings of the box.
 */
import { ref, watch, onMounted } from 'vue';
import { usePlayerStore } from '../stores/player.js';
import { useSongStore } from '../stores/song.js';
import { usePickerStore } from '../stores/picker.js';
import { useLayoutStore } from '../stores/layout.js';

const player = usePlayerStore();
const songs = useSongStore();
const box = ref( null );

let mounting = false;

async function build() {
	if ( mounting || player.model || ! songs.initial || ! box.value ) {
		return;
	}
	mounting = true;
	const model = player.create( songs.initial );
	// Next and previous are the rabbithole's steps, not Webamp's playlist
	// walk: forward lines up whatever the chase, the quest or the floor
	// names and plays it, and back returns to the song before this one in
	// this rabbithole (Justin, #rabbithole, 15 Nov 2026, items 32, 37, 39).
	model.onStep = ( which ) => {
		const steps = usePickerStore();
		const step = which === 'next' ? steps.forward() : steps.back();
		Promise.resolve( step ).catch( ( err ) => console.warn( 'Could not step', which, err ) );
	};
	// Webamp's own title is the way back to the track: the bar's song line was,
	// and it is gone (Justin, #connectome, 22 Nov 2026, 00:55Z: "can we make it
	// so that clicking the title in webamp does that? Returns us to the track
	// centered in a bacon graph, and turns traverse bacon graphs back on?").
	// toTheTrack does both: bacon graphs on, and the pane to the track's own
	// graph at once (App.vue watches layout.backToTrack) rather than to whoever
	// is taking a solo. A track the graph does not hold gets the song's page.
	model.onTitle = () => useLayoutStore().toTheTrack();
	await model.mount( box.value );
}

onMounted( build );
watch( () => songs.initial, build );
</script>

<template>
	<div class="webamp-wrapper" :class="{ shaded: player.shaded }">
		<div id="webamp-player" ref="box"></div>
		<p v-if="player.error" class="player-error">Could not start the player: {{ player.error }}</p>
		<p v-else-if="songs.loadError && !songs.initial" class="player-error">Could not load the track: {{ songs.loadError }}</p>
		<!-- No song asked for yet (come by /bacon): there is no player to wait for, and DrawerStart says so. -->
		<span v-else-if="!player.ready && ( songs.initial || songs.loading )" class="player-loading">Loading player...</span>
	</div>
</template>
