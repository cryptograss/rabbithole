// @vitest-environment happy-dom
/**
 * The connectome inside Rabbithole: which links open one, and what the
 * player tells it (Justin, #rabbithole, 15 Nov 2026).
 */
import { describe, it, expect } from 'vitest';
import { graphSrcFor, isGraphFrame, walkMessage, fxMessage } from '../../src/wiki/graph-frame.js';

describe( 'graphSrcFor', () => {
	it( 'takes a connectome link and tells the graph it is inside Rabbithole', () => {
		expect( graphSrcFor( '/bacon?cut=QmCicada' ) )
			.toBe( '/bacon?cut=QmCicada&host=rabbithole' );
		expect( graphSrcFor( '/bacon' ) ).toBe( '/bacon?host=rabbithole' );
	} );

	it( 'frames the old address at /bacon, with its query (Justin, 16 Nov 2026)', () => {
		expect( graphSrcFor( '/assets/connectome/?cut=QmCicada' ) )
			.toBe( '/bacon?cut=QmCicada&host=rabbithole' );
		expect( graphSrcFor( '/assets/connectome/index.html?walk=mini' ) )
			.toBe( '/bacon?walk=mini&host=rabbithole' );
		expect( graphSrcFor( '/bacon/?p=Maddie+Denton' ) )
			.toBe( '/bacon?p=Maddie+Denton&host=rabbithole' );
	} );

	it( 'frames a kept bacon graph at its own address', () => {
		expect( graphSrcFor( '/bacon/cepkp1cxqmc' ) ).toBe( '/bacon/cepkp1cxqmc?host=rabbithole' );
		expect( graphSrcFor( '/bacon/rzjk0p27qd4/' ) ).toBe( '/bacon/rzjk0p27qd4?host=rabbithole' );
		expect( graphSrcFor( 'https://example.com/bacon/cepkp1cxqmc' ) ).toBe( null );
		expect( graphSrcFor( '/bacon/cepkp1cxqmi' ) ).toBe( null );          // an i is no ID's
		expect( graphSrcFor( '/bacon/xepkp1cxqmc' ) ).toBe( null );          // nor an x first
	} );

	it( 'keeps the host word to one, however the link arrived', () => {
		expect( graphSrcFor( '/assets/connectome/?host=wiki&a=3' ) )
			.toBe( '/bacon?host=rabbithole&a=3' );
	} );

	it( 'is null for anything that is not a connectome', () => {
		expect( graphSrcFor( '/wiki/Song:August' ) ).toBe( null );
		expect( graphSrcFor( '/assets/logo.png' ) ).toBe( null );
		expect( graphSrcFor( '/assets/connectome/graph.json' ) ).toBe( null );
		expect( graphSrcFor( '/baconx' ) ).toBe( null );
		expect( graphSrcFor( '/bacon/x' ) ).toBe( null );
		expect( graphSrcFor( 'https://example.com/assets/connectome/' ) ).toBe( null );
		expect( graphSrcFor( 'https://example.com/bacon' ) ).toBe( null );
		expect( graphSrcFor( '' ) ).toBe( null );
		expect( graphSrcFor( null ) ).toBe( null );
	} );
} );

describe( 'isGraphFrame', () => {
	it( 'knows a connectome frame from any other', () => {
		const frame = document.createElement( 'iframe' );
		frame.setAttribute( 'src', '/bacon?walk=mini&host=rabbithole' );
		expect( isGraphFrame( frame ) ).toBe( true );
		frame.setAttribute( 'src', '/assets/connectome/?walk=mini&host=rabbithole' );
		expect( isGraphFrame( frame ) ).toBe( true );
		frame.setAttribute( 'src', '/assets/something-else/' );
		expect( isGraphFrame( frame ) ).toBe( false );
		frame.setAttribute( 'src', '/baconx?walk=mini' );
		expect( isGraphFrame( frame ) ).toBe( false );
		frame.setAttribute( 'src', '/bacon/cepkp1cxqmc?host=rabbithole' );
		expect( isGraphFrame( frame ) ).toBe( true );
		expect( isGraphFrame( document.createElement( 'iframe' ) ) ).toBe( false );
		expect( isGraphFrame( null ) ).toBe( false );
	} );
} );

