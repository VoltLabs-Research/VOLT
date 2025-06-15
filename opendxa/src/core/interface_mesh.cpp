#include <opendxa/core/interface_mesh.hpp>
#include <opendxa/structures/mesh/mesh.hpp>
#include <opendxa/utils/timer.hpp>

void DXAInterfaceMesh::cleanup(){
	DXAClustering::cleanup();
	nodes.clear();
	nodePool.clear();
	facets.clear();
	facetPool.clear();
	outputMesh.clear();
	outputMeshCap.clear();
}

DXAInterfaceMesh::DXAInterfaceMesh(): DXAClustering(){}

/******************************************************************************
* For each non-crystalline atom that has at least one crystalline neighbor
* (the so-called interface atoms) a node is created for the interface mesh.
******************************************************************************/
void DXAInterfaceMesh::createInterfaceMeshNodes()
{
	LOG_INFO() << "Creating interface mesh nodes.";
	Timer timer;

	// Reset recursive walk counters.
	// And reset neighbor lists for disordered atoms.
	for(vector<InputAtom>::iterator atom = inputAtoms.begin(); atom != inputAtoms.end(); ++atom)
		atom->recursiveDepth = numeric_limits<int>::max();

	// Convert first layer of disordered atoms into mesh nodes.
	for(vector<InputAtom>::iterator atom = inputAtoms.begin(); atom != inputAtoms.end(); ++atom) {
		if(atom->isDisordered() || atom->testFlag(ATOM_NON_BULK) == false) continue;

		// Iterate over all disordered neighbors.
		for(int i = 0; i < atom->numNeighbors; i++) {
			BaseAtom* neighbor1 = atom->neighbor(i);
			if(neighbor1 == NULL || neighbor1->isCrystalline()) continue;

			// Is it already a mesh node?
			if(neighbor1->isMeshNode() == false) {

				// Replace input atom with mesh node.
				MeshNode* node = nodePool.construct(*neighbor1);
				node->index = nodes.size();
				nodes.push_back(node);

				// Also replace the atom with the node in neighbor lists of all nearby crystalline atoms.
				vector<InputAtom*> visitedAtoms;
				createMeshNodeRecursive(&*atom, neighbor1, node, 0, visitedAtoms, ORIGIN - atom->latticeNeighborVector(i));

				// Reset visit flags.
				for(vector<InputAtom*>::const_iterator a = visitedAtoms.begin(); a != visitedAtoms.end(); ++a)
					(*a)->recursiveDepth = numeric_limits<int>::max();

				neighbor1 = node;
			}

			// Create neighbor list of mesh node.
			for(int j = 0; j < i; j++) {
				if(atom->neighborBond(i, j)) {
					BaseAtom* neighbor2 = atom->neighbor(j);
					if(neighbor2 == NULL || neighbor2->isMeshNode() == false) continue;
					if(neighbor1->hasNeighbor(neighbor2) == false) {
						DISLOCATIONS_ASSERT(neighbor1->pos != neighbor2->pos);
						neighbor1->addNeighbor(neighbor2);
						neighbor2->addNeighbor(neighbor1);
					}
				}
			}
		}
	}

	// Determine the maximum number of neighbors.
	int maxNodeNeighbors = 0;
	for(vector<MeshNode*>::iterator node = nodes.begin(); node != nodes.end(); ++node)
		if((*node)->numNeighbors > maxNodeNeighbors)
			maxNodeNeighbors = (*node)->numNeighbors;

	LOG_INFO() << "Generated " << nodes.size() << " interface mesh nodes (" << (nodePool.memoryUsage()/1024/1024) << " mbyte).";
	LOG_INFO() << "Maximum number of nearest neighbors per node: " << maxNodeNeighbors;
	LOG_INFO() << "Node creation time: " << timer.elapsedTime() << " sec.";
}

/******************************************************************************************
* Replaces an input atom with a mesh node in the neighbors list of all surrounding atoms.
*******************************************************************************************/
void DXAInterfaceMesh::createMeshNodeRecursive(InputAtom* a, BaseAtom* neighbor, MeshNode* node, int currentDepth, vector<InputAtom*>& visitedAtoms, const Point3& currentCoord)
{
	visitedAtoms.push_back(a);
	a->recursiveDepth = currentDepth;
	for(int i = 0; i < a->numNeighbors; i++) {
		if(a->neighbor(i) == neighbor) {
			Point3 nodeCoord = currentCoord + a->latticeNeighborVector(i);
			if(nodeCoord.equals(ORIGIN)) {
				// Replace atom in neighbor list with mesh node.
				a->setNeighbor(i, node);
				node->addNeighbor(a);

				// Extend the recursive walk by resetting the depth counter.
				currentDepth = 0;
			}
		}
	}
	// Stop recursive walk when maximum depth is reached.
	if(currentDepth >= MAX_RECURSIVE_ATOM_REPLACEMENT_DEPTH) return;

	currentDepth++;
	for(int j = 0; j < a->numNeighbors; j++) {
		BaseAtom* neighbor2 = a->neighbor(j);
		if(neighbor2 == NULL || neighbor2->isDisordered() || neighbor2->testFlag(ATOM_NON_BULK) == false) continue;
		DISLOCATIONS_ASSERT(neighbor2->isMeshNode() == false);
		InputAtom* inputNeighbor2 = static_cast<InputAtom*>(neighbor2);
		if(inputNeighbor2->recursiveDepth > currentDepth) {
			createMeshNodeRecursive(inputNeighbor2, neighbor, node, currentDepth, visitedAtoms, currentCoord + a->latticeNeighborVector(j));
		}
	}
}

/******************************************************************************
* Creates the interface mesh edges.
******************************************************************************/
void DXAInterfaceMesh::createInterfaceMeshEdges()
{
	LOG_INFO() << "Creating interface mesh edges.";
	Timer timer;

	for(vector<InputAtom>::iterator atom = inputAtoms.begin(); atom != inputAtoms.end(); ++atom) {

		// Do an early rejection of bulk atoms, which are not adjacent to the interface mesh.
		if(atom->testFlag(ATOM_NON_BULK) == false) continue;

		switch(atom->cnaType) {
		case FCC:
		case HCP:
			createFCCHCPMeshEdges(&*atom);
			break;
		case BCC:
			createBCCMeshEdges(&*atom);
			break;
		}
}

	LOG_INFO() << "Edge creation time: " << timer.elapsedTime() << " sec.";
}

