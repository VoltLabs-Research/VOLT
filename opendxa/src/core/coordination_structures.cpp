#include <opendxa/core/coordination_structures.h>

namespace OpenDXA{

// Contains the known coordination structures.
CoordinationStructure CoordinationStructures::_coordinationStructures[NUM_COORD_TYPES];

// Contains the known lattice types.
LatticeStructure CoordinationStructures::_latticeStructures[NUM_LATTICE_TYPES];

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
	const NearestNeighborFinder& neighList, 
	const NearestNeighborFinder::Query<MAX_NEIGHBORS>& neighQuery,
	int numNeighbors,
	int coordinationNumber,
	size_t particleIndex,
	int* neighborIndices,
	Vector3* neighborVectors,
	NeighborBondArray& neighborArray
) const { 
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

double CoordinationStructures::determineLocalStructure(
	const NearestNeighborFinder& neighList, 
	size_t particleIndex,
	std::shared_ptr<ParticleProperty> neighborLists
) const { 
    std::vector<int> neighborIndices(MAX_NEIGHBORS);
    std::vector<Vector3> neighborVectors(MAX_NEIGHBORS);
    NeighborBondArray neighborArray;
    std::vector<int> cnaSignatures(MAX_NEIGHBORS);
    std::vector<int> neighborMapping(MAX_NEIGHBORS);
    std::vector<int> previousMapping(MAX_NEIGHBORS);

    assert(_structureTypes->getInt(particleIndex) == COORD_OTHER);
    
    NearestNeighborFinder::Query<MAX_NEIGHBORS> neighQuery(neighList);
    neighQuery.findNeighbors(neighList.particlePos(particleIndex));
    
    int numNeighbors = neighQuery.results().size();
    int coordinationNumber = getCoordinationNumber();

    if(numNeighbors < coordinationNumber) return 0.0;

	double localCutoff = computeLocalCutoff(
		neighList, neighQuery, numNeighbors, coordinationNumber,
		particleIndex, 
        neighborIndices.data(), 
        neighborVectors.data(), 
        neighborArray
	);

    if (localCutoff == 0.0) return 0.0;

	CoordinationStructureType coordinationType = CommonNeighborAnalysis::computeCoordinationType(
		neighborArray, coordinationNumber, cnaSignatures.data(),
		_inputCrystalType, _identifyPlanarDefects);

	if(coordinationType == COORD_OTHER) return 0.0;

	for(int n = 0; n < coordinationNumber; n++){
		neighborMapping[n] = n;
		previousMapping[n] = -1;
	}

	bool found = CommonNeighborAnalysis::findMatchingNeighborPermutation(
		coordinationType, neighborMapping.data(), previousMapping.data(),
		coordinationNumber, cnaSignatures.data(), neighborArray, _coordinationStructures);

	if(!found) return 0.0;

	_structureTypes->setInt(particleIndex, coordinationType);

	for(int i = 0; i < coordinationNumber; i++){
		const Vector3& neighborVector = neighborVectors[neighborMapping[i]];
		for(size_t dim = 0; dim < 3; dim++){
			if(cell().pbcFlags()[dim]){
				if(std::abs(cell().inverseMatrix().prodrow(neighborVector, dim)) >= 0.5 + EPSILON){
					generateCellTooSmallError(dim);
				}
			}
		}
		neighborLists->setIntComponent(particleIndex, i, neighborIndices[neighborMapping[i]]);
	}

	return localCutoff;
}

void CoordinationStructures::initializeFCC(){
	initializeCoordinationStructure(COORD_FCC, FCC_VECTORS, 12, [&](const Vector3& v1, const Vector3& v2){
		return (v1 - v2).length() < (sqrt(0.5f) + 1.0) * 0.5;
	}, [](int ni){ return 0; });

	initializeLatticeStructure(LATTICE_FCC, FCC_VECTORS, 12, &_coordinationStructures[COORD_FCC]);
    _latticeStructures[LATTICE_FCC].primitiveCell.column(0) = FCC_PRIMITIVE_CELL[0];
    _latticeStructures[LATTICE_FCC].primitiveCell.column(1) = FCC_PRIMITIVE_CELL[1];
    _latticeStructures[LATTICE_FCC].primitiveCell.column(2) = FCC_PRIMITIVE_CELL[2];
}

void CoordinationStructures::initializeHCP(){
	initializeCoordinationStructure(COORD_HCP, HCP_VECTORS, 12, [&](const Vector3& v1, const Vector3& v2){
		return (v1 - v2).length() < (sqrt(0.5) + 1.0) * 0.5;
	}, [&](int ni){ return (HCP_VECTORS[ni].z() == 0) ? 1 : 0; });

	initializeLatticeStructure(LATTICE_HCP, HCP_VECTORS, 18, &_coordinationStructures[COORD_HCP]);
    _latticeStructures[LATTICE_HCP].primitiveCell.column(0) = HCP_PRIMITIVE_CELL[0];
    _latticeStructures[LATTICE_HCP].primitiveCell.column(1) = HCP_PRIMITIVE_CELL[1];
    _latticeStructures[LATTICE_HCP].primitiveCell.column(2) = HCP_PRIMITIVE_CELL[2];
}

void CoordinationStructures::initializeBCC(){
	initializeCoordinationStructure(COORD_BCC, BCC_VECTORS, 14, [&](const Vector3& v1, const Vector3& v2){
		return (v1 - v2).length() < (double(1) + sqrt(double(2))) * double(0.5);
	}, [](int ni) { return (ni < 8) ? 0 : 1; });

	initializeLatticeStructure(LATTICE_BCC, BCC_VECTORS, 14, &_coordinationStructures[COORD_BCC]);
    _latticeStructures[LATTICE_BCC].primitiveCell.column(0) = BCC_PRIMITIVE_CELL[0];
    _latticeStructures[LATTICE_BCC].primitiveCell.column(1) = BCC_PRIMITIVE_CELL[1];
    _latticeStructures[LATTICE_BCC].primitiveCell.column(2) = BCC_PRIMITIVE_CELL[2];
}

void CoordinationStructures::initializeCubicDiamond(){
    initializeDiamondStructure(COORD_CUBIC_DIAMOND, LATTICE_CUBIC_DIAMOND, DIAMOND_CUBIC_VECTORS, 16, 20);
    
    _latticeStructures[LATTICE_CUBIC_DIAMOND].primitiveCell.column(0) = CUBIC_DIAMOND_PRIMITIVE_CELL[0];
    _latticeStructures[LATTICE_CUBIC_DIAMOND].primitiveCell.column(1) = CUBIC_DIAMOND_PRIMITIVE_CELL[1];
    _latticeStructures[LATTICE_CUBIC_DIAMOND].primitiveCell.column(2) = CUBIC_DIAMOND_PRIMITIVE_CELL[2];
}

void CoordinationStructures::initializeHexagonalDiamond(){
	initializeDiamondStructure(COORD_HEX_DIAMOND, LATTICE_HEX_DIAMOND, DIAMOND_HEX_VECTORS, 16, 32);
    
    _latticeStructures[LATTICE_HEX_DIAMOND].primitiveCell.column(0) = HEXAGONAL_DIAMOND_PRIMITIVE_CELL[0];
    _latticeStructures[LATTICE_HEX_DIAMOND].primitiveCell.column(1) = HEXAGONAL_DIAMOND_PRIMITIVE_CELL[1];
    _latticeStructures[LATTICE_HEX_DIAMOND].primitiveCell.column(2) = HEXAGONAL_DIAMOND_PRIMITIVE_CELL[2];
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

void CoordinationStructures::initializeCommonNeighbors(){
	for(auto coordStruct = std::begin(_coordinationStructures); coordStruct != std::end(_coordinationStructures); ++coordStruct){
		for(int neighborIndex = 0; neighborIndex < coordStruct->numNeighbors; neighborIndex++){
			findCommonNeighborsForBond(*coordStruct, neighborIndex);
		}
	}
}

void CoordinationStructures::findCommonNeighborsForBond(CoordinationStructure& coordStruct, int neighborIndex){
	Matrix3 tm;
	tm.column(0) = coordStruct.latticeVectors[neighborIndex];
    bool found = false;

    for(int i1 = 0; i1 < coordStruct.numNeighbors && !found; i1++){
        if(!coordStruct.neighborArray.neighborBond(neighborIndex, i1)) continue;
        tm.column(1) = coordStruct.latticeVectors[i1];
        
        for(int i2 = i1 + 1; i2 < coordStruct.numNeighbors; i2++){
            if(!coordStruct.neighborArray.neighborBond(neighborIndex, i2)) continue;
            tm.column(2) = coordStruct.latticeVectors[i2];
            
            if(std::abs(tm.determinant()) > EPSILON){
                coordStruct.commonNeighbors[neighborIndex][0] = i1;
                coordStruct.commonNeighbors[neighborIndex][1] = i2;
                found = true;
                break;
            }
        }
    }
    assert(found);
}

void CoordinationStructures::initializeSymmetryInformation(){
    for(auto latticeStruct = std::begin(_latticeStructures); 
        latticeStruct != std::end(_latticeStructures); ++latticeStruct){
        
        if(latticeStruct->latticeVectors.empty()) continue;
        
        latticeStruct->primitiveCellInverse = latticeStruct->primitiveCell.inverse();
        generateSymmetryPermutations(*latticeStruct);
        calculateSymmetryProducts(*latticeStruct);
    }
}

void CoordinationStructures::generateSymmetryPermutations(LatticeStructure& latticeStruct){
    const CoordinationStructure& coordStruct = *latticeStruct.coordStructure;
    
    // Find three non-coplanar vectors
    int nindices[3];
    Matrix3 tm1;
    findNonCoplanarVectors(coordStruct, nindices, tm1);
    
    Matrix3 tm1inverse = tm1.inverse();
    
    // Finding symmetry permutations
    std::vector<int> permutation(latticeStruct.latticeVectors.size());
    std::iota(permutation.begin(), permutation.end(), 0);
    
    findAllSymmetryPermutations(latticeStruct, coordStruct, permutation, nindices, tm1, tm1inverse);
}

void CoordinationStructures::findAllSymmetryPermutations(
    LatticeStructure& latticeStruct,
    const CoordinationStructure& coordStruct,
    std::vector<int>& permutation,
    const int nindices[3],
    const Matrix3& tm1,
    const Matrix3& tm1inverse
){
    std::vector<int> lastPermutation(latticeStruct.latticeVectors.size(), -1);
    SymmetryPermutation symmetryPermutation;

    do{
        int changedFrom = std::mismatch(permutation.begin(), permutation.end(), lastPermutation.begin()).first - permutation.begin();
        assert(changedFrom < coordStruct.numNeighbors);
        std::copy(permutation.begin(), permutation.end(), lastPermutation.begin());

        if(changedFrom <= nindices[2]){
            Matrix3 tm2;
            tm2.column(0) = latticeStruct.latticeVectors[permutation[nindices[0]]];
            tm2.column(1) = latticeStruct.latticeVectors[permutation[nindices[1]]];
            tm2.column(2) = latticeStruct.latticeVectors[permutation[nindices[2]]];
            symmetryPermutation.transformation = tm2 * tm1inverse;

            if(!symmetryPermutation.transformation.isOrthogonalMatrix()) {
                bitmapSort(permutation.begin() + nindices[2] + 1, permutation.end(), permutation.size());
                continue;
            }
            changedFrom = 0;
        }
        
        int sortFrom = nindices[2];
        int invalidFrom;

        for(invalidFrom = changedFrom; invalidFrom < coordStruct.numNeighbors; invalidFrom++){
            Vector3 v = symmetryPermutation.transformation * coordStruct.latticeVectors[invalidFrom];
            if(!v.equals(latticeStruct.latticeVectors[permutation[invalidFrom]])) break;
        }

        if(invalidFrom == coordStruct.numNeighbors){
            std::copy(permutation.begin(), permutation.begin() + coordStruct.numNeighbors, symmetryPermutation.permutation.begin());
            bool isDuplicate = false;
            for(const auto& entry : latticeStruct.permutations){
                if(entry.transformation.equals(symmetryPermutation.transformation)){
                    isDuplicate = true;
                    break;
                }
            }
            
            if(!isDuplicate){
                latticeStruct.permutations.push_back(symmetryPermutation);
            }
        }else{
            sortFrom = invalidFrom;
        }
        
        bitmapSort(permutation.begin() + sortFrom + 1, permutation.end(), permutation.size());
    }while(std::next_permutation(permutation.begin(), permutation.end()));

    assert(latticeStruct.permutations.size() >= 1);
    assert(latticeStruct.permutations.front().transformation.equals(Matrix3::Identity()));
}

void CoordinationStructures::findNonCoplanarVectors(const CoordinationStructure& coordStruct, int nindices[3], Matrix3& tm1){
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
}

void CoordinationStructures::calculateSymmetryProducts(LatticeStructure& latticeStruct){
    for(int s1 = 0; s1 < latticeStruct.permutations.size(); s1++) {
        for(int s2 = 0; s2 < latticeStruct.permutations.size(); s2++) {
            calculateProductForPermutation(latticeStruct, s1, s2);
        }
    }
}

void CoordinationStructures::calculateProductForPermutation(LatticeStructure& latticeStruct, size_t s1, size_t s2){
    Matrix3 product = latticeStruct.permutations[s2].transformation * latticeStruct.permutations[s1].transformation;
    
    for(size_t i = 0; i < latticeStruct.permutations.size(); i++){
        if(latticeStruct.permutations[i].transformation.equals(product)){
            latticeStruct.permutations[s1].product.push_back(i);
            break;
        }
    }

    assert(latticeStruct.permutations[s1].product.size() == s2 + 1);
    
    Matrix3 inverseProduct = latticeStruct.permutations[s2].transformation.inverse() * latticeStruct.permutations[s1].transformation;
    
    for(size_t i = 0; i < latticeStruct.permutations.size(); i++){
        if(latticeStruct.permutations[i].transformation.equals(product)){ 
            latticeStruct.permutations[s1].inverseProduct.push_back(i);
            break;
        }
    }

    assert(latticeStruct.permutations[s1].inverseProduct.size() == s2 + 1);
}

void CoordinationStructures::initializeStructures(){
	initializeOther();
	initializeFCC();
	initializeHCP();
	initializeBCC();
	initializeCubicDiamond();
	initializeHexagonalDiamond();
	initializeCommonNeighbors();
	initializeSymmetryInformation();
}

}