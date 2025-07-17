#pragma once

#include <opendxa/core/opendxa.h>
#include "vector3.h"
#include "vector4.h"
#include "point3.h"
#include "matrix3.h"

template<typename T> class Matrix_3;
template<typename T> class RotationT;
template<typename T> class QuaternionT;
template<typename T> class ScalingT;

namespace OpenDXA{ 

template<typename T>
class AffineTransformationT : public std::array<Vector_3<T>,4>{
public:
	struct Zero {};
	struct Identity {};
	typedef T element_type;
	typedef Vector_3<T> column_type;

	using typename std::array<Vector_3<T>, 4>::size_type;
	using typename std::array<Vector_3<T>, 4>::difference_type;
	using typename std::array<Vector_3<T>, 4>::value_type;
	using typename std::array<Vector_3<T>, 4>::iterator;
	using typename std::array<Vector_3<T>, 4>::const_iterator;

public:
	AffineTransformationT() {}
	AffineTransformationT(
						T m11, T m12, T m13,
					    T m21, T m22, T m23,
					    T m31, T m32, T m33)
		: std::array<Vector_3<T>,4>{{
			Vector_3<T>(m11,m21,m31),
			Vector_3<T>(m12,m22,m32),
			Vector_3<T>(m13,m23,m33),
			typename Vector_3<T>::Zero()}} {}

	AffineTransformationT(
						T m11, T m12, T m13, T m14,
					    T m21, T m22, T m23, T m24,
					    T m31, T m32, T m33, T m34)
		: std::array<Vector_3<T>,4>{{
			Vector_3<T>(m11,m21,m31),
			Vector_3<T>(m12,m22,m32),
			Vector_3<T>(m13,m23,m33),
			Vector_3<T>(m14,m24,m34)}} {}

	AffineTransformationT(const column_type& c1, const column_type& c2, const column_type& c3, const column_type& c4)
		: std::array<Vector_3<T>,4>{{c1, c2, c3, c4}} {}

	AffineTransformationT(Zero)
		: std::array<Vector_3<T>,4>{{
			typename Vector_3<T>::Zero(),
			typename Vector_3<T>::Zero(),
			typename Vector_3<T>::Zero(),
			typename Vector_3<T>::Zero()}} {}

	AffineTransformationT(Identity)
		: std::array<Vector_3<T>,4>{{
			Vector_3<T>(T(1),T(0),T(0)),
			Vector_3<T>(T(0),T(1),T(0)),
			Vector_3<T>(T(0),T(0),T(1)),
			Vector_3<T>(T(0),T(0),T(0))}} {}

	explicit  AffineTransformationT(const Matrix_3<T>& tm)
		: std::array<Vector_3<T>,4>{{tm.column(0), tm.column(1), tm.column(2), typename Vector_3<T>::Zero()}} {}

	template<typename U>
	explicit operator AffineTransformationT<U>() const {
		return AffineTransformationT<U>(
				static_cast<U>((*this)(0,0)), static_cast<U>((*this)(0,1)), static_cast<U>((*this)(0,2)), static_cast<U>((*this)(0,3)),
				static_cast<U>((*this)(1,0)), static_cast<U>((*this)(1,1)), static_cast<U>((*this)(1,2)), static_cast<U>((*this)(1,3)),
				static_cast<U>((*this)(2,0)), static_cast<U>((*this)(2,1)), static_cast<U>((*this)(2,2)), static_cast<U>((*this)(2,3)));
	}

	static  size_type row_count() { return 3; }
	static  size_type col_count() { return 4; }

	inline  T operator()(size_type row, size_type col) const {
		return (*this)[col][row];
	}

	inline T& operator()(size_type row, size_type col) {
		return (*this)[col][row];
	}

	inline  const column_type& column(size_type col) const {
		return (*this)[col];
	}

	inline column_type& column(size_type col) {
		return (*this)[col];
	}

	Vector_4<T> row(size_type row) const {
		return { (*this)[0][row], (*this)[1][row], (*this)[2][row], (*this)[3][row] };
	}

