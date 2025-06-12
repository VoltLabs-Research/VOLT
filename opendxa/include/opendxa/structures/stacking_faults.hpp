#ifndef __DXA_STACKING_FAULTS_STRUCT_H
#define __DXA_STACKING_FAULTS_STRUCT_H

#include <opendxa/includes.hpp>

struct StackingFault;

struct StackingFaultContour {
	StackingFault* sf;
	vector<MeshEdge*> edges;
	Point3 basePoint;
	vector<Point3> polyline;
	vector<BurgersCircuit*> borderSegments;
	vector< pair<int,int> > segmentIntervals;

	void writeToFile(ostream& stream) const;
	void writePolyline(ostream& stream) const;
};

struct SFContourVertex {
	Point3 unwrappedPos;
	Point3 pos;
	SFContourVertex* previous;
	SFContourVertex* next;
	SFContourVertex* globalNext;
	Vector3I image;
	unsigned int flags;
	bool isClipVertex(int dim) const { return (flags & (1<<dim)) != 0; }
	void setClipVertex(int dim) { flags |= (1<<dim); }
	bool wasVisited() const { return (flags & (1<<3)) != 0; }
	void setVisited() { flags |= (1<<3); }
};

struct StackingFault {
	int index;
	Point3 basePoint;
	vector<StackingFaultContour> contours;
	Vector3 normalVector;
	Point3 center;
	Vector3 reducedNormalVector;
	Point3 reducedCenter;
	SFContourVertex* globalVertexList;
	bool isInfinite[3];
	bool isInvalid;
	int numHCPAtoms;
	int numISFAtoms;
	int numTBAtoms;

	void writeToFile(ostream& stream) const;
};

#endif 
