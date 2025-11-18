#include <opendxa/analysis/atomic_strain.h>
#include <opendxa/analysis/cutoff_neighbor_finder.h>

#include <cmath>
#include <numeric>
#include <map>
#include <cassert>

namespace OpenDXA{

using namespace Particles;

AtomicStrainModifier::AtomicStrainEngine::AtomicStrainEngine(
    ParticleProperty* positions,
    const SimulationCell& cell,
    ParticleProperty* refPositions,
    const SimulationCell& refCell,
    ParticleProperty* identifiers,
    ParticleProperty* refIdentifiers,
    double cutoff,
    bool eliminateCellDeformation,
    bool assumeUnwrappedCoordinates,
    bool calculateDeformationGradients,
    bool calculateStrainTensors,
    bool calculateNonaffineSquaredDisplacements
)
    : _positions(positions)
    , _refPositions(refPositions)
    , _identifiers(identifiers)
    , _refIdentifiers(refIdentifiers)
    , _simCell(cell)
    , _simCellRef(refCell)
    , _currentSimCellInv(cell.inverseMatrix())
    , _reducedToAbsolute(eliminateCellDeformation ? refCell.matrix() : cell.matrix())
    , _cutoff(cutoff)
    , _eliminateCellDeformation(eliminateCellDeformation)
    , _assumeUnwrappedCoordinates(assumeUnwrappedCoordinates)
    , _calculateDeformationGradients(calculateDeformationGradients)
    , _calculateStrainTensors(calculateStrainTensors)
    , _calculateNonaffineSquaredDisplacements(calculateNonaffineSquaredDisplacements){
    _numInvalidParticles.store(0, std::memory_order_relaxed);
}

void AtomicStrainModifier::AtomicStrainEngine::perform(){
    std::vector<int> currentToRefIndexMap(positions()->size());
    std::vector<int> refToCurrentIndexMap(refPositions()->size());

    if(_identifiers && _refIdentifiers){
        assert(_identifiers->size()    == positions()->size());
        assert(_refIdentifiers->size() == refPositions()->size());

        std::map<int,int> refMap;
        int index = 0;
        for(int id : _refIdentifiers->constIntRange()){
            if(!refMap.insert(std::make_pair(id,index)).second)
                throw std::runtime_error("Particles with duplicate identifiers detected in reference configuration.");
            ++index;
        }

        std::map<int,int> currentMap;
        index = 0;
        for(int id : _identifiers->constIntRange()){
            if(!currentMap.insert(std::make_pair(id,index)).second)
                throw std::runtime_error("Particles with duplicate identifiers detected in current configuration.");
            ++index;
        }

        const int* id = _identifiers->constDataInt();
        for(auto& mappedIndex : currentToRefIndexMap){
            auto it = refMap.find(*id);
            mappedIndex = (it != refMap.end()) ? it->second : -1;
            ++id;
        }

        id = _refIdentifiers->constDataInt();
        for(auto& mappedIndex : refToCurrentIndexMap){
            auto it = currentMap.find(*id);
            mappedIndex = (it != currentMap.end()) ? it->second : -1;
            ++id;
        }
    }else{
        if(positions()->size() != refPositions()->size())
            throw std::runtime_error("Cannot calculate displacements. Numbers of particles in reference configuration and current configuration do not match.");
        std::iota(refToCurrentIndexMap.begin(),   refToCurrentIndexMap.end(),   0);
        std::iota(currentToRefIndexMap.begin(),   currentToRefIndexMap.end(),   0);
    }

    _simCellRef.setPbcFlags(_simCell.pbcFlags());

    CutoffNeighborFinder neighborFinder;
    if(!neighborFinder.prepare(_cutoff, refPositions(), refCell())) return;

    const std::size_t n = positions()->size();

    _shearStrains = std::make_shared<ParticleProperty>(n, DataType::Double, 1, 0, true);
    _volumetricStrains = std::make_shared<ParticleProperty>(n, DataType::Double, 1, 0, true);
    _invalidParticles = std::make_shared<ParticleProperty>(n, DataType::Int, 1, 0, true);

    if(_calculateStrainTensors){
        _strainTensors = std::make_shared<ParticleProperty>(n, DataType::Double, 6, 0, true);
    }else{
        _strainTensors.reset();
    }

    if(_calculateDeformationGradients){
        _deformationGradients = std::make_shared<ParticleProperty>(n, DataType::Double, 9, 0, true);
    }else{
        _deformationGradients.reset();
    }

    if(_calculateNonaffineSquaredDisplacements){
        _nonaffineSquaredDisplacements = std::make_shared<ParticleProperty>(n, DataType::Double, 1, 0, true);
    }else{
        _nonaffineSquaredDisplacements.reset();
    }

    #pragma omp parallel for schedule(dynamic)
    for(long long i = 0; i < static_cast<long long>(n); ++i){
        if(!computeStrain(static_cast<std::size_t>(i),
                          neighborFinder,
                          refToCurrentIndexMap,
                          currentToRefIndexMap)){
            _numInvalidParticles.fetch_add(1, std::memory_order_relaxed);
        }
    }
}

bool AtomicStrainModifier::AtomicStrainEngine::computeStrain(
    std::size_t                 particleIndex,
    CutoffNeighborFinder&       neighborFinder,
    const std::vector<int>&     refToCurrentIndexMap,
    const std::vector<int>&     currentToRefIndexMap){
    Matrix_3<double> V = Matrix_3<double>::Zero();
    Matrix_3<double> W = Matrix_3<double>::Zero();
    int numNeighbors = 0;

    int particleIndexReference = currentToRefIndexMap[particleIndex];

    if(particleIndexReference != -1){
        const Point3 x = positions()->getPoint3(particleIndex);

        for(CutoffNeighborFinder::Query neighQuery(neighborFinder, particleIndexReference);
            !neighQuery.atEnd(); neighQuery.next()){
            const Vector3& r0 = neighQuery.delta();
            int neighborIndexCurrent = refToCurrentIndexMap[neighQuery.current()];
            if(neighborIndexCurrent == -1) continue;

            Vector3 r = positions()->getPoint3(neighborIndexCurrent) - x;
            Vector3 sr = _currentSimCellInv * r; 

            if(!_assumeUnwrappedCoordinates){
                for(std::size_t k = 0; k < 3; ++k){
                    if(_simCell.pbcFlags()[k])
                        sr[k] -= std::floor(sr[k] + double(0.5));
                }
            }

            r = _reducedToAbsolute * sr;

            for(std::size_t i = 0; i < 3; ++i){
                for(std::size_t j = 0; j < 3; ++j){
                    V(i,j) += r0[j] * r0[i];
                    W(i,j) += r0[j] * r[i];
                }
            }

            ++numNeighbors;
        }
    }

    Matrix_3<double> inverseV;
    if(numNeighbors < 3 || !V.inverse(inverseV, 1e-4) || std::abs(W.determinant()) < 1e-4){
        _invalidParticles->setInt(particleIndex, 1);

        if(_deformationGradients){
            for(Matrix_3<double>::size_type col = 0; col < 3; ++col){
                for(Matrix_3<double>::size_type row = 0; row < 3; ++row){
                    _deformationGradients->setDoubleComponent(
                        particleIndex, col*3 + row, 0.0);
                }
            }
        }

        if(_strainTensors){
            _strainTensors->setSymmetricTensor2(particleIndex, SymmetricTensor2::Zero());
        }

        if(_nonaffineSquaredDisplacements){
            _nonaffineSquaredDisplacements->setDouble(particleIndex, 0.0);
        }

        _shearStrains->setDouble(particleIndex, 0.0);
        _volumetricStrains->setDouble(particleIndex, 0.0);
        return false;
    }

    Matrix_3<double> F = W * inverseV;
    if(_deformationGradients){
        for(Matrix_3<double>::size_type col = 0; col < 3; ++col){
            for(Matrix_3<double>::size_type row = 0; row < 3; ++row){
                _deformationGradients->setDoubleComponent(
                    particleIndex, col*3 + row, static_cast<double>(F(row,col)));
            }
        }
    }

    SymmetricTensor2T<double> strain =
        (Product_AtA(F) - SymmetricTensor2T<double>::Identity()) * 0.5;

    if(_strainTensors){
        _strainTensors->setSymmetricTensor2(
            particleIndex, static_cast<SymmetricTensor2>(strain));
    }

    if(_nonaffineSquaredDisplacements){
        double D2min = 0.0;
        const Point3 x = positions()->getPoint3(particleIndex);

        for(CutoffNeighborFinder::Query neighQuery(neighborFinder, particleIndexReference);
            !neighQuery.atEnd(); neighQuery.next())
        {
            const Vector3& r0 = neighQuery.delta();
            int neighborIndexCurrent = refToCurrentIndexMap[neighQuery.current()];
            if(neighborIndexCurrent == -1) continue;

            Vector3 r = positions()->getPoint3(neighborIndexCurrent) - x;
            Vector3 sr = _currentSimCellInv * r;
            if(!_assumeUnwrappedCoordinates){
                for(std::size_t k = 0; k < 3; ++k){
                    if(_simCell.pbcFlags()[k])
                        sr[k] -= std::floor(sr[k] + double(0.5));
                }
            }
            r = _reducedToAbsolute * sr;

            Vector_3<double> rDouble(r.x(),  r.y(),  r.z());
            Vector_3<double> r0Double(r0.x(), r0.y(), r0.z());
            Vector_3<double> dr = rDouble - F * r0Double;
            D2min += dr.squaredLength();
        }

        _nonaffineSquaredDisplacements->setDouble(particleIndex, D2min);
    }

    double xydiff = strain.xx() - strain.yy();
    double xzdiff = strain.xx() - strain.zz();
    double yzdiff = strain.yy() - strain.zz();
    double shearStrain = std::sqrt(
        strain.xy()*strain.xy() +
        strain.xz()*strain.xz() +
        strain.yz()*strain.yz() +
        (xydiff*xydiff + xzdiff*xzdiff + yzdiff*yzdiff) / 6.0
    );
    assert(std::isfinite(shearStrain));
    _shearStrains->setDouble(particleIndex, shearStrain);

    double volumetricStrain =
        (strain(0,0) + strain(1,1) + strain(2,2)) / 3.0;
    assert(std::isfinite(volumetricStrain));
    _volumetricStrains->setDouble(particleIndex, volumetricStrain);

    _invalidParticles->setInt(particleIndex, 0);
    return true;
}

} 