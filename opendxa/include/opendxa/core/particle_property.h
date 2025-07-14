#pragma once

#include <opendxa/core/property_base.h>
#include <string>
#include <vector>
#include <map>

namespace OpenDXA::Particles{

class ParticleProperty : public PropertyBase{
public:

    enum Type {
        UserProperty                = 0,
        ParticleTypeProperty        = 1,
        PositionProperty            = 2,
        SelectionProperty           = 3,
        ColorProperty               = 4,
        DisplacementProperty        = 5,
        DisplacementMagnitudeProperty = 6,
        PotentialEnergyProperty     = 7,
        KineticEnergyProperty       = 8,
        TotalEnergyProperty         = 9,
        VelocityProperty            = 10,
        RadiusProperty              = 11,
        ClusterProperty             = 12,
        CoordinationProperty        = 13,
        StructureTypeProperty       = 14,
        IdentifierProperty          = 15,
        StressTensorProperty        = 16,
        StrainTensorProperty        = 17,
        DeformationGradientProperty = 18,
        OrientationProperty         = 19,
        ForceProperty               = 20,
        MassProperty                = 21,
        ChargeProperty              = 22,
        PeriodicImageProperty       = 23,
        TransparencyProperty        = 24,
        DipoleOrientationProperty   = 25,
        DipoleMagnitudeProperty     = 26,
        AngularVelocityProperty     = 27,
        AngularMomentumProperty     = 28,
        TorqueProperty              = 29,
        SpinProperty                = 30,
        CentroSymmetryProperty      = 31,
        VelocityMagnitudeProperty   = 32,
        MoleculeProperty            = 34,
        AsphericalShapeProperty     = 35,
        VectorColorProperty         = 36,
        ElasticStrainTensorProperty = 37,
        ElasticDeformationGradientProperty = 38,
        RotationProperty            = 39,
        StretchTensorProperty       = 40,
        MoleculeTypeProperty        = 41
    };

public:

    ParticleProperty();
    ParticleProperty(size_t particleCount,
                     Type   type,
                     size_t componentCount = 0,
                     bool   initializeMemory = false);
    ParticleProperty(size_t              particleCount,
                     DataType                 dataType,
                     size_t              componentCount,
                     size_t              stride,
                     bool                initializeMemory);

    ParticleProperty(const ParticleProperty& other);

    Type type() const { return _type; }

    void setType(Type t) { _type = t; }
private:
    Type _type;
};

}