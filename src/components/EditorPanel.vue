<script setup>
/*
 * The timeline editor's panel: the editor itself, and saving.
 *
 * TimelineEditor (src/editor/) still renders itself into a container by
 * hand; this component gives it the container, the data and the player,
 * and owns what sits around it: the Save button, the status line, Copy
 * YAML, the shortcuts help. Converting the editor's own rendering to Vue
 * is the next piece of work; its model, EditableTrackData, already is
 * one.
 *
 * "Saved" means PickiPedia made a revision. The words come from one
 * place, EditableTrackData.saveStateText(), and the save reads the wiki's
 * answer rather than assuming it.
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';

import { useLayoutStore } from '../stores/layout.js';
import { usePlayerStore } from '../stores/player.js';
import { useSongStore } from '../stores/song.js';
import { usePaneStore } from '../stores/pane.js';
import { useAccountStore } from '../stores/account.js';
import { EditableTrackData } from '../editor/EditableTrackData.js';
import { TimelineEditor } from '../editor/TimelineEditor.js';
import { KeyboardShortcuts } from '../editor/keyboard-shortcuts.js';
import { saveMetadata, metadataYaml } from '../wiki/api.js';
import { loginHref } from '../wiki/urls.js';

const layout = useLayoutStore();
const player = usePlayerStore();
const songs = useSongStore();
const pane = usePaneStore();
const account = useAccountStore();

const CONTAINER_ID = 'timeline-editor-container';

let data = null;
let editor = null;
let shortcuts = null;

const hasUnsaved = ref( false );
const stateText = ref( 'No changes' );
const saving = ref( false );
const status = ref( { kind: '', html: '' } );
const helpHtml = ref( '' );
const exportBox = ref( null );

const saveLabel = computed( () => {
	if ( saving.value ) {
		return 'Saving...';
	}
	return hasUnsaved.value ? 'Save to PickiPedia' : stateText.value;
} );

const song = computed( () => player.song || songs.current );

function build() {
	dispose();
	const current = song.value;
	if ( ! current || ! player.model ) {
		return;
	}
	data = new EditableTrackData( current, {
		recordingTitle: `${ current.title } (${ current.album })`,
		onDirtyChange: ( unsaved, text ) => {
			hasUnsaved.value = unsaved;
			stateText.value = text;
		},
	} );
	editor = new TimelineEditor( CONTAINER_ID, data, player.model );
	shortcuts = new KeyboardShortcuts( editor, data, { onSave: save } );
	helpHtml.value = shortcuts.getHelpHTML();
	hasUnsaved.value = data.hasUnsaved;
	stateText.value = data.saveStateText();
}

function dispose() {
	if ( shortcuts ) {
		shortcuts.dispose();
	}
	if ( editor ) {
		editor.dispose();
	}
	if ( data ) {
		data.dispose();
	}
	shortcuts = editor = data = null;
}

async function save() {
	if ( ! data ) {
		return;
	}
	// In the raw view, what's typed is what gets saved. If it doesn't
	// parse, say so and save nothing.
	try {
		if ( editor ) {
			editor.applyPendingRawYaml();
		}
	} catch ( err ) {
		status.value = { kind: 'error', html: escape( err.message ) };
		return;
	}
	if ( ! data.isDirty ) {
		status.value = { kind: '', html: 'No changes to save' };
		return;
	}
	const current = song.value;
	if ( ! current || ! current._metadataTitle ) {
		status.value = { kind: 'error', html: 'This song has no metadata page to save to.' };
		return;
	}

	saving.value = true;
	status.value = { kind: '', html: '' };
	try {
		const result = await saveMetadata( current._metadataTitle, metadataYaml( data.workingData, current ) );
		if ( result.kind === 'login' ) {
			// The edits are kept in this browser, and Special:UserLogin
			// returns into Rabbithole with the editor open: sign in and
			// press Save again.
			data.backupNow();
			account.refresh();
			const url = loginHref( {
				track: current._alias || current._trackCid,
				page: pane.shown || pane.wanted,
				edit: true,
			} );
			status.value = {
				kind: 'error',
				html: 'Not logged in. <a href="' + escape( url ) + '">'
					+ 'Log in to PickiPedia</a> to save — your edits stay here and reopen with the chart.',
			};
		} else if ( result.kind === 'unchanged' ) {
			data.markSaved( { unchanged: true } );
			status.value = { kind: '', html: 'PickiPedia already had exactly this. No new revision.' };
		} else if ( result.kind === 'saved' ) {
			data.markSaved( { revisionId: result.revisionId } );
			status.value = { kind: 'success', html: `Saved, revision ${ result.revisionId }` };
		} else {
			status.value = { kind: 'error', html: escape( result.message ) };
		}
	} catch ( err ) {
		console.error( 'Save failed:', err );
		status.value = { kind: 'error', html: escape( err.message ) };
	} finally {
		saving.value = false;
	}
}

/*
 * The YAML, in your hand: copying the text and pasting it into the page
 * needs nobody to grant anybody anything, and it is the same bytes the
 * save would have written (Skyler, 25 Oct 2026).
 */