describe( 'walkMessage', () => {
	const hops = [
		{ cid: 'Qa', song: 'August', via: null, why: null, at: 1 },
		{ cid: 'Qc', song: 'Cicada Song', via: { name: 'Harry Clark', instrument: 'mandolin' }, why: 'quest', at: 2 },
	];

	it( 'carries every hop with the word for why it connects', () => {
		const m = walkMessage( { hops } );
		expect( m.rabbithole ).toBe( 'walk' );
		expect( m.hops ).toEqual( hops );
	} );

	it( 'says whether Rabbithole is by dark, so a graph in a light page is light', () => {
		// The graph is a page of its own in a frame: it cannot see the
		// app's <html> (Justin, 15 Nov 2026, item 35).
		expect( walkMessage( { hops, night: true } ).night ).toBe( true );
		expect( walkMessage( { hops } ).night ).toBe( false );
	} );

	it( 'carries who is chased and in which mode, for the graph to mark them', () => {
		const m = walkMessage( { hops, chasing: 'Harry Clark', chaseMode: 'chase', now: 'Qc', playing: true } );
		expect( m.chasing ).toBe( 'Harry Clark' );
		expect( m.chaseMode ).toBe( 'chase' );
		expect( m.now ).toBe( 'Qc' );
		expect( m.playing ).toBe( true );
	} );

	it( 'says how much room the graph has, full by default', () => {
		expect( walkMessage( {} ).mode ).toBe( 'full' );
		expect( walkMessage( { mode: 'mini' } ).mode ).toBe( 'mini' );
	} );

	it( 'is a plain object, so it survives postMessage', () => {
		// A hop from a reactive store carries proxies; the message must
		// carry values the structured clone can take.
		expect( () => structuredClone( walkMessage( { hops } ) ) ).not.toThrow();
	} );
} );

describe( 'fxMessage: the ensemble list\'s lights, for a graph (Justin, 20 Nov 2026)', () => {
	const cards = [ { name: 'Justin Holmes', scene: 'lead', singing: true }, { name: 'Cory Walker', scene: 'pickup' }, { name: 'Harry Clark', scene: null }, { name: 'Somebody', engineer: true } ];
	it( 'names each of the band by the chart and by their page, with the scene the card wears, and leaves the engineer out', () => {
		const m = fxMessage( { cards, playing: true, titles: { 'Justin Holmes': 'Justin Myles Holmes' } } );
		expect( m.rabbithole ).toBe( 'fx' );
		expect( m.playing ).toBe( true );
		expect( m.band.map( ( b ) => [ b.name, b.title, b.scene, b.singing ] ) ).toEqual( [
			[ 'Justin Holmes', 'Justin Myles Holmes', 'lead', true ], [ 'Cory Walker', null, 'pickup', false ], [ 'Harry Clark', null, null, false ] ] );
		expect( m.band.every( ( b ) => b.light === null && b.enter === false ) ).toBe( true );
	} );
	it( 'says the song on now by its track, and what each of the band has in hand (Justin, 23 Nov 2026)', () => {
		const m = fxMessage( { cards: [ { name: 'Harry Clark', instrument: 'mandolin', scene: 'out' }, { name: 'Kyle Tuttle' } ], playing: true, track: 'QmAugust' } );
		expect( m.track ).toBe( 'QmAugust' );
		expect( m.band.map( ( b ) => [ b.name, b.instrument, b.scene ] ) ).toEqual( [ [ 'Harry Clark', 'mandolin', 'out' ], [ 'Kyle Tuttle', null, null ] ] );
		expect( fxMessage( { cards } ).track ).toBe( null );
	} );
	it( 'gives a card the one light it shows: a spotlight over a flourish over the band\'s flash, in the list\'s colour and beat', () => {
		const effects = [
			{ kind: 'bandFlash', target: null, color: 'gold', intensity: 0.5, pulse: 0.6 },
			{ kind: 'flourish', target: 'Cory Walker', color: 'coral', intensity: 0.7, pulse: 1.2 },
			{ kind: 'flourish', target: 'Justin Holmes', color: 'coral', intensity: 9, pulse: 0.1 },
			{ kind: 'spotlight', target: 'Justin Holmes', color: 'blue', intensity: 1, pulse: 2.6 },
			{ kind: 'enter', target: 'Harry Clark' },
		];
		const m = fxMessage( { cards, effects, color: ( c ) => 'rgb-of-' + c } );
		const by = Object.fromEntries( m.band.map( ( b ) => [ b.name, b ] ) );
		expect( by[ 'Justin Holmes' ].light ).toEqual( { kind: 'spotlight', color: 'rgb-of-blue', level: 1, pulse: 2.6 } );
		expect( by[ 'Cory Walker' ].light ).toEqual( { kind: 'flourish', color: 'rgb-of-coral', level: 0.7, pulse: 1.2 } );
		expect( by[ 'Harry Clark' ].light ).toEqual( { kind: 'bandFlash', color: 'rgb-of-gold', level: 0.5, pulse: 0.6 } );
		expect( by[ 'Harry Clark' ].enter ).toBe( true );
		expect( m.playing ).toBe( false );
	} );
	it( 'keeps a light within what a stylesheet is given: level 0.35 to 1.3, a beat of half a second to six', () => {
		const m = fxMessage( { cards, effects: [ { kind: 'flourish', target: 'Cory Walker', color: 'coral', intensity: 9, pulse: 0.1 } ] } );
		expect( m.band[ 1 ].light ).toMatchObject( { level: 1.3, pulse: 0.5 } );
	} );
} );
