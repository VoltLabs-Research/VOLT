#pragma once

#include <opendxa/core/opendxa.h>
#include "vector3.h"
#include "rotation.h"
#include "scaling.h"
#include "affine_transformation.h"

namespace OpenDXA{ 

class AffineDecomposition{
public:
	Vector3 translation;
	Quaternion rotation;
	Scaling scaling;
	double sign;	

	AffineDecomposition(const AffineTransformation& tm);
};

}