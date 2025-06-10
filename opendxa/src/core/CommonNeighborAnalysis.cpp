#include "core/Clustering.hpp"
#include "utils/Timer.hpp"
#include "core/NeighborListBuilder.hpp"
#include <unordered_set>
#include <algorithm>
#include <immintrin.h>

typedef pair<int, int> Bond;

constexpr int MAX_BONDS = 6;
constexpr int MAX_COMMON_NEIGHBORS = 6;
constexpr int CACHE_LINE_SIZE = 64;

// Thread-local memory pools
class alignas(CACHE_LINE_SIZE) BondPool{
private:
	static thread_local Bond bondBuffer[MAX_BONDS];
	static thread_local int commonNeighborBuffer[MAX_COMMON_NEIGHBORS];
	static thread_local vector<Bond> bondsToProcessBuffer;
	static thread_local vector<int> atomsToProcessBuffer;
	static thread_local unordered_set<int> atomsProcessedSetBuffer;
	static thread_local unordered_set<int> atomsToProcessSetBuffer;

public:
	static Bond* getBonds(){
		return bondBuffer;
	}

	static int* getCommonNeighbors(){
		return commonNeighborBuffer;
	}

	static void initializeBuffers(){
        bondsToProcessBuffer.clear();
        bondsToProcessBuffer.reserve(MAX_BONDS);
        atomsToProcessBuffer.clear();
        atomsToProcessBuffer.reserve(MAX_BONDS * 2);
        atomsProcessedSetBuffer.clear();
        atomsToProcessSetBuffer.clear();
	}

	static vector<Bond>& getBondsToProcess(){
		return bondsToProcessBuffer;
	}

	static vector<int>& getAtomsToProcess(){
		return atomsToProcessBuffer;
	}

	static unordered_set<int>& getAtomsProcessedSet(){
		return atomsProcessedSetBuffer;
	}

	static unordered_set<int>& getAtomsToProcessSet(){
		return atomsToProcessSetBuffer;
	}
};

// Thread-local buffers
thread_local Bond BondPool::bondBuffer[MAX_BONDS];
thread_local int BondPool::commonNeighborBuffer[MAX_COMMON_NEIGHBORS];
thread_local vector<Bond> BondPool::bondsToProcessBuffer;
thread_local vector<int> BondPool::atomsToProcessBuffer;
thread_local unordered_set<int> BondPool::atomsProcessedSetBuffer;
thread_local unordered_set<int> BondPool::atomsToProcessSetBuffer;

// Pre-calculate bonds
static inline void precalculateBonds(InputAtom* atom, int numNeighbors){
	for(int ni1 = 0; ni1 < numNeighbors; ni1++){
		atom->setNeighborBond(ni1, ni1, false);
        InputAtom* neighbor1 = atom->neighborAtom(ni1);
		for(int ni2 = ni1 + 1; ni2 < numNeighbors; ni2++){
			bool hasNeighbor = neighbor1->hasNeighbor(atom->neighborAtom(ni2));
			atom->setNeighborBond(ni1, ni2, hasNeighbor);
			atom->setNeighborBond(ni2, ni1, hasNeighbor);
		}
	}
}

static inline int findCommonNeighbors(InputAtom* atom1, int atom2, int* commonNeighbors, int maxExpectedCommonNeighbors){
	int numCommonNeighbors = 0;
	const int maxNeighbors = atom1->numNeighbors;
    __builtin_prefetch(atom1, 0, 3);
	for(int ni1 = 0; ni1 < maxNeighbors; ni1++){
		if(atom1->neighborBond(atom2, ni1)){
			if(numCommonNeighbors == maxExpectedCommonNeighbors){
				return 0;
			}

			commonNeighbors[numCommonNeighbors++] = ni1;
		}
	}
	
	return numCommonNeighbors;
}

static inline int findNeighborBonds(
	InputAtom* atom1,
	int* commonNeighbors,
	int numCommonNeighbors,
	Bond* neighborBonds,
	int maxExpectedBonds
){
	int numBonds = 0;
	for(int ni1 = 0; ni1 < numCommonNeighbors; ni1++){
		const int neighbor1 = commonNeighbors[ni1];
		for(int ni2 = 0; ni2 < ni1; ni2++){
			if(atom1->neighborBond(neighbor1, commonNeighbors[ni2])){
				if(numBonds == maxExpectedBonds){
					return 0;
				}

				neighborBonds[numBonds++] = Bond(neighbor1, commonNeighbors[ni2]);
			}
		}
	}

	return numBonds;
}

