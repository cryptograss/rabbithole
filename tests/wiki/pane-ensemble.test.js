// @vitest-environment happy-dom
/**
 * The chased picker, marked in the Studio cut box's ensemble (item 25).
 */
import { describe, it, expect } from 'vitest';
import { markChased } from '../../src/wiki/pane-ensemble.js';

const players = `<div class="pp-players">`
	+ `<div class="pp-players-who"><a href="/wiki/Gaven_Largent" title="Gaven Largent">Gaven Largent</a></div>`
	+ `<div class="pp-players-what">dobro</div>`
	+ `<div class="pp-players-who"><a href="/wiki/Harry_Clark" title="Harry Clark">Harry Clark</a></div>`
	+ `<div class="pp-players-what">mandolin</div>`
	+ `</div>`;

describe( 'markChased', () => {
	it( 'marks the chased picker and the instruments beside them', () => {
		const out = markChased( players, 'Harry Clark' );
		expect( out ).toContain( '<span class="pp-players-chasing">Chasing</span>' );
		// Their row, both cells: the grid has no row element of its own.
		expect( out.match( /pp-players-chased/g ) ).toHaveLength( 2 );
		// And nobody else's: Gaven's cells come back as they went in.
		expect( out ).toContain( '<div class="pp-players-who"><a href="/wiki/Gaven_Largent"' );
		expect( out ).toContain( '<div class="pp-players-what">dobro</div>' );
	} );

	it( 'knows a person by the page their link names when there is no title', () => {
		const html = '<div class="pp-players"><div class="pp-players-who">'
			+ '<a href="/wiki/Maddie_Denton">Maddie Denton</a></div>'
			+ '<div class="pp-players-what">fiddle</div></div>';
		expect( markChased( html, 'Maddie Denton' ) ).toContain( 'pp-players-chased' );
	} );

	it( 'leaves the page alone when nobody is chased, or they are not on it', () => {
		expect( markChased( players, null ) ).toBe( players );
		expect( markChased( players, 'Kyle Tuttle' ) ).toBe( players );
		expect( markChased( '', 'Harry Clark' ) ).toBe( '' );
	} );

	it( 'leaves a page with no ensemble alone, byte for byte', () => {
		const html = '<p>A song page with no studio cut on it.</p>';
		expect( markChased( html, 'Harry Clark' ) ).toBe( html );
	} );

	it( 'marks a picker on two cuts of the song, once in each ensemble', () => {
		const twice = players + players;
		const out = markChased( twice, 'Harry Clark' );
		expect( out.match( /pp-players-chasing/g ) ).toHaveLength( 2 );
	} );
} );
