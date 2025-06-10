#include "core/Clustering.hpp"
#include "structures/Lattice.hpp"

// Coordinates of the nearest neighbors in the FCC lattice:
static const LatticeVector fccNeighborVectors[12] = {
	LatticeVector( 1.0/2, 0, 1.0/2),
	LatticeVector( 1.0/2, 1.0/2, 0),
	LatticeVector( 0, 1.0/2, 1.0/2),
	LatticeVector( 1.0/2, 0,-1.0/2),
	LatticeVector( 0, 1.0/2,-1.0/2),
	LatticeVector(-1.0/2, 0,-1.0/2),
	LatticeVector(-1.0/2, 1.0/2, 0),
	LatticeVector(-1.0/2, 0, 1.0/2),
	LatticeVector( 0,-1.0/2, 1.0/2),
	LatticeVector( 1.0/2,-1.0/2, 0),
	LatticeVector( 0,-1.0/2,-1.0/2),
	LatticeVector(-1.0/2,-1.0/2, 0)
};

static const NearestNeighborTetrahedron fccTetrahedra[8] = {
	{{ 0, 1, 2 }, {fccNeighborVectors[0], fccNeighborVectors[1], fccNeighborVectors[2]}},
	{{ 3, 4, 1 }, {fccNeighborVectors[3], fccNeighborVectors[4], fccNeighborVectors[1]}},
	{{ 2, 6, 7 }, {fccNeighborVectors[2], fccNeighborVectors[6], fccNeighborVectors[7]}},
	{{ 4, 5, 6 }, {fccNeighborVectors[4], fccNeighborVectors[5], fccNeighborVectors[6]}},
	{{ 9, 0, 8 }, {fccNeighborVectors[9], fccNeighborVectors[0], fccNeighborVectors[8]}},
	{{ 3, 9, 10 }, {fccNeighborVectors[3], fccNeighborVectors[9], fccNeighborVectors[10]}},
	{{ 10, 11, 5 }, {fccNeighborVectors[10], fccNeighborVectors[11], fccNeighborVectors[5]}},
	{{ 11, 8, 7 }, {fccNeighborVectors[11], fccNeighborVectors[8], fccNeighborVectors[7]}},
};

const CrystalLatticeType fccLattice = {
	12, 
	fccNeighborVectors, 
	8, 
	fccTetrahedra, 
	0, 
	NULL,
	{
		(1<<1) | (1<<2) | (1<<8) | (1<<9),
		(1<<0) | (1<<2) | (1<<3) | (1<<4),
		(1<<0) | (1<<1) | (1<<6) | (1<<7),
		(1<<1) | (1<<9) | (1<<4) | (1<<10),
		(1<<3) | (1<<1) | (1<<5) | (1<<6),
		(1<<4) | (1<<6) | (1<<10) | (1<<11),
		(1<<4) | (1<<5) | (1<<2) | (1<<7),
		(1<<2) | (1<<8) | (1<<6) | (1<<11),
		(1<<0) | (1<<9) | (1<<11) | (1<<7),
		(1<<0) | (1<<8) | (1<<3) | (1<<10),
		(1<<11) | (1<<5) | (1<<9) | (1<<3),
		(1<<10) | (1<<5) | (1<<8) | (1<<7),
	}
};

const LatticeVector shockleyBurgersVectors[12] = {
	// 1/6[-2 -1 -1]
	LatticeVector(-1.0/3,-1.0/6,-1.0/6),
	// 1/6[ 1  2  1]
	LatticeVector( 1.0/6, 1.0/3, 1.0/6),
	// 1/6[-1  1 -2]
	LatticeVector(-1.0/6, 1.0/6,-1.0/3),

	// 1/6[ 1  1 -2]
	LatticeVector( 1.0/6, 1.0/6,-1.0/3),
	// 1/6[-2  1  1]
	LatticeVector(-1.0/3, 1.0/6, 1.0/6),
	// 1/6[-1  2 -1]
	LatticeVector(-1.0/6, 1.0/3,-1.0/6),

	// 1/6[ 2  1 -1]
	LatticeVector( 1.0/3, 1.0/6,-1.0/6),
	// 1/6[ 1  2  1]
	LatticeVector( 1.0/6, 1.0/3, 1.0/6),
	// 1/6[-1  1  2]
	LatticeVector(-1.0/6, 1.0/6, 1.0/3),

	// 1/6[-2  1 -1]
	LatticeVector(-1.0/3, 1.0/6,-1.0/6),
	// 1/6[-1  2  1]
	LatticeVector(-1.0/6, 1.0/3, 1.0/6),
	// 1/6[-1 -1 -2]
	LatticeVector(-1.0/6,-1.0/6,-1.0/3),
};

