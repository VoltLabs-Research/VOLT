# GPU-Accelerated Dislocation Extraction for Atomistic Simulations

![What's DXA?](/screenshots/Whats-DXA.png)

OpenDXA is an open-source Python package that implements a fast, GPU-accelerated version of the Dislocation Extraction Algorithm (DXA) for analyzing crystal defects in atomistic simulations. It is designed to process LAMMPS trajectory files, identify dislocation lines, classify dislocation types, and export results for further visualization or analysis.

## Features

* **Trajectory parsing** with `LammpstrjParser`
* **Neighbor finding** using a hybrid Voronoi + cutoff approach
* **Local structure classification** (PTM + orientation)
* **Surface atom filtering**
* **Connectivity graph construction**
* **Displacement field analysis**
* **Burgers circuit evaluation** on GPU
* **Dislocation line reconstruction**
* **Dislocation type classification** (edge, screw, mixed)
* **Export** to JSON and plotting

## Installation

```bash
pip install opendxa
```

## Usage

```bash
python -m opendxa nanoparticle.lammpstrj --cutoff 3.5 --num-neighbors 12 -o dislocations.json
```

## Workflow Overview
### 1. Trajectory Parsing
The process begins with the LammpstrjParser, which reads atomic positions, box dimensions, and atom IDs from a LAMMPS .lammpstrj file. OpenDXA supports selecting a specific timestep or analyzing the first frame by default.

### 2. Neighbor Detection
Next, atomic neighborhoods are identified using a hybrid strategy that combines a cutoff-based spatial search with a Voronoi-based selection. This is handled by the HybridNeighborFinder class. The cutoff ensures computational efficiency, while Voronoi filtering ensures topological relevance. The result is a dictionary mapping each atom to its list of neighbors, essential for structural analysis.

### 3. Local Structure Classification
With neighbors in hand, the code proceeds to classify the local crystalline structure around each atom using the Polyhedral Template Matching (PTM) method. The PTMLocalClassifier compares each neighborhood against known lattice templates (FCC, BCC, HCP, etc.) by aligning structures via quaternion-based rotation and computing root-mean-square deviation (RMSD). Atoms are assigned both a structural type and an orientation quaternion.

### 4. Surface Atom Filtering
Since surface atoms can distort dislocation identification, a filtering step (SurfaceFilter) removes atoms with too few neighbors or disordered environments. This ensures that only atoms in the bulk contribute to the dislocation analysis.

### 5. Connectivity Graph Construction
Filtered atoms are then used to construct a lattice connectivity graph via the LatticeConnectivityGraph. This graph captures local bonding based on structural alignment and serves as the backbone for identifying topological loops — precursors to dislocation lines.

### 6. Displacement Field Analysis
To quantify lattice distortions, the DisplacementFieldAnalyzer computes displacement vectors for each atom by comparing idealized template neighbor positions to actual neighbor positions. These vectors provide insights into elastic strain and help guide subsequent Burgers circuit analysis.

### 7. Burgers Circuit Evaluation
The central step of dislocation extraction involves evaluating Burgers circuits — closed loops in the connectivity graph that enclose a defect. Using GPU-accelerated CUDA kernels (BurgersCircuitEvaluator), each loop is analyzed to compute its Burgers vector, which indicates the type and magnitude of the dislocation.

### 8. Dislocation Line Reconstruction
The DislocationLineBuilder reconstructs continuous dislocation lines from loops with non-zero Burgers vectors. These lines represent extended defects in the crystal and are key output features.

### 9. Dislocation Type Classification (Edge, Screw, Mixed)
Each dislocation line is classified using the ClassificationEngine by comparing the Burgers vector to the line’s tangent vector. This results in a label: edge, screw, or mixed — crucial for understanding mechanical behavior.

### 10. Export
Finally, the extracted and classified dislocation lines are exported to a JSON file using DislocationExporter. This file can be visualized or post-processed using tools like OVITO or custom analysis scripts.

