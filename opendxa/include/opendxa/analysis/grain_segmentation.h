#pragma once

#include <opendxa/core/particle_property.h>
#include <opendxa/core/simulation_cell.h>
#include <opendxa/math/matrix3.h>
#include <opendxa/math/quaternion.h>
#include <opendxa/structures/crystal_structure_types.h>
#include <opendxa/analysis/polyhedral_template_matching.h>
#include <opendxa/analysis/nearest_neighbor_finder.h>
#include <opendxa/analysis/ptm_neighbor_finder.h>

#include <ptm_functions.h>
#include <boost/sort/sort.hpp>
#include <boost/intrusive/rbtree_algorithms.hpp>
#include <boost/heap/priority_queue.hpp>
#include <tbb/blocked_range.h>
#include <tbb/parallel_for.h>
#include <tbb/enumerable_thread_specific.h>
#include <tbb/partitioner.h>
#include <tbb/parallel_sort.h>

#include <vector>
#include <unordered_set>
#include <queue>
#include <cmath>
#include <numeric>
#include <limits>
#include <stdexcept>
#include <algorithm>

namespace OpenDXA{

union NodeUnion{
    size_t opposite;
    size_t size;
};

struct HalfEdge{
    HalfEdge* _parent;
    HalfEdge* _left;
    HalfEdge* _right;
    int _color;

    NodeUnion data;
    double weight;
};

inline double calculateMedian(std::vector<double>& data){
    size_t n = data.size();
    std::sort(data.begin(), data.end());
    double median = data[n / 2];
    if(n % 2 == 0){
        median += data[n / 2 - 1];
        median /= 2;
    }
    return median;
}

inline void weightedLinearRegression(
    std::vector<double>& weights,
    std::vector<double>& xs,
    std::vector<double>& ys,
    double& gradient,
    double& intercept
){
    // Normalize weights
    double wsum = 0;
    for(auto w : weights){
        wsum += w;
    }

    for(size_t i = 0; i < weights.size(); i++){
        weights[i] /= wsum;
    }

    // Calculate means
    double xmean = 0;
    double ymean = 0;
    for(size_t i = 0; i < weights.size(); i++){
        xmean += weights[i] * xs[i];
        ymean += weights[i] * ys[i];
    }

    // Calculate relevant covariance elements
    double sum_xx = 0;
    double sum_xy = 0;
    for(size_t i = 0; i < weights.size(); i++){
        sum_xx += weights[i] * (xs[i] - xmean) * (xs[i] - xmean);
        sum_xy += weights[i] * (xs[i] - xmean) * (ys[i] - ymean);
    }

    // Calculate gradient and intercept
    gradient = sum_xy / sum_xx;
    intercept = ymean - gradient * xmean;
}

inline std::vector<double> leastAbsoluteDeviations(
    std::vector<double>& weights, 
    std::vector<double>& xs, 
    std::vector<double>& ys, 
    double& gradient, 
    double& intercept
){
    std::vector<double> residuals(weights.size());
    std::vector<double> w(weights);

    // Iteratively-reweighted least squares
    for(int it = 0; it < 100; it++){
        weightedLinearRegression(w, xs, ys, gradient, intercept);
        
        // Update residuals and weights
        for(size_t i = 0; i < xs.size(); i++){
            double prediction = gradient * xs[i] + intercept;
            double r = std::abs(ys[i] - prediction);
            residuals[i] = r;
            w[i] = weights[i] / std::max(1E-4, r);
        }
    }

    return residuals;
}  

struct rbtree_node_traits{
    typedef HalfEdge node;
    typedef HalfEdge* node_ptr;
    typedef const HalfEdge* const_node_ptr;
    typedef int color;

    static node_ptr get_parent(const_node_ptr n){
        return n->_parent;
    }

    static void set_parent(node_ptr n, node_ptr p){
        n->_parent = p;
    }

    static node_ptr get_left(const_node_ptr n){
        return n->_left;
    }
    
    static void set_left(node_ptr n, node_ptr l){
        n->_left = l;
    }

    static node_ptr get_right(const_node_ptr n){
        return n->_right;
    }

    static void set_right(node_ptr n, node_ptr r){
        n->_right = r;
    }

    static color get_color(const_node_ptr n){
        return n->_color;
    }

    static void set_color(node_ptr n, color c){
        n->_color = c;
    }

    static color black(){
        return color(0);
    }

