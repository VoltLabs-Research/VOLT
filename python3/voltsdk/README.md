# voltsdk

Python SDK for the Volt scientific computing platform.

## Installation

```bash
pip install voltsdk
```

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
print(hub.list())                          # marketplace listing

ptm = hub.get("polyhedral-template-matching")
result = ptm.run(
    "frame.dump",
    output_base="out/frame",
    crystalStructure="FCC",
    rmsd=0.1,
)
print(result.artifact("annotatedDump"))
```

The same hub is exposed on an authenticated client via `client.plugins`.

### Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `VOLT_PLUGIN_REGISTRY` | Registry base URL | `https://server.voltcloud.dev/plugin-registry` |
| `VOLT_CACHE_DIR` | Local plugin cache | `$XDG_CACHE_HOME/volt` |

### Pinning versions

```python
hub.get("opendxa", "1.0.0")     # explicit version
hub["opendxa@1.0.0"]            # shorthand
hub.install("opendxa")          # pre-download the latest bundle
hub.uninstall("opendxa")        # drop every cached version
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
    "opendxa": {
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
```

Each bundle is a flat archive containing `plugin.json`, `bin/<binary>`, and
optional `lib/` and `scripts/` directories.
