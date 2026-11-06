/*
 * Webamp, as the vendored UMD bundle left it on window.
 *
 * webamp 1.5.0 ships only `built/webamp.bundle.js`, a webpack UMD with no
 * "module" field, and jsDelivr's +esm transform of it served JavaScript that
 * did not parse: `import Webamp from 'webamp'` threw and the player sat on
 * "Loading player..." in production, silently (October 2026). So the bundle
 * lives in public/vendor/ and index.html loads it as a classic script, which
 * is what a UMD wrapper is for; this module is the one place the app reads
 * the global it leaves.
 */

export default function webampClass() {
	if ( typeof window === 'undefined' || typeof window.Webamp !== 'function' ) {
		throw new Error(
			'window.Webamp is missing: vendor/webamp.bundle.js did not load, or ' +
			'loaded after the app. It has to be a plain <script> in <head>.'
		);
	}
	return window.Webamp;
}
