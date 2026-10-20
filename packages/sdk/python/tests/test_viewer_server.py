from __future__ import annotations

from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from voltsdk.viewer_server import ViewerRequestHandler


class ViewerServerTests(unittest.TestCase):
    def test_options_reflects_origin_for_credentialed_cors(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            handler = partial(ViewerRequestHandler, directory=tmp)
            server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()

            try:
                port = server.server_address[1]
                request = Request(
                    f'http://127.0.0.1:{port}/model.glb',
                    method='OPTIONS',
                    headers={
                        'Origin': 'https://app.voltcloud.dev',
                        'Access-Control-Request-Headers': 'authorization,x-trace-id',
                    },
                )

                with urlopen(request, timeout=5) as response:
                    self.assertEqual(response.status, 204)
                    self.assertEqual(
                        response.headers.get('Access-Control-Allow-Origin'),
                        'https://app.voltcloud.dev',
                    )
                    self.assertEqual(
                        response.headers.get('Access-Control-Allow-Credentials'),
                        'true',
                    )
                    self.assertEqual(
                        response.headers.get('Access-Control-Allow-Headers'),
                        'authorization,x-trace-id',
                    )
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=5)


if __name__ == '__main__':
    unittest.main()