/******************************************************************************
* Creates the edges around FCC and HCP atoms.
******************************************************************************/
void DXAInterfaceMesh::createFCCHCPMeshEdges(InputAtom* atom)
{
	const CrystalLatticeType& lattice = atom->latticeType();
	for(int tet = 0; tet < lattice.numTetrahedra; tet++) {
		MeshNode* vertices[3];
		LatticeVector latticeVectors[3];
		for(int v = 0; v < 3; v++) {
			BaseAtom* neighbor = atom->neighbor(lattice.tetrahedra[tet].neighborIndices[v]);
			if(neighbor && neighbor->isMeshNode())
				vertices[v] = static_cast<MeshNode*>(neighbor);
			else {
				vertices[v] = NULL;
			}
			latticeVectors[v] = atom->latticeOrientation * lattice.tetrahedra[tet].neighborVectors[v];
		}
		for(int v = 0; v < 3; v++) {
			MeshNode* vertex = vertices[v];
			if(!vertex) continue;
			int v1 = (v+1)%3;
			MeshNode* vother1 = vertices[v1];
			if(!vother1) continue;
			vertex->createEdge(vother1, latticeVectors[v1] - latticeVectors[v]);
		}
	}
}

// Creates the edges around BCC atoms.
void DXAInterfaceMesh::createBCCMeshEdges(InputAtom* atom){
	const CrystalLatticeType& lattice = atom->latticeType();
	for(int quad = 0; quad < lattice.numQuads; ++quad){
		// 4 NN (Nearest Neighbors) + 1 SNN (Second Nearest Neighbor)
		MeshNode *v[5] = { nullptr };
		LatticeVector lv[5];
		// first-order neighbors (contour)
		bool allNN = true;
		for(int i = 0; i < 4; ++i){
			BaseAtom* nb = atom->neighbor(lattice.quads[quad].neighborIndices[i]);
			if(nb && nb->isMeshNode()){
				v[i] = static_cast<MeshNode*>(nb);
			}else{
				// the quad is not complete
				allNN = false;
			}
			lv[i] = atom->latticeOrientation * lattice.quads[quad].neighborVectors[i];
		}

		// second neighbor (center of the quad)
		BaseAtom* nb2 = atom->neighbor(lattice.quads[quad].secondNearestNeighbor);
		if(nb2 && nb2->isMeshNode()){
			v[4] = static_cast<MeshNode*>(nb2);
			lv[4] = atom->latticeOrientation * lattice.neighborVectors[lattice.quads[quad].secondNearestNeighbor];
		}

		// Boundary edges if all 4 vertices exist
		if(allNN){
			for(int i = 0; i < 4; ++i){
				int j = (i + 1) & 3;
				v[i]->createEdge(v[j], lv[j] - lv[i]);
			}
		}

		// Radial edges towards the central vertex
		if(v[4]){
			for(int i = 0; i < 4; ++i){
				if(!v[i]) continue;
				// vector = r_center - r_i in grid coordinates
				LatticeVector rel = lv[4] - lv[i];
				v[i]->createEdge(v[4], rel);
			}
		}
	}
}

/******************************************************************************
* Creates the facets of the interface mesh.
******************************************************************************/
void DXAInterfaceMesh::createInterfaceMeshFacets()
{
	LOG_INFO() << "Creating interface mesh facets.";
	Timer timer;

	for(vector<InputAtom>::iterator atom = inputAtoms.begin(); atom != inputAtoms.end(); ++atom) {

		// Do an early rejection of bulk atoms, which are not adjacent to the interface mesh.
		if(atom->testFlag(ATOM_NON_BULK) == false) continue;

		switch(atom->cnaType) {
		case FCC:
		case HCP:
			createFCCHCPMeshFacets(&*atom);
			break;
		case BCC:
			createBCCMeshFacets(&*atom);
			break;
		}
	}
	// Close the remaining holes in the interface mesh.
	closeFacetHoles();

	validateInterfaceMesh();

	// Fix facet-edge connectivity.
	fixMeshEdges();

	// Remove facets, which are useless.
	removeUnnecessaryFacets();

	// Create copies of mesh nodes, which are part of locally independent manifolds.
	duplicateSharedMeshNodes();

	LOG_INFO() << "Generated " << facets.size() << " interface mesh facets (" << (facetPool.memoryUsage()/1024/1024) << " mbyte).";
	LOG_INFO() << "Facet creation time: " << timer.elapsedTime() << " sec.";
}


/******************************************************************************
* Creates the triangle facets surrounding a FCC or HCP atom.
******************************************************************************/
void DXAInterfaceMesh::createFCCHCPMeshFacets(InputAtom* atom)
{
	// Create facets for all tetrahedra and adjacent quads and triangles.
	// Process each tetrahedron.
	const CrystalLatticeType& lattice = atom->latticeType();
	for(int tet = 0; tet < lattice.numTetrahedra; tet++) {

		MeshNode* vertices[3];
		LatticeVector latticeVectors[3];
		bool allNeighborsAreNodes = true;
		for(int v = 0; v < 3; v++) {
			BaseAtom* neighbor = atom->neighbor(lattice.tetrahedra[tet].neighborIndices[v]);
			if(neighbor && neighbor->isMeshNode())
				vertices[v] = static_cast<MeshNode*>(neighbor);
			else {
				vertices[v] = NULL;
				allNeighborsAreNodes = false;
			}
			latticeVectors[v] = atom->latticeOrientation * lattice.tetrahedra[tet].neighborVectors[v];
		}

		// Calculate lattice vectors from neighbor to neighbor.
		LatticeVector edgeLatticeVectors[3];
		edgeLatticeVectors[0] = latticeVectors[1] - latticeVectors[0];
		edgeLatticeVectors[1] = latticeVectors[2] - latticeVectors[1];
		edgeLatticeVectors[2] = latticeVectors[0] - latticeVectors[2];

		// Create a triangle facet that connects all three neighbors.
		if(allNeighborsAreNodes)
			createFacetAndEdges(3, vertices, edgeLatticeVectors);

		for(int v = 0; v < 3; v++) {
			MeshNode* vertex = vertices[v];
			if(!vertex) continue;

			int v1 = (v+1)%3;
			MeshNode* vother1 = vertices[v1];
			if(!vother1) continue;

			// Try to create a triangle. If this is not possible, try to create a quad facet.
			if(createAdjacentTriangle(vertex, vother1, &*atom, edgeLatticeVectors[v1], edgeLatticeVectors[v]) == false) {
				int v2 = (v+2)%3;
				createAdjacentQuad(&*atom, vother1, vertex, edgeLatticeVectors[v], latticeVectors[v2]);
			}
		}
	}
}

