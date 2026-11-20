<script setup>
/*
 * The wiki, in a box we own.
 *
 * The box is a shadow root, so MediaWiki's styles go in with the content
 * and cannot reach the dock. What goes in it is rendered by Vue, through
 * a Teleport into the root: the article's wrappers, the title, the chase
 * and the trail are components (src/components/pane/), and the one piece
 * of injected HTML is the article the wiki parsed for us. Until 14 Nov
 * 2026 the whole pane was a string built in JavaScript, with widgets
 * inserted afterwards by hand and clicks read off data- attributes
 * (Justin: hard to read and to reason about).
 *
 * The root still listens once, for what happens inside the wiki's own
 * HTML, where there is nothing for Vue to bind to: a link to another page
 * stays in the pane and stops the chase; a Listen button hands its track
 * to the player.
 */
import { ref, watch, watchEffect, onMounted, onBeforeUnmount, computed, nextTick } from 'vue';
import { usePaneStore } from '../stores/pane.js';
import { useLayoutStore } from '../stores/layout.js';
import { usePickerStore } from '../stores/picker.js';
import { useListenStore } from '../stores/listen.js';
import { usePlayerStore } from '../stores/player.js';
import { useWalkStore, drawerDoes } from '../stores/walk.js';
import { useSongStore } from '../stores/song.js';
import { wikiPath } from '../wiki/urls.js';
import { adoptPaneStyles } from '../wiki/pane-styles.js';
import { night } from '../night.js';
import { askOrPlay, listenRequest, openTrack, playTrackInDock, queueTrack, trailToHere } from '../wiki/queue.js';
import { linkIn, titleFromHref, leavesTheApp } from '../wiki/pane-links.js';
import { markChased } from '../wiki/pane-ensemble.js';
import { graphSrcFor, isGraphFrame, walkMessage, fxMessage } from '../wiki/graph-frame.js';
import { cardOf } from '../wiki/infobox.js';
import { fxColor } from '../player/glow.js';
import * as wikiApi from '../wiki/api.js';
import PaneArticle from './pane/PaneArticle.vue';
import PaneChaseOffer from './pane/PaneChaseOffer.vue';
import PaneChasePill from './pane/PaneChasePill.vue';
import PaneGraph from './pane/PaneGraph.vue';
import PaneNotice from './pane/PaneNotice.vue';
import PaneSearch from './pane/PaneSearch.vue';
import PaneTrail from './pane/PaneTrail.vue';

const pane = usePaneStore();
const layout = useLayoutStore();
const picker = usePickerStore();
const listen = useListenStore();
const player = usePlayerStore();
const walk = useWalkStore();
const songs = useSongStore();
const host = ref( null );
/* Where Vue renders: a div of our own inside the shadow root, made once. */
const inside = ref( null );

const view = computed( () => pane.view );
/*
 * Chasing a picker, shown in one of two places and never both: the pill
 * beside their name in the title while they are being chased, or the one
 * line offering the chase on their page (Justin's points 10 and 13).
 * Neither has anywhere to go on a page that is not an article.
 */
const offer = computed( () => ( view.value.kind === 'article' && picker.offer ? picker.offer : null ) );
const chasing = computed( () => (
	!! offer.value && picker.mode === 'chase' && picker.following === offer.value.name
) );
/*
 * The article, with the chased picker marked in the page's own ensemble
 * (Justin's item 25). Only a chase marks it: a quest hands you a picker
 * for the length of one song and says so with the rabbit on their card,
 * which is not the page saying you are chasing them.
 */
const article = computed( () => (
	picker.mode === 'chase' ? markChased( view.value.text, picker.following ) : view.value.text
) );

/**
 * What a Listen button in the pane asks for.
 *
 * A track that is already playing is nothing to ask about; nor is one
 * clicked while the dock is quiet, which simply plays. Asked for while
 * another song is on, it is a question with three answers, and the
 * dialogue asks it (Justin's item 15, 15 Nov 2026).
 */
