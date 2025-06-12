#include <opendxa/core/dislocation_tracing.hpp>
#include <opendxa/structures/atoms/input_atom.hpp>
#include <opendxa/structures/dislocations/burgers_circuit.hpp>
#include <opendxa/structures/dislocations/dislocation_segment.hpp>
#include <opendxa/utils/timer.hpp>

/******************************************************************************
* Does the actual dislocation detection.
******************************************************************************/
void DXATracing::traceDislocationSegments()
{
	if(burgersSearchDepth < 1)
		raiseError("Invalid settings: Maximum Burgers circuit length (maxcircuitsize) must not be less than 3.");
	if(maxBurgersCircuitSize > maxExtendedBurgersCircuitSize)
		raiseError("Invalid settings: Maximum Burgers circuit length must not be larger than the extended Burgers circuit limit (i.e. maxcircuitsize <= extcircuitsize).");

	// Initialize random number generator to make the algorithm predictive.
	srand(1);

	// First find dislocation segments by tracing short Burgers circuits around dislocation cores.
	findPrimarySegments();

	size_t numPrimarySegments = segments.size();
	LOG_INFO() << "Extending and joining dislocation segments. Extended circuit length limit: " << maxExtendedBurgersCircuitSize;

	// Count the number of created dislocation junctions.
	int numJunctions = 0;

	// Try to join two or more segments to form a dislocation junction.
	numJunctions += joinSegments(maxBurgersCircuitSize);

	// Then incrementally extend the segments until they meet each other.
	for(int circuitLength = maxBurgersCircuitSize; circuitLength <= maxExtendedBurgersCircuitSize; circuitLength++) {

		// Extend the existing segments along the interface mesh up to the current maximum circuit length.
		for(vector<BurgersCircuit*>::const_iterator circuit_iter = danglingCircuits.begin(); circuit_iter != danglingCircuits.end(); ++circuit_iter) {
			BurgersCircuit* circuit = *circuit_iter;
			DISLOCATIONS_ASSERT(circuit->isDangling);
			DISLOCATIONS_ASSERT(circuit->countEdges() == circuit->edgeCount);

			traceSegment(*circuit->segment, *circuit, circuitLength, false);
		}

		// Try to join two or more segments to form a dislocation junction.
		numJunctions += joinSegments(circuitLength);
	}

	// Remove extra line points from segments which have not been joined.
#pragma omp parallel for
	for(int segmentIndex = 0; segmentIndex < segments.size(); segmentIndex++) {
		DislocationSegment* segment = segments[segmentIndex];
		deque<Point3>& line = segments[segmentIndex]->line;
		line.erase(line.begin() + segment->primarySegmentEnd, line.end());
		line.erase(line.begin(), line.begin() + segment->primarySegmentStart);
	}

	LOG_INFO() << "Found " << (max(segments.size(), numPrimarySegments) - numPrimarySegments) << " secondary dislocation segments.";
	LOG_INFO() << "Created " << numJunctions << " dislocation junctions.";
}

/******************************************************************************
* Does the actual Burgers circuit search.
******************************************************************************/
void DXATracing::findPrimarySegments()
{
	LOG_INFO() << "Searching for primary dislocation segments. Maximum recursive search depth: " << burgersSearchDepth;

	/* Ensure that all visit flags are cleared.
	for(vector<MeshNode*>::iterator node = nodes.begin(); node != nodes.end(); ++node) {
		DISLOCATIONS_ASSERT((*node)->wasVisited() == false);
		DISLOCATIONS_ASSERT((*node)->recursiveDepth == 0);
	}*/

	// List of all nodes that have been visited during the last recursive walk.
	vector<MeshNode*> visitedNodes;

	// Stack of nodes that still have to be visited during the current recursive walk.
	deque<MeshNode*> toprocess;

	for(vector<MeshNode*>::iterator startNode = nodes.begin(); startNode != nodes.end(); ++startNode) {

		// Clear the flags of the nodes that have been visited during the last walk.
		for(vector<MeshNode*>::iterator node = visitedNodes.begin(); node != visitedNodes.end(); ++node)
			(*node)->clearVisitFlag();

		// The first node is the seed of our recursive walk.
		// It is mapped to the origin of the perfect reference lattice.
		(*startNode)->latticeCoord = NULL_VECTOR;
		(*startNode)->predecessorEdge = NULL;
		(*startNode)->recursiveDepth = 0;

		// Now push the first node onto the walk stack.
		toprocess.resize(1);
		toprocess[0] = *startNode;
		visitedNodes.resize(1);
		visitedNodes[0] = *startNode;
		(*startNode)->setVisitFlag();

		do {
			// Take the next node from the stack of nodes to be visited.
			MeshNode* currentNode = toprocess.front();
			toprocess.pop_front();

			bool foundBurgersCircuit = false;
			for(int e = 0; e < currentNode->numEdges; e++) {
				if(burgersSearchWalkEdge(currentNode, currentNode->edges[e], visitedNodes, toprocess)) {
					foundBurgersCircuit = true;
					break;
				}
			}
			// Stop as soon as a Burgers circuit has been found.
			if(foundBurgersCircuit)
				break;
		}
		while(toprocess.empty() == false);
	}

	LOG_INFO() << "Found " << segments.size() << " primary dislocation segments.";
}

