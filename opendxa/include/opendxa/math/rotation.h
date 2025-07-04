#pragma once
#include <opendxa/core/opendxa.h>
#include "vector3.h"
#include "quaternion.h"
#include "matrix3.h"

namespace OpenDXA{ 
template<typename T>
class RotationT{
private:
	Vector_3<T> _axis;
	T _angle;

public:
	struct Identity {};
	RotationT() {}
	RotationT(const Vector_3<T>& axis, T angle, bool normalize = true) : _axis(normalize ? axis.normalized() : axis), _angle(angle) {}
	RotationT(Identity) : _axis{T(0),T(0),T(1)}, _angle(T(0)) {}

	explicit RotationT(const AffineTransformationT<T>& tm){
    	_axis.x() = tm(2,1) - tm(1,2);
    	_axis.y() = tm(0,2) - tm(2,0);
    	_axis.z() = tm(1,0) - tm(0,1);
    	if(_axis == typename Vector_3<T>::Zero()){
    		_angle = T(0);
    		_axis = Vector_3<T>(0, 0, 1);
    	}else{
    		T trace = tm(0,0) + tm(1,1) + tm(2,2) - T(1);
    		T s = _axis.length();
    		_axis /= s;
    		_angle = atan2(s, trace);
    	}
    }

	explicit RotationT(const QuaternionT<T>& q){
		T scaleSquared = q.x()*q.x() + q.y()*q.y() + q.z()*q.z();
		if(scaleSquared <= T(EPSILON)){
			_angle = T(0);
			_axis = Vector_3<T>(0, 0, 1);
		}else{
			if(q.w() < T(-1))
				_angle = T(PI) * T(2);
			else if(q.w() > T(1))
				_angle = T(0);
			else
				_angle = acos(q.w()) * T(2);
			_axis = Vector_3<T>(q.x(), q.y(), q.z()) / (T)sqrt(scaleSquared);
			assert(std::abs(_axis.squaredLength() - T(1)) <= T(EPSILON));
		}
	}

	RotationT(const Vector_3<T>& a, const Vector_3<T>& b) {
		Vector_3<T> an = a.normalized();
		Vector_3<T> bn = b.normalized();
		T cos = an.dot(bn);
		if(cos > T(1) - T(EPSILON)) {
			_angle = 0;
			_axis = Vector_3<T>(0,0,1);
		}
		else if(cos < T(-1) + T(EPSILON)) {
			_angle = T(PI);
			_axis = Vector_3<T>(0,0,1);
		}
		else {
			_angle = acos(cos);
			_axis = a.cross(b).normalized();
		}
	}

	const Vector_3<T>& axis() const { return _axis; }
	T angle() const { return _angle; }
	void setAxis(const Vector_3<T>& axis) { _axis = axis; }
	void setAngle(T angle) { _angle = angle; }

	RotationT inverse() const  { return RotationT(_axis, -_angle, false); }

	explicit operator QuaternionT<T>() const {
		T omega = _angle * T(0.5);
		T s = sin(omega);
		return QuaternionT<T>(_axis.x() * s, _axis.y() * s, _axis.z() * s, cos(omega)).normalized();
	}

	RotationT& operator+=(const RotationT& r2) { *this = r2 * (*this); return *this; }
	RotationT& operator-=(const RotationT& r2) { *this = (*this) * r2.inverse(); return *this; }

	void setIdentity() {
		_axis = Vector_3<T>(T(0),T(0),T(1));
		_angle = T(0);
	}

	RotationT& operator=(Identity) {
		setIdentity();
		return *this;
	}

	bool operator==(const RotationT& r) const { return ((r._axis==_axis) && (r._angle==_angle)) || ((r._axis==-_axis) && (r._angle==-_angle)); }
	bool operator!=(const RotationT& r) const { return !(*this == r); }
	bool operator==(Identity) const { return (_angle == T(0)); }

	bool operator!=(Identity) const { return (_angle != T(0)); }
	bool equals(const RotationT& r, T tolerance = T(EPSILON)) const {
		return (std::abs(angle() - r.angle()) <= tolerance && axis().equals( r.axis(), tolerance)) ||
			   (std::abs(angle() + r.angle()) <= tolerance && axis().equals(-r.axis(), tolerance));
	}

