from fastapi import FastAPI
from contextlib import asynccontextmanager
from concurrent.futures import ProcessPoolExecutor

import logging

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    '''
    Lifespan event handler for startup and shutdown
    '''
    global executor
    logger.info('Initializing OpenDXA API Server...')
    executor = ProcessPoolExecutor(
        max_workers=1,
    )
    logger.info('OpenDXA API Server initialized successfully')
    yield

    logger.info('Shutting down OpenDXA API Server...')
    if executor:
        executor.shutdown(wait=True)
    logger.info('OpenDXA API server shutdown complete')