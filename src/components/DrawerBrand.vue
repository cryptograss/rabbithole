<script setup>
/*
 * Rabbithole's own mark, at the top of the drawer, right on top of Webamp.
 *
 * Justin, #connectome, 21 Nov 2026, 23:27Z: "Let's put the current Rabbithole
 * BETA 2, with the rabbit, at the top of the rabbithole drawer, just above
 * webamp (when I say "just above", I mean no margin or padding at all)." The
 * bar's corner names the Oracle now (RabbitholeHeader.vue).
 */
import rabbit from '../images/rabbit.png';
</script>

<template>
	<div class="drawer-brand">
		<img :src="rabbit" alt="" width="20" height="20">
		<span class="drawer-brand-name">rabbithole</span>
		<span class="alpha">BETA 2</span>
	</div>
</template>
