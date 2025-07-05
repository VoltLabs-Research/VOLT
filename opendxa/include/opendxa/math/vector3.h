#pragma once
#include <opendxa/core/opendxa.h>

namespace OpenDXA{ 
template<typename T>
class Vector_3 : public std::array<T, 3>{
public:
	struct Zero {};

	using typename std::array<T, 3>::size_type;
	using typename std::array<T, 3>::difference_type;
	using typename std::array<T, 3>::value_type;
	using typename std::array<T, 3>::iterator;
	using typename std::array<T, 3>::const_iterator;

	Vector_3() {}
	explicit Vector_3(T val) : std::array<T, 3>{{val,val,val}} {}
	Vector_3(T x, T y, T z) : std::array<T, 3>{{x, y, z}} {}
	Vector_3(Zero) : std::array<T, 3>{{T(0), T(0), T(0)}} {}

	explicit Vector_3(const std::array<T, 3>& a) : std::array<T, 3>(a) {}

	template<typename U>
	explicit operator Vector_3<U>() const { return Vector_3<U>(static_cast<U>(x()), static_cast<U>(y()), static_cast<U>(z())); }

	Vector_3 operator-() const { return Vector_3(-x(), -y(), -z()); }
	Vector_3& operator+=(const Vector_3& v) { x() += v.x(); y() += v.y(); z() += v.z(); return *this; }
	Vector_3& operator-=(const Vector_3& v) { x() -= v.x(); y() -= v.y(); z() -= v.z(); return *this; }
	Vector_3& operator*=(T s) { x() *= s; y() *= s; z() *= s; return *this; }
	Vector_3& operator/=(T s) { x() /= s; y() /= s; z() /= s; return *this; }
	Vector_3& operator=(Zero) { setZero(); return *this; }

	void setZero() { this->fill(T(0)); }

	T x() const { return (*this)[0]; }
	T y() const { return (*this)[1]; }
	T z() const { return (*this)[2]; }
	T& x() { return (*this)[0]; }
	T& y() { return (*this)[1]; }
	T& z() { return (*this)[2]; }

	bool operator==(const Vector_3& v) const { return (v.x()==x()) && (v.y()==y()) && (v.z()==z()); }
	bool operator!=(const Vector_3& v) const { return (v.x()!=x()) || (v.y()!=y()) || (v.z()!=z()); }
	bool operator==(Zero) const { return (x()==T(0)) && (y()==T(0)) && (z()==T(0)); }
	bool operator!=(Zero) const { return (x()!=T(0)) || (y()!=T(0)) || (z()!=T(0)); }

	bool equals(const Vector_3& v, T tolerance = T(EPSILON)) const {
		return std::abs(v.x() - x()) <= tolerance && std::abs(v.y() - y()) <= tolerance && std::abs(v.z() - z()) <= tolerance;
	}

	bool isZero(T tolerance = T(EPSILON)) const {
		return std::abs(x()) <= tolerance && std::abs(y()) <= tolerance && std::abs(z()) <= tolerance;
	}

	T dot(const Vector_3& b) const { return x()*b.x() + y()*b.y() + z()*b.z(); }

	Vector_3 cross(const Vector_3& b) const {
		return Vector_3(y() * b.z() - z() * b.y(),
						z() * b.x() - x() * b.z(),
						x() * b.y() - y() * b.x());
	}

	T squaredLength() const { return x()*x() + y()*y() + z()*z(); }
	T length() const { return static_cast<T>(sqrt(squaredLength())); }

	inline void normalize() {
		*this /= length();
	}

	inline Vector_3 normalized() const {
		return *this / length();
	}

	inline void resize(T len) {
		*this *= (len / length());
	}

	inline Vector_3 resized(T len) const {
		return *this * (len / length());
	}
};

template<typename T>
Vector_3<T> operator+(const Vector_3<T>& a, const Vector_3<T>& b) {
	return Vector_3<T>( a.x() + b.x(), a.y() + b.y(), a.z() + b.z() );
}

template<typename T>
Vector_3<T> operator-(const Vector_3<T>& a, const Vector_3<T>& b) {
	return Vector_3<T>( a.x() - b.x(), a.y() - b.y(), a.z() - b.z() );
}

template<typename T>
Vector_3<T> operator*(const Vector_3<T>& a, float s) {
	return Vector_3<T>( a.x() * (T)s, a.y() * (T)s, a.z() * (T)s );
}

template<typename T>
Vector_3<T> operator*(const Vector_3<T>& a, double s) {
	return Vector_3<T>( a.x() * (T)s, a.y() * (T)s, a.z() * (T)s );
}

template<typename T>
Vector_3<T> operator*(const Vector_3<T>& a, int s) {
	return Vector_3<T>( a.x() * s, a.y() * s, a.z() * s );
}

template<typename T>
Vector_3<T> operator*(float s, const Vector_3<T>& a) {
	return Vector_3<T>( a.x() * (T)s, a.y() * (T)s, a.z() * (T)s );
}

template<typename T>
Vector_3<T> operator*(double s, const Vector_3<T>& a) {
	return Vector_3<T>( a.x() * (T)s, a.y() * (T)s, a.z() * (T)s );
}

template<typename T>
Vector_3<T> operator*(int s, const Vector_3<T>& a) {
	return Vector_3<T>( a.x() * s, a.y() * s, a.z() * s );
}

template<typename T, typename S>
Vector_3<T> operator/(const Vector_3<T>& a, S s) {
	return Vector_3<T>( a.x() / s, a.y() / s, a.z() / s );
}

using Vector3 = Vector_3<double>;
using Vector3I = Vector_3<int>;

}