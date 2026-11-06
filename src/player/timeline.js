/**
 * A song's chart, as pure functions: what the timeline says is happening at
 * a moment, which part that is, who is featured, and in what order the
 * cards belong.
 *
 * Nothing here touches the DOM, Webamp or a clock. The player model calls
 * these on every tick with the time Webamp reports; the components render
 * what comes back. The editor reads the same functions so the two cannot
 * disagree about where a section starts.
 */

import { musicianEntries, statusAt } from '../musician-status.js';

/**
 * Lay a timeline's section keys out in time.
 *
 * A timeline may mix explicit times (`12.5`) with `section1`, `section2`...
 * keys, which are placed one standardSectionLength apart, starting after
 * the last explicit time. A section may carry its own `length`, and
 * numeric keys inside a section are sub-moments at absolute times. Section
 * starts are flagged `_isSectionStart`, sub-moments `_isSubMoment`, so the
 * parts strip can tell them apart.
 *
 * Returns the timeline itself when there are no sections to place.
 */
export function processTimeline( trackData ) {
	const timeline = ( trackData && trackData.timeline ) || {};
	if ( ! trackData || ! trackData.standardSectionLength ) {
		return timeline;
	}

	const processed = {};
	const explicitTimes = [];
	Object.entries( timeline ).forEach( ( [ key, value ] ) => {
		if ( ! key.startsWith( 'section' ) ) {
			const exactTime = parseFloat( key );
			explicitTimes.push( exactTime );
			processed[ exactTime ] = value;
		}
	} );

	let accumulatedTime = explicitTimes.length ? Math.max( ...explicitTimes ) : 0;

	for ( let i = 1; i <= 20; i++ ) {
		const sectionData = timeline[ `section${ i }` ];
		if ( ! sectionData ) {
			continue;
		}
		const sectionLength = sectionData.length !== undefined
			? sectionData.length
			: trackData.standardSectionLength;

		accumulatedTime += sectionLength;
		const sectionStartTime = accumulatedTime;

		const baseSectionData = {};
		const subMoments = {};
		for ( const [ key, value ] of Object.entries( sectionData ) ) {
			if ( ! isNaN( parseFloat( key ) ) ) {
				subMoments[ key ] = value;
			} else {
				baseSectionData[ key ] = value;
			}
		}
		for ( const [ timeStr, momentData ] of Object.entries( subMoments ) ) {
			processed[ parseFloat( timeStr ) ] = { ...baseSectionData, ...momentData, _isSubMoment: true };
		}
		processed[ sectionStartTime ] = { ...baseSectionData, _isSectionStart: true };
	}

	return processed;
}

/** The processed timeline as [{time, arrangement}], oldest first. */
export function entries( processed ) {
	return Object.entries( processed || {} )
		.map( ( [ timeStr, arrangement ] ) => ( { time: Number( timeStr ), arrangement } ) )
		.filter( ( e ) => ! isNaN( e.time ) )
		.sort( ( a, b ) => a.time - b.time );
}

/** The entries that start a part, for the parts strip: one pass, used twice. */
function partEntries( processed ) {
	return entries( processed ).filter( ( { arrangement } ) =>
		arrangement && arrangement.part && ( arrangement._isSectionStart || ! arrangement._isSubMoment ) );
}

/** The part names in order, as the strip shows them. */
export function songParts( processed ) {
	return partEntries( processed ).map( ( e ) => e.arrangement.part );
}

/** The start time of each part, parallel to songParts(). */
export function songPartTimes( processed ) {
	return partEntries( processed ).map( ( e ) => e.time );
}

/** Index into songParts() of the part the playhead is in, or -1 before the first. */
export function currentPartIndex( processed, time ) {
	let active = -1;
	partEntries( processed ).forEach( ( e, i ) => {
		if ( e.time <= time ) {
			active = i;
		}
	} );
	return active;
}

/** The arrangement in force at `time`: the latest entry at or before it. */
export function currentArrangement( processed, time ) {
	const startTimes = Object.keys( processed || {} ).map( Number ).sort( ( a, b ) => b - a );
	const start = startTimes.find( ( t ) => t <= time );
	return start === undefined ? undefined : processed[ start ];
}

/** Who is playing what at this moment: the ensemble's first instrument, or a change. */
export function currentInstruments( trackData, arrangement ) {
	const instruments = {};
	Object.entries( ( trackData && trackData.ensemble ) || {} ).forEach( ( [ musician, list ] ) => {
		instruments[ musician ] = Array.isArray( list ) ? list[ 0 ] : list;
	} );
	if ( arrangement && arrangement.instrumentChanges ) {
		Object.entries( arrangement.instrumentChanges ).forEach( ( [ musician, instrument ] ) => {
			instruments[ musician ] = instrument;
		} );
	}
	return instruments;
}

