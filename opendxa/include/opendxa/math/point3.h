#pragma once

#include <opendxa/core/opendxa.h>
#include "vector3.h"

namespace OpenDXA{ 
template<typename T>
class Point_3 : public std::array<T, 3>{
public:
	struct Origin {};

	using typename std::array<T, 3>::size_type;
	using typename std::array<T, 3>::difference_type;
	using typename std::array<T, 3>::value_type;
	using typename std::array<T, 3>::iterator;
	using typename std::array<T, 3>::const_iterator;

	Point_3() {}
	explicit Point_3(T val) : std::array<T, 3>{{val,val,val}} {}
	Point_3(T x, T y, T z) : std::array<T, 3>{{x, y, z}} {}
	Point_3(Origin) : std::array<T, 3>{{T(0), T(0), T(0)}} {}
	explicit Point_3(const std::array<T, 3>& a) : std::array<T, 3>(a) {}

	template<typename U>
	explicit operator Point_3<U>() const { return Point_3<U>(static_cast<U>(x()), static_cast<U>(y()), static_cast<U>(z())); }

	Point_3& operator+=(const Vector_3<T>& v) { x() += v.x(); y() += v.y(); z() += v.z(); return *this; }
	Point_3& operator-=(const Vector_3<T>& v) { x() -= v.x(); y() -= v.y(); z() -= v.z(); return *this; }
	Point_3& operator*=(T s) { x() *= s; y() *= s; z() *= s; return *this; }
	Point_3& operator/=(T s) { x() /= s; y() /= s; z() /= s; return *this; }
	Point_3& operator=(Origin) { z() = y() = x() = T(0); return *this; }

	const Vector_3<T>& operator-(Origin) const {
		return reinterpret_cast<const Vector_3<T>&>(*this);
	}

	 T x() const { return (*this)[0]; }
	 T y() const { return (*this)[1]; }
	 T z() const { return (*this)[2]; }
	T& x() { return (*this)[0]; }
	T& y() { return (*this)[1]; }
	T& z() { return (*this)[2]; }

	bool operator==(const Point_3& p) const { return (p.x()==x()) && (p.y()==y()) && (p.z()==z()); }
	bool operator!=(const Point_3& p) const { return (p.x()!=x()) || (p.y()!=y()) || (p.z()!=z()); }
	bool operator==(Origin) const { return (x()==T(0)) && (y()==T(0)) && (z()==T(0)); }
	bool operator!=(Origin) const { return (x()!=T(0)) || (y()!=T(0)) || (z()!=T(0)); }

	bool equals(const Point_3& p, T tolerance = T(EPSILON)) const {
		return std::abs(p.x() - x()) <= tolerance && std::abs(p.y() - y()) <= tolerance && std::abs(p.z() - z()) <= tolerance;
	}

	bool isOrigin(T tolerance = T(EPSILON)) const {
		return std::abs(x()) <= tolerance && std::abs(y()) <= tolerance && std::abs(z()) <= tolerance;
	}

	inline size_type maxComponent() const {
	    return ((x() >= y()) ? ((x() >= z()) ? 0 : 2) : ((y() >= z()) ? 1 : 2));
	}

	inline size_type minComponent() const {
	    return ((x() <= y()) ? ((x() <= z()) ? 0 : 2) : ((y() <= z()) ? 1 : 2));
	}
};

template<typename T>
Point_3<T> operator+(const Point_3<T>& a, const Vector_3<T>& b) {
	return Point_3<T>( a.x() + b.x(), a.y() + b.y(), a.z() + b.z() );
}

template<typename T>
const Point_3<T>& operator+(typename Point_3<T>::Origin, const Vector_3<T>& b) {
	return reinterpret_cast<const Point_3<T>&>(b);
}

template<typename T>
Point_3<T> operator+(const Vector_3<T>& a, const Point_3<T>& b) {
	return b + a;
}

template<typename T>
Point_3<T> operator-(const Point_3<T>& a, const Vector_3<T>& b) {
	return Point_3<T>( a.x() - b.x(), a.y() - b.y(), a.z() - b.z() );
}

template<typename T>
Vector_3<T> operator-(const Point_3<T>& a, const Point_3<T>& b) {
	return Vector_3<T>( a.x() - b.x(), a.y() - b.y(), a.z() - b.z() );
}

template<typename T>
Point_3<T> operator*(const Point_3<T>& a, T s) {
	return Point_3<T>( a.x() * s, a.y() * s, a.z() * s );
}

template<typename T>
Point_3<T> operator*(T s, const Point_3<T>& a) {
	return Point_3<T>( a.x() * s, a.y() * s, a.z() * s );
}

template<typename T>
Point_3<T> operator/(const Point_3<T>& a, T s) {
	return Point_3<T>( a.x() / s, a.y() / s, a.z() / s );
}

template<typename T>
inline std::ostream& operator<<(std::ostream& os, const Point_3<T>& v) {
	return os << "(" << v.x() << ", " << v.y()  << ", " << v.z() << ")";
}

using Point3 = Point_3<double>;

using Point3I = Point_3<int>;

}