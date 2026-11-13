/**
 * Who is signed in to PickiPedia, said where it can be seen.
 *
 * A chart is saved to the wiki as whoever this browser is signed in as,
 * and nothing on the player said who that was, or that it was nobody, until
 * Save. Skyler asked to see the user name in the corner (#rabbithole,
 * 13 Nov 2026), after losing work the night before.
 *
 * The answer can change behind the app's back: a login in another tab, a
 * session that runs out. So it is asked again whenever the tab comes back
 * into view, and when a save finds nobody signed in.
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

import { signedInAs } from '../wiki/api.js';

export const useAccountStore = defineStore( 'account', () => {
	/** The user name; null when nobody is signed in; undefined until asked. */
	const name = ref( undefined );

	async function refresh() {
		try {
			name.value = await signedInAs();
		} catch ( err ) {
			// The wiki didn't answer: say nothing rather than something wrong.
			name.value = undefined;
		}
	}

	if ( typeof document !== 'undefined' ) {
		document.addEventListener( 'visibilitychange', () => {
			if ( document.visibilityState === 'visible' ) {
				refresh();
			}
		} );
	}

	return { name, refresh };
} );
