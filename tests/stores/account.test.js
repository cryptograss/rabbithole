// @vitest-environment happy-dom
/**
 * Who is signed in, for the corner of the header (Skyler, 13 Nov 2026).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAccountStore } from '../../src/stores/account.js';

function wikiSays( userinfo ) {
	globalThis.fetch = vi.fn( async () => ( { ok: true, json: async () => ( { query: { userinfo } } ) } ) );
}

describe( 'who is signed in', () => {
	beforeEach( () => setActivePinia( createPinia() ) );

	it( 'is the user name the wiki gives', async () => {
		wikiSays( { id: 7, name: 'SkymanJenkins' } );
		const account = useAccountStore();
		await account.refresh();
		expect( account.name ).toBe( 'SkymanJenkins' );
	} );

	it( 'is nobody when the wiki says anon', async () => {
		wikiSays( { id: 0, name: '203.0.113.9', anon: '' } );
		const account = useAccountStore();
		await account.refresh();
		expect( account.name ).toBeNull();
	} );

	it( 'says nothing when the wiki does not answer', async () => {
		globalThis.fetch = vi.fn( async () => { throw new TypeError( 'offline' ); } );
		const account = useAccountStore();
		await account.refresh();
		expect( account.name ).toBeUndefined();
	} );

	it( 'asks again when the tab comes back into view', async () => {
		wikiSays( { id: 0, name: '203.0.113.9', anon: '' } );
		const account = useAccountStore();
		await account.refresh();
		wikiSays( { id: 7, name: 'SkymanJenkins' } );
		document.dispatchEvent( new Event( 'visibilitychange' ) );
		await vi.waitFor( () => expect( account.name ).toBe( 'SkymanJenkins' ) );
	} );
} );
