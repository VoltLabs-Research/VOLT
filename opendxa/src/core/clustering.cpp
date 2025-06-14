#include <opendxa/core/clustering.hpp>

DXAClustering::DXAClustering()
		: cnaCutoff(0.0),
		numLocalInputAtoms(0),
		numClusters(0),
		numDisclinationAtoms(0),
		numClusterDisclinations(0),
		numSuperClusters(0),
		numClusterTransitions(0){
	// TODO: Should I keep this? Could I somehow estimate this 
	// parameter based on the simulation being evaluated? 
	// Should it be a configurable parameter?
	constexpr size_t expectedAtoms = 40000;
	inputAtoms.reserve(expectedAtoms);
}

void DXAClustering::cleanup(){
	inputAtoms.clear();
	numClusters = 0;
	numLocalInputAtoms = 0;
	numClusterDisclinations = 0;
	numSuperClusters = 0;
	numClusterTransitions = 0;
	clusters.clear();
	clusterPool.clear();
	clusterTransitionPool.clear();
}

void DXAClustering::setCNACutoff(FloatType cutoff){
	this->cnaCutoff = cutoff;
}

// Wraps input atoms at periodic boundary conditions.
void DXAClustering::wrapInputAtoms(const Vector3 offset){
	// Apply an optional offset transformation to all atoms.
	if(offset != NULL_VECTOR){
		#pragma omp parallel for
		for(int i = 0; i < inputAtoms.size(); i++){
			inputAtoms[i].pos += offset;
		}
	}

	// Make sure that all atoms are within the simulation cell
	if(hasPeriodicBoundaries()){
		#pragma omp parallel for
		for(int i = 0; i < inputAtoms.size(); i++){
			inputAtoms[i].pos = wrapPoint(inputAtoms[i].pos);
		}
	}
}

// Full clustering pipeline
void DXAClustering::clusterAtoms(){
	determineDistanceFromDefects();
	clusterCrystallineAtoms(0);
	createClusterTransitions();

	std::vector<ClusterTransition*> clusterTransitions;
	for(auto &p : clusters){
		for(ClusterTransition* transitions = p.second->transitions; transitions; transitions = transitions->next){
			transitions->priority = transitions->numberOfBonds;
			clusterTransitions.push_back(transitions);
		}
	}

	createSuperclusters(clusterTransitions);
	finalizeSuperclusters();
	alignClusterOrientations();

	// Mark atoms with disordered neighbors
	#pragma omp parallel for
	for(int i = 0; i < numLocalInputAtoms; ++i){
		InputAtom &atom = inputAtoms[i];
		if(atom.isDisordered()) continue;
		for(int n = 0; n < atom.numNeighbors; ++n){
			if(atom.neighborAtom(n)->isDisordered()){
				// TODO: In other methods, we do not use this flag.
				atom.setFlag(ATOM_NON_BULK);
				break;
			}
		}
	}
}

// Propagates orientations and removes redundant transitions after the DSU.
void DXAClustering::finalizeSuperclusters(){
	// Propagate transformations from each root
	std::vector<Cluster*> roots;
	roots.reserve(clusters.size());
	for(auto &kv : clusters){
		if(kv.second->masterCluster == nullptr){
			roots.push_back(kv.second);
		}
	}

	#pragma omp parallel for
	for(size_t k = 0; k < roots.size(); ++k){
		std::stack<Cluster*> stack;
		stack.push(roots[k]);
		while(!stack.empty()){
			Cluster* cluster = stack.top();
			stack.pop();
			for(Cluster* child = cluster->nextCluster; child != cluster; child = child->nextCluster){
				child->transformation = cluster->transformation * child->transformation;
				// flatten
				child->masterCluster = nullptr;
				stack.push(child);
			}
		}
	}

	// Deletes transitions that are now intra-supercluster
	for(auto &kv : clusters){
		Cluster* cluster = kv.second;
		ClusterTransition* prev = nullptr;
		ClusterTransition* transitions = cluster->transitions;
		while(transitions){
			ClusterTransition* next = transitions->next;

			if(transitions->cluster2->masterCluster == nullptr && transitions->cluster2 == cluster){
				// remove
				if(prev){
					prev->next = next;
				}else{
					cluster->transitions = next;
				}
			}else{
				prev = transitions;
			}

			transitions = next;
		}
	}	
}

