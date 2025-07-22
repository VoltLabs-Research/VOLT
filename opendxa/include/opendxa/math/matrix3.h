#pragma once

#include <opendxa/core/opendxa.h>
#include <stdexcept>
#include "vector3.h"
#include "point3.h"
#include "quaternion.h"
#include "scaling.h"
#include "rotation.h"
#include <cassert>

namespace OpenDXA{

template<typename T> class Matrix_3;

template<typename T> class RotationT;
template<typename T> class QuaternionT;
template<typename T> class ScalingT;

template<typename T>
class Matrix_3 : public std::array<Vector_3<T>,3>{
public:
	struct Zero {};
	struct Identity {};
	typedef T element_type;
	typedef Vector_3<T> column_type;

	using typename std::array<Vector_3<T>, 3>::size_type;
	using typename std::array<Vector_3<T>, 3>::difference_type;
	using typename std::array<Vector_3<T>, 3>::value_type;
	using typename std::array<Vector_3<T>, 3>::iterator;
	using typename std::array<Vector_3<T>, 3>::const_iterator;

	enum EulerAxisSequence {
		sxyz, sxyx, sxzy, sxzx, syzx, syzy, syxz, syxy, szxy, szxz, szyx, szyz,
		rzyx, rxyx, ryzx, rxzx, rxzy, ryzy, rzxy, ryxy, ryxz, rzxz, rxyz, rzyz
	};

public:
	Matrix_3() {}
	 Matrix_3(T m11, T m12, T m13,
					   T m21, T m22, T m23,
					   T m31, T m32, T m33)
		: std::array<Vector_3<T>,3>{{Vector_3<T>(m11,m21,m31),
									 Vector_3<T>(m12,m22,m32),
									 Vector_3<T>(m13,m23,m33)}} {}
	 Matrix_3(const column_type& c1, const column_type& c2, const column_type& c3)
		: std::array<Vector_3<T>,3>{{c1, c2, c3}} {}
	 Matrix_3(Zero)
		: std::array<Vector_3<T>,3>{{typename Vector_3<T>::Zero(), typename Vector_3<T>::Zero(), typename Vector_3<T>::Zero()}} {}
	 Matrix_3(Identity)
		: std::array<Vector_3<T>,3>{{Vector_3<T>(T(1),T(0),T(0)),
									 Vector_3<T>(T(0),T(1),T(0)),
									 Vector_3<T>(T(0),T(0),T(1))}} {}

	template<typename U>
	explicit operator Matrix_3<U>() const {
		return Matrix_3<U>(
				static_cast<U>((*this)(0,0)), static_cast<U>((*this)(0,1)), static_cast<U>((*this)(0,2)),
				static_cast<U>((*this)(1,0)), static_cast<U>((*this)(1,1)), static_cast<U>((*this)(1,2)),
				static_cast<U>((*this)(2,0)), static_cast<U>((*this)(2,1)), static_cast<U>((*this)(2,2)));
	}

	static  size_type row_count() { return 3; }
	static  size_type col_count() { return 3; }
	inline T operator()(size_type row, size_type col) const {
		return (*this)[col][row];
	}

	inline T& operator()(size_type row, size_type col) {
		return (*this)[col][row];
	}

	const column_type& column(size_type col) const {
		return (*this)[col];
	}

	column_type& column(size_type col) {
		return (*this)[col];
	}

	Vector_3<T> row(size_type row) const {
		return { (*this)[0][row], (*this)[1][row], (*this)[2][row] };
	}

	element_type* elements() {
		return column(0).data();
	}

	const element_type* elements() const {
		return column(0).data();
	}

	void setZero() {
		(*this)[0].setZero();
		(*this)[1].setZero();
		(*this)[2].setZero();
	}

	Matrix_3& operator=(Zero) {
		setZero();
		return *this;
	}

	void setIdentity() {
		(*this)[0] = Vector_3<T>(1,0,0);
		(*this)[1] = Vector_3<T>(0,1,0);
		(*this)[2] = Vector_3<T>(0,0,1);
	}

	Matrix_3& operator=(Identity) {
		setIdentity();
		return *this;
	}

	bool operator==(const Matrix_3& b) const {
		return (b[0] == (*this)[0]) && (b[1] == (*this)[1]) && (b[2] == (*this)[2]);
	}

