<!--
 * Your rabbithole: where you have been, and how you got here.
 *
 * Justin, 11 Nov 2026: "reliably shows the user where they've been and how
 * they got where they are." The walk (stores/walk.js) is every recording
 * you have listened to, oldest first, each saying who you followed to
 * reach it, kept across a refresh.
 *
 * Justin, 15 Nov 2026: drawn with "the same UI we've built for this
 * explorer", a little collapsed view in the player (the song on now, and
 * one or two before it), and the whole of it when it opens, "more like a
 * flow chart than a constellation". So it is the connectome's own graph
 * (/assets/connectome/?walk), in a frame: the songs are its circles, the
 * picker you followed is the tag on the line between two of them, gold is
 * a Permanent Release and nothing else. In the sidebar the frame shows the
 * last few steps; a click opens it into a drawer over the page, the same
 * frame grown, never reloaded. In the bottom bar there is no room for the
 * steps: a tab opens the drawer from below.
 *
 * The frame and the player talk by postMessage, same origin only: the
 * player says what the walk is, what is on, whether it plays and whether
 * the drawer is open; the graph asks the player to open, to play a song
 * again, to open a page in the pane, or to start a new walk.
-->
<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useLayoutStore } from '../stores/layout.js';
import { useWalkStore, drawerDoes } from '../stores/walk.js';
import { usePlayerStore } from '../stores/player.js';
import { useSongStore } from '../stores/song.js';
import { usePaneStore } from '../stores/pane.js';

const walk = useWalkStore();
const layout = useLayoutStore();
const player = usePlayerStore();
const songs = useSongStore();
const pane = usePaneStore();

/** The graph's own page, in its "your rabbithole" view, told it is Rabbithole's. */
const SRC = '/assets/connectome/?walk=mini&host=rabbithole';

const open = ref( false );
const frame = ref( null );

/** What the graph is told: the walk, the song on now, whether it plays, and how much room it has. */
function say() {
	const win = frame.value && frame.value.contentWindow;
	if ( ! win ) {
		return;
	}
	win.postMessage( {
		rabbithole: 'walk',
		hops: walk.hops.map( ( h ) => ( { cid: h.cid, song: h.song, via: h.via ? { name: h.via.name, instrument: h.via.instrument } : null, at: h.at } ) ),
		now: ( player.song && player.song._trackCid ) || null,
		playing: !! player.playing,
		mode: open.value ? 'full' : 'mini',
	}, window.location.origin );
}

watch( () => [ walk.hops, player.song && player.song._trackCid, player.playing, open.value ], say, { deep: true } );

/** What the graph asks of the player. Only the frame's own words count. */
function onMessage( e ) {
	if ( e.origin !== window.location.origin || ! frame.value || e.source !== frame.value.contentWindow ) {
		return;
	}
	const does = drawerDoes( e.data );
	if ( ! does ) {
		return;
	}
	if ( does.open ) {
		open.value = true;
	}
	if ( does.play ) {
		// A road not taken, taken from the drawer: the walk says who was followed to it.
		if ( does.via ) {
			walk.mark( does.play, does.via );
		}
		songs.playCid( does.play ).then( () => {
			if ( player.model ) {
				player.model.play();
			}
		} ).catch( ( err ) => console.warn( 'Could not play it again:', err ) );
	}
	if ( does.page ) {
		layout.stopFollowing();
		pane.open( does.page );
	}
	if ( does.clear ) {
		walk.clear();
	}
	if ( does.close ) {
		open.value = false;
	}
}

/*
 * Where the drawer comes out from: the sidebar's right edge (56px when the
 * sidebar is folded to its strip), or the top of the bottom bar.
 */
const edge = computed( () => ( layout.isBar
	? { '--walk-left': '0px', '--walk-bottom': 'var(--rh-dock)' }
	: { '--walk-left': layout.minimized ? '56px' : 'var(--rh-side-width)', '--walk-bottom': '0px' } ) );

function onKey( e ) {
	if ( e.key === 'Escape' ) {
		open.value = false;
	}
}
watch( open, ( isOpen ) => {
	if ( isOpen ) {
		window.addEventListener( 'keydown', onKey );
	} else {
		window.removeEventListener( 'keydown', onKey );
	}
} );

