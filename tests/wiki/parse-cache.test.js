// @vitest-environment happy-dom
/**
 * Pages the pane has read are kept, and the ones it is about to read are
 * fetched ahead.
 *
 * Justin, #rabbithole 15 Nov 2026, item 33: "Sometimes in traverse mode,
 * it takes 2 or even 3 seconds to load a picker page - can we prefetch
 * these so that the load matches the transition?" Traverse mode goes to a
 * soloist's page and back to the song's at every marker, so the same
 * handful of pages is asked for over and over.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { parsePage, prefetchPages, parsedTitles, forgetParsed } from '../../src/wiki/api.js';

/** The wiki, counting what it was asked. */
function wikiSays() {
	const asked = [];
	globalThis.fetch = vi.fn( async ( url ) => {
		const page = new URL( url, 'https://pickipedia.xyz' ).searchParams.get( 'page' );
		asked.push( page );
		return { ok: true, json: async () => ( { parse: { title: page, text: '<p>' + page + '</p>' } } ) };
	} );
	return asked;
}

describe( 'the pages in hand', () => {
	beforeEach( () => forgetParsed() );

	it( 'asks the wiki once for a page read twice', async () => {
		const asked = wikiSays();
		const first = await parsePage( 'Maddie Denton' );
		const again = await parsePage( 'Maddie Denton' );
		expect( first.text ).toContain( 'Maddie Denton' );
		expect( again ).toBe( first );
		expect( asked ).toEqual( [ 'Maddie Denton' ] );
	} );

	it( 'is one request when two asks are in flight together', async () => {
		const asked = wikiSays();
		const [ a, b ] = await Promise.all( [ parsePage( 'Song:August' ), parsePage( 'Song:August' ) ] );
		expect( a ).toBe( b );
		expect( asked ).toEqual( [ 'Song:August' ] );
	} );

	it( 'asks again when the caller wants it fresh', async () => {
		const asked = wikiSays();
		await parsePage( 'Song:August' );
		await parsePage( 'Song:August', { fresh: true } );
		expect( asked ).toEqual( [ 'Song:August', 'Song:August' ] );
	} );

	it( 'keeps nothing it could not read, so the next ask tries again', async () => {
		globalThis.fetch = vi.fn( async () => ( { ok: true, json: async () => ( { error: { info: 'no such page' } } ) } ) );
		await expect( parsePage( 'Song:Nowhere' ) ).rejects.toThrow( 'no such page' );
		expect( parsedTitles() ).not.toContain( 'Song:Nowhere' );
	} );

	it( 'fetches the band of a song ahead of the music, and only what it has not got', async () => {
		const asked = wikiSays();
		await parsePage( 'Maddie Denton' );
		prefetchPages( [ 'Maddie Denton', 'Harry Clark', null, 'Kyle Tuttle' ] );
		// The prefetch does not wait, so let the requests go out.
		await Promise.resolve();
		expect( asked ).toEqual( [ 'Maddie Denton', 'Harry Clark', 'Kyle Tuttle' ] );
		// And a page fetched ahead is then free to open.
		expect( await parsePage( 'Harry Clark' ) ).toBeTruthy();
		expect( asked ).toHaveLength( 3 );
	} );

	it( 'forgets the oldest pages rather than growing without end', async () => {
		wikiSays();
		for ( let i = 0; i < 44; i++ ) {
			await parsePage( 'Page ' + i );
		}
		const held = parsedTitles();
		expect( held ).toHaveLength( 40 );
		expect( held ).not.toContain( 'Page 0' );
		expect( held ).toContain( 'Page 43' );
	} );
} );
