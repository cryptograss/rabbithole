<script setup>
/*
 * The offer to chase a picker, on their page: one line.
 *
 * "Follow" read as the social-media kind: press it and you are subscribed
 * to a person. What it does is play the songs they are on, one after
 * another, so it is a chase, and the rabbit is already doing the chasing
 * (Justin and Skyler, #rabbithole, 13 Nov 2026).
 *
 * The next song is not named here. The offer named it ("First up: …"),
 * which took the line to two and told you something you had not asked
 * (Justin's point 10); the queue says what plays next, as it does for
 * everything else.
 */
import { computed } from 'vue';
import { firstName } from '../../wiki/chase.js';

const props = defineProps( { name: { type: String, required: true } } );
defineEmits( [ 'chase' ] );

const first = computed( () => firstName( props.name ) );
</script>

<template>
	<div class="pp-chase">🐇 Keep playing the songs <strong>{{ name }}</strong> is on, one after another.<button
		class="pp-chase-go" type="button" @click="$emit( 'chase', name )">Chase {{ first }}</button></div>
</template>