// Create a new instance of the Cluster structure 
// and adds it to the global list.
Cluster* DXAClustering::createCluster(int id, int processor){
	DISLOCATIONS_ASSERT(id >= 0);
	DISLOCATIONS_ASSERT(processor >= 0);
	DISLOCATIONS_ASSERT(clusters.find(id) == clusters.end());

	Cluster* cluster = clusterPool.construct();
	cluster->id = id;
	cluster->transitions = NULL;
	cluster->originalTransitions = NULL;
	cluster->processor = processor;
	cluster->masterCluster = NULL;
	cluster->nextCluster = cluster;
	cluster->transformation = IDENTITY;
	cluster->numTransitions = 0;
	clusters[id] = cluster;

	return cluster;
}

// Create a new instance of the Cluster structure if necessary.
// If there is an existing instance for the given ID the returns
// this instance.
Cluster* DXAClustering::createClusterOnDemand(int id, int processor){
	// The special NULL cluster has ID -1.
	if(id < 0) return NULL;

	// Lookup existing cluster.
	Cluster* cluster = getCluster(id);
	if(cluster) return cluster;

	// Create new one.
	return createCluster(id, processor);
}

// Brings the neighbors of crystalline atoms into a fixed order.
void DXAClustering::orderCrystallineAtoms(){
	LOG_INFO() << "Ordering neighbors of crystalline atoms.";

	firstGhostAtom = inputAtoms.begin() + numLocalInputAtoms;

	// Order the neighbors of crystalline atoms.
	#pragma omp parallel for
	for(int atomIndex = 0; atomIndex < numLocalInputAtoms; atomIndex++) {
		InputAtom& atom = inputAtoms[atomIndex];
		DISLOCATIONS_ASSERT(atom.isLocalAtom());
		if(atom.isFCC()) orderFCCAtomNeighbors(&atom);
		else if(atom.isHCP()) orderHCPAtomNeighbors(&atom);
		else if(atom.isBCC()) orderBCCAtomNeighbors(&atom);
	}

	numDisclinationAtoms = 0;
}

// Calculate the minimum distance to a defect for each crystalline atom
// Single-source multiple BFS, O(n + m).
void DXAClustering::determineDistanceFromDefects(){
	LOG_INFO() << "Determining distances to defects by BFS.";
	
	std::deque<InputAtom*> deque;
	const int INF = std::numeric_limits<int>::max();
	
	for(auto &atom : inputAtoms){
		atom.defectProximity = INF;
		// TODO: previously using ATOM_ON_THE_STACK
		atom.clearVisitFlag();
		atom.cluster = nullptr;
		if(atom.isDisordered()){
			atom.defectProximity = 0;
			deque.push_back(&atom);
		}
	}

	while(!deque.empty()){
		InputAtom* atom = deque.front();
		deque.pop_front();
		int defectProximity = atom->defectProximity;
		for(int n = 0; n < atom->numNeighbors; ++n){
			InputAtom* nb = atom->neighborAtom(n);
			if(nb->defectProximity > defectProximity + 1){
				nb->defectProximity = defectProximity + 1;
				deque.push_back(nb);
			}
		}
	}
}

// Build all crystal clusters in ONE BFS pass.
// TODO: remove level from fn definition.
void DXAClustering::clusterCrystallineAtoms(int /*level*/){
	LOG_INFO() << "Breaking down crystalline atoms into clusters (single BFS).";
	std::deque<InputAtom*> deque;
	for(auto &atom : inputAtoms){
		if(atom.cluster || atom.isDisordered()) continue;
		// seed
		atom.latticeOrientation = IDENTITY;
		atom.cluster = createCluster(atom.tag, processor);
		++numClusters;
		deque.push_back(&atom);
		while(!deque.empty()){
			InputAtom* a = deque.front();
			deque.pop_front();

			for(int n = 0; n < a->numNeighbors; ++n){
				if(!isValidClusterNeighbor(a, n, 0)) continue;
				InputAtom* nb = a->neighborAtom(n);
				if(nb->cluster) continue;
				nb->latticeOrientation = a->determineTransitionMatrix(n);
				nb->cluster = a->cluster;
				deque.push_back(nb);
			}
		}
	}
}

