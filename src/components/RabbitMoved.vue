<script setup>
/*
 * The rabbit moved, said where the band is: under the cards, where the
 * rabbit itself has just gone from one card to another.
 *
 * Justin, #connectome, 21 Nov 2026, 01:56Z: "I just heard August and then
 * Paint Exchange, and the rabbit was on Harry. Then new next song. I'm
 * guessing that's because there isn't another Harry song? In that event,
 * the rabbit needs to change to another picker for whom a next song is
 * available."
 *
 * It did end in silence, and nothing said why. So when the picker being
 * chased has no song left, the rabbit goes to another of the band who has
 * (stores/picker.js, moveOn), and this says so: who ran out, who it is on
 * now, and the song that follows. With nothing at all to hand out, that the
 * music stops here. What the rabbithole reached for itself was said too,
 * until Justin nixed it (#connectome, 22 Nov 2026: "We see ['Next is the
 * rabbithole's own pick: <track>'] all the time now. It's not needed; I say
 * nix it. We don't have enough material yet for there to be a meaningful
 * way for there to be long sequence of songs. When we do, we'll figure out
 * how to communicate this."): the song just comes on now. A line, not a
 * card over anything: it goes when read (a click), or when the next song
 * comes on (the store takes it back: no timer here, as nowhere in the shell).
 */
import { computed } from 'vue';
import { usePickerStore } from '../stores/picker.js';

const picker = usePickerStore();

/** A song as a person says it: its page's title without the namespace. */
const songName = ( song ) => String( song || '' ).replace( /^Song:/, '' );

const says = computed( () => {
	const m = picker.moved;
	if ( ! m ) {
		return '';
	}
	// The rabbithole's own pick is never said: the song just comes on (Justin,
	// #connectome, 22 Nov 2026: not enough material yet for a sequence's end to
	// mean anything; when there is, we'll figure out how to say it).
	if ( ! m.to && m.song ) {
		return '';
	}
	if ( ! m.from ) {
		// A quest: nobody was being chased, and nothing at all is ready to follow.
		return 'Nobody on this song has another to lead to, and nothing else is ready to follow this one.';
	}
	if ( m.to ) {
		return `${ m.from } has no more songs to play here. The rabbit is on ${ m.to } now, for ${ songName( m.song ) }.`;
	}
	return `${ m.from } has no more songs to play here, and nothing else is ready to follow this one.`;
} );
</script>

<template>
	<p v-if="says" class="rabbit-moved" role="status">
		<span class="rabbit-moved-says">🐇 {{ says }}</span>
		<button type="button" class="rabbit-moved-ok" title="Got it" aria-label="Dismiss" @click="picker.heardMoved()">×</button>
	</p>
</template>

<style scoped>
.rabbit-moved {
	display: flex;
	align-items: flex-start;
	gap: 6px;
	margin: 6px 8px 2px;
	padding: 6px 8px;
	border-left: 3px solid #4a7c59;
	border-radius: 3px;
	background: rgba( 74, 124, 89, 0.12 );
	color: inherit;
	font-size: 12px;
	line-height: 1.35;
}
.rabbit-moved-says {
	flex: 1 1 auto;
	min-width: 0;
}
.rabbit-moved-ok {
	flex: 0 0 auto;
	padding: 0 4px;
	border: 0;
	background: none;
	color: inherit;
	font: inherit;
	font-size: 14px;
	line-height: 1;
	cursor: pointer;
	opacity: 0.7;
}
.rabbit-moved-ok:hover {
	opacity: 1;
}
</style>
