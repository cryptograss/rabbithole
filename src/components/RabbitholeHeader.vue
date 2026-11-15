<script setup>
import { computed, onMounted } from 'vue';
import { useLayoutStore } from '../stores/layout.js';
import { useAccountStore } from '../stores/account.js';
import rabbit from '../images/rabbit.png';

const layout = useLayoutStore();
const account = useAccountStore();

onMounted( () => account.refresh() );

const userHref = computed( () => '/wiki/User:' + encodeURIComponent( String( account.name ).replace( / /g, '_' ) ) );

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
		<img :src="rabbit" alt="Rabbithole" @click="onLogo">
		<h1>rabbithole</h1>
		<span class="alpha">BETA</span>
		<!-- Who you are and the way to fold the dock, together. In the
		     bar the header is a column 116px tall, and these two on
		     lines of their own left nothing for the account chip: it
		     was flattened to 2px between BETA and the fold arrow
		     (Skyler, 14 Nov 2026, on a desktop). Side by side they
		     fit. display:contents everywhere else, so the sidebar's
		     header is the one row it has always been. -->
		<div class="rh-header-foot">
			<a v-if="account.name" class="rh-account" :href="userHref" target="_blank" rel="noopener"
				:title="'Signed in to PickiPedia as ' + account.name + '. Saves go in under this name.'">
				<span class="rh-account-dot" aria-hidden="true"></span>{{ account.name }}
			</a>
			<a v-else-if="account.name === null" class="rh-account signed-out"
				href="/index.php?title=Special:UserLogin" target="_blank" rel="noopener"
				title="Not signed in to PickiPedia: a chart can't be saved until you are. Opens in a new tab.">Log in</a>
			<button class="minimize-btn" title="Minimize/Maximize" @click="layout.toggleDock()">
				<span id="minimize-icon">{{ icon }}</span>
			</button>
		</div>
	</div>
</template>
