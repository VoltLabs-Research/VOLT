import { readNumberEnv } from '@shared/infrastructure/utilities/env';

const DEFAULT_TRAJECTORY_BACKGROUND_PROCESSOR_CONCURRENCY = 5;

export const getTrajectoryBackgroundProcessorConcurrency = (): number => {
    return readNumberEnv(
        'TRAJECTORY_BACKGROUND_PROCESSOR_CONCURRENCY',
        DEFAULT_TRAJECTORY_BACKGROUND_PROCESSOR_CONCURRENCY
    );
};
