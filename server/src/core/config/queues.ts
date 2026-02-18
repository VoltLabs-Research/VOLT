export const QUEUE_CONFIG = {
    analysisMaxConcurrentJobs: Number(process.env.ANALYSIS_QUEUE_MAX_CONCURRENT_JOBS) || 4,
    rasterizerMaxConcurrentJobs: Number(process.env.RASTERIZER_QUEUE_MAX_CONCURRENT_JOBS) || 4,
    trajectoryMaxConcurrentJobs: Number(process.env.TRAJECTORY_QUEUE_MAX_CONCURRENT_JOBS) || 4,
    cloudUploadMaxConcurrentJobs: Number(process.env.CLOUD_UPLOAD_QUEUE_MAX_CONCURRENT_JOBS) || 4,
};
