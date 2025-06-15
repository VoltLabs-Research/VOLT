from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from config import TRAJECTORY_DIR, ANALYSIS_DIR
from opendxa import DislocationAnalysis
from pathlib import Path

router = APIRouter()

@router.get('/analyze/{folder_id}', summary='Analyze all dumps in the specified directory')
async def analyze_folder(folder_id: str):
    folder_path = Path(TRAJECTORY_DIR) / folder_id
    output_path = Path(ANALYSIS_DIR) / folder_id
    if not folder_path.exists():
        raise HTTPException(status_code=404, detail='Folder not found')

    output_path.mkdir(parents=True, exist_ok=True)

    pipeline = DislocationAnalysis()
    pipeline.compute(str(folder_path), str(output_path))

    return JSONResponse(status_code=200, content={
        'status': 'success'
    })