from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.connection_manager import ConnectionManager
from utils.lammps import read_lammps_dump
from config import TRAJECTORY_DIR, ANALYSIS_DIR
from pathlib import Path
import numpy as np
import asyncio

import logging
import json

logger = logging.getLogger(__name__)
router = APIRouter()
manager = ConnectionManager()

# TODO: DO IT FROM C++!
def get_dislocation_type(segment: dict) -> str:
    try:
        points = np.array(segment.get('points', []))
        burgers_vector = np.array(segment.get('burgers', {}).get('vector', []))

        if points.shape[0] < 2 or burgers_vector.shape[0] < 3:
            return 'unknown'

        tangent_vector = points[-1] - points[0]
        norm_tangent = np.linalg.norm(tangent_vector)
        norm_burgers = np.linalg.norm(burgers_vector)

        if norm_tangent == 0 or norm_burgers == 0:
            return 'unknown'

        tangent_norm = tangent_vector / norm_tangent
        burgers_norm = burgers_vector / norm_burgers
        cos_theta = abs(np.dot(tangent_norm, burgers_norm))
        
        if cos_theta > 0.9: return 'screw'
        elif cos_theta < 0.1: return 'edge'
        else: return 'mixed'
            
    except Exception:
        return 'other'

def process_single_timestep(folder_id: str, timestep: int) -> dict | None:
    try:
        folder_path = Path(TRAJECTORY_DIR) / folder_id
        dump_path = folder_path / str(timestep)
        if not dump_path.exists():
            return None

        atoms_data = read_lammps_dump(str(dump_path))
        atoms_data['timestep'] = timestep
        pruned_dislocation_data = []
        dislocation_results = {}

        analysis_file_path = Path(ANALYSIS_DIR) / folder_id / f'timestep_{timestep}.json'
        if analysis_file_path.exists():
            with open(analysis_file_path, 'r') as file:
                analysis_content = json.load(file).get('dislocations', {})
            raw_data = analysis_content.get('data', [])
            if raw_data:
                summary = analysis_content.get('summary', {})
                metadata = analysis_content.get('metadata', {})
                dislocation_results = {
                    'total_dislocations': metadata.get('count', 0),
                    'total_length': summary.get('total_length', 0),
                    'density': summary.get('density', {}).get('dislocation_density', 0),
                }
                for d in raw_data:
                    pruned_dislocation_data.append({
                        'id': d.get('index'), 'points': d.get('points'), 'length': d.get('length'),
                        'type': get_dislocation_type(d),
                        'burgers': {'vector': d.get('burgers', {}).get('vector'), 'magnitude': d.get('burgers', {}).get('magnitude')}
                    })
        
        return {
            'atoms_data': atoms_data,
            'dislocation_data': pruned_dislocation_data,
            'dislocation_results': dislocation_results
        }
    except Exception as e:
        logger.error(f"Error processing timestep {timestep} for folder {folder_id}: {e}")
        return None

@router.websocket('/stream_timesteps/{folder_id}')
async def websocket_stream_timesteps(websocket: WebSocket, folder_id: str):
    await manager.connect(websocket)
    try:
        while True:
            message = await websocket.receive_json()
            if message.get('action') == 'request_timesteps':
                requested_ids = message.get('timesteps', [])
                
                for timestep_id in requested_ids:
                    data = process_single_timestep(folder_id, timestep_id)
                    if data:
                        await websocket.send_json({
                            'status': 'success',
                            'type': 'timestep_data',
                            'data': data
                        })
                        await asyncio.sleep(0.01)

                await websocket.send_json({'status': 'success', 'type': 'stream_complete'})

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Unhandled exception in stream endpoint: {e}")
        await websocket.send_json({'status': 'error', 'message': str(e)})
    finally:
        manager.disconnect(websocket)