// Decides whether the neighbor can join the current atom's cluster.
// Filter by: local/ghost, crystal type, and priority based on defectProximity.
// TODO: remove level from fn definition.
bool DXAClustering::isValidClusterNeighbor(InputAtom* currentAtom, int neighborIndex, int /*level*/){
	InputAtom* neighbor = currentAtom->neighborAtom(neighborIndex);
	
	// If the neighbor isn't a local atom, it's because it's a ghost. 
	// If it's disordered, it means it's non-crystalline.
	if(neighbor->isNonLocalAtom() || neighbor->isDisordered()){
		return false;
	}

	// Ensure that only the unit cell vectors needed to compare cluster orientations are used.
	if(!currentAtom->isValidTransitionNeighbor(neighborIndex)){
		return false;
	}

	// We only allow progress to the same or lesser distance to the defect
	if(neighbor->defectProximity > currentAtom->defectProximity){
		return false;
	}

	// If it already belongs to another different cluster, we ignore it
	if(neighbor->cluster && neighbor->cluster != currentAtom->cluster){
		return false;
	}

	return true;
}

// Makes a neighbor atom part of the crystallite cluster and puts it
// on the recursive stack. Assign the lattice orientation matrix and detects intra-cluster disclinations.
void DXAClustering::clusterNeighbor(InputAtom* currentAtom, InputAtom* neighbor, const LatticeOrientation& neighborLatticeOrientation, deque<InputAtom*>& toprocess, int level){
	// Is the neighbor not part of this cluster yet?
	if(neighbor->cluster == NULL){
		neighbor->latticeOrientation = neighborLatticeOrientation;
		neighbor->cluster = currentAtom->cluster;
		// Put it onto the recursive stack.
		neighbor->setFlag(ATOM_ON_THE_STACK);
		toprocess.push_back(neighbor);
	}else{
		DISLOCATIONS_ASSERT(neighbor->testFlag(ATOM_ON_THE_STACK) == false);
		DISLOCATIONS_ASSERT(neighbor->cluster == currentAtom->cluster);
		// If we have processed this atom before then check the lattice orientation.
		// We might have encountered a disclination.
		// If the two orientations are not equal then a disclination must have been enclosed by the recursive walk.
		if(neighbor->latticeOrientation.equals(neighborLatticeOrientation) == false){
			// Disable the other crystalline atom to create a barrier.
			// This prevents Burgers circuits from being traced around the disclination.
			disableDisclinationBorderAtom(neighbor);
		}
	}
}

// Marks the given crystalline atoms as a disclination border atom and
// disables it such that it becomes a barrier for Burgers circuit tracing.
void DXAClustering::disableDisclinationBorderAtom(InputAtom* atom){
	if(atom->isLocalAtom() && atom->testFlag(ATOM_DISCLINATION_BORDER) == false){
		numDisclinationAtoms++;
	}

	atom->setCNAType(UNDEFINED);
	atom->setFlag(ATOM_DISCLINATION_BORDER);
	atom->numNeighbors = 0;
	atom->cluster = NULL;
}

