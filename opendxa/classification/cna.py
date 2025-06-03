from numba import cuda
from opendxa.utils.cuda import get_cuda_launch_config
from opendxa.kernels.cna import cna_kernel
import numpy as np
import logging

logger = logging.getLogger(__name__)

class CNALocalClassifier:
    def __init__(
        self,
        positions,
        box_bounds,
        neighbor_dict,
        cutoff_distance,
        max_neighbors,
        tolerance,
        adaptive_cutoff,
        neighbor_tolerance,
        # TODO: USE THIS AS MODULE CALL ARGUMENT!!
        extended_signatures = True
    ):
        self.N = len(positions)
        self.positions = np.asarray(positions, dtype=np.float32)
        self.box_bounds = np.asarray(box_bounds, dtype=np.float32)
        self.max_neighbors = max_neighbors
        self.cutoff_distance = cutoff_distance
        self.tolerance = tolerance
        self.adaptive_cutoff = adaptive_cutoff
        self.neighbor_tolerance = neighbor_tolerance
        self.extended_signatures = extended_signatures
        self.types = None
        self.cna_signatures = None

        # Prepare neighbor indices array
        self.neighbors = np.full((self.N, max_neighbors), -1, dtype=np.int32)
        for i, neighbors in neighbor_dict.items():
            for k, j in enumerate(neighbors[:max_neighbors]):
                self.neighbors[i, k] = j

    def classify(self):
        """
        Perform CNA classification with enhanced robustness.
        
        Returns:
            types: Array of structure types for each atom
            cna_signatures: Array of CNA signatures (either 4 or 6 columns)
        """
        # Copy to device
        d_pos = cuda.to_device(self.positions)
        d_neigh = cuda.to_device(self.neighbors)
        d_box = cuda.to_device(self.box_bounds)

        # Output arrays - support both standard (4) and extended (6) signatures
        signature_cols = 6 if self.extended_signatures else 4
        d_types = cuda.device_array(self.N, dtype=np.int32)
        d_cna_signature = cuda.device_array((self.N, signature_cols), dtype=np.int32)

        # Launch kernel with all parameters
        blocks, threads_per_block = get_cuda_launch_config(self.N)
        
        # Use the improved kernel with all parameters
        cna_kernel[blocks, threads_per_block](
            d_pos, 
            d_neigh, 
            d_box,
            self.cutoff_distance,
            self.max_neighbors,
            d_types, 
            d_cna_signature,
            self.tolerance,
            self.adaptive_cutoff,
            self.neighbor_tolerance
        )

        # Copy back
        self.types = d_types.copy_to_host()
        self.cna_signatures = d_cna_signature.copy_to_host()
        return self.types, self.cna_signatures
    
    def infer_structure_type(self):
        logger.info('Infer the type of structure received using CNA...')

        if self.types is None:
            self.classify()

        values, frequencies = np.unique(self.types, return_counts=True)
        counts = dict(zip(values.tolist(), frequencies.tolist()))

        mask_valid = (values >= 0)
        valid_values = values[mask_valid]
        valid_freqs  = frequencies[mask_valid]

        if valid_values.size == 0:
            return None, 0.0, counts

        pos_max = np.argmax(valid_freqs)
        type_key = int(valid_values[pos_max])
        count_max = int(valid_freqs[pos_max])

        fraction = count_max / float(self.N)

        type_name = self.structure_names.get(type_key, 'Unknown')
        logger.info(f'Type of inferred structure: {type_name}')
        return type_name, fraction, counts

    def classify_compatible(self):
        """
        Backward-compatible classification that returns standard 4-column signatures.
        This method ensures compatibility with existing code that expects the original format.
        """
        # Temporarily disable extended signatures
        original_extended = self.extended_signatures
        self.extended_signatures = False
        
        try:
            types, signatures = self.classify()
            return types, signatures
        finally:
            self.extended_signatures = original_extended

    def get_structure_names(self):
        """Get human-readable structure type names."""
        return {
            -1: "Unknown/Invalid",
            0: "FCC",
            1: "HCP", 
            2: "BCC",
            3: "Surface/Defect",
            4: "Icosahedral",
            5: "Other",
            6: "Highly Defective"
        }

    def analyze_statistics(self, types):
        """Analyze and return statistics about the classified structures."""
        structure_names = self.get_structure_names()
        unique, counts = np.unique(types, return_counts=True)
        
        stats = {}
        total = len(types)
        
        for struct_type, count in zip(unique, counts):
            name = structure_names.get(struct_type, f"Type_{struct_type}")
            stats[name] = {
                'count': count,
                'percentage': (count / total) * 100.0
            }
        
        return stats