import { describe, it, expect } from 'vitest';

import { appAddress } from '../src/wiki/pane-html.js';

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
