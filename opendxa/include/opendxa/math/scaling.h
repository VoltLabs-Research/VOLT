#pragma once

#include <opendxa/core/opendxa.h>
#include "vector3.h"
#include "quaternion.h"

namespace OpenDXA{ 

template<typename T>
class ScalingT{
public:
	struct Identity {};

public:
	Vector_3<T> S;
	QuaternionT<T> Q;

	ScalingT() {}

	ScalingT(const Vector_3<T>& scaling, const QuaternionT<T>& orientation) : S(scaling), Q(orientation) {}
	ScalingT(Identity) : S(T(1)), Q(typename QuaternionT<T>::Identity()) {}

	ScalingT inverse() const {
		return { Vector_3<T>(T(1) / S.x(), T(1) / S.y(), T(1) / S.z()), Q.inverse().normalized() };
	}

	ScalingT operator*(const ScalingT& s2) const {
		if(Q == s2.Q){
			return ScalingT(Vector_3<T>(S.x() * s2.S.x(), S.y() * s2.S.y(), S.z() * s2.S.z()), Q);
		}else{
			return ScalingT(Identity());
		}
	}

	ScalingT& operator+=(const ScalingT& s2) { *this = s2 * (*this); return *this; }
	ScalingT& operator-=(const ScalingT& s2) { *this = *this * s2.inverse(); return *this; }

	ScalingT& setIdentity() {
		S = Vector_3<T>(T(1));
		Q.setIdentity();
		return *this;
	}

	ScalingT& operator=(Identity) { return setIdentity(); }

	bool operator==(const ScalingT& s) const { return (s.S==S) && (s.Q==Q); }
	bool operator!=(const ScalingT& s) const { return (s.S!=S) || (s.Q!=Q); }
	bool operator==(Identity) const { return (S == Vector_3<T>(1)); }
	bool operator!=(Identity) const { return (S != Vector_3<T>(1)); }

    static ScalingT interpolate(const ScalingT& s1, const ScalingT& s2, T t) {
    	return ScalingT(t * s2.S + (1 - t) * s1.S, QuaternionT<T>::interpolate(s1.Q, s2.Q, t));
    }

	static ScalingT interpolateQuad(const ScalingT& s1, const ScalingT& s2, const ScalingT& out, const ScalingT& in, T t) {
    	T Ti = 1 - t;
    	T U2 = t*t, T2 = Ti*Ti;
    	T U3 = U2 * t, T3 = T2 * Ti;
    	Vector_3<T> s = s1.S * T3 + out.S * (3 * t * T2) + in.S * (3 * U2 * Ti) + s2.S * U3;
    	return ScalingT(s, QuaternionT<T>::interpolateQuad(s1.Q, s2.Q, in.Q, out.Q, t));
    }
};

template<typename T>
inline std::ostream& operator<<(std::ostream &os, const ScalingT<T>& s) {
	return os << '[' << s.S << "], " << s.Q;
}

using Scaling = ScalingT<double>;

}