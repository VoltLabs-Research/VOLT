from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from config import TRAJECTORY_DIR, ANALYSIS_DIR
from opendxa import DislocationAnalysis
from pathlib import Path
import multiprocessing
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
)

router = APIRouter()

def run_analysis_task(input_files: list[str], output_template: str):
    try:
        pipeline = DislocationAnalysis()
        pipeline.compute_trajectory(input_files, output_template)
    except Exception as e:
        print(f"Unhandled exception: {e}")

@router.get('/status/{folder_id}', summary='Verificar el estado de un análisis de dislocaciones')
async def get_analysis_status(folder_id: str):
    trajectory_path = Path(TRAJECTORY_DIR) / folder_id
    analysis_path = Path(ANALYSIS_DIR) / folder_id

    if not trajectory_path.is_dir():
        raise HTTPException(status_code=404, detail=f"La carpeta de trayectoria '{folder_id}' no fue encontrada.")

    # Contar archivos de forma más idiomática con pathlib
    num_trajectory_files = len([p for p in trajectory_path.glob('*') if p.is_file()])
    
    if not analysis_path.is_dir():
        # Si la carpeta de análisis no existe, el progreso es 0
        return JSONResponse(status_code=200, content={'status': 'pending', 'progress': 0})
        
    num_analysis_files = len([p for p in analysis_path.glob('*.json') if p.is_file()])

    if num_trajectory_files == 0:
        return JSONResponse(status_code=200, content={'status': 'no_files', 'progress': 0, 'message': 'No hay archivos en la carpeta de trayectoria.'})

    progress = (num_analysis_files / num_trajectory_files) * 100

    if progress < 100:
        return JSONResponse(status_code=200, content={'status': 'running', 'progress': round(progress, 2)})
    else:
        return JSONResponse(status_code=200, content={'status': 'complete', 'progress': 100})

@router.get('/analyze/{folder_id}', summary='Analizar todos los dumps en el directorio especificado')
async def analyze_folder(folder_id: str):
    folder_path = Path(TRAJECTORY_DIR) / folder_id
    output_path = Path(ANALYSIS_DIR) / folder_id
    
    if not folder_path.is_dir():
        raise HTTPException(status_code=404, detail=f"La carpeta '{folder_id}' no fue encontrada.")

    output_path.mkdir(parents=True, exist_ok=True)
    
    input_files = sorted([str(p) for p in folder_path.glob('*') if p.is_file()])
    
    if not input_files:
        return JSONResponse(status_code=200, content={'status': 'no_files_found', 'message': 'No se encontraron archivos para analizar.'})

    output_template = str(output_path / "timestep_{}.json")

    process = multiprocessing.Process(
        target=run_analysis_task,
        args=(input_files, output_template)
    )
    process.start()

    return JSONResponse(status_code=202, content={
        'status': 'analysis_started',
        'message': f'El análisis de {len(input_files)} frames ha comenzado en un proceso separado.'
    })