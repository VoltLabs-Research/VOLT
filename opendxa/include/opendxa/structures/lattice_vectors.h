#pragma once

#include <opendxa/math/lin_alg.h>

namespace OpenDXA{

// Twelve face-centered cubic neighbor directions, pointing from
// one atom toward the centers of its 12 nearest-neighbor atoms.
inline const Vector3 FCC_VECTORS[] = {
    { 0.5,  0.5,  0.0}, { 0.0,  0.5,  0.5}, { 0.5,  0.0,  0.5},
    {-0.5, -0.5,  0.0}, { 0.0, -0.5, -0.5}, {-0.5,  0.0, -0.5},
    {-0.5,  0.5,  0.0}, { 0.0, -0.5,  0.5}, {-0.5,  0.0,  0.5},
    { 0.5, -0.5,  0.0}, { 0.0,  0.5, -0.5}, { 0.5,  0.0, -0.5}
};

// Eighteen hexagonal, close-packed neighbor vectors carefully choosen so that each
// atom's 12 nearest neighbors plust next nearest neighbors lie along these fixed directions
// in the ideal HCP lattice.
inline const Vector3 HCP_VECTORS[] = {
    { sqrt(2.0)/4.0, -sqrt(6.0)/4.0,  0.0 }, { -sqrt(2.0)/2.0,  0.0,             0.0 },
    { -sqrt(2.0)/4.0,  sqrt(6.0)/12.0, -sqrt(3.0)/3.0 }, { sqrt(2.0)/4.0,  sqrt(6.0)/12.0, -sqrt(3.0)/3.0 },
    { 0.0,            -sqrt(6.0)/6.0,  -sqrt(3.0)/3.0 }, { -sqrt(2.0)/4.0,  sqrt(6.0)/4.0,   0.0 },
    { sqrt(2.0)/4.0,   sqrt(6.0)/4.0,   0.0 },           { sqrt(2.0)/2.0,   0.0,             0.0 },
    { -sqrt(2.0)/4.0, -sqrt(6.0)/4.0,   0.0 },           { 0.0,            -sqrt(6.0)/6.0,   sqrt(3.0)/3.0 },
    { sqrt(2.0)/4.0,   sqrt(6.0)/12.0,  sqrt(3.0)/3.0 },  { -sqrt(2.0)/4.0,  sqrt(6.0)/12.0,  sqrt(3.0)/3.0 },
    { 0.0,             sqrt(6.0)/6.0,   sqrt(3.0)/3.0 },  { -sqrt(2.0)/4.0, -sqrt(6.0)/12.0, -sqrt(3.0)/3.0 },
    { sqrt(2.0)/4.0,  -sqrt(6.0)/12.0,  sqrt(3.0)/3.0 },  { 0.0,             sqrt(6.0)/6.0,  -sqrt(3.0)/3.0 },
    { sqrt(2.0)/4.0,  -sqrt(6.0)/12.0, -sqrt(3.0)/3.0 },  { -sqrt(2.0)/4.0, -sqrt(6.0)/12.0,  sqrt(3.0)/3.0 }
};

// Fourteen body-centered cubic directions, combining the 8 corner-to-body
// vectors and the 6 face-to-center vectors that defines the BCC packing
inline const Vector3 BCC_VECTORS[] = {
    { 0.5,  0.5,  0.5}, {-0.5,  0.5,  0.5}, { 0.5,  0.5, -0.5}, {-0.5, -0.5,  0.5},
    { 0.5, -0.5,  0.5}, {-0.5,  0.5, -0.5}, {-0.5, -0.5, -0.5}, { 0.5, -0.5, -0.5},
    { 1.0,  0.0,  0.0}, {-1.0,  0.0,  0.0}, { 0.0,  1.0,  0.0}, { 0.0, -1.0,  0.0},
    { 0.0,  0.0,  1.0}, { 0.0,  0.0, -1.0}
};

inline const Vector3 SC_VECTORS[] = {
    { 1.0,  0.0,  0.0}, {-1.0,  0.0,  0.0},
    { 0.0,  1.0,  0.0}, { 0.0, -1.0,  0.0},
    { 0.0,  0.0,  1.0}, { 0.0,  0.0, -1.0}
};

// Twenty common neighbor directions in the cubic diamond (zinc‐blende)
// structure, combining both tetrahedral bonds and the underlying fcc frame.
inline const Vector3 DIAMOND_CUBIC_VECTORS[] = {
    { 0.25,  0.25,  0.25}, { 0.25, -0.25, -0.25}, {-0.25, -0.25,  0.25}, {-0.25,  0.25, -0.25},
    { 0.0,  -0.5,   0.5},  { 0.5,   0.5,   0.0},  {-0.5,   0.0,   0.5}, {-0.5,   0.5,   0.0},
    { 0.0,   0.5,   0.5},  { 0.5,  -0.5,   0.0},  { 0.5,   0.0,   0.5}, { 0.5,   0.0,  -0.5},
    {-0.5,  -0.5,   0.0},  { 0.0,  -0.5,  -0.5}, { 0.0,   0.5,  -0.5}, {-0.5,   0.0,  -0.5},
    { 0.25, -0.25,  0.25}, { 0.25,  0.25, -0.25}, {-0.25,  0.25,  0.25}, {-0.25, -0.25, -0.25}
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

// Any lattice can also be defined by its primitive cell basis vectors,
// which generate the full lattice by integer combinations. Below are
// the three vectors for each lattice, given in the same fractional units.
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

inline const Vector3 SC_PRIMITIVE_CELL[3] = {
    {1.0, 0.0, 0.0},
    {0.0, 1.0, 0.0},
    {0.0, 0.0, 1.0}
};

inline const Vector3 HEXAGONAL_DIAMOND_PRIMITIVE_CELL[3] = {
    {sqrt(0.5)/2, -sqrt(6.0)/4, 0.0},
    {sqrt(0.5)/2, sqrt(6.0)/4, 0.0},
    {0.0, 0.0, sqrt(8.0/6.0)}  
};

}