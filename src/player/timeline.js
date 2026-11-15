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

/*
 * What a moment inside a pass does not take from the pass: whatever
 * happens once, where it is written, and does not hold until something
 * changes it. The pass's name, and its lights. A flourish written on a
 * section is that section's downbeat; a moment later in it that took the
 * flourish along would fire it a second time.
 */
export const happensOnce = ( key ) => key === 'part' || /^(flourish|spotlight|bandFlash)/.test( key );

/**
 * Where a chart's sections start, in order: [{ name, time, data }].
 *
 * `section1`, `section2`... are labels in order, placed one
 * standardSectionLength apart, starting after the last explicit time; a
 * section may carry its own `length`, and a chart may skip numbers (Paint
 * Exchange has no section1). However many there are: this used to count
 * to twenty and stop, and a chart's twenty-first section was not read,
 * which the editor's save would then have taken off the page.
 *
 * The one place this arithmetic is done. The player lays a chart out by
 * it and the editor writes one back by it (editor/sections.js), so the
 * two cannot disagree about where a section starts.
 */
export function sectionStarts( trackData ) {
	const timeline = ( trackData && trackData.timeline ) || {};
	const standard = trackData && trackData.standardSectionLength;
	if ( ! standard ) {
		return [];
	}
	const explicit = Object.keys( timeline )
		.filter( ( key ) => ! key.startsWith( 'section' ) )
		.map( parseFloat )
		.filter( ( t ) => ! isNaN( t ) );
	let at = explicit.length ? Math.max( ...explicit ) : 0;

	return Object.keys( timeline )
		.filter( ( key ) => /^section\d+$/.test( key ) && timeline[ key ] )
		.sort( ( a, b ) => Number( a.slice( 7 ) ) - Number( b.slice( 7 ) ) )
		.map( ( name ) => {
			const data = timeline[ name ];
			at += data.length !== undefined ? data.length : standard;
			return { name, time: at, data };
		} );
}

/**
 * Lay a timeline's section keys out in time.
 *
 * A timeline may mix explicit times (`12.5`) with `section1`, `section2`...
 * keys (sectionStarts says where each begins), and numeric keys inside a
 * section are sub-moments at absolute times. Section starts are flagged
 * `_isSectionStart`, sub-moments `_isSubMoment`, so the parts strip can
 * tell them apart.
 *
 * Everything a chart writes at a second is in force at that second. A
 * moment may be written on the very second a section starts -- its own
 * section's, or the next one's -- and each used to be put down over
 * whatever was already there, so one of the two was lost: Paint
 * Exchange's five-second flourish for John Mailander, written at 23.5
 * where a section starts, never played, and opening that chart in the
 * editor and saving it would have taken those four lines off the wiki
 * (magent, 15 Nov 2026, reading every chart through the new effects). So
 * what is said at each second is gathered first, by who says it, and
 * each entry is made once from all of it.
 *
 * Returns the timeline itself when there are no sections to place.
 */
