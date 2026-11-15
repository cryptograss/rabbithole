/**
 * A soundcheck: every light the ensemble has, in fifty seconds.
 *
 * The effects belong to moments in particular songs -- the one spotlight
 * on the wiki is a minute and eleven seconds into Paint Exchange -- so
 * looking at them all meant knowing where each one was and waiting for
 * it. This is a chart with one of everything, written for whoever is on
 * the song that is loaded: put `?soundcheck` on a development address
 * and the song plays as it always does, with this chart laid over it in
 * place of its own.
 *
 * Only where the app is being developed (the song store asks
 * import.meta.env.DEV): on the wiki the editor saves the chart it is
 * shown, and this one is not the song's.
 */

/**
 * The chart, for a band in the order its cards stand.
 *
 * @param {string[]} band At least three names; six shows everything.
 * @return {Object} A timeline, in seconds.
 */
export function soundcheckTimeline( band ) {
	const [ first, second, third ] = band;
	const fourth = band[ 3 ] || first;
	const fifth = band[ 4 ] || second;
	// The singer is whoever stands last, so that stepping to the front is
	// a walk and not a shuffle.
	const singer = band[ band.length - 1 ];
	const rest = Object.fromEntries( band.slice( 1 ).map( ( name ) => [ name, 'out' ] ) );

	return {
		// One picker alone, and then the band comes in down the list.
		0: { part: 'intro', musicians: { [ first ]: 'in', ...rest } },
		3: { part: 'intro', musicians: { band: 'in' } },
		// A break, and the break handed on.
		6: { part: 'A', solo: second },
		10: { part: 'A', solo: third },
		// A pickup two seconds long, into the break it leads to.
		14: { part: 'A', solo: third, pickup: fourth },
		16: { part: 'B', solo: fourth },
		// A flourish behind somebody else's break.
		19: { part: 'B', solo: fourth, flourish: fifth, flourishDuration: 2.4 },
		// A verse: the singer steps to the front, and stays there.
		23: { part: 'A', solo: singer, instrumentChanges: { [ singer ]: 'vocals' } },
		28: { part: 'A', solo: second },
		// The whole band at once.
		31: { part: 'B', solo: second, bandFlash: true, bandFlashDuration: 1.6 },
		// The spotlight, a second into a break.
		34: { part: 'B', solo: third },
		35: { part: 'B', solo: third, spotlight: third, spotlightBlackout: 4.5, spotlightGlow: 3 },
		// Two drop out; one comes back.
		44: { part: 'A', musicians: { [ fourth ]: 'out', [ fifth ]: 'out' } },
		47: { part: 'A', musicians: { [ fifth ]: 'in' } },
		50: { part: 'outro' },
	};
}

/** Lay the soundcheck over a song, in place of its own chart. */
export function soundcheck( song ) {
	const band = Object.keys( song.ensemble || {} );
	if ( band.length < 3 ) {
		return song;
	}
	song.timeline = soundcheckTimeline( band );
	delete song.standardSectionLength;
	return song;
}