/******************************************************************************
* Does the recursive walk along the edge of a facet.
******************************************************************************/
bool DXATracing::burgersSearchWalkEdge(MeshNode* currentNode, MeshEdge& edge, vector<MeshNode*>& visitedNodes, deque<MeshNode*>& toprocess)
{
	DISLOCATIONS_ASSERT((edge.circuit == NULL) == (edge.nextEdge == NULL));
	DISLOCATIONS_ASSERT((edge.oppositeEdge->circuit == NULL) == (edge.oppositeEdge->nextEdge == NULL));
	DISLOCATIONS_ASSERT(edge.node1 == currentNode);

	// Skip edges which are or have already been part of a Burgers circuit.
	if(edge.nextEdge != NULL || edge.oppositeEdge->nextEdge != NULL) return false;

	// Skip border edges.
	if(edge.facet == NULL || edge.facet->circuit != NULL) return false;

	MeshNode* neighbor = edge.node2();
	LatticeVector neighborCoord = currentNode->latticeCoord + edge.latticeVector;

	// If this neighbor has been assigned lattice coordinates before, then
	// perform Burgers test.
	if(neighbor->wasVisited()) {
		if(neighbor->latticeCoord.equals(neighborCoord) == false) {
			// Found non-closed Burgers circuit.
			LatticeVector burgersVector = neighbor->latticeCoord - neighborCoord;

			// Reconstruct the first Burgers circuit.
			BurgersCircuit* forwardCircuit;
			if(unusedCircuit == NULL)
				forwardCircuit = circuitPool.construct();
			else {
				forwardCircuit = unusedCircuit;
				unusedCircuit = NULL;
			}
			forwardCircuit->edgeCount = 1;
			forwardCircuit->firstEdge = edge.oppositeEdge;
			forwardCircuit->lastEdge = forwardCircuit->firstEdge;
			forwardCircuit->firstEdge->circuit = forwardCircuit;

			// First mark all nodes on the first branch of the recursive walk.
			MeshNode* a = currentNode;
			for(;;) {
				a->clearVisitFlag();
				if(a->predecessorEdge == NULL) break;
				a = a->predecessorEdge->node1;
			}
			// Then walk on the second branch until the first branch is hit.
			a = neighbor;
			for(;;) {
				if(a->wasVisited() == false) {
					a->setVisitFlag();
					break;
				}
				DISLOCATIONS_ASSERT(a->predecessorEdge != NULL);
				DISLOCATIONS_ASSERT(a->predecessorEdge->circuit == NULL);
				DISLOCATIONS_ASSERT(a->predecessorEdge->oppositeEdge->circuit == NULL);
				a->predecessorEdge->nextEdge = forwardCircuit->firstEdge;
				forwardCircuit->firstEdge = a->predecessorEdge;
				forwardCircuit->edgeCount++;
				forwardCircuit->firstEdge->circuit = forwardCircuit;
				a = a->predecessorEdge->node1;
			}
			// Last, walk along the first branch again until the second branch is hit.
			a = currentNode;
			for(;;) {
				if(a->wasVisited()) break;
				DISLOCATIONS_ASSERT(a->predecessorEdge != NULL);
				DISLOCATIONS_ASSERT(a->predecessorEdge->circuit == NULL);
				DISLOCATIONS_ASSERT(a->predecessorEdge->oppositeEdge->circuit == NULL);
				forwardCircuit->lastEdge->nextEdge = a->predecessorEdge->oppositeEdge;
				forwardCircuit->lastEdge = forwardCircuit->lastEdge->nextEdge;
				forwardCircuit->edgeCount++;
				forwardCircuit->lastEdge->circuit = forwardCircuit;
				a = a->predecessorEdge->node1;
			}
			forwardCircuit->lastEdge->nextEdge = forwardCircuit->firstEdge;
			DISLOCATIONS_ASSERT(forwardCircuit->firstEdge != forwardCircuit->firstEdge->nextEdge);
			DISLOCATIONS_ASSERT(forwardCircuit->countEdges() == forwardCircuit->edgeCount);
			DISLOCATIONS_ASSERT(forwardCircuit->calculateBurgersVector().equals(burgersVector));

			// Make sure the circuit does not cross periodic boundaries.
			// This can be checked by summing up the bond vectors of the circuit's edges. The sum should be zero for valid circuits.
			MeshEdge* edge = forwardCircuit->firstEdge;
			Vector3 edgeSum(NULL_VECTOR);
			do {
				edgeSum += wrapVector(edge->node2()->pos - edge->node1->pos);
				edge = edge->nextEdge;
			}
			while(edge != forwardCircuit->firstEdge);
			if(edgeSum.equals(NULL_VECTOR) == false) {
				// Reject circuit.
				// Clear edges.
				MeshEdge* e = forwardCircuit->firstEdge;
				do {
					MeshEdge* nextEdge = e->nextEdge;
					e->nextEdge = NULL;
					e->circuit = NULL;
					e = nextEdge;
				}
				while(e != forwardCircuit->firstEdge);
				unusedCircuit = forwardCircuit;

				// Re-set node flags
				MeshNode* a = currentNode;
				for(;;) {
					a->setVisitFlag();
					if(a->predecessorEdge == NULL) break;
					a = a->predecessorEdge->node1;
				}
				a = neighbor;
				for(;;) {
					a->setVisitFlag();
					if(a->predecessorEdge == NULL) break;
					a = a->predecessorEdge->node1;
				}

				return false;
			}

			// Test for intersections with existing circuits.
			MeshEdge* edge1 = forwardCircuit->firstEdge;
			MeshEdge* edge2 = edge1->nextEdge;
			do {
				if(edge1 != edge2->oppositeEdge) {
					MeshEdge* currentEdge = edge1->oppositeEdge;
					do {
						DISLOCATIONS_ASSERT(currentEdge->facet != NULL);
						MeshEdge* nextEdge = currentEdge->facet->previousEdge(currentEdge);
						if(nextEdge != edge2 && nextEdge->circuit != NULL) {
							DISLOCATIONS_ASSERT(nextEdge->circuit == nextEdge->nextEdge->circuit);
							int goingOutside = 0, goingInside = 0;
							circuitContourIntersection(edge2->oppositeEdge, edge1->oppositeEdge, nextEdge, nextEdge->nextEdge, goingOutside, goingInside);
							DISLOCATIONS_ASSERT(goingInside == 0);
							if(goingOutside) {
								// Clear edges.
								MeshEdge* e = forwardCircuit->firstEdge;
								do {
									MeshEdge* nextEdge = e->nextEdge;
									e->nextEdge = NULL;
									e->circuit = NULL;
									e = nextEdge;
								}
								while(e != forwardCircuit->firstEdge);
								unusedCircuit = forwardCircuit;
								// Stop recursive walk.
								toprocess.resize(0);
								return true;
							}
						}
						currentEdge = nextEdge->oppositeEdge;
					}
					while(currentEdge != edge2);
				}
				edge1 = edge2;
				edge2 = edge2->nextEdge;
			}
			while(edge1 != forwardCircuit->firstEdge);

			// We can accept this circuit.
			danglingCircuits.push_back(forwardCircuit);

			// Build the backward circuit.
			BurgersCircuit* backwardCircuit = buildBackwardCircuit(forwardCircuit);

			// Allocate new dislocation segment.
			DislocationSegment* segment = segmentPool.construct(burgersVector, forwardCircuit, backwardCircuit, currentNode->pos, *this);
			segment->index = segments.size();
			segments.push_back(segment);

			//segment->determineWorldBurgersVector(*this);
			forwardCircuit->updateLatticeToWorldTransformation(*this);

			// Trace the segment in both directions.
			for(size_t circuitIndex = 0; circuitIndex < 2; circuitIndex++) {
				BurgersCircuit* circuit = segment->circuits[circuitIndex];
				traceSegment(*segment, *circuit, maxBurgersCircuitSize, true);
				DISLOCATIONS_ASSERT(circuit->countEdges() == circuit->edgeCount);

				// Create cap facets.
				circuit->createPrimaryCap();
			}

			segment->determineWorldBurgersVector();

			// Stop recursive walk.
			toprocess.resize(0);
			return true;
		}
	}
	else if(currentNode->recursiveDepth < burgersSearchDepth) {
		// This neighbor has not been visited before.
		// Continue with this node. Put it onto the recursive walk stack.
		neighbor->latticeCoord = neighborCoord;
		neighbor->predecessorEdge = &edge;
		neighbor->setVisitFlag();
		neighbor->recursiveDepth = currentNode->recursiveDepth + 1;
		visitedNodes.push_back(neighbor);
		toprocess.push_back(neighbor);
	}

	return false;
}

