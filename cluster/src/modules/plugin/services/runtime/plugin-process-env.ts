import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';
import { resolvePluginNativeThreadBudget, resolvePluginProcessMemoryBudgetMb, resolvePluginProcessConcurrency } from '@shared/domain/utilities/runtime-capacity';


/*
 * Thread ceiling for the numeric libraries a plugin process may load.
 *
 * This used to be a flat 1, which is the usual hygiene for BLAS/NumPy inside a
 * worker — those libraries otherwise start a thread per core in every process. But
 * the list also contains OMP_NUM_THREADS, and OpenMP is not only BLAS here:
 * geogram's parallel Delaunay backend (PDEL) runs on OpenMP. So the blanket 1
 * silently held the whole tessellation stage to one thread in production, giving
 * away the 2.4-3.0x that backend was measured to be worth, while the same binary
 * run from a shell got all of it. That is the kind of gap that makes a local
 * benchmark and a production run disagree for reasons no one can see.
 *
 * The fix is not to remove the ceiling but to make it the *same* number the process
 * receives as --threads, so there is one budget rather than two that contradict each
 * other. Override with PLUGIN_PROCESS_DEFAULT_NATIVE_THREADS if a deployment needs
 * the old pinned-to-one behaviour.
 */
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

/*
 * Ceiling for DuckDB's in-process Parquet engine, in MB.
 *
 * DuckDB defaults `memory_limit` to 80% of system RAM *per instance*, and a plugin
 * creates one per writer. With several plugin processes running at once, that
 * default is not a limit at all: exceeding physical RAM turns a catchable DuckDB
 * error into a kernel OOM kill, and an OOM-killed plugin leaves its queue lease
 * held. Give each process its own share of the pool's memory budget instead.
 */
const resolveDuckDbMemoryLimitMb = (): number => {
    const configured = readPositiveIntegerEnv('VOLT_DUCKDB_MEMORY_LIMIT_MB');
    if (configured !== undefined) {
        return configured;
    }
    const perProcessMb = Math.floor(
        resolvePluginProcessMemoryBudgetMb() / Math.max(1, resolvePluginProcessConcurrency())
    );
    // Half of the process's share: the analysis itself is the other consumer, and it
    // is the larger one (measured at roughly 3 KB per atom).
    return Math.max(256, Math.floor(perProcessMb / 2));
};

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
