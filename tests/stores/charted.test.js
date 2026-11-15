// @vitest-environment happy-dom
/**
 * The list of charted tracks: asked for once, whatever the address says.
 *
 * It used to be fetched only when the address named no track, because
 * only the song selector wanted it. Then the rabbithole's fallback came
 * to want it too -- when a chase and a quest have both run out, a charted
 * track is what plays next (Justin's item 28) -- and on a visit from a
 * Listen link the list was empty, so the song ended in silence (re,
 * #rabbithole, 15 Nov 2026).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// The factory is hoisted above the file, so the spy is made inside it and
// fetched back here.
vi.mock( '../../src/wiki/api.js', () => ( { chartedTracks: vi.fn() } ) );

import { chartedTracks } from '../../src/wiki/api.js';
import { useSongStore } from '../../src/stores/song.js';

describe( 'the charted list', () => {
	beforeEach( () => {
		setActivePinia( createPinia() );
		chartedTracks.mockReset();
	} );

	it( 'is asked of the wiki once, however many ask for it', async () => {
		chartedTracks.mockResolvedValue( [ { cid: 'Qa', title: 'August' } ] );
		const songs = useSongStore();
		const [ first, second ] = await Promise.all( [ songs.chartedList(), songs.chartedList() ] );
		expect( chartedTracks ).toHaveBeenCalledTimes( 1 );
		expect( first ).toEqual( second );
		expect( songs.charted ).toEqual( [ { cid: 'Qa', title: 'August' } ] );
	} );

	it( 'is an empty list when the wiki will not answer, and is asked again later', async () => {
		chartedTracks.mockRejectedValueOnce( new Error( 'offline' ) );
		const songs = useSongStore();
		expect( await songs.chartedList() ).toEqual( [] );
		chartedTracks.mockResolvedValue( [ { cid: 'Qs', title: 'Silver 44' } ] );
		expect( await songs.chartedList() ).toEqual( [ { cid: 'Qs', title: 'Silver 44' } ] );
		expect( chartedTracks ).toHaveBeenCalledTimes( 2 );
	} );
} );
