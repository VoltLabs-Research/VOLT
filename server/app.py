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