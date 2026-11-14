<script setup>
/*
 * How the player got here: the song it started from, and each person who
 * played on both sides of a hop. Built with document.createElement and a
 * style attribute until 14 Nov 2026.
 */
defineProps( { trail: { type: Object, required: true } } );

/** A page title as a person says it: "Song:Victory" is Victory. */
function songName( title ) {
	return String( title ).replace( /^Song:/, '' );
}
</script>

<template>
	<div class="pp-trail">
		<strong>Down the rabbithole from {{ songName( trail.from ) }}</strong>
		<ol>
			<li v-for="( hop, i ) in trail.hops" :key="i">
				{{ hop.via }}<em v-if="hop.instrument"> ({{ hop.instrument }})</em>
				played on both — to <strong>{{ songName( hop.to ) }}</strong>
			</li>
		</ol>
	</div>
</template>
