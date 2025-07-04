#include <opendxa/core/opendxa.h>
#include <opendxa/geometry/tri_mesh.h>

namespace OpenDXA{

void TriMesh::clear(){
    _vertices.clear();
    _faces.clear();
}

void TriMesh::setVertexCount(int n){
    _vertices.resize(n);
}

void TriMesh::setFaceCount(int n){
    _faces.resize(n);
}

TriMeshFace& TriMesh::addFace(){
    setFaceCount(faceCount() + 1);
    return _faces.back();
}

void TriMesh::flipFaces(){
    for(auto& face : faces()){
        face.setVertices(face.vertex(2), face.vertex(1), face.vertex(0));
        face.setEdgeVisibility(face.edgeVisible(2), face.edgeVisible(1), face.edgeVisible(0));
    }
    invalidateFaces();
}

bool TriMesh::intersectRay(const Ray3& ray, double& t, Vector3& normal, int& faceIndex, bool backfaceCull) const{
    double bestT = DOUBLE_MAX;

    for(auto face = faces().cbegin(); face != faces().cend(); ++face){
        const auto& v0 = vertex(face->vertex(0));
        const auto e1 = vertex(face->vertex(1)) - v0;
        const auto e2 = vertex(face->vertex(2)) - v0;

        const auto h = ray.dir.cross(e2);
        const auto a = e1.dot(h);

        if(std::abs(a) < EPSILON) continue;

        const auto f = 1.0f / a;
        const auto s = ray.base - v0;
        const auto u = f * s.dot(h);
        if(u < 0.0f || u > 1.0f) continue;

        const auto q = s.cross(e1);
        const auto v = f * ray.dir.dot(q);
        if(v < 0.0f || (u + v) > 1.0f) continue;

        const auto tt = f * e2.dot(q);
        if(tt < EPSILON || tt >= bestT) continue;

        const auto faceNormal = e1.cross(e2);
        if(faceNormal.isZero(EPSILON)) continue;
        if(backfaceCull && faceNormal.dot(ray.dir) >= 0) continue;

        bestT = tt;
        normal = faceNormal;
        faceIndex = static_cast<int>(std::distance(faces().cbegin(), face));
    }

    if(bestT != DOUBLE_MAX){
        t = bestT;
        return true;
    }

    return false;
}

void TriMesh::clipAtPlane(const Plane3& plane){
    TriMesh clippedMesh;
    std::vector<int> existingVertexMapping(vertexCount(), -1);

    for(int i = 0; i < vertexCount(); ++i){
        if(plane.classifyPoint(vertex(i)) != +1){
            existingVertexMapping[i] = clippedMesh.addVertex(vertex(i));
        }
    }

    std::map<std::pair<int, int>, int> newVertexMapping;

    for(const auto& face : faces()){
        for(int v = 0; v < 3; ++v){
            auto a = face.vertex(v);
            auto b = face.vertex((v + 1) % 3);
            if(a > b) std::swap(a, b);
            const auto& v1 = vertex(a);
            const auto& v2 = vertex(b);
            const auto z1 = plane.pointDistance(v1);
            const auto z2 = plane.pointDistance(v2);
            if((z1 < EPSILON && z2 > EPSILON) || (z2 < EPSILON && z1 > EPSILON)){
                auto key = std::pair{a, b};
                if(!newVertexMapping.contains(key)){
                    const auto intersection = v1 + (v1 - v2) * (z1 / (z2 - z1));
                    newVertexMapping[key] = clippedMesh.addVertex(intersection);
                }
            }
        }
    }

    for(const auto& face : faces()){
        for(int v0 = 0; v0 < 3; ++v0){
            const auto& current_pos = vertex(face.vertex(v0));
            int current_class = plane.classifyPoint(current_pos);
            if(current_class == -1){
                int newface[4];
                int count = 0;
                int next_class;
                for(int v = v0; v < v0 + 3; ++v, current_class = next_class){
                    int idx1 = face.vertex(v % 3);
                    int idx2 = face.vertex((v + 1) % 3);
                    next_class = plane.classifyPoint(vertex(idx2));
                    if(current_class <= 0 && next_class <= 0){
                        assert(existingVertexMapping[idx1] >= 0);
                        newface[count++] = existingVertexMapping[idx1];
                    }else if((current_class == +1 && next_class == -1) || (current_class == -1 && next_class == +1)){
                        auto key = std::pair{std::min(idx1, idx2), std::max(idx1, idx2)};
                        auto ve = newVertexMapping.find(key);
                        assert(ve != newVertexMapping.end());
                        if(current_class == -1) newface[count++] = existingVertexMapping[idx1];
                        newface[count++] = ve->second;
                    }
                }
                if(count >= 3){
                    auto& f1 = clippedMesh.addFace();
                    f1.setVertices(newface[0], newface[1], newface[2]);
                    f1.setSmoothingGroups(face.smoothingGroups());
                    f1.setMaterialIndex(face.materialIndex());
                    if(count == 4){
                        auto& f2 = clippedMesh.addFace();
                        f2.setVertices(newface[0], newface[2], newface[3]);
                        f2.setSmoothingGroups(face.smoothingGroups());
                        f2.setMaterialIndex(face.materialIndex());
                    }
                }
                break;
            }
        }
    }

    swap(clippedMesh);
}

}