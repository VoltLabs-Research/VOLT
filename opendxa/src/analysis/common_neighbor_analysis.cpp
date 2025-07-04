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