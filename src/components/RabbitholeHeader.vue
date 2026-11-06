<script setup>
import { computed } from 'vue';
import { useLayoutStore } from '../stores/layout.js';
import rabbit from '../images/rabbit.png';

const layout = useLayoutStore();

// ◀/▶ fold the sidebar; ▼/▲ collapse the bar.
const icon = computed( () => {
	if ( layout.isBar ) {
		return layout.collapsed ? '▲' : '▼';
	}
	return layout.minimized ? '▶' : '◀';
} );

function onLogo() {
	if ( ! layout.isBar && layout.minimized ) {
		layout.toggleDock();
	}
}
</script>

<template>
	<div id="rabbithole-header" class="rabbithole-header">
		<img :src="rabbit" alt="Rabbithole" style="cursor: pointer" @click="onLogo">
		<h1>rabbithole</h1>
		<span class="alpha">BETA</span>
		<button class="minimize-btn" title="Minimize/Maximize" @click="layout.toggleDock()">
			<span id="minimize-icon">{{ icon }}</span>
		</button>
	</div>
</template>