async function asked( request, el ) {
	const { cid, action } = request;
	if ( action === 'trail' ) {
		await trailToHere( el );
	} else if ( action === 'queue' ) {
		await queueTrack( cid, el );
	} else if ( action === 'open' ) {
		await openTrack( cid );
	} else if ( player.playing && cid !== ( player.song && player.song._trackCid ) ) {
		await listen.ask( cid );
	} else {
		await playTrackInDock( cid );
	}
}

/*
 * The connectome, in the pane rather than in a new tab (Justin's ask, 15
 * Nov 2026). Every graph in the pane is told what the player is doing --
 * the one the pane is showing, and any the wiki's own HTML carries -- so
 * the song playing and the picker being chased are marked wherever they
 * appear. One place says it; one place hears the graphs back.
 */
function graphFrames() {
	const shadow = host.value && host.value.shadowRoot;
	return shadow ? [ ...shadow.querySelectorAll( 'iframe' ) ].filter( isGraphFrame ) : [];
}

function tellGraphs() {
	// A frame that has not finished loading has no listener yet: it is
	// told again when it has.
	for ( const frame of graphFrames() ) {
		if ( frame.dataset.rhListening !== 'yes' ) {
			frame.dataset.rhListening = 'yes';
			frame.addEventListener( 'load', () => tellGraphs() );
		}
	}
	const message = walkMessage( {
		hops: walk.hops,
		chasing: picker.following || null,
		chaseMode: picker.mode || null,
		now: ( player.song && player.song._trackCid ) || null,
		playing: player.playing,
		mode: 'full',
		night: night.value,
		at: walk.at,
		steering: layout.traverse === 'off',
	} );
	// Where the pane's graph goes now: traverse mode's song or its soloist (pickipedia:blu/bacon-traverse), or a
	// graph the reader opened from a page. Said again with everything else, and when the frame has loaded, so an
	// ask made while it loads still lands; the frame, already there, does nothing.
	const go = view.value.kind === 'graph' && view.value.to ? { rabbithole: 'go', to: view.value.to, fresh: !! view.value.fresh } : null;
	const lights = JSON.parse( JSON.stringify( fxNow.value ) );
	for ( const frame of graphFrames() ) {
		if ( frame.contentWindow ) {
			frame.contentWindow.postMessage( message, window.location.origin );
			frame.contentWindow.postMessage( lights, window.location.origin );      // a frame just arrived learns the lights too
			if ( go ) {
				frame.contentWindow.postMessage( go, window.location.origin );
			}
		}
	}
}

/*
 * What traverse mode's graph says back (Justin, #connectome, 18 Nov 2026):
 * it holds no such song, so the song's page it is; or the reader moved it,
 * which turns traverse mode off -- unless where they went is the song on
 * now, which turns it back on.
 */
function heardFromTraverse( d ) {
	if ( view.value.kind !== 'graph' ) {
		return;
	}
	if ( d.missing ) {
		if ( view.value.traverse ) {
			pane.markUnheld( view.value.cid );
		}
		return;
	}
	// One graph, however the reader came to it (shell.js): moving it is steering, wherever it was opened from.
	const now = player.song && player.song._trackCid;
	if ( d.cut && d.cut === now ) {
		pane.letGraphBe();
		layout.resumeTraversing();
	} else {
		pane.letGraphBe();
		layout.stopTraversing();
	}
}

