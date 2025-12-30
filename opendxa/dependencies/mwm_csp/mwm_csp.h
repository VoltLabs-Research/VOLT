#ifndef MWM_CSP_H
#define MWM_CSP_H

#define MWM_CSP_MAX_POINTS 32

#ifdef __cplusplus
extern "C" {
#endif

double calculate_mwm_csp(int num_points, double (*P)[3]);

#ifdef __cplusplus
}
#endif

#endif