BurgersCircuit* DXATracing::buildBackwardCircuit(BurgersCircuit* forwardCircuit)
{
	BurgersCircuit* backwardCircuit = circuitPool.construct();
	danglingCircuits.push_back(backwardCircuit);

	// Build the backward circuit along inner outline.
	backwardCircuit->edgeCount = 0;
	backwardCircuit->firstEdge = NULL;
	backwardCircuit->lastEdge = NULL;
	MeshEdge* edge1 = forwardCircuit->firstEdge;
	do {
		MeshEdge* edge2 = edge1->nextEdge;
		MeshEdge* oppositeEdge1 = edge1->oppositeEdge;
		MeshEdge* oppositeEdge2 = edge2->oppositeEdge;
		MeshFacet* facet1 = oppositeEdge1->facet;
		MeshFacet* facet2 = oppositeEdge2->facet;
		DISLOCATIONS_ASSERT(facet1 != NULL && facet2 != NULL);
		DISLOCATIONS_ASSERT(facet1->circuit == NULL || facet1->circuit == backwardCircuit);
		DISLOCATIONS_ASSERT(facet2->circuit == NULL || facet2->circuit == backwardCircuit);
		DISLOCATIONS_ASSERT(edge1->node2() == edge2->node1);
		DISLOCATIONS_ASSERT(edge1->latticeVector.equals(-oppositeEdge1->latticeVector));
		DISLOCATIONS_ASSERT(edge2->latticeVector.equals(-oppositeEdge2->latticeVector));

		if(facet1 != facet2) {
			MeshEdge* outerEdge1 = NULL;
			MeshEdge* innerEdge1 = NULL;
			MeshEdge* outerEdge2 = NULL;
			MeshEdge* innerEdge2 = NULL;
			for(int e = 0; e < 3; e++) {
				if(facet1->edges[e] == oppositeEdge1) {
					innerEdge1 = facet1->edges[(e+2)%3]->oppositeEdge;
					outerEdge1 = facet1->edges[(e+1)%3]->oppositeEdge;
				}
				if(facet2->edges[e] == oppositeEdge2) {
					innerEdge2 = facet2->edges[(e+1)%3]->oppositeEdge;
					outerEdge2 = facet2->edges[(e+2)%3]->oppositeEdge;
				}
			}
			DISLOCATIONS_ASSERT(innerEdge1 != NULL && innerEdge2 != NULL);
			DISLOCATIONS_ASSERT(innerEdge1->node1 == edge1->node2());
			DISLOCATIONS_ASSERT(innerEdge2->node2() == edge1->node2());
			DISLOCATIONS_ASSERT(innerEdge1->node1 == innerEdge2->node2());
			DISLOCATIONS_ASSERT(innerEdge1->circuit == NULL || innerEdge1->circuit == backwardCircuit);
			DISLOCATIONS_ASSERT(innerEdge2->circuit == NULL || innerEdge2->circuit == backwardCircuit);
			DISLOCATIONS_ASSERT(edge1->latticeVector.equals(-innerEdge1->latticeVector-outerEdge1->latticeVector));
			DISLOCATIONS_ASSERT(edge2->latticeVector.equals(-innerEdge2->latticeVector-outerEdge2->latticeVector));
			facet1->setFlag(FACET_IS_PRIMARY_SEGMENT);
			facet1->circuit = backwardCircuit;
			facet2->setFlag(FACET_IS_PRIMARY_SEGMENT);
			facet2->circuit = backwardCircuit;
			innerEdge1->circuit = backwardCircuit;
			innerEdge2->circuit = backwardCircuit;
			innerEdge2->nextEdge = innerEdge1;
			if(backwardCircuit->lastEdge == NULL) {
				DISLOCATIONS_ASSERT(backwardCircuit->firstEdge == NULL);
				DISLOCATIONS_ASSERT(innerEdge1->nextEdge == NULL);
				backwardCircuit->lastEdge = innerEdge1;
				backwardCircuit->firstEdge = innerEdge2;
				backwardCircuit->edgeCount += 2;
			}
			else if(backwardCircuit->lastEdge != innerEdge2) {
				if(innerEdge1 != backwardCircuit->firstEdge) {
					innerEdge1->nextEdge = backwardCircuit->firstEdge;
					backwardCircuit->edgeCount += 2;
				}
				else {
					backwardCircuit->edgeCount += 1;
				}
				backwardCircuit->firstEdge = innerEdge2;
			}
			else if(backwardCircuit->firstEdge != innerEdge1) {
				innerEdge1->nextEdge = backwardCircuit->firstEdge;
				backwardCircuit->firstEdge = innerEdge1;
				backwardCircuit->edgeCount += 1;
			}
			DISLOCATIONS_ASSERT(!innerEdge1->node1->pos.equals(innerEdge1->node2()->pos));
			DISLOCATIONS_ASSERT(!innerEdge2->node1->pos.equals(innerEdge2->node2()->pos));
		}

		edge1 = edge2;
	}
	while(edge1 != forwardCircuit->firstEdge);
	DISLOCATIONS_ASSERT(backwardCircuit->edgeCount > 0);
	DISLOCATIONS_ASSERT(backwardCircuit->lastEdge->node2() == backwardCircuit->firstEdge->node1);
	DISLOCATIONS_ASSERT(backwardCircuit->lastEdge->nextEdge == NULL || backwardCircuit->lastEdge->nextEdge == backwardCircuit->firstEdge);
	backwardCircuit->lastEdge->nextEdge = backwardCircuit->firstEdge;

	DISLOCATIONS_ASSERT(backwardCircuit->firstEdge != backwardCircuit->firstEdge->nextEdge);
	DISLOCATIONS_ASSERT(backwardCircuit->countEdges() == backwardCircuit->edgeCount);
	DISLOCATIONS_ASSERT(backwardCircuit->calculateBurgersVector().equals(-forwardCircuit->calculateBurgersVector()));

	return backwardCircuit;
}