/******************************************************************************
* Creates the triangle facets surrounding a BCC atom.
******************************************************************************/
void DXAInterfaceMesh::createBCCMeshFacets(InputAtom* atom)
{
	// Create facets for all quads.
	const CrystalLatticeType& lattice = atom->latticeType();
	for(int quad = 0; quad < lattice.numQuads; quad++) {

		MeshNode* vertices[5];
		LatticeVector latticeVectors[5];
		bool allNearestNeighborsAreNodes = true;

		BaseAtom* secondNeighbor = atom->neighbor(lattice.quads[quad].secondNearestNeighbor);
		if(secondNeighbor == NULL) continue;
		vertices[4] = secondNeighbor->isMeshNode() ? static_cast<MeshNode*>(secondNeighbor) : NULL;
		latticeVectors[4] = atom->latticeOrientation * lattice.neighborVectors[lattice.quads[quad].secondNearestNeighbor];

		for(int v = 0; v < 4; v++) {
			BaseAtom* neighbor = atom->neighbor(lattice.quads[quad].neighborIndices[v]);
			if(neighbor && neighbor->isMeshNode())
				vertices[v] = static_cast<MeshNode*>(neighbor);
			else {
				DISLOCATIONS_ASSERT(neighbor == NULL || neighbor->neighborIndexTag(secondNeighbor->tag) < 8);
				vertices[v] = NULL;
				allNearestNeighborsAreNodes = false;
			}
			latticeVectors[v] = atom->latticeOrientation * lattice.quads[quad].neighborVectors[v];
		}

		// Calculate lattice vectors from neighbor to neighbor.
		LatticeVector edgeLatticeVectors[4];
		edgeLatticeVectors[0] = latticeVectors[1] - latticeVectors[0];
		edgeLatticeVectors[1] = latticeVectors[2] - latticeVectors[1];
		edgeLatticeVectors[2] = latticeVectors[3] - latticeVectors[2];
		edgeLatticeVectors[3] = latticeVectors[0] - latticeVectors[3];

		if(allNearestNeighborsAreNodes) {
			// Create a quad facet that connects all four neighbors.
			createFacetAndEdges(4, vertices, edgeLatticeVectors);
		}
		else if(vertices[4] != NULL) {
			for(int v1 = 0; v1 < 4; v1++) {
				int v2 = (v1 + 1) % 4;
				if(vertices[v1] != NULL && vertices[v2] != NULL) {
					MeshNode* triangleVertices[3] = { vertices[v1], vertices[v2], vertices[4] };
					LatticeVector triangleEdgeLatticeVectors[3] = { latticeVectors[v2] - latticeVectors[v1], latticeVectors[4] - latticeVectors[v2], latticeVectors[v1] - latticeVectors[4] };
					createFacetAndEdges(3, triangleVertices, triangleEdgeLatticeVectors);
				}
			}
		}
	}
}


/******************************************************************************
* Tries to create a facet adjacent to a FCC/HCP tetrahedron.
******************************************************************************/
bool DXAInterfaceMesh::createAdjacentTriangle(MeshNode* center, MeshNode* vertex1, BaseAtom* vertex2, const LatticeVector& edgeVector1, const LatticeVector& edgeVector2)
{
	for(int n1 = 0; n1 < center->numNeighbors; n1++) {
		BaseAtom* neighbor1 = center->neighbor(n1);

		if(neighbor1->tag == vertex1->tag) continue;
		if(neighbor1->tag == vertex2->tag) continue;
		if(vertex1->hasNeighbor(neighbor1) == false) continue;

		for(int n2 = 0; n2 < center->numNeighbors; n2++) {
			if(n2 == n1) continue;
			BaseAtom* neighbor2 = center->neighbor(n2);
			if(neighbor2->tag == vertex1->tag) continue;
			if(neighbor2->tag == vertex2->tag) continue;
			if(vertex2->hasNeighbor(neighbor2) == false) continue;
			if(neighbor1->hasNeighbor(neighbor2) == false) continue;
			if(neighbor1->hasNeighbor(vertex2)) continue;
			if(neighbor2->hasNeighbor(vertex1)) continue;

			if(neighbor1->isMeshNode()) {

				bool isValid = !neighbor2->isMeshNode();

				if(!isValid) {
					for(int n3 = 0; n3 < vertex2->numNeighbors; n3++) {
						if(n3 == n1 || n3 == n2) continue;
						BaseAtom* neighbor3 = vertex2->neighbor(n3);
						if(neighbor3 == NULL) continue;
						if(neighbor3->tag == vertex1->tag) continue;
						if(neighbor3->tag == center->tag) continue;
						if(neighbor3->hasNeighbor(neighbor2) == false) continue;
						if(neighbor3->hasNeighbor(neighbor1) == false) continue;
						if(neighbor3->hasNeighbor(vertex1) == false) continue;
						if(neighbor3->hasNeighbor(center)) continue;

						if(neighbor3->isMeshNode() == false)
							isValid = true;
						break;
					}
				}

				if(isValid) {
					MeshNode* vertices[3] = { center, (MeshNode*)neighbor1, vertex1 };
					LatticeVector edgeVectors[3] = { -edgeVector1, edgeVector1 + edgeVector2, -edgeVector2 };
					createFacetAndEdges(3, vertices, edgeVectors);

					return true;
				}
			}

			return false;	// We are done with the octahedron.
		}
	}

	return false;
}

/******************************************************************************
* Tries to create a quad facet adjacent to a FCC/HCP tetrahedron.
******************************************************************************/
void DXAInterfaceMesh::createAdjacentQuad(BaseAtom* center, MeshNode* vertex1, MeshNode* vertex2, const LatticeVector& edgeVector1, const LatticeVector& edgeVector2)
{
	for(int n1 = 0; n1 < center->numNeighbors; n1++) {
		BaseAtom* neighbor1 = center->neighbor(n1);
		if(neighbor1 == NULL) continue;
		if(neighbor1->tag == vertex1->tag) continue;
		if(neighbor1->tag == vertex2->tag) continue;
		if(vertex1->hasNeighbor(neighbor1) == false) continue;

		for(int n2 = 0; n2 < center->numNeighbors; n2++) {
			if(n2 == n1) continue;
			BaseAtom* neighbor2 = center->neighbor(n2);
			if(neighbor2 == NULL) continue;
			if(neighbor2->tag == vertex1->tag) continue;
			if(neighbor2->tag == vertex2->tag) continue;
			if(vertex2->hasNeighbor(neighbor2) == false) continue;
			if(neighbor1->hasNeighbor(neighbor2) == false) continue;
			if(neighbor1->hasNeighbor(vertex2)) continue;
			if(neighbor2->hasNeighbor(vertex1)) continue;

			if(neighbor1->isMeshNode()) {
				if(neighbor2->isMeshNode()) {
					MeshNode* vertices[4] = { (MeshNode*)vertex1, (MeshNode*)vertex2, (MeshNode*)neighbor2, (MeshNode*)neighbor1 };
					LatticeVector edgeVectors[4] = { -edgeVector1, -edgeVector2, edgeVector1, edgeVector2 };
					createFacetAndEdges(4, vertices, edgeVectors);
				}
				else {
					MeshNode* vertices[3] = { (MeshNode*)vertex1, (MeshNode*)vertex2, (MeshNode*)neighbor1 };
					LatticeVector edgeVectors[4] = { -edgeVector1, edgeVector1 - edgeVector2, edgeVector2 };
					createFacetAndEdges(3, vertices, edgeVectors);
				}
			}
			return;	// We are done with the octahedron.
		}
	}
}

