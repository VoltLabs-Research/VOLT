from __future__ import annotations

import hashlib
import json
import os
import platform
import shutil
import tarfile
import urllib.parse
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests
import semver

from .errors import (
    NetworkError,
    PluginNotFoundError,
    PluginVerificationError,
    PluginYankedError,
)

DEFAULT_REGISTRY_URL = 'https://registry.voltcloud.dev'

_SEARCH_PAGE_SIZE = 100
_USER_AGENT = 'voltsdk-plugins/3.0'

@dataclass(frozen=True)
class BundleRef:
    publisher: str
    key: str
    version: str
    platform: str
    url: str
    sha256: str | None = None
    size_bytes: int | None = None

class PluginRegistry:

    def __init__(
        self,
        url: str | None = None,
        *,
        cache_dir: str | os.PathLike[str] | None = None,
        platform_tag: str | None = None,
        token: str | None = None,
    ) -> None:
        self.url = (url or os.environ.get('VOLT_PLUGIN_REGISTRY') or DEFAULT_REGISTRY_URL).rstrip('/')
        self.cache_dir = Path(cache_dir or os.environ.get('VOLT_CACHE_DIR') or _default_cache_dir()).expanduser()
        self.platform_tag = platform_tag or _platform_tag()
        self.token = token or os.environ.get('VOLT_REGISTRY_TOKEN') or None
        self._packument_cache: dict[str, dict[str, Any]] = {}

        self._session = requests.Session()
        self._session.headers['User-Agent'] = _USER_AGENT
        if self.token:
            self._session.headers['Authorization'] = f'Bearer {self.token}'

    def list(self, *, kind: str | None = 'engine') -> list[str]:
        page = 1
        seen: set[str] = set()
        result: list[str] = []
        while True:
            params: dict[str, Any] = {'page': page, 'pageSize': _SEARCH_PAGE_SIZE}
            if kind:
                params['kind'] = kind
            payload = self._get_json('/-/search', params=params)
            items = payload.get('items') if isinstance(payload, dict) else None
            if not isinstance(items, list) or not items:
                break
            for item in items:
                full_name = _packument_full_name(item)
                if not full_name:
                    continue
                scope, name = _split_scope_name(full_name)
                canonical = f'@{scope}/{name}'
                if canonical in seen:
                    continue
                seen.add(canonical)
                result.append(canonical)
            total = payload.get('total') if isinstance(payload, dict) else None
            if isinstance(total, int) and page * _SEARCH_PAGE_SIZE >= total:
                break
            if len(items) < _SEARCH_PAGE_SIZE:
                break
            page += 1
        result.sort()
        return result

    def versions(self, key: str) -> list[str]:
        scope, name = _resolve_key(key)
        packument = self._packument(scope, name)
        versions = packument.get('versions')
        if not isinstance(versions, dict):
            return []
        return sorted(versions.keys(), key=_semver_sort_key)

    def resolve(self, key: str, version: str | None = None) -> BundleRef:
        scope, name = _resolve_key(key)
        packument = self._packument(scope, name)
        versions = packument.get('versions')
        if not isinstance(versions, dict) or not versions:
            raise PluginNotFoundError(f'No versions listed for plugin {key!r}.')

        resolved_version = self._select_version(versions, packument.get('distTags'), version)
        version_meta = versions.get(resolved_version)
        if not isinstance(version_meta, dict):
            raise PluginNotFoundError(f'Plugin {key!r} has no version {resolved_version!r}.')

        yanked = version_meta.get('yanked')
        if isinstance(yanked, dict):
            reason = str(yanked.get('reason') or 'yanked')
            raise PluginYankedError(f'Plugin {key}@{resolved_version} is yanked: {reason}')

        platforms = version_meta.get('platforms')
        if not isinstance(platforms, list) or not platforms:
            raise PluginNotFoundError(f'Plugin {key}@{resolved_version} has no platform bundles.')

        chosen: dict[str, Any] | None = None
        for entry in platforms:
            if not isinstance(entry, dict):
                continue
            if str(entry.get('tag') or '') == self.platform_tag:
                chosen = entry
                break
        if chosen is None:
            raise PluginNotFoundError(
                f'Plugin {key}@{resolved_version} has no bundle for {self.platform_tag!r}.'
            )

        download_url = f'{self.url}/packages/{scope}/{name}/{resolved_version}/-/{self.platform_tag}.tgz'
        sha256 = chosen.get('sha256')
        size = chosen.get('sizeBytes')
        return BundleRef(
            publisher=scope,
            key=name,
            version=resolved_version,
            platform=self.platform_tag,
            url=download_url,
            sha256=str(sha256) if isinstance(sha256, str) else None,
            size_bytes=int(size) if isinstance(size, int) else None,
        )

    def install(self, key: str, version: str | None = None, *, force: bool = False) -> Path:
        ref = self.resolve(key, version)
        target = self._install_dir(ref)
        if not force and _installed_bundle(target):
            return target

        archive = self._fetch(ref.url, fallback_name=f'{ref.key}-{ref.version}-{ref.platform}.tgz')
        if ref.sha256:
            _verify_sha256(archive, ref.sha256)

        if target.exists():
            shutil.rmtree(target)
        target.mkdir(parents=True, exist_ok=True)
        _extract(archive, target)
        _ensure_executable(target / 'bin')
        return target

    def uninstall(self, key: str, version: str | None = None) -> None:
        scope, name = _resolve_key(key)
        if version is None:
            shutil.rmtree(self.cache_dir / 'plugins' / scope / name, ignore_errors=True)
            return
        target = self.cache_dir / 'plugins' / scope / name / version
        shutil.rmtree(target, ignore_errors=True)

    def installed(self, key: str, version: str | None = None) -> Path | None:
        scope, name = _resolve_key(key)
        plugin_dir = self.cache_dir / 'plugins' / scope / name
        if version:
            candidate = plugin_dir / version / self.platform_tag
            return candidate if _installed_bundle(candidate) else None
        if not plugin_dir.is_dir():
            return None
        for version_dir in sorted(plugin_dir.iterdir(), key=lambda path: _semver_sort_key(path.name), reverse=True):
            candidate = version_dir / self.platform_tag
            if _installed_bundle(candidate):
                return candidate
        return None

    def _packument(self, scope: str, name: str) -> dict[str, Any]:
        cache_key = f'{scope}/{name}'
        cached = self._packument_cache.get(cache_key)
        if cached is not None:
            return cached
        payload = self._get_json(f'/packages/{scope}/{name}')
        if not isinstance(payload, dict):
            raise PluginNotFoundError(f'Plugin @{scope}/{name} is not in the registry.')
        self._packument_cache[cache_key] = payload
        self._persist_manifest_cache(scope, name, payload)
        return payload

    def _persist_manifest_cache(self, scope: str, name: str, payload: dict[str, Any]) -> None:
        manifests_dir = self.cache_dir / 'manifests' / scope
        try:
            manifests_dir.mkdir(parents=True, exist_ok=True)
            (manifests_dir / f'{name}.json').write_text(json.dumps(payload), encoding='utf-8')
        except OSError:

            pass

    def _select_version(
        self,
        versions: dict[str, Any],
        dist_tags: Any,
        requested: str | None,
    ) -> str:
        if requested is None or requested == '' or requested == 'latest':
            tag = _string_or_none(dist_tags, 'latest') if isinstance(dist_tags, dict) else None
            if tag and tag in versions:
                return tag
            ordered = sorted(versions.keys(), key=_semver_sort_key, reverse=True)
            if not ordered:
                raise PluginNotFoundError('Registry returned no versions.')
            return ordered[0]

        if isinstance(dist_tags, dict):
            tag_value = dist_tags.get(requested)
            if isinstance(tag_value, str) and tag_value in versions:
                return tag_value

        if requested in versions:
            return requested

        picked = _pick_semver_range(list(versions.keys()), requested)
        if picked is not None:
            return picked
        raise PluginNotFoundError(f'No version satisfies {requested!r}.')

    def _install_dir(self, ref: BundleRef) -> Path:
        return self.cache_dir / 'plugins' / ref.publisher / ref.key / ref.version / ref.platform

    def _abs(self, path: str) -> str:
        return path if _is_absolute(path) else f'{self.url}/{path.lstrip("/")}'

    def _get_json(self, path: str, *, params: dict[str, Any] | None = None) -> Any:
        url = self._abs(path)
        query = {key: value for key, value in (params or {}).items() if value is not None}
        try:
            response = self._session.get(
                url, params=query or None, headers={'Accept': 'application/json'}, timeout=30,
            )
        except requests.RequestException as error:
            raise NetworkError(f'Registry request {url!r} failed: {error}') from error
        if response.status_code == 404:
            raise PluginNotFoundError(f'Registry resource {path!r} not found.')
        if response.status_code >= 400:
            raise NetworkError(f'Registry request {response.url!r} failed: HTTP {response.status_code}')
        if not response.content:
            return {}
        try:
            return response.json()
        except ValueError as error:
            raise NetworkError(f'Registry returned invalid JSON from {response.url!r}.') from error

    def _fetch(self, url: str, *, fallback_name: str) -> Path:
        absolute = self._abs(url)
        downloads = self.cache_dir / 'downloads'
        downloads.mkdir(parents=True, exist_ok=True)
        name = Path(urllib.parse.urlparse(absolute).path).name or fallback_name
        target = downloads / name
        try:
            with self._session.get(
                absolute, stream=True, timeout=60, headers={'Accept': 'application/octet-stream'},
            ) as response:
                if response.status_code == 404:
                    raise PluginNotFoundError(f'Bundle {absolute!r} not found.')
                if response.status_code >= 400:
                    raise NetworkError(f'Bundle download {absolute!r} failed: HTTP {response.status_code}')
                with target.open('wb') as out:
                    for chunk in response.iter_content(chunk_size=1 << 16):
                        out.write(chunk)
        except requests.RequestException as error:
            raise NetworkError(f'Bundle download {absolute!r} failed: {error}') from error
        return target

