"""HTTP registry + on-disk cache for plugin bundles.

Index format (``GET <registry>/index.json``)::

    {
      "plugins": {
        "opendxa": {
          "latest": "1.0.0",
          "versions": {
            "1.0.0": {
              "linux-x86_64": {
                "url": "opendxa/1.0.0/linux-x86_64.tar.zst",
                "sha256": "..."
              }
            }
          }
        }
      }
    }

URLs may be relative to the registry base URL or absolute.

Layout inside a bundle (after extraction)::

    plugin.json
    bin/<binary>
    lib/...        (optional)
    scripts/...    (optional)
"""

from __future__ import annotations

import hashlib
import os
import platform
import shutil
import tarfile
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .errors import PluginNotFoundError, PluginVerificationError

DEFAULT_REGISTRY_URL = "https://server.voltcloud.dev/plugin-registry"
INDEX_PATH = "index.json"


@dataclass(frozen=True)
class BundleRef:
    key: str
    version: str
    platform: str
    url: str
    sha256: str


class PluginRegistry:
    """HTTP-only client for a static plugin registry."""

    def __init__(
        self,
        url: str | None = None,
        *,
        cache_dir: str | os.PathLike[str] | None = None,
        platform_tag: str | None = None,
    ) -> None:
        self.url = _normalize_registry_url(url or os.environ.get("VOLT_PLUGIN_REGISTRY") or DEFAULT_REGISTRY_URL)
        self.cache_dir = Path(cache_dir or os.environ.get("VOLT_CACHE_DIR") or _default_cache_dir()).expanduser()
        self.platform_tag = platform_tag or _platform_tag()
        self._index: dict[str, Any] | None = None

    # ------------------------------------------------------------------
    # Index
    # ------------------------------------------------------------------

    def index(self, *, refresh: bool = False) -> dict[str, Any]:
        if self._index is None or refresh:
            self._index = _read_json(self._fetch(INDEX_PATH, "index.json"))
        return self._index

    def list(self) -> list[str]:
        return sorted(self.index().get("plugins", {}).keys())

    def versions(self, key: str) -> list[str]:
        plugin = self._plugin_entry(key)
        return sorted(plugin.get("versions", {}).keys())

    def resolve(self, key: str, version: str | None = None) -> BundleRef:
        plugin = self._plugin_entry(key)
        version = version or str(plugin.get("latest") or "")
        if not version:
            raise PluginNotFoundError(f"No versions listed for plugin {key!r}.")
        versions = plugin.get("versions", {})
        bundle = versions.get(version)
        if not isinstance(bundle, dict):
            raise PluginNotFoundError(f"Plugin {key!r} has no version {version!r}.")
        platform_entry = bundle.get(self.platform_tag)
        if not isinstance(platform_entry, dict):
            raise PluginNotFoundError(
                f"Plugin {key}@{version} has no bundle for {self.platform_tag!r}."
            )
        return BundleRef(
            key=key,
            version=version,
            platform=self.platform_tag,
            url=str(platform_entry["url"]),
            sha256=str(platform_entry.get("sha256", "")),
        )

    # ------------------------------------------------------------------
    # Bundle download / cache
    # ------------------------------------------------------------------

    def install(self, key: str, version: str | None = None, *, force: bool = False) -> Path:
        ref = self.resolve(key, version)
        target = self._install_dir(ref)
        if not force and (target / "plugin.json").exists():
            return target

        archive = self._fetch(ref.url, f"{ref.key}-{ref.version}-{ref.platform}")
        if ref.sha256:
            actual = _sha256(archive)
            if actual != ref.sha256:
                archive.unlink(missing_ok=True)
                raise PluginVerificationError(
                    f"sha256 mismatch for {ref.key}@{ref.version}: expected {ref.sha256}, got {actual}."
                )

        if target.exists():
            shutil.rmtree(target)
        target.mkdir(parents=True, exist_ok=True)
        _extract(archive, target)
        _ensure_executable(target / "bin")
        return target

    def uninstall(self, key: str, version: str | None = None) -> None:
        if version is None:
            shutil.rmtree(self.cache_dir / "plugins" / key, ignore_errors=True)
            return
        target = self.cache_dir / "plugins" / key / version
        shutil.rmtree(target, ignore_errors=True)

    def installed(self, key: str, version: str | None = None) -> Path | None:
        plugin_dir = self.cache_dir / "plugins" / key
        if version:
            candidate = plugin_dir / version / self.platform_tag
            return candidate if (candidate / "plugin.json").exists() else None
        if not plugin_dir.is_dir():
            return None
        for version_dir in sorted(plugin_dir.iterdir(), reverse=True):
            candidate = version_dir / self.platform_tag
            if (candidate / "plugin.json").exists():
                return candidate
        return None

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _plugin_entry(self, key: str) -> dict[str, Any]:
        plugins = self.index().get("plugins", {})
        entry = plugins.get(key)
        if not isinstance(entry, dict):
            raise PluginNotFoundError(f"Plugin {key!r} is not in the registry index.")
        return entry

    def _install_dir(self, ref: BundleRef) -> Path:
        return self.cache_dir / "plugins" / ref.key / ref.version / ref.platform

    def _fetch(self, url: str, fallback_name: str) -> Path:
        absolute = url if _is_absolute(url) else f"{self.url}/{url.lstrip('/')}"
        downloads = self.cache_dir / "downloads"
        downloads.mkdir(parents=True, exist_ok=True)
        target = downloads / Path(urllib.parse.urlparse(absolute).path).name
        if not target.name:
            target = downloads / fallback_name
        with urllib.request.urlopen(absolute) as response, target.open("wb") as out:
            shutil.copyfileobj(response, out)
        return target


def _default_cache_dir() -> Path:
    base = os.environ.get("XDG_CACHE_HOME") or str(Path.home() / ".cache")
    return Path(base) / "volt"


def _normalize_registry_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    path = parsed.path.rstrip("/")
    if path.endswith(f"/{INDEX_PATH}"):
        path = path[: -len(f"/{INDEX_PATH}")]
    normalized = parsed._replace(path=path, params="", query="", fragment="")
    return urllib.parse.urlunparse(normalized).rstrip("/")


def _platform_tag() -> str:
    system = {"Linux": "linux", "Darwin": "darwin", "Windows": "windows"}.get(platform.system(), platform.system().lower())
    machine = platform.machine().lower()
    return f"{system}-{machine}"


def _read_json(path: Path) -> dict[str, Any]:
    import json

    return json.loads(path.read_text(encoding="utf-8"))


def _is_absolute(url: str) -> bool:
    return urllib.parse.urlparse(url).scheme in {"http", "https"}


def _sha256(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def _extract(archive: Path, target: Path) -> None:
    if archive.suffixes[-2:] == [".tar", ".zst"]:
        import zstandard

        with archive.open("rb") as fh, zstandard.ZstdDecompressor().stream_reader(fh) as reader:
            with tarfile.open(fileobj=reader, mode="r|") as tar:
                tar.extractall(target)
        return
    if archive.suffixes[-2:] == [".tar", ".gz"] or archive.suffix == ".tgz":
        with tarfile.open(archive, "r:gz") as tar:
            tar.extractall(target)
        return
    if archive.suffix == ".zip":
        import zipfile

        with zipfile.ZipFile(archive) as zf:
            zf.extractall(target)
        return
    raise ValueError(f"Unsupported bundle archive format: {archive.name}")


def _ensure_executable(bin_dir: Path) -> None:
    if not bin_dir.is_dir():
        return
    for entry in bin_dir.iterdir():
        if entry.is_file():
            entry.chmod(entry.stat().st_mode | 0o111)
