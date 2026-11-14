<script setup>
/*
 * What the pane says when it has no article: that one is on its way, or
 * that it could not be had. A page that failed keeps its way out -- the
 * wiki itself may well have it.
 */
import { computed } from 'vue';
import { wikiPath } from '../../wiki/urls.js';

const props = defineProps( {
	kind: { type: String, required: true },
	title: { type: String, required: true },
} );

const href = computed( () => wikiPath( props.title ) );
</script>

<template>
	<div class="pane-loading">
		<template v-if="kind === 'loading'">Loading {{ title }}…</template>
		<template v-else>Could not load {{ title }} — <a :href="href">open it directly</a>.</template>
	</div>
</template>