/******************************************************************************
* Traces a dislocation segment in one direction.
******************************************************************************/
void DXATracing::traceSegment(DislocationSegment& segment, BurgersCircuit& circuit, int maxCircuitLength, bool isPrimarySegment)
{
	DISLOCATIONS_ASSERT(circuit.countEdges() == circuit.edgeCount);
	DISLOCATIONS_ASSERT(circuit.isDangling);

	// Advance circuit as far as possible.
	for(;;) {

		// During each iteration, first shorten circuit as much as possible.
		// Pick a random start edge to distribute the removal of edges
		// over the whole circuit.
		MeshEdge* firstEdge = circuit.getEdge(rand() % circuit.edgeCount);

		// Shorten circuit as far as possible.
		MeshEdge* edge0 = firstEdge;
		MeshEdge* edge1 = edge0->nextEdge;
		MeshEdge* edge2 = edge1->nextEdge;
		DISLOCATIONS_ASSERT(edge1->circuit == &circuit);
		int counter = 0;
		do {
			// Check Burgers circuit.
			DISLOCATIONS_ASSERT(circuit.edgeCount >= 2);
			DISLOCATIONS_ASSERT(circuit.countEdges() == circuit.edgeCount);
			DISLOCATIONS_ASSERT(circuit.isForwardCircuit() == false || circuit.calculateBurgersVector().equals(segment.burgersVector));
			DISLOCATIONS_ASSERT(circuit.isForwardCircuit() == true || circuit.calculateBurgersVector().equals(-segment.burgersVector));

			bool wasShortened = false;
			if(tryRemoveTwoCircuitEdges(edge0, edge1, edge2))
				wasShortened = true;
			else if(tryRemoveThreeCircuitEdges(edge0, edge1, edge2, isPrimarySegment))
				wasShortened = true;
			else if(tryRemoveOneCircuitEdge(edge0, edge1, edge2, isPrimarySegment))
				wasShortened = true;
			else if(trySweepTwoFacets(edge0, edge1, edge2, isPrimarySegment))
				wasShortened = true;

			if(wasShortened) {
				recordLinePoint(&circuit, isPrimarySegment);
				counter = -1;
			}

			edge0 = edge1;
			edge1 = edge2;
			edge2 = edge2->nextEdge;
			counter++;
		}
		while(counter <= circuit.edgeCount);
		DISLOCATIONS_ASSERT(circuit.edgeCount >= 2);
		DISLOCATIONS_ASSERT(circuit.countEdges() == circuit.edgeCount);

		if(circuit.edgeCount >= maxCircuitLength)
			break;

		// In the second step, extend circuit by inserting an edge if possible.
		bool wasExtended = false;

		// Pick a random start edge to distribute the insertion of new edges
		// over the whole circuit.
		firstEdge = circuit.getEdge(rand() % circuit.edgeCount);

		edge0 = firstEdge;
		edge1 = firstEdge->nextEdge;
		do {
			if(tryInsertOneCircuitEdge(edge0, edge1, isPrimarySegment)) {
				wasExtended = true;
				recordLinePoint(&circuit, isPrimarySegment);
				break;
			}

			edge0 = edge1;
			edge1 = edge1->nextEdge;
		}
		while(edge0 != firstEdge);
		if(!wasExtended) break;
	}
}

/******************************************************************************
* Eliminates two edges from a Burgers circuit if they are opposite halfedges.
******************************************************************************/
bool DXATracing::tryRemoveTwoCircuitEdges(MeshEdge*& edge0, MeshEdge*& edge1, MeshEdge*& edge2)
{
	if(edge1 != edge2->oppositeEdge)
		return false;

	BurgersCircuit* circuit = edge0->circuit;
	DISLOCATIONS_ASSERT(circuit->edgeCount >= 4);
	edge0->nextEdge = edge2->nextEdge;
	if(edge0 == circuit->lastEdge) {
		circuit->firstEdge = circuit->lastEdge->nextEdge;
	}
	else if(edge1 == circuit->lastEdge) {
		circuit->lastEdge = edge0;
		circuit->firstEdge = edge0->nextEdge;
	}
	else if(edge2 == circuit->lastEdge) {
		circuit->lastEdge = edge0;
	}
	circuit->edgeCount -= 2;

	edge1 = edge0->nextEdge;
	edge2 = edge1->nextEdge;
	return true;
}

/******************************************************************************
* Eliminates three edges from a Burgers circuit if they border a triangle.
******************************************************************************/
bool DXATracing::tryRemoveThreeCircuitEdges(MeshEdge*& edge0, MeshEdge*& edge1, MeshEdge*& edge2, bool isPrimarySegment)
{
	MeshFacet* facet1 = edge1->facet;
	MeshFacet* facet2 = edge2->facet;
	DISLOCATIONS_ASSERT(facet1 != NULL && facet2 != NULL);

	if(facet2 != facet1 || facet1->circuit != NULL)
		return false;

	BurgersCircuit* circuit = edge0->circuit;
	DISLOCATIONS_ASSERT(circuit->edgeCount > 2);
	MeshEdge* edge3 = edge2->nextEdge;

	if(edge3->facet != facet1) return false;
	DISLOCATIONS_ASSERT(circuit->edgeCount > 4);

	edge0->nextEdge = edge3->nextEdge;

	if(edge2 == circuit->firstEdge || edge3 == circuit->firstEdge) {
		circuit->firstEdge = edge3->nextEdge;
		circuit->lastEdge = edge0;
	}
	else if(edge1 == circuit->firstEdge) {
		circuit->firstEdge = edge3->nextEdge;
		DISLOCATIONS_ASSERT(circuit->lastEdge == edge0);
	}
	else if(edge3 == circuit->lastEdge) {
		circuit->lastEdge = edge0;
	}
	circuit->edgeCount -= 3;
	edge1 = edge3->nextEdge;
	edge2 = edge1->nextEdge;

	facet1->circuit = circuit;
	if(isPrimarySegment)
		facet1->setFlag(FACET_IS_PRIMARY_SEGMENT);

	return true;
}

