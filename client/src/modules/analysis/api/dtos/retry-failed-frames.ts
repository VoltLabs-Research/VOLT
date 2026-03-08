export interface RetryFailedFramesParams {
    analysisId: string;
};

export interface RetryFailedFramesResponse {
    message: string;
    retriedFrames: number;
    totalFrames: number;
    failedTimesteps?: number[];
};
