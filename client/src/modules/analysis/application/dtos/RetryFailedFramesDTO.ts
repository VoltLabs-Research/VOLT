export interface RetryFailedFramesInputDTO {
    id: string;
};

export interface RetryFailedFramesOutputDTO {
    message: string;
    retriedFrames: number;
    totalFrames: number;
    failedTimesteps?: number[];
};