    static RotationT interpolate(const RotationT& rot1, const RotationT& rot2, T t){
    	assert(t >= 0 && t <= 1);

    	RotationT _rot2;
    	if(rot1.axis().dot(rot2.axis()) < T(0))
    		_rot2 = RotationT(-rot2.axis(), -rot2.angle(), false);
    	else
    		_rot2 = rot2;

		if(rot1.axis().equals(_rot2.axis())) {
			return RotationT((T(1) - t) * rot1.axis() + t * _rot2.axis(), (T(1) - t) * rot1.angle() + t * _rot2.angle());
		}
		else if(rot1.angle() != T(0)) {
			T fDiff = _rot2.angle() - rot1.angle();
			T fDiffUnit = fDiff/T(2*PI);
			int extraSpins = (int)floor(fDiffUnit + T(0.5));
			if(extraSpins * fDiffUnit * (fDiffUnit - extraSpins) < 0)
				extraSpins = -extraSpins;

	    	QuaternionT<T> q1 = (QuaternionT<T>)rot1;
	    	QuaternionT<T> q2 = (QuaternionT<T>)_rot2;

	    	if(q1.dot(q2) < T(0))
	    		q2 = -q2;

	    	if(q1.w() < T(-1)) q1.w() = T(-1); else if(q1.w() > T(1)) q1.w() = T(1);
	    	if(q2.w() < T(-1)) q2.w() = T(-1); else if(q2.w() > T(1)) q2.w() = T(1);

			RotationT result = RotationT(slerpExtraSpins(t, q1, q2, extraSpins));
			if(result.axis().dot(interpolateAxis(t, rot1.axis(), _rot2.axis())) < T(0))
				result = RotationT(-result.axis(), -result.angle(), false);
			int nrev = floor((t * _rot2.angle() + (T(1) - t) * rot1.angle() - result.angle())/T(2*PI) + T(0.5));
			result.addRevolutions(nrev);
			return result;
		}
		else {
			return RotationT(interpolateAxis(t, rot1.axis(), _rot2.axis()), (T(1) - t) * rot1.angle() + t * _rot2.angle());
		}
    }

    static RotationT interpolateQuad(const RotationT& rot1, const RotationT& rot2, const RotationT& out, const RotationT& in, T t) {
    	RotationT slerpP = interpolate(rot1, rot2, t);
    	RotationT slerpQ = interpolate(out, in, t);
    	T Ti = T(2) * t * (T(1) - t);
    	return interpolate(slerpP, slerpQ, Ti);
    }

	static RotationT fromEuler(const Vector_3<T>& eulerAngles, typename Matrix_3<T>::EulerAxisSequence axisSequence = Matrix_3<T>::szyx) {
		assert(axisSequence == Matrix_3<T>::szyx);	// TODO: Other orders not implemented yet!
		return RotationT(Vector3(1,0,0), eulerAngles[2]) * RotationT(Vector3(0,1,0), eulerAngles[1]) * RotationT(Vector3(0,0,1), eulerAngles[0]);
	}

	Vector_3<T> toEuler(typename Matrix_3<T>::EulerAxisSequence axisSequence) const {
		if(*this == Identity()) return typename Vector_3<T>::Zero();
		Vector_3<T> euler = Matrix_3<T>::rotation(*this).toEuler(axisSequence);

		// Handles rotations with multiple revolutions.
		// Since the Euler-angle decomposition routine cannot handle this case directly,
		// we have to determine the correct revolution number for each Euler axis in a trial-and-error
		// fashion. To this end, we test all possible combinations of revolutions until
		// we find the one that yields the original axis-angle rotation. Multiple equivalent decompositions
		// are ranked, because we prefer Euler decompositions that rotate about a single axis.
		int maxRevolutions = (int)std::floor(std::abs(angle()) / T(PI*2) + T(0.5 + EPSILON));
		if(maxRevolutions == 0) return euler;
		Vector_3<T> bestDecomposition = euler;
		int bestDecompositionRanking = -1;
		for(int xr = -maxRevolutions; xr <= maxRevolutions; xr++) {
			Vector_3<T> euler2;
			euler2.x() = euler.x() + T(PI*2) * xr;
			int maxRevolutionsY = maxRevolutions - std::abs(xr);
			for(int yr = -maxRevolutionsY; yr <= maxRevolutionsY; yr++) {
				euler2.y() = euler.y() + T(PI*2) * yr;
				int maxRevolutionsZ = maxRevolutionsY - std::abs(yr);
				for(int zr = -maxRevolutionsZ; zr <= maxRevolutionsZ; zr++) {
					euler2.z() = euler.z() + T(PI*2) * zr;
					if(equals(fromEuler(euler2, axisSequence))) {
						int ranking = int(std::abs(euler2.x()) <= T(EPSILON)) + int(std::abs(euler2.y()) <= T(EPSILON)) + int(std::abs(euler2.z()) <= T(EPSILON));
						if(ranking > bestDecompositionRanking) {
							bestDecomposition = euler2;
							bestDecompositionRanking = ranking;
						}
					}
				}
			}
		}
		return bestDecomposition;
	}