    static color red(){
        return color(1);
    }
};

struct node_ptr_compare{
    bool operator()(const HalfEdge* a, const HalfEdge* b) const{
        return a->data.opposite < b->data.opposite;
    }
};

typedef boost::intrusive::rbtree_algorithms<rbtree_node_traits> algo;


static inline HalfEdge* find(HalfEdge* header, size_t index){
    HalfEdge key;
    key.data.opposite = index;
    HalfEdge* result = algo::find(header, &key, node_ptr_compare());
    return result == header ? nullptr : result;
}

static inline void insert_halfedge(HalfEdge* header, HalfEdge* edge){
    algo::insert_equal_upper_bound(header, edge, node_ptr_compare());
    header->data.size++;
}

class DisjointSet{
public:
    DisjointSet(size_t n){
        parents.resize(n);
        sizes.resize(n);
        clear();
    }

    void clear(){
        std::iota(parents.begin(), parents.end(), (size_t) 0);
        std::fill(sizes.begin(), sizes.end(), 1);
    }

    // "Find" part of Union-Find.
    size_t find(size_t index){
        // Find root and make root as parent of i (path compression)
        size_t x = parents[index];
        while(x != parents[x]){
            parents[x] = parents[parents[x]];
            x = parents[x];
        }
        parents[index] = x;
        return x;
    }

    // "Union" part of Union-Find.
    size_t merge(size_t index1, size_t index2){
        size_t parentA = find(index1);
        size_t parentB = find(index2);
        if(parentA == parentB) return parentA;

        // Attach smaller tree under root of larger tree
        if(sizes[parentA] < sizes[parentB]){
            parents[parentA] = parentB;
            sizes[parentB] += sizes[parentA];
            return parentB;
        }else{
            parents[parentB] = parentA;
            sizes[parentA] += sizes[parentB];
            return parentA;
        }
    }

    size_t nodesize(size_t index) const{
        return sizes[index];
    }
    
private:
    std::vector<size_t> parents;
    std::vector<size_t> sizes;
};

class GrainSegmentationEngine1{
public:
    class Graph{
    public:
        std::vector<double> wnode;
        std::vector<HalfEdge> header;
        std::vector<HalfEdge> edgeBuffer;
        size_t edgeCount = 0;
        std::unordered_set<size_t> activeNodes;

        Graph(size_t numNodes, size_t numEdges){
            wnode.assign(numNodes, 0.0);
            header.resize(numNodes);
            for(size_t i = 0; i < numNodes; ++i){
                algo::init_header(&header[i]);
                header[i].data.size = 0;
            }
            edgeBuffer.resize(2 * numEdges);
        }

        size_t num_nodes() const{
            return activeNodes.size();
        }

        size_t next_node() const{
            return *activeNodes.begin();
        } 

        std::tuple<double, size_t> nearestNeighbor(size_t a) const{
            double dmin = std::numeric_limits<double>::infinity();
            size_t vmin = std::numeric_limits<size_t>::max();

            HalfEdge* e = header[a]._left;
            for(size_t it = 0; it < header[a].data.size; ++it){
                size_t v = e->data.opposite;
                double w = e->weight;
                e = algo::next_node(e);

                if(v == a){
                    throw std::runtime_error("Graph has self loops");
                }

                double d = wnode[v] / std::max(w, 1e-300);
                if(d < dmin || (d == dmin && v < vmin)){
                    dmin = d; vmin = v;
                }
            }

            return std::make_tuple(dmin * wnode[a], vmin);
        }

        void add_edge(size_t u, size_t v, double w){
            size_t nodes[2] = {u,v};
            for(size_t idx : nodes){
                if(header[idx].data.size == 0){
                    activeNodes.insert(idx);
                }

                wnode[idx] += w;
            }

            HalfEdge* e = &edgeBuffer[edgeCount++];
            e->data.opposite = v; e->weight = w;
            insert_halfedge(&header[u], e);

            e = &edgeBuffer[edgeCount++];
            e->data.opposite = u; e->weight = w;
            insert_halfedge(&header[v], e);
        }

        void remove_node(size_t u){
            activeNodes.erase(u);
        }

