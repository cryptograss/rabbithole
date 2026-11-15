/**
 * A time written in a chart with nothing under it is an empty moment.
 *
 * Justin, #rabbithole-editor, 15 Nov 2026: Swords to Ploughshares would
 * not open. The editor drew its panel and nothing in it, and the console
 * said "can't access property 'solo', e is null" over and over; the
 * player went with it -- the timeline stopped scrolling, Play Now did
 * nothing for any song, and Webamp's stop button would not stop.
 *
 * One null moment did all of that. In YAML a bare time --
 *
 *     '7.7':
 *
 * -- parses as null, and the editor took a pasted chart, and the browser
 * backup made from it, word for word. Every reader of a moment then met
 * a null: markerWho's `data.solo` was the first.
 *
 * The chart's moments are objects, settled at the doors a chart comes in
 * by. A bare time means a marker with nothing said about it, which the
 * ruler already calls "unnamed".
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { normalizeTimeline } from '../src/player/timeline.js';
import { EditableTrackData } from '../src/editor/EditableTrackData.js';
import { extractMetadata } from '../src/wiki/api.js';
import { markerLabel, markerWho } from '../src/editor/TimelineEditor.js';

const PLOUGHSHARES = {
	title: 'Swords to Ploughshares',
	ensemble: { 'Justin Holmes': [ 'guitar', 'vocals' ], 'Maddie Denton': [ 'fiddle' ] },
	timeline: {
		'0': { part: 'intro', pickup: 'Maddie Denton' },
		'7.7': null,
		'20.6': { part: 'B', solo: 'Justin Holmes' },
	},
};

let stored = null;

beforeEach( () => {
	stored = null;
	globalThis.localStorage = {
		getItem: () => stored,
		setItem: ( key, value ) => {
			stored = value;
		},
		removeItem: () => {
			stored = null;
		},
	};
} );

describe( 'normalizeTimeline', () => {
	it( 'makes a bare time an empty moment, and keeps it in the chart', () => {
		const out = normalizeTimeline( PLOUGHSHARES.timeline );
		expect( Object.keys( out ) ).toEqual( [ '0', '7.7', '20.6' ] );
		expect( out[ '7.7' ] ).toEqual( {} );
	} );

	it( 'leaves every real moment alone', () => {
		const out = normalizeTimeline( PLOUGHSHARES.timeline );
		expect( out[ '0' ] ).toEqual( { part: 'intro', pickup: 'Maddie Denton' } );
		expect( out[ '20.6' ] ).toEqual( { part: 'B', solo: 'Justin Holmes' } );
	} );

	it( 'answers an empty chart for nothing at all', () => {
		expect( normalizeTimeline( null ) ).toEqual( {} );
		expect( normalizeTimeline( undefined ) ).toEqual( {} );
		expect( normalizeTimeline( 'not a chart' ) ).toEqual( {} );
	} );
} );

describe( 'a chart from the wiki', () => {
	it( 'arrives with every moment an object', () => {
		const meta = extractMetadata( PLOUGHSHARES );
		expect( meta.timeline[ '7.7' ] ).toEqual( {} );
	} );

	it( 'arrives that way from arthel YAML too', () => {
		const meta = extractMetadata( {
			studio_versions: {
				0: { '4masks': { ensemble: {}, rabbithole: { timeline: { 12: null } } } },
			},
		} );
		expect( meta.timeline[ '12' ] ).toEqual( {} );
	} );
} );

describe( 'the editor', () => {
	it( 'opens a chart with a bare time, and reads every marker', () => {
		const data = new EditableTrackData( PLOUGHSHARES, { enableBackup: false } );
		const entries = data.getTimelineEntries();
		expect( entries.map( ( e ) => e.time ) ).toEqual( [ 0, 7.7, 20.6 ] );
		expect( () => entries.map( ( e ) => markerWho( e.data, data.ensemble ) ) ).not.toThrow();
		expect( markerLabel( entries[ 1 ].data, data.ensemble ) ).toBe( '' );
	} );

	it( 'opens when the browser backup holds one', () => {
		stored = JSON.stringify( {
			recordingTitle: 'Swords to Ploughshares',
			timestamp: Date.now(),
			timeline: { '0': { part: 'intro' }, '7.7': null },
		} );
		const data = new EditableTrackData(
			{ ...PLOUGHSHARES, timeline: { '0': { part: 'intro' } } },
			{ enableBackup: false }
		);
		expect( data.timeline[ '7.7' ] ).toEqual( {} );
		expect( () => data.getTimelineEntries().map( ( e ) => markerWho( e.data, data.ensemble ) ) )
			.not.toThrow();
	} );

	it( 'takes a pasted chart with a bare time through replaceTimeline', () => {
		const data = new EditableTrackData( PLOUGHSHARES, { enableBackup: false } );
		data.replaceTimeline( { '0': { part: 'A' }, '9.5': null } );
		expect( data.timeline[ '9.5' ] ).toEqual( {} );
	} );
} );
