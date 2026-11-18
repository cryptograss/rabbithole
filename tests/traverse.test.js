/**
 * Traverse mode puts the pane where the music is.
 *
 * Justin's item 18, #rabbithole 15 Nov 2026: a stretch of the song where
 * nobody is soloing belongs to the song, so the pane goes back to its page
 * rather than staying on whoever played last.
 */
import { describe, it, expect } from 'vitest';
import { traverseTo, TRAVERSE_MODES, baconAddress } from '../src/traverse.js';

describe( 'traverseTo', () => {
	it( 'opens the song\'s page when the track changes', () => {
		expect( traverseTo( { trackChanged: true, playing: false } ) ).toBe( 'song' );
		expect( traverseTo( { trackChanged: true, playing: true, solo: 'Maddie Denton' } ) ).toBe( 'song' );
	} );

	it( 'opens the soloist\'s page while they are taking it', () => {
		expect( traverseTo( { playing: true, solo: 'Harry Clark', lastSolo: 'Justin Holmes' } ) ).toBe( 'person' );
	} );

	it( 'goes back to the song when the solo ends', () => {
		expect( traverseTo( { playing: true, solo: null, lastSolo: 'Harry Clark' } ) ).toBe( 'song' );
	} );

	it( 'stays put through a stretch nobody has soloed', () => {
		// The intro: the pane is already the song's, and moving there again
		// would push another entry onto the history.
		expect( traverseTo( { playing: true, solo: null, lastSolo: null } ) ).toBeNull();
	} );

	it( 'leaves a reader alone while the song is paused', () => {
		expect( traverseTo( { playing: false, solo: 'Kyle Tuttle' } ) ).toBeNull();
		expect( traverseTo( { playing: false, solo: null, lastSolo: 'Kyle Tuttle' } ) ).toBeNull();
	} );
} );

describe( 'traverse mode\'s bacon graphs (Justin, #connectome, 18 Nov 2026)', () => {
	it( 'rocks left to right: bacon graphs, off, PickiPedia pages', () => {
		expect( TRAVERSE_MODES ).toEqual( [ 'bacon', 'off', 'pages' ] );
	} );

	it( 'shows the song on now in its own graph', () => {
		expect( baconAddress( 'QmSong' ) ).toBe( '?cut=QmSong' );
	} );

	it( 'shows the soloist with the song beside them', () => {
		expect( baconAddress( 'QmSong', 'Harry Clark' ) ).toBe( '?p=Harry+Clark&playing=QmSong' );
	} );

	it( 'has nowhere to go without a track', () => {
		expect( baconAddress( null, 'Harry Clark' ) ).toBe( null );
	} );
} );
