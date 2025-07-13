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