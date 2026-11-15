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
 */
defineProps( {
	src: { type: String, required: true },
} );
</script>

<template>
	<iframe
		class="pane-graph"
		:src="src"
		title="The connectome"
		loading="eager"
	></iframe>
</template>
