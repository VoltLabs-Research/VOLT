from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.connection_manager import ConnectionManager
from server.utils.analysis import load_timestep_data
from typing import List
from server.config import uploaded_files

import logging
import json
import asyncio

logger = logging.getLogger(__name__)
router = APIRouter()
manager = ConnectionManager()

async def stream_timesteps_data(
    websocket: WebSocket,
    file_id: str,
    timesteps: List[int],
    batch_size: int = 10,
    delay_ms: int = 100
):
    session_id = f'{file_id}_{id(websocket)}'
    manager.streaming_sessions[session_id] = True

    try:
        total_timesteps = len(timesteps)
        await manager.send_personal_message(json.dumps({
            'type': 'stream_start',
            'file_id': file_id,
            'total_timesteps': total_timesteps,
            'batch_size': batch_size
        }), websocket)

        for i in range(0, len(timesteps), batch_size):
            if not manager.streaming_sessions.get(session_id, False):
                break
            
            batch_timesteps = timesteps[i:i + batch_size]
            batch_data = []
            for timestep in batch_timesteps:
                try:
                    timestep_data = load_timestep_data(file_id, timestep)
                    positions = timestep_data['positions']
                    atom_types = timestep_data.get('atom_types', [])
                    box_bounds = timestep_data.get('box_bounds', [])
                    
                    batch_data.append({
                        'timestep': timestep,
                        'atoms_count': len(positions),
                        'positions': positions,
                        'atom_types': atom_types,
                        'box_bounds': box_bounds
                    })
                except Exception as e:
                    logger.error(f'Error loading timestep {timestep}: {e}')
                    batch_data.append({
                        'timestep': timestep,
                        'error': str(e)
                    })

            message = {
                'type': 'timestep_batch',
                'file_id': file_id,
                'batch_index': i // batch_size,
                'total_batches': (len(timesteps) + batch_size - 1) // batch_size,
                'data': batch_data,
                'progress': {
                    'current': min(i + batch_size, len(timesteps)),
                    'total': total_timesteps
                }
            }

            await manager.send_personal_message(json.dumps(message), websocket)

            if delay_ms > 0:
                await asyncio.sleep(delay_ms / 1000)
            
        await manager.send_personal_message(json.dumps({
            'type': 'stream_complete',
            'file_id': file_id,
            'total_timesteps': total_timesteps
        }), websocket)
    
    except Exception as e:
        logger.error(f'Error in stream_timesteps_data: {e}')
        await manager.send_personal_message(json.dumps({
            'type': 'stream_error',
            'file_id': file_id,
            'error': str(e)
        }), websocket)
    finally:
        if session_id in manager.streaming_sessions:
            del manager.streaming_sessions[session_id]

@router.websocket('/ws/timesteps/{file_id}')
async def websocket_timesteps(websocket: WebSocket, file_id: str):
    '''
    WebSocket endpoint for streaming and timesteps
    '''
    await manager.connect()

    if file_id not in uploaded_files:
        await manager.send_personal_message(json.dumps({
            'type': 'error',
            'message': f'File with ID {file_id} not found'
        }), websocket)
        
        await websocket.close()
        return

    try:
        metadata = uploaded_files[file_id]
        timesteps = [ts['timestep'] for ts in metadata['timesteps_info']]

        await manager.send_personal_message(json.dumps({
            'type': 'connection_established',
            'file_id': file_id,''
            'filename': metadata['original_filename'],
            'total_timesteps': len(timesteps),
            'available_timesteps': timesteps[:100]
        }), websocket)

        while True:
            data = await websocket.receive_text()
            command = json.loads(data)

            if command['type'] == 'start_stream':
                batch_size = command.get('batch_size', 10)
                delay_ms = command.get('delay_ms', 100)

                start_timestep = command.get('start_timestep')
                end_timestep = command.get('end_timestep')

                filtered_timesteps = timesteps

                if start_timestep is not None or end_timestep is not None:
                    filtered_timesteps = [
                        timestep for timestep in timesteps
                        if (start_timestep is None or timestep >= start_timestep) and 
                        (end_timestep is None or timestep <= end_timestep)
                    ]
                await stream_timesteps_data(
                    websocket,
                    file_id,
                    filtered_timesteps,
                    batch_size,
                    delay_ms
                )
            elif command['type'] == 'stop_stream':
                session_id = f'{file_id}_{id(websocket)}'
                manager.streaming_sessions[session_id] = False
                await manager.send_personal_message(json.dumps({
                    'type': 'stream_stopped',
                    'file_id': file_id
                }), websocket)
            elif command['type'] == 'get_timestep':
                timestep = command['timestep']
                try:
                    timestep_data = load_timestep_data(file_id, timestep)
                    if timestep_data:
                        positions = timestep_data['positions']
                        atom_types = timestep_data.get('atom_types', [])
                        box_bounds = timestep_data.get('box_bounds', None)
                        await manager.send_personal_message(json.dumps({
                            'type': 'single_timestep',
                            'timestep': timestep,
                            'data': {
                                'atom_count': len(positions),
                                'positions': positions,
                                'atom_types': atom_types,
                                'box_bounds': box_bounds
                            }
                        }), websocket)
                    else:
                        await manager.send_personal_message(json.dumps({
                            'type': 'error',
                            'message': f'Timestep {timestep} not found'
                        }), websocket)
                except Exception as e:
                    await manager.send_personal_message(json.dumps({
                        'type': 'error',
                        'message': f'Error loading timestep {timestep}: {str(e)}'
                    }), websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        session_id = f'{file_id}_{id(websocket)}'
        if session_id in manager.streaming_sessions:
            manager.streaming_sessions[session_id] = False
            del manager.streaming_sessions[session_id]
    except Exception as e:
        logger.error(f'WebSocket error: {e}')
        await manager.send_personal_message(json.dumps({
            'type': 'error',
            'message': str(e)
        }), websocket)