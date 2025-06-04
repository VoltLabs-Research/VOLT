# OpenDXA - Open Dislocation Extraction Algorithm

![What's DXA?](/screenshots/Whats-DXA.png)

[![License: GPL v2](https://img.shields.io/badge/License-GPL%20v2-blue.svg)](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)

**OpenDXA** is a high-performance, open-source Python package for extracting, analyzing, and visualizing dislocation lines in atomistic simulations. Built with GPU acceleration and robust algorithms, it provides comprehensive analysis of crystal defects in FCC, BCC, and HCP structures from LAMMPS trajectory files.

## Key Features

- **Parallell Neighbor Finding & Structure Classification**: OpenDXA uses a hybrid algorithm that combines cutoff-based and Voronoi-based neighbors search, with adjustable `cutoff`, `num_neighbors`, `voronoi_factor`. Supports both PTM (Polyhedral Template Matching) and CNA (Common Neighbor Analysis), selectable via `--use-cna`. Automatically infers or accepts user-supplied crystal-type and lattice parameter.
- **Surface Filtering & Delaunay Tessellation**: To remove surface/disordered atoms based on a minimum neighbors criterion (`--min-neighbors`). Delaunay tessellation under PBC with ghost layers (`--ghost-thickness`) to identify tetrahedral connectivity for core-marking and later steps.
- **Lattice Connectivity Graph**: `LatticeConnectivityGraph` builds a base connectivity graph from neighbors, then feeds into `ConnectivityManager` that centralizes and optionally enhaces connectivity (e.g via tessellation), allowing reuse of neighbors list across multiple pipeline stages. 
- **Dislocation Loop Finding & Burgers Circuit Evaluation**: `FilteredLoopFinder` finds minimal loops in the connectivity graph (with `--max-loop-length`, `--max-loops`, `--loop-timeout`). `LoopCanonicalizer` normalizes loops for translation and symmetry-invariance. `BurgersCircuitEvaluator` computes Burgers vectors for each loop in a vectorized, GPU-friendly manner. Loop grouping (`LoopGrouper`) merges similar loops based on distance and Burgers-vector angle thresholds.
- **Loop Clustering & Grouping**: Vectorized distance and angle-matrix computation with `scipy.spatial.distance.cdist`. Aggressive thresholds (`--grouping-distance-threshold`, `--grouping-angle-threshold`) for fast, approximate grouping when many loops are found. Fallback to simple grouping when the number of loops is small.
- **Crystalline Cluster Building**: `CrystallineClusterBuilder` groups atoms into clusters by structure type (PTM/CNA) and orientation (quaternion similarity, `--orientation-threshold`, `--min-cluster-size`). Detects cluster borders (transitions) for elastic-mapping analyzes or advanced defect-network studies.
- **Displacement Field Analysis & Lattice Parameter Estimation**: `DisplacementFieldAnalyzer` computes atomic displacement vectors and average magnitudes. PBC unwrapping via `unwrap_pbc_displacement`. Automatic estimation of lattice parameter from first-neighbor distances (`estimate_lattice_parameter`), with fallbacks for unrealistic values.
- **Dislocation Core Marking & Line Refinement**: `DislocationCoreMarker` assigns dislocation-core IDs to atoms within a core radius (`--core-radius`) scaled by Burgers magnitude. `DislocationLineSmoother` smooths raw line points (`--line-smoothing-level`, `--line-point-interval`). Combines refined lines with core IDs and computes Nye tensor and comprehensive statistics (lengths, densities, Burgers-family classification).
- **Export to JSON & Fast-Mode Pipeline**: `DislocationExporter` writes out final dislocation data (loops, segments, Burgers vectors, types, etc.) to a JSON file (`--output`). Supports "fast-mode" (`--fast-mode`) to skip heavy refinement steps and export minimal loop information quickly.
- **Built-In Statistical & Graph-Theoric Analyses**: `DislocationStatisticsGenerator` produces tables similar to OVITO's DataTable: total length, density, line density, Burgers-family breakdown, cluster statistics, etc. Optional modules for histogramming Burgers vectors, tortuosity, orientation (azimuth/spherical), voxel density (`--run-voxel-density`, `--voxel-grid--size`), and persistence/homology. Graph-topology analysis for selected timesteps (`--run-graph-topology`, `--graph-topology-timesteps`).
- **Spacetime Heatmap & Tracking Over Multiple Timesteps**: Builds a 2D heatmap (timestep vs. z-position) showing counts of dislocation centroids per z-bin (`--spacetime-heatmap`). `track_dislocations` correlates dislocations across successive timesteps based on Burgers signature and spatial proximity to produce time-resolving "tracks."

## Installation
Follow the steps below to set up OpenDXA using Poetry. These instructions assume you already have Python 3.12+ installed.

1. **Install Poetry**

    If you don't have Poetry installed, run:

    ```bash
    pip install poetry
    ```

    or, for the latest recommended installation method:

    ```bash
    curl -sSL https://install.python-poetry.org | python3 -
    ```

2. **Clone Repository**

    ```bash
    git clone https://github.com/rodyherrera/OpenDXA.git
    cd OpenDXA
    ```
3. **Install Dependencies**

    Poetry will automatically create and manage a virtual environment for you. Simply run:

    ```bash
    poetry install
    ```

    This will:
      - Read the pyproject.toml and poetry.lock files.
      - Create a new isolated virtual environment.
      - Install all required packages exactly as pinned in the lockfile.

4. **Activate the Poetry Shell (Optional but Recommended)** 

    To enter the project’s virtual environment and run commands interactively:

    ```bash
    poetry shell

    ```
    You can also skip stepping into the shell and prefix commands with poetry run (see next step).

5. **Run OpenDXA**

    Run OpenDXAFrom inside the Poetry shell (or by prefixing with poetry run), invoke the CLI module:

    ```bash
    python -m opendxa path/to/trajectory.lammpstrj \
        --workers 8 \
        --cutoff 3.5 \
        --use-cna \
        --core-radius 2.0 \
        --max-loop-length 16
    ```

    Or, outside the shell:

    ```bash
    poetry run python -m opendxa path/to/trajectory.lammpstrj \
        --workers 8 \
        --cutoff 3.5 \
        --use-cna \
        --core-radius 2.0 \
        --max-loop-length 16 
      ```
## Command-Line Arguments
| Argument                     | Type             | Default        | Description                                                                                                                                                     |
|------------------------------|------------------|----------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| lammpstrj                    | string           | (required)     | Path to LAMMPS lammpstrj file                                                                                                                                   |
| --workers                    | int              | 4              | Number of parallel workers                                                                                                                                      |
| --defect-threshold           | float            | 0.15           | Threshold for detecting defective atoms                                                                                                                         |
| --smooth-mesh                | bool             | true           | Apply smoothing to interface mesh                                                                                                                               |
| --timestep                   | int              | None           | Specific timestep to analyze (default: first)                                                                                                                   |
| --cutoff                     | float            | 3.5            | Cutoff distance for neighbor search                                                                                                                             |
| --num-neighbors              | int              | 12             | Number of Voronoi neighbors                                                                                                                                     |
| --min-neighbors              | int              | 12             | Min. neighbors for surface filtering                                                                                                                            |
| --voronoi-factor             | float            | 1.5            | Factor to expand cutoff for Voronoi                                                                                                                             |
| --tolerance                  | float            | 0.3            | Tolerance for lattice connectivity matching                                                                                                                     |
| --max-loop-length            | int              | 16             | Max length for Burgers circuit detection                                                                                                                        |
| --burgers-threshold          | float            | 0.0001         | Threshold for Burgers vector módulo                                                                                                                             |
| --orientation-threshold      | float            | 0.1            | Threshold for clustering (PTM/CNA)                                                                                                                              |
| --min-cluster-size           | int              | 5              | Min. atoms for cluster                                                                                                                                          |
| --core-radius                | float            | 2.0            | Radius for core marking (Å)                                                                                                                                     |
| --crystal-type               | string (choices)| None           | Crystal Type (FCC, HCP, BCC, ICO o SC). If not provided, it is inferred.                                                                                     |
| --lattice-parameter          | float            | 4.0            | Lattice parameter (Å)                                                                                                                                           |
| --adaptive-cutoff            | bool             | false          | Enable adaptive cutoff                                                                                                                                          |
| --spacetime-heatmap          | bool             | false          | Constructs and displays a heat map where x-axis is timestep and y-axis is position along z (bins), color indicates how many lines have centroid in that z-range |
| --allow-non-standard-burgers | bool             | true           | Detect non-standard Burgers                                                                                                                                     |
| --validation-tolerance       | float            | 0.35           | Tolerance for Burgers validation                                                                                                                                |
| --ghost-thickness            | float            | 1.5            | Ghost thickness (Å)                                                                                                                                             |
| --output, -o                 | string           | dislocations.json | Output JSON file                                                                                                                                              |
| -v, --verbose                | bool             | false          | Enable verbose logging                                                                                                                                          |
| --use-cna                    | bool             | false          | Use CNA instead of PTM                                                                                                                                          |
| --neighbor-tolerance         | float            | 0.1            | Relative neighbor tolerance                                                                                                                                     |
| --track-dir                  | string           | None           | Directory for JSON tracking                                                                                                                                     |
| --fast-mode                  | bool             | false          | Enable fast mode (skip steps)                                                                                                                                    |
| --max-loops                  | int              | 1000           | Max loops to find                                                                                                                                               |
| --max-connections-per-atom   | int              | 6              | Max connections per atom                                                                                                                                        |
| --loop-timeout               | int              | 60             | Timeout for loops (s)                                                                                                                                           |
| --line-threshold             | float            | 0.1            | Threshold for dislocation lines                                                                                                                                 |
| --include-segments           | bool             | true           | Include segments in JSON                                                                                                                                        |
| --segment-length             | float            | None           | Target segment length (auto)                                                                                                                                    |
| --min-segments               | int              | 5              | Min segments per line                                                                                                                                           |
| --no-segments                | bool             | false          | Do not generate segments (faster)                                                                                                                               |
| --line-smoothing-level       | int              | 3              | Line smoothing level                                                                                                                                            |
| --line-point-interval        | float            | 1.0            | Interval (Å) between points on line                                                                                                                             |
| --run-burgers-histogram      | bool             | false          | Compute and plot Burgers histogram                                                                                                                               |
| --run-voxel-density          | bool             | false          | Compute voxel density                                                                                                                                           |
| --voxel-grid-size            | int[3]           | [10, 10, 10]   | Grid size for voxel density                                                                                                                                     |
| --run-clustering             | bool             | false          | Perform centroid clustering (KMeans)                                                                                                                            |
| --clustering-n-clusters      | int              | 3              | Number of clusters for KMeans                                                                                                                                    |
| --run-tortuosity             | bool             | false          | Compute and plot tortuosity histogram                                                                                                                            |
| --run-orientation            | bool             | false          | Compute and plot orientation histogram                                                                                                                            |
| --run-graph-topology         | bool             | false          | Analyze graph topology                                                                                                                                         |
| --graph-topology-timesteps   | int[]            | None           | List of timesteps for graph topology analysis                                                                                                                   |

### Advanced Options
```bash
python -m opendxa --help  # View all options
```

## Using OpenDXA as a Python Modulo
Below are two example workflows illustrating how to import and use OpenDXA directly from Python code (instead of via the CLI). Each section includes a short explanation and a code snippet.

---

### Running a Dislocation Analysis Programmatically

In this example, we create an `AnalysisConfig` object with the desired parameters (e.g. path to the LAMMPS `lammpstrj` file, number of workers, whether to use CNA or PTM for structure classification, etc.). Then we instantiate `DislocationAnalysis` with that config and call `analysis.run()` to launch the full DXA pipeline.

```python
from opendxa.core.analysis_config import AnalysisConfig
from opendxa.core.engine import DislocationAnalysis

# Build an AnalysisConfig with custom parameters
config = AnalysisConfig(
    lammpstrj='/home/rodyherrera/Desktop/OpenDXA/analysis.lammpstrj',
    workers=2,
    use_cna=False,
    # Add any other flags you need, for example:
    # defect_threshold=0.2,
    # core_radius=1.5,
    # max_loop_length=12,
    # run_voxel_density=True,
    # voxel_grid_size=[20, 20, 10],
    # fast_mode=True,
)

# Instantiate and run the DislocationAnalysis engine
analysis = DislocationAnalysis(config)
analysis.run()
```
We import `AnalysisConfig` and `DislocationAnalysis`. We fill out `AnalysisConfig(...)` with only the parameters we want to change—the rest take default values.
Calling `analysis.run()` executes the full workflow: neighbor finding, classification (PTM or CNA), surface filtering, tessellation, loop finding, Burgers‐vector evaluation, line refinement, and final JSON export.

### Compute Dislocation Centroids and Save to CSV
```python
from opendxa.export import DislocationDataset
from opendxa.analysis import compute_centroids
import numpy as np
import os

DATA_DIR = '/home/rodyherrera/Desktop/OpenDXA/dislocations'
RESULTS_DIR = '/home/rodyherrera/Desktop/OpenDXA/reports'
TABLES_DIR = os.path.join(RESULTS_DIR, 'tables')
os.makedirs(TABLES_DIR, exist_ok=True)

dataset = DislocationDataset(directory=DATA_DIR)
dataset.load_all_timesteps()

# Compute centroids: returns a list of (timestep, ndarray_of_centroids) tuples
print("Computing centroids...")
centroids_list = compute_centroids(dataset.timesteps_data)

# Save each timestep's centroids to CSV
for timestep, centroids in centroids_list:
    csv_filename = os.path.join(TABLES_DIR, f'centroids_t{timestep}.csv')
    np.savetxt(csv_filename, centroids, delimiter=',', header='x,y,z', comments='')
print('Centroids saved to CSV.')
```

Other centroid-related functions:
- **compute_line_lengths(...)**: returns (timestep, length) pairs
- **compute_anisotropy_eigenvalues(...)**: principal eigenvalues of centroid covariance matrix

### Voxel Density & Voxel Line-Length Density
```python
from opendxa.visualization import plot_voxel_density_map, plot_voxel_line_length_map
from opendxa.analysis import voxel_density, voxel_line_length_density
from opendxa.export import DislocationDataset
import os

dataset = DislocationDataset(directory=DATA_DIR)
dataset.load_all_timesteps()

box_bounds = [[0, 30], [0, 30], [0, 10]]
grid_size = (20, 20, 10)

print('Computing voxel density (counts)...')
voxel_counts = voxel_density(
    dataset.timesteps_data,
    grid_size=grid_size,
    box_bounds=box_bounds
)

# Plot and save the central Z-slice of voxel counts
fig1 = plot_voxel_density_map(voxel_counts, grid_size=grid_size, title='Voxel Count')
fig1.savefig(os.path.join(FIGURES_DIR, 'voxel_count.png'))
print("Voxel count plot saved.")

print("Computing voxel line-length density...")
voxel_densities = voxel_line_length_density(
    dataset.timesteps_data,
    grid_size=grid_size,
    box_bounds=box_bounds
)

# Plot & save the central Z-slice of voxel line length density
fig2 = plot_voxel_line_length_map(voxel_densities, axis='z')
fig2.savefig(os.path.join(FIGURES_DIR, 'voxel_line_length.png'))
print('Voxel line length density plot saved.')
```

Additional voxel functions
- **voxel_density(...)** (you can adjust **grid_size**)
- **voxel_line_length_density(...)**
To compute a 3D density histogram, inspect the returned dictionaries

### KMeans Clustering on Centroids
```python
from opendxa.export import DislocationDataset
from opendxa.analysis import cluster_centroids
import numpy as np

dataset = DislocationDataset(directory=DATA_DIR)
dataset.load_all_timesteps()

print('Running KMeans clustering on centroids...')
kmeans_model, all_centroids, cluster_labels = cluster_centroids(
    dataset.timesteps_data,
    n_clusters=3
)

print(f'KMeans inertia: {kmeans_model.inertia_:.3f}')

# Count how many points per cluster
unique_labels, label_counts = np.unique(cluster_labels, return_counts=True)
for label, count in zip(unique_labels, label_counts):
    print(f"  Cluster {label}: {count} points")
```

Other clustering-related utilities
- **compute_persistence_centroids(...)**: for persistent homology of the centroid point cloud
- **compute_anisotropy_eigenvalues(...)**: eigenvalues of covariance

### Tortuosity & Line Length Histograms
```python
from opendxa.analysis import compute_tortuosity, compute_line_lengths
from opendxa.export import DislocationDataset
from opendxa.visualization import plot_histogram
import numpy as np
import os

dataset = DislocationDataset(directory=DATA_DIR)
dataset.load_all_timesteps()

# Compute tortuosity values (real path length / end-to-end distance)
print('Computing tortuosity...')
tortuosity_values = compute_tortuosity(dataset.timesteps_data)

# Plot and save histogram of tortuosity
fig3 = plot_histogram(
    tortuosity_values,
    bins=50,
    title='Tortuosity',
    xlabel='Tortuosity'
)
fig3.savefig(os.path.join(FIGURES_DIR, 'tortuosity_histogram.png'))
print('Tortuosity histogram saved.')

print('Computing line lengths...')
line_lengths_data = compute_line_lengths(dataset.timesteps_data)
lengths = np.array([length for (_, length) in line_lengths_data])

# Plot and save histogram of line lengths
fig4 = plot_histogram(
    lengths,
    bins=50,
    title='Line Lengths',
    xlabel="Length (Å)"
)
fig4.savefig(os.path.join(FIGURES_DIR, 'line_lengths_histogram.png'))
print('Line length histogram saved.')
```
Other shape-analysis functions
- **compute_orientation_azimuth(...) / compute_orientation_spherical(...)**: line orientation distributions
- **segments_to_plane_histogram(...)**: counts of segments lying near specified crystal planes

### Graph-Theoretic Analysis (One Timestep)
```python
from opendxa.analysis import build_dislocation_graph, analyze_graph_topology, compute_graph_spectrum
from opendxa.visualization import plot_networkx_graph
from opendxa.export import DislocationDataset

dataset = DislocationDataset(directory=DATA_DIR)
dataset.load_all_timesteps()

# Pick the first timestep for demonstration
timesteps = dataset.get_timesteps()
first_timestep = timesteps[0]
print(f"Building graph for timestep {first_timestep}...")
dislocs_first = dataset.get_dislocations(first_timestep)

# Build a NetworkX graph where nodes are dislocation IDs and edges connect spatially adjacent lines
graph_first = build_dislocation_graph(dislocs_first)

# Compute basic graph statistics
topology_stats = analyze_graph_topology(graph_first)
laplacian_spectrum = compute_graph_spectrum(graph_first)

print(f"  Components: {topology_stats['num_components']}")
print(f"  Cycles:     {topology_stats['num_cycles']}")
print(f"  Mean degree: {topology_stats['mean_degree']:.3f}")
print(f"  First 5 Laplacian eigenvalues: {laplacian_spectrum[:5]}")

# Visualize and save the XY-projection of the graph
fig5 = plot_networkx_graph(graph_first, title=f"Graph at t={first_timestep}")
fig5.savefig(os.path.join(FIGURES_DIR, f"graph_{first_timestep}.png"))
print(f"Graph for timestep {first_timestep} saved.")
```

Other network functions
- **compute_laplacian_spectrum(...)**: full spectrum (if you passed a NetworkX Graph directly)

### Spacetime Heatmap
```python
from opendxa.export import DislocationDataset
from opendxa.analysis import compute_spacetime_heatmap
from opendxa.visualization import plot_spacetime_heatmap

dataset = DislocationDataset(directory=DATA_DIR)
dataset.load_all_timesteps()

print('Computing spacetime heatmap...')
ts_list, z_bounds, heatmap_matrix = compute_spacetime_heatmap(
    dataset.timesteps_data,
    num_z_bins=50,
    # automatically infers min/max Z
    z_bounds=None
)

fig6 = plot_spacetime_heatmap(ts_list, z_bounds, heatmap_matrix)
fig6.savefig(os.path.join(FIGURES_DIR, 'spacetime_heatmap.png'))
print("Spacetime heatmap saved.")
```
Other heatmap utilities
- You can adjust **num_z_bins** to increase/decrease resolution
- For custom binning, supply a fixed **z_bounds=[z_min, z_max]**

### Tracking Dislocations Across Timesteps
```python
from opendxa.export import DislocationDataset
from opendxa.analysis import track_dislocations

dataset = DislocationDataset(directory=DATA_DIR)
dataset.load_all_timesteps()

print('Tracking dislocations...')
dislocation_tracks = track_dislocations(dataset.timesteps_data)
print(f'  Number of tracks found: {len(dislocation_tracks)}')

# Example: print which timesteps the first track appears in
if dislocation_tracks:
    example_track = dislocation_tracks[0]
    print(f'  Track #0 present at timesteps: {sorted(example_track.keys())}')

```

Other tracking tools
- You may supply a custom tolerance (**tol**) or distance threshold (**dist_tol**) to **track_dislocations(...)**
- To export track data, iterate over **dislocation_tracks** and save per-track CSVs or JSONs

### Visualization & Analysis Tools
| Function Name                      | Description                                                                                                                |
|------------------------------------|----------------------------------------------------------------------------------------------------------------------------|
| **plot_centroids_3d(centroids, burgers_labels=None)** | Create a 3D scatter plot of dislocation centroids, colored by optional Burgers vector labels.                    |
| **plot_dislocation_lines_3d(dislocs, color_by='burgers')** | Plot 3D dislocation lines; lines colored randomly if `color_by='burgers'`, otherwise uniform color.           |
| **plot_networkx_graph(G, title='Dislocation Graph')** | Draw an XY-projection of a NetworkX graph representing dislocation connectivity; nodes and edges plotted.          |
| **plot_spacetime_heatmap(ts, z_bounds, heat)** | Render a 2D heatmap (timestep vs. Z coordinate) showing counts of lines per Z-bin over time.                         |
| **plot_histogram(data, bins=50, title='', xlabel='', ylabel='Frequency')** | Generate a histogram of `data` with specified bin count, title, and axis labels.                                 |
| **plot_burgers_histogram(burgers_hist)** | Create a bar chart of Burgers vector frequencies (keys) vs. counts.                                                      |
| **plot_voxel_density_map(counts, grid_size, title='Voxel Density')** | Display the central Z-slice of a 3D voxel count array as a 2D heatmap; `counts` is a dict mapping voxel→count.    |
| **plot_voxel_line_length_map(densities, axis='z', slice_index=None)** | Show the central slice of line-length density along the specified axis (`x`, `y`, or `z`).                       |
| **compute_anisotropy_eigenvalues(timesteps_data)** | Compute principal eigenvalues (λ₁ ≥ λ₂ ≥ λ₃) of the covariance matrix of all dislocation centroids.                  |
| **compute_laplacian_spectrum(G)** | Return the sorted eigenvalues of the Laplacian matrix of graph `G`.                                                       |
| **compute_burgers_histogram(timesteps_data)** | Build a histogram (dict) of discrete Burgers vector strings → counts across all timesteps; returns (hist, total_loops). |
| **compute_centroids(timesteps_data)** | Compute the centroid of each dislocation line (average of its points) for every timestep; returns a list of (t, centroids_array). |
| **cluster_centroids(timesteps_data, n_clusters=3)** | Run KMeans clustering on all centroids across timesteps; returns (KMeans model, all_centroids_array, labels).        |
| **build_dislocation_graph(dislocs, tol=1e-3)** | Construct a NetworkX graph by rounding each point to grid `tol` and connecting consecutive points of each line.      |
| **analyze_graph_topology(G)** | Compute basic graph‐theoretic metrics: number of connected components, number of cycles, mean node degree, degree distribution. |
| **compute_graph_spectrum(G)** | Compute and return the sorted Laplacian eigenvalues of graph `G`.                                                         |
| **compute_orientation_azimuth(timesteps_data)** | Calculate azimuth angles (φ in degrees) for each dislocation line, using its first-to-last segment in XY plane.    |
| **compute_orientation_spherical(timesteps_data)** | Compute spherical orientation angles (θ, φ) for each segment of every line; returns array of (θ, φ) pairs.          |
| **compute_persistence_centroids(timesteps_data, maxdim=1)** | Perform persistent homology on the point cloud of all centroids; returns persistence diagrams (`dgms`).            |
| **segments_to_plane_histogram(dislocs, plane_normals, angle_tol=5.0)** | Count line segments whose orientation is within `angle_tol` of 90° to each given crystal plane normal.               |
| **compute_spacetime_heatmap(timesteps_data, num_z_bins=50, z_bounds=None)** | Build a 2D array of shape (num_timesteps × num_z_bins) counting centroids per Z-bin for each timestep.               |
| **compute_tortuosity(timesteps_data)** | Calculate tortuosity (actual length / end-to-end distance) for each line across all timesteps; returns list of values. |
| **compute_line_lengths(timesteps_data)** | Compute total geometric length of each dislocation line for every timestep; returns list of (timestep, length).       |
| **voxel_density(timesteps_data, grid_size=(10,10,10), box_bounds=None)** | Bin each line’s centroid into a 3D grid and count how many lines fall in each voxel; returns dict voxel→count.        |
| **voxel_line_length_density(timesteps_data, grid_size=(10,10,10), box_bounds=None)** | Sum line lengths per voxel based on each centroid’s position; returns a 3D NumPy array of length densities.          |
| **track_dislocations(timesteps_data, tol=1e-2, dist_tol=5.0)** | Link dislocations across successive timesteps by matching rounded Burgers vectors and spatial proximity; returns list of track dicts. |

## 🛠️ Development

### Project Structure
```
OpenDXA/
├── opendxa/
│   ├── classification/     # Structure and dislocation classification
│   ├── core/              # Core analysis algorithms
│   ├── export/            # Export and visualization
│   ├── filters/           # Data filtering and preprocessing
│   ├── neighbors/         # Neighbor finding algorithms
│   ├── parser/            # File parsing utilities
│   └── utils/             # Utility functions and CUDA kernels
├── screenshots/           # Documentation images
└── dislocations/         # Example output files
```

## 📄 License

This project is licensed under the GPL-2.0 license License - see the [LICENSE](LICENSE) file for details.

## 📚 Citation

If you use **OpenDXA** in your research, please cite the version you used.  
To cite the latest version, use the **concept DOI** below:

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.15514685.svg)](https://doi.org/10.5281/zenodo.15514685)

```bibtex
@software{opendxa,
  author       = {Rodolfo Herrera Hernández},
  title        = {OpenDXA: Open Source Dislocation Extraction Algorithm},
  year         = {2025},
  publisher    = {Zenodo},
  version      = {1.0.0-beta},
  doi          = {10.5281/zenodo.15514686},
  url          = {https://doi.org/10.5281/zenodo.15514686}
}