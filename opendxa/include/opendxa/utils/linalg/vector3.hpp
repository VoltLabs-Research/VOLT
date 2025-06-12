#ifndef __DXA_LINALG_VECTOR3_H
#define __DXA_LINALG_VECTOR3_H

#include <opendxa/utils/float_type.hpp>

class NullVector {};
extern NullVector NULL_VECTOR;

template<typename ValueType>
class Vector_3{
public:
	ValueType X;
	ValueType Y;
	ValueType Z;

	Vector_3() {}

    explicit Vector_3(ValueType val) { X = Y = Z = val; }

    Vector_3(ValueType x, ValueType y, ValueType z) : X(x), Y(y), Z(z) {}
    Vector_3(ValueType val[3]) : X(val[0]), Y(val[1]), Z(val[2]) {}
    Vector_3(NullVector) : X((ValueType)0), Y((ValueType)0), Z((ValueType)0) {}

	ValueType& operator[](size_t i) {
		DISLOCATIONS_ASSERT_GLOBAL(sizeof(Vector_3<ValueType>) == sizeof(ValueType) * 3);
		DISLOCATIONS_ASSERT_MSG_GLOBAL(i<3, "Vector3 operator[]", "Index out of range.");
		return (&X)[i];
	}

	const ValueType& operator[](size_t i) const {
		DISLOCATIONS_ASSERT_GLOBAL(sizeof(Vector_3<ValueType>) == sizeof(ValueType) * 3);
		DISLOCATIONS_ASSERT_MSG_GLOBAL(i<3, "Vector3 operator[]", "Index out of range.");
		return (&X)[i];
	}

	ValueType* data() {
        DISLOCATIONS_ASSERT_GLOBAL(sizeof(Vector_3<ValueType>) == sizeof(ValueType) * 3);
		return (ValueType*)this;
	}

	const ValueType* constData() const {
        DISLOCATIONS_ASSERT_GLOBAL(sizeof(Vector_3<ValueType>) == sizeof(ValueType) * 3);
		return (const ValueType*)this;
	}

	template<typename T2>
	operator Vector_3<T2>() const { return Vector_3<T2>((T2)X, (T2)Y, (T2)Z); }

	Vector_3<ValueType> operator-() const { return(Vector_3<ValueType>(-X, -Y, -Z)); }
	Vector_3<ValueType>& operator+=(const Vector_3<ValueType>& v) { X += v.X; Y += v.Y; Z += v.Z; return *this; }
	Vector_3<ValueType>& operator-=(const Vector_3<ValueType>& v) { X -= v.X; Y -= v.Y; Z -= v.Z; return *this; }
	Vector_3<ValueType>& operator*=(ValueType s) { X *= s; Y *= s; Z *= s; return *this; }
	Vector_3<ValueType>& operator/=(ValueType s) { X /= s; Y /= s; Z /= s; return *this; }

    const ValueType& x() const { return X; }
	const ValueType& y() const { return Y; }
	const ValueType& z() const { return Z; }

	void setx(const ValueType& value) { X = value; }
	void sety(const ValueType& value) { Y = value; }
	void setz(const ValueType& value) { Z = value; }

	bool operator==(const Vector_3<ValueType>& v) const { return (v.X==X) && (v.Y==Y) && (v.Z==Z); }
	bool operator!=(const Vector_3<ValueType>& v) const { return (v.X!=X) || (v.Y!=Y) || (v.Z!=Z); }
	bool operator==(const NullVector&) const { return (X==(ValueType)0) && (Y==(ValueType)0) && (Z==(ValueType)0); }
	bool operator!=(const NullVector&) const { return (X!=(ValueType)0) || (Y!=(ValueType)0) || (Z!=(ValueType)0); }
	bool equals(const Vector_3<ValueType>& v, ValueType tolerance = FLOATTYPE_EPSILON) const {
		DISLOCATIONS_ASSERT_GLOBAL(tolerance >= 0);
		return fabs(v.X - X) <= tolerance && fabs(v.Y - Y) <= tolerance && fabs(v.Z - Z) <= tolerance;
	}

