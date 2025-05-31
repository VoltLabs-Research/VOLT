from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import Dict, Any, List
from server.config import uploaded_files
from server.utils.analysis import process_all_timesteps, load_timestep_data

import uuid
import logging
import traceback
import tempfile
import time
import os

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post('/', summary='Upload LAMMPS trajectory file and process all timesteps')
async def upload_file(file: UploadFile = File(...)) -> Dict[str, Any]:
    '''
    Upload a LAMMPS trajectory file and process all timesteps
    '''
    try:
        file_id = str(uuid.uuid4())
        temp_dir = tempfile.gettempdir()
        file_path = os.path.join(temp_dir, f'opendxa_{file_id}_{file.filename}')

        with open(file_path, 'wb') as buffer:
            content = await file.read()
            buffer.write(content)
        
        logger.info(f'Starting to process all timesteps for file: {file.filename}')
        processing_result = process_all_timesteps(file_path, file_id)

        uploaded_files[file_id] = {
            'original_filename': file.filename,
            'file_path': file_path,
            'file_size': len(content),
            'upload_time': time.time(),
            'total_timesteps': processing_result['total_timesteps'],
            'atoms_count': processing_result['atoms_count'],
            'timesteps_info': processing_result['timesteps_info']
        }

        return {
            'file_id': file_id,
            'filename': file.filename,
            'size': len(content),
            'total_timesteps': processing_result['total_timesteps'],
            'atoms_count': processing_result['atoms_count'],
            'timesteps': [ts['timestep'] for ts in processing_result['timesteps_info'][:20]],
            'message': f'File {file.filename} uploaded and all timesteps processed successfully'
        }
    except Exception as e:
        logger.error(f'Error uploading and processing file: {e}')
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f'Error processing file: {str(e)}')

@router.get('/', summary='List uploaded files')
async def list_files() -> Dict[str, List[str, Any]]:
    '''
    List all uploaded files with their metadata
    '''
    files_info = []
    for file_id, metadata in uploaded_files.items():
        files_info.append({
            'file_id': file_id,
            'filename': metadata['original_filename'],
            'size': metadata['file_size'],
            'total_timesteps': metadata['total_timesteps'],
            'atoms_count': metadata['atoms_count'],
            'upload_time': metadata['upload_time']
        })
    
    return { 'files': files_info }

@router.get('/{file_id}/timesteps', summary='Get available timesteps for file')
async def get_timesteps(file_id: str) -> Dict[str, Any]:
    if file_id not in uploaded_files:
        raise HTTPException(status_code=404, detail=f'File with ID {file_id} not found')
    
    metadata = uploaded_files[file_id]
    timesteps = [ts['timestep'] for ts in metadata['timesteps_info']]
    
    return {
        'file_id': file_id,
        'filename': metadata['original_filename'],
        'total_timesteps': metadata['total_timesteps'],
        'timesteps': timesteps
    }

@router.get('/{file_id}/timesteps/{timestep}/positions', summary='Get positions for specific timestep')
async def get_timestep_positions(file_id: str, timestep: int) -> Dict[str, Any]:
    if file_id not in uploaded_files:
        raise HTTPException(status_code=404, detail=f'File with ID {file_id} not found')
    
    timestep_data = load_timestep_data(file_id, timestep)
    if timestep_data is None:
        metadata = uploaded_files[file_id]
        available_timesteps = [ts['timestep'] for ts in metadata['timesteps_info']]
        raise HTTPException(
            status_code=404, 
            detail=f'Timestep {timestep} not found for file {file_id}. Available timesteps: {available_timesteps[:10]}...'
        )
    
    try:
        positions = timestep_data['positions']
        atom_types = timestep_data.get('atom_types', [])
        box_bounds = timestep_data.get('box_bounds', None)
        
        return {
            'file_id': file_id,
            'timestep': timestep,
            'atoms_count': len(positions),
            'positions': positions,
            'atom_types': atom_types,
            'box_bounds': box_bounds,
            'metadata': {
                'simulation_box': box_bounds,
                'total_atoms': len(positions)
            }
        }
        
    except Exception as e:
        logger.error(f'Error processing timestep data: {e}')
        logger.error(f'timestep_data keys: {list(timestep_data.keys()) if timestep_data else "None"}')
        logger.error(f'positions type: {type(timestep_data.get("positions", None)) if timestep_data else "None"}')
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f'Error processing timestep data: {str(e)}')
