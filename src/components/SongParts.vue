<script setup>
/*
 * The song laid out left to right, the block you are in lit.
 *
 * A chart no taller than two lines, whatever the song's length (Justin,
 * #rabbithole, 13 Nov 2026, item 3b: "if the chart is too long to fit on
 * two lines, it needs to be shown as two lines and somehow elegantly
 * scroll and give the user the feeling that it's moving forward -- or, if
 * they seek, backward"). Vertical space in the player is the scarce thing,
 * and a 35-part song (Barlows) was taking either five rows of it or two
 * rows of seven-pixel slivers.
 *
 * So: the blocks keep a legible width and wrap as many rows as they need,
 * and the chart is a window two rows tall onto that. The row the song is
 * in sits at the top of the window, the row after it below -- what you are
 * in, and what is coming. As the song moves on the strip slides up by a
 * row; seek backwards and it slides back down. The slide is the thing that
 * says which way the song is going.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { usePlayerStore } from '../stores/player.js';

const player = usePlayerStore();

const chart = ref( null );
const strip = ref( null );
/** How far the strip is slid up, in pixels: always a whole number of rows. */
const offset = ref( 0 );
/** The window's height, in rows: one row for a short song, never more than two. */
const rows = ref( 1 );
/** How many blocks go in a row. */
const columns = ref( 1 );

const WINDOW_ROWS = 2;

const vars = computed( () => ( {
	'--parts-rows': rows.value,
	'--parts-columns': columns.value,
	'--parts-offset': offset.value + 'px',
} ) );

/*
 * How the blocks lie, and where the window sits on them.
 *
 * The columns are counted from the width rather than left to auto-fill,
 * so the answer does not depend on the layout it then changes. A song
 * that fits in two rows is split evenly between them, as it always was --
 * the second row reads as the rest of the first. A song that does not fit
 * keeps the widest columns that do and scrolls instead.
 */
function place() {
	const box = strip.value;
	const frame = chart.value;
	if ( ! box || ! frame ) {
		return;
	}
	const blocks = [ ...box.children ];
	if ( ! blocks.length ) {
		rows.value = 1;
		offset.value = 0;
		return;
	}

	const style = getComputedStyle( frame );
	const gap = parseFloat( style.getPropertyValue( '--parts-gap' ) ) || 0;
	const min = parseFloat( style.getPropertyValue( '--parts-block' ) ) || 1;
	const width = frame.clientWidth;
	const fit = Math.max( 1, Math.floor( ( width + gap ) / ( min + gap ) ) );
	const needed = Math.ceil( blocks.length / fit );

	columns.value = needed <= WINDOW_ROWS ? Math.ceil( blocks.length / needed ) : fit;
	rows.value = Math.min( needed, WINDOW_ROWS );

	const active = blocks[ player.partIndex ];
	if ( ! active || needed <= WINDOW_ROWS ) {
		offset.value = 0;
		return;
	}
	// Measured, not multiplied: offsetTop is the honest answer to which
	// row a block ended up in. The last window shows the last two rows,
	// because a song does not scroll past its own ending.
	const top = blocks[ 0 ].offsetTop;
	const tops = [ ...new Set( blocks.map( ( b ) => b.offsetTop ) ) ].sort( ( a, b ) => a - b );
	const last = tops[ Math.max( 0, tops.length - WINDOW_ROWS ) ] - top;
	offset.value = Math.max( 0, Math.min( active.offsetTop - top, last ) );
}

let frame = null;
function replace() {
	cancelAnimationFrame( frame );
	frame = requestAnimationFrame( () => nextTick( place ) );
}

watch( () => [ player.partIndex, player.parts.length ], replace, { immediate: true } );

let watcher = null;
onMounted( () => {
	place();
	if ( typeof ResizeObserver === 'function' ) {
		watcher = new ResizeObserver( replace );
		watcher.observe( chart.value );
	}
} );

onBeforeUnmount( () => {
	cancelAnimationFrame( frame );
	if ( watcher ) {
		watcher.disconnect();
	}
} );
</script>

<template>
	<div id="parts-chart" ref="chart" class="parts-chart" :class="{ 'two-rows': rows > 1 }" :style="vars">
		<div ref="strip" class="parts-strip">
			<div
				v-for="( part, i ) in player.parts"
				:id="'part-' + i"
				:key="i"
				class="part-box"
				:class="{ active: i === player.partIndex }"
				title="Jump to this part"
				@click="player.seekToPart( i )"
			>{{ part }}</div>
		</div>
	</div>
</template>
