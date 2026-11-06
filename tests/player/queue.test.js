/**
 * The queue is Webamp's playlist.
 *
 * For a year the player guessed at the end of a track from the clock and a
 * `length` Webamp's state does not carry, and so never played on: trails and
 * add-to-queue lined songs up that nothing ever reached (audit, 5 Nov 2026,
 * item 1). A queued song goes into Webamp's own playlist, Webamp moves on by
 * itself when a track ends, and the chart follows its current track.
 *
 * Webamp here is a toy: appendTracks records what it was handed, and the
 * store holds the shape the model reads (playlist.trackOrder,
 * playlist.currentTrack, tracks[id].url).
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock( '../../src/player/webamp-global.js', () => ( { default: () => class {} } ) );

import { WebampPlayer } from '../../src/player/model.js';

const SWORDS = { title: 'Swords to Ploughshares', audioFile: 'swords.ogg', _trackCid: 'QmSwords', ensemble: {}, timeline: {} };
const VICTORY = { title: 'Victory', audioFile: 'victory.ogg', _trackCid: 'QmVictory', ensemble: {}, timeline: {} };
const CICADA = { title: 'Cicada Song', audioFile: 'cicada.ogg', _trackCid: 'QmCicada', ensemble: {}, timeline: {} };

function fakeWebamp() {
	const state = { playlist: { trackOrder: [], currentTrack: null }, tracks: {}, media: { status: 'STOPPED', timeElapsed: 0, volume: 75 } };
	const listeners = new Set();
	let nextId = 1;
	const notify = () => listeners.forEach( ( fn ) => fn() );
	return {
		state,
		appended: [],
		appendTracks( tracks ) {
			tracks.forEach( ( t ) => {
				const id = nextId++;
				state.tracks[ id ] = { id, url: t.url };
				state.playlist.trackOrder.push( id );
				this.appended.push( t );
			} );
			notify();
		},
		// What Webamp does on `ended`: the next track becomes current.
		advance() {
			const order = state.playlist.trackOrder;
			const at = order.indexOf( state.playlist.currentTrack );
			state.playlist.currentTrack = order[ at + 1 ] ?? null;
			notify();
		},
		store: {
			getState: () => state,
			subscribe( fn ) { listeners.add( fn ); return () => listeners.delete( fn ); },
			dispatch() {},
		},
		getMediaStatus: () => state.media.status,
		onWillClose() {},
	};
}

/** A model wired to the toy, with the first song in Webamp's playlist and current. */
function wired() {
	const model = new WebampPlayer( SWORDS );
	const webamp = fakeWebamp();
	model.webamp = webamp;
	webamp.appendTracks( [ model._webampTrack( SWORDS ) ] );
	webamp.state.playlist.currentTrack = 1;
	model._unsubscribe = webamp.store.subscribe( () => model._onStoreChange() );
	model._onStoreChange();
	return { model, webamp };
}

describe( 'the queue is the playlist', () => {
	it( 'hands a queued song to Webamp, with its title so no tags are read', () => {
		const { model, webamp } = wired();
		model.enqueue( VICTORY );
		expect( webamp.appended.map( ( t ) => t.url ) ).toEqual( [ 'swords.ogg', 'victory.ogg' ] );
		expect( webamp.appended[ 1 ].metaData.title ).toBe( 'Victory' );
		expect( model.state.upNext ).toEqual( [ VICTORY ] );
	} );

	it( 'lines a song up once, however many times it is asked for', () => {
		const { model } = wired();
		expect( model.enqueue( VICTORY ) ).toBe( true );
		expect( model.enqueue( VICTORY ) ).toBe( false );
		expect( model.state.upNext ).toEqual( [ VICTORY ] );
	} );

	it( 'lists what is up next in playing order, after the current track only', () => {
		const { model, webamp } = wired();
		model.enqueue( VICTORY );
		model.enqueue( CICADA );
		expect( model.state.upNext.map( ( s ) => s.title ) ).toEqual( [ 'Victory', 'Cicada Song' ] );
		webamp.advance();
		expect( model.state.upNext.map( ( s ) => s.title ) ).toEqual( [ 'Cicada Song' ] );
	} );

	it( 'shows the next song when Webamp moves on', () => {
		const { model, webamp } = wired();
		model.enqueue( VICTORY );
		webamp.advance();
		expect( model.state.song.title ).toBe( 'Victory' );
	} );

	it( 'leaves the chart alone for a track it never handed Webamp', () => {
		const { model, webamp } = wired();
		webamp.appendTracks( [ { url: 'blob:dragged-in' } ] );
		webamp.advance();
		expect( model.state.song.title ).toBe( 'Swords to Ploughshares' );
		expect( model.state.upNext ).toEqual( [] );
	} );
} );
