<script setup>
/*
 * The offer to chase a picker: a button beside their name.
 *
 * It was a bar above the title -- "🐇 Keep playing the songs X is on, one
 * after another." with the button at its end. Justin, #rabbithole 15 Nov
 * 2026, item 23: "The big bar 'Keep playing the songs <picker> is on...'
 * is awful. Just put the 'Chase <picker>' next to their name (ie, the
 * title of the page) and put that info in a tooltip."
 *
 * So the sentence is the tooltip and the button is the whole of it, in
 * the same place the chasing pill appears once you press it -- one spot
 * beside the name that says what the chase is doing, offered or running.
 *
 * "Follow" read as the social-media kind: press it and you are subscribed
 * to a person. What it does is play the songs they are on, one after
 * another, so it is a chase, and the rabbit is already doing the chasing
 * (Justin and Skyler, #rabbithole, 13 Nov 2026).
 */
import { computed } from 'vue';
import { firstName } from '../../wiki/chase.js';

const props = defineProps( { name: { type: String, required: true } } );
defineEmits( [ 'chase' ] );

const first = computed( () => firstName( props.name ) );
const says = computed( () => `Keep playing the songs ${ props.name } is on, one after another.` );
</script>

<template>
	<button class="pp-chase-go" type="button" :title="says" @click="$emit( 'chase', name )">🐇 Chase {{ first }}</button>
</template>