static inline int getAdjacentBonds(
	int atom,
	vector<Bond>& bondsToProcess,
	vector<int>& atomsToProcess,
	unordered_set<int>& atomsProcessedSet,
	unordered_set<int>& atomsToProcessSet
){
	atomsProcessedSet.insert(atom);
	int adjacentBonds = 0;
	for(auto bond = bondsToProcess.begin(); bond != bondsToProcess.end(); ){
		if(atom == bond->first || atom == bond->second){
			++adjacentBonds;
			if(atomsProcessedSet.find(bond->first) == atomsProcessedSet.end() &&
					atomsToProcessSet.find(bond->first) == atomsToProcessSet.end()){
				atomsToProcess.push_back(bond->first);
				atomsToProcessSet.insert(bond->first);
			}

			if(atomsProcessedSet.find(bond->second) == atomsProcessedSet.end()
					&& atomsToProcessSet.find(bond->second) == atomsToProcessSet.end()){
				atomsToProcess.push_back(bond->second);
				atomsToProcessSet.insert(bond->second);
			}
			
			bond = bondsToProcess.erase(bond);
		}else{
			++bond;
		}
	}
	
	return adjacentBonds;
}

static inline int calcMaxChainLength(Bond* neighborBonds, int numBonds, int expectedMaxChainLength){
	if(numBonds == 0){
		return 0;
	}
    
	vector<Bond>& bondsToProcess = BondPool::getBondsToProcess();
	vector<int>& atomsToProcess = BondPool::getAtomsToProcess();
	unordered_set<int>& atomsProcessedSet = BondPool::getAtomsProcessedSet();
	unordered_set<int>& atomsToProcessSet = BondPool::getAtomsToProcessSet();
    
	bondsToProcess.assign(neighborBonds, neighborBonds + numBonds);
    
	int maxChainLength = 0;
    
	while(!bondsToProcess.empty()){
		Bond newBond = bondsToProcess.back();
		bondsToProcess.pop_back();
        
		atomsToProcess.clear();
		atomsProcessedSet.clear();
		atomsToProcessSet.clear();
        
		atomsToProcess.push_back(newBond.first);
		atomsToProcess.push_back(newBond.second);
		atomsToProcessSet.insert(newBond.first);
		atomsToProcessSet.insert(newBond.second);
        
		int clusterSize = 1;
        
		while(!atomsToProcess.empty()){
			int nextAtom = atomsToProcess.back();
			atomsToProcess.pop_back();
			atomsToProcessSet.erase(nextAtom);
            
			clusterSize += getAdjacentBonds(nextAtom, bondsToProcess, atomsToProcess, 
											atomsProcessedSet, atomsToProcessSet);
		}
        
		if(clusterSize > maxChainLength){
			maxChainLength = clusterSize;
			if(maxChainLength > expectedMaxChainLength){
				break;
			}
		}
	}
	
	return maxChainLength;
}

