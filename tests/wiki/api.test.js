/**
 * What the wiki says, read right.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { interpretEditResponse, extractMetadata, pickEncoding, metadataYaml, sameOrigin, saveMetadata } from '../../src/wiki/api.js';

/*
 * "Saved" means the wiki made a revision. MediaWiki answers result: Success
 * with nochange when the page already had the text, and that is not a save;
 * twice in one night an edit that never reached the wiki showed "Saved!"
 * because the shell did not read the answer (5 and 6 Nov 2026).
 */
describe( 'interpretEditResponse', () => {
	it( 'names the revision a real save made', () => {
		expect( interpretEditResponse( { edit: { result: 'Success', newrevid: 14701, oldrevid: 14637 } } ) )
			.toEqual( { kind: 'saved', revisionId: 14701 } );
	} );

	it( 'does not call nochange a save', () => {
		expect( interpretEditResponse( { edit: { result: 'Success', nochange: '' } } ) ).toEqual( { kind: 'unchanged' } );
	} );

	it( 'reports an error the wiki names', () => {
		expect( interpretEditResponse( { error: { code: 'protectedpage', info: 'This page has been protected' } } ) )
			.toEqual( { kind: 'error', message: 'This page has been protected' } );
	} );

	it( 'treats anything but Success as not saved', () => {
		expect( interpretEditResponse( { edit: { result: 'Failure' } } ).kind ).toBe( 'error' );
		expect( interpretEditResponse( null ).kind ).toBe( 'error' );
	} );
} );

describe( 'extractMetadata', () => {
	it( 'reads the flat shape the editor saves', () => {
		const m = extractMetadata( { timeline: { 0: { part: 'A' } }, ensemble: { 'Justin Holmes': [ 'guitar' ] }, standardSectionLength: 13.68, engineer: 'Sean' } );
		expect( m.timeline ).toEqual( { 0: { part: 'A' } } );
		expect( m.engineer ).toBe( 'Sean' );
	} );

	it( 'reads the arthel studio_versions shape too', () => {
		const m = extractMetadata( { studio_versions: { 0: { 'Vowel Sounds': { ensemble: { a: [ 'x' ] }, rabbithole: { timeline: { 0: {} }, standardSectionLength: 16 } } } } } );
		expect( m.album ).toBe( 'Vowel Sounds' );
		expect( m.standardSectionLength ).toBe( 16 );
		expect( m.ensemble ).toEqual( { a: [ 'x' ] } );
	} );

	it( 'gives nothing for nothing', () => {
		expect( extractMetadata( null ) ).toEqual( {} );
		expect( extractMetadata( { unrelated: true } ) ).toEqual( {} );
	} );
} );

describe( 'pickEncoding', () => {
	const encodings = { ogg: 'QmOgg', flac: 'QmFlac' };

	it( 'prefers ogg where the browser can play it', () => {
		expect( pickEncoding( encodings, { canPlay: () => true } ) ).toEqual( { cid: 'QmOgg', format: 'ogg' } );
	} );

	it( 'falls back to flac for a browser that cannot do ogg (Safari)', () => {
		expect( pickEncoding( encodings, { canPlay: ( t ) => t === 'audio/flac' } ) ).toEqual( { cid: 'QmFlac', format: 'flac' } );
	} );

	it( 'tries ogg anyway when the browser disclaims both, rather than playing nothing', () => {
		expect( pickEncoding( encodings, { canPlay: () => false } ) ).toEqual( { cid: 'QmOgg', format: 'ogg' } );
	} );

	it( 'lets ?enc= force one', () => {
		expect( pickEncoding( encodings, { forced: 'flac', canPlay: () => true } ) ).toEqual( { cid: 'QmFlac', format: 'flac' } );
	} );

	it( 'has nothing to say without encodings', () => {
		expect( pickEncoding( null ) ).toBeNull();
	} );
} );

describe( 'metadataYaml', () => {
	it( 'writes timeline, ensemble, section length and title, in that order', () => {
		const text = metadataYaml( { timeline: { 0: { part: 'A' } }, ensemble: { a: [ 'guitar' ] }, standardSectionLength: 10 }, { title: 'Swords' } );
		expect( text.indexOf( 'timeline:' ) ).toBeLessThan( text.indexOf( 'ensemble:' ) );
		expect( text ).toContain( 'standardSectionLength: 10' );
		expect( text ).toContain( 'title: Swords' );
	} );
} );

describe( 'sameOrigin', () => {
	it( 'keeps the path and drops the wiki\'s own host and port', () => {
		expect( sameOrigin( 'http://pickipedia:4009/images/thumb/a.png?x=1' ) ).toBe( '/images/thumb/a.png?x=1' );
		expect( sameOrigin( null ) ).toBeNull();
	} );
} );

/*
 * Save writes over the revision the chart was read from and no other. On
 * 8 Nov 2026 a stale copy of August's chart was saved over Justin's,
 * flourishes and all, because the save never asked what the page held.
 */
describe( 'saveMetadata', () => {
	const realFetch = globalThis.fetch;
	let posted;
	function wiki( latest ) {
		posted = null;
		globalThis.fetch = async ( url, init ) => {
			if ( init && init.method === 'POST' ) {
				posted = Object.fromEntries( init.body );
				return { ok: true, json: async () => ( { edit: { result: 'Success', newrevid: 99 } } ) };
			}
			const u = String( url );
			if ( u.includes( 'meta=tokens' ) ) {
				return { ok: true, json: async () => ( { query: { tokens: { csrftoken: 'abc+\\' } } } ) };
			}
			const pages = latest ? { 1: { revisions: [ { revid: latest, user: 'JMyles' } ] } } : { '-1': { missing: '' } };
			return { ok: true, json: async () => ( { query: { pages } } ) };
		};
	}
	afterEach( () => {
		globalThis.fetch = realFetch;
	} );

	it( 'saves over the revision it was read from', async () => {
		wiki( 5132 );
		expect( await saveMetadata( 'Release:X/Metadata', 'timeline: {}', { baseRevision: 5132 } ) )
			.toEqual( { kind: 'saved', revisionId: 99 } );
		expect( posted.baserevid ).toBe( '5132' );
	} );

	it( 'writes nothing when the page has moved on', async () => {
		wiki( 15130 );
		expect( await saveMetadata( 'Release:X/Metadata', 'timeline: {}', { baseRevision: 5132 } ) )
			.toEqual( { kind: 'conflict', revisionId: 15130, user: 'JMyles' } );
		expect( posted ).toBe( null );
	} );

	it( 'writes nothing over a page that exists when the chart came from none', async () => {
		wiki( 5132 );
		expect( ( await saveMetadata( 'Release:X/Metadata', 'timeline: {}' ) ).kind ).toBe( 'conflict' );
		expect( posted ).toBe( null );
	} );

	it( 'creates a missing page only if it is still missing', async () => {
		wiki( null );
		expect( ( await saveMetadata( 'Release:X/Metadata', 'timeline: {}' ) ).kind ).toBe( 'saved' );
		expect( posted.createonly ).toBe( '1' );
	} );
} );
