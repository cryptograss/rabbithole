<script setup>
/*
 * The one bar, all the way across the top.
 *
 * There were two: this one over the dock, and the song's line over the page
 * beside it. Justin's item 17, 15 Nov 2026: "Let's make this one little bar,
 * all the way across the top. Move the traverse mode slider to the middle of
 * this bar, and move the carrot that's currently to the right of the 'Follow
 * the solo' selector there as well. Then, webamp can sit at the very top of
 * the player pane."
 *
 * Three zones: who we are, what the pane is doing (traverse mode), and what
 * is playing -- with the account chip and the graph's three controls at the
 * far end. The
 * carrot that played sat beside traverse mode until Justin, #connectome, 19
 * Nov 2026, 03:15Z: "The carrot in the top bar has outlived its usefulness,
 * IMO. Nix it." Webamp's own buttons play. The song's line is the
 * sidebar's; in the bottom bar Webamp's own title says which song it is, so
 * it goes (item 29).
 *
 * One bar for the graph too (Justin, #connectome, 21 Nov 2026, 01:56Z:
 * "integrate the top bar of rabbithole with the top bar of /bacon/ (on
 * which, once we move the two text boxes, we'll only have the link button,
 * the FAQ, and the link to pickipedia). Let's get all that stuff on one
 * unified top bar."). The link and the FAQ are the graph's own, so they are
 * here while the graph is what the pane shows, and they ask the graph
 * (layout.askBar; PaneGraph says it to the frame, graph-frame.js
 * barMessage), which shows the answer inside itself. PickiPedia's mark is a
 * plain link to the wiki's front page.
 *
 * The fold arrow was at this bar's far end until the same message: "The
 * left hand drawer for rabbithole is currently only collapsible but a
 * button way over on the right side of the top bar - that's very counter
 * intuitive. Give it a nice grip in the middle of the drawer." The grip is
 * DrawerGrip.vue, on the drawer's own edge.
 *
 * Justin, #connectome, 21 Nov 2026, 23:27Z: "In the upper-left, where
 * "Rabbithole BETA 2" is, let's change that to "The Oracle of Bluegrass
 * Bacon", in the same fine and regal font but smaller, and have it be a link
 * back to /bacon/." Rabbithole's own mark went to the top of the drawer
 * (DrawerBrand.vue). The link opens the front in the pane, so the music plays
 * on; a ctrl-click or a middle click opens it in a tab of its own.
 */
import { computed, onMounted } from 'vue';
import { useLayoutStore } from '../stores/layout.js';
import { useAccountStore } from '../stores/account.js';
import { useSongStore } from '../stores/song.js';
import { usePaneStore } from '../stores/pane.js';
import { loginHref } from '../wiki/urls.js';
import TraverseSwitch from './TraverseSwitch.vue';
import SongInfo from './SongInfo.vue';

const layout = useLayoutStore();
const account = useAccountStore();
const songs = useSongStore();
const pane = usePaneStore();

onMounted( () => account.refresh() );

const userHref = computed( () => '/wiki/User:' + encodeURIComponent( String( account.name ).replace( / /g, '_' ) ) );
const loginUrl = computed( () => loginHref( {
	track: songs.current && ( songs.current._alias || songs.current._trackCid ),
	page: pane.shown || pane.wanted,
	edit: layout.editorOpen,
} ) );

// The graph's own controls, while the graph is what the pane shows.
const graphFront = computed( () => !! pane.graphSrc && !! pane.view && pane.view.kind === 'graph' );
/** The explorer's mark, from where the explorer keeps it: one file, the same on both bars. */
const MARK = '/assets/connectome/pickipedia-mark.png';
function onMarkError( e ) {
	e.target.style.display = 'none';
}

/** Back to the front of /bacon, in the pane: a step of the reader's, so traverse mode lets go of the pane. */
function onOracle( e ) {
	if ( e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey ) {
		return;
	}
	e.preventDefault();
	if ( layout.traverse !== 'off' ) {
		layout.stopTraversing();
	}
	pane.openGraph( '/bacon', {}, { step: true } );
}
</script>

<template>
	<div id="rabbithole-header" class="rabbithole-header">
		<span class="rh-brand">
			<a class="rh-oracle" href="/bacon/" title="The Oracle of Bluegrass Bacon: back to the start" @click="onOracle"><h1>The Oracle of Bluegrass Bacon</h1></a>
		</span>
		<!-- The middle of the bar: whether the pane travels with the track. -->
		<div class="rh-bar-mid">
			<TraverseSwitch />
		</div>
		<!-- What is playing, who you are, and the graph's three controls. -->
		<div class="rh-bar-end">
			<SongInfo v-if="!layout.isBar" />
			<a v-if="account.name" class="rh-account" :href="userHref" target="_blank" rel="noopener"
				:title="'Signed in to PickiPedia as ' + account.name + '. Saves go in under this name.'">
				<span class="rh-account-dot" aria-hidden="true"></span>{{ account.name }}
			</a>
			<a v-else-if="account.name === null" class="rh-account signed-out"
				:href="loginUrl"
				title="Not signed in to PickiPedia: sign in to save charts and return right here.">Log in</a>
			<!-- The graph's three: the link to this very graph, the FAQ, and the way home to the wiki. -->
			<span class="rh-bar-graph">
				<button v-if="graphFront" id="rh-bar-share" type="button" class="rh-bar-btn" title="A link to this graph, to keep or to share"
					aria-label="A link to this graph" @click="layout.askBar( 'share' )"><span aria-hidden="true">🔗</span></button>
				<button v-if="graphFront" id="rh-bar-faq" type="button" class="rh-bar-btn" title="Bacon graphs: questions and answers"
					@click="layout.askBar( 'faq' )">FAQ</button>
				<!-- A tab of its own, so the music plays on (Justin, #connectome, 21 Nov 2026, 18:01Z: "new tab makes sense") -->
				<a id="rh-bar-home" class="rh-bar-home" href="/wiki/Main_Page" target="_blank" rel="noopener" title="PickiPedia: the front page, in a new tab"><img
					:src="MARK" alt="" width="24" height="24" @error="onMarkError"><span>PickiPedia</span></a>
			</span>
		</div>
	</div>
</template>
