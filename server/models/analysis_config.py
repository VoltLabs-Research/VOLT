from typing import Literal 
from pydantic import BaseModel, Field

class AnalysisConfig(BaseModel):
    crystal_structure: Literal["FCC", "BCC", "HCP", "CUBIC_DIAMOND", "HEX_DIAMOND"] = Field(
        default="FCC",
        description='Reference crystal structure (FCC, BCC, etc.)'
    )

    identification_mode: Literal["PTM", "CNA"] = Field(
        default="PTM", 
        description='Local structure identification method (CNA or PTM).'
    )

    max_trial_circuit_size: float = Field(
        default=14.0,
        description='Maximal size of the Burgers circuit (in units of lattice parameter).'
    )

    circuit_stretchability: float = Field(
        default=9.0,
        description='Stretchability parameter of the circuit.'
    )

    defect_mesh_smoothing_level: int = Field(
        default=8,
        description='Smoothing level for the defect mesh (e.g. stacking faults).'
    )
    
    line_smoothing_level: float = Field(
        default=1.0,
        description='Smoothing level for dislocation lines.'
    )
    
    line_point_interval: float = Field(
        default=2.5,
        description='Interval (distance) between points on the final dislocation lines.'
    )

    only_perfect_dislocations: bool = Field(
        default=False,
        description='If True, analyze only perfect dislocations.'
    )
    
    mark_core_atoms: bool = Field(
        default=False,
        description='If True, mark the dislocation core atoms in the output.'
    )