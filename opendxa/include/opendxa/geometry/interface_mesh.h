#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/geometry/half_edge_mesh.h>
#include <opendxa/analysis/elastic_mapping.h>

namespace OpenDXA{

struct BurgersCircuit;
struct BurgersCircuitSearchStruct;
class BurgersLoopBuilder;

struct InterfaceMeshVertex{
    BurgersCircuitSearchStruct* burgersSearchStruct = nullptr;
    bool visited = false;
};

struct InterfaceMeshFace{
    BurgersCircuit* circuit = nullptr;
};

struct InterfaceMeshEdge{
    Vector3 physicalVector;
    Vector3 clusterVector;
    ClusterTransition* clusterTransition = nullptr;
    BurgersCircuit* circuit = nullptr;
    HalfEdgeMesh<InterfaceMeshEdge, InterfaceMeshFace, InterfaceMeshVertex>::Edge* nextCircuitEdge = nullptr;
};

class InterfaceMesh : public HalfEdgeMesh<InterfaceMeshEdge, InterfaceMeshFace, InterfaceMeshVertex>{
public:
    explicit InterfaceMesh(ElasticMapping& mapping) noexcept
        : _elasticMapping(mapping){}

    [[nodiscard]] ElasticMapping& elasticMapping() noexcept{
		return _elasticMapping;
	}

    [[nodiscard]] ElasticMapping const& elasticMapping() const noexcept{
		return _elasticMapping;
	}

    [[nodiscard]] DelaunayTessellation& tessellation() noexcept{
		return elasticMapping().tessellation();
	}

    [[nodiscard]] StructureAnalysis const& structureAnalysis() const noexcept{
        return elasticMapping().structureAnalysis();
    }

    void createMesh(double maximumNeighborDistance);

    [[nodiscard]] bool isCompletelyGood() const noexcept{
		return _isCompletelyGood;
	}

    [[nodiscard]] bool isCompletelyBad()  const noexcept{
		return _isCompletelyBad;
	}

    bool generateDefectMesh(BurgersLoopBuilder const& tracer, HalfEdgeMesh<InterfaceMeshEdge, InterfaceMeshFace, InterfaceMeshVertex>& defectMesh);

private:
    ElasticMapping& _elasticMapping;
    bool _isCompletelyGood = true;
    bool _isCompletelyBad  = true;
};

}
