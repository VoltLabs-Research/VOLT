#include <opendxa/core/opendxa.h>
#include <opendxa/structures/dislocation_network.h>

namespace OpenDXA{

DislocationNetwork::DislocationNetwork(const DislocationNetwork& other): _clusterGraph(other._clusterGraph){
	_segments.reserve(other._segments.size());

	for(const auto *oldSegment : other.segments()){
		assert(oldSegment->replacedWith == nullptr);
		assert(oldSegment->id == static_cast<int>(_segments.size()));

		auto* newSegment = createSegment(oldSegment->burgersVector);
		newSegment->line = oldSegment->line;
		newSegment->coreSize = oldSegment->coreSize;

		assert(newSegment->id == oldSegment->id);
	}

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

DislocationSegment* DislocationNetwork::createSegment(const ClusterVector& burgersVector){
	auto *forwardNode = _nodePool.construct();
	auto *backwardNode = _nodePool.construct();

	auto *segment = _segmentPool.construct(burgersVector, forwardNode, backwardNode);
	segment->id = static_cast<int>(_segments.size());
	_segments.push_back(segment);

	return segment;
}

void DislocationNetwork::discardSegment(DislocationSegment* segment){
	assert(segment != nullptr);
	const auto it = std::ranges::find(_segments, segment);
	assert(it != _segments.end());
	_segments.erase(it);
}

[[nodiscard]]
Point3 DislocationSegment::getPointOnLine(double t) const{
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