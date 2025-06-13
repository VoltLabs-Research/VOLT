#include <opendxa/parser/parser_stream.hpp>
#include <opendxa/engine/config.hpp>
#include <opendxa/core/stacking_faults.hpp>
#include <opendxa/utils/timer.hpp>
#include <GL/glu.h>

json DXAStackingFaults::compute(const OpenDXA::Config &config){
	setCNACutoff((FloatType) config.cnaCutoff);
	setPBC(config.pbcX, config.pbcY, config.pbcZ);
	setMaximumBurgersCircuitSize(config.maxCircuitSize);
	setMaximumExtendedBurgersCircuitSize(config.extendedCircuitSize);

	std::ifstream inputFile(config.inputFile);
	if(!inputFile){
		throw std::runtime_error("Cannot open " + config.inputFile);
	}

	ParserStream parserStream(inputFile);
	readAtomsFile(parserStream);

	if(config.scaleFactors != Vector3{1, 1, 1}){
		transformSimulationCell(Matrix3(config.scaleFactors.X, 0, 0, 0, config.scaleFactors.Y, 0, 0, 0, config.scaleFactors.Z));
	}

	wrapInputAtoms(config.atomOffset);

	Timer fullTimer;
	buildNearestNeighborLists();
	performCNA();
	orderCrystallineAtoms();
	clusterAtoms();
	createInterfaceMeshNodes();

	if(!config.dumpSFPlanesFile.empty()) createStackingFaultEdges();
	if(!config.dumpAtomsFile.empty()) writeAtomsDumpFile(*new std::ofstream(config.dumpAtomsFile));

	createInterfaceMeshFacets();
	validateInterfaceMesh();
	findStackingFaultPlanes();
	traceDislocationSegments();

	if(!config.dumpSurfaceFile.empty()){
		generateOutputMesh();
		smoothOutputSurface(config.surfaceSmooth);
		writeOutputMeshFile(*new std::ofstream(config.dumpSurfaceFile));
	}

	smoothDislocationSegments(config.lineSmooth, config.lineCoarsen);
	finishStackingFaults(config.sfFlatten);
	wrapDislocationSegments();

	std::ofstream fout(config.outputFile);
	if(!fout){
		throw std::runtime_error("Cannot open " + config.outputFile);
	}

	writeDislocationsVTKFile(fout);
	json data = exportDislocationsToJson();
	data["interface_mesh"] = getInterfaceMeshData();

	// Calculate scalar dislocation density and density tensor
	// TODO: This may be optional, and in the future may be exported if specified.
	double dislocationDensity = 0.0;
	double dislocationDensityTensor[3][3] = { 0.0 };

	const std::vector<DislocationSegment*>& segments = getSegments();
	for(int segmentIndex = 0; segmentIndex < segments.size(); segmentIndex++){
		DislocationSegment* segment = segments[segmentIndex];
		const std::deque<Point3>& line = segment->line;
		// line.front() line.back() (line.back() - line.front()) (diff)
		for(std::deque<Point3>::const_iterator p1 = line.begin(), p2 = line.begin() + 1; p2 < line.end(); ++p1, ++p2){
			Vector3 delta = (*p2) - (*p1);
			dislocationDensity += Length(delta);
			for(int i = 0; i < 3; i++){
				for(int j = 0; j < 3; j++){
					dislocationDensityTensor[i][j] += delta[i] * segment->burgersVectorWorld[j];
				}
			}
		}
	}

	double volume = getSimulationCell().determinant();
	dislocationDensity /= volume;
	for(int i = 0; i < 3; i++){
		for(int j = 0; j < 3; j++){
			dislocationDensityTensor[i][j] /= volume;
		}
	}

	LOG_INFO() << "Dislocation densitity: " << dislocationDensity;
	LOG_INFO() << "Dislocation density tensor: ";
	for(int i = 0; i < 3; i++){
		LOG_INFO() << dislocationDensityTensor[i][0] << " " << dislocationDensityTensor[i][1] << " " << dislocationDensityTensor[i][2];
	}

	LOG_INFO() << "Total time: " << fullTimer.elapsedTime() << " seconds.";

	cleanup();

	return data;
}

bool DXAStackingFaults::createStackingFaultEdges(){
	LOG_INFO() << "Creating stacking fault contour edges.";

	bool isInvalidInput = false;
	int numExtraEdgesCreated = 0;

	for(vector<InputAtom>::iterator atom = inputAtoms.begin(); atom != inputAtoms.end(); ++atom) {
		if(atom->isNonHCP()) continue;

		BaseAtom* neighbor1 = atom->neighbor(hcpBasalPlaneAtoms[5]);
		for(int n = 0; n < 6; n++) {
			BaseAtom* neighbor2 = atom->neighbor(hcpBasalPlaneAtoms[n]);
			if(neighbor1 == NULL || neighbor2 == NULL) {
				isInvalidInput = true;
				neighbor1 = neighbor2;
				continue;
			}
			DISLOCATIONS_ASSERT(neighbor1 != NULL && neighbor2 != NULL);

			if(neighbor1->isDisordered() && neighbor2->isDisordered()) {
				MeshNode* node1 = (MeshNode*)neighbor1;
				MeshNode* node2 = (MeshNode*)neighbor2;
				Vector3 latticeVector = atom->latticeOrientation *
						(hcpLattice.neighborVectors[hcpBasalPlaneAtoms[n]] - hcpLattice.neighborVectors[hcpBasalPlaneAtoms[(n+5)%6]]);

				MeshEdge* meshEdge = NULL;
				int numExistingEdges = 0;
				// Find existing interface mesh edges, which border the HCP plane.
				for(int e = 0; e < node1->numEdges; e++) {
					MeshEdge* edge = &node1->edges[e];
					if(edge->node2() == node2 && edge->latticeVector.equals(latticeVector)) {
						meshEdge = edge;
						// Mark edge as border edge.
						meshEdge->isSFEdge = true;
						meshEdge->oppositeEdge->isSFEdge = true;
						numExistingEdges++;
					}
				}
				if(meshEdge == NULL) {
					numExtraEdgesCreated++;
					// Create a new edge.
					meshEdge = node1->createEdge(node2, latticeVector);
					meshEdge->isSFEdge = true;
					meshEdge->oppositeEdge->isSFEdge = true;
				}
				DISLOCATIONS_ASSERT(meshEdge != NULL);
			}
			neighbor1 = neighbor2;
		}

		// Identify intrinsic stacking fault (ISF) atoms.
		// ISF atoms have at least one HCP neighbor, which is not in the basal plane.
		for(int n = 0; n < 6; n++) {
			BaseAtom* neighbor = atom->neighbor(hcpNonBasalPlaneAtoms[n]);
			if(neighbor == NULL) continue;
			if(neighbor->isDisordered() || ((InputAtom*)neighbor)->isNonHCP()) continue;
			for(int n2 = 0; n2 < 6; n2++) {
				if(neighbor->neighbor(hcpNonBasalPlaneAtoms[n2]) == &*atom) {
					atom->setFlag(ATOM_ISF);
					break;
				}
			}
		}

		// Identify twin boundary (TB) atoms.
		// TB atoms have at least one FCC neighbor on each side of the basal plane.
		for(int n = 0; n < 3; n++) {
			BaseAtom* neighbor = atom->neighbor(hcpNonBasalPlaneAtoms[n]);
			if(neighbor == NULL) continue;
			if(neighbor->isDisordered() || ((InputAtom*)neighbor)->isNonFCC()) continue;
			for(int n2 = 3; n2 < 6; n2++) {
				BaseAtom* neighbor = atom->neighbor(hcpNonBasalPlaneAtoms[n2]);
				if(neighbor == NULL) continue;
				if(neighbor->isDisordered() || ((InputAtom*)neighbor)->isNonFCC()) continue;
				atom->setFlag(ATOM_TB);
				break;
			}
			break;
		}
	}

	if(isInvalidInput)
		LOG_INFO() << "*** WARNING ***: Cannot extract stacking faults due to invalid input file. No stacking fault output will be generated.";

	LOG_INFO() << "Created " << numExtraEdgesCreated << " extra SF border edges.";

	return !isInvalidInput;
}