	Vector_3<ValueType> operator+(const Vector_3<ValueType>& v) const { return Vector_3<ValueType>(X + v.X, Y + v.Y, Z + v.Z); }
	Vector_3<ValueType> operator-(const Vector_3<ValueType>& v) const { return Vector_3<ValueType>(X - v.X, Y - v.Y, Z - v.Z); }
	Vector_3<ValueType> operator*(ValueType s) const { return Vector_3<ValueType>(X*s, Y*s, Z*s); }
	Vector_3<ValueType> operator/(ValueType s) const { return Vector_3<ValueType>(X/s, Y/s, Z/s); }
};

template<typename ValueType>
inline Vector_3<ValueType> operator*(const ValueType& s, const Vector_3<ValueType>& v) { return v * s; }

template<typename ValueType>
inline ValueType DotProduct(const Vector_3<ValueType>& a, const Vector_3<ValueType>& b) {
	return a.X*b.X + a.Y*b.Y + a.Z*b.Z;
}

template<typename ValueType>
inline bool isDotProductPositive(const Vector_3<ValueType>& a, const Vector_3<ValueType>& b) {
	return a.X*b.X + a.Y*b.Y + a.Z*b.Z > 0;
}

template<typename ValueType>
inline Vector_3<ValueType> CrossProduct(const Vector_3<ValueType>& a, const Vector_3<ValueType>& b) {
	return Vector_3<ValueType>(a.Y * b.Z - a.Z * b.Y,
				       a.Z * b.X - a.X * b.Z,
				       a.X * b.Y - a.Y * b.X);
}

template<typename ValueType>
inline ValueType LengthSquared(const Vector_3<ValueType>& a) {
	return a.X*a.X + a.Y*a.Y + a.Z*a.Z;
}

template<typename ValueType>
inline ValueType Length(const Vector_3<ValueType>& a) {
	return (ValueType)sqrt(LengthSquared(a));
}

template<typename ValueType>
inline Vector_3<ValueType> Normalize(const Vector_3<ValueType>& a) {
	DISLOCATIONS_ASSERT_MSG_GLOBAL(a != NullVector(), "Normalize(const Vector3&)", "Cannot normalize a null vector.");
	return a / Length(a);
}

template<typename ValueType>
inline Vector_3<ValueType> NormalizeSafely(const Vector_3<ValueType>& a) {
	if(a.equals(NullVector(), FLOATTYPE_EPSILON)) return NullVector();
	return a / Length(a);
}

template<typename ValueType>
inline size_t MaxComponent(const Vector_3<ValueType>& a) {
    return ((a.X >= a.Y) ? ((a.X >= a.Z) ? 0 : 2) : ((a.Y >= a.Z) ? 1 : 2));
}

template<typename ValueType>
inline size_t MinComponent(const Vector_3<ValueType>& a) {
    return ((a.X <= a.Y) ? ((a.X <= a.Z) ? 0 : 2) : ((a.Y <= a.Z) ? 1 : 2));
}

template<typename ValueType>
inline size_t MaxAbsComponent(const Vector_3<ValueType>& a) {
    return ((fabs(a.X) >= fabs(a.Y)) ? ((fabs(a.X) >= fabs(a.Z)) ? 0 : 2) : ((fabs(a.Y) >= fabs(a.Z)) ? 1 : 2));
}

template<typename ValueType>
inline std::ostream& operator<<(std::ostream &os, const Vector_3<ValueType> &v) {
	return os << '(' << v.X << ' ' << v.Y  << ' ' << v.Z << ')';
}

typedef Vector_3<FloatType> Vector3;
typedef Vector_3<int> Vector3I;
extern Vector3 unitVectors[3];

#endif 

