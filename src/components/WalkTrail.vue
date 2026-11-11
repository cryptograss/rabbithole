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
 * The colour is read from the performer graph when the walk is drawn, not
 * when it was stored, so a walk kept from before a wiki edit still draws
 * with what the wiki now says.
-->
<script setup>
import { computed, ref } from 'vue';
import { useWalkStore } from '../stores/walk.js';
import { performerGraph } from '../wiki/queue.js';

const walk = useWalkStore();

const COLORS = {
	guitar: '#2a78d6',
	banjo: '#eb6834',
	mandolin: '#1baf7a',
	fiddle: '#9a5fd4',
};
const NEUTRAL = '#a9a8a3';

// Closed until asked for: one line saying how deep you are, the hops on a
// click. Open, it took the room Webamp and the cards need.
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
</script>

<template>
	<div class="walk-trail" v-if="rows.length">
		<button class="walk-head" @click="open = !open">
			🐇 Your rabbithole <span class="walk-count">{{ rows.length }}</span>
			<span class="walk-caret">{{ open ? '▾' : '▸' }}</span>
		</button>
		<ol class="walk-hops" v-if="open">
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
		<button class="walk-clear" v-if="open" @click="walk.clear()">start a new rabbithole</button>
	</div>
</template>

<style>
.walk-trail { border-top: 1px solid #e3e2de; padding-top: .5em; margin-top: .4em; font-size: 12px; }
.walk-head { display: flex; gap: .4em; align-items: center; background: none; border: none;
	font: inherit; font-weight: 600; cursor: pointer; padding: 0; color: inherit; }
.walk-count { font-weight: 400; color: #52514e; }
.walk-caret { color: #52514e; }
.walk-hops { list-style: none; margin: .5em 0 .2em; padding: 0 0 0 8px; position: relative; max-height: 220px; overflow-y: auto; }
.walk-hops li { display: flex; gap: 8px; padding: 3px 0; position: relative; }
.walk-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; margin-top: 3px; box-shadow: 0 0 0 2px var(--surface, #fcfcfb); }
.walk-line { position: absolute; left: 12px; top: -9px; width: 3px; height: 21px; border-radius: 2px; }
.walk-hops li:first-child .walk-line { display: none; }
.walk-body { display: flex; flex-direction: column; line-height: 1.35; min-width: 0; }
.walk-via { font-size: 11px; color: #52514e; }
.walk-song { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.walk-now { font-size: 11px; font-weight: 700; color: #1b7a3d; }
.walk-clear { background: none; border: none; font: inherit; font-size: 11px; color: #52514e;
	cursor: pointer; padding: .2em 0 0; text-decoration: underline; }
</style>
