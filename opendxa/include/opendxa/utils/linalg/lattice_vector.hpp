#ifndef OPENDXA_LATTICE_VECTOR_H
#define OPENDXA_LATTICE_VECTOR_H

#include <opendxa/utils/linalg/lin_alg.hpp>
#include <opendxa/utils/linalg/vector3.hpp>

typedef Vector3 LatticeVector;

#define CHECKED_FP_PRODUCT(x,y) ((x)*(y))
#define CHECKED_FP_DIVISION(x,y) ((x)/(y))
#define CHECKED_FP_PRODUCT_SUM3(a1,b1, a2,b2, a3,b3) ((a1)*(b1) + (a2)*(b2) + (a3)*(b3))
#define CHECKED_FP_PRODUCT_DIF2(a1,b1, a2,b2) ((a1)*(b1) - (a2)*(b2))
#define CHECKED_FP_PRODUCT_DIF2_DIV(a1,b1, a2,b2, c) (((a1)*(b1) - (a2)*(b2))/c)
#define FP_TO_FLOAT(a) (a)

#endif

