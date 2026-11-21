<script setup>
/*
 * The drawer's grip: on the drawer's own edge, halfway along it.
 *
 * Justin, #connectome, 21 Nov 2026, 01:56Z: "The left hand drawer for
 * rabbithole is currently only collapsible but a button way over on the
 * right side of the top bar - that's very counter intuitive. Give it a nice
 * grip in the middle of the drawer."
 *
 * A button, so a mouse, a finger and a keyboard all work it (Enter or Space
 * once it has the focus). Beside the page the drawer is the left side and
 * the grip is a tab on its right edge, halfway down; along the bottom (a
 * phone, or the bar chosen) it is a handle in a rail on the drawer's top
 * edge. Folded, the same grip opens it: it stays where the edge is.
 */
import { computed } from 'vue';
import { useLayoutStore } from '../stores/layout.js';

const layout = useLayoutStore();

const open = computed( () => ( layout.isBar ? ! layout.collapsed : ! layout.minimized ) );
const label = computed( () => ( open.value ? 'Fold the player away' : 'Open the player' ) );
// Which way the drawer goes when pressed: toward its edge to fold, away from it to open.
const mark = computed( () => ( layout.isBar ? '' : ( open.value ? '‹' : '›' ) ) );
</script>

<template>
	<button id="drawer-grip" type="button" class="drawer-grip" :class="{ folded: !open }" :title="label" :aria-label="label"
		:aria-expanded="open ? 'true' : 'false'" aria-controls="rabbithole-sidebar" @click="layout.toggleDock()">
		<span class="drawer-grip-mark" aria-hidden="true">{{ mark }}</span>
	</button>
</template>
