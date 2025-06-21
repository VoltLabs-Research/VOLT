#ifndef OPENDXA_DISLOCATION_SEGMENT_HPP
#define OPENDXA_DISLOCATION_SEGMENT_HPP

#include <opendxa/engine/analysis_environment.hpp>
#include <opendxa/utils/linalg/lattice_vector.hpp>
#include <opendxa/utils/linalg/lin_alg.hpp>
#include <opendxa/structures/dislocations/burgers_circuit.hpp>

struct BurgersCircuit;

struct DislocationSegment{
    DislocationSegment(const Vector3& b, const Vector3& bWorld)
            : burgersVector(b)
            , burgersVectorWorld(bWorld)
            , replacedWith(NULL)
            , V(NULL_MATRIX)
            , W(NULL_MATRIX){
        circuits[0] = circuits[1] = NULL;
        displacementCount = 0;
    }

    DislocationSegment(
            const Vector3& b, 
            BurgersCircuit* forwardCircuit, 
            BurgersCircuit* backwardCircuit, 
            const Point3& refPoint, 
            const AnalysisEnvironment& simCell
        ) : burgersVector(b)
            , primarySegmentStart(0)
            , primarySegmentEnd(2)
            , replacedWith(NULL)
            , V(NULL_MATRIX)
            , W(NULL_MATRIX){
		circuits[0] = forwardCircuit;
		circuits[1] = backwardCircuit;
		circuits[0]->segment = this;
		circuits[1]->segment = this;
		circuits[0]->oppositeCircuit = circuits[1];
		circuits[1]->oppositeCircuit = circuits[0];

		// Add the first two points to the line.
		line.push_back(backwardCircuit->calculateCenter(refPoint, simCell));
		line.push_back(forwardCircuit->calculateCenter(refPoint, simCell));

		displacementCount = 0;
	}

	void determineWorldBurgersVector();

    // TODO: I should leave only the definitions here and move the logic to src/?
	BurgersCircuit* forwardCircuit() const{
        return circuits[0];
    }
    
	BurgersCircuit* backwardCircuit() const{
        return circuits[1];
    }

	void recordLinePoint(BurgersCircuit* circuit, bool isPrimarySegment, const AnalysisEnvironment& simCell){
		DISLOCATIONS_ASSERT_GLOBAL(!line.empty());
		if(circuit == forwardCircuit()){
			line.push_back(circuit->calculateCenter(line.back(), simCell));
			if(isPrimarySegment == true) primarySegmentEnd++;
		}else{
			DISLOCATIONS_ASSERT(circuit == backwardCircuit());
			line.push_front(circuit->calculateCenter(line.front(), simCell));
			primarySegmentEnd++;
			if(isPrimarySegment == false) primarySegmentStart++;
		}
	}

	bool isClosedLoop() const{
		return (circuits[0]->isDangling == false) && (circuits[0]->junctionRing == circuits[1]) && (circuits[1]->junctionRing == circuits[0]);
	}

	FloatType calculateLength() const{
		FloatType length = 0.0;
		deque<Point3>::const_iterator i1 = line.begin();
		for(;;){
			deque<Point3>::const_iterator i2 = i1 + 1;
			if(i2 == line.end()) break;
			length += Distance(*i1, *i2);
			i1 = i2;
		}
		return length;
	}

    int index;
	deque<Point3> line;
	vector<Vector3> displacement;
	int displacementCount;
	Vector3 burgersVector;
	Vector3 burgersVectorWorld;
	BurgersCircuit* circuits[2];
	size_t primarySegmentStart;
	size_t primarySegmentEnd;
	DislocationSegment* replacedWith;
	Matrix3 V,W;
};

#endif