void DXAStackingFaults::findStackingFaultPlanes(){
	LOG_INFO() << "Tracing stacking fault contours.";

	// Reset visit flags of atoms.
	for(vector<InputAtom>::iterator atom = inputAtoms.begin(); atom != inputAtoms.end(); ++atom)
		atom->clearVisitFlag();

	// Find a first HCP atoms. It is the seed for the recursive walk.
	for(vector<InputAtom>::iterator seedAtom = inputAtoms.begin(); seedAtom != inputAtoms.end(); ++seedAtom) {
		// Skip atoms that are already part of a plane.
		if(seedAtom->wasVisited()) continue;
		// Skip non-HCP atoms.
		if(seedAtom->isNonHCP()) continue;

		// Recursively visit all basal plane neighbors of the seed atom.
		// Initialize recursive walk stack.
		deque< pair<InputAtom*, Point3> > toprocess;	// Contains all atoms that still have to be processed as well as their unwrapped positions.
		toprocess.push_back(make_pair(&*seedAtom, seedAtom->pos));
		seedAtom->pbcImage = NULL_VECTOR;
		seedAtom->setVisitFlag();
		DISLOCATIONS_ASSERT(periodicImage(seedAtom->pos) == NULL_VECTOR);

		// Calculate normal vector of HCP basal plane ({111} plane) in lattice space.
		LatticeVector sfPlaneNormal = seedAtom->latticeOrientation * LatticeVector(1.0, 1.0, 1.0);

		// Allocate a new stacking fault object.
		StackingFault* sf = stackingFaultPool.construct();
		sf->index = stackingFaults.size();
		sf->normalVector = NULL_VECTOR;
		sf->center = ORIGIN;
		sf->basePoint = seedAtom->pos;
		sf->globalVertexList = NULL;
		sf->isInfinite[0] = sf->isInfinite[1] = sf->isInfinite[2] = false;
		sf->isInvalid = false;
		sf->numHCPAtoms = 0;
		sf->numISFAtoms = 0;
		sf->numTBAtoms = 0;
		stackingFaults.push_back(sf);

		set<MeshEdge*> visitedEdges;

		do {
			// Take next atom from the recursive stack.
			InputAtom* currentAtom = toprocess.front().first;
			Point3 currentUnwrappedPos = toprocess.front().second;
			toprocess.pop_front();

			// Calculate center of mass of the stacking fault.
			// Note that we have to use the unwrapped positions of the atoms.
			sf->center += currentUnwrappedPos - ORIGIN;
			sf->numHCPAtoms++;
			if(currentAtom->testFlag(ATOM_ISF)) sf->numISFAtoms++;
			if(currentAtom->testFlag(ATOM_TB)) sf->numTBAtoms++;

			// Align local orientation of HCP basal plane with global SF orientation.
			LatticeVector planeNormalLocal = currentAtom->latticeOrientation * LatticeVector(1.0, 1.0, 1.0);
			const int* hcpBasalPlaneIndices;
			if(isDotProductPositive(sfPlaneNormal, planeNormalLocal))
				hcpBasalPlaneIndices = hcpBasalPlaneAtoms;
			else
				hcpBasalPlaneIndices = hcpBasalPlaneAtomsReverse;

			// The 6 lattice vectors in the basal plane.
			LatticeVector basalPlaneLatticeVectors[6];
			for(int n = 0; n < 6; n++)
				basalPlaneLatticeVectors[n] = currentAtom->latticeNeighborVector(hcpBasalPlaneIndices[n]);

			for(int n = 0; n < 6; n++) {
				BaseAtom* neighbor1 = currentAtom->neighbor(hcpBasalPlaneIndices[n]);
				BaseAtom* neighbor2 = currentAtom->neighbor(hcpBasalPlaneIndices[(n+1)%6]);
				if(neighbor1 == NULL) continue;

				// Calculate average normal vector of stacking fault plane.
				if(neighbor2 != NULL)
					sf->normalVector += CrossProduct(wrapVector(neighbor1->pos - currentAtom->pos), wrapVector(neighbor2->pos - currentAtom->pos));

				if(neighbor1->isMeshNode()) {

					// Is it a mesh edge connecting two nodes?
					if(neighbor2 == NULL || neighbor2->isMeshNode() == false) continue;
					if(neighbor1->testFlag(ATOM_SHARED_NODE)) continue;
					if(neighbor2->testFlag(ATOM_SHARED_NODE)) continue;

					MeshNode* node1 = (MeshNode*)neighbor1;
					MeshNode* node2 = (MeshNode*)neighbor2;

					// Calculate expected direction of edge in lattice space.
					LatticeVector node1LatticeVector = basalPlaneLatticeVectors[n];
					LatticeVector node2LatticeVector = basalPlaneLatticeVectors[(n+1)%6];
					LatticeVector edgeLatticeVector = node2LatticeVector - node1LatticeVector;
					DISLOCATIONS_ASSERT(edgeLatticeVector.equals(basalPlaneLatticeVectors[(n+2) % 6]));

					// Find actual interface mesh edge, which borders the HCP plane.
					MeshEdge* borderEdge = NULL;
					for(int e = 0; e < node1->numEdges; e++) {
						MeshEdge* edge = &node1->edges[e];
						if(edge->node2() == node2 &&
								edge->latticeVector.equals(edgeLatticeVector) &&
								isValidStackingFaultContourEdge(edge, node1LatticeVector, node2LatticeVector)) {
							borderEdge = edge;
							break;
						}
					}
					if(!borderEdge) continue;
					DISLOCATIONS_ASSERT(findEdgeBasalPlaneNeighbor(borderEdge, node1LatticeVector, node2LatticeVector) == currentAtom);

					// Is this edge part of a contour that has already been traced?
					if(visitedEdges.find(borderEdge) != visitedEdges.end()) continue;

					//if(sf->index == 3038) {
					//	LOG_INFO() << "SF " << sf->index << " seed edge: " << borderEdge->node1->tag << " - " << borderEdge->node2()->tag << "  hcp atom: " << currentAtom->tag;
					//}

					// Begin a new contour.
					StackingFaultContour contour;
					contour.sf = sf;
					contour.edges.push_back(borderEdge);
					contour.basePoint = currentUnwrappedPos + wrapVector(borderEdge->node1->pos - currentAtom->pos);
					visitedEdges.insert(borderEdge);

					// Trace closed countour around stacking fault.
					traceStackingFaultContour(sf, contour, toprocess, currentUnwrappedPos + wrapVector(borderEdge->node2()->pos - currentAtom->pos),
							visitedEdges, basalPlaneLatticeVectors, (n + 2) % 6);
					DISLOCATIONS_ASSERT(contour.edges.size() > 1);
					DISLOCATIONS_ASSERT(contour.edges.back()->node2() == contour.edges.front()->node1);

					// Skip degenerate contours with less than three edges.
					if(contour.edges.size() < 3) continue;

					// Add contour to the list of contours of the current stacking fault polygon.
					sf->contours.push_back(contour);
				}
				else {
					// Put 6 basal plane neighbors of HCP atoms onto the recursive walk stack.
					recursiveWalkSFAtom((InputAtom*)neighbor1, sf, currentUnwrappedPos + wrapVector(neighbor1->pos - currentAtom->pos), toprocess);
				}
			}
		}
		while(toprocess.empty() == false);

		// Calculate average normal vector and center of mass point of the current stacking fault polygon.
		sf->normalVector = NormalizeSafely(sf->normalVector);
		sf->center.X /= sf->numHCPAtoms;
		sf->center.Y /= sf->numHCPAtoms;
		sf->center.Z /= sf->numHCPAtoms;

		// A planar stacking fault can only be infinite in two or less dimensions.
		DISLOCATIONS_ASSERT(sf->isInfinite[0] == false || sf->isInfinite[1] == false || sf->isInfinite[2] == false);
		for(int dim = 0; dim < 3; dim++) {
			if(sf->isInfinite[dim]) {
				//DISLOCATIONS_ASSERT(fabs(sf->normalVector[dim]) < FLOATTYPE_EPSILON);
				sf->normalVector[dim] = 0;
			}
		}
	}

	LOG_INFO() << "Found " << stackingFaults.size() << " stacking faults.";
}

/******************************************************************************
* Puts the atom onto the recusrive stack.
******************************************************************************/
void DXAStackingFaults::recursiveWalkSFAtom(InputAtom* atom, StackingFault* sf, Point3 unwrappedPos, deque< pair<InputAtom*, Point3> >& toprocess)
{
	// Round unwrapped pos.
	Vector3 shift = absoluteToReduced(unwrappedPos - atom->pos);
	shift.X = floor(shift.X + 0.5);
	shift.Y = floor(shift.Y + 0.5);
	shift.Z = floor(shift.Z + 0.5);
	unwrappedPos = atom->pos + reducedToAbsolute(shift);

	DISLOCATIONS_ASSERT(atom->isHCP());
	if(atom->wasVisited() == false) {
		atom->setVisitFlag();
		atom->pbcImage = periodicImage(unwrappedPos);
		toprocess.push_back(make_pair(atom, unwrappedPos));
	}
	else {
		Vector3I pbcShift = (atom->pbcImage - periodicImage(unwrappedPos));
		if(pbcShift.X != 0) sf->isInfinite[0] = true;
		if(pbcShift.Y != 0) sf->isInfinite[1] = true;
		if(pbcShift.Z != 0) sf->isInfinite[2] = true;
	}
}

/******************************************************************************
* Finds the basal plane HCP atom for a contour edge.
******************************************************************************/
BaseAtom* DXAStackingFaults::findEdgeBasalPlaneNeighbor(MeshEdge* edge, const LatticeVector& node1LatticeVector, const LatticeVector& node2LatticeVector) const
{
	MeshNode* currentNode = edge->node1;
	MeshNode* nextNode = edge->node2();

	for(int nn = 0; nn < currentNode->numNeighbors; nn++) {
		BaseAtom* neighbor = currentNode->neighbor(nn);
		if(neighbor->isMeshNode() == false && ((InputAtom*)neighbor)->isHCP()) {
			if(!neighbor->hasNeighborTag(nextNode->tag)) {
				continue;
			}
			DISLOCATIONS_ASSERT(neighbor->hasNeighborTag(currentNode->tag));

			// Check if the two edge nodes are in the hexagonal basal plane of the HCP atom.
			int index1 = neighbor->neighborIndexTag(currentNode->tag);
			if(find(hcpBasalPlaneAtoms, hcpBasalPlaneAtoms+6, index1) == hcpBasalPlaneAtoms+6) continue;
			int index2 = neighbor->neighborIndexTag(nextNode->tag);
			if(find(hcpBasalPlaneAtoms, hcpBasalPlaneAtoms+6, index2) == hcpBasalPlaneAtoms+6) continue;

			// Check if the two lattice vectors from the HCP atom to the edge end points are valid hexagonal basal plane vectors.
			if(node1LatticeVector.equals(((InputAtom*)neighbor)->latticeNeighborVector(index1)) == false) continue;
			if(node2LatticeVector.equals(((InputAtom*)neighbor)->latticeNeighborVector(index2)) == false) continue;

			return (InputAtom*)neighbor;
		}
	}

	return NULL;
}

