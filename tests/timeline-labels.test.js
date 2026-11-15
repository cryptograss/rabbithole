/*
 * The timeline's labels name the instrument or the picker (Justin,
 * #rabbithole, 13 Nov 2026), the instrument being the one the player's
 * card shows at that marker.
 */
import { describe, it, expect } from 'vitest';
import { markerWho, markerNote, markerLabel } from '../src/editor/TimelineEditor.js';

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

/*
 * A marker that features nobody still says what it does: a flourish, an
 * instrument picked up, somebody stepping in. The ruler called all of
 * them "unnamed" (Justin, #rabbithole, 15 Nov 2026).
 */
describe( 'markerNote', () => {
	it( 'names a flourish, by picker or by instrument', () => {
		expect( markerNote( { flourish: 'Bea Cole', flourishDuration: 2.8 }, ensemble, 'name' ) ).toBe( '✦ Bea Cole' );
		expect( markerNote( { flourish: 'Bea Cole' }, ensemble, 'instrument' ) ).toBe( '✦ mandolin' );
		expect( markerNote( { spotlight: 'Ada Banks' }, ensemble, 'instrument' ) ).toBe( '✦ guitar' );
	} );

	it( 'says what was picked up', () => {
		const data = { instrumentChanges: { 'Ada Banks': 'banjo' } };
		expect( markerNote( data, ensemble, 'name' ) ).toBe( 'Ada Banks → banjo' );
		expect( markerNote( data, ensemble, 'instrument' ) ).toBe( '→ banjo' );
	} );

	it( 'says who stepped in, and lets the band speak for itself', () => {
		expect( markerNote( { musicians: { 'Bea Cole': 'in' } }, ensemble, 'name' ) ).toBe( 'Bea Cole in' );
		expect( markerNote( { musicians: { band: 'in', 'Cy Dunn': 'out' } }, ensemble, 'name' ) ).toBe( 'band in' );
		expect( markerNote( { musicians: { 'Bea Cole': 'out' } }, ensemble, 'instrument' ) ).toBe( 'mandolin out' );
	} );

	it( 'marks the end of a solo, and says nothing about an empty marker', () => {
		expect( markerNote( { solo: false }, ensemble, 'name' ) ).toBe( 'solo ends' );
		expect( markerNote( {}, ensemble, 'name' ) ).toBe( '' );
	} );

	it( 'leaves a marker that names somebody to markerWho', () => {
		expect( markerWho( { solo: 'Bea Cole', flourish: 'Ada Banks' }, ensemble, 'name' ) ).toBe( 'Bea Cole' );
	} );
} );

describe( 'markerLabel', () => {
	it( 'is who the marker features, or what it does when it features nobody', () => {
		expect( markerLabel( { solo: 'Bea Cole' }, ensemble, 'instrument' ) ).toBe( 'mandolin' );
		expect( markerLabel( { flourish: 'Bea Cole' }, ensemble, 'instrument' ) ).toBe( '✦ mandolin' );
	} );

	it( 'keeps the ✦ on a flourish that plays behind a solo', () => {
		expect( markerLabel( { solo: 'Ada Banks', flourish: 'Bea Cole' }, ensemble, 'name' ) ).toBe( 'Ada Banks ✦' );
	} );
} );
