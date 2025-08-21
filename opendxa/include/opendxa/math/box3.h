#pragma once

#include <opendxa/core/opendxa.h>
#include "vector3.h"
#include "point3.h"
#include "affine_transformation.h"
#include <limits>
#include <algorithm>
#include <cassert>
#include <ostream>

namespace OpenDXA{

template<typename T>
class Box_3{
public:
	Point_3<T> minc;
	Point_3<T> maxc;

	constexpr Box_3() noexcept : minc(std::numeric_limits<T>::max()), maxc(std::numeric_limits<T>::lowest()) {}

	constexpr Box_3(const Point_3<T>& lower, const Point_3<T>& upper) noexcept : minc(lower), maxc(upper) {}

	constexpr Box_3(const Point_3<T>& center, T halfEdgeLength) noexcept {
		Vector_3<T> half_size(halfEdgeLength);
		minc = center - half_size;
		maxc = center + half_size;
	}

	constexpr bool isEmpty() const noexcept {
        return (minc.x() > maxc.x()) || (minc.y() > maxc.y()) || (minc.z() > maxc.z());
	}

	void setEmpty() noexcept {
		minc = Point_3<T>(std::numeric_limits<T>::max());
		maxc = Point_3<T>(std::numeric_limits<T>::lowest());
	}

	constexpr Point_3<T> center() const noexcept {
		return Point_3<T>((minc.x() + maxc.x()) / 2, (minc.y() + maxc.y()) / 2, (minc.z() + maxc.z()) / 2);
	}

	constexpr Vector_3<T> size() const noexcept {
		return maxc - minc;
	}

	constexpr T size(typename Point_3<T>::size_type dimension) const noexcept {
		return maxc[dimension] - minc[dimension];
	}

	constexpr T sizeX() const noexcept { return maxc.x() - minc.x(); }
	constexpr T sizeY() const noexcept { return maxc.y() - minc.y(); }
	constexpr T sizeZ() const noexcept { return maxc.z() - minc.z(); }

	constexpr Point_3<T> operator[](typename Point_3<T>::size_type i) const noexcept {
		const Point_3<T>* const c = &minc;
		assert(&c[1] == &maxc);
		return Point_3<T>(c[i&1].x(), c[(i>>1)&1].y(), c[(i>>2)&1].z());
	}

	constexpr bool contains(const Point_3<T>& p) const noexcept {
		return p.x() >= minc.x() && p.x() <= maxc.x() &&
			   p.y() >= minc.y() && p.y() <= maxc.y() &&
			   p.z() >= minc.z() && p.z() <= maxc.z();
	}

	constexpr int classifyPoint(const Point_3<T>& p, T epsilon = T(EPSILON)) const noexcept {
		if(p.x() > maxc.x() + epsilon || p.y() > maxc.y() + epsilon || p.z() > maxc.z() + epsilon) return -1;
		if(p.x() < minc.x() - epsilon || p.y() < minc.y() - epsilon || p.z() < minc.z() - epsilon) return -1;
		if(p.x() < maxc.x() - epsilon && p.x() > minc.x() + epsilon &&
		   p.y() < maxc.y() - epsilon && p.y() > minc.y() + epsilon &&
		   p.z() < maxc.z() - epsilon && p.z() > minc.z() + epsilon) return 1;
		return 0;
	}

    template<typename PointsRange>
    void addPoints(const PointsRange& points) noexcept {
        for(const Point_3<T>& p : points)
            addPoint(p);
    }

    constexpr Box_3 padBox(T amount) const noexcept {
        if(isEmpty()) return *this;
        return Box_3(minc - Vector_3<T>(amount), maxc + Vector_3<T>(amount));
    }

	void addPoints(const Point_3<T>* points, std::size_t count) noexcept {
        const Point_3<T>* const points_end = points + count;
        for(; points != points_end; ++points)
            addPoint(*points);
    }

	inline void addPoint(const Point_3<T>& p) noexcept {
        minc.x() = std::min(minc.x(), p.x());
        maxc.x() = std::max(maxc.x(), p.x());
        minc.y() = std::min(minc.y(), p.y());
        maxc.y() = std::max(maxc.y(), p.y());
        minc.z() = std::min(minc.z(), p.z());
        maxc.z() = std::max(maxc.z(), p.z());
    }

	constexpr Box_3 transformed(const AffineTransformationT<T>& tm) const noexcept {
		if(isEmpty()) return *this;
		Box_3 b;
		for(size_t i = 0; i < 8; i++)
			b.addPoint(tm * (*this)[i]);
		return b;
	}
};

template<typename T>
constexpr Box_3<T> operator*(const AffineTransformationT<T>& tm, const Box_3<T>& box) noexcept {
	return box.transformed(tm);
}

template<typename T>
inline std::ostream& operator<<(std::ostream &os, const Box_3<T> &b) {
	return os << '[' << b.minc << "] - [" << b.maxc << ']';
}

using Box3 = Box_3<double>;
using Box3I = Box_3<int>;

}