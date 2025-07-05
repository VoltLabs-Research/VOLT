#include <opendxa/core/coordination_structures.h>

namespace OpenDXA{

// Contains the known coordination structures.
CoordinationStructure CoordinationStructures::_coordinationStructures[NUM_COORD_TYPES];

// Contains the known lattice types.
LatticeStructure CoordinationStructures::_latticeStructures[NUM_LATTICE_TYPES];

// Fast sorting function for an array of (bounded) integers.
// Sorts values in descending order.
template<typename iterator>
void bitmapSort(iterator begin, iterator end, int max){
	assert(max <= 32);
	assert(end >= begin);
	int bitarray = 0;
	for(iterator pin = begin; pin != end; ++pin){
		assert(*pin >= 0 && *pin < max);
		bitarray |= 1 << (*pin);
	}

	iterator pout = begin;
	for(int i = max - 1; i >= 0; i--){
		if(bitarray & (1 << i)){
			*pout++ = i;
		}
	}
	assert(pout == end);
}

CoordinationStructures::CoordinationStructures(
	ParticleProperty* structureTypes,
	LatticeStructureType inputCrystalType,
	bool identifyPlanarDefects,
	const SimulationCell& simCell
) : _structureTypes(structureTypes)
	, _inputCrystalType(inputCrystalType)
	, _identifyPlanarDefects(identifyPlanarDefects)
	, _simCell(simCell){}

void CoordinationStructures::generateCellTooSmallError(int dimension){
	static const char* axes[3] = { "X", "Y", "Z" };
	// TODO
}

int CoordinationStructures::getCoordinationNumber() const{
	switch(_inputCrystalType){
		case LATTICE_FCC:
		case LATTICE_HCP:
			return 12;
		case LATTICE_BCC:
			return 14;
		case LATTICE_CUBIC_DIAMOND:
		case LATTICE_HEX_DIAMOND:
			return 16;
		default:
			return 0;
	}
}

double CoordinationStructures::computeLocalCutoff(
	NearestNeighborFinder& neighList,
	const NearestNeighborFinder::Query<MAX_NEIGHBORS>& neighQuery,
	int numNeighbors,
	int coordinationNumber,
	size_t particleIndex,
	int* neighborIndices,
	Vector3* neighborVectors,
	NeighborBondArray& neighborArray
){
	double localScaling = 0;
	double localCutoff = 0;
	
	switch(_inputCrystalType){
		case LATTICE_FCC:
		case LATTICE_HCP:
			for(int neighbor = 0; neighbor < 12; neighbor++){
				localScaling += sqrt(neighQuery.results()[neighbor].distanceSq);
			}
			localScaling /= 12;
			localCutoff = localScaling * (1.0f + sqrt(2.0f)) * 0.5f;
			break;
		case LATTICE_BCC:
			for(int neighbor = 0; neighbor < 8; neighbor++){
				localScaling += sqrt(neighQuery.results()[neighbor].distanceSq);
			}
			localScaling /= 8;
			localCutoff = localScaling / (sqrt(3.0) / 2.0) * 0.5 * (1.0 + sqrt(2.0));
			break;
		case LATTICE_CUBIC_DIAMOND:
		case LATTICE_HEX_DIAMOND: {
			// Generate list of second nearest neighbors
			int outputIndex = 4;
			for(size_t i = 0; i < 4; i++){
				const Vector3& v0 = neighQuery.results()[i].delta;
				neighborVectors[i] = v0;
				neighborIndices[i] = neighQuery.results()[i].index;
				
				NearestNeighborFinder::Query<MAX_NEIGHBORS> neighQuery2(neighList);
				neighQuery2.findNeighbors(neighList.particlePos(neighborIndices[i]));
				if(neighQuery2.results().size() < 4) return 0.0;

				for(size_t j = 0; j < 4; j++){
					Vector3 v = v0 + neighQuery2.results()[j].delta;
					if(neighQuery2.results()[j].index == particleIndex && v.isZero()) continue;
					if(outputIndex == 16) return 0;

					neighborIndices[outputIndex] = neighQuery2.results()[j].index;
					neighborVectors[outputIndex] = v;
					neighborArray.setNeighborBond(i, outputIndex, true);
					outputIndex++;
				}

				if(outputIndex != (i * 3) + 7) return 0;
			}

			// Compute local scale factor
			localScaling = 0;
			for(int neighbor = 4; neighbor< 16; neighbor++){
				localScaling += neighborVectors[neighbor].length();
			}

			localScaling /= 12;
			// 1.2071068 is a geometric constant used to calculate 
			// the local shear radius in diamond-type structures, and is equal to ((1 + sqrt(2)) / 2).
			// That is, it allows to delimit the maximum distance allowed between secondary 
			// neighbors that could still form links coherent with the ideal network.
			localCutoff = localScaling * 1.2071068;
			break;
		}
		default:
			return 0.0;
	}

	double localCutoffSquared = localCutoff * localCutoff;

	switch(_inputCrystalType){
		case LATTICE_FCC:
		case LATTICE_HCP:
		case LATTICE_BCC:
			// Make sure the (N + 1) -th atom is beyond the cutoff radius (if it exists)
			if(numNeighbors > coordinationNumber && neighQuery.results()[coordinationNumber].distanceSq <= localCutoffSquared){
				return 0.0;
			}

			// Compute common neighbor fit-flag array
			for(int ni1 = 0; ni1 < coordinationNumber; ni1++){
				neighborIndices[ni1] = neighQuery.results()[ni1].index;
				neighborVectors[ni1] = neighQuery.results()[ni1].delta;
				neighborArray.setNeighborBond(ni1, ni1, false);
				for(int ni2 = ni1 + 1; ni2 < coordinationNumber; ni2++){
					neighborArray.setNeighborBond(ni1, ni2, (neighQuery.results()[ni1].delta - neighQuery.results()[ni2].delta).squaredLength() <= localCutoffSquared);
				}
			}
			break;
		case LATTICE_CUBIC_DIAMOND:
		case LATTICE_HEX_DIAMOND:
			// Compute common neighbor bit-flag array
			for(int ni1 = 4; ni1 < coordinationNumber; ni1++){
				for(int ni2 = ni1 + 1; ni2 < coordinationNumber; ni2++){
					auto distance = (neighborVectors[ni1] - neighborVectors[ni2]);
					bool isBonded = distance.squaredLength() <= localCutoffSquared;
					neighborArray.setNeighborBond(ni1, ni2, isBonded);
				}
			}
			break;
		default:
			return 0.0;
	}

	return localCutoff;
}

CoordinationStructureType CoordinationStructures::computeCoordinationType(
	const NeighborBondArray& neighborArray,
    int coordinationNumber,
    int* cnaSignatures
){
	CoordinationStructureType coordinationType;

	switch(_inputCrystalType){
		case LATTICE_FCC:
		case LATTICE_HCP: {
			size_t n421 = 0;
			size_t n422 = 0;
			for(size_t neighborIndex = 0; neighborIndex < coordinationNumber; neighborIndex++){
				// Determine number of neighbors the two atoms have in common
				unsigned int commonNeighbors;
				size_t numCommonNeighbors = CommonNeighborAnalysis::findCommonNeighbors(neighborArray, neighborIndex, commonNeighbors, coordinationNumber);
				if(numCommonNeighbors != 4) break;

				// Determine the number of bonds among the common neighbors
				CNAPairBond neighborBonds[MAX_NEIGHBORS * MAX_NEIGHBORS];
				size_t numNeighborBonds = CommonNeighborAnalysis::findNeighborBonds(neighborArray, commonNeighbors, coordinationNumber, neighborBonds);
				if(numNeighborBonds != 2) break;

				// Determine the number of bonds in the longest continuous chain
				size_t maxChainLength = CommonNeighborAnalysis::calcMaxChainLength(neighborBonds, numNeighborBonds);

				if(maxChainLength == 1){
					n421++;
					cnaSignatures[neighborIndex] = 0;
				}else if(maxChainLength == 2){
					n422++;
					cnaSignatures[neighborIndex] = 1;
				}else{
					break;
				}
			}
		
			if(n421 == 12 && (_identifyPlanarDefects || _inputCrystalType == LATTICE_FCC)){
				coordinationType = COORD_FCC;
			}else if(n421 == 6 && n422 == 6 && (_identifyPlanarDefects || _inputCrystalType == LATTICE_HCP)){
				coordinationType = COORD_HCP;
			}else{
				return COORD_OTHER;
			}

			break;
		}
		case LATTICE_BCC: {
			size_t n444 = 0;
			size_t n666 = 0;
			for(size_t neighborIndex = 0; neighborIndex < coordinationNumber; neighborIndex++){
				// Determine number of neighbors the two atoms have in common 
				unsigned int commonNeighbors;
				size_t numCommonNeighbors = CommonNeighborAnalysis::findCommonNeighbors(neighborArray, neighborIndex, commonNeighbors, 14);
				if(numCommonNeighbors != 4 && numCommonNeighbors != 6) break;

				// Determine the number of bonds among the common neighbors
				CNAPairBond neighborBonds[MAX_NEIGHBORS * MAX_NEIGHBORS];
				size_t numNeighborBonds = CommonNeighborAnalysis::findNeighborBonds(neighborArray, commonNeighbors, 14, neighborBonds);
				if(numNeighborBonds != 4 && numNeighborBonds != 6) break;

				// Determine the number of bonds in the longest continuous chain
				size_t maxChainLength = CommonNeighborAnalysis::calcMaxChainLength(neighborBonds, numNeighborBonds);
				if(numCommonNeighbors == 4 && numNeighborBonds == 4 && maxChainLength == 4){
					n444++;
					cnaSignatures[neighborIndex] = 1;
				}else if(numCommonNeighbors == 6 && numNeighborBonds == 6 && maxChainLength == 6){
					n666++;
					cnaSignatures[neighborIndex] = 0;
				}else{
					break;
				}
			}

			if(n666 == 8 && n444 == 6){
				coordinationType = COORD_BCC;
			}else{
				return COORD_OTHER;
			}
			
			break;
		}
		case LATTICE_CUBIC_DIAMOND:
		case LATTICE_HEX_DIAMOND: {
			for(int neighborIndex = 0; neighborIndex < 4; neighborIndex++){
				cnaSignatures[neighborIndex] = 0;
				unsigned int commonNeighbors;
				size_t numCommonNeighbors = CommonNeighborAnalysis::findCommonNeighbors(neighborArray, neighborIndex, commonNeighbors, coordinationNumber);
				if(numCommonNeighbors != 3) return COORD_OTHER;
			}

			int n543 = 0;
			int n544 = 0;
			for(int neighborIndex = 4; neighborIndex < coordinationNumber; neighborIndex++){
				// Determine number of neighbors the two atoms have in common
				unsigned int commonNeighbors;
				size_t numCommonNeighbors = CommonNeighborAnalysis::findCommonNeighbors(neighborArray, neighborIndex, commonNeighbors, coordinationNumber);
				if(numCommonNeighbors != 5) break;

				// Determine the number of bonds among the common neighbors
				CNAPairBond neighborBonds[MAX_NEIGHBORS * MAX_NEIGHBORS];
				size_t numNeighborBonds = CommonNeighborAnalysis::findNeighborBonds(neighborArray, commonNeighbors, coordinationNumber, neighborBonds);
				if(numNeighborBonds != 4) break;

				// Determine the number of bonds in the longest continuous chain
				size_t maxChainLength = CommonNeighborAnalysis::calcMaxChainLength(neighborBonds, numNeighborBonds);
				if(maxChainLength == 3){
					n543++;
					cnaSignatures[neighborIndex] = 1;
				}else if(maxChainLength == 4){
					n544++;
					cnaSignatures[neighborIndex] = 2;
				}else{
					break;
				}
			}

			if(n543 == 12 && (_identifyPlanarDefects || _inputCrystalType == LATTICE_CUBIC_DIAMOND)){
				coordinationType = COORD_CUBIC_DIAMOND;
			}else if(n543 == 6 && n544 == 6 && (_identifyPlanarDefects || _inputCrystalType == LATTICE_HEX_DIAMOND)){
				coordinationType = COORD_HEX_DIAMOND;
			}else{
				return COORD_OTHER;
			}
		}
	}

	return coordinationType;
}

bool CoordinationStructures::findMatchingNeighborPermutation(
	CoordinationStructureType coordinationType,
	int* neighborMapping,
	int* previousMapping,
	int coordinationNumber,
	const int* cnaSignatures,
	const NeighborBondArray& neighborArray
){
	// Find first matching neighbor permutation
	const CoordinationStructure& coordStructure = _coordinationStructures[coordinationType];
	for(;;){
		int ni1 = 0;
		
		while(neighborMapping[ni1] == previousMapping[ni1]){
			ni1++;
			assert(ni1 < coordinationNumber);
		}

		for(; ni1 < coordinationNumber; ni1++){
			int atomNeighborIndex1 = neighborMapping[ni1];
			previousMapping[ni1] = atomNeighborIndex1;
			
			if(cnaSignatures[atomNeighborIndex1] != coordStructure.cnaSignatures[ni1]){
				break;
			}
			
			int ni2;

			for(ni2 = 0; ni2 < ni1; ni2++){
				int atomNeighborIndex2 = neighborMapping[ni2];
				if(neighborArray.neighborBond(atomNeighborIndex1, atomNeighborIndex2) != coordStructure.neighborArray.neighborBond(ni1, ni2)){
					break;
				}
			}

			if(ni2 != ni1) break;
		}

		if(ni1 == coordinationNumber) return true;

		bitmapSort(neighborMapping + ni1 + 1, neighborMapping + coordinationNumber, coordinationNumber);
		if(!std::next_permutation(neighborMapping, neighborMapping + coordinationNumber)){
			assert(false);
			return false;
		}
	}
}

double CoordinationStructures::determineLocalStructure(
	NearestNeighborFinder& neighList, 
	size_t particleIndex,
	std::shared_ptr<ParticleProperty> neighborLists
){
    assert(_structureTypes->getInt(particleIndex) == COORD_OTHER);
    // Construct local neighbor list builder
    NearestNeighborFinder::Query<MAX_NEIGHBORS> neighQuery(neighList);
    // Find N nearest neighbors of current atom
    neighQuery.findNeighbors(neighList.particlePos(particleIndex));
    int numNeighbors = neighQuery.results().size();
    int neighborIndices[MAX_NEIGHBORS];
    Vector3 neighborVectors[MAX_NEIGHBORS];

    // Number of neighbors to analyze
    int coordinationNumber = getCoordinationNumber();

    // Early rejection of under-coordinated atoms
    if(numNeighbors < coordinationNumber) return 0.0;

	NeighborBondArray neighborArray;

	double localCutoff = computeLocalCutoff(
		neighList,
		neighQuery,
		numNeighbors,
		coordinationNumber,
		particleIndex,
		neighborIndices,
		neighborVectors,
		neighborArray
	);

	int cnaSignatures[MAX_NEIGHBORS];
	CoordinationStructureType coordinationType = computeCoordinationType(neighborArray, coordinationNumber, cnaSignatures);

	if(coordinationType == COORD_OTHER) return 0.0;

	// Initialize permutation.
	int neighborMapping[MAX_NEIGHBORS];
	int previousMapping[MAX_NEIGHBORS];
	for(int n = 0; n < coordinationNumber; n++){
		neighborMapping[n] = n;
		previousMapping[n] = -1;
	}

	// Find first matching neighbor permutation.
	bool found = findMatchingNeighborPermutation(
		coordinationType, neighborMapping, previousMapping,
		coordinationNumber, cnaSignatures, neighborArray);

	if(!found) return 0.0;

	// Assign coordination structure type to atom.
	_structureTypes->setInt(particleIndex, coordinationType);

	// Save the atom's neighbor list.
	for(int i = 0; i < coordinationNumber; i++){
		const Vector3& neighborVector = neighborVectors[neighborMapping[i]];
		// Check if neighbor vectors spans more than half of a periodic simulation cell.
		for(size_t dim = 0; dim < 3; dim++){
			if(cell().pbcFlags()[dim]){
				if(std::abs(cell().inverseMatrix().prodrow(neighborVector, dim)) >= double(0.5) + EPSILON){
					CoordinationStructures::generateCellTooSmallError(dim);
				}
			}
		}
		// Set neighbor (centralAtomIndex, neighborListIndex, neighborAtomIndex) (REFACTOR - DUPLICATED CODE STRUCTURE ANALYSIS CPP)
		neighborLists->setIntComponent(particleIndex, i, neighborIndices[neighborMapping[i]]);
	}

	// Determine maximum neighbor distance.
	// Return the local cutoff distance for thread-safe aggregation
	return localCutoff;
}

void CoordinationStructures::initializeFCC(){
	Vector3 fccVec[12] = {
		Vector3( 0.5,  0.5,  0.0),
		Vector3( 0.0,  0.5,  0.5),
		Vector3( 0.5,  0.0,  0.5),
		Vector3(-0.5, -0.5,  0.0),
		Vector3( 0.0, -0.5, -0.5),
		Vector3(-0.5,  0.0, -0.5),
		Vector3(-0.5,  0.5,  0.0),
		Vector3( 0.0, -0.5,  0.5),
		Vector3(-0.5,  0.0,  0.5),
		Vector3( 0.5, -0.5,  0.0),
		Vector3( 0.0,  0.5, -0.5),
		Vector3( 0.5,  0.0, -0.5)
	};

	initializeCoordinationStructure(COORD_FCC, fccVec, 12, [&](const Vector3& v1, const Vector3& v2){
		return (v1 - v2).length() < (sqrt(0.5f) + 1.0) * 0.5;
	}, [](int ni){ return 0; });

	initializeLatticeStructure(LATTICE_FCC, fccVec, 12, &_coordinationStructures[COORD_FCC]);
    _latticeStructures[LATTICE_FCC].primitiveCell.column(0) = Vector3(0.5, 0.5, 0.0);
    _latticeStructures[LATTICE_FCC].primitiveCell.column(1) = Vector3(0.0, 0.5, 0.5);
    _latticeStructures[LATTICE_FCC].primitiveCell.column(2) = Vector3(0.5, 0.0, 0.5);
}

void CoordinationStructures::initializeHCP(){
	Vector3 hcpVec[18] = {
		Vector3(sqrt(2.0)/4.0, -sqrt(6.0)/4.0, 0.0),
		Vector3(-sqrt(2.0)/2.0, 0.0, 0.0),
		Vector3(-sqrt(2.0)/4.0, sqrt(6.0)/12.0, -sqrt(3.0)/3.0),
		Vector3(sqrt(2.0)/4.0, sqrt(6.0)/12.0, -sqrt(3.0)/3.0),
		Vector3(0.0, -sqrt(6.0)/6.0, -sqrt(3.0)/3.0),
		Vector3(-sqrt(2.0)/4.0, sqrt(6.0)/4.0, 0.0),
		Vector3(sqrt(2.0)/4.0, sqrt(6.0)/4.0, 0.0),
		Vector3(sqrt(2.0)/2.0, 0.0, 0.0),
		Vector3(-sqrt(2.0)/4.0, -sqrt(6.0)/4.0, 0.0),
		Vector3(0.0, -sqrt(6.0)/6.0, sqrt(3.0)/3.0),
		Vector3(sqrt(2.0)/4.0, sqrt(6.0)/12.0, sqrt(3.0)/3.0),
		Vector3(-sqrt(2.0)/4.0, sqrt(6.0)/12.0, sqrt(3.0)/3.0),
		Vector3(0.0, sqrt(6.0)/6.0, sqrt(3.0)/3.0),
		Vector3(-sqrt(2.0)/4.0, -sqrt(6.0)/12.0, -sqrt(3.0)/3.0),
		Vector3(sqrt(2.0)/4.0, -sqrt(6.0)/12.0, sqrt(3.0)/3.0),
		Vector3(0.0, sqrt(6.0)/6.0, -sqrt(3.0)/3.0),
		Vector3(sqrt(2.0)/4.0, -sqrt(6.0)/12.0, -sqrt(3.0)/3.0),
		Vector3(-sqrt(2.0)/4.0, -sqrt(6.0)/12.0, sqrt(3.0)/3.0)
	};

	initializeCoordinationStructure(COORD_HCP, hcpVec, 12, [&](const Vector3& v1, const Vector3& v2){
		return (v1 - v2).length() < (sqrt(0.5) + 1.0) * 0.5;
	}, [&](int ni){ return (hcpVec[ni].z() == 0) ? 1 : 0; });

	initializeLatticeStructure(LATTICE_HCP, hcpVec, 18, &_coordinationStructures[COORD_HCP]);
    _latticeStructures[LATTICE_HCP].primitiveCell.column(0) = Vector3(sqrt(0.5)/2, -sqrt(6.0)/4, 0.0);
    _latticeStructures[LATTICE_HCP].primitiveCell.column(1) = Vector3(sqrt(0.5)/2, sqrt(6.0)/4, 0.0);
    _latticeStructures[LATTICE_HCP].primitiveCell.column(2) = Vector3(0.0, 0.0, sqrt(8.0/6.0));
}

void CoordinationStructures::initializeBCC(){
	Vector3 bccVec[14] = {
		Vector3( 0.5,  0.5,  0.5),
		Vector3(-0.5,  0.5,  0.5),
		Vector3( 0.5,  0.5, -0.5),
		Vector3(-0.5, -0.5,  0.5),
		Vector3( 0.5, -0.5,  0.5),
		Vector3(-0.5,  0.5, -0.5),
		Vector3(-0.5, -0.5, -0.5),
		Vector3( 0.5, -0.5, -0.5),
		Vector3( 1.0,  0.0,  0.0),
		Vector3(-1.0,  0.0,  0.0),
		Vector3( 0.0,  1.0,  0.0),
		Vector3( 0.0, -1.0,  0.0),
		Vector3( 0.0,  0.0,  1.0),
		Vector3( 0.0,  0.0, -1.0)
	};

	initializeCoordinationStructure(COORD_BCC, bccVec, 14, [&](const Vector3& v1, const Vector3& v2){
		return (v1 - v2).length() < (double(1) + sqrt(double(2))) * double(0.5);
	}, [](int ni) { return (ni < 8) ? 0 : 1; });

	initializeLatticeStructure(LATTICE_BCC, bccVec, 14, &_coordinationStructures[COORD_BCC]);
    _latticeStructures[LATTICE_BCC].primitiveCell.column(0) = Vector3(1.0, 0.0, 0.0);
    _latticeStructures[LATTICE_BCC].primitiveCell.column(1) = Vector3(0.0, 1.0, 0.0);
    _latticeStructures[LATTICE_BCC].primitiveCell.column(2) = Vector3(0.5, 0.5, 0.5);
}

void CoordinationStructures::initializeCubicDiamond(){
	Vector3 diamondCubicVec[] = {
		Vector3(0.25, 0.25, 0.25),
		Vector3(0.25, -0.25, -0.25),
		Vector3(-0.25, -0.25, 0.25),
		Vector3(-0.25, 0.25, -0.25),

		Vector3(0, -0.5, 0.5),
		Vector3(0.5, 0.5, 0),
		Vector3(-0.5, 0, 0.5),
		Vector3(-0.5, 0.5, 0),
		Vector3(0, 0.5, 0.5),
		Vector3(0.5, -0.5, 0),
		Vector3(0.5, 0, 0.5),
		Vector3(0.5, 0, -0.5),
		Vector3(-0.5, -0.5, 0),
		Vector3(0, -0.5, -0.5),
		Vector3(0, 0.5, -0.5),
		Vector3(-0.5, 0, -0.5),

		Vector3(0.25, -0.25, 0.25),
		Vector3(0.25, 0.25, -0.25),
		Vector3(-0.25, 0.25, 0.25),
		Vector3(-0.25, -0.25, -0.25)
	};

    initializeDiamondStructure(COORD_CUBIC_DIAMOND, LATTICE_CUBIC_DIAMOND, diamondCubicVec, 16, 20);
    
    _latticeStructures[LATTICE_CUBIC_DIAMOND].primitiveCell.column(0) = Vector3(0.5, 0.5, 0.0);
    _latticeStructures[LATTICE_CUBIC_DIAMOND].primitiveCell.column(1) = Vector3(0.0, 0.5, 0.5);
    _latticeStructures[LATTICE_CUBIC_DIAMOND].primitiveCell.column(2) = Vector3(0.5, 0.0, 0.5);
}

void CoordinationStructures::initializeHexagonalDiamond(){
	Vector3 diamondHexVec[] = {
		Vector3(-sqrt(2.0)/4, sqrt(3.0/2.0)/6, -sqrt(3.0)/12),
		Vector3(0, -sqrt(3.0/2.0)/3, -sqrt(3.0)/12),
		Vector3(sqrt(2.0)/4, sqrt(3.0/2.0)/6, -sqrt(3.0)/12),
		Vector3(0, 0, sqrt(3.0)/4),

		Vector3(sqrt(2.0)/4.0, -sqrt(6.0)/4.0, 0.0),
		Vector3(-sqrt(2.0)/2.0, 0.0, 0.0),
		Vector3(-sqrt(2.0)/4.0, sqrt(6.0)/4.0, 0.0),
		Vector3(sqrt(2.0)/4.0, sqrt(6.0)/4.0, 0.0),
		Vector3(sqrt(2.0)/2.0, 0.0, 0.0),
		Vector3(-sqrt(2.0)/4.0, -sqrt(6.0)/4.0, 0.0),
		Vector3(-sqrt(2.0)/4.0, sqrt(6.0)/12.0, -sqrt(3.0)/3.0),
		Vector3(sqrt(2.0)/4.0, sqrt(6.0)/12.0, -sqrt(3.0)/3.0),
		Vector3(0.0, -sqrt(6.0)/6.0, -sqrt(3.0)/3.0),
		Vector3(0.0, -sqrt(6.0)/6.0, sqrt(3.0)/3.0),
		Vector3(sqrt(2.0)/4.0, sqrt(6.0)/12.0, sqrt(3.0)/3.0),
		Vector3(-sqrt(2.0)/4.0, sqrt(6.0)/12.0, sqrt(3.0)/3.0),

		Vector3(-sqrt(2.0)/4, sqrt(3.0/2.0)/6, sqrt(3.0)/12),
		Vector3(0, -sqrt(3.0/2.0)/3, sqrt(3.0)/12),
		Vector3(sqrt(2.0)/4, sqrt(3.0/2.0)/6, sqrt(3.0)/12),
		Vector3(0, 0, -sqrt(3.0)/4),

		Vector3(-sqrt(2.0)/4, -sqrt(3.0/2.0)/6, -sqrt(3.0)/12),
		Vector3(0, sqrt(3.0/2.0)/3, -sqrt(3.0)/12),
		Vector3(sqrt(2.0)/4, -sqrt(3.0/2.0)/6, -sqrt(3.0)/12),

		Vector3(-sqrt(2.0)/4, -sqrt(3.0/2.0)/6, sqrt(3.0)/12),
		Vector3(0, sqrt(3.0/2.0)/3, sqrt(3.0)/12),
		Vector3(sqrt(2.0)/4, -sqrt(3.0/2.0)/6, sqrt(3.0)/12),

		Vector3(0.0, sqrt(6.0)/6.0, sqrt(3.0)/3.0),
		Vector3(-sqrt(2.0)/4.0, -sqrt(6.0)/12.0, -sqrt(3.0)/3.0),
		Vector3(sqrt(2.0)/4.0, -sqrt(6.0)/12.0, sqrt(3.0)/3.0),
		Vector3(0.0, sqrt(6.0)/6.0, -sqrt(3.0)/3.0),
		Vector3(sqrt(2.0)/4.0, -sqrt(6.0)/12.0, -sqrt(3.0)/3.0),
		Vector3(-sqrt(2.0)/4.0, -sqrt(6.0)/12.0, sqrt(3.0)/3.0)
	};

	initializeDiamondStructure(COORD_HEX_DIAMOND, LATTICE_HEX_DIAMOND, diamondHexVec, 16, 32);
    
    _latticeStructures[LATTICE_HEX_DIAMOND].primitiveCell.column(0) = Vector3(sqrt(0.5)/2, -sqrt(6.0)/4, 0.0);
    _latticeStructures[LATTICE_HEX_DIAMOND].primitiveCell.column(1) = Vector3(sqrt(0.5)/2, sqrt(6.0)/4, 0.0);
    _latticeStructures[LATTICE_HEX_DIAMOND].primitiveCell.column(2) = Vector3(0.0, 0.0, sqrt(8.0/6.0));
}

void CoordinationStructures::initializeOther(){
    _coordinationStructures[COORD_OTHER].numNeighbors = 0;
    _latticeStructures[LATTICE_OTHER].coordStructure = &_coordinationStructures[COORD_OTHER];
    _latticeStructures[LATTICE_OTHER].primitiveCell.setZero();
    _latticeStructures[LATTICE_OTHER].primitiveCellInverse.setZero();
    _latticeStructures[LATTICE_OTHER].maxNeighbors = 0;
}

template <typename BondPredicate, typename SignatureFunction>
void CoordinationStructures::initializeCoordinationStructure(
	int coordType,
	const Vector3* vectors,
	int numNeighbors,
	BondPredicate bondPred,
	SignatureFunction sigFunc
){
	_coordinationStructures[coordType].numNeighbors = numNeighbors;
	for(int ni1 = 0; ni1 < numNeighbors; ni1++){
        _coordinationStructures[coordType].neighborArray.setNeighborBond(ni1, ni1, false);
        for(int ni2 = ni1 + 1; ni2 < numNeighbors; ni2++){
            bool bonded = bondPred(vectors[ni1], vectors[ni2]);
            _coordinationStructures[coordType].neighborArray.setNeighborBond(ni1, ni2, bonded);
        }
        _coordinationStructures[coordType].cnaSignatures[ni1] = sigFunc(ni1);
    }
    
    _coordinationStructures[coordType].latticeVectors.assign(vectors, vectors + numNeighbors);
}

void CoordinationStructures::initializeLatticeStructure(
    int latticeType, 
    const Vector3* vectors, 
    int totalVectors,
    CoordinationStructure* coordStruct
){
    _latticeStructures[latticeType].latticeVectors.assign(vectors, vectors + totalVectors);
    _latticeStructures[latticeType].coordStructure = coordStruct;
    _latticeStructures[latticeType].maxNeighbors = coordStruct->numNeighbors;
}

void CoordinationStructures::initializeDiamondStructure(
    int coordType, 
    int latticeType,
    const Vector3* vectors, 
    int numNeighbors, 
    int totalVectors
){
    _coordinationStructures[coordType].numNeighbors = numNeighbors;
    
    for(int ni1 = 0; ni1 < numNeighbors; ni1++){
        _coordinationStructures[coordType].neighborArray.setNeighborBond(ni1, ni1, false);
        double cutoff = (ni1 < 4) ? (sqrt(3.0)*0.25+sqrt(0.5))/2 : (1.0+sqrt(0.5))/2;

        for(int ni2 = ni1 + 1; ni2 < 4; ni2++){
            _coordinationStructures[coordType].neighborArray.setNeighborBond(ni1, ni2, false);
        }

        for(int ni2 = std::max(ni1 + 1, 4); ni2 < numNeighbors; ni2++){
            bool bonded = (vectors[ni1] - vectors[ni2]).length() < cutoff;
            _coordinationStructures[coordType].neighborArray.setNeighborBond(ni1, ni2, bonded);
        }
        
        if(coordType == COORD_HEX_DIAMOND){
            _coordinationStructures[coordType].cnaSignatures[ni1] = 
                (ni1 < 4) ? 0 : ((vectors[ni1].z() == 0) ? 2 : 1);
        }else{
            _coordinationStructures[coordType].cnaSignatures[ni1] = (ni1 < 4) ? 0 : 1;
        }
    }

    _coordinationStructures[coordType].latticeVectors.assign(vectors, vectors + numNeighbors);
    initializeLatticeStructure(latticeType, vectors, totalVectors, &_coordinationStructures[coordType]);
}

void CoordinationStructures::initializeStructures(){
	initializeOther();
	initializeFCC();
	initializeHCP();
	initializeBCC();
	initializeCubicDiamond();
	initializeHexagonalDiamond();

	for(auto coordStruct = std::begin(_coordinationStructures); coordStruct != std::end(_coordinationStructures); ++coordStruct){
		// Find two non-coplanar common neighbors for every neighbor bond.
		for(int neighIndex = 0; neighIndex < coordStruct->numNeighbors; neighIndex++){
			Matrix3 tm;
			tm.column(0) = coordStruct->latticeVectors[neighIndex];
			bool found = false;
			for(int i1 = 0; i1 < coordStruct->numNeighbors && !found; i1++){
				if(!coordStruct->neighborArray.neighborBond(neighIndex, i1)) continue;
				tm.column(1) = coordStruct->latticeVectors[i1];
				for(int i2 = i1 + 1; i2 < coordStruct->numNeighbors; i2++){
					if(!coordStruct->neighborArray.neighborBond(neighIndex, i2)) continue;
					tm.column(2) = coordStruct->latticeVectors[i2];
					if(std::abs(tm.determinant()) > EPSILON){
						coordStruct->commonNeighbors[neighIndex][0] = i1;
						coordStruct->commonNeighbors[neighIndex][1] = i2;
						found = true;
						break;
					}
				}
			}
			assert(found);
		}
	}

	// Generate symmetry information
	for(auto latticeStruct = std::begin(_latticeStructures); latticeStruct != std::end(_latticeStructures); ++latticeStruct){
		if(latticeStruct->latticeVectors.empty()) continue;

		latticeStruct->primitiveCellInverse = latticeStruct->primitiveCell.inverse();

		const CoordinationStructure& coordStruct = *latticeStruct->coordStructure;
		assert(latticeStruct->latticeVectors.size() >= coordStruct.latticeVectors.size());
		assert(coordStruct.latticeVectors.size() == coordStruct.numNeighbors);

		// Find three non-coplanar neighbor vectors.
		int nindices[3];
		Matrix3 tm1;
		int n = 0;
		for(int i = 0; i < coordStruct.numNeighbors && n < 3; i++){
			tm1.column(n) = coordStruct.latticeVectors[i];
			if(n == 1){
				if(tm1.column(0).cross(tm1.column(1)).squaredLength() <= EPSILON) continue;
			}else if(n == 2){
				if(std::abs(tm1.determinant()) <= EPSILON) continue;
			}
			nindices[n++] = i;
		}
		
		assert(n == 3);
		assert(std::abs(tm1.determinant()) > EPSILON);
		Matrix3 tm1inverse = tm1.inverse();

		// Find symmetry permutations.
		std::vector<int> permutation(latticeStruct->latticeVectors.size());
		std::vector<int> lastPermutation(latticeStruct->latticeVectors.size(), -1);
		std::iota(permutation.begin(), permutation.end(), 0);
		SymmetryPermutation symmetryPermutation;

		do{
			int changedFrom = std::mismatch(permutation.begin(), permutation.end(), lastPermutation.begin()).first - permutation.begin();
			assert(changedFrom < coordStruct.numNeighbors);
			std::copy(permutation.begin(), permutation.end(), lastPermutation.begin());

			if(changedFrom <= nindices[2]){
				Matrix3 tm2;
				tm2.column(0) = latticeStruct->latticeVectors[permutation[nindices[0]]];
				tm2.column(1) = latticeStruct->latticeVectors[permutation[nindices[1]]];
				tm2.column(2) = latticeStruct->latticeVectors[permutation[nindices[2]]];
				symmetryPermutation.transformation = tm2 * tm1inverse;

				if(!symmetryPermutation.transformation.isOrthogonalMatrix()){
					bitmapSort(permutation.begin() + nindices[2] + 1, permutation.end(), permutation.size());
					continue;
				}
				changedFrom = 0;
			}
			
			int sortFrom = nindices[2];
			int invalidFrom;

			for(invalidFrom = changedFrom; invalidFrom < coordStruct.numNeighbors; invalidFrom++){
				Vector3 v = symmetryPermutation.transformation * coordStruct.latticeVectors[invalidFrom];
				if(!v.equals(latticeStruct->latticeVectors[permutation[invalidFrom]])) break;
			}

			if(invalidFrom == coordStruct.numNeighbors){
				std::copy(permutation.begin(), permutation.begin() + coordStruct.numNeighbors, symmetryPermutation.permutation.begin());
				for(const auto& entry : latticeStruct->permutations){
					assert(!entry.transformation.equals(symmetryPermutation.transformation));
				}
				latticeStruct->permutations.push_back(symmetryPermutation);
			}else{
				sortFrom = invalidFrom;
			}
			bitmapSort(permutation.begin() + sortFrom + 1, permutation.end(), permutation.size());
		}while(std::next_permutation(permutation.begin(), permutation.end()));

		assert(latticeStruct->permutations.size() >= 1);
		assert(latticeStruct->permutations.front().transformation.equals(Matrix3::Identity()));

		// Determine products of symmetry transformations.
		for(int s1 = 0; s1 < latticeStruct->permutations.size(); s1++){
			for(int s2 = 0; s2 < latticeStruct->permutations.size(); s2++){
				Matrix3 product = latticeStruct->permutations[s2].transformation * latticeStruct->permutations[s1].transformation;
				for(int i = 0; i < latticeStruct->permutations.size(); i++){
					if(latticeStruct->permutations[i].transformation.equals(product)){
						latticeStruct->permutations[s1].product.push_back(i);
						break;
					}
				}

				assert(latticeStruct->permutations[s1].product.size() == s2 + 1);
				Matrix3 inverseProduct = latticeStruct->permutations[s2].transformation.inverse() * latticeStruct->permutations[s1].transformation;
				for(int i = 0; i < latticeStruct->permutations.size(); i++){
					if(latticeStruct->permutations[i].transformation.equals(product)){
						latticeStruct->permutations[s1].inverseProduct.push_back(i);
						break;
					}
				}

				assert(latticeStruct->permutations[s1].inverseProduct.size() == s2 + 1);
			}
		}
	}
}

}