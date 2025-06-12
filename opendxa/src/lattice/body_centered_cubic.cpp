#include <opendxa/core/clustering.hpp>
#include <opendxa/structures/lattice.hpp>

static const LatticeVector bccNeighborVectors[16] = {
	LatticeVector(-1.0/2,-1.0/2,-1.0/2),
	LatticeVector( 1.0/2,-1.0/2,-1.0/2),
	LatticeVector( 1.0/2, 1.0/2,-1.0/2),
	LatticeVector(-1.0/2, 1.0/2,-1.0/2),
	LatticeVector(-1.0/2,-1.0/2, 1.0/2),
	LatticeVector( 1.0/2,-1.0/2, 1.0/2),
	LatticeVector( 1.0/2, 1.0/2, 1.0/2),
	LatticeVector(-1.0/2, 1.0/2, 1.0/2),
	LatticeVector(0, 0, -1.0),
	LatticeVector(0, 0,  1.0),
	LatticeVector(0, -1.0, 0),
	LatticeVector(0,  1.0, 0),
	LatticeVector(-1.0, 0, 0),
	LatticeVector( 1.0, 0, 0),
};

static const NearestNeighborQuad bccQuads[6] = {
	{{ 0, 1, 2, 3 }, 8, {bccNeighborVectors[0], bccNeighborVectors[1], bccNeighborVectors[2], bccNeighborVectors[3]}},
	{{ 0, 4, 5, 1 }, 10, {bccNeighborVectors[0], bccNeighborVectors[4], bccNeighborVectors[5], bccNeighborVectors[1]}},
	{{ 1, 5, 6, 2 }, 13, {bccNeighborVectors[1], bccNeighborVectors[5], bccNeighborVectors[6], bccNeighborVectors[2]}},
	{{ 2, 6, 7, 3 }, 11, {bccNeighborVectors[2], bccNeighborVectors[6], bccNeighborVectors[7], bccNeighborVectors[3]}},
	{{ 3, 7, 4, 0 }, 12, {bccNeighborVectors[3], bccNeighborVectors[7], bccNeighborVectors[4], bccNeighborVectors[0]}},
	{{ 7, 6, 5, 4 }, 9, {bccNeighborVectors[7], bccNeighborVectors[6], bccNeighborVectors[5], bccNeighborVectors[4]}}
};

const CrystalLatticeType bccLattice = { 
	14, 
	bccNeighborVectors, 
	0, 
	NULL, 
	6, 
	bccQuads, 
	{
		(1<<1) | (1<<4) | (1<<3) | (1<<12) | (1<<10) | (1<<8),
		(1<<0) | (1<<5) | (1<<2) | (1<<10) | (1<<13) | (1<<8),
		(1<<1) | (1<<3) | (1<<6) | (1<<13) | (1<<11) | (1<<8),
		(1<<0) | (1<<2) | (1<<7) | (1<<11) | (1<<12) | (1<<8),
		(1<<0) | (1<<5) | (1<<7) | (1<<12) | (1<<10) | (1<<9),
		(1<<4) | (1<<6) | (1<<1) | (1<<10) | (1<<13) | (1<<9),
		(1<<5) | (1<<7) | (1<<2) | (1<<13) | (1<<11) | (1<<9),
		(1<<4) | (1<<6) | (1<<3) | (1<<11) | (1<<12) | (1<<9),
		(1<<0) | (1<<1) | (1<<2) | (1<<3),
		(1<<4) | (1<<5) | (1<<6) | (1<<7),
		(1<<0) | (1<<1) | (1<<5) | (1<<4),
		(1<<2) | (1<<3) | (1<<7) | (1<<6),
		(1<<0) | (1<<3) | (1<<4) | (1<<7),
		(1<<1) | (1<<2) | (1<<5) | (1<<6),
	}
};

