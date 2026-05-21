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

## Plugin hub

VoltSDK ships a Hugging Face-style plugin hub. Plugins live in a static
registry; bundles are downloaded and cached on first use:

```python
from voltsdk import PluginHub

hub = PluginHub()                          # default registry, ~/.cache/volt
print(hub.list())                          # publisher-qualified marketplace listing

ptm = hub.get("voltlabs@polyhedral-template-matching")
result = ptm.run(
    "frame.dump",
    output_base="out/frame",
    crystal_structure="FCC",
    rmsd=0.1,
)
print(result.path("annotated.dump"))
```

The same hub is exposed on an authenticated client via `client.plugins`.

When a plugin subprocess is launched, VoltSDK also prepends its bundled native
runtime directories to `PATH`, `LD_LIBRARY_PATH`, and `DYLD_LIBRARY_PATH`. This
lets downloaded plugin bundles reuse the libraries installed with the wheel.

### Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `VOLT_PLUGIN_REGISTRY` | Registry base URL | `https://server.voltcloud.dev/plugin-registry` |
| `VOLT_CACHE_DIR` | Local plugin cache | `$XDG_CACHE_HOME/volt` |

### Pinning versions

Plugin identifiers are always publisher-qualified: `publisher@plugin`.

```python
hub.get("voltlabs@opendxa", "1.0.0")  # explicit version
hub["voltlabs@opendxa"]               # shorthand for the latest version
hub.install("voltlabs@opendxa")       # pre-download the latest bundle
hub.uninstall("voltlabs@opendxa")     # drop every cached version
```

### Registry layout

The hub expects a static index plus per-platform bundles:

```
<registry>/index.json
<registry>/<key>/<version>/<os>-<arch>.tar.zst
```

`index.json` example:

```json
{
  "plugins": {
    "voltlabs": {
      "opendxa": {
        "publisher": "voltlabs",
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
}
```

Each bundle is a flat archive containing `plugin.json`, `bin/<binary>`, and
optional `lib/` and `scripts/` directories.
