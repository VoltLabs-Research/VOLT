#pragma once

#include <opendxa/core/opendxa.h>
#include "vector3.h"
#include <array>
#include <type_traits>
#include <ostream>

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

	constexpr Point_3() noexcept : std::array<T, 3>{} {}
	explicit constexpr Point_3(T val) noexcept : std::array<T, 3>{{val,val,val}} {}
	constexpr Point_3(T x, T y, T z) noexcept : std::array<T, 3>{{x, y, z}} {}
	constexpr Point_3(Origin) noexcept : std::array<T, 3>{{T(0), T(0), T(0)}} {}
	explicit constexpr Point_3(const std::array<T, 3>& a) noexcept : std::array<T, 3>(a) {}

	template<typename U>
	explicit constexpr operator Point_3<U>() const noexcept { return Point_3<U>(static_cast<U>(x()), static_cast<U>(y()), static_cast<U>(z())); }

	constexpr Point_3& operator+=(const Vector_3<T>& v) noexcept { x() += v.x(); y() += v.y(); z() += v.z(); return *this; }
	constexpr Point_3& operator-=(const Vector_3<T>& v) noexcept { x() -= v.x(); y() -= v.y(); z() -= v.z(); return *this; }
	constexpr Point_3& operator*=(T s) noexcept { x() *= s; y() *= s; z() *= s; return *this; }
	constexpr Point_3& operator/=(T s) noexcept { x() /= s; y() /= s; z() /= s; return *this; }
	constexpr Point_3& operator=(Origin) noexcept { x() = T(0); y() = T(0); z() = T(0); return *this; }

	constexpr const Vector_3<T>& operator-(Origin) const noexcept {
		return reinterpret_cast<const Vector_3<T>&>(*this);
	}

	constexpr  T x() const noexcept { return (*this)[0]; }
	constexpr  T y() const noexcept { return (*this)[1]; }
	constexpr  T z() const noexcept { return (*this)[2]; }
	T& x() noexcept { return (*this)[0]; }
	T& y() noexcept { return (*this)[1]; }
	T& z() noexcept { return (*this)[2]; }

	constexpr bool operator==(const Point_3& p) const noexcept { return (p.x()==x()) && (p.y()==y()) && (p.z()==z()); }
	constexpr bool operator!=(const Point_3& p) const noexcept { return (p.x()!=x()) || (p.y()!=y()) || (p.z()!=z()); }
	constexpr bool operator==(Origin) const noexcept { return (x()==T(0)) && (y()==T(0)) && (z()==T(0)); }
	constexpr bool operator!=(Origin) const noexcept { return (x()!=T(0)) || (y()!=T(0)) || (z()!=T(0)); }

	constexpr bool equals(const Point_3& p, T tolerance = T(EPSILON)) const noexcept {
		return std::abs(p.x() - x()) <= tolerance && std::abs(p.y() - y()) <= tolerance && std::abs(p.z() - z()) <= tolerance;
	}
};

template<typename T>
constexpr Point_3<T> operator+(const Point_3<T>& a, const Vector_3<T>& b) noexcept {
	return Point_3<T>( a.x() + b.x(), a.y() + b.y(), a.z() + b.z() );
}

template<typename T>
constexpr const Point_3<T>& operator+(typename Point_3<T>::Origin, const Vector_3<T>& b) noexcept {
	return reinterpret_cast<const Point_3<T>&>(b);
}

template<typename T>
constexpr Point_3<T> operator+(const Vector_3<T>& a, const Point_3<T>& b) noexcept {
	return b + a;
}

template<typename T>
constexpr Point_3<T> operator-(const Point_3<T>& a, const Vector_3<T>& b) noexcept {
	return Point_3<T>( a.x() - b.x(), a.y() - b.y(), a.z() - b.z() );
}

template<typename T>
constexpr Vector_3<T> operator-(const Point_3<T>& a, const Point_3<T>& b) noexcept {
	return Vector_3<T>( a.x() - b.x(), a.y() - b.y(), a.z() - b.z() );
}

template<typename T, typename S, typename = std::enable_if_t<std::is_arithmetic_v<S>>>
constexpr Point_3<T> operator*(const Point_3<T>& a, S s) noexcept {
	return Point_3<T>( a.x() * static_cast<T>(s), a.y() * static_cast<T>(s), a.z() * static_cast<T>(s) );
}

template<typename T, typename S, typename = std::enable_if_t<std::is_arithmetic_v<S>>>
constexpr Point_3<T> operator*(S s, const Point_3<T>& a) noexcept {
	return a * s;
}

template<typename T, typename S, typename = std::enable_if_t<std::is_arithmetic_v<S>>>
constexpr Point_3<T> operator/(const Point_3<T>& a, S s) noexcept {
	return Point_3<T>( a.x() / s, a.y() / s, a.z() / s );
}

template<typename T>
inline std::ostream& operator<<(std::ostream& os, const Point_3<T>& v) {
	return os << "(" << v.x() << ", " << v.y()  << ", " << v.z() << ")";
}

using Point3 = Point_3<double>;
using Point3I = Point_3<int>;

}