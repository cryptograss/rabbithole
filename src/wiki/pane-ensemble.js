/**
 * The chased picker, marked in the page's own ensemble.
 *
 * A Song: page's Studio cut box lists who played on the cut, one player a
 * row, from [[Module:Studio sessions]]: a .pp-players grid of
 * .pp-players-who and .pp-players-what cells. While a chase is on, that
 * picker's row is marked there as well as on their card in the dock,
 * because the box is where the reader is looking (Justin's item 25,
 * 15 Nov 2026).
 *
 * A pure function over the wiki's HTML, run again whenever the chase
 * changes, rather than the rendered DOM being reached into and put back.
 */

import { titleFromHref } from './pane-links.js';

/** Does this link name the person? Its title, else the page its href names. */
function names( link, person ) {
	const title = link.getAttribute( 'title' );
	if ( title && title === person ) {
		return true;
	}
	return titleFromHref( link.getAttribute( 'href' ) ) === person;
}

/**
 * The wiki's HTML with the chased picker's row in the ensemble marked: a
 * class on both cells of their row, and the word beside their name.
 *
 * Pure. The HTML comes back unchanged when nobody is being chased, when
 * the page has no ensemble, or when the ensemble does not name them.
 *
 * @param {string} html The article, as the wiki parsed it.
 * @param {?string} person Who is being chased, by their page's title.
 * @return {string} The article, marked.
 */
export function markChased( html, person ) {
	if ( ! html || ! person || ! html.includes( 'pp-players-who' ) ) {
		return html;
	}
	const doc = new DOMParser().parseFromString( html, 'text/html' );
	let marked = false;
	for ( const who of doc.querySelectorAll( '.pp-players-who' ) ) {
		const link = who.querySelector( 'a[href]' );
		if ( ! link || ! names( link, person ) ) {
			continue;
		}
		who.classList.add( 'pp-players-chased' );
		const word = doc.createElement( 'span' );
		word.className = 'pp-players-chasing';
		word.textContent = 'Chasing';
		who.append( word );
		const what = who.nextElementSibling;
		if ( what && what.classList.contains( 'pp-players-what' ) ) {
			what.classList.add( 'pp-players-chased' );
		}
		marked = true;
	}
	return marked ? doc.body.innerHTML : html;
}
