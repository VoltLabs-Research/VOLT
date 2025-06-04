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
### Clone the repository and navigate into it
```bash
git clone https://github.com/rodyherrera/OpenDXA.git
cd OpenDXA
```

### Install all dependencies and create a virtual environment
Poetry will automatically create and manage a venv for you:
```bash
poetry install
```

### Activate the Poetry shell to run local commands
```bash
poetry shell
```

### Run OpenDXA
From inside the Poetry shell (or by prefixing with poetry run), you can invoke the CLI exactly as before. For example:
```
python -m opendxa path/to/trajectory.lammpstrj \
    --workers 8 \
    --cutoff 3.5 \
    --use-cna \
    --core-radius 2.0 \
    --max-loop-length 16
```

## ⚙️ Command Line Options

### Core Parameters
- `lammpstrj` - Path to LAMMPS trajectory file
- `--output`, `-o` - Output JSON file (default: `dislocations.json`)
- `--timestep` - Specific timestep to analyze (default: first)
- `--workers` - Number of parallel workers (default: 4)

### Analysis Configuration
- `--cutoff` - Cutoff distance for neighbor search (default: 3.5)
- `--num-neighbors` - Number of Voronoi neighbors (default: 12)
- `--crystal-type` - Crystal structure type: `fcc`, `bcc`, `hcp`, `auto` (default: `fcc`)
- `--lattice-parameter` - Lattice parameter in Angstroms (default: 4.0)

### Segmentation Options
- `--include-segments` - Include dislocation segments in JSON export (default: True)
- `--segment-length` - Target length for segments (auto-calculated if not set)
- `--min-segments` - Minimum segments per dislocation line (default: 5)
- `--no-segments` - Disable segment generation for faster export

### Performance Options
- `--fast-mode` - Enable fast mode (skips detailed analysis)
- `--max-loops` - Maximum loops to find (default: 1000)
- `--loop-timeout` - Timeout for loop finding in seconds (default: 60)

### Advanced Options
```bash
python -m opendxa --help  # View all options
```

## 📄 Output Format

### JSON Structure
```json
{
  "timestep": 4900,
  "dislocations": [
    {
      "loop_index": 0,
      "type": 0,
      "burgers": [-3.343, -0.651, -12.729],
      "points": [[10.748, 10.748, 0.544], ...],
      "segments": [
        {
          "start": [10.748, 10.748, 0.544],
          "end": [28.548, 10.382, 2.173],
          "length": 18.2,
          "start_index": 0,
          "end_index": 3
        }
      ],
      "segment_count": 8,
      "total_line_length": 145.7,
      "matched_burgers": [0.5, 0.0, 0.5],
      "matched_burgers_str": "1/2[1 0 1]",
      "classification": {
        "crystal_structure": "fcc",
        "dislocation_type": "mixed",
        "family": "perfect",
        "is_standard": true
      }
    }
  ],
  "analysis_metadata": {
    "total_loops": 12,
    "classification_available": true,
    "structure_analysis_available": true
  }
}
```

### Segment Information
Each dislocation can include detailed segment data:
- **start/end**: 3D coordinates of segment endpoints
- **length**: Physical length of the segment
- **start_index/end_index**: Indices in the original points array

## 🔬 Algorithm Workflow

### 1. **Trajectory Parsing**
- Parse LAMMPS `.lammpstrj` files
- Extract atomic positions, box dimensions, and atom IDs
- Support for periodic boundary conditions

### 2. **Neighbor Detection**
- Hybrid Voronoi + cutoff approach
- Efficient spatial search with topological relevance
- Configurable neighbor count and cutoff distance

### 3. **Structure Classification**
- Polyhedral Template Matching (PTM)
- FCC, BCC, HCP structure identification
- Orientation quaternion calculation

### 4. **Surface Filtering**
- Remove surface atoms with insufficient neighbors
- Focus analysis on bulk crystal regions
- Configurable neighbor thresholds

### 5. **Connectivity Analysis**
- Construct lattice connectivity graph
- Identify topological loops
- GPU-accelerated bond evaluation

### 6. **Displacement Field Analysis**
- Compute atomic displacement vectors
- Quantify elastic strain fields
- Guide Burgers circuit analysis

### 7. **Burgers Circuit Evaluation**
- GPU-accelerated CUDA kernels
- Evaluate closed loops for Burgers vectors
- Identify dislocation cores

### 8. **Line Reconstruction**
- Build continuous dislocation lines
- Connect related loop segments
- Generate smooth line representations

### 9. **Classification & Segmentation**
- Classify as edge, screw, or mixed dislocations
- Generate configurable line segments
- Calculate segment statistics

### 10. **Export & Visualization**
- Comprehensive JSON export
- Plotting capabilities
- Integration with visualization tools

## 📊 Examples

### Analyze with Custom Parameters
```bash
python -m opendxa nanoparticle.lammpstrj \
  --cutoff 3.2 \
  --num-neighbors 14 \
  --crystal-type bcc \
  --lattice-parameter 2.87 \
  --segment-length 10.0 \
  --min-segments 3
```

### Fast Analysis for Large Systems
```bash
python -m opendxa large_system.lammpstrj \
  --fast-mode \
  --workers 8 \
  --max-loops 500 \
  --no-segments
```

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