#!/usr/bin/env node
/**
 * What did my saves touch? Every chart page (Release:<cid>/Metadata) a person
 * edited since a moment, and whether each ended where it started.
 *
 * Saving a chart needs a person signed in to PickiPedia, so the save test is
 * theirs to do. What went wrong on 8 Nov was silent: two saves from the
 * dropdown meant for Silver 44 wrote August's page, and nobody knew until
 * someone read the history. This reads the wiki and says, so nobody has to.
 *
 * The save test, on the live site, after a redeploy:
 *   1. Pick a song from the dropdown, open ✎ edit timeline, add a marker, Save.
 *   2. Delete that marker, Save again.
 *   3. npm run check:save -- <your wiki name> <when you started, ISO 8601>
 * Expect one page, the song you picked, and "back where it started".
 *
 * Read-only. Exits 1 if any chart page you touched didn't end where it started.
 */

const [ user, since ] = process.argv.slice( 2 );
const WIKI = process.env.RH_WIKI || 'https://pickipedia.xyz';
if ( ! user || ! since || isNaN( Date.parse( since ) ) ) {
	console.error( 'usage: npm run check:save -- <wiki user name> <since, e.g. 2026-11-08T18:00:00Z>' );
	process.exit( 2 );
}

async function api( params ) {
	const url = new URL( '/api.php', WIKI );
	url.search = new URLSearchParams( { format: 'json', formatversion: '2', ...params } );
	return ( await fetch( url, { headers: { 'User-Agent': 'rabbithole check-save' } } ) ).json();
}

const contribs = ( await api( { action: 'query', list: 'usercontribs', ucuser: user, uclimit: '500',
	ucend: new Date( since ).toISOString(), ucprop: 'ids|title|timestamp|comment' } ) ).query.usercontribs
	.filter( ( c ) => /^Release:.+\/Metadata$/.test( c.title ) );

if ( ! contribs.length ) {
	console.log( `${ user } edited no chart page since ${ since }.` );
	process.exit( 0 );
}

let changed = 0;
const pages = [ ...new Set( contribs.map( ( c ) => c.title ) ) ];
for ( const title of pages ) {
	const mine = contribs.filter( ( c ) => c.title === title ).sort( ( a, b ) => a.revid - b.revid );
	const before = mine[ 0 ].parentid;
	const ids = [ before, mine[ mine.length - 1 ].revid ].filter( Boolean );
	const revisions = ( await api( { action: 'query', prop: 'revisions', revids: ids.join( '|' ), rvprop: 'ids|sha1|user|timestamp' } ) )
		.query.pages[ 0 ].revisions;
	const sha = ( id ) => ( revisions.find( ( r ) => r.revid === id ) || {} ).sha1;
	const now = ( await api( { action: 'query', prop: 'revisions', titles: title, rvprop: 'ids|user', rvlimit: '1' } ) )
		.query.pages[ 0 ].revisions[ 0 ];
	const back = before && sha( before ) === sha( mine[ mine.length - 1 ].revid );
	if ( ! back ) {
		changed++;
	}
	console.log( `${ title }\n  ${ mine.length } edit${ mine.length === 1 ? '' : 's' } by ${ user }: revisions ${ mine.map( ( c ) => c.revid ).join( ', ' ) }`
		+ `\n  ${ back ? 'back where it started' : before ? 'NOT back where it started' : 'new page' } (before: revision ${ before || 'none' })`
		+ ( now.revid !== mine[ mine.length - 1 ].revid ? `\n  edited since by ${ now.user } (revision ${ now.revid })` : '' ) );
}
console.log( `${ pages.length } chart page${ pages.length === 1 ? '' : 's' } touched; ${ changed ? `${ changed } not back where ${ changed === 1 ? 'it' : 'they' } started` : 'all back where they started' }.` );
process.exit( changed ? 1 : 0 );
