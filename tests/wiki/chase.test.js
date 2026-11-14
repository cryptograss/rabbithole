/**
 * Chasing a picker, as it reads: one line offering it, or a pill beside
 * their name. Justin's points 10 and 13 (#rabbithole, 13 Nov 2026).
 */
import { describe, it, expect } from 'vitest';
import { chaseOfferHtml, chasePillHtml, firstName } from '../../src/wiki/chase.js';

describe( 'chaseOfferHtml', () => {
	const offer = { name: 'Harry Clark', next: { song: 'Song:Victory', cid: 'Qv' } };

	it( 'offers the chase in one line, by name, without naming the next song', () => {
		const html = chaseOfferHtml( offer );
		expect( html ).toContain( 'Harry Clark' );
		expect( html ).toContain( 'Chase Harry' );
		// "First up: Victory" was the second line nobody asked for.
		expect( html ).not.toContain( 'Victory' );
		expect( html ).not.toMatch( /follow/i );
	} );

	it( 'carries the full name on the button, for the click to act on', () => {
		expect( chaseOfferHtml( offer ) ).toContain( 'data-chase="Harry Clark"' );
	} );

	it( 'says nothing when there is nothing of theirs left to play', () => {
		expect( chaseOfferHtml( { name: 'Harry Clark', next: null } ) ).toBe( null );
		expect( chaseOfferHtml( null ) ).toBe( null );
	} );

	it( 'escapes a name that looks like markup', () => {
		const html = chaseOfferHtml( { name: '<b>x</b>', next: { song: 'Song:A', cid: 'Q' } } );
		expect( html ).not.toContain( '<b>' );
	} );
} );

describe( 'chasePillHtml', () => {
	it( 'is a pill saying it is chasing, and the way to stop', () => {
		const html = chasePillHtml( 'Harry Clark' );
		expect( html ).toContain( 'chasing' );
		expect( html ).toContain( 'data-unchase' );
		expect( html ).toContain( 'Stop chasing Harry Clark' );
	} );
} );

describe( 'firstName', () => {
	it( 'is what you call them on a button', () => {
		expect( firstName( 'Harry Clark' ) ).toBe( 'Harry' );
		expect( firstName( 'Madonna' ) ).toBe( 'Madonna' );
	} );
} );
