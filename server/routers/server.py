from fastapi import APIRouter
from typing import Dict, Any
from server.config import uploaded_files, analysis_cache, DATA_DIR

router = APIRouter()

@router.get('/', summary='API Health Check')
async def health_check():
    return {
        'message': 'OpenDXA API Server is running',
        'version': '1.0.0',
        'status': 'healthy'
    }

@router.get('/status', summary='Get server status')
async def get_status() -> Dict[str, Any]:
    total_timesteps = sum(
        metadata['total_timesteps'] 
        for metadata in uploaded_files.values()
    )

    return {
        'status': 'running',
        'uploaded_files': len(uploaded_files),
        'total_timesteps_stored': total_timesteps,
        'cached_results': len(analysis_cache),
        'data_directory': str(DATA_DIR),
        'version': '1.0.0'
    }