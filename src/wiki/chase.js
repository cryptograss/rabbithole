/**
 * Chasing a picker: the word, and what a person is called while it is on.
 *
 * "Follow" read as the social-media kind: press it and you are subscribed
 * to a person. What it does is play the songs they are on, one after
 * another, so it is a chase, and the rabbit is already doing the chasing
 * (Justin and Skyler, #rabbithole, 13 Nov 2026).
 *
 * The two shapes it takes in the pane -- the offer on a picker's page, the
 * pill beside their name while they are being chased -- are components
 * now: PaneChaseOffer.vue and PaneChasePill.vue, with their styles in
 * src/styles/pane-chase.css. This module built both as strings, and their
 * stylesheet as an array of strings, until 14 Nov 2026.
 */

/** What a person is called when they are being spoken to, not about. */
export function firstName( name ) {
	return String( name ).split( ' ' )[ 0 ];
}
