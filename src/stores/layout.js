/**
 * Which dock to wear, and what state it is in.
 *
 * The shape of the dock follows the shape of the window by default: a side
 * column costs width, a bottom bar costs height, and a screen always has
 * more of one than the other. Wide gets the sidebar, narrow gets the bar.
 *
 * The sidebar is the skin's 277px, so it holds down to a 700px window,
 * which leaves the article over 400px. That was 1100px, and zooming a desktop
 * browser in moved the player to the bottom far too soon (Justin, 11 Nov
 * 2026: "I'd like to be able to zoom in more and have the player remain
 * on the side").
 *
 * A person can overrule that, and the choice sticks (Skyler, 24 Oct 2026).
 * Precedence, highest first: ?layout= in the URL, so a link can show
 * somebody a particular one without changing their setting; then their
 * stored choice; then the window. The switch used to reload the page,
 * because the two layouts built the cards in different places; the cards
 * are a component now, so the layout changes in place.
 */

import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';

import { INITIAL_PARAMS, cameToEdit } from '../initial-params.js';
import { useMediaQuery } from '../composables/media-query.js';
import { TRAVERSE_MODES } from '../traverse.js';
import { GRAPH_START, startsOnSong } from '../shell.js';

export const AUTO_AT = 700;
/*
 * A phone, either way up: there the sidebar leaves the wiki no room at all,
 * so a phone always gets the bar and is not offered the switch (Skyler,
 * #rabbithole, 8 Nov 2026). Sideways, a phone is wide but short.
 *
 * A phone is a touch screen that small, not any window that small. Sized
 * by width and height alone, a desktop browser zoomed in counted as a
 * phone: the player went to the bottom whatever you had chosen, "use
 * auto" meant nothing, and the sideways-phone bar put Webamp mostly below
 * the page (Justin, 11 Nov 2026).
 */
const TOUCH = '(hover: none) and (pointer: coarse)';
export const PHONE = `${ TOUCH } and (max-width: 760px), ${ TOUCH } and (max-height: 520px)`;
const KEY = 'rabbitholeLayout';

function readStored() {
	try {
		const v = window.localStorage.getItem( KEY );
		return v === 'bar' || v === 'sidebar' ? v : null;
	} catch ( e ) {
		return null;
	}
}

function writeStored( choice ) {
	try {
		if ( choice ) {
			window.localStorage.setItem( KEY, choice );
		} else {
			window.localStorage.removeItem( KEY );
		}
	} catch ( e ) {
		// Private mode, or storage full: the choice holds for this page.
	}
}

const TIMELINE_KEY = 'rabbitholeTimelineView';
const LABELS_KEY = 'rabbitholeTimelineLabels';

function readFlag( key, fallback ) {
	try {
		const v = window.localStorage.getItem( key );
		return v === null ? fallback : v === 'on';
	} catch ( e ) {
		return fallback;
	}
}

function readLabels() {
	try {
		return window.localStorage.getItem( LABELS_KEY ) === 'name' ? 'name' : 'instrument';
	} catch ( e ) {
		return 'instrument';
	}
}

function writeFlag( key, on ) {
	try {
		window.localStorage.setItem( key, on ? 'on' : 'off' );
	} catch ( e ) {
		// Private mode, or storage full: the choice holds for this page.
	}
}

