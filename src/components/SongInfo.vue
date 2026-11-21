<script setup>
/*
 * What is loaded, in the bar: its title, which is the way back to the song,
 * and what is lined up after it.
 *
 * The record's name, its cover and the one selector (the album's track list,
 * or the songs ready to play) were here too until Justin, #connectome, 21 Nov
 * 2026, 01:56Z: "For now, let's remove the album name, album cover, and
 * dropdown menu from the top bar. We'll come up with a better "album mode"
 * later." The songs ready to play are in the drawer before one is on
 * (DrawerStart.vue); the record's page is a click from the song's.
 */
import { computed } from 'vue';
import { useSongStore } from '../stores/song.js';
import { usePlayerStore } from '../stores/player.js';
import { useLayoutStore } from '../stores/layout.js';
import { usePaneStore } from '../stores/pane.js';
import { wikiPath } from '../wiki/urls.js';

const songs = useSongStore();
const player = usePlayerStore();
const layout = useLayoutStore();
const pane = usePaneStore();

const song = computed( () => songs.current );
const upNextText = computed( () => ( player.upNext.length ? 'Up next: ' + player.upNext.map( ( s ) => s.title ).join( ' · ' ) : '' ) );

/** The song's own page, for the title's href; the click opens it in the pane. */
const songHref = computed( () => wikiPath( song.value.title ? 'Song:' + song.value.title : song.value._metadataTitle || '' ) );

/*
 * Back to the song: traverse mode comes back on as it was before the reader
 * went off reading (Justin, #connectome, 18 Nov 2026), and the song opens as
 * that mode has it -- its bacon graph, or its page.
 */
function backToSong() {
	if ( layout.resumeTraversing() === 'bacon' && pane.bacon( song.value ) ) {
		return;
	}
	pane.openSong( song.value );
}
</script>

<template>
	<div v-if="song" id="song-info-header" class="song-info-header">
		<!-- The title is the way back to the song's page once the pane has
			followed the pickers away from it (Justin, 11 Nov 2026). The
			editor's pencil used to sit on it and took a line of its own
			under a two-line title; it is on the Song Parts label now. -->
		<h2 id="song-title-display" class="song-title-display"><a id="song-title-link" class="song-title-link" :href="songHref"
			title="Back to this song's page" @click.prevent="backToSong">{{ song.title || 'Untitled' }}<span class="song-title-back" aria-hidden="true">↩</span></a></h2>
		<div id="recording-metadata" class="recording-metadata">
			<span v-for="p in songs.metadataParts" :key="p">{{ p }}</span>
		</div>
		<button v-if="upNextText" id="up-next" type="button" class="up-next" title="Play it now"
			@click="player.model && player.model.playNext()">{{ upNextText }}</button>
	</div>
</template>
