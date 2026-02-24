import { readNumberEnv } from '@shared/infrastructure/utilities/env';

export const QUEUE_CONFIG = {
    analysisMaxConcurrentJobs: readNumberEnv('ANALYSIS_QUEUE_MAX_CONCURRENT_JOBS', 4),
    rasterizerMaxConcurrentJobs: readNumberEnv('RASTERIZER_QUEUE_MAX_CONCURRENT_JOBS', 4),
    trajectoryMaxConcurrentJobs: readNumberEnv('TRAJECTORY_QUEUE_MAX_CONCURRENT_JOBS', 4),
    cloudUploadMaxConcurrentJobs: readNumberEnv('CLOUD_UPLOAD_QUEUE_MAX_CONCURRENT_JOBS', 4),
};
