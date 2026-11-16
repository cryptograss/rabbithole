/**
 * What to do with a track you asked for while another one is playing.
 *
 * Justin, #rabbithole 15 Nov 2026, item 15: "What happens if you're already
 * listening in rabbithole and you click another 'play in rabbithole'? It
 * needs to pop up a dialogue with three options: 'play now', 'play next',
 * and 'chase to here' - and these all need to work."
 *
 * Nothing playing, nothing to interrupt: the track just plays, as it always
 * has. This store holds the question while it is being asked, and the name
 * of the song it is about once the wiki has told us, so the dialogue can
 * say what it is offering to play.
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

import * as wiki from '../wiki/api.js';

export const useListenStore = defineStore( 'listen', () => {
	/** The track being asked about: {cid, song, page} or null. */
	const asking = ref( null );
	/** What the last answer did, for the dialogue to report before it closes. */
	const said = ref( '' );

	/**
	 * Ask about a track. The song's name is filled in when the wiki answers;
	 * the dialogue is up before that, since the question does not wait on it.
	 *
	 * `via` is how the track was reached where that is known -- a road not
	 * taken in a connectome, which is a picker followed -- and it rides
	 * along so that answering "play now" keeps the word on the walk's hop
	 * (Justin, 15 Nov 2026, item 36: a play from a graph asks too).
	 */
	async function ask( cid, song = null, via = null ) {
		asking.value = { cid, song, page: song ? 'Song:' + song : null, via };
		said.value = '';
		if ( song ) {
			return;
		}
		const page = await wiki.songPageOf( cid, null ).catch( () => null );
		if ( asking.value && asking.value.cid === cid ) {
			asking.value = { cid, song: page ? page.replace( /^Song:/, '' ) : null, page, via };
		}
	}

	function close() {
		asking.value = null;
		said.value = '';
	}

	return { asking, said, ask, close };
} );