        size_t contract_edge(size_t a, size_t b){
            if(header[b].data.size > header[a].data.size){
                std::swap(a,b);
            }

            algo::unlink(find(&header[b], a));
            algo::unlink(find(&header[a], b));
            header[a].data.size--;
            header[b].data.size--;

            HalfEdge* edge = header[b]._left;
            while(header[b].data.size != 0){
                size_t v = edge->data.opposite;
                double w = edge->weight;
                HalfEdge* next = algo::next_node(edge);
                algo::unlink(edge);
                header[b].data.size--;

                HalfEdge* opposite = find(&header[v], b);
                algo::unlink(opposite);
                header[v].data.size--;

                HalfEdge* temp = find(&header[a], v);
                if(temp){
                    temp->weight += w;
                    find(&header[v], a)->weight += w;
                }else{
                    edge->data.opposite = v; edge->weight = w;
                    insert_halfedge(&header[a], edge);

                    opposite->data.opposite = a; opposite->weight = w;
                    insert_halfedge(&header[v], opposite);
                }

                edge = next;
            }

            remove_node(b);
            wnode[a] += wnode[b];
            return a;
        }
    };

    static constexpr int MAX_DISORDERED_NEIGHBORS = 8;

    struct NeighborBond{
        size_t a;
        size_t b;
        double disorientation;
        double length;
    };

    struct DendrogramNode{
        DendrogramNode() = default;
        DendrogramNode(size_t _a, size_t _b, double _distance, double _disorientation, size_t _size, const Quaternion& _orientation)
            : a(_a)
            , b(_b)
            , distance(_distance)
            , disorientation(_disorientation)
            , size(_size)
            , merge_size(0.0)
            , orientation(_orientation){}
        size_t a = 0;
        size_t b = 0;
        double distance = 0.0;
        double disorientation = 0.0;
        size_t size = 0;
        double merge_size = 0.0;
        Quaternion orientation;
    };

    class InterfaceHandler{
    public:
        explicit InterfaceHandler(const std::shared_ptr<ParticleProperty>& structures){
            int counts[(int) StructureType::NUM_STRUCTURE_TYPES] = {0};

            for(size_t i = 0; i < structures->size(); ++i){
                int t = structures->getInt(i);
                if(t >= 0 && t < (int) StructureType::NUM_STRUCTURE_TYPES){
                    counts[t]++;
                }
            }

            parent_fcc = counts[(int) StructureType::FCC] >= counts[(int) StructureType::HCP];
            parent_dcub = counts[(int) StructureType::CUBIC_DIAMOND] >= counts[(int) StructureType::HEX_DIAMOND];

            for(int k = 0;k < (int) StructureType::NUM_STRUCTURE_TYPES; ++k){
                target[k] = (StructureType) k;
            }

            if(parent_fcc){
                target[(int) StructureType::HCP] = StructureType::FCC;
            }else{
                target[(int) StructureType::FCC] = StructureType::HCP;
            }

            if(parent_dcub){
                target[(int) StructureType::HEX_DIAMOND] = StructureType::CUBIC_DIAMOND;
            }else{
                target[(int) StructureType::CUBIC_DIAMOND] = StructureType::HEX_DIAMOND;
            }
        }

        StructureType parent_phase(StructureType s) const{
            return target[(int) s];
        }

        bool reorder_bond(NeighborBond& bond, const std::vector<StructureType>& types) const{
            size_t a = bond.a;
            size_t b = bond.b;

            auto sa = types[a];
            auto sb = types[b];

            bool flipped = false;
            if(sa == StructureType::FCC && sb == StructureType::HCP){
                flipped |= !parent_fcc;
            }else if(sa == StructureType::HCP && sb == StructureType::FCC){
                flipped |=  parent_fcc;
            }else if(sa == StructureType::CUBIC_DIAMOND && sb == StructureType::HEX_DIAMOND){
                flipped |= !parent_dcub;
            }else if(sa == StructureType::HEX_DIAMOND && sb == StructureType::CUBIC_DIAMOND){
                flipped |=  parent_dcub;
            }else{
                return false;
            }

            if(flipped) std::swap(a,b);

            bond.a = a; 
            bond.b = b;

            return true;
        }

    private:
        bool parent_fcc  = true;
        bool parent_dcub = true;
        StructureType target[(int) StructureType::NUM_STRUCTURE_TYPES];
    };

    class Regressor{
    public:
        double gradient = 0;
        double intercept = 0;
        double mean_absolute_deviation = 0;

        std::vector<double> residuals;
        std::vector<double> xs;
        std::vector<double> ys;
        std::vector<double> weights;

        Regressor(std::vector<GrainSegmentationEngine1::DendrogramNode>& dendrogram){
            if(dendrogram.size() == 0){
                return;
            }

            for(auto node : dendrogram){
                weights.push_back(node.merge_size);
                xs.push_back(log(node.merge_size));
                ys.push_back(log(node.distance));
            }

            residuals = leastAbsoluteDeviations(weights, xs, ys, gradient, intercept);
            mean_absolute_deviation = calculateMedian(residuals); 
        }

