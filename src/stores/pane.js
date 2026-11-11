/**
 * The wiki pane: which page was asked for, and which is on screen.
 *
 * The rule: the pane shows the page most recently asked for. Each open()
 * aborts the request before it and becomes the newest; a response that
 * finds it is no longer the newest is dropped. `wanted` is what was asked
 * for, `shown` is what is on screen, so a repeat of a page already on its
 * way is a no-op (audit item 2).
 *
 * The same click that moves the pane pushes the real wiki URL, so the
 * address bar reads /wiki/Cory_Walker while the song keeps playing, and
 * that URL is a thing you can send somebody.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

import * as wiki from '../wiki/api.js';
import { paneBody, searchResults, loadingBody, failedBody, wikiPath } from '../wiki/pane-html.js';

export const usePaneStore = defineStore( 'pane', () => {
	const wanted = ref( null );
	const shown = ref( null );
	/** The HTML inside the shadow root. A string: the component injects it. */
	const html = ref( '' );
	/** How many times html has been replaced, so a repeat of the same string still re-renders. */
	const revision = ref( 0 );
	const loading = ref( false );
	/** A trail drawn from what is playing to the song being read about. */
	const trail = ref( null );

	let request = null;

	function setHtml( value ) {
		html.value = value;
		revision.value += 1;
	}

	async function open( title, { push = true, force = false } = {} ) {
		if ( ! title ) {
			return;
		}
		const path = wikiPath( title );

		if ( ! force && wanted.value === title ) {
			if ( push ) {
				history.pushState( { wikiTitle: title }, '', path );
			}
			return;
		}
		wanted.value = title;
		trail.value = null;
		if ( request ) {
			request.abort();
		}
		const mine = new AbortController();
		request = mine;
		const latest = () => request === mine;

		// Only blank the pane when there is nothing in it: replacing an
		// article with "Loading" and then the next article is two layouts
		// and a flash where one will do.
		if ( ! shown.value ) {
			setHtml( loadingBody( title ) );
		}
		loading.value = true;

		try {
			const parsed = await wiki.parsePage( title, { signal: mine.signal } );
			if ( ! latest() ) {
				return;
			}
			setHtml( paneBody( title, parsed ) );
			shown.value = title;
			loading.value = false;
			if ( push ) {
				history.pushState( { wikiTitle: title }, '', path );
			} else {
				history.replaceState( { wikiTitle: title }, '', path );
			}
		} catch ( err ) {
			// Superseded (aborted, or finished second): the newer request
			// owns the pane. Otherwise it failed for real: say so, and forget
			// the ask so a retap tries again.
			if ( ! latest() ) {
				return;
			}
			loading.value = false;
			wanted.value = null;
			console.warn( 'Could not open', title, err );
			setHtml( failedBody( title ) );
		}
	}

	async function search( text ) {
		const q = text.trim();
		if ( ! q ) {
			return;
		}
		const hits = await wiki.search( q );
		setHtml( searchResults( q, hits ) );
		shown.value = null;
		wanted.value = null;
	}

	/** The title of the song page on screen, or null if the pane shows something else. */
	const shownSongTitle = computed( () => ( shown.value && shown.value.startsWith( 'Song:' ) ? shown.value : null ) );

	return { wanted, shown, html, revision, loading, trail, shownSongTitle, open, search };
} );
