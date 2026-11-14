// @vitest-environment happy-dom
/**
 * Chasing a picker, as it reads in the pane: one line offering it, or a
 * pill beside their name. Justin's points 10 and 13 (#rabbithole, 13 Nov
 * 2026). Both were HTML built in a JS module until the 14th.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PaneChaseOffer from '../../../src/components/pane/PaneChaseOffer.vue';
import PaneChasePill from '../../../src/components/pane/PaneChasePill.vue';

describe( 'the offer to chase', () => {
	const offer = () => mount( PaneChaseOffer, { props: { name: 'Harry Clark' } } );

	it( 'offers it in one line, by name, without naming the next song', () => {
		const text = offer().text();
		expect( text ).toContain( 'Harry Clark' );
		expect( text ).toContain( 'Chase Harry' );
		// "First up: Victory" was the second line nobody asked for.
		expect( text ).not.toMatch( /first up/i );
		expect( text ).not.toMatch( /follow/i );
	} );

	it( 'asks for the chase by their full name when pressed', async () => {
		const w = offer();
		await w.get( 'button.pp-chase-go' ).trigger( 'click' );
		expect( w.emitted( 'chase' ) ).toEqual( [ [ 'Harry Clark' ] ] );
	} );

	/*
	 * A name is text, not markup. It was escaped by hand in a string of
	 * HTML; Vue does it by construction, which is the point of the move.
	 */
	it( 'shows a name that looks like markup as the name it is', () => {
		const w = mount( PaneChaseOffer, { props: { name: '<b>x</b>' } } );
		expect( w.html() ).not.toContain( '<b>x</b>' );
		expect( w.text() ).toContain( '<b>x</b>' );
	} );
} );

describe( 'the pill while chasing', () => {
	it( 'says it is chasing, and is the way to stop', async () => {
		const w = mount( PaneChasePill, { props: { name: 'Harry Clark' } } );
		expect( w.text() ).toContain( 'chasing' );
		expect( w.get( 'button' ).attributes( 'title' ) ).toBe( 'Stop chasing Harry Clark' );
		await w.get( 'button' ).trigger( 'click' );
		expect( w.emitted( 'stop' ) ).toHaveLength( 1 );
	} );
} );
