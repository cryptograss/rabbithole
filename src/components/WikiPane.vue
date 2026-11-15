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
import { ref, watch, onMounted, onBeforeUnmount, computed, nextTick } from 'vue';
import { usePaneStore } from '../stores/pane.js';
import { useLayoutStore } from '../stores/layout.js';
import { usePickerStore } from '../stores/picker.js';
import { useListenStore } from '../stores/listen.js';
import { usePlayerStore } from '../stores/player.js';
import { useWalkStore, drawerDoes } from '../stores/walk.js';
import { useSongStore } from '../stores/song.js';
import { adoptPaneStyles } from '../wiki/pane-styles.js';
import { listenRequest, openTrack, playTrackInDock, queueTrack, trailToHere } from '../wiki/queue.js';
import { linkIn, titleFromHref, leavesTheApp } from '../wiki/pane-links.js';
import { markChased } from '../wiki/pane-ensemble.js';
import { graphSrcFor, isGraphFrame, walkMessage } from '../wiki/graph-frame.js';
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
	} );
	for ( const frame of graphFrames() ) {
		if ( frame.contentWindow ) {
			frame.contentWindow.postMessage( message, window.location.origin );
		}
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
	const does = drawerDoes( e.data );
	if ( ! does ) {
		return;
	}
	if ( does.play ) {
		if ( does.via ) {
			walk.mark( does.play, does.via );
		}
		layout.openDock();
		songs.playCid( does.play, { play: true } )
			.catch( ( err ) => console.warn( 'Could not play that from the graph:', err ) );
	}
	if ( does.page ) {
		layout.stopTraversing();
		pane.open( does.page );
	}
}

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
		layout.stopTraversing();
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

// A graph hears the player when it arrives, and whenever any of it changes.
watch(
	() => [ view.value, walk.hops, picker.following, picker.mode,
		player.song && player.song._trackCid, player.playing ],
	() => nextTick( tellGraphs ),
	{ deep: true, immediate: true }
);

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
		<PaneGraph v-else-if="view.kind === 'graph'" :src="view.src" />
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
