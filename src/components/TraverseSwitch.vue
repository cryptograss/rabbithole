<script setup>
/*
 * Traverse mode: the information pane loads the pages the track's parts are
 * about as the track plays.
 *
 * It was "Follow the solo", and before that "auto-switch artist profiles",
 * which read like a social-media follow (Skyler and magent, 7 Nov 2026).
 * Justin's item 16, 15 Nov 2026: "Follow the solo is still awkward. Let's
 * change that to traverse mode", with the tooltip below, his words.
 *
 * The carrot that plays sits beside it, since the switch moved to the one
 * bar across the top (item 17) and the carrot came with it.
 */
import { useLayoutStore } from '../stores/layout.js';

const layout = useLayoutStore();

const TOOLTIP = 'When on, the information pane will load pages pertaining to parts of the track as it plays.';
</script>

<template>
	<label class="auto-switch traverse-switch" :title="TOOLTIP">
		<span class="toggle-switch">
			<input id="auto-switch-toggle" v-model="layout.traverse" type="checkbox">
			<span class="toggle-slider"></span>
		</span>
		<span class="auto-switch-caption">traverse mode</span>
	</label>
</template>