static inline void analyzeCNASignature(
	InputAtom* atom, 
	int numNeighbors, 
	size_t& numFCC, 
	size_t& numHCP, 
	size_t& numBCC
){
	precalculateBonds(atom, numNeighbors);
    
	if(numNeighbors == 12){
		size_t n421 = 0, n422 = 0;
		bool validStructure = true;
        
		for(int ni = 0; ni < 12 && validStructure; ni++){
			int* commonNeighbors = BondPool::getCommonNeighbors();
			int numCommon = findCommonNeighbors(atom, ni, commonNeighbors, 4);
            
			if(numCommon != 4){
				validStructure = false;
				break;
			}

			Bond* neighborBonds = BondPool::getBonds();
			int numBonds = findNeighborBonds(atom, commonNeighbors, 4, neighborBonds, 2);
            
			if(numBonds != 2){
				validStructure = false;
				break;
			}

			int maxChainLength = calcMaxChainLength(neighborBonds, 2, 2);
			if(maxChainLength == 1){
				n421++;
			}else if(maxChainLength == 2){
				n422++;
			}else{
				validStructure = false;
				break;
			}
		}

		if(validStructure){
			if(n421 == 12){
				atom->setCNAType(FCC); 
				numFCC++; 
			}else if(n421 == 6 && n422 == 6){
				atom->setCNAType(HCP); 
				numHCP++; 
			}else{
				atom->setCNAType(OTHER);
			}
		}else{
			atom->setCNAType(OTHER);
		}
	}else if(numNeighbors == 14){
		size_t n444 = 0, n666 = 0;
		bool validBCC = true;
        
		for(int ni = 0; ni < 14 && validBCC; ni++){
			int* commonNeighbors = BondPool::getCommonNeighbors();
			int numCommon = findCommonNeighbors(atom, ni, commonNeighbors, 6);
            
			if(numCommon != 4 && numCommon != 6){
				validBCC = false;
				break;
			}

			Bond* neighborBonds = BondPool::getBonds();
			int numBonds = findNeighborBonds(atom, commonNeighbors, numCommon, neighborBonds, 6);
            
			if(numBonds != 4 && numBonds != 6){
				validBCC = false;
				break;
			}

			int maxChainLength = calcMaxChainLength(neighborBonds, numBonds, 6);
            
			if(maxChainLength == 6 && numBonds == 6 && numCommon == 6){
				n666++;
			}else if(maxChainLength == 4 && numBonds == 4 && numCommon == 4){
				n444++;
			}else{
				validBCC = false;
				break;
			}
		}
        
		if(validBCC && n666 == 8 && n444 == 6){
			atom->setCNAType(BCC); 
			numBCC++; 
		}else{
			atom->setCNAType(OTHER);
		}
	}else{
		atom->setCNAType(OTHER);
	}
}

void DXAClustering::buildNearestNeighborLists(){
	MsgLogger() << "Building nearest neighbor lists." << endl;
	Timer neighborTimer;

	neighborListBuilder.initialize(*this, cnaCutoff);
    
	const size_t numAtoms = inputAtoms.size();
    
	for(size_t i = 0; i < numAtoms; ++i){
		if(i + 1 < numAtoms){
			__builtin_prefetch(&inputAtoms[i + 1], 0, 3);
		}
		neighborListBuilder.insertParticle(inputAtoms[i]);
	}

#pragma omp parallel
	{
		BondPool::initializeBuffers();
        
#pragma omp for schedule(dynamic, 32) nowait
		for(int i = 0; i < static_cast<int>(numAtoms); i++){
			InputAtom* atom = &inputAtoms[i];
            
			for(NeighborListBuilder<InputAtom>::iterator neighborIter(neighborListBuilder, atom); 
				!neighborIter.atEnd(); neighborIter.next()){
                
				if(atom->numNeighbors == MAX_ATOM_NEIGHBORS){
#pragma omp critical
					{
						raiseError("Maximum number of nearest neighbors exceeded. Atom %i has more than %i nearest neighbors (built-in maximum number).", atom->tag, MAX_ATOM_NEIGHBORS);
					}
				}
                
				atom->addNeighbor(neighborIter.current());
			}
		}
	}

	MsgLogger() << "Neighbor list time: " << neighborTimer.elapsedTime() << " sec." << endl;
}

void DXAClustering::performCNA(){
	MsgLogger() << "Performing common neighbor analysis (CNA)." << endl;
	Timer timer;
	size_t numFCC = 0;
	size_t numHCP = 0;
	size_t numBCC = 0;
	const size_t numAtoms = inputAtoms.size();

#pragma omp parallel reduction(+: numFCC) reduction(+: numHCP) reduction(+: numBCC)
	{
		BondPool::initializeBuffers();
        
		size_t local_numFCC = 0;
		size_t local_numHCP = 0;
		size_t local_numBCC = 0;
        
#pragma omp for schedule(dynamic, 16) nowait
		for(int i = 0; i < static_cast<int>(numAtoms); i++){
			InputAtom* atom = &inputAtoms[i];
			const int numNeighbors = atom->numNeighbors;
            
			if(i + 1 < static_cast<int>(numAtoms)){
				__builtin_prefetch(&inputAtoms[i + 1], 0, 3);
			}
            
			analyzeCNASignature(atom, numNeighbors, local_numFCC, local_numHCP, local_numBCC);
		}
        
		numFCC += local_numFCC;
		numHCP += local_numHCP;
		numBCC += local_numBCC;
	}

	MsgLogger() << "Number of FCC atoms: " << numFCC 
				<< "   Number of HCP atoms: " << numHCP 
				<< "   Number of BCC atoms: " << numBCC << endl;
	MsgLogger() << "CNA time: " << timer.elapsedTime() << " sec." << endl;
}