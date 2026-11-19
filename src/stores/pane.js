/**
 * The wiki pane: which page was asked for, and which is on screen.
 *
 * The rule: the pane shows the page most recently asked for. Each open()
 * aborts the request before it and becomes the newest; a response that
 * finds it is no longer the newest is dropped. `wanted` is what was asked
 * for, `shown` is what is on screen, so a repeat of a page already on its
 * way is a no-op (audit item 2).
 *
 * The same click that moves the pane pushes the app's own address,
 * /rabbithole/?track=<cid>&page=Cory_Walker, so the song keeps playing and
 * the address is a thing you can send somebody: it opens the player on
 * that page with that song, where the wiki's /wiki/Cory_Walker opened the
 * plain wiki with no player (Justin, 11 Nov 2026).
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

import * as wiki from '../wiki/api.js';
import { appAddress } from '../wiki/urls.js';
import { GRAPH_PATH } from '../wiki/graph-frame.js';
import { cardOf } from '../wiki/infobox.js';
import { baconAddress } from '../traverse.js';

export const usePaneStore = defineStore( 'pane', () => {
	const wanted = ref( null );
	const shown = ref( null );
	/*
	 * What the pane is showing, as a thing rather than as markup: an
	 * article (the wiki's parsed HTML, with its title), a word that it is
	 * loading or could not, or a search and its hits. The components
	 * render it; until 14 Nov 2026 the store built the HTML itself and the
	 * pane had no idea what it was holding.
	 */
	const view = ref( { kind: 'empty' } );
	const loading = ref( false );
	/** A trail drawn from what is playing to the song being read about. */
	const trail = ref( null );

	let request = null;

	async function open( title, { push = true, force = false } = {} ) {
		if ( ! title ) {
			return;
		}
		const path = appAddress( title );

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
			view.value = { kind: 'loading', title };
		}
		loading.value = true;

		try {
			// Asked for again on purpose (force): the wiki, not what is in hand.
			const parsed = await wiki.parsePage( title, { signal: mine.signal, fresh: force } );
			if ( ! latest() ) {
				return;
			}
			view.value = { kind: 'article', title, text: parsed.text || '', displaytitle: parsed.displaytitle || '' };
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
			view.value = { kind: 'failed', title };
		}
	}

	/**
	 * The connectome, in the pane, in a frame of its own.
	 *
	 * A graph is a page with scripts, so it is framed rather than injected
	 * (wiki/graph-frame.js). Exploring it is reading, not navigating the
	 * wiki, so the address is left alone: what is in the pane when you
	 * came is still what a reload opens (Justin, #rabbithole, 15 Nov 2026).
	 *
	 * @param {string} src The frame's src, from graphSrcFor().
	 * @param {Object} [traverse] Traverse mode's own: { traverse: true, to, card, cid } (see bacon()).
	 */
	function openGraph( src, traverse = {} ) {
		if ( ! src ) {
			return;
		}
		if ( request ) {
			request.abort();
		}
		loading.value = false;
		trail.value = null;
		// No article is on screen while the graph is: the page you came
		// from is not being read, and asking for it again has to open it
		// rather than be taken for the page already shown.
		wanted.value = null;
		shown.value = null;
		view.value = Object.assign( { kind: 'graph', src }, traverse );
	}

	/*
	 * Traverse mode's bacon graphs (Justin, #connectome, 18 Nov 2026): the
	 * song on now in its own graph; while somebody takes a solo, them in the
	 * middle with the song beside them, as big as they are, and their card
	 * over the corner. It is one frame, moved by message (WikiPane says `to`
	 * to it), so it slides from one to the next rather than loading again.
	 *
	 * A song the graph does not hold gets its page instead: the graph says so
	 * (markUnheld), and bacon() says no for that track from then on.
	 */
	const unheld = ref( null );

	/** The bacon graph for the song on now, or its soloist; false where the graph has no such song. */
	function bacon( song, solo = null ) {
		const cid = song && song._trackCid;
		const to = baconAddress( cid, solo );
		if ( ! to || unheld.value === cid ) {
			return false;
		}
		const card = solo || null;
		if ( view.value.kind === 'graph' && view.value.traverse ) {
			view.value = Object.assign( {}, view.value, { to, card, cid } );
		} else {
			const src = GRAPH_PATH + to + '&host=rabbithole';
			openGraph( src, { traverse: true, to, card, cid } );
		}
		// The soloist by their page's own name, once the wiki has said it: a chart's "Justin Holmes" is the
		// graph's "Justin Myles Holmes". Until then the graph keeps the song, if it doesn't know the name.
		if ( solo ) {
			cardOf( solo, wiki.parsePage ).then( ( { title } ) => {
				const v = view.value;
				if ( title && title !== solo && v.kind === 'graph' && v.traverse && v.card === solo && v.cid === cid && v.to === to ) {
					view.value = Object.assign( {}, v, { to: baconAddress( cid, title ) } );
				}
			} );
		}
		return true;
	}

	/** The graph has no song for this track. */
	function markUnheld( cid ) {
		unheld.value = cid || null;
	}

	/** The reader moved traverse mode's graph: it is theirs now, told nothing more, and the card goes. */
	function letGraphBe() {
		if ( view.value.kind === 'graph' && view.value.traverse ) {
			view.value = Object.assign( {}, view.value, { to: null, card: null } );
		}
	}

	async function search( text ) {
		const q = text.trim();
		if ( ! q ) {
			return;
		}
		const hits = await wiki.search( q );
		view.value = { kind: 'search', text: q, hits };
		shown.value = null;
		wanted.value = null;
	}

	/*
	 * A song's page: the Song: page that owns the track (its title's, or the
	 * one that links its release), else the track's metadata page. A song
	 * should open on the song, not on the YAML somebody edits it with
	 * (Skyler). The song's title in the dock is a link here, the way back
	 * once the pane has followed the pickers off the song (Justin, 11 Nov 2026).
	 */
	async function openSong( song, { push = true } = {} ) {
		const fallback = song._metadataTitle;
		try {
			open( ( await wiki.songPageOf( song._trackCid, song.title ) ) || fallback, { push } );
		} catch ( err ) {
			console.warn( 'Could not look for a song page:', err );
			open( fallback, { push } );
		}
	}

	/** The title of the song page on screen, or null if the pane shows something else. */
	const shownSongTitle = computed( () => ( shown.value && shown.value.startsWith( 'Song:' ) ? shown.value : null ) );

	/** Is this page the song's own: Song:<title>, or the track's metadata page? */
	function isSongPage( title, song ) {
		return !! title && !! song && ( title === 'Song:' + song.title || title === song._metadataTitle );
	}

	return { wanted, shown, view, loading, trail, shownSongTitle, unheld, open, openSong, openGraph, bacon, markUnheld,
		letGraphBe, isSongPage, search };
} );