/******************************************************************************
* Eliminates one edge from a Burgers circuit by replacing two edges with one.
******************************************************************************/
bool DXATracing::tryRemoveOneCircuitEdge(MeshEdge*& edge0, MeshEdge*& edge1, MeshEdge*& edge2, bool isPrimarySegment)
{
	MeshFacet* facet1 = edge1->facet;
	MeshFacet* facet2 = edge2->facet;
	DISLOCATIONS_ASSERT(facet1 != NULL && facet2 != NULL);
	if(facet2 != facet1 || facet1->circuit != NULL) return false;

	BurgersCircuit* circuit = edge0->circuit;
	DISLOCATIONS_ASSERT(circuit->edgeCount > 2);

	if(edge0->facet == facet1) return false;

	MeshEdge* shortEdge = NULL;
	for(int e = 0; e < 3; e++) {
		if(facet1->edges[e] != edge1 && facet1->edges[e] != edge2) {
			shortEdge = facet1->edges[e]->oppositeEdge;
			break;
		}
	}
	DISLOCATIONS_ASSERT(shortEdge != NULL);

	if(shortEdge->circuit != NULL) return false;

	DISLOCATIONS_ASSERT(shortEdge->nextEdge == NULL);
	shortEdge->nextEdge = edge2->nextEdge;
	DISLOCATIONS_ASSERT(shortEdge != edge2->nextEdge->oppositeEdge);
	DISLOCATIONS_ASSERT(shortEdge != edge0->oppositeEdge);
	edge0->nextEdge = shortEdge;
	if(edge0 == circuit->lastEdge) {
		DISLOCATIONS_ASSERT(circuit->lastEdge != edge2);
		DISLOCATIONS_ASSERT(circuit->firstEdge == edge1);
		DISLOCATIONS_ASSERT(shortEdge != circuit->lastEdge->oppositeEdge);
		circuit->firstEdge = shortEdge;
	}

	if(edge2 == circuit->lastEdge) {
		circuit->lastEdge = shortEdge;
	}
	else if(edge2 == circuit->firstEdge) {
		circuit->firstEdge = shortEdge->nextEdge;
		circuit->lastEdge = shortEdge;
	}
	circuit->edgeCount -= 1;
	edge1 = shortEdge;
	edge2 = shortEdge->nextEdge;
	shortEdge->circuit = circuit;

	facet1->circuit = circuit;
	if(isPrimarySegment)
		facet1->setFlag(FACET_IS_PRIMARY_SEGMENT);

	return true;
}

/******************************************************************************
* Advances a Burgers circuit by skipping two facets.
******************************************************************************/
bool DXATracing::trySweepTwoFacets(MeshEdge*& edge0, MeshEdge*& edge1, MeshEdge*& edge2, bool isPrimarySegment)
{
	MeshFacet* facet1 = edge1->facet;
	MeshFacet* facet2 = edge2->facet;
	DISLOCATIONS_ASSERT(facet1 != NULL && facet2 != NULL);

	if(facet1->circuit != NULL || facet2->circuit != NULL) return false;

	BurgersCircuit* circuit = edge0->circuit;
	if(facet1 == facet2 || circuit->edgeCount <= 2) return false;

	MeshEdge* outerEdge1 = NULL;
	MeshEdge* innerEdge1 = NULL;
	MeshEdge* outerEdge2 = NULL;
	MeshEdge* innerEdge2 = NULL;
	for(int e = 0; e < 3; e++) {
		if(facet1->edges[e] == edge1) {
			outerEdge1 = facet1->edges[(e+2)%3]->oppositeEdge;
			innerEdge1 = facet1->edges[(e+1)%3];
		}
		if(facet2->edges[e] == edge2) {
			outerEdge2 = facet2->edges[(e+1)%3]->oppositeEdge;
			innerEdge2 = facet2->edges[(e+2)%3];
		}
	}
	DISLOCATIONS_ASSERT(outerEdge1 != NULL && outerEdge2 != NULL);

	if(innerEdge1 != innerEdge2->oppositeEdge || outerEdge1->circuit != NULL || outerEdge2->circuit != NULL)
		return false;

	DISLOCATIONS_ASSERT(outerEdge1->nextEdge == NULL);
	DISLOCATIONS_ASSERT(outerEdge2->nextEdge == NULL);
	outerEdge1->nextEdge = outerEdge2;
	outerEdge2->nextEdge = edge2->nextEdge;
	edge0->nextEdge = outerEdge1;
	if(edge0 == circuit->lastEdge) {
		circuit->firstEdge = outerEdge1;
	}
	else if(edge1 == circuit->lastEdge) {
		circuit->lastEdge = outerEdge1;
		circuit->firstEdge = outerEdge2;
	}
	else if(edge2 == circuit->lastEdge) {
		circuit->lastEdge = outerEdge2;
	}
	outerEdge1->circuit = circuit;
	outerEdge2->circuit = circuit;

	facet1->circuit = circuit;
	facet2->circuit = circuit;
	if(isPrimarySegment) {
		facet1->setFlag(FACET_IS_PRIMARY_SEGMENT);
		facet2->setFlag(FACET_IS_PRIMARY_SEGMENT);
	}

	edge0 = outerEdge1;
	edge1 = outerEdge2;
	edge2 = edge1->nextEdge;

	circuit->updateLatticeToWorldTransformation(*this, edge1->node1);

	return true;
}

/******************************************************************************
* Advances a Burgers circuit by skipping one facet and inserting an aditional edge.
******************************************************************************/
bool DXATracing::tryInsertOneCircuitEdge(MeshEdge*& edge0, MeshEdge*& edge1, bool isPrimarySegment)
{
	DISLOCATIONS_ASSERT(edge0 != edge1->oppositeEdge);

	MeshFacet* facet = edge1->facet;
	DISLOCATIONS_ASSERT(facet != NULL);
	if(facet->circuit != NULL)
		return false;

	MeshEdge* insertEdge1 = facet->previousEdge(edge1)->oppositeEdge;
	if(insertEdge1->circuit != NULL)
		return false;

	MeshEdge* insertEdge2 = facet->nextEdge(edge1)->oppositeEdge;
	if(insertEdge2->circuit != NULL)
		return false;

	DISLOCATIONS_ASSERT(insertEdge1->nextEdge == NULL);
	DISLOCATIONS_ASSERT(insertEdge2->nextEdge == NULL);
	BurgersCircuit* circuit = edge0->circuit;
	insertEdge1->nextEdge = insertEdge2;
	insertEdge2->nextEdge = edge1->nextEdge;
	edge0->nextEdge = insertEdge1;
	if(edge0 == circuit->lastEdge) {
		circuit->firstEdge = insertEdge1;
	}
	else if(edge1 == circuit->lastEdge) {
		circuit->lastEdge = insertEdge2;
	}
	insertEdge1->circuit = circuit;
	insertEdge2->circuit = circuit;
	circuit->edgeCount++;

	// Check Burgers circuit.
	DISLOCATIONS_ASSERT(circuit->countEdges() == circuit->edgeCount);
	DISLOCATIONS_ASSERT(circuit->isForwardCircuit() == false || circuit->calculateBurgersVector().equals(circuit->segment->burgersVector));
	DISLOCATIONS_ASSERT(circuit->isForwardCircuit() == true || circuit->calculateBurgersVector().equals(-circuit->segment->burgersVector));

	facet->circuit = circuit;
	if(isPrimarySegment)
		facet->setFlag(FACET_IS_PRIMARY_SEGMENT);

	circuit->updateLatticeToWorldTransformation(*this, insertEdge2->node1);

	return true;
}