/******************************************************************************
* Checks whether this mesh edge borders a stacking fault.
******************************************************************************/
bool DXAStackingFaults::isValidStackingFaultContourEdge(MeshEdge* edge, const LatticeVector& node1LatticeVector, const LatticeVector& node2LatticeVector) const
{
	// A valid border edge must be have two adjacent facets.
	MeshFacet* facet1 = edge->facet;
	MeshFacet* facet2 = edge->oppositeEdge->facet;
	//if(edge->node2()->tag == 225186 && edge->node1->tag == 242078)
	//	LOG_INFO() << "facet1 = " << facet1;
	if(facet1 == NULL) {
#if defined(SF_DEBUG_STARTNODE) and defined(SF_DEBUG_ENDNODE)
		if(edge->node2()->tag == SF_DEBUG_ENDNODE && edge->node1->tag == SF_DEBUG_STARTNODE)
			LOG_INFO() << "  Edge " << edge->node1->tag << "  -  " << edge->node2()->tag << "  has no facet.";
#endif
		return false;
	}
	DISLOCATIONS_ASSERT(facet2 != NULL);

	//MeshNode* currentNode = edge->node1;
	MeshNode* nextNode = edge->node2();

	MeshEdge* node1edge = facet1->previousEdge(edge)->oppositeEdge;
	MeshEdge* node2edge = facet2->nextEdge(edge->oppositeEdge);
	MeshNode* node1 = node1edge->node2();
	MeshNode* node2 = node2edge->node2();

	FloatType facet_det = Matrix3(edge->latticeVector, node1edge->latticeVector, node2edge->latticeVector).determinant();

	MeshEdge* diagonalEdge1a = facet1->nextEdge(edge)->oppositeEdge;
	MeshEdge* parallelEdge1a = diagonalEdge1a->facet->previousEdge(diagonalEdge1a)->oppositeEdge;
	DISLOCATIONS_ASSERT(parallelEdge1a->node1 == node1);
	MeshNode* node1_quad_a = parallelEdge1a->node2();
	MeshEdge* diagonalEdge2a = node2edge->oppositeEdge;
	MeshEdge* parallelEdge2a = diagonalEdge2a->facet->previousEdge(diagonalEdge2a);
	DISLOCATIONS_ASSERT(parallelEdge2a->node2() == node2);
	MeshNode* node2_quad_a = parallelEdge2a->node1;

	MeshEdge* diagonalEdge1b = node1edge;
	MeshEdge* parallelEdge1b = diagonalEdge1b->facet->nextEdge(diagonalEdge1b)->oppositeEdge;
	DISLOCATIONS_ASSERT(parallelEdge1b->node2() == node1);
	MeshNode* node1_quad_b = parallelEdge1b->node1;
	MeshEdge* diagonalEdge2b = facet2->nextEdge(node2edge)->oppositeEdge;
	MeshEdge* parallelEdge2b = diagonalEdge2b->facet->nextEdge(diagonalEdge2b);
	DISLOCATIONS_ASSERT(parallelEdge2b->node1 == node2);
	MeshNode* node2_quad_b = parallelEdge2b->node2();

#if defined(SF_DEBUG_STARTNODE) and defined(SF_DEBUG_ENDNODE)
	if(edge->node2()->tag == SF_DEBUG_ENDNODE && edge->node1->tag == SF_DEBUG_STARTNODE)
		LOG_INFO() << "facet_det = " << facet_det << "  node1=" << node1->tag << "  node2=" << node2->tag;
#endif

	if(fabs(facet_det) <= FLOATTYPE_EPSILON || node1->tag == node2->tag ||
			(node1_quad_a->tag == node2->tag && parallelEdge1a->latticeVector.equals(edge->latticeVector)) ||
			(node2_quad_a->tag == node1->tag && parallelEdge2a->latticeVector.equals(edge->latticeVector)) ||
			(node1_quad_b->tag == node2->tag && parallelEdge1b->latticeVector.equals(edge->latticeVector)) ||
			(node2_quad_b->tag == node1->tag && parallelEdge2b->latticeVector.equals(edge->latticeVector))) {
		if(edge->isSFEdge) {	// sfcontour5.png
			FloatType tet1_det = Matrix3(edge->latticeVector, node1edge->latticeVector, node1LatticeVector).determinant();
			FloatType tet2_det = Matrix3(edge->latticeVector, node2edge->latticeVector, node1LatticeVector).determinant();
#if defined(SF_DEBUG_STARTNODE) and defined(SF_DEBUG_ENDNODE)
			if(edge->node2()->tag == SF_DEBUG_ENDNODE && edge->node1->tag == SF_DEBUG_STARTNODE)
				LOG_INFO() << "CASE1_sfedge: tet1_det=" << tet1_det << " tet2_det=" << tet2_det << "  result=" << (!(tet1_det < -FLOATTYPE_EPSILON && tet2_det > FLOATTYPE_EPSILON));
#endif
			if(!(tet1_det < -FLOATTYPE_EPSILON && tet2_det > FLOATTYPE_EPSILON))	// sfcontour6.png
				return true;
		}
		Vector3 facet1normal = CrossProduct(node1edge->latticeVector, edge->latticeVector);
		Vector3 facet2normal = CrossProduct(edge->latticeVector, node2edge->latticeVector);
#if defined(SF_DEBUG_STARTNODE) and defined(SF_DEBUG_ENDNODE)
		if(edge->node2()->tag == SF_DEBUG_ENDNODE && edge->node1->tag == SF_DEBUG_STARTNODE)
			LOG_INFO() << "CASE1: Dot=" << DotProduct(facet1normal, facet2normal);
#endif
		return DotProduct(facet1normal, facet2normal) < 0.0;
	}
	else if(facet_det < -FLOATTYPE_EPSILON) {
		Vector3 facet1normal = CrossProduct(node1edge->latticeVector, edge->latticeVector);
		Vector3 facet2normal = CrossProduct(edge->latticeVector, node2edge->latticeVector);
#if defined(SF_DEBUG_STARTNODE) and defined(SF_DEBUG_ENDNODE)
		if(edge->node2()->tag == SF_DEBUG_ENDNODE && edge->node1->tag == SF_DEBUG_STARTNODE)
			LOG_INFO() << "CASE2: Dot1=" << DotProduct(facet1normal, node1LatticeVector) << " Dot2=" << DotProduct(facet2normal, node1LatticeVector);
#endif
		return DotProduct(facet1normal, node1LatticeVector) < FLOATTYPE_EPSILON &&
				DotProduct(facet2normal, node1LatticeVector) < FLOATTYPE_EPSILON;
	}
	else {
		FloatType tet1_det = Matrix3(edge->latticeVector, node1edge->latticeVector, node1LatticeVector).determinant();
		FloatType tet2_det = Matrix3(edge->latticeVector, node2edge->latticeVector, node1LatticeVector).determinant();
#if defined(SF_DEBUG_STARTNODE) and defined(SF_DEBUG_ENDNODE)
		if(edge->node2()->tag == SF_DEBUG_ENDNODE && edge->node1->tag == SF_DEBUG_STARTNODE)
			LOG_INFO() << "CASE2: tet1_det=" << tet1_det << " tet2_det=" << tet2_det << "  result=" << !((tet1_det < -FLOATTYPE_EPSILON) && (tet2_det > FLOATTYPE_EPSILON));
#endif
		return !((tet1_det < -FLOATTYPE_EPSILON) && (tet2_det > FLOATTYPE_EPSILON));	// sfcontour7.png
		//return !((tet1_det < -FLOATTYPE_EPSILON) && (tet2_det > FLOATTYPE_EPSILON));
	}
}

