#include <opendxa/analysis/common_neighbor_analysis.h>

namespace OpenDXA{

// Count how many common neighbors a given neighbor has by using a bitmask
// Each bit in neighborArray.neighborArray[neighborIndex] represents whether
// two atoms share a particular neighbor. This function uses the compiler
// intrinsic __builtin_popcount to count the sets bits (common neighbors)
// in that msk, which maps directly to the CPU's POPCNT instructon for maximum speed.
int CommonNeighborAnalysis::findCommonNeighbors(
	const NeighborBondArray& neighborArray,
	int neighborIndex,
	unsigned int &commonNeighbors,
	int numNeighbors
){
	commonNeighbors = neighborArray.neighborArray[neighborIndex];
	return __builtin_popcount(commonNeighbors);
}

// Find a permutation of neighbor that matches a reference coordination structure.
// Given a candidate ordering of neighbor indices (neighborMapping), this routine
// attempts to reorder them so that each neighbor's CNA signature and mutual bond 
// topology matches exactly the expected pattern in coordinationStructures[coordinationType].
// It iterates though mismatches, incrementally swapping neighbors (using next_permutation)
// until a perfect match is found or all permutations are exhausted.
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

        // Skip over positions that haven't changed since last time
        while(neighborMapping[ni1] == previousMapping[ni1]){
            ni1++;
            assert(ni1 < coordinationNumber);
        }

        // Attempt to advance the permutation at index ni1
        for(; ni1 < coordinationNumber; ni1++){
            int atomNeighborIndex1 = neighborMapping[ni1];
            previousMapping[ni1] = atomNeighborIndex1;

            // Check CNA signature match
            if(cnaSignatures[atomNeighborIndex1] != coordStructure.cnaSignatures[ni1]){
                break;
            }

            // Check that bond connectivity matches
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

        // If all positions matched, we succeeded
        if(ni1 == coordinationNumber) return true;

        // Otherwise generate the next permutation and retry
        bitmapSort(neighborMapping + ni1 + 1, neighborMapping + coordinationNumber, coordinationNumber);
        if(!std::next_permutation(neighborMapping, neighborMapping + coordinationNumber)){
            assert(false);
            return false;
        }
    }
}

