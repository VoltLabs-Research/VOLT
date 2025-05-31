from fastapi import FastAPI, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor
from opendxa.parser import LammpstrjParser
from opendxa.utils.ptm_templates import get_ptm_templates
from opendxa.utils.logging import setup_logging
from opendxa.core import analyze_timestep, init_worker
from server.models.analysis_config import AnalysisConfig
from server.models.analysis_result import AnalysisResult
from server.services.connection_manager import manager
from server.utils.analysis import (
    save_analysis_result,
    save_timestep_data,
    load_analysis_result,
    process_all_timesteps
)

import pickle
import json
import os
import tempfile
import logging
import uvicorn
import uuid
import time
import traceback
import asyncio
import argparse
import traceback
import time
import argparse
import uuid
import asyncio

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

uploaded_files: Dict[str, Dict[str, Any]] = {}
analysis_cache: Dict[str, Dict] = {}

async def stream_timesteps_data(
    websocket: WebSocket, 
    file_id: str, 
    timesteps: List[int], 
    include_positions: bool = True,
    batch_size: int = 10,
    delay_ms: int = 100
):
    """Stream timestep data through WebSocket"""
    session_id = f"{file_id}_{id(websocket)}"
    manager.streaming_sessions[session_id] = True
    
    try:
        total_timesteps = len(timesteps)
        await manager.send_personal_message(json.dumps({
            "type": "stream_start",
            "file_id": file_id,
            "total_timesteps": total_timesteps,
            "batch_size": batch_size
        }), websocket)

        # Procesar en lotes
        for i in range(0, len(timesteps), batch_size):
            # Verificar si la sesión sigue activa
            if not manager.streaming_sessions.get(session_id, False):
                break
                
            batch_timesteps = timesteps[i:i + batch_size]
            batch_data = []
            
            for timestep in batch_timesteps:
                try:
                    if include_positions:
                        # Cargar datos completos del timestep
                        timestep_data = load_timestep_data(file_id, timestep)
                        if timestep_data:
                            positions = safe_to_list(timestep_data['positions'])
                            atom_types = safe_to_list(timestep_data.get('atom_types', []))
                            box_bounds = safe_to_list(timestep_data.get('box_bounds', None))
                            
                            batch_data.append({
                                "timestep": timestep,
                                "atoms_count": len(positions),
                                "positions": positions,
                                "atom_types": atom_types,
                                "box_bounds": box_bounds
                            })
                    else:
                        # Solo metadatos básicos
                        timestep_data = load_timestep_data(file_id, timestep)
                        if timestep_data:
                            batch_data.append({
                                "timestep": timestep,
                                "atoms_count": len(timestep_data['positions']),
                                "has_data": True
                            })
                        
                except Exception as e:
                    logger.error(f"Error loading timestep {timestep}: {e}")
                    batch_data.append({
                        "timestep": timestep,
                        "error": str(e)
                    })

            # Enviar lote
            message = {
                "type": "timestep_batch",
                "file_id": file_id,
                "batch_index": i // batch_size,
                "total_batches": (len(timesteps) + batch_size - 1) // batch_size,
                "data": batch_data,
                "progress": {
                    "current": min(i + batch_size, len(timesteps)),
                    "total": total_timesteps
                }
            }
            
            await manager.send_personal_message(json.dumps(message), websocket)
            
            # Pequeña pausa para no saturar
            if delay_ms > 0:
                await asyncio.sleep(delay_ms / 1000)

        # Señal de finalización
        await manager.send_personal_message(json.dumps({
            "type": "stream_complete",
            "file_id": file_id,
            "total_timesteps": total_timesteps
        }), websocket)

    except Exception as e:
        logger.error(f"Error in stream_timesteps_data: {e}")
        await manager.send_personal_message(json.dumps({
            "type": "stream_error",
            "file_id": file_id,
            "error": str(e)
        }), websocket)
    finally:
        # Limpiar sesión
        if session_id in manager.streaming_sessions:
            del manager.streaming_sessions[session_id]

