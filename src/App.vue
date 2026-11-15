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
import { computed, watch, watchEffect, onMounted, onBeforeUnmount } from 'vue';

import { INITIAL_PARAMS, cameToListen } from './initial-params.js';
import { traverseTo } from './traverse.js';
import { useLayoutStore } from './stores/layout.js';
import { useSongStore } from './stores/song.js';
import { usePaneStore } from './stores/pane.js';
import { usePlayerStore } from './stores/player.js';
import * as wiki from './wiki/api.js';

import RabbitholeHeader from './components/RabbitholeHeader.vue';
import MiniPlayer from './components/MiniPlayer.vue';
import TimelineView from './components/TimelineView.vue';
import WebampDock from './components/WebampDock.vue';
import Ensemble from './components/Ensemble.vue';
import SongParts from './components/SongParts.vue';
import LayoutSwitch from './components/LayoutSwitch.vue';
import WalkTrail from './components/WalkTrail.vue';
import WikiPane from './components/WikiPane.vue';
import EditorPanel from './components/EditorPanel.vue';
import ListenChoice from './components/ListenChoice.vue';

const layout = useLayoutStore();
const songs = useSongStore();
const pane = usePaneStore();
const player = usePlayerStore();

/*
 * A spotlight blacks out the player pane for as long as it lasts, leaving
 * the one card lit (Justin's item 22, 15 Nov 2026). The model already says
 * when one is on and for how long; this is only where it is worn.
 */
const spotlit = computed( () => player.effects.some( ( e ) => e.kind === 'spotlight' ) );

watchEffect( () => {
	document.body.classList.toggle( 'bottom-bar', layout.isBar );
	document.body.classList.toggle( 'bar-collapsed', layout.isBar && layout.collapsed );
} );

/*
 * Each song starts on its own page, and in traverse mode the pane travels
 * with the track as it plays (Skyler, 17 and 30 Oct, 8 Nov 2026). So a new
 * song opens its page, and a change of soloist opens theirs only while the
 * music is playing: loading a song sets its first soloist, and that used
 * to carry the pane off the song page before a note had played.
 *
 * And when nobody is taking it -- an intro, a tag, a stretch where the band
 * is just playing -- the pane goes back to the song's own page rather than
 * staying on whoever soloed last (Justin's item 18, 15 Nov 2026). That is
 * what the song page is: the page the track itself is about.
 *
 * All of it waits on traverse mode; a person reading something keeps reading.
 */
watch( () => [ player.song && player.song._trackCid, player.currentSolo ], ( [ cid, solo ], [ oldCid, oldSolo ] ) => {
	if ( ! layout.traverse ) {
		return;
	}
	// The first song is openPaneForStart's; a change of track from here on
	// is this watcher's.
	const trackChanged = cid !== oldCid;
	if ( trackChanged && ! oldCid ) {
		return;
	}
	const where = traverseTo( { trackChanged, playing: player.playing, solo, lastSolo: oldSolo } );
	if ( where === 'person' ) {
		pane.open( solo );
	} else if ( where === 'song' && player.song ) {
		pane.openSong( player.song );
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
		layout.stopTraversing();
		pane.open( title, { push: false } );
	}
}

/**
 * Where the pane opens: the page the address names (?page=, a shared or
 * reloaded address), else the first song's page, linked to or not.
 */
function openPaneForStart() {
	const page = INITIAL_PARAMS.get( 'page' );
	const song = songs.initial;
	if ( page ) {
		pane.open( page, { push: false } );
	} else if ( song ) {
		pane.openSong( song, { push: false } );
	} else {
		pane.open( 'Justin Holmes', { push: false } );
	}
}

// A Listen button brought them here: the song plays as soon as the player
// stands (cameToListen says which addresses are a button's).
if ( cameToListen( INITIAL_PARAMS ) ) {
	const stop = watch( () => player.ready, ( ready ) => {
		if ( ready ) {
			player.model.play();
			stop();
		}
	}, { immediate: true } );
}

// A record link (?record=): once the player stands, the rest of the record
// lines up behind the track it started with.
if ( INITIAL_PARAMS.has( 'record' ) ) {
	const stop = watch( () => player.ready, ( ready ) => {
		if ( ready ) {
			stop();
			songs.queueRecordRest();
		}
	}, { immediate: true } );
}

onMounted( async () => {
	window.addEventListener( 'popstate', onPopState );
	await songs.boot();
	openPaneForStart();
} );

onBeforeUnmount( () => {
	window.removeEventListener( 'popstate', onPopState );
} );

</script>

<template>
	<div class="layout" :class="{ minimized: !layout.isBar && layout.minimized, 'with-editor': layout.editorOpen,
		'with-timeline': layout.showTimeline && layout.timelineView, 'with-timeline-tab': layout.showTimeline && !layout.timelineView }">
		<!-- One bar, all the way across the top of both columns: who we are,
		     traverse mode and the carrot, and what is playing (Justin's item
		     17, 15 Nov 2026). It was two bars, one over each column. -->
		<RabbitholeHeader />

		<div id="rabbithole-sidebar" :class="{ spotlit }">
			<MiniPlayer v-if="!layout.isBar" />

			<div class="player-container">
				<!-- Webamp at the very top of the player pane: the bar above
				     holds what used to stand between them. -->
				<WebampDock />

				<Ensemble />

				<!-- One line, after what is playing: above Webamp, a few hops
				     pushed it off the bottom of the screen (Justin, 11 Nov
				     2026). The hops open in a drawer over the page; in the
				     bar the line is a tab at the right end. -->
				<WalkTrail />

				<!-- The song parts at the bottom, with whatever space is
				     spare left under the cards rather than under the strip
				     (Justin's item 19). -->
				<div class="data-section">
					<!-- The way into the timeline editor: a pencil on the label
					     of what it edits. It was on the song's title, where a
					     two-line title pushed it onto a line of its own, and
					     the ensemble off the screen (Justin, 12 Nov 2026). -->
					<div class="section-label">Song Parts</div><button
						id="editor-toggle-btn"
						type="button"
						class="editor-pencil"
						:class="{ active: layout.editorOpen }"
						:title="layout.editorOpen ? 'Close the timeline editor' : 'Edit this song\'s timeline'"
						:aria-label="layout.editorOpen ? 'Close the timeline editor' : 'Edit this song\'s timeline'"
						@click="layout.editorOpen = !layout.editorOpen"
					>✎<span class="editor-pencil-label">edit timeline</span></button>
					<LayoutSwitch />
					<SongParts />
				</div>
			</div>
		</div>

		<div class="pane-column">
			<WikiPane />
		</div>

		<EditorPanel v-if="layout.editorOpen" />
		<TimelineView v-else-if="layout.showTimeline" />

		<!-- Asked for a track while another one is playing (item 15). -->
		<ListenChoice />
	</div>
</template>
