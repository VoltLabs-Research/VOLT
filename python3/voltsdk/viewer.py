"""Open local or remote GLB assets in the Volt canvas."""

from __future__ import annotations

import base64
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import uuid
import webbrowser
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import quote, urlencode, urljoin, urlparse

import requests

_LOCAL_VIEWER_HOST = '127.0.0.1'
_LOCAL_JUPYTER_URL = 'http://127.0.0.1:8888'
_DEFAULT_VOLT_APP_URL = 'https://app.voltcloud.dev'
_NOTEBOOK_VIEWER_ROOT = PurePosixPath('.voltsdk-viewer')


Pathish = str | os.PathLike[str]
ViewerSource = Pathish | Sequence[Pathish] | Mapping[int, Pathish]


@dataclass(frozen=True)
class _FrameSource:
    value: str | Path
    is_url: bool
    label: str | None
    timestep: int | None


@dataclass(frozen=True)
class _StagedView:
    root: Path | None = None
    direct_url: str | None = None
    asset_rel_path: PurePosixPath | None = None
    manifest_rel_path: PurePosixPath | None = None


def open_in_volt(
    source: ViewerSource,
    *,
    title: str | None = None,
    volt_url: str | None = None,
    open_browser: bool = True,
) -> str:
    """Open one GLB or a GLB sequence in the Volt canvas.

    ``source`` can be:

    * a single local path or remote URL
    * a sequence of local paths / remote URLs
    * a mapping ``{timestep: path_or_url}``
    """

    frames = _normalize_source(source)
    if _can_use_jupyter_proxy():
        route = _build_notebook_viewer_route(frames, title)
    else:
        route = _build_local_viewer_route(frames, title)
    return _open_browser_url(route, volt_url=volt_url, open_browser=open_browser)


def open_canvas_view(
    *,
    trajectory_id: str | None = None,
    analysis_id: str | None = None,
    exposure_id: str | None = None,
    timestep: int | None = None,
    volt_url: str | None = None,
    open_browser: bool = True,
) -> str:
    route = _build_canvas_route(
        trajectory_id=trajectory_id,
        analysis_id=analysis_id,
        exposure_id=exposure_id,
        timestep=timestep,
    )
    return _open_browser_url(route, volt_url=volt_url, open_browser=open_browser)


def _build_canvas_route(
    *,
    trajectory_id: str | None = None,
    analysis_id: str | None = None,
    exposure_id: str | None = None,
    timestep: int | None = None,
) -> str:
    base_path = '/canvas/glb' if not trajectory_id else f'/canvas/{trajectory_id}'
    params: dict[str, Any] = {}
    if analysis_id and analysis_id != 'default':
        params['analysisId'] = analysis_id
    if exposure_id:
        params['timelineExposure'] = exposure_id
    if timestep is not None:
        params['timestep'] = int(timestep)

    if not params:
        return base_path
    return f'{base_path}?{urlencode(params)}'


def _build_local_viewer_route(frames: list[_FrameSource], title: str | None) -> str:
    stage_root = Path(tempfile.mkdtemp(prefix='voltsdk-viewer-'))
    staged = _stage_view(frames, title=title, stage_root=stage_root)
    if staged.direct_url:
        return _build_glb_route(url=staged.direct_url)

    if staged.root is None:
        raise RuntimeError('Local viewer stage did not produce a root directory.')

    base_url = _start_local_viewer_server(staged.root)
    if staged.asset_rel_path is not None:
        return _build_glb_route(url=f'{base_url}/{_encode_posix_path(staged.asset_rel_path)}')
    if staged.manifest_rel_path is not None:
        return _build_glb_route(manifest=f'{base_url}/{_encode_posix_path(staged.manifest_rel_path)}')
    raise RuntimeError('Local viewer stage did not produce a renderable target.')


