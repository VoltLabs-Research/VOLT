"""The kernel of VOLT's notebooks in the browser (`python3 -m volt_kernel`): runs cells in one
namespace as IPython does (the value of a cell's last expression is its result, top-level await
works, `%pip` installs into the notebook's environment) and reports what they print and display as
the outputs of nbformat. The program's JavaScript side (src/python/kernel.ts) calls in and passes
the messages on to the page."""

import ast
import base64
import builtins
import getpass
import importlib
import importlib.metadata
import importlib.util
import inspect
import io
import json
import os
import pprint
import re
import rlcompleter
import shlex
import sys
import time
import traceback
import types

from pyodide.code import CodeRunner

_bridge = None
_current = None
_count = 0
_main = types.ModuleType("__main__")
_namespace = _main.__dict__


def _send(message):
    _bridge.send(json.dumps(message, default=str))


def _output(output):
    _send({"type": "output", "id": _current, "output": output})


class _Stream(io.TextIOBase):
    """sys.stdout and sys.stderr: text goes out as stream outputs, a batch at most every 50 ms
    while a cell keeps writing."""

    INTERVAL = 0.05
    LIMIT = 64 * 1024

    def __init__(self, name):
        self.name = name
        self._parts = []
        self._size = 0
        self._sent_at = 0.0

    @property
    def encoding(self):
        return "utf-8"

    def writable(self):
        return True

    def isatty(self):
        return False

    def write(self, text):
        if not isinstance(text, str):
            raise TypeError(f"write() argument must be str, not {type(text).__name__}")
        if text:
            self._parts.append(text)
            self._size += len(text)
            if self._size >= self.LIMIT or time.monotonic() - self._sent_at >= self.INTERVAL:
                self.flush()
        return len(text)

    def flush(self):
        if self._parts:
            text = "".join(self._parts)
            self._parts = []
            self._size = 0
            _output({"output_type": "stream", "name": self.name, "text": text})
        self._sent_at = time.monotonic()


def _flush():
    sys.stdout.flush()
    sys.stderr.flush()


# --- rich display ------------------------------------------------------------------------------

_FORMATS = (
    ("text/html", "_repr_html_"),
    ("text/markdown", "_repr_markdown_"),
    ("image/svg+xml", "_repr_svg_"),
    ("image/png", "_repr_png_"),
    ("image/jpeg", "_repr_jpeg_"),
    ("text/latex", "_repr_latex_"),
    ("application/json", "_repr_json_"),
)
_BINARY = {"image/png", "image/jpeg"}


def _is_figure(value):
    return type(value).__module__.startswith("matplotlib.figure") and hasattr(value, "savefig")


def _figure_png(figure):
    buffer = io.BytesIO()
    figure.savefig(buffer, format="png", bbox_inches="tight")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def _text(value):
    if isinstance(value, (dict, list, tuple, set, frozenset)):
        return pprint.pformat(value, width=100)
    return repr(value)


def _mimebundle(value):
    """The representations of a value a notebook shows, as IPython's display formatter finds
    them: its _repr_*_ methods, and text/plain."""
    data = {}
    if _is_figure(value):
        data["image/png"] = _figure_png(value)
        pyplot = sys.modules.get("matplotlib.pyplot")
        if pyplot is not None:
            # Shown here, so not again with the cell's other figures.
            pyplot.close(value)
    elif not inspect.isclass(value):
        method = getattr(value, "_repr_mimebundle_", None)
        if callable(method):
            try:
                bundle = method()
                if isinstance(bundle, tuple):
                    bundle = bundle[0]
                data.update(bundle or {})
            except Exception:
                pass
        for mime, name in _FORMATS:
            method = getattr(value, name, None)
            if mime in data or not callable(method):
                continue
            try:
                content = method()
            except Exception:
                continue
            if isinstance(content, tuple):
                content = content[0]
            if content is None:
                continue
            if mime in _BINARY and isinstance(content, bytes):
                content = base64.b64encode(content).decode("ascii")
            elif mime == "application/json" and isinstance(content, str):
                content = json.loads(content)
            data[mime] = content
    data.setdefault("text/plain", _text(value))
    return data


