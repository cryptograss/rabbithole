/**
 * Chasing a picker, as it reads in the pane.
 *
 * "Follow" read as the social-media kind: press it and you are subscribed
 * to a person. What it does is play the songs they are on, one after
 * another, so it is a chase, and the rabbit is already doing the chasing
 * (Justin and Skyler, #rabbithole, 13 Nov 2026).
 *
 * Two shapes, and never both:
 *  - not chasing them: one line offering to, on their page.
 *  - chasing them: a pill beside their name in the title. It was a box
 *    above the title, two lines of warning-coloured text for something
 *    the reader chose (Justin's point 13).
 *
 * The next song is not named here. The offer named it ("First up: …"),
 * which took the line to two and told you something you had not asked
 * (point 10); the queue says what plays next, as it does for everything
 * else.
 *
 * Pure: HTML in, no DOM, no stores. The pane puts it where it goes.
 */

import { escapeHtml } from './pane-html.js';

/** What a person is called when they are being spoken to, not about. */
export function firstName( name ) {
	return String( name ).split( ' ' )[ 0 ];
}

/**
 * The offer, for a picker's page when they are not being chased: one line.
 * Null when there is nothing of theirs left to play, so a page with
 * nothing to offer says nothing at all.
 */
export function chaseOfferHtml( offer ) {
	if ( ! offer || ! offer.next ) {
		return null;
	}
	const name = escapeHtml( offer.name );
	const first = escapeHtml( firstName( offer.name ) );
	return '<div class="pp-chase">🐇 Keep playing the songs <strong>' + name + '</strong> is on, '
		+ 'one after another.<button data-chase="' + name + '" class="pp-chase-go">Chase ' + first + '</button></div>';
}

/**
 * The pill that goes beside their name in the title while they are being
 * chased. It is the way to stop, so it says so when you point at it.
 */
export function chasePillHtml( name ) {
	const first = escapeHtml( firstName( name ) );
	return '<button data-unchase="1" class="pp-chasing" title="Stop chasing ' + escapeHtml( name )
		+ '">🐇 chasing<span class="pp-chasing-stop"> — stop</span></button>';
}

/**
 * The styles for both, as a sheet of their own. The pane puts it in after
 * the wiki's: these belong to the chase, not to the article, and keeping
 * them here means pane-html.js never has to know the chase exists.
 */
export const CHASE_STYLES = [
	'<style>',
	'.pp-chase { margin: .6em 0; padding: .45em .7em; border: 1px solid #c9d3c3;',
	'  border-left: 4px solid #4a7c59; background: #f6f8f4; font-size: 13px;',
	'  line-height: 1.5; display: flex; align-items: center; gap: .6em; }',
	'.pp-chase-go { margin-left: auto; flex: 0 0 auto; padding: .15em .8em;',
	'  border: 1px solid #4a7c59; border-radius: 4px; background: #4a7c59;',
	'  color: #fff; font-size: 12px; cursor: pointer; }',
	// Beside the title, at the title's size: a quiet green pill, not a
	// warning. It grows " — stop" when pointed at, so what it does is
	// never a surprise and never in the way.
	'.pp-chasing { vertical-align: middle; margin-left: .5em; padding: .1em .6em;',
	'  border: 1px solid #b7cdb0; border-radius: 999px; background: #eef5ea;',
	'  color: #2d5016; font-size: 12px; font-weight: 600; line-height: 1.6;',
	'  font-family: inherit; cursor: pointer; }',
	'.pp-chasing:hover { background: #dfeed6; border-color: #4a7c59; }',
	'.pp-chasing-stop { display: none; }',
	'.pp-chasing:hover .pp-chasing-stop { display: inline; }',
	'</style>',
].join( '' );
