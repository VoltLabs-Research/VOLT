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

