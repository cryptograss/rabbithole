// @vitest-environment happy-dom
/**
 * The ruler's transport, and the light on the selected marker.
 *
 * Skyler, 15 Nov 2026, charting August: the carrot followed the rabbit, so
 * the play button moved every time the song did; dragging the rabbit on a
 * fresh page and pressing play started nothing; and the marker last edited
 * stayed lit while the song lit the ones it played through.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EditableTrackData } from '../src/editor/EditableTrackData.js';
import { TimelineEditor } from '../src/editor/TimelineEditor.js';

const TRACK = {
	title: 'August',
	duration: 180,
	ensemble: { 'Harry Clark': [ 'mandolin' ], 'Maddie Denton': [ 'fiddle' ] },
	timeline: { '0': { part: 'intro' }, '21.5': { part: 'A', solo: 'Harry Clark' } },
};

/** Enough of the player model for the editor: what it asks of the audio. */
function fakePlayer( { duration = 0, playing = false } = {} ) {
	const seeks = [];
	return {
		seeks,
		webamp: {
			seekToTime: ( t ) => seeks.push( t ),
			store: { getState: () => ( { media: { status: playing ? 'PLAYING' : 'STOPPED' } } ), subscribe: () => {}, dispatch: () => {} },
		},
		isPlaying: () => playing,
		getDuration: () => duration,
		getCurrentTime: () => 0,
		onTimeUpdate: () => {},
		updateTimeline: () => {},
	};
}

let data, editor, player;
function build( options = {}, playerOptions = {} ) {
	globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
	document.body.innerHTML = '<div id="ed"></div>';
	data = new EditableTrackData( TRACK );
	player = fakePlayer( playerOptions );
	editor = new TimelineEditor( 'ed', data, player, options );
}

beforeEach( () => build() );

describe( 'the ruler\'s carrot', () => {
	it( 'is the column\'s own button, not the playhead\'s', () => {
		const carrot = document.querySelector( '.ruler-carrot' );
		expect( carrot ).not.toBeNull();
		expect( carrot.closest( '.ruler-playhead' ) ).toBeNull();
		expect( carrot.parentElement.className ).toBe( 'timeline-ruler' );
	} );

	it( 'plays and pauses, and says which it would do', () => {
		let toggled = 0;
		player.togglePlay = () => { toggled += 1; };
		document.querySelector( '.ruler-carrot' ).click();
		expect( toggled ).toBe( 1 );
		expect( document.querySelector( '.ruler-carrot' ).classList.contains( 'playing' ) ).toBe( false );
	} );
} );

describe( 'seeking before the audio knows its length', () => {
	it( 'asks for nothing, remembers the time, and shows the rabbit there', () => {
		editor.seekTo( 90 );
		expect( player.seeks ).toEqual( [] );
		expect( editor._startFrom ).toBe( 90 );
		expect( editor.currentPlayingTime ).toBe( 90 );
		expect( document.querySelector( '.ruler-playhead-tag b' ).textContent ).toBe( '1:30' );
	} );

	it( 'spends the remembered time the moment playing begins', () => {
		editor.seekTo( 90 );
		editor._seekUntilLanded( editor._startFrom );
		expect( player.seeks ).toEqual( [ 90.05 ] );
		clearInterval( editor._seekWhenReady );
	} );

	it( 'seeks straight away once the audio has a length', () => {
		build( {}, { duration: 179.2 } );
		editor.seekTo( 90 );
		expect( player.seeks ).toEqual( [ 90.05 ] );
	} );
} );

describe( 'the light on the selected marker', () => {
	it( 'comes on with the selection, wherever it is set from', () => {
		data.selectedMarkerTime = 21.5;
		expect( data.selectionShown ).toBe( true );
		editor.render();
		expect( document.querySelectorAll( '.ruler-marker.selected' ).length ).toBe( 1 );
		expect( document.querySelectorAll( '.marker-row.selected' ).length ).toBe( 1 );
	} );

	it( 'goes out at the next action, and the marker stays selected', () => {
		data.selectedMarkerTime = 21.5;
		editor.render();
		document.querySelector( '.ruler-track' ).dispatchEvent(
			new window.PointerEvent( 'pointerdown', { bubbles: true } ) );
		expect( document.querySelectorAll( '.selected' ).length ).toBe( 0 );
		expect( data.selectedMarkerTime ).toBe( 21.5 );
		expect( data.selectionShown ).toBe( false );
		editor.render();
		expect( document.querySelectorAll( '.selected' ).length ).toBe( 0 );
	} );

	it( 'stays on when the press is that marker\'s own row', () => {
		data.selectedMarkerTime = 21.5;
		editor.render();
		document.querySelector( '.marker-row' ).dispatchEvent(
			new window.PointerEvent( 'pointerdown', { bubbles: true } ) );
		expect( data.selectionShown ).toBe( true );
		expect( document.querySelectorAll( '.selected' ).length ).toBeGreaterThan( 0 );
	} );

	it( 'is on the marker a save just wrote', () => {
		editor.openMarkerForm( 40, null );
		document.querySelector( '.marker-form .mf-part[data-part="B"]' ).click();
		document.querySelector( '.marker-form .mf-save' ).click();
		expect( data.selectedMarkerTime ).toBe( 40 );
		expect( data.selectionShown ).toBe( true );
		expect( document.querySelector( '.marker-row.selected' ).dataset.time ).toBe( '40' );
	} );
} );
