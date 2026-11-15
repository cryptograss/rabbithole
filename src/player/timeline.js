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
import { isVoice } from '../instruments.js';

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
		/*
		 * A sub-moment is inside a pass, not the start of one: Maddie's
		 * pickup at 0:40 of August, Gaven's flourishes at 2:03 and 2:06.
		 * It inherits who is playing and who is featured, but never the
		 * section's part, unless it names one itself. Nothing reads a
		 * part off a sub-moment -- the parts strip skips them -- and
		 * copying it in meant that writing the chart back out in seconds
		 * (flattenSections) turned each of those moments into another B
		 * part. August's ten passes came back as eighteen, and the
		 * chartifact that says "second B part" no longer points at the
		 * same pass the song does (Justin and re, 15 Nov 2026).
		 */
		const { part, ...insideThePass } = baseSectionData;
		for ( const [ timeStr, momentData ] of Object.entries( subMoments ) ) {
			processed[ parseFloat( timeStr ) ] = { ...insideThePass, ...momentData, _isSubMoment: true };
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

/** When the chart next says something after `time`, in seconds, or null when it has no more to say. */
export function nextMarker( processed, time ) {
	const next = entries( processed ).find( ( e ) => e.time > time );
	return next ? next.time : null;
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
 * The scene a chart names for somebody at this moment, or null: `feature`
 * first, then the plain shapes -- taking it, or leading in.
 */
function namedScene( name, arrangement ) {
	if ( ! arrangement ) {
		return null;
	}
	const featured = arrangement.feature && arrangement.feature[ name ];
	if ( featured ) {
		return featured;
	}
	if ( soloistsOf( arrangement ).includes( name ) ) {
		return 'lead';
	}
	return arrangement.pickup === name ? 'pickup' : null;
}

/**
 * Who is singing in an arrangement, in the chart's order.
 *
 * A chart has no word for singing and does not need one: somebody takes it
 * (or is featured as the harmony) and what they have in hand is their
 * voice. Silver 44's last verse is `solo: Justin Holmes` with
 * `instrumentChanges: { Justin Holmes: vocals }`.
 */
export function singersOf( trackData, arrangement ) {
	if ( ! arrangement ) {
		return [];
	}
	const instruments = currentInstruments( trackData, arrangement );
	const named = [ ...soloistsOf( arrangement ), ...Object.keys( arrangement.feature || {} ) ];
	return [ ...new Set( named ) ].filter( ( name ) => {
		const scene = namedScene( name, arrangement );
		return ( scene === 'lead' || scene === 'harmony' ) && isVoice( instruments[ name ] );
	} );
}

/**
 * Who stands at the microphone at `time`, nearest it first.
 *
 * The singer steps to the front and the pickers stay where they stand: a
 * break lights a card where it is, and only a voice moves one (Justin,
 * #visual-effects, 15 Nov 2026: "I'm not convinced that cards moving to
 * the top for solos have much value. Moving to the top for vocals makes
 * sense"). The cards used to re-sort on every solo -- the soloist to the
 * top, the last three soloists behind them by recency -- so a fiddle tune
 * shuffled the whole band every thirteen seconds.
 *
 * Whoever has sung stays at the front, the latest singer first, until the
 * song is over: a singer who walked back to their place between verses
 * would be motion that says "this stopped mattering", which is nothing to
 * draw an eye for. And it is read off the chart up to `time`, not kept as
 * the song plays, so seeking back before the first verse puts everybody
 * back where they started.
 */
export function micOrder( trackData, processed, time ) {
	let front = [];
	for ( const { time: t, arrangement } of entries( processed ) ) {
		if ( t > time ) {
			break;
		}
		const singing = singersOf( trackData, arrangement );
		if ( singing.length ) {
			front = [ ...singing, ...front.filter( ( name ) => ! singing.includes( name ) ) ];
		}
	}
	return front;
}

/**
 * The cards, as the arrangement at `time` wants them.
 *
 * One object per person: name, the instrument in hand, the scene class the
 * card wears (lead, pickup, out, or a named scene), whether it carries the
 * star or the microphone, and its sort weight. `since` and `until` are the
 * span of the arrangement in force, in the song's seconds, so a pickup
 * knows how long it has to lead in. The engineer, when there is one, comes
 * last.
 *
 * @return {Array<{name, instrument, scene, star, singing, weight, since, until, engineer}>}
 */
export function cards( trackData, processed, time ) {
	const all = entries( processed );
	const at = all.filter( ( e ) => e.time <= time ).pop();
	const next = all.find( ( e ) => e.time > time );
	const arrangement = at ? at.arrangement : undefined;
	const since = at ? at.time : 0;
	const until = next ? next.time : Infinity;

	const instruments = currentInstruments( trackData, arrangement );
	const base = baseWeights( trackData && trackData.ensemble );
	const front = micOrder( trackData, processed, time );
	const singers = singersOf( trackData, arrangement );

	const list = Object.keys( ( trackData && trackData.ensemble ) || {} ).map( ( name ) => {
		const scene = namedScene( name, arrangement )
			|| ( musicianStatus( processed, name, time ) === 'out' ? 'out' : null );
		const singing = singers.includes( name );
		const place = front.indexOf( name );
		return {
			name,
			instrument: instruments[ name ] || '',
			scene,
			star: scene === 'lead' && ! singing,
			singing,
			weight: place === -1 ? base[ name ] : 1 + place,
			since,
			until,
			engineer: false,
		};
	} );

	if ( trackData && trackData.engineer ) {
		list.push( { name: trackData.engineer, instrument: 'console', scene: null, star: false, singing: false, weight: 1000, since, until, engineer: true } );
	}

	return list;
}

/*
 * How long an effect may be in force, in seconds of the song. A chart asks
 * for what it wants and gets it: Paint Exchange asks for five seconds of
 * dark and three and a half of glow for Kaitlyn's cello, and for a week it
 * got three in all, because at the old, hard look anything longer read as
 * a fault. The bounds are here for a typing mistake, not for taste.
 */
const SPANS = {
	flourish: { fallback: 1.5, min: 0.75, max: 12 },
	blackout: { fallback: 3, min: 1.5, max: 8 },
	glow: { fallback: 2, min: 0, max: 6 },
	bandFlash: { fallback: 0.8, min: 0.75, max: 6 },
	// How long a card says "just came in".
	enter: 0.9,
};

// Nothing written longer ago than this can still be in force.
const LONGEST = Math.max( SPANS.flourish.max, SPANS.blackout.max + SPANS.glow.max, SPANS.bandFlash.max );

function bounded( asked, { fallback, min, max } ) {
	const n = Number( asked );
	return Math.max( min, Math.min( max, n > 0 ? n : fallback ) );
}

const names = ( value ) => ( Array.isArray( value ) ? value : [ value ] )
	.map( ( n ) => ( typeof n === 'string' ? n.trim() : '' ) ).filter( Boolean );

/**
 * The effects in force at `time`: a flourish, a spotlight, a band flash,
 * somebody coming in.
 *
 * Each is a span on the song's own clock -- from the moment the chart
 * writes it, for as long as it asks -- and it is in force while the
 * playhead is inside that span. Nothing fires and nothing times out: seek
 * into the middle of one and it is on, seek out and it is off, pause and
 * it holds. They used to be fired when the arrangement changed and taken
 * away by a timer, so a seek that landed anywhere after a spotlight's
 * marker blacked the pane out, and a pause did not stop one.
 *
 * A record is `{ key, kind, target, start, end, color, intensity, pulse }`;
 * `target` is a name, or null for the whole band. A spotlight also says
 * whether it is still `dark` (the blackout) or only glowing. The key is the
 * same on every tick, so whatever draws it can tell one it has seen.
 *
 * An effect is light on a card, so it is only ever for somebody who has
 * one: a chart that asks for a spotlight on "Harry" where the card says
 * "Harry Clark" gets no spotlight, where it used to get the pane blacked
 * out for nobody. The editor is where that is said aloud
 * (musician-status.js unmatchedNames). And there is one stage, so one
 * spotlight: a second one written before the first is over takes it.
 *
 * @return {Array<Object>}
 */
export function effectsAt( trackData, processed, time ) {
	const found = new Map();
	const add = ( record ) => found.set( record.kind + ':' + record.target, record );
	const ensemble = Object.keys( ( trackData && trackData.ensemble ) || {} );
	const carded = new Set( trackData && trackData.engineer ? [ ...ensemble, trackData.engineer ] : ensemble );
	const onACard = ( value ) => names( value ).filter( ( name ) => carded.has( name ) );
	const status = musicianEntries( processed );

	for ( const { time: t, arrangement: a } of entries( processed ) ) {
		if ( t > time ) {
			break;
		}
		const since = time - t;
		if ( ! a || since >= LONGEST ) {
			continue;
		}

		const flourish = bounded( a.flourishDuration, SPANS.flourish );
		if ( a.flourish && since < flourish ) {
			onACard( a.flourish ).forEach( ( target ) => add( {
				key: `flourish:${ target }:${ t }`, kind: 'flourish', target, start: t, end: t + flourish,
				color: a.flourishColor || 'coral',
				intensity: Number( a.flourishIntensity ) > 0 ? Number( a.flourishIntensity ) : 0.7,
				pulse: Number( a.flourishPulseSpeed ) > 0 ? Number( a.flourishPulseSpeed ) : 1.2,
			} ) );
		}

		const dark = bounded( a.spotlightBlackout, SPANS.blackout );
		const glow = Number( a.spotlightGlow ) === 0 ? 0 : bounded( a.spotlightGlow, SPANS.glow );
		const target = onACard( a.spotlight )[ 0 ];
		if ( target ) {
			// The latest one written is the only one there is, over or not.
			found.delete( 'spotlight' );
			if ( since < dark + glow ) {
				found.set( 'spotlight', {
					key: `spotlight:${ target }:${ t }`, kind: 'spotlight', target, start: t, end: t + dark + glow,
					dark: since < dark,
					color: a.spotlightColor || 'coral', intensity: 1, pulse: 2.6,
				} );
			}
		}

		const flash = bounded( a.bandFlashDuration, SPANS.bandFlash );
		if ( a.bandFlash && since < flash ) {
			add( {
				key: `bandFlash:${ t }`, kind: 'bandFlash', target: null, start: t, end: t + flash,
				color: a.bandFlashColor || 'coral',
				intensity: Number( a.bandFlashIntensity ) > 0 ? Number( a.bandFlashIntensity ) : 0.5,
				pulse: Number( a.bandFlashPulseSpeed ) > 0 ? Number( a.bandFlashPulseSpeed ) : 0.6,
			} );
		}

		// Somebody comes in: out until this marker, in from it. Not at the
		// top of the song, where nobody arrives; they are simply there.
		if ( t > 0 && a.musicians && since < SPANS.enter ) {
			ensemble
				.filter( ( name ) => statusAt( status, name, t, { exclusive: true } ) === 'out' && statusAt( status, name, t ) === 'in' )
				.forEach( ( name ) => add( {
					key: `enter:${ name }:${ t }`, kind: 'enter', target: name, start: t, end: t + SPANS.enter,
				} ) );
		}
	}

	return [ ...found.values() ];
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