	const column_type& translation() const { return column(3); }

	column_type& translation() { return column(3); }

	void setZero() {
		for(size_type i = 0; i < col_count(); i++)
			(*this)[i].setZero();
	}

	AffineTransformationT& operator=(Zero) {
		setZero();
		return *this;
	}

	void setIdentity() {
		(*this)[0] = Vector_3<T>(T(1),T(0),T(0));
		(*this)[1] = Vector_3<T>(T(0),T(1),T(0));
		(*this)[2] = Vector_3<T>(T(0),T(0),T(1));
		(*this)[3].setZero();
	}

	AffineTransformationT& operator=(Identity) {
		setIdentity();
		return *this;
	}

	const element_type* elements() const {
		return column(0).data();
	}

	element_type* elements() {
		return column(0).data();
	}

	bool operator==(const AffineTransformationT& b) const {
		return (b[0] == (*this)[0]) && (b[1] == (*this)[1]) && (b[2] == (*this)[2]) && (b[3] == (*this)[3]);
	}

	bool operator!=(const AffineTransformationT& b) const {
		return !(*this == b);
	}

	inline bool equals(const AffineTransformationT& m, T tolerance = T(EPSILON)) const {
		for(size_type i = 0; i < col_count(); i++)
			if(!column(i).equals(m.column(i), tolerance)) return false;
		return true;
	}

	inline bool isZero(T tolerance = T(EPSILON)) const {
		for(size_type i = 0; i < col_count(); i++)
			if(!column(i).isZero(tolerance)) return false;
		return true;
	}

	inline T determinant() const {
		return(((*this)[0][0]*(*this)[1][1] - (*this)[0][1]*(*this)[1][0])*((*this)[2][2])
			  -((*this)[0][0]*(*this)[1][2] - (*this)[0][2]*(*this)[1][0])*((*this)[2][1])
			  +((*this)[0][1]*(*this)[1][2] - (*this)[0][2]*(*this)[1][1])*((*this)[2][0]));
	}

	AffineTransformationT inverse() const {
		T det = determinant();
		AffineTransformationT inv(
						((*this)[1][1]*(*this)[2][2] - (*this)[1][2]*(*this)[2][1])/det,
						((*this)[2][0]*(*this)[1][2] - (*this)[1][0]*(*this)[2][2])/det,
						((*this)[1][0]*(*this)[2][1] - (*this)[1][1]*(*this)[2][0])/det,
						T(0),
						((*this)[2][1]*(*this)[0][2] - (*this)[0][1]*(*this)[2][2])/det,
						((*this)[0][0]*(*this)[2][2] - (*this)[2][0]*(*this)[0][2])/det,
						((*this)[0][1]*(*this)[2][0] - (*this)[0][0]*(*this)[2][1])/det,
						T(0),
						((*this)[0][1]*(*this)[1][2] - (*this)[1][1]*(*this)[0][2])/det,
						((*this)[0][2]*(*this)[1][0] - (*this)[0][0]*(*this)[1][2])/det,
						((*this)[0][0]*(*this)[1][1] - (*this)[1][0]*(*this)[0][1])/det,
						T(0));
		inv.translation() = inv * (-translation());
		return inv;
	}

	bool inverse(AffineTransformationT& result, T epsilon = T(1e-16)) const {
		T det = determinant();
		if(std::abs(det) <= epsilon) return false;
		result = AffineTransformationT(
						((*this)[1][1]*(*this)[2][2] - (*this)[1][2]*(*this)[2][1])/det,
						((*this)[2][0]*(*this)[1][2] - (*this)[1][0]*(*this)[2][2])/det,
						((*this)[1][0]*(*this)[2][1] - (*this)[1][1]*(*this)[2][0])/det,
						T(0),
						((*this)[2][1]*(*this)[0][2] - (*this)[0][1]*(*this)[2][2])/det,
						((*this)[0][0]*(*this)[2][2] - (*this)[2][0]*(*this)[0][2])/det,
						((*this)[0][1]*(*this)[2][0] - (*this)[0][0]*(*this)[2][1])/det,
						T(0),
						((*this)[0][1]*(*this)[1][2] - (*this)[1][1]*(*this)[0][2])/det,
						((*this)[0][2]*(*this)[1][0] - (*this)[0][0]*(*this)[1][2])/det,
						((*this)[0][0]*(*this)[1][1] - (*this)[1][0]*(*this)[0][1])/det,
						T(0));
		result.translation() = result * (-translation());
		return true;
	}

