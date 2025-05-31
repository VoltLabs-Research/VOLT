from fastapi import FastAPI
from contextlib import asynccontextmanager
from concurrent.futures import ProcessPoolExecutor
from opendxa.core import init_worker
from opendxa.utils.ptm_templates import get_ptm_templates

import logging

logger = logging.getLogger(__name__)
TEMPLATES, TEMPLATES_SIZES = get_ptm_templates()

@asynccontextmanager
async def lifespan(app: FastAPI):
    '''
    Lifespan event handler for startup and shutdown
    '''
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