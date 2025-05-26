from pydantic import BaseModel, Field
from typing import Optional
from models.analysis_config import AnalysisConfig

class AnalysisRequest(BaseModel):
    timestep: Optional[int] = Field(default=None, description='Specific timestep to analyze (None for first)')
    config: AnalysisConfig = Field(default_factory=AnalysisConfig, description='Analysis configuration')