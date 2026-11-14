<script setup>
/*
 * The pill beside a picker's name in the title, while they are being
 * chased. It was a box above the title, two lines of warning-coloured
 * text for something the reader chose (Justin's point 13, 13 Nov 2026).
 * It is also the way to stop, so it says so when you point at it.
 */
defineProps( { name: { type: String, required: true } } );
defineEmits( [ 'stop' ] );
</script>

<template>
	<button class="pp-chasing" type="button" :title="'Stop chasing ' + name" @click="$emit( 'stop' )">🐇 chasing<span
		class="pp-chasing-stop"> — stop</span></button>
</template>
