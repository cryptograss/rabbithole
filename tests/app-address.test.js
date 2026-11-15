import { describe, it, expect } from 'vitest';

import { appAddress, loginHref } from '../src/wiki/urls.js';

// The app's path is vite's base: /rabbithole/ in a build, / under vitest.
const base = new URL( import.meta.env.BASE_URL || '/', 'https://pickipedia.xyz' ).pathname;

describe( 'the app’s address for a page in the pane', () => {
	it( 'keeps the track and names the page, under the app’s own path', () => {
		const from = 'https://pickipedia.xyz/rabbithole/?track=QmS3QEZ';
		expect( appAddress( 'Kyle Tuttle', from ) ).toBe( base + '?track=QmS3QEZ&page=Kyle+Tuttle' );
	} );

	it( 'replaces the page it already names, and drops the hash', () => {
		const from = 'https://pickipedia.xyz/rabbithole/?track=QmS3QEZ&page=Song%3AAugust#solo';
		expect( appAddress( 'Kyle Tuttle', from ) ).toBe( base + '?track=QmS3QEZ&page=Kyle+Tuttle' );
	} );
} );

describe( 'signing in from Rabbithole', () => {
	it( 'returns through Special:Rabbithole to the current track and page', () => {
		const href = loginHref( {
			track: 'QmS3QEZFa1c75BBa9vwNEsXkS6GBmS75Cs6RyDJBXqRx8a',
			page: 'Song:August',
			search: '',
		} );
		const u = new URL( href, 'https://pickipedia.xyz' );
		expect( u.pathname ).toBe( '/index.php' );
		expect( u.searchParams.get( 'title' ) ).toBe( 'Special:UserLogin' );
		expect( u.searchParams.get( 'returnto' ) ).toBe( 'Special:Rabbithole' );
		const ret = new URLSearchParams( u.searchParams.get( 'returntoquery' ) );
		expect( ret.get( 'track' ) ).toBe( 'QmS3QEZFa1c75BBa9vwNEsXkS6GBmS75Cs6RyDJBXqRx8a' );
		expect( ret.get( 'page' ) ).toBe( 'Song:August' );
		expect( ret.has( 'action' ) ).toBe( false );
	} );

	it( 'reopens the timeline editor when signing in from an open editor', () => {
		const href = loginHref( {
			track: 'QmS3QEZ',
			page: 'Song:August',
			edit: true,
			search: '?track=QmS3QEZ',
		} );
		const ret = new URLSearchParams( new URL( href, 'https://pickipedia.xyz' ).searchParams.get( 'returntoquery' ) );
		expect( ret.get( 'action' ) ).toBe( 'edit' );
	} );

	it( 'clears a stale action=edit when the editor was closed', () => {
		const href = loginHref( {
			track: 'QmS3QEZ',
			page: 'Song:August',
			edit: false,
			search: '?track=QmS3QEZ&action=edit',
		} );
		const ret = new URLSearchParams( new URL( href, 'https://pickipedia.xyz' ).searchParams.get( 'returntoquery' ) );
		expect( ret.has( 'action' ) ).toBe( false );
	} );

	it( 'omits returntoquery when nothing is selected yet', () => {
		const href = loginHref( { search: '' } );
		const u = new URL( href, 'https://pickipedia.xyz' );
		expect( u.searchParams.get( 'returnto' ) ).toBe( 'Special:Rabbithole' );
		expect( u.searchParams.has( 'returntoquery' ) ).toBe( false );
	} );
} );