/******************************************************************************
* Finds all mesh edges forming a closed contour of a stacking fault.
******************************************************************************/
void DXAStackingFaults::traceStackingFaultContour(StackingFault* sf, StackingFaultContour& contour, deque< pair<InputAtom*, Point3> >& toprocess, Point3 currentUnwrappedPos, set<MeshEdge*>& visitedEdges, const LatticeVector basalPlaneLatticeVectors[6], int lastDir)
{
	MeshEdge* lastEdge = contour.edges.back();
	MeshNode* currentNode = lastEdge->node2();
	DISLOCATIONS_ASSERT(lastEdge->latticeVector.equals(basalPlaneLatticeVectors[lastDir]));

	//LOG_INFO() << "start Node = " << lastEdge->node1->tag;

	// Traverse edges until we arrive at the start edge again.
	for(;;) {

		// Determine next edge.
		MeshEdge* nextEdge = NULL;
		int inverseDir = (lastDir + 3) % 6;
		int nextDir = -1;
		BaseAtom* basalPlaneAtom = NULL;

		MeshEdge* bestInvalidEdge = NULL;
		int bestInvalidEdgeDir = -1;

		//Vector3 normalV;
#ifdef SF_DEBUG_STARTNODE
		if(currentNode->tag == SF_DEBUG_STARTNODE)
			LOG_INFO() << "********* currentNode = " << currentNode->tag;
#endif
		//	for(int i=0; i<6; i++)
		//		LOG_INFO() << " v=" << i << "  " << basalPlaneLatticeVectors[i];
		//	normalV = CrossProduct(basalPlaneLatticeVectors[0], basalPlaneLatticeVectors[1]);

		// Iterate over all outgoing edges of the current node.
		for(int e = 0; e < currentNode->numEdges; e++) {
			MeshEdge* edge = &currentNode->edges[e];
			MeshNode* nextNode = edge->node2();

#ifdef SF_DEBUG_STARTNODE
			if(currentNode->tag == SF_DEBUG_STARTNODE)
				LOG_INFO() << "--- nextnode=" << nextNode->tag <<  "   " << edge->latticeVector << "  has facet=" << (edge->facet != NULL) << "  current next dir=" << nextDir;
#endif

			// Determine lattice direction in basal plane of this edge.
			int dir = -1;
			for(int nn = 0; nn < 6; nn++) {
				if(edge->latticeVector.equals(basalPlaneLatticeVectors[nn])) {
					dir = nn;
					break;
				}
			}
			if(dir == -1) continue;	// The edge is off-lattice.

			// We take the edge, which is pointing towards the stacking fault region.
			dir = (dir - inverseDir + 6) % 6;

#ifdef SF_DEBUG_STARTNODE
			if(currentNode->tag == SF_DEBUG_STARTNODE)
				LOG_INFO() << " dir=" << dir;
#endif

			if(dir == 0 && nextNode != lastEdge->node1 && edge->facet != NULL && nextNode->tag == lastEdge->node1->tag && edgeEdgeOrientation(lastEdge, edge->oppositeEdge)) {
#ifdef SF_DEBUG_STARTNODE
				if(currentNode->tag == SF_DEBUG_STARTNODE)
					LOG_INFO() << "Changing dir to 6";
#endif
				dir = 6;
			}

			if(dir == 5 && nextNode->tag == lastEdge->node1->tag)
				continue;

			// Handle special situation shown in "sfcontour8.png"
			if(edge->facet != NULL && dir > 3) {
				bool isInvalidEdge = false;
				for(int e2 = 0; e2 < currentNode->numEdges; e2++) {
					if(e2 == e) continue;
					MeshEdge* parallelEdge = &currentNode->edges[e2];
					if(parallelEdge->node2() != nextNode) continue;
					if(parallelEdge->facet == NULL) continue;
					if(edgeEdgeOrientation(edge, parallelEdge)) continue;
					if(parallelEdge->facet->nextEdge(parallelEdge)->node2() == lastEdge->node1 ||
							parallelEdge->oppositeEdge->facet->nextEdge(parallelEdge->oppositeEdge)->node2() == lastEdge->node1) {
						isInvalidEdge = true;
						break;
					}
				}
				if(isInvalidEdge) {
#ifdef SF_DEBUG_STARTNODE
					if(currentNode->tag == SF_DEBUG_STARTNODE)
						LOG_INFO() << "Skipping skewed edge " << currentNode->tag << " - " << nextNode->tag;
#endif
					continue;
				}
			}

			if(dir < nextDir) continue;

			// Is this edge already part of the current contour?
			//bool hasBeenVisitedBefore = false;
			//for(vector<MeshEdge*>::const_iterator edge_iter = contour.edges.begin()+1; edge_iter != contour.edges.end(); ++edge_iter) {
			//	if(*edge_iter == edge) {
			//		hasBeenVisitedBefore = true;
			//		break;
			//	}
			//}
			//if(hasBeenVisitedBefore) continue;

			// Check edge.
			LatticeVector node1LatticeVector = basalPlaneLatticeVectors[(dir - 2 + inverseDir + 6) % 6];
			LatticeVector node2LatticeVector = basalPlaneLatticeVectors[(dir - 1 + inverseDir + 6) % 6];
			if(!isValidStackingFaultContourEdge(edge, node1LatticeVector, node2LatticeVector)) {
#ifdef SF_DEBUG_STARTNODE
				if(currentNode->tag == SF_DEBUG_STARTNODE)
					LOG_INFO() << " not valid sf contour edge";
#endif
				if(dir > bestInvalidEdgeDir && edge->facet == NULL) {

					/*
					bool isInvalidShortcut = false;
					if(contour.edges.size() >= 2) {
						MeshEdge* previousEdge = contour.edges[contour.edges.size() - 2];
						if(previousEdge->node1 == nextNode) {
							isInvalidShortcut = true;
						}
					}
					if(!isInvalidShortcut) {
					*/
						bestInvalidEdge = edge;
						bestInvalidEdgeDir = dir;
					//}
				}
				continue;
			}

#ifdef SF_DEBUG_STARTNODE
			if(currentNode->tag == SF_DEBUG_STARTNODE)
				LOG_INFO() << " is valid - ACCEPTED";
#endif

			nextDir = dir;
			nextEdge = edge;
			basalPlaneAtom = findEdgeBasalPlaneNeighbor(edge, node1LatticeVector, node2LatticeVector);
		}

		// Find a bypass if the real edge has no facets attached to it.
		MeshEdge* bypassEdge1 = NULL;
		MeshEdge* bypassEdge2 = NULL;
		//if(nextEdge != NULL && basalPlaneAtom == false && bestInvalidEdge != NULL && bestInvalidEdgeDir > nextDir) {
		//	nextEdge = NULL;
		//}

		if(nextEdge == NULL && bestInvalidEdge != NULL && bestInvalidEdgeDir > nextDir) {

			bool isInvalidShortcut = false;

			/*
			if(nextEdge != NULL && contour.edges.size() >= 2) {
				MeshEdge* previousEdge = contour.edges[contour.edges.size() - 2];
				if(previousEdge->node1 == bestInvalidEdge->node2()) {
					isInvalidShortcut = true;
				}
			}
			*/

			if(!isInvalidShortcut) {

				for(int e1 = 0; e1 < currentNode->numEdges; e1++) {
					MeshEdge* edge1 = &currentNode->edges[e1];
					MeshNode* bypassNode = edge1->node2();
					for(int e2 = 0; e2 < bypassNode->numEdges; e2++) {
						MeshEdge* edge2 = &bypassNode->edges[e2];
						if(edge2->node2() != bestInvalidEdge->node2()) continue;

						LatticeVector node1LatticeVector = -bestInvalidEdge->latticeVector;
						LatticeVector node2LatticeVector = -edge2->latticeVector;
						if(!isValidStackingFaultContourEdge(edge1, node1LatticeVector, node2LatticeVector)) continue;

						node1LatticeVector = edge1->latticeVector;
						node2LatticeVector = bestInvalidEdge->latticeVector;
						if(!isValidStackingFaultContourEdge(edge2, node1LatticeVector, node2LatticeVector)) continue;

						nextEdge = bestInvalidEdge;
						nextDir = bestInvalidEdgeDir;
						bypassEdge1 = edge1;
						bypassEdge2 = edge2;
						basalPlaneAtom = NULL;
						break;
					}
				}
			}
		}

		nextDir = (nextDir + inverseDir) % 6;

		// Put the HCP atom onto the recursive stack because it is part of the same stacking fault.
		if(basalPlaneAtom != NULL && basalPlaneAtom->isMeshNode() == false && ((InputAtom*)basalPlaneAtom)->isHCP()) {
			recursiveWalkSFAtom((InputAtom*)basalPlaneAtom, sf, currentUnwrappedPos + wrapVector(basalPlaneAtom->pos - currentNode->pos), toprocess);
		}

		if(nextEdge == contour.edges.front()) {
			// We arrived at the beginning of the contour. We're done.
			return;
		}

		DISLOCATIONS_ASSERT(visitedEdges.find(nextEdge) == visitedEdges.end());

		// Append edge to contour.
		DISLOCATIONS_ASSERT(nextEdge->node1 == currentNode);

		visitedEdges.insert(nextEdge);
		if(bypassEdge1 == NULL)
			contour.edges.push_back(nextEdge);
		else {
			contour.edges.push_back(bypassEdge1);
			contour.edges.push_back(bypassEdge2);
		}

		currentUnwrappedPos += wrapVector(nextEdge->node2()->pos - currentNode->pos);

		lastEdge = nextEdge;
		currentNode = nextEdge->node2();
		lastDir = nextDir;
	}
}

/**
 * This helper class invokes The OpenGL utility library to tessellate
 * a stacking fault polygon into triangle facets.
 */
class SFTessellator
{
public:
	/// Constructor.
	SFTessellator(DXAStackingFaults& _caller) : caller(_caller) {
		tess = gluNewTess();
		if(!tess) caller.raiseError("Could not create OpenGL polygon tessellation object.");
#if defined(__APPLE__) and (__MAC_OS_X_VERSION_MAX_ALLOWED < 1050)		// If old OS X version (pre 10.5)
		gluTessCallback(tess, GLU_TESS_ERROR_DATA, (GLvoid (*)(...))errorData);
		gluTessCallback(tess, GLU_TESS_BEGIN_DATA, (GLvoid (*)(...))beginData);
		gluTessCallback(tess, GLU_TESS_END_DATA, (GLvoid (*)(...))endData);
		gluTessCallback(tess, GLU_TESS_VERTEX_DATA, (GLvoid (*)(...))vertexData);
		gluTessCallback(tess, GLU_TESS_COMBINE_DATA, (GLvoid (*)(...))combineData);
#else
		gluTessCallback(tess, GLU_TESS_ERROR_DATA, (GLvoid (*)())errorData);
		gluTessCallback(tess, GLU_TESS_BEGIN_DATA, (GLvoid (*)())beginData);
		gluTessCallback(tess, GLU_TESS_END_DATA, (GLvoid (*)())endData);
		gluTessCallback(tess, GLU_TESS_VERTEX_DATA, (GLvoid (*)())vertexData);
		gluTessCallback(tess, GLU_TESS_COMBINE_DATA, (GLvoid (*)())combineData);
#endif

		gluTessProperty(tess, GLU_TESS_WINDING_RULE, GLU_TESS_WINDING_POSITIVE);
	}

	/// Destructor.
	~SFTessellator() {
		// Cleanup.
		if(tess) gluDeleteTess(tess);
	}

	/// Sends the vertices of the stacking fault contours to the tessellation engine.
	void tessellateSF(StackingFault* sf) {
		this->sf = sf;
		gluTessNormal(tess, sf->normalVector.X, sf->normalVector.Y, sf->normalVector.Z);
		gluTessBeginPolygon(tess, this);
		for(SFContourVertex* seedVertex = sf->globalVertexList; seedVertex != NULL; seedVertex = seedVertex->globalNext) {
			if(seedVertex->wasVisited() == false) {
				gluTessBeginContour(tess);
				SFContourVertex* vertex = seedVertex;
				do {
					DISLOCATIONS_ASSERT(vertex != NULL);
					DISLOCATIONS_ASSERT(vertex->next != NULL);
					DISLOCATIONS_ASSERT(vertex->wasVisited() == false);
					vertex->setVisited();
					OutputVertex* outputVertex = caller.stackingFaultOutputMesh.createVertex(vertex->pos);
					outputVertex->normal = sf->normalVector;
					double vertexCoord[3] = {vertex->pos.X, vertex->pos.Y, vertex->pos.Z};
					gluTessVertex(tess, vertexCoord, outputVertex);
					vertex = vertex->next;
				}
				while(vertex != seedVertex);
				gluTessEndContour(tess);
			}
		}
		gluTessEndPolygon(tess);
	}

private:

	static void beginData(GLenum type, void* polygon_data) {
		SFTessellator* tessellator = (SFTessellator*)polygon_data;
		tessellator->primitiveType = type;
		tessellator->vertices.clear();
	}

