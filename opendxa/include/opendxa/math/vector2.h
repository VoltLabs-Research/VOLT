#pragma once
#include <opendxa/core/opendxa.h>

namespace OpenDXA{  
template<typename T>
class Vector_2 : public std::array<T, 2>{
public:
	struct Zero {};
	using typename std::array<T, 2>::size_type;
	using typename std::array<T, 2>::difference_type;
	using typename std::array<T, 2>::value_type;
	using typename std::array<T, 2>::iterator;
	using typename std::array<T, 2>::const_iterator;

	Vector_2() {}
	explicit Vector_2(T val) : std::array<T, 2>{{val,val}} {}
	Vector_2(T x, T y) : std::array<T, 2>{{x, y}} {}
	Vector_2(Zero) : std::array<T, 2>{{T(0), T(0)}} {}

	explicit Vector_2(const std::array<T, 2>& a) : std::array<T, 2>(a) {}
	template<typename U>
	explicit operator Vector_2<U>() const { return Vector_2<U>(static_cast<U>(x()), static_cast<U>(y())); }

	Vector_2 operator-() const { return Vector_2(-x(), -y()); }
	Vector_2& operator+=(const Vector_2& v) { x() += v.x(); y() += v.y(); return *this; }
	Vector_2& operator-=(const Vector_2& v) { x() -= v.x(); y() -= v.y(); return *this; }
	Vector_2& operator*=(T s) { x() *= s; y() *= s; return *this; }
	Vector_2& operator/=(T s) { x() /= s; y() /= s; return *this; }
	Vector_2& operator=(Zero) { setZero(); return *this; }

	void setZero() { this->fill(T(0)); }
	T x() const { return (*this)[0]; }
	T y() const { return (*this)[1]; }
	T& x() { return (*this)[0]; }
	T& y() { return (*this)[1]; }

	bool operator==(const Vector_2& v) const { return (v.x()==x()) && (v.y()==y()); }
	bool operator!=(const Vector_2& v) const { return (v.x()!=x()) || (v.y()!=y()); }
	bool operator==(Zero) const { return (x()==T(0)) && (y()==T(0)); }
	bool operator!=(Zero) const { return (x()!=T(0)) || (y()!=T(0)); }
	bool equals(const Vector_2& v, T tolerance = T(EPSILON)) const {
		return std::abs(v.x() - x()) <= tolerance && std::abs(v.y() - y()) <= tolerance;
	}

	bool isZero(T tolerance = T(EPSILON)) const {
		return std::abs(x()) <= tolerance && std::abs(y()) <= tolerance;
	}

	T dot(const Vector_2& b) const { return x()*b.x() + y()*b.y(); }
	T squaredLength() const { return x()*x() + y()*y(); }
	T length() const { return static_cast<T>(sqrt(squaredLength())); }

	inline void normalize() {
		*this /= length();
	}

	inline void resize(T len) {
		*this *= (len / length());
	}

	inline Vector_2 normalized() const {
		return *this / length();
	}

	inline void normalizeSafely(T epsilon = T(EPSILON)) {
		T l = length();
		if(l > epsilon)
			*this /= l;
	}

	inline Vector_2 resized(T len) const {
		return *this * (len / length());
	}

	inline size_type maxComponent() const {
	    return (x() >= y()) ? 0 : 1;
	}

	inline size_type minComponent() const {
	    return (x() <= y()) ? 0 : 1;
	}
};

template<typename T>
Vector_2<T> operator+(const Vector_2<T>& a, const Vector_2<T>& b) {
	return Vector_2<T>( a.x() + b.x(), a.y() + b.y() );
}

template<typename T>
Vector_2<T> operator-(const Vector_2<T>& a, const Vector_2<T>& b) {
	return Vector_2<T>( a.x() - b.x(), a.y() - b.y() );
}

template<typename T>
Vector_2<T> operator*(const Vector_2<T>& a, T s) {
	return Vector_2<T>( a.x() * s, a.y() * s );
}

template<typename T>
Vector_2<T> operator*(T s, const Vector_2<T>& a) {
	return Vector_2<T>( a.x() * s, a.y() * s );
}

template<typename T>
Vector_2<T> operator/(const Vector_2<T>& a, T s) {
	return Vector_2<T>( a.x() / s, a.y() / s );
}

template<typename T>
inline std::ostream& operator<<(std::ostream& os, const Vector_2<T>& v) {
	return os << "(" << v.x() << ", " << v.y() << ")";
}

using Vector2 = Vector_2<double>;
using Vector2I = Vector_2<int>;

}