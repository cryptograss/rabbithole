// @vitest-environment happy-dom
/**
 * Every layout.<something>() the app calls is something the layout store has.
 *
 * one-bar renamed stopFollowing to stopTraversing (Justin's item 16) and
 * every caller in the tree was renamed with it -- but blu's walk drawer
 * landed on main meanwhile with a call of its own, and the two merged
 * cleanly into a TypeError that stopped the graph's page from opening
 * (re, #rabbithole, 15 Nov 2026). Nothing in the tree had both halves, so
 * nothing caught it. This does: it reads the calls out of the source and
 * holds them against the store itself.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { setActivePinia, createPinia } from 'pinia';
import { useLayoutStore } from '../../src/stores/layout.js';

function sources( dir, found = [] ) {
	for ( const entry of readdirSync( dir ) ) {
		const path = join( dir, entry );
		if ( statSync( path ).isDirectory() ) {
			sources( path, found );
		} else if ( /\.(js|vue)$/.test( entry ) ) {
			found.push( path );
		}
	}
	return found;
}

describe( 'the layout store answers to every name the app calls it by', () => {
	beforeEach( () => setActivePinia( createPinia() ) );

	it( 'has a member for every layout.x() in src/', () => {
		const layout = useLayoutStore();
		const missing = [];
		for ( const path of sources( 'src' ) ) {
			const text = readFileSync( path, 'utf8' );
			for ( const [ , name ] of text.matchAll( /\blayout\.([A-Za-z_$][\w$]*)\s*\(/g ) ) {
				if ( ! ( name in layout ) ) {
					missing.push( path + ': layout.' + name + '()' );
				}
			}
		}
		expect( missing ).toEqual( [] );
	} );

	it( 'finds the calls it is meant to be reading', () => {
		// A guard on the guard: a regex that matches nothing would pass
		// the test above for the wrong reason.
		const calls = sources( 'src' )
			.flatMap( ( p ) => [ ...readFileSync( p, 'utf8' ).matchAll( /\blayout\.([A-Za-z_$][\w$]*)\s*\(/g ) ] );
		expect( calls.length ).toBeGreaterThan( 5 );
	} );
} );