/******************************************************************************
* Appends a new point to a dislocation line.
******************************************************************************/
void DXATracing::recordLinePoint(BurgersCircuit* circuit, bool isPrimarySegment)
{
	DislocationSegment* segment = circuit->segment;
	DISLOCATIONS_ASSERT(!segment->line.empty());

	segment->recordLinePoint(circuit, isPrimarySegment, *this);
}


/******************************************************************************
* Look for dislocation segments whose front circuits touch each other.
* If the combined Burgers circuitis below the length threshold then
* join them together.
******************************************************************************/
int DXATracing::joinSegments(int maxCircuitLength)
{
	// First pass over all circuits.
	// Creating secondary dislocation segments in the holes between existing circuits.
	for(size_t circuitIndex = 0; circuitIndex < danglingCircuits.size(); circuitIndex++) {
		BurgersCircuit* circuit = danglingCircuits[circuitIndex];
		DISLOCATIONS_ASSERT(circuit->isDangling);

		// Go around the circuit to find holes.
		MeshEdge* edge = circuit->firstEdge;
		do {
			BurgersCircuit* oppositeCircuit = edge->oppositeEdge->circuit;
			DISLOCATIONS_ASSERT(edge->circuit == circuit);
			if(oppositeCircuit == NULL) {
				DISLOCATIONS_ASSERT(edge->oppositeEdge->nextEdge == NULL);

				// Try to create a new circuit inside the hole.
				createSecondarySegment(edge, circuit, maxCircuitLength);

				// Continue along circuit until next junction.
				while(edge->oppositeEdge->circuit == NULL && edge != circuit->firstEdge)
					edge = edge->nextEdge;
			}
			else edge = edge->nextEdge;
		}
		while(edge != circuit->firstEdge);
	}

	// Second pass over all circuits.
	// Gather circuits which are completely surrounded by other circuits. They are candidates for the creation of junctions.
	for(vector<BurgersCircuit*>::const_iterator circuit_iter = danglingCircuits.begin(); circuit_iter != danglingCircuits.end(); ++circuit_iter) {
		BurgersCircuit* circuit = *circuit_iter;
		DISLOCATIONS_ASSERT(circuit->isDangling);

		// Go around the circuit to see whether it is completely surrounded by other circuits.
		// Also put it into the same ring as its neighbors.
		circuit->isEnclosed = true;
		MeshEdge* edge = circuit->firstEdge;
		do {
			DISLOCATIONS_ASSERT(edge->circuit == circuit);
			BurgersCircuit* oppositeCircuit = edge->oppositeEdge->circuit;
			if(oppositeCircuit == NULL) {
				circuit->isEnclosed = false;
			}
			else {
				DISLOCATIONS_ASSERT(oppositeCircuit->isDangling);
				if(circuit->isInRing(oppositeCircuit) == false) {
					DISLOCATIONS_ASSERT(oppositeCircuit->isInRing(circuit) == false);
					circuit->joinRings(oppositeCircuit);
				}
			}
			edge = edge->nextEdge;
		}
		while(edge != circuit->firstEdge);
	}

	// Count the number of created dislocation junctions.
	int numJunctions = 0;

	// Last pass over all circuits.
	// Create junctions for completed rings.
	for(vector<BurgersCircuit*>::const_iterator circuit_iter = danglingCircuits.begin(); circuit_iter != danglingCircuits.end(); ++circuit_iter) {
		BurgersCircuit* circuit = *circuit_iter;

		// Skip circuits which are already part of a junction.
		if(circuit->isDangling == false) continue;

		// Check all circuits in the ring. They must all be completely enlcosed by other circuits.
		bool isCompleteRing = true;
		int circuitCount = 0;
		Vector3 junctionVector(NULL_VECTOR);
		Point3 refPoint = circuit->center();
		BurgersCircuit* c = circuit->junctionRing;
		LatticeVector burgersVector(NULL_VECTOR);
		do {
			DISLOCATIONS_ASSERT(c->isDangling);
			if(c->isEnclosed == false) {
				isCompleteRing = false;
				break;
			}
			circuitCount++;
			junctionVector += wrapVector(c->center() - refPoint);
			burgersVector += c->burgersVector();
			c = c->junctionRing;
		}
		while(c != circuit->junctionRing);
		if(isCompleteRing == false) continue;

		// Junction must follow the Frank rule (Burgers vector conservation).
		DISLOCATIONS_ASSERT(burgersVector.equals(NULL_VECTOR));

		// Junctions must consist of at least two dislocation segments.
		DISLOCATIONS_ASSERT(circuitCount >= 2);

		// Create a new junction for three or more segments.
		if(circuitCount >= 3) {
			numJunctions++;
			junctionVector /= circuitCount;

			//LOG_INFO() << "Created junction with " << circuitCount << " segments.";

			// Extend segment lines up to junction.
			DISLOCATIONS_ASSERT(c == circuit->junctionRing);
			do {
				c->isDangling = false;
				if(c->isForwardCircuit()) {
					c->segment->line.push_back(c->segment->line.back() + wrapVector(refPoint + junctionVector - c->segment->line.back()));
					c->segment->primarySegmentEnd = c->segment->line.size();
				}
				else {
					c->segment->line.push_front(c->segment->line.front() + wrapVector(refPoint + junctionVector - c->segment->line.front()));
					c->segment->primarySegmentStart = 0;
					c->segment->primarySegmentEnd++;
				}
				c = c->junctionRing;
			}
			while(c != circuit->junctionRing);
		}
		else {
			// For a two-segment junction, just join the two segments into a single segment.
			BurgersCircuit* circuit1 = circuit;
			BurgersCircuit* circuit2 = circuit->junctionRing;
			DISLOCATIONS_ASSERT(circuit2->junctionRing == circuit1);
			DISLOCATIONS_ASSERT(circuit1->junctionRing == circuit2);
			DISLOCATIONS_ASSERT(circuit2->burgersVector().equals(-circuit1->burgersVector()));
			circuit1->isDangling = false;
			circuit2->isDangling = false;
			// Join segments only if it is not a closed loop.
			if(circuit1->oppositeCircuit != circuit2) {
				BurgersCircuit* endCircuit1 = circuit1->oppositeCircuit;
				BurgersCircuit* endCircuit2 = circuit2->oppositeCircuit;
				DislocationSegment* segment1 = endCircuit1->segment;
				DislocationSegment* segment2 = endCircuit2->segment;
				DISLOCATIONS_ASSERT(segment1->primarySegmentEnd <= segment1->line.size());
				DISLOCATIONS_ASSERT(segment1->primarySegmentEnd > segment1->primarySegmentStart);
				if(endCircuit1->isForwardCircuit()) {
					segment1->circuits[1] = endCircuit2;
					segment1->primarySegmentEnd += segment2->line.size() - 1;
					Vector3 shiftVector;
					if(endCircuit2->isForwardCircuit()) {
						shiftVector = segment2->line.front() - segment1->line.front();
						segment1->line.insert(segment1->line.begin(), segment2->line.rbegin(), segment2->line.rend() - 1);
						segment1->primarySegmentStart = segment2->line.size() - segment2->primarySegmentEnd;
						DISLOCATIONS_ASSERT(segment1->primarySegmentEnd <= segment1->line.size());
					}
					else {
						shiftVector = segment2->line.back() - segment1->line.front();
						segment1->line.insert(segment1->line.begin(), segment2->line.begin(), segment2->line.end() - 1);
						segment1->primarySegmentStart = segment2->primarySegmentStart;
						DISLOCATIONS_ASSERT(segment1->primarySegmentEnd <= segment1->line.size());
					}
					if(LengthSquared(shiftVector) > cnaCutoff*cnaCutoff) {
						for(deque<Point3>::iterator p = segment1->line.begin(); p != segment1->line.begin() + segment2->line.size() - 1; ++p)
							*p -= shiftVector;
					}
				}
				else {
					segment1->circuits[0] = endCircuit2;
					Vector3 shiftVector;
					if(endCircuit2->isForwardCircuit()) {
						shiftVector = segment2->line.front() - segment1->line.back();
						segment1->primarySegmentEnd = segment2->primarySegmentEnd + segment1->line.size() - 1;
						segment1->line.insert(segment1->line.end(), segment2->line.begin() + 1, segment2->line.end());
						DISLOCATIONS_ASSERT(segment1->primarySegmentEnd <= segment1->line.size());
					}
					else {
						shiftVector = segment2->line.back() - segment1->line.back();
						segment1->line.insert(segment1->line.end(), segment2->line.rbegin() + 1, segment2->line.rend());
						segment1->primarySegmentEnd = segment1->line.size() - segment2->primarySegmentStart;
						DISLOCATIONS_ASSERT(segment1->primarySegmentEnd <= segment1->line.size());
					}
					if(LengthSquared(shiftVector) > cnaCutoff*cnaCutoff) {
						for(deque<Point3>::iterator p = segment1->line.end() - segment2->line.size() + 1; p != segment1->line.end(); ++p)
							*p -= shiftVector;
					}
				}
				DISLOCATIONS_ASSERT(segment1->primarySegmentEnd > segment1->primarySegmentStart);
				DISLOCATIONS_ASSERT(segment1->primarySegmentEnd <= segment1->line.size());
				endCircuit2->segment = segment1;
				//circuit2->segment = segment1;
				segment2->replacedWith = segment1;
				endCircuit1->oppositeCircuit = endCircuit2;
				endCircuit2->oppositeCircuit = endCircuit1;
				segments.erase(find(segments.begin(), segments.end(), segment2));
			}
			else {
				DISLOCATIONS_ASSERT(circuit1->segment == circuit2->segment);
				DISLOCATIONS_ASSERT(circuit1->segment->isClosedLoop());
				if(!wrapVector(circuit1->segment->line.front() - circuit1->segment->line.back()).equals(NULL_VECTOR)) {
					circuit1->segment->line.push_back(circuit1->segment->line.back() +
							wrapVector(circuit1->segment->line.front() - circuit1->segment->line.back()));
				}
				DISLOCATIONS_ASSERT(wrapVector(circuit1->segment->line.front() - circuit1->segment->line.back()).equals(NULL_VECTOR));
				DISLOCATIONS_ASSERT(circuit1->segment->line.size() >= 3);
				circuit1->segment->primarySegmentStart = 0;
				circuit1->segment->primarySegmentEnd = circuit1->segment->line.size();
			}
		}
	}

	// Clean up list of dangling circuits. Remove joined circuits.
	vector<BurgersCircuit*>::iterator destination = danglingCircuits.begin();
	for(vector<BurgersCircuit*>::const_iterator circuit_iter = danglingCircuits.begin(); circuit_iter != danglingCircuits.end(); ++circuit_iter) {
		if((*circuit_iter)->isDangling)
			*destination++ = *circuit_iter;
	}
	danglingCircuits.erase(destination, danglingCircuits.end());

	return numJunctions;
}