@app.websocket("/ws/timesteps/{file_id}")
async def websocket_timesteps(websocket: WebSocket, file_id: str):
    """WebSocket endpoint para streaming de timesteps"""
    await manager.connect(websocket)
    
    if file_id not in uploaded_files:
        await manager.send_personal_message(json.dumps({
            "type": "error",
            "message": f"File with ID {file_id} not found"
        }), websocket)
        await websocket.close()
        return

    try:
        metadata = uploaded_files[file_id]
        timesteps = [ts['timestep'] for ts in metadata['timesteps_info']]
        
        # Enviar información inicial
        await manager.send_personal_message(json.dumps({
            "type": "connection_established",
            "file_id": file_id,
            "filename": metadata['original_filename'],
            "total_timesteps": len(timesteps),
            "available_timesteps": timesteps[:100]  # Enviar solo los primeros 100 para no saturar
        }), websocket)

        while True:
            # Esperar comandos del cliente
            data = await websocket.receive_text()
            command = json.loads(data)
            
            if command["type"] == "start_stream":
                include_positions = command.get("include_positions", True)
                batch_size = command.get("batch_size", 10)
                delay_ms = command.get("delay_ms", 100)
                
                # Filtrar timesteps si se especifica un rango
                start_timestep = command.get("start_timestep")
                end_timestep = command.get("end_timestep")
                
                filtered_timesteps = timesteps
                if start_timestep is not None or end_timestep is not None:
                    filtered_timesteps = [
                        ts for ts in timesteps 
                        if (start_timestep is None or ts >= start_timestep) and
                           (end_timestep is None or ts <= end_timestep)
                    ]
                
                await stream_timesteps_data(
                    websocket, 
                    file_id, 
                    filtered_timesteps, 
                    include_positions, 
                    batch_size, 
                    delay_ms
                )
                
            elif command["type"] == "stop_stream":
                session_id = f"{file_id}_{id(websocket)}"
                manager.streaming_sessions[session_id] = False
                await manager.send_personal_message(json.dumps({
                    "type": "stream_stopped",
                    "file_id": file_id
                }), websocket)
                
            elif command["type"] == "get_timestep":
                timestep = command["timestep"]
                try:
                    timestep_data = load_timestep_data(file_id, timestep)
                    if timestep_data:
                        positions = safe_to_list(timestep_data['positions'])
                        atom_types = safe_to_list(timestep_data.get('atom_types', []))
                        box_bounds = safe_to_list(timestep_data.get('box_bounds', None))
                            
                        await manager.send_personal_message(json.dumps({
                            "type": "single_timestep",
                            "timestep": timestep,
                            "data": {
                                "atoms_count": len(positions),
                                "positions": positions,
                                "atom_types": atom_types,
                                "box_bounds": box_bounds
                            }
                        }), websocket)
                    else:
                        await manager.send_personal_message(json.dumps({
                            "type": "error",
                            "message": f"Timestep {timestep} not found"
                        }), websocket)
                except Exception as e:
                    await manager.send_personal_message(json.dumps({
                        "type": "error",
                        "message": f"Error loading timestep {timestep}: {str(e)}"
                    }), websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        # Detener cualquier streaming activo
        session_id = f"{file_id}_{id(websocket)}"
        if session_id in manager.streaming_sessions:
            manager.streaming_sessions[session_id] = False
            del manager.streaming_sessions[session_id]
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await manager.send_personal_message(json.dumps({
            "type": "error",
            "message": str(e)
        }), websocket)

def args_from_config(config: AnalysisConfig, output_file: str = 'temp_output.json') -> object:
    '''Convert AnalysisConfig to args object compatible with OpenDXA'''
    class Args:
        pass
    
    args = Args()
    
    args.cutoff = config.cutoff
    args.num_neighbors = config.num_neighbors
    args.min_neighbors = config.min_neighbors
    args.voronoi_factor = config.voronoi_factor
    args.tolerance = config.tolerance
    args.max_loop_length = config.max_loop_length
    args.burgers_threshold = config.burgers_threshold
    args.crystal_type = config.crystal_type
    args.lattice_parameter = config.lattice_parameter
    args.allow_non_standard_burgers = config.allow_non_standard_burgers
    args.validation_tolerance = config.validation_tolerance
    args.fast_mode = config.fast_mode
    args.max_loops = config.max_loops
    args.max_connections_per_atom = config.max_connections_per_atom
    args.loop_timeout = config.loop_timeout
    args.include_segments = config.include_segments and not config.no_segments
    args.segment_length = config.segment_length
    args.min_segments = config.min_segments
    args.no_segments = config.no_segments
    args.workers = 1
    args.output = output_file
    args.verbose = False
    args.track_dir = None
    
    return args

def analyze_timestep_wrapper(data: Dict, config: AnalysisConfig) -> Dict:
    '''Wrapper function for analyze_timestep that returns results instead of writing to file'''
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
            args = args_from_config(config, temp_file.name)

            start_time = time.time()
            analyze_timestep(data, args)
            end_time = time.time()
            execution_time = end_time - start_time

            # Check if output file exists and has content
            if os.path.exists(temp_file.name):
                file_size = os.path.getsize(temp_file.name)
                logger.info(f"Output file created: {temp_file.name}, size: {file_size} bytes")
                
                if file_size > 0:
                    try:
                        with open(temp_file.name, 'r') as file:
                            result = json.load(file)
                        os.unlink(temp_file.name)

                        return {
                            'success': True,
                            'timestep': data['timestep'],
                            'dislocations': result.get('dislocations', []),
                            'analysis_metadata': result.get('analysis_metadata', {}),
                            'execution_time': execution_time,
                            'error': None
                        }
                    except json.JSONDecodeError as e:
                        logger.error(f"JSON decode error in output file: {e}")
                        # Read the file content for debugging
                        with open(temp_file.name, 'r') as file:
                            content = file.read()
                        logger.error(f"File content (first 1000 chars): {content[:1000]}")
                        os.unlink(temp_file.name)
                        
                        return {
                            'success': False,
                            'timestep': data['timestep'],
                            'dislocations': [],
                            'analysis_metadata': {},
                            'execution_time': execution_time,
                            'error': f'JSON decode error: {str(e)}'
                        }
                else:
                    logger.error(f"Output file is empty: {temp_file.name}")
                    os.unlink(temp_file.name)
                    return {
                        'success': False,
                        'timestep': data['timestep'],
                        'dislocations': [],
                        'analysis_metadata': {},
                        'execution_time': execution_time,
                        'error': 'Output file is empty - analysis may have failed silently'
                    }
            else:
                logger.error(f"Output file not created: {temp_file.name}")
                return {
                    'success': False,
                    'timestep': data['timestep'],
                    'dislocations': [],
                    'analysis_metadata': {},
                    'execution_time': execution_time,
                    'error': 'No output file generated'
                }
    except Exception as e:
        logger.error(f'Error in analysis: {e}', exc_info=True)
        return {
            'success': False,
            'timestep': data.get('timestep', -1),
            'dislocations': [],
            'analysis_metadata': {},
            'execution_time': 0,
            'error': str(e)
        }

# Todos los endpoints REST existentes...
@app.get('/', summary='API Health Check')
async def root():
    '''Health check endpoint'''
    return {
        'message': 'OpenDXA API Server is running',
        'version': '1.0.0',
        'status': 'healthy'
    }

@app.post('/upload', summary='Upload LAMMPS trajectory file and process all timesteps')
async def upload_file(file: UploadFile = File(...)) -> Dict[str, Any]:
    '''Upload a LAMMPS trajectory file and process all timesteps'''
    try:
        file_id = str(uuid.uuid4())
        
        temp_dir = tempfile.gettempdir()
        file_path = os.path.join(temp_dir, f'opendxa_{file_id}_{file.filename}')
        
        with open(file_path, 'wb') as buffer:
            content = await file.read()
            buffer.write(content)
        
        logger.info(f'Starting to process all timesteps for file: {file.filename}')
        processing_result = process_all_timesteps(file_path, file_id)
        
        uploaded_files[file_id] = {
            'original_filename': file.filename,
            'file_path': file_path,
            'file_size': len(content),
            'upload_time': time.time(),
            'total_timesteps': processing_result['total_timesteps'],
            'atoms_count': processing_result['atoms_count'],
            'timesteps_info': processing_result['timesteps_info']
        }
        
        return {
            'file_id': file_id,
            'filename': file.filename,
            'size': len(content),
            'total_timesteps': processing_result['total_timesteps'],
            'atoms_count': processing_result['atoms_count'],
            'timesteps': [ts['timestep'] for ts in processing_result['timesteps_info'][:20]],
            'message': f'File {file.filename} uploaded and all timesteps processed successfully'
        }
        
    except Exception as e:
        logger.error(f'Error uploading and processing file: {e}')
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f'Error processing file: {str(e)}')

