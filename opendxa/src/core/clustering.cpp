#include <opendxa/core/clustering.hpp>

/******************************************************************************
* Wraps input atoms at periodic boundary conditions.
******************************************************************************/
void DXAClustering::wrapInputAtoms(const Vector3 offset)
{
	// Apply an optional offset transformation to all atoms.
	if(offset != NULL_VECTOR) {
#pragma omp parallel for
		for(int i = 0; i < inputAtoms.size(); i++)
			inputAtoms[i].pos += offset;
	}

	// Make sure that all atoms are within the simulation cell.
	if(hasPeriodicBoundaries()) {
#pragma omp parallel for
		for(int i = 0; i < inputAtoms.size(); i++) {
			inputAtoms[i].pos = wrapPoint(inputAtoms[i].pos);
		}
	}
}

/******************************************************************************
* High-level function that performs the complete clustering of crystalline atoms.
******************************************************************************/
void DXAClustering::clusterAtoms()
{
	determineDistanceFromDefects();

	for(int level = 0; level < NUM_RECURSIVE_WALK_PRIORITIES; level++)
		clusterCrystallineAtoms(level);

	createClusterTransitions();

	// Insert transitions into array.
	vector<ClusterTransition*> clusterTransitions;
	for(map<int, Cluster*>::const_iterator iter1 = clusters.begin(); iter1 != clusters.end(); ++iter1)
		for(ClusterTransition* transition = iter1->second->transitions; transition != NULL; transition = transition->next) {
			clusterTransitions.push_back(transition);
			transition->priority = transition->numberOfBonds;
		}

	createSuperclusters(clusterTransitions);

	for(map<int, Cluster*>::const_iterator iter1 = clusters.begin(); iter1 != clusters.end(); ++iter1) {
		Cluster* cluster = iter1->second;
		cluster->transitions = cluster->originalTransitions;
		for(ClusterTransition* transition = cluster->transitions; transition != NULL; transition = transition->next) {
			transition->transitionTM = transition->originalTransitionTM;
			transition->cluster1 = transition->originalCluster1;
			transition->cluster2 = transition->originalCluster2;
			transition->next = transition->originalNext;
		}
	}

	alignClusterOrientations();

	// Mark atoms which have at least one disordered neighbor.
#pragma omp parallel for
	for(int atomIndex = 0; atomIndex < numLocalInputAtoms; atomIndex++) {
		InputAtom& atom = inputAtoms[atomIndex];
		if(atom.isDisordered()) continue;
		for(int n = 0; n < atom.numNeighbors; n++) {
			if(atom.neighborAtom(n)->isDisordered()) {
				atom.setFlag(ATOM_NON_BULK);
				break;
			}
		}
	}
}