/******************************************************************************
* Creates a facet connecting up to four nodes.
* Checks whether the facet already exists.
* Edges are created on demand by this function.
******************************************************************************/
void DXAInterfaceMesh::createFacetAndEdges(int numVertices, MeshNode** vertices, const LatticeVector* edgeVectors)
{
	DISLOCATIONS_ASSERT(numVertices <= 4);
	MeshEdge* edges[4];

	// Lookup free existing edges.
	// Also check if the facet already exists.
	for(int v = 0; v < numVertices; v++) {
		MeshNode* node1 = vertices[v];
		MeshNode* node2 = vertices[(v+1)%numVertices];
		DISLOCATIONS_ASSERT(node2->tag != node1->tag);

		edges[v] = NULL;
		for(int e = 0; e < node1->numEdges; e++) {
			MeshEdge& edge = node1->edges[e];
			if(edge.node2() == node2 && edge.latticeVector.equals(edgeVectors[v])) {
				const MeshFacet* existingFacet = edge.facet;
				if(existingFacet == NULL) {
					//if(edges[v]) LOG_INFO() << "Multiple existing edges: " << edge.node1->tag << " - " << edge.node2()->tag;					
					edges[v] = &edge;
					break;
				}
				else {
					if(existingFacet->hasVertex(vertices[(v+2)%numVertices])) {
						//LOG_INFO() << "Existing facet";
						return;
					}
				}
			}
		}
	}

	// Create necessary edges.
	for(int v = 0; v < numVertices; v++) {
		DISLOCATIONS_ASSERT(vertices[v]->isMeshNode());
		if(edges[v] == NULL)
			edges[v] = vertices[v]->createEdge(vertices[(v+1)%numVertices], edgeVectors[v]);
	}

	// Create facet
	createFacet(numVertices, vertices, edges);
}

/******************************************************************************
* Creates a facet with N edges.
* Triangulates the facet if N >= 4.
******************************************************************************/
void DXAInterfaceMesh::createFacet(int numVertices, MeshNode** vertices, MeshEdge** edges, int selection)
{
	DISLOCATIONS_ASSERT(numVertices >= 3);

	// Check if we have to split the facet.
	int split_v1, split_v2;
	bool splitEdgeFound = false;
	bool prioritySplitEdgeFound = false;
	for(int v1 = 0; v1 < numVertices; v1++) {
		for(int v2 = v1 + 2; v2 < numVertices; v2++) {
			if(v1 == 0 && v2 == numVertices-1) continue;
			if(vertices[v1]->tag == vertices[v2]->tag) continue;
			if(vertices[v1]->hasNeighbor(vertices[v2])) {
				splitEdgeFound = true;
				split_v1 = v1; split_v2 = v2;
			}
			for(int e = 0; e < vertices[v1]->numEdges; e++) {
				if(vertices[v1]->edges[e].node2() == vertices[v2]) {
					splitEdgeFound = true;
					split_v1 = v1; split_v2 = v2;
					if(vertices[v1]->edges[e].isSFEdge) {
						prioritySplitEdgeFound = true;
						break;
					}
				}
			}
			for(int e = 0; e < vertices[v2]->numEdges; e++) {
				if(vertices[v2]->edges[e].node2() == vertices[v1]) {
					splitEdgeFound = true;
					split_v1 = v1; split_v2 = v2;
					if(vertices[v2]->edges[e].isSFEdge) {
						prioritySplitEdgeFound = true;
						break;
					}
				}
			}
			if(prioritySplitEdgeFound) break;
		}
		if(prioritySplitEdgeFound) break;
	}

	if(splitEdgeFound) {
		int numVertices1 = split_v2 - split_v1 + 1;
		int numVertices2 = split_v1 + numVertices - split_v2 + 1;
		DISLOCATIONS_ASSERT(numVertices1 + numVertices2 == numVertices + 2);
		DISLOCATIONS_ASSERT(numVertices1 >= 3 && numVertices1 < MAX_FACET_HOLE_EDGE_COUNT);
		DISLOCATIONS_ASSERT(numVertices2 >= 3 && numVertices2 < MAX_FACET_HOLE_EDGE_COUNT);

		MeshNode* vertices1[MAX_FACET_HOLE_EDGE_COUNT];
		MeshEdge* edges1[MAX_FACET_HOLE_EDGE_COUNT];
		LatticeVector b1(NULL_VECTOR);
		for(int v = 0; v < numVertices1 - 1; v++) {
			vertices1[v] = vertices[v + split_v1];
			edges1[v] = edges[v + split_v1];
			b1 -= edges1[v]->latticeVector;
		}

		vertices1[numVertices1 - 1] = vertices[split_v2];
		edges1[numVertices1 - 1] = vertices[split_v2]->createEdge(vertices[split_v1], b1);
		createFacet(numVertices1, vertices1, edges1, selection);

		MeshNode* vertices2[MAX_FACET_HOLE_EDGE_COUNT];
		MeshEdge* edges2[MAX_FACET_HOLE_EDGE_COUNT];
		LatticeVector b2(NULL_VECTOR);
		for(int v = 0; v < numVertices2 - 1; v++) {
			vertices2[v] = vertices[(v + split_v2) % numVertices];
			edges2[v] = edges[(v + split_v2) % numVertices];
			b2 -= edges2[v]->latticeVector;
		}
		vertices2[numVertices2 - 1] = vertices[split_v1];
		edges2[numVertices2 - 1] = edges1[numVertices1 - 1]->oppositeEdge;
		DISLOCATIONS_ASSERT(b2.equals(edges2[numVertices2 - 1]->latticeVector));
		createFacet(numVertices2, vertices2, edges2, selection);

		return;
	}

	MeshFacet* facet = facetPool.construct();
	facet->selection = selection;
	facet->edges[0] = edges[0];
	facet->edges[1] = edges[1];
	edges[0]->facet = facet;
	edges[1]->facet = facet;
	LatticeVector edgeVector = edges[0]->latticeVector + edges[1]->latticeVector;
	for(int v = 2; v < numVertices - 1; v++) {
		// Create a new edge.
		MeshEdge* extraEdge = vertices[0]->createEdge(vertices[v], edgeVector);
		MeshEdge* opppositeEdge = extraEdge->oppositeEdge;

		facet->edges[2] = opppositeEdge;
		opppositeEdge->facet = facet;
		facets.push_back(facet);

		facet = facetPool.construct();
		facet->selection = selection;
		facet->edges[0] = extraEdge;
		facet->edges[1] = edges[v];
		extraEdge->facet = facet;
		edges[v]->facet = facet;
		edgeVector += edges[v]->latticeVector;
	}
	facet->edges[2] = edges[numVertices-1];
	edges[numVertices-1]->facet = facet;
	facets.push_back(facet);
}

