import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';

/** Builds a plugin child process env, pinning native thread pools to avoid oversubscription. */

const DEFAULT_NATIVE_THREAD_COUNT = readPositiveIntegerEnv('PLUGIN_PROCESS_DEFAULT_NATIVE_THREADS') ?? 1;
/*
 * OneTBB is deliberately absent: it has no environment knob. Measured on a 16-CPU
 * host against polyhedral-template-matching 2.0.2, neither `TBB_NUM_THREADS` nor
 * `OMP_NUM_THREADS` nor a restricted affinity mask (`taskset -c 0-3`) changed the
 * arena, which stayed at 16 threads in all three cases because the plugin sizes it
 * from the hwloc topology. TBB-based plugins are bounded through their own
 * `--threads` flag instead, fed by `resolvePluginNativeThreadBudget`.
 */
const NATIVE_THREAD_ENV_KEYS = [
    'OMP_NUM_THREADS',
    'OPENBLAS_NUM_THREADS',
    'MKL_NUM_THREADS',
    'VECLIB_MAXIMUM_THREADS',
    'NUMEXPR_NUM_THREADS',
    'BLIS_NUM_THREADS'
];

export const buildPluginProcessEnv = (
    inputEnv?: NodeJS.ProcessEnv,
    extraEnv: NodeJS.ProcessEnv = {}
): NodeJS.ProcessEnv => {
    const env = {
        ...process.env,
        ...inputEnv,
        ...extraEnv
    };
    const threadCount = String(DEFAULT_NATIVE_THREAD_COUNT);

    for (const key of NATIVE_THREAD_ENV_KEYS) {
        if (!env[key]) {
            env[key] = threadCount;
        }
    }

    return env;
};
