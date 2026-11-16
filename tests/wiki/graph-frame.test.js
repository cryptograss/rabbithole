// @vitest-environment happy-dom
/**
 * The connectome inside Rabbithole: which links open one, and what the
 * player tells it (Justin, #rabbithole, 15 Nov 2026).
 */
import { describe, it, expect } from 'vitest';
import { graphSrcFor, isGraphFrame, walkMessage } from '../../src/wiki/graph-frame.js';

describe( 'graphSrcFor', () => {
	it( 'takes a connectome link and tells the graph it is inside Rabbithole', () => {
		expect( graphSrcFor( '/assets/connectome/?cut=QmCicada' ) )
			.toBe( '/assets/connectome/?cut=QmCicada&host=rabbithole' );
	} );

	it( 'keeps the host word to one, however the link arrived', () => {
		expect( graphSrcFor( '/assets/connectome/?host=wiki&a=3' ) )
			.toBe( '/assets/connectome/?host=rabbithole&a=3' );
	} );

	it( 'is null for anything that is not a connectome', () => {
		expect( graphSrcFor( '/wiki/Song:August' ) ).toBe( null );
		expect( graphSrcFor( '/assets/logo.png' ) ).toBe( null );
		expect( graphSrcFor( 'https://example.com/assets/connectome/' ) ).toBe( null );
		expect( graphSrcFor( '' ) ).toBe( null );
		expect( graphSrcFor( null ) ).toBe( null );
	} );
} );

describe( 'isGraphFrame', () => {
	it( 'knows a connectome frame from any other', () => {
		const frame = document.createElement( 'iframe' );
		frame.setAttribute( 'src', '/assets/connectome/?walk=mini&host=rabbithole' );
		expect( isGraphFrame( frame ) ).toBe( true );
		frame.setAttribute( 'src', '/assets/something-else/' );
		expect( isGraphFrame( frame ) ).toBe( false );
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
