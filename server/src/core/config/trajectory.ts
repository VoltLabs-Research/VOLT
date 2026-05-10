import { readNumberEnv, readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';

const DEFAULT_TRAJECTORY_BACKGROUND_PROCESSOR_CONCURRENCY = 8;
const DEFAULT_TRAJECTORY_COMPRESSION_QUEUE_CONCURRENCY = 4;
const DEFAULT_TRAJECTORY_CLOUD_UPLOAD_QUEUE_CONCURRENCY = 16;
const DEFAULT_TRAJECTORY_ZSTD_THREADS = 2;
const DEFAULT_TRAJECTORY_CLOUD_UPLOAD_JOB_ATTEMPTS = 5;
const DEFAULT_TRAJECTORY_CLOUD_UPLOAD_JOB_BACKOFF_MS = 2000;
const DEFAULT_TRAJECTORY_PARQUET_INGEST_TIMEOUT_MS = 10 * 60 * 1000;

export const getTrajectoryBackgroundProcessorConcurrency = (): number => {
    return readNumberEnv(
        'TRAJECTORY_BACKGROUND_PROCESSOR_CONCURRENCY',
        DEFAULT_TRAJECTORY_BACKGROUND_PROCESSOR_CONCURRENCY
    );
};

export const getTrajectoryCompressionQueueConcurrency = (): number => {
    return readNumberEnv(
        'TRAJECTORY_COMPRESSION_QUEUE_CONCURRENCY',
        DEFAULT_TRAJECTORY_COMPRESSION_QUEUE_CONCURRENCY
    );
};

export const getTrajectoryCloudUploadQueueConcurrency = (): number => {
    return readNumberEnv(
        'TRAJECTORY_CLOUD_UPLOAD_QUEUE_CONCURRENCY',
        DEFAULT_TRAJECTORY_CLOUD_UPLOAD_QUEUE_CONCURRENCY
    );
};

export const getTrajectoryZstdThreads = (): number => {
    return readPositiveIntegerEnv(
        'TRAJECTORY_ZSTD_THREADS',
        DEFAULT_TRAJECTORY_ZSTD_THREADS
    );
};

export const getTrajectoryCloudUploadJobAttempts = (): number => {
    return readPositiveIntegerEnv(
        'TRAJECTORY_CLOUD_UPLOAD_JOB_ATTEMPTS',
        DEFAULT_TRAJECTORY_CLOUD_UPLOAD_JOB_ATTEMPTS
    );
};

export const getTrajectoryCloudUploadJobBackoffMs = (): number => {
    return readPositiveIntegerEnv(
        'TRAJECTORY_CLOUD_UPLOAD_JOB_BACKOFF_MS',
        DEFAULT_TRAJECTORY_CLOUD_UPLOAD_JOB_BACKOFF_MS
    );
};

export const getTrajectoryParquetIngestTimeoutMs = (): number => {
    return readPositiveIntegerEnv(
        'TRAJECTORY_PARQUET_INGEST_TIMEOUT_MS',
        DEFAULT_TRAJECTORY_PARQUET_INGEST_TIMEOUT_MS
    );
};
