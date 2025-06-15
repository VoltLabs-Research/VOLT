from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import Dict, Any, List
from config import uploaded_files
from pathlib import Path
from config import TRAJECTORY_DIR

import logging
import traceback
import uuid

router = APIRouter()
logger = logging.getLogger(__name__)

@router.delete('/{file_id}', summary='Delete uploaded file and all associated data')
async def delete_file(file_id: str) -> Dict[str, str]:
    if file_id not in uploaded_files:
        raise HTTPException(status_code=404, detail=f'File with ID {file_id} not found')

@router.post('/', summary='Upload multiple trajectory files from a folder')
async def upload_file(files: List[UploadFile] = File(...)) -> Dict[str, Any]:
    folder_id = str(uuid.uuid4())
    folder_path = Path(TRAJECTORY_DIR) / folder_id
    folder_path.mkdir(parents=True, exist_ok=True)
    saved_files = []

    for file in files:
        try:
            relative_path = Path(file.filename)
            save_path = folder_path / relative_path
            save_path.parent.mkdir(parents=True, exist_ok=True)

            with open(save_path, 'wb') as file:
                content = await file.read()
                file.write(content)
            
            saved_files.append(str(relative_path))
        except Exception as e:
            logger.error(f'Error saving {file.filename}: {e}')
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f'Failed to save {file.filename}')
    
    return {
        'folder_id': folder_id,
        'files': saved_files
    }

@router.get('/', summary='List all uploaded trajectory folders')
async def list_folders() -> Dict[str, List[str]]:
    trajectory_path = Path(TRAJECTORY_DIR)

    if not trajectory_path.exists():
        trajectory_path.mkdir(parents=True)

    folders = [f.name for f in trajectory_path.iterdir() if f.is_dir()]
    return {
        'num_folders': len(folders),
        'folders': folders
    }

@router.get('/{folder_id}', summary='List files inside a trajectory folder')
async def list_files_in_folder(folder_id: str):
    folder_path = Path(TRAJECTORY_DIR) / folder_id
    if not folder_path.exists():
        raise HTTPException(status_code=404, detail='Folder not found')

    files = [str(p.relative_to(folder_path)) for p in folder_path.rglob('*') if p.is_file()]
    return {
        'folder_id': folder_id,
        'num_files': len(files),
        'files': files
    }