        double calculate_threshold(std::vector<GrainSegmentationEngine1::DendrogramNode>& dendrogram, double cutoff){
            // Select the threshold as the inlier with the largest distance.
            double threshold = 0;
            for(auto node : dendrogram) {
                double x = log(node.merge_size);
                double y = log(node.distance);

                double prediction = x * gradient + intercept;
                double residual = y - prediction;
                if (residual < cutoff * mean_absolute_deviation) {
                    threshold = std::max(threshold, y);
                }
            }

            return threshold;
        }
    };

    GrainSegmentationEngine1(
        std::shared_ptr<ParticleProperty> positions,
        std::shared_ptr<ParticleProperty> structures,
        std::shared_ptr<ParticleProperty> orientations,
        std::shared_ptr<ParticleProperty> correspondences,
        const SimulationCell* simCell,
        bool handleCoherentInterfaces,
        bool outputBonds
    )
    : _handleBoundaries(handleCoherentInterfaces)
    , _numParticles(positions ? positions->size() : 0)
    , _positions(std::move(positions))
    , _structuresProperty(std::move(structures))
    , _orientationsProperty(std::move(orientations))
    , _correspondencesProperty(std::move(correspondences))
    , _simCell(*simCell)
    , _outputBonds(outputBonds)
    {
        _adjustedStructureTypes.resize(_numParticles, StructureType::OTHER);
        _adjustedOrientations.resize(_numParticles);

        for(size_t i=0;i<_numParticles;++i){
            _adjustedStructureTypes[i] = (StructureType)_structuresProperty->getInt(i);
            const double* q = _orientationsProperty->dataDouble() + 4 * i;
            _adjustedOrientations[i] = Quaternion(q[0], q[1], q[2], q[3]);
            _adjustedOrientations[i].normalize();
        }
    }

    void perform(){
        createNeighborBonds();
        rotateInterfaceAtoms();
        computeDisorientationAngles();
        determineMergeSequence();

        _positions.reset();
    }

    const std::vector<DendrogramNode>& dendrogram() const{
        return _dendrogram;
    }

    double suggestedMergingThreshold() const{
        return _suggestedMergingThreshold;
    }

    const std::shared_ptr<ParticleProperty>& structuresProperty() const{
        return _structuresProperty;
    }

    const std::shared_ptr<ParticleProperty>& orientationsProperty() const{
        return _orientationsProperty;
    }

private:
    // TODO: Duplicated
    static inline Matrix3 quaternionToMatrix(const Quaternion& q){
        double w = q.w();
        double x = q.x();
        double y = q.y();
        double z = q.z();
        Matrix3 R;

        R(0, 0)= 1 - 2 * (y * y+ z * z); 
        R(0, 1)= 2 * (x * y - w * z); 
        R(0, 2)= 2 * (x * z + w * y);
        R(1, 0)= 2 * (x * y + w * z);  
        R(1, 1)= 1 - 2 * (x * x + z * z); 
        R(1, 2)= 2 * (y * z - w * x);
        R(2, 0)= 2 * (x * z - w * y);
        R(2, 1)= 2 * (y * z + w * x);
        R(2, 2)= 1 - 2 * (x * x + y * y);
        return R;
    }

    static inline Quaternion quaternionFromMatrix(const Matrix3& R){
        double tr = R(0, 0) + R(1, 1) + R(2, 2);
        double qw, qx, qy, qz;

        if(tr > 0){
            double S = std::sqrt(tr + 1.0) * 2.0;
            qw = 0.25 * S; 
            qx = (R(2, 1) - R(1, 2)) / S; 
            qy = (R(0, 2) - R(2, 0)) / S; 
            qz = (R(1, 0) - R(0, 1)) / S;
        }else if(R(0, 0) > R(1, 1) && R(0, 0) > R(2, 2)){
            double S = std::sqrt(1.0 + R(0, 0) - R(1, 1) - R(2, 2)) * 2.0;
            qw = (R(2, 1) - R(1, 2)) / S; 
            qx = 0.25 * S; 
            qy = (R(0, 1) + R(1, 0)) / S; 
            qz = (R(0, 2) + R(2, 0)) / S;
        }else if(R(1, 1) > R(2, 2)){
            double S = std::sqrt(1.0 + R(1, 1) - R(0, 0) - R(2, 2)) * 2.0;
            qw = (R(0, 2) - R(2, 0)) / S; 
            qx = (R(0, 1) + R(1, 0)) / S; 
            qy = 0.25 * S; 
            qz = (R(1, 2) + R(2, 1)) / S;
        }else{
            double S = std::sqrt(1.0 + R(2, 2) - R(0, 0) - R(1, 1)) * 2.0;
            qw = (R(1, 0) - R(0, 1)) / S; 
            qx = (R(0, 2) + R(2, 0)) / S; 
            qy = (R(1, 2) + R(2, 1)) / S; 
            qz = 0.25 * S;
        }
        
        Quaternion q(qx, qy, qz, qw); 
        q.normalize();
        
        return q;
    }

