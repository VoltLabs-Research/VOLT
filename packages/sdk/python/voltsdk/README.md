# voltsdk

Python SDK for the Volt scientific computing platform.

## Installation

```bash
pip install voltsdk
```

`pip` will select the platform wheel that matches the host operating system and
architecture. VoltSDK wheels bundle the native Volt runtime under
`voltsdk/native/{bin,lib,share}`, so users do not need to install the shipped
TBB, hwloc, and related shared libraries manually for the bundled binaries.

Supported wheel targets published by CI:

- `linux_x86_64` built on `ubuntu-24.04`
- `macosx_14_0_arm64`
- `win_amd64`

Linux wheels target the Ubuntu 24.04 build baseline. Older glibc releases are
not supported; document that requirement in downstream READMEs when you ship
Linux-native workflows.

Optional extras:

```bash
pip install "voltsdk[ovito]"   # OVITO pipeline integration
```

## Authenticated client

Inside a Volt notebook the client is already wired up — no arguments needed:

```python
from voltsdk import VoltClient

client = VoltClient.from_env()      # reads VOLT_SECRET_KEY + VOLT_BASE_URL
print(client.team)
```

Outside Volt, pass a key and the server origin. The `/api` suffix is optional —
a bare origin works too:

```python
client = VoltClient(
    secret_key="vsk_your_key_here",
    base_url="https://volt.example.com",   # or https://volt.example.com/api
)
```

## Reading data into pandas

```python
traj = client.trajectories.get("<trajectory-id>")

# Every atom of a frame (all pages fetched and concatenated):
df = traj.frames.first().atoms()

# An analysis results table:
analysis = traj.analyses.first()
df = analysis.df()                     # shortcut for analysis.listings.to_dataframe()
```

## Open In Volt

Use the Volt web canvas as the viewer for local GLBs, GLB sequences, or
existing Volt resources:

```python
from voltsdk import open_in_volt

open_in_volt('out/frame.glb')
open_in_volt({
    0: 'out/frame-0000.glb',
    5000: 'out/frame-5000.glb',
    10000: 'out/frame-10000.glb',
})
```

Resource helpers open the exact canvas route:

```python
trajectory.open_in_volt(timestep=5000)
frame.open_in_volt()
analysis.open_in_volt(timestep=5000)
exposure.open_in_volt(5000)
run['dislocations'].open_in_volt()
```

For plugin artifacts, `open_in_volt(...)` auto-assembles supported `.json`
and `.msgpack` exporter payloads into a sibling `.glb` when needed.

For local files, VoltSDK serves them directly to `/canvas/glb` without creating
fake analyses. In a Volt notebook it uses the Jupyter proxy; on a local machine
it starts a tiny background file server. The browser still needs an authenticated
Volt session. By default the viewer opens against `https://app.voltcloud.dev`;
override it with `volt_url=...` or `VOLT_APP_URL` if needed.

## SpatialAssembler

Volt exporter payloads can also be rendered locally from Python:

```python
from voltsdk import SpatialAssembler, open_in_volt

assembler = SpatialAssembler()
glb_path = assembler.lines_glb(
    'output/ptm-dxa_dislocations.json',
    output_path='output/ptm-dxa_dislocations.glb',
)

open_in_volt(glb_path)
```

The Python API accepts either the full artifact file (`.json`, `.msgpack`, or a
`.parquet` line entity table with `id`/`points` plus per-entity property columns)
or the raw nested payload from `export.AtomisticExporter`, `export.MeshExporter`,
or `export.LineExporter`.

You can also let a `PluginRun` do the conversion directly:

```python
viewer_url = dxa_run['dislocations'].open_in_volt(open_browser=False)
mesh_glb = dxa_run['defect_mesh'].glb()
```

## Plugin hub

