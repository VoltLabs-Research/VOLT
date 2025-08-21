#pragma once

#include <opendxa/core/opendxa.h>
#include <array>
#include <cmath>
#include <type_traits>

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

	constexpr Vector_3() noexcept {}
	explicit constexpr Vector_3(T val) noexcept : std::array<T, 3>{{val,val,val}} {}
	constexpr Vector_3(T x, T y, T z) noexcept : std::array<T, 3>{{x, y, z}} {}
	constexpr Vector_3(Zero) noexcept : std::array<T, 3>{{T(0), T(0), T(0)}} {}

	explicit constexpr Vector_3(const std::array<T, 3>& a) noexcept : std::array<T, 3>(a) {}

	template<typename U>
	explicit constexpr operator Vector_3<U>() const noexcept { return Vector_3<U>(static_cast<U>(x()), static_cast<U>(y()), static_cast<U>(z())); }

	constexpr Vector_3 operator-() const noexcept { return Vector_3(-x(), -y(), -z()); }
	constexpr Vector_3& operator+=(const Vector_3& v) noexcept { x() += v.x(); y() += v.y(); z() += v.z(); return *this; }
	constexpr Vector_3& operator-=(const Vector_3& v) noexcept { x() -= v.x(); y() -= v.y(); z() -= v.z(); return *this; }
	constexpr Vector_3& operator*=(T s) noexcept { x() *= s; y() *= s; z() *= s; return *this; }
	constexpr Vector_3& operator/=(T s) noexcept { x() /= s; y() /= s; z() /= s; return *this; }
	constexpr Vector_3& operator=(Zero) noexcept { setZero(); return *this; }

	constexpr void setZero() noexcept { this->fill(T(0)); }

	constexpr T x() const noexcept { return (*this)[0]; }
	constexpr T y() const noexcept { return (*this)[1]; }
	constexpr T z() const noexcept { return (*this)[2]; }
	T& x() noexcept { return (*this)[0]; }
	T& y() noexcept { return (*this)[1]; }
	T& z() noexcept { return (*this)[2]; }

	constexpr bool operator==(const Vector_3& v) const noexcept { return (v.x()==x()) && (v.y()==y()) && (v.z()==z()); }
	constexpr bool operator!=(const Vector_3& v) const noexcept { return (v.x()!=x()) || (v.y()!=y()) || (v.z()!=z()); }
	constexpr bool operator==(Zero) const noexcept { return (x()==T(0)) && (y()==T(0)) && (z()==T(0)); }
	constexpr bool operator!=(Zero) const noexcept { return (x()!=T(0)) || (y()!=T(0)) || (z()!=T(0)); }

	constexpr bool equals(const Vector_3& v, T tolerance = T(EPSILON)) const noexcept {
		return std::abs(v.x() - x()) <= tolerance && std::abs(v.y() - y()) <= tolerance && std::abs(v.z() - z()) <= tolerance;
	}

	constexpr bool isZero(T tolerance = T(EPSILON)) const noexcept {
		return std::abs(x()) <= tolerance && std::abs(y()) <= tolerance && std::abs(z()) <= tolerance;
	}

	constexpr T dot(const Vector_3& b) const noexcept { return x()*b.x() + y()*b.y() + z()*b.z(); }

	constexpr Vector_3 cross(const Vector_3& b) const noexcept {
		return Vector_3(y() * b.z() - z() * b.y(),
						z() * b.x() - x() * b.z(),
						x() * b.y() - y() * b.x());
	}

	constexpr T squaredLength() const noexcept { return x()*x() + y()*y() + z()*z(); }
	T length() const noexcept { return static_cast<T>(std::sqrt(squaredLength())); }

	inline void normalize() noexcept {
		T sqLen = squaredLength();
		if (sqLen > T(0)) {
			*this *= (T(1) / std::sqrt(sqLen));
		}
	}

	inline Vector_3 normalized() const noexcept {
		T sqLen = squaredLength();
		if (sqLen > T(0)) {
			return *this * (T(1) / std::sqrt(sqLen));
		}
		return *this;
	}

	inline void resize(T len) noexcept {
		T sqLen = squaredLength();
		if (sqLen > T(0)) {
			*this *= (len / std::sqrt(sqLen));
		}
	}

	inline Vector_3 resized(T len) const noexcept {
		T sqLen = squaredLength();
		if (sqLen > T(0)) {
			return *this * (len / std::sqrt(sqLen));
		}
		return *this;
	}
};

template<typename T>
constexpr Vector_3<T> operator+(const Vector_3<T>& a, const Vector_3<T>& b) noexcept {
	return Vector_3<T>( a.x() + b.x(), a.y() + b.y(), a.z() + b.z() );
}

template<typename T>
constexpr Vector_3<T> operator-(const Vector_3<T>& a, const Vector_3<T>& b) noexcept {
	return Vector_3<T>( a.x() - b.x(), a.y() - b.y(), a.z() - b.z() );
}

template<typename T, typename S, typename = std::enable_if_t<std::is_arithmetic_v<S>>>
constexpr Vector_3<T> operator*(const Vector_3<T>& a, S s) noexcept {
	return Vector_3<T>( a.x() * static_cast<T>(s), a.y() * static_cast<T>(s), a.z() * static_cast<T>(s) );
}

template<typename T, typename S, typename = std::enable_if_t<std::is_arithmetic_v<S>>>
constexpr Vector_3<T> operator*(S s, const Vector_3<T>& a) noexcept {
	return a * s;
}

template<typename T, typename S, typename = std::enable_if_t<std::is_arithmetic_v<S>>>
constexpr Vector_3<T> operator/(const Vector_3<T>& a, S s) noexcept {
	return Vector_3<T>( a.x() / s, a.y() / s, a.z() / s );
}

using Vector3 = Vector_3<double>;
using Vector3I = Vector_3<int>;

}