def _build_notebook_viewer_route(frames: list[_FrameSource], title: str | None) -> str:
    if len(frames) == 1 and frames[0].is_url:
        return _build_glb_route(url=str(frames[0].value))

    notebook_root = _infer_notebook_root()
    if notebook_root is not None:
        stage_root = notebook_root / _NOTEBOOK_VIEWER_ROOT / uuid.uuid4().hex
        staged = _stage_view(frames, title=title, stage_root=stage_root, copy_files=True)
        if staged.direct_url:
            return _build_glb_route(url=staged.direct_url)

        if staged.asset_rel_path is not None:
            public_url = _build_jupyter_file_url(stage_root / staged.asset_rel_path, notebook_root)
            return _build_glb_route(url=public_url)

        if staged.manifest_rel_path is not None:
            public_url = _build_jupyter_file_url(stage_root / staged.manifest_rel_path, notebook_root)
            return _build_glb_route(manifest=public_url)

        raise RuntimeError('Notebook viewer stage did not produce a renderable target.')

    temp_root = Path(tempfile.mkdtemp(prefix='voltsdk-notebook-viewer-'))
    staged = _stage_view(frames, title=title, stage_root=temp_root)
    if staged.direct_url:
        return _build_glb_route(url=staged.direct_url)

    notebook_prefix = _NOTEBOOK_VIEWER_ROOT / uuid.uuid4().hex
    _upload_stage_to_jupyter(staged.root or temp_root, notebook_prefix)

    if staged.asset_rel_path is not None:
        return _build_glb_route(url=_build_jupyter_file_url(notebook_prefix / staged.asset_rel_path))
    if staged.manifest_rel_path is not None:
        return _build_glb_route(manifest=_build_jupyter_file_url(notebook_prefix / staged.manifest_rel_path))
    raise RuntimeError('Notebook viewer stage did not produce a renderable target.')


def _build_glb_route(*, url: str | None = None, manifest: str | None = None) -> str:
    params: dict[str, str] = {}
    if manifest:
        params['manifest'] = manifest
    elif url:
        params['url'] = url
    else:
        raise ValueError('Either url or manifest must be provided.')
    return f'/canvas/glb?{urlencode(params)}'


def _normalize_source(source: ViewerSource) -> list[_FrameSource]:
    if isinstance(source, Mapping):
        frames: list[_FrameSource] = []
        for timestep, value in sorted(source.items(), key=lambda item: item[0]):
            frames.append(_normalize_frame(value, timestep=int(timestep)))
        if frames:
            return frames
        raise ValueError('Viewer source mapping is empty.')

    if isinstance(source, (str, os.PathLike)):
        return [_normalize_frame(source)]

    if isinstance(source, Sequence):
        frames = [_normalize_frame(value, timestep=index) for index, value in enumerate(source)]
        if frames:
            return frames
        raise ValueError('Viewer source sequence is empty.')

    raise TypeError('Viewer source must be a path, URL, sequence, or timestep mapping.')


def _normalize_frame(value: Pathish, *, timestep: int | None = None) -> _FrameSource:
    if isinstance(value, os.PathLike):
        path = Path(value).expanduser().resolve()
        if not path.is_file():
            raise FileNotFoundError(f'Viewer asset not found: {path}')
        return _FrameSource(value=path, is_url=False, label=path.name, timestep=timestep)

    if isinstance(value, str):
        if _is_url(value):
            parsed = urlparse(value)
            label = PurePosixPath(parsed.path).name or None
            return _FrameSource(value=value, is_url=True, label=label, timestep=timestep)

        path = Path(value).expanduser().resolve()
        if not path.is_file():
            raise FileNotFoundError(f'Viewer asset not found: {path}')
        return _FrameSource(value=path, is_url=False, label=path.name, timestep=timestep)

    raise TypeError(f'Unsupported viewer asset type: {type(value)!r}')


def _is_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {'http', 'https', 'data', 'blob'}


