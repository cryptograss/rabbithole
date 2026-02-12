import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.js'),
            name: 'Rabbithole',
            fileName: (format) => `rabbithole.${format}.js`
        },
        rollupOptions: {
            // Externalize deps that shouldn't be bundled
            external: ['webamp'],
            output: {
                globals: {
                    webamp: 'Webamp'
                }
            }
        }
    },
    server: {
        port: 5173,
        open: true,
        allowedHosts: [
            'justin0.hunter.cryptograss.live',
            'justin1.hunter.cryptograss.live',
            'justin2.hunter.cryptograss.live',
            'skyler0.hunter.cryptograss.live',
            'skyler1.hunter.cryptograss.live',
            'skyler2.hunter.cryptograss.live',
            'localhost',
            '127.0.0.1'
        ],
        proxy: {
            '/audio': {
                target: 'https://justinholmes.com',
                changeOrigin: true,
                secure: true
            },
            '/piki': {
                target: 'https://pickipedia.xyz',
                changeOrigin: true,
                secure: true,
                rewrite: (path) => path.replace(/^\/piki/, ''),
                configure: (proxy) => {
                    proxy.on('proxyRes', (proxyRes) => {
                        delete proxyRes.headers['x-frame-options'];
                        delete proxyRes.headers['content-security-policy'];
                    });
                }
            },
            // PickiPedia assets - images, resources, extensions
            '/images': {
                target: 'https://pickipedia.xyz',
                changeOrigin: true,
                secure: true
            },
            '/resources': {
                target: 'https://pickipedia.xyz',
                changeOrigin: true,
                secure: true
            },
            '/extensions': {
                target: 'https://pickipedia.xyz',
                changeOrigin: true,
                secure: true
            }
        }
    }
});
