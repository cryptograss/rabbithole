<!--
 * Your rabbithole: where you have been, and how you got here.
 *
 * Justin, 11 Nov 2026: "reliably shows the user where they've been and how
 * they got where they are." The walk (stores/walk.js) is every recording
 * that has been on, oldest first, each hop saying who you followed to
 * reach it, kept across a refresh. This draws it as the chain it is: the
 * song you are on at the bottom, a line up to each place you came from,
 * each line the colour of the instrument the hop was made with.
 *
 * In the dock it is one line, how many hops deep you are. The hops live in
 * a drawer that slides out over the page: from the sidebar's edge, or up
 * from the bottom bar on a phone. In the dock the list took the room Webamp
 * and the cards need, and a chevron that opens over the page is what
 * Justin asked for (11 Nov 2026). The drawer closes on its ✕, on Escape,
 * or on a click outside it.
 *
 * The colour is read from the performer graph when the walk is drawn, not
 * when it was stored, so a walk kept from before a wiki edit still draws
 * with what the wiki now says.
-->
<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useLayoutStore } from '../stores/layout.js';
import { useWalkStore } from '../stores/walk.js';
import { performerGraph } from '../wiki/queue.js';

const walk = useWalkStore();
const layout = useLayoutStore();

const COLORS = {
	guitar: '#2a78d6',
	banjo: '#eb6834',
	mandolin: '#1baf7a',
	fiddle: '#9a5fd4',
};
const NEUTRAL = '#a9a8a3';

const open = ref( false );
const graph = ref( null );
performerGraph().then( ( g ) => { graph.value = g; } );

/**
 * The instrument the hop's picker played on the song they led to, as the
 * graph spells it: the colour the line gets.
 */
function instrumentOf( hop ) {
	if ( ! graph.value || ! hop.via || ! hop.song ) {
		return null;
	}
	// The walk stores a track's title; the graph names its Song: page.
	const page = hop.song.startsWith( 'Song:' ) ? hop.song : 'Song:' + hop.song;
	const instruments = ( ( graph.value.band[ page ] || {} )[ hop.via.name ] ) || [];
	return instruments[ 0 ] || null;
}

const rows = computed( () => walk.hops.map( ( hop, i ) => ( {
	cid: hop.cid,
	song: hop.song ? hop.song.replace( /^Song:/, '' ) : hop.cid.slice( 0, 10 ),
	via: hop.via ? hop.via.name : null,
	viaInstrument: hop.via && hop.via.instrument ? hop.via.instrument : instrumentOf( hop ),
	color: COLORS[ String( ( hop.via && hop.via.instrument ) || instrumentOf( hop ) || '' ).toLowerCase() ] || NEUTRAL,
	isNow: i === walk.hops.length - 1,
} ) ) );

/*
 * Where the drawer comes out from: the sidebar's right edge (56px when the
 * sidebar is folded to its strip), or the top of the bottom bar. The
 * drawer is teleported to <body>, so it reads the layout from the store
 * rather than from the classes on .layout.
 */
