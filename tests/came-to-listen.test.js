import { describe, it, expect } from 'vitest';

import { cameToListen } from '../src/initial-params.js';

/*
 * A Listen button lands at ?track=<cid> and the song plays; the app's own
 * addresses name a page too, and those open quiet (Justin, 12 Nov 2026).
 */
describe( 'cameToListen', () => {
	it( 'is a bare track, the address a Listen or Play button sends', () => {
		expect( cameToListen( new URLSearchParams( '?track=QmS3QEZ' ) ) ).toBe( true );
		expect( cameToListen( new URLSearchParams( '?track=Reuben%27s_Train&layout=bar' ) ) ).toBe( true );
	} );

	it( 'is not a reload or a copied address, which names a page', () => {
		expect( cameToListen( new URLSearchParams( '?track=QmS3QEZ&page=Song%3AAugust' ) ) ).toBe( false );
	} );

	it( 'is not the front door', () => {
		expect( cameToListen( new URLSearchParams( '' ) ) ).toBe( false );
		expect( cameToListen( new URLSearchParams( '?page=Justin+Holmes' ) ) ).toBe( false );
	} );
} );
