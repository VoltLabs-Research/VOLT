"""Minimal static file server used by ``voltsdk.open_in_volt``."""

from __future__ import annotations

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class ViewerRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def log_message(self, _format: str, *_args: object) -> None:
        return


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description='Serve VoltSDK viewer assets.')
    parser.add_argument('--root', required=True)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, required=True)
    args = parser.parse_args(argv)

    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        raise SystemExit(f'Viewer root does not exist: {root}')

    handler = partial(ViewerRequestHandler, directory=str(root))
    with ThreadingHTTPServer((args.host, args.port), handler) as server:
        server.serve_forever()

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
