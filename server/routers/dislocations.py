from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from config import TRAJECTORY_DIR, ANALYSIS_DIR, COMPRESSED_ANALYSIS_DIR
from fastapi.responses import JSONResponse
from opendxa import DislocationAnalysis
from utils.json_compression import compress_single_json_file
from pathlib import Path
from typing import Dict, List

import multiprocessing
import logging
import asyncio
import time

logger = logging.getLogger(__name__)

router = APIRouter()
manager = multiprocessing.Manager()
active_analyses: Dict[str, dict] = manager.dict()

def compress_and_delete_task(original_json_path_str: str, compressed_dir_str: str, status_dict: Dict[str, dict], folder_id: str):
    original_json_path = Path(original_json_path_str)
    try:
        success, message, _ = compress_single_json_file(original_json_path_str, compressed_dir_str)
        if success:
            try:
                original_json_path.unlink()
            except OSError as e:
                logging.warning(f"Could not delete temp JSON {original_json_path}: {e}")
        else:
            logging.error(f"Compression failed for {original_json_path.name}: {message}")
            current_status = status_dict[folder_id]
            current_status['failed_compressions'] = current_status.get('failed_compressions', 0) + 1
            status_dict[folder_id] = current_status
    except Exception as e:
        logging.error(f"Critical failure in compress_and_delete_task for {original_json_path.name}: {e}")
        current_status = status_dict[folder_id]
        current_status['failed_compressions'] = current_status.get('failed_compressions', 0) + 1
        status_dict[folder_id] = current_status

def run_analysis_task_with_compression(
    input_files: list[str],
    output_template: str,
    folder_id: str,
    status_dict: Dict[str, dict]
):
    try:
        compressed_dir = Path(COMPRESSED_ANALYSIS_DIR) / folder_id
        compressed_dir.mkdir(parents=True, exist_ok=True)
        
        analysis_dir = Path(output_template).parent
        analysis_dir.mkdir(parents=True, exist_ok=True)

        status_dict[folder_id] = {
            'status': 'running',
            'current_file': 0,
            'total_files': len(input_files),
            'start_time': time.time(),
            'processing_file': 'Initializing...',
            'failed_analyses': 0,
            'failed_compressions': 0
        }
        
        compression_processes: List[multiprocessing.Process] = []
        processed_frames_count = 0

        def analysis_callback(progress_info):
            nonlocal processed_frames_count, compression_processes
            processed_frames_count += 1
            
            frame_result = progress_info.frame_result
            
            current_status = status_dict[folder_id]
            current_status['current_file'] = processed_frames_count
            current_status['processing_file'] = f"Analyzed frame {processed_frames_count}/{len(input_files)}"
            
            if frame_result.get('is_failed', False):
                current_status['failed_analyses'] = current_status.get('failed_analyses', 0) + 1
            
            status_dict[folder_id] = current_status
            
            original_json_path_str = frame_result.get('output_file')
            if original_json_path_str and not frame_result.get('is_failed'):
                p = multiprocessing.Process(
                    target=compress_and_delete_task,
                    args=(original_json_path_str, str(compressed_dir), status_dict, folder_id)
                )
                p.start()
                compression_processes.append(p)

        logging.info("Starting C++ parallel analysis...")
        pipeline = DislocationAnalysis()
        pipeline.set_progress_callback(analysis_callback)
        pipeline.compute_trajectory(input_files, output_template)
        
        logging.info(f"Analysis finished. Waiting for {len(compression_processes)} compression tasks to complete...")
        for p in compression_processes:
            p.join()
        logging.info("All compression tasks completed.")
        
        final_state = status_dict[folder_id]
        failed_analyses = final_state.get('failed_analyses', 0)
        failed_compressions = final_state.get('failed_compressions', 0)
        
        if failed_analyses > 0 or failed_compressions > 0:
            status = 'complete_with_errors'
            error_msg = f"{failed_analyses} analyses failed, {failed_compressions} compressions failed."
        else:
            status = 'complete'
            error_msg = None
            
        final_state.update({
            'status': status, 'end_time': time.time(), 'progress': 100,
            'processing_file': 'Complete!', 'error': error_msg
        })
        status_dict[folder_id] = final_state

    except Exception as e:
        logging.exception(f"Critical failure during analysis for {folder_id}")
        error_state = {
            'status': 'error',
            'error': f"A critical error occurred: {str(e)}",
            'end_time': time.time()
        }
        if folder_id in status_dict:
            current_state = status_dict[folder_id]
            current_state.update(error_state)
            status_dict[folder_id] = current_state
        else:
            status_dict[folder_id] = error_state

