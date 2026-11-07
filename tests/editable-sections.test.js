/**
 * The editor opens a sectioned chart in seconds.
 *
 * Paint Exchange and August are written as section1, section2... with a
 * standardSectionLength; the editor read those keys as NaN, so every
 * marker's play button seeked nowhere (Skyler, 6 Nov 2026). The editor
 * resolves them the way the player does, and nothing else changes.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EditableTrackData, flattenSections, hasSections } from '../src/editor/EditableTrackData.js';

const PAINT = {
	title: 'Paint Exchange',
	standardSectionLength: 11.75,
	ensemble: { 'Justin Holmes': [ 'mandolin' ], 'Kaitlyn Raitz': [ 'cello' ] },
	timeline: {
		'0': { part: 'A', musicians: { 'Justin Holmes': 'in' } },
		section2: { '12.8': { musicians: { band: 'in' } } },
		section3: { part: 'A' },
		section7: { solo: 'Kaitlyn Raitz', '71': { spotlight: 'Kaitlyn Raitz' } },
	},
};

beforeEach( () => {
	globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
} );

describe( 'flattenSections', () => {
	it( 'resolves section keys to seconds, the way the player does', () => {
		const flat = flattenSections( PAINT ).timeline;
		expect( hasSections( flat ) ).toBe( false );
		// section1 is absent and does not count: section2 is the first 11.75 after the last explicit time (0).
		expect( flat[ 11.75 ] ).toEqual( {} );
		expect( flat[ 23.5 ] ).toEqual( { part: 'A' } );
		expect( flat[ 12.8 ] ).toEqual( { musicians: { band: 'in' } } );
		// A moment inside a section carries the section's arrangement.
		expect( flat[ 71 ] ).toEqual( { solo: 'Kaitlyn Raitz', spotlight: 'Kaitlyn Raitz' } );
		expect( Object.values( flat ).some( ( a ) => '_isSectionStart' in a || '_isSubMoment' in a ) ).toBe( false );
	} );

	it( 'leaves a chart in seconds alone', () => {
		const swords = { title: 'Swords', timeline: { '0': { part: 'intro' }, '46.7': { part: 'A' } } };
		expect( flattenSections( swords ) ).toBe( swords );
	} );
} );

describe( 'EditableTrackData on a sectioned chart', () => {
	it( 'has a number for every marker, and is not dirty for having opened', () => {
		const data = new EditableTrackData( PAINT, { enableBackup: false } );
		const times = data.getTimelineEntries().map( ( e ) => e.time );
		expect( times.every( Number.isFinite ) ).toBe( true );
		expect( times ).toEqual( [ 0, 11.75, 12.8, 23.5, 35.25, 71 ] );
		expect( data.isDirty ).toBe( false );
		expect( data.workingData.standardSectionLength ).toBe( 11.75 );
	} );
} );
