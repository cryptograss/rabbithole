// @vitest-environment happy-dom
/**
 * Clicking the wave seeks; adding a moment takes its own button.
 *
 * Justin, #rabbithole-editor, 16 Nov 2026: "it's too easy to accidentally
 * mark a moment using the editor". A click on the ruler that had not
 * dragged opened the marker form, so every time he clicked to listen to a
 * spot he was handed a new moment to fill in or cancel. Charting is mostly
 * listening; the clicks you make all day should do the harmless thing.
 *
 * So: the wave seeks, wherever you click it, and a "+" rides the hover line
 * in the gutter beside it. That button, and only that button, puts a new
 * moment on the chart.
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
function fakePlayer() {
	const seeks = [];
	return {
		seeks,
		webamp: {
			seekToTime: ( t ) => seeks.push( t ),
			store: {
				getState: () => ( { media: { status: 'STOPPED' } } ),
				subscribe: () => {},
				dispatch: () => {},
			},
		},
		isPlaying: () => false,
		getDuration: () => 180,
		getCurrentTime: () => 0,
		onTimeUpdate: () => {},
		updateTimeline: () => {},
	};
}

/** The ruler as it is on screen: 400 pixels tall, 100 from the top. */
const TOP = 100;
const HEIGHT = 400;

let data, editor, player, track, opened;

function build( options = {} ) {
	globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
	document.body.innerHTML = '<div id="ed"></div>';
	data = new EditableTrackData( TRACK, { enableBackup: false } );
	player = fakePlayer();
	editor = new TimelineEditor( 'ed', data, player, options );

	track = document.querySelector( '.ruler-track' );
	track.getBoundingClientRect = () => ( {
		top: TOP, bottom: TOP + HEIGHT, height: HEIGHT,
		left: 0, right: 100, width: 100, x: 0, y: TOP,
	} );

	opened = [];
	editor.openMarkerForm = ( time, existing ) => opened.push( { time, existing } );
}

/** The clientY that lands on a second of the song. */
const yFor = ( seconds ) => TOP + ( seconds / parseFloat( track.dataset.duration ) ) * HEIGHT;

/* seekTo lands just past the second asked for, so a seek to the start of
   a part does not land on the frame before it changes. */
const NUDGE = 0.05;

function mouse( target, type, clientY ) {
	target.dispatchEvent( new window.MouseEvent( type, { clientY, bubbles: true, cancelable: true } ) );
}

beforeEach( () => build() );

describe( 'a click on the wave', () => {
	it( 'seeks there, and writes nothing', () => {
		mouse( track, 'mousedown', yFor( 60 ) );
		mouse( window, 'mouseup', yFor( 60 ) );

		expect( player.seeks ).toEqual( [ 60 + NUDGE ] );
		expect( opened ).toEqual( [] );
		expect( Object.keys( data.timeline ) ).toEqual( [ '0', '21.5' ] );
	} );

	it( 'still seeks at the end of a scrub', () => {
		mouse( track, 'mousedown', yFor( 30 ) );
		mouse( window, 'mousemove', yFor( 90 ) );
		mouse( window, 'mouseup', yFor( 90 ) );

		expect( player.seeks[ player.seeks.length - 1 ] ).toBe( 90 + NUDGE );
		expect( opened ).toEqual( [] );
	} );
} );

describe( 'the "+" beside the hover line', () => {
	it( 'rides the hover line, in the gutter', () => {
		const add = document.querySelector( '.ruler-add' );
		expect( add ).not.toBeNull();
		expect( add.closest( '.ruler-hover' ) ).not.toBeNull();
	} );

	it( 'opens the form at the second under the pointer', () => {
		mouse( track, 'mousemove', yFor( 45 ) );
		document.querySelector( '.ruler-add' ).click();

		expect( opened ).toEqual( [ { time: 45, existing: null } ] );
		expect( player.seeks ).toEqual( [] );
	} );

	it( 'does not start a scrub when it is pressed', () => {
		mouse( track, 'mousemove', yFor( 45 ) );
		const add = document.querySelector( '.ruler-add' );
		mouse( add, 'mousedown', yFor( 45 ) );
		mouse( window, 'mouseup', yFor( 45 ) );

		expect( player.seeks ).toEqual( [] );
	} );

	it( 'is not on the read-only ruler', () => {
		build( { viewOnly: true } );
		expect( document.querySelector( '.ruler-add' ) ).toBeNull();
	} );
} );
