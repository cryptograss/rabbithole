// @vitest-environment happy-dom
/**
 * A picker's card: the picture in their page's {{MusicianInfo}} box and the
 * first three things it says they do, no instrument (Justin, #connectome, 18
 * and 19 Nov 2026).
 */
import { describe, it, expect } from 'vitest';
import { cardFrom, cardOf, DOES } from '../../src/wiki/infobox.js';

// As the wiki drew Harry Clark's page on 19 Nov 2026, cut down: the box, his name, the list, the connectome card.
const PAGE = '<div class="mw-content-ltr mw-parser-output">' +
	'<table class="wikitable" style="float: right; width: 280px;"><tbody>' +
	'<tr><th colspan="2"><figure typeof="mw:File"><a href="/wiki/File:H.jpg"><img src="/images/thumb/h/H.jpg/250px-H.jpg" srcset="/images/thumb/h/H.jpg/375px-H.jpg 1.5x" width="250" height="188"></a>' +
	'<figcaption>Clark showing a mandolin to <a href="/wiki/Fibonacci_Emery_Holmes">Fibonacci Emery Holmes</a></figcaption></figure></th></tr>' +
	'<tr><th>Instrument</th><td><span typeof="mw:File"><img alt="mandolin" src="/images/thumb/i/Instrument-icon-mandolin.png/20px-x.png"></span> mandolin</td></tr>' +
	'</tbody></table>' +
	'<div style="margin-bottom: 1em;"><b>Harry Clark</b>...</div>' +
	'<ul class="thinkingentity-verbs" style="font-style: italic;">' +
	'<li>...plays mandolin in <a href="/index.php?title=East_Nash_Grass&amp;action=edit&amp;redlink=1" class="new" title="East Nash Grass (page does not exist)">East Nash Grass</a></li>' +
	'<li>...played mandolin in <a href="/wiki/The_Wooks" title="The Wooks">The Wooks</a></li>' +
	'<li>...appeared with his brother <a href="/wiki/Jed_Clark" title="Jed Clark">Jed</a> on a record</li>' +
	'<li>...is one of the most prolific pickers on the studio projects</li>' +
	'</ul>' +
	'<div class="connectome-card"><div class="cc-head">the card</div></div></div>';

describe( 'a picker\'s card, out of their page', () => {
	it( 'has the box\'s picture, not the instrument\'s icon', () => {
		const { picture } = cardFrom( PAGE );
		expect( picture.src ).toBe( '/images/thumb/h/H.jpg/250px-H.jpg' );
		expect( picture.srcset ).toContain( '375px-H.jpg 1.5x' );
		expect( picture.caption ).toBe( 'Clark showing a mandolin to Fibonacci Emery Holmes' );
	} );

	it( 'has the first three things they do, in the wiki\'s words, and no fourth', () => {
		const { does } = cardFrom( PAGE );
		expect( DOES ).toBe( 3 );
		expect( does ).toHaveLength( 3 );
		expect( does[ 1 ] ).toBe( '...played mandolin in <a href="/wiki/The_Wooks" title="The Wooks">The Wooks</a>' );
		expect( does[ 2 ] ).toContain( '<a href="/wiki/Jed_Clark" title="Jed Clark">Jed</a>' );
		expect( does.join( ' ' ) ).not.toContain( 'most prolific' );
	} );

	it( 'leaves a page that doesn\'t exist yet as its words, not a link to an empty edit form', () => {
		const { does } = cardFrom( PAGE );
		expect( does[ 0 ] ).toBe( '...plays mandolin in East Nash Grass' );
	} );

	it( 'says nothing of the instrument, or of anything else in the box', () => {
		const { picture, does } = cardFrom( PAGE );
		const all = JSON.stringify( { picture, does } );
		expect( all ).not.toContain( 'Instrument' );
		expect( all ).not.toContain( 'icon-mandolin' );
		expect( all ).not.toContain( 'connectome-card' );
	} );

	it( 'finds the box floated beside the text when something wraps it', () => {
		const wrapped = '<div class="mw-parser-output"><div class="proposed"><table class="wikitable" style="float:right"><tr><th colspan="2"><figure><img src="/images/w.png"><figcaption></figcaption></figure></th></tr></table></div>' +
			'<ul class="thinkingentity-verbs"><li>...picks</li></ul></div>';
		const { picture, does } = cardFrom( wrapped );
		expect( picture ).toEqual( { src: '/images/w.png', srcset: '', caption: '' } );
		expect( does ).toEqual( [ '...picks' ] );
	} );

	it( 'is a name alone for a page with no box and no list, or no page', () => {
		expect( cardFrom( '<div class="mw-parser-output"><p>Only words.</p></div>' ) ).toEqual( { picture: null, does: [] } );
		expect( cardFrom( '' ) ).toEqual( { picture: null, does: [] } );
	} );

	it( 'keeps the page\'s own title, redirects followed, and asks the wiki once a name', async () => {
		let asked = 0;
		const parse = async ( name ) => {
			asked++;
			return { title: name === 'Harry' ? 'Harry Clark' : name, text: PAGE };
		};
		const one = await cardOf( 'Harry', parse );
		const two = await cardOf( 'Harry', parse );
		expect( one.title ).toBe( 'Harry Clark' );
		expect( one.does ).toHaveLength( 3 );
		expect( two ).toBe( one );
		expect( asked ).toBe( 1 );
	} );

	it( 'is the name asked for when the wiki has no page', async () => {
		const card = await cardOf( 'Nobody Yet', async () => {
			throw new Error( 'missingtitle' );
		} );
		expect( card ).toEqual( { title: 'Nobody Yet', picture: null, does: [] } );
	} );
} );
