from __future__ import annotations

import logging
import os
import zipfile
from typing import Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .exceptions import (
    VoltAPIError,
    VoltAuthenticationError,
    VoltConnectionError,
    VoltError,
    VoltNotFoundError,
    VoltPermissionError,
    VoltTimeoutError,
)

logger = logging.getLogger('voltsdk')

class HttpTransport:

    def __init__(
        self,
        base_url: str,
        secret_key: str,
        timeout: int = 30,
    ) -> None:
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self._team_id: str | None = None

        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {secret_key}',
            'Accept': 'application/json',
        })

        retry = Retry(
            total=3,
            backoff_factor=0.5,
            status_forcelist=[502, 503, 504],
            allowed_methods=['GET'],
        )
        adapter = HTTPAdapter(max_retries=retry)
        self.session.mount('http://', adapter)
        self.session.mount('https://', adapter)

    @property
    def team_id(self) -> str:
        if self._team_id is None:
            data = self.get('/teams/secret-keys/me')
            self._team_id = data.get('team')
        return self._team_id

    def get(self, path: str, params: dict[str, Any] | None = None) -> dict:
        return self._request('GET', path, params=params)

    def post(
        self,
        path: str,
        json: dict | None = None,
        params: dict[str, Any] | None = None,
    ) -> dict:
        return self._request('POST', path, json=json, params=params)

    def _request(self, method: str, path: str, **kwargs: Any) -> dict:
        url = f"{self.base_url}/{path.lstrip('/')}"
        kwargs.setdefault('timeout', self.timeout)

        try:
            response = self.session.request(method, url, **kwargs)
        except requests.ConnectionError as exc:
            raise VoltConnectionError(f'Cannot connect to {url}') from exc
        except requests.Timeout as exc:
            raise VoltTimeoutError(f'Request timed out: {url}') from exc

        if response.status_code >= 400:
            try:
                server_message = response.json().get('message') or response.text
            except Exception:
                server_message = response.text
            if response.status_code == 401:
                raise VoltAuthenticationError(401, server_message or 'Invalid or expired secret key', url)
            if response.status_code == 403:
                raise VoltPermissionError(403, server_message or 'Insufficient permissions', url)
            if response.status_code == 404:
                raise VoltNotFoundError(404, server_message or f'Resource not found: {path}', url)
            raise VoltAPIError(response.status_code, server_message or 'Unknown error', url)

        payload = response.json()
        if payload.get('status') != 'success':
            raise VoltAPIError(
                response.status_code,
                payload.get('message', 'Unknown error'),
                url,
            )
        return payload.get('data', {})

    def download_stream(
        self,
        path: str,
        fallback_name: str,
        dest: str = '.',
        params: dict[str, Any] | None = None,
    ) -> str:
        url = f"{self.base_url}/{path.lstrip('/')}"
        os.makedirs(dest, exist_ok=True)

        with self.session.get(
            url, stream=True, timeout=self.timeout, params=params,
        ) as response:
            if response.status_code >= 400:
                raise VoltAPIError(response.status_code, 'Download failed', url)

            cd = response.headers.get('Content-Disposition', '')
            if 'filename=' in cd:
                filename = cd.split('filename=')[-1].strip().strip('"').strip("'")
                filename = os.path.basename(filename) if filename else fallback_name
            else:
                filename = fallback_name

            file_path = os.path.join(dest, filename)
            total = int(response.headers.get('Content-Length', 0) or 0)
            downloaded = 0

            with open(file_path, 'wb') as fh:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        fh.write(chunk)
                        downloaded += len(chunk)

            logger.info('Downloaded %s (%d bytes)', filename, downloaded)

        return file_path

    @staticmethod
    def unzip_recursive(zip_path: str, *, max_depth: int = 16) -> str:
        if not zip_path.lower().endswith('.zip'):
            return zip_path

        extract_dir = zip_path[:-4]
        os.makedirs(extract_dir, exist_ok=True)

        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(extract_dir)

        for _ in range(max_depth):
            nested: list[str] = []
            for root, _dirs, files in os.walk(extract_dir):
                for fname in files:
                    if fname.lower().endswith('.zip'):
                        nested.append(os.path.join(root, fname))
            if not nested:
                break
            for nz in nested:
                sub_dir = nz[:-4]
                os.makedirs(sub_dir, exist_ok=True)
                with zipfile.ZipFile(nz, 'r') as zf:
                    zf.extractall(sub_dir)
                os.remove(nz)
        else:
            raise VoltError(
                f'Nested zip extraction exceeded {max_depth} levels for {zip_path!r}.'
            )

        return extract_dir