	static void endData(void* polygon_data) {
		SFTessellator* tessellator = (SFTessellator*)polygon_data;

		if(tessellator->primitiveType == GL_TRIANGLE_FAN) {
			DISLOCATIONS_ASSERT_GLOBAL(tessellator->vertices.size() >= 4);
			OutputVertex* facetVertices[3];
			facetVertices[0] = tessellator->vertices[0];
			facetVertices[1] = tessellator->vertices[1];
			for(vector<OutputVertex*>::iterator v = tessellator->vertices.begin() + 2; v != tessellator->vertices.end(); ++v) {
				facetVertices[2] = *v;
				tessellator->caller.stackingFaultOutputMesh.createFacetAndEdges(facetVertices, tessellator->sf->index);
				facetVertices[1] = facetVertices[2];
			}
		}
		else if(tessellator->primitiveType == GL_TRIANGLE_STRIP) {
			DISLOCATIONS_ASSERT_GLOBAL(tessellator->vertices.size() >= 3);
			OutputVertex* facetVertices[3];
			facetVertices[0] = tessellator->vertices[0];
			facetVertices[1] = tessellator->vertices[1];
			bool even = true;
			for(vector<OutputVertex*>::iterator v = tessellator->vertices.begin() + 2; v != tessellator->vertices.end(); ++v) {
				facetVertices[2] = *v;
				tessellator->caller.stackingFaultOutputMesh.createFacetAndEdges(facetVertices, tessellator->sf->index);
				if(even)
					facetVertices[0] = facetVertices[2];
				else
					facetVertices[1] = facetVertices[2];
				even = !even;
			}
		}
		else if(tessellator->primitiveType == GL_TRIANGLES) {
			for(vector<OutputVertex*>::iterator v = tessellator->vertices.begin(); v != tessellator->vertices.end(); v += 3) {
				tessellator->caller.stackingFaultOutputMesh.createFacetAndEdges(&*v, tessellator->sf->index);
			}
		}
	}

	static void vertexData(void* vertex_data, void* polygon_data) {
		SFTessellator* tessellator = (SFTessellator*)polygon_data;
		tessellator->vertices.push_back((OutputVertex*)vertex_data);
	}

	static void combineData(GLdouble coords[3], void* vertex_data[4], GLfloat weight[4], void** outDatab, void* polygon_data) {
		SFTessellator* tessellator = (SFTessellator*)polygon_data;
		OutputVertex* outputVertex = tessellator->caller.stackingFaultOutputMesh.createVertex(Point3(coords[0], coords[1], coords[2]));
		outputVertex->normal = tessellator->sf->normalVector;
		*outDatab = outputVertex;
	}

	static void errorData(GLenum errno, void* polygon_data) {
		SFTessellator* tessellator = (SFTessellator*)polygon_data;
		LOG_INFO() << "GLU error: " << errno;
		if(errno == GLU_TESS_NEED_COMBINE_CALLBACK) {
			tessellator->caller.raiseError("Could not tessellate stacking fault polygon. It contains overlapping contours.");
		}
		else
			tessellator->caller.raiseError("Could not tessellate stacking fault polygon.");
	}

private:
	DXAStackingFaults& caller;
	GLUtesselator* tess;
	StackingFault* sf;
	GLenum primitiveType;
	vector<OutputVertex*> vertices;
};

/******************************************************************************
* Links stacking faults to dislocation segments and triangulates the SF planes.
******************************************************************************/
void DXAStackingFaults::finishStackingFaults(FloatType flatten)
{
	createSFPolylines(flatten);

	LOG_INFO() << "Wrapping infinite stacking faults at periodic boundaries.";

	bool hasInfiniteSF = false;

	for(int sfindex = 0; sfindex < (int)stackingFaults.size(); sfindex++) {
		StackingFault* sf = stackingFaults[sfindex];
		if(sf->isInvalid) continue;

		sf->reducedNormalVector = Normalize(getReciprocalSimulationCell() * sf->normalVector);
		sf->reducedCenter = ORIGIN + (getReciprocalSimulationCell() * (sf->center - getSimulationCellOrigin()));

		Point3 bbminSFfOld(+100);
		Point3 bbmaxSFfOld(-100);

		// Convert original polyline into a linked list of vertices.
		Point3I bbminSF(+100);
		Point3I bbmaxSF(-100);
		for(vector<StackingFaultContour>::iterator contour = sf->contours.begin(); contour != sf->contours.end(); ++contour) {
			if(contour->polyline.size() <= 2) continue;
			Point3I bbminContour(+100);
			Point3I bbmaxContour(-100);
			SFContourVertex* firstContourVertex = NULL;
			SFContourVertex* lastContourVertex = NULL;
			for(vector<Point3>::iterator p = contour->polyline.begin(); p != contour->polyline.end(); ++p) {
				SFContourVertex* vertex = createSFVertex(sf, ORIGIN + (getReciprocalSimulationCell() * (*p - getSimulationCellOrigin())));
				for(int dim = 0; dim < 3; dim++) {
					if(vertex->image[dim] < bbminContour[dim]) bbminContour[dim] = vertex->image[dim];
					if(vertex->image[dim] > bbmaxContour[dim]) bbmaxContour[dim] = vertex->image[dim];
					if(vertex->pos[dim] < bbminSFfOld[dim]) bbminSFfOld[dim] = vertex->pos[dim];
					if(vertex->pos[dim] > bbmaxSFfOld[dim]) bbmaxSFfOld[dim] = vertex->pos[dim];
				}
				vertex->previous = lastContourVertex;
				if(lastContourVertex != NULL) lastContourVertex->next = vertex;
				lastContourVertex = vertex;
				if(firstContourVertex == NULL) firstContourVertex = vertex;
			}
			firstContourVertex->previous = lastContourVertex;
			lastContourVertex->next = firstContourVertex;

			for(int dim = 0; dim < 3; dim++) {
				if(sf->isInfinite[dim]) {
					DISLOCATIONS_ASSERT(pbcFlags()[dim]);
					DISLOCATIONS_ASSERT(sf->reducedNormalVector[dim] == 0);
					int shift = 0;
					if(bbmaxContour[dim] > 0) shift = -bbmaxContour[dim];
					if(bbminContour[dim] < -1) shift = (-1) - bbminContour[dim];
					if(shift != 0) {
						for(SFContourVertex* vertex = firstContourVertex; ; vertex = vertex->next) {
							vertex->pos[dim] += shift;
							vertex->image[dim] += shift;
							if(vertex == lastContourVertex) break;
						}
						bbminContour[dim] += shift;
						bbmaxContour[dim] += shift;
					}
				}
				if(bbminContour[dim] < bbminSF[dim]) bbminSF[dim] = bbminContour[dim];
				if(bbmaxContour[dim] > bbmaxSF[dim]) bbmaxSF[dim] = bbmaxContour[dim];
			}
		}

		if(sf->isInfinite[0] || sf->isInfinite[1] || sf->isInfinite[2]) {
			sf->isInvalid = true;
			hasInfiniteSF = true;
			continue;
		}

		if(sf->globalVertexList == NULL) {
			sf->isInvalid = true;
			continue;
		}

		for(SFContourVertex* vertex = sf->globalVertexList; vertex != NULL; vertex = vertex->globalNext) {
			vertex->pos = reducedToAbsolute(vertex->pos);
		}
	}

	if(hasInfiniteSF){
		LOG_INFO() << "WARNING: Detected infinite stacking faults in the periodic simulation cell. They cannot be processed yet.";
	}
	LOG_INFO() << "Triangulating stacking fault polygons.";
	SFTessellator tessellator(*this);
	for(vector<StackingFault*>::const_iterator sf = stackingFaults.begin(); sf != stackingFaults.end(); ++sf) {
		if((*sf)->isInvalid == false)
			tessellator.tessellateSF(*sf);
	}

	LOG_INFO() << "Refining triangulation of stacking fault polygons.";
	stackingFaultOutputMesh.refineFacets(*this, 40.0);

	LOG_INFO() << "Smoothing stacking faults.";
	for(int iteration = 0; iteration < 20; iteration++) {
		stackingFaultOutputMesh.smoothMesh(0.5, *this, true);
	}
	// Refine again to split too long facets which might result from slight displacement of vertices during smoothing.
	stackingFaultOutputMesh.refineFacets(*this);

	LOG_INFO() << "Wrapping triangulated stacking faults at periodic boundaries.";
	stackingFaultOutputMesh.wrapMesh(*this);
}



