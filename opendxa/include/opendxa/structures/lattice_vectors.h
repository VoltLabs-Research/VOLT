#pragma once

#include <opendxa/math/lin_alg.h>

namespace OpenDXA{

// TODO: inline constexpr
inline const Vector3 FCC_VECTORS[] = {
    Vector3( 0.5,  0.5,  0.0),
    Vector3( 0.0,  0.5,  0.5),
    Vector3( 0.5,  0.0,  0.5),
    Vector3(-0.5, -0.5,  0.0),
    Vector3( 0.0, -0.5, -0.5),
    Vector3(-0.5,  0.0, -0.5),
    Vector3(-0.5,  0.5,  0.0),
    Vector3( 0.0, -0.5,  0.5),
    Vector3(-0.5,  0.0,  0.5),
    Vector3( 0.5, -0.5,  0.0),
    Vector3( 0.0,  0.5, -0.5),
    Vector3( 0.5,  0.0, -0.5)
};

inline const Vector3 HCP_VECTORS[] = {
    Vector3(sqrt(2.0)/4.0, -sqrt(6.0)/4.0, 0.0),
    Vector3(-sqrt(2.0)/2.0, 0.0, 0.0),
    Vector3(-sqrt(2.0)/4.0, sqrt(6.0)/12.0, -sqrt(3.0)/3.0),
    Vector3(sqrt(2.0)/4.0, sqrt(6.0)/12.0, -sqrt(3.0)/3.0),
    Vector3(0.0, -sqrt(6.0)/6.0, -sqrt(3.0)/3.0),
    Vector3(-sqrt(2.0)/4.0, sqrt(6.0)/4.0, 0.0),
    Vector3(sqrt(2.0)/4.0, sqrt(6.0)/4.0, 0.0),
    Vector3(sqrt(2.0)/2.0, 0.0, 0.0),
    Vector3(-sqrt(2.0)/4.0, -sqrt(6.0)/4.0, 0.0),
    Vector3(0.0, -sqrt(6.0)/6.0, sqrt(3.0)/3.0),
    Vector3(sqrt(2.0)/4.0, sqrt(6.0)/12.0, sqrt(3.0)/3.0),
    Vector3(-sqrt(2.0)/4.0, sqrt(6.0)/12.0, sqrt(3.0)/3.0),
    Vector3(0.0, sqrt(6.0)/6.0, sqrt(3.0)/3.0),
    Vector3(-sqrt(2.0)/4.0, -sqrt(6.0)/12.0, -sqrt(3.0)/3.0),
    Vector3(sqrt(2.0)/4.0, -sqrt(6.0)/12.0, sqrt(3.0)/3.0),
    Vector3(0.0, sqrt(6.0)/6.0, -sqrt(3.0)/3.0),
    Vector3(sqrt(2.0)/4.0, -sqrt(6.0)/12.0, -sqrt(3.0)/3.0),
    Vector3(-sqrt(2.0)/4.0, -sqrt(6.0)/12.0, sqrt(3.0)/3.0)
};

inline const Vector3 BCC_VECTORS[] = {
    Vector3( 0.5,  0.5,  0.5),
    Vector3(-0.5,  0.5,  0.5),
    Vector3( 0.5,  0.5, -0.5),
    Vector3(-0.5, -0.5,  0.5),
    Vector3( 0.5, -0.5,  0.5),
    Vector3(-0.5,  0.5, -0.5),
    Vector3(-0.5, -0.5, -0.5),
    Vector3( 0.5, -0.5, -0.5),
    Vector3( 1.0,  0.0,  0.0),
    Vector3(-1.0,  0.0,  0.0),
    Vector3( 0.0,  1.0,  0.0),
    Vector3( 0.0, -1.0,  0.0),
    Vector3( 0.0,  0.0,  1.0),
    Vector3( 0.0,  0.0, -1.0)
};

inline const Vector3 DIAMOND_CUBIC_VECTORS[] = {
    Vector3(0.25, 0.25, 0.25),
    Vector3(0.25, -0.25, -0.25),
    Vector3(-0.25, -0.25, 0.25),
    Vector3(-0.25, 0.25, -0.25),

    Vector3(0, -0.5, 0.5),
    Vector3(0.5, 0.5, 0),
    Vector3(-0.5, 0, 0.5),
    Vector3(-0.5, 0.5, 0),
    Vector3(0, 0.5, 0.5),
    Vector3(0.5, -0.5, 0),
    Vector3(0.5, 0, 0.5),
    Vector3(0.5, 0, -0.5),
    Vector3(-0.5, -0.5, 0),
    Vector3(0, -0.5, -0.5),
    Vector3(0, 0.5, -0.5),
    Vector3(-0.5, 0, -0.5),

    Vector3(0.25, -0.25, 0.25),
    Vector3(0.25, 0.25, -0.25),
    Vector3(-0.25, 0.25, 0.25),
    Vector3(-0.25, -0.25, -0.25)
};

inline const Vector3 DIAMOND_HEX_VECTORS[] = {
    Vector3(-sqrt(2.0)/4, sqrt(3.0/2.0)/6, -sqrt(3.0)/12),
    Vector3(0, -sqrt(3.0/2.0)/3, -sqrt(3.0)/12),
    Vector3(sqrt(2.0)/4, sqrt(3.0/2.0)/6, -sqrt(3.0)/12),
    Vector3(0, 0, sqrt(3.0)/4),

    Vector3(sqrt(2.0)/4.0, -sqrt(6.0)/4.0, 0.0),
    Vector3(-sqrt(2.0)/2.0, 0.0, 0.0),
    Vector3(-sqrt(2.0)/4.0, sqrt(6.0)/4.0, 0.0),
    Vector3(sqrt(2.0)/4.0, sqrt(6.0)/4.0, 0.0),
    Vector3(sqrt(2.0)/2.0, 0.0, 0.0),
    Vector3(-sqrt(2.0)/4.0, -sqrt(6.0)/4.0, 0.0),
    Vector3(-sqrt(2.0)/4.0, sqrt(6.0)/12.0, -sqrt(3.0)/3.0),
    Vector3(sqrt(2.0)/4.0, sqrt(6.0)/12.0, -sqrt(3.0)/3.0),
    Vector3(0.0, -sqrt(6.0)/6.0, -sqrt(3.0)/3.0),
    Vector3(0.0, -sqrt(6.0)/6.0, sqrt(3.0)/3.0),
    Vector3(sqrt(2.0)/4.0, sqrt(6.0)/12.0, sqrt(3.0)/3.0),
    Vector3(-sqrt(2.0)/4.0, sqrt(6.0)/12.0, sqrt(3.0)/3.0),

    Vector3(-sqrt(2.0)/4, sqrt(3.0/2.0)/6, sqrt(3.0)/12),
    Vector3(0, -sqrt(3.0/2.0)/3, sqrt(3.0)/12),
    Vector3(sqrt(2.0)/4, sqrt(3.0/2.0)/6, sqrt(3.0)/12),
    Vector3(0, 0, -sqrt(3.0)/4),

    Vector3(-sqrt(2.0)/4, -sqrt(3.0/2.0)/6, -sqrt(3.0)/12),
    Vector3(0, sqrt(3.0/2.0)/3, -sqrt(3.0)/12),
    Vector3(sqrt(2.0)/4, -sqrt(3.0/2.0)/6, -sqrt(3.0)/12),

    Vector3(-sqrt(2.0)/4, -sqrt(3.0/2.0)/6, sqrt(3.0)/12),
    Vector3(0, sqrt(3.0/2.0)/3, sqrt(3.0)/12),
    Vector3(sqrt(2.0)/4, -sqrt(3.0/2.0)/6, sqrt(3.0)/12),

    Vector3(0.0, sqrt(6.0)/6.0, sqrt(3.0)/3.0),
    Vector3(-sqrt(2.0)/4.0, -sqrt(6.0)/12.0, -sqrt(3.0)/3.0),
    Vector3(sqrt(2.0)/4.0, -sqrt(6.0)/12.0, sqrt(3.0)/3.0),
    Vector3(0.0, sqrt(6.0)/6.0, -sqrt(3.0)/3.0),
    Vector3(sqrt(2.0)/4.0, -sqrt(6.0)/12.0, -sqrt(3.0)/3.0),
    Vector3(-sqrt(2.0)/4.0, -sqrt(6.0)/12.0, sqrt(3.0)/3.0)
};

// In a crystal lattice, any position vector "r" in the lattice 
// can be described as an integer linear combination of three 
// linearly independent vectors a1, a2, a3:
// Then, r = n1 * a1 + n2 * a2 + n3 * a3.
// These "a1, a2, ... ai" are the generating vectors of the 
// primitive cell and define the shape and minimum volume that 
// is repeated periodically to form the entire network.
inline const Vector3 FCC_PRIMITIVE_CELL[3] = {
    {0.5, 0.5, 0.0},
    {0.0, 0.5, 0.5},
    {0.5, 0.0, 0.5}
};

inline const Vector3 HCP_PRIMITIVE_CELL[3] = {
    {sqrt(0.5)/2, -sqrt(6.0)/4, 0.0},
    {sqrt(0.5)/2, sqrt(6.0)/4, 0.0},
    {0.0, 0.0, sqrt(8.0/6.0)}
};

inline const Vector3 BCC_PRIMITIVE_CELL[3] = {
    {1.0, 0.0, 0.0},
    {0.0, 1.0, 0.0},
    {0.5, 0.5, 0.5}
};

inline const Vector3 CUBIC_DIAMOND_PRIMITIVE_CELL[3] = {
    {0.5, 0.5, 0.0},
    {0.0, 0.5, 0.5},
    {0.5, 0.0, 0.5}
};

inline const Vector3 HEXAGONAL_DIAMOND_PRIMITIVE_CELL[3] = {
    {sqrt(0.5)/2, -sqrt(6.0)/4, 0.0},
    {sqrt(0.5)/2, sqrt(6.0)/4, 0.0},
    {0.0, 0.0, sqrt(8.0/6.0)}  
};

}