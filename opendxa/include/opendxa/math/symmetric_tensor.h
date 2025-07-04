#pragma once

#include <opendxa/core/opendxa.h>
#include "matrix3.h"

namespace OpenDXA{
template<typename T>
class SymmetricTensor2T : public std::array<T, 6>{
public:
	struct Zero {};
	struct Identity {};
	typedef T value_type;
	typedef std::size_t size_type;

public:
	SymmetricTensor2T()
	: std::array<T,6>{{T(0),T(0),T(0),T(0),T(0),T(0)}} {}


	SymmetricTensor2T(T xx, T yy, T zz, T xy, T xz, T yz)
		: std::array<T, 6>{{xx,yy,zz,xy,xz,yz}} {}

	 SymmetricTensor2T(Zero)
		: std::array<T, 6>{{T(0),T(0),T(0),T(0),T(0),T(0)}} {}

	 SymmetricTensor2T(Identity)
		: std::array<T, 6>{{T(1), T(1), T(1), T(0), T(0), T(0)}} {}

	template<typename U>
	explicit operator SymmetricTensor2T<U>() const {
		return SymmetricTensor2T<U>(
				static_cast<U>(xx()), static_cast<U>(yy()), static_cast<U>(zz()),
				static_cast<U>(xy()), static_cast<U>(xz()), static_cast<U>(yz()));
	}

	static  size_type row_count() { return 3; }
	static  size_type col_count() { return 3; }

	inline const T& operator()(size_type row, size_type col) const {
		if(row == col) return (*this)[row];
		if(row > col) std::swap(row, col);
		if(row == 0) {
			if(col == 1) return xy();
			else return xz();
		}
		else return yz();
	}

	inline T& operator()(size_type row, size_type col) {
		if(row == col) return (*this)[row];
		if(row > col) std::swap(row, col);
		if(row == 0) {
			if(col == 1) return xy();
			else return xz();
		}
		else return yz();
	}

	T xx() const { return (*this)[0]; }
	T yy() const { return (*this)[1]; }
	T zz() const { return (*this)[2]; }
	T xy() const { return (*this)[3]; }
	T xz() const { return (*this)[4]; }
	T yz() const { return (*this)[5]; }

	T& xx() { return (*this)[0]; }
	T& yy() { return (*this)[1]; }
	T& zz() { return (*this)[2]; }
	T& xy() { return (*this)[3]; }
	T& xz() { return (*this)[4]; }
	T& yz() { return (*this)[5]; }

};

template<typename T>
inline SymmetricTensor2T<T> operator+(const SymmetricTensor2T<T>& A, const SymmetricTensor2T<T>& B){
	return { A[0]+B[0], A[1]+B[1], A[2]+B[2], A[3]+B[3], A[4]+B[4], A[5]+B[5] };
}

template<typename T>
inline SymmetricTensor2T<T> operator-(const SymmetricTensor2T<T>& A, const SymmetricTensor2T<T>& B){
	return { A[0]-B[0], A[1]-B[1], A[2]-B[2], A[3]-B[3], A[4]-B[4], A[5]-B[5] };
}

template<typename T>
inline SymmetricTensor2T<T> operator-(const SymmetricTensor2T<T>& A, typename SymmetricTensor2T<T>::Identity){
	return { A[0]-T(1), A[1]-T(1), A[2]-T(1), A[3], A[4], A[5] };
}

template<typename T>
inline SymmetricTensor2T<T> operator-(typename SymmetricTensor2T<T>::Identity, const SymmetricTensor2T<T>& B){
	return { T(1)-B[0], T(1)-B[1], T(1)-B[2], B[3], B[4], B[5] };
}

template<typename T>
inline SymmetricTensor2T<T> operator*(const SymmetricTensor2T<T>& A, T s){
	return { A[0]*s, A[1]*s, A[2]*s, A[3]*s, A[4]*s, A[5]*s };
}

template<typename T>
inline SymmetricTensor2T<T> operator*(T s, const SymmetricTensor2T<T>& A){
	return { A[0]*s, A[1]*s, A[2]*s, A[3]*s, A[4]*s, A[5]*s };
}

template<typename T>
inline SymmetricTensor2T<T> Product_AtA(const Matrix_3<T>& A){
	SymmetricTensor2T<T> S;
	for(size_t i = 0; i < 3; i++){
		for(size_t j = 0; j <= i; j++){
			T b = 0;
			for(size_t k = 0; k < 3; k++){
				b += A(k,i) * A(k,j);
			}
			S(i,j) = b;
		}
	}
	return S;
}

template<typename T>
inline SymmetricTensor2T<T> Product_AAt(const Matrix_3<T>& A){
	SymmetricTensor2T<T> S;
	for(size_t i = 0; i < 3; i++){
		for(size_t j = 0; j <= i; j++){
			T b = 0;
			for(size_t k = 0; k < 3; k++){
				b += A(i,k) * A(j,k);
			}
			S(i,j) = b;
		}
	}
	return S;
}

template<typename T>
inline SymmetricTensor2T<T> TripleProduct_ASAt(const Matrix_3<T>& A, const SymmetricTensor2T<T>& S){
	Matrix_3<T> AS = A * S;
	SymmetricTensor2T<T> R;
	for(size_t i = 0; i < 3; i++){
		for(size_t j = 0; j <= i; j++){
			T b = 0;
			for(size_t k=0; k<3; k++){
				b += AS(i,k) * A(j,k);
			}
			R(i,j) = b;
		}
	}
	return R;
}

template<typename T>
inline T DoubleContraction(const SymmetricTensor2T<T>& A, const SymmetricTensor2T<T>& B){
	T d = 0;
	for(size_t i = 0; i < 3; i++){
		d += A[i] * B[i];
	}

	for(size_t i = 3; i < 6; i++){
		d += T(2) * A[i] * B[i];
	}

	return d;
}

template<typename T>
inline std::ostream& operator<<(std::ostream &os, const SymmetricTensor2T<T>& m){
	for(typename SymmetricTensor2T<T>::size_type row = 0; row < m.row_count(); row++){
		for(typename SymmetricTensor2T<T>::size_type col = 0; col < m.col_count(); col++){
			os << m(row, col) << " ";
		}
		os << std::endl;
	}
	return os;
}

using SymmetricTensor2 = SymmetricTensor2T<double>;

}