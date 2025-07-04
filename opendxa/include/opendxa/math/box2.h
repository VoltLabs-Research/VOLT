#pragma once

#include <opendxa/core/opendxa.h>
#include "vector2.h"
#include "point2.h"

namespace OpenDXA{
template<typename T>
class Box_2{
public:
	Point_2<T> minc;
	Point_2<T> maxc;

	Box_2() : minc(std::numeric_limits<T>::max()), maxc(std::numeric_limits<T>::lowest()) {}
	Box_2(const Point_2<T>& lower, const Point_2<T>& upper) : minc(lower), maxc(upper) {}

	Box_2(T xmin, T ymin, T xmax, T ymax) : minc(Point_2<T>(xmin, ymin)), maxc(Point_2<T>(xmax, ymax)) {
		assert(minc.x() <= maxc.x());
		assert(minc.y() <= maxc.y());
	}

	Box_2(const Point_2<T>& center, T halfEdgeLength) {
		assert(halfEdgeLength >= 0);
		minc.x() = center.x() - halfEdgeLength;
		minc.y() = center.y() - halfEdgeLength;
		maxc.x() = center.x() + halfEdgeLength;
		maxc.y() = center.y() + halfEdgeLength;
	}

	bool isEmpty() const {
        return (minc.x() > maxc.x()) || (minc.y() > maxc.y());
	}

	void setEmpty() {
		minc = Point_2<T>(std::numeric_limits<T>::max());
		maxc = Point_2<T>(std::numeric_limits<T>::lowest());
	}

	Point_2<T> operator[](typename Point_2<T>::size_type i) const {
		const Point_2<T>* const c = &minc;
		assert(&c[1] == &maxc);
		return Point_2<T>(c[i&1].x(), c[(i>>1)&1].y());
	}

	T width() const { return maxc.x() - minc.x(); }
	T height() const { return maxc.y() - minc.y(); }

	Point_2<T> center() const {
		return Point_2<T>((minc.x() + maxc.x()) / 2, (minc.y() + maxc.y()) / 2);
	}

	Vector_2<T> size() const {
		return maxc - minc;
	}

	T size(typename Point_2<T>::size_type dimension) const {
		return maxc[dimension] - minc[dimension];
	}

	bool contains(const Point_2<T>& p) const {
		return (p.x() >= minc.x() && p.x() <= maxc.x() && p.y() >= minc.y() && p.y() <= maxc.y());
	}

	int classifyPoint(const Point_2<T>& p, T epsilon = T(EPSILON)) const {
		return
				(p.x() > maxc.x() + epsilon || p.y() > maxc.y() + epsilon) ||
				(p.x() < minc.x() - epsilon || p.y() < minc.y() - epsilon)
						? -1 :
				((p.x() < maxc.x() - epsilon && p.x() > minc.x() + epsilon && p.y() < maxc.y() - epsilon && p.y() > minc.y() + epsilon)
						? 1 : 0);
	}

	bool containsBox(const Box_2<T>& b) const {
		return (b.minc.x() >= minc.x() && b.maxc.x() <= maxc.x()) &&
			(b.minc.y() >= minc.y() && b.maxc.y() <= maxc.y());
	}

	bool intersects(const Box_2<T>& b) const {
		return (maxc.x() > b.minc.x() && minc.x() < b.maxc.x() &&
				maxc.y() > b.minc.y() && minc.y() < b.maxc.y() &&
				!isEmpty() && !b.isEmpty());
	}

	void addPoint(const Point_2<T>& p) {
		minc.x() = std::min(minc.x(), p.x()); maxc.x() = std::max(maxc.x(), p.x());
		minc.y() = std::min(minc.y(), p.y()); maxc.y() = std::max(maxc.y(), p.y());
	}

	void addPoint(T x, T y) {
		minc.x() = std::min(minc.x(), x); maxc.x() = std::max(maxc.x(), x);
		minc.y() = std::min(minc.y(), y); maxc.y() = std::max(maxc.y(), y);
	}

	void addPoints(const Point_2<T>* points, std::size_t count) {
		for(; count != 0; count--, points++) {
			minc.x() = std::min(minc.x(), points->X); maxc.x() = std::max(maxc.x(), points->X);
			minc.y() = std::min(minc.y(), points->Y); maxc.y() = std::max(maxc.y(), points->Y);
		}
	}

	void addBox(const Box_2& b) {
		minc.x() = std::min(minc.x(), b.minc.x()); maxc.x() = std::max(maxc.x(), b.maxc.x());
		minc.y() = std::min(minc.y(), b.minc.y()); maxc.y() = std::max(maxc.y(), b.maxc.y());
	}

    void includeX(T x) {
        minc.x() = std::min(minc.x(), x); maxc.x() = std::max(maxc.x(), x);
	}

    void includeY(T y) {
        minc.y() = std::min(minc.y(), y); maxc.y() = std::max(maxc.y(), y);
	}
};

template<typename T>
inline std::ostream& operator<<(std::ostream &os, const Box_2<T> &b) {
	return os << '[' << b.minc << "] - [" << b.maxc << ']';
}

using Box2 = Box_2<double>;

using Box2I = Box_2<int>;

}