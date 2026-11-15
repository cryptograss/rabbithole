/**
 * Quest mode: who the song hands you, and what plays when it ends.
 *
 * Justin's items 27 and 28, #rabbithole, 15 Nov 2026.
 */
import { describe, it, expect } from 'vitest';
import { questPick, anotherTrack, anyOf } from '../../src/stores/picker.js';

const first = ( list ) => list[ 0 ];
const band = [ 'Maddie Denton', 'Kyle Tuttle', 'Harry Clark' ];

describe( 'questPick', () => {
	it( 'hands you somebody other than the picker the last song handed you', () => {
		expect( questPick( band, { last: 'Maddie Denton', choose: first } ) ).toBe( 'Kyle Tuttle' );
	} );

	it( 'passes over a picker whose every song this rabbithole has played', () => {
		const played = new Set( [ 'Kyle Tuttle' ] );
		const name = questPick( band, {
			last: 'Maddie Denton', unplayed: ( who ) => ! played.has( who ), choose: first,
		} );
		expect( name ).toBe( 'Harry Clark' );
	} );

	it( 'takes anybody when that is true of the whole band', () => {
		// "unless that's true of the entire ensemble for the current track".
		const name = questPick( band, { last: null, unplayed: () => false, choose: first } );
		expect( name ).toBe( 'Maddie Denton' );
	} );

	it( 'hands you the same picker again when the band is one person', () => {
		expect( questPick( [ 'Justin Holmes' ], { last: 'Justin Holmes', choose: first } ) )
			.toBe( 'Justin Holmes' );
	} );

	it( 'is null when the song has no band the graph knows', () => {
		expect( questPick( [], { last: null, choose: first } ) ).toBe( null );
	} );

	it( 'chooses at random by default, so the rabbithole is not a running order', () => {
		const seen = new Set();
		for ( let i = 0; i < 80; i++ ) {
			seen.add( questPick( band, { last: null } ) );
		}
		expect( seen.size ).toBeGreaterThan( 1 );
	} );
} );

describe( 'anotherTrack', () => {
	const charted = [
		{ cid: 'Qa', title: 'August' },
		{ cid: 'Qs', title: 'Silver 44' },
		{ cid: 'Qp', title: 'Paint Exchange' },
	];

	it( 'is a track this rabbithole has not heard, and never the one playing', () => {
		const track = anotherTrack( charted, {
			currentCid: 'Qa', playedCids: new Set( [ 'Qa', 'Qs' ] ), choose: first,
		} );
		expect( track.cid ).toBe( 'Qp' );
	} );

	it( 'falls back to a track already heard rather than to nothing (item 28)', () => {
		const track = anotherTrack( charted, {
			currentCid: 'Qp', playedCids: new Set( [ 'Qa', 'Qs', 'Qp' ] ), choose: first,
		} );
		expect( track.cid ).toBe( 'Qa' );
	} );

	it( 'is null only when there is no other charted track at all', () => {
		expect( anotherTrack( [ { cid: 'Qa' } ], { currentCid: 'Qa' } ) ).toBe( null );
		expect( anotherTrack( [], {} ) ).toBe( null );
		expect( anotherTrack( null, {} ) ).toBe( null );
	} );

	it( 'skips entries with no recording', () => {
		expect( anotherTrack( [ null, { title: 'no cid' }, { cid: 'Qs' } ], { choose: first } ).cid )
			.toBe( 'Qs' );
	} );
} );

describe( 'anyOf', () => {
	it( 'picks from the list', () => {
		expect( band ).toContain( anyOf( band ) );
	} );
} );
