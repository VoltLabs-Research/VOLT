import { readPositiveIntegerEnv } from '@shared/utilities/env';
import { resolvePluginNativeThreadBudget, resolveDuckDbMemoryLimitMb } from '@shared/utilities/runtime-capacity';

const resolveNativeThreadCount = (): number =>
    readPositiveIntegerEnv('PLUGIN_PROCESS_DEFAULT_NATIVE_THREADS') ?? resolvePluginNativeThreadBudget();

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
    const threadCount = String(resolveNativeThreadCount());

    for (const key of NATIVE_THREAD_ENV_KEYS) {
        if (!env[key]) {
            env[key] = threadCount;
        }
    }

    if (!env.VOLT_DUCKDB_MEMORY_LIMIT_MB) {
        env.VOLT_DUCKDB_MEMORY_LIMIT_MB = String(resolveDuckDbMemoryLimitMb());
    }

    // Tells the plugin its @volt:progress lines are read: CoreToolkit only writes them when set,
    // so a plugin run by hand, or by a daemon older than this, logs what it always did.
    env.VOLT_PROGRESS = '1';

    return env;
};
