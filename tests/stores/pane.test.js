// @vitest-environment happy-dom
/**
 * The pane shows the page most recently asked for.
 *
 * Two solo changes in a row fetched two pages and the slower one won
 * (audit item 2): the newest request aborts the one before, and a response
 * checks it is still the newest before it touches the pane.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePaneStore } from '../../src/stores/pane.js';

// A wiki whose answers arrive when the test says so.
function slowWiki() {
	const pending = {};
	globalThis.fetch = vi.fn( ( url, init ) => new Promise( ( resolve, reject ) => {
		const page = new URL( url, 'http://x' ).searchParams.get( 'page' );
		pending[ page ] = () => resolve( {
			ok: true,
			json: async () => ( { parse: { text: '<p>' + page + '</p>', displaytitle: page } } ),
		} );
		if ( init && init.signal ) {
			init.signal.addEventListener( 'abort', () => reject( new DOMException( 'aborted', 'AbortError' ) ) );
		}
	} ) );
	return pending;
}

describe( 'the wiki pane', () => {
	beforeEach( () => {
		setActivePinia( createPinia() );
		history.replaceState( null, '', '/' );
	} );

	it( 'shows the later ask when the earlier answer arrives last', async () => {
		const pending = slowWiki();
		const pane = usePaneStore();

		const first = pane.open( 'Maddie Denton' );
		const second = pane.open( 'Justin Holmes' );

		pending[ 'Justin Holmes' ]();
		await second;
		expect( pane.shown ).toBe( 'Justin Holmes' );
		expect( pane.html ).toContain( '<p>Justin Holmes</p>' );

		// Maddie's request was aborted when Justin's was made; whatever
		// happens to it now, the pane is Justin's.
		if ( pending[ 'Maddie Denton' ] ) {
			pending[ 'Maddie Denton' ]();
		}
		await first;
		expect( pane.shown ).toBe( 'Justin Holmes' );
		expect( pane.html ).toContain( '<p>Justin Holmes</p>' );
		expect( location.pathname ).toBe( '/wiki/Justin_Holmes' );
	} );

	it( 'aborts the request it supersedes', async () => {
		slowWiki();
		const pane = usePaneStore();
		pane.open( 'Maddie Denton' );
		const firstInit = globalThis.fetch.mock.calls[ 0 ][ 1 ];
		pane.open( 'Justin Holmes' );
		expect( firstInit.signal.aborted ).toBe( true );
	} );

	it( 'treats a page already on its way as already asked for', async () => {
		slowWiki();
		const pane = usePaneStore();
		pane.open( 'Maddie Denton' );
		pane.open( 'Maddie Denton' );
		expect( globalThis.fetch ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'forgets a page that failed for real, so a retap tries again', async () => {
		globalThis.fetch = vi.fn( async () => ( { ok: true, json: async () => ( { error: { info: 'no such page' } } ) } ) );
		const pane = usePaneStore();
		await pane.open( 'Nobody At All' );
		expect( pane.wanted ).toBeNull();
		expect( pane.html ).toContain( 'Could not load' );
		await pane.open( 'Nobody At All' );
		expect( globalThis.fetch ).toHaveBeenCalledTimes( 2 );
	} );
} );
