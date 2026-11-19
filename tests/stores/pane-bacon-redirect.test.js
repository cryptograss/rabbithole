// @vitest-environment happy-dom
/**
 * A chart names a soloist as it likes; the graph knows them by their page's
 * own title. The pane asks the wiki, redirects followed, and moves the graph
 * to that name (Justin, #connectome, 18 Nov 2026: Justin Holmes is the
 * graph's Justin Myles Holmes).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock( '../../src/wiki/api.js', () => ( {
	parsePage: vi.fn( async ( title ) => ( title === 'Justin Holmes'
		? { title: 'Justin Myles Holmes', text: '<div class="mw-parser-output"><table class="wikitable"><tr><th>Instrument</th><td>guitar</td></tr></table></div>' }
		: { title, text: '' } ) ),
} ) );

const { usePaneStore } = await import( '../../src/stores/pane.js' );
const SONG = { _trackCid: 'QmSong', title: 'August', _metadataTitle: 'Release:QmSong' };

describe( 'the soloist, by their page\'s own name', () => {
	beforeEach( () => setActivePinia( createPinia() ) );

	it( 'moves the graph to the name the redirect leads to', async () => {
		const pane = usePaneStore();
		pane.bacon( SONG, 'Justin Holmes' );
		expect( pane.view.to ).toBe( '?p=Justin+Holmes&playing=QmSong' );
		await new Promise( ( r ) => setTimeout( r, 0 ) );
		expect( pane.view.to ).toBe( '?p=Justin+Myles+Holmes&playing=QmSong' );
		expect( pane.view.card ).toBe( 'Justin Holmes' );
	} );

	it( 'leaves a newer move alone when the answer comes late', async () => {
		const pane = usePaneStore();
		pane.bacon( SONG, 'Justin Holmes' );
		pane.bacon( SONG );                                   // the solo ended before the wiki answered
		await new Promise( ( r ) => setTimeout( r, 0 ) );
		expect( pane.view.to ).toBe( '?cut=QmSong' );
	} );
} );
