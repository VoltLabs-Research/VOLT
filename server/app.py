from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from utils.bootstrap import lifespan
from routers import (
    file_router,
    server_router,
    websocket_router
)

import logging
import argparse
import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

app.include_router(file_router, prefix='/files')
app.include_router(websocket_router, prefix='/ws')
app.include_router(server_router)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='OpenDXA FastAPI Server')
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind to')
    parser.add_argument('--port', type=int, default=8000, help='Port to bind to')
    parser.add_argument('--reload', action='store_true', help='Enable auto-reload')
    parser.add_argument('--workers', type=int, default=1, help='Number of workers')
    args = parser.parse_args()

    print(f'''
    OpenDXA API Server Starting...
    
    URL: http://{args.host}:{args.port}
    Docs: http://{args.host}:{args.port}/docs
    Interactive API: http://{args.host}:{args.port}/redoc
    
    Upload files via POST /upload
    Analyze via POST /analyze/{{file_id}}/timesteps/{{timestep}}
    Get positions via GET /files/{{file_id}}/timesteps/{{timestep}}/positions
    WebSocket streaming via WS /ws/timesteps/{{file_id}}
    ''')

    uvicorn.run(
        'api_server:app' if args.reload else app,
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=args.workers if not args.reload else 1
    )