// Calculates the transition matrices between all clusters.
void DXAClustering::createClusterTransitions(){
	LOG_INFO() << "Calculating cluster transition matrices.";
	// Iterate over all local atoms that are part of a crystalline cluster.
	for(vector<InputAtom>::iterator atom = inputAtoms.begin(); atom != firstGhostAtom; ++atom){
		// Skip atoms that are not part of a cluster.
		if(atom->cluster == NULL) continue;
		DISLOCATIONS_ASSERT(atom->isCrystalline());

		// Iterate over all its crystalline neighbors, which are part of a cluster as well.
		for(int n = 0; n < atom->numNeighbors; n++){
			InputAtom* neighbor = atom->neighborAtom(n);
			// Skip neighbors, which are not part of a cluster.
			if(neighbor->cluster == NULL) continue;
			// Skip neighbors, which are part of the same cluster.
			if(neighbor->cluster == atom->cluster && neighbor->isNonLocalAtom() == false) continue;
			// Not all neighbors of a crystalline atom can be traversed.
			if(atom->isValidTransitionNeighbor(n) == false) continue;

			DISLOCATIONS_ASSERT(neighbor->isCrystalline());
			DISLOCATIONS_ASSERT(neighbor->hasNeighbor(&*atom));

			// Calculate cluster-cluster transition matrix.
			LatticeOrientation neighborLatticeOrientation = atom->determineTransitionMatrix(n);
			LatticeOrientation transitionTM = neighbor->latticeOrientation * neighborLatticeOrientation.inverse();

			if(neighbor->cluster != atom->cluster){
				// The source cluster should reside on the current processor.
				DISLOCATIONS_ASSERT(atom->cluster->processor == this->processor);

				// Register a cluster-cluster transition.
				ClusterTransition* transition12 = createClusterTransitionOnDemand(atom->cluster, neighbor->cluster, transitionTM);

				if(neighbor->cluster->processor == this->processor){
					// Also register the inverse transition if the second cluster is on the some processor.
					ClusterTransition* transition21 = createClusterTransitionOnDemand(neighbor->cluster, atom->cluster, transitionTM.inverse());
					transition12->numberOfBonds++;
					transition21->numberOfBonds++;
					transition12->inverse = transition21;
					transition21->inverse = transition12;
				}else{
					DISLOCATIONS_ASSERT(transition12->inverse == NULL);
					transition12->numberOfBonds++;
				}
			}else{
				// Detect disclinations for intra-cluster transitions.
				if(transitionTM.equals(IDENTITY) == false) {
					disableDisclinationBorderAtom(&*atom);
					break;
				}
			}
		}
	}
}

// Registers a cluster-cluster transition. Returns the existing
// transition structure if an identical transition has already been registered before.
ClusterTransition* DXAClustering::createClusterTransitionOnDemand(Cluster* cluster1, Cluster* cluster2, const LatticeOrientation& transitionTM){
	// Lookup existing transition.
	ClusterTransition* transition = getClusterTransition(cluster1, cluster2, transitionTM);
	if(transition) return transition;

	// Create a new transition.
	return createClusterTransition(cluster1, cluster2, transitionTM);
}

// Registers a new cluster-cluster transition.
ClusterTransition* DXAClustering::createClusterTransition(Cluster* cluster1, Cluster* cluster2, const LatticeOrientation& transitionTM){
	DISLOCATIONS_ASSERT(transitionTM.isRotationMatrix());
	DISLOCATIONS_ASSERT(cluster1 != cluster2);
	DISLOCATIONS_ASSERT(cluster1 != NULL);
	DISLOCATIONS_ASSERT(cluster2 != NULL);
	DISLOCATIONS_ASSERT(getClusterTransition(cluster1, cluster2, transitionTM) == NULL);

	ClusterTransition* transition = clusterTransitionPool.construct();
	transition->inverse = NULL;
	transition->disabled = false;
	transition->cluster1 = cluster1;
	transition->cluster2 = cluster2;
	transition->originalCluster1 = cluster1;
	transition->originalCluster2 = cluster2;
	transition->numberOfBonds = 0;
	transition->transitionTM = transitionTM;
	transition->originalTransitionTM = transitionTM;
	transition->next = cluster1->transitions;
	transition->originalNext = transition->next;
	cluster1->transitions = transition;
	cluster1->originalTransitions = transition;
	cluster1->numTransitions++;
	numClusterTransitions++;

	return transition;
}

/// This helper function is used to sort cluster-cluster transitions w.r.t. their priority.
inline bool transitionCompare(ClusterTransition* t1, ClusterTransition* t2){
	return t1->priority < t2->priority; 
}

