<script setup>
/*
 * The switch between the sidebar and the bar: one small button, the
 * shape of the layout it would move you to, with the words in its title.
 * It sits on the Song Parts label's line in the sidebar, so it takes no
 * row of its own: the sidebar's height is precious, and the cards must
 * never be pushed into a scroll (Justin, 11 Nov 2026). Top right of the
 * page in the bar. Not on a phone, which always gets the bar.
 *
 * It used to be two text pills, the second one "use auto", which undid a
 * stored choice and let the window decide again. A choice you made is a
 * choice; there is nothing to undo, so that is gone (Justin, 11 Nov).
 */
import { computed } from 'vue';
import { useLayoutStore } from '../stores/layout.js';

const layout = useLayoutStore();

const other = computed( () => ( layout.layout === 'sidebar' ? 'bar' : 'sidebar' ) );
const label = computed( () => ( other.value === 'bar' ? 'Move the player to the bottom' : 'Move the player to the side' ) );
</script>

<template>
	<button v-if="! layout.phone" id="layout-ab" type="button" class="layout-ab" :title="label" :aria-label="label"
		@click="layout.setLayout( other )">
		<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
			<rect x="0.5" y="0.5" width="13" height="13" rx="1.5" fill="none" stroke="currentColor" />
			<rect v-if="other === 'bar'" x="0.5" y="9" width="13" height="4.5" rx="1" fill="currentColor" />
			<rect v-else x="0.5" y="0.5" width="4.5" height="13" rx="1" fill="currentColor" />
		</svg>
	</button>
</template>
