/**
 * PickiPedia, as Rabbithole reads and writes it.
 *
 * Every request is a relative path: in production the app is served from
 * the wiki's own origin, and in development Vite proxies the same paths
 * there. Nothing here holds state and nothing here touches the DOM, apart
 * from pickEncoding asking an <audio> what it can play.
 */

import jsYaml from 'js-yaml';

export const IPFS_GATEWAY = 'https://ipfs.delivery-kid.cryptograss.live';

const api = ( params, init ) => fetch( '/api.php?' + new URLSearchParams( { format: 'json', origin: '*', ...params } ), init )
	.then( ( r ) => {
		if ( ! r.ok ) {
			throw new Error( `PickiPedia answered ${ r.status }` );
		}
		return r.json();
	} );

/** The YAML on a page, parsed, or null when there is no such page. */
export async function fetchYamlPage( title, { signal } = {} ) {
	const j = await api( {
		action: 'query', titles: title, prop: 'revisions', rvprop: 'content', rvslots: 'main',
	}, { signal } );
	const page = Object.values( j.query?.pages || {} )[ 0 ];
	if ( ! page || page.missing !== undefined ) {
		return null;
	}
	const text = page.revisions?.[ 0 ]?.slots?.main?.[ '*' ] || '';
	return jsYaml.load( text ) || {};
}

/** Whether a page exists. */
export async function pageExists( title ) {
	const j = await api( { action: 'query', titles: title } );
	const page = Object.values( j.query?.pages || {} )[ 0 ];
	return !! page && page.missing === undefined;
}

/**
 * Ensemble, timeline and the rest out of a metadata page, in either of
 * the two shapes it comes in: flat (what the editor saves) or arthel's
 * studio_versions tree (what gets pasted from a song's YAML).
 */
export function extractMetadata( data ) {
	if ( ! data || typeof data !== 'object' ) {
		return {};
	}
	if ( data.timeline || data.ensemble ) {
		return {
			ensemble: data.ensemble || {},
			timeline: data.timeline || {},
			standardSectionLength: data.standardSectionLength,
			title: data.title,
			album: data.album,
			record: data.record,
			studio: data.studio,
			sessionType: data[ 'session-type' ] || data.sessionType,
			engineer: data.engineer,
		};
	}
	const versions = data.studio_versions;
	if ( versions && typeof versions === 'object' ) {
		const first = versions[ Object.keys( versions )[ 0 ] ];
		if ( first && typeof first === 'object' ) {
			const releaseKey = Object.keys( first )[ 0 ];
			const release = first[ releaseKey ];
			if ( release && typeof release === 'object' ) {
				const rh = release.rabbithole || {};
				return {
					ensemble: release.ensemble || {},
					timeline: rh.timeline || {},
					standardSectionLength: rh.standardSectionLength,
					title: releaseKey,
					album: releaseKey,
					record: release.record,
					studio: release.studio,
					sessionType: release[ 'session-type' ],
					engineer: release.engineer,
				};
			}
		}
	}
	return {};
}

/**
 * Which encoding this browser can decode.
 *
 * Every Release carries ogg and flac. Ogg is a quarter the size, so it is
 * the default; Safari went most of its life unable to decode Ogg Vorbis
 * and plays silence without saying why, and FLAC it has handled since
 * Safari 11. So ask the browser: "probably" or "maybe" is the only claim
 * either of us has. ?enc=flac or ?enc=ogg forces one, for telling a
 * decoding fault apart from everything else.
 */
export function pickEncoding( encodings, { forced = null, canPlay = defaultCanPlay } = {} ) {
	if ( ! encodings ) {
		return null;
	}
	if ( forced && encodings[ forced ] ) {
		return { cid: encodings[ forced ], format: forced };
	}
	if ( encodings.ogg && canPlay( 'audio/ogg; codecs="vorbis"' ) ) {
		return { cid: encodings.ogg, format: 'ogg' };
	}
	if ( encodings.flac && canPlay( 'audio/flac' ) ) {
		return { cid: encodings.flac, format: 'flac' };
	}
	if ( encodings.ogg ) {
		console.warn( 'This browser claims it can play neither ogg nor flac; trying ogg anyway.' );
		return { cid: encodings.ogg, format: 'ogg' };
	}
	return null;
}

function defaultCanPlay( type ) {
	if ( typeof document === 'undefined' ) {
		return true;
	}
	const verdict = document.createElement( 'audio' ).canPlayType( type );
	return verdict === 'probably' || verdict === 'maybe';
}

