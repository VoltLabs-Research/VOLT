#include <opendxa/core/Clustering.hpp>
#include <opendxa/structures/Lattice.hpp>

static const LatticeVector hcpNeighborVectors[12] = {
	LatticeVector( 1.0/2, 0, 1.0/2),
	LatticeVector( 1.0/2, 1.0/2, 0),
	LatticeVector( 0, 1.0/2, 1.0/2),
	LatticeVector(-1.0/2, 1.0/2, 0),
	LatticeVector( 0, 1.0/2,-1.0/2),
	LatticeVector( 1.0/2, 0,-1.0/2),
	LatticeVector( 1.0/2,-1.0/2, 0),
	LatticeVector(-1.0/2, 0, 1.0/2),
	LatticeVector( 0,-1.0/2, 1.0/2),
	LatticeVector(-1.0/6, -(1.0*2)/3, -1.0/6),
	LatticeVector(-(1.0*2)/3, -1.0/6, -1.0/6),
	LatticeVector(-1.0/6, -1.0/6, -(1.0*2)/3)
};

static const NearestNeighborTetrahedron hcpTetrahedra[8] = {
	{{ 0, 1, 2 }, {hcpNeighborVectors[0], hcpNeighborVectors[1], hcpNeighborVectors[2]}},
	{{ 6, 0, 8 }, {hcpNeighborVectors[6], hcpNeighborVectors[0], hcpNeighborVectors[8]}},
	{{ 7, 2, 3 }, {hcpNeighborVectors[7], hcpNeighborVectors[2], hcpNeighborVectors[3]}},
	{{ 4, 1, 5 }, {hcpNeighborVectors[4], hcpNeighborVectors[1], hcpNeighborVectors[5]}},
	{{ 8, 9, 6 }, {hcpNeighborVectors[8], hcpNeighborVectors[9], hcpNeighborVectors[6]}},
	{{ 3, 10, 7 }, {hcpNeighborVectors[3], hcpNeighborVectors[10], hcpNeighborVectors[7]}},
	{{ 5, 11, 4 }, {hcpNeighborVectors[5], hcpNeighborVectors[11], hcpNeighborVectors[4]}},
	{{ 11, 9, 10 }, {hcpNeighborVectors[11], hcpNeighborVectors[9], hcpNeighborVectors[10]}}
};

const CrystalLatticeType hcpLattice = {
	12, 
	hcpNeighborVectors, 
	8, 
	hcpTetrahedra,
	0,
	NULL,
	{
		(1<<2) | (1<<1) | (1<<6) | (1<<8),
		(1<<0) | (1<<2) | (1<<4) | (1<<5),
		(1<<0) | (1<<1) | (1<<7) | (1<<3),
		(1<<7) | (1<<4) | (1<<2) | (1<<10),
		(1<<3) | (1<<5) | (1<<1) | (1<<11),
		(1<<4) | (1<<6) | (1<<1) | (1<<11),
		(1<<8) | (1<<5) | (1<<0) | (1<<9),
		(1<<8) | (1<<3) | (1<<2) | (1<<10),
		(1<<6) | (1<<7) | (1<<0) | (1<<9),
		(1<<10) | (1<<11) | (1<<6) | (1<<8),
		(1<<9) | (1<<11) | (1<<7) | (1<<3),
		(1<<9) | (1<<10) | (1<<4) | (1<<5),
	}
};

const int hcpBasalPlaneAtoms[6] = { 6, 8, 7, 3, 4, 5 };
const int hcpBasalPlaneAtomsReverse[6] = { 5, 4, 3, 7, 8, 6 };
const int hcpNonBasalPlaneAtoms[6] = { 0, 1, 2, 9, 10, 11 };

