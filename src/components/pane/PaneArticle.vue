<script setup>
/*
 * An article, in the pane.
 *
 * The wiki's own HTML is the one string here: MediaWiki parses the page
 * and we show what it gives us. Everything around it -- the containers
 * MonoBook's rules hang off, the title, the way out to the wiki itself --
 * is markup we own, so it is written as markup rather than concatenated
 * (Justin, #rabbithole, 14 Nov 2026).
 *
 * Two slots, for the things that are about the reading rather than the
 * page: `title` for what goes beside the heading (the chase pill), and
 * the default slot for what goes above the article (the chase offer, the
 * trail).
 */
import { computed } from 'vue';
import { wikiPath } from '../../wiki/urls.js';

const props = defineProps( {
	title: { type: String, required: true },
	text: { type: String, default: '' },
	displaytitle: { type: String, default: '' },
} );

const href = computed( () => wikiPath( props.title ) );
</script>

<template>
	<div id="globalWrapper">
		<div id="column-content">
			<div id="content" class="mw-body">
				<div class="mw-body-content">
					<slot></slot>
					<!-- The title is the way out: the same page on PickiPedia
					     itself, in a new tab, so the song plays on. Inside the
					     pane there was no telling how to escape to the regular
					     wiki page (Justin, 12 Nov 2026). target=_blank is also
					     what tells the pane's click handler to leave it alone. -->
					<h1 class="pane-title firstHeading"><a
						class="pane-escape"
						:href="href"
						target="_blank"
						rel="noopener"
						title="Open on PickiPedia, in a new tab"
					><span v-if="displaytitle" v-html="displaytitle"></span><template v-else>{{ title }}</template><span
						class="pane-escape-mark" aria-hidden="true">↗</span></a><slot name="title"></slot></h1>
					<!-- The article itself. The wrapper is display:contents, so
					     the wiki's own nodes lay out as children of
					     .mw-body-content, as they did when the whole pane was
					     one string. -->
					<!-- eslint-disable-next-line vue/no-v-html -- the wiki's own parsed article -->
					<div class="pane-wikitext" v-html="text"></div>
				</div>
			</div>
		</div>
	</div>
</template>
