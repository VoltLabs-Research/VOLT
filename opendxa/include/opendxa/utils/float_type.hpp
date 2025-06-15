#ifndef OPENDXA_FLOATTYPE_H
#define OPENDXA_FLOATTYPE_H

#include <opendxa/includes.hpp>

typedef float FloatType;
#define FLOATTYPE_FLOAT
#define FLOATTYPE_EPSILON	1e-3f
#define FLOAT_SCANF_STRING_1 "%g"
#define FLOAT_SCANF_STRING_2 "%g %g"
#define FLOAT_SCANF_STRING_3 "%g %g %g"

template<typename T> inline T square(const T& f) { return f*f; }

#define FLOATTYPE_MAX (numeric_limits<FloatType>::max())
#define FLOATTYPE_PI ((FloatType)3.14159265358979323846)

#endif