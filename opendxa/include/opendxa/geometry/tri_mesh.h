#pragma once

#include <vector>
#include <array>
#include <cstdint>
#include <cassert>
#include <algorithm>
#include <utility>
#include <ranges>
#include <opendxa/core/opendxa.h>

namespace OpenDXA {

class TriMeshFace{
public:
    enum class MeshFaceFlag : uint8_t{
        NONE = 0,
        EDGE1 = 1 << 0,
        EDGE2 = 1 << 1,
        EDGE3 = 1 << 2,
        EDGES12 = EDGE1 | EDGE2,
        EDGES23 = EDGE2 | EDGE3,
        EDGES13 = EDGE1 | EDGE3,
        EDGES123 = EDGE1 | EDGE2 | EDGE3
    };

    using MeshFaceFlags = uint8_t;

    TriMeshFace() = default;

    void setVertices(int a, int b, int c){
        _vertices = {a, b, c};
    }

    void setVertex(auto which, int newIndex){
        assert(which < 3);
        _vertices[which] = newIndex;
    }

    int vertex(auto which) const{
        assert(which < 3);
        return _vertices[which];
    }

    void setEdgeVisibility(bool e1, bool e2, bool e3){
        _flags = 0;
        if(e1) _flags |= static_cast<MeshFaceFlags>(MeshFaceFlag::EDGE1);
        if(e2) _flags |= static_cast<MeshFaceFlags>(MeshFaceFlag::EDGE2);
        if(e3) _flags |= static_cast<MeshFaceFlags>(MeshFaceFlag::EDGE3);
    }

    void setEdgeVisibility(MeshFaceFlags edgeVisibility){
        _flags = edgeVisibility;
    }

    bool edgeVisible(auto which) const{
        assert(which < 3);
        return (_flags & (1 << which)) != 0;
    }

    int materialIndex() const{
        return _materialIndex;
    }

    void setMaterialIndex(int index){
        _materialIndex = index;
    }

    void setSmoothingGroups(uint32_t smGroups){
        _smoothingGroups = smGroups;
    }

    uint32_t smoothingGroups() const{
        return _smoothingGroups;
    }

private:
    std::array<int, 3> _vertices{};
    MeshFaceFlags _flags = static_cast<MeshFaceFlags>(MeshFaceFlag::EDGES123);
    uint32_t _smoothingGroups = 0;
    int _materialIndex = 0;

    friend class TriMesh;
};

class TriMesh{
public:
    TriMesh() = default;

    void clear();

    int vertexCount() const{
        return static_cast<int>(_vertices.size());
    }

    void setVertexCount(int n);

    auto& vertices(){
        return _vertices;
    }

    const auto& vertices() const{
        return _vertices;
    }

    auto& vertex(int i){
        assert(i >= 0 && i < vertexCount());
        return _vertices[i];
    }

    const auto& vertex(int i) const{
        assert(i >= 0 && i < vertexCount());
        return _vertices[i];
    }

    int addVertex(const Point3& pos){
        _vertices.push_back(pos);
        return static_cast<int>(_vertices.size()) - 1;
    }

    void invalidateVertices(){
        _boundingBox.setEmpty();
    }

    int faceCount() const{
        return static_cast<int>(_faces.size());
    }

    void setFaceCount(int n);

    auto& faces(){
        return _faces;
    }

    const auto& faces() const{
        return _faces;
    }

    auto& face(int i){
        return _faces[i];
    }

    const auto& face(int i) const{
        return _faces[i];
    }

    TriMeshFace& addFace();

    void invalidateFaces();

    void flipFaces();

    bool intersectRay(const Ray3& ray, double& t, Vector3& normal, int& faceIndex, bool backfaceCull = true) const;

    void clipAtPlane(const Plane3& plane);

    void swap(TriMesh& other){
        std::ranges::swap(_vertices, other._vertices);
        std::ranges::swap(_faces, other._faces);
        std::swap(_boundingBox, other._boundingBox);
    }

private:
    std::vector<Point3> _vertices;
    std::vector<TriMeshFace> _faces;
    Box3 _boundingBox;
};

}