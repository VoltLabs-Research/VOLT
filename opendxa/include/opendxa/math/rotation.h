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
			//assert(std::abs(_axis.squaredLength() - T(1)) <= T(EPSILON));
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

	void addRevolutions(int n) { _angle += T(2*PI) * n; }
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

using Rotation = RotationT<double>;

}