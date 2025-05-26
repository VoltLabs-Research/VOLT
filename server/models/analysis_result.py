from pydantic import BaseModel
from typing import List, Dict, Optional, Any

class AnalysisResult(BaseModel):
    success: bool
    timestep: int
    dislocations: List[Dict[str, Any]]
    analysis_metadata: Dict[str, Any]
    execution_time: float
    error: Optional[str] = None