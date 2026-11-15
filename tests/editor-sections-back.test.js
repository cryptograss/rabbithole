/**
 * A chart that arrives in sections is saved in sections.
 *
 * Justin, #rabbithole 15 Nov 2026: "it's better to leave section numbers
 * in place, if they are present in Release Metadata that has a
 * standardSectionLength." The editor still works in seconds; the save
 * puts the sections back on, and only when they say exactly the same
 * thing.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EditableTrackData, flattenSections } from '../src/editor/EditableTrackData.js';
import { sectionShape, sectionize } from '../src/editor/sections.js';

/* August, as it was written in May: three passes and two moments inside one. */
const AUGUST = {
	title: 'August',
	standardSectionLength: 13.65,
	ensemble: { 'Justin Holmes': [ 'guitar' ], 'Maddie Denton': [ 'fiddle' ] },
	timeline: {
		'0': { part: 'intro', solo: 'Justin Holmes' },
		'7.2': { pickup: 'Maddie Denton' },
		'8.3': { part: 'A', solo: 'Maddie Denton' },
		section1: { part: 'A', solo: 'Justin Holmes' },
		section2: { part: 'B', solo: 'Justin Holmes', '40': { pickup: 'Maddie Denton' }, '42.5': { solo: 'Maddie Denton' } },
		section3: { part: 'A', solo: 'Harry Clark' },
	},
};

const flatOf = ( track ) => flattenSections( track ).timeline;

beforeEach( () => {
	globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
} );

describe( 'sectionShape', () => {
	it( 'is where each section starts, by the player\'s own arithmetic', () => {
		const shape = sectionShape( AUGUST );
		expect( shape.standard ).toBe( 13.65 );
		expect( shape.sections.map( ( s ) => s.name ) ).toEqual( [ 'section1', 'section2', 'section3' ] );
		expect( shape.sections[ 0 ].time ).toBeCloseTo( 21.95, 6 );
	} );

	it( 'is nothing for a chart written in seconds', () => {
		expect( sectionShape( { timeline: { '0': { part: 'A' } } } ) ).toBeNull();
		expect( sectionShape( { standardSectionLength: 10, timeline: { '0': { part: 'A' } } } ) ).toBeNull();
	} );
} );

