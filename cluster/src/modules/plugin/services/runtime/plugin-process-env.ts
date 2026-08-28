import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';
import { resolvePluginNativeThreadBudget, resolveDuckDbMemoryLimitMb } from '@shared/domain/utilities/runtime-capacity';

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

    return env;
};