/******************************************************************************
* Closes the remaining holes in the interface mesh.
******************************************************************************/
void DXAInterfaceMesh::closeFacetHoles()
{
	// Creating missing facets.
	MeshNode* vertices[MAX_FACET_HOLE_EDGE_COUNT];
	MeshEdge* edges[MAX_FACET_HOLE_EDGE_COUNT];

	// Start with closing small holes (3 edges) and then continue with larger and larger holes.
	for(int maxDepth = 3; maxDepth <= MAX_FACET_HOLE_EDGE_COUNT; maxDepth++) {
		for(vector<MeshNode*>::const_iterator node = nodes.begin(); node != nodes.end(); ++node) {
			vertices[0] = *node;
			constructFacetRecursive(0, maxDepth, vertices, edges, NULL_VECTOR);
		}
	}
}

/******************************************************************************
* This recursive function constructs a facet for an open hole.
******************************************************************************/
bool DXAInterfaceMesh::constructFacetRecursive(int numEdges, int maxEdges, MeshNode** vertices, MeshEdge** edges, const LatticeVector& burgersVector)
{
	MeshNode* currentAtom = vertices[numEdges];

	for(int e = 0; e < currentAtom->numEdges; e++) {
		const MeshEdge& edge = currentAtom->edges[e];
		if(edge.facet != NULL) continue;
		edges[numEdges] = const_cast<MeshEdge*>(&edge);
		MeshNode* neighbor = edge.node2();
		LatticeVector burgersVector2 = burgersVector + edge.latticeVector;
		// Is the circuit closed?
		if(neighbor == vertices[0] && numEdges >= 2) {
			// Create only facets that have a null Burgers vector.
			if(burgersVector2.equals(NULL_VECTOR)) {
				createFacet(numEdges+1, vertices, edges, numEdges+1);
			}
			return true;
		}
		else if(numEdges < maxEdges-1) {
			bool invalid = false;
			// TODO: CHECK THIS CODE!!!
			for(int i = 0; i < numEdges; i++) {
				if(edges[i] == &edge || edges[i] == edge.oppositeEdge) {
					invalid = true;
					break;
				}
			}

			if(!invalid) {
				vertices[numEdges+1] = neighbor;
				if(constructFacetRecursive(numEdges + 1, maxEdges, vertices, edges, burgersVector2) && numEdges != 0)
					return true;
			}
		}
	}
	return false;
}


void DXAInterfaceMesh::validateInterfaceMesh()
{
	LOG_INFO() << "Validating mesh topology.";

	// Check if edges and facets are properly linked together.
	for(vector<MeshNode*>::const_iterator iter = nodes.begin(); iter != nodes.end(); ++iter) {
		MeshNode* node = *iter;
		for(int e = 0; e < node->numEdges; e++) {
			MeshNode* neighbor = node->edgeNeighbor(e);
			if(node->edges[e].oppositeEdge->oppositeEdge != &node->edges[e])
				raiseError("Detected invalid reference between opposite edges. Edge vertex 1: %i  edge vertex 2: %i", node->tag, neighbor->tag);			if((node->edges[e].facet != NULL && node->edges[e].oppositeEdge->facet == NULL)
					|| (node->edges[e].facet == NULL && node->edges[e].oppositeEdge->facet != NULL)) {

				raiseError("Detected open interface mesh surface. Edge vertex 1: %i  edge vertex 2: %i", node->tag, neighbor->tag);
			}

			MeshFacet* facet = node->edges[e].facet;
			if(facet == NULL) continue;
			bool found = false;
			for(int v = 0; v < 3; v++) {
				if(facet->edges[v]->node1 == node) {
					if(facet->edges[v] != &node->edges[e])
						raiseError("Detected invalid reference from facet to edge. Edge: %i - %i", node->tag, neighbor->tag);
					found = true;
					break;
				}
			}
			if(!found)
				raiseError("Facet does not contain vertex to which it is incident. Vertex: %i", node->tag);
		}
	}
	for(vector<MeshFacet*>::const_iterator facet = facets.begin(); facet != facets.end(); ++facet) {
		MeshFacet* lastOppositeFacet = NULL;
		LatticeVector burgersVector(NULL_VECTOR);
		for(int v = 0; v < 3; v++) {
			MeshNode* node1 = (*facet)->edges[v]->node1;
			MeshNode* node2 = (*facet)->edges[(v+1)%3]->node1;
			DISLOCATIONS_ASSERT(node2 == (*facet)->edges[v]->node2());
			if((*facet)->edges[v]->facet != (*facet))
				raiseError("Edge is not incident to facet which is part of. Edge: %i - %i.", node1->tag, node2->tag);

			burgersVector += (*facet)->edges[v]->latticeVector;

			MeshFacet* oppositeFacet = (*facet)->edges[v]->oppositeEdge->facet;
			if(oppositeFacet == (*facet))
				raiseError("Facet is opposite to itself.");

			if(oppositeFacet == lastOppositeFacet && oppositeFacet != NULL) {
				MeshNode* thirdVertex = (*facet)->edges[(v+2)%3]->node1;
				if(oppositeFacet->hasVertex(thirdVertex) == false)
					raiseError("Facet has two neighbor edges to the same other facet. Edge: %i - %i", node1->tag, node2->tag);
			}
			lastOppositeFacet = oppositeFacet;
		}
		if(burgersVector.equals(NULL_VECTOR) == false)
			raiseError("Facet Burgers vector is non-null: %f %f %f", burgersVector.X, burgersVector.Y, burgersVector.Z);
	}
}