export const useLayoutStore = defineStore( 'layout', () => {
	const urlChoice = INITIAL_PARAMS.get( 'layout' );
	if ( urlChoice === 'auto' ) {
		writeStored( null );
	}
	const fromUrl = ref( urlChoice === 'bar' || urlChoice === 'sidebar' ? urlChoice : null );
	const saved = ref( urlChoice === 'auto' ? null : readStored() );

	const narrow = useMediaQuery( `(max-width: ${ AUTO_AT }px)` );
	const auto = computed( () => ( narrow.value ? 'bar' : 'sidebar' ) );
	const phone = useMediaQuery( PHONE );
	const layout = computed( () => ( phone.value ? 'bar' : fromUrl.value || saved.value || auto.value ) );
	const isBar = computed( () => layout.value === 'bar' );

	/** A stored choice is in force, as against the window deciding. */
	const pinned = computed( () => !! saved.value );

	// The sidebar folds to a strip; the bar collapses to a shaded player.
	const minimized = ref( false );
	const collapsed = ref( false );
	/*
	 * The timeline editor, open from the start when the address asks for it:
	 * ?track=<cid>&action=edit. That is the link a song page offers beside
	 * the chart it is about ({{Studio cut}}, 14 Nov 2026) — somebody who
	 * clicked "chart it in Rabbithole" came to edit, so the editor is what
	 * they get, rather than the ✎ to find.
	 */
	const editorOpen = ref( cameToEdit( INITIAL_PARAMS ) );

	/*
	 * Traverse mode: where the information pane goes as the track plays. A
	 * rocker of three (Justin, #connectome, 18 Nov 2026): 'bacon', the song's
	 * bacon graph, moving to whoever takes a solo with the song beside them;
	 * 'off'; and 'pages', the pages the track's parts are about, which is what
	 * traverse mode was until then. Bacon graphs unless set otherwise.
	 *
	 * Any navigation a person does turns it off: with it on, somebody who
	 * clicked through to read about a musician was carried off at the next
	 * solo, mid-sentence (Justin, 4 Nov 2026). Coming back to the song turns
	 * it back on as it was (`resume`; 18 Nov: "if they navigate back to the
	 * song, it turns back on automatically"). Set on the rocker, it stays as
	 * set, and `chosen` counts the settings so the app can act on one at once.
	 *
	 * It was "Follow the solo", which named one of the things it does and
	 * read as a social-media follow besides (Justin's item 16, 15 Nov 2026).
	 */
	// Come by /bacon (shell.js) to the song's own graph, bacon graphs, as in Rabbithole (Justin, 20 Nov 2026).
	// Come anywhere else in the graph, the reader is steering: off, to come back on as bacon graphs when they come
	// to the song on now.
	const steeringFirst = GRAPH_START && ! startsOnSong();
	const traverse = ref( steeringFirst ? 'off' : 'bacon' );
	const resume = ref( steeringFirst ? 'bacon' : null );
	const chosen = ref( 0 );

	/*
	 * The timeline beside the page, read-only, with the rabbit running down
	 * it (TimelineView.vue): open unless folded away, and the choice kept.
	 * Shown in the sidebar layout while the editor is closed; the bar and a
	 * phone have no room for a column (Justin, 13 Nov 2026).
	 */
	const timelineView = ref( readFlag( TIMELINE_KEY, true ) );
	watch( timelineView, ( v ) => writeFlag( TIMELINE_KEY, v ) );
	// Under 1000px the page beside it would be squeezed below ~540px.
	const roomy = useMediaQuery( '(min-width: 1000px)' );
	const showTimeline = computed( () => roomy.value && ! isBar.value && ! phone.value && ! editorOpen.value );
	/*
	 * What the timeline's labels say: the instrument, or the picker's name.
	 * Instruments unless chosen otherwise (Justin, #rabbithole, 13 Nov
	 * 2026); the choice kept in the browser.
	 */
	const timelineLabels = ref( readLabels() );
	watch( timelineLabels, ( v ) => {
		try {
			window.localStorage.setItem( LABELS_KEY, v );
		} catch ( e ) {
			// The choice holds for this page.
		}
	} );

	/*
	 * What the one bar asks of the graph in the pane: its link button and its
	 * FAQ are the graph's own (Justin, #connectome, 21 Nov 2026, 01:56Z: "Let's
	 * get all that stuff on one unified top bar"). The bar says which here, and
	 * whoever holds the frame says it to the graph (PaneGraph.vue,
	 * graph-frame.js barMessage). `n` counts, so the same ask twice is two asks.
	 */
	const barAsk = ref( { act: null, n: 0 } );
	function askBar( act ) {
		barAsk.value = { act, n: barAsk.value.n + 1 };
	}

	function setLayout( choice ) {
		saved.value = choice;
		fromUrl.value = null;
		writeStored( choice );
	}

	function toggleDock() {
		if ( isBar.value ) {
			collapsed.value = ! collapsed.value;
		} else {
			minimized.value = ! minimized.value;
		}
	}

	function openDock() {
		if ( isBar.value ) {
			collapsed.value = false;
		} else {
			minimized.value = false;
		}
	}

	function setTraverse( mode ) {
		if ( ! TRAVERSE_MODES.includes( mode ) ) {
			return;
		}
		traverse.value = mode;
		resume.value = null;
		chosen.value++;
	}

	/** The reader went somewhere: off, remembering what it was. */
	function stopTraversing() {
		if ( traverse.value !== 'off' ) {
			resume.value = traverse.value;
			traverse.value = 'off';
		}
	}

	/** The reader came back to the song: on again, as it was before they left. Returns the mode now. */
	function resumeTraversing() {
		if ( traverse.value === 'off' && resume.value ) {
			traverse.value = resume.value;
		}
		resume.value = null;
		return traverse.value;
	}

	/*
	 * Travel with the track again. Asked for where the rabbithole takes a
	 * step of its own rather than where a person goes somewhere to read: a
	 * new rabbithole, and Webamp's next (Justin, #rabbithole, 15 Nov 2026:
	 * "If you start a new rabbithole or use the 'next' button on webamp,
	 * let's have that activate traverse mode"). Stepping is listening, and
	 * the pane is part of what you are listening to.
	 */
	function startTraversing() {
		if ( traverse.value === 'off' ) {
			traverse.value = resume.value || 'bacon';
		}
		resume.value = null;
	}

	return {
		layout, isBar, narrow, phone, auto, pinned, saved,
		minimized, collapsed, editorOpen, traverse, resume, chosen, timelineView, showTimeline, timelineLabels, barAsk,
		setLayout, toggleDock, openDock, setTraverse, stopTraversing, resumeTraversing, startTraversing, askBar,
	};
} );
