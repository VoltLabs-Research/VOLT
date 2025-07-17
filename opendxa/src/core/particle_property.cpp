#include <opendxa/core/particle_property.h>
#include <stdexcept>
#include <cassert>

namespace OpenDXA { namespace Particles {

// Ctor por defecto
ParticleProperty::ParticleProperty()
    : PropertyBase()
    , _type(UserProperty)
{}

// Ctor estándar (4 parámetros)
ParticleProperty::ParticleProperty(size_t particleCount,
                                   Type   type,
                                   size_t componentCount,
                                   bool   initializeMemory)
    : PropertyBase(
        particleCount,
        // Determina el tipo de dato según el tipo estándar
        (type == ParticleTypeProperty || type == StructureTypeProperty || type == SelectionProperty || type == ClusterProperty || type == CoordinationProperty || type == IdentifierProperty || type == MoleculeProperty || type == MoleculeTypeProperty || type == PeriodicImageProperty) ? DataType::Int :
        (type == UserProperty) ? DataType::Void : DataType::Float,
        // Usa el componentCount del usuario si es válido, si no el estándar
        (componentCount > 0) ? componentCount :
        (type == PositionProperty || type == DisplacementProperty || type == VelocityProperty || type == ForceProperty || type == DipoleOrientationProperty || type == AngularVelocityProperty || type == AngularMomentumProperty || type == TorqueProperty || type == AsphericalShapeProperty || type == ColorProperty || type == VectorColorProperty || type == PeriodicImageProperty) ? 3 :
        (type == StressTensorProperty || type == StrainTensorProperty || type == ElasticStrainTensorProperty || type == StretchTensorProperty) ? 6 :
        (type == DeformationGradientProperty || type == ElasticDeformationGradientProperty) ? 9 :
        (type == OrientationProperty || type == RotationProperty) ? 4 : 1,
        // Calcula el stride según el componentCount efectivo y tipo de dato
        (componentCount > 0) ? ((type == ParticleTypeProperty || type == StructureTypeProperty || type == SelectionProperty || type == ClusterProperty || type == CoordinationProperty || type == IdentifierProperty || type == MoleculeProperty || type == MoleculeTypeProperty || type == PeriodicImageProperty) ? componentCount * sizeof(int) : componentCount * sizeof(double)) :
        (type == PositionProperty || type == DisplacementProperty || type == VelocityProperty || type == ForceProperty || type == DipoleOrientationProperty || type == AngularVelocityProperty || type == AngularMomentumProperty || type == TorqueProperty || type == AsphericalShapeProperty) ? sizeof(Vector3) :
        (type == ColorProperty || type == VectorColorProperty) ? 3 * sizeof(double) :
        (type == StressTensorProperty || type == StrainTensorProperty || type == ElasticStrainTensorProperty || type == StretchTensorProperty) ? sizeof(SymmetricTensor2) :
        (type == DeformationGradientProperty || type == ElasticDeformationGradientProperty) ? 9 * sizeof(double) :
        (type == OrientationProperty || type == RotationProperty) ? sizeof(Quaternion) :
        (type == PeriodicImageProperty) ? 3 * sizeof(int) :
        (type == ParticleTypeProperty || type == StructureTypeProperty || type == SelectionProperty || type == ClusterProperty || type == CoordinationProperty || type == IdentifierProperty || type == MoleculeProperty || type == MoleculeTypeProperty) ? sizeof(int) : sizeof(double),
        initializeMemory)
    , _type(type)
{
    // Validación de componentCount
    //assert(componentCount == 0 || componentCount == _componentCount);
    // Validación de tipo de dato
    if (_dataType == DataType::Void && _componentCount > 0) {
        throw std::runtime_error("ParticleProperty: No se puede crear una propiedad de datos con DATATYPE_VOID y componentCount > 0");
    }
}

// Ctor usuario (6 parámetros)
ParticleProperty::ParticleProperty(size_t              particleCount,
                                   DataType                 dataType,
                                   size_t              componentCount,
                                   size_t              stride,
                                   bool                initializeMemory)
    : PropertyBase(particleCount, dataType, componentCount, stride, initializeMemory)
    , _type(UserProperty)
{
}

// Copy ctor
ParticleProperty::ParticleProperty(const ParticleProperty& other)
    : PropertyBase(other)
    , _type(other._type)
{}

}} // namespace OpenDXA::Particles
