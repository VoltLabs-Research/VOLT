from opendxa.export.dislocation_tracker import DislocationTracker
import numpy as np

tracker = DislocationTracker(directory='/home/rodyherrera/Desktop/OpenDXA/dislocations')

print('==== Loading all timesteps from JSON files ====')
tracker.load_all_timesteps()
print(f'Loaded timesteps: {sorted(tracker.timesteps_data.keys())}\n')

# 2) Compute centroids
print('==== Computing centroids for each timestep ====')
centroids_list = tracker.compute_centroids()
for timestep, centroids in centroids_list:
    print(f'  Timestep {timestep}: {len(centroids)} centroids, sample: {centroids[:3]}')
print()

# 3) Voxel density
print('==== Computing voxel density ====')
voxel_counts = tracker.voxel_density(grid_size=(10,10,10))
nonzero_voxels = {k: v for k, v in voxel_counts.items() if v > 0}
print(f'  Total non-zero voxels: {len(nonzero_voxels)}')
print('  Some non-zero voxel counts (i,j,k:count):')
for idx, count in list(nonzero_voxels.items())[:10]:
    print(f'    {idx}: {count}')
print()

# 4) Clustering centroids (KMeans)
print('==== Performing KMeans clustering on all centroids ====')
kmeans_obj, all_centroids, labels = tracker.cluster_centroids(n_clusters=3)
print(f'  Total centroids clustered: {all_centroids.shape[0]}')
print(f'  KMeans inertia: {kmeans_obj.inertia_:.3f}')
unique_labels, counts = np.unique(labels, return_counts=True)
for label, cnt in zip(unique_labels, counts):
    print(f'    Cluster {label}: {cnt} points')
print()

# 5) Compute tortuosity
print('==== Computing tortuosity for all lines ====')
tortuosity_values = tracker.compute_tortuosity()
print(f'  Number of tortuosity values: {len(tortuosity_values)}')
if tortuosity_values:
    print(f'  Tortuosity min: {min(tortuosity_values):.3f}, max: {max(tortuosity_values):.3f}, mean: {np.mean(tortuosity_values):.3f}')
print('  Displaying tortuosity histogram plot...')
tracker.plot_tortuosity_histogram(bins=50)
print()

# 6) Build and analyze graph topology for each timestep
print('==== Analyzing graph topology for each timestep ====')
for timestep in sorted(tracker.timesteps_data.keys()):
    stats = tracker.analyze_graph_topology(timestep)
    print(f'  Timestep {timestep}: components={stats["num_components"]}, cycles={stats["num_cycles"]}, mean_degree={stats["mean_degree"]:.3f}')
print()

# 7) Compute orientation histogram
print('==== Computing orientation histogram (azimuth) ====')
tracker.compute_orientation_histogram(bins=36)
print()

# 8) Plot spacetime heatmap
print('==== Plotting spacetime heatmap ====')
tracker.plot_spacetime_heatmap(num_z_bins=50)
print()

# 9) Track dislocations over time
print('==== Tracking dislocations across timesteps ====')
tracks = tracker.track_dislocations()
print(f'  Number of distinct tracks found: {len(tracks)}')
# Mostrar un ejemplo de un track con sus timesteps
if tracks:
    example_idx = 0
    example_track = tracks[example_idx]
    print(f'  Example track #{example_idx} timesteps: {sorted(example_track.keys())}')
print()

# 10) Compute segments-to-plane histogram for a chosen timestep (ejemplo: primer timestep cargado)
example_timestep = sorted(tracker.timesteps_data.keys())[0]
print(f'==== Computing plane histogram for segments at timestep {example_timestep} ====')
# Definir algunos planos cristalográficos de ejemplo:
plane_normals = {
    '111': np.array([1, 1, 1]),
    '1-11': np.array([1, -1, 1]),
    '-111': np.array([-1, 1, 1]),
    '-1-11': np.array([-1, -1, 1])
}
plane_hist = tracker.segments_to_plane_histogram(example_timestep, plane_normals, angle_tol=5.0)
print('  Segment counts per plane:')
for plane, count in plane_hist.items():
    print(f'    {plane}: {count}')
print()

# 11) Compute general statistics (Burgers histogram)
print('==== Computing general dislocation statistics ====')
tracker.compute_statistics()
print('  Displaying Burgers histogram plot...')
tracker.plot_burgers_histogram()
print()