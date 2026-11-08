<script setup>
/*
 * The shell: a dock (sidebar or bottom bar), the wiki pane beside it, and
 * the timeline editor when it is open. Every piece reads the stores and
 * writes them; nothing here reaches into anything else's DOM.
 *
 * The stylesheet keys the two layouts off classes on <body>
 * (`bottom-bar`, `bar-collapsed`) and on `.layout` (`minimized`,
 * `with-editor`), as it always has; this is the one place they are set.
 */
import { watch, watchEffect, onMounted, onBeforeUnmount } from 'vue';

import { useLayoutStore } from './stores/layout.js';
import { useSongStore } from './stores/song.js';
import { usePaneStore } from './stores/pane.js';
import { usePlayerStore } from './stores/player.js';
import * as wiki from './wiki/api.js';

import RabbitholeHeader from './components/RabbitholeHeader.vue';
import MiniPlayer from './components/MiniPlayer.vue';
import SongInfo from './components/SongInfo.vue';
import DemoSongSelect from './components/DemoSongSelect.vue';
import FollowSwitch from './components/FollowSwitch.vue';
import WebampDock from './components/WebampDock.vue';
import Ensemble from './components/Ensemble.vue';
import SongParts from './components/SongParts.vue';
import LayoutSwitch from './components/LayoutSwitch.vue';
import WikiPane from './components/WikiPane.vue';
import EditorPanel from './components/EditorPanel.vue';

const layout = useLayoutStore();
const songs = useSongStore();
const pane = usePaneStore();
const player = usePlayerStore();

watchEffect( () => {
	document.body.classList.toggle( 'bottom-bar', layout.isBar );
	document.body.classList.toggle( 'bar-collapsed', layout.isBar && layout.collapsed );
} );

/*
 * Each song starts on its own page, and the pane follows the solo from
 * there as the song plays (Skyler, 17 and 30 Oct, 8 Nov 2026). So a new
 * song opens its page, and a change of soloist opens theirs only while the
 * music is playing: loading a song sets its first soloist, and that used
 * to carry the pane off the song page before a note had played. Both wait
 * on following being on; a person reading something keeps reading.
 */
watch( () => [ player.song && player.song._trackCid, player.currentSolo ], ( [ cid, solo ], [ oldCid ] ) => {
	if ( ! layout.follow ) {
		return;
	}
	if ( cid !== oldCid ) {
		// The first song is openPaneForStart's; this is the next one.
		if ( oldCid && player.song ) {
			openSongPage( player.song );
		}
	} else if ( solo && player.playing ) {
		pane.open( solo );
	}
} );

// Collapsing the bar shades Webamp's window; opening it unshades.
watch( () => layout.isBar && layout.collapsed, ( shaded ) => {
	if ( player.model ) {
		player.model.setShaded( shaded );
	}
} );

// Back and forward move the pane. Steering it yourself stops the follow.
function onPopState( e ) {
	const title = e.state && e.state.wikiTitle;
	if ( title ) {
		layout.stopFollowing();
		pane.open( title, { push: false } );
	}
}

/*
 * A song's page: Song:<title> when there is one, else the track's metadata
 * page. A song should open on the song, not on the YAML somebody edits it
 * with (Skyler).
 */
async function openSongPage( song, { push = true } = {} ) {
	const fallback = song._metadataTitle;
	if ( ! song.title ) {
		pane.open( fallback, { push } );
		return;
	}
	const songPage = 'Song:' + song.title;
	try {
		pane.open( ( await wiki.pageExists( songPage ) ) ? songPage : fallback, { push } );
	} catch ( err ) {
		console.warn( 'Could not check for a song page:', err );
		pane.open( fallback, { push } );
	}
}

/** Where the pane opens: the first song's page, linked to or not. */
function openPaneForStart() {
	const song = songs.initial;
	if ( song ) {
		openSongPage( song, { push: false } );
	} else {
		pane.open( 'Justin Holmes', { push: false } );
	}
}

onMounted( async () => {
	window.addEventListener( 'popstate', onPopState );
	await songs.boot();
	openPaneForStart();
} );

onBeforeUnmount( () => {
	window.removeEventListener( 'popstate', onPopState );
} );

const editorLabel = () => {
	if ( layout.editorOpen ) {
		return 'Close Editor';
	}
	return layout.isBar && layout.narrow ? '✎ Edit' : 'Edit Timeline';
};
</script>

<template>
	<div class="layout" :class="{ minimized: !layout.isBar && layout.minimized, 'with-editor': layout.editorOpen }">
		<div id="rabbithole-sidebar">
			<RabbitholeHeader />

			<MiniPlayer v-if="!layout.isBar" />

			<div class="player-container">
				<SongInfo />

				<DemoSongSelect v-if="!songs.lockedToTrack" />

				<div class="toggle-row auto-switch-row">
					<FollowSwitch />
				</div>

				<div class="toggle-row">
					<button
						id="editor-toggle-btn"
						class="editor-toggle-btn"
						:class="{ active: layout.editorOpen }"
						:title="layout.editorOpen ? 'Close Editor' : 'Edit Timeline'"
						@click="layout.editorOpen = !layout.editorOpen"
					>{{ editorLabel() }}</button>
				</div>

				<WebampDock />

				<!-- In the sidebar the cards sit under the player; in the bar
				     they are the bar's middle zone, after the song parts. -->
				<Ensemble v-if="!layout.isBar" />

				<div class="data-section">
					<div class="section-label">Song Parts</div>
					<SongParts />
					<LayoutSwitch />
				</div>

				<Ensemble v-if="layout.isBar" />
			</div>
		</div>

		<WikiPane />

		<EditorPanel v-if="layout.editorOpen" />
	</div>
</template>