def _stage_view(
    frames: list[_FrameSource],
    *,
    title: str | None,
    stage_root: Path,
    copy_files: bool = False,
) -> _StagedView:
    if len(frames) == 1 and frames[0].is_url:
        return _StagedView(direct_url=str(frames[0].value))

    stage_root.mkdir(parents=True, exist_ok=True)
    assets_dir = stage_root / 'assets'
    manifest_frames: list[dict[str, Any]] = []
    asset_rel_path: PurePosixPath | None = None

    for index, frame in enumerate(frames):
        if frame.is_url:
            frame_url = str(frame.value)
        else:
            source_path = Path(frame.value)
            target_name = _build_staged_name(index, source_path.name, len(frames))
            target_path = assets_dir / target_name
            target_path.parent.mkdir(parents=True, exist_ok=True)
            _link_or_copy(source_path, target_path, copy_files=copy_files)
            relative_path = PurePosixPath('assets') / target_name
            frame_url = relative_path.as_posix()
            if len(frames) == 1:
                asset_rel_path = relative_path

        manifest_frame: dict[str, Any] = {
            'url': frame_url,
        }
        if frame.label:
            manifest_frame['label'] = frame.label
        if frame.timestep is not None:
            manifest_frame['timestep'] = frame.timestep
        manifest_frames.append(manifest_frame)

    if len(frames) == 1:
        if frames[0].is_url:
            return _StagedView(direct_url=str(frames[0].value))
        if asset_rel_path is None:
            raise RuntimeError('Single local viewer asset was not staged.')
        return _StagedView(root=stage_root, asset_rel_path=asset_rel_path)

    manifest = {
        'title': title or 'VoltSDK scene',
        'initialFrame': 0,
        'frames': manifest_frames,
    }
    manifest_rel_path = PurePosixPath('manifest.json')
    (stage_root / manifest_rel_path).write_text(
        json.dumps(manifest, indent=2, ensure_ascii=True) + '\n',
        encoding='utf-8',
    )
    return _StagedView(root=stage_root, manifest_rel_path=manifest_rel_path)


def _build_staged_name(index: int, original_name: str, frame_count: int) -> str:
    if frame_count == 1:
        return original_name
    return f'{index:04d}-{original_name}'


def _link_or_copy(source: Path, target: Path, *, copy_files: bool) -> None:
    if copy_files:
        shutil.copy2(source, target)
        return

    try:
        target.symlink_to(source)
    except OSError:
        shutil.copy2(source, target)


def _start_local_viewer_server(root: Path) -> str:
    port = _find_free_port()
    command = [
        sys.executable,
        '-m',
        'voltsdk.viewer_server',
        '--root',
        str(root),
        '--host',
        _LOCAL_VIEWER_HOST,
        '--port',
        str(port),
    ]
    subprocess.Popen(
        command,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
        start_new_session=True,
    )
    _wait_for_port(_LOCAL_VIEWER_HOST, port)
    return f'http://{_LOCAL_VIEWER_HOST}:{port}'


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((_LOCAL_VIEWER_HOST, 0))
        return int(sock.getsockname()[1])


def _wait_for_port(host: str, port: int, timeout: float = 5.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.25)
            if sock.connect_ex((host, port)) == 0:
                return
        time.sleep(0.05)
    raise TimeoutError(f'Viewer server did not start on {host}:{port}.')


def _encode_posix_path(path: PurePosixPath | str) -> str:
    return '/'.join(quote(part) for part in PurePosixPath(path).parts if part not in {'', '.'})


def _can_use_jupyter_proxy() -> bool:
    return _in_notebook() and bool(os.environ.get('VOLT_PUBLIC_BASE_PATH')) and bool(os.environ.get('JUPYTER_TOKEN'))


def _in_notebook() -> bool:
    try:
        from IPython import get_ipython

        shell = get_ipython()
        return shell is not None and shell.__class__.__name__ == 'ZMQInteractiveShell'
    except Exception:
        return False


def _infer_notebook_root() -> Path | None:
    notebook_path = os.environ.get('VOLT_NOTEBOOK_PATH')
    if not notebook_path:
        return None

    notebook_rel = Path(notebook_path)
    cwd = Path.cwd().resolve()
    for candidate_root in (cwd, *cwd.parents):
        if (candidate_root / notebook_rel).is_file():
            return candidate_root
    return None


def _build_jupyter_file_url(path: Path | PurePosixPath, notebook_root: Path | None = None) -> str:
    public_base = _require_env('VOLT_PUBLIC_BASE_PATH').rstrip('/')
    if notebook_root is None:
        rel_path = PurePosixPath(path)
    else:
        rel_path = PurePosixPath(Path(path).resolve().relative_to(notebook_root).as_posix())
    return f'{public_base}/files/{_encode_posix_path(rel_path)}'