@app.get('/files', summary='List uploaded files')
async def list_files() -> Dict[str, List[Dict[str, Any]]]:
    '''List all uploaded files with their metadata'''
    files_info = []
    for file_id, metadata in uploaded_files.items():
        files_info.append({
            'file_id': file_id,
            'filename': metadata['original_filename'],
            'size': metadata['file_size'],
            'total_timesteps': metadata['total_timesteps'],
            'atoms_count': metadata['atoms_count'],
            'upload_time': metadata['upload_time']
        })

    return {
        'files': files_info
    }

@app.get('/files/{file_id}/timesteps', summary='Get available timesteps for file')
async def get_timesteps(file_id: str) -> Dict[str, Any]:
    '''Get all available timesteps for a specific file'''
    if file_id not in uploaded_files:
        raise HTTPException(status_code=404, detail=f'File with ID {file_id} not found')
    
    metadata = uploaded_files[file_id]
    timesteps = [ts['timestep'] for ts in metadata['timesteps_info']]
    
    return {
        'file_id': file_id,
        'filename': metadata['original_filename'],
        'total_timesteps': metadata['total_timesteps'],
        'timesteps': timesteps
    }

@app.get('/files/{file_id}/timesteps/{timestep}/positions', summary='Get positions for specific timestep')
async def get_timestep_positions(file_id: str, timestep: int) -> Dict[str, Any]:
    '''Get atomic positions for a specific timestep from a file'''
    if file_id not in uploaded_files:
        raise HTTPException(status_code=404, detail=f'File with ID {file_id} not found')
    
    timestep_data = load_timestep_data(file_id, timestep)
    if timestep_data is None:
        metadata = uploaded_files[file_id]
        available_timesteps = [ts['timestep'] for ts in metadata['timesteps_info']]
        raise HTTPException(
            status_code=404, 
            detail=f'Timestep {timestep} not found for file {file_id}. Available timesteps: {available_timesteps[:10]}...'
        )
    
    try:
        positions = safe_to_list(timestep_data['positions'])
        atom_types = safe_to_list(timestep_data.get('atom_types', []))
        box_bounds = safe_to_list(timestep_data.get('box_bounds', None))
        
        return {
            'file_id': file_id,
            'timestep': timestep,
            'atoms_count': len(positions),
            'positions': positions,
            'atom_types': atom_types,
            'box_bounds': box_bounds,
            'metadata': {
                'simulation_box': box_bounds,
                'total_atoms': len(positions)
            }
        }
        
    except Exception as e:
        logger.error(f'Error processing timestep data: {e}')
        logger.error(f'timestep_data keys: {list(timestep_data.keys()) if timestep_data else "None"}')
        logger.error(f'positions type: {type(timestep_data.get("positions", None)) if timestep_data else "None"}')
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f'Error processing timestep data: {str(e)}')

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