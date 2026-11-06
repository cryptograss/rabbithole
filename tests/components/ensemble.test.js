// @vitest-environment happy-dom
/**
 * One ensemble, rendered from the player's state.
 *
 * The cards are what the model says they are at this moment: one per
 * person, in weight order, wearing the scene class. Two song loads leave
 * one set of cards showing the second song, because there is nothing
 * else the cards could be (Skyler saw them doubled on 4 Nov 2026, when a
 * timer rebuilt them).
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
	ensemble: { 'Justin Holmes': [ 'guitar' ], 'Harry Clark': [ 'mandolin' ], 'Maddie Denton': [ 'fiddle' ] },
	timeline: { 0: { part: 'intro', pickup: 'Maddie Denton', musicians: { band: 'in' } }, 46.7: { part: 'A', solo: 'Harry Clark' } },
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
		expect( names( w ).sort() ).toEqual( [ 'Harry Clark', 'Justin Holmes', 'Maddie Denton' ] );
		expect( w.find( '[data-musician="Maddie Denton"]' ).classes() ).toContain( 'pickup' );
	} );

	it( 'shows the second song after two loads back to back, with no leftovers', async () => {
		const w = mount( Ensemble, { global: { stubs: { transition: false, 'transition-group': false } } } );
		player.model.showSong( SWORDS );
		player.model.showSong( VICTORY );
		await settled( w );
		expect( names( w ).sort() ).toEqual( [ 'Justin Holmes', 'Kyle Tuttle' ] );
	} );

	it( 'puts the soloist first and stars the name when the playhead reaches the solo', async () => {
		const w = mount( Ensemble, { global: { stubs: { transition: false, 'transition-group': false } } } );
		player.model._tick( 50 );
		await w.vm.$nextTick();
		expect( names( w )[ 0 ] ).toBe( 'Harry Clark' );
		const harry = w.find( '[data-musician="Harry Clark"]' );
		expect( harry.classes() ).toContain( 'lead' );
		expect( harry.text() ).toContain( '⭐ Harry Clark (mandolin)' );
	} );

	it( 'keeps the cards where they are when the song pauses', async () => {
		const w = mount( Ensemble, { global: { stubs: { transition: false, 'transition-group': false } } } );
		player.model._tick( 50 );
		player.model.state.status = 'PAUSED';
		await w.vm.$nextTick();
		expect( w.find( '[data-musician="Harry Clark"]' ).classes() ).toContain( 'lead' );
	} );
} );