def display(*values, raw=False, metadata=None, clear=False, **_options):
    """IPython's display(): each value as a display output of the running cell."""
    if clear:
        clear_output(wait=True)
    _flush()
    for value in values:
        _output({"output_type": "display_data", "data": value if raw else _mimebundle(value), "metadata": metadata or {}})


def clear_output(wait=False):
    _flush()
    _send({"type": "clear", "id": _current, "wait": bool(wait)})


def show_figures():
    """The open matplotlib figures, as images of the running cell's output, then closed: what
    IPython's inline backend does on plt.show() and at the end of a cell."""
    pyplot = sys.modules.get("matplotlib.pyplot")
    if pyplot is None:
        return
    _flush()
    for number in pyplot.get_fignums():
        figure = pyplot.figure(number)
        _output({"output_type": "display_data", "data": {"image/png": _figure_png(figure), "text/plain": repr(figure)}, "metadata": {}})
    pyplot.close("all")


class _Display:
    def __init__(self, data=None, url=None, filename=None, metadata=None):
        if filename is not None:
            mode = "rb" if self._binary else "r"
            with open(filename, mode) as file:
                data = file.read()
        self.data = data
        self.url = url
        self.metadata = metadata

    _binary = False


class HTML(_Display):
    def _repr_html_(self):
        return self.data


class Markdown(_Display):
    def _repr_markdown_(self):
        return self.data


class Latex(_Display):
    def _repr_latex_(self):
        return self.data


class Math(_Display):
    def _repr_latex_(self):
        return f"$\\displaystyle {self.data}$"


class SVG(_Display):
    def _repr_svg_(self):
        return self.data


class JSON(_Display):
    def _repr_json_(self):
        return self.data


class Pretty(_Display):
    def __repr__(self):
        return str(self.data)


class Image(_Display):
    _binary = True

    def __init__(self, data=None, url=None, filename=None, format=None, width=None, height=None, metadata=None, **_options):
        if isinstance(data, str) and filename is None and os.path.exists(data):
            data, filename = None, data
        super().__init__(data, url, filename, metadata)
        name = (filename or url or "").lower()
        self.format = (format or ("jpeg" if name.endswith((".jpg", ".jpeg")) else "png")).lower()

    def _repr_png_(self):
        return self.data if self.format == "png" else None

    def _repr_jpeg_(self):
        return self.data if self.format in ("jpg", "jpeg") else None


def _ipython_modules():
    """IPython.display without IPython: what notebooks import from it, displayed by this kernel.
    get_ipython() is None, as it is outside IPython's shell, for the libraries that look for one."""
    ipython = types.ModuleType("IPython")
    core = types.ModuleType("IPython.core")
    module = types.ModuleType("IPython.display")
    for name, value in {
        "display": display,
        "clear_output": clear_output,
        "HTML": HTML,
        "Markdown": Markdown,
        "Latex": Latex,
        "Math": Math,
        "SVG": SVG,
        "JSON": JSON,
        "Pretty": Pretty,
        "Image": Image,
    }.items():
        setattr(module, name, value)
    ipython.display = module
    ipython.core = core
    ipython.get_ipython = lambda: None
    # A current one: libraries patch older IPythons' internals, which this has none of.
    ipython.version_info = (9, 0, 0)
    ipython.__version__ = "9.0.0"
    core.display = module
    return {"IPython": ipython, "IPython.core": core, "IPython.display": module, "IPython.core.display": module}


# --- input --------------------------------------------------------------------------------------


def _request_input(prompt, password):
    _flush()
    reply = _bridge.requestInput(str(prompt), bool(password))
    if reply is None:
        raise KeyboardInterrupt
    return reply


def _input(prompt=""):
    return _request_input(prompt, False)


def _getpass(prompt="Password: ", stream=None):
    return _request_input(prompt, True)


# --- magics -------------------------------------------------------------------------------------


async def _pip(args):
    import _volt_pip

    await _volt_pip.main(args)
    _flush()


_IGNORED_MAGICS = ("matplotlib", "config", "load_ext", "reload_ext", "autoreload")


