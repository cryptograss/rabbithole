/**
 * One ensemble, rendered into one element.
 *
 * The player used to remove its ensemble and rebuild it on a timer for each
 * song, so two song loads inside the timer's window both built, and every
 * card showed twice (Skyler, Firefox, 4 Nov 2026). Now the element is made
 * once and each song is rendered into it: these tests hold that line.
 *
 * The DOM here is a toy: enough of createElement, appendChild, innerHTML and
 * the class queries the player makes for the ensemble to be rendered and
 * sorted, and no more.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import RabbitholeWebampPlayer from '../../src/player/rabbithole-player.js';

class FakeElement {
	constructor( tag ) {
		this.tagName = tag.toUpperCase();
		this.children = [];
		this.parentNode = null;
		this.dataset = {};
		this.style = {};
		this.id = '';
		this.className = '';
		this.textContent = '';
		this._innerHTML = '';
	}

	get classList() {
		const self = this;
		const list = () => self.className.split( /\s+/ ).filter( Boolean );
		return {
			contains: ( c ) => list().includes( c ),
			add: ( c ) => { if ( ! list().includes( c ) ) self.className = [ ...list(), c ].join( ' ' ); },
			remove: ( c ) => { self.className = list().filter( ( x ) => x !== c ).join( ' ' ); },
			[ Symbol.iterator ]: function* () { yield* list(); },
		};
	}

	// Setting innerHTML empties the element; the markup itself is not parsed.
	set innerHTML( html ) {
		this.children.forEach( ( c ) => { c.parentNode = null; } );
		this.children = [];
		this._innerHTML = html;
	}

	get innerHTML() {
		return this._innerHTML;
	}

	appendChild( child ) {
		if ( child.parentNode ) {
			child.parentNode.children = child.parentNode.children.filter( ( c ) => c !== child );
		}
		child.parentNode = this;
		this.children.push( child );
		return child;
	}

	remove() {
		if ( this.parentNode ) {
			this.parentNode.children = this.parentNode.children.filter( ( c ) => c !== this );
			this.parentNode = null;
		}
	}

	*descendants() {
		for ( const c of this.children ) {
			yield c;
			yield* c.descendants();
		}
	}

	querySelectorAll( selector ) {
		const cls = selector.replace( /^\./, '' );
		return [ ...this.descendants() ].filter( ( el ) => el.classList.contains( cls ) );
	}

	querySelector( selector ) {
		return this.querySelectorAll( selector )[ 0 ] || null;
	}
}

function fakeDocument( root ) {
	return {
		createElement: ( tag ) => new FakeElement( tag ),
		getElementById: ( id ) => [ ...root.descendants() ].find( ( el ) => el.id === id ) || null,
		querySelectorAll: ( selector ) => root.querySelectorAll( selector ),
		head: new FakeElement( 'head' ),
	};
}

const SWORDS = {
	title: 'Swords to Ploughshares',
	audioFile: 'swords.ogg',
	ensemble: { 'Justin Holmes': [ 'guitar' ], 'Harry Clark': [ 'mandolin' ], 'Maddie Denton': [ 'fiddle' ] },
	timeline: { 0: { part: 'intro', pickup: 'Maddie Denton' }, 46.7: { part: 'A', solo: 'Harry Clark' } },
};

const VICTORY = {
	title: 'Victory',
	audioFile: 'victory.ogg',
	ensemble: { 'Justin Holmes': [ 'guitar' ], 'Kyle Tuttle': [ '5-string banjo' ] },
	timeline: { 0: { part: 'intro' } },
};

// The player's methods on a bare receiver, with the fields loadNewSong reads,
// but no constructor: that would build a Webamp.
function player( fields ) {
	return Object.assign( Object.create( RabbitholeWebampPlayer.prototype ), {
		options: { embedMode: false },
		webamp: null,
		currentSolo: null,
		currentEra: null,
		recentSoloists: [],
		musicianWeights: {},
		flashInProgress: false,
		upcomingMomentTimes: [],
		allMomentTimes: [],
	}, fields );
}

describe( 'one ensemble element', () => {
	let root, saved;

	beforeEach( () => {
		root = new FakeElement( 'body' );
		saved = { document: globalThis.document, raf: globalThis.requestAnimationFrame };
		globalThis.document = fakeDocument( root );
		globalThis.requestAnimationFrame = ( fn ) => fn();
	} );

	afterEach( () => {
		globalThis.document = saved.document;
		globalThis.requestAnimationFrame = saved.raf;
	} );

	function placedEnsemble() {
		const el = new FakeElement( 'div' );
		el.id = 'ensemble-display-in-webamp';
		root.appendChild( el );
		const calls = { reloadItems: 0, layout: 0 };
		const packery = {
			element: el,
			reloadItems: () => { calls.reloadItems++; },
			layout: () => { calls.layout++; },
		};
		return { el, packery, calls };
	}

	it( 'renders a song into the element it already has', () => {
		const { el, packery, calls } = placedEnsemble();
		const self = player( { trackData: SWORDS, ensembleEl: el, packery } );

		self.renderSong();

		expect( root.children ).toHaveLength( 1 );
		expect( el.children.map( ( c ) => c.dataset.musician ) )
			.toEqual( expect.arrayContaining( [ 'Justin Holmes', 'Harry Clark', 'Maddie Denton' ] ) );
		expect( el.children ).toHaveLength( 3 );
		expect( calls.reloadItems ).toBe( 1 );
	} );

	it( 'two song loads back to back leave one ensemble, showing the second song', () => {
		const { el, packery } = placedEnsemble();
		const self = player( { trackData: SWORDS, ensembleEl: el, packery } );

		self.loadNewSong( SWORDS );
		self.loadNewSong( VICTORY );

		const ensembles = root.children.filter( ( c ) => c.id === 'ensemble-display-in-webamp' );
		expect( ensembles ).toHaveLength( 1 );
		expect( el.children.map( ( c ) => c.dataset.musician ).sort() )
			.toEqual( [ 'Justin Holmes', 'Kyle Tuttle' ] );
		expect( self.ensembleEl ).toBe( el );
	} );

	it( 'a song loaded before the element exists waits for the build, which renders it', () => {
		const self = player( { trackData: SWORDS, ensembleEl: null, packery: null } );

		// Nothing to render into yet, and nothing scheduled: no throw, no element.
		self.loadNewSong( VICTORY );
		expect( root.children ).toHaveLength( 0 );

		// The build reads trackData when it runs, so it shows Victory.
		const el = new FakeElement( 'div' );
		root.appendChild( el );
		self.renderEnsembleCards( el );
		expect( el.children.map( ( c ) => c.dataset.musician ).sort() )
			.toEqual( [ 'Justin Holmes', 'Kyle Tuttle' ] );
	} );

	it( 'updating a card changes its classes and name and keeps its children', () => {
		const card = new FakeElement( 'div' );
		card.id = 'musician-maddie-denton';
		card.className = 'musician-item musician-card';
		const name = new FakeElement( 'div' );
		name.className = 'musician-name';
		name.textContent = 'Maddie Denton (fiddle)';
		const rabbit = new FakeElement( 'span' );
		rabbit.className = 'rabbithole-icon';
		card.appendChild( name );
		card.appendChild( rabbit );
		root.appendChild( card );

		const self = player( { trackData: SWORDS } );
		self.updateMusicianCard( card, 'Maddie Denton', 'fiddle', [ 'lead' ], true );

		expect( card.classList.contains( 'lead' ) ).toBe( true );
		expect( name.textContent ).toBe( '⭐ Maddie Denton (fiddle)' );
		expect( card.children ).toContain( rabbit );
		expect( card.querySelector( '.rabbithole-icon' ) ).toBe( rabbit );
	} );
} );