export function processTimeline( trackData ) {
	const timeline = ( trackData && trackData.timeline ) || {};
	if ( ! trackData || ! trackData.standardSectionLength ) {
		return timeline;
	}

	// What is said at each second: a marker written at that time, a
	// section starting there, a moment inside a section.
	const said = new Map();
	const at = ( time ) => {
		if ( ! said.has( time ) ) {
			said.set( time, {} );
		}
		return said.get( time );
	};

	Object.entries( timeline ).forEach( ( [ key, value ] ) => {
		if ( ! key.startsWith( 'section' ) ) {
			at( parseFloat( key ) ).marker = value;
		}
	} );

	for ( const { time, data } of sectionStarts( trackData ) ) {
		const base = {};
		const held = {};
		for ( const [ key, value ] of Object.entries( data ) ) {
			if ( ! isNaN( parseFloat( key ) ) ) {
				/*
				 * A sub-moment is inside a pass, not the start of one:
				 * Maddie's pickup at 0:40 of August, Gaven's flourishes
				 * at 2:03 and 2:06.
				 */
				const here = at( parseFloat( key ) );
				here.moment = { ...here.moment, ...value };
				here.pass = held;
				continue;
			}
			base[ key ] = value;
			/*
			 * A moment takes who is playing and who is featured from
			 * its pass, but never the pass's part, unless it names one
			 * itself. Nothing reads a part off a sub-moment -- the
			 * parts strip skips them -- and copying it in meant that
			 * writing the chart back out in seconds (flattenSections)
			 * turned each of those moments into another B part.
			 * August's ten passes came back as eighteen, and the
			 * chartifact that says "second B part" no longer points at
			 * the same pass the song does (Justin and re, 15 Nov 2026).
			 */
			if ( ! happensOnce( key ) ) {
				held[ key ] = value;
			}
		}
		at( time ).section = base;
	}

	const processed = {};
	for ( const [ time, { marker, section, moment, pass } ] of said ) {
		if ( section ) {
			// A pass starts here, and anything written for this second
			// is part of how it starts.
			processed[ time ] = { ...marker, ...section, ...moment, _isSectionStart: true };
		} else if ( marker ) {
			processed[ time ] = moment ? { ...marker, ...moment } : marker;
		} else {
			processed[ time ] = { ...pass, ...moment, _isSubMoment: true };
		}
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
 * A named scene wins: lead 1, cooldown 5, harmony 7, rhythm 8, anything
 * else 6. Then the plain solo shape. Recent soloists hold the next places
 * by recency, and everyone else sits on their base weight, pushed down a
 * step for each recent soloist above them.
 *
 * A pickup is not in that list, and deliberately. It used to sort to 5,
 * which walked the card up to second place and then, a beat later when
 * they took the solo, to first: "Pickups look weird with the person moving
 * to second place and then to first. Just leave them where they are"
 * (Justin, #rabbithole, 15 Nov 2026, item 21). A pickup is half a bar
 * long; it is something to see, not something to re-sort the band for, so
 * it says so with a glow and leaves the order alone.
 */
export function dynamicWeight( name, arrangement, { baseWeights: base = {}, recentSoloists = [] } = {} ) {
	const features = arrangement ? arrangement.feature : null;
	const scene = features ? features[ name ] : null;
	if ( scene && scene !== 'pickup' ) {
		switch ( scene ) {
			case 'lead': return 1;
			case 'cooldown': return 5;
			case 'harmony': return 7;
			case 'rhythm': return 8;
			default: return 6;
		}
	}
	if ( soloistsOf( arrangement ).includes( name ) ) {
		return 1;
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
	const solos = soloistsOf( arrangement );

	const list = Object.keys( ( trackData && trackData.ensemble ) || {} ).map( ( name ) => {
		const scene = features && features[ name ] ? features[ name ]
			: currentSolo === name || solos.includes( name ) ? 'lead'
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

/*
 * Everyone an arrangement names as taking it, in the chart's order. `solo`
 * is one name, or a list of them: a cappella harmony on Reuben's Train is
 * three people taking it at once, and the chart stars them all (Justin,
 * 12 Nov 2026). An older chart may say `soloist`.
 */
export function soloistsOf( arrangement ) {
	const solo = arrangement ? ( arrangement.solo || arrangement.soloist ) : null;
	if ( ! solo ) {
		return [];
	}
	return ( Array.isArray( solo ) ? solo : [ solo ] ).map( ( n ) => String( n ).trim() ).filter( Boolean );
}

/** The first soloist an arrangement names, or null. Null, never undefined, so "nobody" equals "nobody". */
export function soloistOf( arrangement ) {
	return soloistsOf( arrangement )[ 0 ] || null;
}

/** mm:ss */
export function formatTime( seconds ) {
	const s = Math.max( 0, seconds || 0 );
	const mins = Math.floor( s / 60 );
	const secs = Math.floor( s % 60 );
	return `${ mins }:${ secs.toString().padStart( 2, '0' ) }`;
}
