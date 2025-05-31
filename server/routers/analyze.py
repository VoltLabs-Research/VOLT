from fastapi import APIRouter, HTTPException
from server.models.analysis_config import AnalysisConfig
from server.models.analysis_result import AnalysisResult
from server.config import uploaded_files
from server.utils.analysis import (
    load_analysis_result, 
    load_timestep_data, 
    save_analysis_result, 
    analyze_timestep_wrapper
)

import logging
import traceback

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post('/{file_id}/all', summary='Analyze all timesteps in file')
async def analyze_all_timesteps(file_id: str, config: AnalysisConfig):
    if file_id not in uploaded_files:
        raise HTTPException(status_code=404, detail=f'File with ID {file_id} not found')
    
    metadata = uploaded_files[file_id]
    timesteps = [ts['timestep'] for ts in metadata['timesteps_info']]
    
    results = []
    processed = 0
    errors = 0
    
    logger.info(f'Starting batch analysis of {len(timesteps)} timesteps for file_id {file_id}')
    
    for timestep in timesteps:
        try:
            cached_result = load_analysis_result(file_id, timestep)
            if cached_result:
                results.append(cached_result)
                processed += 1
                continue
            
            timestep_data = load_timestep_data(file_id, timestep)
            if timestep_data:
                result = analyze_timestep_wrapper(timestep_data, config)
                save_analysis_result(file_id, timestep, result)
                results.append(result)
                processed += 1
            else:
                errors += 1
                
        except Exception as e:
            logger.error(f'Error analyzing timestep {timestep}: {e}')
            errors += 1
        
        if processed % 50 == 0:
            logger.info(f'Batch analysis progress: {processed}/{len(timesteps)} timesteps processed')
    
    return {
        'file_id': file_id,
        'total_timesteps': len(timesteps),
        'processed': processed,
        'errors': errors,
        'results': results
    }

@router.post('/{file_id}/timesteps/{timestep}', summary='Analyze specific timestep')
async def analyze_timestep_endpoint(file_id: str, timestep: int, config: AnalysisConfig):
    if file_id not in uploaded_files:
        raise HTTPException(status_code=404, detail=f'File with ID {file_id} not found')

    cached_result = load_analysis_result(file_id, timestep)
    if cached_result:
        logger.info(f'Returning cached analysis result for {file_id}_{timestep}')
        return AnalysisResult(**cached_result)

    timestep_data = load_timestep_data(file_id, timestep)
    if timestep_data is None:
        metadata = uploaded_files[file_id]
        available_timesteps = [timestep['timestep'] for timestep in metadata['timesteps_info']]
        raise HTTPException(
            status_code=404,
            detail=f'Timestep {timestep} not found for file {file_id}. Available: {available_timesteps[:10]}...'
        )

    try:
        logger.info(f'Analyzing timestep {timestep} from file_id {file_id}')
        result = analyze_timestep_wrapper(timestep_data, config)
        
        save_analysis_result(file_id, timestep, result)
        
        return AnalysisResult(**result)
    except Exception as e:
        logger.error(f'Error analyzing timestep: {e}')
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f'Analysis error: {str(e)}')