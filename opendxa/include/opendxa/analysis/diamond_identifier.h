#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/analysis/structure_analysis.h>
#include <opendxa/analysis/nearest_neighbor_finder.h>
#include <opendxa/core/particle_property.h>
#include <opendxa/core/simulation_cell.h>
#include <opendxa/analysis/analysis_context.h>
#include <vector>
#include <array>
#include <memory>

namespace OpenDXA{

class DiamondStructureAnalysis{
public:
    explicit DiamondStructureAnalysis(AnalysisContext& context);
    
    bool identifyDiamondStructures();

    std::vector<int64_t> getStructureTypeCounts() const;

private:
    struct NeighborInfo{
        Vector3 vec;
        int index;

        NeighborInfo() : vec(Vector3::Zero()), index(-1) {}
        NeighborInfo(const Vector3& v, int idx) : vec(v), index(idx) {}
    };

    class NeighborBondArray{
    private:
        std::array<std::array<bool, 12>, 12> bonds;

    public:
        NeighborBondArray(){
            for(auto &row : bonds){
                row.fill(false);
            }
        }

        void setNeighborBond(int i, int j, bool bonded){
            if(i >= 0 && i < 12 && j >= 0 && j < 12){
                bonds[i][j] = bonds[j][i] = bonded;
            }
        }

        bool getNeighborBond(int i, int j) const{
            if(i >= 0 && i < 12 && j >= 0 && j < 12){
                return bonds[i][j];
            }

            return false;
        }
    };

    struct CNAPairBond {
        int i, j;
        CNAPairBond(int a, int b) : i(a), j(b) {}
    };

    AnalysisContext& _context;
    std::shared_ptr<ParticleProperty> _diamondStructures;
    
    bool findFourNearestNeighbors(size_t atomIndex, std::array<NeighborInfo, 4>& neighbors);
    bool generateSecondNeighbors(const std::array<NeighborInfo, 4>& firstNeighbors, std::array<Vector3, 12>& secondNeighbors);
    float computeLocalCutoff(const std::array<Vector3, 12>& secondNeighbors);
    StructureType classifyAtomStructure(size_t atomIndex);
    void markNeighborStructures();
    
    int findCommonNeighbors(const NeighborBondArray& neighborArray, int ni, uint32_t& commonNeighbors);
    int findNeighborBonds(const NeighborBondArray& neighborArray, uint32_t commonNeighbors, int maxNeighbors, std::vector<CNAPairBond>& neighborBonds);
    int calcMaxChainLength(const std::vector<CNAPairBond>& neighborBonds, int numBonds);
};

}