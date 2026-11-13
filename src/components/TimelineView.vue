<script setup>
/*
 * The timeline, to watch rather than edit: the ruler, the song's parts and
 * solos down it, and the rabbit running down it as the song plays. A click
 * on it seeks. The editor's own ruler with no forms, so it is the same
 * picture the editor shows, and the pencil turns it into the editor
 * (Justin, #rabbithole, 13 Nov 2026: "the rabbit going down the timeline -
 * but without the actual edit boxes ... as a default view when you first
 * start playing the song").
 *
 * It shows the chart as saved, which is what the player plays: no browser
 * backup of unsaved edits is restored here, and nothing is backed up.
 *
 * Its labels name the instrument or the picker, instruments by default
 * (layout.timelineLabels).
 *
 * The x folds it to a tab at the page's edge, and the tab unfolds it;
 * either way is remembered (layout.timelineView).
 */
import { computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useLayoutStore } from '../stores/layout.js';
import { usePlayerStore } from '../stores/player.js';
import { useSongStore } from '../stores/song.js';
import { EditableTrackData } from '../editor/EditableTrackData.js';
import { TimelineEditor } from '../editor/TimelineEditor.js';

const layout = useLayoutStore();
const player = usePlayerStore();
const songs = useSongStore();

const CONTAINER_ID = 'timeline-view-container';

let data = null;
let view = null;

const song = computed( () => player.song || songs.current );

function build() {
	dispose();
	const current = song.value;
	if ( ! layout.timelineView || ! current || ! player.model ) {
		return;
	}
	data = new EditableTrackData( current, { enableBackup: false, restoreBackup: false } );
	view = new TimelineEditor( CONTAINER_ID, data, player.model, { viewOnly: true, labelBy: layout.timelineLabels } );
}

function dispose() {
	if ( view ) {
		view.dispose();
	}
	if ( data ) {
		data.dispose();
	}
	view = data = null;
}

onMounted( build );
onBeforeUnmount( dispose );

watch( () => player.status, () => {
	if ( view ) {
		view._showCarrot();
	}
} );
watch( [ song, () => player.model ], build );
watch( () => layout.timelineLabels, ( by ) => {
	if ( view ) {
		view.labelBy = by;
		view.render();
	}
} );
watch( () => layout.timelineView, async () => {
	await nextTick();
	build();
} );
</script>

<template>
	<div id="timeline-view" class="timeline-view" :class="{ folded: ! layout.timelineView }">
		<template v-if="layout.timelineView">
			<div class="timeline-view-header">
				<span class="timeline-view-title">Timeline</span>
				<button type="button" class="timeline-view-edit" title="Edit this song's timeline"
					@click="layout.editorOpen = true">✎ edit</button>
				<button type="button" class="timeline-view-close" title="Fold the timeline away"
					aria-label="Fold the timeline away" @click="layout.timelineView = false">×</button>
			</div>
			<div class="timeline-view-labels" role="group" aria-label="Label the timeline by">
				<button type="button" :class="{ on: layout.timelineLabels === 'instrument' }"
					:aria-pressed="layout.timelineLabels === 'instrument'"
					@click="layout.timelineLabels = 'instrument'">instruments</button>
				<button type="button" :class="{ on: layout.timelineLabels === 'name' }"
					:aria-pressed="layout.timelineLabels === 'name'"
					@click="layout.timelineLabels = 'name'">pickers</button>
			</div>
			<div :id="CONTAINER_ID" class="timeline-view-body"></div>
		</template>
		<button v-else type="button" class="timeline-view-tab" title="Show the timeline"
			@click="layout.timelineView = true">timeline</button>
	</div>
</template>