/******************************************************************************
* Splits a polyline segment at periodic boundaries of the simulation
* cell.
******************************************************************************/
void DXAStackingFaults::splitPolylineSegment2(StackingFault* sf, SFContourVertex* vertex1, int dim, const Vector3& projectionDir, multimap<FloatType, SFContourVertex*> clipVertices[2])
{
	SFContourVertex* vertex2 = vertex1->next;
	if(vertex2 == NULL) return;

	FloatType rv1 = vertex1->pos[dim];
	FloatType rv2 = vertex2->pos[dim];
	int cell1 = vertex1->image[dim];
	int cell2 = vertex2->image[dim];
	if(cell1 == cell2) return;

	//LOG_INFO() << "dim=" << dim << "  cell1: " << cell1 << "  cell2: " << cell2;
	DISLOCATIONS_ASSERT((cell1 == -1 && cell2 == 0) || (cell2 == -1 && cell1 == 0));

	FloatType rvdelta = rv2 - rv1;
	if(fabs(rvdelta) >= 0.5) {
		DISLOCATIONS_ASSERT(sf->isInfinite[dim]);
		return;
	}
	DISLOCATIONS_ASSERT_GLOBAL(rvdelta != 0.0);

	FloatType t;
	t = (-rv1) / rvdelta;
	DISLOCATIONS_ASSERT(t >= 0.0 && t <= 1.0);

	Vector3 vectorDelta = vertex2->pos - vertex1->pos;
	Point3 ipoint = vertex1->pos + t * vectorDelta;
	DISLOCATIONS_ASSERT_GLOBAL(fabs(ipoint[dim]) <= FLOATTYPE_EPSILON);
	ipoint[dim] = 0;
	SFContourVertex* intersectionPoint1 = createSFVertex(sf, ipoint);
	SFContourVertex* intersectionPoint2 = createSFVertex(sf, ipoint);
	intersectionPoint1->image[dim] = cell1;
	intersectionPoint2->image[dim] = cell2;
	for(int d = 0; d < 3; d++) {
		if(vertex1->image[d] == vertex2->image[d])
			intersectionPoint1->image[d] = intersectionPoint2->image[d] = vertex1->image[d];
	}
	//LOG_INFO() << "intersectionPoint1->image = " << intersectionPoint1->image;
	//LOG_INFO() << "intersectionPoint2->image = " << intersectionPoint2->image;

	intersectionPoint1->previous = vertex1;
	vertex1->next = intersectionPoint1;

	intersectionPoint2->next = vertex2;
	vertex2->previous = intersectionPoint2;

	intersectionPoint1->setClipVertex(dim);
	intersectionPoint2->setClipVertex(dim);

	// Project clip vertex position onto (stacking fault)-(cell face) intersection line.
	FloatType tsort = DotProduct(projectionDir, ipoint - sf->reducedCenter);
	tsort -= DotProduct(projectionDir, Vector3(intersectionPoint1->image.X, intersectionPoint1->image.Y, intersectionPoint1->image.Z));

	if(cell1 < cell2) {
		clipVertices[0].insert(make_pair(-tsort, intersectionPoint1));
		clipVertices[1].insert(make_pair(+tsort, intersectionPoint2));
	}
	else {
		clipVertices[0].insert(make_pair(-tsort, intersectionPoint2));
		clipVertices[1].insert(make_pair(+tsort, intersectionPoint1));
	}
}

void DXAStackingFaults::findSFDislocationContours()
{
LOG_INFO() << "Finding stacking fault border dislocations.";

//#pragma omp parallel for
	for(int sfindex = 0; sfindex < (int)stackingFaults.size(); sfindex++) {
		StackingFault* sf = stackingFaults[sfindex];
		for(vector<StackingFaultContour>::iterator contour = sf->contours.begin(); contour != sf->contours.end(); ++contour) {
			// Find intersections of SF contour with Burgers circuits on the interface mesh.
			int stopEdge = 0;
			vector<MeshEdge*>::const_iterator edge = contour->edges.begin();
			do {
				MeshFacet* facet1 = (*edge)->facet;
				MeshFacet* facet2 = (*edge)->oppositeEdge->facet;
				DISLOCATIONS_ASSERT(facet1 != NULL && facet2 != NULL);
				//if(sf->index == 671)
				//	LOG_INFO() << "currentEdge=" << (edge - contour->edges.begin()) << "  stopedge=" << stopEdge;

				if(facet1->circuit != NULL && facet2->circuit != NULL &&
						(facet1->testFlag(FACET_IS_PRIMARY_SEGMENT) || facet1->circuit->isDangling == false) &&
						(facet2->testFlag(FACET_IS_PRIMARY_SEGMENT) || facet2->circuit->isDangling == false)) {

					DislocationSegment* segment1 = facet1->circuit->segment;
					DislocationSegment* segment2 = facet2->circuit->segment;
					while(segment1->replacedWith != NULL) segment1 = segment1->replacedWith;
					while(segment2->replacedWith != NULL) segment2 = segment2->replacedWith;
					if(segment1 == segment2) {
						//if(sf->index==257)
						//	LOG_INFO() << "Starting segment at edge index " << (edge - contour->edges.begin());

						pair<int,int> startstop = findSFContourSegmentIntersection(*contour, segment1, edge);
						//if(sf->index == 182)
						//	LOG_INFO() << "segment " << segment1->index << "  start=" << startstop.first << "  stop=" << startstop.second << "  currentEdge=" << (edge - contour->edges.begin()) << "  stopedge=" << stopEdge;
						//if(segment1->index == 444)
						//	LOG_INFO() << "segment " << segment1->index << "  start=" << startstop.first << "  stop=" << startstop.second << "  sf=" << sf->index;

						int currentEdgeIndex = edge - contour->edges.begin();
						if(stopEdge == 0) {
							if(startstop.first >= startstop.second) {
								stopEdge = startstop.first;
								if(startstop.second == startstop.first || currentEdgeIndex >= stopEdge)
									break;
							}
						}
						else if(stopEdge != 0) {
							if(startstop.first >= startstop.second && startstop.first < stopEdge)
								stopEdge = startstop.first;
							if(startstop.second >= stopEdge)
								break;
						}
						edge = contour->edges.begin() + startstop.second;
						DISLOCATIONS_ASSERT(stopEdge != contour->edges.size());
					}
					else ++edge;
				}
				else ++edge;
				DISLOCATIONS_ASSERT(stopEdge != contour->edges.size());
				if(edge == contour->edges.end())
					edge = contour->edges.begin();
			}
			while(edge - contour->edges.begin() != stopEdge);

			if(contour->borderSegments.size() >= 2) {
				BurgersCircuit* startCircuit = contour->borderSegments.front();
				BurgersCircuit* endCircuit = contour->borderSegments.back()->oppositeCircuit;
				if(startCircuit->isDangling == false && endCircuit->isDangling == false && startCircuit->isInRing(endCircuit))
					contour->segmentIntervals.back().second = contour->segmentIntervals.front().first;
			}
		}
	}

	// Project dislocation lines onto stacking fault planes.
	for(int sfindex = 0; sfindex < (int)stackingFaults.size(); sfindex++) {
		StackingFault* sf = stackingFaults[sfindex];
		for(vector<StackingFaultContour>::iterator contour = sf->contours.begin(); contour != sf->contours.end(); ++contour) {
			for(size_t segmentIndex = 0; segmentIndex < contour->borderSegments.size(); segmentIndex++) {
				DislocationSegment* segment = contour->borderSegments[segmentIndex]->segment;
				if(segment->displacement.empty()) {
					segment->displacement.resize(segment->line.size(), NULL_VECTOR);
				}
				segment->displacementCount++;

				Point3 unwrappedPoint = contour->basePoint;
				Point3 wrappedPoint = contour->edges.front()->node1->pos;
				DISLOCATIONS_ASSERT(wrapVector(unwrappedPoint - wrappedPoint).equals(NULL_VECTOR));

				int dislocationStartIndex = contour->segmentIntervals[segmentIndex].first;
				if(contour->borderSegments[segmentIndex]->isForwardCircuit())
					dislocationStartIndex = contour->segmentIntervals[segmentIndex].second;
				for(vector<MeshEdge*>::const_iterator edge = contour->edges.begin(); edge != contour->edges.begin() + dislocationStartIndex; ++edge) {
					Vector3 delta = wrapVector((*edge)->node1->pos - wrappedPoint);
					wrappedPoint += delta;
					unwrappedPoint += delta;
				}

				vector<Vector3>::iterator d = segment->displacement.begin();
				for(deque<Point3>::iterator p = segment->line.begin(); p != segment->line.end(); ++p) {
					Vector3 delta = wrapVector(*p - wrappedPoint);
					unwrappedPoint += delta;
					wrappedPoint += delta;
					Vector3 dd = (unwrappedPoint - sf->center);
					FloatType t = DotProduct(dd, sf->normalVector);
					*d++ += -t * sf->normalVector;
				}
				DISLOCATIONS_ASSERT(d == segment->displacement.end());
			}
		}
	}

#pragma omp parallel for
	for(int segmentIndex = 0; segmentIndex < segments.size(); segmentIndex++) {
		DislocationSegment* segment = segments[segmentIndex];
		DISLOCATIONS_ASSERT(segment);
		deque<Point3>& line = segments[segmentIndex]->line;
		if(segment->displacementCount == 0) continue;
		vector<Vector3>::const_iterator d = segment->displacement.begin();
		for(deque<Point3>::iterator p = line.begin(); p != line.end(); ++p) {
			*p += *d++ / segment->displacementCount;
		}
		DISLOCATIONS_ASSERT(d == segment->displacement.end());
	}

	for(int segmentIndex = 0; segmentIndex < segments.size(); segmentIndex++) {
		DislocationSegment* segment = segments[segmentIndex];
		if(segment->replacedWith != NULL) continue;
		for(int circuitIndex = 0; circuitIndex < 2; circuitIndex++) {
			BurgersCircuit* circuit = segment->circuits[circuitIndex];
			DISLOCATIONS_ASSERT(circuit);
			if(circuit->isDangling) continue;
			int circuitCount = 0;

			Vector3 junctionVector(NULL_VECTOR);
			Point3 refPoint = circuit->center();
			BurgersCircuit* c = circuit->junctionRing;
			do {
				DISLOCATIONS_ASSERT(c);
				DISLOCATIONS_ASSERT(c->isDangling == false);
				DISLOCATIONS_ASSERT(c->segment->line.size() >= 2);
				DISLOCATIONS_ASSERT(c->segment->replacedWith == NULL);
				circuitCount++;
				if(c->isForwardCircuit())
					junctionVector += wrapVector(c->segment->line.back() - refPoint);
				else
					junctionVector += wrapVector(c->segment->line.front() - refPoint);
				c = c->junctionRing;
			}
			while(c != circuit->junctionRing);

			if(circuitCount >= 3) {
				junctionVector /= circuitCount;
				//LOG_INFO() << junctionVector;
				do {
					DISLOCATIONS_ASSERT(c->segment->line.size() >= 2);
					DISLOCATIONS_ASSERT(c->segment->replacedWith == NULL);
					if(c->isForwardCircuit()) {
						c->segment->line.back() += wrapVector(refPoint + junctionVector - c->segment->line.back());
					}
					else {
						c->segment->line.front() += wrapVector(refPoint + junctionVector - c->segment->line.front());
					}
					c = c->junctionRing;
				}
				while(c != circuit->junctionRing);
			}
		}
	}
}

