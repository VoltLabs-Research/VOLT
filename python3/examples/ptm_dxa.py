import json
from pathlib import Path

import numpy as np
import pandas as pd

from voltsdk import PluginHub

hub = PluginHub()

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
