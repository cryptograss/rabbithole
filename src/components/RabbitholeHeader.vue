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
 * is playing -- with the account chip and the fold arrow at the far end. The
 * carrot that played sat beside traverse mode until Justin, #connectome, 19
 * Nov 2026, 03:15Z: "The carrot in the top bar has outlived its usefulness,
 * IMO. Nix it." Webamp's own buttons play. The song's line is the
 * sidebar's; in the bottom bar Webamp's own title says which song it is, so
 * it goes (item 29).
 */
import { computed, onMounted } from 'vue';
import { useLayoutStore } from '../stores/layout.js';
import { useAccountStore } from '../stores/account.js';
import { useSongStore } from '../stores/song.js';
import { usePaneStore } from '../stores/pane.js';
import { loginHref } from '../wiki/urls.js';
import rabbit from '../images/rabbit.png';
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

// ◀/▶ fold the sidebar; ▼/▲ collapse the bar.
const icon = computed( () => {
	if ( layout.isBar ) {
		return layout.collapsed ? '▲' : '▼';
	}
	return layout.minimized ? '▶' : '◀';
} );

function onLogo() {
	if ( ! layout.isBar && layout.minimized ) {
		layout.toggleDock();
	}
}
</script>

<template>
	<div id="rabbithole-header" class="rabbithole-header">
		<span class="rh-brand">
			<img :src="rabbit" alt="Rabbithole" @click="onLogo">
			<h1>rabbithole</h1>
			<span class="alpha">BETA</span>
		</span>
		<!-- The middle of the bar: whether the pane travels with the track. -->
		<div class="rh-bar-mid">
			<TraverseSwitch />
		</div>
		<!-- Who you are and the way to fold the dock, together. In the
		     bar the header was a column 116px tall, and these two on
		     lines of their own left nothing for the account chip: it
		     was flattened to 2px between BETA and the fold arrow
		     (Skyler, 14 Nov 2026, on a desktop). Side by side they
		     fit. display:contents everywhere else, so the sidebar's
		     header is the one row it has always been. -->
		<div class="rh-bar-end">
			<SongInfo v-if="!layout.isBar" />
			<div class="rh-header-foot">
				<a v-if="account.name" class="rh-account" :href="userHref" target="_blank" rel="noopener"
					:title="'Signed in to PickiPedia as ' + account.name + '. Saves go in under this name.'">
					<span class="rh-account-dot" aria-hidden="true"></span>{{ account.name }}
				</a>
				<a v-else-if="account.name === null" class="rh-account signed-out"
					:href="loginUrl"
					title="Not signed in to PickiPedia: sign in to save charts and return right here.">Log in</a>
				<button class="minimize-btn" title="Minimize/Maximize" @click="layout.toggleDock()">
					<span id="minimize-icon">{{ icon }}</span>
				</button>
			</div>
		</div>
	</div>
</template>
