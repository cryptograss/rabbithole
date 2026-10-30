/**
 * Trails: how you get from one song to another through the people who played
 * on both.
 *
 * This is the thing the project is named after. The wiki already knows who
 * played what on which track -- `Has performer` subobjects, one per person per
 * song, carrying the instrument -- so a trail is a path through that graph,
 * and every hop is true because somebody actually played it.
 *
 * Pure functions, no DOM and no network: the shell fetches, this decides.
 */

/**
 * Turn an SMW `#ask` result set into a graph.
 *
 * @param {Object} results The `query.results` object from api.php action=ask,
 *   keyed by subobject id, each with printouts for Has performer and
 *   Has instrument.
 * @return {{band: Object, plays: Object}} band maps a song to its players and
 *   their instruments; plays maps a person to the songs they are on.
 */
export function buildGraph( results ) {
	const band = {};
	const plays = {};

	for ( const [ key, value ] of Object.entries( results || {} ) ) {
		// Subobject ids look like "Song:August# 4d6a4d21...".
		const song = key.split( '#' )[ 0 ].trim();
		if ( !song ) {
			continue;
		}

		const printouts = value.printouts || {};
		const instruments = printouts[ 'Has instrument' ] || [];

		for ( const performer of printouts[ 'Has performer' ] || [] ) {
			const name = typeof performer === 'string' ? performer : performer.fulltext;
			if ( !name ) {
				continue;
			}

			band[ song ] = band[ song ] || {};
			band[ song ][ name ] = instruments.slice();

			plays[ name ] = plays[ name ] || [];
			if ( !plays[ name ].includes( song ) ) {
				plays[ name ].push( song );
			}
		}
	}

	return { band, plays };
}

/**
 * How many songs each person is on.
 *
 * @param {Object} graph From buildGraph().
 * @return {Object} person to song count.
 */
export function reach( graph ) {
	const counts = {};
	for ( const [ person, songs ] of Object.entries( graph.plays ) ) {
		counts[ person ] = songs.length;
	}
	return counts;
}

/**
 * Find a trail from one song to another.
 *
 * Not plain shortest-path, and the difference matters. One person can be on
 * nearly every song in the catalogue -- on PickiPedia today Justin Myles
 * Holmes is on 45 of 149 edges -- so the shortest route is almost always one
 * hop through the hub. That is true and it is boring, and a rabbithole that
 * always answers "through Justin" is not a rabbithole.
 *
 * So hops are weighted: a hop through somebody who plays on a lot of songs
 * costs more than a hop through somebody who plays on a few. The cheapest
 * trail is the one that introduces people, rather than the one with fewest
 * steps.
 *
 * @param {Object} graph From buildGraph().
 * @param {string} from Song page title.
 * @param {string} to Song page title.
 * @param {Object} [options]
 * @param {string[]} [options.avoid] People never to route through.
 * @param {number} [options.hubPenalty] How much a well-connected person costs.
 *   0 gives plain shortest-path. The default of 2 is tuned so that two hops
 *   through people on two songs each (1+2, then 1+2, is 6) beats one hop
 *   through somebody on four songs (1+2*3, is 7). At a penalty of 1 those tie
 *   at 4, and a tie goes to the shorter route -- which is the hub, which is
 *   the answer this whole weighting exists to avoid.
 * @param {number} [options.maxHops] Give up past this many hops.
 * @return {?Array<{from: string, via: string, instrument: string, to: string}>}
 *   The hops in order, or null when there is no route.
 */
export function findTrail( graph, from, to, options = {} ) {
	const { band, plays } = graph;
	const avoid = new Set( options.avoid || [] );
	const hubPenalty = options.hubPenalty === undefined ? 2 : options.hubPenalty;
	const maxHops = options.maxHops || 6;

	if ( !band[ from ] || !band[ to ] ) {
		return null;
	}
	if ( from === to ) {
		return [];
	}

	// Uniform-cost search. The frontier is small enough that a sorted array
	// beats the ceremony of a heap, and staying simple keeps it testable.
	const best = { [ from ]: 0 };
	const cameBy = {};
	let frontier = [ { song: from, cost: 0, hops: 0 } ];

	while ( frontier.length ) {
		frontier.sort( ( a, b ) => a.cost - b.cost );
		const current = frontier.shift();

		if ( current.song === to ) {
			const hops = [];
			let cursor = to;
			while ( cameBy[ cursor ] ) {
				const step = cameBy[ cursor ];
				hops.push( {
					from: step.from,
					via: step.via,
					instrument: step.instrument,
					to: cursor,
				} );
				cursor = step.from;
			}
			return hops.reverse();
		}

		if ( current.hops >= maxHops ) {
			continue;
		}

		for ( const [ person, instruments ] of Object.entries( band[ current.song ] || {} ) ) {
			if ( avoid.has( person ) ) {
				continue;
			}

			const cost = current.cost + 1 + hubPenalty * ( ( plays[ person ] || [] ).length - 1 );

			for ( const nextSong of plays[ person ] || [] ) {
				if ( nextSong === current.song ) {
					continue;
				}
				if ( best[ nextSong ] !== undefined && best[ nextSong ] <= cost ) {
					continue;
				}

				best[ nextSong ] = cost;
				cameBy[ nextSong ] = {
					from: current.song,
					via: person,
					instrument: instruments[ 0 ] || '',
				};
				frontier.push( { song: nextSong, cost, hops: current.hops + 1 } );
			}
		}
	}

	return null;
}

/**
 * The songs a trail passes through, in playing order.
 *
 * @param {string} from The song the trail starts at.
 * @param {Array} hops From findTrail().
 * @return {string[]} Song titles, starting with `from`.
 */
export function trailSongs( from, hops ) {
	return [ from, ...( hops || [] ).map( ( hop ) => hop.to ) ];
}
