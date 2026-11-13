import { describe, it, expect } from 'vitest';

import { runningOrderFrom } from '../src/record-order.js';
import { cameToListen } from '../src/initial-params.js';

const record = [
	{ cid: 'QmC', track_number: 3 },
	{ cid: 'QmA', track_number: 1 },
	{ cid: 'QmB', track_number: 2 },
];

describe( 'runningOrderFrom', () => {
	it( 'is the running order, whatever order the page lists them in', () => {
		expect( runningOrderFrom( record ) ).toEqual( [ 'QmA', 'QmB', 'QmC' ] );
	} );

	it( 'picks up from the track a reload names', () => {
		expect( runningOrderFrom( record, 'QmB' ) ).toEqual( [ 'QmB', 'QmC' ] );
	} );

	it( 'starts at the top for a track not on the record', () => {
		expect( runningOrderFrom( record, 'QmZ' ) ).toEqual( [ 'QmA', 'QmB', 'QmC' ] );
	} );

	it( 'keeps listed order where track numbers are missing', () => {
		expect( runningOrderFrom( [ { cid: 'QmX' }, { cid: 'QmY' } ] ) ).toEqual( [ 'QmX', 'QmY' ] );
	} );

	it( 'is empty for a page with no tracks', () => {
		expect( runningOrderFrom( undefined ) ).toEqual( [] );
		expect( runningOrderFrom( [ { title: 'no cid' } ] ) ).toEqual( [] );
	} );
} );

describe( 'cameToListen, for a record', () => {
	it( 'is a bare record, the address a record link sends', () => {
		expect( cameToListen( new URLSearchParams( '?record=QmUWtV7' ) ) ).toBe( true );
	} );

	it( 'is quiet once the pane names a page', () => {
		expect( cameToListen( new URLSearchParams( '?record=QmUWtV7&track=QmB&page=Song%3AAugust' ) ) ).toBe( false );
	} );
} );
