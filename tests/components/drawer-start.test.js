// @vitest-environment happy-dom
/**
 * The drawer before a song is on (Justin, #connectome, 21 Nov 2026, 01:56Z:
 * "I think it makes sense to start with rabbithole as a drawer on the
 * left"): it lists what the rabbithole hands out -- the tracks in production
 * (20 Nov: "I really only want Reuben's, Paint Exchange, and August") -- and
 * a press plays one. The list was the bar's dropdown until the same message
 * took that out of the bar.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive } from 'vue';

vi.mock( '../../src/stores/song.js', () => ( { useSongStore: () => globalThis.__songs } ) );

import DrawerStart from '../../src/components/DrawerStart.vue';

const CHARTED = [
	{ cid: 'Qa', title: 'August', album: 'Vowel Sounds', state: 'production' },
	{ cid: 'Qp', title: 'Paint Exchange', album: '4masks', state: 'production' },
	{ cid: 'Qs', title: 'Silver 44', album: '4masks', state: 'beta' },
	{ cid: 'Qc', title: 'Cicada Song', album: 'Vowel Sounds' },
];

describe( 'the drawer before a song is on', () => {
	beforeEach( () => {
		globalThis.__songs = reactive( {
			charted: CHARTED,
			ready: CHARTED.filter( ( t ) => t.state === 'production' ),
			current: null, playCid: vi.fn( async () => ( {} ) ),
		} );
	} );
	const titles = ( w ) => w.findAll( '.drawer-start-title' ).map( ( o ) => o.text() );

	it( 'lists the tracks in production and no others', () => {
		const w = mount( DrawerStart );
		expect( titles( w ) ).toEqual( [ 'August', 'Paint Exchange' ] );
		expect( w.text() ).toContain( 'Nothing playing yet' );
		expect( w.text() ).toContain( 'start with one of these' );
	} );
	it( 'plays the one pressed', async () => {
		const w = mount( DrawerStart );
		await w.findAll( 'button.drawer-start-song' )[ 1 ].trigger( 'click' );
		expect( globalThis.__songs.playCid ).toHaveBeenCalledWith( 'Qp', { play: true } );
	} );
	it( 'with none ready, says where a song is started and lists nothing', () => {
		globalThis.__songs.ready = [];
		const w = mount( DrawerStart );
		expect( w.find( '.drawer-start-songs' ).exists() ).toBe( false );
		expect( w.text() ).toContain( 'on a song in the graph, and it plays here' );
	} );
} );
