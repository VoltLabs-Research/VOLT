#pragma once

#include <opendxa/core/opendxa.h>
#include "vector3.h"
#include "point3.h"
#include "affine_transformation.h"

namespace OpenDXA{

template<typename T>
class Box_3{
public:	
	Point_3<T> minc;
	Point_3<T> maxc;

	Box_3() : minc(std::numeric_limits<T>::max()), maxc(std::numeric_limits<T>::lowest()) {}

	Box_3(const Point_3<T>& lower, const Point_3<T>& upper) : minc(lower), maxc(upper) {}

	Box_3(const Point_3<T>& center, T halfEdgeLength) {
		assert(halfEdgeLength >= 0);
		minc.x() = center.x() - halfEdgeLength;
		minc.y() = center.y() - halfEdgeLength;
		minc.z() = center.z() - halfEdgeLength;
		maxc.x() = center.x() + halfEdgeLength;
		maxc.y() = center.y() + halfEdgeLength;
		maxc.z() = center.z() + halfEdgeLength;
	}

	bool isEmpty() const {
        return (minc.x() > maxc.x()) || (minc.y() > maxc.y()) || (minc.z() > maxc.z());
	}

	void setEmpty() {
		minc = Point_3<T>(std::numeric_limits<T>::max());
		maxc = Point_3<T>(std::numeric_limits<T>::lowest());
	}

	Point_3<T> center() const {
		return Point_3<T>((minc.x() + maxc.x()) / 2, (minc.y() + maxc.y()) / 2, (minc.z() + maxc.z()) / 2);
	}

	Vector_3<T> size() const {
		return maxc - minc;
	}

	T size(typename Point_3<T>::size_type dimension) const {
		return maxc[dimension] - minc[dimension]; 
	}

	T sizeX() const { return maxc.x() - minc.x(); }
	T sizeY() const { return maxc.y() - minc.y(); }
	T sizeZ() const { return maxc.z() - minc.z(); }

	Point_3<T> operator[](typename Point_3<T>::size_type i) const {
		const Point_3<T>* const c = &minc;
		assert(&c[1] == &maxc);
		return Point_3<T>(c[i&1].x(), c[(i>>1)&1].y(), c[(i>>2)&1].z());
	}

	bool contains(const Point_3<T>& p) const {
		return p.x() >= minc.x() && p.x() <= maxc.x() &&
			   p.y() >= minc.y() && p.y() <= maxc.y() &&
			   p.z() >= minc.z() && p.z() <= maxc.z();
	}
	
	int classifyPoint(const Point_3<T>& p, T epsilon = T(EPSILON)) const {
		if(p.x() > maxc.x() + epsilon || p.y() > maxc.y() + epsilon || p.z() > maxc.z() + epsilon) return -1;
		if(p.x() < minc.x() - epsilon || p.y() < minc.y() - epsilon || p.z() < minc.z() - epsilon) return -1;
		if(p.x() < maxc.x() - epsilon && p.x() > minc.x() + epsilon &&
		   p.y() < maxc.y() - epsilon && p.y() > minc.y() + epsilon &&
		   p.z() < maxc.z() - epsilon && p.z() > minc.z() + epsilon) return 1;
		return 0;
	}

	Box_3 transformed(const AffineTransformationT<T>& tm) const {
		if(isEmpty()) return *this;
		Box_3 b;
		const Point_3<T>* const c = &minc;
		assert(&c[1] == &maxc);
		for(size_t i = 0; i < 8; i++)
			b.addPoint(tm * Point_3<T>(c[i&1].x(), c[(i>>1)&1].y(), c[(i>>2)&1].z()));
		return b;
	}
};

template<typename T>
inline Box_3<T> operator*(const AffineTransformationT<T>& tm, const Box_3<T>& box) {
	return box.transformed(tm);
}

template<typename T>
inline std::ostream& operator<<(std::ostream &os, const Box_3<T> &b) {
	return os << '[' << b.minc << "] - [" << b.maxc << ']';
}

using Box3 = Box_3<double>;

using Box3I = Box_3<int>;

}
