<script setup>
/*
 * The wiki, in a box we own.
 *
 * The pane store decides what the box holds: an HTML string, replaced
 * whole. This component puts it in a shadow root, so MediaWiki's styles
 * go in with the content and cannot reach the dock, and listens once, on
 * the root, for what happens inside: a link to another page stays in the
 * pane and stops the follow; a Listen button hands its track to the
 * player; the mode switcher and the search box do what they say.
 */
import { ref, watch, onMounted } from 'vue';
import { usePaneStore } from '../stores/pane.js';
import { useLayoutStore } from '../stores/layout.js';
import { PANE_STYLES, escapeHtml } from '../wiki/pane-html.js';
import { listenRequest, playTrackInDock, queueTrack, trailToHere } from '../wiki/queue.js';
import { titleFromHref, leavesTheApp } from '../wiki/pane-links.js';

const pane = usePaneStore();
const layout = useLayoutStore();
const host = ref( null );
let shadow = null;

async function onClick( e ) {
	const a = e.composedPath().find( ( el ) => el.tagName === 'A' );
	if ( ! a ) {
		return;
	}
	const listen = listenRequest( a.getAttribute( 'href' ) );
	if ( listen ) {
		e.preventDefault();
		if ( listen.action === 'trail' ) {
			await trailToHere( a );
		} else if ( listen.action === 'queue' ) {
			await queueTrack( listen.cid, a );
		} else {
			await playTrackInDock( listen.cid );
		}
		return;
	}
	const href = a.getAttribute( 'href' );
	const title = titleFromHref( href );
	if ( title ) {
		e.preventDefault();
		layout.stopFollowing();
		pane.open( title );
		return;
	}
	if ( leavesTheApp( href ) ) {
		// An edit form, a history page, a Special page: the wiki's own
		// pages, which the pane cannot hold (injected HTML runs no
		// scripts). They open in a new tab, so the song and an open
		// timeline editor stay where they are (Skyler, 6 Nov 2026).
		e.preventDefault();
		window.open( new URL( href, window.location.origin ).href, '_blank', 'noopener' );
	}
}

function onChange( e ) {
	const el = e.composedPath()[ 0 ];
	if ( el && el.classList && el.classList.contains( 'pane-mode' ) ) {
		pane.setMode( el.value );
	}
}

function onKeydown( e ) {
	const el = e.composedPath()[ 0 ];
	if ( e.key === 'Enter' && el && el.classList && el.classList.contains( 'pane-search' ) ) {
		layout.stopFollowing();
		pane.search( el.value );
	}
}

/*
 * A search form in the pane (MonoBook's, in skin mode) searches in the
 * pane. Left alone it would submit the whole window to /index.php and
 * walk away from the player; injected HTML runs no scripts, so nothing
 * of MonoBook's own would answer it either.
 */
function onSubmit( e ) {
	const form = e.composedPath()[ 0 ];
	const input = form && form.querySelector && form.querySelector( 'input[name="search"]' );
	if ( ! input ) {
		return;
	}
	e.preventDefault();
	layout.stopFollowing();
	pane.search( input.value );
}

function trailPanel( trail ) {
	const div = document.createElement( 'div' );
	div.className = 'pp-trail';
	div.setAttribute( 'style', 'margin:.6em 0; padding:.6em .8em; border:1px solid #c9d3c3; '
		+ 'border-left:4px solid #4a7c59; background:#f6f8f4; font-size:13px; line-height:1.5;' );
	div.innerHTML = '<strong>Down the rabbithole from ' + escapeHtml( trail.from.replace( /^Song:/, '' ) )
		+ '</strong><ol style="margin:.4em 0 0; padding-left:1.4em;">'
		+ trail.hops.map( ( hop ) => '<li>' + escapeHtml( hop.via )
			+ ( hop.instrument ? ' <em>(' + escapeHtml( hop.instrument ) + ')</em>' : '' )
			+ ' played on both — to <strong>' + escapeHtml( hop.to.replace( /^Song:/, '' ) ) + '</strong></li>' ).join( '' )
		+ '</ol>';
	return div;
}

function render() {
	if ( ! shadow ) {
		return;
	}
	shadow.innerHTML = PANE_STYLES + pane.html;
	if ( host.value ) {
		host.value.scrollTop = 0;
	}
	showTrail();
}

function showTrail() {
	if ( ! shadow ) {
		return;
	}
	shadow.querySelectorAll( '.pp-trail' ).forEach( ( el ) => el.remove() );
	if ( pane.trail ) {
		const body = shadow.querySelector( '.mw-body-content' ) || shadow;
		body.insertBefore( trailPanel( pane.trail ), body.firstChild );
	}
}

onMounted( () => {
	shadow = host.value.shadowRoot || host.value.attachShadow( { mode: 'open' } );
	shadow.addEventListener( 'click', onClick );
	shadow.addEventListener( 'change', onChange );
	shadow.addEventListener( 'keydown', onKeydown );
	shadow.addEventListener( 'submit', onSubmit );
	render();
} );

watch( () => pane.revision, render );
watch( () => pane.trail, showTrail );
</script>

<template>
	<div id="pickipedia-frame" ref="host" class="pickipedia-frame"></div>
</template>
