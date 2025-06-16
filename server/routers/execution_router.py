from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path
import docker
import logging
import json
import uuid
import shutil

logger = logging.getLogger(__name__)
router = APIRouter()

SANDBOX_BASE_DIR = Path(__file__).resolve().parent.parent / 'execution_sandboxes'

class CodeExecutionRequest(BaseModel):
    code: str
    context_data: dict = {} 

docker_client = docker.from_env()

@router.post('/run_sandboxed')
async def run_sandboxed_code(request: CodeExecutionRequest):
    if not docker_client:
        raise HTTPException(status_code=503, detail='The Docker execution service is unavailable.')

    exec_id = str(uuid.uuid4())
    session_dir = SANDBOX_BASE_DIR / exec_id
    
    container = None
    try:
        SANDBOX_BASE_DIR.mkdir(exist_ok=True)
        session_dir.mkdir()

        script_path = session_dir / 'user_script.py'
        full_script_content = f'''
import numpy as np
import pandas as pd
import json

context = {request.context_data}

{request.code}

if 'result' not in locals():
    result = None

with open('/workspace/output.json', 'w') as f:
    try:
        json.dump({{'result': result}}, f)
    except TypeError:
        json.dump({{'result': repr(result)}}, f)
'''
        with open(script_path, 'w') as f:
            f.write(full_script_content)
        
        host_path = str(session_dir.resolve())
        
        container = docker_client.containers.run(
            image='opendxa-sandbox',
            command=['python', '/workspace/user_script.py'],
            volumes={host_path: {'bind': '/workspace', 'mode': 'rw'}},
            user='root',
            mem_limit='256m',
            cpu_shares=512,
            detach=True
        )

        result = container.wait(timeout=30)
        exit_code = result.get('StatusCode', -1)
        
        stdout = container.logs(stdout=True, stderr=False).decode('utf-8')
        stderr = container.logs(stdout=False, stderr=True).decode('utf-8')

        output_data = None
        output_file_path = session_dir / 'output.json'
        if output_file_path.exists():
            with open(output_file_path, 'r') as f:
                output_data = json.load(f)

        return {
            'exit_code': exit_code,
            'stdout': stdout,
            'stderr': stderr,
            'result': output_data.get('result') if output_data else None
        }

    except docker.errors.ContainerError as e:
        stderr = container.logs(stdout=False, stderr=True).decode('utf-8') if container else ''
        raise HTTPException(status_code=400, detail=f'Error inside container: {stderr or e}')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Execution error: {str(e)}')
    finally:
        if container:
            try:
                container.stop()
                container.remove()
            except docker.errors.NotFound:
                pass
            except Exception as e:
                logger.error(f'Error cleaning up container {container.id}: {e}')
        
        if session_dir.exists():
            shutil.rmtree(session_dir)