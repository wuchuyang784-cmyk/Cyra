import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Utf8NoCacheHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".moc3": "application/octet-stream",
        ".model3.json": "application/json; charset=utf-8",
        ".physics3.json": "application/json; charset=utf-8",
        ".pose3.json": "application/json; charset=utf-8",
        ".exp3.json": "application/json; charset=utf-8",
        ".motion3.json": "application/json; charset=utf-8",
    }

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Serve Cyra frontend assets.")
    parser.add_argument("--port", type=int, default=5173)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Utf8NoCacheHandler)
    print(f"Serving frontend on http://127.0.0.1:{args.port}/")
    server.serve_forever()
