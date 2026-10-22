# @volt/web-runtime

VOLT's backends, run in a browser tab or in the desktop app's window. The server, the cluster daemon
with its planes, and the plugins the daemon runs are the same programs a self-hosted deployment runs.
They run unmodified in module workers, on a Node platform implemented over browser APIs:

- **Network.** A loopback network between workers (`127.0.0.1`), with `http`, `ws` and `fetch`
  over it.
- **Files.** A synchronous `fs` on the origin private file system. The workspace persists between
  visits.
- **Databases.** `better-sqlite3` on sqlite-wasm, and `@duckdb/node-api` on duckdb-wasm.
- **Processes.** `child_process` and `worker_threads` as workers. Stdin is a shared-memory pipe, so
  a program's blocking reads work.
- **Native addons.** The backends' native Node addons are compiled to WebAssembly from their own
  `binding.gyp` with Emscripten and emnapi.

Plugins are Node programs too. Their `wasm-wasm32` builds (CoreToolkit's `volt_wasm_program`) run as
`bin/<name>` and query the DuckDB installed on the machine. A machine reporting `wasm32` asks the
registry for `wasm-wasm32` bundles.

## Python

Every machine has a `python3` on its `PATH` (`src/python`): CPython compiled to WebAssembly, from
the Pyodide release in `package.json`, run as Node runs it. A backend spawns it as it spawns
`python3` anywhere. It sees the process's files, reads and writes its standard streams, and exits
with its code.

- **Virtual environments.** `python3 -m venv DIR` writes what Python's `venv` writes. The
  interpreter in its `bin/` is a copy of the `python3` executable, and the runtime runs a copy as
  the program it names.
- **Packages.** `python3 -m pip install` installs into the running environment with micropip. It
  takes Pyodide's builds of packages with native code (numpy, pandas, pyarrow, scikit-learn, ...)
  and pure-Python wheels from PyPI. Installs are kept with the environment. Pyodide keeps the wheels
  it downloads next to its files in `/usr/local/lib/pyodide`.
- **The SDK.** The build packages `packages/sdk/python` as a wheel, which every machine has in
  `/usr/local/share/python-wheels`. `pip install voltsdk` installs that wheel rather than PyPI's,
  so code here uses the SDK of the server it talks to. The wheel's version ends in the digest of its
  files (`3.1.1+afe0a4816516`), and `pip install -U voltsdk` replaces another build with it.
- **Plugins.** The daemon provisions a Python plugin as it does on a machine: a virtual environment,
  `pip install -r requirements.txt`, then its script with the plugin stub.

Python is a guest here, not the host, so a few things work differently:

- There is no `subprocess` and no threads.
- `requests` reaches the backends through the service worker's relay.
- The first install of a package downloads it from Pyodide's CDN.
- The SDK's `SpatialAssembler` needs `volt-spatial-assembler`, a native extension with no build
  for Pyodide.

## Notebooks

A client running its stack runs its notebooks' kernels in the page (`src/host/notebook-kernels.ts`).
Each kernel is a `python3 -m volt_kernel` process with the notebook's credentials for the server. It
runs cells as IPython does: rich outputs, matplotlib figures, top-level `await`, `%pip`, `input()`
and interrupts.

The kernels share a file system of their own. In it, each workspace has a virtual environment and a
working directory that all its notebooks use: what one notebook installs or writes, the others have.
The first kernel of a workspace creates its environment and installs `voltsdk`. A kernel that finds
another build of the SDK than the machine's installs the machine's, so notebooks follow VOLT's updates.

## Using it from a web client

The client adds the Vite plugin. It serves the built runtime under `/volt-runtime/` and the service
worker at `/volt-service-worker.js`, and copies both into the build:

```ts
import voltWebRuntime from '@volt/web-runtime/vite';

export default defineConfig({ plugins: [voltWebRuntime()] });
```

Then it starts the stack with `startBrowserStack` (`@volt/web-runtime/host/browser-stack`), as
`packages/apps/client/src/modules/local-stack` does. The service worker relays the page's `/api` and
`/socket.io` requests to the stack. It also makes the page cross-origin isolated, which
`SharedArrayBuffer` needs. Only one tab of an origin runs the stack.

## Using it from the desktop app

The desktop app (`packages/apps/desktop`) is a window onto the same build of the client. It serves the
client's `dist` at `https://volt.invalid`, with the COOP/COEP headers the service worker adds in a
browser, and the client runs its stack there as it does in a tab. The origin's storage is the app's
own and is persistent, so nothing evicts the workspace.

## Building

```bash
source ~/emsdk/emsdk_env.sh           # Emscripten 3.1.74, as CI uses
pnpm --filter "@volt/web-runtime^..." build
pnpm --filter @volt/web-runtime build
```

The build bundles the backends' built `dist/`, so build them first. It compiles native addons into
`node_modules/.cache/native-addons`, rebuilding only when a source changes.

The daemon's `vendor/` tools, `volt-dump-transform` and `zstd`, come from the `wasm-wasm32` assets of
the CoreToolkit release that `cluster-daemon`'s `coreToolkitTools` pins. To use a local CoreToolkit
build instead, point `VOLT_WASM_TOOLS_DIR` at its install prefix:

```bash
packages/coretoolkit/scripts/build-wasm-plugin.sh   # no plugin: CoreToolkit's own programs
VOLT_WASM_TOOLS_DIR=packages/coretoolkit/install-wasm pnpm --filter @volt/web-runtime build
```

## Testing

```bash
pnpm --filter @volt/web-runtime smoke page       # the Node platform in a worker
pnpm --filter @volt/web-runtime smoke programs   # Node programs spawned with binary stdio
pnpm --filter @volt/web-runtime smoke stack      # the whole stack provisioned, as the client does
pnpm --filter @volt/web-runtime smoke python     # python3: venv, pip, stdio and exit codes
pnpm --filter @volt/web-runtime smoke notebook   # notebook kernels in the page
```

The Python pages download their packages from Pyodide's CDN, so they need the network.

Each smoke runs a page of `smoke/` in headless Chrome (`CHROME_PATH`, `/usr/bin/google-chrome` by
default) and fails unless the page reaches its last step.
