/*
 * ESM shim over the vendored Webamp UMD bundle.
 *
 * webamp 1.5.0 ships only `built/webamp.bundle.js` — a webpack UMD with no
 * "module" field in its package.json. That is why the importmap used to point
 * at jsdelivr's `/+esm`, which transforms CJS/UMD into ESM on the fly.
 *
 * That transform is broken: cdn.jsdelivr.net/npm/webamp@1.5.0/+esm serves
 * JavaScript that does not parse ("SyntaxError: Unexpected token '}'"), so
 * `import Webamp from 'webamp'` threw, webamp-chartifacts.js never loaded, and
 * the shell sat on "Loading player..." — in production, silently, for however
 * long. A dependency we do not build and do not host broke the one feature the
 * page exists for.
 *
 * So the bundle is vendored and loaded as a classic script, which is what its
 * UMD wrapper is for: `root["Webamp"] = factory()` against window. Classic
 * scripts in <head> run before module scripts, which are deferred by default,
 * so the global is there by the time anything imports this.
 */

if ( typeof window.Webamp !== 'function' ) {
	throw new Error(
		'window.Webamp is missing: vendor/webamp.bundle.js did not load, or ' +
		'loaded after the module that imports it. It has to be a plain ' +
		'<script> in <head>, before the importmap.'
	);
}

export default window.Webamp;