void DXAInterfaceMesh::duplicateSharedMeshNodes(){
	size_t numSharedNodes = 0;

	for(size_t nodeIndex = 0; nodeIndex < nodes.size(); nodeIndex++) {
		MeshNode* node = nodes[nodeIndex];
		DISLOCATIONS_ASSERT(node->numEdges <= MAX_NODE_EDGES);
		bool edgeVisited[MAX_NODE_EDGES] = { false };
		MeshEdge* initialEdge = NULL;
		for(int e = 0; e < node->numEdges; e++) {
			if(node->edges[e].facet != NULL || node->edges[e].oppositeEdge->facet != NULL)
				initialEdge = &node->edges[e];
			else
				edgeVisited[e] = true;
		}
		if(initialEdge == NULL) continue;

		MeshEdge* currentEdge = initialEdge;
		do {
			edgeVisited[node->edgeIndex(currentEdge)] = true;
			DISLOCATIONS_ASSERT(currentEdge->facet != NULL);
			DISLOCATIONS_ASSERT(currentEdge->facet->testFlag(FACET_IS_UNNECESSARY) == false);
			currentEdge = currentEdge->facet->previousEdge(currentEdge)->oppositeEdge;
		}
		while(currentEdge != initialEdge);

		bool isSharedNode = false;
		for(int e = 0; e < node->numEdges; e++) {
			if(edgeVisited[e] == false) {
				isSharedNode = true;
				break;
			}
		}
		if(!isSharedNode) continue;

		// Create a second node that takes the edges not visited yet.
		MeshNode* secondNode = nodePool.construct(*(BaseAtom*)node);
		DISLOCATIONS_ASSERT(secondNode->numEdges == 0);
		secondNode->index = nodes.size();
		nodes.push_back(secondNode);
		for(int e = 0; e < node->numEdges; e++) {
			if(edgeVisited[e] == false) {
				MeshEdge& oldEdge = node->edges[e];
				MeshEdge* oppositeEdge = oldEdge.oppositeEdge;
				MeshEdge& newEdge = secondNode->edges[secondNode->numEdges++];
				// Copy edge data.
				newEdge.node1 = secondNode;
				newEdge.latticeVector = oldEdge.latticeVector;
				newEdge.oppositeEdge = oppositeEdge;
				newEdge.facet = oldEdge.facet;
				// Adjust pointers.
				oppositeEdge->oppositeEdge = &newEdge;
				DISLOCATIONS_ASSERT(oppositeEdge != &newEdge);
				if(oldEdge.facet) {
					oldEdge.facet->edges[oldEdge.facet->edgeIndex(&oldEdge)] = &newEdge;
					DISLOCATIONS_ASSERT(oldEdge.facet->hasVertex(secondNode));
				}
			}
		}

		// Copy neighbors.
		for(int nn = 0; nn < node->numNeighbors; nn++)
			secondNode->addNeighbor(node->neighbor(nn));

		// Delete edges from original node.
		int newNumEdges = 0;
		for(int e = 0; e < node->numEdges; e++) {
			if(edgeVisited[e]) {
				if(e != newNumEdges)
					node->moveEdge(e, newNumEdges);
				newNumEdges++;
			}
		}
		node->numEdges = newNumEdges;

		node->setFlag(ATOM_SHARED_NODE);
		secondNode->setFlag(ATOM_SHARED_NODE);

		numSharedNodes++;
	}

}

