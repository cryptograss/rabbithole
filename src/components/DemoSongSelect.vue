<script setup>
/*
 * Every track with a chart on the wiki, by album. It shows the song that
 * is loaded, whatever loaded it, and lists that song even before it has a
 * chart. On a phone the label says the song and nothing else: the row
 * already carries the album as the cover beside it.
 */
import { computed } from 'vue';
import { useSongStore } from '../stores/song.js';
import { useLayoutStore } from '../stores/layout.js';

const songs = useSongStore();
const layout = useLayoutStore();

const currentCid = computed( () => songs.current && songs.current._trackCid );
const options = computed( () => {
	const list = songs.charted.slice();
	const c = songs.current;
	if ( c && c._trackCid && ! list.some( ( t ) => t.cid === c._trackCid ) ) {
		list.unshift( { cid: c._trackCid, title: c.title, album: songs.album ? songs.album.title : '' } );
	}
	return list;
} );
const label = ( t ) => ( layout.narrow || ! t.album ? t.title : `${ t.title } - ${ t.album }` );
</script>

<template>
	<span class="demo-select-row">
		<select id="song-selector" class="song-select" :value="currentCid" title="Every song with a chart on PickiPedia"
			@change="songs.pickTrack( $event.target.value )">
			<option v-for="t in options" :key="t.cid" :value="t.cid">{{ label( t ) }}</option>
		</select>
		<span v-if="songs.notice" class="inline-flash-note">{{ songs.notice }}</span>
	</span>
</template>
