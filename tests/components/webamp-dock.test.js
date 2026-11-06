// @vitest-environment happy-dom
/**
 * The dock says so when there is no player.
 *
 * Webamp is a classic script the app reads off window. When it has not
 * loaded, the model cannot be built, and the one thing that must not
 * happen is "Loading player..." forever: that is how the jsDelivr failure
 * of October 2026 sat unseen in production. The error goes on screen.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';

import { useSongStore } from '../../src/stores/song.js';
import { usePlayerStore } from '../../src/stores/player.js';
import WebampDock from '../../src/components/WebampDock.vue';

const SONG = { title: 'Swords to Ploughshares', audioFile: 'swords.ogg', ensemble: {}, timeline: { 0: { part: 'intro' } } };

describe( 'the dock without Webamp', () => {
	beforeEach( () => {
		setActivePinia( createPinia() );
		delete window.Webamp;
	} );

	it( 'shows the error instead of loading forever', async () => {
		const songs = useSongStore();
		const player = usePlayerStore();
		songs.initial = SONG;
		const wrapper = mount( WebampDock );
		await flushPromises();
		expect( player.error ).toMatch( /window\.Webamp is missing/ );
		expect( wrapper.text() ).toContain( 'Could not start the player' );
		expect( wrapper.text() ).not.toContain( 'Loading player' );
	} );
} );
