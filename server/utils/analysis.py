from typing import Dict, Optional, Any
from config import TIMESTEPS_DIR, RESULTS_DIR
from utils.lammps import LammpstrjParser
from models.analysis_config import AnalysisConfig
from opendxa import DislocationAnalysis

import pickle
import json
import tempfile
import logging
import time
import os

logger = logging.getLogger(__name__)

def create_timestep_dump_file(timestep_data: Dict, output_path: str) -> None:
    '''
    Create a LAMMPS dump file from timestep data for OpenDXA analysis
    '''
    logger.info(f"Creating dump file with timestep_data keys: {list(timestep_data.keys())}")
    
    with open(output_path, 'w') as f:
        # Write LAMMPS dump header
        f.write("ITEM: TIMESTEP\n")
        f.write(f"{timestep_data['timestep']}\n")
        
        # Get atoms count and validate positions data
        if 'positions' in timestep_data:
            positions = timestep_data['positions']
            atoms_count = len(positions)
            logger.info(f"Using 'positions' data with {atoms_count} atoms")
        elif 'atom_data' in timestep_data and 'x' in timestep_data['atom_data']:
            atom_data = timestep_data['atom_data']
            atoms_count = len(atom_data['x'])
            positions = [[atom_data['x'][i], atom_data['y'][i], atom_data['z'][i]] 
                        for i in range(atoms_count)]
            logger.info(f"Using 'atom_data' with {atoms_count} atoms")
        else:
            raise ValueError("No position data found in timestep_data")
        
        # Log coordinate ranges for diagnostic purposes
        if positions:
            x_coords = [pos[0] for pos in positions]
            y_coords = [pos[1] for pos in positions]
            z_coords = [pos[2] for pos in positions]
            
            logger.info(f"Coordinate ranges:")
            logger.info(f"  X: {min(x_coords):.3f} to {max(x_coords):.3f}")
            logger.info(f"  Y: {min(y_coords):.3f} to {max(y_coords):.3f}")
            logger.info(f"  Z: {min(z_coords):.3f} to {max(z_coords):.3f}")
        
        logger.info(f"Writing dump file with {atoms_count} atoms")
        
        # Write number of atoms
        f.write("ITEM: NUMBER OF ATOMS\n")
        f.write(f"{atoms_count}\n")
        
        # Write box bounds - handle different formats
        if 'box_bounds' in timestep_data:
            box_bounds = timestep_data['box_bounds']
            logger.info(f"Using 'box_bounds': {box_bounds}")
        elif 'box' in timestep_data:
            if isinstance(timestep_data['box'], dict) and 'bounds' in timestep_data['box']:
                box_bounds = timestep_data['box']['bounds']
                logger.info(f"Using 'box.bounds': {box_bounds}")
                # Check if it's triclinic
                if timestep_data['box'].get('is_triclinic', False):
                    logger.info("Box is triclinic")
                    f.write("ITEM: BOX BOUNDS xy xz yz pp pp pp\n")
                    tilt_factors = timestep_data['box'].get('tilt_factors', [0, 0, 0])
                    logger.info(f"Tilt factors: {tilt_factors}")
                    for i, bounds in enumerate(box_bounds):
                        tilt = tilt_factors[i] if i < len(tilt_factors) else 0
                        f.write(f"{bounds[0]} {bounds[1]} {tilt}\n")
                else:
                    logger.info("Box is orthogonal")
                    f.write("ITEM: BOX BOUNDS pp pp pp\n")
                    for bounds in box_bounds:
                        f.write(f"{bounds[0]} {bounds[1]}\n")
            else:
                box_bounds = timestep_data['box']
                logger.info(f"Using 'box' as bounds: {box_bounds}")
                f.write("ITEM: BOX BOUNDS pp pp pp\n")
                for bounds in box_bounds:
                    f.write(f"{bounds[0]} {bounds[1]}\n")
        else:
            # Default box bounds if not provided
            logger.warning("No box bounds found, using default")
            box_bounds = [[-50, 50], [-50, 50], [-50, 50]]
            f.write("ITEM: BOX BOUNDS pp pp pp\n")
            for bounds in box_bounds:
                f.write(f"{bounds[0]} {bounds[1]}\n")
        
        # Log box bounds vs coordinate ranges for diagnostics
        if positions and box_bounds:
            x_coords = [pos[0] for pos in positions]
            y_coords = [pos[1] for pos in positions]
            z_coords = [pos[2] for pos in positions]
            
            logger.info("Box bounds vs coordinate ranges comparison:")
            logger.info(f"  X: box [{box_bounds[0][0]:.3f}, {box_bounds[0][1]:.3f}] vs coords [{min(x_coords):.3f}, {max(x_coords):.3f}]")
            logger.info(f"  Y: box [{box_bounds[1][0]:.3f}, {box_bounds[1][1]:.3f}] vs coords [{min(y_coords):.3f}, {max(y_coords):.3f}]")
            logger.info(f"  Z: box [{box_bounds[2][0]:.3f}, {box_bounds[2][1]:.3f}] vs coords [{min(z_coords):.3f}, {max(z_coords):.3f}]")
            
            # Check for atoms outside box bounds - this could explain partial dislocations
            atoms_outside = 0
            for i, pos in enumerate(positions):
                if (pos[0] < box_bounds[0][0] or pos[0] > box_bounds[0][1] or
                    pos[1] < box_bounds[1][0] or pos[1] > box_bounds[1][1] or
                    pos[2] < box_bounds[2][0] or pos[2] > box_bounds[2][1]):
                    atoms_outside += 1
            
            if atoms_outside > 0:
                logger.warning(f"⚠️  {atoms_outside}/{atoms_count} atoms ({atoms_outside/atoms_count*100:.1f}%) are outside the box bounds!")
                logger.warning("This could cause OpenDXA to miss dislocations that cross box boundaries")
            else:
                logger.info("✓ All atoms are within box bounds")
        
        # Determine available fields and write appropriate header
        has_type = False
        atom_types = None
        
        if 'atom_data' in timestep_data and 'type' in timestep_data['atom_data']:
            has_type = True
            atom_types = timestep_data['atom_data']['type']
        elif 'atom_types' in timestep_data:
            has_type = True
            atom_types = timestep_data['atom_types']
        elif 'ids' in timestep_data:
            # Sometimes type information is embedded or we need to infer it
            # For now, default all atoms to type 1
            has_type = True
            atom_types = [1] * atoms_count
        
        # Write atoms header with appropriate fields
        if has_type:
            f.write("ITEM: ATOMS id type x y z\n")
        else:
            f.write("ITEM: ATOMS id x y z\n")
        
        # Get atom IDs
        if 'ids' in timestep_data:
            atom_ids = timestep_data['ids']
        elif 'atom_data' in timestep_data and 'id' in timestep_data['atom_data']:
            atom_ids = timestep_data['atom_data']['id']
        else:
            # Generate sequential IDs starting from 1
            atom_ids = list(range(1, atoms_count + 1))
        
        # Validate data consistency
        if len(atom_ids) != atoms_count:
            logger.warning(f"Atom IDs count ({len(atom_ids)}) doesn't match positions count ({atoms_count})")
            atom_ids = list(range(1, atoms_count + 1))
        
        if has_type and len(atom_types) != atoms_count:
            logger.warning(f"Atom types count ({len(atom_types)}) doesn't match positions count ({atoms_count})")
            atom_types = [1] * atoms_count
        
        # Write atom data
        for i in range(atoms_count):
            pos = positions[i]
            atom_id = atom_ids[i] if i < len(atom_ids) else i + 1
            
            if has_type:
                atom_type = atom_types[i] if i < len(atom_types) else 1
                f.write(f"{atom_id} {atom_type} {pos[0]} {pos[1]} {pos[2]}\n")
            else:
                f.write(f"{atom_id} {pos[0]} {pos[1]} {pos[2]}\n")
    
    # Log the created file for debugging
    with open(output_path, 'r') as f:
        content = f.read()
        lines = content.split('\n')
        logger.info(f"Lines", len(lines))
        logger.info(f"Last 5 lines:\n" + '\n'.join(lines[-5:]))

