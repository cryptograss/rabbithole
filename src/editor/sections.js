/**
 * A chart written in sections, and the way back to it.
 *
 * The editor works in seconds: `section1` keys parsed as NaN and every
 * marker's play button seeked nowhere (Skyler, 6 Nov 2026), so a chart
 * that arrives in sections is resolved on open. Saving used to write the
 * seconds back, which quietly took the sections off a chart that was
 * written around a click. Justin, 15 Nov 2026: "it's better to leave
 * section numbers in place, if they are present in Release Metadata that
 * has a standardSectionLength. It's marginally easier to read if nothing
 * else."
 *
 * So: the shape a chart arrived in is remembered, and the save puts it
 * back on -- but only when the sectioned text says exactly what the
 * editor holds. Every candidate is resolved again (processTimeline) and
 * compared against the working chart; anything that does not match to the
 * letter is written in seconds instead. A chart is never changed for the
 * sake of its appearance.
 */

import { processTimeline, sectionStarts, happensOnce } from '../player/timeline.js';

/** Floats accumulate; two times within this are the same moment. */
const SAME = 1e-6;

const near = ( a, b ) => Math.abs( a - b ) < SAME;

/**
 * Where a sectioned chart's sections start: the player's own arithmetic
 * (player/timeline.js sectionStarts), which is the one place it is done.
 *
 * Returns null for a chart that has no sections to keep.
 */
export function sectionShape( trackData ) {
	const standard = trackData && trackData.standardSectionLength;
	const sections = sectionStarts( trackData )
		.map( ( { name, time, data } ) => ( { name, time, length: data.length } ) );
	if ( ! standard || ! sections.length ) {
		return null;
	}
	return { standard, sections, explicitUntil: sections[ 0 ].time };
}

/**
 * The working chart, in seconds, written back as sections.
 *
 * Returns null when the sectioned form cannot say the same thing -- a
 * section start deleted or moved, a marker put before the sections that
 * would push them all later -- and the caller writes seconds.
 */
export function sectionize( timeline, shape ) {
	if ( ! shape || ! shape.sections.length ) {
		return null;
	}
	const times = Object.keys( timeline || {} ).map( parseFloat )
		.filter( ( t ) => ! isNaN( t ) ).sort( ( a, b ) => a - b );
	const at = ( time ) => timeline[ String( time ) ] !== undefined
		? timeline[ String( time ) ]
		: timeline[ Object.keys( timeline ).find( ( k ) => near( parseFloat( k ), time ) ) ];

	// The sections that are still there, and any new pass that landed
	// exactly on the next line of the grid after the last of them.
	const sections = shape.sections.map( ( s ) => ( { ...s } ) );
	for ( const s of sections ) {
		if ( at( s.time ) === undefined ) {
			return null;
		}
	}
	let used = Math.max( ...sections.map( ( s ) => Number( s.name.replace( 'section', '' ) ) ) );
	for ( ;; ) {
		const last = sections[ sections.length - 1 ];
		const next = last.time + shape.standard;
		if ( ! times.some( ( t ) => near( t, next ) ) ) {
			break;
		}
		used += 1;
		sections.push( { name: `section${ used }`, time: next } );
	}

	const out = {};
	const sectionData = new Map();

	for ( const time of times ) {
		const marker = at( time );
		const owner = [ ...sections ].reverse().find( ( s ) => s.time <= time + SAME );

		if ( ! owner ) {
			// Before the sections: an explicit time, as it always was.
			// Nothing can come after them -- a later time belongs to the
			// section it falls in -- and if the explicit times have moved,
			// every section moves with them, which the check below catches.
			out[ String( time ) ] = marker;
			continue;
		}

		if ( near( owner.time, time ) ) {
			// A section's own length is a key of the marker already: it
			// survives the resolution into seconds and goes back as it was.
			const base = { ...marker };
			out[ owner.name ] = base;
			sectionData.set( owner.name, base );
			continue;
		}

		// Inside a pass: say only what the moment itself adds. Whatever
		// happens once -- its part, its lights -- is its own and always
		// written, since none of that is taken from the pass.
		const base = sectionData.get( owner.name ) || {};
		const inside = {};
		for ( const [ key, value ] of Object.entries( marker ) ) {
			if ( happensOnce( key ) || JSON.stringify( value ) !== JSON.stringify( base[ key ] ) ) {
				inside[ key ] = value;
			}
		}
		out[ owner.name ][ String( time ) ] = inside;
	}

	return says( out, shape.standard, timeline ) ? out : null;
}

/** Whether the sectioned chart resolves to exactly the chart in hand. */
function says( sectioned, standard, timeline ) {
	const back = processTimeline( { timeline: sectioned, standardSectionLength: standard } );
	const plain = ( chart ) => {
		const out = {};
		for ( const [ key, value ] of Object.entries( chart ) ) {
			const { _isSectionStart, _isSubMoment, ...rest } = value || {};
			out[ String( Number( key ) ) ] = rest;
		}
		return out;
	};
	return stable( plain( back ) ) === stable( plain( timeline ) );
}

/**
 * A value as text, the same text however its keys were ordered. Resolving
 * a chart puts its markers back in its own order, which says nothing
 * about whether the two charts are the same chart.
 */
function stable( value ) {
	if ( Array.isArray( value ) ) {
		return '[' + value.map( stable ).join( ',' ) + ']';
	}
	if ( value && typeof value === 'object' ) {
		return '{' + Object.keys( value ).sort()
			.map( ( key ) => JSON.stringify( key ) + ':' + stable( value[ key ] ) ).join( ',' ) + '}';
	}
	return JSON.stringify( value === undefined ? null : value );
}
