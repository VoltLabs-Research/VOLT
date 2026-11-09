"""Tell VOLT how far a plugin is, from any plugin that runs as a script or an executable.

VOLT reads these lines from the plugin's stderr and shows them as the job's progress:

    @volt:progress 0.42
    @volt:progress 340/1000 Meshing cells
    @volt:status Indexing neighbours

A persistent Python plugin can instead write its ``process(frame, config)`` as a generator and
yield numbers from 0 to 1 and strings, the way OVITO's ``modify()`` reports progress.
"""

from __future__ import annotations

import os
import sys
import time
from typing import Optional, TextIO

PROGRESS_DIRECTIVE = "@volt:progress"
STATUS_DIRECTIVE = "@volt:status"

# VOLT shows at most one value a second; writing a few more lines than that is enough.
_MIN_INTERVAL_S = 0.2

_last_written_at: Optional[float] = None
_last_fraction: Optional[float] = None


def _one_line(text: str) -> str:
    # A line break inside the text would end the directive there.
    return " ".join(str(text).split())


def is_progress_read() -> bool:
    """Whether VOLT reads these lines: it sets VOLT_PROGRESS=1 for the plugins it runs."""
    return os.environ.get("VOLT_PROGRESS") == "1"


def _write(line: str, stream: Optional[TextIO]) -> None:
    target = stream if stream is not None else sys.stderr
    target.write(line + "\n")
    target.flush()


def report_progress(
    done: float,
    total: Optional[float] = None,
    text: Optional[str] = None,
    *,
    stream: Optional[TextIO] = None,
) -> None:
    """Report how far the plugin is: ``done`` of ``total``, or ``done`` alone as a fraction 0..1.

    Call it as often as is convenient: lines closer together than VOLT can show are skipped,
    except the one that reaches the end. Outside VOLT (no VOLT_PROGRESS=1) nothing is written.
    """
    global _last_written_at, _last_fraction

    if total is not None:
        if total <= 0:
            raise ValueError("total must be greater than 0")
        fraction = float(done) / float(total)
    else:
        fraction = float(done)
    fraction = min(1.0, max(0.0, fraction))
    if not is_progress_read():
        return

    now = time.monotonic()
    if fraction == _last_fraction and text is None:
        return
    if fraction < 1.0 and _last_written_at is not None and now - _last_written_at < _MIN_INTERVAL_S:
        return

    _last_written_at = now
    _last_fraction = fraction
    line = f"{PROGRESS_DIRECTIVE} {fraction:.4f}"
    if text:
        line = f"{line} {_one_line(text)}"
    _write(line, stream)


def report_status(text: str, *, stream: Optional[TextIO] = None) -> None:
    """Say what the plugin is doing now, without a value. It is also kept in the run's log."""
    line = _one_line(text)
    if line and is_progress_read():
        _write(f"{STATUS_DIRECTIVE} {line}", stream)
