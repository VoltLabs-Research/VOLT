import numpy as np
from typing import Dict, List, Any
from collections import defaultdict
import logging
import pandas as pd

logger = logging.getLogger(__name__)

class DislocationStatisticsGenerator:
    """
    Generates comprehensive statistical reports about dislocation analysis results,
    similar to OVITO's DataTable functionality.
    """
    
    def __init__(self, positions, box_bounds, validated_loops, burgers_vectors, 
                 dislocation_ids, dislocation_lines):
        self.positions = np.asarray(positions)
        self.box_bounds = np.asarray(box_bounds)
        self.validated_loops = validated_loops
        self.burgers_vectors = burgers_vectors
        self.dislocation_ids = dislocation_ids
        self.dislocation_lines = dislocation_lines
        
        # Compute system volume
        self.system_volume = self._compute_system_volume()
        
        # Standard Burgers vector families for common crystal structures
        self.burgers_families = {
            'fcc': {
                'perfect': {
                    'a/2<110>': [(0.5, 0.5, 0), (0.5, -0.5, 0), (0.5, 0, 0.5), 
                                (0.5, 0, -0.5), (0, 0.5, 0.5), (0, 0.5, -0.5)]
                },
                'partial': {
                    'a/6<112>': [(1/6, 1/6, 1/3), (1/6, -1/6, 1/3), (1/6, 1/6, -1/3),
                                (1/6, -1/6, -1/3), (-1/6, 1/6, 1/3), (-1/6, -1/6, 1/3)]
                }
            },
            'bcc': {
                'perfect': {
                    'a/2<111>': [(0.5, 0.5, 0.5), (0.5, 0.5, -0.5), (0.5, -0.5, 0.5),
                                (0.5, -0.5, -0.5), (-0.5, 0.5, 0.5), (-0.5, 0.5, -0.5)]
                }
            }
        }
    
    def generate_reports(self) -> Dict:
        """Generate all statistical reports"""
        reports = {}
        
        # 1. Burgers vector family analysis
        reports['burgers_family_table'] = self._generate_burgers_family_table()
        
        # 2. Dislocation line statistics
        reports['line_statistics_table'] = self._generate_line_statistics_table()
        
        # 3. System-level properties
        reports['system_properties'] = self._generate_system_properties()
        
        # 4. Core atom analysis
        reports['core_atom_analysis'] = self._generate_core_atom_analysis()
        
        # 5. Spatial distribution analysis
        reports['spatial_distribution'] = self._generate_spatial_distribution()
        
        # 6. Export summary tables as CSV-ready format
        reports['csv_tables'] = self._prepare_csv_tables(reports)
        
        return reports
    
    def _generate_burgers_family_table(self) -> pd.DataFrame:
        """Generate table with Burgers vector family statistics"""
        
        family_stats = defaultdict(lambda: {
            'count': 0,
            'total_length': 0.0,
            'avg_length': 0.0,
            'burgers_magnitude': 0.0,
            'examples': []
        })
        
        # Classify Burgers vectors into families
        for loop_id, burgers_vector in self.burgers_vectors.items():
            if isinstance(burgers_vector, (list, tuple)):
                burgers_vector = np.array(burgers_vector)
            
            family = self._classify_burgers_family(burgers_vector)
            line_length = self._get_line_length(loop_id)
            
            family_stats[family]['count'] += 1
            family_stats[family]['total_length'] += line_length
            family_stats[family]['burgers_magnitude'] = np.linalg.norm(burgers_vector)
            
            if len(family_stats[family]['examples']) < 3:
                family_stats[family]['examples'].append(burgers_vector.tolist())
        
        # Compute averages and create DataFrame
        table_data = []
        for family, stats in family_stats.items():
            if stats['count'] > 0:
                stats['avg_length'] = stats['total_length'] / stats['count']
            
            table_data.append({
                'Burgers_Family': family,
                'Count': stats['count'],
                'Total_Length': stats['total_length'],
                'Average_Length': stats['avg_length'],
                'Burgers_Magnitude': stats['burgers_magnitude'],
                'Example_Vector': str(stats['examples'][0]) if stats['examples'] else 'None'
            })
        
        return pd.DataFrame(table_data)
    
    def _generate_line_statistics_table(self) -> pd.DataFrame:
        """Generate table with individual dislocation line statistics"""
        
        table_data = []
        
        for line_id, line_data in enumerate(self.dislocation_lines):
            points = line_data.get('points', [])
            if len(points) < 2:
                continue
            
            # Compute line properties
            length = self._compute_line_length(points)
            tortuosity = self._compute_line_tortuosity(points)
            burgers_vector = self.burgers_vectors.get(line_id, np.zeros(3))
            
            # Count core atoms for this dislocation
            core_atom_count = sum(1 for d_id in self.dislocation_ids.values() if d_id == line_id)
            
            table_data.append({
                'Line_ID': line_id,
                'Length': length,
                'Tortuosity': tortuosity,
                'Burgers_X': burgers_vector[0] if len(burgers_vector) > 0 else 0,
                'Burgers_Y': burgers_vector[1] if len(burgers_vector) > 1 else 0,
                'Burgers_Z': burgers_vector[2] if len(burgers_vector) > 2 else 0,
                'Burgers_Magnitude': np.linalg.norm(burgers_vector),
                'Core_Atoms': core_atom_count,
                'Segments': len(points) - 1 if len(points) > 1 else 0
            })
        
        return pd.DataFrame(table_data)
    
    def _generate_system_properties(self) -> Dict:
        """Generate system-level properties and densities"""
        
        total_length = sum(self._get_line_length(i) for i in range(len(self.dislocation_lines)))
        total_dislocations = len([d for d in self.dislocation_lines if len(d.get('points', [])) >= 2])
        
        # Dislocation density (length per unit volume)
        dislocation_density = total_length / self.system_volume if self.system_volume > 0 else 0
        
        # Core atom fraction
        total_core_atoms = sum(1 for d_id in self.dislocation_ids.values() if d_id >= 0)
        core_fraction = total_core_atoms / len(self.positions) if len(self.positions) > 0 else 0
        
        # Nye tensor (simplified)
        nye_tensor = self._compute_nye_tensor()
        
        return {
            'System_Volume': self.system_volume,
            'Total_Atoms': len(self.positions),
            'Total_Dislocations': total_dislocations,
            'Total_Dislocation_Length': total_length,
            'Dislocation_Density': dislocation_density,
            'Core_Atoms': total_core_atoms,
            'Core_Fraction': core_fraction,
            'Average_Line_Length': total_length / total_dislocations if total_dislocations > 0 else 0,
            'Nye_Tensor_Trace': np.trace(nye_tensor),
            'Nye_Tensor_Norm': np.linalg.norm(nye_tensor)
        }
    
    def _generate_core_atom_analysis(self) -> pd.DataFrame:
        """Generate analysis of core atoms per dislocation"""
        
        core_data = defaultdict(lambda: {'atoms': [], 'positions': []})
        
        for atom_id, disloc_id in self.dislocation_ids.items():
            if disloc_id >= 0:
                core_data[disloc_id]['atoms'].append(atom_id)
                core_data[disloc_id]['positions'].append(self.positions[atom_id])
        
        table_data = []
        for disloc_id, data in core_data.items():
            positions = np.array(data['positions'])
            
            if len(positions) > 0:
                # Compute core region properties
                centroid = np.mean(positions, axis=0)
                spread = np.std(positions, axis=0)
                volume = self._estimate_core_volume(positions)
                
                table_data.append({
                    'Dislocation_ID': disloc_id,
                    'Core_Atoms': len(data['atoms']),
                    'Centroid_X': centroid[0],
                    'Centroid_Y': centroid[1],
                    'Centroid_Z': centroid[2],
                    'Spread_X': spread[0],
                    'Spread_Y': spread[1],
                    'Spread_Z': spread[2],
                    'Core_Volume': volume
                })
        
        return pd.DataFrame(table_data)
    
    def _generate_spatial_distribution(self) -> Dict:
        """Generate spatial distribution analysis"""
        
        # Divide system into grid cells and analyze dislocation density
        grid_size = 10  # 10x10x10 grid
        box_size = self.box_bounds[1] - self.box_bounds[0]  # Assuming cubic box
        cell_size = box_size / grid_size
        
        grid_densities = np.zeros((grid_size, grid_size, grid_size))
        
        # Count dislocations in each grid cell
        for line_data in self.dislocation_lines:
            points = line_data.get('points', [])
            for point in points:
                # Convert to grid coordinates
                grid_coords = ((point - self.box_bounds[0]) / cell_size).astype(int)
                grid_coords = np.clip(grid_coords, 0, grid_size - 1)
                
                grid_densities[grid_coords[0], grid_coords[1], grid_coords[2]] += 1
        
        return {
            'grid_size': grid_size,
            'cell_size': cell_size,
            'grid_densities': grid_densities.tolist(),
            'max_density': float(np.max(grid_densities)),
            'avg_density': float(np.mean(grid_densities)),
            'density_std': float(np.std(grid_densities))
        }
    
    def _prepare_csv_tables(self, reports) -> Dict:
        """Prepare CSV-exportable versions of the tables"""
        csv_tables = {}
        
        for report_name, report_data in reports.items():
            if isinstance(report_data, pd.DataFrame):
                csv_tables[f"{report_name}.csv"] = report_data.to_csv(index=False)
        
        return csv_tables
    
    # Helper methods
    
    def _compute_system_volume(self) -> float:
        """Compute system volume from box bounds"""
        if self.box_bounds.shape[0] >= 2:
            box_size = self.box_bounds[1] - self.box_bounds[0]
            return np.prod(box_size)
        return 1.0  # Default if box bounds not available
    
    def _classify_burgers_family(self, burgers_vector: np.ndarray) -> str:
        """Classify Burgers vector into standard families"""
        
        # Normalize and compare with standard families
        magnitude = np.linalg.norm(burgers_vector)
        if magnitude < 1e-6:
            return 'zero'
        
        normalized = burgers_vector / magnitude
        
        # Check against common families (simplified)
        if abs(magnitude - 0.707) < 0.1:  # ~a/sqrt(2) for <110> type
            return 'a/2<110>'
        elif abs(magnitude - 0.577) < 0.1:  # ~a/sqrt(3) for <111> type
            return 'a/2<111>'
        elif abs(magnitude - 0.408) < 0.1:  # ~a/sqrt(6) for <112> type
            return 'a/6<112>'
        else:
            return f'other_{magnitude:.3f}'
    
    def _get_line_length(self, line_id: int) -> float:
        """Get length of dislocation line"""
        if line_id < len(self.dislocation_lines):
            points = self.dislocation_lines[line_id].get('points', [])
            return self._compute_line_length(points)
        return 0.0
    
    def _compute_line_length(self, points: List) -> float:
        """Compute total length of a line from points"""
        if len(points) < 2:
            return 0.0
        
        points = np.array(points)
        segments = points[1:] - points[:-1]
        lengths = np.linalg.norm(segments, axis=1)
        return float(np.sum(lengths))
    
    def _compute_line_tortuosity(self, points: List) -> float:
        """Compute tortuosity (actual length / straight-line distance)"""
        if len(points) < 2:
            return 1.0
        
        points = np.array(points)
        actual_length = self._compute_line_length(points)
        straight_length = np.linalg.norm(points[-1] - points[0])
        
        return actual_length / straight_length if straight_length > 1e-6 else 1.0
    
    def _estimate_core_volume(self, positions: np.ndarray) -> float:
        """Estimate volume of core region using convex hull or bounding box"""
        if len(positions) < 4:
            return 0.0
        
        # Simple bounding box volume estimate
        min_coords = np.min(positions, axis=0)
        max_coords = np.max(positions, axis=0)
        box_volume = np.prod(max_coords - min_coords)
        
        return box_volume
    
    def _compute_nye_tensor(self) -> np.ndarray:
        """Compute simplified Nye tensor from Burgers vectors"""
        nye = np.zeros((3, 3))
        
        # Simplified computation: sum outer products of Burgers vectors
        for burgers_vector in self.burgers_vectors.values():
            if isinstance(burgers_vector, (list, tuple)):
                burgers_vector = np.array(burgers_vector)
            
            if len(burgers_vector) == 3:
                # Add contribution to Nye tensor
                nye += np.outer(burgers_vector, burgers_vector)
        
        return nye / self.system_volume if self.system_volume > 0 else nye
