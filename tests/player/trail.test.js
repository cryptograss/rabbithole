/**
 * Trails through the people who played on the songs.
 *
 * The fixture is small and deliberately shaped like the real catalogue: one
 * person on nearly everything, and a couple of people who are on two songs
 * each. That shape is what makes plain shortest-path give a boring answer.
 */
import { describe, it, expect } from 'vitest';
import { buildGraph, findTrail, reach, trailSongs } from '../../src/trail.js';

function subobject( song, person, instrument ) {
	return [
		`${ song }# ${ person.replace( /\W/g, '' ) }`,
		{ printouts: { 'Has performer': [ { fulltext: person } ], 'Has instrument': [ instrument ] } },
	];
}

// Hub is on all four songs. Grier and Walker are each on two, and together
// they make a two-hop route from A to D that never touches the hub.
const results = Object.fromEntries( [
	subobject( 'Song:A', 'Hub', 'guitar' ),
	subobject( 'Song:B', 'Hub', 'guitar' ),
	subobject( 'Song:C', 'Hub', 'guitar' ),
	subobject( 'Song:D', 'Hub', 'guitar' ),
	subobject( 'Song:A', 'Grier', 'guitar' ),
	subobject( 'Song:B', 'Grier', 'guitar' ),
	subobject( 'Song:B', 'Walker', 'banjo' ),
	subobject( 'Song:D', 'Walker', 'banjo' ),
] );

const graph = buildGraph( results );

describe( 'buildGraph', () => {
	it( 'reads a song and its players out of the subobject ids', () => {
		expect( Object.keys( graph.band ).sort() ).toEqual( [ 'Song:A', 'Song:B', 'Song:C', 'Song:D' ] );
		expect( Object.keys( graph.band[ 'Song:B' ] ).sort() ).toEqual( [ 'Grier', 'Hub', 'Walker' ] );
		expect( graph.band[ 'Song:B' ].Walker ).toEqual( [ 'banjo' ] );
	} );

	it( 'counts how many songs each person is on', () => {
		expect( reach( graph ) ).toEqual( { Hub: 4, Grier: 2, Walker: 2 } );
	} );

	it( 'ignores a subobject with no performer', () => {
		const thin = buildGraph( { 'Song:X# 1': { printouts: { 'Has instrument': [ 'kazoo' ] } } } );
		expect( thin.band ).toEqual( {} );
	} );
} );

describe( 'findTrail', () => {
	it( 'routes around the hub rather than through it', () => {
		const hops = findTrail( graph, 'Song:A', 'Song:D' );

		// One hop through Hub would be shorter. It is also the answer nobody
		// wants: a rabbithole that always goes through the same person.
		expect( hops.map( ( h ) => h.via ) ).toEqual( [ 'Grier', 'Walker' ] );
		expect( hops[ 0 ] ).toMatchObject( { from: 'Song:A', to: 'Song:B', instrument: 'guitar' } );
		expect( hops[ 1 ] ).toMatchObject( { from: 'Song:B', to: 'Song:D', instrument: 'banjo' } );
	} );

	it( 'does take the hub when that is the only way', () => {
		// Song:C has nobody on it but Hub.
		const hops = findTrail( graph, 'Song:A', 'Song:C' );

		expect( hops.map( ( h ) => h.via ) ).toEqual( [ 'Hub' ] );
	} );

	it( 'takes the short way when the penalty is switched off', () => {
		const hops = findTrail( graph, 'Song:A', 'Song:D', { hubPenalty: 0 } );

		expect( hops ).toHaveLength( 1 );
		expect( hops[ 0 ].via ).toBe( 'Hub' );
	} );

	it( 'honours a person to avoid', () => {
		expect( findTrail( graph, 'Song:A', 'Song:C', { avoid: [ 'Hub' ] } ) ).toBeNull();
	} );

	it( 'returns an empty trail for a song to itself, not null', () => {
		expect( findTrail( graph, 'Song:A', 'Song:A' ) ).toEqual( [] );
	} );

	it( 'returns null for a song it has never heard of', () => {
		expect( findTrail( graph, 'Song:A', 'Song:Nope' ) ).toBeNull();
	} );

	it( 'gives up rather than wandering, past maxHops', () => {
		expect( findTrail( graph, 'Song:A', 'Song:D', { maxHops: 1, avoid: [ 'Hub' ] } ) ).toBeNull();
	} );
} );

describe( 'trailSongs', () => {
	it( 'lists the songs in playing order, starting where you are', () => {
		const hops = findTrail( graph, 'Song:A', 'Song:D' );

		expect( trailSongs( 'Song:A', hops ) ).toEqual( [ 'Song:A', 'Song:B', 'Song:D' ] );
	} );
} );
