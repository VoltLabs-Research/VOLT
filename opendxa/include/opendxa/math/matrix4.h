#pragma once

#include <opendxa/core/opendxa.h>
#include "vector3.h"
#include "point3.h"
#include "matrix3.h"
#include "vector4.h"
#include "affine_transformation.h"

namespace OpenDXA{

template<typename T>
class Matrix_4 : public std::array<Vector_4<T>,4>{
public:
	struct Zero {};
	struct Identity {};
	typedef T element_type;
	typedef Vector_4<T> column_type;

	using typename std::array<Vector_4<T>, 4>::size_type;
	using typename std::array<Vector_4<T>, 4>::difference_type;
	using typename std::array<Vector_4<T>, 4>::value_type;
	using typename std::array<Vector_4<T>, 4>::iterator;
	using typename std::array<Vector_4<T>, 4>::const_iterator;

public:
	Matrix_4() : std::array<Vector_4<T>, 4>{} {}
	 Matrix_4(T m11, T m12, T m13,
					   T m21, T m22, T m23,
					   T m31, T m32, T m33)
		: std::array<Vector_4<T>,4>{{{m11,m21,m31,T(0)},{m12,m22,m32,T(0)},{m13,m23,m33,T(0)}, typename Vector_4<T>::Zero()}} {}

		Matrix_4(
			T m11, T m12, T m13, T m14,
			T m21, T m22, T m23, T m24,
			T m31, T m32, T m33, T m34)
		: std::array<Vector_4<T>,4>{{
			Vector_4<T>(m11,m21,m31,T(0)),
			Vector_4<T>(m12,m22,m32,T(0)),
			Vector_4<T>(m13,m23,m33,T(0)),
			Vector_4<T>(m14,m24,m34,T(0))}} {}

	 Matrix_4(
						T m11, T m12, T m13, T m14,
						T m21, T m22, T m23, T m24,
						T m31, T m32, T m33, T m34,
						T m41, T m42, T m43, T m44)
		: std::array<Vector_4<T>,4>{{
			Vector_4<T>(m11,m21,m31,m41),
			Vector_4<T>(m12,m22,m32,m42),
			Vector_4<T>(m13,m23,m33,m43),
			Vector_4<T>(m14,m24,m34,m44)}} {}

	Matrix_4(const Vector_4<T>& c1, const Vector_4<T>& c2, const Vector_4<T>& c3, const Vector_4<T>& c4)
		: std::array<Vector_4<T>,4>{{c1, c2, c3, c4}} {}

	explicit  Matrix_4(const AffineTransformationT<T>& tm)
		: std::array<Vector_4<T>,4>{{
			Vector_4<T>(tm(0,0),tm(1,0),tm(2,0),T(0)),
			Vector_4<T>(tm(0,1),tm(1,1),tm(2,1),T(0)),
			Vector_4<T>(tm(0,2),tm(1,2),tm(2,2),T(0)),
			Vector_4<T>(tm(0,3),tm(1,3),tm(2,3),T(1))}} {}

	 Matrix_4(const Vector_3<T>& c1, const Vector_3<T>& c2, const Vector_3<T>& c3, const Vector_3<T>& c4)
		: std::array<Vector_4<T>,4>{{
			Vector_4<T>(c1[0],c1[1],c1[2],T(0)),
			Vector_4<T>(c2[0],c2[1],c2[2],T(0)),
			Vector_4<T>(c3[0],c3[1],c3[2],T(0)),
			Vector_4<T>(c4[0],c4[1],c4[2],T(1))}} {}

	Matrix_4(Zero)
		: std::array<Vector_4<T>,4>{{
			typename Vector_4<T>::Zero(),
			typename Vector_4<T>::Zero(),
			typename Vector_4<T>::Zero(),
			typename Vector_4<T>::Zero()}} {}

	 Matrix_4(Identity)
		: std::array<Vector_4<T>,4>{{
			Vector_4<T>(T(1),T(0),T(0),T(0)),
			Vector_4<T>(T(0),T(1),T(0),T(0)),
			Vector_4<T>(T(0),T(0),T(1),T(0)),
			Vector_4<T>(T(0),T(0),T(0),T(1))}} {}

