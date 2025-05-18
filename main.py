from core.lammpstrj_parser import LammpstrjParser
from core.hybrid_neighbor_finder import HybridNeighborFinder
from core.ptm_local_classifier import PTMLocalClassifier, get_ptm_templates
from core.surface_filter import SurfaceFilter
from core.lattice_connectivity_graph import LatticeConnectivityGraph
from core.displacement_field_analyzer import DisplacementFieldAnalyzer

parser = LammpstrjParser('./nanoparticle.lammpstrj')

for data in parser.iter_timesteps():
    timestep = data['timestep']
    positions = data['positions']
    box_bounds = data['box']
    ids = data['ids']

    print(f'Timestep {timestep}, {len(positions)} atoms')

    neighbor_finder = HybridNeighborFinder(
        positions=positions,
        cutoff=3.5,
        num_neighbors=12,
        box_bounds=box_bounds
    )
    print('Finding neighbors...')
    neighbors = neighbor_finder.find_neighbors()
    print(f'Neighbors of atom {ids[0]}:', neighbors[0])

    templates, template_sizes = get_ptm_templates()
    classifier = PTMLocalClassifier(
        positions=positions,
        box_bounds=box_bounds,
        neighbor_dict=neighbors,
        templates=templates,
        template_sizes=template_sizes,
        max_neighbors=template_sizes.max()
    )

    types, quaternions = classifier.classify()
    surface_filter = SurfaceFilter(min_neighbors=12)
    interior_idxs = surface_filter.filter_indices(neighbors, ptm_types=types)

    print('Interior atom count:', len(interior_idxs))

    filtered_data = surface_filter.filter_data(positions, ids, neighbors, ptm_types=types, quaternions=quaternions)

    print('\n--- Filtered Data ---')
    print('Filtered positions (first 5):')
    print(filtered_data['positions'][:5])
    print('\nFiltered IDs:')
    print(filtered_data['ids'])
    print('\nFiltered neighbor lists (first 5):')
    for i in range(min(5, len(filtered_data['ids']))):
        print(f'  atom {filtered_data["ids"][i]} →', filtered_data['neighbors'][i])
    print('\nFiltered PTM types:')
    print(filtered_data['ptm_types'])
    print('\nFiltered orientation quaternions (first 5):')
    print(filtered_data['quaternions'][:5])

    lattice_graph = LatticeConnectivityGraph(
        positions=filtered_data['positions'],
        ids=filtered_data['ids'],
        neighbors=filtered_data['neighbors'],
        ptm_types=filtered_data['ptm_types'],
        quaternions=filtered_data['quaternions'],
        templates=templates,
        template_sizes=template_sizes,
        tolerance=0.2
    )
    connectivity = lattice_graph.build_graph()

    dfa = DisplacementFieldAnalyzer(
        positions=filtered_data['positions'],
        connectivity=connectivity,
        ptm_types=filtered_data['ptm_types'],
        quaternions=filtered_data['quaternions'],
        templates=templates,
        template_sizes=template_sizes,
        box_bounds=box_bounds
    )

    disp_vectors, avg_mags = dfa.compute_displacement_field()

    for i, avg_mag in enumerate(avg_mags):
        if avg_mag == 0.0: continue
        print(f'Avg displacement magnitude of atom {i}:', avg_mags[i])
        print(f'Displacement vectors for atom {i}:\n', disp_vectors.get(i))
        break

    break