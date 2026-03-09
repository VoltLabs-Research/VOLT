from typing import Any, Dict, Optional
import os
import requests
import zipfile


class VoltClient:
    def __init__(
        self,
        secret_key: str,
        base_url: Optional[str] = None,
        timeout: int = 30
    ) -> None:
        if not secret_key:
            raise ValueError('secret_key is required')

        if not base_url:
            raise ValueError('base_url is required')

        self.secret_key = secret_key
        self.base_url = base_url
        self.timeout = timeout

        self._secret_key_info: Optional[Dict[str, Any]] = None
        self._team_id: Optional[str] = None

        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {secret_key}',
            'Accept': 'application/json'
        })

        self._setup_client()

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None
    ) -> Any:
        response = self._send(
            method,
            path,
            params=params
        )

        payload = response.json()
        if payload.get('status') != 'success':
            raise RuntimeError(payload.get('message') or 'Volt API request faield')

        return payload.get('data')

    def _send(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        stream: bool = False
    ) -> requests.Response:
        url = f"{self.base_url.rstrip('/')}/{path.lstrip('/')}"
        response = self.session.request(
            method=method,
            url=url,
            params=params,
            timeout=self.timeout,
            stream=stream
        )

        if response.status_code >= 400:
            try:
                payload = response.json()
                message = payload.get('message') or response.text
            except Exception:
                message = response.text or response.reason

            raise requests.HTTPError(
                f'{response.status_code} {response.reason}: {message} ({response.url})',
                response=response
            )

        return response

    def _setup_client(self) -> Dict[str, Any]:
        data = self._request('GET', '/team/secret-keys/me')

        self._secret_key_info = data
        self._team_id = data.get('team')
        return data

    def _resolve_download_filename(
        self,
        response: requests.Response,
        fallback_name: str
    ) -> str:
        content_disposition = response.headers.get('Content-Disposition', '')
        if 'filename=' not in content_disposition:
            return fallback_name

        filename = content_disposition.split('filename=')[-1].strip().strip('"').strip("'")
        if not filename:
            return fallback_name

        return os.path.basename(filename)

    def _download_stream(
        self,
        path: str,
        fallback_name: str
    ) -> str:
        with self._send('GET', path, stream=True) as response:
            downloads_dir = './downloads'
            os.makedirs(downloads_dir, exist_ok=True)

            filename = self._resolve_download_filename(response, fallback_name)
            file_path = os.path.join(downloads_dir, filename)
            total_bytes = int(response.headers.get('Content-Length', 0) or 0)
            downloaded_bytes = 0

            with open(file_path, 'wb') as file:
                for chunk in response.iter_content(chunk_size=8192):
                    if not chunk:
                        continue

                    file.write(chunk)
                    downloaded_bytes += len(chunk)

                    if total_bytes > 0:
                        percent = (downloaded_bytes * 100) / total_bytes
                        print(
                            f'\rDownloading {filename}: {percent:.2f}% ({downloaded_bytes}/{total_bytes} bytes)',
                            end='',
                            flush=True
                        )
                    else:
                        print(
                            f'\rDownloading {filename}: {downloaded_bytes} bytes',
                            end='',
                            flush=True
                        )

            print()

        return file_path

    def _extract_zip_file(self, zip_path: str) -> str:
        extract_dir = zip_path[:-4]
        os.makedirs(extract_dir, exist_ok=True)

        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)

        os.remove(zip_path)
        return extract_dir

    def _unzip_recursive(self, zip_path: str) -> str:
        if not zip_path.lower().endswith('.zip'):
            return zip_path

        root_dir = self._extract_zip_file(zip_path)
        while True:
            zip_files = []
            for current_root, _, files in os.walk(root_dir):
                for file_name in files:
                    if file_name.lower().endswith('.zip'):
                        zip_files.append(os.path.join(current_root, file_name))

            if not zip_files:
                break

            total_zip_files = len(zip_files)
            for index, current_zip_path in enumerate(zip_files, start=1):
                print(
                    f'Extracting nested zip {index}/{total_zip_files}: {os.path.basename(current_zip_path)}',
                    flush=True
                )
                self._extract_zip_file(current_zip_path)

        return root_dir

    def list_analyses(
        self,
        trajectory_id: str,
        page: int = 1,
        limit: int = 1000
    ) -> Dict[str, Any]:
        response = self._request(
            'GET',
            f'/analysis/{self._team_id}/trajectory/{trajectory_id}',
            params={'page': page, 'limit': limit}
        )

        return response.get('data')

    def list_analysis_results(
        self,
        analysis_id: str,
        page: int = 1,
        limit: int = 1000
    ):
        response = self._request(
            'GET',
            f'/plugin/{self._team_id}/listing/analysis/{analysis_id}',
            params={'page': page, 'limit': limit}
        )

        return response.get('data')

    def find_analysis_by_id(self, analysis_id: str):
        return self._request(
            'GET',
            f'/analysis/{self._team_id}/{analysis_id}'
        )

    def _resolve_trajectory_id(self, analysis_id: str) -> str:
        analysis = self.find_analysis_by_id(analysis_id)
        trajectory_id = analysis.get('trajectory')
        if not trajectory_id:
            raise RuntimeError('analysis trajectory not found')

        return trajectory_id

    def download_analysis_artifacts(
        self,
        analysis_id: str,
        unzip: bool = True
    ):
        zip_path = self._download_stream(
            f'/plugin/{self._team_id}/exposure/export/analysis/{analysis_id}',
            f'analysis-{analysis_id}-artifacts.zip'
        )

        if unzip:
            return self._unzip_recursive(zip_path)

        return zip_path

    def download_plugin_results_file(
        self,
        analysis_id: str,
        unzip: bool = True
    ):
        return self.download_analysis_artifacts(analysis_id, unzip=unzip)

    def download_frame_glb(
        self,
        analysis_id: str,
        timestep: int
    ):
        trajectory_id = self._resolve_trajectory_id(analysis_id)

        return self._download_stream(
            f'/trajectory/{self._team_id}/{trajectory_id}/{timestep}/{analysis_id}',
            f'frame-{analysis_id}-{timestep}.glb'
        )

    def download_plugin_exported_glb(
        self,
        analysis_id: str,
        exposure_id: str,
        timestep: int
    ):
        trajectory_id = self._resolve_trajectory_id(analysis_id)

        return self._download_stream(
            f'/plugin/{self._team_id}/exposure/glb/{trajectory_id}/{analysis_id}/{exposure_id}/{timestep}',
            f'plugin-glb-{analysis_id}-{exposure_id}-{timestep}.glb'
        )
