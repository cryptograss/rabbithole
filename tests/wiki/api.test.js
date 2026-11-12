/**
 * What the wiki says, read right.
 */
import { describe, it, expect } from 'vitest';
import { interpretEditResponse, extractMetadata, pickEncoding, audioInFolder, metadataYaml, sameOrigin, isCharted, songPageFrom } from '../../src/wiki/api.js';

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

describe( 'audioInFolder', () => {
	const listing = '<a href="/ipfs/QmDir">QmDir</a> <a href="/ipfs/QmDir/metadata.json">metadata.json</a>'
		+ ' <a href="/ipfs/QmMeta?filename=metadata.json">QmMeta</a>'
		+ ' <a href="/ipfs/QmDir/ruebens-train-web3summit.mp3">ruebens-train-web3summit.mp3</a>'
		+ ' <a href="/ipfs/QmFile?filename=ruebens-train-web3summit.mp3">QmFile</a>';

	it( 'finds the audio file in an upload folder', () => {
		expect( audioInFolder( listing, 'QmDir' ) ).toBe( 'QmDir/ruebens-train-web3summit.mp3' );
	} );

	it( 'has nothing when the folder holds no audio', () => {
		expect( audioInFolder( '<a href="/ipfs/QmDir/metadata.json">m</a>', 'QmDir' ) ).toBeNull();
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

describe( 'isCharted', () => {
	it( 'is true for a timeline with more than one entry', () => {
		expect( isCharted( "timeline:\n  '0':\n    part: intro\n  '10':\n    part: A\n" ) ).toBe( true );
	} );
	it( 'is false for the stub the editor leaves (Silver 44, 8 Nov 2026)', () => {
		expect( isCharted( '# Recording metadata for Silver 44.\n\ntimeline: {}\nensemble: {}\n' ) ).toBe( false );
	} );
	it( 'is false for YAML it cannot read', () => {
		expect( isCharted( 'timeline: [unclosed' ) ).toBe( false );
	} );
} );

/*
 * A track opens on its song's page. The release's title is whatever the
 * pinner typed, so the page named after it is tried first and the Song: page
 * that links the release is the fallback (Reuben's Train, 11 Nov 2026).
 */
describe( 'songPageFrom', () => {
	const reubens = { title: 'Immutable Strings - Reuben\'s Train (from web3summit 2024)' };

	it( 'takes the page named after the title when it exists', () => {
		const answer = { query: { pages: { 7: { title: 'Song:August' } }, backlinks: [] } };
		expect( songPageFrom( answer, 'August' ) ).toBe( 'Song:August' );
	} );

	it( 'falls back to the Song: page that links the release', () => {
		const answer = { query: {
			pages: { '-1': { title: 'Song:' + reubens.title, missing: true } },
			backlinks: [ { ns: 3000, title: 'Cryptograss:Moods/rabbithole/links/2026-11' }, { ns: 3008, title: 'Song:Reuben\'s Train' } ],
		} };
		expect( songPageFrom( answer, reubens.title ) ).toBe( 'Song:Reuben\'s Train' );
	} );

	it( 'has nothing when no song page owns the track', () => {
		expect( songPageFrom( { query: { pages: { '-1': { missing: true } }, backlinks: [] } }, 'Nobody' ) ).toBeNull();
		expect( songPageFrom( { query: { backlinks: [] } }, '' ) ).toBeNull();
	} );
} );