    static inline double rotationAngleDeg(const Matrix3& R){
        double tr = R(0, 0) + R(1, 1) + R(2, 2);
        double c = 0.5 * (tr - 1.0);
        if(c > 1.0) c = 1.0;
        if(c < -1.0) c= -1.0;
        return std::acos(c) * 180.0 / M_PI;
    }

    static double mapAndAccumulateMisorientationDeg(StructureType st, Quaternion& qa_sum, const Quaternion& qb_sum){
        if(st == StructureType::OTHER){
            return std::numeric_limits<double>::infinity();
        }

        double ang_deg = PTM::calculateDisorientation(st, st, qa_sum.normalized(), qb_sum.normalized());
        qa_sum.w() += qb_sum.w();
        qa_sum.x() += qb_sum.x();
        qa_sum.y() += qb_sum.y();
        qa_sum.z() += qb_sum.z();
        return ang_deg;
    }

    static inline double calculateGraphWeight(double theta_deg){
        if(theta_deg < 1e-5){
            theta_deg = 0.0;
        }

        return std::exp(-(1.0/3.0) * theta_deg * theta_deg);
    }

    static inline int desired_ptm_neighbor_count(StructureType st, int available){
        if(st == StructureType::OTHER){
            return std::min(available, MAX_DISORDERED_NEIGHBORS);
        }

        int ptmType = PTM::toPtmStructureType(st);
        int want = ptm_num_nbrs[ptmType];
        return std::min(available, want);
    } 

private:
    void createNeighborBonds(){
        PTMNeighborFinder neighFinder(
            false, 
            _positions, 
            _structuresProperty, 
            _orientationsProperty, 
            _correspondencesProperty, 
            _simCell
        );

        using BaseQuery = NearestNeighborFinder::Query<PTM::MAX_INPUT_NEIGHBORS>;
        tbb::enumerable_thread_specific<BaseQuery> baseQueries([&]{
            return BaseQuery(neighFinder);
        });

        tbb::enumerable_thread_specific<std::vector<NeighborBond>> tlsBonds;

        tbb::parallel_for(tbb::blocked_range<std::size_t>(0, _numParticles, 1024), [&](const tbb::blocked_range<std::size_t>& r){
            auto& base = baseQueries.local();
            auto& out = tlsBonds.local();

            for(size_t i = r.begin(); i != r.end(); ++i){
                base.findNeighbors(i);
                const auto& res = base.results();
                int available = (int) res.size();

                StructureType st = (StructureType) _structuresProperty->getInt(i);
                int num = desired_ptm_neighbor_count(st, available);

                for(int j = 0; j < num; ++j){
                    size_t nb = res[j].index;
                    if(i < nb){
                        double length = std::sqrt(res[j].distanceSq);
                        out.push_back({ i, nb, std::numeric_limits<double>::infinity(), length });
                    }
                }
            }
        }, tbb::auto_partitioner{});

        tlsBonds.combine_each([&](const std::vector<NeighborBond>& v){
            _neighborBonds.insert(_neighborBonds.end(), v.begin(), v.end());
        });
    }

    // coherent interfaces
    bool interface_cubic_hex(NeighborBond& bond, const InterfaceHandler& iface, Quaternion& outRot){
        bond.disorientation = std::numeric_limits<double>::infinity();
        if(!iface.reorder_bond(bond, _adjustedStructureTypes)){
            return false;
        }

        size_t a = bond.a;
        size_t b = bond.b;

        const StructureType sa = _adjustedStructureTypes[a];
        const StructureType sb = _adjustedStructureTypes[b];

        Quaternion qrot;
        double mis = PTM::calculateInterfacialDisorientation(sa, sb, _adjustedOrientations[a], _adjustedOrientations[b], qrot);
        bond.disorientation = mis;
        outRot = qrot;
        return mis < _misorientationThresholdDeg;
    }

