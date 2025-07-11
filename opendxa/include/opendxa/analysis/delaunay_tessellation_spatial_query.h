#pragma once

#include <vector>
#include <optional>
#include <utility>

#include <boost/geometry.hpp>
#include <boost/geometry/geometries/point.hpp>
#include <boost/geometry/geometries/box.hpp>
#include <boost/geometry/index/rtree.hpp>

#include <opendxa/geometry/delaunay_tessellation.h>

namespace OpenDXA {

struct bPointCell {
    Point3 point;
    size_t cell;
};

}

namespace boost { namespace geometry { namespace traits {
template<> struct tag<       ::OpenDXA::bPointCell> { using type = point_tag; };
template<> struct coordinate_type< ::OpenDXA::bPointCell> { using type = double; };
template<> struct coordinate_system< ::OpenDXA::bPointCell> { using type = cs::cartesian; };
template<> struct dimension<     ::OpenDXA::bPointCell> : boost::mpl::int_<3> {};

template<> struct access< ::OpenDXA::bPointCell, 0> {
    static double get( ::OpenDXA::bPointCell const& p ) { return p.point.x(); }
    static void   set( ::OpenDXA::bPointCell&       p, double v ) { p.point.x() = v; }
};
template<> struct access< ::OpenDXA::bPointCell, 1> {
    static double get( ::OpenDXA::bPointCell const& p ) { return p.point.y(); }
    static void   set( ::OpenDXA::bPointCell&       p, double v ) { p.point.y() = v; }
};
template<> struct access< ::OpenDXA::bPointCell, 2> {
    static double get( ::OpenDXA::bPointCell const& p ) { return p.point.z(); }
    static void   set( ::OpenDXA::bPointCell&       p, double v ) { p.point.z() = v; }
};

}}}

namespace OpenDXA{

// These using declarations now resolve correctly thanks to the above traits.
using bBox = boost::geometry::model::box<bPointCell>;
using BoxValue = std::pair<bBox, DelaunayTessellation::CellHandle>;

class DelaunayTessellationSpatialQuery{
public:
    DelaunayTessellationSpatialQuery(
        DelaunayTessellation& tess,
        std::optional<double> alpha = std::nullopt
    );

    void getOverlappingCells(
        const Box3&           queryBox,
        std::vector<BoxValue>& out
    ) const;

    size_t numCells() const;

private:
    boost::geometry::index::rtree<
        BoxValue,
        boost::geometry::index::quadratic<128>
    > _rtree;
};

} 