def _upload_stage_to_jupyter(stage_root: Path, notebook_prefix: PurePosixPath) -> None:
    session = requests.Session()
    session.headers.update({'Authorization': f'token {_require_env("JUPYTER_TOKEN")}'})

    directories = sorted(
        [path for path in stage_root.rglob('*') if path.is_dir()],
        key=lambda path: len(path.relative_to(stage_root).parts),
    )
    _jupyter_ensure_directory(session, notebook_prefix)
    for directory in directories:
        rel_path = notebook_prefix / PurePosixPath(directory.relative_to(stage_root).as_posix())
        _jupyter_ensure_directory(session, rel_path)

    for file_path in sorted(path for path in stage_root.rglob('*') if path.is_file()):
        rel_path = notebook_prefix / PurePosixPath(file_path.relative_to(stage_root).as_posix())
        _jupyter_upload_file(session, rel_path, file_path)


def _jupyter_ensure_directory(session: requests.Session, rel_path: PurePosixPath) -> None:
    parts = [part for part in rel_path.parts if part not in {'', '.'}]
    current = PurePosixPath('.')
    for part in parts:
        current = current / part
        response = session.put(
            _jupyter_contents_url(current),
            json={'type': 'directory'},
            timeout=30,
        )
        if response.status_code not in {200, 201}:
            raise RuntimeError(f'Could not create notebook directory {current}: {response.text}')


def _jupyter_upload_file(session: requests.Session, rel_path: PurePosixPath, source_path: Path) -> None:
    encoded_content = base64.b64encode(source_path.read_bytes()).decode('ascii')
    response = session.put(
        _jupyter_contents_url(rel_path),
        json={
            'type': 'file',
            'format': 'base64',
            'content': encoded_content,
        },
        timeout=120,
    )
    if response.status_code not in {200, 201}:
        raise RuntimeError(f'Could not upload notebook file {rel_path}: {response.text}')


def _jupyter_contents_url(rel_path: PurePosixPath) -> str:
    base_path = _require_env('VOLT_PUBLIC_BASE_PATH').rstrip('/')
    rel = _encode_posix_path(rel_path)
    return f'{_LOCAL_JUPYTER_URL}{base_path}/api/contents/{rel}'


def _open_browser_url(
    route_or_url: str,
    *,
    volt_url: str | None,
    open_browser: bool,
) -> str:
    browser_url = _resolve_browser_url(route_or_url, volt_url=volt_url)
    if not open_browser:
        return browser_url

    if _in_notebook():
        _open_browser_in_notebook(browser_url)
    else:
        webbrowser.open(browser_url)
    return browser_url


def _resolve_browser_url(route_or_url: str, *, volt_url: str | None) -> str:
    if _is_url(route_or_url):
        return route_or_url

    if _in_notebook() and volt_url is None:
        return route_or_url

    app_url = _resolve_volt_app_url(volt_url)
    return urljoin(app_url.rstrip('/') + '/', route_or_url.lstrip('/'))


def _resolve_volt_app_url(volt_url: str | None) -> str:
    candidates = [
        volt_url,
        os.environ.get('VOLT_APP_URL'),
        os.environ.get('VOLT_BASE_URL'),
        os.environ.get('VOLT_SERVER_URL'),
        os.environ.get('SERVER_ENDPOINT'),
        os.environ.get('JUPYTERHUB_API_URL'),
    ]
    for candidate in candidates:
        normalized = _normalize_app_url(candidate)
        if normalized:
            return normalized
    return _DEFAULT_VOLT_APP_URL


def _normalize_app_url(value: str | None) -> str | None:
    if not value:
        return None

    parsed = urlparse(value)
    if parsed.scheme not in {'http', 'https'}:
        return None

    path = parsed.path.rstrip('/')
    if path.endswith('/hub/api'):
        path = path[:-8]
    elif path.endswith('/api'):
        path = path[:-4]

    return parsed._replace(path=path or '', params='', query='', fragment='').geturl().rstrip('/')


def _open_browser_in_notebook(browser_url: str) -> None:
    try:
        from IPython.display import Javascript, display

        script = (
            '(() => {'
            'let origin = window.location.origin;'
            'try {'
            'if (window.top && window.top.location && window.top.location.origin) {'
            'origin = window.top.location.origin;'
            '}'
            '} catch (error) {}'
            f'const target = new URL({json.dumps(browser_url)}, origin).toString();'
            "window.open(target, '_blank', 'noopener,noreferrer');"
            '})();'
        )
        display(Javascript(script))
        return
    except Exception:
        webbrowser.open(browser_url)


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f'{name} is required for notebook viewer support.')
    return value
