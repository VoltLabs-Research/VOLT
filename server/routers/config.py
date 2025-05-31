from fastapi import APIRouter
from server.models.analysis_config import AnalysisConfig

router = APIRouter()

@router.get('/defaults', summary='Get default analysis configuration')
async def get_default_config() -> AnalysisConfig:
    return AnalysisConfig()