def _default_cache_dir() -> Path:
    base = os.environ.get('XDG_CACHE_HOME') or str(Path.home() / '.cache')
    return Path(base) / 'volt'

def _platform_tag() -> str:
    system = {'Linux': 'linux', 'Darwin': 'darwin', 'Windows': 'windows'}.get(
        platform.system(), platform.system().lower()
    )
    machine = platform.machine().lower()
    machine = {'x64': 'x86_64', 'amd64': 'x86_64', 'aarch64': 'arm64'}.get(machine, machine)
    return f'{system}-{machine}'

def _resolve_key(value: str) -> tuple[str, str]:
    if not isinstance(value, str):
        raise ValueError('Plugin key must be a string.')
    trimmed = value.strip()
    if not trimmed.startswith('@') or '/' not in trimmed:
        raise ValueError(f"Plugin key must use the form '@scope/name', got {value!r}.")
    scope, _, name = trimmed[1:].partition('/')
    scope, name = scope.strip(), name.strip()
    if not scope or not name or '/' in name or '@' in name:
        raise ValueError(f"Plugin key must use the form '@scope/name', got {value!r}.")
    return scope, name

def _split_scope_name(full_name: str) -> tuple[str, str]:
    scope, _, name = full_name.lstrip('@').partition('/')
    return scope, name

