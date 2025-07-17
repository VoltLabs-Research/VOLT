#include <opendxa/analysis/nearest_neighbor_finder.h>
#include <opendxa/core/particle_property.h>

namespace OpenDXA{

// Returns the stored 3D position of the atom at the given index.
// Ensures index is in bounds and then references the pre-loaded atom list.
const Point3& NearestNeighborFinder::particlePos(size_t index) const{
    //assert(index >= 0 && index < atoms.size());
    return atoms[index].pos;
}

// Computes the squared minimum possible distance from "query_point" to any point
// inside the axis-aligned bounding box of "node". This is used to cull tree branches
// whose entire regions lies farther than our current furthest neighbor.
double NearestNeighborFinder::minimumDistance(TreeNode* node, const Point3& query_point) const{
	// Delta to box min and max corners
    Vector3 p1 = node->bounds.minc - query_point;
    Vector3 p2 = query_point - node->bounds.maxc;

    double minDistance = 0;
    // For each axis, if query_point is outside the slab, dot against face normal
	for(size_t dim = 0; dim < 3; dim++){
        double t_min = planeNormals[dim].dot(p1);
        if(t_min > minDistance) minDistance = t_min;
        double t_max = planeNormals[dim].dot(p2);
        if(t_max > minDistance) minDistance = t_max;
    }

	// Return squared distance
    return minDistance * minDistance;
}

// K-nearest query entrey point. Find the nearest neighbors to a 3D point,
// optionally including the point itself. Handles periodic images to wrap
// the search around the simulation box.
template<int MAX_NEIGHBORS_LIMIT>
void NearestNeighborFinder::Query<MAX_NEIGHBORS_LIMIT>::findNeighbors(const Point3& query_point, bool includeSelf){
    queue.clear();
	// Try every periodic image shift
    for(const Vector3& pbcShift : t.pbcImages){
        q = query_point - pbcShift;
		// Only descend into the tree if there's any hope of finding a closer point
        if(!queue.full() || queue.top().distanceSq > t.minimumDistance(t.root, q)){
            qr = t.simCell.absoluteToReduced(q);
            visitNode(t.root, includeSelf);
        }
    }

	// Sort the result heap by distance
    queue.sort();
}

// Overload. Query by atom index rather than 3D point
template<int MAX_NEIGHBORS_LIMIT>
void NearestNeighborFinder::Query<MAX_NEIGHBORS_LIMIT>::findNeighbors(size_t particleIndex, bool includeSelf){
    findNeighbors(t.particlePos(particleIndex), includeSelf);
}

// Recursive tree-walk. At a leaf, test every atom; otherwise choose the nearer
// child first and prune the farther child if its box is too far.
template<int MAX_NEIGHBORS_LIMIT>
void NearestNeighborFinder::Query<MAX_NEIGHBORS_LIMIT>::visitNode(TreeNode* node, bool includeSelf){
    if(node->isLeaf()){
		// Check every atom in this bucket
        for(NeighborListAtom* atom = node->atoms; atom != nullptr; atom = atom->nextInBin){
            Neighbor n;
            n.delta = atom->pos - q;
            n.distanceSq = n.delta.squaredLength();
            // Optionally skip zero-distance self hits
            if(includeSelf || n.distanceSq != 0){
                n.atom = atom;
                n.index = atom - &t.atoms.front();
                queue.insert(n);
            }
        }
    }else{
		// Determine which child region is closer on split axis
        TreeNode* cnear;
        TreeNode* cfar;
        if(qr[node->splitDim] < node->splitPos){
            cnear = node->children[0];
            cfar  = node->children[1];
        }else{
            cnear = node->children[1];
            cfar  = node->children[0];
        }
        visitNode(cnear, includeSelf); 

		// Only descend into the far child if it could hot a nearer point
        if(!queue.full() || queue.top().distanceSq > t.minimumDistance(cfar, q)){
            visitNode(cfar, includeSelf); 
        }
    }
}

// Convert all bounding boxes in the three from reduced (0-1) to actual coordinates
// once every point has been inserted.
void NearestNeighborFinder::TreeNode::convertToAbsoluteCoordinates(const SimulationCell& cell){
    bounds.minc = cell.reducedToAbsolute(bounds.minc);
    bounds.maxc = cell.reducedToAbsolute(bounds.maxc);
    if(!isLeaf()){
        children[0]->convertToAbsoluteCoordinates(cell);
        children[1]->convertToAbsoluteCoordinates(cell);
    }
}

// A node is leaf it it hasn't been split (splitDim == -1)
bool NearestNeighborFinder::TreeNode::isLeaf() const{
    return splitDim == -1;
}

template<int MAX_NEIGHBORS_LIMIT>
void NearestNeighborFinder::Query<MAX_NEIGHBORS_LIMIT>::findNeighbors(const Point3& query_point){
    queue.clear();
    for(const Vector3& pbcShift : t.pbcImages){
        q = query_point - pbcShift;
        if(!queue.full() || queue.top().distanceSq > t.minimumDistance(t.root, q)){
            qr = t.simCell.absoluteToReduced(q);
            visitNode(t.root);
        }
    }
    queue.sort();
}

template<int MAX_NEIGHBORS_LIMIT>
void NearestNeighborFinder::Query<MAX_NEIGHBORS_LIMIT>::findNeighbors(size_t particleIndex){
    findNeighbors(t.particlePos(particleIndex));
}

template<int MAX_NEIGHBORS_LIMIT>
void NearestNeighborFinder::Query<MAX_NEIGHBORS_LIMIT>::visitNode(TreeNode* node){
    if(node->isLeaf()){
        for(NeighborListAtom* atom = node->atoms; atom != nullptr; atom = atom->nextInBin){
            Neighbor n;
            n.delta = atom->pos - q;
            n.distanceSq = n.delta.squaredLength();
            if(n.distanceSq != 0){
                n.atom = atom;
                n.index = atom - &t.atoms.front();
                queue.insert(n);
            }
        }
    }else{
        TreeNode* cnear;
        TreeNode* cfar;
        if(qr[node->splitDim] < node->splitPos){
            cnear = node->children[0];
            cfar  = node->children[1];
        }else{
            cnear = node->children[1];
            cfar  = node->children[0];
        }
        visitNode(cnear);

        if(!queue.full() || queue.top().distanceSq > t.minimumDistance(cfar, q)){
            visitNode(cfar);
        }
    }
}

// Inserts a single atom into the bounding-volume tree. Splits a leaf
// if its bucket overflows, choosing the largest box dimension to cut in half.
void NearestNeighborFinder::insertParticle(NeighborListAtom* atom, const Point3& p, TreeNode* node, int depth){
	if(node->isLeaf()){
		// Add to thist leaf's linked list
		//assert(node->bounds.classifyPoint(p) != -1);
		atom->nextInBin = node->atoms;
		node->atoms = atom;
		node->numAtoms++;
		if(depth > maxTreeDepth) maxTreeDepth = depth;

		// If too many atoms, split this leaf on its longest axis
		if(node->numAtoms > bucketSize && depth < TREE_DEPTH_LIMIT){
			splitLeafNode(node, determineSplitDirection(node));
		}
	}else{
		// Recurse into the appropiate child
		if(p[node->splitDim] < node->splitPos){
			insertParticle(atom, p, node->children[0], depth+1);
		}else{
			insertParticle(atom, p, node->children[1], depth+1);
		}
	}
}

// Chooses the split axis by comparing physical box sizes in each dimension,
// scaled by the simulation cell basis vectors.
int NearestNeighborFinder::determineSplitDirection(TreeNode* node){
	double dmax = 0.0;
	int dmax_dim = -1;
	for(int dim = 0; dim < 3; dim++){
		double d = simCell.matrix().column(dim).squaredLength() * node->bounds.size(dim) * node->bounds.size(dim);
		if(d > dmax){
			dmax = d;
			dmax_dim = dim;
		}
	}
	//assert(dmax_dim >= 0);
	return dmax_dim;
}

// Splits a leaf node into two children along "splitDim" at the midpoint.
// Re-distributes all atoms in this leaf into the two new child leaves.
void NearestNeighborFinder::splitLeafNode(TreeNode* node, int splitDim){
	NeighborListAtom* atom = node->atoms;

	// Allocate children
	node->splitDim = splitDim;
	node->splitPos = (node->bounds.minc[splitDim] + node->bounds.maxc[splitDim]) * 0.5;
	node->children[0] = nodePool.construct();
	node->children[1] = nodePool.construct();
	node->children[0]->bounds = node->bounds;
	node->children[1]->bounds = node->bounds;
	node->children[0]->bounds.maxc[splitDim] = node->children[1]->bounds.minc[splitDim] = node->splitPos;

	// Redistribute atoms to child nodes.
	while(atom != nullptr){
		NeighborListAtom* next = atom->nextInBin;
		double p = simCell.inverseMatrix().prodrow(atom->pos, splitDim);
		if(p < node->splitPos){
			atom->nextInBin = node->children[0]->atoms;
			node->children[0]->atoms = atom;
		}else{
			atom->nextInBin = node->children[1]->atoms;
			node->children[1]->atoms = atom;
		}
		atom = next;
	}

	numLeafNodes++;
}

// Builds the entire tree from a flat list of particle positions and an optional
// selection mask. Handles periodic boundaries by generating a short list of image
// shifts, sorting them nearest-first and inserting every selected atom into the three.
bool NearestNeighborFinder::prepare(
    ParticleProperty* posProperty, 
    const SimulationCell& cellData, 
    ParticleProperty* selectionProperty
){
	//assert(posProperty);

	simCell = cellData;

	// Automatically disable PBCs in Z direction for 2D systems.
	if(simCell.is2D()){
		simCell.setPbcFlags(simCell.pbcFlags()[0], simCell.pbcFlags()[1], false);
		AffineTransformation matrix = simCell.matrix();
		matrix.column(2) = Vector3(0, 0, 0.01f);
		simCell.setMatrix(matrix);
	}

	if(simCell.volume3D() <= EPSILON){
		throw std::runtime_error("Simulation cell is degenerate.");
	}

	// Compute normal vectors of simulation cell faces.
	planeNormals[0] = simCell.cellNormalVector(0);
	planeNormals[1] = simCell.cellNormalVector(1);
	planeNormals[2] = simCell.cellNormalVector(2);

	// Create list of periodic image shift vectors.
	int nx = simCell.pbcFlags()[0] ? 1 : 0;
	int ny = simCell.pbcFlags()[1] ? 1 : 0;
	int nz = simCell.pbcFlags()[2] ? 1 : 0;

	for(int iz = -nz; iz <= nz; iz++){
		for(int iy = -ny; iy <= ny; iy++){
			for(int ix = -nx; ix <= nx; ix++){
				pbcImages.push_back(simCell.matrix() * Vector3(ix,iy,iz));
			}
		}
	}

	// Sort images by increasing shift distances
	std::sort(pbcImages.begin(), pbcImages.end(), [](const Vector3& a, const Vector3& b){
		return a.squaredLength() < b.squaredLength();
	});

	// Determine reduced-space bounding box if any PBC is off
	Box3 boundingBox(Point3(0,0,0), Point3(1,1,1));
	if(simCell.pbcFlags()[0] == false || simCell.pbcFlags()[1] == false || simCell.pbcFlags()[2] == false){
		for(const Point3& p : posProperty->constPoint3Range()){
			Point3 reducedp = simCell.absoluteToReduced(p);
			if(simCell.pbcFlags()[0] == false){
				if(reducedp.x() < boundingBox.minc.x()){
					boundingBox.minc.x() = reducedp.x();
				}else if(reducedp.x() > boundingBox.maxc.x()){
					boundingBox.maxc.x() = reducedp.x();
				}
			}
			if(simCell.pbcFlags()[1] == false){
				if(reducedp.y() < boundingBox.minc.y()){
					boundingBox.minc.y() = reducedp.y();
				}else if(reducedp.y() > boundingBox.maxc.y()){
					boundingBox.maxc.y() = reducedp.y();
				}
			}
			if(simCell.pbcFlags()[2] == false){
				if(reducedp.z() < boundingBox.minc.z()){
					boundingBox.minc.z() = reducedp.z();
				}else if(reducedp.z() > boundingBox.maxc.z()){
					boundingBox.maxc.z() = reducedp.z();
				}
			}
		}
	}

	// Create root node.
	root = nodePool.construct();
	root->bounds = boundingBox;
	numLeafNodes++;

	// Create first level of child nodes by splitting in X direction.
	splitLeafNode(root, 0);

	// Create second level of child nodes by splitting in Y direction.
	splitLeafNode(root->children[0], 1);
	splitLeafNode(root->children[1], 1);

	// Create third level of child nodes by splitting in Z direction.
	splitLeafNode(root->children[0]->children[0], 2);
	splitLeafNode(root->children[0]->children[1], 2);
	splitLeafNode(root->children[1]->children[0], 2);
	splitLeafNode(root->children[1]->children[1], 2);

	// Insert particles into tree structure. Refine tree as needed.
	const Point3* p = posProperty->constDataPoint3();
	const int* sel = selectionProperty ? selectionProperty->constDataInt() : nullptr;
	atoms.resize(posProperty->size());

	for(NeighborListAtom& a : atoms){
		a.pos = *p;
		// Wrap atomic positions back into simulation box.
		Point3 rp = simCell.absoluteToReduced(a.pos);
		for(size_t k = 0; k < 3; k++){
			if(simCell.pbcFlags()[k]){
				if(double s = floor(rp[k])){
					rp[k] -= s;
					a.pos -= s * simCell.matrix().column(k);
				}
			}
		}

		// TODO: remove selections
		if(!sel || *sel++){
			insertParticle(&a, rp, root, 0);
		}
		++p;
	}

	// Switch all node bounds into real coordinates for later distance tests
	root->convertToAbsoluteCoordinates(simCell);
	return true;
}

// Explicit instantiations of the templated Query for common neighbor limits
template class NearestNeighborFinder::Query<16>;
template class NearestNeighborFinder::Query<18>;
template class NearestNeighborFinder::Query<32>;
template class NearestNeighborFinder::Query<64>;
template class NearestNeighborFinder::Query<128>;

}