void DXATracing::createSecondarySegment(MeshEdge* firstEdge, BurgersCircuit* outerCircuit, int maxCircuitLength)
{
	// Create circuit along the border of the hole.
	int edgeCount = 1;
	LatticeVector burgersVector(NULL_VECTOR);
	bool isBorder = false;
	int numCircuits = 1;
	MeshEdge* circuitStart = firstEdge->oppositeEdge;
	MeshEdge* circuitEnd = circuitStart;
	MeshEdge* edge = circuitStart;
	for(;;) {
		for(;;) {
			DISLOCATIONS_ASSERT(edge->facet != NULL);
			DISLOCATIONS_ASSERT(edge->circuit == NULL);
			MeshEdge* oppositeEdge = edge->oppositeEdge;
			MeshFacet* oppositeFacet = oppositeEdge->facet;
			if(oppositeFacet == NULL) {
				isBorder = true;
				break;
			}
			MeshEdge* nextEdge = oppositeFacet->edges[(oppositeFacet->edgeIndex(oppositeEdge)+2) % 3];
			DISLOCATIONS_ASSERT(nextEdge->node2() == oppositeEdge->node1);
			DISLOCATIONS_ASSERT(nextEdge->node2() == edge->node2());
			if(nextEdge->circuit != NULL) {
				if(nextEdge->circuit != outerCircuit) {
					outerCircuit = nextEdge->circuit;
					numCircuits++;
				}
				edge = nextEdge->oppositeEdge;
				break;
			}
			edge = nextEdge;
		}
		if(isBorder) break;
		DISLOCATIONS_ASSERT(edgeCount < 1000);
		circuitEnd->nextEdge = edge;
		burgersVector += edge->latticeVector;
		if(edge == circuitStart)
			break;
		circuitEnd = edge;
		edgeCount++;
	}

	LOG_INFO() << "Build hole circuit: " << edgeCount << " edges  b=" << burgersVector << "  isBorder=" << isBorder << " numCircuits = " << numCircuits;

	// Create secondary segment only for dislocations (b != 0) and thin enough dislocation cores.
	if(numCircuits == 1 || isBorder || edgeCount > maxCircuitLength || burgersVector.equals(NULL_VECTOR)) {
		// Clear unused circuit.
		edge = circuitStart;
		for(;;) {
			DISLOCATIONS_ASSERT(edge->circuit == NULL);
			MeshEdge* nextEdge = edge->nextEdge;
			edge->nextEdge = NULL;
			if(edge == circuitEnd) break;
			edge = nextEdge;
		}
		return;
	}
	DISLOCATIONS_ASSERT(circuitStart != circuitEnd);

	// Create forward circuit.
	BurgersCircuit* forwardCircuit = circuitPool.construct();
	danglingCircuits.push_back(forwardCircuit);
	forwardCircuit->firstEdge = circuitStart;
	forwardCircuit->lastEdge = circuitEnd;
	forwardCircuit->edgeCount = edgeCount;
	forwardCircuit->isEnclosed = true;
	edge = circuitStart;
	do {
		DISLOCATIONS_ASSERT(edge->circuit == NULL);
		edge->circuit = forwardCircuit;
		edge = edge->nextEdge;
	}
	while(edge != circuitStart);
	DISLOCATIONS_ASSERT(forwardCircuit->countEdges() == forwardCircuit->edgeCount);

	LOG_INFO() << "Creating secondary segment";

	// Build the backward circuit.
	BurgersCircuit* backwardCircuit = buildBackwardCircuit(forwardCircuit);

	// Allocate a new dislocation segment.
	DislocationSegment* segment = segmentPool.construct(burgersVector, forwardCircuit, backwardCircuit, firstEdge->node1->pos, *this);
	segment->index = segments.size();
	segments.push_back(segment);

	forwardCircuit->updateLatticeToWorldTransformation(*this);

	// Trace the segment in the backward direction.
	traceSegment(*segment, *backwardCircuit, maxCircuitLength, true);

	segment->determineWorldBurgersVector();

	// Create cap facets.
	forwardCircuit->createPrimaryCap();
	backwardCircuit->createPrimaryCap();
}