def analyze_timestep_wrapper(timestep_data: Dict, config: AnalysisConfig, file_path) -> Dict:
    '''
    Wrapper function for analyze_timestep that returns results instead of writing to file
    '''
    try:
        dump_file_path = file_path
        # Create a temporary VTK file for the output
        with tempfile.NamedTemporaryFile(mode='w', suffix='.vtk', delete=False) as temp_file:
            vtk_output_path = temp_file.name

            logger.info(f"Starting OpenDXA analysis: {dump_file_path} -> {vtk_output_path}")
            start_time = time.time()
            
            try:
                pipeline = DislocationAnalysis()
                
                # Configure the pipeline to generate VTK output
                # The pipeline.compute() method expects inputFile and outputFile parameters
                pipeline.set_circuit_sizes(3, 16)
                pipeline.compute(dump_file_path, vtk_output_path)
                
                end_time = time.time()
                execution_time = end_time - start_time
                logger.info(f"OpenDXA analysis completed in {execution_time:.2f} seconds")
                
            except Exception as e:
                logger.error(f"OpenDXA analysis failed: {e}")
                # Clean up and re-raise
                # if os.path.exists(dump_file_path):
                #    os.unlink(dump_file_path)
                raise Exception(f"OpenDXA analysis failed: {str(e)}")

            # Clean up the temporary dump file
            # os.unlink(dump_file_path)

            if os.path.exists(vtk_output_path):
                file_size = os.path.getsize(vtk_output_path)
                logger.info(f"VTK output file created: {vtk_output_path}, size: {file_size} bytes")
                
                if file_size > 0:
                    try:
                        # Read the VTK file content as plain text
                        with open(vtk_output_path, 'r') as file:
                            vtk_content = file.read()
                        # os.unlink(vtk_output_path)

                        # Log the first few lines to verify VTK format
                        lines = vtk_content.split('\n')
                        logger.info(f"VTK file has {len(lines)} lines")
                        logger.info(f"VTK file preview (first 15 lines):\n" + '\n'.join(lines[:15]))
                        
                        # Enhanced VTK content analysis
                        points_lines = [line for line in lines if line.strip().startswith('POINTS')]
                        cells_lines = [line for line in lines if line.strip().startswith('CELLS')]
                        vectors_lines = [line for line in lines if 'burgers_vector' in line.lower() or line.strip().startswith('VECTORS')]
                        
                        # Count data sections
                        point_count = 0
                        cell_count = 0
                        
                        for line in lines:
                            if line.strip().startswith('POINTS'):
                                try:
                                    point_count = int(line.split()[1])
                                except (IndexError, ValueError):
                                    pass
                            elif line.strip().startswith('CELLS'):
                                try:
                                    cell_count = int(line.split()[1])
                                except (IndexError, ValueError):
                                    pass
                        
                        logger.info(f"VTK data analysis:")
                        logger.info(f"  Points declared: {point_count}")
                        logger.info(f"  Cells declared: {cell_count}")
                        logger.info(f"  POINTS lines found: {len(points_lines)}")
                        logger.info(f"  CELLS lines found: {len(cells_lines)}")
                        logger.info(f"  Vector/Burgers lines found: {len(vectors_lines)}")
                        
                        if point_count == 0 and cell_count == 0:
                            logger.warning("⚠️  VTK file contains no points or cells - no dislocations detected!")
                            logger.warning("This suggests OpenDXA found no dislocations in the dump file")
                        elif point_count > 0 and cell_count == 0:
                            logger.warning("⚠️  VTK file has points but no cells - incomplete dislocation data")
                        elif point_count > 0 and cell_count > 0:
                            logger.info(f"✓ VTK file contains {point_count} points and {cell_count} cells")
                            
                            # Analyze coordinate ranges in VTK
                            vtk_coords = []
                            in_points = False
                            for line in lines:
                                if line.strip().startswith('POINTS'):
                                    in_points = True
                                    continue
                                elif line.strip().startswith('CELLS') or line.strip().startswith('CELL_TYPES'):
                                    in_points = False
                                    continue
                                elif in_points and line.strip():
                                    coords = line.strip().split()
                                    try:
                                        for i in range(0, len(coords), 3):
                                            if i + 2 < len(coords):
                                                x, y, z = float(coords[i]), float(coords[i+1]), float(coords[i+2])
                                                vtk_coords.append([x, y, z])
                                    except ValueError:
                                        continue
                            
                            if vtk_coords:
                                x_vals = [pos[0] for pos in vtk_coords]
                                y_vals = [pos[1] for pos in vtk_coords]
                                z_vals = [pos[2] for pos in vtk_coords]
                                logger.info(f"VTK coordinate ranges:")
                                logger.info(f"  X: {min(x_vals):.3f} to {max(x_vals):.3f}")
                                logger.info(f"  Y: {min(y_vals):.3f} to {max(y_vals):.3f}")
                                logger.info(f"  Z: {min(z_vals):.3f} to {max(z_vals):.3f}")
                                logger.info(f"  Actual VTK points parsed: {len(vtk_coords)}")
                        
                        # Validate VTK content
                        if not vtk_content.strip().startswith('# vtk DataFile'):
                            logger.warning("VTK file doesn't start with expected header")
                        
                        # Check for key VTK sections
                        has_points = 'POINTS' in vtk_content
                        has_cells = 'CELLS' in vtk_content
                        has_vectors = 'VECTORS' in vtk_content or 'burgers_vector' in vtk_content
                        
                        logger.info(f"VTK content analysis: POINTS={has_points}, CELLS={has_cells}, VECTORS={has_vectors}")

                        return {
                            'success': True,
                            'timestep': 0,
                            'dislocations': [],  # VTK data contains the dislocations
                            'analysis_metadata': {
                                'format': 'vtk',
                                'lines_count': len(lines),
                                'file_size': file_size,
                                'has_vtk_data': len(vtk_content.strip()) > 0,
                                'has_points': has_points,
                                'has_cells': has_cells,
                                'has_vectors': has_vectors,
                                'execution_time': execution_time
                            },
                            'vtk_data': vtk_content,
                            'execution_time': execution_time,
                            'error': None
                        }
                    except Exception as e:
                        logger.error(f"Error reading VTK file: {e}")
                        # Read the file content for debugging
                        try:
                            with open(vtk_output_path, 'r') as file:
                                content = file.read()
                            logger.error(f"VTK file content (first 1000 chars): {content[:1000]}")
                            # os.unlink(vtk_output_path)
                            
                            return {
                                'success': False,
                                'timestep': timestep_data.get('timestep', 0),
                                'dislocations': [],
                                'vtk_data': content,
                                'analysis_metadata': {'error_content': content[:1000]},
                                'execution_time': execution_time,
                                'error': f'VTK file read error: {str(e)}'
                            }
                        except:
                            return {
                                'success': False,
                                'timestep': timestep_data.get('timestep', 0),
                                'dislocations': [],
                                'vtk_data': '',
                                'analysis_metadata': {},
                                'execution_time': execution_time,
                                'error': f'VTK file read error and cleanup failed: {str(e)}'
                            }
                else:
                    logger.error(f"VTK output file is empty: {vtk_output_path}")
                    # os.unlink(vtk_output_path)
                    return {
                        'success': False,
                        'timestep': timestep_data.get('timestep', 0),
                        'dislocations': [],
                        'analysis_metadata': {},
                        'vtk_data': '',
                        'execution_time': execution_time,
                        'error': 'VTK output file is empty - analysis may have failed silently'
                    }
            else:
                logger.error(f"VTK output file not created: {vtk_output_path}")
                return {
                    'success': False,
                    'timestep': timestep_data.get('timestep', 0),
                    'dislocations': [],
                    'analysis_metadata': {},
                    'vtk_data': '',
                    'execution_time': execution_time,
                    'error': 'No VTK output file generated'
                }
    except Exception as e:
        logger.error(f'Error in analysis: {e}', exc_info=True)
        return {
            'success': False,
            'timestep': timestep_data.get('timestep', 0),
            'dislocations': [],
            'analysis_metadata': {},
            'vtk_data': '',
            'execution_time': 0,
            'error': str(e)
        }

