#pragma once

#include <opendxa/core/opendxa.h>
#include "vector3.h"
#include "point3.h"
#include "ray.h"
#include "affine_transformation.h"

namespace OpenDXA{ 
template<typename T>
class Plane_3{
public:
	Vector_3<T> normal;
	T dist;
	Plane_3() {}
	Plane_3(const Vector_3<T>& n, T d) : normal(n), dist(d) {}
	Plane_3(const Point_3<T>& basePoint, const Vector_3<T>& n) : normal(n), dist(normal.dot((basePoint - typename Point_3<T>::Origin()))) {}
	Plane_3(const Point_3<T>& p1, const Point_3<T>& p2, const Point_3<T>& p3) {
		normal = (p2-p1).cross(p3-p1);
		T lsq = normal.squaredLength();
		if(lsq) dist = normal.dot(p1 - typename Point_3<T>::Origin()) / lsq;
		else dist = 0;
	}

	Plane_3(const Point_3<T>& p1, const Point_3<T>& p2, const Point_3<T>& p3, bool normalize) {
		if(normalize) {
			normal = (p2-p1).cross(p3-p1).normalized();
			dist = normal.dot(p1 - typename Point_3<T>::Origin());
		}
		else {
			normal = (p2-p1).cross(p3-p1);
			T lsq = normal.squaredLength();
			if(lsq) dist = normal.dot(p1 - typename Point_3<T>::Origin()) / lsq;
			else dist = 0;
		}
	}

	Plane_3(const Point_3<T>& p, const Vector_3<T>& v1, const Vector_3<T>& v2, bool normalize = true) {
		if(normalize)
			normal = v1.cross(v2).normalized();
		else
			normal = v1.cross(v2);
		dist = normal.dot(p - typename Point_3<T>::Origin());
	}

	void normalizePlane() {
		T len = normal.length();
		dist /= len;
		normal /= len;
		assert(std::abs(normal.squaredLength() - T(1)) <= T(EPSILON));
	}

	Plane_3<T> operator-() const { return Plane_3<T>(-normal, -dist); }

	bool operator==(const Plane_3<T>& other) const { return normal == other.normal && dist == other.dist; }

	int classifyPoint(const Point_3<T>& p, const T tolerance = T(EPSILON)) const {
        T d = pointDistance(p);
		if(d < -tolerance) return -1;
		else if(d > tolerance) return 1;
		else return 0;
	}

	T pointDistance(const Point_3<T>& p) const {
		return (normal.x() * p.x() + normal.y() * p.y() + normal.z() * p.z()) - dist;
	}

	Point_3<T> intersection(const Ray3& ray, T epsilon = T(0)) const {
		T t = intersectionT(ray, epsilon);
		return ray.point(t);
	}

	T intersectionT(const Ray3& ray, T epsilon = T(0)) const {
		// The plane's normal vector should be normalized.
		assert(std::abs(normal.squaredLength() - T(1)) <= T(EPSILON));
		T dot = normal.dot(ray.dir);
		if(std::abs(dot) <= epsilon) return std::numeric_limits<T>::max();
		return -pointDistance(ray.base) / dot;
	}

	Point_3<T> projectPoint(const Point_3<T>& p) const {
		return p - pointDistance(p) * normal;
	}
};

template<typename T>
inline Plane_3<T> operator*(const AffineTransformationT<T>& tm, const Plane_3<T>& plane) {
	Plane_3<T> p2;
	p2.normal = (tm * plane.normal).normalized();
	Point_3<T> base = tm * (typename Point_3<T>::Origin() + plane.normal * plane.dist);
	p2.dist = p2.normal.dot(base - typename Point_3<T>::Origin());
	return p2;
}

template<typename T>
inline std::ostream& operator<<(std::ostream &os, const Plane_3<T>& p) {
	return os << '[' << p.normal.x() << ' ' << p.normal.y()  << ' ' << p.normal.z() << "], " << p.dist;
}

using Plane3 = Plane_3<double>;

}