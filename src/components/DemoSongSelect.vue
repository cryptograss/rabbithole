<script setup>
/*
 * Every track with a chart on the wiki, by album. It shows the song that
 * is loaded, whatever loaded it, and lists that song even before it has a
 * chart. Songs sit under their album's name, so each option is only a
 * title.
 */
import { computed } from 'vue';
import { useSongStore } from '../stores/song.js';

const songs = useSongStore();

const currentCid = computed( () => songs.current && songs.current._trackCid );
const options = computed( () => {
	const list = songs.charted.slice();
	const c = songs.current;
	if ( c && c._trackCid && ! list.some( ( t ) => t.cid === c._trackCid ) ) {
		list.unshift( { cid: c._trackCid, title: c.title, album: songs.album ? songs.album.title : '' } );
	}
	return list;
} );
const groups = computed( () => {
	const byAlbum = new Map();
	for ( const t of options.value ) {
		const album = t.album || 'Other songs';
		if ( ! byAlbum.has( album ) ) {
			byAlbum.set( album, [] );
		}
		byAlbum.get( album ).push( t );
	}
	return [ ...byAlbum ].map( ( [ album, tracks ] ) => ( { album, tracks } ) );
} );
</script>

<template>
	<span class="demo-select-row">
		<select id="song-selector" class="song-select" :value="currentCid" title="Every song with a chart on PickiPedia"
			@change="songs.pickTrack( $event.target.value )">
			<optgroup v-for="g in groups" :key="g.album" :label="g.album">
				<option v-for="t in g.tracks" :key="t.cid" :value="t.cid">{{ t.title }}</option>
			</optgroup>
		</select>
		<span v-if="songs.notice" class="inline-flash-note">{{ songs.notice }}</span>
	</span>
</template>
