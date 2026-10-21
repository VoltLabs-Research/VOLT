# @volt/web-runtime

VOLT's backends, run in a browser tab. The server, the cluster daemon with its planes, and the
plugins the daemon runs are the same programs the desktop runs. They run unmodified in module
workers, on a Node platform implemented over browser APIs:

- **Network.** A loopback network between workers (`127.0.0.1`), with `http`, `ws` and `fetch`
  over it.
- **Files.** A synchronous `fs` on the origin private file system. The workspace persists between
  visits, as the desktop's data directory does.
- **Databases.** `better-sqlite3` on sqlite-wasm, and `@duckdb/node-api` on duckdb-wasm.
- **Processes.** `child_process` and `worker_threads` as workers. Stdin is a shared-memory pipe, so
  a program's blocking reads work.
- **Native addons.** The backends' native Node addons are compiled to WebAssembly from their own
  `binding.gyp` with Emscripten and emnapi.

Plugins are Node programs too. Their `wasm-wasm32` builds (CoreToolkit's `volt_wasm_program`) run as
`bin/<name>` and query the DuckDB installed on the machine. A machine reporting `wasm32` asks the
registry for `wasm-wasm32` bundles. Python plugins need an interpreter and cannot run here.

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
```

Each smoke runs a page of `smoke/` in headless Chrome (`CHROME_PATH`, `/usr/bin/google-chrome` by
default) and fails unless the page reaches its last step.
