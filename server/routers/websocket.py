from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.connection_manager import ConnectionManager
from utils.lammps import read_lammps_dump
from config import TRAJECTORY_DIR, ANALYSIS_DIR
from pathlib import Path

import logging
import json

logger = logging.getLogger(__name__)
router = APIRouter()
manager = ConnectionManager()

@router.websocket('/timesteps/{folder_id}/{timestep}')
async def websocket_send_timestep(websocket: WebSocket, folder_id: str, timestep: int):
    await manager.connect(websocket)

    try:
        folder_path = Path(TRAJECTORY_DIR) / folder_id
        
        if not folder_path.exists() or not folder_path.is_dir():
            await websocket.send_text(json.dumps({
                'status': 'error',
                'data': { 'code': 'trajectory_folder_not_found' }
            }))
            await websocket.close()
            return

        # If the timestep sent by the client is equal to -1, then we load the 
        # first timestep in the simulation. When the directory is loaded, all 
        # timesteps are extracted, assuming each file is an exported timestep. 
        # The {folder_id} directory contains a list of files in the format {timestep}. 
        # Therefore, when sorted, the first file will be the first timestep.
        if timestep == -1:
            timestep_files = [
                int(dump_file.name) for dump_file in folder_path.iterdir()
                if dump_file.is_file() and dump_file.name.isdigit()
            ]
            
            if not timestep_files:
                raise ValueError('No timestep files found.')
            
            timestep = min(timestep_files)
        
        dump_path = folder_path / str(timestep)
        if not dump_path.exists():
            await websocket.send_text(json.dumps({
                'status': 'error',
                'data': { 'code': 'trajectory_not_found'} 
            }))
            await websocket.close()
            return
        
        num_atoms, positions = read_lammps_dump(str(dump_path))
        await websocket.send_text(json.dumps({
            'status': 'success',
            'data': {
                'timestep': timestep,
                'total_atoms': num_atoms,
                'positions': positions.tolist()
            }
        }))
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(e)
        await websocket.send_text(json.dumps({
            'status': 'error',
            'code': 'unhandled_exception'
        }))
        await websocket.close()

@router.websocket('/analysis/{folder_id}/{timestep}')
async def websocket_send_analysis(websocket: WebSocket, folder_id: str, timestep: int):
    await manager.connect(websocket)
    
    try:
        folder_path = Path(ANALYSIS_DIR) / folder_id
        analysis_file = folder_path / f'timestep_{timestep}.json'

        if not folder_path.exists() or not folder_path.is_dir():
            await websocket.send_text(json.dumps({
                'status': 'error',
                'data': { 'code': 'analysis_folder_Not_found' }
            }))

            await websocket.close()
            return
        
        if not analysis_file.exists():
            await websocket.send_text(json.dumps({
                'status': 'error',
                'data': { 'code': 'analysis_file_not_found' }
            }))
            
            await websocket.close()
            return
        
        with open(analysis_file, 'r') as file:
            content = json.load(file)

        # There's no need to verify that the properties exist (I think). 
        # Since they're returned from CPP, it's impossible for them not to exist (I think).
        dislocations = content['dislocations']
        
        await websocket.send_text(json.dumps({
            'status': 'success',
            'data': dislocations
        }))

    except WebSocketDisconnect:
        manager.disconnect(websocket)

    except Exception as e:
        print(e)
        await websocket.send_text(json.dumps({
            'status': 'error',
            'code': 'unhandled_exception'
        }))
        await websocket.close()