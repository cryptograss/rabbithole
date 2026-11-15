/**
 * The colours a chart can name for a flourish, a spotlight or a band flash
 * (`flourishColor: gold`), as CSS colours.
 *
 * One colour each. The stylesheet makes the rest of a glow out of it --
 * the soft edge, the wash over the card -- so there is one place a colour
 * is written and one place a glow is drawn. This used to hand back a stack
 * of five box-shadows per colour for a keyframe to animate, which is the
 * most expensive way a browser has of drawing a light.
 */

const COLORS = {
	coral: 'rgb(255 127 80)',
	red: 'rgb(255 60 60)',
	blue: 'rgb(100 149 237)',
	green: 'rgb(50 205 50)',
	gold: 'rgb(255 205 40)',
	purple: 'rgb(147 112 219)',
	brown: 'rgb(205 133 63)',
	white: 'rgb(255 255 255)',
	cyan: 'rgb(0 215 225)',
	orange: 'rgb(255 150 20)',
};

/** The colour a chart named, or coral when it names none, or one nobody knows. */
export function fxColor( name = 'coral' ) {
	return COLORS[ String( name ).toLowerCase() ] || COLORS.coral;
}
