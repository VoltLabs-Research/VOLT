#pragma once

#include <opendxa/core/opendxa.h>
#include "vector3.h"
#include "vector4.h"
#include "affine_transformation.h"
#include "matrix3.h"

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

	QuaternionT() {}
	QuaternionT(T x, T y, T z, T w) : std::array<T, 4>{{x,y,z,w}} {}
	explicit QuaternionT(Identity) : std::array<T, 4>{{ T(0), T(0), T(0), T(1) }} {}
	explicit QuaternionT(const Matrix_3<T>& tm);

	template<typename U>
	explicit operator QuaternionT<U>() const { return QuaternionT<U>(static_cast<U>(x()), static_cast<U>(y()), static_cast<U>(z()), static_cast<U>(w())); }

	QuaternionT& setIdentity() {
		z() = y() = x() = T(0);
		w() = T(1);
		return *this;
	}

	QuaternionT& operator=(Identity) { return setIdentity(); }
	T x() const { return (*this)[0]; }
	T y() const { return (*this)[1]; }
	T z() const { return (*this)[2]; }
	T w() const { return (*this)[3]; }

	T& x() { return (*this)[0]; }
	T& y() { return (*this)[1]; }
	T& z() { return (*this)[2]; }
	T& w() { return (*this)[3]; }

	QuaternionT operator-() const { return {-x(), -y(), -z(), -w()}; }
	QuaternionT  inverse() const { return { -x(), -y(), -z(), w() }; }

	bool operator==(const QuaternionT& q) const { return (q.x() == x() && q.y() == y() && q.z() == z() && q.w() == w()); }
	bool operator!=(const QuaternionT& q) const { return !(q == *this); }

	QuaternionT& operator*=(T s) { x() *= s; y() *= s; z() *= s; w() *= s; return *this; }
	QuaternionT& operator/=(T s) { x() /= s; y() /= s; z() /= s; w() /= s; return *this; }

	T dot(const QuaternionT& b) const { return x()*b.x() + y()*b.y() + z()*b.z() + w()*b.w(); }

	inline void normalize() {
		T c = sqrt(dot(*this));
		x() /= c; y() /= c; z() /= c; w() /= c;
	}

	inline QuaternionT normalized() const {
		T c = sqrt(dot(*this));
		return { x() / c, y() / c, z() / c, w() / c };
	}

    static QuaternionT interpolate(const QuaternionT& q1, const QuaternionT& q2, T alpha) {
    	T cos_t = q1.dot(q2);

    	// Same quaternion? (avoid domain error)
    	if(T(1) <= std::abs(cos_t))
    		return q1;

    	// t is now theta.
    	T theta = std::acos(cos_t);
    	T sin_t = std::sin(theta);

    	// Same quaternion? (avoid zero-div)
    	if(sin_t == 0)
    		return q1;

    	T s = std::sin((T(1)-alpha)*theta)/sin_t;
    	T t = std::sin(alpha*theta)/sin_t;

    	QuaternionT res(s*q1.x() + t*q2.x(), s*q1.y() + t*q2.y(), s*q1.z() + t*q2.z(), s*q1.w() + t*q2.w());
    	res.normalize();
    	return res;
    }

	static QuaternionT interpolateQuad(const QuaternionT& q1, const QuaternionT& q2, const QuaternionT& out, const QuaternionT& in, T alpha){
		QuaternionT slerpP = interpolate(q1, q2, alpha);
		QuaternionT slerpQ = interpolate(out, in, alpha);
		T Ti = 2 * alpha * (1 - alpha);
		return interpolate(slerpP, slerpQ, Ti);
	}

	static QuaternionT fromEuler(T ai, T aj, T ak, typename Matrix_3<T>::EulerAxisSequence axisSequence);
};

