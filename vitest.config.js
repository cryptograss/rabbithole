import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig( {
	plugins: [ vue() ],
	test: {
		// Pure modules run under node; component tests ask for a DOM with a
		// `// @vitest-environment happy-dom` comment at the top of the file.
		environment: 'node',
		include: [ 'tests/**/*.test.js' ],
	},
} );
