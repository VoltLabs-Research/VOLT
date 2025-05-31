from fastapi import FastAPI, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
from contextlib import asynccontextmanager
from concurrent.futures import ProcessPoolExecutor
from opendxa.utils.ptm_templates import get_ptm_templates
from opendxa.utils.logging import setup_logging
from opendxa.core import init_worker
from server.models.analysis_config import AnalysisConfig
from server.models.analysis_result import AnalysisResult
from server.services.connection_manager import manager
from server.config import DATA_DIR, TIMESTEPS_DIR, RESULTS_DIR
from server.utils.analysis import (
    save_analysis_result,
    load_timestep_data,
    load_analysis_result,
    process_all_timesteps,
    analyze_timestep_wrapper
)

import json
import os
import tempfile
import logging
import uvicorn
import uuid
import time
import traceback
import argparse
import traceback
import time
import argparse
import uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TEMPLATES, TEMPLATES_SIZES = get_ptm_templates()
executor = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    '''Lifespan event handler for startup and shutdown'''
    global executor
    logger.info('Initializing OpenDXA API Server...')
    executor = ProcessPoolExecutor(
        max_workers=4,
        initializer=init_worker,
        initargs=(TEMPLATES, TEMPLATES_SIZES)
    )
    logger.info('OpenDXA API Server initialized successfully')
    yield

    logger.info('Shutting down OpenDXA API Server...')
    if executor:
        executor.shutdown(wait=True)
    logger.info('OpenDXA API server shutdown complete')

app = FastAPI(
    title='OpenDXA API Server',
    description='REST API for Open Dislocation Extraction Algorithm',
    version='1.0.0',
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

@app.post('/analyze/{file_id}/timesteps/{timestep}', summary='Analyze specific timestep')
async def analyze_timestep_endpoint(
    file_id: str,
    timestep: int,
    config: AnalysisConfig
) -> AnalysisResult:
    '''Analyze a specific timestep from an uploaded file'''
    if file_id not in uploaded_files:
        raise HTTPException(status_code=404, detail=f'File with ID {file_id} not found')
    
    cached_result = load_analysis_result(file_id, timestep)
    if cached_result:
        logger.info(f'Returning cached analysis result for {file_id}_{timestep}')
        return AnalysisResult(**cached_result)
    
    timestep_data = load_timestep_data(file_id, timestep)
    if timestep_data is None:
        metadata = uploaded_files[file_id]
        available_timesteps = [ts['timestep'] for ts in metadata['timesteps_info']]
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

@app.post('/analyze/{file_id}/all', summary='Analyze all timesteps in file')
async def analyze_all_timesteps(
    file_id: str,
    config: AnalysisConfig
) -> Dict[str, Any]:
    '''Analyze all timesteps in a file (batch processing)'''
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

@app.delete('/files/{file_id}', summary='Delete uploaded file and all associated data')
async def delete_file(file_id: str) -> Dict[str, str]:
    '''Delete an uploaded file and all its associated timestep data'''
    if file_id not in uploaded_files:
        raise HTTPException(status_code=404, detail=f'File with ID {file_id} not found')
    
    try:
        metadata = uploaded_files[file_id]
        
        if os.path.exists(metadata['file_path']):
            os.unlink(metadata['file_path'])
        
        for timestep_info in metadata['timesteps_info']:
            timestep = timestep_info['timestep']
            timestep_file = TIMESTEPS_DIR / f'{file_id}_{timestep}.pkl'
            if timestep_file.exists():
                timestep_file.unlink()
            
            result_file = RESULTS_DIR / f'{file_id}_{timestep}_analysis.json'
            if result_file.exists():
                result_file.unlink()
        
        del uploaded_files[file_id]
        
        keys_to_remove = [key for key in analysis_cache.keys() if key.startswith(file_id)]
        for key in keys_to_remove:
            del analysis_cache[key]
        
        return {
            'message': f'File {file_id} and all associated data deleted successfully'
        }
        
    except Exception as e:
        logger.error(f'Error deleting file: {e}')
        raise HTTPException(status_code=500, detail=f'Error deleting file: {str(e)}')
    
@app.get('/config/defaults', summary='Get default analysis configuration')
async def get_default_config() -> AnalysisConfig:
    '''Get default analysis configuration'''
    return AnalysisConfig()

@app.get('/status', summary='Get server status')
async def get_status() -> Dict[str, Any]:
    '''Get server status and statistics'''
    total_timesteps = sum(metadata['total_timesteps'] for metadata in uploaded_files.values())
    
    return {
        'status': 'running',
        'uploaded_files': len(uploaded_files),
        'total_timesteps_stored': total_timesteps,
        'cached_results': len(analysis_cache),
        'data_directory': str(DATA_DIR),
        'version': '1.0.0'
    }

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='OpenDXA FastAPI Server')
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind to')
    parser.add_argument('--port', type=int, default=8000, help='Port to bind to')
    parser.add_argument('--reload', action='store_true', help='Enable auto-reload')
    parser.add_argument('--workers', type=int, default=1, help='Number of workers')
    args = parser.parse_args()

    setup_logging()

    print(f'''
    🚀 OpenDXA API Server Starting...
    
    📍 URL: http://{args.host}:{args.port}
    📖 Docs: http://{args.host}:{args.port}/docs
    🔍 Interactive API: http://{args.host}:{args.port}/redoc
    
    📁 Upload files via POST /upload
    🔬 Analyze via POST /analyze/{{file_id}}/timesteps/{{timestep}}
    📊 Get positions via GET /files/{{file_id}}/timesteps/{{timestep}}/positions
    🌐 WebSocket streaming via WS /ws/timesteps/{{file_id}}
    ''')

    uvicorn.run(
        'api_server:app' if args.reload else app,
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=args.workers if not args.reload else 1
    )