// Merge clusters with Union-Fin
void DXAClustering::createSuperclusters(vector<ClusterTransition*>& edges){
	// TODO: Move this (Disjoint Set Union | Union-Find)
	struct DSU{
		std::vector<int> p, r;
		DSU(size_t n): p(n), r(n, 0){
			std::iota(p.begin(), p.end(), 0);
		}

		int find(int x){
			return p[x] == x ? x : p[x] = find(p[x]);
		}

		bool unite(int a, int b){
			a = find(a);
			b = find(b);
			if(a == b) return false;
			if(r[a] < r[b]) std::swap(a, b);
			p[b] = a;
			if(r[a] == r[b]) ++r[a];
			return true;
		}
	};

	LOG_INFO() << "Joining " << clusters.size() << " crystallite clusters into superclusters (DSU).";

	// compact index
	std::unordered_map<Cluster*, int> idx;
	idx.reserve(clusters.size());
	int id = 0;
	for(auto &kv : clusters){
		idx[kv.second] = id++;
	}

	DSU dsu(idx.size());

	// a single order
	std::sort(edges.begin(), edges.end(), [](auto* a, auto* b){
		return a->priority > b->priority;
	});

	// joins and marks masterCluster
	numSuperClusters = clusters.size();
	for(auto *transitions : edges){
		if(transitions->disabled) continue;
		Cluster* cluster1 = transitions->cluster1;
		Cluster* cluster2 = transitions->cluster2;
		if(dsu.unite(idx[cluster1], idx[cluster2])){
			// c1 remains as a provisional root
			cluster2->masterCluster = cluster1;
			--numSuperClusters;
		}
	}

	LOG_INFO() << "Number of super clusters: " << numSuperClusters;
}

// Joins two adjacent clusters into one larger cluster.
void DXAClustering::joinClusters(ClusterTransition* transition, list<ClusterTransition*>& priorityStack){
	DISLOCATIONS_ASSERT(transition->disabled == false);
	Cluster* cluster1 = transition->cluster1;
	Cluster* cluster2 = transition->cluster2;
	ClusterTransition* inverseTransition = transition->inverse;

	DISLOCATIONS_ASSERT(cluster1 != cluster2);
	DISLOCATIONS_ASSERT(cluster1->masterCluster == NULL);
	DISLOCATIONS_ASSERT(cluster2->masterCluster == NULL);

	LOG_INFO() << "Joining clusters " << std::to_string(cluster1->id) << " and " << std::to_string(cluster2->id);

	ClusterTransition* t;

	// Transform all orientations of cluster 2 to align with cluster 1.
	LatticeOrientation newTransformation = cluster1->transformation * inverseTransition->transitionTM;
	LatticeOrientation diffTransformation = newTransformation * cluster2->transformation.inverse();
	Cluster* c = cluster2;
	do{
		DISLOCATIONS_ASSERT(c->masterCluster == cluster2 || c == cluster2);
		DISLOCATIONS_ASSERT(c->transitions == NULL || c == cluster2);

		c->transformation = diffTransformation * c->transformation;
		c->masterCluster = cluster1;
		c = c->nextCluster;
	}while(c != cluster2);

	// Re-wire transitions. All transitions pointing to/from cluster 2 will be transfered to cluster 1.
	ClusterTransition* t2 = cluster2->transitions;
	while(t2){
		DISLOCATIONS_ASSERT(t2->cluster1 == cluster2);
		DISLOCATIONS_ASSERT(t2->inverse != NULL);
		DISLOCATIONS_ASSERT(t2->inverse->cluster2 == cluster2);

		t2->cluster1 = cluster1;
		t2->inverse->cluster2 = cluster1;
		t2->transitionTM = t2->transitionTM * diffTransformation.inverse();
		t2->inverse->transitionTM = t2->transitionTM.inverse();
		ClusterTransition* next = t2->next;

		// Insert transition into list of cluster 1.
		t2->next = cluster1->transitions;
		cluster1->transitions = t2;
		cluster1->numTransitions++;

		t2 = next;
	}
	cluster2->transitions = NULL;
	cluster2->numTransitions = 0;

	DISLOCATIONS_ASSERT(transition->cluster1 == cluster1);
	DISLOCATIONS_ASSERT(transition->cluster2 == cluster1);
	DISLOCATIONS_ASSERT(transition->transitionTM.equals(IDENTITY));

	// Remove the processed transition from the list.
	cluster1->removeTransition(transition);
	cluster1->removeTransition(transition->inverse);
	priorityStack.remove(transition->inverse);

	// Disable all remaining intra-cluster transitions.
	t = cluster1->transitions;
	ClusterTransition* previous = NULL;
	int counter3 = 0;
	int counter3Max = cluster1->numTransitions;
	while(t){
		DISLOCATIONS_ASSERT(t->cluster1 == cluster1);
		DISLOCATIONS_ASSERT(t->inverse != NULL);
		ClusterTransition* next = t->next;
		if(t->cluster2 == cluster1){
			if(t->transitionTM.equals(IDENTITY) == false) {
				numClusterDisclinations++;
				t->disabled = true;
			}
			t->next = NULL;
			priorityStack.remove(t);
			if(previous) previous->next = next;
			else cluster1->transitions = next;
			cluster1->numTransitions--;
		}
		else previous = t;
		t = next;
	}
	DISLOCATIONS_ASSERT(cluster1->numTransitions >= 0);

	// Sum up priorities of remaining transitions.
	ClusterTransition* t1 = cluster1->transitions;
	int counter4 = 0;
	while(t1){
		DISLOCATIONS_ASSERT(t1->cluster1 == cluster1);
		DISLOCATIONS_ASSERT(t1->cluster2 != cluster1);
		DISLOCATIONS_ASSERT(t1->inverse != NULL);
		DISLOCATIONS_ASSERT(t1->cluster2->masterCluster == NULL);
		DISLOCATIONS_ASSERT(t1->disabled == false);
		t1->priority = t1->numberOfBonds;
		if(t1->priority != numeric_limits<int>::max()) {
			ClusterTransition* t2 = t1->next;
			int counter5 = counter4;
			while(t2) {
				if(t2->cluster2 == t1->cluster2 && t2->transitionTM.equals(t1->transitionTM)) {
					if(t2->numberOfBonds != numeric_limits<int>::max())
						t1->priority += t2->numberOfBonds;
					else {
						t1->priority = t2->numberOfBonds;
						break;
					}
				}
				t2 = t2->next;
			}
		}
		t1->inverse->priority = t1->priority;
		t1 = t1->next;
	}

	// Join cluster rings.
	Cluster* temp = cluster1->nextCluster;
	cluster1->nextCluster = cluster2->nextCluster;
	cluster2->nextCluster = temp;

	numSuperClusters--;
}

