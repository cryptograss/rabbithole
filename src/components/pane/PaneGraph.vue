<script setup>
/*
 * The connectome, in the pane.
 *
 * A frame, because the graph is a page with its own scripts and injected
 * HTML runs none. Told host=rabbithole it keeps its ways out inside the
 * player: a song plays in the dock, a page opens here beside it, and the
 * window never goes anywhere (Justin, #rabbithole, 15 Nov 2026).
 *
 * The talking is WikiPane's, which holds every graph frame in the pane --
 * this one and any the wiki's own HTML carries -- so there is one place
 * that says what is playing and one that hears the graph back.
 *
 * In traverse mode's bacon graphs, the picker taking a solo has their card
 * (Justin, #connectome, 18 Nov 2026). The graph draws it itself, in its upper
 * right corner, where its ring leaves a place empty for it (20 Nov 2026,
 * 14:16Z: one bar less over the graph and no band under it). It was a band
 * under the frame here, and before that a card over the frame's corner.
 */
defineProps( {
	src: { type: String, required: true },
	// Behind whatever else the pane shows: out of sight, at the size it had, so nothing in it is laid out again
	// and coming back to it is coming back to the same drawing (shell.js).
	away: { type: Boolean, default: false },
} );
</script>

<template>
	<div class="pane-graph-wrap" :class="{ 'pane-graph-away': away }" :aria-hidden="away ? 'true' : null" :inert="away || null">
		<iframe
			class="pane-graph"
			:src="src"
			title="The connectome"
			loading="eager"
		></iframe>
	</div>
</template>
