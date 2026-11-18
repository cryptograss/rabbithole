/**
 * A picker's card, out of their page (Justin, #connectome, 18 Nov 2026: "an
 * info card of the picker with their image and the details in their
 * MusicianInfo template from their page, and a link to their pickipedia
 * page"): the box {{MusicianInfo}} draws -- {{PersonInfo}}'s table, the first
 * thing of its kind in the page's own words -- as the wiki drew it. Nothing
 * is read out of it or written into it: the page says what it says.
 */

/**
 * The page's own info box, as HTML, or '' where it has none.
 *
 * Pure, given a parser. The box is the first wikitable straight inside the
 * article; failing that, the first one floated beside the text, which is how
 * {{PersonInfo}} sits.
 *
 * @param {string} html The page's parsed HTML.
 * @param {DOMParser} [parser]
 * @return {string}
 */
export function infoboxOf( html, parser = new DOMParser() ) {
	if ( ! html ) {
		return '';
	}
	const doc = parser.parseFromString( html, 'text/html' );
	const root = doc.querySelector( '.mw-parser-output' ) || doc.body;
	const own = [ ...root.children ].find( ( el ) => el.tagName === 'TABLE' && el.classList.contains( 'wikitable' ) );
	const box = own || [ ...root.querySelectorAll( 'table.wikitable' ) ].find( ( el ) => /float\s*:\s*right/.test( el.getAttribute( 'style' ) || '' ) );
	return box ? box.outerHTML : '';
}

const cards = new Map();

/**
 * A picker's card, fetched once a page load: a soloist comes round again
 * within one song. The title is their page's own, redirects followed: a
 * chart says "Justin Holmes" where the page, and the graph, say "Justin Myles
 * Holmes". The box is '' for a page with none; the title is the name asked
 * for when there is no page at all.
 *
 * @param {string} name The name a chart gives them.
 * @param {Function} parsePage The wiki's parse, as api.js has it.
 * @return {Promise<{title: string, box: string}>}
 */
export async function cardOf( name, parsePage ) {
	if ( ! cards.has( name ) ) {
		cards.set( name, parsePage( name )
			.then( ( p ) => ( { title: p.title || name, box: infoboxOf( p.text || '' ) } ) )
			.catch( () => ( { title: name, box: '' } ) ) );
	}
	return cards.get( name );
}
