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
import { graphAt, frameSrc, shellAddress, movesByWord } from '../shell.js';
import { useLayoutStore } from './layout.js';
import { usePlayerStore } from './player.js';

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

	/*
	 * The graph's frame: one, for as long as the app is open (shell.js). It
	 * is made when the pane first holds a graph and is never taken down:
	 * behind an article it waits as it was, so coming back to it is coming
	 * back to the same drawing. Within the plain graph it is moved by word;
	 * a kept graph and a challenge are read from the path, so those load.
	 */
	const graphSrc = ref( null );
	/** Where that frame is, as last asked or heard: "/bacon?p=Cory+Walker". */
	let graphNow = null;
	/** How many times a place has been asked for afresh: the count that makes the frame's src a new one (shell.js frameSrc). */
	let reloads = 0;
	/** Back or Forward came to a step of the graph's: the word for the frame (WikiPane passes it on). */
	const stepWord = ref( null );

	/** The track that stands (by the name it came by), else the one the address names: kept in the address as the graph's changes. */
	function trackInAddress() {
		const song = usePlayerStore().song;
		return ( song && ( song._alias || song._trackCid ) ) || new URLSearchParams( window.location.search ).get( 'track' );
	}

	/**
	 * @param {string} title The page.
	 * @param {Object} [options]
	 * @param {boolean} [options.push] An entry of its own in the history, else the entry in sight rewritten.
	 * @param {boolean} [options.force] Ask the wiki again, though it is the page in hand.
	 * @param {boolean} [options.music] Traverse mode opened it, not the reader: the entry says so (`music`), and
	 *   Back onto it is coming back to where the music had the pane (traverse.js, comesBackToTheMusic).
	 */
	async function open( title, { push = true, force = false, music = false } = {} ) {
		if ( ! title ) {
			return;
		}
		const path = appAddress( title );
		const entry = music ? { wikiTitle: title, music: true } : { wikiTitle: title };

		if ( ! force && wanted.value === title ) {
			if ( push ) {
				history.pushState( entry, '', path );
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
				history.pushState( entry, '', path );
			} else {
				history.replaceState( entry, '', path );
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
	 * @param {Object} [traverse] Traverse mode's own: { traverse: true, to, card, cid } (see bacon()). Its entry
	 *   in the history is the music's, and says so (`music`).
	 * @param {Object} [options]
	 * @param {boolean} [options.step] A step of the reader's: an entry of its own.
	 * @param {boolean} [options.write] Whether the history is written at all.
	 * @param {boolean} [options.inPlace] The entry in sight is rewritten whatever it holds: Back came onto it.
	 * @param {boolean} [options.reload] This place, loaded afresh: the frame goes there even if it is the page it
	 *   already holds and has been taken elsewhere by word since (the Oracle's name in the bar).
	 */
	function openGraph( src, traverse = {}, { step = false, write = true, inPlace = false, reload = false } = {} ) {
		const at = src ? graphAt( src, window.location.origin ) : null;
		if ( ! at ) {
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
		// A step of the reader's (a link they clicked), or the graph taking
		// over from an article: an entry of its own in the history, so Back
		// comes back to what was there. Otherwise this entry is the graph's.
		const from = window.history.state;
		const push = ! inPlace && ( step || !! ( from && from.wikiTitle ) );
		let to = null;
		if ( ! reload && graphSrc.value && movesByWord( graphNow || graphSrc.value, at ) ) {
			to = at.slice( at.indexOf( '?' ) );
		} else {
			graphSrc.value = frameSrc( at, useLayoutStore().traverse === 'off', reload ? ++reloads : 0 );
		}
		graphNow = at;
		// `fresh`: moved by word into an entry of its own, the frame gives the view a number of its own, and the
		// step before keeps its drawing.
		view.value = Object.assign( { kind: 'graph', src: graphSrc.value, to, fresh: push && !! to }, traverse );
		if ( write ) {
			const entry = { graph: at };
			if ( ! push && from && from.n !== undefined && ( inPlace || from.graph === at ) ) {
				// The same entry, come back to (the frame was just sent to its number, and draws what comes
				// next under it), or the same place in it: the frame's own number for the entry stands.
				entry.n = from.n;
				entry.s = from.s;
			}
			if ( traverse.traverse ) {
				entry.music = true;
			}
			window.history[ push ? 'pushState' : 'replaceState' ]( entry, '', shellAddress( at, trackInAddress() ) );
		}
	}

	/**
	 * What the graph's frame says of where it is: the shell keeps the
	 * history (shell.js). A step the reader took is an entry; anything else
	 * (the music moved it, the frame's first view) rewrites the entry in
	 * sight. Heard only while the pane holds the graph.
	 *
	 * An entry rewritten while traverse mode is on is the music's (`music`):
	 * the music moved the frame there, or the frame said again where the
	 * music has it. A step is the reader's, and never is; nor is anything
	 * heard once the reader has steered and traverse mode is off.
	 *
	 * @param {Object} d { at, step, n, s }: where, whether a step, and the frame's own number for it.
	 * @return {boolean} Whether it was taken.
	 */
	function heardGraphAt( d ) {
		const at = d && typeof d.at === 'string' ? graphAt( d.at, window.location.origin ) : null;
		if ( ! at || view.value.kind !== 'graph' ) {
			return false;
		}
		graphNow = at;
		const entry = { graph: at, n: d.n, s: d.s };
		if ( ! d.step && useLayoutStore().traverse !== 'off' ) {
			entry.music = true;
		}
		window.history[ d.step ? 'pushState' : 'replaceState' ]( entry, '', shellAddress( at, trackInAddress() ) );
		return true;
	}

	/**
	 * Back or Forward came to an entry of the graph's: the pane holds the
	 * graph again, and the frame is sent to that step, which it draws as
	 * it was where it still has it.
	 *
	 * @param {Object} state The entry's state: { graph, n, s }.
	 */
	function showGraph( state ) {
		const at = state && graphAt( state.graph, window.location.origin );
		if ( ! at ) {
			return;
		}
		if ( ! graphSrc.value ) {
			openGraph( at, {}, { write: false } );                   // no frame yet (a reload since): it loads there
			return;
		}
		// The frame has gone to another page of the graph's since (a new song took it from a kept graph or a
		// challenge to the song's own, which is /bacon and a query): a step cannot be sent across pages, since
		// those are read from the path. The frame loads the entry's page, laid out afresh.
		const door = ( where ) => new URL( where, window.location.origin ).pathname.replace( /(.)\/$/, '$1' );
		if ( door( graphNow || graphSrc.value ) !== door( at ) ) {
			openGraph( at, {}, { write: false } );
			return;
		}
		if ( request ) {
			request.abort();
		}
		loading.value = false;
		trail.value = null;
		wanted.value = null;
		shown.value = null;
		graphNow = at;
		view.value = { kind: 'graph', src: graphSrc.value, to: null };
		stepWord.value = { rabbithole: 'step', to: at, n: state.n, s: state.s };
		// The entry's address was written with whatever stood then; a reload from it opens what stands now.
		const now = shellAddress( at, trackInAddress() );
		if ( now !== window.location.pathname + window.location.search ) {
			window.history.replaceState( window.history.state, '', now );
		}
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
	function bacon( song, solo = null, { inPlace = false } = {} ) {
		const cid = song && song._trackCid;
		const to = baconAddress( cid, solo );
		if ( ! to || unheld.value === cid ) {
			return false;
		}
		const card = solo || null;
		// The entry in sight is the reader's own: they steered there, and traverse mode has come back on (a new
		// song started; they pressed the song's name; the rocker). The music takes an entry of its own, so Back
		// is back to what they were looking at, drawn as it was (Justin, #connectome, 21 Nov 2026, 01:56Z: "if
		// the user wants to keep doing what they were doing, they can just click "back""). It was rewritten.
		const from = window.history.state;
		const readers = ! inPlace && !! from && ! from.music && !! ( from.graph || from.wikiTitle );
		if ( view.value.kind === 'graph' && view.value.traverse && ! inPlace && ! readers ) {
			view.value = Object.assign( {}, view.value, { to, card, cid, fresh: false } );
		} else {
			// Back came onto the music's entry (inPlace): the entry is written here, whatever it held, rather
			// than left for the frame to say where it went.
			openGraph( GRAPH_PATH + to, { traverse: true, to, card, cid }, { inPlace, step: readers } );
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

	/** The reader moved the graph: it is theirs now, told nothing more, and the card goes. */
	function letGraphBe() {
		if ( view.value.kind === 'graph' && ( view.value.to || view.value.card ) ) {
			view.value = Object.assign( {}, view.value, { to: null, card: null, fresh: false } );
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
	async function openSong( song, { push = true, music = false } = {} ) {
		const fallback = song._metadataTitle;
		try {
			open( ( await wiki.songPageOf( song._trackCid, song.title ) ) || fallback, { push, music } );
		} catch ( err ) {
			console.warn( 'Could not look for a song page:', err );
			open( fallback, { push, music } );
		}
	}

	/** The title of the song page on screen, or null if the pane shows something else. */
	const shownSongTitle = computed( () => ( shown.value && shown.value.startsWith( 'Song:' ) ? shown.value : null ) );

	/** Is this page the song's own: Song:<title>, or the track's metadata page? */
	function isSongPage( title, song ) {
		return !! title && !! song && ( title === 'Song:' + song.title || title === song._metadataTitle );
	}

	return { wanted, shown, view, loading, trail, shownSongTitle, unheld, graphSrc, stepWord, open, openSong, openGraph,
		heardGraphAt, showGraph, bacon, markUnheld, letGraphBe, isSongPage, search };
} );
