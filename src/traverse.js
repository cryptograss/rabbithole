/**
 * Traverse mode: where the information pane belongs, moment by moment.
 *
 * The rule is one sentence -- the pane shows the page this moment of the
 * music is about -- and it is a pure function of four things, so it is
 * written here rather than inside a watcher.
 *
 * Whoever is taking it is what the moment is about; when nobody is, the
 * track itself is, so the pane goes back to the song's own page (Justin's
 * item 18, #rabbithole, 15 Nov 2026: "If there's a section in the song
 * where nobody is soloing, but traverse mode is on, then go back to the
 * Song page"). A paused song is about nothing: whoever is reading keeps
 * reading, which is why loading a song does not carry the pane off before
 * a note has played.
 *
 * @param {Object} moment
 * @param {boolean} moment.trackChanged A different recording than last time.
 * @param {boolean} moment.playing The audio is running.
 * @param {?string} moment.solo Who is taking it now, if anybody.
 * @param {?string} moment.lastSolo Who was taking it a moment ago.
 * @return {'song'|'person'|null} The song's page, the soloist's, or stay put.
 */
export function traverseTo( { trackChanged = false, playing = false, solo = null, lastSolo = null } = {} ) {
	if ( trackChanged ) {
		return 'song';
	}
	if ( ! playing ) {
		return null;
	}
	if ( solo ) {
		return 'person';
	}
	// Nobody is taking it. Worth a move only if somebody just was: an
	// intro that nobody solos is already on the song's page, and moving
	// there again would push a second entry onto the history.
	return lastSolo ? 'song' : null;
}

/** Traverse mode's rocker, left to right (Justin, #connectome, 18 Nov 2026): bacon graphs, off, PickiPedia pages. */
export const TRAVERSE_MODES = [ 'bacon', 'off', 'pages' ];

/**
 * Where traverse mode's bacon graph goes: the song on now, in its own graph; or whoever is taking it, in the
 * middle of theirs, with the song beside them (pickipedia:blu/bacon-traverse reads both). Pure.
 *
 * @param {?string} cid The track on now.
 * @param {?string} solo Who is taking it, if anybody.
 * @return {?string} The graph's address, or null with no track.
 */
export function baconAddress( cid, solo = null ) {
	if ( ! cid ) {
		return null;
	}
	return '?' + new URLSearchParams( solo ? { p: solo, playing: cid } : { cut: cid } );
}

/**
 * Is Back or Forward onto this entry of the history coming back to where
 * the music had the pane?
 *
 * Justin, #connectome, 20 Nov 2026: "If someone turns traverse off by
 * navigating, but then uses 'back' to get all the way back to where they
 * were when traverse was on, it needs to turn back on, whether they're
 * going all the way back to the song node, or if they departed traverse on
 * a picker."
 *
 * An entry written while traverse mode was on is the music's, and says so
 * (`music`, written by the pane store). Coming onto one with traverse mode
 * off because the reader went somewhere (`resume` holds what it was) is
 * coming back: it turns on again as it was, and the pane goes where the
 * music is now. Set off on the rocker, there is nothing to resume, and it
 * stays off; already on, Back is the reader steering, as it was. Pure.
 *
 * @param {?Object} state The entry's state.
 * @param {Object} now
 * @param {string} now.traverse Traverse mode now.
 * @param {?string} now.resume What it was before the reader went somewhere, if they did.
 * @param {boolean} now.standing Whether a song stands for the pane to travel with.
 * @return {boolean}
 */
export function comesBackToTheMusic( state, { traverse, resume, standing } ) {
	return !! ( state && state.music ) && traverse === 'off' && TRAVERSE_MODES.includes( resume ) && resume !== 'off' && !! standing;
}