async function exportYaml() {
	if ( ! data ) {
		return;
	}
	const yaml = metadataYaml( data.workingData, song.value );
	let copied = false;
	try {
		await navigator.clipboard.writeText( yaml );
		copied = true;
	} catch ( err ) {
		// Clipboard needs a secure context; showing the text is the same text, selectable.
	}
	exportBox.value = { yaml, copied, page: song.value && song.value._metadataTitle };
	status.value = { kind: '', html: '' };
	await nextTick();
	const ta = document.querySelector( '.yaml-export-box textarea' );
	if ( ta ) {
		ta.focus();
		ta.select();
	}
}

function escape( s ) {
	return String( s ).replace( /[&<>"]/g, ( c ) => ( { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ c ] ) );
}

function backupIfDirty() {
	if ( editor ) {
		try {
			editor.applyPendingRawYaml();
		} catch ( err ) {
			// Invalid raw YAML stays unapplied; keep the last valid workingData.
		}
	}
	if ( data && data.isDirty ) {
		data.backupNow();
	}
}

onMounted( () => {
	build();
	window.addEventListener( 'pagehide', backupIfDirty );
} );
onBeforeUnmount( () => {
	window.removeEventListener( 'pagehide', backupIfDirty );
	backupIfDirty();
	dispose();
} );

// The song changed under an open editor: the edits are kept in the
// browser's backup for that recording, and the editor shows the new song.
// Paused or played anywhere (Webamp, the sidebar's carrot), the ruler's
// carrot says so: the editor's ticks stop when the song does.
watch( () => player.status, () => {
	if ( editor ) {
		editor._showCarrot();
	}
} );

watch( song, ( next, prev ) => {
	if ( next === prev ) {
		return;
	}
	if ( data && data.isDirty ) {
		data.backupNow();
	}
	build();
} );
</script>

<template>
	<div id="editor-panel" class="editor-panel">
		<div class="editor-panel-header">
			<h3>Timeline Editor</h3>
			<button id="editor-close-btn" class="editor-close-btn" title="Close editor" @click="layout.editorOpen = false">x</button>
		</div>
		<div :id="CONTAINER_ID"></div>
		<div class="editor-save-section">
			<button id="save-to-wiki-btn" class="btn-save-wiki" :class="{ saving }" :disabled="!hasUnsaved || saving" @click="save">{{ saveLabel }}</button>
			<button id="export-yaml-btn" class="btn-save-wiki" @click="exportYaml">Copy YAML</button>
			<span id="save-status" :class="status.kind" v-html="status.html"></span>
		</div>
		<div v-if="exportBox" class="yaml-export-box">
			<p>
				<strong>{{ exportBox.copied ? 'Copied.' : 'Select and copy this.' }}</strong>
				Paste it as the whole contents of
				<a v-if="exportBox.page" :href="'/index.php?title=' + encodeURIComponent( exportBox.page ) + '&action=edit'" target="_blank" rel="noopener"><code>{{ exportBox.page }}</code></a>
				<span v-else>the track’s <code>Release:&lt;cid&gt;/Metadata</code> page</span>.
			</p>
			<textarea readonly :value="exportBox.yaml"></textarea>
			<button @click="exportBox = null">Close</button>
		</div>
		<div id="keyboard-help" v-html="helpHtml"></div>
	</div>
</template>
