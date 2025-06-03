import numpy as np
import logging
from typing import Dict, List, Optional, Any, Tuple
from opendxa.classification.elastic_mapper import ElasticMapper
from opendxa.filters.burgers_normalizer import BurgersNormalizer

logger = logging.getLogger(__name__)

class UnifiedBurgersValidator:
    '''
    Unified validation of Burgers vectors using normalization,
    elastic mapping, and optional interface checks.
    '''

    def __init__(
        self,
        crystal_type: str = 'fcc',
        lattice_parameter: float = 1.0,
        tolerance: float = 0.15,
        validation_tolerance: float = 0.3,
        box_bounds: Optional[np.ndarray] = None,
        pbc: List[bool] = [True, True, True],
        allow_non_standard: bool = True
    ):
        '''
        Args:
            crystal_type (str): 'fcc', 'bcc' or 'hcp'.
            lattice_parameter (float): Lattice constant a (must be > 0).
            tolerance (float): Fractional tolerance for normalization (>= 0).
            validation_tolerance (float): Fractional tolerance for elastic mapping (>= 0).
            box_bounds (np.ndarray, optional): Array of shape (3,2) defining [min,max] in each axis.
            pbc (List[bool]): List of 3 booleans indicating PBC usage on x, y, z axes.
            allow_non_standard (bool): Whether to accept non-standard Burgers vectors.

        Raises:
            ValueError: If any parameter is out of valid range or improperly formatted.
        '''
        # Validate crystal_type
        if not isinstance(crystal_type, str) or crystal_type.lower() not in ['fcc', 'bcc', 'hcp']:
            raise ValueError(f'crystal_type must be "fcc", "bcc" or "hcp", got: {crystal_type}')
        self.crystal_type = crystal_type.lower()

        # Validate numeric parameters
        if not (isinstance(lattice_parameter, (int, float)) and lattice_parameter > 0):
            raise ValueError(f'lattice_parameter must be a positive number, got: {lattice_parameter}')
        if not (isinstance(tolerance, (int, float)) and tolerance >= 0):
            raise ValueError(f'tolerance must be non-negative, got: {tolerance}')
        if not (isinstance(validation_tolerance, (int, float)) and validation_tolerance >= 0):
            raise ValueError(f'validation_tolerance must be non-negative, got: {validation_tolerance}')
        self.lattice_parameter = float(lattice_parameter)
        self.tolerance = float(tolerance)
        self.validation_tolerance = float(validation_tolerance)

        # Validate allow_non_standard
        if not isinstance(allow_non_standard, bool):
            raise ValueError(f'allow_non_standard must be boolean, got: {allow_non_standard}')
        self.allow_non_standard = allow_non_standard

        # Validate box_bounds
        if box_bounds is not None:
            box = np.asarray(box_bounds, dtype=np.float32)
            if box.ndim != 2 or box.shape != (3, 2):
                raise ValueError(f'box_bounds must have shape (3,2), got: {box.shape}')
            self.box_bounds = box
        else:
            self.box_bounds = None

        # Validate pbc
        if not (isinstance(pbc, (list, tuple)) and len(pbc) == 3 and all(isinstance(x, bool) for x in pbc)):
            raise ValueError(f'pbc must be a list of 3 booleans, got: {pbc}')
        self.pbc = pbc

        # Initialize Burgers normalizer
        self.normalizer = BurgersNormalizer(
            crystal_type=self.crystal_type,
            lattice_parameter=self.lattice_parameter,
            tolerance=self.tolerance
        )

        # Initialize ElasticMapper
        try:
            self.elastic_mapper = ElasticMapper(
                crystal_type=self.crystal_type,
                lattice_parameter=self.lattice_parameter,
                tolerance=self.validation_tolerance,
                box_bounds=self.box_bounds,
                pbc=self.pbc
            )
        except Exception as e:
            raise ValueError(f'Failed to initialize ElasticMapper: {e}')

        # Define standard Burgers vectors
        self._define_standard_burgers_vectors()

        logger.info(
            f'UnifiedBurgersValidator initialized: {self.crystal_type}, '
            f'a={self.lattice_parameter:.3f} Å, tol={self.tolerance:.3f}, '
            f'allow_non_standard={self.allow_non_standard}'
        )

    def _define_standard_burgers_vectors(self):
        '''Define standard Burgers vectors for each crystal structure.'''
        a = self.lattice_parameter

        self.standard_burgers: Dict[str, Dict[str, List[np.ndarray]]] = {
            'fcc': {
                'perfect': [
                    a/2 * np.array([1, 1, 0]),
                    a/2 * np.array([1, -1, 0]),
                    a/2 * np.array([1, 0, 1]),
                    a/2 * np.array([1, 0, -1]),
                    a/2 * np.array([0, 1, 1]),
                    a/2 * np.array([0, 1, -1])
                ],
                'partial': [
                    a/6 * np.array([1, 1, 2]),
                    a/6 * np.array([1, 1, -2]),
                    a/6 * np.array([1, -1, 2]),
                    a/6 * np.array([1, -1, -2]),
                    a/6 * np.array([1, 2, 1]),
                    a/6 * np.array([1, -2, 1]),
                    a/6 * np.array([-1, 2, 1]),
                    a/6 * np.array([-1, -2, 1]),
                    a/6 * np.array([2, 1, 1]),
                    a/6 * np.array([2, 1, -1]),
                    a/6 * np.array([2, -1, 1]),
                    a/6 * np.array([2, -1, -1]),
                    # Shockley a/3: 1/3 [0 -1 0]
                    a/3 * np.array([0, -1, 0]),
                    a/3 * np.array([0,  1, 0]),
                ]
            },
            'bcc': {
                'perfect': [
                    a/2 * np.array([1, 1, 1]),
                    a/2 * np.array([1, 1, -1]),
                    a/2 * np.array([1, -1, 1]),
                    a/2 * np.array([1, -1, -1])
                ],
                'partial': [
                    a/2 * np.array([1, 0, 0]),
                    a/2 * np.array([0, 1, 0]),
                    a/2 * np.array([0, 0, 1])
                ]
            },
            'hcp': {
                'perfect': [
                    a * np.array([1, 0, 0]),
                    a * np.array([-1/2, np.sqrt(3)/2, 0]),
                    a * np.array([-1/2, -np.sqrt(3)/2, 0])
                ],
                'partial': [
                    a/3 * np.array([1, 0, 0]),
                    a/3 * np.array([-1/2, np.sqrt(3)/2, 0]),
                    a/3 * np.array([-1/2, -np.sqrt(3)/2, 0])
                ]
            }
        }

    def validate_burgers_vectors(
        self,
        primary_burgers: Dict[int, np.ndarray],
        loops: List[List[int]],
        positions: np.ndarray,
        displacement_field: Dict[Any, np.ndarray],
        connectivity: Dict[int, List[int]],
        ideal_edge_vectors: Optional[Dict[Any, np.ndarray]] = None,
        elastic_mapping_stats: Optional[Dict] = None,
        interface_mesh: Optional[Dict[str, Any]] = None,
        defect_regions: Optional[Dict[int, bool]] = None,
        ptm_types: Optional[np.ndarray] = None
    ) -> Dict[str, Any]:
        '''
        Perform multi-stage validation of Burgers vectors.

        Args:
            primary_burgers (dict): {loop_id: 3-array} of primary Burgers vectors.
            loops (list of list[int]): Each loop is a list of atom indices.
            positions (np.ndarray): Array shape (N_atoms, 3).
            displacement_field (dict): {edge_key: 3-array} mapping edges to displacements.
            connectivity (dict): {atom_idx: [neighbor_idx, ...]} adjacency list.
            ideal_edge_vectors (dict, optional): {edge_key: 3-array} ideal edges for enhanced mapping.
            elastic_mapping_stats (dict, optional): Precomputed stats for elastic mapper.
            interface_mesh (dict, optional): {'vertices': np.ndarray, 'faces': np.ndarray}.
            defect_regions (dict, optional): {tetrahedron_id: bool is_good}.
            ptm_types (np.ndarray, optional): Array of PTM type IDs per atom.

        Returns:
            dict: {
                'primary_validation': ...,
                'secondary_validation': ...,
                'interface_validation': ...,
                'consistency_metrics': ...,
                'enhancement_metrics': ...,
                'final_validation': ...
            }
        '''
        # Validate primary_burgers
        if not isinstance(primary_burgers, dict):
            raise ValueError('primary_burgers must be a dict mapping loop_id to 3-element array')
        n_loops = len(loops)
        for loop_id, vec in primary_burgers.items():
            if not isinstance(loop_id, int) or loop_id < 0 or loop_id >= n_loops:
                raise ValueError(f'Invalid loop_id {loop_id} in primary_burgers')
            arr = np.asarray(vec, dtype=np.float32)
            if arr.ndim != 1 or arr.size != 3:
                raise ValueError(f'primary_burgers[{loop_id}] must be a 3-element array, got {arr.shape}')

        # Validate positions
        pos = np.asarray(positions, dtype=np.float32)
        if pos.ndim != 2 or pos.shape[1] != 3:
            raise ValueError(f'positions must be shape (N_atoms, 3), got {pos.shape}')
        N_atoms = pos.shape[0]

        # Filter out any loops with invalid atom indices
        filtered_loops: List[List[int]] = []
        for idx, loop in enumerate(loops):
            if not isinstance(loop, (list, tuple, np.ndarray)):
                logger.warning(f'skipping loop {idx}: not a sequence of atom indices')
                continue
            out_of_range = False
            for atom_idx in loop:
                if not isinstance(atom_idx, int) or atom_idx < 0 or atom_idx >= N_atoms:
                    logger.warning(f'skipping loop {idx}: atom index {atom_idx} out of range [0, {N_atoms - 1}]')
                    out_of_range = True
                    break
            if not out_of_range:
                filtered_loops.append(loop)
        loops = filtered_loops
        if not loops:
            logger.warning('No valid loops remain after filtering; proceeding with empty loop set')

        # Validate and filter displacement_field
        filtered_disp: Dict[Tuple[int, int], np.ndarray] = {}
        if not isinstance(displacement_field, dict):
            raise ValueError('displacement_field must be a dict mapping edge_key to 3-element array')
        for edge_key, disp in displacement_field.items():
            if (isinstance(edge_key, tuple) and len(edge_key) == 2 and
                all(isinstance(x, int) for x in edge_key)):
                arr = np.asarray(disp, dtype=np.float32)
                if arr.ndim == 1 and arr.size == 3:
                    filtered_disp[edge_key] = arr
                else:
                    logger.warning(f'skipping displacement_field[{edge_key}]: must be a 3-element array')
            else:
                pass
        displacement_field = filtered_disp

        # Validate and filter connectivity
        filtered_conn: Dict[int, List[int]] = {}
        if not isinstance(connectivity, dict):
            raise ValueError('connectivity must be a dict mapping atom to neighbor list')
        for atom, nbrs in connectivity.items():
            if not isinstance(atom, int) or atom < 0 or atom >= N_atoms:
                logger.warning(f'skipping connectivity entry for invalid atom index {atom}')
                continue
            if not isinstance(nbrs, (list, tuple, np.ndarray)):
                logger.warning(f'skipping connectivity[{atom}]: must be a list of neighbor indices')
                continue
            valid_nbrs: List[int] = []
            for n in nbrs:
                if isinstance(n, int) and 0 <= n < N_atoms:
                    valid_nbrs.append(n)
                else:
                    pass
            if valid_nbrs:
                filtered_conn[atom] = valid_nbrs
        connectivity = filtered_conn

        # --- Step 1: primary validation ---
        primary_validation = self._validate_primary_burgers(
            primary_burgers, ptm_types, loops, pos
        )

        # --- Step 2: secondary validation ---
        if ideal_edge_vectors is not None:
            # Validate and filter ideal_edge_vectors
            filtered_ideal: Dict[Tuple[int, int], np.ndarray] = {}
            if not isinstance(ideal_edge_vectors, dict):
                raise ValueError('ideal_edge_vectors must be a dict mapping edge_key to 3-array')
            for edge_key, vec in ideal_edge_vectors.items():
                if (isinstance(edge_key, tuple) and len(edge_key) == 2 and
                    all(isinstance(x, int) for x in edge_key)):
                    arr = np.asarray(vec, dtype=np.float32)
                    if arr.ndim == 1 and arr.size == 3:
                        filtered_ideal[edge_key] = arr
                    else:
                        logger.warning(f'skipping ideal_edge_vectors[{edge_key}]: must be a 3-element array')
                else:
                    pass
            ideal_edge_vectors = filtered_ideal

            secondary_validation = self._validate_with_enhanced_elastic_mapping(
                primary_burgers, loops, pos, displacement_field,
                connectivity, ideal_edge_vectors
            )
        else:
            secondary_validation = self._validate_with_elastic_mapping(
                primary_burgers, loops, pos, displacement_field, connectivity
            )

        # --- Step 3: interface mesh validation ---
        interface_validation: Dict[str, Any] = {}
        if interface_mesh is not None:
            if not isinstance(interface_mesh, dict):
                raise ValueError('interface_mesh must be a dict with keys "vertices" and "faces"')
            interface_validation = self._validate_with_interface_mesh(
                primary_burgers, loops, pos, interface_mesh, defect_regions
            )

        # --- Step 4: consistency metrics ---
        consistency_metrics = self._compute_enhanced_consistency_metrics(
            primary_validation, secondary_validation, interface_validation
        )

        # --- Step 5: final validation ---
        final_validated = self._create_enhanced_final_validation(
            primary_validation, secondary_validation, interface_validation, consistency_metrics
        )

        # --- Step 6: enhancement metrics ---
        enhancement_metrics: Dict[str, Any] = {}
        if ideal_edge_vectors or interface_mesh is not None:
            enhancement_metrics = self._compute_enhancement_metrics(
                primary_validation, secondary_validation, interface_validation,
                bool(ideal_edge_vectors), interface_mesh is not None
            )

        logger.info(
            f'Enhanced validation complete: {len(final_validated["valid_loops"])} valid loops '
            f'(consistency: {consistency_metrics.get("overall_consistency", 0.0):.2f})'
        )
        if enhancement_metrics:
            logger.info(
                f'Enhancement score: {enhancement_metrics.get("enhancement_score", 0.0):.2f}'
            )

        return {
            'primary_validation': primary_validation,
            'secondary_validation': secondary_validation,
            'interface_validation': interface_validation,
            'consistency_metrics': consistency_metrics,
            'enhancement_metrics': enhancement_metrics,
            'final_validation': final_validated
        }

    def _validate_primary_burgers(
        self,
        burgers_vectors: Dict[int, np.ndarray],
        ptm_types: Optional[np.ndarray] = None,
        loops: Optional[List[List[int]]] = None,
        positions: Optional[np.ndarray] = None
    ) -> Dict[str, Any]:
        '''
        Primary validation: normalize Burgers and perform local structure analysis if PTM data is available.
        '''
        validated_loops: List[int] = []
        normalized_burgers: Dict[int, np.ndarray] = {}
        burgers_classifications: Dict[int, Dict[str, Any]] = {}
        validation_stats = {
            'fcc_perfect': 0, 'fcc_partial': 0,
            'bcc_perfect': 0, 'bcc_partial': 0,
            'hcp_perfect': 0, 'hcp_partial': 0,
            'non_standard': 0, 'unknown': 0, 'zero': 0
        }
        magnitudes: List[float] = []
        structure_analysis: Dict[int, Dict[str, Any]] = {}

        for loop_id, burger_vector in burgers_vectors.items():
            # Validate shape of burger_vector
            arr = np.asarray(burger_vector, dtype=np.float32)
            if arr.ndim != 1 or arr.size != 3:
                raise ValueError(f'primary_burgers[{loop_id}] must be a 3-element array, got {arr.shape}')

            magnitude = float(np.linalg.norm(arr))
            magnitudes.append(magnitude)

            if magnitude > 1e-5:
                # Local structure analysis if data is provided
                local_structure: Optional[str] = None
                if (loops is not None and positions is not None and ptm_types is not None and
                    0 <= loop_id < len(loops)):
                    loop_atoms = loops[loop_id]
                    if positions.ndim != 2 or positions.shape[1] != 3:
                        raise ValueError('positions must be shape (N_atoms, 3)')
                    if ptm_types.ndim != 1 or ptm_types.size < len(loop_atoms):
                        raise ValueError('ptm_types must be a 1D array with at least len(loop) entries')
                    loop_structure = self.analyze_loop_structure(loop_atoms, positions, ptm_types)
                    local_structure = loop_structure.get('dominant_structure')
                    structure_analysis[loop_id] = loop_structure

                classification = self.classify_burgers_vector(arr, local_structure)
                burgers_classifications[loop_id] = classification

                # Normalize via BurgersNormalizer
                norm_vec, b_type, distance = self.normalizer.normalize_burgers_vector(arr)

                if b_type in ['perfect', 'partial'] and classification.get('is_standard', False):
                    family_key = f'{classification["crystal_structure"]}_{b_type}'
                    validation_stats[family_key] = validation_stats.get(family_key, 0) + 1
                    normalized_burgers[loop_id] = norm_vec
                    validated_loops.append(loop_id)
                elif self.allow_non_standard and magnitude > 0.1 * self.lattice_parameter:
                    validation_stats['non_standard'] += 1
                    normalized_burgers[loop_id] = arr.copy()
                    validated_loops.append(loop_id)
                    classification['validation_method'] = 'non_standard'
                else:
                    validation_stats['unknown'] += 1
                    classification['validation_method'] = 'failed'
            else:
                validation_stats['zero'] += 1

        return {
            'valid_loops': validated_loops,
            'normalized_burgers': normalized_burgers,
            'burgers_classifications': burgers_classifications,
            'structure_analysis': structure_analysis,
            'stats': validation_stats,
            'magnitudes': magnitudes
        }

    def _validate_with_elastic_mapping(
        self,
        burgers_vectors: Dict[int, np.ndarray],
        loops: List[List[int]],
        positions: np.ndarray,
        displacement_field: Dict[Tuple[int, int], np.ndarray],
        connectivity: Dict[int, List[int]]
    ) -> Dict[str, Any]:
        '''
        Secondary validation using elastic mapping (edges -> Burgers).
        '''
        # Compute edge vectors
        try:
            edge_vectors = self.elastic_mapper.compute_edge_vectors(connectivity, positions)
        except Exception as e:
            raise RuntimeError(f'Failed to compute edge vectors: {e}')

        # Map edges to Burgers via displacement_field
        try:
            edge_burgers = self.elastic_mapper.map_edge_burgers(edge_vectors, displacement_field)
        except Exception as e:
            raise RuntimeError(f'Failed to map edge Burgers: {e}')

        loop_elastic_burgers: Dict[int, np.ndarray] = {}
        validation_results: Dict[int, Dict[str, Any]] = {}

        for loop_id, loop_atoms in enumerate(loops):
            if loop_id not in burgers_vectors:
                continue

            if not isinstance(loop_atoms, (list, tuple, np.ndarray)):
                raise ValueError(f'loops[{loop_id}] must be a list of atom indices')

            loop_burgers_sum = np.zeros(3, dtype=np.float32)
            valid_edges = 0

            for i in range(len(loop_atoms)):
                atom1 = loop_atoms[i]
                atom2 = loop_atoms[(i + 1) % len(loop_atoms)]
                if not (isinstance(atom1, int) and isinstance(atom2, int)):
                    raise ValueError(f'Atom indices in loops[{loop_id}] must be integers')
                edge_key = (min(atom1, atom2), max(atom1, atom2))

                if edge_key in edge_burgers:
                    vec = edge_burgers[edge_key]
                    arr = np.asarray(vec, dtype=np.float32)
                    if arr.ndim != 1 or arr.size != 3:
                        raise ValueError(f'edge_burgers[{edge_key}] must be 3-element array')
                    loop_burgers_sum += arr
                    valid_edges += 1

            if valid_edges > 0:
                loop_elastic_burgers[loop_id] = loop_burgers_sum
                primary_vec = np.asarray(burgers_vectors[loop_id], dtype=np.float32)
                diff = float(np.linalg.norm(loop_burgers_sum - primary_vec))
                denom = float(np.linalg.norm(primary_vec)) + 1e-10
                rel_error = diff / denom

                validation_results[loop_id] = {
                    'elastic_burgers': loop_burgers_sum,
                    'primary_burgers': primary_vec,
                    'difference': diff,
                    'relative_error': rel_error,
                    'is_consistent': rel_error < 0.5
                }

        return {
            'edge_burgers': edge_burgers,
            'loop_elastic_burgers': loop_elastic_burgers,
            'validation_results': validation_results,
            'method': 'elastic_mapping'
        }

    def _validate_with_enhanced_elastic_mapping(
        self,
        burgers_vectors: Dict[int, np.ndarray],
        loops: List[List[int]],
        positions: np.ndarray,
        displacement_field: Dict[Tuple[int, int], np.ndarray],
        connectivity: Dict[int, List[int]],
        ideal_edge_vectors: Dict[Tuple[int, int], np.ndarray]
    ) -> Dict[str, Any]:
        '''
        Enhanced elastic mapping using provided ideal edge vectors.
        '''
        loop_elastic_burgers: Dict[int, np.ndarray] = {}
        validation_results: Dict[int, Dict[str, Any]] = {}

        N_atoms = positions.shape[0]

        for loop_id, loop_atoms in enumerate(loops):
            if loop_id not in burgers_vectors:
                continue

            if not isinstance(loop_atoms, (list, tuple, np.ndarray)):
                raise ValueError(f'loops[{loop_id}] must be a list of atom indices')

            loop_burgers_sum = np.zeros(3, dtype=np.float32)
            valid_edges = 0

            for i in range(len(loop_atoms)):
                atom1 = loop_atoms[i]
                atom2 = loop_atoms[(i + 1) % len(loop_atoms)]
                if not (isinstance(atom1, int) and isinstance(atom2, int)):
                    raise ValueError(f'Atom indices in loops[{loop_id}] must be integers')
                if atom1 < 0 or atom1 >= N_atoms or atom2 < 0 or atom2 >= N_atoms:
                    raise ValueError(f'Atom index out of range in loops[{loop_id}]')
                edge_key = (min(atom1, atom2), max(atom1, atom2))

                if edge_key in ideal_edge_vectors:
                    actual_vec = positions[atom2] - positions[atom1]
                    ideal_vec = np.asarray(ideal_edge_vectors[edge_key], dtype=np.float32)
                    if ideal_vec.ndim != 1 or ideal_vec.size != 3:
                        raise ValueError(f'ideal_edge_vectors[{edge_key}] must be a 3-element array')
                    burgers_contribution = actual_vec - ideal_vec
                    loop_burgers_sum += burgers_contribution
                    valid_edges += 1

            if valid_edges > 0:
                loop_elastic_burgers[loop_id] = loop_burgers_sum
                primary_vec = np.asarray(burgers_vectors[loop_id], dtype=np.float32)
                diff = float(np.linalg.norm(loop_burgers_sum - primary_vec))
                denom = float(np.linalg.norm(primary_vec)) + 1e-10
                rel_error = diff / denom

                validation_results[loop_id] = {
                    'elastic_burgers': loop_burgers_sum,
                    'primary_burgers': primary_vec,
                    'difference': diff,
                    'relative_error': rel_error,
                    'is_consistent': rel_error < 0.3,
                    'valid_edges': valid_edges,
                    'total_edges': len(loop_atoms)
                }

        return {
            'loop_elastic_burgers': loop_elastic_burgers,
            'validation_results': validation_results,
            'method': 'enhanced_elastic_mapping'
        }

    def _validate_with_interface_mesh(
        self,
        burgers_vectors: Dict[int, np.ndarray],
        loops: List[List[int]],
        positions: np.ndarray,
        interface_mesh: Dict[str, Any],
        defect_regions: Optional[Dict[int, bool]] = None
    ) -> Dict[str, Any]:
        '''
        Validate loops against an interface mesh by checking proximity and defect enclosure.
        '''
        vertices = interface_mesh.get('vertices', np.array([]))
        faces = interface_mesh.get('faces', np.array([]))

        vert_arr = np.asarray(vertices, dtype=np.float32)
        face_arr = np.asarray(faces, dtype=int)

        if vert_arr.ndim != 2 or vert_arr.shape[1] != 3:
            logger.warning('Interface mesh vertices missing or invalid, skipping mesh validation')
            return {'validation_results': {}, 'method': 'interface_mesh'}
        if face_arr.ndim != 2 or face_arr.shape[1] < 3:
            logger.warning('Interface mesh faces missing or invalid, skipping mesh validation')
            return {'validation_results': {}, 'method': 'interface_mesh'}

        N_atoms = positions.shape[0]
        mesh_validation_results: Dict[int, Dict[str, Any]] = {}

        for loop_id, loop_atoms in enumerate(loops):
            if loop_id not in burgers_vectors:
                continue
            if not isinstance(loop_atoms, (list, tuple, np.ndarray)):
                raise ValueError(f'loops[{loop_id}] must be a list of atom indices')

            # Check atoms in valid range
            for atom in loop_atoms:
                if atom < 0 or atom >= N_atoms:
                    raise ValueError(f'Atom index {atom} in loops[{loop_id}] out of range')

            loop_pos = positions[loop_atoms]
            loop_centroid = np.mean(loop_pos, axis=0)

            min_dist = self._compute_point_to_mesh_distance(loop_centroid, vert_arr, face_arr)

            enclosure_score = 0.0
            if defect_regions:
                enclosure_score = self._compute_defect_enclosure_score(loop_atoms, positions, defect_regions)

            is_consistent = (min_dist < 5.0 and enclosure_score > 0.1)

            mesh_validation_results[loop_id] = {
                'interface_distance': min_dist,
                'defect_enclosure_score': enclosure_score,
                'is_interface_consistent': is_consistent,
                'loop_centroid': loop_centroid.tolist()
            }

        return {
            'validation_results': mesh_validation_results,
            'method': 'interface_mesh'
        }

    def _compute_consistency_metrics(
        self,
        primary_validation: Dict[str, Any],
        secondary_validation: Dict[str, Any]
    ) -> Dict[str, Any]:
        '''
        Compute consistency metrics between primary and secondary validations.
        '''
        validation_results = secondary_validation.get('validation_results', {})
        if not validation_results:
            return {
                'overall_consistency': 0.0,
                'consistent_loops': [],
                'inconsistent_loops': [],
                'mean_relative_error': float('inf'),
                'consistency_ratio': 0.0
            }

        consistent_loops: List[int] = []
        inconsistent_loops: List[int] = []
        relative_errors: List[float] = []

        for loop_id, result in validation_results.items():
            rel_error = result.get('relative_error', float('inf'))
            relative_errors.append(rel_error)
            if result.get('is_consistent', False):
                consistent_loops.append(loop_id)
            else:
                inconsistent_loops.append(loop_id)

        consistency_ratio = len(consistent_loops) / len(validation_results)
        mean_relative_error = float(np.mean(relative_errors)) if relative_errors else float('inf')
        overall_consistency = 1.0 - min(mean_relative_error, 1.0)

        logger.info(
            f'Consistency: {len(consistent_loops)}/{len(validation_results)} '
            f'loops, mean error {mean_relative_error:.3f}'
        )

        return {
            'overall_consistency': overall_consistency,
            'consistent_loops': consistent_loops,
            'inconsistent_loops': inconsistent_loops,
            'mean_relative_error': mean_relative_error,
            'consistency_ratio': consistency_ratio,
            'relative_errors': relative_errors
        }

    def _compute_enhanced_consistency_metrics(
        self,
        primary_validation: Dict[str, Any],
        secondary_validation: Dict[str, Any],
        interface_validation: Dict[str, Any]
    ) -> Dict[str, Any]:
        '''
        Compute consistency metrics including interface mesh if available.
        '''
        base_metrics = self._compute_consistency_metrics(primary_validation, secondary_validation)

        interface_results = interface_validation.get('validation_results', {})
        if interface_results:
            interface_consistent: List[int] = []
            interface_inconsistent: List[int] = []

            for loop_id, res in interface_results.items():
                if res.get('is_interface_consistent', False):
                    interface_consistent.append(loop_id)
                else:
                    interface_inconsistent.append(loop_id)

            total_interface = len(interface_results)
            interface_ratio = (len(interface_consistent) / total_interface) if total_interface > 0 else 0.0

            base = base_metrics.get('overall_consistency', 0.0)
            weight = 0.3
            enhanced_val = (1.0 - weight) * base + weight * interface_ratio

            base_metrics.update({
                'interface_consistent_loops': interface_consistent,
                'interface_inconsistent_loops': interface_inconsistent,
                'interface_consistency_ratio': interface_ratio,
                'enhanced_overall_consistency': enhanced_val
            })

        return base_metrics

    def _create_final_validation(
        self,
        primary_validation: Dict[str, Any],
        secondary_validation: Dict[str, Any],
        consistency_metrics: Dict[str, Any]
    ) -> Dict[str, Any]:
        '''
        Create final validation results combining primary and secondary validations.
        '''
        primary_valid = set(primary_validation.get('valid_loops', []))
        consistent = set(consistency_metrics.get('consistent_loops', []))
        final_loops = list(primary_valid.intersection(consistent))

        final_norm_burgers: Dict[int, np.ndarray] = {}
        for loop_id in final_loops:
            if loop_id in primary_validation.get('normalized_burgers', {}):
                final_norm_burgers[loop_id] = primary_validation['normalized_burgers'][loop_id]

        final_stats = primary_validation.get('stats', {}).copy()
        final_stats['consistency_validated'] = len(final_loops)
        final_stats['consistency_ratio'] = consistency_metrics.get('consistency_ratio', 0.0)

        return {
            'valid_loops': final_loops,
            'normalized_burgers': final_norm_burgers,
            'stats': final_stats,
            'quality_score': consistency_metrics.get('overall_consistency', 0.0)
        }

    def _create_enhanced_final_validation(
        self,
        primary_validation: Dict[str, Any],
        secondary_validation: Dict[str, Any],
        interface_validation: Dict[str, Any],
        consistency_metrics: Dict[str, Any]
    ) -> Dict[str, Any]:
        '''
        Create final validation results using both elastic mapping and interface mesh when available.
        '''
        base_final = self._create_final_validation(
            primary_validation, secondary_validation, consistency_metrics
        )

        interface_results = interface_validation.get('validation_results', {})
        if interface_results:
            primary_valid = set(primary_validation.get('valid_loops', []))
            elastic_consistent = set(consistency_metrics.get('consistent_loops', []))
            interface_consistent = set(consistency_metrics.get('interface_consistent_loops', []))

            if interface_consistent:
                final_loops = list(primary_valid.intersection(elastic_consistent).intersection(interface_consistent))
            else:
                final_loops = list(primary_valid.intersection(elastic_consistent))

            base_final['valid_loops'] = final_loops
            methods = ['primary', 'elastic_mapping']
            if interface_consistent:
                methods.append('interface_mesh')
            base_final['validation_methods_used'] = methods

            if 'enhanced_overall_consistency' in consistency_metrics:
                base_final['quality_score'] = consistency_metrics['enhanced_overall_consistency']

        return base_final

    def _compute_enhancement_metrics(
        self,
        primary_validation: Dict[str, Any],
        secondary_validation: Dict[str, Any],
        interface_validation: Dict[str, Any],
        has_enhanced_elastic: bool,
        has_interface_mesh: bool
    ) -> Dict[str, Any]:
        '''
        Compute metrics showing value of enhanced elastic mapping and interface mesh.
        '''
        metrics: Dict[str, Any] = {
            'enhancement_score': 0.0,
            'elastic_enhancement': 0.0,
            'interface_enhancement': 0.0,
            'methods_used': []
        }

        baseline_count = len(primary_validation.get('valid_loops', []))

        if has_enhanced_elastic:
            metrics['methods_used'].append('enhanced_elastic_mapping')
            em_results = secondary_validation.get('validation_results', {})
            if em_results:
                errors = [res.get('relative_error', 1.0) for res in em_results.values()]
                if errors:
                    metrics['elastic_enhancement'] = 1.0 - float(np.mean(errors))

        if has_interface_mesh:
            metrics['methods_used'].append('interface_mesh')
            im_results = interface_validation.get('validation_results', {})
            if im_results:
                scores = [res.get('defect_enclosure_score', 0.0) for res in im_results.values()]
                if scores:
                    metrics['interface_enhancement'] = float(np.mean(scores))
                    metrics['interface_correlation'] = float(np.std(scores))

        metrics['enhancement_score'] = (
            0.6 * metrics['elastic_enhancement'] +
            0.4 * metrics['interface_enhancement']
        )

        return metrics

    def _compute_point_to_mesh_distance(
        self,
        point: np.ndarray,
        vertices: np.ndarray,
        faces: np.ndarray
    ) -> float:
        '''
        Compute minimum distance from a point to a triangulated mesh (approximate via plane distance).
        '''
        if faces.ndim != 2 or faces.shape[1] < 3:
            return float('inf')

        min_dist = float('inf')
        for face in faces:
            if len(face) < 3:
                continue
            v0 = vertices[face[0]]
            v1 = vertices[face[1]]
            v2 = vertices[face[2]]
            dist = self._point_to_triangle_distance(point, v0, v1, v2)
            if dist < min_dist:
                min_dist = dist

        return min_dist

    def _point_to_triangle_distance(
        self,
        point: np.ndarray,
        v0: np.ndarray,
        v1: np.ndarray,
        v2: np.ndarray
    ) -> float:
        '''
        Compute approximate distance from a point to a triangle plane (ignore in-plane check).
        '''
        edge1 = v1 - v0
        edge2 = v2 - v0
        normal = np.cross(edge1, edge2)
        norm_len = float(np.linalg.norm(normal))
        if norm_len < 1e-12:
            # Degenerate triangle: return min distance to vertices
            return float(min(
                np.linalg.norm(point - v0),
                np.linalg.norm(point - v1),
                np.linalg.norm(point - v2)
            ))
        normal /= norm_len
        to_pt = point - v0
        return float(abs(np.dot(to_pt, normal)))

    def _compute_defect_enclosure_score(
        self,
        loop_atoms: List[int],
        positions: np.ndarray,
        defect_regions: Dict[int, bool]
    ) -> float:
        '''
        Compute fraction of defective tetrahedra enclosed by the loop bounding box.
        '''
        loop_pos = positions[loop_atoms]
        loop_min = np.min(loop_pos, axis=0)
        loop_max = np.max(loop_pos, axis=0)

        enclosed = 0
        total = 0
        for tet_id, is_good in defect_regions.items():
            total += 1
            if not is_good:
                enclosed += 1  # Simplified: assume all bad tets count

        return float(enclosed / total) if total > 0 else 0.0

    def classify_burgers_vector(
        self,
        burgers_vector: np.ndarray,
        local_structure: Optional[str] = None
    ) -> Dict[str, Any]:
        '''
        Classify a single Burgers vector based on standard sets, or detect structure if unknown.
        '''
        arr = np.asarray(burgers_vector, dtype=np.float32)
        if arr.ndim != 1 or arr.size != 3:
            raise ValueError(f'burgers_vector must be a 3-element array, got {arr.shape}')

        magnitude = float(np.linalg.norm(arr))
        classification: Dict[str, Any] = {
            'magnitude': magnitude,
            'normalized_vector': (arr / max(magnitude, 1e-10)).tolist(),
            'crystal_structure': 'unknown',
            'is_standard': False,
            'dislocation_type': 'unknown',
            'family': 'unknown'
        }

        # Determine local structure if not provided
        if local_structure is None:
            local = self._detect_local_structure(arr)
        else:
            local = local_structure if isinstance(local_structure, str) else self.crystal_type
        classification['crystal_structure'] = local

        # Check standard sets
        if local in self.standard_burgers:
            stds = self.standard_burgers[local]
            for dtype in ['perfect', 'partial']:
                candidates = stds.get(dtype, [])
                match, err = self._find_best_match(arr, candidates)
                if err < self.tolerance:
                    classification.update({
                        'is_standard': True,
                        'dislocation_type': dtype,
                        'family': f'{local}_{dtype}',
                        'match_error': float(err),
                        'standard_vector': match.tolist()
                    })
                    return classification

        # Non-standard
        if self.allow_non_standard and magnitude > 0.1 * self.lattice_parameter:
            classification.update({
                'dislocation_type': 'non_standard',
                'family': f'{local}_non_standard'
            })
        return classification

    def _find_best_match(
        self,
        vector: np.ndarray,
        standard_vectors: List[np.ndarray]
    ) -> Tuple[np.ndarray, float]:
        '''
        Find closest vector among standard_vectors (or its negative).
        '''
        min_err = float('inf')
        best = None
        for std in standard_vectors:
            std_arr = np.asarray(std, dtype=np.float32)
            if std_arr.shape != (3,):
                continue
            err1 = float(np.linalg.norm(vector - std_arr))
            err2 = float(np.linalg.norm(vector + std_arr))
            if err1 < min_err:
                min_err = err1
                best = std_arr
            if err2 < min_err:
                min_err = err2
                best = -std_arr
        return best if best is not None else np.zeros(3, dtype=np.float32), min_err

    def _detect_local_structure(self, burgers_vector: np.ndarray) -> str:
        '''
        Heuristically detect likely crystal structure from Burgers magnitude.
        '''
        mag = float(np.linalg.norm(burgers_vector))
        a = self.lattice_parameter

        # FCC checks
        if abs(mag - a/2 * np.sqrt(2)) < self.tolerance:
            return 'fcc'
        if abs(mag - a/6 * np.sqrt(6)) < self.tolerance:
            return 'fcc'

        # BCC checks
        if abs(mag - a/2 * np.sqrt(3)) < self.tolerance:
            return 'bcc'
        if abs(mag - a/2) < self.tolerance:
            return 'bcc'

        # HCP checks
        if abs(mag - a) < self.tolerance:
            return 'hcp'
        if abs(mag - a/3) < self.tolerance:
            return 'hcp'

        return self.crystal_type

    def analyze_loop_structure(
        self,
        loop: List[int],
        positions: np.ndarray,
        ptm_types: Optional[np.ndarray] = None
    ) -> Dict[str, Any]:
        '''
        Analyze local crystal structure along a loop using PTM types.
        '''
        if ptm_types is None:
            return {
                'dominant_structure': self.crystal_type,
                'structure_fractions': {},
                'structure_counts': {},
                'total_atoms': len(loop)
            }

        if not isinstance(ptm_types, np.ndarray) or ptm_types.ndim != 1:
            raise ValueError('ptm_types must be a 1D numpy array')

        structure_map = {0: 'unknown', 1: 'fcc', 2: 'hcp', 3: 'bcc', 4: 'ico', 5: 'sc'}
        counts: Dict[str, int] = {}
        for atom in loop:
            if not isinstance(atom, int) or atom < 0 or atom >= len(ptm_types):
                continue
            stype = structure_map.get(int(ptm_types[atom]), 'unknown')
            counts[stype] = counts.get(stype, 0) + 1

        total_atoms = len(loop)
        fractions = {k: v / total_atoms for k, v in counts.items()} if total_atoms > 0 else {}
        dominant = max(counts, key=counts.get) if counts else 'unknown'

        return {
            'dominant_structure': dominant,
            'structure_fractions': fractions,
            'structure_counts': counts,
            'total_atoms': total_atoms
        }
