#include <opendxa/analysis/elastic_strain.h>
#include <opendxa/analysis/cluster_connector.h>

#include <cmath>
#include <cassert>

namespace OpenDXA{

ElasticStrainEngine::ElasticStrainEngine(
    ParticleProperty* positions,
    ParticleProperty* structures,
    const SimulationCell& simcell,
    LatticeStructureType inputCrystalStructure,
    std::vector<Matrix3>&& preferredCrystalOrientations,
    bool calculateDeformationGradients,
    bool calculateStrainTensors,
    double latticeConstant,
    double caRatio,
    bool pushStrainTensorsForward,
    StructureAnalysis::Mode identificationMode,
    double rmsd
)
    : _latticeConstant(latticeConstant)
    , _axialScaling(1.0)
    , _inputCrystalStructure(inputCrystalStructure)
    , _pushStrainTensorsForward(pushStrainTensorsForward)
    , _context(positions,
               simcell,
               inputCrystalStructure,
               /*selection*/ nullptr,
               /*outputStructures*/ structures,
               std::move(preferredCrystalOrientations))
    , _structureAnalysis(_context,
                         /*identifyPlanarDefects*/ false,
                         identificationMode,
                         rmsd)
    , _volumetricStrains(std::make_unique<ParticleProperty>(
          positions->size(), DataType::Double, 1, 0, false))
    , _strainTensors(calculateStrainTensors
          ? std::make_unique<ParticleProperty>(
                positions->size(), DataType::Double, 6, 0, false)
          : nullptr)
    , _deformationGradients(calculateDeformationGradients
          ? std::make_unique<ParticleProperty>(
                positions->size(), DataType::Double, 9, 0, false)
          : nullptr)
{
    if(inputCrystalStructure == LatticeStructureType::LATTICE_FCC ||
       inputCrystalStructure == LatticeStructureType::LATTICE_BCC ||
       inputCrystalStructure == LatticeStructureType::LATTICE_CUBIC_DIAMOND){
        _axialScaling = 1.0;
    }else{
        _latticeConstant *= std::sqrt(2.0);
        _axialScaling = caRatio / std::sqrt(8.0 / 3.0);
    }
}

void ElasticStrainEngine::perform(){
    _structureAnalysis.identifyStructures();

    auto stats = _structureAnalysis.getNamedStructureStatistics();
    spdlog::info("Structure Identification Results:");
    for(const auto& [name, count] : stats){
        spdlog::info("  {}: {}", name, count);
    }
    spdlog::info("Input Crystal Structure (Expected): {}", _inputCrystalStructure);

    ClusterConnector clusterConnector(_structureAnalysis, _context);
    clusterConnector.buildClusters();
    clusterConnector.connectClusters();
    clusterConnector.formSuperClusters();

    const std::size_t N = _context.atomCount();

    #pragma omp parallel for
    for(long idx = 0; idx < static_cast<long>(N); ++idx){
        std::size_t particleIndex = static_cast<std::size_t>(idx);

        Cluster* localCluster = _structureAnalysis.atomCluster(static_cast<int>(particleIndex));
        if(!localCluster || localCluster->id == 0){
            _volumetricStrains->setDouble(particleIndex, 0.0);
            if(_strainTensors){
                for(size_t c = 0; c < 6; ++c){
                    _strainTensors->setDoubleComponent(particleIndex, c, 0.0);
                }
            }
            if(_deformationGradients){
                for(size_t c = 0; c < 9; ++c){
                    _deformationGradients->setDoubleComponent(particleIndex, c, 0.0);
                }
            }
            continue;
        }

        Matrix3 idealUnitCellTM(
            _latticeConstant, 0.0,            0.0,
            0.0,              _latticeConstant, 0.0,
            0.0,              0.0,            _latticeConstant * _axialScaling
        );

        Cluster* parentCluster = nullptr;
        if(localCluster->parentTransition != nullptr){
            parentCluster = localCluster->parentTransition->cluster2;
            idealUnitCellTM = idealUnitCellTM * localCluster->parentTransition->tm;
        }else if(localCluster->structure == _inputCrystalStructure){
            parentCluster = localCluster;
        }

        if(!parentCluster){
            _volumetricStrains->setDouble(particleIndex, 0.0);
            if(_strainTensors){
                for(size_t c = 0; c < 6; ++c){
                    _strainTensors->setDoubleComponent(particleIndex, c, 0.0);
                }
            }
            if(_deformationGradients){
                for(size_t c = 0; c < 9; ++c){
                    _deformationGradients->setDoubleComponent(particleIndex, c, 0.0);
                }
            }
            continue;
        }

        assert(parentCluster->structure == _inputCrystalStructure);

        // TODO: PTM already provides this information. We should use it if it is available.
        Matrix_3<double> orientationV = Matrix_3<double>::Zero();
        Matrix_3<double> orientationW = Matrix_3<double>::Zero();

        int numneighs = _structureAnalysis.numberOfNeighbors(static_cast<int>(particleIndex));
        for(int n = 0; n < numneighs; ++n){
            int neighborAtomIndex = _structureAnalysis.getNeighbor(static_cast<int>(particleIndex), n);

            Vector3 latticeVector =
                idealUnitCellTM * _structureAnalysis.neighborLatticeVector(static_cast<int>(particleIndex), n);

            const Vector3& spatialVector =
                _context.simCell.wrapVector(
                    _context.positions->getPoint3(neighborAtomIndex) -
                    _context.positions->getPoint3(particleIndex)
                );

            for(size_t r = 0; r < 3; ++r){
                for(size_t c = 0; c < 3; ++c){
                    orientationV(r,c) += static_cast<double>(latticeVector[c] * latticeVector[r]);
                    orientationW(r,c) += static_cast<double>(latticeVector[c] * spatialVector[r]);
                }
            }
        }

        Matrix_3<double> elasticF = orientationW * orientationV.inverse();

        if(_deformationGradients){
            for(size_t col = 0; col < 3; ++col){
                for(size_t row = 0; row < 3; ++row){
                    _deformationGradients->setDoubleComponent(
                        particleIndex, col*3 + row, static_cast<double>(elasticF(row,col)));
                }
            }
        }

        // Strain tensor
        SymmetricTensor2T<double> elasticStrain;
        if(!_pushStrainTensorsForward){
            // Green strain (material frame)
            elasticStrain = (Product_AtA(elasticF) - SymmetricTensor2T<double>::Identity()) * 0.5;
        }else{
            // Euler strain (spatial frame)
            Matrix_3<double> inverseF;
            if(!elasticF.inverse(inverseF)){
                _volumetricStrains->setDouble(particleIndex, 0.0);
                if(_strainTensors){
                    for(size_t c = 0; c < 6; ++c){
                        _strainTensors->setDoubleComponent(particleIndex, c, 0.0);
                    }
                }
                continue;
            }
            elasticStrain = (SymmetricTensor2T<double>::Identity() - Product_AtA(inverseF)) * 0.5;
        }

        if(_strainTensors){
            _strainTensors->setSymmetricTensor2(particleIndex, (SymmetricTensor2)elasticStrain);
        }

        // Volumetric strain = tr(ε)/3
        double volumetricStrain =
            (elasticStrain(0,0) + elasticStrain(1,1) + elasticStrain(2,2)) / 3.0;
        assert(std::isfinite(volumetricStrain));
        _volumetricStrains->setDouble(particleIndex, volumetricStrain);
    } 
}

}