# ... resto de las funciones permanecen igual ...

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
    # timestep_file= TIMESTEPS_DIR / f'{file_id}_{timestep}.pkl'
    # with open(timestep_file, 'wb') as file:
    #    pickle.dump(data, file)
    # return str(timestep_file)
    return ''

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
        
        # Transform data to maintain compatibility with existing code
        # Convert new format to old format if needed
        if 'atom_data' in data and 'positions' not in data:
            # Convert atom_data format to positions format for backward compatibility
            atom_data = data['atom_data']
            if 'x' in atom_data and 'y' in atom_data and 'z' in atom_data:
                data['positions'] = [[atom_data['x'][j], atom_data['y'][j], atom_data['z'][j]] 
                                   for j in range(len(atom_data['x']))]
            if 'id' in atom_data:
                data['ids'] = atom_data['id']
            
            # Update box structure for backward compatibility
            if 'box' in data and 'box_bounds' not in data:
                data['box_bounds'] = data['box']['bounds']
        
        save_timestep_data(file_id, timestep, data)

        if i == 0:
            # Get atoms count from the appropriate source
            if 'positions' in data:
                atoms_count = len(data['positions'])
            elif 'atom_data' in data and 'id' in data['atom_data']:
                atoms_count = len(data['atom_data']['id'])
            else:
                atoms_count = 0
        
        # Get current timestep atoms count
        current_atoms_count = 0
        if 'positions' in data:
            current_atoms_count = len(data['positions'])
        elif 'atom_data' in data and 'id' in data['atom_data']:
            current_atoms_count = len(data['atom_data']['id'])
        
        timesteps_info.append({
            'timestep': timestep,
            'atoms_count': current_atoms_count,
            'box_bounds': data.get('box_bounds', data.get('box', {}).get('bounds', None))
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