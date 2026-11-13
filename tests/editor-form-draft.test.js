// @vitest-environment happy-dom
/**
 * The marker form is a draft until Save or Cancel.
 *
 * Skyler, 10 Nov 2026: choose a soloist, then a part, and the soloist
 * field went blank. A part on an existing marker takes at once, the editor
 * rebuilds, and the form was rebuilt from the saved marker, which had no
 * soloist yet. The open form now rides through any rebuild whole.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EditableTrackData } from '../src/editor/EditableTrackData.js';
import { TimelineEditor } from '../src/editor/TimelineEditor.js';

const TRACK = {
	title: 'Silver 44',
	ensemble: { 'Harry Clark': [ 'mandolin' ], 'Maddie Denton': [ 'fiddle' ] },
	timeline: { '0': { part: 'A' }, '21.5': { part: 'B' } },
};

let editor, data;
beforeEach( () => {
	globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
	document.body.innerHTML = '<div id="ed"></div>';
	data = new EditableTrackData( TRACK );
	editor = new TimelineEditor( 'ed', data, null );
} );

const form = () => document.querySelector( '.marker-form' );

describe( 'the marker form', () => {
	it( 'keeps a soloist typed before the part is picked', () => {
		editor.openMarkerForm( 21.5, 21.5 );
		form().querySelector( '.mf-solo' ).value = 'Harry Clark';
		form().querySelector( '.mf-part[data-part="A"]' ).click();

		expect( form() ).not.toBeNull();
		expect( form().querySelector( '.mf-solo' ).value ).toBe( 'Harry Clark' );
		expect( data.getMarker( 21.5 ).part ).toBe( 'A' );
		expect( form().querySelector( '.mf-part.on' ).dataset.part ).toBe( 'A' );
	} );

	it( 'keeps it through a second part click too', () => {
		editor.openMarkerForm( 21.5, 21.5 );
		form().querySelector( '.mf-solo' ).value = 'Maddie Denton';
		form().querySelector( '.mf-part[data-part="A"]' ).click();
		form().querySelector( '.mf-part[data-part="A"]' ).click();

		expect( form().querySelector( '.mf-solo' ).value ).toBe( 'Maddie Denton' );
		expect( data.getMarker( 21.5 ).part ).toBeUndefined();
	} );

	it( 'goes away when its marker does', () => {
		editor.openMarkerForm( 21.5, 21.5 );
		data.deleteMarker( 21.5 );
		expect( form() ).toBeNull();
	} );
} );
