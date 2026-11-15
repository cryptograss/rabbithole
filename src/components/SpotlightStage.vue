<script setup>
/*
 * The spotlight: the player pane goes dark, and one picker steps out of
 * the row into the light.
 *
 * "Black out everything in the player pane except that person and their
 * glow" (Justin, #rabbithole, 15 Nov 2026, item 22), and then, having
 * seen it: "jarring... The fade and flashes are too fast, and the zoom is
 * hardly palpable" (#visual-effects, the same day). So it is a lighting
 * cue now and not a switch: the house lights go down over most of a
 * second, a beam opens from above, the name lifts off its card and
 * travels to the middle of the pane, growing as it comes; it holds there,
 * breathing; and when the dark is over it goes home while the lights come
 * up slowly behind it.
 *
 * The room is the pane itself: the stage is laid over it by the pane's
 * own anchor (app.css names #rabbithole-sidebar `--rh-player-pane`), so it is
 * the pane's size in either layout, however the pane is scrolled or the
 * window resized, with nothing measured. The one thing measured is where
 * the card stands, because that is where the name leaves from and where
 * it lands.
 *
 * It is a state, with a way in and a way out, not a film: whenever the
 * dark starts or stops -- the chart's marker, a seek, a pause -- the
 * lights go down or come up from wherever they are.
 */
import { computed, ref } from 'vue';
import MusicianCard from './MusicianCard.vue';
import { fxColor } from '../player/glow.js';

const props = defineProps( {
	// The spotlight in force, or null: { target, color, key }.
	effect: { type: Object, default: null },
	// (name) => the DOMRect of that picker's card, or null.
	whereIs: { type: Function, default: () => null },
} );

// As long as the slowest thing in each direction (styles/ensemble.css).
const DURATION = { enter: 1200, leave: 1700 };

const style = computed( () => ( props.effect ? { '--spot': fxColor( props.effect.color ) } : null ) );

const heroCard = ref( null );

// Where the name sits inside the hero, as it was measured coming in.
let lift = null;

/*
 * Where the name leaves from, how big it is there, and how big it gets:
 * variables the stylesheet's two ends read. The name starts exactly over
 * itself on its card, at the size it has there, and comes back to exactly
 * that. Measured with the stage's transitions off, or setting the
 * variables would itself be a move to animate.
 */
function place( el, name, { coming = false } = {} ) {
	const hero = el.querySelector( '.spot-hero' );
	if ( ! hero ) {
		return;
	}
	el.classList.add( 'measuring' );
	// Its middle is where it is drawn, whatever size it is drawn at.
	const drawn = hero.getBoundingClientRect();
	const middle = { x: drawn.left + drawn.width / 2, y: drawn.top + drawn.height / 2 };

	if ( coming ) {
		// Nothing has moved it yet, so this is its own size.
		const stage = el.getBoundingClientRect();
		// As big as the pane lets it be, and never so little that you
		// have to look for the difference.
		const fits = Math.min( 0.86 * stage.width / Math.max( 1, drawn.width ), 0.5 * stage.height / Math.max( 1, drawn.height ) );
		el.style.setProperty( '--hero-scale', Math.max( 1.2, Math.min( 2.1, fits ) ).toFixed( 3 ) );
		const who = heroCard.value && heroCard.value.whoRect();
		lift = who && who.height ? { dx: who.left - middle.x, dy: who.top - middle.y, height: who.height } : null;
	}

	const from = props.whereIs( name );
	if ( from && from.height && lift ) {
		const scale = from.height / lift.height;
		el.style.setProperty( '--from-scale', scale.toFixed( 3 ) );
		el.style.setProperty( '--from-x', ( from.left - middle.x - scale * lift.dx ).toFixed( 1 ) + 'px' );
		el.style.setProperty( '--from-y', ( from.top - middle.y - scale * lift.dy ).toFixed( 1 ) + 'px' );
	}
	// Read once, so the variables are in place before the transitions are.
	void el.offsetWidth;
	el.classList.remove( 'measuring' );
}

const onEnter = ( el ) => props.effect && place( el, props.effect.target, { coming: true } );
// Home may have moved while the lights were down.
const onBeforeLeave = ( el ) => el.dataset.target && place( el, el.dataset.target );
</script>

<template>
	<Transition name="spot" :duration="DURATION" @enter="onEnter" @before-leave="onBeforeLeave">
		<div v-if="effect" :key="effect.key" class="rh-spotlight" :style="style" :data-target="effect.target" aria-hidden="true">
			<div class="spot-dark" />
			<div class="spot-beam" />
			<div class="spot-pool" />
			<div class="spot-hero">
				<MusicianCard ref="heroCard" :name="effect.target" hero />
			</div>
		</div>
	</Transition>
</template>