void DXAClustering::orderBCCAtomNeighbors(InputAtom* atom){
	DISLOCATIONS_ASSERT(atom->isBCC() && atom->numNeighbors == 14);

	// Find bonds between neighbors.
	int numBonds[14] = { 0 };
	int neighborNeighbors[14][6];
	for(int i=0; i<14; i++){
		for(int j=i+1; j<14; j++){
			if(atom->neighborBond(i, j)){
				DISLOCATIONS_ASSERT(numBonds[i] < 6);
				DISLOCATIONS_ASSERT(numBonds[j] < 6);
				neighborNeighbors[i][numBonds[i]] = j;
				neighborNeighbors[j][numBonds[j]] = i;
				numBonds[i]++;
				numBonds[j]++;
			}
		}
	}

	// Determine indices of the 6 second nearest neighbors.
	int secondNeighbors[6];
	int numSecondNeighbors = 0;
	for(int i=0; i<14; i++) {
		if(numBonds[i] == 4) secondNeighbors[numSecondNeighbors++] = i;
	}
	DISLOCATIONS_ASSERT(numSecondNeighbors == 6);

	// Compile the first quad of nearest neighbors.
	int firstQuad[4];
	firstQuad[0] = neighborNeighbors[secondNeighbors[0]][0];
	if(atom->neighborBond(firstQuad[0], neighborNeighbors[secondNeighbors[0]][1])) {
		firstQuad[1] = neighborNeighbors[secondNeighbors[0]][1];
		if(atom->neighborBond(firstQuad[0], neighborNeighbors[secondNeighbors[0]][2])) {
			firstQuad[2] = neighborNeighbors[secondNeighbors[0]][3];
			firstQuad[3] = neighborNeighbors[secondNeighbors[0]][2];
		}
		else {
			firstQuad[2] = neighborNeighbors[secondNeighbors[0]][2];
			firstQuad[3] = neighborNeighbors[secondNeighbors[0]][3];
		}
	}
	else {
		firstQuad[1] = neighborNeighbors[secondNeighbors[0]][2];
		firstQuad[2] = neighborNeighbors[secondNeighbors[0]][1];
		firstQuad[3] = neighborNeighbors[secondNeighbors[0]][3];
	}
	DISLOCATIONS_ASSERT(atom->neighborBond(firstQuad[0], firstQuad[1]));
	DISLOCATIONS_ASSERT(atom->neighborBond(firstQuad[1], firstQuad[2]));
	DISLOCATIONS_ASSERT(atom->neighborBond(firstQuad[2], firstQuad[3]));
	DISLOCATIONS_ASSERT(atom->neighborBond(firstQuad[3], firstQuad[0]));
	DISLOCATIONS_ASSERT(atom->neighborBond(firstQuad[1], firstQuad[3]) == false);
	DISLOCATIONS_ASSERT(atom->neighborBond(firstQuad[0], firstQuad[2]) == false);

	// Reverse sense of quad if orientation is wrong.
	Matrix3 matrix;
	matrix.column(0) = wrapVector(atom->neighborAtom(firstQuad[0])->pos - atom->pos);
	matrix.column(1) = wrapVector(atom->neighborAtom(firstQuad[1])->pos - atom->pos);
	matrix.column(2) = wrapVector(atom->neighborAtom(firstQuad[2])->pos - atom->pos);
	if(matrix.determinant() < 0.0) {
		swap(firstQuad[0], firstQuad[3]);
		swap(firstQuad[1], firstQuad[2]);
	}

	// Compile secondary quads.
	int secondaryQuads[4][4];
	secondaryQuads[0][0] = firstQuad[1];
	secondaryQuads[0][1] = firstQuad[0];
	secondaryQuads[1][0] = firstQuad[2];
	secondaryQuads[1][1] = firstQuad[1];
	secondaryQuads[2][0] = firstQuad[3];
	secondaryQuads[2][1] = firstQuad[2];
	secondaryQuads[3][0] = firstQuad[0];
	secondaryQuads[3][1] = firstQuad[3];
	int sortedSecondNeighbors[6];
	sortedSecondNeighbors[0] = secondNeighbors[0];
	sortedSecondNeighbors[5] = -1;
	DISLOCATIONS_ASSERT(atom->neighborBond(sortedSecondNeighbors[0], firstQuad[0]));
	DISLOCATIONS_ASSERT(atom->neighborBond(sortedSecondNeighbors[0], firstQuad[1]));
	DISLOCATIONS_ASSERT(atom->neighborBond(sortedSecondNeighbors[0], firstQuad[2]));
	DISLOCATIONS_ASSERT(atom->neighborBond(sortedSecondNeighbors[0], firstQuad[3]));

	for(int i = 1; i < 6; i++) {
		bool foundQuad = false;
		for(int j = 0; j < 4; j++) {
			if(atom->neighborBond(secondNeighbors[i], secondaryQuads[j][0]) && atom->neighborBond(secondNeighbors[i], secondaryQuads[j][1])) {
				sortedSecondNeighbors[j + 1] = secondNeighbors[i];
				for(int k = 0; k < 4; k++) {
					int n = neighborNeighbors[secondNeighbors[i]][k];
					if(n != secondaryQuads[j][0] && atom->neighborBond(secondaryQuads[j][1], n))
						secondaryQuads[j][2] = n;
					if(n != secondaryQuads[j][1] && atom->neighborBond(secondaryQuads[j][0], n))
						secondaryQuads[j][3] = n;
				}
				foundQuad = true;
				break;
			}
		}
		if(!foundQuad) {
			DISLOCATIONS_ASSERT(sortedSecondNeighbors[5] == -1);
			sortedSecondNeighbors[5] = secondNeighbors[i];
		}
	}

	DISLOCATIONS_ASSERT(secondaryQuads[0][2] == secondaryQuads[3][3]);
	DISLOCATIONS_ASSERT(secondaryQuads[0][3] == secondaryQuads[1][2]);
	DISLOCATIONS_ASSERT(secondaryQuads[1][3] == secondaryQuads[2][2]);
	DISLOCATIONS_ASSERT(secondaryQuads[2][3] == secondaryQuads[3][2]);

	DISLOCATIONS_ASSERT(atom->neighborBond(secondaryQuads[1][0], secondaryQuads[2][0]));
	DISLOCATIONS_ASSERT(atom->neighborBond(secondaryQuads[1][0], secondaryQuads[3][1]));
	DISLOCATIONS_ASSERT(atom->neighborBond(secondaryQuads[1][3], secondaryQuads[3][2]));
	DISLOCATIONS_ASSERT(atom->neighborBond(secondaryQuads[1][3], secondaryQuads[2][3]));

	DISLOCATIONS_ASSERT(atom->neighborBond(secondaryQuads[0][3], sortedSecondNeighbors[5]));
	DISLOCATIONS_ASSERT(atom->neighborBond(secondaryQuads[1][3], sortedSecondNeighbors[5]));
	DISLOCATIONS_ASSERT(atom->neighborBond(secondaryQuads[2][3], sortedSecondNeighbors[5]));
	DISLOCATIONS_ASSERT(atom->neighborBond(secondaryQuads[3][3], sortedSecondNeighbors[5]));

	InputAtom* sortedNeighbors[14];
	sortedNeighbors[0]  = atom->neighborAtom(firstQuad[0]);
	sortedNeighbors[1]  = atom->neighborAtom(firstQuad[1]);
	sortedNeighbors[2]  = atom->neighborAtom(firstQuad[2]);
	sortedNeighbors[3]  = atom->neighborAtom(firstQuad[3]);
	sortedNeighbors[4]  = atom->neighborAtom(secondaryQuads[0][2]);
	sortedNeighbors[5]  = atom->neighborAtom(secondaryQuads[1][2]);
	sortedNeighbors[6]  = atom->neighborAtom(secondaryQuads[2][2]);
	sortedNeighbors[7]  = atom->neighborAtom(secondaryQuads[3][2]);
	sortedNeighbors[8]  = atom->neighborAtom(sortedSecondNeighbors[0]);
	sortedNeighbors[9]  = atom->neighborAtom(sortedSecondNeighbors[5]);
	sortedNeighbors[10] = atom->neighborAtom(sortedSecondNeighbors[1]);
	sortedNeighbors[11] = atom->neighborAtom(sortedSecondNeighbors[3]);
	sortedNeighbors[12] = atom->neighborAtom(sortedSecondNeighbors[4]);
	sortedNeighbors[13] = atom->neighborAtom(sortedSecondNeighbors[2]);
	for(int i = 0; i < 14; i++)
		atom->setNeighbor(i, sortedNeighbors[i]);

	memcpy(atom->neighborArray, bccLattice.neighborBonds, sizeof(atom->neighborArray));
}