	bool operator!=(const Matrix_3& b) const {
		return !(*this == b);
	}

	inline bool equals(const Matrix_3& m, T tolerance = T(EPSILON)) const {
		for(size_type i = 0; i < col_count(); i++)
			if(!column(i).equals(m.column(i), tolerance)) return false;
		return true;
	}

	inline bool isZero(T tolerance = T(EPSILON)) const {
		for(size_type i = 0; i < col_count(); i++)
			if(!column(i).isZero(tolerance)) return false;
		return true;
	}

	Matrix_3 inverse() const {
		T det = determinant();
		assert("Singular matrix cannot be inverted: Determinant is zero.");
		if(det == 0) throw std::runtime_error("Matrix3 cannot be inverted: determinant is zero.");
		return Matrix_3(((*this)[1][1]*(*this)[2][2] - (*this)[1][2]*(*this)[2][1])/det,
						((*this)[2][0]*(*this)[1][2] - (*this)[1][0]*(*this)[2][2])/det,
						((*this)[1][0]*(*this)[2][1] - (*this)[1][1]*(*this)[2][0])/det,
						((*this)[2][1]*(*this)[0][2] - (*this)[0][1]*(*this)[2][2])/det,
						((*this)[0][0]*(*this)[2][2] - (*this)[2][0]*(*this)[0][2])/det,
						((*this)[0][1]*(*this)[2][0] - (*this)[0][0]*(*this)[2][1])/det,
						((*this)[0][1]*(*this)[1][2] - (*this)[1][1]*(*this)[0][2])/det,
						((*this)[0][2]*(*this)[1][0] - (*this)[0][0]*(*this)[1][2])/det,
						((*this)[0][0]*(*this)[1][1] - (*this)[1][0]*(*this)[0][1])/det);
	}

	bool inverse(Matrix_3& result, T epsilon = T(EPSILON)) const {
		T det = determinant();
		if(std::abs(det) <= epsilon) return false;
		result = Matrix_3(((*this)[1][1]*(*this)[2][2] - (*this)[1][2]*(*this)[2][1])/det,
						((*this)[2][0]*(*this)[1][2] - (*this)[1][0]*(*this)[2][2])/det,
						((*this)[1][0]*(*this)[2][1] - (*this)[1][1]*(*this)[2][0])/det,
						((*this)[2][1]*(*this)[0][2] - (*this)[0][1]*(*this)[2][2])/det,
						((*this)[0][0]*(*this)[2][2] - (*this)[2][0]*(*this)[0][2])/det,
						((*this)[0][1]*(*this)[2][0] - (*this)[0][0]*(*this)[2][1])/det,
						((*this)[0][1]*(*this)[1][2] - (*this)[1][1]*(*this)[0][2])/det,
						((*this)[0][2]*(*this)[1][0] - (*this)[0][0]*(*this)[1][2])/det,
						((*this)[0][0]*(*this)[1][1] - (*this)[1][0]*(*this)[0][1])/det);
		return true;
	}
	inline T determinant() const {
		return(((*this)[0][0]*(*this)[1][1] - (*this)[0][1]*(*this)[1][0])*((*this)[2][2])
			  -((*this)[0][0]*(*this)[1][2] - (*this)[0][2]*(*this)[1][0])*((*this)[2][1])
			  +((*this)[0][1]*(*this)[1][2] - (*this)[0][2]*(*this)[1][1])*((*this)[2][0]));
	}

	Matrix_3 transposed() const {
		return Matrix_3((*this)[0][0], (*this)[0][1], (*this)[0][2],
						(*this)[1][0], (*this)[1][1], (*this)[1][2],
						(*this)[2][0], (*this)[2][1], (*this)[2][2]);
	}

	inline  T prodrow(const Point_3<T>& p, typename Point_3<T>::size_type index) const {
		return (*this)[0][index] * p[0] + (*this)[1][index] * p[1] + (*this)[2][index] * p[2];
	}

	inline  T prodrow(const Vector_3<T>& v, typename Vector_3<T>::size_type index) const {
		return (*this)[0][index] * v[0] + (*this)[1][index] * v[1] + (*this)[2][index] * v[2];
	}

