// @vitest-environment happy-dom
/**
 * One ensemble, rendered from the player's state.
 *
 * The cards are what the model says they are at this moment: one per
 * person, in weight order, wearing the scene class. Two song loads leave
 * one set of cards showing the second song, because there is nothing
 * else the cards could be (Skyler saw them doubled on 4 Nov 2026, when a
 * timer rebuilt them).
 *
 * The light moves and the pickers stay where they stand: a break lights a
 * card in place, and only a singer changes the order (Justin,
 * #visual-effects, 15 Nov 2026).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';

// The model would build a Webamp; the store's `create` is what we drive.
vi.mock( '../../src/player/webamp-global.js', () => ( { default: () => class {} } ) );

import { usePlayerStore } from '../../src/stores/player.js';
import Ensemble from '../../src/components/Ensemble.vue';

const SWORDS = {
	title: 'Swords to Ploughshares',
	audioFile: 'swords.ogg',
	ensemble: { 'Justin Holmes': [ 'guitar' ], 'Harry Clark': [ 'mandolin' ], 'Maddie Denton': [ 'fiddle' ], 'Lauren Luz': [ 'vocals' ] },
	timeline: {
		0: { part: 'intro', pickup: 'Maddie Denton', musicians: { band: 'in' } },
		46.7: { part: 'A', solo: 'Harry Clark' },
		60: { part: 'A', solo: 'Lauren Luz', flourish: 'Maddie Denton', flourishColor: 'gold', flourishDuration: 3 },
		80: { part: 'B', solo: 'Harry Clark', spotlight: 'Harry Clark', spotlightBlackout: 4, spotlightGlow: 2 },
		90: { part: 'B', bandFlash: true, musicians: { 'Maddie Denton': 'out' } },
		95: { part: 'B', musicians: { 'Maddie Denton': 'in' } },
	},
};

const VICTORY = {
	title: 'Victory',
	audioFile: 'victory.ogg',
	ensemble: { 'Justin Holmes': [ 'guitar' ], 'Kyle Tuttle': [ '5-string banjo' ] },
	timeline: { 0: { part: 'intro' } },
};

describe( 'the ensemble', () => {
	let player;

	beforeEach( () => {
		setActivePinia( createPinia() );
		player = usePlayerStore();
		player.create( SWORDS );
	} );

	const names = ( w ) => w.findAll( '.musician-card' ).map( ( c ) => c.attributes( 'data-musician' ) );

	const mountEnsemble = () => mount( Ensemble );

	// A card that leaves fades out first: TransitionGroup removes it after
	// the next frames, once there is no transition to wait for. The order
	// and the classes are what is under test, so let the frames pass.
	const settled = async ( w ) => {
		await w.vm.$nextTick();
		await new Promise( ( r ) => requestAnimationFrame( () => requestAnimationFrame( () => setTimeout( r, 0 ) ) ) );
		await w.vm.$nextTick();
	};

	it( 'renders one card per musician', () => {
		const w = mountEnsemble();
		expect( names( w ).sort() ).toEqual( [ 'Harry Clark', 'Justin Holmes', 'Lauren Luz', 'Maddie Denton' ] );
		expect( w.find( '[data-musician="Maddie Denton"]' ).classes() ).toContain( 'pickup' );
	} );

	it( 'shows the second song after two loads back to back, with no leftovers', async () => {
		const w = mount( Ensemble, { global: { stubs: { transition: false, 'transition-group': false } } } );
		player.model.showSong( SWORDS );
		player.model.showSong( VICTORY );
		await settled( w );
		expect( names( w ).sort() ).toEqual( [ 'Justin Holmes', 'Kyle Tuttle' ] );
	} );

	const still = { global: { stubs: { transition: false, 'transition-group': false } } };
	const card = ( w, name ) => w.find( `[data-musician="${ name }"]` );

	it( 'lights the soloist where they stand, and stars the name', async () => {
		const w = mount( Ensemble, still );
		const before = names( w );
		player.model._tick( 50 );
		await w.vm.$nextTick();
		expect( names( w ) ).toEqual( before );
		const harry = card( w, 'Harry Clark' );
		expect( harry.classes() ).toEqual( expect.arrayContaining( [ 'lead', 'is-lit' ] ) );
		expect( harry.find( '.mc-mark' ).text() ).toBe( '⭐' );
		expect( harry.find( '.mc-who' ).text() ).toBe( 'Harry Clark' );
		expect( harry.find( '.musician-instrument' ).text() ).toBe( '(mandolin)' );
	} );

	it( 'brings a singer to the front, with the microphone', async () => {
		const w = mount( Ensemble, still );
		player.model._tick( 61 );
		await settled( w );
		expect( names( w )[ 0 ] ).toBe( 'Lauren Luz' );
		const lauren = card( w, 'Lauren Luz' );
		expect( lauren.classes() ).toEqual( expect.arrayContaining( [ 'lead', 'singing' ] ) );
		expect( lauren.find( '.mc-mark' ).text() ).toBe( '🎤' );
		// And she stays there when the next break is somebody else's.
		player.model._tick( 81 );
		await settled( w );
		expect( names( w )[ 0 ] ).toBe( 'Lauren Luz' );
		expect( card( w, 'Lauren Luz' ).classes() ).not.toContain( 'singing' );
	} );

	it( 'wears a flourish while it is in force, in the colour the chart names, and keeps the colour as it goes out', async () => {
		const w = mount( Ensemble, still );
		player.model._tick( 61 );
		await w.vm.$nextTick();
		const maddie = card( w, 'Maddie Denton' );
		expect( maddie.classes() ).toContain( 'fx-flourish' );
		expect( maddie.attributes( 'style' ) ).toContain( '--fx-color: rgb(255 205 40)' );
		player.model._tick( 64 );
		await w.vm.$nextTick();
		expect( card( w, 'Maddie Denton' ).classes() ).not.toContain( 'fx-flourish' );
		expect( card( w, 'Maddie Denton' ).attributes( 'style' ) ).toContain( '--fx-color: rgb(255 205 40)' );
	} );

	it( 'flashes the whole band, and marks who just came in', async () => {
		const w = mount( Ensemble, still );
		player.model._tick( 90.2 );
		await w.vm.$nextTick();
		expect( w.findAll( '#ensemble-display .musician-card.fx-band' ) ).toHaveLength( 4 );
		player.model._tick( 95.2 );
		await w.vm.$nextTick();
		expect( w.findAll( '.musician-card.fx-enter' ).map( ( c ) => c.attributes( 'data-musician' ) ) ).toEqual( [ 'Maddie Denton' ] );
	} );

	it( 'tells a pickup how long it has to lead in, and how far in it already was when first seen', async () => {
		// Arriving in the middle of one, as a seek does.
		player.model._tick( 6.7 );
		const w = mount( Ensemble, still );
		const style = () => card( w, 'Maddie Denton' ).attributes( 'style' );
		expect( style() ).toContain( '--lead-in: 46.7s' );
		expect( style() ).toContain( '--lead-in-from: -6.7s' );
		// Where it started from is said once: a fill told a new starting
		// point on every tick would never move.
		player.model._tick( 7.2 );
		await w.vm.$nextTick();
		expect( style() ).toContain( '--lead-in-from: -6.7s' );
	} );

	describe( 'the spotlight', () => {
		it( 'puts the picker on the stage while the pane is dark, and only while the song plays', async () => {
			const w = mount( Ensemble, still );
			player.model.state.status = 'PLAYING';
			player.model._tick( 81 );
			await w.vm.$nextTick();
			const stage = w.find( '.rh-spotlight' );
			expect( stage.exists() ).toBe( true );
			expect( stage.find( '.spot-hero .mc-who' ).text() ).toBe( 'Harry Clark' );
			// The copy on the stage is not a second card in the list.
			expect( names( w ).filter( ( n ) => n === 'Harry Clark' ) ).toHaveLength( 1 );
			expect( card( w, 'Harry Clark' ).classes() ).toEqual( expect.arrayContaining( [ 'is-away', 'fx-glow' ] ) );

			// Paused, the lights are up: the player is not left in the dark.
			player.model.state.status = 'PAUSED';
			await settled( w );
			expect( w.find( '.rh-spotlight' ).exists() ).toBe( false );
			expect( card( w, 'Harry Clark' ).classes() ).not.toContain( 'is-away' );
		} );

		it( 'brings the lights up when the dark is over, and leaves the glow on the card', async () => {
			const w = mount( Ensemble, still );
			player.model.state.status = 'PLAYING';
			player.model._tick( 84.5 );
			await settled( w );
			expect( w.find( '.rh-spotlight' ).exists() ).toBe( false );
			expect( card( w, 'Harry Clark' ).classes() ).toContain( 'fx-glow' );
			player.model._tick( 86.5 );
			await w.vm.$nextTick();
			expect( card( w, 'Harry Clark' ).classes() ).not.toContain( 'fx-glow' );
		} );
	} );

	it( 'draws the list again when the order changes, and not with the clock', async () => {
		// A card sliding to a new place is only left alone to finish if
		// nothing redraws the list under it, and the list is redrawn
		// whenever the order it is drawn from is a new one. So the order
		// has to be the same order, not an equal one, from tick to tick.
		const w = mount( Ensemble, still );
		player.model._tick( 47 );
		await w.vm.$nextTick();
		const order = w.vm.order;
		for ( const t of [ 47.3, 47.6, 47.9, 48.2 ] ) {
			player.model._tick( t );
			await w.vm.$nextTick();
			expect( w.vm.order ).toBe( order );
		}
		// And a new one when a singer steps up.
		player.model._tick( 61 );
		await w.vm.$nextTick();
		expect( w.vm.order ).not.toBe( order );
		expect( w.vm.order[ 0 ] ).toBe( 'Lauren Luz' );
	} );

	it( 'keeps the cards where they are when the song pauses', async () => {
		const w = mount( Ensemble, { global: { stubs: { transition: false, 'transition-group': false } } } );
		player.model._tick( 50 );
		player.model.state.status = 'PAUSED';
		await w.vm.$nextTick();
		expect( w.find( '[data-musician="Harry Clark"]' ).classes() ).toContain( 'lead' );
	} );
} );
