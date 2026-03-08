export interface RetryFailedFramesInputDTO {
    analysisId: string;
    teamId: string;
    userId: string;
};

export interface RetryFailedFramesOutputDTO {
    message: string;
    retriedFrames: number;
    totalFrames: number;
    failedTimesteps?: number[];
};
