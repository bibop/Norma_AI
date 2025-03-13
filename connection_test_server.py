#!/usr/bin/env python3
import http.server
import socketserver

PORT = 3006
DIRECTORY = "."

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/' or self.path == '':
            self.path = '/connection_test.html'
        return http.server.SimpleHTTPRequestHandler.do_GET(self)

if __name__ == '__main__':
    Handler.extensions_map.update({
        '.html': 'text/html',
        '.js': 'application/javascript',
    })
    
    print(f"Starting HTTP server on http://localhost:{PORT}")
    print(f"Access the connection test page at: http://localhost:{PORT}")
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down the server...")
            httpd.shutdown()
