<script setup>
/*
 * Title, record and cover for what is loaded, and what is lined up after
 * it, with the one selector under the title: the album's track list when
 * the app is locked to a track, the demo songs otherwise. Two selectors
 * would be two ways to do one thing, and one apart from the title was a
 * song chooser stranded at the far end of the bar (Skyler, 8 Nov 2026).
 */
import { computed } from 'vue';
import { useSongStore } from '../stores/song.js';
import { usePlayerStore } from '../stores/player.js';
import { useLayoutStore } from '../stores/layout.js';
import DemoSongSelect from './DemoSongSelect.vue';

const songs = useSongStore();
const player = usePlayerStore();
const layout = useLayoutStore();

const song = computed( () => songs.current );
const tracks = computed( () => ( songs.album ? songs.album.tracks.slice().sort( ( a, b ) => ( a.track_number || 0 ) - ( b.track_number || 0 ) ) : [] ) );
const upNextText = computed( () => ( player.upNext.length ? 'Up next: ' + player.upNext.map( ( s ) => s.title ).join( ' · ' ) : '' ) );

function onTrackPick( e ) {
	songs.goToTrack( e.target.value );
}

function onArtError() {
	// A cover that fails shows: the slot keeps its size and turns into a
	// marked box, so "no cover" and "no room for a cover" look different.
	songs.artFailed = true;
}
</script>

<template>
	<div v-if="song" id="song-info-header" class="song-info-header">
		<!-- The way into the timeline editor is a pencil on the title of what
			it edits, not a button with its own space in the player (Justin,
			7 Nov 2026), named in small print so it reads as more than a
			doodle (Skyler, 8 Nov). -->
		<h2 id="song-title-display" class="song-title-display">{{ song.title || 'Untitled' }}<button
			id="editor-toggle-btn"
			class="editor-pencil"
			:class="{ active: layout.editorOpen }"
			:title="layout.editorOpen ? 'Close the timeline editor' : 'Edit this song\'s timeline'"
			:aria-label="layout.editorOpen ? 'Close the timeline editor' : 'Edit this song\'s timeline'"
			@click="layout.editorOpen = !layout.editorOpen"
		>✎<span class="editor-pencil-label">edit timeline</span></button></h2>
		<div v-if="songs.album || !songs.lockedToTrack" id="album-row" class="album-row">
			<img
				v-if="songs.album && songs.artUrl"
				id="album-art"
				class="album-art"
				:class="{ 'album-art-missing': songs.artFailed }"
				:src="songs.artUrl"
				:alt="songs.artFailed ? 'cover did not load' : ( songs.album.title || 'album art' )"
				:title="songs.artFailed ? 'The cover failed to load from ' + songs.artUrl : songs.album.title"
				@error="onArtError"
			>
			<select
				v-if="songs.lockedToTrack && songs.album"
				id="album-track-select"
				class="album-track-select"
				:title="songs.album.title"
				:value="song._trackCid"
				@change="onTrackPick"
			>
				<option v-for="t in tracks" :key="t.cid" :value="t.cid">{{ t.track_number ? t.track_number + '. ' : '' }}{{ t.title || t.cid }}</option>
			</select>
			<DemoSongSelect v-else-if="!songs.lockedToTrack" />
		</div>
		<div id="recording-metadata" class="recording-metadata">
			<span v-for="p in songs.metadataParts" :key="p">{{ p }}</span>
		</div>
		<button v-if="upNextText" id="up-next" type="button" class="up-next" title="Play it now"
			@click="player.model && player.model.playNext()">{{ upNextText }}</button>
	</div>
</template>