void BurgersCircuit::updateLatticeToWorldTransformation(const AnalysisEnvironment& simCell) const
{
	MeshEdge* e = firstEdge;
	do {
		updateLatticeToWorldTransformation(simCell, e->node1);
		e = e->nextEdge;
	}
	while(e != firstEdge);
}

void BurgersCircuit::updateLatticeToWorldTransformation(const AnalysisEnvironment& simCell, MeshNode* node) const
{
	DISLOCATIONS_ASSERT(segment != NULL);
	for(int nindex = 0; nindex < node->numNeighbors; nindex++) {
		BaseAtom* atom = node->neighbor(nindex);
		if(atom == NULL) continue;
		if(atom->isCrystalline()) {
			for(int n2 = 0; n2 < atom->numNeighbors; n2++) {
				if(atom->neighbor(n2) == NULL) continue;
				const Vector3& nv = simCell.wrapVector(atom->neighbor(n2)->pos - atom->pos);
				const LatticeVector& lv = ((InputAtom*)atom)->latticeNeighborVector(n2);
				for(int i = 0; i < 3; i++) {
					for(int j = 0; j < 3; j++) {
						segment->V(i,j) += lv[j] * lv[i];
						segment->W(i,j) += lv[j] * nv[i];
					}
				}
				BaseAtom* neighbor = atom->neighbor(n2);
				if(neighbor->isCrystalline()) {
					for(int n3 = 0; n3 < neighbor->numNeighbors; n3++) {
						if(neighbor->neighbor(n3) == NULL) continue;
						const Vector3& nv = simCell.wrapVector(neighbor->neighbor(n3)->pos - neighbor->pos);
						const LatticeVector& lv = ((InputAtom*)neighbor)->latticeNeighborVector(n3);
						for(int i = 0; i < 3; i++) {
							for(int j = 0; j < 3; j++) {
								segment->V(i,j) += lv[j] * lv[i];
								segment->W(i,j) += lv[j] * nv[i];
							}
						}
					}
				}
			}
		}
	}
}

void DislocationSegment::determineWorldBurgersVector()
{
	DISLOCATIONS_ASSERT(fabs(V.determinant()) > FLOATTYPE_EPSILON);
	DISLOCATIONS_ASSERT(fabs(W.determinant()) > FLOATTYPE_EPSILON);
	Matrix3 latticeToWorld = W * V.inverse();
	burgersVectorWorld = latticeToWorld * burgersVector;
}

/******************************************************************************
* Determines whether a Burgers circuit is intersected by a SF contour.
******************************************************************************/
void DXATracing::circuitContourIntersection(MeshEdge* contourEdge1, MeshEdge* contourEdge2, MeshEdge* circuitEdge1, MeshEdge* circuitEdge2, int& goingOutside, int& goingInside)
{
	DISLOCATIONS_ASSERT(contourEdge2->node1 == circuitEdge2->node1);
	DISLOCATIONS_ASSERT(contourEdge1->node2() == circuitEdge2->node1);
	DISLOCATIONS_ASSERT(circuitEdge1->node2() == circuitEdge2->node1);

	// Iterate over interior facet edges.
	MeshEdge* edge = circuitEdge2;
	bool contour1inside = false;
	bool contour2inside = false;
	for(;;) {
		MeshEdge* oppositeEdge = edge->oppositeEdge;
		if(oppositeEdge == circuitEdge1) break;
		if(edge != circuitEdge2) {
			if(oppositeEdge == contourEdge1) contour1inside = true;
			if(edge == contourEdge2) contour2inside = true;
		}
		MeshFacet* facet = oppositeEdge->facet;
		DISLOCATIONS_ASSERT(facet != NULL);
		edge = facet->nextEdge(oppositeEdge);
		DISLOCATIONS_ASSERT(edge->node1 == circuitEdge2->node1);
		DISLOCATIONS_ASSERT(edge != circuitEdge2);
	}
	DISLOCATIONS_ASSERT(contourEdge2 != circuitEdge2 || contour2inside == false);

	// Iterate over exterior facet edges.
	bool contour1outside = false;
	bool contour2outside = false;
	edge = circuitEdge1;
	for(;;) {
		MeshFacet* facet = edge->facet;
		DISLOCATIONS_ASSERT(facet != NULL);
		MeshEdge* nextEdge = facet->nextEdge(edge);
		if(nextEdge == circuitEdge2) break;
		MeshEdge* oppositeEdge = nextEdge->oppositeEdge;
		DISLOCATIONS_ASSERT(oppositeEdge->node2() == circuitEdge2->node1);
		edge = oppositeEdge;
		if(edge == contourEdge1) contour1outside = true;
		if(nextEdge == contourEdge2) contour2outside = true;
	}

	DISLOCATIONS_ASSERT(contour1outside == false || contour1inside == false);
	DISLOCATIONS_ASSERT(contour2outside == false || contour2inside == false);

	if(contour2outside == true && contour1outside == false) {
		goingOutside += 1;
	}
	else if(contour2inside == true && contour1inside == false) {
		goingInside += 1;
	}
}
