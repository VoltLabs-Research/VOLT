#include <opendxa/analysis/common_neighbor_analysis.h>

namespace OpenDXA{

int CommonNeighborAnalysis::findCommonNeighbors(
	const NeighborBondArray& neighborArray,
	int neighborIndex,
	unsigned int &commonNeighbors,
	int numNeighbors
){
	commonNeighbors = neighborArray.neighborArray[neighborIndex];
    // __builtin_popcount(x) is an intrinsic function of the GCC/Clang 
    // compiler that allows to count how many bits are "1" in the binary representation of "x".
    // Used to know how many common neighbors exist (bits in "1") after calculating 
    // the common neighbors of the "neighborIndex" atom (already encoded as a binary mask).
    // Perhaps using a loop is more human-readable, however it is extremely fast, 
    // it translates directly to a CPU instruction (popcnt)
	return __builtin_popcount(commonNeighbors);
}

bool CommonNeighborAnalysis::findMatchingNeighborPermutation(
    CoordinationStructureType coordinationType,
    int* neighborMapping,
    int* previousMapping,
    int coordinationNumber,
    const int* cnaSignatures,
    const NeighborBondArray& neighborArray,
    const CoordinationStructure* coordinationStructures
){
    const CoordinationStructure& coordStructure = coordinationStructures[coordinationType];

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
                if(neighborArray.neighborBond(atomNeighborIndex1, atomNeighborIndex2) !=
                   coordStructure.neighborArray.neighborBond(ni1, ni2)){
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

CoordinationStructureType CommonNeighborAnalysis::computeCoordinationType(
    const NeighborBondArray& neighborArray,
    int coordinationNumber,
    int* cnaSignatures,
    LatticeStructureType inputCrystalType,
    bool identifyPlanarDefects
) {
    CoordinationStructureType coordinationType = COORD_OTHER;

    switch(inputCrystalType){
        case LATTICE_FCC:
        case LATTICE_HCP: {
            size_t n421 = 0;
            size_t n422 = 0;
            for(size_t neighborIndex = 0; neighborIndex < coordinationNumber; neighborIndex++){
                unsigned int commonNeighbors;
                size_t numCommonNeighbors = findCommonNeighbors(neighborArray, neighborIndex, commonNeighbors, coordinationNumber);
                if(numCommonNeighbors != 4) break;

                CNAPairBond neighborBonds[MAX_NEIGHBORS * MAX_NEIGHBORS];
                size_t numNeighborBonds = findNeighborBonds(neighborArray, commonNeighbors, coordinationNumber, neighborBonds);
                if(numNeighborBonds != 2) break;

                size_t maxChainLength = calcMaxChainLength(neighborBonds, numNeighborBonds);

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

            if(n421 == 12 && (identifyPlanarDefects || inputCrystalType == LATTICE_FCC)){
                coordinationType = COORD_FCC;
            }else if(n421 == 6 && n422 == 6 && (identifyPlanarDefects || inputCrystalType == LATTICE_HCP)){
                coordinationType = COORD_HCP;
            }
            break;
        }

        case LATTICE_BCC: {
            size_t n444 = 0;
            size_t n666 = 0;
            for(size_t neighborIndex = 0; neighborIndex < coordinationNumber; neighborIndex++){
                unsigned int commonNeighbors;
                size_t numCommonNeighbors = findCommonNeighbors(neighborArray, neighborIndex, commonNeighbors, 14);
                if(numCommonNeighbors != 4 && numCommonNeighbors != 6) break;

                CNAPairBond neighborBonds[MAX_NEIGHBORS * MAX_NEIGHBORS];
                size_t numNeighborBonds = findNeighborBonds(neighborArray, commonNeighbors, 14, neighborBonds);
                if(numNeighborBonds != 4 && numNeighborBonds != 6) break;

                size_t maxChainLength = calcMaxChainLength(neighborBonds, numNeighborBonds);

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
            }
            break;
        }

        case LATTICE_CUBIC_DIAMOND:
        case LATTICE_HEX_DIAMOND: {
            for(int neighborIndex = 0; neighborIndex < 4; neighborIndex++){
                cnaSignatures[neighborIndex] = 0;
                unsigned int commonNeighbors;
                size_t numCommonNeighbors = findCommonNeighbors(neighborArray, neighborIndex, commonNeighbors, coordinationNumber);
                if(numCommonNeighbors != 3) return COORD_OTHER;
            }

            int n543 = 0;
            int n544 = 0;
            for(int neighborIndex = 4; neighborIndex < coordinationNumber; neighborIndex++){
                unsigned int commonNeighbors;
                size_t numCommonNeighbors = findCommonNeighbors(neighborArray, neighborIndex, commonNeighbors, coordinationNumber);
                if(numCommonNeighbors != 5) break;

                CNAPairBond neighborBonds[MAX_NEIGHBORS * MAX_NEIGHBORS];
                size_t numNeighborBonds = findNeighborBonds(neighborArray, commonNeighbors, coordinationNumber, neighborBonds);
                if(numNeighborBonds != 4) break;

                size_t maxChainLength = calcMaxChainLength(neighborBonds, numNeighborBonds);

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

            if(n543 == 12 && (identifyPlanarDefects || inputCrystalType == LATTICE_CUBIC_DIAMOND)){
                coordinationType = COORD_CUBIC_DIAMOND;
            }else if(n543 == 6 && n544 == 6 && (identifyPlanarDefects || inputCrystalType == LATTICE_HEX_DIAMOND)){
                coordinationType = COORD_HEX_DIAMOND;
            }
            break;
        }

        default:
            break;
    }

    return coordinationType;
}

int CommonNeighborAnalysis::findNeighborBonds(
	const NeighborBondArray& neighborArray, 
	unsigned int commonNeighbors,
	int numNeighbors, 
	CNAPairBond* neighborBonds
){
    int numBonds = 0;
	unsigned int nib[32];
	int nibn = 0;
	unsigned int ni1b = 1;
    for(int ni1 = 0; ni1 < numNeighbors; ni1++, ni1b <<= 1){
        if(commonNeighbors & ni1b){
            unsigned int b = commonNeighbors & neighborArray.neighborArray[ni1];
            for(int n = 0; n < nibn; n++){
                if(b & nib[n]){
                    neighborBonds[numBonds++] = ni1b | nib[n];
                }
            }
            nib[nibn++] = ni1b;
        }
    }

    return numBonds;
}

// Helper, find adjacent bonds and update processing queues.
int CommonNeighborAnalysis::getAdjacentBonds(
	unsigned int atom, 
	CNAPairBond* bondsToProcess, 
	int& numBonds, 
	unsigned int& atomsToProcess, 
	unsigned int& atomsProcessed
){
    int adjacentBonds = 0;
    for(int b = numBonds - 1; b >= 0; --b){
        if(atom & bondsToProcess[b]){
            ++adjacentBonds;
            atomsToProcess |= bondsToProcess[b] & (~atomsProcessed);
            // Remove bond from list by shifting following elements left.
            memmove(&bondsToProcess[b], &bondsToProcess[b+1], sizeof(CNAPairBond) * (numBonds - b - 1));
            --numBonds;
        }
    }
    return adjacentBonds;
}

int CommonNeighborAnalysis::calcMaxChainLength(CNAPairBond* neighborBonds, int numBonds){
    int maxChainLength = 0;
    while(numBonds){
        numBonds--;
        unsigned int atomsToProcess = neighborBonds[numBonds];
        unsigned int atomsProcessed = 0;
        int clusterSize = 1;
        do{
			int nextAtomIndex = __builtin_ctz(atomsToProcess);
            unsigned int nextAtom = 1 << nextAtomIndex;
            atomsProcessed |= nextAtom;
            atomsToProcess &= ~nextAtom;
            clusterSize += getAdjacentBonds(nextAtom, neighborBonds, numBonds, atomsToProcess, atomsProcessed);
        }while(atomsToProcess);
        if(clusterSize > maxChainLength){
            maxChainLength = clusterSize;
        }
    }

    return maxChainLength;
}

}