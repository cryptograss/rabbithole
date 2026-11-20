// @vitest-environment happy-dom
/**
 * The song selector lists what the rabbithole hands out -- the tracks in
 * production -- and the song that is loaded, whatever its state (Justin,
 * #connectome, 20 Nov 2026: "I really only want Reuben's, Paint Exchange,
 * and August").
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive } from 'vue';

vi.mock( '../../src/stores/song.js', () => ( { useSongStore: () => globalThis.__songs } ) );

import DemoSongSelect from '../../src/components/DemoSongSelect.vue';

const CHARTED = [
	{ cid: 'Qa', title: 'August', album: 'Vowel Sounds', state: 'production' },
	{ cid: 'Qp', title: 'Paint Exchange', album: '4masks', state: 'production' },
	{ cid: 'Qs', title: 'Silver 44', album: '4masks', state: 'beta' },
	{ cid: 'Qc', title: 'Cicada Song', album: 'Vowel Sounds' },
];

describe( 'the song selector', () => {
	beforeEach( () => {
		globalThis.__songs = reactive( {
			charted: CHARTED,
			ready: CHARTED.filter( ( t ) => t.state === 'production' ),
			current: null, album: null, notice: '', pickTrack: vi.fn(),
		} );
	} );
	const titles = ( w ) => w.findAll( 'option' ).map( ( o ) => o.text() );

	it( 'lists the tracks in production and no others', () => {
		const w = mount( DemoSongSelect );
		expect( titles( w ) ).toEqual( [ 'August', 'Paint Exchange' ] );
	} );
	it( 'lists the loaded song too when it is not one of them, and shows it', () => {
		globalThis.__songs.current = { _trackCid: 'Qs', title: 'Silver 44' };
		globalThis.__songs.album = { title: '4masks' };
		const w = mount( DemoSongSelect );
		expect( titles( w ) ).toEqual( [ 'Silver 44', 'Paint Exchange', 'August' ] );
		expect( w.find( 'select' ).element.value ).toBe( 'Qs' );
	} );
	it( 'lists a loaded song in production once', () => {
		globalThis.__songs.current = { _trackCid: 'Qa', title: 'August' };
		const w = mount( DemoSongSelect );
		expect( titles( w ) ).toEqual( [ 'August', 'Paint Exchange' ] );
	} );
} );
