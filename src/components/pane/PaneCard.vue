<script setup>
/*
 * A picker's card over traverse mode's bacon graph, while they take a solo
 * (Justin, #connectome, 18 Nov 2026): their picture and the details their
 * {{MusicianInfo}} gives, as the wiki draws them, and the way to their page.
 * A click on either is the reader going there, so traverse mode stops, as it
 * does for any link in the pane (WikiPane's click), and it comes back on
 * when they come back to the song.
 */
import { ref, watch } from 'vue';
import * as wiki from '../../wiki/api.js';
import { wikiPath } from '../../wiki/urls.js';
import { cardOf } from '../../wiki/infobox.js';

const props = defineProps( {
	name: { type: String, required: true },
} );

const box = ref( '' );
const title = ref( props.name );

watch( () => props.name, async ( name ) => {
	box.value = '';
	title.value = name;
	const card = await cardOf( name, wiki.parsePage );
	if ( props.name === name ) {
		box.value = card.box;
		title.value = card.title;
	}
}, { immediate: true } );
</script>

<template>
	<aside class="pane-card" :aria-label="'About ' + title">
		<a class="pane-card-name" :href="wikiPath( title )">{{ title }}</a>
		<!-- The wiki's own HTML for the box, as the pane shows any article's. -->
		<div v-if="box" class="pane-card-box" v-html="box"></div>
		<a class="pane-card-more" :href="wikiPath( title )">Their page on PickiPedia</a>
	</aside>
</template>
