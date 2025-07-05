#pragma once

#include <opendxa/core/opendxa.h>
#include "vector3.h"

namespace OpenDXA{ 

template<typename T>
class Vector_4 : public std::array<T, 4>{
public:
	struct Zero {};

	using typename std::array<T, 4>::size_type;
	using typename std::array<T, 4>::difference_type;
	using typename std::array<T, 4>::value_type;
	using typename std::array<T, 4>::iterator;
	using typename std::array<T, 4>::const_iterator;

	Vector_4() {}

	explicit Vector_4(T val) : std::array<T, 4>{{val,val,val,val}} {}
	Vector_4(T x, T y, T z, T w) : std::array<T, 4>{{x, y, z, w}} {}
	Vector_4(Zero) : std::array<T, 4>{{T(0), T(0), T(0), T(0)}} {}

	explicit Vector_4(const std::array<T, 4>& a) : std::array<T, 4>(a) {}
	explicit Vector_4(const Vector_3<T>& v, T w) : std::array<T, 4>{{v.x(), v.y(), v.z(), w}} {}

	Vector_4 operator-() const { return Vector_4{-x(), -y(), -z(), -w()}; }

	Vector_4& operator+=(const Vector_4& v) { x() += v.x(); y() += v.y(); z() += v.z(); w() += v.w(); return *this; }
	Vector_4& operator-=(const Vector_4& v) { x() -= v.x(); y() -= v.y(); z() -= v.z(); w() -= v.w(); return *this; }
	Vector_4& operator*=(T s) { x() *= s; y() *= s; z() *= s; w() *= s; return *this; }
	Vector_4& operator/=(T s) { x() /= s; y() /= s; z() /= s; w() /= s; return *this; }
	Vector_4& operator=(Zero) { setZero(); return *this; }
	void setZero() { this->fill(T(0)); }

	T x() const { return (*this)[0]; }
	T y() const { return (*this)[1]; }
	T z() const { return (*this)[2]; }
	T w() const { return (*this)[3]; }
	T& x() { return (*this)[0]; }
	T& y() { return (*this)[1]; }
	T& z() { return (*this)[2]; }
	T& w() { return (*this)[3]; }

	bool operator==(const Vector_4& v) const { return (v.x()==x()) && (v.y()==y()) && (v.z()==z()) && (v.w()==w()); }
	bool operator!=(const Vector_4& v) const { return (v.x()!=x()) || (v.y()!=y()) || (v.z()!=z()) || (v.w()!=w()); }
	bool operator==(Zero) const { return (x()==T(0)) && (y()==T(0)) && (z()==T(0)) && (w()==T(0)); }
	bool operator!=(Zero) const { return (x()!=T(0)) || (y()!=T(0)) || (z()!=T(0)) || (w()!=T(0)); }

	bool equals(const Vector_4& v, T tolerance = T(EPSILON)) const{
		return std::abs(v.x() - x()) <= tolerance && std::abs(v.y() - y()) <= tolerance && std::abs(v.z() - z()) <= tolerance && std::abs(v.w() - w()) <= tolerance;
	}

	bool isZero(T tolerance = T(EPSILON)) const{
		return std::abs(x()) <= tolerance && std::abs(y()) <= tolerance && std::abs(z()) <= tolerance && std::abs(w()) <= tolerance;
	}

	T dot(const Vector_4& b) const { return x()*b.x() + y()*b.y() + z()*b.z() + w()*b.w(); }
	T squaredLength() const { return x()*x() + y()*y() + z()*z() + w()*w(); }
	T length() const { return static_cast<T>(sqrt(squaredLength())); }

	inline void normalize(){
		*this /= length();
	}

	inline Vector_4 normalized() const{
		return *this / length();
	}
};

template<typename T>
Vector_4<T> operator+(const Vector_4<T>& a, const Vector_4<T>& b){
	return Vector_4<T>( a.x() + b.x(), a.y() + b.y(), a.z() + b.z(), a.w() + b.w() );
}

template<typename T>
Vector_4<T> operator-(const Vector_4<T>& a, const Vector_4<T>& b) {
	return Vector_4<T>( a.x() - b.x(), a.y() - b.y(), a.z() - b.z(), a.w() - b.w() );
}

template<typename T>
Vector_4<T> operator*(const Vector_4<T>& a, T s) {
	return Vector_4<T>( a.x() * s, a.y() * s, a.z() * s, a.w() * s );
}

template<typename T>
Vector_4<T> operator*(T s, const Vector_4<T>& a) {
	return Vector_4<T>( a.x() * s, a.y() * s, a.z() * s, a.w() * s );
}

template<typename T>
Vector_4<T> operator/(const Vector_4<T>& a, T s) {
	return Vector_4<T>( a.x() / s, a.y() / s, a.z() / s, a.w() / s );
}

using Vector4 = Vector_4<double>;
using Vector4I = Vector_4<int>;

}