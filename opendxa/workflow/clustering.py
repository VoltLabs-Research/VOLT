from typing import Dict, Set, List, Tuple
import numpy as np
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)

def step_build_clusters(ctx, structure_classification):
    '''
    Build crystalline clusters based on structure classification results (PTM or CNA).
    Groups atoms with similar structure types and orientations into clusters.
    
    This step implements crystallographic clustering similar to OVITO's StructureAnalysis::buildClusters
    and connectClusters functionality.
    '''
    data = ctx['data']
    args = ctx['args']
    positions = data['positions']
    neighbors = structure_classification['neighbors']
    types = structure_classification['types']
    quaternions = structure_classification['quaternions']
    
    classification_method = structure_classification.get('classification_method', 'unknown')
    logger.info(f"Building crystalline clusters using {classification_method.upper()} classification...")
    
    # Build clusters based on structure type and orientation similarity
    cluster_builder = CrystallineClusterBuilder(
        positions=positions,
        neighbors=neighbors,
        structure_types=types,
        quaternions=quaternions,
        # Threshold for quaternion similarity
        orientation_threshold=args.orientation_threshold,
        min_cluster_size=args.min_cluster_size
    )
    
    clusters = cluster_builder.build_clusters()
    
    # Store built clusters in the builder for transition finding
    cluster_builder.clusters = clusters
    
    cluster_transitions = cluster_builder.find_cluster_transitions()
    
    logger.info(f"Built {len(clusters)} crystalline clusters")
    logger.info(f"Found {len(cluster_transitions)} cluster transitions")
    
    # Store cluster information in context for elastic mapping
    ctx['clusters'] = clusters
    ctx['cluster_transitions'] = cluster_transitions
    
    return {
        'clusters': clusters,
        'cluster_transitions': cluster_transitions,
        'cluster_info': cluster_builder.get_cluster_statistics()
    }