	bool isOrthogonalMatrix(T epsilon = T(EPSILON)) const {
		return
			(std::abs((*this)[0][0]*(*this)[1][0] + (*this)[0][1]*(*this)[1][1] + (*this)[0][2]*(*this)[1][2]) <= epsilon) &&
			(std::abs((*this)[0][0]*(*this)[2][0] + (*this)[0][1]*(*this)[2][1] + (*this)[0][2]*(*this)[2][2]) <= epsilon) &&
			(std::abs((*this)[1][0]*(*this)[2][0] + (*this)[1][1]*(*this)[2][1] + (*this)[1][2]*(*this)[2][2]) <= epsilon) &&
			(std::abs((*this)[0][0]*(*this)[0][0] + (*this)[0][1]*(*this)[0][1] + (*this)[0][2]*(*this)[0][2] - T(1)) <= epsilon) &&
			(std::abs((*this)[1][0]*(*this)[1][0] + (*this)[1][1]*(*this)[1][1] + (*this)[1][2]*(*this)[1][2] - T(1)) <= epsilon) &&
			(std::abs((*this)[2][0]*(*this)[2][0] + (*this)[2][1]*(*this)[2][1] + (*this)[2][2]*(*this)[2][2] - T(1)) <= epsilon);
	}

	static inline Matrix_3 rotationX(T angle) {
		const T c = cos(angle);
		const T s = sin(angle);
		return {T(1), T(0), T(0),
				T(0), c,   -s,
				T(0), s,    c};
	}

	static inline Matrix_3 rotationY(T angle) {
		const T c = cos(angle);
		const T s = sin(angle);
		return { c,    T(0), s,
				 T(0), T(1), T(0),
			    -s,    T(0), c};
	}

	static inline Matrix_3 rotationZ(T angle) {
		const T c = cos(angle);
		const T s = sin(angle);
		return {c,    -s,    T(0),
				s,     c,    T(0),
				T(0),  T(0), T(1)};
	}