def _packument_full_name(item: Any) -> str | None:
    if not isinstance(item, dict):
        return None
    full_name = item.get('fullName')
    if isinstance(full_name, str) and full_name:
        return full_name
    scope = item.get('scope')
    name = item.get('name')
    if isinstance(scope, str) and isinstance(name, str) and scope and name:
        return f'@{scope}/{name}'
    return None

def _is_absolute(url: str) -> bool:
    return urllib.parse.urlparse(url).scheme in {'http', 'https', 'file'}

def _string_or_none(value: Any, key: str) -> str | None:
    if not isinstance(value, dict):
        return None
    inner = value.get(key)
    return inner if isinstance(inner, str) and inner else None

def _semver_sort_key(version: str) -> tuple[Any, ...]:
    try:
        parsed = semver.Version.parse(version)
    except ValueError:
        return (0, version)
    prerelease = parsed.prerelease or ''
    return (1, parsed.major, parsed.minor, parsed.patch, prerelease == '', prerelease)

def _pick_semver_range(versions: list[str], spec: str) -> str | None:
    spec = spec.strip()
    if not spec.startswith('^'):
        return None
    try:
        base = semver.Version.parse(_coerce(spec[1:]))
    except ValueError:
        return None
    if base.major > 0:
        upper = base.bump_major()
    elif base.minor > 0:
        upper = base.bump_minor()
    else:
        upper = base.bump_patch()

    matching: list[str] = []
    for raw in versions:
        try:
            version = semver.Version.parse(raw)
        except ValueError:
            continue
        if base <= version < upper:
            matching.append(raw)
    if not matching:
        return None
    return max(matching, key=_semver_sort_key)

def _coerce(raw: str) -> str:
    parts = raw.split('.')
    while len(parts) < 3:
        parts.append('0')
    return '.'.join(parts)

def _verify_sha256(archive: Path, expected: str) -> None:
    digest = hashlib.sha256()
    with archive.open('rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            digest.update(chunk)
    actual = digest.hexdigest()
    if actual.lower() != expected.lower():
        raise PluginVerificationError(
            f'sha256 mismatch for {archive.name}: expected {expected}, got {actual}.'
        )

def _safe_tar_extractall(tar: tarfile.TarFile, target: Path) -> None:

    if hasattr(tarfile, 'data_filter'):
        tar.extractall(target, filter='data')
    else:
        tar.extractall(target)

def _extract(archive: Path, target: Path) -> None:
    with archive.open('rb') as fh:
        magic = fh.read(4)
    if magic[:4] == b'\x28\xb5\x2f\xfd':
        import zstandard

        with archive.open('rb') as fh, zstandard.ZstdDecompressor().stream_reader(fh) as reader:
            with tarfile.open(fileobj=reader, mode='r|') as tar:
                _safe_tar_extractall(tar, target)
        return
    if magic[:2] == b'\x1f\x8b':
        with tarfile.open(archive, 'r:gz') as tar:
            _safe_tar_extractall(tar, target)
        return
    if magic[:2] == b'PK':
        import zipfile

        with zipfile.ZipFile(archive) as zf:
            zf.extractall(target)
        return
    raise ValueError(f'Unsupported bundle archive format: {archive.name}')

def _ensure_executable(bin_dir: Path) -> None:
    if not bin_dir.is_dir():
        return
    for entry in bin_dir.iterdir():
        if entry.is_file():
            entry.chmod(entry.stat().st_mode | 0o111)

def _installed_bundle(path: Path) -> bool:
    return path.is_dir() and ((path / 'bin').is_dir() or (path / 'scripts').is_dir())
