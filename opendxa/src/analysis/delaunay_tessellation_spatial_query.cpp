#include <opendxa/analysis/delaunay_tessellation_spatial_query.h>
#include <cassert>

namespace OpenDXA {

DelaunayTessellationSpatialQuery::DelaunayTessellationSpatialQuery(
    const DelaunayTessellation& tess,
    std::optional<double> alpha){
    size_t count = 0;
    for(auto cell : tess.cells()){
        if(!tess.isValidCell(cell)) continue;
        if(alpha && !tess.alphaTest(cell, *alpha).value_or(false)) continue;

        // Construct the bounding box for the cell
        Box3 b3;
        for(size_t i = 0; i < 4; ++i){
            b3.addPoint(tess.vertexPosition(tess.cellVertex(cell, i)));
        }

        // Convert our Box3 into a bBox for the R-tree
        // The inner {} creates a bPointCell from a Point3
        bBox box{{b3.minc}, {b3.maxc}};

        _rtree.insert({box, cell});
        ++count;
        assert(_rtree.size() == count);
    }
}

void DelaunayTessellationSpatialQuery::getOverlappingCells(
    const Box3& queryBox,
    std::vector<BoxValue>& out) const{
    out.clear();

    // Create the query box in the format Boost.Geometry understands
    bBox q{{queryBox.minc}, {queryBox.maxc}};

    // Perform the spatial query
    _rtree.query(
        boost::geometry::index::intersects(q),
        std::back_inserter(out)
    );
}

size_t DelaunayTessellationSpatialQuery::numCells() const{
    return _rtree.size();
}

}
