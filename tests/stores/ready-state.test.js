// @vitest-environment happy-dom
/**
 * A track's Rabbithole state: alpha, beta or production, one key at the
 * top of its /Metadata page (wiki/api.js, STATES).
 *
 * Justin, #rabbithole, 16 Nov 2026: "if we post a link to Rabbit Hole,
 * someone listens to August, I don't want it then their next song ... to
 * take them to a song that is broken." And #connectome, 20 Nov 2026:
 * "Currently, I really only want Reuben's, Paint Exchange, and August."
 *
 * Here: what a page's text says, what the lists made of it hold, and the
 * pure rules each path that hands out a song asks. The picker's own paths
 * are in picker-steps.test.js, the selector's in components.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import jsYaml from 'js-yaml';

import { STATES, namedState, stateOf, isProduction, extractMetadata, readyTracks, metadataYaml } from '../../src/wiki/api.js';
import { firstPlayable, anotherTrack } from '../../src/stores/picker.js';
import { findTrail } from '../../src/trail.js';

const CHART = 'timeline:\n  0: { part: A }\n  10: { part: B }\nensemble:\n  Cory Walker: [banjo]\n';

describe( 'what a metadata page says its state is', () => {
	it( 'is one of three', () => {
		expect( STATES ).toEqual( [ 'alpha', 'beta', 'production' ] );
	} );
	it( 'reads the key at the top, whatever its case and spacing', () => {
		expect( stateOf( { state: 'production' } ) ).toBe( 'production' );
		expect( stateOf( { state: ' Beta ' } ) ).toBe( 'beta' );
		expect( stateOf( { state: 'alpha' } ) ).toBe( 'alpha' );
	} );
	it( 'is alpha when the page names none, or one nobody knows', () => {
		[ {}, null, undefined, { state: 'prod' }, { state: true }, { state: 3 }, { state: [ 'production' ] }, { rabbithole: { state: 'production' } } ]
			.forEach( ( data ) => expect( stateOf( data ) ).toBe( 'alpha' ) );
		expect( namedState( {} ) ).toBe( null );
		expect( namedState( { state: 'prod' } ) ).toBe( null );
		expect( namedState( { state: 'Production' } ) ).toBe( 'production' );
	} );
	it( 'says of a page\'s text whether its track is in production', () => {
		expect( isProduction( CHART + 'state: production\n' ) ).toBe( true );
		expect( isProduction( 'state: production\n' + CHART ) ).toBe( true );
		expect( isProduction( CHART + 'state: beta\n' ) ).toBe( false );
		expect( isProduction( CHART ) ).toBe( false );
		expect( isProduction( '' ) ).toBe( false );
		expect( isProduction( 'state: [production' ) ).toBe( false );                  // not YAML at all
		expect( isProduction( '# state: production\n' + CHART ) ).toBe( false );       // a comment says nothing
	} );
	it( 'is carried with the chart', () => {
		expect( extractMetadata( jsYaml.load( CHART + 'state: production\n' ) ).state ).toBe( 'production' );
		expect( extractMetadata( jsYaml.load( CHART ) ).state ).toBe( 'alpha' );
		// The old shape has nowhere to say.
		expect( extractMetadata( { studio_versions: { v: { '4masks': { rabbithole: { timeline: { 0: {} } }, ensemble: {} } } } } ).state ).toBe( 'alpha' );
	} );
} );

describe( 'what the rabbithole may hand out', () => {
	const list = [
		{ cid: 'Qa', title: 'August', state: 'production' },
		{ cid: 'Qs', title: 'Silver 44', state: 'beta' },
		{ cid: 'Qc', title: 'Cicada Song', state: 'alpha' },
		{ cid: 'Qp', title: 'Paint Exchange', state: 'production' },
		{ cid: 'Qv', title: 'Victory' },
	];
	it( 'is the tracks in production, and no others', () => {
		expect( readyTracks( list ).map( ( t ) => t.cid ) ).toEqual( [ 'Qa', 'Qp' ] );
		expect( readyTracks( [] ) ).toEqual( [] );
		expect( readyTracks( null ) ).toEqual( [] );
	} );
	it( 'the floor finds nothing in an empty list, and nothing when the only one is playing', () => {
		expect( anotherTrack( [], { currentCid: 'Qa' } ) ).toBe( null );
		expect( anotherTrack( readyTracks( [ list[ 0 ] ] ), { currentCid: 'Qa' } ) ).toBe( null );
	} );
	it( 'a picker\'s first song worth playing is one that is ready', async () => {
		const cids = { 'Song:Cicada Song': 'Qc', 'Song:Silver 44': 'Qs', 'Song:Paint Exchange': 'Qp' };
		const asked = [];
		const options = {
			currentCid: 'Qa', playedCids: new Set(), queuedCids: [], cidOf: async ( song ) => cids[ song ],
			ready: async ( cid ) => {
				asked.push( cid );
				return cid === 'Qp';
			},
		};
		expect( await firstPlayable( Object.keys( cids ), options ) ).toEqual( { song: 'Song:Paint Exchange', cid: 'Qp' } );
		expect( asked ).toEqual( [ 'Qc', 'Qs', 'Qp' ] );
		expect( await firstPlayable( [ 'Song:Cicada Song', 'Song:Silver 44' ], options ) ).toBe( null );
	} );
} );

describe( 'the song store\'s ready list', () => {
	beforeEach( () => {
		vi.resetModules();
		setActivePinia( createPinia() );
	} );
	async function store( charted ) {
		vi.doMock( '../../src/wiki/api.js', async ( original ) => ( { ...( await original() ), chartedTracks: vi.fn( async () => charted ) } ) );
		const { useSongStore } = await import( '../../src/stores/song.js' );
		return useSongStore();
	}

	it( 'is the charted tracks in production, asked of the wiki once', async () => {
		const songs = await store( [ { cid: 'Qa', state: 'production' }, { cid: 'Qs', state: 'beta' }, { cid: 'Qc' } ] );
		expect( ( await songs.readyList() ).map( ( t ) => t.cid ) ).toEqual( [ 'Qa' ] );
		expect( songs.ready.map( ( t ) => t.cid ) ).toEqual( [ 'Qa' ] );
		expect( songs.charted.length ).toBe( 3 );
		expect( await songs.isReady( 'Qa' ) ).toBe( true );
		expect( await songs.isReady( 'Qs' ) ).toBe( false );
		expect( await songs.isReady( 'QmNeverCharted' ) ).toBe( false );
		expect( await songs.isReady( null ) ).toBe( false );
	} );
	it( 'holds nothing when no page says production', async () => {
		const songs = await store( [ { cid: 'Qa' }, { cid: 'Qs', state: 'alpha' } ] );
		expect( await songs.readyList() ).toEqual( [] );
		expect( await songs.isReady( 'Qa' ) ).toBe( false );
	} );
} );

describe( 'a record\'s running order, as it is handed out', () => {
	let handedFrom;
	beforeEach( async () => {
		( { handedFrom } = await import( '../../src/stores/song.js' ) );
	} );
	const order = [ 'Q1', 'Q2', 'Q3', 'Q4' ];
	it( 'is the tracks in production, in order', () => {
		expect( handedFrom( order, null, [ 'Q4', 'Q2' ] ) ).toEqual( [ 'Q2', 'Q4' ] );
	} );
	it( 'starts on the track the address names, whatever its state', () => {
		expect( handedFrom( [ 'Q3', 'Q4' ], 'Q3', [ 'Q4', 'Q2' ] ) ).toEqual( [ 'Q3', 'Q4' ] );
		// A name that is not where the order starts is no name for this record.
		expect( handedFrom( order, 'Q3', [ 'Q4' ] ) ).toEqual( [ 'Q4' ] );
	} );
	it( 'plays the first track alone when the record has nothing in production', () => {
		expect( handedFrom( order, null, [] ) ).toEqual( [ 'Q1' ] );
		expect( handedFrom( [], null, [ 'Q1' ] ) ).toEqual( [] );
	} );
} );

describe( 'the header\'s list of the record\'s tracks', () => {
	let listedOf;
	beforeEach( async () => {
		( { listedOf } = await import( '../../src/stores/song.js' ) );
	} );
	const record = [ { cid: 'Q3', track_number: 3 }, { cid: 'Q1', track_number: 1 }, { cid: 'Q2', track_number: 2 }, { cid: 'Q4', track_number: 4 } ];
	const cids = ( list ) => list.map( ( t ) => t.cid );
	it( 'is the tracks in production, in running order', () => {
		expect( cids( listedOf( record, [ 'Q4', 'Q2' ] ) ) ).toEqual( [ 'Q2', 'Q4' ] );
	} );
	it( 'holds the track that stands, whatever its state, in its place', () => {
		expect( cids( listedOf( record, [ 'Q4', 'Q2' ], 'Q3' ) ) ).toEqual( [ 'Q2', 'Q3', 'Q4' ] );
		expect( cids( listedOf( record, [], 'Q1' ) ) ).toEqual( [ 'Q1' ] );
	} );
	it( 'is empty for no record', () => {
		expect( listedOf( null, [ 'Q1' ] ) ).toEqual( [] );
	} );
} );

describe( 'a record link (?record=) plays the record\'s tracks that are in production', () => {
	beforeEach( () => {
		vi.resetModules();
		setActivePinia( createPinia() );
	} );
	async function booted( query, charted ) {
		vi.doMock( '../../src/initial-params.js', async ( original ) => ( { ...( await original() ), INITIAL_PARAMS: new URLSearchParams( query ) } ) );
		vi.doMock( '../../src/wiki/api.js', async ( original ) => ( {
			...( await original() ),
			chartedTracks: vi.fn( async () => charted ),
			resolveTrack: async ( name ) => ( { cid: name, alias: null } ),
			loadAlbum: async ( cid ) => ( cid === 'QmRecord' ? {
				cid, title: '4masks',
				tracks: [ { cid: 'Q1', track_number: 1 }, { cid: 'Q2', track_number: 2 }, { cid: 'Q3', track_number: 3 }, { cid: 'Q4', track_number: 4 } ],
			} : null ),
			loadTrack: async ( cid ) => ( { title: cid, _trackCid: cid } ),
			recordPageOf: async () => null,
			findAlbumArt: async () => null,
		} ) );
		const { useSongStore } = await import( '../../src/stores/song.js' );
		const songs = useSongStore();
		await songs.boot();
		return songs;
	}
	const states = ( ...ready ) => [ 'Q1', 'Q2', 'Q3', 'Q4' ].map( ( cid ) => ( { cid, state: ready.includes( cid ) ? 'production' : 'beta' } ) );

	it( 'starts on the first one that is, and lines up the rest that are', async () => {
		const songs = await booted( 'record=QmRecord', states( 'Q2', 'Q4' ) );
		expect( songs.initial._trackCid ).toBe( 'Q2' );
		expect( songs.recordRest ).toEqual( [ 'Q4' ] );
	} );
	it( 'starts on the track the address names, whatever its state', async () => {
		const songs = await booted( 'record=QmRecord&track=Q3', states( 'Q2', 'Q4' ) );
		expect( songs.initial._trackCid ).toBe( 'Q3' );
		expect( songs.recordRest ).toEqual( [ 'Q4' ] );
	} );
	it( 'plays the first track alone when nothing on the record is', async () => {
		const songs = await booted( 'record=QmRecord', states() );
		expect( songs.initial._trackCid ).toBe( 'Q1' );
		expect( songs.recordRest ).toEqual( [] );
	} );
} );

describe( 'a trail goes through songs that are ready', () => {
	// August -Kyle- Cicada -Maddie- Victory, and a longer way round: August -Harry- Silver -Skyler- Paint -Cory- Victory.
	const band = {
		'Song:August': { Kyle: [ 'banjo' ], Harry: [ 'mandolin' ] },
		'Song:Cicada Song': { Kyle: [ 'banjo' ], Maddie: [ 'fiddle' ] },
		'Song:Victory': { Maddie: [ 'fiddle' ], Cory: [ 'banjo' ] },
		'Song:Silver 44': { Harry: [ 'mandolin' ], Skyler: [ 'bass' ] },
		'Song:Paint Exchange': { Skyler: [ 'bass' ], Cory: [ 'banjo' ] },
	};
	const plays = {};
	for ( const [ song, people ] of Object.entries( band ) ) {
		for ( const name of Object.keys( people ) ) {
			( plays[ name ] = plays[ name ] || [] ).push( song );
		}
	}
	const graph = { band, plays };
	let readyTrail;
	beforeEach( async () => {
		vi.resetModules();
		setActivePinia( createPinia() );
		( { readyTrail } = await import( '../../src/wiki/queue.js' ) );
	} );
	const through = ( hops ) => hops.map( ( h ) => h.to );

	it( 'takes the short way when every song on it is ready', async () => {
		expect( through( await readyTrail( graph, 'Song:August', 'Song:Victory', async () => true ) ) ).toEqual( [ 'Song:Cicada Song', 'Song:Victory' ] );
	} );
	it( 'goes round a song that is not', async () => {
		const hops = await readyTrail( graph, 'Song:August', 'Song:Victory', async ( song ) => song !== 'Song:Cicada Song' );
		expect( through( hops ) ).toEqual( [ 'Song:Silver 44', 'Song:Paint Exchange', 'Song:Victory' ] );
	} );
	it( 'ends on the song asked for whatever its state, and never asks about it', async () => {
		const asked = [];
		const hops = await readyTrail( graph, 'Song:August', 'Song:Victory', async ( song ) => {
			asked.push( song );
			return true;
		} );
		expect( through( hops ).pop() ).toBe( 'Song:Victory' );
		expect( asked ).not.toContain( 'Song:Victory' );
	} );
	it( 'finds no way when every way there passes through a song that is not ready', async () => {
		expect( await readyTrail( graph, 'Song:August', 'Song:Victory', async () => false ) ).toBe( null );
	} );
	it( 'findTrail may still end on a song it is told to avoid', () => {
		expect( through( findTrail( graph, 'Song:August', 'Song:Cicada Song', { avoidSongs: [ 'Song:Cicada Song' ] } ) ) ).toEqual( [ 'Song:Cicada Song' ] );
	} );
} );

describe( 'saving a chart keeps the track\'s state', () => {
	const working = { timeline: { 0: { part: 'A' } }, ensemble: { 'Cory Walker': [ 'banjo' ] } };
	it( 'writes back the state the page named', () => {
		const text = metadataYaml( working, { title: 'August', _state: 'production' } );
		expect( jsYaml.load( text ).state ).toBe( 'production' );
		expect( isProduction( text ) ).toBe( true );
		expect( jsYaml.load( metadataYaml( working, { title: 'Silver 44', _state: 'beta' } ) ).state ).toBe( 'beta' );
	} );
	it( 'writes none where the page named none', () => {
		expect( 'state' in jsYaml.load( metadataYaml( working, { title: 'Cicada Song', _state: null } ) ) ).toBe( false );
		expect( 'state' in jsYaml.load( metadataYaml( working, { title: 'Cicada Song' } ) ) ).toBe( false );
		expect( 'state' in jsYaml.load( metadataYaml( working, { title: 'x', _state: 'ready' } ) ) ).toBe( false );
	} );
} );
