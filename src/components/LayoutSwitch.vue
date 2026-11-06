<script setup>
/*
 * The A/B switch between the sidebar and the bar. Deliberately plain and
 * labelled with which layout you are looking at, so a screenshot says
 * which one it is. A stored choice is amber, and "use auto" is shown
 * whenever one exists: a setting you cannot see is a setting you cannot
 * undo. Bottom left of the sidebar, under the song parts (Skyler, 6 Nov
 * 2026); top right of the page in the bar.
 */
import { computed } from 'vue';
import { useLayoutStore } from '../stores/layout.js';

const layout = useLayoutStore();

const other = computed( () => ( layout.layout === 'sidebar' ? 'bar' : 'sidebar' ) );
const label = computed( () => {
	const name = layout.layout === 'sidebar' ? 'Sidebar' : 'Bottom bar';
	const otherName = other.value === 'sidebar' ? 'sidebar' : 'bottom bar';
	return ( layout.pinned ? name + ' (saved)' : name ) + ' — switch to ' + otherName;
} );
</script>

<template>
	<div class="layout-ab-wrap">
		<a id="layout-ab" class="layout-ab" :class="{ 'layout-ab-pinned': layout.pinned }" href="#" @click.prevent="layout.setLayout( other )">{{ label }}</a>
		<a v-if="layout.pinned" id="layout-ab-auto" class="layout-ab layout-ab-auto" href="#" title="Go back to choosing by window size" @click.prevent="layout.setLayout( null )">use auto</a>
	</div>
</template>
