#ifndef OPENDXA_LATTICE_H
#define OPENDXA_LATTICE_H

#include <opendxa/includes.hpp>
#include <opendxa/settings.hpp>

#define NUM_CNA_ATOM_TYPES 7

enum CNAAtomType {
	UNDEFINED = 0,
	FCC = 1,
	HCP = 2,
	BCC = 3,
	OTHER = 4,
	SIGMA7_TWIST_UNIT = 5
};

struct NearestNeighborTetrahedron {
	int neighborIndices[3];
	LatticeVector neighborVectors[3];
};

struct NearestNeighborQuad {
	int neighborIndices[4];
	int secondNearestNeighbor;
	LatticeVector neighborVectors[4];
};

struct CrystalLatticeType {
	int numNeighbors;
	LatticeVector const* neighborVectors;
	int numTetrahedra;
	NearestNeighborTetrahedron const* tetrahedra;
	int numQuads;
	NearestNeighborQuad const* quads;
	int neighborBonds[MAX_CRYSTALLINE_ATOM_NEIGHBORS];
};

extern const CrystalLatticeType fccLattice;
extern const LatticeVector shockleyBurgersVectors[12];

extern const CrystalLatticeType hcpLattice;
extern const int hcpBasalPlaneAtoms[6];
extern const int hcpBasalPlaneAtomsReverse[6];
extern const int hcpNonBasalPlaneAtoms[6];

extern const CrystalLatticeType bccLattice;

inline const CrystalLatticeType& latticeTypeFromCNA(CNAAtomType cnaType)
{
	if(cnaType == FCC) return fccLattice;
	else if(cnaType == HCP) return hcpLattice;
	else if(cnaType == BCC) return bccLattice;
	else { DISLOCATIONS_ASSERT_GLOBAL(false); return fccLattice; }
}

#endif 

