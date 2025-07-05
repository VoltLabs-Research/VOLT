#pragma once

#include <opendxa/core/opendxa.h>
#include "vector3.h"
#include "point3.h"
#include "affine_transformation.h"

namespace OpenDXA{

template<typename T>
class Ray_3{
public:
	Point_3<T> base;
	Vector_3<T> dir;
	Ray_3() {}
	Ray_3(const Point_3<T>& b, const Vector_3<T>& d) : base(b), dir(d) {}
	Ray_3(const Point_3<T>& a, const Point_3<T>& b) : base(a), dir(b - a) {}
	Point_3<T> point(T t) const { return base + dir * t; }
	Ray_3 operator-() const { return Ray_3(base, -dir); }
};

template<typename T>
inline Ray_3<T> operator*(const AffineTransformationT<T>& tm, const Ray_3<T>& ray) {
	return { tm * ray.base, (tm * ray.dir).normalized() };
}

using Ray3 = Ray_3<double>;

}