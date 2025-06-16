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

@router.websocket('/timestep_data/{folder_id}/{timestep}')
async def websocket_send_combined_data(websocket: WebSocket, folder_id: str, timestep: int):
    await manager.connect(websocket)

    try:
        folder_path = Path(TRAJECTORY_DIR) / folder_id
        if not folder_path.is_dir():
            await websocket.send_text(json.dumps({
                'status': 'error', 'data': {'code': 'trajectory_folder_not_found'}
            }))
            await websocket.close(); return

        # If the timestep sent by the client is equal to -1, then we load the 
        # first timestep in the simulation. When the directory is loaded, all 
        # timesteps are extracted, assuming each file is an exported timestep. 
        # The {folder_id} directory contains a list of files in the format {timestep}. 
        # Therefore, when sorted, the first file will be the first timestep.
        if timestep == -1:
            timestep_files = [int(f.name) for f in folder_path.iterdir() if f.is_file() and f.name.isdigit()]
            if not timestep_files:
                raise ValueError('No timestep files found.')
            timestep = min(timestep_files)
        
        dump_path = folder_path / str(timestep)
        if not dump_path.exists():
            await websocket.send_text(json.dumps({
                'status': 'error', 'data': {'code': 'trajectory_not_found'}
            }))
            await websocket.close(); return

        atoms_data = read_lammps_dump(str(dump_path))
        atoms_data['timestep'] = timestep

        dislocation_data = []
        try:
            analysis_folder_path = Path(ANALYSIS_DIR) / folder_id
            analysis_file_path = analysis_folder_path / f'timestep_{timestep}.json'

            if analysis_file_path.exists():
                with open(analysis_file_path, 'r') as file:
                    analysis_content = json.load(file)
                    dislocation_data = analysis_content.get('dislocations', {}).get('data', [])

        except Exception as e:
            logger.error(f"Could not read analysis file for {folder_id}/{timestep}: {e}")

        combined_data = {
            'atoms_data': atoms_data,
            'dislocation_data': dislocation_data
        }

        await websocket.send_text(json.dumps({
            'status': 'success',
            'data': combined_data
        }))

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Unhandled exception in combined data endpoint: {e}")
        await websocket.send_text(json.dumps({
            'status': 'error', 'data': {'code': 'unhandled_exception'}
        }))
    finally:
        await websocket.close()