/**
 * The audio file in an upload's folder, as "<cid>/<name>", or null.
 *
 * A song uploaded on its own (Special:DeliverOtherContent) is pinned as a
 * folder: the file as it was uploaded, and a metadata.json. Its Release has
 * no encodings, since only albums are transcoded, so Rabbithole said "no
 * encoding this browser can play" and played nothing: Reuben's Train from
 * Web3 Summit 2024 (Skyler and Justin, 11 Nov 2026). The folder's listing
 * on the gateway names the file; this reads it from that page.
 */
export function audioInFolder( html, cid ) {
	const prefix = '/ipfs/' + cid + '/';
	for ( const [ , href ] of String( html ).matchAll( /href="([^"]+)"/g ) ) {
		if ( href.startsWith( prefix ) && /\.(mp3|ogg|oga|flac|wav|m4a|aac|opus)$/i.test( href ) ) {
			return href.slice( '/ipfs/'.length );
		}
	}
	return null;
}

async function lonePlayable( release, cid, { signal } = {} ) {
	if ( ! /^audio\//.test( release.file_type || '' ) ) {
		return null;
	}
	// Some are pinned as the bare file (Barlow's Jig with David Grier), so
	// ask what the CID is before reading it as a folder.
	const url = IPFS_GATEWAY + '/ipfs/' + cid + '/';
	const head = await fetch( url, { method: 'HEAD', signal } );
	if ( /^audio\//.test( head.headers.get( 'content-type' ) || '' ) ) {
		return cid;
	}
	const r = await fetch( url, { signal } );
	return r.ok ? audioInFolder( await r.text(), cid ) : null;
}

/**
 * A track, ready to play: its Release page and its /Metadata page, folded
 * into the one object the player and the editor work on.
 */
export async function loadTrack( cid, { forcedEncoding = null, signal } = {} ) {
	const release = await fetchYamlPage( 'Release:' + cid, { signal } );
	if ( ! release ) {
		throw new Error( 'Track Release page not found: ' + cid );
	}
	const metadata = extractMetadata( await fetchYamlPage( 'Release:' + cid + '/Metadata', { signal } ) || {} );
	const encoding = pickEncoding( release.encodings, { forced: forcedEncoding } )
		|| await lonePlayable( release, cid, { signal } ).then( ( path ) => path && { cid: path, format: 'file' } );
	if ( ! encoding ) {
		throw new Error( 'Track has no encoding this browser can play' );
	}
	return {
		title: release.title || metadata.title || cid,
		album: release.parent_release || metadata.album || '',
		duration: release.duration || 180,
		audioFile: IPFS_GATEWAY + '/ipfs/' + encoding.cid,
		ensemble: metadata.ensemble || {},
		timeline: metadata.timeline || {},
		standardSectionLength: metadata.standardSectionLength,
		engineer: metadata.engineer,
		_trackCid: cid,
		_metadataTitle: 'Release:' + cid + '/Metadata',
		_releaseTitle: 'Release:' + cid,
		_record: metadata.record,
		_studio: metadata.studio,
		_sessionType: metadata.sessionType,
		_engineer: metadata.engineer,
	};
}

/** Every page named, as {title: wikitext}, fifty titles to a request (the API's limit). */
async function pageTexts( titles ) {
	const texts = {};
	for ( let i = 0; i < titles.length; i += 50 ) {
		const j = await api( {
			action: 'query', titles: titles.slice( i, i + 50 ).join( '|' ),
			prop: 'revisions', rvprop: 'content', rvslots: 'main',
		} );
		for ( const page of Object.values( j.query?.pages || {} ) ) {
			const text = page.revisions?.[ 0 ]?.slots?.main?.[ '*' ];
			if ( text !== undefined ) {
				texts[ page.title ] = text;
			}
		}
	}
	return texts;
}

/** Whether a metadata page has a chart: a timeline with more than one entry. */
export function isCharted( metadataText ) {
	let data;
	try {
		data = jsYaml.load( metadataText );
	} catch {
		return false;
	}
	const timeline = extractMetadata( data ).timeline;
	return !! timeline && typeof timeline === 'object' && Object.keys( timeline ).length > 1;
}

/**
 * Every track with a chart on the wiki, as {cid, title, album}, by album
 * then title: the song selector's list. A song is on it once its
 * /Metadata page has a timeline, so charting a song is what puts it there.
 */