LatticeOrientation InputAtom::determineTransitionMatrixBCC(int neighborIndex) const{
	DISLOCATIONS_ASSERT_GLOBAL(neighborIndex < 8);
	InputAtom* vertex = neighborAtom(neighborIndex);
	DISLOCATIONS_ASSERT_GLOBAL(vertex->isBCC());

	// Find two other nearest neighbors, which are second nearest neighbors of the first one.
	int nn2, nn3;
	for(nn2 = 0; nn2 < 8; nn2++) {
		if(neighborBond(neighborIndex, nn2) == true)
			break;
	}
	for(nn3 = 0; nn3 < 8; nn3++) {
		if(nn3 != nn2 && neighborBond(neighborIndex, nn3) == true)
			break;
	}
	DISLOCATIONS_ASSERT_GLOBAL(nn2 < 8 && nn3 < 8);

	DISLOCATIONS_ASSERT_GLOBAL(vertex->hasNeighbor(this));
	DISLOCATIONS_ASSERT_GLOBAL(vertex->hasNeighbor(neighborAtom(nn2)));
	DISLOCATIONS_ASSERT_GLOBAL(vertex->hasNeighbor(neighborAtom(nn3)));

	// Determine the indices of the current atom and the second and third neighbor in the neighbor list of the vertex.
	int vnn1 = vertex->neighborIndex(this);
	int vnn2 = vertex->neighborIndex(neighborAtom(nn2));
	int vnn3 = vertex->neighborIndex(neighborAtom(nn3));
	DISLOCATIONS_ASSERT_GLOBAL(vnn1 < 8 && vnn2 >= 8 && vnn2 < 14 && vnn3 >= 8 && vnn3 < 14);

	LatticeOrientation righttm;
	LatticeOrientation lefttm;

	righttm.column(0) = -bccLattice.neighborVectors[vnn1];
	righttm.column(1) =  bccLattice.neighborVectors[vnn2] - bccLattice.neighborVectors[vnn1];
	righttm.column(2) =  bccLattice.neighborVectors[vnn3] - bccLattice.neighborVectors[vnn1];

	lefttm.column(0) = this->latticeOrientation * bccLattice.neighborVectors[neighborIndex];
	lefttm.column(1) = this->latticeOrientation * bccLattice.neighborVectors[nn2];
	lefttm.column(2) = this->latticeOrientation * bccLattice.neighborVectors[nn3];

	LatticeOrientation transitionTM = lefttm * righttm.inverse();
	DISLOCATIONS_ASSERT_GLOBAL(transitionTM.isRotationMatrix());
	return transitionTM;
}