    void rotateInterfaceAtoms(){
        if(!_handleBoundaries) return;
        if(_neighborBonds.empty()) createNeighborBonds();

        InterfaceHandler iface(_structuresProperty);

        PTMNeighborFinder neighFinder(
            false, 
            _positions,
            _structuresProperty, 
            _orientationsProperty, 
            _correspondencesProperty, 
            _simCell
        );

        using BaseQuery = NearestNeighborFinder::Query<PTM::MAX_INPUT_NEIGHBORS>;
        BaseQuery base(neighFinder);

        struct PQCmp{
            bool operator()(const NeighborBond& a, const NeighborBond& b) const{
                return a.disorientation > b.disorientation; 
            }
        };

        std::priority_queue<NeighborBond, std::vector<NeighborBond>, PQCmp> pq;

        for(auto b : _neighborBonds){
            Quaternion rot;
            if(interface_cubic_hex(b, iface, rot)){
                pq.push(b);
            }
        }

        while(!pq.empty()){
            auto bond = pq.top(); 
            pq.pop();

            Quaternion rotated;
            if(!interface_cubic_hex(bond, iface, rotated)) continue;

            // defect 
            size_t idx = bond.b; 
            _adjustedStructureTypes[idx] = iface.parent_phase(_adjustedStructureTypes[idx]);
            _adjustedOrientations[idx]   = rotated;

            base.findNeighbors(idx);
            const auto& res = base.results();
            int available = (int) res.size();
            int num = desired_ptm_neighbor_count(_adjustedStructureTypes[idx], available);

            for(int j = 0;j < num; ++j){
                size_t nb = res[j].index;
                NeighborBond b2{ idx, nb, 0.0, std::sqrt(res[j].distanceSq) };
                if(interface_cubic_hex(b2, iface, rotated)){
                    pq.push(b2);
                }
            }
        }
    }

    // Misorientations
    bool isCrystallineBond(const NeighborBond& b) const{
        auto a = _adjustedStructureTypes[b.a];
        auto c = _adjustedStructureTypes[b.b];

        if(a == StructureType::OTHER) return false;
        if(c == StructureType::OTHER) return false;
        if(a == c) return true;
        if(!_handleBoundaries) return false;

        if((a == StructureType::FCC && c == StructureType::HCP) || (a == StructureType::HCP && c == StructureType::FCC)) return true;
        if((a == StructureType::CUBIC_DIAMOND && c == StructureType::HEX_DIAMOND) || (a == StructureType::HEX_DIAMOND && c == StructureType::CUBIC_DIAMOND)) return true;
        return false;
    }

    void computeDisorientationAngles(){
        if(_neighborBonds.empty()) createNeighborBonds();
        const size_t N = _neighborBonds.size();

        InterfaceHandler iface(_structuresProperty);

        tbb::parallel_for(tbb::blocked_range<size_t>(0, N, 1024), [&](const tbb::blocked_range<size_t>& r){
            for(size_t i = r.begin(); i != r.end(); ++i){
                auto& b = _neighborBonds[i];
                auto sa = _adjustedStructureTypes[b.a];
                auto sb = _adjustedStructureTypes[b.b];

                if(sa == StructureType::OTHER || sb == StructureType::OTHER){
                    b.disorientation = std::numeric_limits<double>::infinity();
                    continue;
                }

                if(sa == sb){
                    b.disorientation = PTM::calculateDisorientation(sa, sb, _adjustedOrientations[b.a], _adjustedOrientations[b.b]);
                }else if(_handleBoundaries){
                    Quaternion dummy;
                    auto tmp = b;
                    if(interface_cubic_hex(tmp, iface, dummy)){
                        b.disorientation = tmp.disorientation;
                    }else{
                        b.disorientation = std::numeric_limits<double>::infinity();
                    }
                }else{
                    b.disorientation = std::numeric_limits<double>::infinity();
                }
            }
        }, tbb::auto_partitioner{});

        tbb::parallel_sort(_neighborBonds.begin(), _neighborBonds.end(), [](const NeighborBond& x, const NeighborBond& y){
            return x.disorientation < y.disorientation;
        });
    }

