from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.connection_manager import ConnectionManager
import logging

logger = logging.getLogger(__name__)
router = APIRouter()
manager = ConnectionManager()

@router.websocket('/timesteps/{folder_id}')
async def websocket_timesteps(websocket: WebSocket, folder_id: str):
    '''
    WebSocket endpoint for streaming and timesteps
    '''
    await manager.connect(websocket)