// Joins adjacent crystallite clusters into a supercluster by re-orienting
// their atoms such that they are all aligned.
void DXAClustering::alignClusterOrientations(){
	LOG_INFO() << "Aligning cluster orientations.";

	// Ensures that each atom points to its root cluster.
	// This reduces failed lookups in getClusterTransition().
	// TODO: This is not exactly necessary, it is optional, but it is useful.
	for(auto &p : clusters){
		Cluster* cluster = p.second;
		// is already root
		if(cluster->masterCluster == nullptr) continue;
		Cluster* root = cluster->masterCluster;
		while(root->masterCluster){
			root = root->masterCluster;
		}
		// compression
		cluster->masterCluster = root;
	}

	#pragma omp parallel for
	for(int i = 0; i < static_cast<int>(inputAtoms.size()); ++i){
		InputAtom &atom = inputAtoms[i];
		if(atom.cluster && atom.cluster->masterCluster){
			atom.cluster = atom.cluster->masterCluster;
		}
	}

	// Disables borders with transitions marked as "disabled".
	#pragma omp parallel for
	for(int atomIdx = 0; atomIdx < static_cast<int>(inputAtoms.size()); ++atomIdx){
		InputAtom &atom = inputAtoms[atomIdx];
		// not crystalline
		if(atom.cluster == nullptr) continue;
		for(int n = 0; n < atom.numNeighbors; ++n){
			InputAtom* nb = atom.neighborAtom(n);
			if(nb->isDisordered()) continue;
			// same supercluster
			if(nb->cluster == atom.cluster) continue;
			if(!atom.isValidTransitionNeighbor(n)) continue;
			// transMatrix = T_nb * (T_atom) ^ (-1)
			LatticeOrientation transTM = nb->latticeOrientation * atom.determineTransitionMatrix(n).inverse();
			ClusterTransition* clusterTransition = getClusterTransition(atom.cluster, nb->cluster, transTM);
			// If there is no transition, it's okay, they are already merged.
			if(clusterTransition && clusterTransition->disabled){
				disableDisclinationBorderAtom(&atom);
				break;
			}
		}
	}

	// Adjusts the orientations of all atoms according to the final transformation of the (super)cluster to which they belong.
	#pragma omp parallel for
	for(int atomIdx = 0; atomIdx < static_cast<int>(inputAtoms.size()); ++atomIdx){
		InputAtom &atom = inputAtoms[atomIdx];
		if(atom.cluster == nullptr) continue;
		atom.latticeOrientation = atom.cluster->transformation * atom.latticeOrientation;
	}
}
