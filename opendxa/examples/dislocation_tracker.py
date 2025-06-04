from opendxa.export import DislocationDataset
from opendxa.visualization import (
    plot_histogram,
    plot_burgers_histogram,
    plot_voxel_density_map,
    plot_voxel_line_length_map,
    plot_networkx_graph,
    plot_spacetime_heatmap,
    plot_centroids_3d,
    plot_dislocation_lines_3d
)

from opendxa.analysis import (
    compute_centroids,
    voxel_density,
    voxel_line_length_density,
    cluster_centroids,
    compute_tortuosity,
    compute_line_lengths,
    build_dislocation_graph,
    analyze_graph_topology,
    compute_graph_spectrum,
    compute_orientation_azimuth,
    compute_orientation_spherical,
    compute_spacetime_heatmap,
    track_dislocations,
    segments_to_plane_histogram,
    compute_burgers_histogram,
    compute_persistence_centroids,
    compute_anisotropy_eigenvalues
)

import matplotlib.pyplot as plt
import numpy as np
import os

DATA_DIR = '/home/rodyherrera/Desktop/OpenDXA/dislocations'
RESULTS_DIR = '/home/rodyherrera/Desktop/OpenDXA/reports'
FIGURES_DIR = os.path.join(RESULTS_DIR, 'figures')
TABLES_DIR = os.path.join(RESULTS_DIR, 'tables')

os.makedirs(FIGURES_DIR, exist_ok=True)
os.makedirs(TABLES_DIR, exist_ok=True)

