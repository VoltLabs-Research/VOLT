#pragma once

#include <opendxa/core/opendxa.h>
#include "vector3.h"
#include "vector4.h"
#include "affine_transformation.h"
#include "matrix3.h"
#include <array>
#include <cmath>

namespace OpenDXA{

template<typename T> class AffineTransformationT;
template<typename T> class Matrix_3;

template<typename T>
class QuaternionT : public std::array<T, 4>{
public:
	struct Identity {};
	using typename std::array<T, 4>::size_type;
	using typename std::array<T, 4>::difference_type;
	using typename std::array<T, 4>::value_type;
	using typename std::array<T, 4>::iterator;
	using typename std::array<T, 4>::const_iterator;

	constexpr QuaternionT() noexcept {}
	constexpr QuaternionT(T x, T y, T z, T w) noexcept : std::array<T, 4>{{x,y,z,w}} {}
	explicit constexpr QuaternionT(Identity) noexcept : std::array<T, 4>{{ T(0), T(0), T(0), T(1) }} {}
	explicit QuaternionT(const Matrix_3<T>& tm);

	template<typename U>
	explicit constexpr operator QuaternionT<U>() const noexcept { return QuaternionT<U>(static_cast<U>(x()), static_cast<U>(y()), static_cast<U>(z()), static_cast<U>(w())); }

	QuaternionT& setIdentity() noexcept {
		(*this)[0] = T(0);
		(*this)[1] = T(0);
		(*this)[2] = T(0);
		(*this)[3] = T(1);
		return *this;
	}

	QuaternionT& operator=(Identity) noexcept { return setIdentity(); }
	constexpr T x() const noexcept { return (*this)[0]; }
	constexpr T y() const noexcept { return (*this)[1]; }
	constexpr T z() const noexcept { return (*this)[2]; }
	constexpr T w() const noexcept { return (*this)[3]; }

	T& x() noexcept { return (*this)[0]; }
	T& y() noexcept { return (*this)[1]; }
	T& z() noexcept { return (*this)[2]; }
	T& w() noexcept { return (*this)[3]; }

	constexpr QuaternionT operator-() const noexcept { return {-x(), -y(), -z(), -w()}; }
	constexpr QuaternionT  inverse() const noexcept { return { -x(), -y(), -z(), w() }; }

	constexpr bool operator==(const QuaternionT& q) const noexcept { return (q.x() == x() && q.y() == y() && q.z() == z() && q.w() == w()); }
	constexpr bool operator!=(const QuaternionT& q) const noexcept { return !(q == *this); }

	QuaternionT& operator*=(T s) noexcept { x() *= s; y() *= s; z() *= s; w() *= s; return *this; }
	QuaternionT& operator/=(T s) noexcept { x() /= s; y() /= s; z() /= s; w() /= s; return *this; }

	constexpr T dot(const QuaternionT& b) const noexcept { return x()*b.x() + y()*b.y() + z()*b.z() + w()*b.w(); }

	inline void normalize() noexcept {
		T len_sq = dot(*this);
		if (len_sq > T(0)) {
			T inv_len = T(1) / std::sqrt(len_sq);
			x() *= inv_len; y() *= inv_len; z() *= inv_len; w() *= inv_len;
		}
	}

	inline QuaternionT normalized() const noexcept {
		T len_sq = dot(*this);
		if (len_sq > T(0)) {
			T inv_len = T(1) / std::sqrt(len_sq);
			return { x() * inv_len, y() * inv_len, z() * inv_len, w() * inv_len };
		}
		return *this;
	}
};

template<typename T>
inline QuaternionT<T>::QuaternionT(const Matrix_3<T>& tm) {
    T trace = tm(0,0) + tm(1,1) + tm(2,2);
	if(trace > T(0)) {
		T root = std::sqrt(trace + T(1));
		w() = T(0.5) * root;
		root = T(0.5) / root;
		x() = (tm(2,1) - tm(1,2)) * root;
		y() = (tm(0,2) - tm(2,0)) * root;
		z() = (tm(1,0) - tm(0,1)) * root;
	}
	else {
		static const typename Matrix_3<T>::size_type next[] = { 1, 2, 0 };
		typename Matrix_3<T>::size_type i = 0;
		if(tm(1,1) > tm(0,0)) i = 1;
		if(tm(2,2) > tm(i,i)) i = 2;
		typename Matrix_3<T>::size_type j = next[i];
		typename Matrix_3<T>::size_type k = next[j];
		T root = std::sqrt(tm(i,i) - tm(j,j) - tm(k,k) + T(1));
		(*this)[i] = T(0.5) * root;
		root = T(0.5) / root;
		w() = (tm(k,j) - tm(j,k)) * root;
		(*this)[j] = (tm(j,i) + tm(i,j)) * root;
		(*this)[k] = (tm(k,i) + tm(i,k)) * root;
	}
}

template<typename T>
constexpr QuaternionT<T> operator*(const QuaternionT<T>& a, const QuaternionT<T>& b) noexcept {
	return {
		a.w()*b.x() + a.x()*b.w() + a.y()*b.z() - a.z()*b.y(),
		a.w()*b.y() + a.y()*b.w() + a.z()*b.x() - a.x()*b.z(),
		a.w()*b.z() + a.z()*b.w() + a.x()*b.y() - a.y()*b.x(),
		a.w()*b.w() - a.x()*b.x() - a.y()*b.y() - a.z()*b.z() };
}

template<typename T>
inline Vector_3<T> operator*(const QuaternionT<T>& q, const Vector_3<T>& v) noexcept {
	Vector_3<T> u(q.x(), q.y(), q.z());
	T s = q.w();
	return T(2) * u.dot(v) * u
		 + (s*s - u.dot(u)) * v
		 + T(2) * s * u.cross(v);
}

using Quaternion = QuaternionT<double>;

}
