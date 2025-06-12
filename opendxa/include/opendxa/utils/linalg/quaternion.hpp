#ifndef __DXA_LINALG_QUATERNION_H
#define __DXA_LINALG_QUATERNION_H

#include <opendxa/utils/linalg/lin_alg.hpp>

class IdentityQuaternion {};
extern IdentityQuaternion IDENTITY_QUAT;

class Quaternion{
public:
	FloatType X, Y, Z, W;

	Quaternion() {}
	Quaternion(FloatType _x, FloatType _y, FloatType _z, FloatType _w) : X(_x), Y(_y), Z(_z), W(_w) {}
	Quaternion(IdentityQuaternion) : X(0), Y(0), Z(0), W(1) {}

    explicit Quaternion(const Matrix3& tm) {
		DISLOCATIONS_ASSERT_MSG(tm.isRotationMatrix(), "Quaternion constructor" , "Quaternion::Quaternion(const Matrix3& tm) accepts only pure rotation matrices.");
		FloatType trace = tm(0,0) + tm(1,1) + tm(2,2);
		FloatType root;

		if(trace > 0.0){
			root = sqrt(trace + 1.0);
			W = 0.5 * root;
			root = 0.5 / root;
			X = (tm(2,1) - tm(1,2)) * root;
			Y = (tm(0,2) - tm(2,0)) * root;
			Z = (tm(1,0) - tm(0,1)) * root;
		}else{
			const int next[] = { 1, 2, 0 };
			int i = 0;
			if(tm(1,1) > tm(0,0)) i = 1;
			if(tm(2,2) > tm(i,i)) i = 2;
			int j = next[i];
			int k = next[j];
			root = sqrt(tm(i,i) - tm(j,j) - tm(k,k) + 1.0);
			(*this)[i] = 0.5 * root;
			root = 0.5 / root;
			W = (tm(k,j) - tm(j,k)) * root;
			(*this)[j] = (tm(j,i) + tm(i,j)) * root;
			(*this)[k] = (tm(k,i) + tm(i,k)) * root;
		}

		DISLOCATIONS_ASSERT(fabs(X*X+Y*Y+Z*Z+W*W-1.0) <= FLOATTYPE_EPSILON);
	}

	FloatType& operator[](size_t i) {
		DISLOCATIONS_ASSERT_GLOBAL(sizeof(Quaternion) == sizeof(FloatType) * 4);
		DISLOCATIONS_ASSERT_GLOBAL(i<4);
		return (&X)[i];
	}

	const FloatType& operator[](size_t i) const {
		DISLOCATIONS_ASSERT_GLOBAL(sizeof(Quaternion) == sizeof(FloatType) * 4);
		DISLOCATIONS_ASSERT_GLOBAL(i<4);
		return (&X)[i];
	}

	Quaternion operator-() const { return Quaternion(-X, -Y, -Z, -W); }
	Quaternion inverse() const { return Quaternion(-X, -Y, -Z, W); }

	bool operator==(const Quaternion& q) const { return (q.X == X && q.Y == Y && q.Z == Z && q.W == W); }
	bool operator!=(const Quaternion& q) const { return !(q == *this); }
	bool operator==(const IdentityQuaternion&) const { return (X == 0 && Y == 0 && Z == 0 && W == 1); }
	bool operator!=(const IdentityQuaternion&) const { return (X != 0 || Y != 0 || Z != 0 || W != 1); }
	bool equals(const Quaternion& q, FloatType tolerance) const {
		DISLOCATIONS_ASSERT_GLOBAL(tolerance >= 0);
		return fabs(q.X - X) <= tolerance && fabs(q.Y - Y) <= tolerance && fabs(q.Z - Z) <= tolerance && fabs(q.W - W) <= tolerance;
	}
};

inline FloatType DotProduct(const Quaternion& a, const Quaternion& b) {
	return a.X*b.X + a.Y*b.Y + a.Z*b.Z + a.W*b.W;
}

inline Quaternion operator*(const Quaternion& a, const Quaternion& b){
	return Quaternion(
		a.W*b.X + a.X*b.W + a.Y*b.Z - a.Z*b.Y,
		a.W*b.Y + a.Y*b.W + a.Z*b.X - a.X*b.Z,
		a.W*b.Z + a.Z*b.W + a.X*b.Y - a.Y*b.X,
		a.W*b.W - a.X*b.X - a.Y*b.Y - a.Z*b.Z);
}

inline Vector3 operator*(const Quaternion& q, const Vector3& v){
	DISLOCATIONS_ASSERT_MSG_GLOBAL(fabs(DotProduct(q,q) - 1.0) <= FLOATTYPE_EPSILON, "Vector rotation", "Quaternion must be normalized.");
	return Matrix3(1.0 - 2.0*(q.Y*q.Y + q.Z*q.Z),       2.0*(q.X*q.Y - q.W*q.Z),       2.0*(q.X*q.Z + q.W*q.Y),
			         2.0*(q.X*q.Y + q.W*q.Z), 1.0 - 2.0*(q.X*q.X + q.Z*q.Z),       2.0*(q.Y*q.Z - q.W*q.X),
		             2.0*(q.X*q.Z - q.W*q.Y),       2.0*(q.Y*q.Z + q.W*q.X), 1.0 - 2.0*(q.X*q.X + q.Y*q.Y)) * v;
}

inline Quaternion Normalize(const Quaternion& q) {
	DISLOCATIONS_ASSERT_MSG_GLOBAL(DotProduct(q,q) > 0, "Normalize(const Quaternion&)", "Cannot normalize the null quaternion.");
	FloatType c = 1.0 / sqrt(DotProduct(q,q));
	return Quaternion(q.X * c, q.Y * c, q.Z * c, q.W * c);
}

inline std::ostream& operator<<(std::ostream &os, const Quaternion& q) {
	return os << '[' << q.X << ' ' << q.Y << ' ' << q.Z << ' ' << q.W << ']';
}

#endif