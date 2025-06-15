from fastapi import APIRouter, HTTPException, UploadFile, File
from config import TRAJECTORY_DIR, ANALYSIS_DIR
from utils.lammps import extract_timesteps
from typing import Dict, Any, List
from pathlib import Path

import logging
import traceback
import uuid
import shutil

router = APIRouter()
logger = logging.getLogger(__name__)

@router.delete('/{folder_id}', summary='Delete a trajectory folder and its contents')
async def delete_folder(folder_id: str) -> Dict[str, str]:
    folder_path = Path(TRAJECTORY_DIR) / folder_id
    analysis_path = Path(ANALYSIS_DIR) / folder_id

    if not folder_path.exists() or not folder_path.is_dir():
        raise HTTPException(status_code=404, detail=f'Folder "{folder_id}" not found')

    try:
        shutil.rmtree(folder_path)
        shutil.rmtree(analysis_path)
        return {"detail": f'Folder "{folder_id}" deleted successfully'}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to delete folder: {e}')

@router.post('/', summary='Upload multiple trajectory files from a folder')
async def upload_file(files: List[UploadFile] = File(...)) -> Dict[str, Any]:
    folder_id = str(uuid.uuid4())
    folder_path = Path(TRAJECTORY_DIR) / folder_id
    folder_path.mkdir(parents=True, exist_ok=True)

    for upload_file in files:
        try:
            filename = Path(upload_file.filename).name
            folder_path.mkdir(parents=True, exist_ok=True)

            content = await upload_file.read()
            text = content.decode('utf-8', errors='ignore')
            lines = text.splitlines()

            # Since we're loading a directory, we assume each dump file 
            # corresponds to a specific timestep. Given this, we should only
            # get a list with one item. If it doesn't exist, it's simply because 
            # a file was placed in the folder that wasn't a dump, we ignore it.
            timesteps = extract_timesteps(lines)
            if not len(timesteps):
                continue

            filename = Path(str(timesteps[0]))
            save_path = folder_path / filename
            with open(save_path, 'wb') as file:
                file.write(content)

        except Exception as e:
            logger.error(f'Error saving {upload_file.filename}: {e}')
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f'Failed to save {upload_file.filename}')
    
    return {
        'folder_id': folder_id,
    }

@router.get('/', summary='List all uploaded trajectory folders')
async def list_folders() -> List[str]:
    trajectory_path = Path(TRAJECTORY_DIR)
    if not trajectory_path.exists():
        trajectory_path.mkdir(parents=True)

    folders = [f.name for f in trajectory_path.iterdir() if f.is_dir()]
    return folders

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