from opendxa import DislocationAnalysis, Logger

from typing import Dict, Optional, Tuple, List, Any
from dataclasses import dataclass, field
from pathlib import Path

import pyvista as pv
import numpy as np
import math

@dataclass
class VisualizationSettings:
    line_width: float = 3.0
    point_size: float = 2.0
    background_color: str = 'white'
    colormap: str = 'viridis'

    show_atoms: bool = False
    show_stacking_fauls: bool = False
    show_interface: bool = False
    show_grid: bool = False
    show_axes: bool = True
    show_background_mesh: bool = False
    show_plot: bool = True

    vtk_output: Optional[str] = None

    scalar_bar_args: Dict[str, Any] = field(default_factory=lambda: {
        'viewport': (0, 0, 0.2, 0.2),
        'line_width': 2,
        'cone_radius': 0.6,
        'shaft_length': 0.7,
        'tip_length': 0.3,
        'ambient': 0.5,
        'label_size': (0.4, 0.16)
    })

@dataclass
class DislocationStats:
    num_segments: int
    total_points: int
    total_length: float
    average_length: float
    max_length: float
    min_length: float
    burgers_magnitudes: List[float]
    unique_burgers_magnitudes: List[float]
    fractional_burgers: List[str]
    segment_info: List[Dict[str, Any]]

class MeshBuilder:
    @staticmethod
    def build_dislocation_mesh(segments: List[Dict]) -> Tuple[pv.PolyData, Dict[str, List]]:
        all_points = []
        lines = []

        burgers_vectors = []
        burgers_vectors_world = []
        burgers_magnitudes = []
        segment_lengths = []
        segment_ids = []
        fractional_burgers_info = []
        
        point_offset = 0

        for segment in segments:
            segment_points = np.array(segment['points'], dtype=float)
            all_points.extend(segment_points)

            num_points = len(segment_points)
            if num_points > 0:
                line = [num_points] + list(range(point_offset, point_offset + num_points))
                lines.extend(line)

                bv = segment['burgers_vector']
                burgers_vectors.append([ bv[0], bv[1], bv[2] ])

                bv_world = segment.get('burgers_vector_world', bv)
                burgers_vectors_world.append([ bv_world[0], bv_world[1], bv_world[2] ])

                magnitude = math.sqrt(bv[0] ** 2 + bv[1] ** 2 + bv[2] ** 2)
                burgers_magnitudes.append(magnitude)

                segment_lengths.append(segment['length'])
                segment_ids.append(segment['index'])

                fractional_str = segment.get('fractional_burgers', f'[{bv[0], bv[1], bv[2]}]')
                fractional_burgers_info.append(fractional_str)

                point_offset += num_points

        # Create mesh
        points_array = np.array(all_points, dtype=float)
        mesh = pv.PolyData(points_array, lines=lines)

        # Add data to the cell
        mesh.cell_data['burgers_vector'] = np.array(burgers_vectors, dtype=float)
        mesh.cell_data['burgers_vector_world'] = np.array(burgers_vectors_world, dtype=float)
        mesh.cell_data['burgers_vector_magnitude'] = np.array(burgers_magnitudes, dtype=float)
        mesh.cell_data['segment_length'] = np.array(segment_lengths, dtype=float)
        mesh.cell_data['segment_id'] = np.array(segment_ids, dtype=int)
        
        # For stats
        additional_data = {
            'burgers_magnitude': burgers_magnitudes,
            'segment_lengths': segment_lengths,
            'segment_ids': segment_ids,
            'fractional_burgers_info': fractional_burgers_info
        }

        return mesh, additional_data
    
    @staticmethod
    def build_atom_mesh(atoms_data: Dict) -> Optional[pv.PolyData]:
        if atoms_data['metadata']['num_atoms'] == 0:
            return None
        
        atom_points = np.array([ 
            [atom['position'][0], atom['position'][1], atom['position'][2]] 
            for atom in atoms_data['data']
        ], dtype=float)

        atom_types = np.array([
            atom['cna']['atom_type']
            for atom in atoms_data['data']
        ])
        
        mesh = pv.PolyData(atom_points)
        mesh.point_data['atom_type'] = atom_types
        return mesh
    
    @staticmethod
    def build_stacking_faults_mesh(stacking_fault_data: List) -> Optional[pv.PolyData]:
        if not isinstance(stacking_fault_data, list) or len(stacking_fault_data) == 0:
            return None
        
        stacking_fault_points = []
        stacking_fault_lines = []
        stacking_fault_point_offset = 0

        for stacking_fault in stacking_fault_data:
            if not (
                isinstance(stacking_fault, dict) and 'data' in stacking_fault and
                isinstance(stacking_fault['data'], dict) and 'consolidated' in stacking_fault_data
            ):
                continue

            consolidated = stacking_fault['data']['consolidated']
            if not ('points' in consolidated and len(consolidated['points']) > 0):
                continue

            points = np.arange([
                [p['position'][0], p['position'][1], p['position'][2]]
                for p in consolidated['points']
            ], dtype=float)
            
            stacking_fault_points.extend(points)
            if 'edges' in consolidated:
                for edge in consolidated['edges']:
                    if 'vertices' in edge and len(edge['vertices']) >= 2:
                        vertices = edge['vertices']
                        line = [2, vertices[0] + stacking_fault_point_offset, vertices[1] + stacking_fault_point_offset]
                        stacking_fault_lines.extend(line)
            stacking_fault_point_offset += len(points)
        
        if not stacking_fault_lines:
            return None
        
        if not stacking_fault_lines:
            return pv.PolyData(np.array(stacking_fault_points), lines=stacking_fault_lines)

        return pv.PolyData(np.array(stacking_fault_points))
    
    @staticmethod
    def build_interface_mesh(interface_data: Dict) -> Optional[pv.PolyData]:
        if interface_data['metadata']['num_nodes'] == 0:
            return None
        
        interface_points = np.array([
            [p['position'][0], p['position'][1], p['position'][2]]
            for p in interface_data['points']
        ], dtype=float)

        interface_lines = []
        for edge in interface_data['edges']:
            vertices = edge['vertices']
            line = [2, vertices[0], vertices[1]]
            interface_lines.extend(line)

        return pv.PolyData(interface_points, lines=interface_lines)
    
    @staticmethod
    def build_background_mesh(bounds: Tuple[float, ...]) -> pv.PolyData:
        background_grid = pv.ImageData(
            dimensions=(20, 20, 20),
            spacing=((bounds[1] - bounds[0]) / 19, (bounds[3] - bounds[2]) / 19, (bounds[5] - bounds[4]) / 19),
            origin=(bounds[0], bounds[2], bounds[4])
        )

        return background_grid.outline()
    

