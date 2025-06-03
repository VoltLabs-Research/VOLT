from numba import cuda
from opendxa.utils.cuda import get_cuda_launch_config
from opendxa.kernels.ptm import ptm_kernel
import numpy as np
import logging

logger = logging.getLogger(__name__)

class PTMLocalClassifier:
    def __init__(
        self, 
        positions, 
        box_bounds, 
        neighbor_dict,
        templates, 
        template_sizes, 
        max_neighbors=32,
    ):
        self.N = len(positions)
        self.positions = np.asarray(positions, dtype=np.float32)
        self.box_bounds = np.asarray(box_bounds, dtype=np.float32)
        self.max_neighbors = max_neighbors
        self.structure_names = {
            0: "FCC",
            1: "HCP",
            2: "BCC",
            3: "ICO",
            4: "SC"
        }

        # Prepare neighbor indices array
        self.neighbors = np.full((self.N, max_neighbors), -1, dtype=np.int32)
        for i, nbrs in neighbor_dict.items():
            for k, j in enumerate(nbrs[:max_neighbors]):
                self.neighbors[i,k] = j

        # Classification
        self.types = None
        self.quats = None

        # Templates
        self.templates = np.asarray(templates, dtype=np.float32)
        self.template_sizes = np.asarray(template_sizes, dtype=np.int32)
        self.M = self.templates.shape[0]

    def classify(self):
        # Copy to device
        d_pos = cuda.to_device(self.positions)
        d_neigh = cuda.to_device(self.neighbors)
        d_box = cuda.to_device(self.box_bounds)
        d_templates = cuda.to_device(self.templates)
        d_tmpl_sz = cuda.to_device(self.template_sizes)
        # Output arrays
        d_types = cuda.device_array(self.N, dtype=np.int32)
        d_quat = cuda.device_array((self.N, 4), dtype=np.float32)
        # Launch kernel
        blocks, threads_per_block = get_cuda_launch_config(self.N)
        ptm_kernel[blocks, threads_per_block](
            d_pos, d_neigh, d_box,
            d_templates, d_tmpl_sz, self.M,
            self.max_neighbors,
            d_types, d_quat
        )
        # Copy back
        self.types = d_types.copy_to_host()
        self.quats = d_quat.copy_to_host()
        return self.types, self.quats
    
    def infer_structure_type(self):
        logger.info('Infer the type of structure received using PTM...')
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
