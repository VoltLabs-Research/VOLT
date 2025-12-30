/*
MIT License

Copyright (c) 2020 PM Larsen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

#include <cmath>
#include <cassert>
#include "mwm_csp.h"
#include "matching.h"


static double greedy_edge_assignment(int num_points, double *weights, bool* p_matching)
{
    int pair[32];
    double csp = 0.0;
    for (int i=0;i<num_points;i++)
    {
        int bi = -1;
        double min = INFINITY;
        for (int j=0;j<num_points;j++)
        {
            double edge_weight = weights[i * num_points + j];
            if (i != j && edge_weight < min)
            {
                min = edge_weight;
                bi = j;
            }
        }

        pair[i] = bi;
        csp += min;
    }

    bool matching = true;
    for (int i=0;i<num_points;i++)
        if (pair[pair[i]] != i)
            matching = false;

    *p_matching = matching;
    return csp / 2;
}

double _calculate_mwm_csp(int num_points, double (*P)[3])
{
    assert(num_points < MWM_CSP_MAX_POINTS);
    assert(num_points % 2 == 0);

    double weights[MWM_CSP_MAX_POINTS * MWM_CSP_MAX_POINTS];
    for (int i=0;i<num_points;i++)
    {
        for (int j=i+1;j<num_points;j++)
        {
            double* a = P[i];
            double* b = P[j];

            double dx = a[0] + b[0];
            double dy = a[1] + b[1];
            double dz = a[2] + b[2];
            double s = dx*dx + dy*dy + dz*dz;
            weights[i * num_points + j] = s;
            weights[j * num_points + i] = s;
        }
    }

    bool matching = false;
    double lower_bound = greedy_edge_assignment(num_points, weights, &matching);
    if (matching)
        return lower_bound;

    int res[MWM_CSP_MAX_POINTS][2];
    return MinimumCostPerfectMatching(num_points, weights, res);
}

#ifdef __cplusplus
extern "C" {
#endif

double calculate_mwm_csp(int num_points, double (*P)[3]) {
    return _calculate_mwm_csp(num_points, P);
}

#ifdef __cplusplus
}
#endif

