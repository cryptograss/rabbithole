import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig( {
	test: {
		environment: 'node',
		include: [ 'tests/**/*.test.js' ],
	},
	resolve: {
		alias: {
			// The player imports these at module scope and webamp reads window
			// on import. The logic under test never calls either one.
			webamp: resolve( __dirname, 'tests/stubs/webamp.js' ),
			packery: resolve( __dirname, 'tests/stubs/packery.js' ),
		},
	},
} );