void DXAClustering::orderFCCAtomNeighbors(InputAtom* atom){
	DISLOCATIONS_ASSERT(atom->isFCC() && atom->numNeighbors == 12);

	// Generate first Thompson tetrahedron.
	// All 4 vertices of a tetrahedron must be neighbors of each other.
	// First vertex is always the central atom. Second vertex is always the first neighbor.
	int tetrahedron[3];
	tetrahedron[0] = 0;

	// Find third vertex.
	for(int i = 1; i < 12; i++) {
		if(atom->neighborBond(0, i)) {
			tetrahedron[1] = i;
			// Find fourth vertex.
			for(int j = i + 1; j < 12; j++) {
				if(atom->neighborBond(j, 0) && atom->neighborBond(j, i)) {
					tetrahedron[2] = j;
					break;
				}
				DISLOCATIONS_ASSERT(j < 11);
			}
			break;
		}
		DISLOCATIONS_ASSERT(i < 11);
	}
	
	Matrix3 tetrahedronMatrix;
	tetrahedronMatrix.column(0) = wrapVector(atom->neighbor(tetrahedron[0])->pos - atom->pos);
	tetrahedronMatrix.column(1) = wrapVector(atom->neighbor(tetrahedron[1])->pos - atom->pos);
	tetrahedronMatrix.column(2) = wrapVector(atom->neighbor(tetrahedron[2])->pos - atom->pos);
	if(tetrahedronMatrix.determinant() < 0.0)
		swap(tetrahedron[1], tetrahedron[2]);

	// Generate three more tetrahedra, which are adjacent to the first one.
	int secondTetrahedra[3][3];
	for(int j=0; j<3; j++) {
		int count = 1;
		secondTetrahedra[j][0] = tetrahedron[j];
		for(int i=0; i<12; i++) {
			if(i == tetrahedron[0] || i == tetrahedron[1] || i == tetrahedron[2]) continue;
			if(atom->neighborBond(tetrahedron[j], i))
				secondTetrahedra[j][count++] = i;
		}
		DISLOCATIONS_ASSERT(count == 3);
		if(Matrix3(
				wrapVector(atom->neighbor(secondTetrahedra[j][0])->pos - atom->pos),
				wrapVector(atom->neighbor(secondTetrahedra[j][1])->pos - atom->pos),
				wrapVector(atom->neighbor(secondTetrahedra[j][2])->pos - atom->pos)).determinant() < 0.0)
			swap(secondTetrahedra[j][1], secondTetrahedra[j][2]);

		DISLOCATIONS_ASSERT(secondTetrahedra[j][0] != secondTetrahedra[j][1]);
		DISLOCATIONS_ASSERT(secondTetrahedra[j][1] != secondTetrahedra[j][2]);
		DISLOCATIONS_ASSERT(secondTetrahedra[j][2] != secondTetrahedra[j][0]);
	}

	int thirdTetrahedra[3][3];
	thirdTetrahedra[0][0] = secondTetrahedra[0][1];
	thirdTetrahedra[0][1] = secondTetrahedra[2][2];
	thirdTetrahedra[1][0] = secondTetrahedra[1][1];
	thirdTetrahedra[1][1] = secondTetrahedra[0][2];
	thirdTetrahedra[2][0] = secondTetrahedra[2][1];
	thirdTetrahedra[2][1] = secondTetrahedra[1][2];

	for(int j=0; j<3; j++) {
		int count = 0;
		DISLOCATIONS_ASSERT(atom->neighborBond(thirdTetrahedra[j][0], thirdTetrahedra[j][1]));
		for(int i=0; i<12; i++) {
			if(atom->neighborBond(i, thirdTetrahedra[j][0]) && atom->neighborBond(i, thirdTetrahedra[j][1])) {
				thirdTetrahedra[j][2] = i;
				count++;
			}
		}
		DISLOCATIONS_ASSERT(count == 1);
	}

	DISLOCATIONS_ASSERT(secondTetrahedra[0][1] == thirdTetrahedra[0][0]);
	DISLOCATIONS_ASSERT(secondTetrahedra[0][2] == thirdTetrahedra[1][1]);
	DISLOCATIONS_ASSERT(secondTetrahedra[1][1] == thirdTetrahedra[1][0]);
	DISLOCATIONS_ASSERT(secondTetrahedra[1][2] == thirdTetrahedra[2][1]);
	DISLOCATIONS_ASSERT(secondTetrahedra[2][1] == thirdTetrahedra[2][0]);
	DISLOCATIONS_ASSERT(secondTetrahedra[2][2] == thirdTetrahedra[0][1]);

	InputAtom* sortedNeighbors[12];
	sortedNeighbors[0] = atom->neighborAtom(tetrahedron[0]);
	sortedNeighbors[1] = atom->neighborAtom(tetrahedron[1]);
	sortedNeighbors[2] = atom->neighborAtom(tetrahedron[2]);
	sortedNeighbors[3] = atom->neighborAtom(secondTetrahedra[1][1]);
	sortedNeighbors[4] = atom->neighborAtom(secondTetrahedra[1][2]);
	sortedNeighbors[5] = atom->neighborAtom(thirdTetrahedra[2][2]);
	sortedNeighbors[6] = atom->neighborAtom(secondTetrahedra[2][1]);
	sortedNeighbors[7] = atom->neighborAtom(secondTetrahedra[2][2]);
	sortedNeighbors[8] = atom->neighborAtom(secondTetrahedra[0][1]);
	sortedNeighbors[9] = atom->neighborAtom(secondTetrahedra[0][2]);
	sortedNeighbors[10] = atom->neighborAtom(thirdTetrahedra[1][2]);
	sortedNeighbors[11] = atom->neighborAtom(thirdTetrahedra[0][2]);
	for(int i = 0; i < 12; i++)
		atom->setNeighbor(i, sortedNeighbors[i]);

	// Set bonds between nearest neighbors.
	memcpy(atom->neighborArray, fccLattice.neighborBonds, sizeof(atom->neighborArray));
}

