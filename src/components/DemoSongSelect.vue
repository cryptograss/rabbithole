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

/** The track that is loaded now, or null before anything is. */
const loadedCid = computed( () => {
	if ( ! songs.current ) {
		return null;
	}
	return songs.current._trackCid || null;
} );

/**
 * The loaded song, as an option. A track with no chart yet isn't in
 * songs.charted, but it is still what's playing, so the selector
 * shows it rather than going blank.
 */
function loadedSongAsOption() {
	const albumTitle = songs.album ? songs.album.title : '';
	return { cid: loadedCid.value, title: songs.current.title, album: albumTitle };
}

const options = computed( () => {
	const charted = songs.charted;
	if ( ! loadedCid.value ) {
		return charted;
	}
	const loadedIsCharted = charted.some( ( track ) => track.cid === loadedCid.value );
	if ( loadedIsCharted ) {
		return charted;
	}
	return [ loadedSongAsOption(), ...charted ];
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
		<select id="song-selector" class="song-select" :value="loadedCid" title="Every song with a chart on PickiPedia"
			@change="songs.pickTrack( $event.target.value )">
			<optgroup v-for="g in groups" :key="g.album" :label="g.album">
				<option v-for="t in g.tracks" :key="t.cid" :value="t.cid">{{ t.title }}</option>
			</optgroup>
		</select>
		<span v-if="songs.notice" class="inline-flash-note">{{ songs.notice }}</span>
	</span>
</template>
