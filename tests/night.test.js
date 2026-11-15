/**
 * Night (src/night.js, src/styles/night.css, src/styles/pane-night.css).
 *
 * Whether it is night is small and is tested as it is. What night looks
 * like is two stylesheets that answer day's, rule for rule, and the ways
 * that goes wrong are quiet ones: day gains a pale ground or a dark ink and
 * nobody writes its answer, so one white box stands in a dark room; or
 * day's rule is renamed and its answer answers nothing. The second half
 * reads the sheets as text and holds them to each other.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { chosen, isNight, followNight, night, NIGHT_CLASS } from '../src/night.js';

const root = resolve( __dirname, '..' );
const read = ( p ) => readFileSync( resolve( root, p ), 'utf8' );

describe( 'the reader\'s choice', () => {
	it( 'is the wiki\'s cookie, wherever it sits among the others', () => {
		expect( chosen( 'pickipedia-mode=dark' ) ).toBe( 'dark' );
		expect( chosen( 'a=1; pickipedia-mode=light; b=2' ) ).toBe( 'light' );
	} );

	it( 'is nothing when the cookie is missing or says anything else', () => {
		expect( chosen( '' ) ).toBe( '' );
		expect( chosen( undefined ) ).toBe( '' );
		expect( chosen( 'pickipedia-mode=Dark' ) ).toBe( '' );
		expect( chosen( 'pickipedia-mode=darkness' ) ).toBe( '' );
		expect( chosen( 'not-pickipedia-mode=dark' ) ).toBe( '' );
	} );

	it( 'wins over the system, either way', () => {
		expect( isNight( 'pickipedia-mode=dark', false ) ).toBe( true );
		expect( isNight( 'pickipedia-mode=light', true ) ).toBe( false );
	} );

	it( 'with none made, the system says', () => {
		expect( isNight( '', true ) ).toBe( true );
		expect( isNight( '', false ) ).toBe( false );
	} );
} );

/** A window, as far as followNight looks at one. */
function fakeWindow( { cookie = '', dark = false } = {} ) {
	const classes = new Set();
	const listeners = new Set();
	const system = {
		matches: dark,
		addEventListener: ( _, fn ) => listeners.add( fn ),
		removeEventListener: ( _, fn ) => listeners.delete( fn ),
	};
	return {
		classes,
		listeners,
		system,
		document: {
			cookie,
			documentElement: { classList: { toggle: ( name, on ) => ( on ? classes.add( name ) : classes.delete( name ) ) } },
		},
		matchMedia: () => system,
	};
}

describe( 'following night', () => {
	it( 'marks <html> and says so, by the system', () => {
		const win = fakeWindow( { dark: true } );
		followNight( win );
		expect( night.value ).toBe( true );
		expect( win.classes.has( NIGHT_CLASS ) ).toBe( true );
	} );

	it( 'turns with the system while the app is open', () => {
		const win = fakeWindow( { dark: false } );
		followNight( win );
		expect( night.value ).toBe( false );
		win.system.matches = true;
		win.listeners.forEach( ( fn ) => fn() );
		expect( night.value ).toBe( true );
		expect( win.classes.has( NIGHT_CLASS ) ).toBe( true );
		win.system.matches = false;
		win.listeners.forEach( ( fn ) => fn() );
		expect( win.classes.has( NIGHT_CLASS ) ).toBe( false );
	} );

	it( 'holds to a choice whatever the system does', () => {
		const win = fakeWindow( { cookie: 'pickipedia-mode=light', dark: true } );
		followNight( win );
		expect( night.value ).toBe( false );
		expect( win.classes.has( NIGHT_CLASS ) ).toBe( false );
	} );

	it( 'stops when asked', () => {
		const win = fakeWindow();
		const stop = followNight( win );
		expect( win.listeners.size ).toBe( 1 );
		stop();
		expect( win.listeners.size ).toBe( 0 );
	} );

	it( 'is the same test index.html makes before anything paints', () => {
		const page = read( 'index.html' );
		expect( page ).toContain( 'pickipedia-mode=(dark|light)' );
		expect( page ).toContain( '(prefers-color-scheme: dark)' );
		expect( page ).toContain( `classList.add( '${ NIGHT_CLASS }' )` );
	} );
} );

/*
 * The sheets, read as text. A rule is its selector and its declarations;
 * at-rules are walked through (a rule inside @media is a rule), keyframes
 * are left out, and night's one wrapper is taken off.
 */