export async function chartedTracks() {
	const metadataTitles = [];
	let from;
	do {
		const j = await api( {
			action: 'query', list: 'allpages', apnamespace: 3004, aplimit: 500, ...( from ? { apcontinue: from } : {} ),
		} );
		for ( const p of j.query?.allpages || [] ) {
			if ( p.title.endsWith( '/Metadata' ) ) {
				metadataTitles.push( p.title );
			}
		}
		from = j.continue?.apcontinue;
	} while ( from );

	const metadata = await pageTexts( metadataTitles );
	const cids = metadataTitles.filter( ( t ) => metadata[ t ] && isCharted( metadata[ t ] ) )
		.map( ( t ) => t.slice( 'Release:'.length, -'/Metadata'.length ) );

	const load = ( text ) => {
		try {
			return jsYaml.load( text ) || {};
		} catch {
			return {};
		}
	};
	const releases = await pageTexts( cids.map( ( cid ) => 'Release:' + cid ) );
	const tracks = cids.map( ( cid ) => ( { cid, release: load( releases[ 'Release:' + cid ] || '' ) } ) );
	const parents = [ ...new Set( tracks.map( ( t ) => t.release.parent_release ).filter( Boolean ) ) ];
	const albums = await pageTexts( parents.map( ( cid ) => 'Release:' + cid ) );

	return tracks.map( ( { cid, release } ) => ( {
		cid,
		title: release.title || cid,
		album: ( release.parent_release && load( albums[ 'Release:' + release.parent_release ] || '' ).title ) || '',
	} ) ).sort( ( a, b ) => a.album.localeCompare( b.album ) || a.title.localeCompare( b.title ) );
}

/** The record a track belongs to: title and running order, from the parent Release. */
export async function loadAlbum( parentCid ) {
	if ( ! parentCid ) {
		return null;
	}
	const album = await fetchYamlPage( 'Release:' + parentCid );
	if ( ! album || ! Array.isArray( album.tracks ) ) {
		return null;
	}
	return { cid: parentCid, title: album.title || '', tracks: album.tracks };
}

/**
 * Cover art, the long way round, because the release schema has no field
 * for it: the record page links to the release, so the backlink finds the
 * record page, and its first image that is not an instrument icon is the
 * cover. Returns a same-origin path, since the wiki answers with URLs built
 * from its own $wgServer. The honest fix is an art field on the release.
 */
export async function findAlbumArt( parentCid ) {
	const back = await api( { action: 'query', list: 'backlinks', bltitle: 'Release:' + parentCid, blnamespace: '0', bllimit: '5' } );
	const recordPage = back.query?.backlinks?.[ 0 ]?.title;
	if ( ! recordPage ) {
		return null;
	}
	const imgs = await api( { action: 'query', titles: recordPage, prop: 'images', imlimit: '50' } );
	const candidates = ( Object.values( imgs.query?.pages || {} )[ 0 ]?.images || [] )
		.map( ( i ) => i.title )
		.filter( ( t ) => ! /Instrument-icon-/i.test( t ) );
	if ( ! candidates.length ) {
		return null;
	}
	const info = await api( { action: 'query', titles: candidates[ 0 ], prop: 'imageinfo', iiprop: 'url|size', iiurlwidth: '96' } );
	const ii = Object.values( info.query?.pages || {} )[ 0 ]?.imageinfo?.[ 0 ];
	if ( ! ii ) {
		return null;
	}
	return sameOrigin( ii.thumburl || ii.url || null );
}

export function sameOrigin( url ) {
	if ( ! url ) {
		return null;
	}
	try {
		const u = new URL( url, typeof window !== 'undefined' ? window.location.href : 'https://pickipedia.xyz/' );
		return u.pathname + u.search;
	} catch ( err ) {
		return url;
	}
}

/** A page's parsed HTML and display title, for the pane. Redirects are followed: a musician's page, not "Redirect to:". */
export async function parsePage( title, { signal } = {} ) {
	const data = await api( { action: 'parse', page: title, prop: 'text|displaytitle', formatversion: '2', redirects: '1' }, { signal } );
	if ( ! data.parse ) {
		throw new Error( data.error?.info || 'no such page' );
	}
	return data.parse;
}

/** Full-text search hits: [{title, snippet}]. */
export async function search( text ) {
	const data = await api( { action: 'query', list: 'search', srsearch: text, srlimit: '15', formatversion: '2' } );
	return data.query?.search || [];
}

/**
 * The performer graph's raw results, for trail.js's buildGraph.
 *
 * Two kinds of subobject come back, both from {{Studio cut}}: one per
 * musician (Has cut, Has performer, Has instrument) and one per appearance
 * (Has cut, Has record). They share the cut, and buildGraph joins them, so
 * each credit knows which record it is on. Without that, Harry Clark's
 * Vowel Sounds cut of Barlow's Jig led to the 4masks recording, which he
 * is not on (Justin, 11 Nov 2026).
 */
