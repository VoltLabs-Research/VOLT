#pragma once

#include <opendxa/analysis/triangle_tetrahedron_intersection_test.h>
#include <opendxa/geometry/delaunay_tessellation.h>
#include <boost/geometry.hpp>
#include <boost/geometry/geometries/point.hpp>
#include <boost/geometry/geometries/box.hpp>
#include <boost/geometry/index/rtree.hpp>
#include <boost/geometry/geometries/register/point.hpp>
#include <vector>
#include <optional>
#include <utility>

namespace OpenDXA {

struct bPointCell {
    Point3 point;
    size_t cell;
};

}

BOOST_GEOMETRY_REGISTER_POINT_3D(
    OpenDXA::bPointCell, 
    double, boost::geometry::cs::cartesian, 
    point[0],
    point[1], 
    point[2]
);

namespace OpenDXA{

// These using declarations now resolve correctly thanks to the above traits.
using bBox = boost::geometry::model::box<bPointCell>;
using BoxValue = std::pair<bBox, DelaunayTessellation::CellHandle>;

class DelaunayTessellationSpatialQuery{
public:
    DelaunayTessellationSpatialQuery(
        const DelaunayTessellation& tess,
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