#include <opendxa/core/opendxa.h>
#include <opendxa/analysis/crystal_path_finder.h>

namespace OpenDXA{

// Finds an atom-to-atom path from atom 1 to atom 2 that lies entirely in the good
// crystal region. Returns true if a path could be found and stores the corresponding ideal
// vector and the cluster transition in the provided pass-by-reference variables.
std::optional<ClusterVector> CrystalPathFinder::findPath(int atomIndex1, int atomIndex2){
    assert(atomIndex1 != atomIndex2);

    auto* cluster1 = structureAnalysis().atomCluster(atomIndex1);
    auto* cluster2 = structureAnalysis().atomCluster(atomIndex2);

    // Test if atom 2 is a direct neighbor of atom 1
    if(cluster1->id != 0){
        if(int ni = structureAnalysis().findNeighbor(atomIndex1, atomIndex2); ni >= 0){
            const auto& v = structureAnalysis().neighborLatticeVector(atomIndex1, ni);
            return ClusterVector{v, cluster1};
        }
    }else if(cluster2->id != 0){
        // Test if atom 1 is a direct neighbor of atom 2
        if(int ni = structureAnalysis().findNeighbor(atomIndex2, atomIndex1); ni >= 0){
            const auto& v = structureAnalysis().neighborLatticeVector(atomIndex2, ni);
            return ClusterVector{-v, cluster2};
        }
    }

    if(_maxPathLength == 1){
        return std::nullopt;
	}

    _nodePool.clear(true);
    PathNode start{atomIndex1, ClusterVector{Vector3::Zero(), nullptr}};
    start.distance = 0;

    // Mark the head atom as visited
    _visitedAtoms.set(atomIndex1);

    // Process items from queue until it becomes empty or the destination atom has been reached.
    PathNode* tail = &start;
    std::optional<ClusterVector> result;

    for(PathNode* cur = &start; cur && !result; cur = cur->nextToProcess){
        int a = cur->atomIndex;
        assert(a != atomIndex2);
        assert(_visitedAtoms.test(a));

        auto* curCluster = structureAnalysis().atomCluster(a);
        int nbors = structureAnalysis().numberOfNeighbors(a);

        for(int i = 0; i < nbors; ++i){
            int nb = structureAnalysis().getNeighbor(a, i);
            if(_visitedAtoms.test(nb)){
                continue;
			}

            if(cur->distance >= _maxPathLength - 1 && nb != atomIndex2){
                continue;
			}

            ClusterVector step{Vector3::Zero(), nullptr};
            if(curCluster->id != 0){
                step = ClusterVector{structureAnalysis().neighborLatticeVector(a, i), curCluster};
            }else{
                auto* nbCluster = structureAnalysis().atomCluster(nb);
                if(nbCluster->id == 0){
                    continue;
				}
                bool found = false;
                int n2 = structureAnalysis().numberOfNeighbors(nb);
                for(int j = 0; j < n2; ++j){
                    if(structureAnalysis().getNeighbor(nb, j) == a){
                        step = ClusterVector{-structureAnalysis().neighborLatticeVector(nb, j), nbCluster};
                        found = true;
                        break;
                    }
                }
                if(!found){
                    continue;
				}
            }

            // Build path vector
            auto pathVec = cur->idealVector;
            if(pathVec.cluster() == step.cluster()){
                pathVec.localVec() += step.localVec();
            }else if(pathVec.cluster()){
                assert(step.cluster());
                if(auto* trans = clusterGraph().determineClusterTransition(step.cluster(), pathVec.cluster())){
                    pathVec.localVec() += trans->transform(step.localVec());
                }else{
                    continue;
                }
            }else{
                pathVec = step;
            }

            if(nb == atomIndex2){
                result = pathVec;
                break;
            }

            // Enqueue for BFS
            if(cur->distance < _maxPathLength - 1){
                auto* node = _nodePool.construct(nb, pathVec);
                node->distance = cur->distance + 1;
                assert(!tail->nextToProcess);
                tail->nextToProcess = node;
                tail = node;
                _visitedAtoms.set(nb);
            }
        }
    }

    for(PathNode* node = &start; node; node = node->nextToProcess){
        _visitedAtoms.reset(node->atomIndex);
    }

    return result;
}

}