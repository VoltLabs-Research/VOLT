from opendxa.utils.cuda import compute_displacement_field_gpu
import logging
import numpy as np

logger = logging.getLogger(__name__)

class DisplacementFieldAnalyzer:
    def __init__(
        self,
        positions,
        connectivity,
        types,
        quaternions,
        templates,
        template_sizes,
        box_bounds=None
    ):
        # store
        self.positions = np.asarray(positions, dtype=np.float32)
        self.connectivity = connectivity
        self.types = np.asarray(types, dtype=int)
        self.quaternions = np.asarray(quaternions, dtype=np.float32)
        self.templates = np.asarray(templates, dtype=np.float32)
        self.template_sizes = np.asarray(template_sizes, dtype=int)
        self.N = self.positions.shape[0]
        # optional box for PBC
        if box_bounds is not None:
            self.box_bounds = np.asarray(box_bounds, dtype=np.float32)
        else:
            self.box_bounds = None

    def compute_displacement_field(self):
        logger.info(f'Computing displacement field using GPU acceleration for {self.N} atoms')
        disp_dict = compute_displacement_field_gpu(
            self.positions,
            self.connectivity,
            self.types,
            self.templates
        )
        
        # Compute average magnitudes
        avg = np.zeros(self.N, dtype=np.float32)
        for atom_id, disp_vectors in disp_dict.items():
            # Multiple displacement vectors
            if disp_vectors.ndim == 2:
                avg[atom_id] = np.linalg.norm(disp_vectors, axis=1).mean()
            # Single displacement vector
            else:
                avg[atom_id] = np.linalg.norm(disp_vectors)
        
        logger.info(f'GPU displacement field computation completed')
        return disp_dict, avg