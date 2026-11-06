import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

/*
 * Rabbithole is an installable app, served at /rabbithole/ on pickipedia.xyz
 * from the dist/ this builds (maybelle-config, rabbithole-shell role). The
 * wiki's API is same-origin there, so every request in the app is a relative
 * path; in development the same paths are proxied to the real wiki below.
 */

const WIKI = 'https://pickipedia.xyz';

const proxied = ( paths, extra = {} ) => Object.fromEntries(
	paths.map( ( p ) => [ p, { target: WIKI, changeOrigin: true, secure: true, ...extra } ] )
);

export default defineConfig( {
	base: '/rabbithole/',

	plugins: [
		vue(),
		VitePWA( {
			registerType: 'autoUpdate',
			includeAssets: [ 'icons/apple-touch-icon.png' ],
			manifest: {
				name: 'Rabbithole',
				short_name: 'Rabbithole',
				description: 'Discover music by connections, not algorithms. Follow the people who played on a record down the rabbithole.',
				theme_color: '#4a7c59',
				background_color: '#f5f5f5',
				display: 'standalone',
				orientation: 'any',
				icons: [
					{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
					{ src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
				],
			},
			workbox: {
				// Webamp's vendored bundle is 1.6 MB; the default cap is 2 MB,
				// which leaves no room for it to grow.
				maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
				globPatterns: [ '**/*.{js,css,html,png,svg,ico,woff2}' ],
				// A deep link inside the app's own scope opens the app. The
				// wiki's paths (/wiki/, /api.php) are outside /rabbithole/ and
				// never reach this worker.
				navigateFallback: '/rabbithole/index.html',
				runtimeCaching: [
					{
						// Release pages, metadata, parsed articles: fresh when
						// the network is there, the last copy when it is not.
						urlPattern: ( { url } ) => url.pathname === '/api.php',
						handler: 'NetworkFirst',
						method: 'GET',
						options: {
							cacheName: 'wiki-api',
							networkTimeoutSeconds: 6,
							expiration: { maxEntries: 400, maxAgeSeconds: 7 * 24 * 3600 },
						},
					},
					{
						// MediaWiki's stylesheets for the pane, and its images.
						urlPattern: ( { url } ) => url.pathname === '/load.php' || url.pathname.startsWith( '/images/' ),
						handler: 'StaleWhileRevalidate',
						options: { cacheName: 'wiki-assets', expiration: { maxEntries: 200 } },
					},
					{
						// Waveform peaks from delivery-kid never change for a CID.
						urlPattern: ( { url } ) => url.hostname === 'delivery-kid.cryptograss.live' && url.pathname.startsWith( '/peaks/' ),
						handler: 'CacheFirst',
						options: { cacheName: 'peaks', expiration: { maxEntries: 200, maxAgeSeconds: 90 * 24 * 3600 } },
					},
					{
						// The web fonts.
						urlPattern: ( { url } ) => url.hostname.endsWith( 'gstatic.com' ) || url.hostname.endsWith( 'googleapis.com' ),
						handler: 'CacheFirst',
						options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 3600 } },
					},
					// The audio itself is not cached by the worker: it streams
					// from the IPFS gateway with range requests, and a 30 MB
					// FLAC in the cache is a decision a person should make.
					// Bring-your-own-files and remoteStorage come next.
				],
			},
		} ),
	],

	build: {
		outDir: 'dist',
		sourcemap: true,
	},

	server: {
		port: 5173,
		allowedHosts: [
			'justin0.hunter.cryptograss.live',
			'justin1.hunter.cryptograss.live',
			'justin2.hunter.cryptograss.live',
			'skyler0.hunter.cryptograss.live',
			'skyler1.hunter.cryptograss.live',
			'skyler2.hunter.cryptograss.live',
			'magent0.hunter.cryptograss.live',
			'localhost',
			'127.0.0.1',
		],
		proxy: {
			...proxied( [ '/api.php', '/index.php', '/load.php', '/wiki', '/images', '/resources', '/extensions', '/assets', '/skins' ] ),
			'/piki': {
				target: WIKI,
				changeOrigin: true,
				secure: true,
				rewrite: ( path ) => path.replace( /^\/piki/, '' ),
			},
		},
	},
} );
