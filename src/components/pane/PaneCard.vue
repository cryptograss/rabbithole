<script setup>
/*
 * A picker's card over traverse mode's bacon graph, while they take a solo
 * (Justin, #connectome, 18 Nov 2026), as he trimmed it on 19 Nov 2026,
 * 03:15Z: their name, which is the way to their page; their picture, small;
 * and the first three things their {{MusicianInfo}} says they do. No
 * instrument: the player shows what they're playing. A click on a link is
 * the reader going there, so traverse mode stops, as it does for any link in
 * the pane (WikiPane's click), and it comes back on when they come back to
 * the song.
 */
import { ref, watch } from 'vue';
import * as wiki from '../../wiki/api.js';
import { wikiPath } from '../../wiki/urls.js';
import { cardOf } from '../../wiki/infobox.js';

const props = defineProps( {
	name: { type: String, required: true },
} );

const title = ref( props.name );
const picture = ref( null );
const does = ref( [] );

watch( () => props.name, async ( name ) => {
	title.value = name;
	picture.value = null;
	does.value = [];
	const card = await cardOf( name, wiki.parsePage );
	if ( props.name === name ) {
		title.value = card.title;
		picture.value = card.picture;
		does.value = card.does;
	}
}, { immediate: true } );
</script>

<template>
	<aside class="pane-card" :class="{ 'with-pic': picture }" :aria-label="'About ' + title">
		<img v-if="picture" class="pane-card-pic" :src="picture.src" :srcset="picture.srcset || null"
			:alt="picture.caption" :title="picture.caption || null">
		<a class="pane-card-name" :href="wikiPath( title )">{{ title }}</a>
		<!-- The wiki's own words for each, links and all, as the pane shows any article's. -->
		<ul v-if="does.length" class="pane-card-does">
			<li v-for="( line, i ) in does" :key="i" v-html="line"></li>
		</ul>
	</aside>
</template>