describe( 'sectionize', () => {
	it( 'puts an untouched chart back exactly as it was', () => {
		const back = sectionize( flatOf( AUGUST ), sectionShape( AUGUST ) );
		expect( back ).toEqual( AUGUST.timeline );
	} );

	it( 'keeps a new moment inside the pass it falls in, saying only what it adds', () => {
		const flat = { ...flatOf( AUGUST ), 45: { solo: 'Maddie Denton', flourish: 'Gaven Largent' } };
		const back = sectionize( flat, sectionShape( AUGUST ) );
		// A moment says what it adds to its section, which is Justin's pass:
		// Maddie having taken it at 42.5 is that moment's business, not this one's.
		expect( back.section2[ '45' ] ).toEqual( { solo: 'Maddie Denton', flourish: 'Gaven Largent' } );
	} );

	it( 'makes a new section of a pass that lands on the next line of the grid', () => {
		const next = 49.25 + 13.65;
		const flat = { ...flatOf( AUGUST ), [ next ]: { part: 'B', solo: 'Kyle Tuttle' } };
		const back = sectionize( flat, sectionShape( AUGUST ) );
		expect( back.section4 ).toEqual( { part: 'B', solo: 'Kyle Tuttle' } );
	} );

	it( 'homes a moment under the section it falls in', () => {
		/*
		 * A sub-moment's key is an absolute time, so which section it is
		 * written under is bookkeeping, and Paint Exchange's chart keeps
		 * several of them under the section before the one they sound in.
		 * The chart says the same either way; written back, each goes
		 * where it belongs.
		 */
		const chart = {
			standardSectionLength: 10,
			timeline: {
				'0': { part: 'A' },
				section1: { part: 'A', '24': { flourish: 'Sam Grisman' } },
				section2: { part: 'B' },
			},
		};
		const back = sectionize( flatOf( chart ), sectionShape( chart ) );
		// section1 is 0 + 10, section2 is 20: the moment at 24 sounds in section2.
		expect( back.section1[ '24' ] ).toBeUndefined();
		expect( back.section2[ '24' ] ).toEqual( { flourish: 'Sam Grisman' } );
	} );

	it( 'keeps a moment that was written on the second a section starts', () => {
		/*
		 * Paint Exchange has a five-second flourish for John Mailander at
		 * 23.5, written under one section and landing where the next one
		 * starts. Resolved to seconds it was put down under the section
		 * start and lost, so opening the chart and saving it took it off
		 * the page. It is part of how that section starts, and goes back
		 * as that.
		 */
		const chart = {
			standardSectionLength: 11.75,
			timeline: {
				'0': { part: 'A' },
				section2: {
					'12.8': { musicians: { band: 'in' } },
					'23.5': { flourish: 'John Mailander', flourishDuration: 5 },
				},
				section3: { part: 'A', '36': { flourish: 'Justin Holmes' } },
				section4: {},
			},
		};
		const flat = flatOf( chart );
		expect( flat[ '23.5' ] ).toEqual( { part: 'A', flourish: 'John Mailander', flourishDuration: 5 } );
		const back = sectionize( flat, sectionShape( chart ) );
		expect( back ).toEqual( {
			'0': { part: 'A' },
			section2: { '12.8': { musicians: { band: 'in' } } },
			section3: { part: 'A', flourish: 'John Mailander', flourishDuration: 5 },
			// 36 sounds in section4, which starts at 35.25.
			section4: { '36': { flourish: 'Justin Holmes' } },
		} );
		// And said that way, it is the same chart.
		expect( flatOf( { ...chart, timeline: back } ) ).toEqual( flat );
	} );

	it( 'writes a moment\'s own lights even where its pass has the same ones', () => {
		// A moment takes nothing that happens once from its pass, so a
		// flourish it shares with the pass has to be said again or it is
		// not there.
		const chart = {
			standardSectionLength: 10,
			timeline: {
				'0': { part: 'intro' },
				section1: { part: 'A', solo: 'Kyle Tuttle', flourish: 'Gaven Largent', '14': { flourish: 'Gaven Largent' } },
			},
		};
		const back = sectionize( flatOf( chart ), sectionShape( chart ) );
		expect( back ).toEqual( chart.timeline );
	} );

	it( 'keeps and makes sections past the twentieth', () => {
		const timeline = { '0': { part: 'intro' } };
		for ( let i = 1; i <= 22; i++ ) {
			timeline[ `section${ i }` ] = { part: i % 2 ? 'A' : 'B' };
		}
		const chart = { standardSectionLength: 10, timeline };
		const flat = { ...flatOf( chart ), 230: { part: 'A', solo: 'Kyle Tuttle' } };
		const back = sectionize( flat, sectionShape( chart ) );
		expect( back.section22 ).toEqual( { part: 'B' } );
		expect( back.section23 ).toEqual( { part: 'A', solo: 'Kyle Tuttle' } );
	} );

	it( 'writes seconds instead when a section start is gone', () => {
		const flat = { ...flatOf( AUGUST ) };
		delete flat[ '35.6' ];
		expect( sectionize( flat, sectionShape( AUGUST ) ) ).toBeNull();
	} );

	it( 'writes seconds instead when the sections would land somewhere else', () => {
		// The sections accumulate from the last explicit time; moving it
		// moves every one of them, so the sectioned text would lie.
		const flat = { ...flatOf( AUGUST ) };
		delete flat[ '8.3' ];
		expect( sectionize( flat, sectionShape( AUGUST ) ) ).toBeNull();
	} );
} );

describe( 'EditableTrackData.savingData', () => {
	it( 'writes the sections back for a chart that came in them', () => {
		const data = new EditableTrackData( AUGUST, { enableBackup: false } );
		expect( data.savingData().timeline ).toEqual( AUGUST.timeline );
		expect( data.workingData.timeline[ '21.950000000000003' ] ).toBeDefined();
	} );

	it( 'leaves a chart written in seconds in seconds', () => {
		const swords = { title: 'Swords', timeline: { '0': { part: 'intro' }, '46.7': { part: 'A' } } };
		const data = new EditableTrackData( swords, { enableBackup: false } );
		expect( data.savingData().timeline ).toEqual( swords.timeline );
	} );

	it( 'falls back to seconds rather than write a chart it cannot say in sections', () => {
		const data = new EditableTrackData( AUGUST, { enableBackup: false } );
		data.deleteMarker( 35.6 );
		expect( data.savingData().timeline[ '21.950000000000003' ] ).toBeDefined();
		expect( data.savingData().timeline.section1 ).toBeUndefined();
	} );
} );