	static  size_type row_count() { return 4; }
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

	void setRow(size_type row, const Vector_4<T>& v) {
		(*this)[0][row] = v[0];
		(*this)[1][row] = v[1];
		(*this)[2][row] = v[2];
		(*this)[3][row] = v[3];
	}

	const element_type* elements() const {
		return column(0).data();
	}

	element_type* elements() {
		return column(0).data();
	}

	void setZero() {
		for(size_type i = 0; i < col_count(); i++)
			column(i).setZero();
	}

	Matrix_4& operator=(Zero) {
		setZero();
		return *this;
	}

	void setIdentity() {
		(*this)[0][0] = T(1); (*this)[0][1] = T(0); (*this)[0][2] = T(0); (*this)[0][3] = T(0);
		(*this)[1][0] = T(0); (*this)[1][1] = T(1); (*this)[1][2] = T(0); (*this)[1][3] = T(0);
		(*this)[2][0] = T(0); (*this)[2][1] = T(0); (*this)[2][2] = T(1); (*this)[2][3] = T(0);
		(*this)[3][0] = T(0); (*this)[3][1] = T(0); (*this)[3][2] = T(0); (*this)[3][3] = T(1);
	}

	Matrix_4& operator=(Identity) {
		setIdentity();
		return *this;
	}

	inline bool equals(const Matrix_4& m, T tolerance = T(EPSILON)) const {
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
		return ((*this)[0][3] * (*this)[1][2] * (*this)[2][1] * (*this)[3][0]-(*this)[0][2] * (*this)[1][3] * (*this)[2][1] * (*this)[3][0]-(*this)[0][3] * (*this)[1][1] * (*this)[2][2] * (*this)[3][0]+(*this)[0][1] * (*this)[1][3] * (*this)[2][2] * (*this)[3][0]+
				(*this)[0][2] * (*this)[1][1] * (*this)[2][3] * (*this)[3][0]-(*this)[0][1] * (*this)[1][2] * (*this)[2][3] * (*this)[3][0]-(*this)[0][3] * (*this)[1][2] * (*this)[2][0] * (*this)[3][1]+(*this)[0][2] * (*this)[1][3] * (*this)[2][0] * (*this)[3][1]+
				(*this)[0][3] * (*this)[1][0] * (*this)[2][2] * (*this)[3][1]-(*this)[0][0] * (*this)[1][3] * (*this)[2][2] * (*this)[3][1]-(*this)[0][2] * (*this)[1][0] * (*this)[2][3] * (*this)[3][1]+(*this)[0][0] * (*this)[1][2] * (*this)[2][3] * (*this)[3][1]+
				(*this)[0][3] * (*this)[1][1] * (*this)[2][0] * (*this)[3][2]-(*this)[0][1] * (*this)[1][3] * (*this)[2][0] * (*this)[3][2]-(*this)[0][3] * (*this)[1][0] * (*this)[2][1] * (*this)[3][2]+(*this)[0][0] * (*this)[1][3] * (*this)[2][1] * (*this)[3][2]+
				(*this)[0][1] * (*this)[1][0] * (*this)[2][3] * (*this)[3][2]-(*this)[0][0] * (*this)[1][1] * (*this)[2][3] * (*this)[3][2]-(*this)[0][2] * (*this)[1][1] * (*this)[2][0] * (*this)[3][3]+(*this)[0][1] * (*this)[1][2] * (*this)[2][0] * (*this)[3][3]+
				(*this)[0][2] * (*this)[1][0] * (*this)[2][1] * (*this)[3][3]-(*this)[0][0] * (*this)[1][2] * (*this)[2][1] * (*this)[3][3]-(*this)[0][1] * (*this)[1][0] * (*this)[2][2] * (*this)[3][3]+(*this)[0][0] * (*this)[1][1] * (*this)[2][2] * (*this)[3][3]);
	}

