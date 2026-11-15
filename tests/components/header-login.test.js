// @vitest-environment happy-dom
/**
 * Signing in from Rabbithole's header returns into the same song and page,
 * rather than opening a second tab onto PickiPedia's Main_Page (Skyler,
 * #interfaces, 15 Nov 2026).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';

vi.mock( '../../src/player/webamp-global.js', () => ( { default: () => class {} } ) );

import { useAccountStore } from '../../src/stores/account.js';
import { usePlayerStore } from '../../src/stores/player.js';
import { usePaneStore } from '../../src/stores/pane.js';
import { useLayoutStore } from '../../src/stores/layout.js';
import RabbitholeHeader from '../../src/components/RabbitholeHeader.vue';

const AUGUST_CID = 'QmS3QEZFa1c75BBa9vwNEsXkS6GBmS75Cs6RyDJBXqRx8a';

describe( 'RabbitholeHeader sign-in link', () => {
	beforeEach( () => {
		setActivePinia( createPinia() );
		globalThis.fetch = vi.fn( async () => ( {
			ok: true,
			json: async () => ( { query: { userinfo: { id: 0, name: '203.0.113.9', anon: '' } } } ),
		} ) );
	} );

	it( 'navigates in the same tab and carries the current track, page, and editor state', async () => {
		const player = usePlayerStore();
		const pane = usePaneStore();
		const layout = useLayoutStore();
		const account = useAccountStore();

		player.create( { title: 'August', audioFile: 'august.ogg', _trackCid: AUGUST_CID } );
		pane.shown = 'Song:August';

		const w = mount( RabbitholeHeader );
		await vi.waitFor( () => expect( account.name ).toBeNull() );
		await nextTick();

		const link = w.find( 'a.rh-account.signed-out' );
		expect( link.exists() ).toBe( true );
		expect( link.attributes( 'target' ) ).toBeUndefined();

		const u = new URL( link.attributes( 'href' ), 'https://pickipedia.xyz' );
		expect( u.searchParams.get( 'title' ) ).toBe( 'Special:UserLogin' );
		expect( u.searchParams.get( 'returnto' ) ).toBe( 'Special:Rabbithole' );
		const ret = new URLSearchParams( u.searchParams.get( 'returntoquery' ) );
		expect( ret.get( 'track' ) ).toBe( AUGUST_CID );
		expect( ret.get( 'page' ) ).toBe( 'Song:August' );
		expect( ret.has( 'action' ) ).toBe( false );

		layout.editorOpen = true;
		await nextTick();
		const retEdit = new URLSearchParams(
			new URL( link.attributes( 'href' ), 'https://pickipedia.xyz' ).searchParams.get( 'returntoquery' )
		);
		expect( retEdit.get( 'action' ) ).toBe( 'edit' );
	} );
} );