onMounted( () => window.addEventListener( 'message', onMessage ) );
onBeforeUnmount( () => {
	window.removeEventListener( 'message', onMessage );
	window.removeEventListener( 'keydown', onKey );
} );
</script>

<template>
	<div class="walk-trail" v-if="walk.hops.length">
		<!-- In the bar: a tab; the steps wait in the drawer. -->
		<button class="walk-tab" v-if="layout.isBar" @click="open = !open" title="Your rabbithole: where you have been, and how you got here">🐇</button>
		<div class="walk-label" v-else>
			<span>🐇 Your rabbithole</span>
			<button class="walk-more" @click="open = true">the whole of it ▸</button>
		</div>
		<div class="walk-shade" v-if="open" @click="open = false" />
		<!-- One frame, in the dock and in the drawer alike: it grows, it isn't moved, so it never loads twice. -->
		<div class="walk-frame" :class="{ open, bar: layout.isBar }" :style="edge" role="region" aria-label="Your rabbithole">
			<iframe ref="frame" :src="SRC" title="Your rabbithole" @load="say" />
			<button class="walk-cover" v-if="!open && !layout.isBar" @click="open = true" aria-label="Open your rabbithole" />
			<button class="walk-close" v-if="open" @click="open = false" aria-label="Close">✕</button>
		</div>
	</div>
</template>

<style>
/* In the dock: a label, and the last few steps. */
.walk-trail { border-top: 1px solid #e3e2de; padding-top: .4em; margin-top: .4em; font-size: 12px; }
.walk-label { display: flex; align-items: baseline; gap: .4em; font-weight: 600; }
.walk-more { margin-left: auto; background: none; border: none; font: inherit; font-weight: 400; color: #52514e; cursor: pointer; padding: 2px 0; }
.walk-more:hover { text-decoration: underline; }
.walk-frame { position: relative; height: 172px; margin-top: 4px; }
.walk-frame iframe { display: block; width: 100%; height: 100%; border: 0; background: transparent; }
.walk-cover { position: absolute; inset: 0; width: 100%; height: 100%; background: none; border: 0; padding: 0; cursor: pointer; }
.walk-cover:focus-visible { outline: 2px solid #4a7c59; outline-offset: -2px; }

/* In the bar: a small tab at the right end; the frame waits, out of sight, for the drawer. */
body.bottom-bar .walk-trail { order: 80; border: none; margin: 0; padding: 0 6px; align-self: center; flex: none; }
.walk-tab { padding: 4px 8px; border: 1px solid #c9d6cc; border-radius: 6px; background: #f3f6f3; font: inherit; cursor: pointer; }
body.bottom-bar .walk-frame:not(.open) { position: fixed; left: -10000px; top: 0; width: 320px; height: 190px; }

/* The drawer, over the page: the same frame, grown. */
.walk-shade { position: fixed; inset: 0; background: rgba(20, 30, 22, .28); z-index: 400; }
.walk-frame.open { position: fixed; top: 0; bottom: 0; left: var(--walk-left, 0px); height: auto; margin: 0;
	width: min(920px, calc(100vw - var(--walk-left, 0px) - 24px)); background: #fcfcfb;
	border-right: 2px solid #4a7c59; box-shadow: 6px 0 22px rgba(0,0,0,.22); z-index: 401; }
.walk-frame.open.bar { top: auto; bottom: var(--walk-bottom, 0px); left: 0; right: 0; width: auto;
	height: min(640px, calc(100vh - var(--walk-bottom, 0px) - 16px)); border-right: none; border-top: 2px solid #4a7c59; border-radius: 14px 14px 0 0;
	box-shadow: 0 -6px 22px rgba(0,0,0,.22); overflow: hidden; }
.walk-close { position: absolute; top: 8px; right: 10px; width: 32px; height: 32px; border-radius: 16px;
	border: 1px solid #c3c2b7; background: #fcfcfb; font: 16px system-ui, sans-serif; color: #52514e; cursor: pointer; z-index: 2; }
.walk-close:hover { background: #f0efec; color: #0b0b0b; }
</style>