/******************************************************************************
* Deletes facets which are not necessary for the interface mesh.
******************************************************************************/
void DXAInterfaceMesh::removeUnnecessaryFacets()
{

	size_t oldFacetCount = facets.size();

	bool removedSomeFacets;
	do {
		removedSomeFacets = false;

		// Flip quad diagonals.
		for(vector<MeshFacet*>::const_iterator facet = facets.begin(); facet != facets.end(); ++facet) {
			DISLOCATIONS_ASSERT((*facet)->testFlag(FACET_IS_UNNECESSARY) == false);
			for(int e = 0; e < 3; e++) {
				MeshEdge* edge = (*facet)->edges[e];
				DISLOCATIONS_ASSERT(edge->facet == *facet);
				MeshEdge* oppositeEdge = edge->oppositeEdge;
				MeshFacet* oppositeFacet = oppositeEdge->facet;
				DISLOCATIONS_ASSERT(oppositeFacet != NULL);

				MeshEdge* oppositeNextEdge = oppositeFacet->nextEdge(oppositeEdge);
				MeshNode* quadNode = oppositeNextEdge->node2();

				MeshEdge* nextEdge = (*facet)->edges[(e+1)%3];
				MeshEdge* previousEdge = (*facet)->edges[(e+2)%3];
				MeshFacet* backFacet1 = nextEdge->oppositeEdge->facet;
				MeshFacet* backFacet2 = previousEdge->oppositeEdge->facet;
				DISLOCATIONS_ASSERT(backFacet1 && backFacet2);
				MeshEdge* backDiag1 = backFacet1->previousEdge(nextEdge->oppositeEdge);
				MeshEdge* backDiag2 = backFacet2->nextEdge(previousEdge->oppositeEdge);

				if(backDiag1->node1->tag == quadNode->tag && backDiag2->node2()->tag == quadNode->tag && backDiag1 == backDiag2->oppositeEdge) {
					//LOG_INFO() << "Flipping quad: " << nextEdge->node2()->tag;
					DISLOCATIONS_ASSERT(backFacet1->previousEdge(nextEdge->oppositeEdge) == backFacet2->nextEdge(previousEdge->oppositeEdge)->oppositeEdge);

					MeshEdge* backEdge11 = backFacet1->nextEdge(backDiag1);
					MeshEdge* backEdge12 = backFacet1->previousEdge(backDiag1);

					MeshEdge* backEdge21 = backFacet2->nextEdge(backDiag2);
					MeshEdge* backEdge22 = backFacet2->previousEdge(backDiag2);

					LatticeVector diagVector = backEdge22->latticeVector + backEdge11->latticeVector;
					DISLOCATIONS_ASSERT(backEdge22->node1->findEdgeTo(backEdge12->node1) != NULL);

					MeshEdge* newDiagEdge = backEdge22->node1->createEdge(backEdge12->node1, diagVector);
					backDiag1->facet = NULL;
					backDiag2->facet = NULL;
					newDiagEdge->facet = backFacet2;
					newDiagEdge->oppositeEdge->facet = backFacet1;
					backFacet1->edges[0] = backEdge22;
					backFacet1->edges[1] = backEdge11;
					backFacet1->edges[2] = newDiagEdge->oppositeEdge;
					backFacet2->edges[0] = backEdge12;
					backFacet2->edges[1] = backEdge21;
					backFacet2->edges[2] = newDiagEdge;
					backEdge22->facet = backFacet1;
					backEdge11->facet = backFacet1;
					backEdge12->facet = backFacet2;
					backEdge21->facet = backFacet2;
				}
			}
		}

		// Mark unnecessary facets.
		for(vector<MeshFacet*>::const_iterator facet = facets.begin(); facet != facets.end(); ++facet) {
			if((*facet)->testFlag(FACET_IS_UNNECESSARY)) continue;
			for(int e = 0; e < 3; e++) {
				MeshEdge* edge = (*facet)->edges[e];
				MeshEdge* oppositeEdge = edge->oppositeEdge;
				MeshFacet* oppositeFacet = oppositeEdge->facet;
				DISLOCATIONS_ASSERT(oppositeFacet != NULL);
				MeshEdge* nextEdge = (*facet)->edges[(e+1)%3];
				MeshEdge* previousEdge = (*facet)->edges[(e+2)%3];
				MeshEdge* oppositeNextEdge = oppositeFacet->nextEdge(oppositeEdge);
				MeshEdge* oppositePreviousEdge = oppositeFacet->previousEdge(oppositeEdge);
				DISLOCATIONS_ASSERT(oppositePreviousEdge->node2() == nextEdge->node1);
				DISLOCATIONS_ASSERT(oppositeNextEdge->node1 == previousEdge->node2());
				if(nextEdge->oppositeEdge == oppositePreviousEdge && previousEdge->oppositeEdge == oppositeNextEdge) {
					// We have found two facets that share all three edges. We can delete both.
					DISLOCATIONS_ASSERT(oppositeFacet->testFlag(FACET_IS_UNNECESSARY) == false);
					(*facet)->setFlag(FACET_IS_UNNECESSARY);
					oppositeFacet->setFlag(FACET_IS_UNNECESSARY);
					// Detach facets from edges.
					edge->facet = NULL;
					nextEdge->facet = NULL;
					previousEdge->facet = NULL;
					oppositeEdge->facet = NULL;
					oppositeNextEdge->facet = NULL;
					oppositePreviousEdge->facet = NULL;
					break;
				}
				else if(nextEdge->oppositeEdge == oppositePreviousEdge && previousEdge->oppositeEdge != oppositeNextEdge/* && edge->isSFEdge == false && nextEdge->isSFEdge == false*/) {
					// We have found two facets that share two edges. We can delete both.
					DISLOCATIONS_ASSERT(oppositeFacet->testFlag(FACET_IS_UNNECESSARY) == false);
					DISLOCATIONS_ASSERT(previousEdge->latticeVector.equals(-oppositeNextEdge->latticeVector));
					(*facet)->setFlag(FACET_IS_UNNECESSARY);
					oppositeFacet->setFlag(FACET_IS_UNNECESSARY);
					previousEdge->oppositeEdge->oppositeEdge = oppositeNextEdge->oppositeEdge;
					oppositeNextEdge->oppositeEdge->oppositeEdge = previousEdge->oppositeEdge;
					previousEdge->oppositeEdge = oppositeNextEdge;
					oppositeNextEdge->oppositeEdge = previousEdge;
					// Detach facets from edges.
					edge->facet = NULL;
					nextEdge->facet = NULL;
					previousEdge->facet = NULL;
					oppositeEdge->facet = NULL;
					oppositeNextEdge->facet = NULL;
					oppositePreviousEdge->facet = NULL;
					break;
				}
				else if(nextEdge->oppositeEdge != oppositePreviousEdge && previousEdge->oppositeEdge != oppositeNextEdge/* && edge->isSFEdge == false*/) {
					if(nextEdge->node2() == oppositePreviousEdge->node1 && previousEdge->node1 == nextEdge->node2() && previousEdge->node1 == oppositeNextEdge->node2()) {
						DISLOCATIONS_ASSERT(oppositeFacet->testFlag(FACET_IS_UNNECESSARY) == false);
						if(previousEdge->latticeVector.equals(-oppositeNextEdge->latticeVector) && nextEdge->latticeVector.equals(-oppositePreviousEdge->latticeVector)) {
							// We have found two facets that share one edge. We can delete both.
							(*facet)->setFlag(FACET_IS_UNNECESSARY);
							oppositeFacet->setFlag(FACET_IS_UNNECESSARY);
							previousEdge->oppositeEdge->oppositeEdge = oppositeNextEdge->oppositeEdge;
							oppositeNextEdge->oppositeEdge->oppositeEdge = previousEdge->oppositeEdge;
							previousEdge->oppositeEdge = oppositeNextEdge;
							oppositeNextEdge->oppositeEdge = previousEdge;
							nextEdge->oppositeEdge->oppositeEdge = oppositePreviousEdge->oppositeEdge;
							oppositePreviousEdge->oppositeEdge->oppositeEdge = nextEdge->oppositeEdge;
							nextEdge->oppositeEdge = oppositePreviousEdge;
							oppositePreviousEdge->oppositeEdge = nextEdge;
							// Detach facets from edges.
							edge->facet = NULL;
							nextEdge->facet = NULL;
							previousEdge->facet = NULL;
							oppositeEdge->facet = NULL;
							oppositeNextEdge->facet = NULL;
							oppositePreviousEdge->facet = NULL;
						}
						break;
					}
				}
			}
		}

		// Delete unnecessary facets.
		vector<MeshFacet*>::iterator dest = facets.begin();
		for(vector<MeshFacet*>::const_iterator facet = facets.begin(); facet != facets.end(); facet++) {
			if((*facet)->testFlag(FACET_IS_UNNECESSARY) == false)
				*dest++ = *facet;
			else
				removedSomeFacets = true;
		}
		facets.resize(dest - facets.begin());
	}
	while(removedSomeFacets);
}

