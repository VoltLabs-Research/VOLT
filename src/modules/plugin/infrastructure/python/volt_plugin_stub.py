#!/usr/bin/env python3
"""
Volt Plugin Host — persistent Python worker.

Protocol (stdin/stdout are binary):
    [u32 opId LE][u32 payloadLen LE][msgpack bytes]
Each request maps to a single response with the same opId.

The stub imports a user-provided module (path passed via --plugin-root and
--entrypoint) and invokes either `process(frame, config)` or
`process_batch(frames, config)` depending on opcode.

When a frame descriptor carries shared-memory bindings, the stub exposes the
columns as zero-copy numpy arrays via mmap when numpy is available, or raw
bytes otherwise. The caller may always fall back to inline payloads.
"""

from __future__ import annotations

import argparse
import importlib
import importlib.util
import io
import os
import struct
import sys
import traceback
import types
from typing import Any, Callable, Dict, List, Optional

try:
    import msgpack  # type: ignore
except ImportError as exc:
    sys.stderr.write(
        "volt-plugin-stub: msgpack is required but not installed in the plugin venv: "
        f"{exc}\n"
    )
    sys.exit(2)

try:
    import numpy as _np  # type: ignore
except ImportError:
    _np = None

_DTYPE_TO_ITEMSIZE = {
    "int8": 1,
    "uint8": 1,
    "int16": 2,
    "uint16": 2,
    "int32": 4,
    "uint32": 4,
    "int64": 8,
    "uint64": 8,
    "float16": 2,
    "float32": 4,
    "float64": 8,
}


def _read_exact(stream: io.BufferedReader, length: int) -> Optional[bytes]:
    buffer = bytearray()
    while len(buffer) < length:
        chunk = stream.read(length - len(buffer))
        if not chunk:
            if not buffer:
                return None
            raise EOFError("Unexpected EOF while reading plugin stub frame")
        buffer.extend(chunk)
    return bytes(buffer)


def _read_request(stream: io.BufferedReader):
    header = _read_exact(stream, 8)
    if header is None:
        return None
    op_id, length = struct.unpack("<II", header)
    payload = _read_exact(stream, length) if length > 0 else b""
    if payload is None:
        raise EOFError("Unexpected EOF while reading plugin stub payload")
    decoded = msgpack.unpackb(payload, raw=False, use_list=True) if payload else {}
    if not isinstance(decoded, dict):
        raise ValueError("Plugin stub expected dict payload")
    return op_id, decoded


def _write_response(stream: io.BufferedWriter, op_id: int, payload: dict) -> None:
    packed = msgpack.packb(payload, use_bin_type=True)
    stream.write(struct.pack("<II", op_id, len(packed)))
    stream.write(packed)
    stream.flush()


def _load_user_module(plugin_root: str, entrypoint: str) -> types.ModuleType:
    if plugin_root and plugin_root not in sys.path:
        sys.path.insert(0, plugin_root)

    if entrypoint.endswith(".py") or os.path.sep in entrypoint or "/" in entrypoint:
        candidate = os.path.join(plugin_root, entrypoint) if plugin_root and not os.path.isabs(entrypoint) else entrypoint
        module_name = os.path.splitext(os.path.basename(candidate))[0]
        spec = importlib.util.spec_from_file_location(module_name, candidate)
        if spec is None or spec.loader is None:
            raise ImportError(f"Cannot load plugin module from '{candidate}'")
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)
        return module

    return importlib.import_module(entrypoint)


def _resolve_callables(module: types.ModuleType) -> Dict[str, Callable[..., Any]]:
    callables: Dict[str, Callable[..., Any]] = {}
    process = getattr(module, "process", None)
    process_batch = getattr(module, "process_batch", None)
    warmup = getattr(module, "warmup", None)

    if callable(process):
        callables["process"] = process
    if callable(process_batch):
        callables["process_batch"] = process_batch
    if callable(warmup):
        callables["warmup"] = warmup

    if "process" not in callables:
        raise AttributeError(
            "Plugin module must expose `process(frame, config)` — "
            "optional: `process_batch(frames, config)` and `warmup()`."
        )
    return callables


def _dtype_itemsize(dtype: str) -> int:
    if dtype not in _DTYPE_TO_ITEMSIZE:
        raise ValueError(f"Unsupported dtype '{dtype}'")
    return _DTYPE_TO_ITEMSIZE[dtype]


