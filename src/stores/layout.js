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
import { ref, computed } from 'vue';

import { INITIAL_PARAMS } from '../initial-params.js';
import { useMediaQuery } from '../composables/media-query.js';

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
	const editorOpen = ref( false );

	/*
	 * Follow the solo into each player's page. Any navigation a person does
	 * turns it off: with it on, somebody who clicked through to read about
	 * a musician was carried off at the next solo, mid-sentence (Justin,
	 * 4 Nov 2026). One tap turns it back on.
	 */
	const follow = ref( true );

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

	function stopFollowing() {
		follow.value = false;
	}

	return {
		layout, isBar, narrow, phone, auto, pinned, saved,
		minimized, collapsed, editorOpen, follow,
		setLayout, toggleDock, openDock, stopFollowing,
	};
} );
