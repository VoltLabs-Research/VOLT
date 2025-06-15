#ifndef OPENDXA_LINALG_POINT3_H
#define OPENDXA_LINALG_POINT3_H

#include <opendxa/utils/linalg/lin_alg.hpp>
#include <opendxa/utils/linalg/vector3.hpp>

class Origin {};
extern Origin ORIGIN;

template<typename T>
class Point_3{
public:
	T X;
	T Y;
	T Z;

	Point_3() {}
	Point_3(T val) { X = Y = Z = val; }
	Point_3(T x, T y, T z) : X(x), Y(y), Z(z) {}
	Point_3(T val[3]) : X(val[0]), Y(val[1]), Z(val[2]) {}
	Point_3(Origin) : X((T)0), Y((T)0), Z((T)0) {}

    T& operator[](size_t i) {
		DISLOCATIONS_ASSERT_GLOBAL(sizeof(Point_3<T>) == sizeof(T) * 3);
		DISLOCATIONS_ASSERT_GLOBAL(i<3);
		return (&X)[i];
	}

	const T& operator[](size_t i) const {
		DISLOCATIONS_ASSERT_GLOBAL(sizeof(Point_3<T>) == sizeof(T) * 3);
		DISLOCATIONS_ASSERT_GLOBAL(i<3);
		return (&X)[i];
	}

	T* data() {
        DISLOCATIONS_ASSERT_GLOBAL(sizeof(Point_3<T>) == sizeof(T) * 3);
		return (T*)this;
	}

	const T* constData() const {
        DISLOCATIONS_ASSERT_GLOBAL(sizeof(Point_3<T>) == sizeof(T) * 3);
		return (const T*)this;
	}

	Point_3<T>& operator+=(const Vector_3<T>& v) { X += v.X; Y += v.Y; Z += v.Z; return *this; }
	Point_3<T>& operator-=(const Vector_3<T>& v) { X -= v.X; Y -= v.Y; Z -= v.Z; return *this; }
	Point_3<T>& operator+=(const Point_3<T>& p) { X += p.X; Y += p.Y; Z += p.Z; return *this; }

	const T& x() const { return X; }
	const T& y() const { return Y; }
	const T& z() const { return Z; }

    void setx(const T& value) { X = value; }
	void sety(const T& value) { Y = value; }
	void setz(const T& value) { Z = value; }

	bool operator==(const Point_3<T>& p) const { return (p.X==X) && (p.Y==Y) && (p.Z==Z); }
	bool operator!=(const Point_3<T>& p) const { return (p.X!=X) || (p.Y!=Y) || (p.Z!=Z); }
	bool operator==(const Origin&) const { return (X==(T)0) && (Y==(T)0) && (Z==(T)0); }
	bool operator!=(const Origin&) const { return (X!=(T)0) || (Y!=(T)0) || (Z!=(T)0); }
	bool equals(const Point_3<T>& p, T tolerance = FLOATTYPE_EPSILON) const {
		return (fabs(p.X - X) <= tolerance) && (fabs(p.Y - Y) <= tolerance) && (fabs(p.Z - Z) <= tolerance);
	}

	Point_3<T> operator+(const Point_3<T>& p) const { return Point_3<T>(X + p.X, Y + p.Y, Z + p.Z); }
	Point_3<T> operator+(const Vector_3<T>& v) const { return Point_3<T>(X + v.X, Y + v.Y, Z + v.Z); }
	Vector_3<T> operator-(const Point_3<T>& p) const { return Vector_3<T>(X - p.X, Y - p.Y, Z - p.Z); }
	Point_3<T> operator-(const Vector_3<T>& v) const { return Point_3<T>(X - v.X, Y - v.Y, Z - v.Z); }

	const Vector_3<T>& operator-(Origin) const {
		DISLOCATIONS_ASSERT_GLOBAL(sizeof(Point_3<T>) == sizeof(Vector_3<T>));
		return *(Vector_3<T>*)this;
	}

	Point_3<T> operator*(T s) const { return Point_3<T>(X*s, Y*s, Z*s); }
	Point_3<T> operator/(T s) const { return Point_3<T>(X/s, Y/s, Z/s); }
};

template<typename T>
Point_3<T> operator+(const Origin&, const Vector_3<T>& v) {
	return Point_3<T>(v.X, v.Y, v.Z);
}

template<typename T>
Point_3<T> operator-(const Origin&, const Vector_3<T>& v) {
	return Point_3<T>(-v.X, -v.Y, -v.Z);
}

template<typename T>
inline T DistanceSquared(const Point_3<T>& a, const Point_3<T>& b) {
	return square(a.X - b.X) + square(a.Y - b.Y) + square(a.Z - b.Z);
}

template<typename T>
inline T Distance(const Point_3<T>& a, const Point_3<T>& b) {
	return (T)sqrt(DistanceSquared(a, b));
}

template<typename T>
inline size_t MaxComponent(const Point_3<T>& a) {
    return ((a.X >= a.Y) ? ((a.X >= a.Z) ? 0 : 2) : ((a.Y >= a.Z) ? 1 : 2));
}

template<typename T>
inline size_t MinComponent(const Point_3<T>& a) {
    return ((a.X <= a.Y) ? ((a.X <= a.Z) ? 0 : 2) : ((a.Y <= a.Z) ? 1 : 2));
}

template<typename T>
inline size_t MaxAbsComponent(const Point_3<T>& a) {
    return ((fabs(a.X) >= fabs(a.Y)) ? ((fabs(a.X) >= fabs(a.Z)) ? 0 : 2) : ((fabs(a.Y) >= fabs(a.Z)) ? 1 : 2));
}

template<typename T>
inline std::ostream& operator<<(std::ostream &os, const Point_3<T> &p) {
	return os << '(' << p.X << ' ' << p.Y  << ' ' << p.Z << ')';
}

typedef Point_3<FloatType>	Point3;
typedef Point_3<int>		Point3I;

#endif 