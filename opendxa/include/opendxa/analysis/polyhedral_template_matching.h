#pragma once

#include <opendxa/structures/crystal_structure_types.h>
#include <opendxa/analysis/nearest_neighbor_finder.h> 
#include <opendxa/core/simulation_cell.h>
#include <opendxa/math/matrix3.h>
#include <opendxa/math/quaternion.h>
#include <ptm_functions.h>

#include <vector>
#include <array>
#include <algorithm>
#include <cstdint>
#include <utility>

extern "C" {
    typedef struct ptm_local_handle* ptm_local_handle_t;
}

namespace OpenDXA{

class PTM : private NearestNeighborFinder{
public:
    // This enumeration classifies the possible chemical 
    // arrangement schemes that a region or cluster can have in the crystal lattice.
    enum class OrderingType{
        ORDERING_NONE = 0,
        ORDERING_PURE = 1,
        ORDERING_L10 = 2,
        ORDERING_L12_A = 3,
        ORDERING_L12_B = 4,
        ORDERING_B2 = 5,
        ORDERING_ZINCBLENDE_WURTZITE = 6,
        ORDERING_BORON_NITRIDE = 7,
        NUM_ORDERING_TYPES 
    };

    static constexpr int MAX_INPUT_NEIGHBORS = 18;
    static constexpr int MAX_OUTPUT_NEIGHBORS = 16;

    static StructureType ptmToStructureType(int type);
    static int toPtmStructureType(StructureType type);

    PTM();

    void setRmsdCutoff(double cutoff){
        _rmsdCutoff = cutoff;
    }

    double rmsdCutoff() const{
        return _rmsdCutoff;
    }

    void setCalculateDefGradient(bool calculateDefGradient){
        _calculateDefGradient = calculateDefGradient;
    }

    bool calculateDefGradient() const{
        return _calculateDefGradient;
    }

    void setIdentifyOrdering(const int* particleTypes);

    bool prepare(const Point3* positions, size_t particle_count, const SimulationCell& cell);

    size_t particleCount() const{
        return _particleCount;
    }

    class Kernel : private NearestNeighborFinder::Query<MAX_INPUT_NEIGHBORS>{
    private:
        using NeighborQuery = NearestNeighborFinder::Query<MAX_INPUT_NEIGHBORS>;

    public:
        Kernel(const PTM& algorithm);
        ~Kernel();

        StructureType identifyStructure(size_t particleIndex, const std::vector<uint64_t>& cachedNeighbors, Quaternion* qtarget = nullptr);
        int cacheNeighbors(size_t particleIndex, uint64_t* res);

        StructureType structureType() const{
            return _structureType;
        }

        double rmsd() const{
            return _rmsd;
        }

        const Matrix3& deformationGradient() const{
            return _F;
        }

        double interatomicDistance() const{
            return _interatomicDistance;
        }

        OrderingType orderingType() const{
            return static_cast<OrderingType>(_orderingType);
        }

        Quaternion orientation() const;
        int bestTemplateIndex() const{
            return _bestTemplateIndex;
        }

        int numTemplateNeighbors() const;
        int numNearestNeighbors() const{
            return results().size();
        }

        const NearestNeighborFinder::Neighbor& getNearestNeighbor(int index) const;
        const NearestNeighborFinder::Neighbor& getTemplateNeighbor(int index) const;
        const Vector3& getIdealNeighborVector(int index) const;
    private:
        const PTM& _algorithm;
        ptm_local_handle_t _handle;
        double _rmsd;
        double _scale;
        double _interatomicDistance;
        double _quaternion[4];
        Matrix3 _F;
        StructureType _structureType;
        int32_t _orderingType;
        int _bestTemplateIndex;
        const double (*_bestTemplate)[3];
        ptm_atomicenv_t _env;
    };

private:
    friend class Kernel;
    size_t _particleCount = 0;
    const int* _particleTypes = nullptr;

    std::array<bool, static_cast<size_t>(StructureType::NUM_STRUCTURE_TYPES)> _typesToIdentify = {};
    bool _identifyOrdering = false;
    bool _calculateDefGradient = false;
    double _rmsdCutoff = 0.1;
};

}