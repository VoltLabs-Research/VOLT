from pydantic import BaseModel, Field
from typing import Optional, List

class AnalysisConfig(BaseModel):
    cna_cutoff: Optional[float] = Field(default=None, description='Common Neighbor Analysis (CNA) cutoff radius')
    inputfile: str = Field(description='Input atom file path')
    outputfile: str = Field(description='Output JSON file path')
    pbc: Optional[List[int]] = Field(default=None, description='Periodic boundary conditions (X Y Z) - 1 for periodic, 0 for non-periodic')
    offset: Optional[List[float]] = Field(default=None, description='Atom position offset (X Y Z)')
    scale: Optional[List[float]] = Field(default=None, description='Cell scaling factors (X Y Z)')
    
    # Circuit and analysis parameters
    maxcircuitsize: int = Field(default=12, description='Maximum size for Burgers circuit detection')
    extcircuitsize: int = Field(default=14, description='Maximum size for extended Burgers circuit detection')
    
    # Smoothing and processing parameters
    smoothsurface: int = Field(default=8, description='Surface smoothing level for dislocation surface extraction')
    smoothlines: int = Field(default=1, description='Line smoothing level for dislocation line processing')
    coarsenlines: int = Field(default=1, description='Line coarsening level to reduce point density')
    flattensf: float = Field(default=0.0, description='Stacking fault flattening level')