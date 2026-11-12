<script setup>
/*
 * The play button is a carrot: its body is the ▶, pointing right, with the
 * greens out its left end, and it passes through a circle (Skyler, #rabbithole,
 * 7 Nov 2026). Playing, the carrot stays a carrot: two notches cut through
 * its body read as pause. Given a progress (0 to 1), the circle fills with
 * it, as the folded sidebar's ring did. Given how much is eaten (0 to 1),
 * that much of the carrot is gone from the tip.
 */
import { computed, useId } from 'vue';

const props = defineProps( {
	playing: { type: Boolean, default: false },
	progress: { type: Number, default: null },
	size: { type: Number, default: 48 },
	eaten: { type: Number, default: 0 },
} );
defineEmits( [ 'toggle' ] );

const R = 15;
const CIRCUMFERENCE = 2 * Math.PI * R;
const dashOffset = computed( () => {
	const fraction = Math.max( 0, Math.min( 1, props.progress || 0 ) );
	return CIRCUMFERENCE * ( 1 - fraction );
} );
const maskId = `carrot-notches-${ useId() }`;

// The body runs from its wide end at x 15 (half-height 11) to its tip at x 42.
const TIP = 42, WIDE = 15, HALF = 11;
const halfAt = ( x ) => HALF * ( TIP - x ) / ( TIP - WIDE );

/*
 * The carrot goes as the song goes: a clean edge moves from the tip
 * toward the greens with how much is played, and at the end only the
 * greens are left in the ring. It used to be bitten off in a cartoon
 * chomp, with teeth marks, chewing and crumbs; Skyler, 12 Nov 2026:
 * "just have the carrot disappear as the song progresses". That also
 * ends the chew and crumb animations, which repainted the carrot every
 * frame while a song played (Justin asked about the cost, 11 Nov).
 */
const edge = computed( () => {
	const fraction = Math.max( 0, Math.min( 1, props.eaten || 0 ) );
	return TIP - fraction * ( TIP - WIDE );
} );

/*
 * Pause, while it plays: two notches through what is left of the carrot,
 * sized to fit it, so a carrot nearly gone still reads as pause.
 */
const notches = computed( () => {
	const end = Math.min( 36, edge.value - 1 );
	const room = Math.max( 4, end - ( WIDE + 2 ) );
	const w = Math.min( 3.5, room * 0.3 );
	const gap = Math.min( 3, w * 0.9 );
	const mid = WIDE + 2 + room / 2;
	const h = Math.min( 16, 2 * halfAt( mid ) * 0.8 );
	return [ mid - gap / 2 - w, mid + gap / 2 ].map( ( x ) => ( { x, y: 24 - h / 2, w, h } ) );
} );
</script>

<template>
	<button class="carrot-btn" :class="{ playing }" :title="playing ? 'Pause' : 'Play'"
		:aria-label="playing ? 'Pause' : 'Play'" @click="$emit( 'toggle' )">
		<svg :width="size" :height="size" viewBox="0 0 48 48" aria-hidden="true">
			<defs>
				<mask :id="maskId">
					<rect x="0" y="0" width="48" height="48" fill="white" />
					<rect v-if="edge < TIP" class="carrot-gone" :x="edge" y="0" :width="48 - edge" height="48" fill="black" />
					<g v-if="playing" fill="black">
						<rect v-for="( n, i ) in notches" :key="i" :x="n.x" :y="n.y" :width="n.w" :height="n.h" rx="1" />
					</g>
				</mask>
			</defs>
			<circle class="carrot-ring" cx="25" cy="24" :r="R" />
			<circle v-if="progress !== null" class="carrot-ring-progress" cx="25" cy="24" :r="R"
				transform="rotate(-90 25 24)" :stroke-dasharray="CIRCUMFERENCE" :stroke-dashoffset="dashOffset" />
			<g class="carrot-greens">
				<path d="M15 24 C 12 17, 7 12, 2 10 C 4 15, 8 21, 15 24 Z" />
				<path d="M15 24 C 10 21, 4 21, 0 24 C 4 27, 10 27, 15 24 Z" />
				<path d="M15 24 C 12 31, 7 36, 2 38 C 4 33, 8 27, 15 24 Z" />
			</g>
			<g :mask="`url(#${ maskId })`">
				<path class="carrot-body" d="M15 13 L 42 24 L 15 35 Z" />
				<g class="carrot-ridges">
					<path d="M19 17.5 l 3 1.2" />
					<path d="M18 27 l 4 -1.6" />
					<path d="M28 22 l 3 1.2" />
					<path d="M33 25.5 l 2.5 -1" />
				</g>
			</g>
		</svg>
	</button>
</template>

<style scoped>
.carrot-btn {
	border: none;
	background: none;
	padding: 0;
	cursor: pointer;
	line-height: 0;
	transition: transform 0.2s;
}

.carrot-btn:hover {
	transform: scale(1.08);
}

.carrot-ring {
	fill: none;
	stroke: #e0e0e0;
	stroke-width: 2.5;
}

.carrot-ring-progress {
	fill: none;
	stroke: #4a7c59;
	stroke-width: 2.5;
	stroke-linecap: round;
	transition: stroke-dashoffset 0.2s;
}

.carrot-greens path {
	fill: #4a7c59;
	stroke: #3a6847;
	stroke-width: 0.6;
	stroke-linejoin: round;
}

.carrot-body {
	fill: #ff6b35;
	stroke: #ff6b35;
	stroke-width: 3;
	stroke-linejoin: round;
	filter: drop-shadow(0 1px 1.5px rgba(180, 60, 20, 0.35));
}

.playing .carrot-body {
	fill: #e55a2b;
	stroke: #e55a2b;
}

.carrot-ridges path {
	fill: none;
	stroke: rgba(160, 50, 10, 0.45);
	stroke-width: 1;
	stroke-linecap: round;
}
</style>