    double calculate_disorientation(int structureType, Quaternion& qa, const Quaternion& qb){
        qa.normalize();
        Quaternion qb_normalized = qb.normalized();
        
        double qtarget[4] = { qa.w(), qa.x(), qa.y(), qa.z() };
        double q[4] = { qb_normalized.w(), qb_normalized.x(), qb_normalized.y(), qb_normalized.z() };

        // TODO: DUPLICATED
        // Convert structure type back to PTM representation
        int type = 0;
        if(structureType == StructureType::OTHER){
            return std::numeric_limits<double>::max();
        }else if(structureType == StructureType::FCC){
            type = PTM_MATCH_FCC;
        }else if(structureType == StructureType::HCP){
            type = PTM_MATCH_HCP;
        }else if(structureType == StructureType::BCC){
            type = PTM_MATCH_BCC;
        }else if(structureType == StructureType::SC){
            type = PTM_MATCH_SC;
        }else if(structureType == StructureType::CUBIC_DIAMOND){
            type = PTM_MATCH_DCUB;
        }else if(structureType == StructureType::HEX_DIAMOND){
            type = PTM_MATCH_DHEX;
        }else if(structureType == StructureType::GRAPHENE){
            type = PTM_MATCH_GRAPHENE;
        }

        double disorientation = (double) ptm_map_and_calculate_disorientation(type, qtarget, q);

        qa.w() += q[0];
        qa.x() += q[1];
        qa.y() += q[2];
        qa.z() += q[3];

        return disorientation;
    }

    void node_pair_sampling_clustering(Graph& graph, std::vector<Quaternion>& qsum){
        double totalWeight = 1;

        size_t progressVal = 0;
        std::vector<size_t> chain;
        while(graph.num_nodes()){
            // nearest-neighbor chain
            size_t node = graph.next_node();

            chain.push_back(node);
            while(!chain.empty()){

                size_t a = chain.back();
                chain.pop_back();

                auto [d, b] = graph.nearestNeighbor(a);
                if(b == std::numeric_limits<size_t>::max()){
                    // Remove the connected component
                    graph.remove_node(a);
                }else if(!chain.empty()){
                    size_t c = chain.back();
                    chain.pop_back();

                    if(b == c){
                        size_t parent = graph.contract_edge(a, b);
                        size_t child = (parent == a) ? b : a;

                        double disorientation = calculate_disorientation(_adjustedStructureTypes[parent], qsum[parent], qsum[child]);
                        _dendrogram.emplace_back(parent, child, d / totalWeight, disorientation, 1, qsum[parent]);
                    }else{
                        chain.push_back(c);
                        chain.push_back(a);
                        chain.push_back(b);
                    }
                }else{
                    chain.push_back(a);
                    chain.push_back(b);
                }
            }
        }
    }

    void determineMergeSequence(){
        Graph graph(_numParticles, _neighborBonds.size());
        size_t counter = 0;
        for(auto edge : _neighborBonds){
            if(isCrystallineBond(edge) && edge.disorientation < _misorientationThresholdDeg){
                double weight = calculateGraphWeight(edge.disorientation);
                graph.add_edge(edge.a, edge.b, weight);
            }
        }

        std::vector<Quaternion> qsum(_adjustedOrientations.cbegin(), _adjustedOrientations.cend());
        DisjointSet uf(_numParticles);
        _dendrogram.resize(0);
        node_pair_sampling_clustering(graph, qsum);

        std::sort(_dendrogram.begin(), _dendrogram.end(), [](const DendrogramNode& a, const DendrogramNode& b){ 
            return a.distance < b.distance; 
        });

        size_t numPlot = 0;
        uf.clear();
        for(DendrogramNode& node : _dendrogram){
            size_t sa = uf.nodesize(uf.find(node.a));
            size_t sb = uf.nodesize(uf.find(node.b));
            size_t dsize = std::min(sa, sb);

            // harmonic mean
            node.merge_size = 2. / (1. / sa + 1. / sb);
            uf.merge(node.a, node.b);

            node.size = dsize;
            if(dsize >= _minPlotSize){
                numPlot++;
            }
        }

        // Create PropertyStorage objects for the output plot.
        std::vector<double> mergeDistanceArray;
        std::vector<double> mergeSizeArray;
        
        mergeDistanceArray.reserve(numPlot);
        mergeSizeArray.reserve(numPlot);

        // Generate output data plot points from dendrogram data.
        for(const DendrogramNode& node : _dendrogram){
            if(node.size >= _minPlotSize){
                mergeDistanceArray.push_back(std::log(node.distance));
                mergeSizeArray.push_back(node.size);
            }
        }

        auto regressor = Regressor(_dendrogram);
        _suggestedMergingThreshold = regressor.calculate_threshold(_dendrogram, 1.5);

        // Create PropertyStorage objects for the output plot.
        numPlot = 0;
        for(auto y : regressor.ys){
            // plot positive distances only, for clarity
            numPlot += (y > 0) ? 1 : 0;
        }

        std::vector<double> logMergeSizeArray;
        std::vector<double> logMergeDistanceArray;
        
        logMergeSizeArray.reserve(numPlot);
        logMergeDistanceArray.reserve(numPlot);

        // Generate output data plot points from dendrogram data.
        for(size_t i = 0; i < regressor.residuals.size(); i++){
            if(regressor.ys[i] > 0){
                logMergeSizeArray.push_back(regressor.xs[i]);
                logMergeDistanceArray.push_back(regressor.ys[i]);
            }
        }
    }

private:
    static constexpr double _misorientationThresholdDeg = 4.0;
    const size_t _minPlotSize = 20;

