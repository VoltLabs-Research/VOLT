# OpenDXA - Open Dislocation Extraction Algorithm

![What's DXA?](/screenshots/Whats-DXA.png)

[![License: GPL v2](https://img.shields.io/badge/License-GPL%20v2-blue.svg)](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)

**OpenDXA** is a high-performance, open-source Python package for extracting, analyzing, and visualizing dislocation lines in atomistic simulations. Built with GPU acceleration and robust algorithms, it provides comprehensive analysis of crystal defects in FCC, BCC, and HCP structures from LAMMPS trajectory files.

## 🚀 Key Features

- **🔍 Advanced Dislocation Detection**: Robust extraction of dislocation lines using hybrid Voronoi-cutoff neighbor finding
- **⚡ GPU Acceleration**: CUDA-accelerated Burgers circuit evaluation for high-performance analysis
- **🔬 Multi-Crystal Support**: Compatible with FCC, BCC, and HCP crystal structures
- **📊 Comprehensive Analysis**: Burgers vector classification, line type determination (edge/screw/mixed)
- **📈 Detailed Export**: JSON export with dislocation segments, statistics, and metadata
- **🎯 Flexible Segmentation**: Configurable dislocation line segmentation for detailed analysis
- **📋 Structure Classification**: PTM-based local structure identification with orientation analysis
- **🔄 Parallel Processing**: Multi-threaded analysis for large-scale simulations

## 📦 Installation

### Quick Install
```bash
git clone https://github.com/rodyherrera/OpenDXA.git
cd OpenDXA
pip install -e .
```

### Dependencies
```bash
pip install numpy scipy matplotlib cupy numba
```

### Virtual Environment (Recommended)
```bash
python -m venv opendxa-env
source opendxa-env/bin/activate  # On Windows: opendxa-env\Scripts\activate
pip install -e .
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