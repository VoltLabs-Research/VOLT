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
    show_stacking_faults: bool = False
    show_interface: bool = False
    show_grid: bool = False
    show_axes: bool = True
    show_background_mesh: bool = False
    show_plot: bool = True

    dislocation_opacity: float = 1.0
    atom_opacity: float = 0.6
    stacking_fault_opacity: float = 0.8
    interface_opacity: float = 0.3

    vtk_output: Optional[str] = None

    scalar_bar_args: Dict[str, Any] = field(default_factory=lambda: {
        'title': 'Magnitud Vector Burgers',
        'title_font_size': 12,
        'label_font_size': 10,
        'position_x': 0.85,
        'position_y': 0.1
    })

    axes_args: Dict[str, Any] = field(default_factory=lambda: {
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
        'burgers_magnitudes': burgers_magnitudes,
        'segment_lengths': segment_lengths,
        'segment_ids': segment_ids,
        'fractional_burgers_info': fractional_burgers_info
    }

    return mesh, additional_data

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

def build_stacking_faults_mesh(stacking_fault_data: List) -> Optional[pv.PolyData]:
    if not isinstance(stacking_fault_data, list) or len(stacking_fault_data) == 0:
        return None
    
    stacking_fault_points = []
    stacking_fault_lines = []
    stacking_fault_point_offset = 0

    for stacking_fault in stacking_fault_data:
        if not (
            isinstance(stacking_fault, dict) and 'data' in stacking_fault and
            isinstance(stacking_fault['data'], dict) and 'consolidated' in stacking_fault['data']
        ):
            continue

        consolidated = stacking_fault['data']['consolidated']
        if not ('points' in consolidated and len(consolidated['points']) > 0):
            continue

        points = np.array([
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
    
    if not stacking_fault_points:
        return None
    
    if not stacking_fault_lines:
        return pv.PolyData(np.array(stacking_fault_points), lines=stacking_fault_lines)

    return pv.PolyData(np.array(stacking_fault_points))
    
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
    
def build_background_mesh(bounds: Tuple[float, ...]) -> pv.PolyData:
    background_grid = pv.ImageData(
        dimensions=(20, 20, 20),
        spacing=((bounds[1] - bounds[0]) / 19, (bounds[3] - bounds[2]) / 19, (bounds[5] - bounds[4]) / 19),
        origin=(bounds[0], bounds[2], bounds[4])
    )

    return background_grid.outline()
    
class DislocationVisualizer:
    def __init__(self, analysis: Dict, settings: Optional[VisualizationSettings] = None):
        self.settings = settings or VisualizationSettings()
        self.analysis = analysis

        self.stats: Optional[DislocationStats] = None
        self.meshes: Dict[str, Optional[pv.PolyData]] = {}
        self.plotter: Optional[pv.Plotter] = None

    def build_meshes(self) -> Dict[str, Optional[pv.PolyData]]:
        segments = self.analysis['dislocations']['segments']
        dislocation_mesh, additional_data = build_dislocation_mesh(segments)
        self.meshes['dislocations'] = dislocation_mesh

        self._build_statistics(segments, additional_data)

        if 'atoms' in self.analysis:
            self.meshes['atoms'] = build_atom_mesh(self.analysis['atoms'])

        if 'stacking_faults' in self.analysis:
            self.meshes['stacking_faults'] = build_stacking_faults_mesh(self.analysis['stacking_faults'])

        if 'interface_mesh' in self.analysis:
            self.meshes['interface'] = build_interface_mesh(self.analysis['interface_mesh'])

        if dislocation_mesh is not None:
            bounds = dislocation_mesh.bounds
            self.meshes['background'] = build_background_mesh(bounds)

        return self.meshes
    
    def _build_statistics(self, segments: List[Dict], additional_data: Dict):
        segment_lengths = additional_data['segment_lengths']
        burgers_magnitudes = additional_data['burgers_magnitudes']
        segment_ids = additional_data['segment_ids']
        fractional_burgers_info = additional_data['fractional_burgers_info']

        segment_info = []
        for segment_id, fractional_burgers, length, magnitudes in zip(
            segment_ids,
            fractional_burgers_info,
            segment_lengths,
            burgers_magnitudes
        ):
            segment_info.append({
                'segment_id': segment_id,
                'fractional_burgers': fractional_burgers,
                'length': length,
                'burgers_magnitudes': magnitudes
            })
        
        self.stats = DislocationStats(
            num_segments=len(segments),
            total_points=len(self.meshes['dislocations'].points),
            total_length=sum(segment_lengths),
            average_length=np.mean(segment_lengths) if segment_lengths else 0,
            max_length=max(segment_lengths) if segment_lengths else 0,
            min_length=min(segment_lengths) if segment_lengths else 0,
            burgers_magnitudes=burgers_magnitudes,
            unique_burgers_magnitudes=list(set(burgers_magnitudes)),
            fractional_burgers=fractional_burgers_info,
            segment_info=segment_info
        )

    def create_plotter(self) -> pv.Plotter:
        self.plotter = pv.Plotter()
        self.plotter.set_background(self.settings.background_color)
        return self.plotter
    
    def add_dislocations(self):
        if self.meshes['dislocations'] is None or self.plotter is None:
            return
        
        self.plotter.add_mesh(
            self.meshes['dislocations'],
            scalars='burgers_vector_magnitude',
            line_width=self.settings.line_width,
            cmap=self.settings.colormap,
            opacity=self.settings.dislocation_opacity,
            label='Dislocaciones',
            show_scalar_bar=True,
            scalar_bar_args=self.settings.scalar_bar_args
        )

    def add_atoms(self):
        if not self.settings.show_atoms or self.meshes.get('atoms') is None or self.plotter is None:
            return
        
        self.plotter.add_mesh(
            self.meshes['atoms'],
            scalars='atom_type',
            point_size=self.settings.point_size,
            render_points_as_spheres=True,
            opacity=self.settings.atom_opacity,
            label='Atoms'
        )

    def add_stacking_faults(self):
        if not self.settings.show_stacking_faults or self.meshes.get('stacking_faults') is None or self.plotter is None:
            return 
        
        mesh = self.meshes['stacking_faults']

        if mesh.lines.size > 0:
            self.plotter.add_mesh(
                mesh,
                color='red',
                line_width=2.0,
                opacity=self.settings.stacking_fault_opacity,
                label='Stacking Faults')
            return

        self.plotter.add_mesh(
            mesh,
            color='red',
            point_size=self.settings.point_size * 1.5,
            render_points_as_spheres=True,
            opacity=self.settings.stacking_fault_opacity,
            label='Stacking Faults'
        )

    def add_interface(self):
        if not self.settings.show_interface or self.meshes.get('interface') is None or self.plotter is None:
            return
        

        self.plotter.add_mesh(
            self.meshes['interface'],
            color='blue',
            line_width=1.0,
            opacity=self.settings.interface_opacity,
            label='Interface'
        )

    def add_background_mesh(self):
        if not self.settings.show_background_mesh or self.meshes.get('background') is None or self.plotter is None:
            return
        
        self.plotter.add_mesh(
            self.meshes['background'],
            color='lightgray',
            line_width=0.5,
            opacity=0.2
        )

    def add_axes(self):
        if not self.settings.show_axes or self.plotter is None:
            return
        
        self.plotter.add_axes(**self.settings.axes_args)
    
    def add_grid(self):
        if not self.settings.show_grid or self.plotter is None:
            return
        
        try:
            self.plotter.show_bounds(
                grid=True,
                location='back',
                color='gray'
            )
        except:
            self.plotter.show_bounds(grid=True)
    
    def add_legend(self):
        if self.plotter is None:
            return
        
        elements_count = sum([
            # Dislocations are always present
            1,
            self.settings.show_atoms and self.meshes.get('atoms') is not None,
            self.settings.show_stacking_faults and self.meshes.get('stacking_faults') is not None,
            self.settings.show_interface and self.meshes.get('interface') is not None
        ])

        if elements_count > 1:
            self.plotter.add_legend(loc='upper right', size=(0.2, 0.1))
    
    def to_vtk(self, filename: Optional[str] = None):
        if self.meshes['dislocations'] is None:
            return
        
        output_file = filename or self.settings.vtk_output
        if output_file:
            self.meshes['dislocations'].save(output_file)
    
    def visualize(self) -> Tuple[pv.Plotter, DislocationStats]:
        if not self.meshes:
            self.build_meshes()

        self.create_plotter()
        self.add_dislocations()
        self.add_atoms()
        self.add_stacking_faults()
        self.add_interface()
        self.add_background_mesh()
        self.add_axes()
        self.add_grid()
        self.add_legend()
        
        if self.settings.show_plot:
            self.plotter.show()

        return self.plotter, self.stats