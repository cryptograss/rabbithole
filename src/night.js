/*
 * Night: whether Rabbithole is by dark, and keeping <html> saying so.
 *
 * One choice, read everywhere. On the wiki the reader's switch keeps "dark"
 * or "light" in the cookie "pickipedia-mode" (pickipedia: PickiPediaContent's
 * night.js); posts and the connectome's graph read it, and Rabbithole is
 * served from the same origin, so it reads it too. With no choice made, or
 * on an origin that has no such cookie, the reader's system says.
 *
 * index.html marks <html> from the same two things before anything paints,
 * so a dark page never opens light. This module keeps the mark true
 * afterwards (the system can change at dusk with the app open) and gives
 * the rest of the app something to watch: the wiki pane puts night on its
 * shadow root, which a class on <html> cannot reach.
 *
 * What night looks like is src/styles/night.css.
 */

import { ref } from 'vue';

export const MODE_COOKIE = 'pickipedia-mode';
export const NIGHT_CLASS = 'rh-night';

/** The reader's choice in a cookie string: 'dark', 'light', or '' for none. */
export function chosen( cookies ) {
	const found = /(?:^|;\s*)pickipedia-mode=(dark|light)(?:;|$)/.exec( cookies || '' );
	return found ? found[ 1 ] : '';
}

/** Night or not: the choice if there is one, else the system. */
export function isNight( cookies, systemDark ) {
	const choice = chosen( cookies );
	return choice ? choice === 'dark' : !! systemDark;
}

/** True while Rabbithole is by dark. */
export const night = ref( false );

/**
 * Start following: set `night` and the class on <html> now, and again
 * whenever the system changes. Returns a function that stops.
 */
export function followNight( win = window ) {
	const doc = win.document;
	const system = win.matchMedia ? win.matchMedia( '(prefers-color-scheme: dark)' ) : null;
	const look = () => {
		night.value = isNight( doc.cookie, system && system.matches );
		doc.documentElement.classList.toggle( NIGHT_CLASS, night.value );
	};
	look();
	if ( ! system || ! system.addEventListener ) {
		return () => {};
	}
	system.addEventListener( 'change', look );
	return () => system.removeEventListener( 'change', look );
}