def _materialize_column(column: dict, mmap_cache: Dict[str, memoryview]) -> Any:
    name = column.get("name")
    dtype = column.get("dtype") or column.get("binding", {}).get("dtype")
    shape = column.get("shape") or []
    binding = column.get("binding") or {}
    kind = binding.get("kind")

    if kind == "shm":
        shm_path = binding.get("shm_path") or binding.get("shmPath") or binding.get("path")
        if not shm_path:
            raise ValueError(f"Column '{name}' missing shm path")
        offset = int(binding.get("offset", 0))
        length = int(binding.get("length", 0))
        backing = mmap_cache.get(shm_path)
        if backing is None:
            import mmap as _mmap
            fd = os.open(shm_path, os.O_RDONLY)
            try:
                size = os.fstat(fd).st_size
                region = _mmap.mmap(fd, size, prot=_mmap.PROT_READ)
            finally:
                os.close(fd)
            backing = memoryview(region)
            mmap_cache[shm_path] = backing
        slice_view = backing[offset : offset + length]
        if _np is not None and dtype:
            array = _np.frombuffer(slice_view, dtype=dtype)
            if shape:
                array = array.reshape(shape)
            return array
        return bytes(slice_view)

    if kind == "inline":
        raw = column.get("bytes") or binding.get("bytes")
        if raw is None:
            raise ValueError(f"Column '{name}' inline payload missing")
        if _np is not None and dtype:
            array = _np.frombuffer(raw, dtype=dtype)
            if shape:
                array = array.reshape(shape)
            return array
        return bytes(raw)

    raise ValueError(f"Unsupported column binding kind: {kind}")


def _materialize_frame(frame: Optional[dict], mmap_cache: Dict[str, memoryview]) -> Optional[dict]:
    if frame is None:
        return None

    materialized: Dict[str, Any] = {
        "timestep": frame.get("timestep"),
        "natoms": frame.get("natoms"),
        "simulation_cell": frame.get("simulationCell") or frame.get("simulation_cell")
    }
    columns = frame.get("columns") or []
    if columns:
        for column in columns:
            materialized[column.get("name")] = _materialize_column(column, mmap_cache)
    payload = frame.get("payload")
    if isinstance(payload, dict):
        for key, value in payload.items():
            materialized.setdefault(key, value)
    return materialized


def _invoke(
    callables: Dict[str, Callable[..., Any]],
    opcode: str,
    request: dict,
    mmap_cache: Dict[str, memoryview]
) -> dict:
    if opcode == "warmup":
        warmup = callables.get("warmup")
        if warmup is not None:
            warmup()
        return {"ok": True, "result": {"ready": True}}

    if opcode == "ping":
        return {"ok": True, "result": {"pong": True}}

    config = request.get("config") or {}

    if opcode == "process_batch":
        process_batch = callables.get("process_batch")
        materialized_frames: List[dict] = []
        for raw_frame in request.get("frames") or []:
            materialized = _materialize_frame(raw_frame, mmap_cache)
            if materialized is not None:
                materialized_frames.append(materialized)

        if process_batch is not None:
            batch_result = process_batch(materialized_frames, config)
            return {"ok": True, "results": list(batch_result) if batch_result is not None else []}

        single = callables["process"]
        results = [single(frame, config) for frame in materialized_frames]
        return {"ok": True, "results": results}

    if opcode == "process":
        process = callables["process"]
        frame = _materialize_frame(request.get("frame"), mmap_cache)
        result = process(frame, config)
        return {"ok": True, "result": result}

    raise ValueError(f"Unsupported opcode '{opcode}'")


def _main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plugin-root", required=True)
    parser.add_argument("--entrypoint", required=True)
    args = parser.parse_args()

    try:
        module = _load_user_module(args.plugin_root, args.entrypoint)
        callables = _resolve_callables(module)
    except Exception as exc:
        sys.stderr.write(f"volt-plugin-stub: failed to load plugin entrypoint: {exc}\n")
        sys.stderr.write(traceback.format_exc())
        sys.stderr.flush()
        return 1

    if "warmup" in callables:
        try:
            callables["warmup"]()
        except Exception:
            sys.stderr.write("volt-plugin-stub: warmup failed:\n")
            sys.stderr.write(traceback.format_exc())
            sys.stderr.flush()

    stdin = sys.stdin.buffer
    stdout = sys.stdout.buffer
    mmap_cache: Dict[str, memoryview] = {}

    try:
        while True:
            request = _read_request(stdin)
            if request is None:
                break
            op_id, payload = request
            opcode = payload.get("opcode") or "process"
            try:
                response = _invoke(callables, opcode, payload, mmap_cache)
            except Exception as exc:
                response = {
                    "ok": False,
                    "error": {
                        "message": str(exc),
                        "type": type(exc).__name__,
                        "traceback": traceback.format_exc()
                    }
                }
            _write_response(stdout, op_id, response)
    except (BrokenPipeError, KeyboardInterrupt):
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(_main())