template<typename T>
inline QuaternionT<T>::QuaternionT(const Matrix_3<T>& tm){
	// Make sure this is a pure rotation matrix.

	// Algorithm in Ken Shoemake's article in 1987 SIGGRAPH course notes
    // article "Quaternion Calculus and Fast Animation".
    T trace = tm(0,0) + tm(1,1) + tm(2,2);
	if(trace > 0) {
		T root = sqrt(trace + T(1));
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
		T root = sqrt(tm(i,i) - tm(j,j) - tm(k,k) + T(1));
		(*this)[i] = T(0.5) * root;
		root = T(0.5) / root;
		w() = (tm(k,j) - tm(j,k)) * root;
		(*this)[j] = (tm(j,i) + tm(i,j)) * root;
		(*this)[k] = (tm(k,i) + tm(i,k)) * root;
	}

	// Since we represent a rotation, make sure we are unit length.
	assert(std::abs(dot(*this)-T(1)) <= T(EPSILON));
}

template<typename T>
inline QuaternionT<T> operator*(const QuaternionT<T>& a, const QuaternionT<T>& b){
	return {
		a.w()*b.x() + a.x()*b.w() + a.y()*b.z() - a.z()*b.y(),
		a.w()*b.y() + a.y()*b.w() + a.z()*b.x() - a.x()*b.z(),
		a.w()*b.z() + a.z()*b.w() + a.x()*b.y() - a.y()*b.x(),
		a.w()*b.w() - a.x()*b.x() - a.y()*b.y() - a.z()*b.z() };
}

template<typename T>
inline Vector_3<T> operator*(const QuaternionT<T>& q, const Vector_3<T>& v){
	return Matrix_3<T>(T(1) - T(2)*(q.y()*q.y() + q.z()*q.z()),        T(2)*(q.x()*q.y() - q.w()*q.z()),        T(2)*(q.x()*q.z() + q.w()*q.y()),
						  T(2)*(q.x()*q.y() + q.w()*q.z()), T(1) - T(2)*(q.x()*q.x() + q.z()*q.z()),        T(2)*(q.y()*q.z() - q.w()*q.x()),
						  T(2)*(q.x()*q.z() - q.w()*q.y()),        T(2)*(q.y()*q.z() + q.w()*q.x()), T(1) - T(2)*(q.x()*q.x() + q.y()*q.y())) * v;
}

// Constructs a quaternion from three Euler angles.
template<typename T>
inline QuaternionT<T> QuaternionT<T>::fromEuler(T ai, T aj, T ak, typename Matrix_3<T>::EulerAxisSequence axisSequence){
	assert(axisSequence == Matrix_3<T>::szyx);
	int firstaxis = 2;
	int parity = 1;
	bool repetition = false;
	bool frame = false;

	int i = firstaxis;
	int j = (i + parity + 1) % 3;
	int k = (i - parity + 2) % 3;

	if(frame)
		std::swap(ai, ak);
	if(parity)
		aj = -aj;

	ai *= T(0.5);
	aj *= T(0.5);
	ak *= T(0.5);
	T ci = std::cos(ai);
	T si = std::sin(ai);
	T cj = std::cos(aj);
	T sj = std::sin(aj);
	T ck = std::cos(ak);
	T sk = std::sin(ak);
	T cc = ci*ck;
	T cs = ci*sk;
	T sc = si*ck;
	T ss = si*sk;

	QuaternionT<T> quaternion;
	if(repetition) {
		quaternion[i] = cj*(cs + sc);
		quaternion[j] = sj*(cc + ss);
		quaternion[k] = sj*(cs - sc);
		quaternion[3] = cj*(cc - ss);
	}
	else {
		quaternion[i] = cj*sc - sj*cs;
		quaternion[j] = cj*ss + sj*cc;
		quaternion[k] = cj*cs - sj*sc;
		quaternion[3] = cj*cc + sj*ss;
	}
	if(parity)
		quaternion[j] = -quaternion[j];

	return quaternion;
}

template<typename T>
inline std::ostream& operator<<(std::ostream &os, const QuaternionT<T>& q) {
	return os << '[' << q.x() << ' ' << q.y() << ' ' << q.z() << ' ' << q.w() << ']';
}

using Quaternion = QuaternionT<double>;

}