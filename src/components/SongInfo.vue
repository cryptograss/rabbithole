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
import { usePaneStore } from '../stores/pane.js';
import { wikiPath } from '../wiki/urls.js';
import DemoSongSelect from './DemoSongSelect.vue';

const songs = useSongStore();
const player = usePlayerStore();
const layout = useLayoutStore();
const pane = usePaneStore();

const song = computed( () => songs.current );
const tracks = computed( () => ( songs.album ? songs.album.tracks.slice().sort( ( a, b ) => ( a.track_number || 0 ) - ( b.track_number || 0 ) ) : [] ) );
const upNextText = computed( () => ( player.upNext.length ? 'Up next: ' + player.upNext.map( ( s ) => s.title ).join( ' · ' ) : '' ) );

/** The song's own page, for the title's href; the click opens it in the pane. */
const songHref = computed( () => wikiPath( song.value.title ? 'Song:' + song.value.title : song.value._metadataTitle || '' ) );

/** The record's own page, for the record link's href. */
const recordHref = computed( () => wikiPath( songs.recordPage || '' ) );

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

function openRecord() {
	layout.stopTraversing();
	pane.open( songs.recordPage );
}

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
		<!-- The title is the way back to the song's page once the pane has
			followed the pickers away from it (Justin, 11 Nov 2026). The
			editor's pencil used to sit on it and took a line of its own
			under a two-line title; it is on the Song Parts label now. -->
		<h2 id="song-title-display" class="song-title-display"><a id="song-title-link" class="song-title-link" :href="songHref"
			title="Back to this song's page" @click.prevent="backToSong">{{ song.title || 'Untitled' }}<span class="song-title-back" aria-hidden="true">↩</span></a></h2>
		<!-- The record the song is on, and the way back to its page. The
			record was only ever a cover and a tooltip; the name of it is
			what people look for (Skyler, 14 Nov 2026). Blue, because the
			page beside it is the wiki, and that is what a link looks like
			there, and ↗ rather than the title's ↩: you have likely never
			been to the record's page, so there is no going back to it. -->
		<div v-if="songs.recordPage" id="record-line" class="record-line"><a id="record-link" class="record-link" :href="recordHref"
			title="Open this record's page" @click.prevent="openRecord">{{ songs.recordPage }}<span class="record-link-out" aria-hidden="true">↗</span></a></div>
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