	Matrix_4 inverse() const {
		T det = determinant();
		const T a1 = (*this)[0][0]; const T b1 = (*this)[0][1];
		const T c1 = (*this)[0][2]; const T d1 = (*this)[0][3];
		const T a2 = (*this)[1][0]; const T b2 = (*this)[1][1];
		const T c2 = (*this)[1][2]; const T d2 = (*this)[1][3];
		const T a3 = (*this)[2][0]; const T b3 = (*this)[2][1];
		const T c3 = (*this)[2][2]; const T d3 = (*this)[2][3];
		const T a4 = (*this)[3][0]; const T b4 = (*this)[3][1];
		const T c4 = (*this)[3][2]; const T d4 = (*this)[3][3];

	    return Matrix_4(
				det3x3( b2, b3, b4, c2, c3, c4, d2, d3, d4) / det,
			  - det3x3( a2, a3, a4, c2, c3, c4, d2, d3, d4) / det,
				det3x3( a2, a3, a4, b2, b3, b4, d2, d3, d4) / det,
			  - det3x3( a2, a3, a4, b2, b3, b4, c2, c3, c4) / det,

			  - det3x3( b1, b3, b4, c1, c3, c4, d1, d3, d4) / det,
				det3x3( a1, a3, a4, c1, c3, c4, d1, d3, d4) / det,
			  - det3x3( a1, a3, a4, b1, b3, b4, d1, d3, d4) / det,
				det3x3( a1, a3, a4, b1, b3, b4, c1, c3, c4) / det,

				det3x3( b1, b2, b4, c1, c2, c4, d1, d2, d4) / det,
			  - det3x3( a1, a2, a4, c1, c2, c4, d1, d2, d4) / det,
				det3x3( a1, a2, a4, b1, b2, b4, d1, d2, d4) / det,
			  - det3x3( a1, a2, a4, b1, b2, b4, c1, c2, c4) / det,

			  - det3x3( b1, b2, b3, c1, c2, c3, d1, d2, d3) / det,
				det3x3( a1, a2, a3, c1, c2, c3, d1, d2, d3) / det,
			  - det3x3( a1, a2, a3, b1, b2, b3, d1, d2, d3) / det,
				det3x3( a1, a2, a3, b1, b2, b3, c1, c2, c3) / det);
	}

private:
	static  inline T det2x2(T a, T b, T c, T d) { return (a * d - b * c); }
	static  inline T det3x3(T a1, T a2, T a3, T b1, T b2, T b3, T c1, T c2, T c3) {
		return (a1 * det2x2( b2, b3, c2, c3 )
			- b1 * det2x2( a2, a3, c2, c3 )
	        + c1 * det2x2( a2, a3, b2, b3 ));
	}

};

template<typename T>
inline Vector_4<T> operator*(const Matrix_4<T>& a, const Vector_4<T>& v){
	return {
		a(0,0)*v[0] + a(0,1)*v[1] + a(0,2)*v[2] + a(0,3)*v[3],
		a(1,0)*v[0] + a(1,1)*v[1] + a(1,2)*v[2] + a(1,3)*v[3],
		a(2,0)*v[0] + a(2,1)*v[1] + a(2,2)*v[2] + a(2,3)*v[3],
		a(3,0)*v[0] + a(3,1)*v[1] + a(3,2)*v[2] + a(3,3)*v[3]
	};
}

template<typename T>
inline Vector_3<T> operator*(const Matrix_4<T>& a, const Vector_3<T>& v){
	T s = a(3,0)*v[0] + a(3,1)*v[1] + a(3,2)*v[2] + a(3,3);
	return {
		(a(0,0)*v[0] + a(0,1)*v[1] + a(0,2)*v[2]) / s,
		(a(1,0)*v[0] + a(1,1)*v[1] + a(1,2)*v[2]) / s,
		(a(2,0)*v[0] + a(2,1)*v[1] + a(2,2)*v[2]) / s
	};
}

using Matrix4 = Matrix_4<double>;

}