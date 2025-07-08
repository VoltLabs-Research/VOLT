from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from config import TRAJECTORY_DIR, ANALYSIS_DIR
from opendxa import DislocationAnalysis
from pathlib import Path
import os
import multiprocessing

router = APIRouter()

def run_analysis_task(input_files: list[str], output_template: str):
    """
    This function runs in a separate process and executes the CPU-bound analysis.
    """
    try:
        print(f"Starting analysis for {len(input_files)} files in a new process...")
        pipeline = DislocationAnalysis()
        pipeline.compute_trajectory(input_files, output_template)
        print("Analysis task completed successfully.")
    except Exception as e:
        print(f"An error occurred during analysis: {e}")

def start_analysis_process(input_files: list[str], output_template: str):
    """
    This function is called by BackgroundTasks. It creates and starts a new
    process for the analysis, ensuring the main thread is not blocked.
    """
    process = multiprocessing.Process(
        target=run_analysis_task,
        args=(input_files, output_template)
    )
    process.start()
    # We don't .join() the process here, as that would block.

@router.get('/status/{folder_id}', summary='Check the status of a dislocation analysis')
async def get_analysis_status(folder_id: str):
    trajectory_path = Path(TRAJECTORY_DIR) / folder_id
    analysis_path = Path(ANALYSIS_DIR) / folder_id

    if not trajectory_path.is_dir():
        raise HTTPException(status_code=404, detail=f"Folder '{folder_id}' not found")

    if not analysis_path.is_dir():
        return JSONResponse(status_code=200, content={'status': 'pending', 'progress': 0})

    try:
        num_trajectory_files = len([name for name in os.listdir(trajectory_path) if os.path.isfile(trajectory_path / name)])
        num_analysis_files = len([name for name in os.listdir(analysis_path) if os.path.isfile(analysis_path / name)])
    except FileNotFoundError:
        return JSONResponse(status_code=200, content={'status': 'pending', 'progress': 0})

    if num_trajectory_files == 0:
        return JSONResponse(status_code=200, content={'status': 'no_files', 'progress': 0})

    progress = (num_analysis_files / num_trajectory_files) * 100

    if progress < 100:
        return JSONResponse(status_code=200, content={'status': 'running', 'progress': progress})
    else:
        return JSONResponse(status_code=200, content={'status': 'complete', 'progress': 100})

@router.get('/analyze/{folder_id}', summary='Analyze all dumps in the specified directory')
async def analyze_folder(folder_id: str, background_tasks: BackgroundTasks):
    """
    Analyzes a folder of simulation dumps as a trajectory in a true background process.
    
    This endpoint returns a 202 response immediately and schedules the analysis 
    to run in a separate process, preventing the main server from blocking.
    """
    folder_path = Path(TRAJECTORY_DIR) / folder_id
    output_path = Path(ANALYSIS_DIR) / folder_id
    
    if not folder_path.is_dir():
        raise HTTPException(status_code=404, detail=f"Folder '{folder_id}' not found")

    output_path.mkdir(parents=True, exist_ok=True)
    
    input_files = [str(folder_path / f) for f in sorted(os.listdir(folder_path)) if os.path.isfile(folder_path / f)]
    
    if not input_files:
        return JSONResponse(status_code=200, content={'status': 'success', 'message': 'No files found to analyze.'})

    output_template = str(output_path / "timestep_%d.json")

    # The background task now only starts a new process
    background_tasks.add_task(start_analysis_process, input_files, output_template)

    return JSONResponse(status_code=202, content={
        'status': 'analysis_started',
        'message': f'Analysis of {len(input_files)} frames has been started in a separate process.'
    })