LatticeOrientation InputAtom::determineTransitionMatrixFCCHCP(int neighborIndex) const{
	const CrystalLatticeType& currentLattice = latticeType();

	// Process each tetrahedron.
	for(int tet = 0; tet < currentLattice.numTetrahedra; tet++) {
		// Get the three neighbors that form the tetrahedron.
		InputAtom* vertices[3];
		LatticeVector latticeVectors[3];
		int v = -1;
		for(int i=0; i<3; i++) {
			if(currentLattice.tetrahedra[tet].neighborIndices[i] == neighborIndex) v = i;
			vertices[i] = neighborAtom(currentLattice.tetrahedra[tet].neighborIndices[i]);
			latticeVectors[i] = latticeOrientation * currentLattice.tetrahedra[tet].neighborVectors[i];
		}
		if(v == -1) continue;

		InputAtom* vertex = vertices[v];
		DISLOCATIONS_ASSERT_GLOBAL(vertex->isFCC() || vertex->isHCP());

		int vother1 = (v+1)%3;
		int vother2 = (v+2)%3;

		DISLOCATIONS_ASSERT(vertex->hasNeighbor(this));
		DISLOCATIONS_ASSERT(vertex->hasNeighbor(vertices[vother1]));
		DISLOCATIONS_ASSERT(vertex->hasNeighbor(vertices[vother2]));

		// Determine lattice orientation of the neighbor atom.
		int neighborTetrahedron[3] = {
				vertex->neighborIndex(this),
				vertex->neighborIndex(vertices[vother2]),
				vertex->neighborIndex(vertices[vother1])
		};
		int match = false;
		LatticeOrientation righttm;
		const CrystalLatticeType& vertexLattice = vertex->latticeType();
		for(int neighbor_tet = 0; neighbor_tet < vertexLattice.numTetrahedra && !match; neighbor_tet++) {
			for(int permutation = 0; permutation < 3; permutation++) {
				if(neighborTetrahedron[0] == vertexLattice.tetrahedra[neighbor_tet].neighborIndices[permutation] &&
					neighborTetrahedron[1] == vertexLattice.tetrahedra[neighbor_tet].neighborIndices[(permutation+1)%3] &&
					neighborTetrahedron[2] == vertexLattice.tetrahedra[neighbor_tet].neighborIndices[(permutation+2)%3]) {
					righttm.column(0) = vertexLattice.tetrahedra[neighbor_tet].neighborVectors[permutation];
					righttm.column(1) = vertexLattice.tetrahedra[neighbor_tet].neighborVectors[(permutation+1)%3];
					righttm.column(2) = vertexLattice.tetrahedra[neighbor_tet].neighborVectors[(permutation+2)%3];
					match = true;
					break;
				}
			}
		}
		DISLOCATIONS_ASSERT_GLOBAL(match);

		LatticeOrientation lefttm(
				-latticeVectors[v],
				latticeVectors[vother2] - latticeVectors[v],
				latticeVectors[vother1] - latticeVectors[v]
			);
		LatticeOrientation transitionTM = lefttm * righttm.inverse();
		DISLOCATIONS_ASSERT_GLOBAL(transitionTM.isRotationMatrix());
		return transitionTM;
	}

	DISLOCATIONS_ASSERT_GLOBAL(false);
	return IDENTITY;
}
