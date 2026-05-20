import os
import json
from pathlib import Path

import numpy as np
import pandas as pd

from voltsdk import PluginHub

EXAMPLES_DIR = Path(__file__).resolve().parent
REPO_ROOT = EXAMPLES_DIR.parents[2]
REGISTRY_DIR = EXAMPLES_DIR / "output" / "_plugin_registry"
CACHE_DIR = EXAMPLES_DIR / "output" / "_plugin_cache"
PTM_PLUGIN_BUNDLE = Path(
    os.environ.get(
        "VOLT_PTM_PLUGIN_BUNDLE",
        REPO_ROOT / "voltlabs-ecosystem" / "plugins" / "_dist" / "PolyhedralTemplateMatching" / "polyhedral-template-matching-plugin.zip",
    )
).resolve()
OPENDXA_PLUGIN_BUNDLE = Path(
    os.environ.get(
        "VOLT_OPENDXA_PLUGIN_BUNDLE",
        REPO_ROOT / "voltlabs-ecosystem" / "plugins" / "_dist" / "OpenDXA" / "opendxa-plugin-localstack.zip",
    )
).resolve()


def build_local_registry_index() -> Path:
    REGISTRY_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "plugins": {
            "polyhedral-template-matching": {
                "latest": "1.0.0",
                "versions": {
                    "1.0.0": {
                        "linux-x86_64": {
                            "url": PTM_PLUGIN_BUNDLE.as_uri(),
                            "sha256": "",
                        }
                    }
                },
            },
            "opendxa": {
                "latest": "1.0.0",
                "versions": {
                    "1.0.0": {
                        "linux-x86_64": {
                            "url": OPENDXA_PLUGIN_BUNDLE.as_uri(),
                            "sha256": "",
                        }
                    }
                },
            },
        }
    }

    index_path = REGISTRY_DIR / "index.json"
    index_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return index_path


hub = PluginHub(url=build_local_registry_index().as_uri(), cache_dir=CACHE_DIR)

ptm = hub.get("polyhedral-template-matching")
dxa = hub.get("opendxa")

input_file = "timestep-50000.dump"
output_base = "./output/ptm_dxa"

ptm_run = ptm.run(
    input_file,
    output_base=output_base,
    crystalStructure="FCC",
    rmsd=0.10,
)

dxa_run = dxa.run(
    ptm_run.artifact("annotatedDump") or f"{output_base}_annotated.dump",
    output_base=output_base,
    **{
        "reference-topology": "fcc",
        "clusters-table": ptm_run.artifact("clustersTable"),
        "clusters-transitions": ptm_run.artifact("clustersTransitions"),
        "export-interface-mesh": True,
        "export-structure-identification": True,
        "export-coherent-crystalline-regions": True,
    },
)

dislocations_path = Path(
    dxa_run.artifact("dislocations.json")
    or dxa_run.artifact("dislocations.msgpack")
    or f"{output_base}_dislocations.json"
)

with dislocations_path.open(encoding="utf-8") as fh:
    payload = json.load(fh)

summary_df = pd.DataFrame([payload.get("main_listing", {})])
dislocations_df = pd.json_normalize(
    payload.get("sub_listings", {}).get("dislocation_segments", [])
)

if not dislocations_df.empty:
    dislocations_df[["burgers_x", "burgers_y", "burgers_z"]] = np.asarray(
        dislocations_df["burgers_vector"].tolist(),
        dtype=float,
    )
    dislocations_df[["start_x", "start_y", "start_z"]] = np.asarray(
        dislocations_df["points"].str[0].tolist(),
        dtype=float,
    )
    dislocations_df[["end_x", "end_y", "end_z"]] = np.asarray(
        dislocations_df["points"].str[-1].tolist(),
        dtype=float,
    )

print(summary_df)
print(dislocations_df.head())
