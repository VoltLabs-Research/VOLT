import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';

const DEFAULT_TRAJECTORY_ZSTD_THREADS = 2;
const DEFAULT_TRAJECTORY_PARQUET_INGEST_TIMEOUT_MS = 10 * 60 * 1000;

export const getTrajectoryZstdThreads = (): number => {
    return readPositiveIntegerEnv(
        'TRAJECTORY_ZSTD_THREADS',
        DEFAULT_TRAJECTORY_ZSTD_THREADS
    );
};

export const getTrajectoryParquetIngestTimeoutMs = (): number => {
    return readPositiveIntegerEnv(
        'TRAJECTORY_PARQUET_INGEST_TIMEOUT_MS',
        DEFAULT_TRAJECTORY_PARQUET_INGEST_TIMEOUT_MS
    );
};