const edge = computed( () => ( layout.isBar
	? { '--walk-left': '0px', '--walk-bottom': 'calc(var(--rh-dock-height) + var(--rh-strip-extra, 0px))' }
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
onBeforeUnmount( () => window.removeEventListener( 'keydown', onKey ) );
</script>

<template>
	<div class="walk-trail" v-if="rows.length">
		<button class="walk-head" :class="{ open }" @click="open = !open" title="Where you have been, and how you got here">
			<span class="walk-rabbit">🐇</span>
			<span class="walk-label">Your rabbithole</span>
			<span class="walk-count">{{ rows.length }} {{ rows.length === 1 ? 'hop' : 'hops' }}</span>
			<span class="walk-caret">{{ layout.isBar ? '▴' : '▸' }}</span>
		</button>

		<Teleport to="body">
			<div class="walk-shade" v-if="open" @click="open = false" />
			<aside class="walk-drawer" :class="{ open, bar: layout.isBar }" :style="edge" :inert="!open" aria-label="Your rabbithole">
				<div class="walk-drawer-head">
					<strong>🐇 Your rabbithole</strong>
					<span class="walk-count">{{ rows.length }} {{ rows.length === 1 ? 'hop' : 'hops' }}</span>
					<button class="walk-close" @click="open = false" aria-label="Close">✕</button>
				</div>
				<p class="walk-blurb">Every song that has been on, and who you followed to get there.</p>
				<ol class="walk-hops">
					<li v-for="(row, i) in rows" :key="row.cid + i" :class="{ now: row.isNow }">
						<span class="walk-line" :style="{ background: i === 0 ? 'transparent' : rows[i - 1].color }" />
						<span class="walk-dot" :style="{ background: row.isNow ? '#0b0b0b' : '#6f6e69' }" />
						<span class="walk-body">
							<span class="walk-via" v-if="row.via" :style="{ color: row.color }">via {{ row.via }}<template v-if="row.viaInstrument"> ({{ row.viaInstrument }})</template></span>
							<span class="walk-via" v-else>where you came in</span>
							<strong class="walk-song">{{ row.song }}</strong>
							<span class="walk-now" v-if="row.isNow">▶ listening now</span>
						</span>
					</li>
				</ol>
				<button class="walk-clear" @click="walk.clear(); open = false">start a new rabbithole</button>
			</aside>
		</Teleport>
	</div>
</template>

<style>
/* The one line in the dock. */
.walk-trail { border-top: 1px solid #e3e2de; padding-top: .4em; margin-top: .4em; font-size: 12px; }
.walk-head { display: flex; gap: .4em; align-items: center; width: 100%; background: none; border: none;
	font: inherit; font-weight: 600; cursor: pointer; padding: 2px 0; color: inherit; text-align: left; }
.walk-head:hover .walk-label { text-decoration: underline; }
.walk-count { font-weight: 400; color: #52514e; }
.walk-caret { color: #52514e; margin-left: auto; }

/* In the bar it is a small tab at the right end, not a row. */
body.bottom-bar .walk-trail { order: 80; border: none; margin: 0; padding: 0 6px; align-self: center; flex: none; }
body.bottom-bar .walk-head { width: auto; padding: 4px 8px; border: 1px solid #c9d6cc; border-radius: 6px; background: #f3f6f3; }
body.bottom-bar .walk-label { display: none; }
body.bottom-bar .walk-caret { margin-left: 0; }

/* The drawer, over the page. */
.walk-shade { position: fixed; inset: 0; background: rgba(20, 30, 22, .28); z-index: 400; }
.walk-drawer { position: fixed; top: 0; bottom: 0; left: var(--walk-left, 0px);
	width: min(440px, calc(100vw - var(--walk-left, 0px)));
	background: #fcfcfb; color: #1a1a1a; border-right: 2px solid #4a7c59; box-shadow: 6px 0 22px rgba(0,0,0,.22);
	z-index: 401; display: flex; flex-direction: column; padding: 14px 16px 12px; box-sizing: border-box;
	font-size: 14px; transform: translateX(calc(-100% - 24px)); transition: transform .25s ease; visibility: hidden; }
.walk-drawer.open { transform: none; visibility: visible; }
.walk-drawer.bar { top: auto; bottom: var(--walk-bottom, 0px); left: 0; right: 0; width: auto;
	height: min(70vh, 540px); border-right: none; border-top: 2px solid #4a7c59; border-radius: 14px 14px 0 0;
	box-shadow: 0 -6px 22px rgba(0,0,0,.22); transform: translateY(calc(100% + 24px)); }
.walk-drawer.bar.open { transform: none; }
.walk-drawer-head { display: flex; align-items: baseline; gap: .5em; font-size: 16px; }
.walk-close { margin-left: auto; background: none; border: none; font: inherit; font-size: 18px; cursor: pointer; color: #52514e; padding: 0 2px; }
.walk-blurb { margin: .3em 0 .6em; font-size: 12px; color: #52514e; }
.walk-hops { list-style: none; margin: 0; padding: 0 0 0 10px; position: relative; overflow-y: auto; flex: 1 1 auto; min-height: 0; }
.walk-hops li { display: flex; gap: 10px; padding: 5px 0; position: relative; }
.walk-dot { width: 11px; height: 11px; border-radius: 50%; flex: none; margin-top: 4px; box-shadow: 0 0 0 2px #fcfcfb; }
.walk-line { position: absolute; left: 14px; top: -11px; width: 3px; height: 26px; border-radius: 2px; }
.walk-hops li:first-child .walk-line { display: none; }
.walk-body { display: flex; flex-direction: column; line-height: 1.35; min-width: 0; }
.walk-via { font-size: 12px; color: #52514e; }
.walk-song { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.walk-now { font-size: 12px; font-weight: 700; color: #1b7a3d; }
.walk-clear { align-self: flex-start; background: none; border: none; font: inherit; font-size: 12px; color: #52514e;
	cursor: pointer; padding: .6em 0 0; text-decoration: underline; }
</style>
