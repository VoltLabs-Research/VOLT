from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
from concurrent.futures import ProcessPoolExecutor
from opendxa.parser import LammpstrjParser
from opendxa.utils.ptm_templates import get_ptm_templates
from opendxa.utils.logging import setup_logging
from opendxa.core import analyze_timestep, init_worker
from server.models.analysis_config import AnalysisConfig
from server.models.file_info import FileInfo
from server.models.analysis_request import AnalysisRequest
from server.models.analysis_result import AnalysisResult

import json
import os
import tempfile
import logging
import uvicorn
import traceback
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variables for templates
TEMPLATES, TEMPLATES_SIZES = get_ptm_templates()
executor = None

@asynccontextmanager
async def lifespan():
    '''
    Lifespan event handler for startup and shutdown
    '''
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

# In-memory sotrage for uploaded files and analysis results
# TODO: REDIS HERE?!
# filename -> filepath
uploaded_files: Dict[str, str] = {}
# cache_key -> result
analysis_cache: Dict[str, Dict] = {}


def args_from_config(config: AnalysisConfig, output_file: str = 'temp_output.json') -> object:
    '''
    TODO: This is so ugly. Fix this.
    Convert AnalysisConfig to args object compatible with OpenDXA.
    '''
    class Args:
        pass
    
    args = Args()
    
    # Set all the configuration parameters
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
    # Force single worker for API
    args.workers = 1
    args.output = output_file
    args.verbose = False
    args.track_dir = None
    
    return args

def analyze_timestep_wrapper(data: Dict, config: AnalysisConfig) -> Dict:
    '''
    Wrapper function for analyze_timestep that returns results instead of writing to file
    '''
    try:
        # Create temporary output file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
            args = args_from_config(config, temp_file.name)

            start_time = time.time()
            analyze_timestep(data, args)
            end_time = time.time()
            execution_time = start_time - end_time

            if os.path.exists(temp_file.name):
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
            else:
                return {
                    'success': False,
                    'timestep': data['timestep'],
                    'dislocations': [],
                    'analysis_metadata': {},
                    'execution_time': execution_time,
                    'error': 'No output file generated'
                }
    except Exception as e:
        logger.error(f'Error in analysis: {e}')
        return {
            'success': False,
            'timestep': data.get('timestep', -1),
            'dislocations': [],
            'analysis_metadata': {},
            'execution_time': 0,
            'error': str(e)
        }
    
@app.get('/', summary='API Health Check')
async def root():
    '''
    Health check endpoint
    '''
    return {
        'message': 'OpenDXA API Server is running',
        'version': '1.0.0',
        'status': 'healthy'
    }

@app.post('/upload', summary='Upload LAMMPS trajectory file')
async def upload_file(file: UploadFile = File(...)) -> Dict[str, Any]:
    '''
    Upload a LAMMPS trajectory file for analysis
    '''
    try:
        # Save uploaded file
        temp_dir = tempfile.gettempdir()
        file_path = os.path.join(temp_dir, f'opendxa_{file.filename}')
        with open(file_path, 'wb') as buffer:
            content = await file.read()
            buffer.write(content)
        parser = LammpstrjParser(file_path)
        timesteps = []
        atoms_count = 0
        for i, data in enumerate(parser.iter_timesteps()):
            timesteps.append(data['timestep'])
            if i == 0:
                atoms_count = len(data['positions'])
            # Limit to first 10 timesteps for info
            if i >= 10:
                break
        # Store file info
        uploaded_files[file.filename] = file_path
        return {
            'filename': file.filename,
            'size': len(content),
            'timesteps': timesteps,
            'atoms_count': atoms_count,
            'message': f'File {file.filename} uploaded successfully'
        }
    except Exception as e:
        logger.error(f'Error uploading file: {e}')
        raise HTTPException(status_code=500, detail=f'Error uploading file: {str(e)}')
    
@app.get('/files', summary='List uploaded files')
async def list_files() -> Dict[str, List[FileInfo]]:
    '''
    List all uploaded files
    '''
    files_info = []
    for filename, filepath in uploaded_files.items():
        try:
            if os.path.exists(filepath):
                # TODO: duplicated code!
                stat = os.stat(filepath)
                parser = LammpstrjParser(filepath)
                timesteps = []
                atoms_count = 0
                for i, data in enumerate(parser.iter_timesteps()):
                    timesteps.append(data['timestep'])
                    if i == 0:
                        atoms_count = len(data['positions'])
                    # Limit for perfomance
                    if i >= 10:
                        break
                files_info.append(FileInfo(
                    filename=filename,
                    size=stat.st_size,
                    timesteps=timesteps,
                    atoms_count=atoms_count
                ))
        except Exception as e:
            logger.warning(f'Error reading file info for {filename}: {e}')

    return {
        'files': files_info
    }

@app.post('/analyze/{filename}', summary='Analyze specific timestep from file')
async def analyze_file(
    filename: str,
    request: AnalysisRequest
) -> AnalysisResult:
    '''
    Analyze a specific timestep from an uploaded file
    '''
    if filename not in uploaded_files:
        raise HTTPException(status_code=404, detail=f'File {filename} not found')
    file_path = uploaded_files[filename]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f'File {filename} no longer exists')
    try:
        # Parse file and find requested timestep
        parser = LammpstrjParser(file_path)
        target_timestep = request.timestep
        timestep_data = None
        for data in parser.iter_timesteps():
            if target_timestep is None or data['timestep'] == target_timestep:
                timestep_data = data
                break
        if timestep_data is None:
            available_timesteps = [data['timestep'] for data in parser.iter_timesteps()]
            raise HTTPException(
                status_code=400,
                detail=f'Timestep {target_timestep} not found. Available: {available_timesteps[:10]}'
            )
        # Check cache
        cache_key = f'{filename}_{timestep_data['timestep']}_{hash(str(request.config.model_dump()))}'
        if cache_key in analysis_cache:
            logger.info(f'Returning cached result for {cache_key}')
            return AnalysisResult(**analysis_cache[cache_key])
        # Run analysis
        logger.info(f'Analyzing timestep {timestep_data['timestep']} from {filename}')
        result = analyze_timestep_wrapper(timestep_data, request.config)
        analysis_cache[cache_key] = result
        return AnalysisResult(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error analyzing file: {e}')
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f'Analysis error: {str(e)}')

@app.get('/analyze/{filename}/timesteps', summary='Get available timesteps for file')
async def get_timesteps(filename: str) -> Dict[str, List[int]]:
    '''
    Get all availble timesteps for a specific file
    '''
    if filename not in uploaded_files:
        raise HTTPException(status_code=404, detail=f'File {filename} not found')
    
    file_path = uploaded_files[filename]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f'File {filename} no longer exists')
    
    try:
        parser = LammpstrjParser(file_path)
        timesteps = [data['timestep'] for data in parser.iter_timesteps()]
        return {'timesteps': timesteps}
        
    except Exception as e:
        logger.error(f'Error getting timesteps: {e}')
        raise HTTPException(status_code=500, detail=f'Error reading timesteps: {str(e)}')