def _transform(code):
    """IPython's line magics this kernel has (%pip), and errors for the ones it has not and for
    shell commands, which a browser has no shell for."""
    lines = []
    for line in code.split("\n"):
        stripped = line.lstrip()
        indent = line[: len(line) - len(stripped)]
        if not stripped.startswith(("%", "!")):
            lines.append(line)
            continue
        words = stripped.lstrip("%!").split(None, 1)
        name = words[0] if words else ""
        rest = words[1] if len(words) > 1 else ""
        if name == "pip":
            lines.append(f"{indent}await __volt_pip__({shlex.split(rest)!r})")
        elif stripped.startswith("%") and name in _IGNORED_MAGICS:
            lines.append(f"{indent}pass")
        elif stripped.startswith("!"):
            lines.append(f"{indent}raise RuntimeError({'Shell commands are not available: this kernel runs in the browser. Use %pip to install packages.'!r})")
        else:
            lines.append(f"{indent}raise RuntimeError({f'UsageError: Line magic function %{name} not found.'!r})")
    return "\n".join(lines)


# --- execution ----------------------------------------------------------------------------------


def _error_output(error):
    """An error output with the traceback from the cell's own frames on, as IPython shows it."""
    tb = error.__traceback__
    while tb is not None and not tb.tb_frame.f_code.co_filename.startswith("<cell"):
        tb = tb.tb_next
    if isinstance(error, SyntaxError) or tb is None:
        lines = traceback.format_exception_only(type(error), error)
    else:
        lines = traceback.format_exception(type(error), error, tb)
    return {
        "output_type": "error",
        "ename": type(error).__name__,
        "evalue": str(error),
        "traceback": "".join(lines).rstrip("\n").split("\n"),
    }


async def execute(cell_id, code):
    global _current, _count
    _current = cell_id
    _count += 1
    count = _count
    status = "ok"
    try:
        runner = CodeRunner(_transform(code), filename=f"<cell {count}>", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT).compile()
        result = await runner.run_async(_namespace)
        if result is not None:
            _namespace["_"] = result
            _flush()
            _output({"output_type": "execute_result", "execution_count": count, "data": _mimebundle(result), "metadata": {}})
        show_figures()
    except BaseException as error:
        _flush()
        pyplot = sys.modules.get("matplotlib.pyplot")
        if pyplot is not None:
            pyplot.close("all")
        _output(_error_output(error))
        status = "error"
    finally:
        _flush()
        _current = None
    return json.dumps({"status": status, "execution_count": count})


def complete(code, cursor):
    """Names and attributes for the identifier before the cursor, as the interactive interpreter
    completes them."""
    match = re.search(r"[A-Za-z_][\w.]*$", code[:cursor])
    matches = []
    if match:
        completer = rlcompleter.Completer(_namespace)
        state = 0
        while len(matches) < 200:
            candidate = completer.complete(match.group(0), state)
            if candidate is None:
                break
            candidate = candidate.rstrip("(")
            if candidate not in matches:
                matches.append(candidate)
            state += 1
    start = match.start() if match else cursor
    return json.dumps({"matches": matches, "cursor_start": start, "cursor_end": cursor})


def _is_current(requirement):
    """Whether the environment has a requirement: installed, and from the machine's own wheel of it
    when the machine has one."""
    import _volt_pip

    name = re.split(r"[\s<>=!~;\[]", requirement, maxsplit=1)[0]
    try:
        version = importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return False
    wheel = _volt_pip.local_wheel(requirement)
    return wheel is None or _volt_pip.wheel_version(wheel) == version


async def prepare(requirements):
    """Installs the packages every notebook of the environment has: the first time, and again when
    the machine has another build of one of its own (the VOLT SDK, once VOLT updates)."""
    outdated = [requirement for requirement in requirements if not _is_current(requirement)]
    if outdated:
        await _pip(["install", "--upgrade", *outdated])
    return json.dumps({"installed": outdated})


def start(bridge):
    global _bridge
    _bridge = bridge
    os.environ.setdefault("MPLBACKEND", "module://_volt_matplotlib")
    sys.stdout = _Stream("stdout")
    sys.stderr = _Stream("stderr")
    builtins.input = _input
    getpass.getpass = _getpass
    if importlib.util.find_spec("IPython") is None:
        sys.modules.update(_ipython_modules())
    _namespace.update({"__builtins__": builtins, "display": display, "__volt_pip__": _pip})
    sys.modules["__main__"] = _main
