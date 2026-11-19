/**
 * A picker's card, out of their page. Justin, #connectome, 18 Nov 2026: "an
 * info card of the picker with their image and the details in their
 * MusicianInfo template from their page, and a link to their pickipedia
 * page". And 19 Nov 2026, 03:15Z: "make the picture smaller, and include the
 * first three-or-so bullet items from their MusicianInfo template instance.
 * No need for 'instrument' on this card - we already see what instrument
 * they're playing right there in the player."
 *
 * So the card is the picture in their {{MusicianInfo}} box and the first
 * three things the box says they do (its does1, does2, does3), in the words
 * and links the wiki drew them with. The box's other rows stay on their page.
 */

/** How many of the things a picker does the card shows. */
export const DOES = 3;

/**
 * The page's own info box: the first wikitable straight inside the article;
 * failing that, the first one floated beside the text, which is how
 * {{PersonInfo}} sits when something wraps it.
 *
 * @param {Element} root
 * @return {Element|null}
 */
function boxIn( root ) {
	const own = [ ...root.children ].find( ( el ) => el.tagName === 'TABLE' && el.classList.contains( 'wikitable' ) );
	return own || [ ...root.querySelectorAll( 'table.wikitable' ) ].find( ( el ) => /float\s*:\s*right/.test( el.getAttribute( 'style' ) || '' ) ) || null;
}

/**
 * One of the things they do, as the wiki drew it, with a link to a page that
 * doesn't exist yet left as its words: in the player it would open an empty
 * edit form.
 *
 * @param {Element} li
 * @return {string}
 */
function lineOf( li ) {
	const line = li.cloneNode( true );
	for ( const a of line.querySelectorAll( 'a.new' ) ) {
		a.replaceWith( line.ownerDocument.createTextNode( a.textContent ) );
	}
	return line.innerHTML.trim();
}

/**
 * The card's picture and lines, out of the page's parsed HTML. Pure, given a
 * parser. The picture is null for a box with none (or no box); the lines are
 * [] for a page that says nothing of what they do.
 *
 * @param {string} html The page's parsed HTML.
 * @param {DOMParser} [parser]
 * @return {{picture: ({src: string, srcset: string, caption: string}|null), does: string[]}}
 */
export function cardFrom( html, parser = new DOMParser() ) {
	if ( ! html ) {
		return { picture: null, does: [] };
	}
	const doc = parser.parseFromString( html, 'text/html' );
	const root = doc.querySelector( '.mw-parser-output' ) || doc.body;
	const box = boxIn( root );
	// The picture heads the box, across both columns; an instrument's icon sits in a row of its own.
	const img = box && box.querySelector( 'figure img, th[colspan] img' );
	const caption = img && img.closest( 'figure' ) && img.closest( 'figure' ).querySelector( 'figcaption' );
	const picture = img && img.getAttribute( 'src' ) ? {
		src: img.getAttribute( 'src' ),
		srcset: img.getAttribute( 'srcset' ) || '',
		caption: caption ? caption.textContent.trim() : '',
	} : null;
	// What they do: {{PersonInfo}}'s list, the page's first.
	const list = root.querySelector( 'ul.thinkingentity-verbs' );
	const does = list ? [ ...list.children ].filter( ( el ) => el.tagName === 'LI' ).slice( 0, DOES ).map( lineOf ).filter( Boolean ) : [];
	return { picture, does };
}

const cards = new Map();

/**
 * A picker's card, fetched once a page load: a soloist comes round again
 * within one song. The title is their page's own, redirects followed: a
 * chart says "Justin Holmes" where the page, and the graph, say "Justin Myles
 * Holmes". With no page at all, the title is the name asked for, with no
 * picture and no lines.
 *
 * @param {string} name The name a chart gives them.
 * @param {Function} parsePage The wiki's parse, as api.js has it.
 * @return {Promise<{title: string, picture: (Object|null), does: string[]}>}
 */
export async function cardOf( name, parsePage ) {
	if ( ! cards.has( name ) ) {
		cards.set( name, parsePage( name )
			.then( ( p ) => ( { title: p.title || name, ...cardFrom( p.text || '' ) } ) )
			.catch( () => ( { title: name, picture: null, does: [] } ) ) );
	}
	return cards.get( name );
}
