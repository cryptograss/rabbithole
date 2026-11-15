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
