from fastapi import APIRouter

router = APIRouter()

@router.get('/', summary='API Health Check')
async def health_check():
    return {
        'message': 'OpenDXA API Server is running',
        'version': '1.0.0',
        'status': 'healthy'
    }