bool DXAInterfaceMesh::edgeEdgeOrientation(MeshEdge* edge1, MeshEdge* edge3)
{
	DISLOCATIONS_ASSERT(edge1->node1->tag == edge3->node1->tag);
	DISLOCATIONS_ASSERT(edge1->node2()->tag == edge3->node2()->tag);
	MeshNode* nodeA = edge1->node1;
	MeshNode* nodeB = edge1->node2();
	MeshEdge* edge[4] = { edge1, edge1->oppositeEdge, edge3, edge3->oppositeEdge };
	MeshFacet* facet[4];
	MeshEdge* nextEdge[4];
	MeshEdge* previousEdge[4];
	MeshNode* node[4];
	for(int e = 0; e < 4; e++) {
		facet[e] = edge[e]->facet;
		DISLOCATIONS_ASSERT(facet[e]);
		nextEdge[e] = facet[e]->nextEdge(edge[e]);
		previousEdge[e] = facet[e]->previousEdge(edge[e]);
		node[e] = nextEdge[e]->node2();
	}

	MeshEdge* quadnode_a_edge[4];
	MeshNode* quadnode_a[4];
	MeshEdge* quadnode_b_edge[4];
	MeshNode* quadnode_b[4];

	for(int e = 0; e < 4; e++) {
		quadnode_a_edge[e] = nextEdge[e]->oppositeEdge->facet->previousEdge(nextEdge[e]->oppositeEdge);
		quadnode_a[e] = quadnode_a_edge[e]->node1;
		DISLOCATIONS_ASSERT(quadnode_a_edge[e]->node2() == node[e]);

		quadnode_b_edge[e] = previousEdge[e]->oppositeEdge->facet->nextEdge(previousEdge[e]->oppositeEdge);
		quadnode_b[e] = quadnode_b_edge[e]->node2();
		DISLOCATIONS_ASSERT(quadnode_b_edge[e]->node1 == node[e]);
	}

	if(node[0]->tag == node[1]->tag) return true;
	if(node[2]->tag == node[3]->tag) return true;
	if(node[1]->tag == node[2]->tag) return false;
	if(node[0]->tag == node[3]->tag) return false;
	if(quadnode_a[0]->tag == node[1]->tag && quadnode_a_edge[0]->latticeVector.equals(edge[1]->latticeVector)) return true;
	if(quadnode_b[0]->tag == node[1]->tag && quadnode_b_edge[0]->latticeVector.equals(edge[1]->latticeVector)) return true;
	if(quadnode_a[1]->tag == node[0]->tag && quadnode_a_edge[1]->latticeVector.equals(edge[0]->latticeVector)) return true;
	if(quadnode_b[1]->tag == node[0]->tag && quadnode_b_edge[1]->latticeVector.equals(edge[0]->latticeVector)) return true;
	if(quadnode_a[2]->tag == node[3]->tag && quadnode_a_edge[2]->latticeVector.equals(edge[3]->latticeVector)) return true;
	if(quadnode_b[2]->tag == node[3]->tag && quadnode_b_edge[2]->latticeVector.equals(edge[3]->latticeVector)) return true;
	if(quadnode_a[3]->tag == node[2]->tag && quadnode_a_edge[3]->latticeVector.equals(edge[2]->latticeVector)) return true;
	if(quadnode_b[3]->tag == node[2]->tag && quadnode_b_edge[3]->latticeVector.equals(edge[2]->latticeVector)) return true;

	if(quadnode_a[0]->tag == node[3]->tag && quadnode_a_edge[0]->latticeVector.equals(edge[3]->latticeVector)) return false;
	if(quadnode_b[0]->tag == node[3]->tag && quadnode_b_edge[0]->latticeVector.equals(edge[3]->latticeVector)) return false;
	if(quadnode_a[1]->tag == node[2]->tag && quadnode_a_edge[1]->latticeVector.equals(edge[2]->latticeVector)) return false;
	if(quadnode_b[1]->tag == node[2]->tag && quadnode_b_edge[1]->latticeVector.equals(edge[2]->latticeVector)) return false;
	if(quadnode_a[2]->tag == node[1]->tag && quadnode_a_edge[2]->latticeVector.equals(edge[1]->latticeVector)) return false;
	if(quadnode_b[2]->tag == node[1]->tag && quadnode_b_edge[2]->latticeVector.equals(edge[1]->latticeVector)) return false;
	if(quadnode_a[3]->tag == node[0]->tag && quadnode_a_edge[3]->latticeVector.equals(edge[0]->latticeVector)) return false;
	if(quadnode_b[3]->tag == node[0]->tag && quadnode_b_edge[3]->latticeVector.equals(edge[0]->latticeVector)) return false;

	Vector3 edgeAB = wrapVector(nodeB->pos - nodeA->pos);
	Vector3 edgeA[4];
	for(int e = 0; e < 4; e++) {
		edgeA[e] = wrapVector(node[e]->pos - nodeA->pos);
	}
	FloatType facet_det12 = Matrix3(edgeAB, edgeA[0], edgeA[1]).determinant();
	FloatType facet_det34 = Matrix3(edgeAB, edgeA[2], edgeA[3]).determinant();

	if(facet_det12 > 0.0 && facet_det34 > 0.0)
		return true;
	else if(facet_det12 < 0.0 && facet_det34 < 0.0)
		return false;
	else {
		FloatType facet_det14 = Matrix3(edgeAB, edgeA[0], edgeA[3]).determinant();
		FloatType facet_det23 = Matrix3(edgeAB, edgeA[2], edgeA[1]).determinant();
		if(facet_det14 < 0.0 && facet_det23 < 0.0)
			return true;
		else
			return false;
	}
}

/******************************************************************************
* Fix facet-edge connectivity.
******************************************************************************/
void DXAInterfaceMesh::fixMeshEdges()
{
	size_t fixedEdges = 0;

	// Iterate over all edges of the mesh, which are in use.
	for(vector<MeshFacet*>::const_iterator facet = facets.begin(); facet != facets.end(); ++facet) {
		for(int e = 0; e < 3; e++) {
			MeshEdge* edge1 = (*facet)->edges[e];
			
			// Look for an identical parallel edge.
			for(int e2 = 0; e2 < edge1->node1->numEdges; e2++) {
				MeshEdge* edge2 = &edge1->node1->edges[e2];
				if(edge2 == edge1) continue;
				if(edge2->facet == NULL) continue;				
				if(edge2->node2() == edge1->node2() && edge1->latticeVector.equals(edge2->latticeVector)) {
			
					// Check if edge2 can be reached from edge1 by traversing the facets of the first shared node.
					bool hitEdge2 = false;
					MeshEdge* currentEdge = edge1;
					do {
						if(currentEdge == edge2) hitEdge2 = true;
						currentEdge = currentEdge->facet->previousEdge(currentEdge)->oppositeEdge;
					}
					while(currentEdge != edge1);

					if(hitEdge2) {

						if(!edgeEdgeOrientation(edge1, edge2))
							continue;

						// Swap facets of the two edges.
						swap(edge1->facet->edges[edge1->facet->edgeIndex(edge1)], edge2->facet->edges[edge2->facet->edgeIndex(edge2)]);
						swap(edge1->facet, edge2->facet);
						fixedEdges++;

					}
				}
			}
		}
	}
}

/******************************************************************************
* Determines whether a triangle facet is wrapped at a periodic boundary.
******************************************************************************/
bool DXAInterfaceMesh::isWrappedFacet(MeshFacet* facet) const
{
	if(hasPeriodicBoundaries()) {
		if(isWrappedVector(facet->vertex(1)->pos - facet->vertex(0)->pos) ||
				isWrappedVector(facet->vertex(2)->pos - facet->vertex(0)->pos)) {
			return true;
		}
	}
	return false;
}

/******************************************************************************
* Determines whether a mesh edge is wrpapped at a periodic boundary.
******************************************************************************/
bool DXAInterfaceMesh::isWrappedEdge(MeshEdge* edge) const
{
	return isWrappedVector(edge->node2()->pos - edge->node1->pos);
}