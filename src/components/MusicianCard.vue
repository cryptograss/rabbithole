<script setup>
/*
 * One picker's card: who they are, what they have in hand, and what the
 * chart says about them at this moment.
 *
 * The card reads the player itself, by name. The ensemble above it only
 * says who is on it and in what order, so the list is drawn again when
 * the order changes and not four times a second with the clock -- which
 * is what let a card that was sliding to a new place start its slide over
 * on every tick.
 *
 * What it wears is all state: a scene from the chart (lead, pickup, out),
 * and a class for each effect in force on it. The stylesheet
 * (styles/ensemble.css) turns each into light, with a quick way in and a
 * slow way out; nothing here keeps time.
 */
import { computed, ref, watch } from 'vue';
import { usePlayerStore } from '../stores/player.js';
import { fxColor } from '../player/glow.js';

const props = defineProps( {
	name: { type: String, required: true },
	// Where the card stands in the order, for the small delays that make
	// a row of cards move as a wave rather than as a block.
	rank: { type: Number, default: 0 },
	// This is the picker being chased: the rabbit is on their card, so
	// the chase is visible wherever the pane has wandered to (Justin's
	// point 12, 13 Nov 2026).
	chased: { type: Boolean, default: false },
	// Their name has stepped out into the spotlight; the card keeps its
	// place for them.
	away: { type: Boolean, default: false },
	// This is the copy that stepped out.
	hero: { type: Boolean, default: false },
} );
defineEmits( [ 'select' ] );

const player = usePlayerStore();

const card = computed( () => player.cards.find( ( c ) => c.name === props.name ) || null );
const slug = computed( () => 'musician-' + props.name.replace( /\s+/g, '-' ).toLowerCase() );

const mine = computed( () => player.effects.filter( ( e ) => e.target === props.name ) );
const flourish = computed( () => mine.value.find( ( e ) => e.kind === 'flourish' ) || null );
const spotlight = computed( () => mine.value.find( ( e ) => e.kind === 'spotlight' ) || null );
const entering = computed( () => mine.value.some( ( e ) => e.kind === 'enter' ) );
// The whole band's flash is everybody's but the engineer's, who was not playing.
const band = computed( () => ( card.value && ! card.value.engineer
	? player.effects.find( ( e ) => e.kind === 'bandFlash' ) || null : null ) );

// The one light a card shows at a time: the rarest wins.
const light = computed( () => spotlight.value || flourish.value || band.value );

/*
 * What that light is made of stays on the card after the light has gone:
 * it goes out slowly, and it has to go out in the colour it had.
 */
const colours = ref( null );
watch( light, ( now ) => {
	if ( now ) {
		colours.value = {
			'--fx-color': fxColor( now.color ),
			'--fx-level': Math.max( 0.35, Math.min( 1.3, now.intensity ) ),
			'--fx-pulse': Math.max( 0.5, Math.min( 6, now.pulse ) ) + 's',
		};
	}
}, { immediate: true } );

/*
 * The star for a break, the microphone for a verse: a singer is the one
 * card that moves, and the microphone is why (Justin, #visual-effects,
 * 15 Nov 2026).
 */
const mark = computed( () => {
	if ( ! card.value ) {
		return null;
	}
	return card.value.singing ? '🎤' : ( card.value.star ? '⭐' : null );
} );

const classes = computed( () => {
	const c = card.value;
	const lit = c.scene === 'lead' || c.scene === 'pickup' || !! light.value || entering.value;
	return [
		c.scene,
		{
			singing: c.singing,
			'engineer-card': c.engineer,
			chased: props.chased,
			'is-lit': lit,
			'is-away': props.away,
			'is-hero': props.hero,
			'fx-flourish': !! flourish.value,
			'fx-glow': !! spotlight.value,
			'fx-band': !! band.value && ! spotlight.value && ! flourish.value,
			'fx-enter': entering.value,
		},
	];
} );

/*
 * A pickup leads in to the next pass, and the chart knows how long that
 * is: from its marker to the next one. The card fills across in that
 * time, so the colour arrives when the downbeat does. How far in we
 * already were when the pickup was first seen is noted once, here, and
 * not on every tick: it is where the fill starts from, and a fill that
 * was told a new starting point four times a second would never move.
 */
const leadIn = ref( null );
watch( () => ( card.value && card.value.scene === 'pickup' ? card.value.since : null ), ( since ) => {
	if ( since === null ) {
		leadIn.value = null;
		return;
	}
	const until = isFinite( card.value.until ) ? card.value.until : since + 4;
	leadIn.value = {
		seconds: Math.max( 0.4, until - since ),
		elapsed: Math.max( 0, player.time - since ),
	};
}, { immediate: true } );

/*
 * Where the name is on the screen. A spotlight lifts the name off the
 * card and sets it down again, and both ends have to be exactly here.
 */
const who = ref( null );
defineExpose( { whoRect: () => ( who.value ? who.value.getBoundingClientRect() : null ) } );

const style = computed( () => {
	const vars = { '--i': props.rank, ...colours.value };
	if ( leadIn.value ) {
		vars[ '--lead-in' ] = leadIn.value.seconds + 's';
		vars[ '--lead-in-from' ] = '-' + leadIn.value.elapsed + 's';
	}
	return vars;
} );
</script>

<template>
	<div
		v-if="card"
		:id="hero ? null : slug"
		class="musician-item musician-card"
		:class="classes"
		:style="style"
		:data-musician="hero ? null : card.name"
		@click="$emit( 'select' )"
	>
		<!-- The light, back to front: a glow outside the card, the card's own
		     face with the colour that fills it and the light that washes
		     over it, and a ring that leaves it. All of it is drawn under the
		     words, and none of it is anything a reader needs read to them. -->
		<span class="mc-halo" aria-hidden="true" />
		<span class="mc-plate" aria-hidden="true">
			<span class="mc-fill" />
			<span class="mc-wash" />
			<span class="mc-sheen" />
		</span>
		<span class="mc-ring" aria-hidden="true" />

		<!-- The rabbit sits at the right end of the card. On the left it
		     pushed the name across and landed next to the star, which are
		     two different things saying two different things (Justin's
		     item 24, 15 Nov 2026). -->
		<span v-if="chased" class="chasing-rabbit" title="Chasing them: their songs play one after another">🐇</span>
		<!-- The instrument never breaks across lines: "(5-string banjo)" is one
		     thing, and split it reads as two (Justin, 7 Nov 2026). -->
		<div class="musician-name"><Transition name="mark" mode="out-in"><span v-if="mark" :key="mark" class="mc-mark">{{ mark }}</span></Transition><span ref="who" class="mc-who">{{ card.name }}</span>{{ card.instrument ? ' ' : '' }}<span v-if="card.instrument" class="musician-instrument">({{ card.instrument }})</span></div>
	</div>
</template>
