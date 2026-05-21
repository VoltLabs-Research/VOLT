#!/usr/bin/env python3
"""Download native runtime bundles from an explicit static index.

Expected index format::

    {
      "platforms": {
        "linux-x86_64": {
          "bundles": [
            {
              "name": "atomic-strain-1.0.0-linux-x86_64.tar.zst",
              "url": "https://example.invalid/native/atomic-strain-1.0.0-linux-x86_64.tar.zst",
              "sha256": "..."
            }
          ]
        }
      }
    }

The ``platforms`` wrapper is optional; a top-level ``{"linux-x86_64": ...}``
mapping is also accepted. Bundle URLs may be absolute or relative to the index
location.

The script also accepts the plugin-registry format used by VoltSDK itself::

    {
      "plugins": {
        "voltlabs": {
          "opendxa": {
            "publisher": "voltlabs",
            "latest": "1.0.0",
            "versions": {
              "1.0.0": {
                "linux-x86_64": {
                  "url": "https://example.invalid/opendxa-1.0.0-linux-x86_64.tar.zst",
                  "sha256": "..."
                }
              }
            }
          }
        }
      }
    }
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import tarfile
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path, PurePosixPath
from typing import Any

import zstandard

INDEX_PATH = "index.json"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--index-url", required=True, help="Base URL or direct JSON path/URL to the native bundle index.")
    parser.add_argument("--install-root", type=Path, required=True)
    parser.add_argument("--os", dest="os_slug", required=True)
    parser.add_argument("--arch", dest="arch_slug", required=True)
    args = parser.parse_args()
    index_url = args.index_url.strip()
    if not index_url:
        raise SystemExit("A native bundle index URL or path is required.")

    install_root = args.install_root.expanduser().resolve()
    install_root.mkdir(parents=True, exist_ok=True)

    index_root, index_name = _resolve_index_location(index_url)
    index = _read_json(_fetch(index_root, index_name, index_name))
    platform_tag = f"{args.os_slug}-{args.arch_slug}"
    bundles = _resolve_bundles(index, platform_tag)

    installed: list[dict[str, str]] = []
    for number, bundle in enumerate(bundles, start=1):
        url = str(bundle["url"])
        sha256 = str(bundle.get("sha256", "")).strip()
        name = str(bundle.get("name") or Path(urllib.parse.urlparse(url).path).name or f"bundle-{number}")
        archive_path = _fetch(index_root, url, name)
        if sha256:
            _verify_digest(archive_path, sha256)
        _merge_bundle(archive_path, install_root)
        installed.append({"name": name, "url": url, "sha256": sha256})
        print(f"Installed {name}")

    metadata_dir = install_root / "share" / "voltsdk"
    metadata_dir.mkdir(parents=True, exist_ok=True)
    (metadata_dir / "native-bundles.json").write_text(json.dumps(installed, indent=2), encoding="utf-8")
    print(f"Installed {len(installed)} native bundle(s) into {install_root}")


def _resolve_bundles(index: dict[str, Any], platform_tag: str) -> list[dict[str, Any]]:
    publishers = index.get("plugins")
    if isinstance(publishers, dict):
        bundles = _resolve_plugin_registry_bundles(publishers, platform_tag)
        if bundles:
            return bundles
        raise SystemExit(f"Plugin registry index has no bundles for platform {platform_tag!r}.")

    platforms = index.get("platforms", index)
    if not isinstance(platforms, dict):
        raise SystemExit("Native bundle index must be a JSON object with a 'platforms' or 'plugins' mapping.")

    entry = platforms.get(platform_tag)
    if isinstance(entry, list):
        bundles = entry
    elif isinstance(entry, dict):
        bundles = entry.get("bundles")
    else:
        bundles = None

    if not isinstance(bundles, list) or not bundles:
        raise SystemExit(f"Native bundle index has no bundles for platform {platform_tag!r}.")

    normalized: list[dict[str, Any]] = []
    for bundle in bundles:
        if not isinstance(bundle, dict) or "url" not in bundle:
            raise SystemExit(f"Invalid bundle entry for platform {platform_tag!r}: {bundle!r}")
        normalized.append(bundle)
    return normalized


def _resolve_plugin_registry_bundles(publishers: dict[str, Any], platform_tag: str) -> list[dict[str, Any]]:
    bundles: list[dict[str, Any]] = []
    for publisher in sorted(publishers):
        entries = publishers.get(publisher)
        if not isinstance(entries, dict):
            continue
        for key in sorted(entries):
            entry = entries.get(key)
            if not isinstance(entry, dict):
                continue
            if str(entry.get("publisher") or "").strip() != publisher:
                raise SystemExit(f"Plugin registry entry {publisher}@{key} has invalid publisher metadata.")
            version = str(entry.get("latest") or "").strip()
            versions = entry.get("versions", {})
            if not version or not isinstance(versions, dict):
                continue
            platform_entry = versions.get(version, {})
            if not isinstance(platform_entry, dict):
                continue
            bundle = platform_entry.get(platform_tag)
            if not isinstance(bundle, dict) or "url" not in bundle:
                continue
            normalized = {
                "name": f"{publisher}-{key}-{version}-{platform_tag}.tar.zst",
                "publisher": publisher,
                "key": key,
                "version": version,
                "url": str(bundle["url"]),
                "sha256": str(bundle.get("sha256", "")).strip(),
            }
            bundles.append(normalized)
    return bundles


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _resolve_index_location(url: str) -> tuple[str, str]:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme in {"http", "https", "file"}:
        path = parsed.path.rstrip("/")
        index_name = INDEX_PATH
        if path.endswith(".json"):
            path, _, index_name = path.rpartition("/")
            path = path or "/"
        normalized = parsed._replace(path=path, params="", query="", fragment="")
        return urllib.parse.urlunparse(normalized).rstrip("/"), index_name

    local_path = Path(url).expanduser().resolve()
    if local_path.is_file():
        return local_path.parent.as_uri(), local_path.name
    if local_path.is_dir():
        return local_path.as_uri(), INDEX_PATH
    raise SystemExit(f"Unsupported native bundle index location: {url}")


def _fetch(index_root: str, url: str, fallback_name: str) -> Path:
    absolute = url if _is_absolute(url) else f"{index_root}/{url.lstrip('/')}"
    cache_dir = Path(".github/.bundle-cache").resolve()
    cache_dir.mkdir(parents=True, exist_ok=True)
    target = cache_dir / (Path(urllib.parse.urlparse(absolute).path).name or fallback_name)
    with urllib.request.urlopen(absolute) as response, target.open("wb") as output:
        shutil.copyfileobj(response, output)
    return target


def _is_absolute(url: str) -> bool:
    return urllib.parse.urlparse(url).scheme in {"http", "https", "file"}


def _verify_digest(path: Path, expected_sha256: str) -> None:
    actual_sha256 = _sha256(path)
    if actual_sha256 != expected_sha256:
        raise SystemExit(f"sha256 mismatch for {path.name}: expected {expected_sha256}, got {actual_sha256}")


def _sha256(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1 << 20), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def _merge_bundle(archive_path: Path, install_root: Path) -> None:
    with tempfile.TemporaryDirectory(prefix="voltsdk-native-") as temp_dir:
        temp_root = Path(temp_dir)
        _extract_tar_zst(archive_path, temp_root)
        for name in ("bin", "lib", "share"):
            source = temp_root / name
            if source.is_dir():
                shutil.copytree(source, install_root / name, dirs_exist_ok=True)


def _extract_tar_zst(archive_path: Path, destination: Path) -> None:
    with archive_path.open("rb") as compressed:
        with zstandard.ZstdDecompressor().stream_reader(compressed) as stream:
            with tarfile.open(fileobj=stream, mode="r|") as archive:
                for member in archive:
                    _validate_member_name(member.name)
                    archive.extract(member, destination, filter="data")


def _validate_member_name(name: str) -> None:
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts:
        raise SystemExit(f"Unsafe path inside native bundle: {name}")


if __name__ == "__main__":
    main()
