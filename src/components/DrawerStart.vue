<script setup>
/*
 * The drawer before a song is on.
 *
 * Come by /bacon, nothing plays until it is asked for (shell.js), and until
 * 21 Nov 2026 the player's whole chrome stayed away till then. Justin,
 * #connectome, 21 Nov 2026, 01:56Z: "There's still a bit of UI friction
 * between 'rabbithole' mode and 'not rabbithole mode'. It needs to feel
 * identical. To that end, I think it makes sense to start with rabbithole as
 * a drawer on the left". So the drawer is there from the first load, and
 * this is what it holds while Webamp has nothing to play: a line saying so,
 * and the songs the rabbithole hands out (stores/song.js, `ready`), each a
 * button that plays it. They were the bar's dropdown, which the same message
 * takes out of the bar. With none ready, the line alone.
 *
 * The first play puts Webamp, the band and the song's parts here in its
 * place; the drawer and the bar do not move.
 */
import { computed } from 'vue';
import { useSongStore } from '../stores/song.js';

const songs = useSongStore();

/** The songs ready to play, in the order the wiki lists them. */
const ready = computed( () => songs.ready || [] );

function play( cid ) {
	songs.playCid( cid, { play: true } ).catch( ( err ) => console.warn( 'Could not start', cid, err ) );
}
</script>

<template>
	<div id="drawer-start" class="drawer-start" :class="{ 'none-ready': !ready.length }">
		<p class="drawer-start-head">Nothing playing yet</p>
		<p class="drawer-start-say">
			<template v-if="ready.length">Press <span aria-hidden="true">▶</span><span class="visually-hidden">play</span> on a song in the graph, or start with one of these:</template>
			<template v-else>Press <span aria-hidden="true">▶</span><span class="visually-hidden">play</span> on a song in the graph, and it plays here.</template>
		</p>
		<ul v-if="ready.length" class="drawer-start-songs">
			<li v-for="t in ready" :key="t.cid">
				<button type="button" class="drawer-start-song" :title="'Play ' + t.title" @click="play( t.cid )">
					<span class="drawer-start-tri" aria-hidden="true">▶</span><span class="drawer-start-title">{{ t.title }}</span><span
						v-if="t.album" class="drawer-start-album">{{ t.album }}</span>
				</button>
			</li>
		</ul>
	</div>
</template>
