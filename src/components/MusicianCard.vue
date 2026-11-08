<script setup>
import { computed } from 'vue';
import { glowShadows } from '../player/glow.js';

const props = defineProps( {
	card: { type: Object, required: true },
	effects: { type: Array, default: () => [] },
	dim: { type: Boolean, default: false },
} );
defineEmits( [ 'select' ] );

const slug = computed( () => 'musician-' + props.card.name.replace( /\s+/g, '-' ).toLowerCase() );

const flourish = computed( () => props.effects.find( ( e ) => e.kind === 'flourish' ) );
const spotlight = computed( () => props.effects.find( ( e ) => e.kind === 'spotlight' ) );
const flash = computed( () => props.effects.some( ( e ) => e.kind === 'flash' ) );

const classes = computed( () => [
	props.card.scene,
	{
		'engineer-card': props.card.engineer,
		'flourish-active': !! flourish.value,
		'spotlight-active': !! spotlight.value,
		flash: flash.value,
		'fx-dim': props.dim,
	},
] );

// The glow an effect asks for, as variables the stylesheet's keyframes read.
const style = computed( () => {
	const fx = spotlight.value || flourish.value;
	if ( ! fx ) {
		return null;
	}
	const glow = glowShadows( fx.color, fx.intensity );
	return { '--glow-min': glow.min, '--glow-max': glow.max, '--pulse': fx.pulse + 's' };
} );

const label = computed( () => ( props.card.star ? '⭐ ' : '' ) + props.card.name );
</script>

<template>
	<div
		:id="slug"
		class="musician-item musician-card"
		:class="classes"
		:style="style"
		:data-musician="card.name"
		@click="$emit( 'select' )"
	>
		<!-- The instrument never breaks across lines: "(5-string banjo)" is one
			thing, and split it reads as two (Justin, 7 Nov 2026). -->
		<div class="musician-name">{{ label + ( card.instrument ? ' ' : '' ) }}<span v-if="card.instrument" class="musician-instrument">({{ card.instrument }})</span></div>
		<div class="chartifact-line">{{ card.engineer ? 'Engineer' : 'Chartifact "0x1234ff" owned by cryptograss.eth' }}</div>
	</div>
</template>