/** What a graph in the pane asks of the player: the drawer's own words. */
function onGraphMessage( e ) {
	if ( e.origin !== window.location.origin ) {
		return;
	}
	if ( ! graphFrames().some( ( frame ) => frame.contentWindow === e.source ) ) {
		return;
	}
	if ( e.data && e.data.connectome === true && typeof e.data.at === 'string' ) {
		// Where the pane's own graph is now: the shell's history and address follow it (shell.js).
		const own = paneFrame();
		if ( own && own.contentWindow === e.source && pane.heardGraphAt( e.data ) && ! songs.current && e.data.title ) {
			document.title = String( e.data.title );                 // with nothing playing, the tab is the graph's
		}
		return;
	}
	if ( e.data && e.data.connectome === true && ( e.data.missing || e.data.moved ) ) {
		heardFromTraverse( e.data );
		return;
	}
	const does = drawerDoes( e.data );
	if ( ! does ) {
		return;
	}
	if ( does.play ) {
		if ( does.step !== null && does.step !== undefined ) {
			// A step of the walk, clicked in the graph: back in this
			// rabbithole rather than the start of another (item 40).
			picker.playHop( does.play, does.step );
		} else {
			// Something playing already? Then this is a question, the same
			// one a Listen button in the pane asks (item 36).
			askOrPlay( does.play, does.via )
				.catch( ( err ) => console.warn( 'Could not play that from the graph:', err ) );
		}
	}
	if ( does.page ) {
		if ( ! songs.current ) {
			// Nothing stands to keep playing: the wiki itself, as the graph's page always went.
			window.location.assign( wikiPath( does.page ) );
			return;
		}
		layout.stopTraversing();
		pane.open( does.page );
	}
}

/** The pane's own graph frame (shell.js): one, kept behind whatever else the pane shows. */
function paneFrame() {
	const shadow = host.value && host.value.shadowRoot;
	return shadow ? shadow.querySelector( 'iframe.pane-graph' ) : null;
}

// Back or Forward came to a step of the graph's: the frame is sent there.
watch( () => pane.stepWord, ( word ) => {
	const own = paneFrame();
	if ( word && own && own.contentWindow ) {
		own.contentWindow.postMessage( Object.assign( {}, word ), window.location.origin );
	}
} );

async function onClick( e ) {
	const link = linkIn( e.composedPath() );
	if ( ! link ) {
		return;
	}
	const { el: a, href } = link;
	if ( link.newTab ) {
		// Asked for a new tab, by the pane's own title above all: the
		// browser does that itself, and the song plays on here.
		return;
	}
	const request = listenRequest( href );
	if ( request ) {
		e.preventDefault();
		await asked( request, a );
		return;
	}
	const title = titleFromHref( href );
	if ( title ) {
		e.preventDefault();
		// Back to the song on now is back on, as traverse mode was; anywhere else, off (Justin, 18 Nov 2026).
		if ( pane.isSongPage( title, player.song ) ) {
			layout.resumeTraversing();
		} else {
			layout.stopTraversing();
		}
		pane.open( title );
		return;
	}
	const graph = graphSrcFor( href );
	if ( graph ) {
		// The connectome opens here, to be explored for the next thing to
		// chase to, rather than in a tab away from the music.
		e.preventDefault();
		layout.stopTraversing();
		pane.openGraph( graph );
		return;
	}
	if ( leavesTheApp( href ) ) {
		// An edit form, a history page, a Special page, the big
		// connectome graph: the wiki's own pages, which the pane cannot
		// hold (injected HTML runs no scripts). They open in a new tab,
		// so the song and an open timeline editor stay where they are
		// (Skyler, 6 Nov 2026).
		e.preventDefault();
		window.open( new URL( href, window.location.origin ).href, '_blank', 'noopener' );
	}
}

function onSearch( text ) {
	layout.stopTraversing();
	pane.search( text );
}

function onChase( name ) {
	picker.chase( name );
}

onMounted( () => {
	const shadow = host.value.shadowRoot || host.value.attachShadow( { mode: 'open' } );
	adoptPaneStyles( shadow );
	const root = document.createElement( 'div' );
	root.className = 'pane-root';
	shadow.append( root );
	shadow.addEventListener( 'click', onClick );
	window.addEventListener( 'message', onGraphMessage );
	inside.value = root;
} );

onBeforeUnmount( () => window.removeEventListener( 'message', onGraphMessage ) );