/** 'in' or 'out' for one person at a time, by the shared rule. */
export function musicianStatus( processed, name, time ) {
	return statusAt( musicianEntries( processed ), name, time );
}

/**
 * Times at which somebody comes in or drops out, after the top of the
 * song: the moments a flash marks.
 */
export function momentTimes( timeline ) {
	const times = [];
	Object.entries( timeline || {} ).forEach( ( [ timeStr, arrangement ] ) => {
		const time = Number( timeStr );
		if ( isNaN( time ) || time <= 0 || ! arrangement ) {
			return;
		}
		const musicians = arrangement.musicians;
		if ( musicians ) {
			if ( musicians.band === 'in' || musicians.band === 'out' ) {
				times.push( time );
			} else if ( Object.values( musicians ).some( ( s ) => s === 'in' || s === 'out' ) ) {
				times.push( time );
			}
		}
		if ( arrangement.detail === 'band-in' ) {
			times.push( time );
		}
	} );
	return times.sort( ( a, b ) => a - b );
}

/** Each musician's resting weight: the ensemble's order, 100, 110, 120... */
export function baseWeights( ensemble ) {
	const weights = {};
	let w = 100;
	Object.keys( ensemble || {} ).forEach( ( name ) => {
		weights[ name ] = w;
		w += 10;
	} );
	return weights;
}

/**
 * Where a card sorts right now. Lower is nearer the top.
 *
 * A named scene wins: lead 1, pickup 5, cooldown 5, harmony 7, rhythm 8,
 * anything else 6. Then the plain solo/pickup shape. Recent soloists hold
 * the next places by recency, and everyone else sits on their base weight,
 * pushed down a step for each recent soloist above them.
 */
export function dynamicWeight( name, arrangement, { baseWeights: base = {}, recentSoloists = [] } = {} ) {
	const features = arrangement ? arrangement.feature : null;
	const scene = features ? features[ name ] : null;
	if ( scene ) {
		switch ( scene ) {
			case 'lead': return 1;
			case 'pickup': return 5;
			case 'cooldown': return 5;
			case 'harmony': return 7;
			case 'rhythm': return 8;
			default: return 6;
		}
	}
	if ( arrangement && ( arrangement.solo === name || arrangement.soloist === name ) ) {
		return 1;
	}
	if ( arrangement && arrangement.pickup === name ) {
		return 5;
	}
	const recent = recentSoloists.indexOf( name );
	if ( recent !== -1 ) {
		return 10 + recent;
	}
	return ( base[ name ] === undefined ? 100 : base[ name ] ) + recentSoloists.length * 5;
}

/**
 * The cards, as the arrangement at `time` wants them.
 *
 * One object per person: name, the instrument in hand, the scene class the
 * card wears (lead, pickup, out, or a named scene), whether it is starred,
 * and its sort weight. The engineer, when there is one, comes last.
 *
 * @return {Array<{name, instrument, scene, star, weight, engineer}>}
 */
export function cards( trackData, processed, time, { currentSolo = null, recentSoloists = [] } = {} ) {
	const arrangement = currentArrangement( processed, time );
	const instruments = currentInstruments( trackData, arrangement );
	const base = baseWeights( trackData && trackData.ensemble );
	const pickup = arrangement ? arrangement.pickup : null;
	const features = arrangement ? arrangement.feature : null;

	const list = Object.keys( ( trackData && trackData.ensemble ) || {} ).map( ( name ) => {
		const scene = features && features[ name ] ? features[ name ]
			: currentSolo === name ? 'lead'
				: pickup === name ? 'pickup'
					: musicianStatus( processed, name, time ) === 'out' ? 'out'
						: null;
		return {
			name,
			instrument: instruments[ name ] || '',
			scene,
			star: scene === 'lead',
			weight: dynamicWeight( name, arrangement, { baseWeights: base, recentSoloists } ),
			engineer: false,
		};
	} );

	if ( trackData && trackData.engineer ) {
		list.push( { name: trackData.engineer, instrument: 'console', scene: null, star: false, weight: 1000, engineer: true } );
	}

	return list;
}

/** The soloist an arrangement names, or null. Null, never undefined, so "nobody" equals "nobody". */
export function soloistOf( arrangement ) {
	return arrangement ? ( arrangement.solo || arrangement.soloist || null ) : null;
}

/** mm:ss */
export function formatTime( seconds ) {
	const s = Math.max( 0, seconds || 0 );
	const mins = Math.floor( s / 60 );
	const secs = Math.floor( s % 60 );
	return `${ mins }:${ secs.toString().padStart( 2, '0' ) }`;
}