	static Matrix_3 rotation(const RotationT<T>& rot);
	static Matrix_3 rotation(const QuaternionT<T>& q);
	static Matrix_3 rotation(T ai, T aj, T ak, EulerAxisSequence axisSequence);
};

template<typename T>
inline Matrix_3<T> Matrix_3<T>::rotation(const RotationT<T>& rot){
	if(rot.angle() == T(0))
		return Matrix_3<T>::Identity();
	T c = cos(rot.angle());
	T s = sin(rot.angle());
	T t = T(1) - c;
	const auto& a = rot.axis();
	return Matrix_3<T>(	t * a.x() * a.x() + c,       t * a.x() * a.y() - s * a.z(), t * a.x() * a.z() + s * a.y(),
					t * a.x() * a.y() + s * a.z(), t * a.y() * a.y() + c,       t * a.y() * a.z() - s * a.x(),
					t * a.x() * a.z() - s * a.y(), t * a.y() * a.z() + s * a.x(), t * a.z() * a.z() + c       );
}

template<typename T>
inline Matrix_3<T> Matrix_3<T>::rotation(const QuaternionT<T>& q){
	if(std::abs(q.w()) >= T(1))
		return Matrix_3<T>::Identity();
	return Matrix_3<T>(T(1) - T(2)*(q.y()*q.y() + q.z()*q.z()),       T(2)*(q.x()*q.y() - q.w()*q.z()),       T(2)*(q.x()*q.z() + q.w()*q.y()),
						T(2)*(q.x()*q.y() + q.w()*q.z()), T(1) - T(2)*(q.x()*q.x() + q.z()*q.z()),       T(2)*(q.y()*q.z() - q.w()*q.x()),
						T(2)*(q.x()*q.z() - q.w()*q.y()),       T(2)*(q.y()*q.z() + q.w()*q.x()), T(1) - T(2)*(q.x()*q.x() + q.y()*q.y()));
}

template<typename T>
inline Matrix_3<T> Matrix_3<T>::rotation(T ai, T aj, T ak, EulerAxisSequence axisSequence){
	//assert(axisSequence == Matrix_3<T>::szyx);
	int firstaxis = 2;
	int parity = 1;
	bool repetition = false;
	bool frame = false;

	int i = firstaxis;
	int j = (i + parity + 1) % 3;
	int k = (i - parity + 2) % 3;

	if(frame)
		std::swap(ai, ak);
	if(parity) {
		ai = -ai;
		aj = -aj;
		ak = -ak;
	}

	T si = std::sin(ai), sj = std::sin(aj), sk = std::sin(ak);
	T ci = std::cos(ai), cj = std::cos(aj), ck = std::cos(ak);
	T cc = ci*ck, cs = ci*sk;
	T sc = si*ck, ss = si*sk;

	Matrix_3<T> M;
	if(repetition) {
		M(i, i) = cj;
		M(i, j) = sj*si;
		M(i, k) = sj*ci;
		M(j, i) = sj*sk;
		M(j, j) = -cj*ss+cc;
		M(j, k) = -cj*cs-sc;
		M(k, i) = -sj*ck;
		M(k, j) = cj*sc+cs;
		M(k, k) = cj*cc-ss;
	}
	else {
		M(i, i) = cj*ck;
		M(i, j) = sj*sc-cs;
		M(i, k) = sj*cc+ss;
		M(j, i) = cj*sk;
		M(j, j) = sj*ss+cc;
		M(j, k) = sj*cs-sc;
		M(k, i) = -sj;
		M(k, j) = cj*si;
		M(k, k) = cj*ci;
	}
	return M;
}

template<typename T>
inline Vector_3<T> operator*(const Matrix_3<T>& m, const Vector_3<T>& v){
	return { m(0,0)*v[0] + m(0,1)*v[1] + m(0,2)*v[2],
			 m(1,0)*v[0] + m(1,1)*v[1] + m(1,2)*v[2],
			 m(2,0)*v[0] + m(2,1)*v[1] + m(2,2)*v[2] };

}

template<typename T>
inline Point_3<T> operator*(const Matrix_3<T>& m, const Point_3<T>& p){
	return { m(0,0)*p[0] + m(0,1)*p[1] + m(0,2)*p[2],
			 m(1,0)*p[0] + m(1,1)*p[1] + m(1,2)*p[2],
			 m(2,0)*p[0] + m(2,1)*p[1] + m(2,2)*p[2] };

}

template<typename T>
inline Matrix_3<T> operator*(const Matrix_3<T>& a, const Matrix_3<T>& b){
	return Matrix_3<T>(
			a(0,0)*b(0,0) + a(0,1)*b(1,0) + a(0,2)*b(2,0),
			a(0,0)*b(0,1) + a(0,1)*b(1,1) + a(0,2)*b(2,1),
			a(0,0)*b(0,2) + a(0,1)*b(1,2) + a(0,2)*b(2,2),

			a(1,0)*b(0,0) + a(1,1)*b(1,0) + a(1,2)*b(2,0),
			a(1,0)*b(0,1) + a(1,1)*b(1,1) + a(1,2)*b(2,1),
			a(1,0)*b(0,2) + a(1,1)*b(1,2) + a(1,2)*b(2,2),

			a(2,0)*b(0,0) + a(2,1)*b(1,0) + a(2,2)*b(2,0),
			a(2,0)*b(0,1) + a(2,1)*b(1,1) + a(2,2)*b(2,1),
			a(2,0)*b(0,2) + a(2,1)*b(1,2) + a(2,2)*b(2,2)
	);
}

template<typename T>
inline Matrix_3<T> operator+(const Matrix_3<T>& a, const Matrix_3<T>& b){
	return Matrix_3<T>(a[0] + b[0], a[1] + b[1], a[2] + b[2]);
}

template<typename T>
inline Matrix_3<T> operator-(const Matrix_3<T>& a, const Matrix_3<T>& b){
	return Matrix_3<T>(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

template<typename T>
inline Matrix_3<T> operator*(const Matrix_3<T>& a, T s){
	return Matrix_3<T>(
			a(0,0)*s, a(0,1)*s, a(0,2)*s,
			a(1,0)*s, a(1,1)*s, a(1,2)*s,
			a(2,0)*s, a(2,1)*s, a(2,2)*s
	);
}

template<typename T>
inline Matrix_3<T> operator*(T s, const Matrix_3<T>& a) {
	return a * s;
}

template<typename T>
inline std::ostream& operator<<(std::ostream &os, const Matrix_3<T>& m) {
	for(typename Matrix_3<T>::size_type row = 0; row < m.row_count(); row++)
		os << m.row(row) << std::endl;
	return os;
}

using Matrix3 = Matrix_3<double>;

}