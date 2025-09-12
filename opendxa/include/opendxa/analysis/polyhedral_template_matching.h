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

class PTM : public NearestNeighborFinder{
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

    static const double (*getTemplate(StructureType structureType, int templateIndex))[3]{
		if(structureType == StructureType::OTHER){
			return nullptr;
		}

		int ptmType = toPtmStructureType(structureType);
		const ptm::refdata_t* ref = ptm::refdata[ptmType];
		return ref->points[templateIndex];
	}

    static double calculateInterfacialDisorientation(
        StructureType structureTypeA,
        StructureType structureTypeB,
        const Quaternion& qa,
        const Quaternion& qb,
        Quaternion &output
    ){
        double disorientation = std::numeric_limits<double>::infinity();
        double orientA[4] = { qa.w(), qa.x(), qa.y(), qa.z() };
        double orientB[4] = { qb.w(), qb.x(), qb.y(), qb.z() };

        if(structureTypeA == StructureType::FCC || structureTypeA == StructureType::CUBIC_DIAMOND) {
            disorientation = (double)ptm::quat_disorientation_hexagonal_to_cubic(orientA, orientB);
        }else{
            disorientation = (double)ptm::quat_disorientation_cubic_to_hexagonal(orientA, orientB);
        }

        output.w() = orientB[0];
        output.x() = orientB[1];
        output.y() = orientB[2];
        output.z() = orientB[3];

        return disorientation * (180 / M_PI);
    }

    template <typename QuaternionType1, typename QuaternionType2>
    static double calculateDisorientation(
        StructureType structureTypeA, 
        StructureType structureTypeB, 
        const QuaternionType1 &qa, 
        const QuaternionType2& qb
    ){
        double disorientation = std::numeric_limits<double>::max();
        if(structureTypeA != structureTypeB){
            return disorientation;
        }

        double orientA[4] = { qa.w(), qa.x(), qa.y(), qa.z() };
        double orientB[4] = { qb.w(), qb.x(), qb.y(), qb.z() };

        int structureType = structureTypeA;
        if(structureType == StructureType::SC ||
            structureType == StructureType::FCC ||
            structureType == StructureType::BCC || 
            structureType == StructureType::CUBIC_DIAMOND){
            disorientation = static_cast<double>(ptm::quat_disorientation_cubic(orientA, orientB));
        }else if(structureType == StructureType::HCP || structureType == StructureType::HEX_DIAMOND){
            disorientation = static_cast<double>(ptm::quat_disorientation_hcp_conventional(orientA, orientB));
        }else{
            return disorientation;
        }

        return disorientation * double(180 / M_PI);
    }

    void setCalculateDefGradient(bool calculateDefGradient){
        _calculateDefGradient = calculateDefGradient;
    }

    bool calculateDefGradient() const{
        return _calculateDefGradient;
    }

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

        uint64_t correspondencesCode() const { return _corrCode; }

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

        const NearestNeighborFinder::Neighbor& getNearestNeighbor(int index) const;
        const NearestNeighborFinder::Neighbor& getTemplateNeighbor(int index) const;

    private:
        const PTM& _algorithm;
        ptm_local_handle_t _handle;
        double _rmsd;
        uint64_t _corrCode = 0;
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