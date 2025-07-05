#include <opendxa/core/opendxa.h>
#include <opendxa/geometry/delaunay_tessellation.h>
#include <omp.h>

#include <boost/random/mersenne_twister.hpp>
#include <boost/random/uniform_real.hpp>

namespace OpenDXA{

bool DelaunayTessellation::generateTessellation(
	const SimulationCell &simCell,
	const Point3* positions,
	size_t numPoints,
	double ghostLayerSize,
	const int* selectedPoints
){
	const double epsilon = 2e-5;
	boost::mt19937 rng;
	boost::uniform_real<> displacement(-epsilon, epsilon);
	rng.seed(4);
	_simCell = simCell;
	_particleIndices.clear();
	_pointData.clear();
	for(size_t i = 0; i < numPoints; i++, ++positions){
		if(selectedPoints && !*selectedPoints++){
			continue;
		}
	
		Point3 wp = simCell.wrapPoint(*positions);
		_pointData.push_back(static_cast<double>(wp.x()) + displacement(rng));
		_pointData.push_back(static_cast<double>(wp.y()) + displacement(rng));
		_pointData.push_back(static_cast<double>(wp.z()) + displacement(rng));
		_particleIndices.push_back(static_cast<int>(i));	
	}

	_primaryVertexCount = _particleIndices.size();
	Vector3I stencilCount;
	double cuts[3][2];
	Vector3 cellNormals[3];
	for(size_t dim = 0; dim < 3; dim++){
		cellNormals[dim] = simCell.cellNormalVector(dim);
		cuts[dim][0] = cellNormals[dim].dot(Vector3(simCell.reducedToAbsolute(Point3(0, 0, 0))));
		cuts[dim][1] = cellNormals[dim].dot(Vector3(simCell.reducedToAbsolute(Point3(1, 1, 1))));

		if(simCell.pbcFlags()[dim]){
			stencilCount[dim] = static_cast<int>(ceil(ghostLayerSize / simCell.matrix().column(dim).dot(cellNormals[dim])));
			cuts[dim][0] -= ghostLayerSize;
			cuts[dim][1] += ghostLayerSize;
		}else{
			stencilCount[dim] = 0;
			cuts[dim][0] -= ghostLayerSize;
			cuts[dim][1] += ghostLayerSize;
		}
	}

	for(int ix = -stencilCount[0]; ix <= +stencilCount[0]; ix++){
		for(int iy = -stencilCount[1]; iy <= +stencilCount[1]; iy++){
			for(int iz = -stencilCount[2]; iz <= +stencilCount[2]; iz++){
				if(ix == 0 && iy == 0 && iz == 0) continue;

				Vector3 shift = simCell.reducedToAbsolute(Vector3(ix, iy, iz));
				Vector_3<double> shiftd = static_cast<Vector_3<double>>(shift);

				for(size_t vertexIndex = 0; vertexIndex < _primaryVertexCount; vertexIndex++){
					double x = _pointData[vertexIndex * 3 + 0] + shiftd.x();
					double y = _pointData[vertexIndex * 3 + 1] + shiftd.y();
					double z = _pointData[vertexIndex * 3 + 2] + shiftd.z();

					Point3 pimage = Point3(x, y, z);
					bool isClipped = false;
					for(size_t dim = 0; dim < 3; dim++){
						double d = cellNormals[dim].dot(Vector3(pimage));
						if(d < cuts[dim][0] || d > cuts[dim][1]){
							isClipped = true;
							break;
						}
					}

					if(!isClipped){
						_pointData.push_back(x);
						_pointData.push_back(y);
						_pointData.push_back(z);
						_particleIndices.push_back(_particleIndices[vertexIndex]);
					}
				}
			}
		}
	}

	static bool isGeogramInitialized = false;
	if(!isGeogramInitialized){
		// TODO: this is ugly
        isGeogramInitialized = true;
        auto* old_cout = std::cout.rdbuf();
        auto* old_cerr = std::cerr.rdbuf();
        auto* old_clog = std::clog.rdbuf();
        std::cout.rdbuf(nullptr);
        std::cerr.rdbuf(nullptr);
        std::clog.rdbuf(nullptr);
        GEO::initialize();
        GEO::set_assert_mode(GEO::ASSERT_ABORT);
        std::cout.rdbuf(old_cout);
        std::cerr.rdbuf(old_cerr);
        std::clog.rdbuf(old_clog);
        GEO::Logger::instance()->set_quiet(true);
    }

	_dt = new GEO::Delaunay3d();
	_dt->set_keeps_infinite(true);
	_dt->set_reorder(true);

	GEO::index_t nv = static_cast<GEO::index_t>(_pointData.size() / 3);
	_dt->set_vertices(nv, _pointData.data());

	_numPrimaryTetrahedra = 0;
	_cellInfo.resize(_dt->nb_cells());
	for(CellIterator cell = begin_cells(); cell != end_cells(); ++cell) {
		bool isGhost = classifyGhostCell(cell);
		_cellInfo[cell] = { isGhost, isGhost ? -1 : static_cast<int>(_numPrimaryTetrahedra++) };
	}

	// TODO: dt is valid?
	return true;
}

bool DelaunayTessellation::classifyGhostCell(CellHandle cell) const{
	if(!isValidCell(cell)) return true;
	VertexHandle headVertex = cellVertex(cell, 0);
	int headVertexIndex = vertexIndex(headVertex);
	assert(headVertexIndex >= 0);
	for(int v = 1; v < 4; v++){
		VertexHandle p = cellVertex(cell, v);
		int vindex = vertexIndex(p);
		assert(vindex >= 0);
		if(vindex < headVertexIndex){
			headVertex = p;
			headVertexIndex = vindex;
		}
	}

	return isGhostVertex(headVertex);
}

static inline double determinant(double a00, double a01, double a02,
								 double a10, double a11, double a12,
								 double a20, double a21, double a22){
	return a00*a11*a22 + a01*a12*a20 + a02*a10*a21
		 - a02*a11*a20 - a01*a10*a22 - a00*a12*a21;
}

bool DelaunayTessellation::alphaTest(CellHandle cell, double alpha) const{
	auto v0 = _dt->vertex_ptr(_dt->cell_vertex(cell, 0));
	auto v1 = _dt->vertex_ptr(_dt->cell_vertex(cell, 1));
	auto v2 = _dt->vertex_ptr(_dt->cell_vertex(cell, 2));
	auto v3 = _dt->vertex_ptr(_dt->cell_vertex(cell, 3));

	auto qpx = v1[0] - v0[0];
	auto qpy = v1[1] - v0[1];
	auto qpz = v1[2] - v0[2];
	auto qp2 = qpx*qpx + qpy*qpy + qpz*qpz;

	auto rpx = v2[0] - v0[0];
	auto rpy = v2[1] - v0[1];
	auto rpz = v2[2] - v0[2];
	auto rp2 = rpx*rpx + rpy*rpy + rpz*rpz;

	auto spx = v3[0] - v0[0];
	auto spy = v3[1] - v0[1];
	auto spz = v3[2] - v0[2];
	auto sp2 = spx*spx + spy*spy + spz*spz;

	auto num_x = determinant(qpy, qpz, qp2, rpy, rpz, rp2, spy, spz, sp2);
	auto num_y = determinant(qpx, qpz, qp2, rpx, rpz, rp2, spx, spz, sp2);
	auto num_z = determinant(qpx, qpy, qp2, rpx, rpy, rp2, spx, spy, sp2);
	auto den = determinant(qpx, qpy, qpz, rpx, rpy, rpz, spx, spy, spz);

	return (num_x*num_x + num_y*num_y + num_z*num_z) / (4.0 * den * den) < alpha;
}

}