<script setup>
/*
 * Traverse mode: where the information pane goes as the track plays.
 *
 * A rocker of three (Justin, #connectome, 18 Nov 2026): on the left, bacon
 * graphs -- the song's own graph, moving to whoever takes a solo with the
 * song beside them, the default; in the middle, off; on the right, the
 * PickiPedia pages the track's parts are about, which is what traverse mode
 * was until then (Justin's item 16, 15 Nov 2026, with its tooltip in his
 * words, below).
 *
 * The carrot that plays sits beside it, since the switch moved to the one
 * bar across the top (item 17) and the carrot came with it.
 */
import { useLayoutStore } from '../stores/layout.js';

const layout = useLayoutStore();

const POSITIONS = [
	{ mode: 'bacon', label: 'bacon graphs', tip: 'The information pane shows the song\'s bacon graph, and goes to whoever takes a solo, the song beside them.' },
	{ mode: 'off', label: 'off', tip: 'The information pane stays where you put it.' },
	{ mode: 'pages', label: 'pickipedia pages', tip: 'When on, the information pane will load pages pertaining to parts of the track as it plays.' },
];
</script>

<template>
	<div class="traverse-rocker" role="radiogroup" aria-label="Traverse mode">
		<span class="traverse-caption">traverse</span>
		<span class="traverse-track">
			<label
				v-for="p in POSITIONS"
				:key="p.mode"
				class="traverse-pos"
				:class="{ on: layout.traverse === p.mode, [ 'traverse-' + p.mode ]: true }"
				:title="p.tip"
			>
				<input
					type="radio"
					name="traverse-mode"
					:value="p.mode"
					:checked="layout.traverse === p.mode"
					@change="layout.setTraverse( p.mode )"
				>
				<span>{{ p.label }}</span>
			</label>
		</span>
	</div>
</template>
