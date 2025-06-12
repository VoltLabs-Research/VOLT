#ifndef __DXA_LINALG_MATRIX3_H
#define __DXA_LINALG_MATRIX3_H

#include <opendxa/utils/linalg/lin_alg.hpp>
#include <opendxa/utils/linalg/vector3.hpp>

class IdentityMatrix {};
extern IdentityMatrix IDENTITY;

class NullMatrix {};
extern NullMatrix NULL_MATRIX;

class Quaternion;
class Scaling;

class Matrix3{
private:
	FloatType m[3][3];

public:
	Matrix3() {}
	Matrix3(FloatType m11, FloatType m12, FloatType m13,
			FloatType m21, FloatType m22, FloatType m23,
			FloatType m31, FloatType m32, FloatType m33){
		m[0][0] = m11; m[0][1] = m21; m[0][2] = m31;
		m[1][0] = m12; m[1][1] = m22; m[1][2] = m32;
		m[2][0] = m13; m[2][1] = m23; m[2][2] = m33;
	}

	explicit Matrix3(const Vector3& col1, const Vector3& col2, const Vector3& col3){
		m[0][0] = col1.X; m[0][1] = col1.Y; m[0][2] = col1.Z;
		m[1][0] = col2.X; m[1][1] = col2.Y; m[1][2] = col2.Z;
		m[2][0] = col3.X; m[2][1] = col3.Y; m[2][2] = col3.Z;
	}

	explicit Matrix3(const Vector3 columns[3]) {
		memcpy(m, columns, sizeof(m));
	}

	Matrix3(const NullMatrix&) {
		m[0][0] = 0; m[0][1] = 0; m[0][2] = 0;
		m[1][0] = 0; m[1][1] = 0; m[1][2] = 0;
		m[2][0] = 0; m[2][1] = 0; m[2][2] = 0;
	}

	Matrix3(const IdentityMatrix&) {
		m[0][0] = 1.0; m[0][1] = 0.0; m[0][2] = 0.0;
		m[1][0] = 0.0; m[1][1] = 1.0; m[1][2] = 0.0;
		m[2][0] = 0.0; m[2][1] = 0.0; m[2][2] = 1.0;
	}

	FloatType operator()(size_t row, size_t col) const {
		DISLOCATIONS_ASSERT_MSG_GLOBAL(row<3, "Matrix3", "Row index out of range");
		DISLOCATIONS_ASSERT_MSG_GLOBAL(col<3, "Matrix3", "Column index out of range");
		return m[col][row];
	}

	FloatType& operator()(size_t row, size_t col) {
		DISLOCATIONS_ASSERT_MSG_GLOBAL(row<3, "Matrix3", "Row index out of range");
		DISLOCATIONS_ASSERT_MSG_GLOBAL(col<3, "Matrix3", "Column index out of range");
		return m[col][row];
	}

	const Vector3& column(size_t i) const {
		DISLOCATIONS_ASSERT_MSG_GLOBAL(i<3, "Matrix3::column()", "Column index out of range.");
		DISLOCATIONS_ASSERT_GLOBAL(sizeof(m) == sizeof(Vector3)*3);
		return *(const Vector3*)m[i];
	}

	Vector3& column(size_t i) {
		DISLOCATIONS_ASSERT_MSG_GLOBAL(i<3, "Matrix3::column()", "Column index out of range.");
		DISLOCATIONS_ASSERT_GLOBAL(sizeof(m) == sizeof(Vector3)*3);
		return *(Vector3*)m[i];
	}

	const Vector3& getColumn(size_t i) const { return column(i); }
	void setColumn(size_t i, const Vector3& c) { column(i) = c; }

	Vector3 row(size_t i) const {
		DISLOCATIONS_ASSERT_MSG_GLOBAL(i<3, "Matrix3::row()", "Row index out of range.");
		return Vector3(m[0][i], m[1][i], m[2][i]);
	}

	void setRow(size_t i, const Vector3& r) {
		DISLOCATIONS_ASSERT_MSG_GLOBAL(i<3, "Matrix3::setRow()", "Row index out of range.");
		m[0][i] = r.X; m[1][i] = r.Y; m[2][i] = r.Z;
	}

	Matrix3 inverse() const {
		const FloatType det = determinant();
		DISLOCATIONS_ASSERT_MSG_GLOBAL(det != 0, "Matrix3::inverse()", "Singular matrix cannot be inverted: determinant is zero.");
		return Matrix3( (m[1][1]*m[2][2] - m[1][2]*m[2][1])/det,
						(m[2][0]*m[1][2] - m[1][0]*m[2][2])/det,
						(m[1][0]*m[2][1] - m[1][1]*m[2][0])/det,
						(m[2][1]*m[0][2] - m[0][1]*m[2][2])/det,
						(m[0][0]*m[2][2] - m[2][0]*m[0][2])/det,
						(m[0][1]*m[2][0] - m[0][0]*m[2][1])/det,
						(m[0][1]*m[1][2] - m[1][1]*m[0][2])/det,
						(m[0][2]*m[1][0] - m[0][0]*m[1][2])/det,
						(m[0][0]*m[1][1] - m[1][0]*m[0][1])/det);
	}