/******************************************************************************
* Create the polylines that border the stacking faults.
******************************************************************************/
void DXAStackingFaults::createSFPolylines(FloatType flatten)
{
LOG_INFO() << "Creating stacking fault contour lines.";

//#pragma omp parallel for
	for(int sfindex = 0; sfindex < (int)stackingFaults.size(); sfindex++) {
		StackingFault* sf = stackingFaults[sfindex];
		for(vector<StackingFaultContour>::iterator contour = sf->contours.begin(); contour != sf->contours.end(); ++contour) {
			// Convert contour into polyline.
			Point3 unwrappedPoint = contour->basePoint;
			Point3 wrappedPoint = contour->edges.front()->node1->pos;
			DISLOCATIONS_ASSERT(wrapVector(unwrappedPoint - wrappedPoint).equals(NULL_VECTOR));
			if(contour->borderSegments.empty()) {
				addMeshIntervalToSFPolyline(*contour, 0, contour->edges.size(), wrappedPoint, unwrappedPoint);
			}
			else {
				LOG_INFO() << "New contour: sf=" << sf->index;
				for(size_t segmentIndex1 = 0; segmentIndex1 < contour->borderSegments.size(); segmentIndex1++) {
					size_t segmentIndex2 = segmentIndex1 + 1;
					if(segmentIndex2 == contour->borderSegments.size()) segmentIndex2 = 0;

					int startIndex = contour->segmentIntervals[segmentIndex1].second;
					int endIndex = contour->segmentIntervals[segmentIndex2].first;

					// Advance base point to beginning of first dislocation interval.
					if(segmentIndex1 == 0) {
						int dislocationStartIndex = contour->segmentIntervals[segmentIndex1].first;
						for(vector<MeshEdge*>::const_iterator edge = contour->edges.begin(); edge != contour->edges.begin() + dislocationStartIndex; ++edge) {
							Vector3 delta = wrapVector((*edge)->node1->pos - wrappedPoint);
							wrappedPoint += delta;
							unwrappedPoint += delta;
							LOG_INFO() << " skipping " << (*edge)->node1->pos << "  " << unwrappedPoint <<  "  " << wrappedPoint;
						}
					}
					addDislocationIntervalToSFPolyline(*contour, contour->borderSegments[segmentIndex1], wrappedPoint, unwrappedPoint);
					addMeshIntervalToSFPolyline(*contour, startIndex, endIndex, wrappedPoint, unwrappedPoint);
				}
			}

			// Project polyline points onto stacking fault plane.
			if(flatten != 0) {
				for(vector<Point3>::iterator p = contour->polyline.begin(); p != contour->polyline.end(); ++p) {
					Vector3 d = (*p - sf->center);
					FloatType t = DotProduct(d, sf->normalVector);
					*p -= (flatten * t) * sf->normalVector;
				}
			}
		}
	}
}

/******************************************************************************
* Finds the intersection points where the SF contour line enters and exists the
* defect surface area swept by the dislocation segment's Burgers circuits.
******************************************************************************/
pair<int,int> DXAStackingFaults::findSFContourSegmentIntersection(StackingFaultContour& contour, DislocationSegment* segment, const vector<MeshEdge*>::const_iterator& interiorEdge)
{
	DISLOCATIONS_ASSERT(find(segments.begin(), segments.end(), segment) != segments.end());

	LOG_INFO() << "sf=" << contour.sf->index << "  segment=" << segment->index << "  startIndex=" << (interiorEdge - contour.edges.begin());

	// Check if the start edge is on one of the Burgers circuits.
	for(int circuitIndex = 0; circuitIndex < 2; circuitIndex++) {
		BurgersCircuit* circuit = segment->circuits[circuitIndex];
		if(circuit->isDangling == false) {
			// Iterate over the circuit's edges.
			MeshEdge* circuitEdge = circuit->firstEdge;
			do {
				if(*interiorEdge == circuitEdge) {
					int startIntersection = interiorEdge - contour.edges.begin();
					int endIntersection = startIntersection + 1;
					if(endIntersection == contour.edges.size()) endIntersection = 0;
					return make_pair(startIntersection, endIntersection);
				}
				circuitEdge = circuitEdge->nextEdge;
			}
			while(circuitEdge != circuit->firstEdge);
		}
		else {
			for(vector<MeshEdge*>::const_iterator i = circuit->primarySegmentCap.begin(); i != circuit->primarySegmentCap.end(); ++i) {
				if(*interiorEdge == *i) {
					//LOG_INFO() << "Invalid start edge";
					int startIntersection = interiorEdge - contour.edges.begin();
					int endIntersection = startIntersection + 1;
					if(endIntersection == contour.edges.size()) endIntersection = 0;
					return make_pair(startIntersection, endIntersection);
				}
			}
		}
	}

	// Go along the contour.
	vector<MeshEdge*>::const_iterator ci1 = interiorEdge;
	bool isInside = true;
	vector<int> intersectionPoints;
	vector<int> intersectionCircuits;
	do {
		vector<MeshEdge*>::const_iterator ci2 = ci1 + 1;
		if(ci2 == contour.edges.end()) ci2 = contour.edges.begin();
		DISLOCATIONS_ASSERT((*ci1)->node2() == (*ci2)->node1);
		DISLOCATIONS_ASSERT((*ci2)->facet != NULL && (*ci2)->oppositeEdge->facet != NULL);
		MeshEdge* contourEdge1 = *ci1;
		MeshEdge* contourEdge2 = *ci2;

		bool isFullyInside = false;
		bool isFullyOutside = false;
		MeshFacet* facet1 = contourEdge2->facet;
		MeshFacet* facet2 = contourEdge2->oppositeEdge->facet;
		DISLOCATIONS_ASSERT(facet1 != NULL && facet2 != NULL);
		if(facet1->circuit != NULL && facet2->circuit != NULL &&
				(facet1->testFlag(FACET_IS_PRIMARY_SEGMENT) || facet1->circuit->isDangling == false) &&
				(facet2->testFlag(FACET_IS_PRIMARY_SEGMENT) || facet2->circuit->isDangling == false)) {
			DislocationSegment* segment1 = facet1->circuit->segment;
			DislocationSegment* segment2 = facet2->circuit->segment;
			while(segment1->replacedWith != NULL) segment1 = segment1->replacedWith;
			while(segment2->replacedWith != NULL) segment2 = segment2->replacedWith;
			if(segment1 == segment && segment2 == segment)
				isFullyInside = true;
			else if(segment1 != segment && segment2 != segment)
				isFullyOutside = true;
		}
		else isFullyOutside = true;

		int goingOutside[2] = { 0, 0 };
		int goingInside[2] = { 0, 0 };

		// Check for intersection with any of the two Burgers circuits.
		for(int circuitIndex = 0; circuitIndex < 2; circuitIndex++) {
			BurgersCircuit* circuit = segment->circuits[circuitIndex];
			if(circuit->isDangling == false) {
				// Iterate over the circuit's edges.
				MeshEdge* circuitEdge1 = circuit->firstEdge;
				do {
					MeshEdge* circuitEdge2 = circuitEdge1->nextEdge;
					if(contourEdge2->node1 == circuitEdge2->node1) {
						circuitContourIntersection(contourEdge1, contourEdge2, circuitEdge1, circuitEdge2, goingOutside[circuitIndex], goingInside[circuitIndex]);
					}
					circuitEdge1 = circuitEdge2;
				}
				while(circuitEdge1 != circuit->firstEdge);
			}
			else {
				for(vector<MeshEdge*>::const_iterator i1 = circuit->primarySegmentCap.begin(); i1 != circuit->primarySegmentCap.end(); ++i1) {
					vector<MeshEdge*>::const_iterator i2 = i1 + 1;
					if(i2 == circuit->primarySegmentCap.end()) i2 = circuit->primarySegmentCap.begin();
					if(contourEdge2->node1 == (*i2)->node1) {
						circuitContourIntersection(contourEdge1, contourEdge2, *i1, *i2, goingOutside[circuitIndex], goingInside[circuitIndex]);
					}
				}
			}
		}

		bool wentOutside = false;
		if(isInside) {
			for(int circuitIndex = 0; circuitIndex < 2; circuitIndex++) {
				if(goingOutside[circuitIndex] > 0 && goingOutside[circuitIndex] >= goingInside[circuitIndex]) {
					isInside = false;
					wentOutside = true;
					intersectionPoints.push_back(ci2 - contour.edges.begin());
					intersectionCircuits.push_back(circuitIndex);
					break;
				}
			}
		}
		if(!isInside && !isFullyOutside) {
			for(int circuitIndex = 0; circuitIndex < 2; circuitIndex++) {
				if(goingInside[circuitIndex] > 0 && goingInside[circuitIndex] >= goingOutside[circuitIndex]) {
					isInside = true;
					intersectionPoints.push_back(ci2 - contour.edges.begin());
					intersectionCircuits.push_back(circuitIndex);
					break;
				}
			}
		}
		if(isInside && !wentOutside && !isFullyInside) {
			for(int circuitIndex = 0; circuitIndex < 2; circuitIndex++) {
				if(goingOutside[circuitIndex] > 0 && goingOutside[circuitIndex] >= goingInside[circuitIndex]) {
					isInside = false;
					intersectionPoints.push_back(ci2 - contour.edges.begin());
					intersectionCircuits.push_back(circuitIndex);
					break;
				}
			}
		}
		ci1 = ci2;
	}
	while(ci1 != interiorEdge);

	DISLOCATIONS_ASSERT((intersectionPoints.size() % 2) == 0);
	for(int i = 0; i < (int)intersectionPoints.size();) {
		if(intersectionPoints[i] == intersectionPoints[i+1] &&
				intersectionCircuits[i] == intersectionCircuits[i+1]) {
			intersectionPoints.erase(intersectionPoints.begin() + i, intersectionPoints.begin() + i + 2);
			intersectionCircuits.erase(intersectionCircuits.begin() + i, intersectionCircuits.begin() + i + 2);
		}
		else i += 2;
	}
	for(int i = 1; i < (int)intersectionPoints.size() - 1; ) {
		if(intersectionPoints[i] == intersectionPoints[i+1] &&
				intersectionCircuits[i] == intersectionCircuits[i+1]) {
			intersectionPoints.erase(intersectionPoints.begin() + i, intersectionPoints.begin() + i + 2);
			intersectionCircuits.erase(intersectionCircuits.begin() + i, intersectionCircuits.begin() + i + 2);
		}
		else i += 2;
	}
	DISLOCATIONS_ASSERT((intersectionPoints.size() % 2) == 0);
	// After we have traversed the complete contour, we should be inside the segment area again.
	if(intersectionCircuits.empty() || intersectionCircuits.front() == intersectionCircuits.back()) {
		int startIntersection = interiorEdge - contour.edges.begin();
		int endIntersection = startIntersection + 1;
		if(endIntersection == contour.edges.size()) endIntersection = 0;
		return make_pair(startIntersection, endIntersection);
	}

	int startIntersection = intersectionPoints.back();
	int endIntersection = intersectionPoints.front();
	BurgersCircuit* startCircuit = segment->circuits[intersectionCircuits.back()];
	BurgersCircuit* endCircuit = segment->circuits[intersectionCircuits.front()];

	if(contour.borderSegments.empty() == false && startCircuit->isDangling == false) {
		BurgersCircuit* otherCircuit = contour.borderSegments.back()->oppositeCircuit;
		if(otherCircuit->isDangling == false && otherCircuit->isInRing(startCircuit)) {
			startIntersection = contour.segmentIntervals.back().second;
		}
	}

	contour.borderSegments.push_back(startCircuit);
	contour.segmentIntervals.push_back(make_pair(startIntersection, endIntersection));

	return make_pair(startIntersection, endIntersection);
}


