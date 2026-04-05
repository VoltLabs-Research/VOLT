import { readNumberEnv } from '@shared/infrastructure/utilities/env';

const DEFAULT_TRAJECTORY_BACKGROUND_PROCESSOR_CONCURRENCY = 5;
const DEFAULT_TRAJECTORY_COMPRESSION_QUEUE_CONCURRENCY = 1;

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
