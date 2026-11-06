/**
 * The queue is Webamp's playlist.
 *
 * For a year the player guessed at the end of a track from the clock and a
 * `length` Webamp's state does not carry, and so never played on: trails and
 * add-to-queue lined songs up that nothing ever reached (audit, 5 Nov 2026,
 * item 1). Now a queued song goes into Webamp's own playlist, Webamp moves on
 * by itself when a track ends, and the chart follows its current track.
 *
 * Webamp here is a toy: appendTracks records what it was handed, and the
 * store holds the shape the player reads (playlist.trackOrder,
 * playlist.currentTrack, tracks[id].url).
 */
import { describe, it, expect } from 'vitest';
import RabbitholeWebampPlayer from '../../src/player/rabbithole-player.js';

const SWORDS = { title: 'Swords to Ploughshares', audioFile: 'swords.ogg', _trackCid: 'QmSwords', ensemble: {}, timeline: {} };
const VICTORY = { title: 'Victory', audioFile: 'victory.ogg', _trackCid: 'QmVictory', ensemble: {}, timeline: {} };
const CICADA = { title: 'Cicada Song', audioFile: 'cicada.ogg', _trackCid: 'QmCicada', ensemble: {}, timeline: {} };

function fakeWebamp() {
	const state = { playlist: { trackOrder: [], currentTrack: null }, tracks: {}, media: { status: 'STOPPED' } };
	let nextId = 1;
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
		},
		// What Webamp does on `ended`: the next track becomes current.
		advance() {
			const order = state.playlist.trackOrder;
			const at = order.indexOf( state.playlist.currentTrack );
			state.playlist.currentTrack = order[ at + 1 ] ?? null;
		},
		store: { getState: () => state },
	};
}

// The player's methods on a bare receiver, with showSong stubbed: the chart
// side is covered by ensemble.test.js, and here only the following matters.
function player( fields ) {
	const shown = [];
	const self = Object.assign( Object.create( RabbitholeWebampPlayer.prototype ), {
		options: {},
		songsByUrl: new Map(),
		shown,
		showSong( song ) { this.trackData = song; shown.push( song ); },
	}, fields );
	self.songsByUrl.set( self.trackData.audioFile, self.trackData );
	return self;
}

describe( 'the queue is the playlist', () => {
	it( 'hands a queued song to Webamp, with its title so no tags are read', () => {
		const webamp = fakeWebamp();
		const self = player( { trackData: SWORDS, webamp } );
		webamp.appendTracks( [ self.webampTrack( SWORDS ) ] );
		webamp.state.playlist.currentTrack = 1;

		self.enqueue( VICTORY );

		expect( webamp.appended.map( ( t ) => t.url ) ).toEqual( [ 'swords.ogg', 'victory.ogg' ] );
		expect( webamp.appended[ 1 ].metaData.title ).toBe( 'Victory' );
		expect( self.upNext() ).toEqual( [ VICTORY ] );
	} );

	it( 'lines a song up once, however many times it is asked for', () => {
		const webamp = fakeWebamp();
		const self = player( { trackData: SWORDS, webamp } );
		webamp.appendTracks( [ self.webampTrack( SWORDS ) ] );
		webamp.state.playlist.currentTrack = 1;

		expect( self.enqueue( VICTORY ) ).toBe( true );
		expect( self.enqueue( VICTORY ) ).toBe( false );

		expect( self.upNext() ).toEqual( [ VICTORY ] );
	} );

	it( 'lists what is up next in playing order, after the current track only', () => {
		const webamp = fakeWebamp();
		const self = player( { trackData: SWORDS, webamp } );
		webamp.appendTracks( [ self.webampTrack( SWORDS ) ] );
		webamp.state.playlist.currentTrack = 1;
		self.enqueue( VICTORY );
		self.enqueue( CICADA );

		expect( self.upNext().map( ( s ) => s.title ) ).toEqual( [ 'Victory', 'Cicada Song' ] );

		webamp.advance();
		self.followWebampTrack( webamp.state );

		expect( self.upNext().map( ( s ) => s.title ) ).toEqual( [ 'Cicada Song' ] );
	} );

	it( 'shows the next song when Webamp moves on, and tells the shell', () => {
		const webamp = fakeWebamp();
		const changes = [];
		const self = player( { trackData: SWORDS, webamp, options: { onSongChange: ( s ) => changes.push( s ) } } );
		webamp.appendTracks( [ self.webampTrack( SWORDS ) ] );
		webamp.state.playlist.currentTrack = 1;
		self.enqueue( VICTORY );

		webamp.advance();
		self.followWebampTrack( webamp.state );

		expect( self.trackData ).toBe( VICTORY );
		expect( self.shown ).toEqual( [ VICTORY ] );
		expect( changes ).toEqual( [ VICTORY ] );
	} );

	it( 'does nothing when the current track is already the song shown', () => {
		const webamp = fakeWebamp();
		const changes = [];
		const self = player( { trackData: SWORDS, webamp, options: { onSongChange: ( s ) => changes.push( s ) } } );
		webamp.appendTracks( [ self.webampTrack( SWORDS ) ] );
		webamp.state.playlist.currentTrack = 1;

		self.followWebampTrack( webamp.state );
		self.followWebampTrack( webamp.state );

		expect( self.shown ).toEqual( [] );
		expect( changes ).toEqual( [] );
	} );

	it( 'leaves the chart alone for a track it never handed Webamp', () => {
		const webamp = fakeWebamp();
		const self = player( { trackData: SWORDS, webamp } );
		webamp.appendTracks( [ self.webampTrack( SWORDS ), { url: 'blob:dragged-in' } ] );
		webamp.state.playlist.currentTrack = 2;

		self.followWebampTrack( webamp.state );

		expect( self.trackData ).toBe( SWORDS );
		expect( self.upNext() ).toEqual( [] );
	} );
} );
