#!/usr/bin/env python3
"""Server for rabbithole shell: static files + PickiPedia proxy (strips X-Frame-Options)."""

import http.server
import urllib.request
import urllib.error
import json

PORT = 4000
WIKI = 'https://pickipedia.xyz'

# Headers to strip from proxied responses (allow iframe embedding)
STRIP_HEADERS = {'x-frame-options', 'content-security-policy'}

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/api-proxy'):
            self._proxy_api()
        elif self.path.startswith('/wiki/') or self.path.startswith('/w/') \
                or self.path.startswith('/load.php') \
                or self.path.startswith('/api.php') \
                or self.path.startswith('/index.php') \
                or self.path.startswith('/extensions/') \
                or self.path.startswith('/resources/') \
                or self.path.startswith('/skins/') \
                or self.path.startswith('/images/'):
            self._proxy_wiki()
        else:
            super().do_GET()

    def _proxy_api(self):
        qs = self.path.split('?', 1)[1] if '?' in self.path else 'action=releaselist&filter=ipfs&format=json'
        url = f'{WIKI}/api.php?{qs}'
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'RabbitholeShell/1.0'})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def _proxy_wiki(self):
        """Proxy PickiPedia pages, stripping headers that block iframe embedding."""
        qs = ''
        path = self.path
        if '?' in path:
            path, qs = path.split('?', 1)
            qs = '?' + qs
        url = f'{WIKI}{path}{qs}'
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'RabbitholeShell/1.0',
                'Accept': self.headers.get('Accept', '*/*'),
                'Accept-Encoding': 'identity',  # don't ask for gzip, we relay raw
            })
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
                content_type = resp.headers.get('Content-Type', 'text/html')

            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Access-Control-Allow-Origin', '*')
            # Relay cache headers if present
            for hdr in ('Cache-Control', 'ETag', 'Last-Modified'):
                val = resp.headers.get(hdr)
                if val:
                    self.send_header(hdr, val)
            self.end_headers()
            self.wfile.write(data)
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(str(e).encode())

if __name__ == '__main__':
    with http.server.HTTPServer(('0.0.0.0', PORT), Handler) as httpd:
        print(f'Serving on port {PORT}')
        httpd.serve_forever()
