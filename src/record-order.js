/**
 * A whole record, from ?record=<cid>: what plays first and what follows.
 *
 * Justin, #pickipedia-style-and-main-page, 13 Nov 2026: a link that plays a
 * record, not one track of it. The record's Release page lists its tracks;
 * the first plays and the rest line up after it in Webamp's playlist, in
 * running order. A reload names the track that was playing (the app writes
 * ?track= as it goes), so the record picks up from there, not from the top.
 */

/**
 * The record's track CIDs in running order, starting at `fromCid` if the
 * record holds it, else at its first track.
 *
 * @param {Array<{cid: string, track_number?: number}>} tracks
 * @param {string|null} fromCid
 * @return {string[]}
 */
export function runningOrderFrom( tracks, fromCid = null ) {
	const cids = ( Array.isArray( tracks ) ? tracks : [] )
		.filter( ( t ) => t && t.cid )
		.map( ( t, i ) => ( { cid: t.cid, n: Number( t.track_number ) || i + 1 } ) )
		.sort( ( a, b ) => a.n - b.n )
		.map( ( t ) => t.cid );
	const start = fromCid ? cids.indexOf( fromCid ) : -1;
	return start > 0 ? cids.slice( start ) : cids;
}
