from opendxa.visualizers.settings import VisualizationSettings
from opendxa.visualizers.stats import DislocationStats
from opendxa.mesh import (
    build_dislocation_mesh, 
    build_atom_mesh, 
    build_interface_mesh, 
    build_stacking_faults_mesh,
    build_background_mesh
)

from typing import Dict, Optional, Tuple, List
import pyvista as pv
import numpy as np

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
        if not segments or not additional_data:
            self.stats = DislocationStats(
                num_segments=0,
                total_points=0,
                total_length=0,
                average_length=0.0,
                max_length=0.0,
                min_length=0.0,
                burgers_magnitudes=[],
                unique_burgers_magnitudes=[],
                fractional_burgers=[],
                segment_info=[]
            )
            return
    
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
            show_scalar_bar=False,
        )

        self.plotter.add_scalar_bar(**self.settings.scalar_bar_args)

    def add_atoms(self):
        if not self.settings.show_atoms or self.meshes.get('atoms') is None or self.plotter is None:
            return
        
        self.plotter.add_mesh(
            self.meshes['atoms'],
            scalars='atom_type',
            show_scalar_bar=False,
            point_size=self.settings.point_size,
            render_points_as_spheres=True,
            opacity=self.settings.atom_opacity
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
                opacity=self.settings.stacking_fault_opacity)
            return

        self.plotter.add_mesh(
            mesh,
            color='red',
            point_size=self.settings.point_size * 1.5,
            render_points_as_spheres=True,
            opacity=self.settings.stacking_fault_opacity)

    def add_interface(self):
        if not self.settings.show_interface or self.meshes.get('interface') is None or self.plotter is None:
            return
        

        self.plotter.add_mesh(
            self.meshes['interface'],
            color='blue',
            line_width=1.0,
            opacity=self.settings.interface_opacity
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
        
        if self.settings.show_plot:
            self.plotter.show()

        return self.plotter, self.stats

    def print_stats(self):
        if self.stats is None:
            # TODO: use OpenDXA logger
            print('Warning: No statistics available. Run build_meshes() first.')
            return
        
        print('Dislocation Statistics')
        print(f'    Total number of segments: {self.stats.num_segments}')
        print(f'    Total number of points: {self.stats.total_points}')
        print(f'    Total length: {self.stats.total_length:.3f} Angstrom')
        print(f'    Average length: {self.stats.average_length:.3f} Angstrom')
        print(f'    Maximum length: {self.stats.max_length:.3f} Angstrom')
        print(f'    Minimum length: {self.stats.min_length:.3f} Angstrom')

        print(f'\nUnique Burgers magnitudes: {len(self.stats.unique_burgers_magnitudes)}')
        for magnitude in sorted(self.stats.unique_burgers_magnitudes):
            count = self.stats.burgers_magnitudes.count(magnitude)
            percentage = (count / len(self.stats.burgers_magnitudes)) * 100
            print(f'    |b| = {magnitude:.3f}: {count} segments ({percentage:.1f}%)')
        
        # Segment details (first 10)
        print(f'\nSegment Details (first 10)')
        print(f'{"ID":<4} {"Burgers Vector":<25} {"Length":<10} {"|b|":<8}')

        for info in self.stats.segment_info[:10]:
            print(f'{info["segment_id"]:<4} '
                f'{info["fractional_burgers"]:<25} '
                f'{info["length"]:<10.3f} '
                f'{info["burgers_magnitudes"]:<8.3f}')
        
        if len(self.stats.segment_info) > 10:
            print(f'... and {len(self.stats.segment_info) - 10} more segments')