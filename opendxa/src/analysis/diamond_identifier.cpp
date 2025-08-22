#include <opendxa/analysis/diamond_identifier.h>
#include <opendxa/analysis/nearest_neighbor_finder.h>
#include <opendxa/structures/crystal_structure_types.h> 
#include <tbb/parallel_for.h>
#include <tbb/blocked_range.h>
#include <algorithm>
#include <cmath>
#include <limits>

namespace OpenDXA{

DiamondStructureAnalysis::DiamondStructureAnalysis(AnalysisContext& context) : _context(context){
    _diamondStructures = std::make_shared<ParticleProperty>(
        _context.atomCount(),
        DataType::Int,
        1,
        static_cast<int>(StructureType::OTHER),
        false
    );
}

bool DiamondStructureAnalysis::identifyDiamondStructures(){
    const size_t N = _context.atomCount();
    if(N == 0) return false;

    if(_context.simCell.is2D()) {
        throw std::runtime_error("Diamond structure analysis does not support 2D simulation cells.");
    }

    // Find four nearest neighbors for each atom.
    std::vector<std::array<NeighborInfo, 4>> localNeighborLists(N);

    // Set up neighbor finder for 4 nearest neighbors
    NearestNeighborFinder neighborFinder(4);
    if(!neighborFinder.prepare(_context.positions, _context.simCell, _context.particleSelection)){
        return false;
    }

    // Find neighbors
    tbb::parallel_for(tbb::blocked_range<size_t>(0, N), [&](const auto &r){
        NearestNeighborFinder::Query<4> query(neighborFinder);

        for(size_t i = r.begin(); i != r.end(); ++i){
            // Skip unselected particles
            if(_context.particleSelection && 
               !_context.particleSelection->getInt(i)) {
                continue;
            }

            // Don't include self
            query.findNeighbors(i, false);
            const auto& results = query.results();

            int j = 0;
            for(; j < std::min(4, (int) results.size()); ++j){
                localNeighborLists[i][j] = NeighborInfo(results[j].delta, results[j].index);
            }

            // Fill remaining slots with invalid neighbors (-1)
            for(; j < 4; ++j){
                localNeighborLists[i][j] = NeighborInfo();
            }
        }
    });

    // Perform structure identification
    tbb::parallel_for(tbb::blocked_range<size_t>(0, N), [&](const auto &r){
        for(size_t i = r.begin(); i != r.end(); ++i){
          // Skip unselected particles
            if(_context.particleSelection && 
               !_context.particleSelection->getInt(i)){
                _diamondStructures->setInt(i, static_cast<int>(StructureType::OTHER));
                continue;
            }

            const auto& neighbors = localNeighborLists[i];

            // Check if we have 4 valid neighbors
            bool hasValidNeighbors = (neighbors[0].index != -1 && neighbors[1].index != -1 && neighbors[2].index != -1 && neighbors[3].index != -1);
            if(!hasValidNeighbors){
                _diamondStructures->setInt(i, static_cast<int>(StructureType::OTHER));
                continue;
            }

            // Generate second nearest neighbors
            std::array<Vector3, 12> secondNeighbors;
            auto vout = secondNeighbors.begin();
            bool validSecondNeighbors = true;

            for(int j = 0; j < 4 && validSecondNeighbors; ++j){
                const Vector3& v0 = neighbors[j].vec;
                const auto& secondLevel = localNeighborLists[neighbors[j].index];

                for(int k = 0; k < 4; ++k){
                    if(secondLevel[k].index == -1){
                        validSecondNeighbors = false;
                        break;
                    }

                    Vector3 v = v0 + secondLevel[k].vec;
                    // Self-connection
                    if(v.squaredLength() < 1e-4f){
                        continue;
                    }

                    if(vout == secondNeighbors.end()){
                        validSecondNeighbors = false;
                        break;
                    }
                    *vout++ = v;
                }
            }

            if(!validSecondNeighbors || std::distance(secondNeighbors.begin(), vout) != 12){
                _diamondStructures->setInt(i, static_cast<int>(StructureType::OTHER));
                continue;
            }

            // Compute local cutoff radius
            float sum = 0.0f;
            for(const Vector3& v : secondNeighbors){
                sum += v.length();
            }
            sum /= 12.0f;

            // sqrt(2.0) * ((1.0 + sqrt(0.5)) / 2)
            const float factor = 1.2071068f; 
            float localCutoff = sum * factor;
            float localCutoffSquared = localCutoff * localCutoff;

            // Build neighbor bond array
            NeighborBondArray neighborArray;
            for(int ni1 = 0; ni1 < 12; ++ni1) {
                neighborArray.setNeighborBond(ni1, ni1, false);
                for(int ni2 = ni1 + 1; ni2 < 12; ++ni2){
                    float distSq = (secondNeighbors[ni1] - secondNeighbors[ni2]).squaredLength();
                    neighborArray.setNeighborBond(ni1, ni2, distSq <= localCutoffSquared);
                }
            }

            // Perform CNA Analysis
            int n421 = 0;
            int n422 = 0;
            bool validStructure = true;
            
            for(int ni = 0; ni < 12 && validStructure; ++ni){
                uint32_t commonNeighbors = 0;
                int numCommonNeighbors = findCommonNeighbors(neighborArray, ni, commonNeighbors);
                if(numCommonNeighbors != 4){
                    validStructure = false;
                    break;
                }

                std::vector<CNAPairBond> neighborBonds;
                int numNeighborBonds = findNeighborBonds(neighborArray, commonNeighbors, 12, neighborBonds);
                if(numNeighborBonds != 2){
                    validStructure = false;
                    break;
                }

                int maxChainLength = calcMaxChainLength(neighborBonds, numNeighborBonds);
                if(maxChainLength == 1){
                    n421++;
                }else if(maxChainLength == 2){
                    n422++;
                }else{
                    validStructure = false;
                    break;
                }
            }

            // Classify structure based on CNA results
            StructureType structureType = StructureType::OTHER;
            if(validStructure){
                if(n421 == 12 && n422 == 0){
                    structureType = StructureType::CUBIC_DIAMOND;
                }else if(n421 == 6 && n422 == 6){
                    structureType = StructureType::HEX_DIAMOND;
                }
            }

            _diamondStructures->setInt(i, static_cast<int>(structureType));
        }
    });

    // Mark first and second neighbors of diamond atoms
    markNeighborStructures();

    // Store results in context, copy the data to the existing structure types property
    for(size_t i = 0; i < N; ++i){
        _context.structureTypes->setInt(i, _diamondStructures->getInt(i));
    }

    // Populate the shared neighbor list
    if(_context.neighborLists->componentCount() < 4){
        throw std::runtime_error("NeighborList component count must be at least 4 for Diamond Analysis.");
    }

    for(size_t i = 0; i < N; ++i){
        for(int j = 0; j < 4; ++j){
            _context.neighborLists->setIntComponent(i, j, localNeighborLists[i][j].index);
        }
    }

    return true;
}

void DiamondStructureAnalysis::markNeighborStructures(){
    const size_t N = _context.atomCount();

    NearestNeighborFinder neighFinder(4);
    neighFinder.prepare(_context.positions, _context.simCell, _context.particleSelection);

    std::vector<int> newStructureTypes(N);
    for(size_t i = 0; i < N; ++i){
        newStructureTypes[i] = _diamondStructures->getInt(i);
    }

    for(size_t i = 0; i < N; ++i){
        int currentType = _diamondStructures->getInt(i);
        if(currentType != static_cast<int>(StructureType::CUBIC_DIAMOND) && currentType != static_cast<int>(StructureType::HEX_DIAMOND)) continue;
        if(_context.particleSelection && !_context.particleSelection->getInt(i)) continue;

        NearestNeighborFinder::Query<4> query(neighFinder);
        query.findNeighbors(i, false);

        for(const auto &neighbor : query.results()){
            if(_diamondStructures->getInt(neighbor.index) == static_cast<int>(StructureType::OTHER)){
                if(currentType == static_cast<int>(StructureType::CUBIC_DIAMOND)){
                    newStructureTypes[neighbor.index] = static_cast<int>(StructureType::CUBIC_DIAMOND_FIRST_NEIGH);
                }else{
                    newStructureTypes[neighbor.index] = static_cast<int>(StructureType::HEX_DIAMOND_FIRST_NEIGH);
                }
            }
        }
    }

    for(size_t i = 0; i < N; ++i){
        _diamondStructures->setInt(i, newStructureTypes[i]);
    }

    for(size_t i = 0; i < N; ++i){
        int currentType = _diamondStructures->getInt(i);
        if(currentType != static_cast<int>(StructureType::CUBIC_DIAMOND_FIRST_NEIGH) && currentType != static_cast<int>(StructureType::HEX_DIAMOND_FIRST_NEIGH)) continue;
        if(_context.particleSelection && !_context.particleSelection->getInt(i)) continue;

        NearestNeighborFinder::Query<4> query(neighFinder);
        query.findNeighbors(i, false);
        
        for(const auto& neighbor : query.results()) {
            if(_diamondStructures->getInt(neighbor.index) == static_cast<int>(StructureType::OTHER)){
                if(currentType == static_cast<int>(StructureType::CUBIC_DIAMOND_FIRST_NEIGH)){
                    newStructureTypes[neighbor.index] = static_cast<int>(StructureType::CUBIC_DIAMOND_SECOND_NEIGH);
                } else {
                    newStructureTypes[neighbor.index] = static_cast<int>(StructureType::HEX_DIAMOND_SECOND_NEIGH);
                }
            }
        }
    }

    for(size_t i = 0; i < N; ++i){
        _diamondStructures->setInt(i, newStructureTypes[i]);
    }
}

int DiamondStructureAnalysis::findCommonNeighbors(const NeighborBondArray& neighborArray, int ni, uint32_t& commonNeighbors){
    commonNeighbors = 0;
    int count = 0;

    for(int j = 0; j < 12; ++j){
        if(j != ni && neighborArray.getNeighborBond(ni, j)){
            commonNeighbors |= (1u << j);
            count++;
        }
    }

    return count;
}

int DiamondStructureAnalysis::findNeighborBonds(
    const NeighborBondArray& neighborArray,
    uint32_t commonNeighbors, 
    int maxNeighbors, 
    std::vector<CNAPairBond>& neighborBonds
){
    neighborBonds.clear();

    for(int i = 0; i < maxNeighbors; ++i){
        if(!(commonNeighbors & (1u << i))) continue;
        for(int j = i + 1; j < maxNeighbors; ++j){
            if(!(commonNeighbors & (1u << j))) continue;
            if(neighborArray.getNeighborBond(i, j)){
                neighborBonds.emplace_back(i, j);
            }
        }
    }

    return neighborBonds.size();
}

// TODO: duplicated code
int DiamondStructureAnalysis::calcMaxChainLength(const std::vector<CNAPairBond>& neighborBonds, int numBonds){
    if(numBonds == 0) return 0;
    if(numBonds == 1) return 1;
    
    if(numBonds == 2){
        const auto &bond1 = neighborBonds[0];
        const auto &bond2 = neighborBonds[1];

        if(bond1.i == bond2.i || bond1.i == bond2.j || bond1.j == bond2.i || bond1.j == bond2.j){
            return 2;
        }else{
            return 1;
        }
    }

    return 1;
}

}