@router.get('/status/{folder_id}')
async def get_analysis_status(folder_id: str):
    trajectory_path = Path(TRAJECTORY_DIR) / folder_id
    compressed_path = Path(COMPRESSED_ANALYSIS_DIR) / folder_id
    if not trajectory_path.is_dir():
        raise HTTPException(status_code=404, detail=f"Folder '{folder_id}' not found")
    if folder_id in active_analyses:
        status = active_analyses[folder_id].copy()
        if status['status'] == 'running' and status.get('total_files', 0) > 0:
            progress = (status['current_file'] / status['total_files']) * 100
            status['progress'] = round(progress, 1)
        return JSONResponse(content=status)
    try:
        num_trajectory_files = len([p for p in trajectory_path.glob('*') if p.is_file()])
    except Exception:
        num_trajectory_files = 0
    if num_trajectory_files == 0:
        return JSONResponse(content={'status': 'no_files', 'progress': 0})
    num_compressed = len([p for p in compressed_path.glob('*.json.zst') if p.is_file()]) if compressed_path.exists() else 0
    progress = (num_compressed / num_trajectory_files) * 100 if num_trajectory_files > 0 else 0
    if progress < 100:
        return JSONResponse(content={'status': 'partial', 'progress': round(progress, 2)})
    else:
        return JSONResponse(content={'status': 'complete', 'progress': 100})

@router.get('/analyze/{folder_id}')
async def analyze_folder(folder_id: str):
    folder_path = Path(TRAJECTORY_DIR) / folder_id
    output_path = Path(ANALYSIS_DIR) / folder_id
    if not folder_path.is_dir():
        raise HTTPException(status_code=404, detail=f"Folder '{folder_id}' not found")
    if folder_id in active_analyses and active_analyses[folder_id].get('status') == 'running':
        return JSONResponse(status_code=409, content={'status': 'already_running', 'message': 'Analysis already in progress'})
    output_path.mkdir(parents=True, exist_ok=True)
    input_files = sorted([str(p) for p in folder_path.glob('*') if p.is_file()])
    if not input_files:
        return JSONResponse(status_code=400, content={'status': 'no_files_found'})
    output_template = str(output_path / "timestep_{}.json")
    process = multiprocessing.Process(
        target=run_analysis_task_with_compression,
        args=(input_files, output_template, folder_id, active_analyses)
    )
    process.start()
    active_analyses[folder_id] = {
        'status': 'starting',
        'total_files': len(input_files),
        'current_file': 0,
        'start_time': time.time()
    }
    return JSONResponse(status_code=202, content={
        'status': 'analysis_started',
        'message': f'Analysis of {len(input_files)} files started with on-the-fly compression'
    })

@router.get('/compression-stats/{folder_id}')
async def get_compression_statistics(folder_id: str):
    compressed_path = Path(COMPRESSED_ANALYSIS_DIR) / folder_id
    if not compressed_path.exists():
        return JSONResponse(content={'folder_id': folder_id, 'stats': {'total_files': 0, 'total_size': 0, 'total_size_mb': 0, 'files': []}})
    return JSONResponse(content={'folder_id': folder_id})