	FloatType determinant() const {
		return((m[0][0]*m[1][1] - m[0][1]*m[1][0])*(m[2][2])
			  -(m[0][0]*m[1][2] - m[0][2]*m[1][0])*(m[2][1])
			  +(m[0][1]*m[1][2] - m[0][2]*m[1][1])*(m[2][0]));
	}

	Matrix3 transposed() const {
		return Matrix3(
			m[0][0], m[0][1], m[0][2],
			m[1][0], m[1][1], m[1][2],
			m[2][0], m[2][1], m[2][2]);
	}

	bool isRotationMatrix() const {
		if(fabs(m[0][0]*m[1][0] + m[0][1]*m[1][1] + m[0][2]*m[1][2]) > FLOATTYPE_EPSILON) return false;
		if(fabs(m[0][0]*m[2][0] + m[0][1]*m[2][1] + m[0][2]*m[2][2]) > FLOATTYPE_EPSILON) return false;
		if(fabs(m[1][0]*m[2][0] + m[1][1]*m[2][1] + m[1][2]*m[2][2]) > FLOATTYPE_EPSILON) return false;
		if(fabs(m[0][0]*m[0][0] + m[0][1]*m[0][1] + m[0][2]*m[0][2] - 1.0) > FLOATTYPE_EPSILON) return false;
		if(fabs(m[1][0]*m[1][0] + m[1][1]*m[1][1] + m[1][2]*m[1][2] - 1.0) > FLOATTYPE_EPSILON) return false;
		if(fabs(m[2][0]*m[2][0] + m[2][1]*m[2][1] + m[2][2]*m[2][2] - 1.0) > FLOATTYPE_EPSILON) return false;
		return(fabs(determinant() - 1.0) <= FLOATTYPE_EPSILON);
	}

	bool equals(const Matrix3& m, FloatType tolerance = FLOATTYPE_EPSILON) const {
		for(int i=0; i<3; i++)
			for(int j=0; j<3; j++)
				if(fabs(m(i,j) - (*this)(i,j)) > tolerance)
					return false;
		return true;
	}

	static Matrix3 rotation(const Quaternion& q);
	static Matrix3 scaling(const Scaling& scaling);
	friend Vector3 operator*(const Matrix3& a, const Vector3& v);
	friend Point3 operator*(const Matrix3& a, const Point3& v);
	friend Matrix3 operator*(const Matrix3& a, const Matrix3& b);
	friend Matrix3 operator*(const Matrix3& a, FloatType s);
	friend Matrix3 operator-(const Matrix3& a, const Matrix3& b);
	friend Matrix3 operator+(const Matrix3& a, const Matrix3& b);

	friend class Matrix4;
};

inline Vector3 operator*(const Matrix3& a, const Vector3& v){
	return Vector3(a.m[0][0]*v.X + a.m[1][0]*v.Y + a.m[2][0]*v.Z,
				   a.m[0][1]*v.X + a.m[1][1]*v.Y + a.m[2][1]*v.Z,
				   a.m[0][2]*v.X + a.m[1][2]*v.Y + a.m[2][2]*v.Z);
}

inline Point3 operator*(const Matrix3& a, const Point3& v){
	return Point3(a.m[0][0]*v.X + a.m[1][0]*v.Y + a.m[2][0]*v.Z,
				  a.m[0][1]*v.X + a.m[1][1]*v.Y + a.m[2][1]*v.Z,
				  a.m[0][2]*v.X + a.m[1][2]*v.Y + a.m[2][2]*v.Z);
}

inline Matrix3 operator*(const Matrix3& a, const Matrix3& b){
	Matrix3 m;
	for(size_t i=0; i<3; i++) {
		for(size_t j=0; j<3; j++) {
			FloatType v(0);
			for(size_t k=0; k<3; k++)
				v += a(i, k) * b(k, j);
			m(i, j) = v;
		}
	}
	return m;
}

inline Matrix3 operator*(const Matrix3& a, FloatType s){
	Matrix3 b;
	for(size_t i=0; i<3; i++)
		for(size_t j=0; j<3; j++)
			b.m[i][j] = a.m[i][j] * s;
	return b;
}

inline Matrix3 operator*(FloatType s, const Matrix3& a) { return a * s; }

inline Matrix3 operator-(const Matrix3& a, const Matrix3& b){
	Matrix3 m;
	for(size_t i=0; i<3; i++)
		for(size_t j=0; j<3; j++)
			m(i, j) = a(i,j) - b(i,j);
	return m;
}

inline Matrix3 operator+(const Matrix3& a, const Matrix3& b){
	Matrix3 m;
	for(size_t i=0; i<3; i++)
		for(size_t j=0; j<3; j++)
			m(i, j) = a(i,j) + b(i,j);
	return m;
}

inline std::ostream& operator<<(std::ostream &os, const Matrix3& m) {
	return os << m.row(0) << std::endl << m.row(1) << std::endl << m.row(2) << std::endl;
}

#endif 