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
pip install "voltsdk[visualization]"
pip install "voltsdk[notebook]"
```

## Authenticated client

```python
from voltsdk import VoltClient

client = VoltClient(
    secret_key="your-secret-key",
    base_url="https://api.example.com",
)
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
glb_path = assembler.dislocations_glb(
    'output/ptm-dxa_dislocations.json',
    output_path='output/ptm-dxa_dislocations.glb',
)

open_in_volt(glb_path)
```

The Python API accepts either the full artifact file (`.json` or `.msgpack`) or
the raw nested payload from `export.AtomisticExporter`, `export.MeshExporter`,
or `export.DislocationExporter`.

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

Plugin identifiers accept both the canonical npm-style form (`@scope/name`) and
the legacy `publisher@name` form. Versions may be exact, the literal `latest`,
or a semver range:

```python
hub.get("@voltlabs/opendxa", "1.0.0")  # canonical, explicit version
hub.get("voltlabs@opendxa", "^1.0.0")  # legacy form + semver range
hub["voltlabs@opendxa"]                # shorthand for the latest version
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
