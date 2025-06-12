#ifndef __DXA_LINALG_SCALING_H
#define __DXA_LINALG_SCALING_H

#include <opendxa/utils/linalg/lin_alg.hpp>
#include <opendxa/utils/linalg/vector3.hpp>
#include <opendxa/utils/linalg/quaternion.hpp>

class IdentityScaling {};
extern IdentityScaling IDENTITY_SCALING;

class Scaling{
public:
	Vector3 S;
	Quaternion Q;

	Scaling() {}
	Scaling(const Vector3& scaling, const Quaternion& orientation) : S(scaling), Q(orientation) {}

	Scaling(const IdentityScaling&) : S(1,1,1), Q(IDENTITY_QUAT) {}

	Scaling inverse() const{
		DISLOCATIONS_ASSERT_MSG(S.X != 0 && S.Y != 0 && S.Z, "Scaling::inverse()", "Cannot invert a singular scaling value.");
		return Scaling(Vector3(1.0 / S.X, 1.0 / S.Y, 1.0 / S.Z), Normalize(Q.inverse()));
	}

	bool operator==(const Scaling& s) const { return (s.S==S) && (s.Q==Q); }
	bool operator!=(const Scaling& s) const { return (s.S!=S) || (s.Q!=Q); }
	bool operator==(const IdentityScaling&) const { return (S == Vector3(1,1,1)); }
	bool operator!=(const IdentityScaling&) const { return (S != Vector3(1,1,1)); }
};

inline std::ostream& operator<<(std::ostream &os, const Scaling& s){
	return os << '[' << s.S << "], " << s.Q;
}

#endif
