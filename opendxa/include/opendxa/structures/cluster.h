#pragma once

#include <opendxa/core/opendxa.h>

namespace OpenDXA{

inline constexpr double CA_TRANSITION_MATRIX_EPSILON = double(1e-4);

struct Cluster;
struct ClusterTransition;

struct ClusterTransition{
	Cluster* cluster1 = nullptr;
	Cluster* cluster2 = nullptr;
	Matrix3 tm{};
	ClusterTransition* reverse = nullptr;
	ClusterTransition* next = nullptr;
	int distance = 1;
	int area = 0;

	[[nodiscard]] bool isSelfTransition() const{
		//assert((reverse != this) || (cluster1 == cluster2));
		//assert((reverse != this) || tm.equals(Matrix3::Identity(), CA_TRANSITION_MATRIX_EPSILON));
		//assert((reverse != this) || (distance == 0));

		return reverse == this;
	}

	[[nodiscard]] Vector3 transform(const Vector3& vector) const{
		return isSelfTransition() ? vector : (tm * vector);
	}

	[[nodiscard]] Vector3 reverseTransform(const Vector3& vector) const{
		return isSelfTransition() ? vector : (reverse->tm * vector);
	}
};

struct Cluster{
	int id;
	int structure;
	int atomCount = 0;

	ClusterTransition* transitions = nullptr;
	ClusterTransition* predecessor = nullptr;

	union{
		int distanceFromStart;
		int rank;
	};

	Matrix3 orientation = Matrix3::Identity();
	int symmetryTransformation = 0;
	Point3 centerOfMass = Point3::Origin();
	ClusterTransition* parentTransition = nullptr;

	Cluster(int _id, int _structure) : id(_id), structure(_structure){}

	void insertTransition(ClusterTransition* newTransition){
		//assert(newTransition->cluster1 == this);
		ClusterTransition* prev = nullptr;

		for(auto* transition = transitions; transition && transition->distance < newTransition->distance; transition = transition->next){
			prev = transition;
		}

		if(prev){
			newTransition->next = prev->next;
			prev->next = newTransition;
			//assert(prev->distance < newTransition->distance);
		}else{
			newTransition->next = transitions;
			transitions = newTransition;
		}
	}

	void removeTransition(ClusterTransition* transition){
		if(transitions == transition){
			transitions = transition->next;
			transition->next = nullptr;
			return;
		}

		for(auto *iter = transitions; iter; iter = iter->next){
			if(iter->next != transition) continue;

			iter->next = transition->next;
			transition->next = nullptr;
			return;
		}

		//assert(false);
	}

	[[nodiscard]] ClusterTransition* findTransition(Cluster* clusterB) const{
		for(auto* transition = transitions; transition; transition = transition->next){
			if(transition->cluster2 == clusterB) return transition;
		}

		return nullptr;
	}

	[[nodiscard]] bool hasTransition(ClusterTransition* target) const{
		for(auto* transition = transitions; transition; transition = transition->next){
			if(transition == target) return true;
		}
		return false;
	}
};

}