/**
 * The player model against a stand-in for Webamp's store: what it mirrors,
 * what it derives, and the two rules timers used to enforce.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock( '../../src/player/webamp-global.js', () => ( { default: () => class {} } ) );

import { WebampPlayer, sameRecording } from '../../src/player/model.js';

const SWORDS = {
	title: 'Swords to Ploughshares',
	audioFile: 'swords.ogg',
	ensemble: { 'Justin Holmes': [ 'guitar' ], 'Harry Clark': [ 'mandolin' ] },
	timeline: { 0: { part: 'intro', musicians: { 'Justin Holmes': 'in' } }, 10: { part: 'A', solo: 'Harry Clark', musicians: { band: 'in' }, flourish: 'Harry Clark' } },
};
const VICTORY = { title: 'Victory', audioFile: 'victory.ogg', ensemble: { 'Kyle Tuttle': [ 'banjo' ] }, timeline: { 0: { part: 'intro' } } };

/** Enough of Webamp for the model: a store, and the calls it makes. */
function fakeWebamp( initial = {} ) {
	let state = {
		media: { status: 'STOPPED', timeElapsed: 0, volume: 75 },
		playlist: { trackOrder: [ 0 ], currentTrack: 0 },
		tracks: { 0: { url: 'swords.ogg', duration: 267 } },
		...initial,
	};
	const listeners = new Set();
	const calls = [];
	const store = {
		getState: () => state,
		subscribe: ( fn ) => { listeners.add( fn ); return () => listeners.delete( fn ); },
		dispatch: ( a ) => calls.push( a ),
	};
	const set = ( patch ) => {
		state = { ...state, ...patch, media: { ...state.media, ...( patch.media || {} ) } };
		listeners.forEach( ( fn ) => fn() );
	};
	return {
		store, calls, set,
		getMediaStatus: () => state.media.status,
		pause: () => { calls.push( 'pause' ); set( { media: { status: 'PAUSED' } } ); },
		play: () => calls.push( 'play' ),
		stop: () => calls.push( 'stop' ),
		seekToTime: ( t ) => calls.push( [ 'seek', t ] ),
		setTracksToPlay: ( tracks ) => calls.push( [ 'setTracksToPlay', tracks ] ),
		appendTracks: ( tracks ) => {
			const id = Object.keys( state.tracks ).length;
			calls.push( [ 'appendTracks', tracks ] );
			set( { tracks: { ...state.tracks, [ id ]: { url: tracks[ 0 ].url } }, playlist: { ...state.playlist, trackOrder: [ ...state.playlist.trackOrder, id ] } } );
		},
		onWillClose: () => {},
	};
}

function wired( song = SWORDS ) {
	const model = new WebampPlayer( song );
	const webamp = fakeWebamp();
	model.webamp = webamp;
	model._unsubscribe = webamp.store.subscribe( () => model._onStoreChange() );
	model._onStoreChange();
	return { model, webamp };
}

describe( 'the player model', () => {
	beforeEach( () => vi.useFakeTimers() );

	it( 'derives the chart from the song and the time, and nothing else', () => {
		const { model, webamp } = wired();
		expect( model.parts.value ).toEqual( [ 'intro', 'A' ] );
		expect( model.partIndex.value ).toBe( 0 );
		webamp.set( { media: { status: 'PLAYING', timeElapsed: 12 } } );
		expect( model.state.time ).toBe( 12 );
		expect( model.partIndex.value ).toBe( 1 );
		expect( model.state.currentSolo ).toBe( 'Harry Clark' );
		expect( model.cards.value.find( ( c ) => c.name === 'Harry Clark' ).scene ).toBe( 'lead' );
		expect( model.state.duration ).toBe( 267 );
	} );

	it( 'a loaded song is paused the first time Webamp reports it playing; a played one is not', () => {
		const { model, webamp } = wired();
		model.loadSong( VICTORY );
		expect( webamp.calls ).toContainEqual( 'stop' );
		webamp.set( { media: { status: 'PLAYING' } } );
		expect( webamp.calls ).toContain( 'pause' );

		const second = wired();
		second.webamp.set( { media: { status: 'PLAYING' } } );
		second.model.loadSong( VICTORY );
		second.webamp.set( { media: { status: 'PLAYING' } } );
		expect( second.webamp.calls ).not.toContain( 'pause' );
	} );

	it( 'follows Webamp to the next track in its playlist', () => {
		const { model, webamp } = wired();
		expect( model.enqueue( VICTORY ) ).toBe( true );
		expect( model.enqueue( VICTORY ) ).toBe( false );
		expect( model.state.upNext.map( ( s ) => s.title ) ).toEqual( [ 'Victory' ] );
		webamp.set( { playlist: { trackOrder: [ 0, 1 ], currentTrack: 1 } } );
		expect( model.state.song.title ).toBe( 'Victory' );
		expect( model.state.upNext ).toEqual( [] );
	} );

	it( 'fires an effect once per arrangement, for as long as it asks', () => {
		const { model } = wired();
		model._tick( 10.1 );
		expect( model.state.effects.map( ( e ) => e.kind ) ).toEqual( [ 'flourish', 'flash' ] );
		model._tick( 10.3 );
		expect( model.state.effects.filter( ( e ) => e.kind === 'flourish' ) ).toHaveLength( 1 );
		vi.advanceTimersByTime( 1600 );
		expect( model.state.effects.filter( ( e ) => e.kind === 'flourish' ) ).toHaveLength( 0 );
	} );

	it( 'keeps the soloist while paused: the cards render from time, not status', () => {
		const { model, webamp } = wired();
		webamp.set( { media: { status: 'PLAYING', timeElapsed: 12 } } );
		webamp.set( { media: { status: 'PAUSED' } } );
		expect( model.state.currentSolo ).toBe( 'Harry Clark' );
	} );

	it( 'keeps the editor\'s view of it: trackData, updateTimeline, onTimeUpdate', () => {
		const { model } = wired();
		const seen = [];
		model.onTimeUpdate( ( t, arr ) => seen.push( [ t, arr && arr.part ] ) );
		model._tick( 3 );
		model.updateTimeline( { 0: { part: 'Z' } } );
		expect( model.trackData.timeline ).toEqual( { 0: { part: 'Z' } } );
		expect( model.parts.value ).toEqual( [ 'Z' ] );
		expect( seen.at( -1 ) ).toEqual( [ 3, 'Z' ] );
	} );
} );

describe( 'sameRecording', () => {
	it( 'is the CID when both have one, whatever the file', () => {
		expect( sameRecording( { _trackCid: 'Qb', audioFile: 'a.ogg' }, { _trackCid: 'Qb', audioFile: 'a.flac' } ) ).toBe( true );
		expect( sameRecording( { _trackCid: 'Qb', audioFile: 'a.ogg' }, { _trackCid: 'Qv', audioFile: 'a.ogg' } ) ).toBe( false );
	} );
	it( 'is the file when there is no CID', () => {
		expect( sameRecording( { audioFile: 'a.ogg' }, { audioFile: 'a.ogg' } ) ).toBe( true );
	} );
} );