	inline  T prodrow(const Point_3<T>& p, typename Point_3<T>::size_type index) const {
		return (*this)[0][index] * p[0] + (*this)[1][index] * p[1] + (*this)[2][index] * p[2] + (*this)[3][index];
	}

	inline  T prodrow(const Vector_3<T>& v, typename Vector_3<T>::size_type index) const {
		return (*this)[0][index] * v[0] + (*this)[1][index] * v[1] + (*this)[2][index] * v[2];
	}

	static AffineTransformationT rotation(const RotationT<T>& rot);
	static AffineTransformationT rotation(const QuaternionT<T>& q);
	static  AffineTransformationT translation(const Vector_3<T>& t) {
		return AffineTransformationT(T(1), T(0), T(0), t.x(),
						 	 	 	 T(0), T(1), T(0), t.y(),
						 	 	 	 T(0), T(0), T(1), t.z());
	}

	static  AffineTransformationT scaling(T s) {
		return AffineTransformationT(
						 s, T(0), T(0), T(0),
						 T(0),    s, T(0), T(0),
						 T(0), T(0),    s, T(0));
	}

	static AffineTransformationT scaling(const ScalingT<T>& scaling);

	static AffineTransformationT lookAlong(const Point_3<T>& camera, const Vector_3<T>& direction, const Vector_3<T>& upVector) {
		auto zaxis = -direction.normalized();
		auto xaxis = upVector.cross(zaxis);
		if(xaxis == typename Vector_3<T>::Zero()) {
			xaxis = Vector_3<T>(0,1,0).cross(zaxis);
			if(xaxis == typename Vector_3<T>::Zero()) {
				xaxis = Vector_3<T>(0,0,1).cross(zaxis);
				//assert(xaxis != typename Vector_3<T>::Zero());
			}
		}
		xaxis.normalize();
		auto yaxis = zaxis.cross(xaxis);

		return AffineTransformationT{
					xaxis.x(), xaxis.y(), xaxis.z(), -xaxis.dot(camera - typename Point_3<T>::Origin()),
					yaxis.x(), yaxis.y(), yaxis.z(), -yaxis.dot(camera - typename Point_3<T>::Origin()),
					zaxis.x(), zaxis.y(), zaxis.z(), -zaxis.dot(camera - typename Point_3<T>::Origin()) };
	}

