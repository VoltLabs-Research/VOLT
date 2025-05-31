from typing import Dict, Optional, Any
from server.config import TIMESTEPS_DIR, RESULTS_DIR
from opendxa.parser.lammpstrj import LammpstrjParser

import pickle
import json
import logging

logger = logging.getLogger(__name__)

def save_analysis_result(file_id: str, timestep: int, result: Dict) -> str:
    '''
    Save analysis result to disk
    '''
    result_file = RESULTS_DIR / f'{file_id}_{timestep}_analysis.json'
    with open(result_file, 'w') as file:
        json.dump(result, file, indent=2)
    return str(result_file)

def load_analysis_result(file_id: str, timestep: int) -> Optional[Dict]:
    '''
    Load analysis result from disk
    '''
    result_file = RESULTS_DIR / f'{file_id}_{timestep}_analysis.json'
    if not result_file.exists():
        return None

    with open(result_file, 'r') as file:
        return json.load(file)

def save_timestep_data(file_id: str, timestep: int, data: Dict) -> str:
    '''
    Save timestep data to disk and return the file path
    '''
    timestep_file= TIMESTEPS_DIR / f'{file_id}_{timestep_file}.pkl'
    with open(timestep_file, 'wb') as file:
        pickle.dump(data, file)
    return str(timestep_file)

def process_all_timesteps(file_path: str, file_id: str) -> Dict[str, Any]:
    '''
    Process and save all timesteps from a LAMMPS trajectory file
    '''
    parser = LammpstrjParser(file_path)
    timesteps_info = []
    total_timesteps = 0
    atoms_count = 0
    logger.info(f'Processing all timesteps for file_id: {file_id}')

    for i, data in enumerate(parser.iter_timesteps()):
        timestep = data['timestep']
        save_timestep_data(file_id, timestep, data)

        if i == 0:
            atoms_count = len(data['positions'])
        
        timesteps_info.append({
            'timestep': timestep,
            'atoms_count': len(data['positions']),
            'box_bounds': data.get('box_bounds', None)
        })

        total_timesteps += 1

        if (i + 1) % 100 == 0:
            logger.info(f'Processed {i + 1} timesteps for file_id: {file_id}')

    logger.info(f'Completed processing {total_timesteps} timesteps for file_id: {file_id}')

    return {
        'total_timesteps': total_timesteps,
        'atoms_count': atoms_count,
        'timesteps_info': timesteps_info
    }