function rulesOf( css, wrapper ) {
	const text = css.replace( /\/\*[\s\S]*?\*\//g, '' );
	const rules = [];
	const walk = ( from, to ) => {
		let i = from;
		while ( i < to ) {
			const open = text.indexOf( '{', i );
			if ( open === -1 || open >= to ) {
				return;
			}
			let depth = 1;
			let close = open + 1;
			while ( depth && close < to ) {
				depth += text[ close ] === '{' ? 1 : text[ close ] === '}' ? -1 : 0;
				close++;
			}
			const head = text.slice( i, open ).split( ';' ).pop().trim().replace( /\s+/g, ' ' );
			const body = text.slice( open + 1, close - 1 );
			if ( /^@(-webkit-)?keyframes/.test( head ) ) {
				// not colours a reader rests on
			} else if ( head.startsWith( '@' ) || head === wrapper ) {
				walk( open + 1, close - 1 );
			} else {
				const decls = {};
				body.split( ';' ).forEach( ( d ) => {
					const at = d.indexOf( ':' );
					if ( at > 0 ) {
						decls[ d.slice( 0, at ).trim() ] = d.slice( at + 1 ).trim();
					}
				} );
				head.split( /,(?![^(]*\))/ ).forEach( ( one ) => rules.push( { selector: one.trim(), decls } ) );
			}
			i = close;
		}
	};
	walk( 0, text.length );
	return rules;
}

/** How light a colour is, 0 to 1, or null for one that is not opaque or not a plain colour. */
function lightness( value ) {
	const v = value.trim().toLowerCase();
	if ( v === 'white' ) {
		return 1;
	}
	if ( v === 'black' ) {
		return 0;
	}
	let hex = ( /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec( v ) || [] )[ 1 ];
	if ( ! hex ) {
		return null;
	}
	if ( hex.length === 3 ) {
		hex = [ ...hex ].map( ( c ) => c + c ).join( '' );
	}
	const [ r, g, b ] = [ 0, 2, 4 ].map( ( i ) => parseInt( hex.slice( i, i + 2 ), 16 ) / 255 );
	return ( Math.max( r, g, b ) + Math.min( r, g, b ) ) / 2;
}

const DAY = {
	'src/styles/night.css': [ 'src/styles/app.css', 'src/styles/ensemble.css', 'src/styles/editor.css' ],
	'src/styles/pane-night.css': [ 'src/styles/pane.css', 'src/styles/pane-chase.css', 'src/styles/pane-trail.css' ],
};
const WRAPPER = { 'src/styles/night.css': ':root.rh-night', 'src/styles/pane-night.css': '.pane-root.pp-night' };
/* The pane's paper is on :host by day, and :host(.pp-night) answers it. */
const ANSWERS_AS = { ':host': ':host(.pp-night)', ':host( .pane-holds-graph )': ':host( .pane-holds-graph.pp-night )' };
/* Day's pale grounds and dark inks that stand by night, each for a reason. A new one goes here on purpose
   or gets its answer in the night sheet; it does not get forgotten. */
const STANDS = {
	'.rh-account-dot': 'a pale dot on the green header, which is green by night too',
	'.spot-hero .musician-card .mc-plate': 'the card under the spotlight is lit, and the room around it is blacked out by day too',
	'.spot-hero .musician-card .musician-name': 'on the lit card',
	'.spot-hero .musician-card .musician-instrument': 'on the lit card',
};

describe.each( Object.keys( DAY ) )( '%s', ( sheet ) => {
	const nightRules = rulesOf( read( sheet ), WRAPPER[ sheet ] );
	const dayRules = DAY[ sheet ].flatMap( ( file ) => rulesOf( read( file ) ) );
	const answered = ( selector, props ) => nightRules.some( ( r ) => (
		r.selector === ( ANSWERS_AS[ selector ] || selector ) && props.some( ( p ) => p in r.decls )
	) );

	it( 'is loaded', () => {
		const loader = sheet.includes( 'pane' ) ? read( 'src/wiki/pane-styles.js' ) : read( 'src/main.js' );
		expect( loader ).toContain( sheet.split( '/' ).pop() );
	} );

	it( 'answers every pale ground of day\'s', () => {
		const pale = dayRules.filter( ( r ) => {
			const ground = r.decls[ 'background-color' ] || r.decls.background || '';
			const l = lightness( ground );
			return l !== null && l >= 0.85;
		} );
		expect( pale.length ).toBeGreaterThan( 2 );
		const unanswered = pale.filter( ( r ) => (
			! ( r.selector in STANDS ) && ! answered( r.selector, [ 'background-color', 'background' ] )
		) );
		expect( unanswered.map( ( r ) => r.selector ) ).toEqual( [] );
	} );

	it( 'answers every dark ink of day\'s', () => {
		const dark = dayRules.filter( ( r ) => {
			const l = lightness( r.decls.color || '' );
			return l !== null && l <= 0.45;
		} );
		expect( dark.length ).toBeGreaterThan( 2 );
		const unanswered = dark.filter( ( r ) => ! ( r.selector in STANDS ) && ! answered( r.selector, [ 'color' ] ) );
		expect( unanswered.map( ( r ) => r.selector ) ).toEqual( [] );
	} );

	it( 'answers only rules day still has', () => {
		const day = new Set( dayRules.map( ( r ) => r.selector ) );
		// The components' own styles, and what night answers by what script wrote.
		const elsewhere = [ read( 'src/components/WalkTrail.vue' ), read( 'src/components/CarrotButton.vue' ) ].join( '\n' );
		const orphans = nightRules.map( ( r ) => r.selector ).filter( ( s ) => (
			! day.has( s ) && ! Object.values( ANSWERS_AS ).includes( s ) && s !== 'body' &&
			! s.startsWith( '[style*=' ) && ! elsewhere.includes( s.split( /[\s:>]/ )[ 0 ] )
		) );
		expect( orphans ).toEqual( [] );
	} );
} );