/*
 * The ensemble list's lights, said to the graphs (graph-frame.js fxMessage):
 * a flourish, a solo, the band's flash show on whoever of the band is in
 * sight there, as they show on the list (Justin, #connectome, 20 Nov 2026).
 * The graph knows a picker by their page's own name, so each card's name is
 * asked of the wiki once (a chart's "Justin Holmes" is "Justin Myles
 * Holmes"); until it answers, the chart's name is tried as it is.
 */
const fxTitles = ref( {} );
watch( () => player.cards.map( ( c ) => c.name ).join( '|' ), () => {
	for ( const c of player.cards ) {
		if ( c.name && ! ( c.name in fxTitles.value ) ) {
			fxTitles.value = { ...fxTitles.value, [ c.name ]: null };
			cardOf( c.name, wikiApi.parsePage ).then( ( { title } ) => {
				fxTitles.value = { ...fxTitles.value, [ c.name ]: title || null };
			} );
		}
	}
}, { immediate: true } );
const fxNow = computed( () => fxMessage( { cards: player.cards, effects: player.effects, playing: player.playing, titles: fxTitles.value, color: fxColor } ) );
function tellFx() {
	for ( const frame of graphFrames() ) {
		if ( frame.contentWindow ) {
			frame.contentWindow.postMessage( JSON.parse( JSON.stringify( fxNow.value ) ), window.location.origin );
		}
	}
}
// Only when what is said changes: the player's clock ticks many times a second, the lights change a few times a song.
watch( () => JSON.stringify( fxNow.value ), () => nextTick( tellFx ) );

// A graph hears the player when it arrives, and whenever any of it changes.
watch(
	() => [ view.value, walk.hops, picker.following, picker.mode,
		player.song && player.song._trackCid, player.playing, night.value, walk.at ],
	() => nextTick( tellGraphs ),
	{ deep: true, immediate: true }
);

// Night reaches the pane by a class of its own: the one on <html> stops at
// the shadow root. On the host it darkens the paper (pane-night.css); on the
// root it is what the wiki's night sheet looks for above an article.
watchEffect( () => {
	if ( host.value ) {
		host.value.classList.toggle( 'pp-night', night.value );
	}
	if ( inside.value ) {
		inside.value.classList.toggle( 'pp-night', night.value );
	}
} );

// A new page starts at the top of it, as turning a page does.
watch( () => view.value, () => {
	if ( host.value ) {
		host.value.scrollTop = 0;
	}
} );

watch( () => pane.shown, ( title ) => picker.look( title ), { immediate: true } );
</script>

<template>
	<div
		id="pickipedia-frame"
		ref="host"
		class="pickipedia-frame"
		:class="{ 'pane-holds-graph': view.kind === 'graph' }"
	></div>
	<Teleport v-if="inside" :to="inside">
		<!-- The graph's frame, one for as long as the app is open: behind an
		     article it waits as it was, so coming back to it is coming back
		     to the same drawing (shell.js). A new src is a new frame, so
		     loading one adds nothing to the browser's history. -->
		<PaneGraph
			v-if="pane.graphSrc"
			:away="view.kind !== 'graph'"
			:key="pane.graphSrc"
			:src="pane.graphSrc"
		/>
		<PaneSearch
			v-if="view.kind === 'search'"
			:text="view.text"
			:hits="view.hits"
			@search="onSearch"
		/>
		<PaneNotice
			v-else-if="view.kind === 'loading' || view.kind === 'failed'"
			:kind="view.kind"
			:title="view.title"
		/>
		<PaneArticle
			v-else-if="view.kind === 'article'"
			:title="view.title"
			:text="article"
			:displaytitle="view.displaytitle"
		>
			<!-- Beside their name, and never both: the pill while they are
			     being chased, the offer while they are not (Justin's items
			     13 and 23). -->
			<template #title>
				<PaneChasePill v-if="chasing" :name="offer.name" @stop="picker.stop()" />
				<PaneChaseOffer v-else-if="offer && offer.next" :name="offer.name" @chase="onChase" />
			</template>
			<PaneTrail v-if="pane.trail" :trail="pane.trail" />
		</PaneArticle>
	</Teleport>
</template>