/******************************************************************************
* Converts a part of an SF contour, which runs along the interface mesh, into
* a polyline.
******************************************************************************/
void DXAStackingFaults::addMeshIntervalToSFPolyline(StackingFaultContour& contour, int startIndex, int endIndex, Point3& wrappedPoint, Point3& unwrappedPoint)
{
	// Number of mesh edges.
	int edgeCount = endIndex - startIndex;
	if(edgeCount < 0) edgeCount += contour.edges.size();

	// Iterate over mesh edges in the contour interval.
	vector<MeshEdge*>::const_iterator edge = contour.edges.begin() + startIndex;
	while(edgeCount > 0) {
		if(edge == contour.edges.end()) edge = contour.edges.begin();
		MeshNode* meshNode = (*edge)->node1;
		Point3* p;
		if(meshNode->outputVertex == NULL)
			p = &meshNode->pos;
		else
			p = &meshNode->outputVertex->pos;
		// Unwrap contour.
		Vector3 delta = wrapVector(*p - wrappedPoint);
		unwrappedPoint += delta;
		wrappedPoint += delta;
		if(meshNode->outputVertex != NULL)
			contour.polyline.push_back(unwrappedPoint);
		edgeCount--;
		++edge;
	}
}

/******************************************************************************
* Converts a part of an SF contour, which runs along a dislocation line, into
* a polyline.
******************************************************************************/
void DXAStackingFaults::addDislocationIntervalToSFPolyline(StackingFaultContour& contour, BurgersCircuit* startCircuit, Point3& wrappedPoint, Point3& unwrappedPoint)
{
	// The dislocation segment should be a real one.
	DISLOCATIONS_ASSERT(startCircuit->segment->replacedWith == NULL);
	DISLOCATIONS_ASSERT(startCircuit->segment->line.size() >= 2);

	//LOG_INFO() << "addDislocationIntervalToSFPolyline";

	if(startCircuit->isBackwardCircuit()) {
		// Unwrap contour.
		for(deque<Point3>::const_iterator p = startCircuit->segment->line.begin(); p != startCircuit->segment->line.end(); ++p) {
			// Unwrap contour.
			//DISLOCATIONS_ASSERT()
			Vector3 delta = wrapVector(*p - wrappedPoint);
			//LOG_INFO() << "delta=" << absoluteToReduced(delta);
			unwrappedPoint += delta;
			wrappedPoint += delta;
			contour.polyline.push_back(unwrappedPoint);
			//DISLOCATIONS_ASSERT(fabs(DotProduct(unwrappedPoint - contour.sf->center, contour.sf->normalVector)) < 50.0);
		}
	}
	else {
		for(size_t p = startCircuit->segment->line.size(); p != 0; ) {
			// Unwrap contour.
			Vector3 delta = wrapVector(startCircuit->segment->line[--p] - wrappedPoint);
			unwrappedPoint += delta;
			wrappedPoint += delta;
			contour.polyline.push_back(unwrappedPoint);
		}
	}
}

/******************************************************************************
* Determines whether the given point (in reduced coordinates) is inside the
* stacking fault polygon.
******************************************************************************/
bool DXAStackingFaults::isInsideStackingFault(StackingFault* sf, SFContourVertex* vertexHead, const Point3 p)
{
	// Point must be in the SF plane.
	DISLOCATIONS_ASSERT(fabs(DotProduct(p - sf->reducedCenter, sf->reducedNormalVector)) <= FLOATTYPE_EPSILON);

	// Determine which vertex is closest to the test point.
	SFContourVertex* closestVertex = NULL;
	FloatType closestDistance2 = FLOATTYPE_MAX;
	Vector3 closestNormal = NULL_VECTOR, closestVector = NULL_VECTOR;
	for(SFContourVertex* vertex = vertexHead; vertex != NULL; vertex = vertex->globalNext) {
		Vector3 r = vertex->pos - p;
		for(int dim = 0; dim < 3; dim++) {
			if(sf->isInfinite[dim]) {
				while(r[dim] < -0.5) r[dim] += 1;
				while(r[dim] > +0.5) r[dim] -= 1;
			}
		}
		FloatType dist2 = LengthSquared(r);
		if(dist2 < closestDistance2) {
			closestDistance2 = dist2;
			closestVertex = vertex;
			closestVector = r;
		}
	}

	// Check if any edge is closer to the test point than the closest vertex.
	SFContourVertex* closestEdge = NULL;
	for(SFContourVertex* vertex = vertexHead; vertex != NULL; vertex = vertex->globalNext) {
		DISLOCATIONS_ASSERT(vertex->next != NULL);
		Vector3 lineDir = wrapReducedVector(vertex->next->pos - vertex->pos);
		Vector3 r = p - vertex->pos;
		for(int dim = 0; dim < 3; dim++) {
			if(sf->isInfinite[dim]) {
				while(r[dim] < 0.0) r[dim] += 1;
				while(r[dim] > 1.0) r[dim] -= 1;
			}
		}
		FloatType edgeLength = Length(lineDir);
		if(edgeLength <= 1e-8) continue;
		lineDir /= edgeLength;
		FloatType d = DotProduct(lineDir, r);
		if(d >= edgeLength || d <= 0.0) continue;
		Point3 c = vertex->pos + lineDir * d;
		Vector3 r2 = c - p;
		for(int dim = 0; dim < 3; dim++) {
			if(sf->isInfinite[dim]) {
				while(r2[dim] < -0.5) r2[dim] += 1;
				while(r2[dim] > +0.5) r2[dim] -= 1;
			}
		}
		FloatType dist2 = LengthSquared(r2);
		if(dist2 < closestDistance2) {
			closestDistance2 = dist2;
			closestVertex = NULL;
			closestEdge = vertex;
			closestVector = r2;
			LOG_INFO() << DotProduct(lineDir, sf->reducedNormalVector);
			closestNormal = CrossProduct(lineDir, sf->reducedNormalVector);
		}
	}

	if(closestVertex != NULL) {
		// Calculate pseudo-normal at vertex.
		Vector3 lineDir1 = wrapReducedVector(closestVertex->next->pos - closestVertex->pos);
		Vector3 lineDir2 = wrapReducedVector(closestVertex->pos - closestVertex->previous->pos);
		closestNormal = NormalizeSafely(CrossProduct(lineDir1, sf->reducedNormalVector)) + NormalizeSafely(CrossProduct(lineDir2, sf->reducedNormalVector));
	}
	else if(closestEdge == NULL) return true;

	return DotProduct(closestNormal, closestVector) > 0.0;
}

/******************************************************************************
* Determines whether the given point (in reduced coordinates) is inside the
* stacking fault polygon.
******************************************************************************/
bool DXAStackingFaults::isInsideStackingFaultRay(StackingFault* sf, SFContourVertex* vertexHead, const Point3 p)
{
	// Test point must be in the SF plane.
	DISLOCATIONS_ASSERT(fabs(DotProduct(p - sf->reducedCenter, sf->reducedNormalVector)) <= FLOATTYPE_EPSILON);

	// Determine a good ray direction.
	Vector3 rayDir = CrossProduct(sf->reducedNormalVector, Vector3(0,0,1));
	if(LengthSquared(rayDir) < FLOATTYPE_EPSILON)
		rayDir = CrossProduct(sf->reducedNormalVector, Vector3(1,0,0));
	DISLOCATIONS_ASSERT(LengthSquared(rayDir) >= FLOATTYPE_EPSILON);
	rayDir = Normalize(rayDir);

	int intersectioncount = 0;
	for(SFContourVertex* vertex = vertexHead; vertex != NULL; vertex = vertex->globalNext) {
		DISLOCATIONS_ASSERT(vertex->next != NULL);
		Vector3 a = wrapReducedVector(vertex->next->pos - vertex->pos);
		Vector3 b = rayDir;
		Vector3 c = p - vertex->pos;
		FloatType denom = LengthSquared(CrossProduct(a, b));
		if(denom == 0) continue;
		FloatType t = DotProduct(CrossProduct(c,b), CrossProduct(a,b)) / denom;
		if(t <= 0 || t >= 1) continue;
		FloatType s = DotProduct(CrossProduct(-c,a), CrossProduct(b,a)) / denom;
		if(s < 0) continue;
		intersectioncount++;
	}

	return (intersectioncount % 2) != 0;
}
