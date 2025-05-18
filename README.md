# Open Source Dislocation Extraction Algorithm

OpenDXA is a Python package implementing the Dislocation Extraction Algorithm (DXA) for analyzing LAMMPS trajectory files. It detects crystal structures, filters surface atoms, builds connectivity graphs, computes displacement fields, evaluates Burgers circuits, and reconstructs dislocation lines.

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