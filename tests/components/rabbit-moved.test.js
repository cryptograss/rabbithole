// @vitest-environment happy-dom
/**
 * What the rabbit's move says, and what it doesn't.
 *
 * Justin, #connectome, 22 Nov 2026: "We see ['Nobody on this song has
 * another to lead to. Next is the rabbithole's own pick: <track>'] all
 * the time now. It's not needed; I say nix it. We don't have enough
 * material yet for there to be a meaningful way for there to be long
 * sequence of songs. When we do, we'll figure out how to communicate
 * this."
 *
 * The picker store is a stub: this is about the words, not about where
 * the rabbit goes (that is stores/rabbit-moves.test.js).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive } from 'vue';

vi.mock( '../../src/stores/picker.js', () => ( { usePickerStore: () => globalThis.__picker } ) );

import RabbitMoved from '../../src/components/RabbitMoved.vue';

/** The words the move says, as a reader reads them (nothing, if it says none). */
const said = ( m ) => {
	globalThis.__picker.moved = m;
	const w = mount( RabbitMoved );
	const line = w.find( '.rabbit-moved' );
	return line.exists() ? w.find( '.rabbit-moved-says' ).text().replace( '🐇 ', '' ) : '';
};

describe( 'what the rabbit\'s move says', () => {
	beforeEach( () => {
		globalThis.__picker = reactive( { moved: null, heardMoved: vi.fn() } );
	} );

	it( 'nothing while there is no move, and nothing of the rabbithole\'s own pick: the song just comes on', () => {
		expect( said( null ) ).toBe( '' );
		expect( said( { from: null, to: null, song: "Reuben's Train", cid: 'QmReuben' } ) ).toBe( '' );
		expect( said( { from: 'Harry Clark', to: null, song: "Reuben's Train", cid: 'QmReuben' } ) ).toBe( '' );
	} );

	it( 'who ran out and who the rabbit is on now, with the song that follows', () => {
		expect( said( { from: 'Harry Clark', to: 'Cory Walker', song: "Song:Barlow's Jig", cid: 'QmJig' } ) )
			.toBe( "Harry Clark has no more songs to play here. The rabbit is on Cory Walker now, for Barlow's Jig." );
	} );

	it( 'that the music stops here, whoever was chased or not', () => {
		expect( said( { from: null, to: null, song: null, cid: null } ) ).toBe(
			'Nobody on this song has another to lead to, and nothing else is ready to follow this one.'
		);
		expect( said( { from: 'Harry Clark', to: null, song: null, cid: null } ) ).toBe(
			'Harry Clark has no more songs to play here, and nothing else is ready to follow this one.'
		);
	} );
} );