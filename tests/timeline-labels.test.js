/*
 * The timeline's labels name the instrument or the picker (Justin,
 * #rabbithole, 13 Nov 2026), the instrument being the one the player's
 * card shows at that marker.
 */
import { describe, it, expect } from 'vitest';
import { markerWho } from '../src/editor/TimelineEditor.js';

const ensemble = {
	'Ada Banks': [ 'guitar', 'vocals' ],
	'Bea Cole': 'mandolin',
	'Cy Dunn': [],
};

describe( 'markerWho', () => {
	it( 'names the pickers when asked to', () => {
		expect( markerWho( { solo: 'Bea Cole' }, ensemble, 'name' ) ).toBe( 'Bea Cole' );
	} );

	it( 'names the first instrument in the ensemble', () => {
		expect( markerWho( { solo: 'Ada Banks' }, ensemble, 'instrument' ) ).toBe( 'guitar' );
		expect( markerWho( { solo: 'Bea Cole' }, ensemble, 'instrument' ) ).toBe( 'mandolin' );
	} );

	it( 'takes the marker\'s own instrument change', () => {
		const data = { solo: 'Ada Banks', instrumentChanges: { 'Ada Banks': 'banjo' } };
		expect( markerWho( data, ensemble, 'instrument' ) ).toBe( 'banjo' );
	} );

	it( 'labels each of several soloists', () => {
		expect( markerWho( { solo: [ 'Ada Banks', 'Bea Cole' ] }, ensemble, 'instrument' ) )
			.toBe( 'guitar, mandolin' );
	} );

	it( 'keeps the name of someone with no instrument on record', () => {
		expect( markerWho( { solo: 'Cy Dunn' }, ensemble, 'instrument' ) ).toBe( 'Cy Dunn' );
		expect( markerWho( { solo: 'Nobody Known' }, {}, 'instrument' ) ).toBe( 'Nobody Known' );
	} );

	it( 'falls back to the pickup, and to nothing', () => {
		expect( markerWho( { pickup: 'Bea Cole' }, ensemble, 'instrument' ) ).toBe( 'mandolin' );
		expect( markerWho( { part: 'Verse' }, ensemble, 'instrument' ) ).toBe( '' );
	} );
} );
