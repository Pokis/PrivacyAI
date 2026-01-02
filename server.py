from http.server import HTTPServer, SimpleHTTPRequestHandler
import sys

class COOPCOEPServer(SimpleHTTPRequestHandler):
    def end_headers(self):
        # These headers are often required for high-performance features like SharedArrayBuffer
        # which window.ai likely depends on in newer Chrome versions.
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        SimpleHTTPRequestHandler.end_headers(self)

if __name__ == '__main__':
    port = 8000
    print(f"Starting server with COOP/COEP headers at http://localhost:{port}")
    httpd = HTTPServer(('localhost', port), COOPCOEPServer)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