void DXAClustering::orderHCPAtomNeighbors(InputAtom* atom){
	DISLOCATIONS_ASSERT(atom->isHCP() && atom->numNeighbors == 12);

	int nedges0 = 0;
	int nedges2 = 0;
	int edges0[3][2];
	int edges2[3][2];

	// Determine basal plane atoms of HCP atom.
	for(int i=0; i<12; i++) {
		for(int j=i+1; j<12; j++) {
			if(atom->neighborBond(i,j) == false) continue;

			int numCommonNeighbors = 0;
			for(int k = 0; k < 12; k++) {
				if(k == i || k == j) continue;
				if(atom->neighborBond(i,k) && atom->neighborBond(j,k))
					numCommonNeighbors++;
			}
			DISLOCATIONS_ASSERT(numCommonNeighbors <= 2);
			if(numCommonNeighbors == 0) {
				edges0[nedges0][0] = i;
				edges0[nedges0][1] = j;
				nedges0++;
			}
			else if(numCommonNeighbors == 2) {
				edges2[nedges2][0] = i;
				edges2[nedges2][1] = j;
				nedges2++;
			}
		}
	}

	DISLOCATIONS_ASSERT(nedges0 == 3);
	DISLOCATIONS_ASSERT(nedges2 == 3);

	// Sort basal plane edges.
	for(int i=0; i<2; i++) {
		for(int e=i; e<3; e++) {
			if(edges0[e][0] == edges2[i][1]) {
				if(i != e) {
					swap(edges0[e][0], edges0[i][0]);
					swap(edges0[e][1], edges0[i][1]);
				}
				break;
			}
			else if(edges0[e][1] == edges2[i][1]) {
				swap(edges0[e][0], edges0[i][1]);
				if(i != e)
					swap(edges0[e][1], edges0[i][0]);
				break;
			}
		}
		DISLOCATIONS_ASSERT(edges0[i][0] == edges2[i][1]);
		for(int e=i+1; e<3; e++) {
			if(edges2[e][0] == edges0[i][1]) {
				if(i+1 != e) {
					swap(edges2[e][0], edges2[i+1][0]);
					swap(edges2[e][1], edges2[i+1][1]);
				}
				break;
			}
			else if(edges2[e][1] == edges0[i][1]) {
				swap(edges2[e][0], edges2[i+1][1]);
				if(i+1 != e)
					swap(edges2[e][1], edges2[i+1][0]);
				break;
			}
		}
		DISLOCATIONS_ASSERT(edges0[i][1] == edges2[i+1][0]);
	}
	if(edges0[2][1] == edges2[2][1])
		swap(edges0[2][0], edges0[2][1]);
	DISLOCATIONS_ASSERT(atom->neighborBond(edges2[0][0],edges2[0][1]));
	DISLOCATIONS_ASSERT(atom->neighborBond(edges2[1][0],edges2[1][1]));
	DISLOCATIONS_ASSERT(atom->neighborBond(edges2[2][0],edges2[2][1]));
	DISLOCATIONS_ASSERT(atom->neighborBond(edges0[0][0],edges0[0][1]));
	DISLOCATIONS_ASSERT(atom->neighborBond(edges0[1][0],edges0[1][1]));
	DISLOCATIONS_ASSERT(atom->neighborBond(edges0[2][0],edges0[2][1]));
	DISLOCATIONS_ASSERT(edges0[0][0] == edges2[0][1]);
	DISLOCATIONS_ASSERT(edges2[1][0] == edges0[0][1]);
	DISLOCATIONS_ASSERT(edges0[1][0] == edges2[1][1]);
	DISLOCATIONS_ASSERT(edges2[2][0] == edges0[1][1]);
	DISLOCATIONS_ASSERT(edges0[2][0] == edges2[2][1]);
	DISLOCATIONS_ASSERT(edges2[0][0] == edges0[2][1]);

	// Assign out-of-plane neighbors.
	int outofplane[3][2];
	for(int e=0; e<3; e++) {
		int num = 0;
		for(int i=0; i<12; i++) {
			if(atom->neighborBond(i,edges2[e][0]) && atom->neighborBond(i,edges2[e][1])) {
				if(e == 0) {
					if(Matrix3(
							wrapVector(atom->neighborAtom(edges2[0][0])->pos - atom->pos),
							wrapVector(atom->neighborAtom(i)->pos - atom->pos),
							wrapVector(atom->neighborAtom(edges2[0][1])->pos - atom->pos)).determinant() > 0.0)
						outofplane[e][0] = i;
					else
						outofplane[e][1] = i;
				}
				else {
					if(atom->neighborBond(i,outofplane[0][0]))
						outofplane[e][0] = i;
					else
						outofplane[e][1] = i;
				}
				num++;
			}
		}
		DISLOCATIONS_ASSERT(num == 2);
	}

	// Sort neighbors into fixed order.
	InputAtom* sortedNeighbors[12];
	sortedNeighbors[0] = atom->neighborAtom(outofplane[0][0]);
	sortedNeighbors[1] = atom->neighborAtom(outofplane[2][0]);
	sortedNeighbors[2] = atom->neighborAtom(outofplane[1][0]);
	sortedNeighbors[3] = atom->neighborAtom(edges2[1][1]);
	sortedNeighbors[4] = atom->neighborAtom(edges2[2][0]);
	sortedNeighbors[5] = atom->neighborAtom(edges2[2][1]);
	sortedNeighbors[6] = atom->neighborAtom(edges2[0][0]);
	sortedNeighbors[7] = atom->neighborAtom(edges2[1][0]);
	sortedNeighbors[8] = atom->neighborAtom(edges2[0][1]);
	sortedNeighbors[9] = atom->neighborAtom(outofplane[0][1]);
	sortedNeighbors[10] = atom->neighborAtom(outofplane[1][1]);
	sortedNeighbors[11] = atom->neighborAtom(outofplane[2][1]);
	for(int i = 0; i < 12; i++)
		atom->setNeighbor(i, sortedNeighbors[i]);
	memcpy(atom->neighborArray, hcpLattice.neighborBonds, sizeof(atom->neighborArray));
}
