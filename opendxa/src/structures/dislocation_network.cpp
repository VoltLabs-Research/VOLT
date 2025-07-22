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
	segment->id = _segments.size();
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

    if(linePointInterval <= 0 || input.size() < 4){
        output = input;
        outputCoreSize = coreSize;
        return;
    }

    if(isInfiniteLine && input.size() >= 3){
        int coreSizeSum = std::accumulate(coreSize.cbegin(), coreSize.cend() - 1, 0);
        int count = input.empty() ? 0 : static_cast<int>(input.size()) - 1;
        if(count > 0 && coreSizeSum * linePointInterval > count * count){
            Vector3 com = Vector3::Zero();
            for(auto p = input.cbegin(); p != input.cend() - 1; ++p){
                com += (*p - input.front());
            }
            if(count != 0){
                output.push_back(input.front() + com / count);
                outputCoreSize.push_back(coreSizeSum / count);
                output.push_back(input.back() + com / count);
                outputCoreSize.push_back(coreSizeSum / count);
            }
            return;
        }
    }

    output.clear();
    outputCoreSize.clear();

    if(!isClosedLoop){
        output.push_back(input.front());
        outputCoreSize.push_back(coreSize.front());
    }

    size_t minNumPoints = isClosedLoop ? 4 : 2;

    auto point_it = isClosedLoop ? input.cbegin() : std::next(input.cbegin());
    auto core_it = isClosedLoop ? coreSize.cbegin() : std::next(coreSize.cbegin());
    auto end_it = isClosedLoop ? input.cend() : std::prev(input.cend());

    while(point_it != end_it){
        Vector3 com = Vector3::Zero();
        int sum = 0;
        int count = 0;

        do{
            com += (*point_it - Point3::Origin()); 
            sum += *core_it;
            count++;
            ++point_it;
            ++core_it;
        }while(
            point_it != end_it &&
            (static_cast<double>(count) * count) < (linePointInterval * sum)
        );

        if(count > 0){
            output.push_back(Point3::Origin() + com / count);
            outputCoreSize.push_back(sum / count);
        }
    }

    if(!isClosedLoop){
        output.push_back(input.back());
        outputCoreSize.push_back(coreSize.back());
    }else if(!output.empty()){
        output.push_back(output.front());
        outputCoreSize.push_back(outputCoreSize.front());
    }

    if(output.size() < minNumPoints){
        output = input;
        outputCoreSize = coreSize;
    }
}
void DislocationNetwork::smoothDislocationLine(double smoothingLevel, std::deque<Point3>& line, bool isLoop){
    // If anti-aliasing is off or the line is too short to anti-alias, do nothing.
	if(smoothingLevel <= 0 || line.size() <= 2){
		return;
	}

	// Do not smooth closed loops that are very small (e.g. a triangle or a square)
	if(isLoop && line.size() <= 4){
		return;
	}

	// Smoothing parameters (two-pass lambda/mu scheme to avoid shrinkage)
	// These are standard parameters in Laplacian smoothing.
    const double lambda = 0.5;
    const double mu = -0.52; 
    const double prefactors[2] = { lambda, mu };
    
    std::vector<Vector3> laplacians(line.size());

    // The 'smoothingLevel' controls the number of iterations. More iterations = smoother.
	for(int iteration = 0; static_cast<double>(iteration) < smoothingLevel; ++iteration){
		// Two passes are applied per iteration: one that contracts (lambda) and one that expands (mu).
        for(int pass = 0; pass < 2; ++pass){
			
            // Calculate the Laplacian vectors for each point.
			// The Laplacian of a point is the difference between the average of its neighbors and the point itself.
			for(size_t i = 0; i < line.size(); ++i){
				// For open lines, the endpoints do not move to maintain connections.
                if(!isLoop && (i == 0 || i == line.size() - 1)){
					laplacians[i].setZero();
					continue;
				}

                // For closed loops, the neighbor before the first is the second to last.
				const Point3& p_prev = (i == 0) ? line[line.size() - 2] : line[i - 1];
				const Point3& p_curr = line[i];
                // The next neighbor to the last is the second (the first is repeated at the end).
				const Point3& p_next = (i == line.size() - 1) ? line[1] : line[i + 1];

				laplacians[i] = (p_prev - p_curr) + (p_next - p_curr);
			}

			// Move each point a fraction of its Laplacian.
			for(size_t i = 0; i < line.size(); ++i){
				line[i] += prefactors[pass] * 0.5 * laplacians[i];
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