	int revolutions() const { return (int)(_angle/T(PI*2)); }
	void setRevolutions(int n) { _angle = std::fmod(_angle, T(2*PI)) + (T(2*PI)*n); }
	void addRevolutions(int n) { _angle += T(2*PI) * n; }

private:
	static inline Vector_3<T> interpolateAxis(T time, const Vector_3<T>& axis0, const Vector_3<T>& axis1) {
		T cos = axis0.dot(axis1); 
		assert(cos >= T(0));
		if(cos > T(1)) cos = T(1); 

		T angle = acos(cos);
		T invSin = T(1) / sin(angle);
		T timeAngle = time * angle;
		T coeff0 = sin(angle - timeAngle) * invSin;
		T coeff1 = sin(timeAngle) * invSin;

		return (coeff0 * axis0 + coeff1 * axis1);
	}

	static inline QuaternionT<T> slerpExtraSpins(T t, const QuaternionT<T>& p, const QuaternionT<T>& q, int iExtraSpins) {
		T fCos = p.dot(q);
		assert(fCos >= T(0));

		// Numerical round-off error could create problems in call to acos.
		if(fCos < T(-1)) fCos = T(-1);
		else if(fCos > T(1)) fCos = T(1);

		T fAngle = acos(fCos);
		// fSin >= 0 since fCos >= 0
		T fSin = sin(fAngle);

		if(fSin < T(1e-3)) {
			return p;
		}
		else {
			T fPhase = T(PI) * (T)iExtraSpins * t;
			T fInvSin = T(1) / fSin;
			T fCoeff0 = sin((T(1) - t) * fAngle - fPhase) * fInvSin;
			T fCoeff1 = sin(t * fAngle + fPhase) * fInvSin;
			return QuaternionT<T>(fCoeff0*p.x() + fCoeff1*q.x(), fCoeff0*p.y() + fCoeff1*q.y(),
			                        fCoeff0*p.z() + fCoeff1*q.z(), fCoeff0*p.w() + fCoeff1*q.w());
		}
	}
};

template<typename T>
inline RotationT<T> operator*(const RotationT<T>& r1, const RotationT<T>& r2) {
	if(r1 == typename RotationT<T>::Identity()) return r2;
	if(r2 == typename RotationT<T>::Identity()) return r1;
	QuaternionT<T> q1 = (QuaternionT<T>)r1;
	QuaternionT<T> q2 = (QuaternionT<T>)r2;
	QuaternionT<T> q = q1 * q2;
	RotationT<T> result(q);
	int rev;
	if(r1.axis().dot(r2.axis()) >= T(0))
		rev = (int)floor(((r1.angle()+r2.angle()) / T(PI*2)));
	else
		rev = (int)floor(((r1.angle()-r2.angle()) / T(PI*2)));
	if((rev & 1) != 0) {
		result.setAngle(-result.angle());
		rev++;
		result.setAxis(-result.axis());
	}
	result.addRevolutions(rev);
	return result;
}

template<typename T>
inline std::ostream& operator<<(std::ostream &os, const RotationT<T>& r) {
	return os << '[' << r.axis().x() << ' ' << r.axis().y()  << ' ' << r.axis().z() << "], " << r.angle();
}

using Rotation = RotationT<double>;

}