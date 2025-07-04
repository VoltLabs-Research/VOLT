#pragma once

#include <cassert>
#include <cstddef>
#include <optional>
#include <boost/dynamic_bitset.hpp>
#include <opendxa/utilities/memory_pool.h>
#include <opendxa/structures/cluster_vector.h>
#include <opendxa/analysis/structure_analysis.h>

namespace OpenDXA{

class CrystalPathFinder{
public:
    explicit CrystalPathFinder(StructureAnalysis& sa, int maxPathLength)
      : _structureAnalysis(sa),
        _nodePool(1024),
        _visitedAtoms(sa.atomCount()),
        _maxPathLength(maxPathLength){
        assert(maxPathLength >= 1);
    }

    [[nodiscard]] const StructureAnalysis& structureAnalysis() const noexcept{
        return _structureAnalysis;
    }

    [[nodiscard]] ClusterGraph& clusterGraph() noexcept{
        return _structureAnalysis.clusterGraph();
    }

    [[nodiscard]] const ClusterGraph& clusterGraph() const noexcept{
        return _structureAnalysis.clusterGraph();
    }

    [[nodiscard]] std::optional<ClusterVector> findPath(int atomIndex1, int atomIndex2);

private:
    struct PathNode{
        int atomIndex;
        ClusterVector idealVector;
        int distance = 0;
        PathNode* nextToProcess  = nullptr;

        PathNode(int idx, const ClusterVector& vec) noexcept
          : atomIndex(idx), idealVector(vec){}
    };

    StructureAnalysis& _structureAnalysis;
    MemoryPool<PathNode> _nodePool;
    boost::dynamic_bitset<> _visitedAtoms;
    int _maxPathLength;
};

} 