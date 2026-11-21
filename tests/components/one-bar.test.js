// @vitest-environment happy-dom
/**
 * One bar, and a grip on the drawer (Justin, #connectome, 21 Nov 2026,
 * 01:56Z): the graph's link button, its FAQ and the way to PickiPedia are in
 * Rabbithole's bar ("Let's get all that stuff on one unified top bar"), the
 * album's name, cover and dropdown are out of it, the chip says BETA 2, and
 * the drawer folds by a grip on its own edge, not by an arrow at the bar's
 * far end ("Give it a nice grip in the middle of the drawer").
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';

vi.mock( '../../src/player/webamp-global.js', () => ( { default: () => class {} } ) );

import { usePlayerStore } from '../../src/stores/player.js';
import { usePaneStore } from '../../src/stores/pane.js';
import { useLayoutStore } from '../../src/stores/layout.js';
import { barMessage } from '../../src/wiki/graph-frame.js';
import RabbitholeHeader from '../../src/components/RabbitholeHeader.vue';
import DrawerGrip from '../../src/components/DrawerGrip.vue';
import PaneGraph from '../../src/components/pane/PaneGraph.vue';

describe( 'the one bar', () => {
	beforeEach( () => {
		setActivePinia( createPinia() );
		globalThis.fetch = vi.fn( async () => ( { ok: true, json: async () => ( { query: { userinfo: { id: 0, name: '203.0.113.9', anon: '' } } } ) } ) );
	} );

	it( 'says BETA 2, and has no fold arrow, record, cover or selector', () => {
		usePlayerStore().create( { title: 'August', audioFile: 'august.ogg', _trackCid: 'Qa' } );
		const w = mount( RabbitholeHeader );
		expect( w.find( '.alpha' ).text() ).toBe( 'BETA 2' );
		expect( w.find( '#song-title-display' ).text() ).toContain( 'August' );
		for ( const gone of [ '.minimize-btn', '#record-line', '#album-row', '#album-art', 'select' ] ) {
			expect( w.find( gone ).exists(), gone ).toBe( false );
		}
	} );

	it( 'always has the way to PickiPedia, and the graph\'s link and FAQ only while the graph is in front', async () => {
		const pane = usePaneStore();
		const w = mount( RabbitholeHeader );
		expect( w.find( '#rh-bar-home' ).attributes( 'href' ) ).toBe( '/wiki/Main_Page' );
		expect( w.find( '#rh-bar-share' ).exists() ).toBe( false );
		expect( w.find( '#rh-bar-faq' ).exists() ).toBe( false );
		pane.graphSrc = '/bacon?host=rabbithole&shell=1&bar=1';
		pane.view = { kind: 'graph', src: pane.graphSrc, to: null };
		await nextTick();
		expect( w.find( '#rh-bar-share' ).exists() ).toBe( true );
		expect( w.find( '#rh-bar-faq' ).exists() ).toBe( true );
		pane.view = { kind: 'article', title: 'Cory Walker' };
		await nextTick();
		expect( w.find( '#rh-bar-share' ).exists() ).toBe( false );
	} );

	it( 'asks the graph by the layout store, each press a new ask', async () => {
		const pane = usePaneStore(), layout = useLayoutStore();
		pane.graphSrc = '/bacon?host=rabbithole&shell=1&bar=1';
		pane.view = { kind: 'graph', src: pane.graphSrc, to: null };
		const w = mount( RabbitholeHeader );
		await w.find( '#rh-bar-faq' ).trigger( 'click' );
		expect( layout.barAsk ).toEqual( { act: 'faq', n: 1 } );
		await w.find( '#rh-bar-share' ).trigger( 'click' );
		await w.find( '#rh-bar-share' ).trigger( 'click' );
		expect( layout.barAsk ).toEqual( { act: 'share', n: 3 } );
	} );
} );

describe( 'barMessage', () => {
	it( 'is the word both sides agreed, and nothing for an ask it does not know', () => {
		expect( barMessage( 'share' ) ).toEqual( { rabbithole: 'bar', act: 'share' } );
		expect( barMessage( 'faq' ) ).toEqual( { rabbithole: 'bar', act: 'faq' } );
		expect( barMessage( 'fold' ) ).toBe( null );
		expect( barMessage() ).toBe( null );
	} );
} );

describe( 'the graph\'s frame hears the bar', () => {
	beforeEach( () => setActivePinia( createPinia() ) );
	const framed = ( props ) => {
		const w = mount( PaneGraph, { props: Object.assign( { src: '/bacon?host=rabbithole&shell=1&bar=1' }, props ) } );
		const said = [];
		Object.defineProperty( w.find( 'iframe' ).element, 'contentWindow', { value: { postMessage: ( m, origin ) => said.push( [ m, origin ] ) } } );
		return { w, said };
	};

	it( 'says each ask to the frame, to this origin only', async () => {
		const layout = useLayoutStore();
		const { said } = framed();
		layout.askBar( 'share' );
		await nextTick();
		layout.askBar( 'faq' );
		await nextTick();
		expect( said ).toEqual( [ [ { rabbithole: 'bar', act: 'share' }, window.location.origin ], [ { rabbithole: 'bar', act: 'faq' }, window.location.origin ] ] );
	} );
	it( 'says nothing to a frame that is behind an article', async () => {
		const layout = useLayoutStore();
		const { said } = framed( { away: true } );
		layout.askBar( 'faq' );
		await nextTick();
		expect( said ).toEqual( [] );
	} );
} );

describe( 'the drawer\'s grip', () => {
	beforeEach( () => setActivePinia( createPinia() ) );

	it( 'folds the drawer and opens it, and says which it will do', async () => {
		const layout = useLayoutStore();
		const w = mount( DrawerGrip );
		const grip = w.find( 'button#drawer-grip' );
		expect( grip.attributes( 'aria-expanded' ) ).toBe( 'true' );
		expect( grip.attributes( 'aria-label' ) ).toBe( 'Fold the player away' );
		await grip.trigger( 'click' );
		expect( layout.isBar ? layout.collapsed : layout.minimized ).toBe( true );
		expect( grip.attributes( 'aria-expanded' ) ).toBe( 'false' );
		expect( grip.attributes( 'aria-label' ) ).toBe( 'Open the player' );
		await grip.trigger( 'click' );
		expect( layout.isBar ? layout.collapsed : layout.minimized ).toBe( false );
	} );
} );
