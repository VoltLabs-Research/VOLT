#include <opendxa/core/opendxa.h>
#include <opendxa/geometry/delaunay_tessellation.h>
#include <omp.h>

#include <boost/random/mersenne_twister.hpp>
#include <boost/random/uniform_real.hpp>

namespace OpenDXA{

// Generates a 3D Delaunay mesh of your points under periodic boundaries. 
// Each input is wrapped into the main cell, nudged by a tiny fixed random jitter 
// to avoid degenerate arrangements, and if requested - "ghost" copies are placed 
// out to ghostLayerSize so that edge atoms see the correct neighbors across faces. 
// Optionally eight far-out helper points form a convex hull to force a fully finite 
// tetrahedral cover. Finally, Geogram builds the triangulation and tags each tetrahedron 
// as primary or ghost based on its lowest‐indexed corner.
bool DelaunayTessellation::generateTessellation(
	const SimulationCell& simCell,
	const Point3* positions,
	size_t numPoints,
	double ghostLayerSize,
	bool coverDomainWithFiniteTets,
	const int* selectedPoints
){
	// Thread-safe one-time initialization of the Geogram library.
	static std::mutex geogramMutex;
	{
		std::lock_guard<std::mutex> lock(geogramMutex);
		GEO::initialize(GEO::GEOGRAM_NO_HANDLER);
		GEO::set_assert_mode(GEO::ASSERT_ABORT);
	}

	// Compute a lengthScale from the sum of the three cell vectors, then 
	// set epsilon = 1e-10 * lengthScale to define a tiny jitter
	double lengthScale = (simCell.matrix().column(0) + simCell.matrix().column(1) + simCell.matrix().column(2)).length();
	double epsilon = 1e-10 * lengthScale;

	// Use a fixed RNG seed so that jitter is reproducible across runs.
	std::mt19937 rng(4);
	boost::random::uniform_real_distribution<double> displacement(-epsilon, epsilon);
	_simCell = simCell;

	// Wrap each input point into the primary cell, apply jitter,
	// and store it in _pointData / _particleIndices
	_particleIndices.clear();
	_pointData.clear();

	for(size_t i = 0; i < numPoints; i++, ++positions){
		// Skip points which are not inclued
		if(selectedPoints && !*selectedPoints++){
			continue;
		}

		// Add a small random perturbation to the particle positions to 
		// make the Delaunay triangulation more robust against singular 
		// input data, e.g. all particle positioned on ideal crystal lattice sites
		Point3 wp = simCell.wrapPoint(*positions);
		_pointData.emplace_back(
            (double) wp.x() + displacement(rng),
            (double) wp.y() + displacement(rng),
            (double) wp.z() + displacement(rng)
		);

		_particleIndices.push_back(i);
	}

	_primaryVertexCount = _particleIndices.size();

	// Determine how many periodic copies of the input particles are
	// needed in each direction to ensure a consistent periodic
	// topology in the border region
	Vector3I stencilCount;
	double cuts[3][2];
	Vector3 cellNormals[3];
	for(size_t dim = 0; dim < 3; dim++){
		cellNormals[dim] = simCell.cellNormalVector(dim);
		cuts[dim][0] = cellNormals[dim].dot(simCell.reducedToAbsolute(Point3(0,0,0)) - Point3::Origin());
		cuts[dim][1] = cellNormals[dim].dot(simCell.reducedToAbsolute(Point3(1,1,1)) - Point3::Origin());

		if(simCell.hasPbc(dim)){
			stencilCount[dim] = (int) ceil(ghostLayerSize / simCell.matrix().column(dim).dot(cellNormals[dim]));
			cuts[dim][0] -= ghostLayerSize;
			cuts[dim][1] += ghostLayerSize;
		}else{
			stencilCount[dim] = 0;
			cuts[dim][0] -= ghostLayerSize;
			cuts[dim][1] += ghostLayerSize;
		}
	}

	// Create ghost images of input vertices
	for(int ix = -stencilCount[0]; ix <= +stencilCount[0]; ix++){
		for(int iy = -stencilCount[1]; iy <= +stencilCount[1]; iy++){
			for(int iz = -stencilCount[2]; iz <= +stencilCount[2]; iz++){
				if(ix == 0 && iy == 0 && iz == 0) continue;

				Vector3 shift = simCell.reducedToAbsolute(Vector3(ix, iy, iz));
				for(size_t vertexIndex = 0; vertexIndex < _primaryVertexCount; vertexIndex++){
					Point3 pimage = _pointData[vertexIndex] + shift;
					bool isClipped = false;
					for(size_t dim = 0; dim < 3; dim++){
						if(simCell.hasPbc(dim)){
							double d = cellNormals[dim].dot(pimage - Point3::Origin());
							if(d < cuts[dim][0] || d > cuts[dim][1]){
								isClipped = true;
								break;
							}
						}
					}
					if(!isClipped){
						_pointData.push_back(pimage);
						_particleIndices.push_back(_particleIndices[vertexIndex]);
					}
				}
			}
		}
	}

	// In order to cover the simulation box completely with finite tetrahedra, add 8 extra
	// input points to the Delaunay tesselation, far away from the simulation cell and real praticles.
	// These 8 points form a convex hull, whose interior will get completely tessellated.
	if(coverDomainWithFiniteTets){
		// Compute bounding box of inputs points and simulation cell
		Box3 bb = Box3(Point3(0), Point3(1)).transformed(simCell.matrix());
		bb.addPoints(_pointData.data(), _pointData.size());
		// Add extra padding
		bb = bb.padBox(ghostLayerSize);
		// Create 8 helper points at the corners of the bounding box
		for(size_t i = 0; i < 8; i++){
			Point3 corner = bb[i];
			_pointData.push_back(corner);
			_particleIndices.push_back(std::numeric_limits<size_t>::max());
		}
	}

	// Internal Delaunay generator object
	_dt = GEO::Delaunay::create(3, "BDEL");
	_dt->set_keeps_infinite(true);
	_dt->set_reorder(true);

	// Construct Delaunay tessellation
	_dt->set_vertices(_pointData.size(), reinterpret_cast<const double*>(_pointData.data()));

	// Classify tessellation cells as ghost or local cells
	_numPrimaryTetrahedra = 0;
	_cellInfo.resize(_dt->nb_cells());
	for(CellHandle cell : cells()){
		if(classifyGhostCell(cell)){
			_cellInfo[cell].isGhost = true;
            _cellInfo[cell].index = -1;
		}else{
			_cellInfo[cell].isGhost = false;
			_cellInfo[cell].index = _numPrimaryTetrahedra++;
		}
	}
	return true;
}

// Determines whether a given tetrahedron cell should be treated as
// a "ghost" element (i.e. not part of the original point set).
// We look at the four corner vertices, pick the one with the
// smallest original index (so that each tetrahedron is tested exactly one)
// and ask: was the vertex a ghost copy? If so, we label
// the entire tetrahedron ghost.
bool DelaunayTessellation::classifyGhostCell(CellHandle cell) const{
	// Degenerate or infinite cell = ghost
	if(!isValidCell(cell)) return true;

	// Identify the corner with minimum "vertexIndex"
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

	// If that "head" vertex was created as a ghost (out-of-primary),
	// classify the whole tetrahedron ghost.
	return isGhostVertex(headVertex);
}

static inline double determinant(double a00, double a01, double a02,
                                 double a10, double a11, double a12,
                                 double a20, double a21, double a22){
    double m02 = a00*a21 - a20*a01;
    double m01 = a00*a11 - a10*a01;
    double m12 = a10*a21 - a20*a11;
    double m012 = m01*a22 - m02*a12 + m12*a02;
    return m012;
}

// Perfoms the "alpha shape" test on one tetrahedron to detect poorly shaped "sliver" elements.
// Roughly speaking, we compute the ratio of the squared circumradius to the squared edge lengths,
// and compare it to the parameter alpha. If both numerator and denominator are near zero, the shape
// is degenerate and we return std::nullopt. Otherwise, we return true if (numerator/denominator) < alpha,
// meaning the tetrahedron is acceptable under the chosen threshold.
std::optional<bool> DelaunayTessellation::alphaTest(CellHandle cell, double alpha) const{
	// Extract the four vertex coordinates.
    auto v0 = _dt->vertex_ptr(cellVertex(cell, 0));
    auto v1 = _dt->vertex_ptr(cellVertex(cell, 1));
    auto v2 = _dt->vertex_ptr(cellVertex(cell, 2));
    auto v3 = _dt->vertex_ptr(cellVertex(cell, 3));

	// Compute q = v1 - v0, r = v2 - v0, s = v3 - v0 and their
	// squared lengths.
    auto qpx = v1[0]-v0[0];
    auto qpy = v1[1]-v0[1];
    auto qpz = v1[2]-v0[2];
    auto qp2 = qpx*qpx + qpy*qpy + qpz*qpz;
    auto rpx = v2[0]-v0[0];
    auto rpy = v2[1]-v0[1];
    auto rpz = v2[2]-v0[2];
    auto rp2 = rpx*rpx + rpy*rpy + rpz*rpz;
    auto spx = v3[0]-v0[0];
    auto spy = v3[1]-v0[1];
    auto spz = v3[2]-v0[2];
    auto sp2 = spx*spx + spy*spy + spz*spz;

    auto num_x = determinant(qpy,qpz,qp2,rpy,rpz,rp2,spy,spz,sp2);
    auto num_y = determinant(qpx,qpz,qp2,rpx,rpz,rp2,spx,spz,sp2);
    auto num_z = determinant(qpx,qpy,qp2,rpx,rpy,rp2,spx,spy,sp2);
    auto den   = determinant(qpx,qpy,qpz,rpx,rpy,rpz,spx,spy,spz);

    double nomin = (num_x*num_x + num_y*num_y + num_z*num_z);
    double denom = (4 * den * den);

    // Detect degenerate sliver elements, for which we cannot compute a reliable alpha value.
    if(std::abs(denom) < 1e-9 && std::abs(nomin) < 1e-9){
		// Indeterminate result
        return std::nullopt;
    }

    return (nomin / denom) < alpha;
}

}