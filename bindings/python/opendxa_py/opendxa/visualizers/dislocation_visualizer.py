from opendxa.visualizers.settings import VisualizationSettings
from opendxa.stats import DislocationStats
from opendxa.mesh import (
    build_dislocation_mesh, 
    build_atom_mesh, 
    build_interface_mesh, 
    build_background_mesh
)

from typing import Dict, Optional, Tuple, Any
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
        if 'dislocations' in self.analysis:
            dislocation_mesh, additional_data = build_dislocation_mesh(self.analysis['dislocations'])
            self.meshes['dislocations'] = dislocation_mesh
            self._build_statistics(additional_data)

        if 'atoms' in self.analysis:
            self.meshes['atoms'] = build_atom_mesh(self.analysis['atoms'])

        if 'interface_mesh' in self.analysis:
            self.meshes['interface'] = build_interface_mesh(self.analysis['interface_mesh'])

        if self.meshes.get('dislocations') is not None:
            bounds = self.meshes['dislocations'].bounds
            self.meshes['background'] = build_background_mesh(bounds)

        return self.meshes
    
    def _build_statistics(self, additional_data: Dict):
        """Build enhanced statistics from additional mesh data and analysis data."""
        if not additional_data:
            self.stats = self._empty_stats()
            return

        # Get data from mesh builder
        segment_lengths = additional_data.get('segment_lengths', [])
        burgers_magnitudes = additional_data.get('burgers_magnitudes', [])
        segment_ids = additional_data.get('segment_ids', [])
        fractional_burgers_info = additional_data.get('fractional_burgers_info', [])

        # Get summary from analysis data
        dislocations_data = self.analysis.get('dislocations', {})
        summary = dislocations_data.get('summary', {})
        
        total_points = summary.get('total_points', len(self.meshes['dislocations'].points) if self.meshes.get('dislocations') else 0)
        average_length = summary.get('average_segment_length', np.mean(segment_lengths) if segment_lengths else 0.0)

        # Build basic segment info
        segment_info = []
        for segment_id, fractional_burgers, length, magnitude in zip(
            segment_ids,
            fractional_burgers_info,
            segment_lengths,
            burgers_magnitudes
        ):
            segment_info.append({
                'segment_id': segment_id,
                'fractional_burgers': fractional_burgers,
                'length': length,
                'burgers_magnitudes': magnitude
            })
        
        # Use the enhanced stats aggregator to get full statistics
        from opendxa.stats.dislocation_stats_aggregator import compute_stats_static
        self.stats = compute_stats_static(self.analysis)
        
        # If that fails, fall back to basic stats
        if not self.stats or self.stats.num_segments == 0:
            self.stats = DislocationStats(
                num_segments=len(segment_ids),
                total_points=total_points,
                total_length=sum(segment_lengths),
                average_length=average_length,
                max_length=max(segment_lengths) if segment_lengths else 0,
                min_length=min(segment_lengths) if segment_lengths else 0,
                burgers_magnitudes=burgers_magnitudes,
                unique_burgers_magnitudes=list(set(burgers_magnitudes)),
                fractional_burgers=fractional_burgers_info,
                segment_info=segment_info
            )
    
    def _empty_stats(self):
        """Return empty stats for error cases."""
        return DislocationStats(
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

    def create_plotter(self) -> pv.Plotter:
        self.plotter = pv.Plotter()
        self.plotter.set_background(self.settings.background_color)
        return self.plotter
    
    def add_dislocations(self):
        if self.meshes.get('dislocations') is None or self.plotter is None:
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
        if self.meshes.get('dislocations') is None:
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
    
    def print_enhanced_statistics(self):
        """Print comprehensive statistics including network and junction information."""
        if not self.stats:
            print("No statistics available")
            return
        
        print("\n" + "="*60)
        print("ENHANCED DISLOCATION ANALYSIS STATISTICS")
        print("="*60)
        
        # Basic statistics
        print(f"Basic Statistics:")
        print(f"  Number of segments: {self.stats.num_segments}")
        print(f"  Total points: {self.stats.total_points}")
        print(f"  Total length: {self.stats.total_length:.4f}")
        print(f"  Average length: {self.stats.average_length:.4f}")
        print(f"  Max length: {self.stats.max_length:.4f}")
        print(f"  Min length: {self.stats.min_length:.4f}")
        
        # Network statistics
        if self.stats.network_statistics:
            ns = self.stats.network_statistics
            print(f"\nNetwork Statistics:")
            print(f"  Total network length: {ns.total_network_length:.4f}")
            print(f"  Valid segment count: {ns.segment_count}")
            print(f"  Junction count: {ns.junction_count}")
            print(f"  Dangling segments: {ns.dangling_segments}")
            print(f"  Network density: {ns.density:.6f}")
            print(f"  Total segments (incl. degenerate): {ns.total_segments_including_degenerate}")
        
        # Junction information
        if self.stats.junction_information:
            ji = self.stats.junction_information
            print(f"\nJunction Information:")
            print(f"  Total junctions: {ji.total_junctions}")
            if ji.junction_arm_distribution:
                print(f"  Junction arm distribution:")
                for arms, count in sorted(ji.junction_arm_distribution.items()):
                    print(f"    {arms} arms: {count} junctions")
        
        # Circuit information
        if self.stats.circuit_information:
            ci = self.stats.circuit_information
            print(f"\nCircuit Information:")
            print(f"  Total circuits: {ci.total_circuits}")
            print(f"  Dangling circuits: {ci.dangling_circuits}")
            print(f"  Blocked circuits: {ci.blocked_circuits}")
            print(f"  Average edge count: {ci.average_edge_count:.2f}")
            if ci.edge_count_range:
                print(f"  Edge count range: {ci.edge_count_range['min']} - {ci.edge_count_range['max']}")
        
        # Burgers vector analysis
        print(f"\nBurgers Vector Analysis:")
        print(f"  Unique magnitudes: {len(self.stats.unique_burgers_magnitudes)}")
        if self.stats.unique_burgers_magnitudes:
            print(f"  Magnitude range: {min(self.stats.unique_burgers_magnitudes):.4f} - {max(self.stats.unique_burgers_magnitudes):.4f}")
        
        # Core size analysis (if available)
        if self.stats.detailed_segment_info:
            core_sizes = []
            for detail in self.stats.detailed_segment_info:
                if detail.core_sizes:
                    core_sizes.extend(detail.core_sizes)
                if detail.average_core_size > 0:
                    core_sizes.append(detail.average_core_size)
            
            if core_sizes:
                print(f"\nCore Size Analysis:")
                print(f"  Average core size: {np.mean(core_sizes):.2f}")
                print(f"  Core size range: {min(core_sizes):.2f} - {max(core_sizes):.2f}")
        
        print("="*60)
    
    def print_detailed_segment_info(self, limit: int = 10):
        """Print detailed information for individual segments."""
        if not self.stats or not self.stats.detailed_segment_info:
            print("No detailed segment information available")
            return
        
        print(f"\nDETAILED SEGMENT INFORMATION (showing first {limit} segments):")
        print("-" * 80)
        
        for i, detail in enumerate(self.stats.detailed_segment_info[:limit]):
            print(f"Segment {detail.segment_id}:")
            print(f"  Length: {detail.length:.4f}")
            print(f"  Burgers: {detail.fractional_burgers} (magnitude: {detail.burgers_magnitude:.4f})")
            print(f"  Line direction: {detail.line_direction_string}")
            print(f"  Closed loop: {detail.is_closed_loop}")
            print(f"  Infinite line: {detail.is_infinite_line}")
            
            if detail.core_sizes:
                print(f"  Core sizes: {detail.core_sizes}")
                print(f"  Average core size: {detail.average_core_size:.2f}")
            
            if detail.junction_info:
                ji = detail.junction_info
                print(f"  Junction info: forms_junction={ji.get('forms_junction', False)}, arms={ji.get('junction_arms_count', 0)}")
            
            print()
    
    def get_analysis_summary(self) -> Dict[str, Any]:
        """Get a comprehensive summary of the analysis for external use."""
        summary = {
            'basic_stats': {
                'num_segments': self.stats.num_segments if self.stats else 0,
                'total_length': self.stats.total_length if self.stats else 0.0,
                'total_points': self.stats.total_points if self.stats else 0
            }
        }
        
        if self.stats:
            if self.stats.network_statistics:
                summary['network_stats'] = {
                    'junction_count': self.stats.network_statistics.junction_count,
                    'dangling_segments': self.stats.network_statistics.dangling_segments,
                    'density': self.stats.network_statistics.density
                }
            
            if self.stats.junction_information:
                summary['junction_stats'] = {
                    'total_junctions': self.stats.junction_information.total_junctions,
                    'arm_distribution': self.stats.junction_information.junction_arm_distribution
                }
            
            if self.stats.circuit_information:
                summary['circuit_stats'] = {
                    'total_circuits': self.stats.circuit_information.total_circuits,
                    'dangling_circuits': self.stats.circuit_information.dangling_circuits,
                    'blocked_circuits': self.stats.circuit_information.blocked_circuits
                }
        
        # Add mesh information
        if 'simulation_cell' in self.analysis:
            cell = self.analysis['simulation_cell']
            summary['simulation_cell'] = {
                'volume': cell.get('volume', 0.0),
                'is_2d': cell.get('is_2d', False),
                'periodic_boundary_conditions': cell.get('periodic_boundary_conditions', {})
            }
        
        return summary

