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
import { CHASE_STYLES, chaseOfferHtml, chasePillHtml } from '../wiki/chase.js';
import { listenRequest, playTrackInDock, queueTrack, trailToHere } from '../wiki/queue.js';
import { linkIn, titleFromHref, leavesTheApp } from '../wiki/pane-links.js';
import { usePickerStore } from '../stores/picker.js';

const pane = usePaneStore();
const layout = useLayoutStore();
const picker = usePickerStore();
const host = ref( null );
let shadow = null;

async function onClick( e ) {
	const chaseBtn = e.composedPath().find( ( el ) => el.dataset && ( el.dataset.chase || el.dataset.unchase ) );
	if ( chaseBtn ) {
		if ( chaseBtn.dataset.chase ) {
			await picker.follow( chaseBtn.dataset.chase );
		} else {
			picker.stop();
		}
		return;
	}
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
	const listen = listenRequest( href );
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
	const title = titleFromHref( href );
	if ( title ) {
		e.preventDefault();
		layout.stopFollowing();
		pane.open( title );
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

function onKeydown( e ) {
	const el = e.composedPath()[ 0 ];
	if ( e.key === 'Enter' && el && el.classList && el.classList.contains( 'pane-search' ) ) {
		layout.stopFollowing();
		pane.search( el.value );
	}
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

/*
 * Chasing a picker, shown in one of two places and never both: the pill
 * beside their name in the title while they are being chased, or the one
 * line offering the chase on their page. chase.js writes both; this only
 * puts them where they go (Justin's points 10 and 13, 13 Nov 2026).
 */
function showChase() {
	if ( ! shadow ) {
		return;
	}
	shadow.querySelectorAll( '.pp-chase, .pp-chasing' ).forEach( ( el ) => el.remove() );
	const offer = picker.offer;
	if ( ! offer ) {
		return;
	}
	if ( picker.following === offer.name ) {
		const title = shadow.querySelector( '.pane-title' );
		if ( title ) {
			title.insertAdjacentHTML( 'beforeend', chasePillHtml( offer.name ) );
		}
		return;
	}
	const html = chaseOfferHtml( offer );
	if ( html ) {
		const body = shadow.querySelector( '.mw-body-content' ) || shadow;
		body.insertAdjacentHTML( 'afterbegin', html );
	}
}

function render() {
	if ( ! shadow ) {
		return;
	}
	shadow.innerHTML = PANE_STYLES + CHASE_STYLES + pane.html;
	if ( host.value ) {
		host.value.scrollTop = 0;
	}
	showTrail();
	showChase();
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
	shadow.addEventListener( 'keydown', onKeydown );
	render();
} );

watch( () => pane.revision, render );
watch( () => pane.trail, showTrail );
watch( () => pane.shown, ( title ) => picker.look( title ), { immediate: true } );
watch( () => [ picker.offer, picker.following ], showChase );
</script>

<template>
	<div id="pickipedia-frame" ref="host" class="pickipedia-frame"></div>
</template>