    bool _handleBoundaries;
    size_t _numParticles;

    std::shared_ptr<ParticleProperty> _positions;
    std::shared_ptr<ParticleProperty> _structuresProperty;
    std::shared_ptr<ParticleProperty> _orientationsProperty;
    std::shared_ptr<ParticleProperty> _correspondencesProperty;

    const SimulationCell _simCell;
    bool _outputBonds;

    std::vector<NeighborBond> _neighborBonds;
    std::vector<StructureType> _adjustedStructureTypes;
    std::vector<Quaternion> _adjustedOrientations;

    std::vector<DendrogramNode> _dendrogram;
    double _suggestedMergingThreshold = 0.0;
};

class GrainSegmentationEngine2{
public:
    struct GrainInfo{
        int id; 
        size_t size; 
        Quaternion orientation; 
    };

    GrainSegmentationEngine2(
        std::shared_ptr<const GrainSegmentationEngine1> engine1,
        bool adoptOrphanAtoms,
        size_t minGrainAtomCount,
        bool colorParticlesByGrain
    )
    : _engine1(std::move(engine1))
    , _numParticles(_engine1 ? _engine1->structuresProperty()->size() : 0)
    , _adoptOrphanAtoms(adoptOrphanAtoms)
    , _minGrainAtomCount(minGrainAtomCount)
    , _colorParticlesByGrain(colorParticlesByGrain)
    {
        _atomClusters = std::make_shared<ParticleProperty>(_numParticles, DataType::Int, 1, 0, false);
    }

    void perform(){
        if(!_engine1) return;

        const auto& dendro = _engine1->dendrogram();
        double thr = _engine1->suggestedMergingThreshold();

        DisjointSet uf(_numParticles);
        std::vector<Quaternion> meanQ(_engine1->orientationsProperty()->size());
        const double* qptr = _engine1->orientationsProperty()->dataDouble();

        for(size_t i = 0; i < _numParticles; ++i){
            meanQ[i] = Quaternion(qptr[4 * i + 0], qptr[4 * i + 1], qptr[4 * i + 2], qptr[4 * i + 3]);
        }

        for(const auto& node : dendro){
            double logD = std::log(node.distance);
            if(logD > thr) break;
            uf.merge(node.a, node.b);
            size_t p = uf.find(node.a);
            meanQ[p] = node.orientation;
        }

        std::vector<size_t> rep2id(_numParticles, 0);
        size_t nextId = 1;
        for(size_t i = 0; i < _numParticles; ++i){
            if(uf.find(i) == i){
                rep2id[i] = (uf.nodesize(i) >= _minGrainAtomCount) ? nextId++ : 0;
            }
        }

        for(size_t i = 0; i < _numParticles; ++i){
            size_t rep = uf.find(i);
            _atomClusters->setInt(i, (int) rep2id[rep]);
        }

        _grainCount = nextId - 1;
        _grains.clear();
        _grains.reserve(_grainCount);

        for(size_t rep = 0; rep < _numParticles; ++rep){
            if(uf.find(rep) == rep){
                int gid = (int) rep2id[rep];
                if(gid > 0){
                    Quaternion q = meanQ[rep].normalized();
                    _grains.emplace_back(GrainInfo{gid, uf.nodesize(rep), q});
                }
            }
        }
    }

    size_t grainCount() const{
        return _grainCount;
    }

    const std::vector<GrainInfo>& grains() const{
        return _grains;
    }

    std::shared_ptr<ParticleProperty> atomClusters() const{
        return _atomClusters;
    }

private:
    std::shared_ptr<const GrainSegmentationEngine1> _engine1;
    size_t _numParticles = 0;

    bool _adoptOrphanAtoms = false;
    size_t _minGrainAtomCount = 1;
    bool _colorParticlesByGrain = false;
    size_t _grainCount = 0;

    std::vector<GrainInfo> _grains;
    std::shared_ptr<ParticleProperty> _atomClusters;
};

}