// Determine the coordination type (FCC, HCP, BCC, Diamond, etc.) for one atom.
// Examines each neighbor's common-neighbor count and bond topology, builds 
// sinagure counters, and returns the matched CoordinationStructureType.
// If no known pattern matches, returns COORD_OTHER.
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
            // Count 4-2-1 vs 4-2-2 signatures among the 12 neighbors to distinguish FCC vs HCP
            int n421 = 0;
            int n422 = 0;
            for(int neighborIndex = 0; neighborIndex < coordinationNumber; neighborIndex++){
                unsigned int commonNeighbors;
                int numCommonNeighbors = findCommonNeighbors(neighborArray, neighborIndex, commonNeighbors, coordinationNumber);
                if(numCommonNeighbors != 4) break;

                CNAPairBond neighborBonds[MAX_NEIGHBORS * MAX_NEIGHBORS];
                int numNeighborBonds = findNeighborBonds(neighborArray, commonNeighbors, coordinationNumber, neighborBonds);
                if(numNeighborBonds != 2) break;

                int maxChainLength = calcMaxChainLength(neighborBonds, numNeighborBonds);

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
            // Count 4-4-4 vs 6-6-6 signatures among up to 14 neighbors for BCC
            int n444 = 0;
            int n666 = 0;
            for(int neighborIndex = 0; neighborIndex < coordinationNumber; neighborIndex++){
                unsigned int commonNeighbors;
                int numCommonNeighbors = findCommonNeighbors(neighborArray, neighborIndex, commonNeighbors, 14);
                if(numCommonNeighbors != 4 && numCommonNeighbors != 6) break;

                CNAPairBond neighborBonds[MAX_NEIGHBORS * MAX_NEIGHBORS];
                int numNeighborBonds = findNeighborBonds(neighborArray, commonNeighbors, 14, neighborBonds);
                if(numNeighborBonds != 4 && numNeighborBonds != 6) break;

                int maxChainLength = calcMaxChainLength(neighborBonds, numNeighborBonds);

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
            // Check first four for 3-coordination, then next twelve for 5-4-3 vs 5-4-4 patterns
            for(int neighborIndex = 0; neighborIndex < 4; neighborIndex++){
                cnaSignatures[neighborIndex] = 0;
                unsigned int commonNeighbors;
                int numCommonNeighbors = findCommonNeighbors(neighborArray, neighborIndex, commonNeighbors, coordinationNumber);
                if(numCommonNeighbors != 3) return COORD_OTHER;
            }

            int n543 = 0;
            int n544 = 0;
            for(int neighborIndex = 4; neighborIndex < coordinationNumber; neighborIndex++){
                unsigned int commonNeighbors;
                int numCommonNeighbors = findCommonNeighbors(neighborArray, neighborIndex, commonNeighbors, coordinationNumber);
                if(numCommonNeighbors != 5) break;

                CNAPairBond neighborBonds[MAX_NEIGHBORS * MAX_NEIGHBORS];
                int numNeighborBonds = findNeighborBonds(neighborArray, commonNeighbors, coordinationNumber, neighborBonds);
                if(numNeighborBonds != 4) break;

                int maxChainLength = calcMaxChainLength(neighborBonds, numNeighborBonds);

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

// Extract all bonds between the common neighbor of one atom.
// Scans every pair of neighbors that both appear in the commonNeighbors bitmask,
// and records a bond bitmask for each pair. This sets up the input for chain-length
// calculation (how large a connected subgraph those neighbors form).
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

    // Iterate each neighbor bit
    for(int ni1 = 0; ni1 < numNeighbors; ni1++, ni1b <<= 1){
        if(commonNeighbors & ni1b){
            unsigned int b = commonNeighbors & neighborArray.neighborArray[ni1];
            // For each previously seen neighbor, if they share a bond, record it
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

// Given one neighbor atom bit, count adjacent bonds and schedule more atoms.
// For a single atom bt, this removes any bonds touching that atom from bondToProcess[],
// increments adjacentBonds count, and updates the atomsToProcess mask to include
// newly reached atoms (minus those already processed).
int CommonNeighborAnalysis::getAdjacentBonds(
	unsigned int atom, 
	CNAPairBond* bondsToProcess, 
	int& numBonds, 
	unsigned int& atomsToProcess, 
	unsigned int& atomsProcessed
){
    int adjacentBonds = 0;
    // Scan from end to start so we can remove elements safely
    for(int b = numBonds - 1; b >= 0; --b){
        if(atom & bondsToProcess[b]){
            ++adjacentBonds;
            atomsToProcess |= bondsToProcess[b] & (~atomsProcessed);
            // Remove this bond by shifting the rest left
            memmove(&bondsToProcess[b], &bondsToProcess[b+1], sizeof(CNAPairBond) * (numBonds - b - 1));
            --numBonds;
        }
    }
    return adjacentBonds;
}

// Compute the maximum connected chain length among a set of neighbor bonds.
// Repeatedly picks one CNAPairBond, then grows a connected component
// by following all adjacent bonds until no new atoms remain. Track the 
// largest cluster size observed.
int CommonNeighborAnalysis::calcMaxChainLength(CNAPairBond* neighborBonds, int numBonds){
    int maxChainLength = 0;

    // Explore aech bond as a starting point
    while(numBonds){
        numBonds--;
        unsigned int atomsToProcess = neighborBonds[numBonds];
        unsigned int atomsProcessed = 0;
        int clusterSize = 1;
        do{
            // Find the next atom bit (lowest set bit)
			int nextAtomIndex = __builtin_ctz(atomsToProcess);
            unsigned int nextAtom = 1 << nextAtomIndex;
            atomsProcessed |= nextAtom;
            atomsToProcess &= ~nextAtom;

            // Consume its adjacent bond and enqueue new atoms
            clusterSize += getAdjacentBonds(nextAtom, neighborBonds, numBonds, atomsToProcess, atomsProcessed);
        }while(atomsToProcess);
        if(clusterSize > maxChainLength){
            maxChainLength = clusterSize;
        }
    }

    return maxChainLength;
}

}