#include <opendxa/core/opendxa.h>
#include <opendxa/structures/dislocation_network.h>

namespace OpenDXA{

// Reconstruct an independent copy of an existing DislocationNetwork by duplicating
// each segment's Burger vector, line geometry, and connection information.
// Any segment that were linked together via junctions are re-wired in the new network
// to preserve topological continuity.
DislocationNetwork::DislocationNetwork(const DislocationNetwork& other): _clusterGraph(other._clusterGraph){
	_segments.reserve(other._segments.size());

	// Copy each segment's core data and assign the same numeric ID
	for(const auto *oldSegment : other.segments()){
		assert(oldSegment->replacedWith == nullptr);
		assert(oldSegment->id == static_cast<int>(_segments.size()));

		auto* newSegment = createSegment(oldSegment->burgersVector);
		newSegment->line = oldSegment->line;
		newSegment->coreSize = oldSegment->coreSize;

		assert(newSegment->id == oldSegment->id);
	}

	// Re-stablish junction links between dangling ndoes so that segments
	// that met in the original network still meet here.
	for(size_t segmentIndex = 0; segmentIndex < other.segments().size(); ++segmentIndex){
		const auto *oldSegment = other.segments()[segmentIndex];
		auto *newSegment = _segments[segmentIndex];

		for(int nodeIndex = 0; nodeIndex < 2; ++nodeIndex){
			const auto *oldNode = oldSegment->nodes[nodeIndex];
			if(oldNode->isDangling()) continue;

			auto *oldSecondNode = oldNode->junctionRing;
			auto *newNode = newSegment->nodes[nodeIndex];
			auto *newSecondNode= _segments[oldSecondNode->segment->id]->nodes[oldSecondNode->isForwardNode() ? 0 : 1];
			newNode->junctionRing = newSecondNode;
		}
	}
}

// Allocates a new dislocation segment with the given Burgers vector, creates
// its two end nodes and assigns a unique incremental segment ID.
DislocationSegment* DislocationNetwork::createSegment(const ClusterVector& burgersVector){
	DislocationNode *forwardNode = _nodePool.construct();
	DislocationNode *backwardNode = _nodePool.construct();

	DislocationSegment *segment = _segmentPool.construct(burgersVector, forwardNode, backwardNode);
	segment->id = static_cast<int>(_segments.size());
	_segments.push_back(segment);

	return segment;
}

// Removes a segment from the network's list. The segment pointer
// must exist, otherwise an assertion is triggered.
void DislocationNetwork::discardSegment(DislocationSegment* segment){
	assert(segment != nullptr);
	const auto it = std::ranges::find(_segments, segment);
	assert(it != _segments.end());
	_segments.erase(it);
}

// Applies a two-step process to each segment curve. Coarsening to reduce
// the number of points based on core size and a user-specified interval, then smoothing
// the result with repeated Laplacian passes to remove sharp kinks. 
// Closed loops are handled differently from open lines so as not to break continuity.
void DislocationNetwork::smoothDislocationLines(double lineSmoothingLevel, double linePointInterval){
	for(DislocationSegment* segment : segments()){
		if(segment->coreSize.empty()) continue;
		std::deque<Point3> line;
		std::deque<int> coreSize;
        coarsenDislocationLine(linePointInterval, segment->line, segment->coreSize, line, coreSize, segment->isClosedLoop(), segment->isInfiniteLine());
		smoothDislocationLine(lineSmoothingLevel, line, segment->isClosedLoop());
		segment->line = std::move(line);

		// coreSize is no longer needed at  render time
		segment->coreSize.clear();
	}
}

// Reduces the number of points along a segment by averaging over intervals
// determined by the local core size and the desired spacing. Infinite lines
// and very short segments recive special handling to preserve key features
// or collapse into a straight line when the ratio of size versus length 
// exceeds a threshold.
void DislocationNetwork::coarsenDislocationLine(
	double linePointInterval,
	const std::deque<Point3>& input,
	const std::deque<int>& coreSize,
	std::deque<Point3>& output,
	std::deque<int>& outputCoreSize,
	bool isClosedLoop,
	bool isInfiniteLine
){
	assert(input.size() >= 2);
	assert(input.size() == coreSize.size());
	
	if(linePointInterval <= 0){
		output = input;
		outputCoreSize = coreSize;
		return;
	}

	// Special handling for infinite lines
	if(isInfiniteLine && input.size() >= 3){
		// Collapse into two representative points if the core is "thick"
		int coreSizeSum = std::accumulate(coreSize.cbegin(), coreSize.cend() - 1, 0);
		int count = input.size() - 1;
		if(coreSizeSum * linePointInterval > count * count){
			// Make it a straight line
			Vector3 com = Vector3::Zero();
			for(auto p = input.cbegin(); p != input.cend() - 1; ++p){
				com += *p - input.front();
			}
			output.push_back(input.front() + com / count);
            outputCoreSize.push_back(coreSizeSum / count);
            output.push_back(input.back() + com / count);
            outputCoreSize.push_back(coreSizeSum / count);
			return;
		}
	}

	// Special handling for very short segments
	if(input.size() < 4){
		output = input;
		outputCoreSize = coreSize;
		return;
	}

    // Always keep the end points of linear segments fixed to not break junctions
	if(!isClosedLoop){
		output.push_back(input.front());
        outputCoreSize.push_back(coreSize.front());
	}

    // Resulting line must contain at least two points (the end points).
    int minNumPoints = 2;

    // If the dislocation forms a loop, keep at least four points, because two points do not make a proper loop.
    if(input.front().equals(input.back(), CA_ATOM_VECTOR_EPSILON)){
        minNumPoints = 4;
	}

	auto inputPtr = input.cbegin();
	auto inputCoreSizePtr = coreSize.cbegin();

	int sum = 0;
	int count = 0;

	// Average over a half interval, starting from the beginning of the segment
	Vector3 com = Vector3::Zero();
	do{
        sum += *inputCoreSizePtr;
        com += *inputPtr - input.front();
        count++;
        ++inputPtr;
        ++inputCoreSizePtr;
	}while(2 * count * count < (int) (linePointInterval * sum) && count + 1 < input.size() / minNumPoints / 2);

	// Average over a half interval, starting from the end of the segment
	auto inputPtrEnd = input.cend() - 1;
	auto inputCoreSizePtrEnd = coreSize.cend() - 1;
	assert(inputPtr < inputPtrEnd);

	while(count * count < (int) (linePointInterval * sum) && count < input.size() / minNumPoints){
		sum += *inputCoreSizePtrEnd;
        com += *inputPtrEnd - input.back();
        count++;
        --inputPtrEnd;
        --inputCoreSizePtrEnd;
	}

	assert(inputPtr < inputPtrEnd);
	if(isClosedLoop){
		output.push_back(input.front() + com / count);
        outputCoreSize.push_back(sum / count);
	}

	while(inputPtr < inputPtrEnd){
		int sum = 0;
		int count = 0;
		Vector3 com = Vector3::Zero();
		do{
			sum += *inputCoreSizePtr++;
            com.x() += inputPtr->x();
            com.y() += inputPtr->y();
            com.z() += inputPtr->z();
            count++;
            ++inputPtr; 
		}while(count * count < (int) (linePointInterval * sum) && count + 1 < input.size() / minNumPoints && inputPtr != inputPtrEnd);
		output.push_back(Point3::Origin() + com / count);
        outputCoreSize.push_back(sum / count);
	}

	if(!isClosedLoop){
        // Always keep the end points of linear segments to not break junctions
		output.push_back(input.back());
        outputCoreSize.push_back(coreSize.back());
	}else{
		output.push_back(input.back() + com / count);
        outputCoreSize.push_back(sum / count);
	}

	assert(output.size() >= minNumPoints);
	assert(!isClosedLoop || isInfiniteLine || output.size() >= 3);
}

// Applies Laplacian smoothing to a polyline by repeteadly replacing each interior point
// with a weighted average of its neighbors. Open lines keep their ends fixed, while loops
// wap the neighborhood around. The two-pass filter uses parameters that give a gentle "umbrella"
// smoothing effect without significant shrinkage.
void DislocationNetwork::smoothDislocationLine(double smoothingLevel, std::deque<Point3>& line, bool isLoop){
	// Nothing to do
	if(smoothingLevel <= 0 || line.size() <= 2){
		return;
	}

	// Do not smooth loops consisting of very few segments
	if(line.size() <= 4 && line.front().equals(line.back(), CA_ATOM_VECTOR_EPSILON)){
		return;
	}

	double k_PB = 0.1f;
    double lambda = 0.5f;
    double mu = 1.0f / (k_PB - 1.0f/lambda);
    const double prefactors[2] = { lambda, mu };
    std::vector<Vector3> laplacians(line.size());
	for(int iteration = 0; iteration < smoothingLevel; iteration++){
		for(int pass = 0; pass <= 1; pass++){
			// Compute discrete laplacian for each point
			auto l = laplacians.begin();
			if(isLoop == false){
				(*l++).setZero();
			}else{
                (*l++) = ((*(line.end() - 2) - *(line.end() - 3)) + (*(line.begin() + 1) - line.front())) * double(0.5);
			}

			auto p1 = line.cbegin();
			auto p2 = line.cbegin() + 1;
			for(;;){
				auto p0 = p1;
				++p1;
				++p2;
				if(p2 == line.cend()) break;
                *l++ = ((*p0 - *p1) + (*p2 - *p1)) * double(0.5);
			}

			*l++ = laplacians.front();
			assert(l == laplacians.end());

			auto lc = laplacians.cbegin();
			for(Point3 &p : line){
				p += prefactors[pass] * (*lc++);
			}
		}
	}
}

// Given a polyline, returns the point at fractional arc-length t (0 ... 1) by walking
// along the segments and interpolating linearly when the accumulated length exceeds the 
// target. If the line is degenerate or empty, returns the origin.
[[nodiscard]] Point3 DislocationSegment::getPointOnLine(double t) const{
	if(line.empty() || isDegenerate()){
		return Point3::Origin();
	}

	t *= calculateLength();
	double sum = 0;

	for(auto i1 = line.begin(); std::next(i1) != line.end(); ++i1){
		const auto i2 = std::next(i1);
		const auto delta = *i2 - *i1;
		const auto len = delta.length();

		if(len != 0 && sum + len >= t){
			return *i1 + ((t - sum) / len) * delta;
		}

		sum += len;
	}

	return line.back();
}

}