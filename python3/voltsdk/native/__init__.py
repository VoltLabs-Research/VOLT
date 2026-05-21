"""Bundled native runtime payload for VoltSDK wheels."""

from __future__ import annotations

from pathlib import Path

__all__ = ["root", "bin_dir", "lib_dir", "share_dir"]

def root() -> Path:
    return Path(__file__).resolve().parent

def bin_dir() -> Path:
    return root() / "bin"

def lib_dir() -> Path:
    return root() / "lib"

def share_dir() -> Path:
    return root() / "share"
