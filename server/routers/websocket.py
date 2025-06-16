from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.connection_manager import ConnectionManager
from utils.lammps import read_lammps_dump
from config import TRAJECTORY_DIR, ANALYSIS_DIR
from pathlib import Path
import numpy as np

import logging
import json

logger = logging.getLogger(__name__)
router = APIRouter()
manager = ConnectionManager()

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

@router.websocket('/timestep_data/{folder_id}/{timestep}')
async def websocket_send_combined_data(websocket: WebSocket, folder_id: str, timestep: int):
    await manager.connect(websocket)

    try:
        folder_path = Path(TRAJECTORY_DIR) / folder_id
        if not folder_path.is_dir():
            await websocket.send_text(json.dumps({'status': 'error', 'data': {'code': 'trajectory_folder_not_found'}}))
            await websocket.close(); return

        if timestep == -1:
            timestep_files = [int(f.name) for f in folder_path.iterdir() if f.is_file() and f.name.isdigit()]
            if not timestep_files:
                raise ValueError('No timestep files found.')
            timestep = min(timestep_files)
        
        dump_path = folder_path / str(timestep)
        if not dump_path.exists():
            await websocket.send_text(json.dumps({'status': 'error', 'data': {'code': 'trajectory_not_found'}}))
            await websocket.close(); return

        atoms_data = read_lammps_dump(str(dump_path))
        atoms_data['timestep'] = timestep

        pruned_dislocation_data = []
        dislocation_results = {}

        try:
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
                            'id': d.get('index'),
                            'points': d.get('points'),
                            'length': d.get('length'),
                            'type': get_dislocation_type(d),
                            'burgers': {
                                'vector': d.get('burgers', {}).get('vector'),
                                'magnitude': d.get('burgers', {}).get('magnitude')
                            },
                            'is_closed': d.get('burgers_circuits', [{}])[0].get('summary', {}).get('is_closed')
                        })

        except Exception as e:
            logger.error(f"Could not read or process analysis file for {folder_id}/{timestep}: {e}")

        combined_data = {
            'atoms_data': atoms_data,
            'dislocation_data': pruned_dislocation_data,
            'dislocation_results': dislocation_results
        }

        await websocket.send_text(json.dumps({'status': 'success', 'data': combined_data}))

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Unhandled exception in combined data endpoint: {e}")
        await websocket.send_text(json.dumps({'status': 'error', 'data': {'code': 'unhandled_exception'}}))
    finally:
        await websocket.close()