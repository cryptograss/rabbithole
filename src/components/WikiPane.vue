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
import { usePickerStore } from '../stores/picker.js';

const pane = usePaneStore();
const layout = useLayoutStore();
const picker = usePickerStore();
const host = ref( null );
let shadow = null;

async function onClick( e ) {
	const followBtn = e.composedPath().find( ( el ) => el.dataset && ( el.dataset.follow || el.dataset.unfollow ) );
	if ( followBtn ) {
		if ( followBtn.dataset.follow ) {
			await picker.follow( followBtn.dataset.follow );
		} else {
			picker.stop();
		}
		return;
	}
	const a = e.composedPath().find( ( el ) => el.tagName === 'A' );
	if ( ! a ) {
		return;
	}
	if ( a.target === '_blank' ) {
		// Asked for a new tab, by the pane's own title above all: the
		// browser does that itself, and the song plays on here.
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

const first = ( name ) => name.split( ' ' )[ 0 ];
const songName = ( song ) => escapeHtml( song.replace( /^Song:/, '' ) );

/*
 * On a picker's page, one line: what following them does, and the song it
 * plays next, named before you press anything (Justin, 7 Nov 2026).
 */
function followPanel( offer ) {
	const div = document.createElement( 'div' );
	div.className = 'pp-follow';
	div.setAttribute( 'style', 'margin:.6em 0; padding:.5em .8em; border:1px solid #f0c9a8; '
		+ 'border-left:4px solid #ff6b35; background:#fff8f2; font-size:13px; line-height:1.5;' );
	const name = escapeHtml( offer.name );
	const button = ( attr, label ) => ' <button ' + attr + ' style="margin-left:.4em; padding:.1em .7em; '
		+ 'border:1px solid #4a7c59; border-radius:4px; background:#4a7c59; color:#fff; font-size:12px; cursor:pointer;">'
		+ label + '</button>';
	if ( picker.following === offer.name ) {
		div.innerHTML = '🐇 <strong>Following ' + name + '.</strong> '
			+ ( offer.next ? 'Plays next: <strong>' + songName( offer.next.song ) + '</strong>.'
				: 'No more songs of theirs to play.' )
			+ button( 'data-unfollow="1"', 'Stop following' );
	} else if ( offer.next ) {
		div.innerHTML = '🐇 <strong>Follow ' + name + '</strong>: after this song, play the songs '
			+ escapeHtml( first( offer.name ) ) + ' is on, one after another. First up: <strong>'
			+ songName( offer.next.song ) + '</strong>.'
			+ button( 'data-follow="' + name + '"', 'Follow ' + escapeHtml( first( offer.name ) ) );
	} else {
		div.innerHTML = '🐇 ' + name + ' isn\'t on another song with a recording yet, so there\'s nobody to follow.';
	}
	return div;
}

function showFollow() {
	if ( ! shadow ) {
		return;
	}
	shadow.querySelectorAll( '.pp-follow' ).forEach( ( el ) => el.remove() );
	if ( picker.offer ) {
		const body = shadow.querySelector( '.mw-body-content' ) || shadow;
		body.insertBefore( followPanel( picker.offer ), body.firstChild );
	}
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
	showFollow();
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
watch( () => [ picker.offer, picker.following ], showFollow );
</script>

<template>
	<div id="pickipedia-frame" ref="host" class="pickipedia-frame"></div>
</template>
