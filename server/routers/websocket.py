from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.connection_manager import ConnectionManager
from utils.lammps import read_lammps_dump
from config import TRAJECTORY_DIR
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
        dump_path = Path(TRAJECTORY_DIR) / folder_id / str(timestep)
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