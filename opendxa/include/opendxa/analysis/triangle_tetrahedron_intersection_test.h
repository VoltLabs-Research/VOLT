#include <opendxa/core/opendxa.h>

#pragma once

namespace OpenDXA::TetrahedronTriangleIntersection{

constexpr inline double orient2D(const Point2& p1, const Point2& p2, const Point2& p3){
    return (p1.x() - p2.x()) * (p3.y() - p2.y()) - (p1.y() - p2.y()) * (p3.x() - p2.x());
}

constexpr inline bool triVertIntersectionTest2D(
    const Point2& p1, 
    const Point2& p2, 
    const Point2& p3, 
    const Point2& q1, 
    const Point2& q2, 
    const Point2& q3
){
    if(orient2D(q3, q1, p2) >= 0.0){
        if(orient2D(q3, q2, p2) <= 0.0){
            if(orient2D(p1, q1, p2) > 0.0){
                return orient2D(p1, q2, p2) <= 0.0;
            }else{
                if(orient2D(p1, q1, p3) >= 0.0){
                    return orient2D(p2, p3, q1) >= 0.0;
                }else{
                    return false;
                }
            }
        }else if(orient2D(p1, q2, p2) <= 0.0){
            if(orient2D(q3, q2, p3) <= 0.0){
                return orient2D(p2, p3, q2) >= 0.0;
            }else{
                return false;
            }
        }else{
            return false;
        }
    }else if(orient2D(q3, q1, p3) >= 0.0){
        if(orient2D(p2, p3, q3) >= 0.0){
            return orient2D(p1, q1, p3) >= 0.0;
        }else if(orient2D(p2, p3, q2) >= 0.0){
            return orient2D(q3, p3, q2) >= 0.0;
        }else{
            return false;
        }
    }else{
        return false;
    }
};

constexpr inline bool triEdgeIntersectionTest2D(
    const Point2& p1, 
    const Point2& p2, 
    const Point2& p3, 
    const Point2& q1, 
    const Point2& q2, 
    const Point2& q3
){
    if(orient2D(q3, q1, p2) >= 0.0){
        if(orient2D(p1, q1, p2) >= 0.0){
            return orient2D(p1, p2, q3) >= 0.0;
        }else{
            if(orient2D(p2, p3, q1) >= 0.0){
                return orient2D(p3, p1, q1) >= 0.0;
            }else{
                return false;
            }
        }
    }else{
        if(orient2D(q3, q1, p3) >= 0.0){
            if(orient2D(p1, q1, p3) >= 0.0){
                if(orient2D(p1, p3, q3) >= 0.0){
                    return true;
                }else{
                    return orient2D(p2, p3, q3) >= 0.0;
                }
            }else{
                return false;
            }
        }else{
            return false;
        }
    }
}

constexpr inline bool ccwTriTriIntersectionTest2D(
    const Point2& p1, 
    const Point2& p2, 
    const Point2& p3, 
    const Point2& q1, 
    const Point2& q2, 
    const Point2& q3
){
    if(orient2D(q1, q2, p1) >= 0.0){
        if(orient2D(q2, q3, p1) >= 0.0){
            if(orient2D(q3, q1, p1) >= 0.0){
                return 1;
            }else{
                return triEdgeIntersectionTest2D(p1, p2, p3, q1, q2, q3);
            }
        }else{
            if(orient2D(q3, q1, p1) >= 0.0){
                return triEdgeIntersectionTest2D(p1, p2, p3, q3, q1, q2);
            }else{
                return triVertIntersectionTest2D(p1, p2, p3, q1, q2, q3);
            }
        }
    }else{
        if(orient2D(q2, q3, p1) >= 0.0){
            if(orient2D(q3, q1, p1) >= 0.0){
                return triEdgeIntersectionTest2D(p1, p2, p3, q2, q3, q1);
            }else{
                return triVertIntersectionTest2D(p1, p2, p3, q2, q3, q1);
            }
        }else{
            return triVertIntersectionTest2D(p1, p2, p3, q3, q1, q2);
        }
    }
}

constexpr inline bool triTriOverlapTest2D(
    const Point2& p1, 
    const Point2& p2, 
    const Point2& p3, 
    const Point2& q1, 
    const Point2& q2, 
    const Point2& q3
){
    if(orient2D(p1, p2, p3) < 0.0){
        if(orient2D(q1, q2, q3) < 0.0){
            return ccwTriTriIntersectionTest2D(p1, p3, p2, q1, q3, q2);
        }else{
            return ccwTriTriIntersectionTest2D(p1, p3, p2, q1, q2, q3);
        }
    }else if(orient2D(q1, q2, q3) < 0.0){
        return ccwTriTriIntersectionTest2D(p1, p2, p3, q1, q3, q2);
    }else{
        return ccwTriTriIntersectionTest2D(p1, p2, p3, q1, q2, q3);
    }
};

// min/max condition to determine whether or not the two intervals overlap.
constexpr inline bool checkMinMaxCondition(
    const Point3& p1,
    const Point3& p2,
    const Point3& p3,
    const Point3& q1,
    const Point3& q2,
    const Point3& q3
){
    Vector3 n = (q1 - p2).cross(p1 - p2);
    if((q2 - p2).dot(n) > 0.0){
        return false;
    }

    n = (q1 - p1).cross(p3 - p1);
    return (q3 - p1).dot(n) <= 0.0;
}

// Projection of the triangles in 3D onto 2D such that the area of the projection is maximized
// Afterwards the coplanar triangles can be tested in 2D
constexpr inline bool checkTriTriCoplanar(
    const Point3& p1, 
    const Point3& p2, 
    const Point3& p3, 
    const Point3& q1, 
    const Point3& q2,
    const Point3& q3, Vector3 normal
){
    normal.x() = ((normal.x() < 0) ? -normal.x() : normal.x());
    normal.y() = ((normal.y() < 0) ? -normal.y() : normal.y());
    normal.z() = ((normal.z() < 0) ? -normal.z() : normal.z());

    // Projected triangles
    Point2 pp1;
    Point2 pp2;
    Point2 pp3;
    Point2 pq1;
    Point2 pq2;
    Point2 pq3;

    if((normal.x() > normal.z()) && (normal.x() >= normal.y())){
        // Project onto plane YZ
        pp1[0] = p2[2];
        pp1[1] = p2[1];
        pp2[0] = p1[2];
        pp2[1] = p1[1];
        pp3[0] = p3[2];
        pp3[1] = p3[1];

        pq1[0] = q2[2];
        pq1[1] = q2[1];
        pq2[0] = q1[2];
        pq2[1] = q1[1];
        pq3[0] = q3[2];
        pq3[1] = q3[1];
    }else if((normal.y() > normal.z()) && (normal.y() >= normal.x())){
        // Project onto plane XZ
        pp1[0] = p2[0];
        pp1[1] = p2[2];
        pp2[0] = p1[0];
        pp2[1] = p1[2];
        pp3[0] = p3[0];
        pp3[1] = p3[2];

        pq1[0] = q2[0];
        pq1[1] = q2[2];
        pq2[0] = q1[0];
        pq2[1] = q1[2];
        pq3[0] = q3[0];
        pq3[1] = q3[2];
    }else{
        // Project onto plane XY
        pp1[0] = p1[0];
        pp1[1] = p1[1];
        pp2[0] = p2[0];
        pp2[1] = p2[1];
        pp3[0] = p3[0];
        pp3[1] = p3[1];

        pq1[0] = q1[0];
        pq1[1] = q1[1];
        pq2[0] = q2[0];
        pq2[1] = q2[1];
        pq3[0] = q3[0];
        pq3[1] = q3[1];
    }

    return triTriOverlapTest2D(pp1, pp2, pp3, pq1, pq2, pq3);
}

// Thus, it is only necessary to check a min/max condition to determine whether or not the two intervals overlap.
constexpr inline bool checkTriTriIntersection3d(
    const Point3& p1, 
    const Point3& p2,
    const Point3& p3,
    const Point3& q1,
    const Point3& q2,
    const Point3& q3,
    const Vector3& normal,
    double dq1,
    double dq2,
    double dq3
){
    if(dq1 > 0.0){
        if(dq2 > 0.0){
            return checkMinMaxCondition(p1, p3, p2, q3, q1, q2);
        }else if(dq3 > 0.0){
            return checkMinMaxCondition(p1, p3, p2, q2, q3, q1);
        }else{
            return checkMinMaxCondition(p1, p2, p3, q1, q2, q3);
        }
    }else if(dq1 < 0.0){
        if(dq2 < 0.0){
            return checkMinMaxCondition(p1, p2, p3, q3, q1, q2);
        }else if(dq3 < 0.0){
            return checkMinMaxCondition(p1, p2, p3, q2, q3, q1);
        }else{
            return checkMinMaxCondition(p1, p3, p2, q1, q2, q3);
        }
    }else{
        if(dq2 < 0.0){
            if(dq3 >= 0.0){
                return checkMinMaxCondition(p1, p3, p2, q2, q3, q1);
            }else{
                return checkMinMaxCondition(p1, p2, p3, q1, q2, q3);
            }
        }else if(dq2 > 0.0){
            if(dq3 > 0.0){
                return checkMinMaxCondition(p1, p3, p2, q1, q2, q3);
            }else{
                return checkMinMaxCondition(p1, p2, p3, q2, q3, q1);
            }
        }else{
            if(dq3 > 0.0){
                return checkMinMaxCondition(p1, p2, p3, q3, q1, q2);
            }else if(dq3 < 0.0){
                return checkMinMaxCondition(p1, p3, p2, q3, q1, q2);
            }else{
                return checkTriTriCoplanar(p1, p2, p3, q1, q2, q3, normal);
            }
        }
    }
}

constexpr inline bool triTriIntersectionTest(
    const Point3& p1,
    const Point3& p2,
    const Point3& p3,
    const Point3& q1,
    const Point3& q2,
    const Point3& q3
){
    constexpr double EPSILON = 1e-6;

    // Calculate the normal vector of triangle 2
    Vector3 normal = (q1 - q3).cross((q2 - q3));

    // Compute distance signs of p1, p2, and p3 to the plane of triangle 2
    double p1dist = (p1 - q3).dot(normal);
    double p2dist = (p2 - q3).dot(normal);
    double p3dist = (p3 - q3).dot(normal);

    // Set p_dist to 0.0 if the value is close enough (for robustness)
    if(std::abs(p1dist) < EPSILON){
        p1dist = 0.0;
    }

    if(std::abs(p2dist) < EPSILON){
        p2dist = 0.0;
    }

    if(std::abs(p3dist) < EPSILON){
        p3dist = 0.0;
    }

    // Check whether all points of triangle 1 are on the same side of triangle 2
    // No intersection
    if(((p1dist * p2dist) > 0.0) && ((p1dist * p3dist) > 0.0)){
        return false;
    }

    // Calculate the normal vector of triangle 2
    normal = (p2 - p1).cross((p3 - p1));

    // Compute distance signs of q1, q2, and q3 to the plane of triangle 1
    double q1dist = (q1 - p3).dot(normal);
    double q2dist = (q2 - p3).dot(normal);
    double q3dist = (q3 - p3).dot(normal);

    // Set q_dist to 0.0 if the value is close enough (for robustness)
    if (std::abs(q1dist) < EPSILON) q1dist = 0.0;
    if (std::abs(q2dist) < EPSILON) q2dist = 0.0;
    if (std::abs(q3dist) < EPSILON) q3dist = 0.0;
    
    // Check whether all points of triangle 2 are on teh same side of triangle 1
    // No intersection
    if(((q1dist * q2dist) > 0.0) && ((q1dist * q3dist) > 0.0)){
        return false;
    }

    // The algorithm then applies a circular permutation to the vertices of 
    // each triangle such that p1 (respectively, q1) is the only vertex of its 
    // triangle that lies on its side. An additional transposition operation 
    // (i.e., a swap operation) is performed at the same time on vertices
    // q2 and q3 (respectively, p2 and p3 so that vertex p1 (respectively, q1) sees q1q2q3
    // (respectively, p1p2p3 in counterclockwise order (see Figure 2).
    if(p1dist > 0.0){
        if(p2dist > 0.0){
            return checkTriTriIntersection3d(p3, p1, p2, q1, q3, q2, normal, q1dist, q3dist, q2dist);
        }else if(p3dist > 0.0){
            return checkTriTriIntersection3d(p2, p3, p1, q1, q3, q2, normal, q1dist, q3dist, q2dist);
        }else{
            return checkTriTriIntersection3d(p1, p2, p3, q1, q2, q3, normal, q1dist, q2dist, q3dist);
        }
    }else if(p1dist < 0.0){
        if(p2dist < 0.0){
            return checkTriTriIntersection3d(p3, p1, p2, q1, q2, q3, normal, q1dist, q2dist, q3dist);
        }else if(p3dist < 0.0){
            return checkTriTriIntersection3d(p2, p3, p1, q1, q2, q3, normal, q1dist, q2dist, q3dist);
        }else{
            return checkTriTriIntersection3d(p1, p2, p3, q1, q3, q2, normal, q1dist, q3dist, q2dist);
        }
    }else{
        if(p2dist < 0.0){
            if(p3dist >= 0.0){
                return checkTriTriIntersection3d(p2, p3, p1, q1, q3, q2, normal, q1dist, q3dist, q2dist);
            }else{
                return checkTriTriIntersection3d(p1, p2, p3, q1, q2, q3, normal, q1dist, q2dist, q3dist);
            }
        }else if(p2dist > 0.0){
            if(p3dist > 0.0){
                return checkTriTriIntersection3d(p1, p2, p3, q1, q3, q2, normal, q1dist, q3dist, q2dist);
            }else{
                return checkTriTriIntersection3d(p2, p3, p1, q1, q2, q3, normal, q1dist, q2dist, q3dist);
            }
        }else{
            if(p3dist > 0.0){
                return checkTriTriIntersection3d(p3, p1, p2, q1, q2, q3, normal, q1dist, q2dist, q3dist);
            }else if(p3dist < 0.0){
                return checkTriTriIntersection3d(p3, p1, p2, q1, q3, q2, normal, q1dist, q3dist, q2dist);
            }else{
                return checkTriTriCoplanar(p1, p2, p3, q1, q2, q3, normal);
            }
        }
    }
};

inline bool test(const std::array<Point3, 4>& tet, const std::array<Point3, 3>& tri){
    static constexpr std::array<std::array<int, 3>, 4> tabVertexIndex ={{
       {1, 3, 2}, 
       {0, 2, 3}, 
       {0, 3, 1}, 
       {0, 1, 2}
    }};

    for(size_t i = 0; i < 4; ++i){
        if(triTriIntersectionTest(
            tet[tabVertexIndex[i][0]], 
            tet[tabVertexIndex[i][1]], 
            tet[tabVertexIndex[i][2]], 
            tri[0],
            tri[1], 
            tri[2]
        )){
            return true;
        }
    }
    return false;
}

}