class CrystallineClusterBuilder:
    '''
    Builds crystalline clusters by grouping atoms with similar structure types
    and orientations.
    '''
    
    def __init__(self, positions, neighbors, structure_types, quaternions, orientation_threshold, min_cluster_size):
        self.positions = np.asarray(positions)
        self.neighbors = neighbors
        self.structure_types = np.asarray(structure_types)
        self.quaternions = np.asarray(quaternions)
        self.orientation_threshold = orientation_threshold
        self.min_cluster_size = min_cluster_size
        self.n_atoms = len(positions)
        
        # Define structure type constants (similar to PTM types)
        self.STRUCTURE_TYPES = {
            0: 'UNKNOWN',
            1: 'FCC',
            2: 'HCP', 
            3: 'BCC',
            4: 'ICO',
            5: 'SC'
        }
        
    def build_clusters(self) -> Dict[int, Set[int]]:
        """Build clusters by connecting atoms with similar structure and orientation"""
        
        # Initialize cluster data structures
        atom_to_cluster = {}
        clusters = {}
        next_cluster_id = 0
        
        # Process each atom
        for atom_id in range(self.n_atoms):
            # Already assigned to a cluster
            if atom_id in atom_to_cluster:
                continue 

            # Skip unknown/disordered atoms  
            structure_type = self.structure_types[atom_id]
            if structure_type <= 0:
                continue
                
            # Start a new cluster with this atom
            cluster_id = next_cluster_id
            next_cluster_id += 1
            
            cluster_atoms = self._grow_cluster(atom_id, atom_to_cluster)
            
            if len(cluster_atoms) >= self.min_cluster_size:
                clusters[cluster_id] = cluster_atoms
                for atom in cluster_atoms:
                    atom_to_cluster[atom] = cluster_id
            else:
                # Cluster too small, mark atoms as unclustered
                next_cluster_id -= 1
                
        logger.info(f"Created {len(clusters)} clusters from {self.n_atoms} atoms")
        
        return clusters
    
    def _grow_cluster(self, seed_atom: int, atom_to_cluster: Dict[int, int]) -> Set[int]:
        """Grow a cluster starting from a seed atom using breadth-first search"""
        
        cluster_atoms = set()
        queue = [seed_atom]
        visited = set()
        
        seed_type = self.structure_types[seed_atom]
        seed_quat = self.quaternions[seed_atom]
        
        while queue:
            current_atom = queue.pop(0)
            if current_atom in visited or current_atom in atom_to_cluster:
                continue
                
            visited.add(current_atom)
            
            # Check if this atom belongs to the cluster
            if self._atoms_belong_same_cluster(seed_atom, current_atom):
                cluster_atoms.add(current_atom)
                
                # Add neighbors to queue
                if current_atom in self.neighbors:
                    for neighbor in self.neighbors[current_atom]:
                        if neighbor not in visited and neighbor not in atom_to_cluster:
                            queue.append(neighbor)
                            
        return cluster_atoms
    
    def _atoms_belong_same_cluster(self, atom1: int, atom2: int) -> bool:
        """Check if two atoms belong to the same crystalline cluster"""
        
        # Must have same structure type
        if self.structure_types[atom1] != self.structure_types[atom2]:
            return False
            
        structure_type = self.structure_types[atom1]
        if structure_type <= 0:  # Skip unknown/disordered
            return False
            
        # Check orientation similarity using quaternions
        quat1 = self.quaternions[atom1]
        quat2 = self.quaternions[atom2]
        
        orientation_similarity = self._quaternion_similarity(quat1, quat2)
        
        return orientation_similarity > (1.0 - self.orientation_threshold)
    
    def _quaternion_similarity(self, q1: np.ndarray, q2: np.ndarray) -> float:
        """Compute similarity between two quaternions (0 to 1)"""
        # Normalize quaternions
        q1_norm = q1 / np.linalg.norm(q1)
        q2_norm = q2 / np.linalg.norm(q2)
        
        # Compute dot product (accounts for q and -q representing same rotation)
        dot_product = abs(np.dot(q1_norm, q2_norm))
        
        return min(dot_product, 1.0)  # Clamp to [0,1]
    
    def find_cluster_transitions(self) -> List[Tuple[int, int, int, int]]:
        """
        Find transitions between different clusters.
        Returns list of (atom1, atom2, cluster1, cluster2) tuples.
        """
        transitions = []
        
        if not hasattr(self, 'clusters'):
            return transitions
            
        # Create atom to cluster mapping
        atom_to_cluster = {}
        for cluster_id, atoms in self.clusters.items():
            for atom in atoms:
                atom_to_cluster[atom] = cluster_id
        
        # Find transitions across neighbor connections
        for atom1, neighbor_list in self.neighbors.items():
            cluster1 = atom_to_cluster.get(atom1, -1)
            if cluster1 == -1:
                continue
                
            for atom2 in neighbor_list:
                cluster2 = atom_to_cluster.get(atom2, -1)
                if cluster2 == -1 or cluster1 == cluster2:
                    continue
                    
                # Found a transition between different clusters
                if atom1 < atom2:  # Avoid duplicates
                    transitions.append((atom1, atom2, cluster1, cluster2))
        
        return transitions
    
    def get_cluster_statistics(self) -> Dict:
        """Get statistics about the clusters"""
        if not hasattr(self, 'clusters'):
            return {}
            
        stats = {
            'total_clusters': len(self.clusters),
            'cluster_sizes': [len(atoms) for atoms in self.clusters.values()],
            'structure_type_distribution': {},
            'total_clustered_atoms': sum(len(atoms) for atoms in self.clusters.values())
        }
        
        # Count structure types in clusters
        structure_counts = defaultdict(int)
        for atoms in self.clusters.values():
            for atom in atoms:
                structure_type = self.structure_types[atom]
                type_name = self.STRUCTURE_TYPES.get(structure_type, 'UNKNOWN')
                structure_counts[type_name] += 1
        
        stats['structure_type_distribution'] = dict(structure_counts)
        
        if stats['cluster_sizes']:
            stats['avg_cluster_size'] = np.mean(stats['cluster_sizes'])
            stats['max_cluster_size'] = max(stats['cluster_sizes'])
            stats['min_cluster_size'] = min(stats['cluster_sizes'])
        
        return stats
