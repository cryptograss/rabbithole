/**
 * The glow a card wears for a flourish, a spotlight or a band flash: a
 * stack of box-shadows in a named colour, at an intensity. Pure strings;
 * the stylesheet's keyframes read them from CSS variables on the card.
 */

const PRESETS = {
	coral: { primary: [ 255, 127, 80 ], secondary: [ 255, 99, 71 ], tertiary: [ 255, 69, 100 ], outer: [ 255, 20, 80 ] },
	red: { primary: [ 255, 60, 60 ], secondary: [ 220, 20, 60 ], tertiary: [ 178, 34, 34 ], outer: [ 139, 0, 0 ] },
	blue: { primary: [ 100, 149, 237 ], secondary: [ 65, 105, 225 ], tertiary: [ 30, 144, 255 ], outer: [ 0, 0, 205 ] },
	green: { primary: [ 50, 205, 50 ], secondary: [ 34, 139, 34 ], tertiary: [ 0, 128, 0 ], outer: [ 0, 100, 0 ] },
	gold: { primary: [ 255, 215, 0 ], secondary: [ 255, 193, 37 ], tertiary: [ 218, 165, 32 ], outer: [ 184, 134, 11 ] },
	purple: { primary: [ 147, 112, 219 ], secondary: [ 138, 43, 226 ], tertiary: [ 128, 0, 128 ], outer: [ 75, 0, 130 ] },
	brown: { primary: [ 205, 133, 63 ], secondary: [ 160, 82, 45 ], tertiary: [ 139, 69, 19 ], outer: [ 101, 67, 33 ] },
	white: { primary: [ 255, 255, 255 ], secondary: [ 245, 245, 245 ], tertiary: [ 220, 220, 220 ], outer: [ 192, 192, 192 ] },
	cyan: { primary: [ 0, 255, 255 ], secondary: [ 0, 206, 209 ], tertiary: [ 32, 178, 170 ], outer: [ 0, 139, 139 ] },
	orange: { primary: [ 255, 165, 0 ], secondary: [ 255, 140, 0 ], tertiary: [ 255, 69, 0 ], outer: [ 204, 85, 0 ] },
};

export function glowColors( name = 'coral' ) {
	return PRESETS[ String( name ).toLowerCase() ] || PRESETS.coral;
}

/** `{ min, max }`: the resting and peak box-shadow stacks. */
export function glowShadows( colorName = 'coral', intensity = 1.0 ) {
	const c = glowColors( colorName );
	const s = intensity;
	const [ pr, pg, pb ] = c.primary;
	const [ sr, sg, sb ] = c.secondary;
	const [ tr, tg, tb ] = c.tertiary;
	const [ or, og, ob ] = c.outer;
	const stack = ( k, a ) => [
		`0 0 0 ${ k * 1 * s }px rgb(${ pr }, ${ pg }, ${ pb })`,
		`0 0 ${ k * 5 * s }px ${ k * 2.5 * s }px rgba(${ pr }, ${ pg }, ${ pb }, ${ a[ 0 ] * s })`,
		`0 0 ${ k * 10 * s }px ${ k * 5 * s }px rgba(${ sr }, ${ sg }, ${ sb }, ${ a[ 1 ] * s })`,
		`0 0 ${ k * 15 * s }px ${ k * 7.5 * s }px rgba(${ tr }, ${ tg }, ${ tb }, ${ a[ 2 ] * s })`,
		`0 0 ${ k * 20 * s }px ${ k * 10 * s }px rgba(${ or }, ${ og }, ${ ob }, ${ a[ 3 ] * s })`,
	].join( ', ' );
	return {
		min: stack( 3, [ 0.8, 0.6, 0.4, 0.2 ] ),
		max: stack( 5, [ 1.0, 0.8, 0.6, 0.3 ] ),
	};
}
