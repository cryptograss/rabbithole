<script setup>
/*
 * Search results, in place of an article: the box you typed in, kept at
 * the top so the next search starts where the last one ended, and what
 * the wiki found.
 *
 * The snippets are the wiki's own HTML -- it marks the matched words --
 * so they go in as markup; everything else here is ours.
 */
import { ref, watch } from 'vue';
import { wikiPath } from '../../wiki/urls.js';

const props = defineProps( {
	text: { type: String, default: '' },
	hits: { type: Array, default: () => [] },
} );
const emit = defineEmits( [ 'search' ] );

const typed = ref( props.text );
watch( () => props.text, ( value ) => {
	typed.value = value;
} );
</script>

<template>
	<div class="pane-chrome">
		<input
			v-model="typed"
			class="pane-search"
			type="search"
			placeholder="Search PickiPedia"
			aria-label="Search PickiPedia"
			@keydown.enter="emit( 'search', typed )"
		>
	</div>
	<div id="globalWrapper">
		<div id="column-content">
			<div id="content" class="mw-body">
				<div class="mw-body-content">
					<h1 class="pane-title">{{ hits.length }} result{{ hits.length === 1 ? '' : 's' }} for {{ text }}</h1>
					<ul class="pane-results">
						<li v-for="hit in hits" :key="hit.title">
							<a :href="wikiPath( hit.title )">{{ hit.title }}</a>
							<!-- eslint-disable-next-line vue/no-v-html -- the wiki's own highlighted snippet -->
							<div class="snippet" v-html="hit.snippet || ''"></div>
						</li>
					</ul>
				</div>
			</div>
		</div>
	</div>
</template>