/******************************************************************************
* Create a new instance of the Cluster structure and adds it to the
* global list.
******************************************************************************/
Cluster* DXAClustering::createCluster(int id, int processor)
{
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

/******************************************************************************
* Create a new instance of the Cluster structure if necessary.
* If there is an existing instance for the given ID the returns
* this instance.
******************************************************************************/
Cluster* DXAClustering::createClusterOnDemand(int id, int processor)
{
	// The special NULL cluster has ID -1.
	if(id < 0) return NULL;

	// Lookup existing cluster.
	Cluster* cluster = getCluster(id);
	if(cluster) return cluster;

	// Create new one.
	return createCluster(id, processor);
}

/******************************************************************************
* Brings the neighbors of crystalline atoms into a fixed order.
******************************************************************************/
void DXAClustering::orderCrystallineAtoms(){
	LOG_INFO() << "Ordering neighbors of crystalline atoms.";

	firstGhostAtom = inputAtoms.begin() + numLocalInputAtoms;

	// Order the neighbors of crystalline atoms.
#pragma omp parallel for
	for(int atomIndex = 0; atomIndex < numLocalInputAtoms; atomIndex++) {
		InputAtom& atom = inputAtoms[atomIndex];
		DISLOCATIONS_ASSERT(atom.isLocalAtom());
		if(atom.isFCC())
			orderFCCAtomNeighbors(&atom);
		else if(atom.isHCP())
			orderHCPAtomNeighbors(&atom);
		else if(atom.isBCC())
			orderBCCAtomNeighbors(&atom);
	}

	numDisclinationAtoms = 0;
}

/******************************************************************************
* Calculates the distance from the nearest crystal defect for each
* crystalline atoms.
******************************************************************************/
void DXAClustering::determineDistanceFromDefects()
{
	LOG_INFO() << "Determining distances from nearest crystal defect.";

	// Reset fields.
	for(int atomIndex = 0; atomIndex < (int)inputAtoms.size(); atomIndex++) {
		InputAtom& atom = inputAtoms[atomIndex];
		atom.clearVisitFlag();
		atom.defectProximity = 0;
		atom.cluster = NULL;
	}

	// Number the atoms according to their distance from the nearest defect.
	// This is required to give atoms far away from the defects a higher priority during the recursive walk.
	for(int level = NUM_RECURSIVE_WALK_PRIORITIES - 1; level >= 0; --level) {
#pragma omp parallel for
		for(int atomIndex = 0; atomIndex < (int)inputAtoms.size(); atomIndex++) {
			InputAtom& atom = inputAtoms[atomIndex];
			if(atom.isDisordered() || atom.wasVisited()) continue;
			for(int n = 0; n < atom.numNeighbors; n++) {
				InputAtom* neighbor = atom.neighborAtom(n);
				if(neighbor->isDisordered() && neighbor->testFlag(ATOM_DISABLED_GHOST) == false) {
					DISLOCATIONS_ASSERT(level == NUM_RECURSIVE_WALK_PRIORITIES - 1);
					atom.defectProximity = NUM_RECURSIVE_WALK_PRIORITIES - 1;
					atom.setVisitFlag();
					break;
				}
				else if(neighbor->wasVisited() && neighbor->defectProximity != level) {
					DISLOCATIONS_ASSERT(neighbor->isCrystalline());
					DISLOCATIONS_ASSERT(level != NUM_RECURSIVE_WALK_PRIORITIES);
					atom.defectProximity = level;
					atom.setVisitFlag();
					break;
				}
			}
		}
	}
}

/******************************************************************************
* Builds up (local) clusters of connected crystalline atoms.
******************************************************************************/
void DXAClustering::clusterCrystallineAtoms(int level)
{
	LOG_INFO() << "Decomposing crystalline atoms into clusters (pass " << level << ").";

	// First grow any existing clusters.
	if(level > 0) {
		deque<InputAtom*> toprocess;	// This stack contains all atoms that have to be processed recursively.

		// Iterate over all local atoms that are already part of a cluster.
		for(vector<InputAtom>::iterator atom = inputAtoms.begin(); atom != firstGhostAtom; ++atom) {
			// Skip atoms that are not yet part of a cluster.
			if(atom->cluster == NULL) continue;
			// Skip atoms that are not on the previous level.
			if(atom->defectProximity != level - 1) continue;
			DISLOCATIONS_ASSERT(atom->testFlag(ATOM_ON_THE_STACK) == false);

			// Put neighbors onto the recursive stack.
			for(int n = 0; n < atom->numNeighbors; n++) {
				DISLOCATIONS_ASSERT(atom->neighborAtom(n)->isDisordered() || atom->neighborAtom(n)->hasNeighbor(&*atom));
				if(!isValidClusterNeighbor(&*atom, n, level)) continue;
				LatticeOrientation transitionTM = atom->determineTransitionMatrix(n);
				clusterNeighbor(&*atom, atom->neighborAtom(n), transitionTM, toprocess, level);
			}
		}

		// Process all atoms on the recursive stack until it is empty.
		while(toprocess.empty() == false) {
			InputAtom* currentAtom = toprocess.front();
			toprocess.pop_front();
			currentAtom->clearFlag(ATOM_ON_THE_STACK);

			for(int n = 0; n < currentAtom->numNeighbors; n++) {
				if(!isValidClusterNeighbor(currentAtom, n, level)) continue;
				LatticeOrientation transitionTM = currentAtom->determineTransitionMatrix(n);
				clusterNeighbor(currentAtom, currentAtom->neighborAtom(n), transitionTM, toprocess, level);
			}
		}
	}

	// Create new clusters from atoms which have not been visited yet.
	for(vector<InputAtom>::iterator seedAtom = inputAtoms.begin(); seedAtom != firstGhostAtom; ++seedAtom) {
		// Skip atoms that are already part of a cluster.
		if(seedAtom->cluster != NULL) continue;
		// Skip non-crystalline atoms.
		if(seedAtom->isDisordered()) continue;
		// Skip atoms that are not on the current level.
		if(seedAtom->defectProximity != level) continue;

		// Initialize orientation.
		seedAtom->latticeOrientation = IDENTITY;

		// Recursively iterate over all nearest neighbors of the seed atom and put them into the same cluster too.
		// Initialize recursive walk stack.
		deque<InputAtom*> toprocess;	// This stack contains all atoms that still have to be processed.
		toprocess.push_back(&*seedAtom);
		seedAtom->cluster = createCluster(seedAtom->tag, processor);	// Use atom tag as cluster ID. It's unique throughout the system.
		DISLOCATIONS_ASSERT(seedAtom->testFlag(ATOM_ON_THE_STACK) == false);
		seedAtom->setFlag(ATOM_ON_THE_STACK);
		numClusters++;

		// Process all atoms on the recursive stack until it is empty.
		do {
			// Take next atom from the recursive stack.
			InputAtom* currentAtom = toprocess.front();
			toprocess.pop_front();
			currentAtom->clearFlag(ATOM_ON_THE_STACK);

			for(int n = 0; n < currentAtom->numNeighbors; n++) {
				DISLOCATIONS_ASSERT(currentAtom->neighborAtom(n)->isDisordered() || currentAtom->neighborAtom(n)->hasNeighbor(currentAtom));
				if(!isValidClusterNeighbor(currentAtom, n, level)) continue;
				LatticeOrientation transitionTM = currentAtom->determineTransitionMatrix(n);
				clusterNeighbor(currentAtom, currentAtom->neighborAtom(n), transitionTM, toprocess, level);
			}
		}
		while(toprocess.empty() == false);
	}
}

/******************************************************************************
* Decides whether the given neighbor atom will be made part of the same cluster
* as the source atom.
******************************************************************************/
bool DXAClustering::isValidClusterNeighbor(InputAtom* currentAtom, int neighborIndex, int level)
{
	InputAtom* neighbor = currentAtom->neighborAtom(neighborIndex);

	// Skip ghost atoms.
	if(neighbor->isNonLocalAtom()) return false;

	// Continue only with crystalline atoms.
	if(neighbor->isDisordered()) return false;

	// Not all neighbors of a crystalline atom can be traversed.
	if(currentAtom->isValidTransitionNeighbor(neighborIndex) == false) return false;

	// Continue only with atoms with the same or a higher priority.
	if(neighbor->defectProximity > level) return false;

	// Skip neighbors which are on the stack or from another cluster.
	if(neighbor->cluster != NULL) {
		if(neighbor->cluster != currentAtom->cluster) return false;
		if(neighbor->testFlag(ATOM_ON_THE_STACK)) return false;
	}

	return true;
}

/******************************************************************************
* Makes a neighbor atom part of the crystallite cluster and puts it
* on the recursive stack.
* Assigns the lattice orientation matrix and detects intra-cluster
* disclinations.
******************************************************************************/
void DXAClustering::clusterNeighbor(InputAtom* currentAtom, InputAtom* neighbor, const LatticeOrientation& neighborLatticeOrientation, deque<InputAtom*>& toprocess, int level)
{
	// Is the neighbor not part of this cluster yet?
	if(neighbor->cluster == NULL) {
		neighbor->latticeOrientation = neighborLatticeOrientation;
		neighbor->cluster = currentAtom->cluster;
		// Put it onto the recursive stack.
		neighbor->setFlag(ATOM_ON_THE_STACK);
		toprocess.push_back(neighbor);
	}
	else {
		DISLOCATIONS_ASSERT(neighbor->testFlag(ATOM_ON_THE_STACK) == false);
		DISLOCATIONS_ASSERT(neighbor->cluster == currentAtom->cluster);
		// If we have processed this atom before then check the lattice orientation.
		// We might have encountered a disclination.
		// If the two orientations are not equal then a disclination must have been enclosed by the recursive walk.
		if(neighbor->latticeOrientation.equals(neighborLatticeOrientation) == false) {
			// Disable the other crystalline atom to create a barrier.
			// This prevents Burgers circuits from being traced around the disclination.
			disableDisclinationBorderAtom(neighbor);
		}
	}
}

/******************************************************************************
* Marks the given crystalline atoms as a disclination border atom and
* disables it such that it becomes a barrier for Burgers circuit tracing.
******************************************************************************/
void DXAClustering::disableDisclinationBorderAtom(InputAtom* atom)
{
	if(atom->isLocalAtom() && atom->testFlag(ATOM_DISCLINATION_BORDER) == false)
		numDisclinationAtoms++;

	atom->setCNAType(UNDEFINED);
	atom->setFlag(ATOM_DISCLINATION_BORDER);
	atom->numNeighbors = 0;
	atom->cluster = NULL;
}

/******************************************************************************
* Calculates the transition matrices between all clusters.
******************************************************************************/
void DXAClustering::createClusterTransitions()
{
	LOG_INFO() << "Calculating cluster transition matrices.";
	// Iterate over all local atoms that are part of a crystalline cluster.
	for(vector<InputAtom>::iterator atom = inputAtoms.begin(); atom != firstGhostAtom; ++atom) {
		// Skip atoms that are not part of a cluster.
		if(atom->cluster == NULL) continue;
		DISLOCATIONS_ASSERT(atom->isCrystalline());

		// Iterate over all its crystalline neighbors, which are part of a cluster as well.
		for(int n = 0; n < atom->numNeighbors; n++) {
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

			if(neighbor->cluster != atom->cluster) {
				// The source cluster should reside on the current processor.
				DISLOCATIONS_ASSERT(atom->cluster->processor == this->processor);

				// Register a cluster-cluster transition.
				ClusterTransition* transition12 = createClusterTransitionOnDemand(atom->cluster, neighbor->cluster, transitionTM);

				if(neighbor->cluster->processor == this->processor) {
					// Also register the inverse transition if the second cluster is on the some processor.
					ClusterTransition* transition21 = createClusterTransitionOnDemand(neighbor->cluster, atom->cluster, transitionTM.inverse());
					transition12->numberOfBonds++;
					transition21->numberOfBonds++;
					transition12->inverse = transition21;
					transition21->inverse = transition12;
				}
				else {
					DISLOCATIONS_ASSERT(transition12->inverse == NULL);
					transition12->numberOfBonds++;
				}
			}
			else {
				// Detect disclinations for intra-cluster transitions.
				if(transitionTM.equals(IDENTITY) == false) {
					disableDisclinationBorderAtom(&*atom);
					break;
				}
			}
		}
	}
}

/******************************************************************************
* Registers a cluster-cluster transition. Returns the existing
* transition structure if an identical transition has already been registered
* before.
******************************************************************************/
ClusterTransition* DXAClustering::createClusterTransitionOnDemand(Cluster* cluster1, Cluster* cluster2, const LatticeOrientation& transitionTM)
{
	// Lookup existing transition.
	ClusterTransition* transition = getClusterTransition(cluster1, cluster2, transitionTM);
	if(transition) return transition;

	// Create a new transition.
	return createClusterTransition(cluster1, cluster2, transitionTM);
}

/******************************************************************************
* Registers a new cluster-cluster transition.
******************************************************************************/
ClusterTransition* DXAClustering::createClusterTransition(Cluster* cluster1, Cluster* cluster2, const LatticeOrientation& transitionTM)
{
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
inline bool transitionCompare(ClusterTransition* t1, ClusterTransition* t2) { return t1->priority < t2->priority; }

/******************************************************************************
* Joins adjacent crystallite clusters into supercluster and aligns them.
* The joining starts at cluster-cluster transitions with high priority
* (i.e. large number of bonds). This ensures that the number of crystalline atoms
* which have to be disabled to avoid disclinations is minimal.
******************************************************************************/
void DXAClustering::createSuperclusters(vector<ClusterTransition*>& clusterTransitions)
{
	DISLOCATIONS_ASSERT(numClusterTransitions == (int)clusterTransitions.size());

	LOG_INFO() << "Joining " << clusters.size() << " crystallite clusters into superclusters.";
	numClusterDisclinations = 0;

	// In the beginning, each cluster is considered a supercluster.
	numSuperClusters = clusters.size();

	// Create a sorted list of remaining cluster-cluster transitions.
	list<ClusterTransition*> priorityStack(clusterTransitions.begin(), clusterTransitions.end());

	// Join clusters, starting with the transitions with the highest priority.
	while(!priorityStack.empty()) {
		// Keep the priority stack sorted.
		priorityStack.sort(transitionCompare);

		// Take the transition with the highest priority from the top of the stack.
		ClusterTransition* t = priorityStack.back();
		priorityStack.pop_back();

		DISLOCATIONS_ASSERT(t->inverse != NULL && t->inverse->inverse == t);
		DISLOCATIONS_ASSERT(t->inverse->transitionTM.equals(t->transitionTM.inverse()));

		// Join the two clusters.
		joinClusters(t, priorityStack);
	}

	LOG_INFO() << "Number of super clusters: " << numSuperClusters;
	if(numDisclinationAtoms || numClusterDisclinations) {
		LOG_INFO() << "Detected at least one disclination:";
		LOG_INFO() << "  Number of inter-cluster disclinations: " << numClusterDisclinations;
		LOG_INFO() << "  Number of disabled disclination atoms: " << numDisclinationAtoms;
	}
}

/******************************************************************************
* Joins two adjacent clusters into one larger cluster.
* ******************************************************************************/
void DXAClustering::joinClusters(ClusterTransition* transition, list<ClusterTransition*>& priorityStack)
{
	DISLOCATIONS_ASSERT(transition->disabled == false);
	Cluster* cluster1 = transition->cluster1;
	Cluster* cluster2 = transition->cluster2;
	ClusterTransition* inverseTransition = transition->inverse;

	DISLOCATIONS_ASSERT(cluster1 != cluster2);
	DISLOCATIONS_ASSERT(cluster1->masterCluster == NULL);
	DISLOCATIONS_ASSERT(cluster2->masterCluster == NULL);

	std::cout << "Joining clusters " << std::to_string(cluster1->id) << " and " << std::to_string(cluster2->id) << std::endl;

	ClusterTransition* t;

	// Transform all orientations of cluster 2 to align with cluster 1.
	LatticeOrientation newTransformation = cluster1->transformation * inverseTransition->transitionTM;
	LatticeOrientation diffTransformation = newTransformation * cluster2->transformation.inverse();
	Cluster* c = cluster2;
	do {
		DISLOCATIONS_ASSERT(c->masterCluster == cluster2 || c == cluster2);
		DISLOCATIONS_ASSERT(c->transitions == NULL || c == cluster2);

		c->transformation = diffTransformation * c->transformation;
		c->masterCluster = cluster1;
		c = c->nextCluster;
	}
	while(c != cluster2);

	// Re-wire transitions. All transitions pointing to/from cluster 2 will be transfered to cluster 1.
	ClusterTransition* t2 = cluster2->transitions;
	while(t2) {
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
	while(t) {
		DISLOCATIONS_ASSERT(t->cluster1 == cluster1);
		DISLOCATIONS_ASSERT(t->inverse != NULL);
		ClusterTransition* next = t->next;
		if(t->cluster2 == cluster1) {
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
	while(t1) {
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

/******************************************************************************
* Joins adjacent crystallite clusters into a supercluster by re-orienting
* their atoms such that they are all aligned.
******************************************************************************/
void DXAClustering::alignClusterOrientations()
{
	LOG_INFO() << "Aligning cluster orientations.";

	// Some cluster-cluster transitions might have been disabled before to
	// avoid disclinations. We now have to disable the corresponding border atoms.
#pragma omp parallel for
	for(int atomIndex = 0; atomIndex < (int)inputAtoms.size(); atomIndex++) {
		InputAtom& atom = inputAtoms[atomIndex];
		// Skip atoms that are not part of a cluster.
		if(atom.cluster == NULL) continue;
		DISLOCATIONS_ASSERT(atom.isCrystalline());

		// Iterate over all crystalline neighbors.
		for(int n = 0; n < atom.numNeighbors; n++) {
			InputAtom* neighbor = atom.neighborAtom(n);
			if(neighbor->isDisordered()) continue;
			DISLOCATIONS_ASSERT(neighbor->cluster != NULL);

			// Not all neighbors of a crystalline atom can be traversed.
			if(atom.isValidTransitionNeighbor(n) == false) continue;

			// If both atoms belong to the same cluster, we're done.
			// Intra-cluster disclinations have been handled before.
			if(neighbor->cluster == atom.cluster) continue;

			// Calculate cluster-cluster transition matrix.
			LatticeOrientation neighborLatticeOrientation = atom.determineTransitionMatrix(n);
			LatticeOrientation transitionTM = neighbor->latticeOrientation * neighborLatticeOrientation.inverse();

			// Look up corresponding transition structure.
			ClusterTransition* clusterTrans = getClusterTransition(atom.cluster, neighbor->cluster, transitionTM);
			DISLOCATIONS_ASSERT(clusterTrans != NULL);

			// Disable atom if transition was disabled.
			if(clusterTrans->disabled) {
				disableDisclinationBorderAtom(&atom);
				break;
			}
		}
	}

	// Re-orient atoms in all clusters to form superclusters.
#pragma omp parallel for
	for(int atomIndex = 0; atomIndex < (int)inputAtoms.size(); atomIndex++) {
		InputAtom& atom = inputAtoms[atomIndex];
		// Skip atoms that are not part of a cluster.
		if(atom.cluster == NULL) continue;
		// Align cluster's lattice orientation.
		atom.latticeOrientation = atom.cluster->transformation * atom.latticeOrientation;
	}
}

