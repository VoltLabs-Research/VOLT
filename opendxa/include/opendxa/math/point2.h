#pragma once

#include <opendxa/core/opendxa.h>
#include "vector3.h"

namespace OpenDXA{
template<typename T>
class Point_2 : public std::array<T, 2>{
public:
	struct Origin {};

	using typename std::array<T, 2>::size_type;
	using typename std::array<T, 2>::difference_type;
	using typename std::array<T, 2>::value_type;
	using typename std::array<T, 2>::iterator;
	using typename std::array<T, 2>::const_iterator;

	Point_2() : std::array<T, 2>{} {}
	explicit Point_2(T val) : std::array<T, 2>{{val,val}} {}
	Point_2(T x, T y) : std::array<T, 2>{{x, y}} {}
	Point_2(Origin) : std::array<T, 2>{{T(0), T(0)}} {}

	explicit Point_2(const std::array<T, 2>& a) : std::array<T, 2>(a) {}
	template<typename U>
	explicit operator Point_2<U>() const { return Point_2<U>(static_cast<U>(x()), static_cast<U>(y())); }

	Point_2& operator+=(const Vector_2<T>& v) { x() += v.x(); y() += v.y(); return *this; }
	Point_2& operator-=(const Vector_2<T>& v) { x() -= v.x(); y() -= v.y(); return *this; }
	Point_2& operator*=(T s) { x() *= s; y() *= s; return *this; }
	Point_2& operator/=(T s) { x() /= s; y() /= s; return *this; }
	Point_2& operator=(Origin) { this->fill(T(0)); return *this; }
	Vector_2<T> operator-(Origin) const {
		return Vector_2<T>(*this);
	}

	T x() const { return (*this)[0]; }
	T y() const { return (*this)[1]; }
	T& x() { return (*this)[0]; }
	T& y() { return (*this)[1]; }

	bool operator==(const Point_2& p) const { return (p.x()==x()) && (p.y()==y()); }
	bool operator!=(const Point_2& p) const { return (p.x()!=x()) || (p.y()!=y()); }
	bool operator==(Origin) const { return (x()==T(0)) && (y()==T(0)); }
	bool operator!=(Origin) const { return (x()!=T(0)) || (y()!=T(0)); }
	bool equals(const Point_2& p, T tolerance = T(EPSILON)) const {
		return std::abs(p.x() - x()) <= tolerance && std::abs(p.y() - y()) <= tolerance;
	}

	bool isOrigin(T tolerance = T(EPSILON)) const {
		return std::abs(x()) <= tolerance && std::abs(y()) <= tolerance;
	}

	inline std::size_t maxComponent() const {
	    return (x() >= y()) ? 0 : 1;
	}

	inline std::size_t minComponent() const {
	    return (x() <= y()) ? 0 : 1;
	}
};

template<typename T>
Point_2<T> operator+(const Point_2<T>& a, const Vector_2<T>& b) {
	return Point_2<T>( a.x() + b.x(), a.y() + b.y() );
}

template<typename T>
Point_2<T> operator+(const Vector_2<T>& a, const Point_2<T>& b) {
	return b + a;
}

template<typename T>
Vector_2<T> operator-(const Point_2<T>& a, const Point_2<T>& b) {
	return Vector_2<T>( a.x() - b.x(), a.y() - b.y() );
}

template<typename T>
Point_2<T> operator-(const Point_2<T>& a, const Vector_2<T>& b) {
	return Point_2<T>( a.x() - b.x(), a.y() - b.y() );
}

template<typename T>
Point_2<T> operator*(const Point_2<T>& a, T s) {
	return Point_2<T>( a.x() * s, a.y() * s );
}

template<typename T>
Point_2<T> operator*(T s, const Point_2<T>& a) {
	return Point_2<T>( a.x() * s, a.y() * s );
}

template<typename T>
Point_2<T> operator/(const Point_2<T>& a, T s) {
	return Point_2<T>( a.x() / s, a.y() / s );
}

template<typename T>
inline std::ostream& operator<<(std::ostream& os, const Point_2<T>& v) {
	return os << "(" << v.x() << ", " << v.y() << ")";
}

using Point2 = Point_2<double>;

using Point2I = Point_2<int>;

}