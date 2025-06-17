from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path
from config import ANALYSIS_DIR

import docker
import logging
import json
import uuid
import shutil
import textwrap
import hashlib

logger = logging.getLogger(__name__)
router = APIRouter()

SANDBOX_BASE_DIR = Path(__file__).resolve().parent.parent / 'execution_sandboxes'
CACHE_DIR = SANDBOX_BASE_DIR / 'cache'
CACHE_DIR.mkdir(exist_ok=True, parents=True)

class CodeExecutionRequest(BaseModel):
    code: str
    context_data: dict = {}
    language: str = 'python'
    timeout: int = 30

docker_client = docker.from_env()

def compute_cache_key(code: str, context_data: dict) -> str:
    base = code + json.dumps(context_data, sort_keys=True)
    return hashlib.sha256(base.encode()).hexdigest()

@router.post('/run_sandboxed')
async def run_sandboxed_code(request: CodeExecutionRequest):
    if not docker_client:
        raise HTTPException(status_code=503, detail='The Docker execution service is unavailable.')

    cache_key = compute_cache_key(request.code, request.context_data)
    cache_path = CACHE_DIR / f'{cache_key}.json'

    if cache_path.exists():
        with open(cache_path, 'r') as f:
            cached_result = json.load(f)
        cached_result['cached'] = True
        return cached_result

    exec_id = str(uuid.uuid4())
    session_dir = SANDBOX_BASE_DIR / exec_id
    container = None

    try:
        loaded_context = {}
        context = request.context_data or {}
        folder_id = context.get('folder_id')
        timestep = context.get('timestep')

        print(f"Executing with Folder ID: {folder_id}, Timestep: {timestep}")

        if folder_id and timestep is not None:
            analysis_file_path = Path(ANALYSIS_DIR) / folder_id / f'timestep_{timestep}.json'
            try:
                with open(analysis_file_path, 'r') as f:
                    loaded_context = json.load(f)
            except Exception as e:
                logger.warning(f"No se pudo leer contexto desde {analysis_file_path}: {e}")
                loaded_context = {"error": f"Could not load context from {analysis_file_path.name}"}

        SANDBOX_BASE_DIR.mkdir(exist_ok=True)
        session_dir.mkdir()

        script_path = session_dir / 'user_script.py'
        json_string = json.dumps(loaded_context)

        full_script_content = textwrap.dedent(f'''
import sys
import json

sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

context = json.loads(r"""{json_string}""")

try:
{textwrap.indent(request.code, ' ' * 4)}
except Exception as e:
    print("Unhandled exception:", e, file=sys.stderr)
''')

        with open(script_path, 'w') as f:
            f.write(full_script_content)

        container = docker_client.containers.run(
            image='opendxa-sandbox',
            command=['python', '-u', '/workspace/user_script.py'],
            volumes={str(session_dir.resolve()): {'bind': '/workspace', 'mode': 'rw'}},
            user='root',
            mem_limit='4196m',
            cpu_shares=512,
            detach=True
        )

        result = container.wait(timeout=request.timeout)
        exit_code = result.get('StatusCode', -1)
        stdout = container.logs(stdout=True, stderr=False).decode('utf-8', errors='replace')
        stderr = container.logs(stdout=False, stderr=True).decode('utf-8', errors='replace')

        output_data = None
        output_file = session_dir / 'output.json'
        if output_file.exists():
            with open(output_file, 'r') as f:
                output_data = json.load(f)

        response = {
            'exit_code': exit_code,
            'stdout': stdout.strip(),
            'stderr': stderr.strip(),
            'result': output_data.get('result') if output_data else None,
            'cached': False
        }

        with open(cache_path, 'w') as f:
            json.dump(response, f, indent=2)

        return response

    except docker.errors.ContainerError as e:
        raise HTTPException(status_code=400, detail=f'Container error: {str(e)}')
    except Exception as e:
        logger.exception("Execution error")
        raise HTTPException(status_code=500, detail=f'Execution error: {str(e)}')
    finally:
        if container:
            try:
                container.stop()
                container.remove()
            except Exception as e:
                logger.warning(f'Cleanup failed: {e}')
        if session_dir.exists():
            shutil.rmtree(session_dir, ignore_errors=True)