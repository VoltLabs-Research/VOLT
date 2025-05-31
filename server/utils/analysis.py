from typing import Dict, Optional, Any
from server.config import TIMESTEPS_DIR, RESULTS_DIR
from server.utils.args import args_from_config
from opendxa.parser.lammpstrj import LammpstrjParser
from server.models.analysis_config import AnalysisConfig
from opendxa.core import analyze_timestep

import pickle
import json
import tempfile
import logging
import time
import os

logger = logging.getLogger(__name__)

def analyze_timestep_wrapper(data: Dict, config: AnalysisConfig) -> Dict:
    '''
    Wrapper function for analyze_timestep that returns results instead of writing to file
    '''
    try:
        # TODO: Modify OPENDXA for return results if needed
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
            args = args_from_config(config, temp_file.name)

            start_time = time.time()
            analyze_timestep(data, args)
            end_time = time.time()
            execution_time = end_time - start_time

            if os.path.exists(temp_file.name):
                file_size = os.path.getsize(temp_file.name)
                logger.info(f"Output file created: {temp_file.name}, size: {file_size} bytes")
                
                if file_size > 0:
                    try:
                        with open(temp_file.name, 'r') as file:
                            result = json.load(file)
                        os.unlink(temp_file.name)

                        return {
                            'success': True,
                            'timestep': data['timestep'],
                            'dislocations': result.get('dislocations', []),
                            'analysis_metadata': result.get('analysis_metadata', {}),
                            'execution_time': execution_time,
                            'error': None
                        }
                    except json.JSONDecodeError as e:
                        logger.error(f"JSON decode error in output file: {e}")
                        # Read the file content for debugging
                        with open(temp_file.name, 'r') as file:
                            content = file.read()
                        logger.error(f"File content (first 1000 chars): {content[:1000]}")
                        os.unlink(temp_file.name)
                        
                        return {
                            'success': False,
                            'timestep': data['timestep'],
                            'dislocations': [],
                            'analysis_metadata': {},
                            'execution_time': execution_time,
                            'error': f'JSON decode error: {str(e)}'
                        }
                else:
                    logger.error(f"Output file is empty: {temp_file.name}")
                    os.unlink(temp_file.name)
                    return {
                        'success': False,
                        'timestep': data['timestep'],
                        'dislocations': [],
                        'analysis_metadata': {},
                        'execution_time': execution_time,
                        'error': 'Output file is empty - analysis may have failed silently'
                    }
            else:
                logger.error(f"Output file not created: {temp_file.name}")
                return {
                    'success': False,
                    'timestep': data['timestep'],
                    'dislocations': [],
                    'analysis_metadata': {},
                    'execution_time': execution_time,
                    'error': 'No output file generated'
                }
    except Exception as e:
        logger.error(f'Error in analysis: {e}', exc_info=True)
        return {
            'success': False,
            'timestep': data.get('timestep', -1),
            'dislocations': [],
            'analysis_metadata': {},
            'execution_time': 0,
            'error': str(e)
        }


def save_analysis_result(file_id: str, timestep: int, result: Dict) -> str:
    '''
    Save analysis result to disk
    '''
    result_file = RESULTS_DIR / f'{file_id}_{timestep}_analysis.json'
    with open(result_file, 'w') as file:
        json.dump(result, file, indent=2)
    return str(result_file)

def load_timestep_data(file_id: str, timestep: int) -> Optional[Dict]:
    '''Load timestep data from disk'''
    timestep_file = TIMESTEPS_DIR / f'{file_id}_{timestep}.pkl'
    
    if not timestep_file.exists():
        return None
    
    with open(timestep_file, 'rb') as file:
        return pickle.load(file)
    
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