<script setup>
/*
 * The four built-in songs. On a phone the label says the song and nothing
 * else: the row already carries the album as the cover beside it, and the
 * longest label decides how wide the control has to be.
 */
import { useSongStore } from '../stores/song.js';
import { useLayoutStore } from '../stores/layout.js';
import { demoLabels } from '../wiki/demo-songs.js';

const songs = useSongStore();
const layout = useLayoutStore();
</script>

<template>
	<span class="demo-select-row">
		<select id="song-selector" class="song-select" :value="songs.demoKey" @change="songs.pickDemo( $event.target.value )">
			<option v-for="( labels, key ) in demoLabels" :key="key" :value="key">{{ layout.narrow ? labels.short : labels.long }}</option>
		</select>
		<span v-if="songs.notice" class="inline-flash-note">{{ songs.notice }}</span>
	</span>
</template>