	bool isOrthogonalMatrix(T epsilon = T(EPSILON)) const {
		return
			translation().isZero(epsilon) &&
			(std::abs((*this)[0][0]*(*this)[1][0] + (*this)[0][1]*(*this)[1][1] + (*this)[0][2]*(*this)[1][2]) <= epsilon) &&
			(std::abs((*this)[0][0]*(*this)[2][0] + (*this)[0][1]*(*this)[2][1] + (*this)[0][2]*(*this)[2][2]) <= epsilon) &&
			(std::abs((*this)[1][0]*(*this)[2][0] + (*this)[1][1]*(*this)[2][1] + (*this)[1][2]*(*this)[2][2]) <= epsilon) &&
			(std::abs((*this)[0][0]*(*this)[0][0] + (*this)[0][1]*(*this)[0][1] + (*this)[0][2]*(*this)[0][2] - T(1)) <= epsilon) &&
			(std::abs((*this)[1][0]*(*this)[1][0] + (*this)[1][1]*(*this)[1][1] + (*this)[1][2]*(*this)[1][2] - T(1)) <= epsilon) &&
			(std::abs((*this)[2][0]*(*this)[2][0] + (*this)[2][1]*(*this)[2][1] + (*this)[2][2]*(*this)[2][2] - T(1)) <= epsilon);
	}
};

template<typename T>
inline  Vector_3<T> operator*(const AffineTransformationT<T>& m, const Vector_3<T>& v){
	return Vector_3<T>{ m(0,0) * v[0] + m(0,1) * v[1] + m(0,2) * v[2],
						m(1,0) * v[0] + m(1,1) * v[1] + m(1,2) * v[2],
						m(2,0) * v[0] + m(2,1) * v[1] + m(2,2) * v[2] };
}

template<typename T>
inline  Point_3<T> operator*(const AffineTransformationT<T>& m, const Point_3<T>& p){
	return Point_3<T>{ m(0,0) * p[0] + m(0,1) * p[1] + m(0,2) * p[2] + m(0,3),
						m(1,0) * p[0] + m(1,1) * p[1] + m(1,2) * p[2] + m(1,3),
						m(2,0) * p[0] + m(2,1) * p[1] + m(2,2) * p[2] + m(2,3) };
}

template<typename T>
inline  AffineTransformationT<T> operator*(const AffineTransformationT<T>& a, const AffineTransformationT<T>& b){
	return AffineTransformationT<T>(
			a(0,0)*b(0,0) + a(0,1)*b(1,0) + a(0,2)*b(2,0),
			a(0,0)*b(0,1) + a(0,1)*b(1,1) + a(0,2)*b(2,1),
			a(0,0)*b(0,2) + a(0,1)*b(1,2) + a(0,2)*b(2,2),
			a(0,0)*b(0,3) + a(0,1)*b(1,3) + a(0,2)*b(2,3) + a(0,3),

			a(1,0)*b(0,0) + a(1,1)*b(1,0) + a(1,2)*b(2,0),
			a(1,0)*b(0,1) + a(1,1)*b(1,1) + a(1,2)*b(2,1),
			a(1,0)*b(0,2) + a(1,1)*b(1,2) + a(1,2)*b(2,2),
			a(1,0)*b(0,3) + a(1,1)*b(1,3) + a(1,2)*b(2,3) + a(1,3),

			a(2,0)*b(0,0) + a(2,1)*b(1,0) + a(2,2)*b(2,0),
			a(2,0)*b(0,1) + a(2,1)*b(1,1) + a(2,2)*b(2,1),
			a(2,0)*b(0,2) + a(2,1)*b(1,2) + a(2,2)*b(2,2),
			a(2,0)*b(0,3) + a(2,1)*b(1,3) + a(2,2)*b(2,3) + a(2,3)
	);
}

template<typename T>
inline  AffineTransformationT<T> operator*(const AffineTransformationT<T>& a, T s){
	return { a.column(0)*s, a.column(1)*s, a.column(2)*s, a.column(3)*s };
}

template<typename T>
inline  AffineTransformationT<T> operator*(T s, const AffineTransformationT<T>& a){
	return a * s;
}

template<typename T>
inline  AffineTransformationT<T> operator*(const Matrix_3<T>& a, const AffineTransformationT<T>& b){
	return AffineTransformationT<T>(
			a(0,0)*b(0,0) + a(0,1)*b(1,0) + a(0,2)*b(2,0),
			a(0,0)*b(0,1) + a(0,1)*b(1,1) + a(0,2)*b(2,1),
			a(0,0)*b(0,2) + a(0,1)*b(1,2) + a(0,2)*b(2,2),
			a(0,0)*b(0,3) + a(0,1)*b(1,3) + a(0,2)*b(2,3),

			a(1,0)*b(0,0) + a(1,1)*b(1,0) + a(1,2)*b(2,0),
			a(1,0)*b(0,1) + a(1,1)*b(1,1) + a(1,2)*b(2,1),
			a(1,0)*b(0,2) + a(1,1)*b(1,2) + a(1,2)*b(2,2),
			a(1,0)*b(0,3) + a(1,1)*b(1,3) + a(1,2)*b(2,3),

			a(2,0)*b(0,0) + a(2,1)*b(1,0) + a(2,2)*b(2,0),
			a(2,0)*b(0,1) + a(2,1)*b(1,1) + a(2,2)*b(2,1),
			a(2,0)*b(0,2) + a(2,1)*b(1,2) + a(2,2)*b(2,2),
			a(2,0)*b(0,3) + a(2,1)*b(1,3) + a(2,2)*b(2,3)
	);
}

template<typename T>
inline AffineTransformationT<T> operator*(const AffineTransformationT<T>& a, const Matrix_3<T>& b){
	return AffineTransformationT<T>(
			a(0,0)*b(0,0) + a(0,1)*b(1,0) + a(0,2)*b(2,0),
			a(0,0)*b(0,1) + a(0,1)*b(1,1) + a(0,2)*b(2,1),
			a(0,0)*b(0,2) + a(0,1)*b(1,2) + a(0,2)*b(2,2),
			a(0,3),

			a(1,0)*b(0,0) + a(1,1)*b(1,0) + a(1,2)*b(2,0),
			a(1,0)*b(0,1) + a(1,1)*b(1,1) + a(1,2)*b(2,1),
			a(1,0)*b(0,2) + a(1,1)*b(1,2) + a(1,2)*b(2,2),
			a(1,3),

			a(2,0)*b(0,0) + a(2,1)*b(1,0) + a(2,2)*b(2,0),
			a(2,0)*b(0,1) + a(2,1)*b(1,1) + a(2,2)*b(2,1),
			a(2,0)*b(0,2) + a(2,1)*b(1,2) + a(2,2)*b(2,2),
			a(2,3)
	);
}

template<typename T>
inline AffineTransformationT<T> AffineTransformationT<T>::rotation(const RotationT<T>& rot){
	T c = cos(rot.angle());
	T s = sin(rot.angle());
	T t = T(1) - c;
    const auto& a = rot.axis();

	return AffineTransformationT<T>(	t * a.x() * a.x() + c,       t * a.x() * a.y() - s * a.z(), t * a.x() * a.z() + s * a.y(), 0.0,
					t * a.x() * a.y() + s * a.z(), t * a.y() * a.y() + c,       t * a.y() * a.z() - s * a.x(), 0.0,
					t * a.x() * a.z() - s * a.y(), t * a.y() * a.z() + s * a.x(), t * a.z() * a.z() + c      , 0.0);
}

template<typename T>
inline AffineTransformationT<T> AffineTransformationT<T>::rotation(const QuaternionT<T>& q){
	return AffineTransformationT<T>(T(1) - T(2)*(q.y()*q.y() + q.z()*q.z()),       T(2)*(q.x()*q.y() - q.w()*q.z()),       T(2)*(q.x()*q.z() + q.w()*q.y()), T(0),
						T(2)*(q.x()*q.y() + q.w()*q.z()), T(1) - T(2)*(q.x()*q.x() + q.z()*q.z()),       T(2)*(q.y()*q.z() - q.w()*q.x()), T(0),
						T(2)*(q.x()*q.z() - q.w()*q.y()),       T(2)*(q.y()*q.z() + q.w()*q.x()), T(1) - T(2)*(q.x()*q.x() + q.y()*q.y()), T(0));
}

template<typename T>
inline AffineTransformationT<T> AffineTransformationT<T>::scaling(const ScalingT<T>& scaling){
	Matrix_3<T> U = Matrix_3<T>::rotation(scaling.Q);
	Matrix_3<T> K = Matrix_3<T>(scaling.S.x(), T(0), T(0),
								T(0), scaling.S.y(), T(0),
								T(0), T(0), scaling.S.z());
	return AffineTransformationT<T>(U * K * U.transposed());
}

using AffineTransformation = AffineTransformationT<double>;

}