VoltSDK 3.0 talks to the new [Volt-Registry](https://registry.voltcloud.dev) API
(`/packages/:scope/:name`, `/-/search`) instead of the legacy hierarchical
`index.json`. Bundles are downloaded and cached on first use:

```python
from voltsdk import PluginHub

hub = PluginHub(default_publisher="voltlabs")
print(hub.list())                          # publisher-qualified marketplace listing

ptm = hub.get("polyhedral-template-matching")
result = ptm(
    "frame.dump",
    output_dir="out",
    crystal_structure="FCC",
    rmsd=0.1,
)
print(result["annotated.dump"].path)
```

The same hub is exposed on an authenticated client via `client.plugins`.

When a plugin subprocess is launched, VoltSDK also prepends its bundled native
runtime directories to `PATH`, `LD_LIBRARY_PATH`, and `DYLD_LIBRARY_PATH`. This
lets downloaded plugin bundles reuse the libraries installed with the wheel.

### Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `VOLT_PLUGIN_REGISTRY` | Volt-Registry base URL | `https://registry.voltcloud.dev` |
| `VOLT_CACHE_DIR` | Local plugin cache | `$XDG_CACHE_HOME/volt` |
| `VOLT_REGISTRY_TOKEN` | Optional Bearer JWT/PAT for authenticated reads | _unset_ |

### Pinning versions

Plugin identifiers use the npm-style form `@scope/name` (or a bare name when a
`default_publisher` is set on the hub). Versions may be exact, the literal
`latest`, or a caret range (`^x.y.z`):

```python
hub.get("@voltlabs/opendxa", "1.0.0")  # explicit version
hub.get("@voltlabs/opendxa", "^1.0.0")  # caret range
hub["@voltlabs/opendxa"]               # shorthand for the latest version
hub.install("@voltlabs/opendxa")       # pre-download the latest bundle
hub.uninstall("@voltlabs/opendxa")     # drop every cached version
```

### Registry endpoints

The Volt-Registry API endpoints VoltSDK consumes:

```
GET <registry>/packages/:scope/:name              -> Packument
GET <registry>/packages/:scope/:name/:version     -> VersionMetadata
GET <registry>/packages/:scope/:name/:version/-/:platform.tgz  -> 307 to signed tarball
GET <registry>/-/search?kind=engine&page=...      -> Search results
```

Each bundle is a tar+gzip archive containing `bin/<binary>` and optional
`lib/`, `scripts/`, and `share/` directories. The registry returns a 307
redirect to a signed RustFS URL for the actual tarball download.

## Reporting progress from a plugin

A plugin tells VOLT how far it is with lines of its own on **stderr**. VOLT
takes them out of the run's log and shows them as the job's progress: in the
jobs panel, the canvas log, the run's row and its report. Any language can write
them, and stderr is the one channel every runtime gives a plugin, the browser's
included:

```
@volt:progress 0.42                  a fraction, 0..1
@volt:progress 42%                   a percentage
@volt:progress 340/1000 Meshing      done/total, then what it is doing
@volt:status Indexing neighbours     what it is doing, without a value
```

A line has to start with the directive; anything else stays in the log. VOLT
shows about one value a second, so there is no need to write one per iteration.
A `@volt:status` is also kept in the log as a `[Volt]` line, so a failed run's
log says what it was doing.

A persistent Python plugin can write `process(frame, config)` as a generator,
the way OVITO's `modify()` reports progress: each yielded number is how far it
is, each yielded string what it is doing, and what it returns is its result.

```python
def process(frame, config):
    yield "Meshing cells"
    for index, cell in enumerate(cells):
        ...
        yield (index + 1) / len(cells)
    return result
```

From a Python script that runs as a process of its own, `report_progress` and
`report_status` write the lines and skip the ones closer together than VOLT
shows:

```python
from voltsdk import report_progress, report_status

report_status("Meshing cells")
for index, cell in enumerate(cells):
    ...
    report_progress(index + 1, len(cells))
```

From C or C++, write the line and flush it:

```cpp
std::fprintf(stderr, "@volt:progress %zu/%zu Meshing\n", done, total);
std::fflush(stderr);
```