def main():
    # Load dislocation dataset
    dataset = DislocationDataset(directory=DATA_DIR)
    print('Loading JSON files...')
    dataset.load_all_timesteps()
    timesteps = dataset.get_timesteps()
    print(f'Loaded timesteps: {timesteps}\n')

    # Compute centroids and save
    print('Computing centroids...')
    centroids_list = compute_centroids(dataset.timesteps_data)
    # Save centroids to CSV (one file per timestep)
    for timestep, centroids in centroids_list:
        csv_filename = os.path.join(TABLES_DIR, f'centroids_t{timestep}.csv')
        np.savetxt(csv_filename, centroids, delimiter=',', header='x,y,z', comments='')
    print('Centroids saved to CSV.\n')

    # Voxel density (count)
    print('Computing voxel density (count)...')
    # Define real box bounds, for example [[0,30], [0,30], [0,10]]
    box_bounds = [[0, 30], [0, 30], [0, 10]]
    voxel_counts = voxel_density(dataset.timesteps_data, grid_size=(20, 20, 10), box_bounds=box_bounds)
    # Visualize and save voxel density map (central z-slice)
    plot_voxel_density_map(voxel_counts, grid_size=(20, 20, 10), title='Voxel Count').savefig(os.path.join(FIGURES_DIR, 'voxel_count.png'))
    print('Voxel count plot saved.\n')

    # Voxel line length density
    print('Computing voxel line length density...')
    voxel_densities = voxel_line_length_density(dataset.timesteps_data, grid_size=(20, 20, 10), box_bounds=box_bounds)
    # Display central z-slice and save
    plot_voxel_line_length_map(voxel_densities, axis='z').savefig(os.path.join(FIGURES_DIR, 'voxel_line_length.png'))
    print('Voxel line length density plot saved.\n')

    # KMeans clustering on centroids
    print('Running KMeans clustering on centroids...')
    kmeans_model, all_centroids, cluster_labels = cluster_centroids(dataset.timesteps_data, n_clusters=3)
    print(f'KMeans inertia: {kmeans_model.inertia_:.3f}')
    unique_labels, label_counts = np.unique(cluster_labels, return_counts=True)
    for label, count in zip(unique_labels, label_counts):
        print(f'  Cluster {label}: {count} points')
    # Optionally save labels alongside coordinates
    np.savetxt(os.path.join(TABLES_DIR, 'centroids_labels.csv'),
               np.hstack((all_centroids, cluster_labels.reshape(-1,1))),
               delimiter=',', header='x,y,z,label', comments='')
    print('Clustering results saved.\n')

    # Tortuosity and line lengths
    print('Computing tortuosity...')
    tortuosity_values = compute_tortuosity(dataset.timesteps_data)
    plot_histogram(tortuosity_values, bins=50, title='Tortuosity', xlabel='Tortuosity').savefig(os.path.join(FIGURES_DIR, 'tortuosity_histogram.png'))
    print('Tortuosity histogram saved.')

    print('Computing line lengths...')
    line_lengths_data = compute_line_lengths(dataset.timesteps_data)
    # Extract only lengths
    lengths = np.array([length for (_, length) in line_lengths_data])
    plot_histogram(lengths, bins=50, title='Line Lengths', xlabel='Length').savefig(os.path.join(FIGURES_DIR, 'line_lengths_histogram.png'))
    print('Line length histogram saved.\n')

    # Graph and topological metrics
    first_timestep = timesteps[0]
    print(f'Building graph for timestep {first_timestep}...')
    dislocs_first = dataset.get_dislocations(first_timestep)
    graph_first = build_dislocation_graph(dislocs_first)
    topology_stats = analyze_graph_topology(graph_first)
    laplacian_spectrum = compute_graph_spectrum(graph_first)
    print(f'  Number of components: {topology_stats["num_components"]}')
    print(f'  Number of cycles: {topology_stats["num_cycles"]}')
    print(f'  Mean degree: {topology_stats["mean_degree"]:.3f}')
    print(f'  First 5 Laplacian eigenvalues: {laplacian_spectrum[:5]}\n')

    # Visualize graph (XY projection)
    plot_networkx_graph(graph_first, title=f'Graph at t={first_timestep}').savefig(os.path.join(FIGURES_DIR, f'graph_{first_timestep}.png'))
    print(f'Graph for timestep {first_timestep} saved.\n')

    # Line orientation
    print('Computing orientation (azimuth)...')
    azimuth_angles = compute_orientation_azimuth(dataset.timesteps_data)
    plot_histogram(azimuth_angles, bins=36, title='Orientation (Azimuth)', xlabel='Angle (degrees)').savefig(os.path.join(FIGURES_DIR, 'orientation_azimuth_histogram.png'))
    print('Azimuth orientation histogram saved.\n')

    print('Computing spherical orientation...')
    spherical_orientations = compute_orientation_spherical(dataset.timesteps_data)
    # Optionally save theta, phi to CSV
    np.savetxt(os.path.join(TABLES_DIR, 'orientations_spherical.csv'),
               spherical_orientations, delimiter=',', header='theta,phi', comments='')
    print('Spherical orientations saved.\n')

    # Spacetime heatmap
    print('Computing spacetime heatmap...')
    timesteps_list, z_bounds, heatmap_matrix = compute_spacetime_heatmap(dataset.timesteps_data, num_z_bins=50, z_bounds=None)
    plot_spacetime_heatmap(timesteps_list, z_bounds, heatmap_matrix).savefig(os.path.join(FIGURES_DIR, 'spacetime_heatmap.png'))
    print('Spacetime heatmap saved.\n')

    # Dislocation tracking
    print('Tracking dislocations...')
    dislocation_tracks = track_dislocations(dataset.timesteps_data)
    print(f'  Number of tracks found: {len(dislocation_tracks)}')
    if dislocation_tracks:
        example_track = dislocation_tracks[0]
        print(f'  Track #0 present at timesteps: {sorted(example_track.keys())}\n')

    # Plane histogram of segments at first timestep
    print(f'Computing plane histogram for t={first_timestep}...')
    plane_normals = {
        '111': np.array([1, 1, 1]),
        '1-11': np.array([1, -1, 1]),
        '-111': np.array([-1, 1, 1]),
        '-1-11': np.array([-1, -1, 1])
    }
    plane_histogram = segments_to_plane_histogram(dislocs_first, plane_normals,
                                                  angle_tol=5.0)
    for plane_label, segment_count in plane_histogram.items():
        print(f'    {plane_label}: {segment_count} segments')
    print()

    # Burgers vector histogram
    print('Computing Burgers vector histogram...')
    burgers_histogram, total_loops = compute_burgers_histogram(dataset.timesteps_data)
    print(f'  Total dislocation lines: {total_loops}')
    # Show top 5 most frequent Burgers vectors
    top5_burgers = sorted(burgers_histogram.items(), key=lambda x: -x[1])[:5]
    for bvec_str, count in top5_burgers:
        print(f'    {bvec_str}: {count}')

    plot_burgers_histogram(burgers_histogram).savefig(os.path.join(FIGURES_DIR, 'burgers_histogram.png'))
    print('Burgers vector histogram saved.\n')

    # Persistent homology of centroids
    print('Computing persistent homology of centroids...')
    persistence_diagrams = compute_persistence_centroids(dataset.timesteps_data)
    print('Persistent homology computation completed.\n')

    # Compute anisotropy tensor eigenvalues
    print('Computing anisotropy tensor of centroids...')
    anisotropy_eigenvalues = compute_anisotropy_eigenvalues(dataset.timesteps_data)
    if anisotropy_eigenvalues is not None:
        print(f'  Eigenvalues (λ_max, λ_mid, λ_min): {anisotropy_eigenvalues}\n')
    else:
        print('Not enough centroids to compute anisotropy.\n')

    # Total line length by crystal plane at first timestep
    print(f'Computing total line length by crystal plane for t={first_timestep}...')
    lengths_by_plane = {label: 0.0 for label in plane_normals}
    for d in dislocs_first:
        pts = np.array(d['points'])
        for idx in range(len(pts) - 1):
            segment = pts[idx + 1] - pts[idx]
            length = np.linalg.norm(segment)
            if length < 1e-8:
                continue
            segment_unit = segment / length
            for label, normal in plane_normals.items():
                normal_unit = normal / np.linalg.norm(normal)
                angle_deg = np.degrees(np.arccos(abs(np.dot(segment_unit, normal_unit))))
                if abs(angle_deg - 90.0) <= 5.0:
                    lengths_by_plane[label] += length
                    break
    for plane_label, total_length in lengths_by_plane.items():
        print(f'    {plane_label}: total length = {total_length:.3f}')
    print()

    print('=== END OF ANALYSIS ===')


if __name__ == '__main__':
    main()