export async function performerResults() {
	const d = await api( {
		action: 'ask',
		query: '[[Has performer::+]] OR [[Has record::+]]|?Has cut|?Has performer|?Has instrument|?Has record|limit=1000',
	} );
	return d.query && d.query.results;
}

const recordsForCid = {};

/**
 * The names the record a track is on goes by: the record page that carries
 * its parent Release ({{Record release}} on [[4masks]] names
 * Release:QmUWtV…, so the backlink finds the page, as findAlbumArt does),
 * and the Release's own title ("Justin Myles Holmes - 4masks (RC1)"). The
 * Studio cut credits name the record page, so that is the one that matters.
 * Empty when the track stands alone or nobody can say. Asked once per CID.
 */
export function recordsOf( cid ) {
	if ( recordsForCid[ cid ] === undefined ) {
		recordsForCid[ cid ] = ( async () => {
			try {
				const release = await fetchYamlPage( 'Release:' + cid );
				if ( ! release || ! release.parent_release ) {
					return [];
				}
				const parent = 'Release:' + release.parent_release;
				const [ album, back ] = await Promise.all( [
					fetchYamlPage( parent ),
					api( { action: 'query', list: 'backlinks', bltitle: parent, blnamespace: '0', bllimit: '5' } ),
				] );
				const names = ( back.query?.backlinks || [] ).map( ( b ) => b.title );
				if ( album && album.title ) {
					names.push( album.title );
				}
				return names;
			} catch ( err ) {
				return [];
			}
		} )();
	}
	return recordsForCid[ cid ];
}

/**
 * The track CID a song page carries, read off its own listen button.
 * Nothing on the wiki says "this composition was released as that CID";
 * the button a person put the CID into is the edge, for now.
 */
export async function trackCidForSong( songTitle ) {
	try {
		const data = await api( { action: 'parse', page: songTitle, prop: 'text', formatversion: '2' } );
		const html = data.parse && data.parse.text;
		const match = html && html.match( /[?&]track=([A-Za-z0-9]+)/ );
		return match ? match[ 1 ] : null;
	} catch ( err ) {
		return null;
	}
}

/** The session's CSRF token, or null when nobody is logged in. */
export async function csrfToken() {
	const r = await fetch( '/api.php?action=query&meta=tokens&format=json', { credentials: 'include' } );
	const j = await r.json();
	const token = j.query?.tokens?.csrftoken;
	return ! token || token === '+\\' ? null : token;
}

/**
 * What the wiki's answer to an edit means. "Saved" means it made a
 * revision: MediaWiki answers result: Success with nochange when the page
 * already had the text, and that is not a save.
 *
 * @return {{kind: 'saved', revisionId: number} | {kind: 'unchanged'} | {kind: 'error', message: string}}
 */
export function interpretEditResponse( j ) {
	if ( ! j || typeof j !== 'object' ) {
		return { kind: 'error', message: 'PickiPedia gave no answer' };
	}
	if ( j.error ) {
		return { kind: 'error', message: j.error.info || j.error.code || 'edit failed' };
	}
	const edit = j.edit || {};
	if ( edit.result !== 'Success' ) {
		return { kind: 'error', message: 'PickiPedia did not save: ' + JSON.stringify( j ).slice( 0, 200 ) };
	}
	if ( 'nochange' in edit ) {
		return { kind: 'unchanged' };
	}
	return { kind: 'saved', revisionId: edit.newrevid };
}

/**
 * Write a track's metadata page. Resolves to interpretEditResponse's
 * answer, or {kind: 'login'} when there is no session to write with.
 */
export async function saveMetadata( title, yamlText, { summary = 'Update timeline data via Rabbithole Editor' } = {} ) {
	const token = await csrfToken();
	if ( ! token ) {
		return { kind: 'login' };
	}
	const r = await fetch( '/api.php', {
		method: 'POST',
		credentials: 'include',
		body: new URLSearchParams( {
			action: 'edit', title, text: yamlText, summary, token,
			contentmodel: 'recording-metadata-yaml', format: 'json',
		} ),
	} );
	return interpretEditResponse( await r.json() );
}

/** The metadata page's text for a song's working data. */
export function metadataYaml( working, song ) {
	return jsYaml.dump( {
		timeline: working.timeline || {},
		ensemble: working.ensemble || {},
		...( working.standardSectionLength != null ? { standardSectionLength: working.standardSectionLength } : {} ),
		...( song && song.title ? { title: song.title } : {} ),
	}, { sortKeys: false, lineWidth: 120 } );
}
